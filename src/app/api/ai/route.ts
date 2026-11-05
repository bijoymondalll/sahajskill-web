import { NextResponse, type NextRequest } from "next/server";

/**
 * POST /api/ai  -  AI Doubt Solver (REQ-4.1), powered by Google Gemini.
 *
 * Calls the Gemini REST API (`gemini-1.5-flash:generateContent`) with the key
 * from `GEMINI_API_KEY`. The system prompt (teacher persona plus the admin's
 * optional `ai_system_prompt` from Turso) and the user message are joined as
 * `systemPrompt + "\n\n" + userMessage` and sent as
 * `{ contents: [{ parts: [{ text }] }] }`.
 *
 * Body: { message: string }
 * Success (200): { text: string }
 * Gemini failure or missing key: { text: FALLBACK_TEXT, error: string } with
 * status 500 (missing GEMINI_API_KEY) or 502 (Gemini call failed).
 * Bad requests: 400 bad body, 413 message too long, body { error: string }.
 *
 * Limits: `message` is capped at MAX_MESSAGE_CHARS and the Gemini call times
 * out after GEMINI_TIMEOUT_MS.
 */

const TEACHER_PERSONA =
  "তুমি হলে 'SahajSkill AI স্যার' — পশ্চিমবঙ্গ ভোকেশনাল বোর্ডের (WBSCTVESD) Class 11 ও Class 12 (Engineering & IT - ETIT, EDCA, Physics, Chemistry, Math) এর একজন অভিজ্ঞ, সিরিয়াস এবং বন্ধুসুলভ শিক্ষক। কোনো ফালতু ইয়ার্কি বা অপ্রাসঙ্গিক কথা বলবে না। ছাত্রছাত্রীদের প্রশ্নের উত্তর একদম সহজ বাংলায় (প্রয়োজনে ইংরেজি টেকনিক্যাল টার্ম ব্যবহার করে) পয়েন্ট করে, উদাহরণ ও পরীক্ষার সাজেশন সহ বুঝিয়ে দেবে।";

/** Old seeded default in app_config; treated as "no custom prompt". */
const LEGACY_DEFAULT_PROMPT =
  "You are a friendly WBSCTVESD Vocational teacher from West Bengal. Explain concepts clearly in colloquial Bengali and English.";

/** Shown to the student whenever Gemini cannot answer. */
const FALLBACK_TEXT =
  "দুঃখিত, এই মুহূর্তে AI স্যার উত্তর দিতে পারছে না। একটু পরে আবার চেষ্টা করো।";

const MAX_MESSAGE_CHARS = 2000;
const GEMINI_TIMEOUT_MS = 20_000;

/** Merge the persona with the admin's custom prompt (if any). */
function buildSystemPrompt(customPrompt: string | null | undefined): string {
  const custom = customPrompt?.trim();
  if (
    !custom ||
    custom === LEGACY_DEFAULT_PROMPT ||
    custom === TEACHER_PERSONA
  ) {
    return TEACHER_PERSONA;
  }
  return `${TEACHER_PERSONA}\n\nAdditional instructions from the SahajSkill admin:\n${custom}`;
}

/** Resolve the system prompt, merging in the admin DB config when available. */
async function resolveSystemPrompt(): Promise<string> {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoConfigured =
    !!tursoUrl && !tursoUrl.includes("your-db.turso.io");

  if (!tursoConfigured) return TEACHER_PERSONA;

  try {
    // Lazy import: only load the DB module when Turso is configured.
    const { db, initDatabase } = await import("@/lib/db");
    await initDatabase();
    const res = await db.execute(
      "SELECT ai_system_prompt FROM app_config WHERE id = 1"
    );
    const row = res.rows[0] as
      | { ai_system_prompt?: string | null }
      | undefined;
    return buildSystemPrompt(row?.ai_system_prompt ?? null);
  } catch (err) {
    console.error("[/api/ai] config lookup failed, using persona only:", err);
    return TEACHER_PERSONA;
  }
}

function fallback(error: string, status: number) {
  return NextResponse.json({ text: FALLBACK_TEXT, error }, { status });
}

export async function POST(request: NextRequest) {
  let userMessage = "";

  try {
    const body = await request.json();
    userMessage = typeof body?.message === "string" ? body.message.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!userMessage) {
    return NextResponse.json({ error: "Missing `message`" }, { status: 400 });
  }

  if (userMessage.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json(
      { error: `\`message\` must be at most ${MAX_MESSAGE_CHARS} characters` },
      { status: 413 }
    );
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error("[/api/ai] GEMINI_API_KEY is missing in environment variables");
    return fallback("GEMINI_API_KEY is missing in environment variables", 500);
  }

  const systemPrompt = await resolveSystemPrompt();

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt + "\n\n" + userMessage }] }],
        }),
      }
    );

    if (!response.ok) {
      // Log Gemini's status and body so the real cause shows in server logs.
      const detail = await response.text().catch(() => "");
      console.error(
        `[/api/ai] Gemini responded ${response.status}: ${detail.slice(0, 500)}`
      );
      return fallback(`Gemini API request failed (${response.status})`, 502);
    }

    const data = await response.json();
    // Throws (and falls through to the catch) if the shape is unexpected.
    const reply = data.candidates[0].content.parts[0].text;

    if (typeof reply !== "string" || !reply.trim()) {
      console.error(
        "[/api/ai] Gemini returned no text:",
        JSON.stringify(data).slice(0, 500)
      );
      return fallback("Gemini API returned an empty response", 502);
    }

    return NextResponse.json({ text: reply });
  } catch (err) {
    console.error("[/api/ai] Gemini call failed:", err);
    return fallback("Gemini API call failed", 502);
  }
}
