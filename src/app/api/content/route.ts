import { NextResponse } from "next/server";
import { buildDemoContent } from "@/lib/demo-content";

/**
 * GET /api/content
 *
 * Returns the full public dataset the student dashboard needs in one call:
 * classes, subjects, materials, live_classes, mock_tests, app_config, and the
 * top leaderboard users.
 *
 * REQ-1.1 / REQ-2.* / REQ-3.* / REQ-5.* — everything is dynamic.
 *
 * If Turso is not configured yet (placeholder TURSO_DATABASE_URL), the route
 * gracefully falls back to the shared demo data so the UI never crashes during
 * local development or demos. When Turso IS configured, only real DB rows are
 * returned (the admin page reads this endpoint too); the student page fills
 * empty sections with demo items on the client.
 */

function isTursoConfigured(): boolean {
  const url = process.env.TURSO_DATABASE_URL;
  return (
    !!url &&
    !url.includes("your-db.turso.io") &&
    url.trim().length > 0
  );
}

/* -------------------------------------------------------------------------- */
/*                               Mock fallback                                */
/* -------------------------------------------------------------------------- */

/** Shared demo dataset (see src/lib/demo-content.ts). */
function buildMockContent() {
  return buildDemoContent();
}

/* -------------------------------------------------------------------------- */
/*                                  Handler                                   */
/* -------------------------------------------------------------------------- */

export async function GET() {
  if (!isTursoConfigured()) {
    return NextResponse.json(buildMockContent());
  }

  try {
    // Lazy import: keeps this module loadable without TURSO_DATABASE_URL.
    const { db, initDatabase } = await import("@/lib/db");
    await initDatabase();

    const [
      classes,
      subjects,
      materials,
      liveClasses,
      mockTests,
      appConfig,
      leaderboard,
    ] = await Promise.all([
      db.execute("SELECT * FROM classes ORDER BY sort_order ASC"),
      db.execute("SELECT * FROM subjects ORDER BY name ASC"),
      db.execute("SELECT * FROM materials ORDER BY created_at DESC"),
      db.execute("SELECT * FROM live_classes ORDER BY is_live DESC"),
      db.execute("SELECT * FROM mock_tests ORDER BY title ASC"),
      db.execute("SELECT * FROM app_config WHERE id = 1"),
      db.execute(
        "SELECT id, name, avatar_url, xp_points, class_id FROM users ORDER BY xp_points DESC LIMIT 20"
      ),
    ]);

    return NextResponse.json({
      classes: classes.rows,
      subjects: subjects.rows,
      materials: materials.rows,
      live_classes: liveClasses.rows,
      mock_tests: mockTests.rows,
      app_config: appConfig.rows[0] ?? null,
      leaderboard: leaderboard.rows,
      source: "turso" as const,
    });
  } catch (err) {
    // Never let the dashboard crash — fall back to mock data and surface the
    // error for debugging.
    console.error("[/api/content] falling back to mock data:", err);
    return NextResponse.json({
      ...buildMockContent(),
      source: "mock-fallback" as const,
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
