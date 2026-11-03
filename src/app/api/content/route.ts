import { NextResponse } from "next/server";
import { db, initDatabase } from "@/lib/db";

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
 * gracefully falls back to seed/mock data so the UI never crashes during
 * local development or demos.
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

function buildMockContent() {
  const classes = [
    {
      id: "class-12",
      title: "Class 12 (HS Vocational)",
      subtitle: "WBSCTVESD Semester 3 & 4",
      status: "ACTIVE",
      banner_url: null,
      sort_order: 1,
    },
    {
      id: "class-11",
      title: "Class 11 (HS Vocational)",
      subtitle: "WBSCTVESD Semester 1 & 2",
      status: "COMING_SOON",
      banner_url: null,
      sort_order: 2,
    },
  ];

  const subjects = [
    {
      id: "sub-etit-12",
      class_id: "class-12",
      name: "ETIT (Computer Application)",
      trade_code: "ETIT",
      icon_url: null,
      teacher_name: "SahajSkill Faculty",
      status: "ACTIVE",
    },
    {
      id: "sub-edca-12",
      class_id: "class-12",
      name: "EDCA (Electronics)",
      trade_code: "EDCA",
      icon_url: null,
      teacher_name: "SahajSkill Faculty",
      status: "ACTIVE",
    },
    {
      id: "sub-physics-12",
      class_id: "class-12",
      name: "Physics",
      trade_code: "COMMON",
      icon_url: null,
      teacher_name: "SahajSkill Faculty",
      status: "ACTIVE",
    },
    {
      id: "sub-chemistry-12",
      class_id: "class-12",
      name: "Chemistry",
      trade_code: "COMMON",
      icon_url: null,
      teacher_name: "SahajSkill Faculty",
      status: "ACTIVE",
    },
    {
      id: "sub-math-12",
      class_id: "class-12",
      name: "Mathematics",
      trade_code: "COMMON",
      icon_url: null,
      teacher_name: "SahajSkill Faculty",
      status: "ACTIVE",
    },
  ];

  const materials = [
    {
      id: "mat-demo-1",
      subject_id: "sub-etit-12",
      title: "ETIT Semester 3 Full Suggestion (Demo)",
      category: "SUGGESTION",
      file_url: "https://drive.google.com/file/d/DEMO_FILE_ID/preview",
      thumbnail_url: null,
      is_important: 1,
      created_at: new Date().toISOString(),
    },
  ];

  const app_config = {
    id: 1,
    latest_version: "1.0.0",
    min_required_version: "1.0.0",
    force_update_active: 0,
    update_url: "https://play.google.com",
    update_message: "নতুন ফিচার ও সাজেশন পেতে অ্যাপটি আপডেট কর!",
    notice_banner: "WBSCTVESD Class 12 Semester Suggestion Live Now!",
    ai_worker_url: process.env.AI_WORKER_URL ?? null,
    ai_system_prompt:
      "You are a friendly WBSCTVESD Vocational teacher from West Bengal. Explain concepts clearly in colloquial Bengali and English.",
  };

  return {
    classes,
    subjects,
    materials,
    live_classes: [] as unknown[],
    mock_tests: [] as unknown[],
    app_config,
    leaderboard: [] as unknown[],
    source: "mock" as const,
  };
}

/* -------------------------------------------------------------------------- */
/*                                  Handler                                   */
/* -------------------------------------------------------------------------- */

export async function GET() {
  if (!isTursoConfigured()) {
    return NextResponse.json(buildMockContent());
  }

  try {
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
