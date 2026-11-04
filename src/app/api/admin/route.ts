import { NextResponse, type NextRequest } from "next/server";
import type { InValue } from "@libsql/client";
import { sanitizeDriveLink } from "@/lib/helpers";

/**
 * /api/admin  —  Super Admin CRUD surface.
 *
 *   POST   create a row        body: { entity, data }
 *   PUT    update a row        body: { entity, id, data }   (app_config uses id=1)
 *   DELETE delete a row        body: { entity, id }         (or ?entity=&id=)
 *
 * Supported entities: classes, subjects, materials, live_classes, mock_tests,
 * app_config (app_config is a single row, id = 1 — PUT only, used for Force
 * Update + global settings).
 *
 * REQ-1.3 / REQ-2.1 / REQ-6.1 — admin-driven, dynamic, force-update control.
 */

type Entity =
  | "classes"
  | "subjects"
  | "materials"
  | "live_classes"
  | "mock_tests"
  | "app_config";

/** Columns that are safe to write per entity. `id` is handled separately. */
const WRITABLE_COLUMNS: Record<Entity, string[]> = {
  classes: ["title", "subtitle", "status", "banner_url", "sort_order"],
  subjects: [
    "class_id",
    "name",
    "trade_code",
    "icon_url",
    "teacher_name",
    "status",
  ],
  materials: [
    "subject_id",
    "title",
    "category",
    "file_url",
    "thumbnail_url",
    "is_important",
  ],
  live_classes: [
    "class_id",
    "subject_name",
    "title",
    "teacher_name",
    "stream_url",
    "is_live",
    "scheduled_time",
  ],
  mock_tests: ["subject_id", "title", "duration_minutes", "questions_json"],
  app_config: [
    "latest_version",
    "min_required_version",
    "force_update_active",
    "update_url",
    "update_message",
    "notice_banner",
    "ai_system_prompt",
  ],
};

const VALID_ENTITIES = new Set(Object.keys(WRITABLE_COLUMNS));

/** Lazy import: keeps this module loadable without TURSO_DATABASE_URL. */
async function getDb() {
  const { db, initDatabase } = await import("@/lib/db");
  await initDatabase();
  return db;
}

function isValidEntity(value: unknown): value is Entity {
  return typeof value === "string" && VALID_ENTITIES.has(value);
}

function guardConfigured(): NextResponse | null {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url || url.includes("your-db.turso.io")) {
    return NextResponse.json(
      {
        error:
          "Turso is not configured. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env.local to enable admin writes.",
      },
      { status: 503 }
    );
  }
  return null;
}

/** JSON-ify common inputs and sanitize file URLs where relevant. */
function normalizeData(
  entity: Entity,
  data: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data };

  // Auto-convert Google Drive links to embeddable /preview URLs (REQ-2.1).
  if (entity === "materials" && typeof out.file_url === "string") {
    out.file_url = sanitizeDriveLink(out.file_url);
  }

  // Store MCQ arrays as JSON text.
  if (
    entity === "mock_tests" &&
    out.questions_json !== undefined &&
    typeof out.questions_json !== "string"
  ) {
    out.questions_json = JSON.stringify(out.questions_json);
  }

  return out;
}

/** Pick only writable columns that are actually present in the payload. */
function pickColumns(entity: Entity, data: Record<string, unknown>) {
  const allowed = WRITABLE_COLUMNS[entity];
  const cols: string[] = [];
  const values: InValue[] = [];
  for (const col of allowed) {
    if (Object.prototype.hasOwnProperty.call(data, col)) {
      cols.push(col);
      values.push((data[col] ?? null) as InValue);
    }
  }
  return { cols, values };
}

