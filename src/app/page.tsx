"use client";
/* eslint-disable @next/next/no-img-element */

import {
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bot,
  BrainCircuit,
  Check,
  ChevronRight,
  CircleUserRound,
  Clock3,
  ExternalLink,
  FileText,
  FlaskConical,
  GraduationCap,
  Home,
  Laptop,
  LibraryBig,
  Lightbulb,
  LoaderCircle,
  LockKeyhole,
  LogIn,
  LogOut,
  Maximize2,
  MessageCircleQuestion,
  MonitorPlay,
  Play,
  Radio,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Trophy,
  Video,
  X,
  XCircle,
  Zap,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*                                  Types                                     */
/* -------------------------------------------------------------------------- */

type ClassItem = {
  id: string;
  title: string;
  subtitle: string | null;
  status: "ACTIVE" | "COMING_SOON" | "HIDDEN" | string;
  banner_url: string | null;
  sort_order: number;
};

type Subject = {
  id: string;
  class_id: string;
  name: string;
  trade_code: string | null;
  icon_url: string | null;
  teacher_name: string | null;
  status: string;
};

type Material = {
  id: string;
  subject_id: string;
  title: string;
  category: "NOTE" | "SUGGESTION" | "VIDEO" | "PROJECT" | string;
  file_url: string;
  thumbnail_url: string | null;
  is_important: number;
  created_at: string;
};

type LiveClass = {
  id: string;
  class_id: string;
  subject_name: string;
  title: string;
  teacher_name: string;
  stream_url: string;
  is_live: number;
  scheduled_time: string | null;
};

type Question = {
  q: string;
  options: string[];
  ans: number | string;
  explanation?: string;
};

type MockTest = {
  id: string;
  subject_id: string;
  title: string;
  duration_minutes: number;
  questions_json: string | Question[];
};

type AppConfig = {
  id: number;
  latest_version: string;
  min_required_version: string;
  force_update_active: number;
  update_url: string;
  update_message: string;
  notice_banner: string;
};

type LeaderboardUser = {
  id: string;
  name: string;
  avatar_url: string | null;
  xp_points: number;
  class_id: string | null;
};

type ContentResponse = {
  classes: ClassItem[];
  subjects: Subject[];
  materials: Material[];
  live_classes: LiveClass[];
  mock_tests: MockTest[];
  app_config: AppConfig | null;
  leaderboard: LeaderboardUser[];
  source?: "turso" | "mock" | "mock-fallback";
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type Tab = "home" | "library" | "live" | "tests" | "ai";

/* -------------------------------------------------------------------------- */
/*                               Demo fallback                                */
/* -------------------------------------------------------------------------- */

const DEMO_TEST: MockTest = {
  id: "demo-etit-test",
  subject_id: "sub-etit-12",
  title: "ETIT Quick Revision",
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
      explanation: "Ohm's law is V = IR, where V, I and R are voltage, current and resistance.",
    },
  ],
};

const DEMO_LIVE: LiveClass = {
  id: "demo-live",
  class_id: "class-12",
  subject_name: "ETIT",
  title: "Web Design Revision Class",
  teacher_name: "SahajSkill Faculty",
  stream_url: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
  is_live: 1,
  scheduled_time: null,
};

const DEFAULT_CONFIG: AppConfig = {
  id: 1,
  latest_version: "1.0.0",
  min_required_version: "1.0.0",
  force_update_active: 0,
  update_url: "https://play.google.com",
  update_message: "নতুন ফিচার ও সাজেশন পেতে অ্যাপটি আপডেট কর!",
  notice_banner: "WBSCTVESD Class 12 Semester Suggestion Live Now!",
};

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

function parseQuestions(value: string | Question[]): Question[] {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is Question =>
        typeof item?.q === "string" &&
        Array.isArray(item.options) &&
        item.options.length > 1 &&
        (typeof item.ans === "number" || typeof item.ans === "string")
    );
  } catch {
    return [];
  }
}

function answerIndex(question: Question): number {
  if (typeof question.ans === "number") return question.ans;
  const numeric = Number(question.ans);
  if (Number.isInteger(numeric) && numeric >= 0 && numeric < question.options.length) {
    return numeric;
  }
  return question.options.findIndex((option) => option === question.ans);
}

function versionIsOlder(current: string, required: string): boolean {
  const a = current.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const b = required.split(".").map((part) => Number.parseInt(part, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if ((a[i] ?? 0) < (b[i] ?? 0)) return true;
    if ((a[i] ?? 0) > (b[i] ?? 0)) return false;
  }
  return false;
}

function getYoutubeEmbed(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) {
      return `https://www.youtube.com/embed/${parsed.pathname.slice(1)}`;
    }
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v") ?? parsed.pathname.split("/").filter(Boolean).pop();
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

async function fetchDashboardContent(): Promise<ContentResponse> {
  const response = await fetch("/api/content", { cache: "no-store" });
  if (!response.ok) throw new Error(`Content request failed (${response.status})`);
  return (await response.json()) as ContentResponse;
}

function subjectVisual(code: string | null, index: number) {
  const key = (code ?? "").toUpperCase();
  if (key === "ETIT") return { Icon: Laptop, gradient: "from-sky-400 to-blue-600" };
  if (key === "EDCA") return { Icon: Zap, gradient: "from-indigo-400 to-fuchsia-600" };
  if (key === "COMMON" && index % 3 === 0)
    return { Icon: FlaskConical, gradient: "from-emerald-400 to-teal-600" };
  if (key === "COMMON" && index % 3 === 1)
    return { Icon: Lightbulb, gradient: "from-amber-300 to-orange-600" };
  return { Icon: BrainCircuit, gradient: "from-rose-400 to-pink-600" };
}

/** Apple iOS 18 / visionOS style translucent white liquid glass surface. */
const LIQUID_GLASS =
  "rounded-3xl border border-white/90 bg-white/75 shadow-[0_8px_30px_rgb(14,165,233,0.07),inset_0_1px_1px_rgba(255,255,255,0.95)] backdrop-blur-2xl";

/** Quick vocational prompts shown at the top of the Ask AI view. */
const AI_PROMPT_CHIPS = [
  "ETIT সাজেশন দে",
  "EDCA SQL প্র্যাকটিস",
  "Physics Ohm's Law বাংলায় বোঝাও",
  "Chemistry Mole concept সহজে বোঝাও",
  "Math Integration-এর important প্রশ্ন",
];

function isAdminSession(user?: { role?: string; email?: string | null } | null): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL?.trim().toLowerCase();
  return !!adminEmail && user.email?.trim().toLowerCase() === adminEmail;
}

