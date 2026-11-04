import { createClient, type Client } from "@libsql/client";

/**
 * Turso (libSQL) database client for SahajSkill.
 *
 * A single shared client is reused across hot reloads in development to avoid
 * exhausting connections. Schema creation + seeding is handled by
 * {@link initDatabase}, which is idempotent (safe to call repeatedly).
 */

const globalForDb = globalThis as unknown as {
  __sahajskillDb?: Client;
  __sahajskillDbInit?: Promise<void>;
};

function createDbClient(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error(
      "TURSO_DATABASE_URL is not set. Add it to your .env.local file."
    );
  }

  return createClient({ url, authToken });
}

export const db: Client = globalForDb.__sahajskillDb ?? createDbClient();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__sahajskillDb = db;
}

/* -------------------------------------------------------------------------- */
/*                                Schema (DDL)                                */
/* -------------------------------------------------------------------------- */

const SCHEMA_STATEMENTS: string[] = [
  // 1. App Config & Force Update
  `CREATE TABLE IF NOT EXISTS app_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    latest_version TEXT DEFAULT '1.0.0',
    min_required_version TEXT DEFAULT '1.0.0',
    force_update_active INTEGER DEFAULT 0,
    update_url TEXT DEFAULT 'https://play.google.com',
    update_message TEXT DEFAULT 'নতুন ফিচার ও সাজেশন পেতে অ্যাপটি আপডেট কর!',
    notice_banner TEXT DEFAULT 'WBSCTVESD Class 12 Semester Suggestion Live Now!',
    ai_worker_url TEXT,
    ai_system_prompt TEXT DEFAULT 'You are a friendly WBSCTVESD Vocational teacher from West Bengal. Explain concepts clearly in colloquial Bengali and English.'
  )`,

  // 2. Users & Leaderboard
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    avatar_url TEXT,
    role TEXT DEFAULT 'student',
    class_id TEXT,
    xp_points INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // 3. Dynamic Classes
  `CREATE TABLE IF NOT EXISTS classes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT,
    status TEXT DEFAULT 'ACTIVE',
    banner_url TEXT,
    sort_order INTEGER DEFAULT 1
  )`,

  // 4. Dynamic Subjects & Trades
  `CREATE TABLE IF NOT EXISTS subjects (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL,
    name TEXT NOT NULL,
    trade_code TEXT,
    icon_url TEXT,
    teacher_name TEXT,
    status TEXT DEFAULT 'ACTIVE'
  )`,

  // 5. Study Materials (Notes, Suggestions, Videos, Projects)
  `CREATE TABLE IF NOT EXISTS materials (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    file_url TEXT NOT NULL,
    thumbnail_url TEXT,
    is_important INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  // 6. Live Classes
  `CREATE TABLE IF NOT EXISTS live_classes (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL,
    subject_name TEXT NOT NULL,
    title TEXT NOT NULL,
    teacher_name TEXT NOT NULL,
    stream_url TEXT NOT NULL,
    is_live INTEGER DEFAULT 1,
    scheduled_time TEXT
  )`,

  // 7. Mock Tests & MCQ Questions
  `CREATE TABLE IF NOT EXISTS mock_tests (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL,
    title TEXT NOT NULL,
    duration_minutes INTEGER DEFAULT 15,
    questions_json TEXT NOT NULL
  )`,
];

/* -------------------------------------------------------------------------- */
/*                                Seed data                                   */
/* -------------------------------------------------------------------------- */

type SeedClass = {
  id: string;
  title: string;
  subtitle: string;
  status: "ACTIVE" | "COMING_SOON" | "HIDDEN";
  sort_order: number;
};

type SeedSubject = {
  id: string;
  class_id: string;
  name: string;
  trade_code: string;
  teacher_name: string;
};

const SEED_CLASSES: SeedClass[] = [
  {
    id: "class-12",
    title: "Class 12 (HS Vocational)",
    subtitle: "WBSCTVESD Semester 3 & 4",
    status: "ACTIVE",
    sort_order: 1,
  },
  {
    id: "class-11",
    title: "Class 11 (HS Vocational)",
    subtitle: "WBSCTVESD Semester 1 & 2",
    status: "COMING_SOON",
    sort_order: 2,
  },
];

const SEED_SUBJECTS: SeedSubject[] = [
  {
    id: "sub-etit-12",
    class_id: "class-12",
    name: "ETIT (Computer Application)",
    trade_code: "ETIT",
    teacher_name: "SahajSkill Faculty",
  },
  {
    id: "sub-edca-12",
    class_id: "class-12",
    name: "EDCA (Electronics)",
    trade_code: "EDCA",
    teacher_name: "SahajSkill Faculty",
  },
  {
    id: "sub-physics-12",
    class_id: "class-12",
    name: "Physics",
    trade_code: "COMMON",
    teacher_name: "SahajSkill Faculty",
  },
  {
    id: "sub-chemistry-12",
    class_id: "class-12",
    name: "Chemistry",
    trade_code: "COMMON",
    teacher_name: "SahajSkill Faculty",
  },
  {
    id: "sub-math-12",
    class_id: "class-12",
    name: "Mathematics",
    trade_code: "COMMON",
    teacher_name: "SahajSkill Faculty",
  },
];

/* -------------------------------------------------------------------------- */
/*                              Initialization                                */
/* -------------------------------------------------------------------------- */

async function runInit(): Promise<void> {
  // Create all tables.
  for (const statement of SCHEMA_STATEMENTS) {
    await db.execute(statement);
  }

  // Seed the single app_config row (id = 1). Only inserts if missing so admin
  // edits are never overwritten on restart.
  // The legacy `ai_worker_url` column stays in the schema for existing
  // databases, but nothing reads it since /api/ai calls Gemini directly.
  await db.execute(`INSERT OR IGNORE INTO app_config (id) VALUES (1)`);

  // Seed default classes.
  for (const c of SEED_CLASSES) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO classes (id, title, subtitle, status, sort_order)
            VALUES (?, ?, ?, ?, ?)`,
      args: [c.id, c.title, c.subtitle, c.status, c.sort_order],
    });
  }

  // Seed default subjects for the active Class 12.
  for (const s of SEED_SUBJECTS) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO subjects (id, class_id, name, trade_code, teacher_name, status)
            VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
      args: [s.id, s.class_id, s.name, s.trade_code, s.teacher_name],
    });
  }
}

/**
 * Idempotently create all tables and seed default data.
 *
 * Safe to call on every server start / request. The underlying work runs at
 * most once per process via a cached promise.
 */
export async function initDatabase(): Promise<void> {
  if (!globalForDb.__sahajskillDbInit) {
    globalForDb.__sahajskillDbInit = runInit().catch((err) => {
      // Reset the cache so a later call can retry after a transient failure.
      globalForDb.__sahajskillDbInit = undefined;
      throw err;
    });
  }
  return globalForDb.__sahajskillDbInit;
}
