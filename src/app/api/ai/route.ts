import { NextResponse, type NextRequest } from "next/server";

/**
 * POST /api/ai  -  AI Doubt Solver (REQ-4.1), powered by Google Gemini.
 *
 * Calls the official Gemini REST API directly using `GEMINI_API_KEY`, or
 * `GOOGLE_GENERATIVE_AI_API_KEY` when the first is unset, empty, or a
 * placeholder (starts with "your-"). The model is `gemini-2.5-flash`, with
 * an automatic retry on `gemini-1.5-flash` if the first call fails.
 *
 * The system instruction is a strict vocational teacher persona. If the admin
 * saved a custom `ai_system_prompt` in app_config (Turso), it is appended to
 * the persona as additional instructions.
 *
 * Body: { message: string, history?: {role: 'user' | 'assistant', content}[] }
 * Response: { reply: string, source: 'gemini' | 'fallback' | 'unavailable' }
 *
 * If no API key is set or Gemini is unreachable, a bilingual (Bengali +
 * English) fallback answer is returned so the chat UI always responds.
 *
 * Limits: `message` is capped at MAX_MESSAGE_CHARS (413 above that), only the
 * last MAX_HISTORY_ENTRIES history turns are used, each trimmed to
 * MAX_HISTORY_ENTRY_CHARS, and every Gemini call times out after
 * GEMINI_TIMEOUT_MS.
 */

const TEACHER_PERSONA =
  "তুমি হলে 'SahajSkill AI স্যার' — পশ্চিমবঙ্গ ভোকেশনাল বোর্ডের (WBSCTVESD) Class 11 ও Class 12 (Engineering & IT - ETIT, EDCA, Physics, Chemistry, Math) এর একজন অভিজ্ঞ, সিরিয়াস এবং বন্ধুসুলভ শিক্ষক। কোনো ফালতু ইয়ার্কি বা অপ্রাসঙ্গিক কথা বলবে না। ছাত্রছাত্রীদের প্রশ্নের উত্তর একদম সহজ বাংলায় (প্রয়োজনে ইংরেজি টেকনিক্যাল টার্ম ব্যবহার করে) পয়েন্ট করে, উদাহরণ ও পরীক্ষার সাজেশন সহ বুঝিয়ে দেবে।";

/** Old seeded default in app_config; treated as "no custom prompt". */
const LEGACY_DEFAULT_PROMPT =
  "You are a friendly WBSCTVESD Vocational teacher from West Bengal. Explain concepts clearly in colloquial Bengali and English.";

const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-1.5-flash"] as const;

const MAX_MESSAGE_CHARS = 2000;
const MAX_HISTORY_ENTRIES = 8;
const MAX_HISTORY_ENTRY_CHARS = 4000;
const GEMINI_TIMEOUT_MS = 20_000;

type GeminiContent = {
  role: "user" | "model";
  parts: { text: string }[];
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

/** Convert client chat history into Gemini `contents`. */
function toGeminiContents(history: unknown, message: string): GeminiContent[] {
  const contents: GeminiContent[] = [];

  if (Array.isArray(history)) {
    for (const entry of history.slice(-MAX_HISTORY_ENTRIES)) {
      if (!entry || typeof entry !== "object") continue;
      const { role, content } = entry as { role?: unknown; content?: unknown };
      if (typeof content !== "string" || !content.trim()) continue;
      const text = content.slice(0, MAX_HISTORY_ENTRY_CHARS);
      if (role === "user") {
        contents.push({ role: "user", parts: [{ text }] });
      } else if (role === "assistant" || role === "model") {
        contents.push({ role: "model", parts: [{ text }] });
      }
    }
  }

  // Gemini requires the conversation to start with a user turn.
  while (contents.length > 0 && contents[0].role !== "user") {
    contents.shift();
  }

  contents.push({ role: "user", parts: [{ text: message }] });
  return contents;
}

/** Call one Gemini model. Returns the reply text, or null on failure. */
async function callGemini(
  model: string,
  apiKey: string,
  systemPrompt: string,
  contents: GeminiContent[]
): Promise<string | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { temperature: 0.4 },
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(
        `[/api/ai] ${model} responded ${res.status}: ${detail.slice(0, 300)}`
      );
      return null;
    }

    const data = (await res.json().catch(() => null)) as {
      candidates?: { content?: { parts?: { text?: unknown }[] } }[];
    } | null;

    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const text = parts
      .map((p) => (typeof p?.text === "string" ? p.text : ""))
      .join("")
      .trim();

    return text || null;
  } catch (err) {
    console.error(`[/api/ai] ${model} call failed:`, err);
    return null;
  }
}