/** Gemini style floating pill used for inputs and the AI chat bar. */
const FLOATING_PILL =
  "rounded-full border border-slate-200/80 bg-white/85 shadow-[0_10px_40px_rgba(56,189,248,0.12)] backdrop-blur-2xl";

function GlassCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`${LIQUID_GLASS} ${className}`}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                Main page                                   */
/* -------------------------------------------------------------------------- */

export default function HomePage() {
  const [content, setContent] = useState<ContentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [viewerMaterial, setViewerMaterial] = useState<Material | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [studentXp, setStudentXp] = useState(0);
  const [playerOpen, setPlayerOpen] = useState(false);
  const { data: session, status: sessionStatus, update: updateSession } = useSession();
  const signedIn = sessionStatus === "authenticated" && !!session?.user;
  const sessionUserId = signedIn ? session?.user?.id : undefined;
  const sessionUserName = signedIn ? session?.user?.name : undefined;
  const sessionUserImage = signedIn ? session?.user?.image : undefined;
  const sessionXp = signedIn ? session?.user?.xp_points : undefined;

  const navigate = useCallback((tab: Tab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0 });
  }, []);

  const loadContent = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch("/api/content", { cache: "no-store" });
      if (!response.ok) throw new Error(`Content request failed (${response.status})`);
      const data = (await response.json()) as ContentResponse;
      setContent(data);
      const firstActive = data.classes.find((item) => item.status === "ACTIVE");
      setSelectedClassId((current) => current || firstActive?.id || "");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Content could not be loaded");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const storedXp = Number.parseInt(localStorage.getItem("sahajskill-xp") ?? "0", 10);
    queueMicrotask(() => {
      if (Number.isFinite(storedXp)) setStudentXp(storedXp);
    });

    fetchDashboardContent()
      .then((data) => {
        setContent(data);
        const firstActive = data.classes.find((item) => item.status === "ACTIVE");
        setSelectedClassId((current) => current || firstActive?.id || "");
      })
      .catch((error: unknown) => {
        setLoadError(error instanceof Error ? error.message : "Content could not be loaded");
      })
      .finally(() => setLoading(false));
  }, []);

  // Signed-in students use their Turso XP instead of the on-device value.
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled && typeof sessionXp === "number") setStudentXp(sessionXp);
    });
    fetch("/api/xp", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { xp_points?: unknown } | null) => {
        if (!cancelled && typeof data?.xp_points === "number") setStudentXp(data.xp_points);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [signedIn, sessionUserId, sessionXp]);

  const config = content?.app_config ?? DEFAULT_CONFIG;
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0";
  const forceUpdate =
    config.force_update_active === 1 &&
    versionIsOlder(appVersion, config.min_required_version);

  const visibleClasses = useMemo(
    () => content?.classes.filter((item) => item.status !== "HIDDEN") ?? [],
    [content]
  );
  const subjects = useMemo(
    () =>
      content?.subjects.filter(
        (item) => item.class_id === selectedClassId && item.status === "ACTIVE"
      ) ?? [],
    [content, selectedClassId]
  );
  const selectedMaterials = useMemo(
    () =>
      content?.materials.filter((item) => item.subject_id === selectedSubject?.id) ?? [],
    [content, selectedSubject]
  );
  const selectedClass = visibleClasses.find((item) => item.id === selectedClassId);
  const apiLiveClasses =
    content?.live_classes.filter(
      (item) => item.class_id === selectedClassId && item.is_live === 1
    ) ?? [];
  const liveClasses =
    apiLiveClasses.length > 0
      ? apiLiveClasses
      : content?.source !== "turso"
        ? [DEMO_LIVE]
        : [];
  const tests = content?.mock_tests.length ? content.mock_tests : [DEMO_TEST];

  const leaderboard = useMemo(() => {
    const users = [...(content?.leaderboard ?? [])].filter(
      (user) => user.id !== "local-student" && (!sessionUserId || user.id !== sessionUserId)
    );
    users.push({
      id: "local-student",
      name: sessionUserName ? `${sessionUserName} (You)` : "You / তুমি",
      avatar_url: sessionUserImage ?? null,
      xp_points: studentXp,
      class_id: selectedClassId,
    });
    return users.sort((a, b) => b.xp_points - a.xp_points).slice(0, 8);
  }, [content, selectedClassId, studentXp, sessionUserId, sessionUserName, sessionUserImage]);

  const leaderboardNote = signedIn
    ? "Your XP is synced to your SahajSkill account."
    : "Your XP is saved on this device. Sign in with Google to sync it.";

  const awardXp = useCallback(
    (points: number) => {
      const safePoints = Math.min(1000, Math.max(0, Math.round(points)));
      if (safePoints <= 0) return;
      if (!signedIn) {
        setStudentXp((current) => {
          const next = current + safePoints;
          localStorage.setItem("sahajskill-xp", String(next));
          return next;
        });
        return;
      }
      setStudentXp((current) => current + safePoints);
      fetch("/api/xp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points: safePoints }),
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((data: { xp_points?: unknown } | null) => {
          if (typeof data?.xp_points === "number") {
            setStudentXp(data.xp_points);
            void updateSession();
          }
        })
        .catch(() => undefined);
    },
    [signedIn, updateSession]
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#FFFFFF] to-[#F8FAFC] font-sans text-[#0F172A] selection:bg-sky-200">
      <AmbientBackground />
      <NoticeMarquee text={config.notice_banner} />

      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-36 pt-7 sm:px-6 lg:px-8">
        <Header xp={studentXp} source={content?.source} onHome={() => navigate("home")} />

        {loading ? (
          <LoadingState />
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={loadContent} />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            >
              {activeTab === "home" && (
                <div className="pt-12 sm:pt-16">
                  <Hero selectedClass={selectedClass} onExplore={() => navigate("library")} />
                  <ClassSelector
                    classes={visibleClasses}
                    selectedId={selectedClassId}
                    onSelect={(item) => {
                      if (item.status !== "ACTIVE") return;
                      setSelectedClassId(item.id);
                      setSelectedSubject(null);
                      setViewerMaterial(null);
                    }}
                  />
                  <QuickCards
                    subjectCount={subjects.length}
                    liveCount={liveClasses.length}
                    testCount={tests.length}
                    onNavigate={navigate}
                  />
                  <div className="mt-14">
                    <Leaderboard
                      users={leaderboard.slice(0, 5)}
                      note={leaderboardNote}
                      onViewAll={() => navigate("tests")}
                    />
                  </div>
                </div>
              )}

              {activeTab === "library" && (
                <div className="pt-12">
                  <SectionHeading
                    eyebrow="Your subjects"
                    title="আজ কী পড়বে?"
                    description="Choose a subject, then open notes and exam suggestions inside the app."
                  />
                  <SubjectGrid
                    subjects={subjects}
                    selectedSubject={selectedSubject}
                    onSelect={(subject) => {
                      setSelectedSubject(subject);
                      setViewerMaterial(null);
                    }}
                  />
                  <MaterialViewer
                    subject={selectedSubject}
                    materials={selectedMaterials}
                    viewerMaterial={viewerMaterial}
                    onOpen={setViewerMaterial}
                    onClose={() => setViewerMaterial(null)}
                  />
                </div>
              )}

              {activeTab === "live" && (
                <div className="pt-12">
                  <SectionHeading
                    eyebrow="Live classroom"
                    title="এখন শেখো, একসাথে"
                    description="Join live revision classes without leaving SahajSkill."
                  />
                  <LiveClassPanel
                    liveClass={liveClasses[0] ?? null}
                    isDemo={apiLiveClasses.length === 0 && liveClasses.length > 0}
                    playerOpen={playerOpen}
                    setPlayerOpen={setPlayerOpen}
                  />
                </div>
              )}

              {activeTab === "tests" && (
                <div className="pt-12">
                  <SectionHeading
                    eyebrow="Mock test lab"
                    title="Practice. Score. Level up."
                    description="Timed MCQs, instant explanations, and XP for every correct answer."
                  />
                  <MockTestEngine
                    tests={tests}
                    onAwardXp={awardXp}
                    leaderboard={leaderboard}
                    leaderboardNote={leaderboardNote}
                  />
                </div>
              )}

              {activeTab === "ai" && (
                <div className="pt-6">
                  <AiChat />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      <Dock active={activeTab} onNavigate={navigate} />

      <AnimatePresence>
        {forceUpdate && <ForceUpdateBlocker config={config} currentVersion={appVersion} />}
      </AnimatePresence>
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Page furniture                                */
/* -------------------------------------------------------------------------- */

function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden bg-gradient-to-b from-[#FFFFFF] to-[#F8FAFC]">
      <div className="absolute top-[18%] left-1/2 h-[42rem] w-[min(68rem,140vw)] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,#E0F2FE_0%,#DBEAFE_38%,#EEF2FF_62%,transparent_78%)] opacity-60 blur-3xl" />
      <div className="absolute -top-40 -right-32 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle_at_center,#EEF2FF_0%,transparent_70%)] opacity-60 blur-3xl" />
      <div className="absolute -bottom-40 -left-32 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle_at_center,#E0F2FE_0%,transparent_70%)] opacity-60 blur-3xl" />
    </div>
  );
}

function NoticeMarquee({ text }: { text: string }) {
  return (
    <div className="relative z-20 overflow-hidden border-b border-white/90 bg-white/70 py-2.5 shadow-[inset_0_-1px_0_rgba(226,232,240,0.7)] backdrop-blur-2xl">
      <motion.div
        className="flex w-max items-center gap-12 whitespace-nowrap text-xs font-semibold tracking-[0.18em] text-sky-700 uppercase"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
      >
        {[0, 1, 2, 3].map((item) => (
          <span key={item} className="flex items-center gap-3">
            <Sparkles className="h-3.5 w-3.5 text-sky-600" /> {text}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

function Header({ xp, source, onHome }: { xp: number; source?: string; onHome: () => void }) {
  return (
    <header className={`${LIQUID_GLASS} relative z-30 flex items-center justify-between px-4 py-3 sm:px-5`}>
      <button onClick={onHome} className="group flex items-center gap-3 text-left">
        <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/90 bg-gradient-to-br from-sky-100 to-indigo-100 shadow-[inset_0_1px_1px_rgba(255,255,255,0.95)]">
          <GraduationCap className="h-6 w-6 text-sky-700" />
        </span>
        <span>
          <span className="block text-lg font-bold tracking-tight">SahajSkill</span>
          <span className="block text-[10px] tracking-[0.22em] text-slate-500 uppercase">VocaLearn AI</span>
        </span>
      </button>
      <div className="flex items-center gap-2.5">
        {source && (
          <span className="hidden rounded-full border border-slate-200/80 bg-slate-100/70 px-3 py-2 text-[10px] font-semibold tracking-wider text-slate-600 uppercase sm:block">
            {source === "turso" ? "Live data" : "Demo data"}
          </span>
        )}
        <div className="flex items-center gap-2 rounded-full border border-amber-300/60 bg-amber-300/10 px-3.5 py-2 text-sm font-bold text-amber-700 backdrop-blur-xl">
          <Zap className="h-4 w-4 fill-amber-300 text-amber-600" /> {xp} XP
        </div>
        <AccountButton />
      </div>
    </header>
  );
}

function AccountButton() {
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const user = status === "authenticated" ? session?.user : undefined;
  const isAdmin = isAdminSession(user);

  if (!user) {
    return (
      <button
        type="button"
        onClick={() => void signIn("google")}
        disabled={status === "loading"}
        aria-label="Sign in with Google"
        className="flex h-10 items-center gap-2 rounded-full border border-slate-200/80 bg-slate-100/70 px-2.5 text-xs font-semibold text-slate-700 transition hover:bg-white disabled:opacity-60 sm:px-3.5"
      >
        {status === "loading" ? (
          <LoaderCircle className="h-5 w-5 animate-spin text-slate-500" />
        ) : (
          <LogIn className="h-5 w-5 text-slate-600" />
        )}
        <span className="hidden sm:inline">Sign in</span>
      </button>
    );
  }

  return (
    <div className="relative flex items-center gap-2">
      {isAdmin && (
        <Link
          href="/admin"
          className="hidden items-center gap-1.5 rounded-full bg-sky-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-sky-700 sm:flex"
        >
          <ShieldCheck className="h-4 w-4" /> Admin Panel
        </Link>
      )}
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-label="Account menu"
        aria-expanded={menuOpen}
        className="grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-slate-200/80 bg-slate-100/70"
      >
        {user.image ? (
          <img src={user.image} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
        ) : (
          <CircleUserRound className="h-5 w-5 text-slate-600" />
        )}
      </button>
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            className={`${LIQUID_GLASS} absolute top-12 right-0 w-64 p-3`}
          >
            <div className="px-2 py-1.5">
              <p className="truncate text-sm font-bold">{user.name ?? "SahajSkill student"}</p>
              {user.email && <p className="truncate text-xs text-slate-500">{user.email}</p>}
              <p className="mt-1 text-[10px] font-bold tracking-wider text-sky-600 uppercase">{isAdmin ? "Admin" : "Student"}</p>
            </div>
            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setMenuOpen(false)}
                className="mt-2 flex items-center gap-2 rounded-xl px-2 py-2.5 text-sm font-semibold text-sky-700 hover:bg-sky-50"
              >
                <ShieldCheck className="h-4 w-4" /> Admin Panel
              </Link>
            )}
            <button
              type="button"
              onClick={() => void signOut()}
              className="mt-1 flex w-full items-center gap-2 rounded-xl px-2 py-2.5 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function QuickCards({ subjectCount, liveCount, testCount, onNavigate }: { subjectCount: number; liveCount: number; testCount: number; onNavigate: (tab: Tab) => void }) {
  const cards: Array<{ tab: Tab; title: string; detail: string; Icon: typeof FileText; tone: string }> = [
    { tab: "library", title: "Library", detail: `${subjectCount} subjects • Notes & Suggestions`, Icon: LibraryBig, tone: "from-sky-100 to-blue-100 text-sky-700" },
    { tab: "live", title: "Live", detail: liveCount ? `${liveCount} class live now` : "No class live now", Icon: Radio, tone: "from-rose-100 to-pink-100 text-rose-700" },
    { tab: "tests", title: "Tests", detail: `${testCount} mock tests • Earn XP`, Icon: Trophy, tone: "from-amber-100 to-orange-100 text-amber-700" },
    { tab: "ai", title: "Ask AI", detail: "SahajSkill AI স্যার • বাংলা + English", Icon: Bot, tone: "from-indigo-100 to-violet-100 text-indigo-700" },
  ];
  return (
    <div className="mt-14">
      <p className="text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase">Quick overview</p>
      <h2 className="mt-2 mb-4 text-xl font-bold">কোথা থেকে শুরু করবে?</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ tab, title, detail, Icon, tone }) => (
          <motion.button
            key={tab}
            type="button"
            onClick={() => onNavigate(tab)}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            className={`${LIQUID_GLASS} group flex items-center gap-4 p-5 text-left transition hover:bg-white/90`}
          >
            <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${tone}`}>
              <Icon className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold">{title}</span>
              <span className="mt-1 block truncate text-xs text-slate-500">{detail}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-1" />
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function Hero({ selectedClass, onExplore }: { selectedClass?: ClassItem; onExplore: () => void }) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_.85fr]">
      <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-sky-300/60 bg-sky-400/10 px-3.5 py-2 text-xs font-semibold text-sky-700">
          <Sparkles className="h-3.5 w-3.5" /> Made for WBSCTVESD students
        </div>
        <h1 className="max-w-3xl text-4xl leading-[1.08] font-black tracking-[-0.045em] sm:text-6xl lg:text-7xl">
          Vocational learning,
          <span className="block bg-gradient-to-r from-[#0284C7] via-blue-600 to-[#4F46E5] bg-clip-text text-transparent">
            এবার আরও সহজ।
          </span>
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
          Notes, live classes, mock tests and an AI teacher in one calm study space, built for Bengali and English learners.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button onClick={onExplore} className="group flex items-center gap-2 rounded-2xl bg-sky-600 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-sky-700">
            Start learning <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>
          <div className={`${FLOATING_PILL} flex items-center gap-2 px-5 py-3.5 text-sm text-[#475569]`}>
            <BookOpen className="h-4 w-4 text-sky-600" /> {selectedClass?.title ?? "Choose your class"}
          </div>
        </div>
      </motion.div>
      <motion.div initial={{ opacity: 0, scale: 0.94, rotate: 2 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ duration: 0.65, delay: 0.08 }}>
        <GlassCard className="relative overflow-hidden p-5 sm:p-7">
          <div className="absolute inset-0 bg-gradient-to-br from-sky-100/60 via-transparent to-indigo-100/60" />
          <div className="relative">
            <div className="mb-10 flex items-center justify-between">
              <span className="rounded-full border border-emerald-300/60 bg-emerald-400/10 px-3 py-1.5 text-[10px] font-bold tracking-wider text-emerald-700 uppercase">Learning cockpit</span>
              <BrainCircuit className="h-6 w-6 text-indigo-600" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Notes", "Smart study material", FileText, "text-sky-600"],
                ["Live", "Teacher-led sessions", Radio, "text-rose-600"],
                ["Tests", "Earn leaderboard XP", Trophy, "text-amber-600"],
                ["AI Tutor", "Bengali + English", Bot, "text-indigo-600"],
              ].map(([title, subtitle, Icon, color]) => {
                const CardIcon = Icon as typeof FileText;
                return (
                  <div key={String(title)} className="rounded-2xl border border-slate-200/80 bg-white/60 p-4">
                    <CardIcon className={`mb-5 h-5 w-5 ${color}`} />
                    <p className="font-bold">{String(title)}</p>
                    <p className="mt-1 text-xs text-slate-500">{String(subtitle)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}

function ClassSelector({ classes, selectedId, onSelect }: { classes: ClassItem[]; selectedId: string; onSelect: (item: ClassItem) => void }) {
  return (
    <div className="mt-14">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase">Class selector</p>
          <h2 className="mt-2 text-xl font-bold">তোমার ক্লাস বেছে নাও</h2>
        </div>
        <span className="text-xs text-slate-500">Controlled by Admin</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {classes.map((item, index) => {
          const locked = item.status !== "ACTIVE";
          const selected = item.id === selectedId;
          return (
            <motion.button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              disabled={locked}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              whileHover={locked ? undefined : { y: -4 }}
              className={`relative overflow-hidden rounded-[1.65rem] border p-5 text-left backdrop-blur-2xl transition ${
                selected
                  ? "border-sky-300 bg-sky-50/80 shadow-[0_8px_30px_rgb(14,165,233,0.12),inset_0_1px_1px_rgba(255,255,255,0.95)]"
                  : "border-white/90 bg-white/75 shadow-[0_8px_30px_rgb(14,165,233,0.07),inset_0_1px_1px_rgba(255,255,255,0.95)] hover:bg-white/90"
              } ${locked ? "cursor-not-allowed opacity-60" : ""}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <span className={`grid h-12 w-12 place-items-center rounded-2xl ${locked ? "bg-slate-100/70" : "bg-gradient-to-br from-sky-100 to-blue-100"}`}>
                    {locked ? <LockKeyhole className="h-5 w-5 text-slate-600" /> : <GraduationCap className="h-6 w-6 text-sky-700" />}
                  </span>
                  <div>
                    <p className="font-bold">{item.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.subtitle}</p>
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[9px] font-black tracking-wider ${locked ? "bg-amber-300/10 text-amber-700" : "bg-emerald-400/10 text-emerald-700"}`}>
                  {locked ? "COMING SOON" : selected ? "SELECTED" : "ACTIVE"}
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="mb-7 max-w-2xl">
      <p className="text-xs font-bold tracking-[0.2em] text-sky-600 uppercase">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-500 sm:text-base">{description}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               Live classes                                 */
/* -------------------------------------------------------------------------- */

function LiveClassPanel({ liveClass, isDemo, playerOpen, setPlayerOpen }: { liveClass: LiveClass | null; isDemo: boolean; playerOpen: boolean; setPlayerOpen: (open: boolean) => void }) {
  if (!liveClass) {
    return (
      <GlassCard className="flex min-h-48 items-center justify-center p-8 text-center">
        <div><Video className="mx-auto h-8 w-8 text-slate-400" /><p className="mt-4 font-bold">No class is live right now</p><p className="mt-2 text-sm text-slate-500">পরের ক্লাসের আপডেট এখানে দেখাবে।</p></div>
      </GlassCard>
    );
  }

  const youtubeEmbed = getYoutubeEmbed(liveClass.stream_url);
  const isMeet = liveClass.stream_url.includes("meet.google.com");

  return (
    <GlassCard className="overflow-hidden">
      <div className="relative grid gap-0 lg:grid-cols-[.82fr_1.18fr]">
        <div className="relative flex min-h-72 flex-col justify-between overflow-hidden p-6 sm:p-8">
          <div className="absolute inset-0 bg-gradient-to-br from-rose-100/70 via-transparent to-indigo-100/60" />
          <div className="relative">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-2 rounded-full bg-rose-500 px-3 py-1.5 text-[10px] font-black tracking-wider text-white uppercase shadow-lg shadow-rose-500/25">
                <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-white" /></span>
                Live now
              </span>
              {isDemo && <span className="rounded-full border border-slate-200/80 bg-slate-100/70 px-3 py-1.5 text-[10px] text-slate-600">DEMO</span>}
            </div>
            <p className="mt-7 text-sm font-semibold text-rose-700">{liveClass.subject_name}</p>
            <h3 className="mt-2 text-2xl font-black sm:text-3xl">{liveClass.title}</h3>
            <p className="mt-3 text-sm text-slate-500">with {liveClass.teacher_name}</p>
          </div>
          <div className="relative mt-8 flex flex-wrap gap-3">
            {isMeet ? (
              <a href={liveClass.stream_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold text-white hover:bg-sky-700">
                Join Google Meet <ExternalLink className="h-4 w-4" />
              </a>
            ) : (
              <button onClick={() => setPlayerOpen(!playerOpen)} className="flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold text-white hover:bg-sky-700">
                {playerOpen ? <X className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />} {playerOpen ? "Close player" : "Watch here"}
              </button>
            )}
          </div>
        </div>
        <div className="grid min-h-72 place-items-center border-t border-slate-200/80 bg-white/60 p-3 lg:border-t-0 lg:border-l">
          {playerOpen && youtubeEmbed ? (
            <iframe className="aspect-video w-full rounded-2xl" src={youtubeEmbed} title={liveClass.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
          ) : (
            <button onClick={() => youtubeEmbed && setPlayerOpen(true)} className="group flex flex-col items-center text-slate-500">
              <span className="grid h-20 w-20 place-items-center rounded-full border border-white/90 bg-white/85 shadow-[0_10px_40px_rgba(56,189,248,0.12)] transition group-hover:bg-white"><Play className="h-7 w-7 fill-sky-600 text-sky-600" /></span>
              <span className="mt-4 text-sm">{isMeet ? "Google Meet opens in a new tab" : "Open embedded classroom"}</span>
            </button>
          )}
        </div>
      </div>
    </GlassCard>
  );
}

/* -------------------------------------------------------------------------- */
/*                            Subjects and materials                          */
/* -------------------------------------------------------------------------- */

function SubjectGrid({ subjects, selectedSubject, onSelect }: { subjects: Subject[]; selectedSubject: Subject | null; onSelect: (subject: Subject) => void }) {
  if (!subjects.length) return <GlassCard className="p-8 text-center text-sm text-slate-500">No active subjects have been added for this class yet.</GlassCard>;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {subjects.map((subject, index) => {
        const { Icon, gradient } = subjectVisual(subject.trade_code, index);
        const selected = selectedSubject?.id === subject.id;
        return (
          <motion.button key={subject.id} onClick={() => onSelect(subject)} whileHover={{ y: -6 }} whileTap={{ scale: 0.98 }} className={`group rounded-3xl border p-5 text-left backdrop-blur-2xl transition ${selected ? "border-sky-300 bg-sky-50/80 shadow-[0_8px_30px_rgb(14,165,233,0.12),inset_0_1px_1px_rgba(255,255,255,0.95)]" : "border-white/90 bg-white/75 shadow-[0_8px_30px_rgb(14,165,233,0.07),inset_0_1px_1px_rgba(255,255,255,0.95)] hover:bg-white/90"}`}>
            {subject.icon_url ? (
              <img src={subject.icon_url} alt="" className="h-12 w-12 rounded-2xl object-cover" />
            ) : (
              <span className={`grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${gradient} shadow-lg`}><Icon className="h-6 w-6 text-white" /></span>
            )}
            <p className="mt-6 line-clamp-2 font-bold">{subject.name}</p>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>{subject.trade_code ?? "Subject"}</span><ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></div>
          </motion.button>
        );
      })}
    </div>
  );
}

function MaterialViewer({ subject, materials, viewerMaterial, onOpen, onClose }: { subject: Subject | null; materials: Material[]; viewerMaterial: Material | null; onOpen: (material: Material) => void; onClose: () => void }) {
  if (!subject) return <div className="mt-5 rounded-2xl border border-dashed border-slate-200/80 p-6 text-center text-sm text-slate-500">Select a subject to see Notes & Suggestions.</div>;
  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mt-5">
      <GlassCard className="overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-200/80 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-xs font-semibold text-sky-600">{subject.trade_code}</p><h3 className="mt-1 text-lg font-bold">{subject.name} Library</h3></div>
          <span className="text-xs text-slate-500">{materials.length} resources</span>
        </div>
        {materials.length ? (
          <div className="grid gap-3 p-4 md:grid-cols-2">
            {materials.map((material) => (
              <button key={material.id} onClick={() => onOpen(material)} className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white/60 p-4 text-left transition hover:border-sky-300/75 hover:bg-slate-100">
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${material.category === "SUGGESTION" ? "bg-amber-400/12 text-amber-700" : "bg-sky-400/12 text-sky-700"}`}><FileText className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{material.title}</span><span className="mt-1 block text-[10px] font-bold tracking-wider text-slate-500 uppercase">{material.category}{material.is_important ? " • Important" : ""}</span></span>
                <Maximize2 className="h-4 w-4 text-slate-400" />
              </button>
            ))}
          </div>
        ) : <p className="p-8 text-center text-sm text-slate-500">Admin has not added materials for this subject yet.</p>}
      </GlassCard>

      <AnimatePresence>
        {viewerMaterial && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <GlassCard className="mt-5 overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-200/80 p-4">
                <div className="min-w-0"><p className="truncate text-sm font-bold">{viewerMaterial.title}</p><p className="mt-1 text-[10px] text-slate-500">IN-APP VIEWER</p></div>
                <div className="flex gap-2"><a href={viewerMaterial.file_url} target="_blank" rel="noreferrer" aria-label="Open in new tab" className="rounded-xl border border-slate-200/80 p-2 text-slate-600 hover:bg-slate-100"><ExternalLink className="h-4 w-4" /></a><button onClick={onClose} aria-label="Close viewer" className="rounded-xl border border-slate-200/80 p-2 text-slate-600 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>
              </div>
              <iframe src={viewerMaterial.file_url} title={viewerMaterial.title} className="h-[68vh] min-h-[480px] w-full bg-white" allow="autoplay" />
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Mock test engine                              */
/* -------------------------------------------------------------------------- */

function MockTestEngine({ tests, onAwardXp, leaderboard, leaderboardNote }: { tests: MockTest[]; onAwardXp: (points: number) => void; leaderboard: LeaderboardUser[]; leaderboardNote: string }) {
  const [activeTest, setActiveTest] = useState<MockTest | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [xpAwarded, setXpAwarded] = useState(false);
  const questions = useMemo(() => activeTest ? parseQuestions(activeTest.questions_json) : [], [activeTest]);
  const score = questions.reduce(
    (sum, question, index) => sum + (answers[index] === answerIndex(question) ? 1 : 0),
    0
  );

  const finishTest = useCallback(() => {
    if (submitted) return;
    setSubmitted(true);
    if (!xpAwarded) {
      onAwardXp(score * 10);
      setXpAwarded(true);
    }
  }, [onAwardXp, score, submitted, xpAwarded]);

  useEffect(() => {
    if (!activeTest || submitted || timeLeft <= 0) return;
    const timer = window.setTimeout(() => {
      if (timeLeft <= 1) {
        setTimeLeft(0);
        finishTest();
      } else {
        setTimeLeft(timeLeft - 1);
      }
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [activeTest, finishTest, submitted, timeLeft]);

  const start = (test: MockTest) => {
    setActiveTest(test); setQuestionIndex(0); setAnswers({}); setSubmitted(false); setXpAwarded(false); setTimeLeft(Math.max(1, test.duration_minutes) * 60);
  };
  const reset = () => { setActiveTest(null); setSubmitted(false); setAnswers({}); setQuestionIndex(0); };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <GlassCard className="min-h-[460px] p-5 sm:p-7">
        {!activeTest ? (
          <div>
            <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-indigo-400/12 text-indigo-700"><BrainCircuit className="h-5 w-5" /></span><div><h3 className="font-bold">Available tests</h3><p className="text-xs text-slate-500">10 XP for each correct answer</p></div></div>
            <div className="mt-6 space-y-3">{tests.map((test) => { const count = parseQuestions(test.questions_json).length; return <button key={test.id} disabled={!count} onClick={() => start(test)} className="flex w-full items-center gap-4 rounded-2xl border border-slate-200/80 bg-white/60 p-4 text-left transition hover:border-indigo-300/75 hover:bg-slate-100 disabled:opacity-40"><span className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600"><Play className="h-5 w-5 fill-white" /></span><span className="flex-1"><span className="block font-semibold">{test.title}</span><span className="mt-1 block text-xs text-slate-500">{count} questions • {test.duration_minutes} min</span></span><ChevronRight className="h-4 w-4 text-slate-400" /></button>; })}</div>
          </div>
        ) : submitted ? (
          <div>
            <button onClick={reset} className="mb-6 flex items-center gap-2 text-xs text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4" /> All tests</button>
            <div className="text-center"><span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-400/12 text-emerald-700"><Trophy className="h-9 w-9" /></span><p className="mt-5 text-xs font-bold tracking-widest text-emerald-600 uppercase">Test complete</p><h3 className="mt-2 text-4xl font-black">{score}/{questions.length}</h3><p className="mt-2 text-sm text-amber-700">+{score * 10} XP earned</p></div>
            <div className="mt-8 space-y-3">{questions.map((q, index) => { const correct = answers[index] === answerIndex(q); return <div key={index} className={`rounded-2xl border p-4 ${correct ? "border-emerald-400/20 bg-emerald-400/[0.07]" : "border-rose-400/20 bg-rose-400/[0.07]"}`}><div className="flex gap-3">{correct ? <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />}<div><p className="text-sm font-semibold">{q.q}</p><p className="mt-2 text-xs text-slate-600">Correct: {q.options[answerIndex(q)]}</p>{q.explanation && <p className="mt-2 text-xs leading-5 text-slate-500">{q.explanation}</p>}</div></div></div>; })}</div>
          </div>
        ) : questions.length ? (
          <div>
            <div className="flex items-center justify-between"><button onClick={reset} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4" /> Exit</button><span className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${timeLeft < 30 ? "bg-rose-400/12 text-rose-700" : "bg-slate-100/70 text-slate-600"}`}><Clock3 className="h-3.5 w-3.5" /> {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}</span></div>
            <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-slate-100/70"><motion.div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-500" animate={{ width: `${((questionIndex + 1) / questions.length) * 100}%` }} /></div>
            <p className="mt-7 text-xs font-bold tracking-wider text-indigo-600 uppercase">Question {questionIndex + 1} of {questions.length}</p><h3 className="mt-3 text-xl leading-8 font-bold sm:text-2xl">{questions[questionIndex].q}</h3>
            <div className="mt-6 grid gap-3">{questions[questionIndex].options.map((option, optionIndex) => <button key={optionIndex} onClick={() => setAnswers((current) => ({ ...current, [questionIndex]: optionIndex }))} className={`flex items-center gap-4 rounded-2xl border p-4 text-left text-sm transition ${answers[questionIndex] === optionIndex ? "border-sky-300/100 bg-sky-400/10 text-sky-800" : "border-slate-200/80 bg-white/60 text-slate-600 hover:bg-slate-100"}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${answers[questionIndex] === optionIndex ? "bg-sky-600 text-white" : "bg-slate-100/70 text-slate-600"}`}>{String.fromCharCode(65 + optionIndex)}</span>{option}</button>)}</div>
            <div className="mt-7 flex justify-between"><button disabled={questionIndex === 0} onClick={() => setQuestionIndex((index) => index - 1)} className="flex items-center gap-2 rounded-xl border border-slate-200/80 px-4 py-2.5 text-sm text-slate-600 disabled:opacity-30"><ArrowLeft className="h-4 w-4" /> Back</button>{questionIndex === questions.length - 1 ? <button onClick={finishTest} className="rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-bold text-emerald-950">Submit test</button> : <button onClick={() => setQuestionIndex((index) => index + 1)} className="flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white">Next <ArrowRight className="h-4 w-4" /></button>}</div>
          </div>
        ) : <p className="text-sm text-slate-500">This test has no valid questions.</p>}
      </GlassCard>
      <Leaderboard users={leaderboard} note={leaderboardNote} />
    </div>
  );
}

function Leaderboard({ users, note, onViewAll }: { users: LeaderboardUser[]; note: string; onViewAll?: () => void }) {
  return (
    <GlassCard className="h-fit p-5">
      <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-400/12 text-amber-700"><Trophy className="h-5 w-5" /></span><div><h3 className="font-bold">Leaderboard</h3><p className="text-[11px] text-slate-500">Top learners by XP</p></div></div>{onViewAll && <button type="button" onClick={onViewAll} className="flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/70 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-white">View full leaderboard <ChevronRight className="h-3.5 w-3.5" /></button>}</div>
      <div className="mt-5 space-y-2">{users.map((user, index) => <div key={user.id} className={`flex items-center gap-3 rounded-xl p-3 ${user.id === "local-student" ? "border border-sky-300/45 bg-sky-400/[0.07]" : "bg-white/60"}`}><span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-black ${index === 0 ? "bg-amber-300 text-amber-950" : index === 1 ? "bg-slate-300 text-slate-900" : index === 2 ? "bg-orange-400 text-orange-950" : "bg-slate-100/70 text-slate-500"}`}>{index + 1}</span><span className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-slate-100/70">{user.avatar_url ? <img src={user.avatar_url} alt="" className="h-full w-full object-cover" /> : <CircleUserRound className="h-4 w-4 text-slate-500" />}</span><span className="min-w-0 flex-1 truncate text-xs font-semibold">{user.name}</span><span className="text-xs font-bold text-amber-700">{user.xp_points}</span></div>)}</div>
      <p className="mt-4 text-center text-[10px] leading-4 text-slate-400">{note}</p>
    </GlassCard>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 AI chat                                    */
/* -------------------------------------------------------------------------- */

function AiChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: "নমস্কার! আমি SahajSkill AI স্যার। WBSCTVESD Class 11 ও Class 12-এর ETIT, EDCA, Physics, Chemistry বা Math থেকে যেকোনো প্রশ্ন করো। আমি সহজ বাংলায়, পয়েন্ট করে, উদাহরণ আর পরীক্ষার সাজেশন সহ বুঝিয়ে দেব।" }]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll only the message container to the latest message, never the page.
  useEffect(() => {
    const container = scrollRef.current;
    if (container) container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function sendMessage(text: string) {
    const message = text.trim();
    if (!message || sending) return;
    const previous = messages;
    setMessages([...previous, { role: "user", content: message }]); setInput(""); setSending(true);
    try {
      const response = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, history: previous.slice(-8) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "AI request failed");
      setMessages((current) => [...current, { role: "assistant", content: data.reply }]);
    } catch (error) {
      setMessages((current) => [...current, { role: "assistant", content: `দুঃখিত, এখন উত্তর দিতে পারছি না। ${error instanceof Error ? error.message : "Try again."}` }]);
    } finally { setSending(false); }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void sendMessage(input);
  }

  return (
    <div className="flex min-h-[calc(100vh-9rem)] flex-col justify-between">
      <div className="shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="relative grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#0284C7] to-[#4F46E5] shadow-lg shadow-indigo-500/20"><Bot className="h-6 w-6 text-white" /><span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-400" /></span>
            <div>
              <h2 className="text-lg font-black tracking-tight sm:text-xl">SahajSkill AI স্যার</h2>
              <p className="text-xs text-emerald-600">{sending ? "উত্তর লিখছি..." : "Online • WBSCTVESD Class 11 & 12 • বাংলা + English"}</p>
            </div>
          </div>
          <Sparkles className="h-5 w-5 text-indigo-600" />
        </div>
        <div className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {AI_PROMPT_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              disabled={sending}
              onClick={() => void sendMessage(chip)}
              className={`${FLOATING_PILL} shrink-0 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-700 disabled:opacity-50`}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      <div ref={scrollRef} className="mt-5 max-h-[calc(100dvh-20rem)] min-h-[16rem] flex-1 overflow-y-auto overscroll-contain pb-36">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.map((message, index) => <motion.div key={`${message.role}-${index}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[88%] whitespace-pre-wrap rounded-3xl px-4 py-3 text-sm leading-6 sm:max-w-[75%] ${message.role === "user" ? "rounded-br-md bg-gradient-to-br from-blue-500 to-indigo-600 text-white" : "rounded-bl-md border border-white/90 bg-white/85 text-[#0F172A] shadow-[0_4px_20px_rgb(14,165,233,0.06),inset_0_1px_1px_rgba(255,255,255,0.95)] backdrop-blur-2xl"}`}>{message.content}</div></motion.div>)}
          {sending && <div className="flex items-center gap-2 text-xs text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin text-indigo-600" /> উত্তর ভাবছি...</div>}
        </div>
      </div>

      <form onSubmit={submit} className="fixed inset-x-0 bottom-24 z-30 px-4 sm:bottom-28">
        <div className={`${FLOATING_PILL} mx-auto flex max-w-3xl items-center gap-2 py-1.5 pr-1.5 pl-4 transition focus-within:border-sky-300`}>
          <Sparkles className="h-4 w-4 shrink-0 text-indigo-500" />
          <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} rows={1} placeholder="SahajSkill AI স্যারকে প্রশ্ন করো... Ask anything" className="max-h-28 min-h-11 flex-1 resize-none bg-transparent px-2 py-3 text-sm text-[#0F172A] outline-none placeholder:text-slate-400" />
          <button disabled={!input.trim() || sending} aria-label="Send question" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#0284C7] to-[#4F46E5] text-white shadow-[0_6px_20px_rgba(79,70,229,0.25)] transition hover:opacity-90 disabled:opacity-30"><Send className="h-4 w-4" /></button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-slate-400">AI can make mistakes. Verify important exam answers with your teacher.</p>
      </form>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               Dock & states                                */
/* -------------------------------------------------------------------------- */

function Dock({ active, onNavigate }: { active: Tab; onNavigate: (id: Tab) => void }) {
  const items: Array<{ id: Tab; label: string; Icon: typeof Home }> = [
    { id: "home", label: "Home", Icon: Home }, { id: "library", label: "Library", Icon: LibraryBig }, { id: "live", label: "Live", Icon: MonitorPlay }, { id: "tests", label: "Tests", Icon: Trophy }, { id: "ai", label: "Ask AI", Icon: MessageCircleQuestion },
  ];
  // Active state is shown only by the sliding pill: no scale, no translate, no dot.
  return (
    <nav aria-label="Main navigation" className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 sm:bottom-6">
      <div className="flex items-center gap-1 rounded-full border border-white/90 bg-white/80 px-3 py-2 shadow-[0_12px_40px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
        {items.map(({ id, label, Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex min-w-14 flex-col items-center gap-0.5 rounded-full px-3 py-1.5 text-[10px] transition-colors duration-200 sm:min-w-16 ${isActive ? "font-semibold text-sky-700" : "font-medium text-[#475569] hover:text-[#0F172A]"}`}
            >
              {isActive && (
                <motion.span
                  layoutId="activePill"
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-sky-500/12 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)]"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <Icon className="relative h-5 w-5" />
              <span className="relative leading-none">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function ForceUpdateBlocker({ config, currentVersion }: { config: AppConfig; currentVersion: string }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] grid place-items-center bg-[#F8FAFC]/80 p-4 backdrop-blur-3xl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,#E0F2FE,#EEF2FF_40%,transparent_65%)] opacity-60 blur-3xl" />
      <motion.div initial={{ scale: 0.92, y: 24 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 160, damping: 20 }} className={`${LIQUID_GLASS} relative w-full max-w-md p-7 text-center sm:p-9`}>
        <span className="mx-auto grid h-20 w-20 place-items-center rounded-[1.7rem] bg-gradient-to-br from-[#0284C7] to-[#4F46E5] shadow-xl shadow-sky-500/20"><RefreshCw className="h-9 w-9 text-white" /></span>
        <p className="mt-6 text-xs font-bold tracking-[0.2em] text-sky-600 uppercase">Update required</p><h2 className="mt-3 text-3xl font-black">নতুন version এসেছে</h2><p className="mt-4 text-sm leading-6 text-slate-600">{config.update_message}</p>
        <div className="mt-6 flex justify-center gap-3 text-xs text-slate-500"><span>Current {currentVersion}</span><span>•</span><span>Required {config.min_required_version}</span></div>
        <a href={config.update_url} className="mt-7 flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 px-5 py-4 text-sm font-black text-white transition hover:bg-sky-700">Update SahajSkill <ExternalLink className="h-4 w-4" /></a>
        <p className="mt-4 flex items-center justify-center gap-2 text-[10px] text-slate-400"><AlertTriangle className="h-3.5 w-3.5" /> This update is required to continue.</p>
      </motion.div>
    </motion.div>
  );
}

function LoadingState() {
  return <div className="grid min-h-[65vh] place-items-center"><div className="text-center"><LoaderCircle className="mx-auto h-8 w-8 animate-spin text-sky-600" /><p className="mt-4 text-sm text-slate-500">তোমার learning space তৈরি হচ্ছে...</p></div></div>;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="grid min-h-[65vh] place-items-center"><GlassCard className="max-w-md p-8 text-center"><AlertTriangle className="mx-auto h-8 w-8 text-amber-600" /><h2 className="mt-4 text-xl font-bold">Dashboard could not load</h2><p className="mt-2 text-sm text-slate-500">{message}</p><button onClick={onRetry} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold text-white"><RefreshCw className="h-4 w-4" /> Try again</button></GlassCard></div>;
}
