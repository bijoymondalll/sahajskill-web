import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isTursoConfigured } from "@/lib/auth";

/**
 * /api/xp  -  XP sync for the signed-in student (Turso `users.xp_points`).
 *
 * GET  -> { xp_points } for the current user (401 when signed out).
 * POST { test_id: string, answers: Record<number, number> | number[] }
 *      -> grades the answers on the server against `mock_tests.questions_json`,
 *         adds XP_PER_CORRECT for each correct answer, and returns
 *         { xp_points, awarded, score, total }.
 *
 * The client never sends an XP amount, so the award is bounded by the real
 * test. Each user can be awarded XP for the same test at most once per
 * RESUBMIT_COOLDOWN_MS (tracked per server instance).
 *
 * Returns 404 for tests that are not in Turso (e.g. the built-in demo test),
 * 429 inside the cooldown, and 503 when Turso is not configured.
 */

const XP_PER_CORRECT = 10;
const RESUBMIT_COOLDOWN_MS = 60_000;

/** Last award time per `email:test_id` on this server instance. */
const lastAwardAt = new Map<string, number>();

type Question = { options?: unknown; ans?: unknown };

function parseQuestions(value: unknown): Question[] {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is Question =>
        !!item &&
        typeof item === "object" &&
        Array.isArray((item as Question).options) &&
        ((item as Question).options as unknown[]).length > 1 &&
        (typeof (item as Question).ans === "number" ||
          typeof (item as Question).ans === "string")
    );
  } catch {
    return [];
  }
}

/** Same rules as the client: numeric index, numeric string, or option text. */
function answerIndex(question: Question): number {
  const options = question.options as unknown[];
  if (typeof question.ans === "number") return question.ans;
  const numeric = Number(question.ans);
  if (Number.isInteger(numeric) && numeric >= 0 && numeric < options.length) {
    return numeric;
  }
  return options.findIndex((option) => option === question.ans);
}

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

  let testId: unknown;
  let answers: unknown;
  try {
    const body = await request.json();
    testId = body?.test_id;
    answers = body?.answers;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    typeof testId !== "string" ||
    !testId.trim() ||
    !answers ||
    typeof answers !== "object"
  ) {
    return NextResponse.json(
      { error: "`test_id` (string) and `answers` (object or array) are required" },
      { status: 400 }
    );
  }

  if (!isTursoConfigured()) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 }
    );
  }

  const cooldownKey = `${email}:${testId}`;
  const now = Date.now();
  const last = lastAwardAt.get(cooldownKey);
  if (last !== undefined && now - last < RESUBMIT_COOLDOWN_MS) {
    return NextResponse.json(
      { error: "XP for this test was awarded recently. Try again later." },
      { status: 429 }
    );
  }

  try {
    const db = await getDb();
    const testRes = await db.execute({
      sql: "SELECT questions_json FROM mock_tests WHERE id = ?",
      args: [testId],
    });
    const testRow = testRes.rows[0] as { questions_json?: unknown } | undefined;
    if (!testRow) {
      return NextResponse.json({ error: "Test not found" }, { status: 404 });
    }

    const questions = parseQuestions(testRow.questions_json);
    const given = answers as Record<string, unknown>;
    const score = questions.reduce((sum, question, index) => {
      const choice = given[String(index)];
      return sum +
        (typeof choice === "number" && choice === answerIndex(question) ? 1 : 0);
    }, 0);
    const awarded = score * XP_PER_CORRECT;

    if (awarded > 0) {
      await db.execute({
        sql: "UPDATE users SET xp_points = COALESCE(xp_points, 0) + ? WHERE email = ?",
        args: [awarded, email],
      });
    }
    lastAwardAt.set(cooldownKey, now);

    const xp = await readXp(email);
    if (xp === null) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({
      xp_points: xp,
      awarded,
      score,
      total: questions.length,
    });
  } catch (err) {
    console.error("[/api/xp] POST failed:", err);
    return NextResponse.json({ error: "Failed to update XP" }, { status: 500 });
  }
}