/** Bilingual answer used when a key is set but every Gemini call failed. */
function unavailableAnswer(): string {
  return [
    "⚠ **SahajSkill AI স্যার এখন সাময়িকভাবে উত্তর দিতে পারছে না।**",
    "",
    "AI সার্ভার থেকে উত্তর আসেনি। কিছুক্ষণ পরে আবার চেষ্টা করো। " +
      "The AI teacher is temporarily unavailable. Please try again in a moment.",
  ].join("\n");
}

/** Bilingual fallback answer used when no Gemini API key is configured. */
function fallbackAnswer(message: string): string {
  const q = message.trim();
  return [
    "🤖 **SahajSkill AI (Offline Demo Mode)**",
    "",
    `তোমার প্রশ্ন: "${q}"`,
    "",
    "এই মুহূর্তে Gemini AI কানেক্ট করা নেই, তাই এটি একটি ডেমো উত্তর (demo answer). " +
      "The live AI is not configured yet, so here is a helpful placeholder response.",
    "",
    "📘 **Study Tip / পড়ার টিপস:**",
    "- প্রশ্নটিকে ছোট ছোট অংশে ভাগ করো (break the problem into smaller parts).",
    "- WBSCTVESD সিলেবাস অনুযায়ী key definitions আর diagrams মুখস্থ না করে বুঝে পড়ো।",
    "- Practice previous year questions for ETIT / EDCA / Physics / Chemistry / Math.",
    "",
    "⚙ Admin, set a valid `GEMINI_API_KEY` (or `GOOGLE_GENERATIVE_AI_API_KEY`) to enable real answers.",
  ].join("\n");
}

export async function POST(request: NextRequest) {
  let message = "";
  let history: unknown = [];

  try {
    const body = await request.json();
    message = typeof body?.message === "string" ? body.message : "";
    history = Array.isArray(body?.history) ? body.history : [];
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!message.trim()) {
    return NextResponse.json(
      { error: "Missing `message`" },
      { status: 400 }
    );
  }

  if (message.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json(
      { error: `\`message\` must be at most ${MAX_MESSAGE_CHARS} characters` },
      { status: 413 }
    );
  }

  // First non-empty, non-placeholder key wins (an empty GEMINI_API_KEY must
  // not hide GOOGLE_GENERATIVE_AI_API_KEY).
  const apiKey =
    [process.env.GEMINI_API_KEY, process.env.GOOGLE_GENERATIVE_AI_API_KEY]
      .map((value) => value?.trim() ?? "")
      .find((value) => value && !value.startsWith("your-")) ?? "";

  if (!apiKey) {
    return NextResponse.json({
      reply: fallbackAnswer(message),
      source: "fallback" as const,
    });
  }

  const systemPrompt = await resolveSystemPrompt();
  const contents = toGeminiContents(history, message);

  for (const model of GEMINI_MODELS) {
    const reply = await callGemini(model, apiKey, systemPrompt, contents);
    if (reply) {
      return NextResponse.json({ reply, source: "gemini" as const });
    }
  }

  return NextResponse.json({
    reply: unavailableAnswer(),
    source: "unavailable" as const,
    error: "Gemini API call failed",
  });
}
