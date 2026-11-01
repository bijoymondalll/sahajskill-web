# System Architecture & Database Design

## 1. Serverless Tech Stack (100% Free Tier, Zero Credit Card)
- **Framework:** Next.js 14 (App Router, TypeScript, Server Actions / API Routes)
- **Styling:** Tailwind CSS + Framer Motion + Lucide Icons (MacOS Liquid Glass Theme)
- **Database:** Turso (libSQL / SQLite at the Edge) via `@libsql/client`
- **Image CDN:** ImgBB API (`POST https://api.imgbb.com/1/upload`)
- **PDF/Video Storage:** Google Drive Preview Embeds + GitHub Raw + YouTube Unlisted
- **AI Engine:** Custom Cloudflare Worker Failover Router

## 2. Turso (libSQL) Complete Database Schema
```sql
-- 1. App Config & Force Update Table
CREATE TABLE IF NOT EXISTS app_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  latest_version TEXT DEFAULT '1.0.0',
  min_required_version TEXT DEFAULT '1.0.0',
  force_update_active INTEGER DEFAULT 0,
  update_url TEXT DEFAULT '[https://play.google.com](https://play.google.com)',
  update_message TEXT DEFAULT 'নতুন ফিচার ও সাজেশন পেতে অ্যাপটি আপডেট কর!',
  notice_banner TEXT DEFAULT 'WBSCTVESD Class 12 Semester Suggestion Live Now!',
  ai_worker_url TEXT,
  ai_system_prompt TEXT DEFAULT 'You are a friendly WBSCTVESD Vocational teacher from West Bengal. Explain concepts clearly in colloquial Bengali and English.'
);

-- 2. Users & Leaderboard Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  role TEXT DEFAULT 'student', -- 'student' | 'admin'
  class_id TEXT,
  xp_points INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Dynamic Classes Table (Class 11, Class 12, VOCLET)
CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL, -- e.g., 'Class 12 (HS Vocational)'
  subtitle TEXT,
  status TEXT DEFAULT 'ACTIVE', -- 'ACTIVE' | 'COMING_SOON' | 'HIDDEN'
  banner_url TEXT,
  sort_order INTEGER DEFAULT 1
);

-- 4. Dynamic Subjects & Trades Table (ETIT, EDCA, Electrical, Civil, PCM)
CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL,
  name TEXT NOT NULL, -- e.g., 'ETIT (Computer Application)', 'EDCA'
  trade_code TEXT, -- 'ETIT', 'ETEM', 'ETCC', 'COMMON'
  icon_url TEXT,
  teacher_name TEXT,
  status TEXT DEFAULT 'ACTIVE'
);

-- 5. Study Materials Table (Notes, Suggestions, Recorded Videos, Projects)
CREATE TABLE IF NOT EXISTS materials (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL, -- 'NOTE' | 'SUGGESTION' | 'VIDEO' | 'PROJECT'
  file_url TEXT NOT NULL, -- Google Drive / GitHub / YouTube link
  thumbnail_url TEXT,
  is_important INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. Live Classes Table
CREATE TABLE IF NOT EXISTS live_classes (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  title TEXT NOT NULL,
  teacher_name TEXT NOT NULL,
  stream_url TEXT NOT NULL, -- YouTube Live or Google Meet link
  is_live INTEGER DEFAULT 1, -- 1 = Live Now, 0 = Ended/Scheduled
  scheduled_time TEXT
);

-- 7. Mock Tests & MCQ Questions Table
CREATE TABLE IF NOT EXISTS mock_tests (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  title TEXT NOT NULL,
  duration_minutes INTEGER DEFAULT 15,
  questions_json TEXT NOT NULL -- JSON array of {q, options:[], ans, explanation}
);