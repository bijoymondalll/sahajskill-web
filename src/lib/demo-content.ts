/**
 * Shared demo content for SahajSkill.
 *
 * Pure data with no server-only imports, so it is safe to use from both the
 * `/api/content` route (when Turso is not configured) and the "use client"
 * student page (to fill sections the admin has not added content for yet).
 *
 * Subject and class ids match SEED_CLASSES / SEED_SUBJECTS in src/lib/db.ts.
 * Every demo row id that is not a seeded class/subject starts with "demo-".
 */

export type DemoClass = {
  id: string;
  title: string;
  subtitle: string | null;
  status: string;
  banner_url: string | null;
  sort_order: number;
};

export type DemoSubject = {
  id: string;
  class_id: string;
  name: string;
  trade_code: string | null;
  icon_url: string | null;
  teacher_name: string | null;
  status: string;
};

export type DemoMaterial = {
  id: string;
  subject_id: string;
  title: string;
  category: string;
  file_url: string;
  thumbnail_url: string | null;
  is_important: number;
  created_at: string;
};

export type DemoLiveClass = {
  id: string;
  class_id: string;
  subject_name: string;
  title: string;
  teacher_name: string;
  stream_url: string;
  is_live: number;
  scheduled_time: string | null;
};

export type DemoQuestion = {
  q: string;
  options: string[];
  ans: number;
  explanation?: string;
};

export type DemoMockTest = {
  id: string;
  subject_id: string;
  title: string;
  duration_minutes: number;
  questions_json: DemoQuestion[];
};

export type DemoAppConfig = {
  id: number;
  latest_version: string;
  min_required_version: string;
  force_update_active: number;
  update_url: string;
  update_message: string;
  notice_banner: string;
  ai_system_prompt: string;
};

export type DemoContent = {
  classes: DemoClass[];
  subjects: DemoSubject[];
  materials: DemoMaterial[];
  live_classes: DemoLiveClass[];
  mock_tests: DemoMockTest[];
  app_config: DemoAppConfig;
  leaderboard: never[];
  source: "mock";
};

const DEMO_CREATED_AT = "2025-01-01T00:00:00.000Z";

/** Mobile Wikipedia article URL (loads well inside the in-app viewer). */
function wiki(article: string): string {
  return `https://en.m.wikipedia.org/wiki/${article}`;
}

