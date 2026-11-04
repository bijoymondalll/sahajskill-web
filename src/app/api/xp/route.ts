import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isTursoConfigured } from "@/lib/auth";

/**
 * /api/xp  -  XP sync for the signed-in student (Turso `users.xp_points`).
 *
 * GET  -> { xp_points } for the current user (401 when signed out).
 * POST { points: number } -> adds `points` (positive integer, max 1000) and
 *        returns the new { xp_points }.
 *
 * Returns 503 when Turso is not configured.
 */

const MAX_POINTS_PER_REQUEST = 1000;

async function getSessionEmail(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim().toLowerCase();
  return email || null;
}

/** Lazy import: `@/lib/db` throws at import time without TURSO_DATABASE_URL. */
async function getDb() {
  const { db, initDatabase } = await import("@/lib/db");
  await initDatabase();
  return db;
}

async function readXp(email: string): Promise<number | null> {
  const db = await getDb();
  const res = await db.execute({
    sql: "SELECT xp_points FROM users WHERE email = ?",
    args: [email],
  });
  const row = res.rows[0] as { xp_points?: unknown } | undefined;
  if (!row) return null;
  return Number(row.xp_points ?? 0) || 0;
}

export async function GET() {
  const email = await getSessionEmail();
  if (!email) {
    return NextResponse.json(
      { error: "Not signed in", xp_points: 0 },
      { status: 401 }
    );
  }

  if (!isTursoConfigured()) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 }
    );
  }

  try {
    const xp = await readXp(email);
    return NextResponse.json({ xp_points: xp ?? 0 });
  } catch (err) {
    console.error("[/api/xp] GET failed:", err);
    return NextResponse.json({ error: "Failed to read XP" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const email = await getSessionEmail();
  if (!email) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let points: unknown;
  try {
    const body = await request.json();
    points = body?.points;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    typeof points !== "number" ||
    !Number.isInteger(points) ||
    points <= 0 ||
    points > MAX_POINTS_PER_REQUEST
  ) {
    return NextResponse.json(
      {
        error: `\`points\` must be a positive integer up to ${MAX_POINTS_PER_REQUEST}`,
      },
      { status: 400 }
    );
  }

  if (!isTursoConfigured()) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 }
    );
  }

  try {
    const db = await getDb();
    await db.execute({
      sql: "UPDATE users SET xp_points = COALESCE(xp_points, 0) + ? WHERE email = ?",
      args: [points, email],
    });
    const xp = await readXp(email);
    if (xp === null) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({ xp_points: xp });
  } catch (err) {
    console.error("[/api/xp] POST failed:", err);
    return NextResponse.json({ error: "Failed to update XP" }, { status: 500 });
  }
}
