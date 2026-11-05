import type { NextRequest } from "next/server";

/**
 * POST /api/ai  -  AI Doubt Solver (REQ-4.1), powered by Google Gemini.
 *
 * Calls the Gemini REST API (`gemini-1.5-flash:generateContent`) with the key
 * from `GEMINI_API_KEY`. The system prompt (teacher persona plus the admin's
 * optional `ai_system_prompt` from Turso), recent chat history and the user
 * message are combined into one text string and sent as
 * `{ contents: [{ parts: [{ text }] }] }`.
 *
 * Body: { message: string, history?: {role: 'user' | 'assistant', content}[] }
 * Success (200): { reply: string, source: 'gemini' }
 * Errors: 400 bad body, 413 message too long, 500 missing GEMINI_API_KEY,
 * 502 Gemini call failed. Error bodies are { error: string }.
 *
 * Limits: `message` is capped at MAX_MESSAGE_CHARS, only the last
 * MAX_HISTORY_ENTRIES history turns are used (each trimmed to
 * MAX_HISTORY_ENTRY_CHARS), and the Gemini call times out after
 * GEMINI_TIMEOUT_MS.
 */

const TEACHER_PERSONA =
  "তুমি হলে 'SahajSkill AI স্যার' — পশ্চিমবঙ্গ ভোকেশনাল বোর্ডের (WBSCTVESD) Class 11 ও Class 12 (Engineering & IT - ETIT, EDCA, Physics, Chemistry, Math) এর একজন অভিজ্ঞ, সিরিয়াস এবং বন্ধুসুলভ শিক্ষক। কোনো ফালতু ইয়ার্কি বা অপ্রাসঙ্গিক কথা বলবে না। ছাত্রছাত্রীদের প্রশ্নের উত্তর একদম সহজ বাংলায় (প্রয়োজনে ইংরেজি টেকনিক্যাল টার্ম ব্যবহার করে) পয়েন্ট করে, উদাহরণ ও পরীক্ষার সাজেশন সহ বুঝিয়ে দেবে।";

/** Old seeded default in app_config; treated as "no custom prompt". */
const LEGACY_DEFAULT_PROMPT =
  "You are a friendly WBSCTVESD Vocational teacher from West Bengal. Explain concepts clearly in colloquial Bengali and English.";

const MAX_MESSAGE_CHARS = 2000;
const MAX_HISTORY_ENTRIES = 8;
const MAX_HISTORY_ENTRY_CHARS = 4000;
const GEMINI_TIMEOUT_MS = 20_000;

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: unknown }[] } }[];
};

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

/** Format recent client chat history as plain text lines. */
function formatHistory(history: unknown): string {
  if (!Array.isArray(history)) return "";
  const lines: string[] = [];
  for (const entry of history.slice(-MAX_HISTORY_ENTRIES)) {
    if (!entry || typeof entry !== "object") continue;
    const { role, content } = entry as { role?: unknown; content?: unknown };
    if (typeof content !== "string" || !content.trim()) continue;
    const text = content.slice(0, MAX_HISTORY_ENTRY_CHARS);
    if (role === "user") lines.push(`Student: ${text}`);
    else if (role === "assistant" || role === "model") lines.push(`Teacher: ${text}`);
  }
  return lines.join("\n");
}

/** Combine system prompt, history and the user message into one string. */
function buildFullPrompt(
  systemPrompt: string,
  history: unknown,
  message: string
): string {
  const conversation = formatHistory(history);
  return [
    systemPrompt,
    conversation ? `Previous conversation:\n${conversation}` : "",
    `Student's question:\n${message}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function POST(request: NextRequest) {
  let message = "";
  let history: unknown = [];

  try {
    const body = await request.json();
    message = typeof body?.message === "string" ? body.message : "";
    history = Array.isArray(body?.history) ? body.history : [];
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!message.trim()) {
    return Response.json({ error: "Missing `message`" }, { status: 400 });
  }

  if (message.length > MAX_MESSAGE_CHARS) {
    return Response.json(
      { error: `\`message\` must be at most ${MAX_MESSAGE_CHARS} characters` },
      { status: 413 }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    console.error("[/api/ai] GEMINI_API_KEY is missing in environment variables");
    return Response.json(
      { error: "GEMINI_API_KEY is missing in environment variables" },
      { status: 500 }
    );
  }

  const systemPrompt = await resolveSystemPrompt();
  const fullPromptText = buildFullPrompt(systemPrompt, history, message);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      body: JSON.stringify({ contents: [{ parts: [{ text: fullPromptText }] }] }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(
        `[/api/ai] Gemini responded ${res.status}: ${detail.slice(0, 500)}`
      );
      return Response.json(
        { error: `Gemini API request failed (${res.status})` },
        { status: 502 }
      );
    }

    const data = (await res.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const reply = typeof text === "string" ? text.trim() : "";

    if (!reply) {
      console.error(
        "[/api/ai] Gemini returned no text:",
        JSON.stringify(data).slice(0, 500)
      );
      return Response.json(
        { error: "Gemini API returned an empty response" },
        { status: 502 }
      );
    }

    return Response.json({ reply, source: "gemini" as const });
  } catch (err) {
    console.error("[/api/ai] Gemini call failed:", err);
    return Response.json(
      { error: "Gemini API call failed" },
      { status: 502 }
    );
  }
}