function newId(entity: Entity): string {
  const prefix = entity.replace(/_/g, "-");
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/* --------------------------------- POST ---------------------------------- */

export async function POST(request: NextRequest) {
  const guard = guardConfigured();
  if (guard) return guard;

  try {
    const db = await getDb();
    const body = await request.json();
    const { entity, data } = body ?? {};

    if (!isValidEntity(entity)) {
      return NextResponse.json({ error: "Invalid entity" }, { status: 400 });
    }
    if (entity === "app_config") {
      return NextResponse.json(
        { error: "app_config is a singleton; use PUT to update it." },
        { status: 400 }
      );
    }
    if (!data || typeof data !== "object") {
      return NextResponse.json(
        { error: "Missing data object" },
        { status: 400 }
      );
    }

    const normalized = normalizeData(entity, data as Record<string, unknown>);
    const { cols, values } = pickColumns(entity, normalized);

    if (cols.length === 0) {
      return NextResponse.json(
        { error: "No valid columns to insert" },
        { status: 400 }
      );
    }

    const id = (normalized.id as string) || newId(entity);
    const allCols = ["id", ...cols];
    const placeholders = allCols.map(() => "?").join(", ");

    await db.execute({
      sql: `INSERT INTO ${entity} (${allCols.join(
        ", "
      )}) VALUES (${placeholders})`,
      args: [id, ...values],
    });

    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (err) {
    console.error("[/api/admin POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Insert failed" },
      { status: 500 }
    );
  }
}

/* ---------------------------------- PUT ---------------------------------- */

export async function PUT(request: NextRequest) {
  const guard = guardConfigured();
  if (guard) return guard;

  try {
    const db = await getDb();
    const body = await request.json();
    const { entity, id, data } = body ?? {};

    if (!isValidEntity(entity)) {
      return NextResponse.json({ error: "Invalid entity" }, { status: 400 });
    }
    if (!data || typeof data !== "object") {
      return NextResponse.json(
        { error: "Missing data object" },
        { status: 400 }
      );
    }

    const normalized = normalizeData(entity, data as Record<string, unknown>);
    const { cols, values } = pickColumns(entity, normalized);

    if (cols.length === 0) {
      return NextResponse.json(
        { error: "No valid columns to update" },
        { status: 400 }
      );
    }

    const setClause = cols.map((c) => `${c} = ?`).join(", ");

    if (entity === "app_config") {
      // Singleton row — always id = 1; ensure it exists first.
      await db.execute(
        "INSERT OR IGNORE INTO app_config (id) VALUES (1)"
      );
      await db.execute({
        sql: `UPDATE app_config SET ${setClause} WHERE id = 1`,
        args: values,
      });
      return NextResponse.json({ success: true, id: 1 });
    }

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Missing id for update" },
        { status: 400 }
      );
    }

    const result = await db.execute({
      sql: `UPDATE ${entity} SET ${setClause} WHERE id = ?`,
      args: [...values, id],
    });

    if (result.rowsAffected === 0) {
      return NextResponse.json(
        { error: `No ${entity} row found with id ${id}` },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, id });
  } catch (err) {
    console.error("[/api/admin PUT]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 500 }
    );
  }
}

/* -------------------------------- DELETE --------------------------------- */

export async function DELETE(request: NextRequest) {
  const guard = guardConfigured();
  if (guard) return guard;

  try {
    const db = await getDb();

    // Accept id/entity from JSON body or query string.
    let entity: unknown;
    let id: unknown;

    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => ({}));
      entity = body?.entity;
      id = body?.id;
    }
    if (!entity || !id) {
      const params = request.nextUrl.searchParams;
      entity = entity ?? params.get("entity");
      id = id ?? params.get("id");
    }

    if (!isValidEntity(entity)) {
      return NextResponse.json({ error: "Invalid entity" }, { status: 400 });
    }
    if (entity === "app_config") {
      return NextResponse.json(
        { error: "app_config cannot be deleted." },
        { status: 400 }
      );
    }
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const result = await db.execute({
      sql: `DELETE FROM ${entity} WHERE id = ?`,
      args: [id],
    });

    if (result.rowsAffected === 0) {
      return NextResponse.json(
        { error: `No ${entity} row found with id ${id}` },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, id });
  } catch (err) {
    console.error("[/api/admin DELETE]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    );
  }
}