export const DEMO_CLASSES: DemoClass[] = [
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

export const DEMO_SUBJECTS: DemoSubject[] = [
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

function material(
  id: string,
  subject_id: string,
  title: string,
  category: "NOTE" | "SUGGESTION" | "VIDEO",
  file_url: string,
  is_important = 0
): DemoMaterial {
  return {
    id,
    subject_id,
    title,
    category,
    file_url,
    thumbnail_url: null,
    is_important,
    created_at: DEMO_CREATED_AT,
  };
}

export const DEMO_MATERIALS: DemoMaterial[] = [
  // ETIT
  material("demo-mat-etit-1", "sub-etit-12", "কম্পিউটারের মূল অংশ: CPU / Central Processing Unit (Demo)", "NOTE", wiki("Central_processing_unit")),
  material("demo-mat-etit-2", "sub-etit-12", "HTML বেসিক ও গুরুত্বপূর্ণ ট্যাগ / HTML Basics (Demo)", "SUGGESTION", wiki("HTML"), 1),
  material("demo-mat-etit-3", "sub-etit-12", "Web Design রিভিশন ক্লাস / Revision Video (Demo)", "VIDEO", "https://www.youtube.com/embed/jfKfPfyJRdk"),
  // EDCA
  material("demo-mat-edca-1", "sub-edca-12", "সেমিকন্ডাক্টর ও p-n জংশন / Semiconductors (Demo)", "NOTE", wiki("P%E2%80%93n_junction")),
  material("demo-mat-edca-2", "sub-edca-12", "ট্রানজিস্টর: গুরুত্বপূর্ণ প্রশ্ন / Transistor Suggestion (Demo)", "SUGGESTION", wiki("Transistor"), 1),
  material("demo-mat-edca-3", "sub-edca-12", "SQL ও ডেটাবেস বেসিক / SQL Basics (Demo)", "NOTE", wiki("SQL")),
  // Physics
  material("demo-mat-physics-1", "sub-physics-12", "ওহমের সূত্র / Ohm's Law Notes (Demo)", "NOTE", wiki("Ohm%27s_law")),
  material("demo-mat-physics-2", "sub-physics-12", "তড়িৎচুম্বকীয় আবেশ / Electromagnetic Induction Suggestion (Demo)", "SUGGESTION", wiki("Electromagnetic_induction"), 1),
  // Chemistry
  material("demo-mat-chemistry-1", "sub-chemistry-12", "মোল ধারণা / Mole Concept Notes (Demo)", "NOTE", wiki("Mole_(unit)")),
  material("demo-mat-chemistry-2", "sub-chemistry-12", "রাসায়নিক বন্ধন / Chemical Bonding Suggestion (Demo)", "SUGGESTION", wiki("Chemical_bond"), 1),
  // Mathematics
  material("demo-mat-math-1", "sub-math-12", "সমাকলন / Integration Notes (Demo)", "NOTE", wiki("Integral")),
  material("demo-mat-math-2", "sub-math-12", "ম্যাট্রিক্স ও নির্ণায়ক / Matrix & Determinant Suggestion (Demo)", "SUGGESTION", wiki("Matrix_(mathematics)"), 1),
];

export const DEMO_LIVE_CLASSES: DemoLiveClass[] = [
  {
    id: "demo-live",
    class_id: "class-12",
    subject_name: "ETIT",
    title: "Web Design Revision Class",
    teacher_name: "SahajSkill Faculty",
    stream_url: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
    is_live: 1,
    scheduled_time: null,
  },
];

export const DEMO_MOCK_TESTS: DemoMockTest[] = [
  {
    id: "demo-etit-test",
    subject_id: "sub-etit-12",
    title: "ETIT Quick Revision (Demo)",
    duration_minutes: 5,
    questions_json: [
      {
        q: "CPU-এর পূর্ণরূপ কী? / What is the full form of CPU?",
        options: [
          "Central Processing Unit",
          "Computer Personal Unit",
          "Central Program Utility",
          "Control Processing User",
        ],
        ans: 0,
        explanation:
          "CPU means Central Processing Unit. এটি কম্পিউটারের মূল processing অংশ।",
      },
      {
        q: "Which HTML tag creates a hyperlink?",
        options: ["<link>", "<a>", "<href>", "<url>"],
        ans: 1,
        explanation: "The anchor tag <a> creates a hyperlink in HTML.",
      },
      {
        q: "ওহমের সূত্র কোনটি? / Which is Ohm's law?",
        options: ["P = VI", "V = IR", "Q = It", "E = mc²"],
        ans: 1,
        explanation:
          "Ohm's law is V = IR, where V, I and R are voltage, current and resistance.",
      },
      {
        q: "1 Byte = কত bit? / How many bits make 1 byte?",
        options: ["4", "8", "16", "32"],
        ans: 1,
        explanation: "1 byte = 8 bits.",
      },
    ],
  },
  {
    id: "demo-edca-test",
    subject_id: "sub-edca-12",
    title: "EDCA Electronics Basics (Demo)",
    duration_minutes: 5,
    questions_json: [
      {
        q: "p-n জংশন ডায়োড কোন দিকে কারেন্ট চলতে দেয়? / A p-n junction diode conducts mainly in:",
        options: ["Reverse bias", "Forward bias", "Both equally", "Neither"],
        ans: 1,
        explanation:
          "Forward bias-এ depletion layer সরু হয়, তাই diode কারেন্ট চলতে দেয়।",
      },
      {
        q: "Transistor-এর তিনটি terminal কী কী?",
        options: [
          "Anode, Cathode, Gate",
          "Emitter, Base, Collector",
          "Source, Drain, Anode",
          "Input, Output, Ground",
        ],
        ans: 1,
        explanation: "A BJT has Emitter, Base and Collector terminals.",
      },
      {
        q: "সিলিকন একটি কী ধরনের পদার্থ? / Silicon is a:",
        options: ["Conductor", "Insulator", "Semiconductor", "Superconductor"],
        ans: 2,
        explanation: "Silicon is the most common semiconductor material.",
      },
      {
        q: "SQL-এ টেবিল থেকে ডেটা পড়তে কোন command লাগে? / Which SQL command reads data?",
        options: ["INSERT", "UPDATE", "SELECT", "DELETE"],
        ans: 2,
        explanation: "SELECT retrieves rows from a table.",
      },
    ],
  },
  {
    id: "demo-physics-test",
    subject_id: "sub-physics-12",
    title: "Physics Current Electricity (Demo)",
    duration_minutes: 5,
    questions_json: [
      {
        q: "রোধের SI একক কী? / What is the SI unit of resistance?",
        options: ["Volt", "Ampere", "Ohm", "Watt"],
        ans: 2,
        explanation: "Resistance is measured in ohm (Ω).",
      },
      {
        q: "V = 10 V এবং R = 5 Ω হলে কারেন্ট কত? / If V = 10 V and R = 5 Ω, current I = ?",
        options: ["0.5 A", "2 A", "5 A", "50 A"],
        ans: 1,
        explanation: "I = V / R = 10 / 5 = 2 A.",
      },
      {
        q: "বৈদ্যুতিক ক্ষমতার সূত্র কোনটি? / Electrical power P = ?",
        options: ["V / I", "VI", "I / R", "V + I"],
        ans: 1,
        explanation: "P = VI (watt).",
      },
      {
        q: "ফ্যারাডের তড়িৎচুম্বকীয় আবেশ কী নিয়ে? / Faraday's law is about:",
        options: [
          "Induced EMF from changing magnetic flux",
          "Gravitational force",
          "Refraction of light",
          "Radioactive decay",
        ],
        ans: 0,
        explanation:
          "Changing magnetic flux induces an EMF (তড়িৎচালক বল) in a circuit.",
      },
    ],
  },
  {
    id: "demo-chemistry-test",
    subject_id: "sub-chemistry-12",
    title: "Chemistry Mole & Bonding (Demo)",
    duration_minutes: 5,
    questions_json: [
      {
        q: "1 mole-এ কতগুলি কণা থাকে? / Avogadro number is approximately:",
        options: ["6.022 × 10²³", "3.0 × 10⁸", "1.6 × 10⁻¹⁹", "9.8"],
        ans: 0,
        explanation: "1 mole = 6.022 × 10²³ particles (Avogadro number).",
      },
      {
        q: "জলের (H₂O) মোলার ভর কত? / Molar mass of water is:",
        options: ["16 g/mol", "18 g/mol", "20 g/mol", "32 g/mol"],
        ans: 1,
        explanation: "2 × 1 (H) + 16 (O) = 18 g/mol.",
      },
      {
        q: "NaCl-এ কোন ধরনের বন্ধন থাকে? / NaCl has which bond?",
        options: ["Covalent", "Ionic", "Metallic", "Hydrogen"],
        ans: 1,
        explanation: "Na⁺ ও Cl⁻ আয়নের মধ্যে ionic bond থাকে।",
      },
      {
        q: "pH = 7 হলে দ্রবণটি কী? / A solution with pH 7 is:",
        options: ["Acidic", "Basic", "Neutral", "Salty"],
        ans: 2,
        explanation: "pH 7 is neutral at 25 °C.",
      },
    ],
  },
  {
    id: "demo-math-test",
    subject_id: "sub-math-12",
    title: "Mathematics Calculus & Matrix (Demo)",
    duration_minutes: 5,
    questions_json: [
      {
        q: "∫ x dx = ?",
        options: ["x² + C", "x²/2 + C", "2x + C", "1 + C"],
        ans: 1,
        explanation: "∫ xⁿ dx = xⁿ⁺¹/(n+1) + C, so ∫ x dx = x²/2 + C.",
      },
      {
        q: "d/dx (sin x) = ?",
        options: ["cos x", "−cos x", "sin x", "tan x"],
        ans: 0,
        explanation: "The derivative of sin x is cos x.",
      },
      {
        q: "2×2 identity matrix-এর determinant কত? / det(I₂) = ?",
        options: ["0", "1", "2", "4"],
        ans: 1,
        explanation: "det(I) = 1 × 1 − 0 × 0 = 1.",
      },
      {
        q: "∫ eˣ dx = ?",
        options: ["eˣ + C", "x·eˣ + C", "eˣ⁺¹ + C", "ln x + C"],
        ans: 0,
        explanation: "eˣ is its own integral: ∫ eˣ dx = eˣ + C.",
      },
    ],
  },
];

export const DEMO_APP_CONFIG: DemoAppConfig = {
  id: 1,
  latest_version: "1.0.0",
  min_required_version: "1.0.0",
  force_update_active: 0,
  update_url: "https://play.google.com",
  update_message: "নতুন ফিচার ও সাজেশন পেতে অ্যাপটি আপডেট কর!",
  notice_banner: "WBSCTVESD Class 12 Semester Suggestion Live Now!",
  ai_system_prompt:
    "You are a friendly WBSCTVESD Vocational teacher from West Bengal. Explain concepts clearly in colloquial Bengali and English.",
};

/** Full demo dataset shaped like the `/api/content` response. */
export function buildDemoContent(): DemoContent {
  return {
    classes: DEMO_CLASSES.map((item) => ({ ...item })),
    subjects: DEMO_SUBJECTS.map((item) => ({ ...item })),
    materials: DEMO_MATERIALS.map((item) => ({ ...item })),
    live_classes: DEMO_LIVE_CLASSES.map((item) => ({ ...item })),
    mock_tests: DEMO_MOCK_TESTS.map((item) => ({ ...item })),
    app_config: { ...DEMO_APP_CONFIG },
    leaderboard: [],
    source: "mock",
  };
}
