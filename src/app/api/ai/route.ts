import { NextResponse, type NextRequest } from "next/server";
import { db, initDatabase } from "@/lib/db";

/**
 * POST /api/ai  —  AI Doubt Solver proxy (REQ-4.1).
 *
 * Forwards the student's question plus the admin-configured `ai_system_prompt`
 * to the custom Cloudflare Worker Multi-API Router (`AI_WORKER_URL` /
 * app_config.ai_worker_url).
 *
 * Body: { message: string, history?: {role, content}[] }
 *
 * If the worker URL is a placeholder / unreachable, a smart bilingual
 * (Bengali + English) vocational fallback answer is returned so the chat UI
 * always responds.
 */

export const dynamic = "force-dynamic";

const DEFAULT_SYSTEM_PROMPT =
  "You are a friendly WBSCTVESD Vocational teacher from West Bengal. Explain concepts clearly in colloquial Bengali and English.";

function isPlaceholderWorker(url: string | null | undefined): boolean {
  if (!url) return true;
  const u = url.trim();
  return (
    u.length === 0 ||
    u.includes("your-worker") ||
    u.includes("example.com") ||
    !/^https?:\/\//i.test(u)
  );
}

/** Resolve the worker URL + system prompt, preferring admin DB config. */
async function resolveAiConfig(): Promise<{
  workerUrl: string | null;
  systemPrompt: string;
}> {
  let workerUrl = process.env.AI_WORKER_URL ?? null;
  let systemPrompt = DEFAULT_SYSTEM_PROMPT;

  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoConfigured =
    !!tursoUrl && !tursoUrl.includes("your-db.turso.io");

  if (tursoConfigured) {
    try {
      await initDatabase();
      const res = await db.execute(
        "SELECT ai_worker_url, ai_system_prompt FROM app_config WHERE id = 1"
      );
      const row = res.rows[0] as
        | { ai_worker_url?: string | null; ai_system_prompt?: string | null }
        | undefined;
      if (row?.ai_worker_url) workerUrl = row.ai_worker_url;
      if (row?.ai_system_prompt) systemPrompt = row.ai_system_prompt;
    } catch (err) {
      console.error("[/api/ai] config lookup failed, using env defaults:", err);
    }
  }

  return { workerUrl, systemPrompt };
}

/** Bilingual fallback answer used when no live worker is available. */
function fallbackAnswer(message: string): string {
  const q = message.trim();
  return [
    "🤖 **SahajSkill AI (Offline Demo Mode)**",
    "",
    `তোমার প্রশ্ন: "${q}"`,
    "",
    "এই মুহূর্তে AI Worker কানেক্ট করা নেই, তাই এটি একটি ডেমো উত্তর (demo answer). " +
      "The live AI router is not configured yet, so here is a helpful placeholder response.",
    "",
    "📘 **Study Tip / পড়ার টিপস:**",
    "- প্রশ্নটিকে ছোট ছোট অংশে ভাগ করো (break the problem into smaller parts).",
    "- WBSCTVESD সিলেবাস অনুযায়ী key definitions আর diagrams মুখস্থ না করে বুঝে পড়ো।",
    "- Practice previous year questions for ETIT / EDCA / Physics / Chemistry / Math.",
    "",
    "⚙️ Admin, set a valid `AI_WORKER_URL` (or app_config.ai_worker_url) to enable real answers.",
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

  const { workerUrl, systemPrompt } = await resolveAiConfig();

  // No usable worker — return the bilingual fallback.
  if (isPlaceholderWorker(workerUrl)) {
    return NextResponse.json({
      reply: fallbackAnswer(message),
      source: "fallback" as const,
    });
  }

  try {
    const res = await fetch(workerUrl as string, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_prompt: systemPrompt,
        messages: [
          { role: "system", content: systemPrompt },
          ...(history as Array<{ role: string; content: string }>),
          { role: "user", content: message },
        ],
        // Also pass flat fields for simpler worker implementations.
        message,
      }),
    });

    if (!res.ok) {
      throw new Error(`Worker responded ${res.status}`);
    }

    const data = await res.json().catch(() => null);

    // Normalize common response shapes (OpenAI-style, {reply}, {response}, raw).
    const reply =
      data?.choices?.[0]?.message?.content ??
      data?.reply ??
      data?.response ??
      data?.answer ??
      (typeof data === "string" ? data : null);

    if (!reply) {
      return NextResponse.json({
        reply: fallbackAnswer(message),
        source: "fallback" as const,
        note: "Worker returned an unrecognized response shape.",
      });
    }

    return NextResponse.json({ reply, source: "worker" as const });
  } catch (err) {
    console.error("[/api/ai] worker call failed:", err);
    return NextResponse.json({
      reply: fallbackAnswer(message),
      source: "fallback" as const,
      error: err instanceof Error ? err.message : "Worker call failed",
    });
  }
}
