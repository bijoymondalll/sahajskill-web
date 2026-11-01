"use client";
/* eslint-disable @next/next/no-img-element */

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  CircleGauge,
  CloudUpload,
  Database,
  FileText,
  FlaskConical,
  GraduationCap,
  LayoutDashboard,
  Link2,
  ListChecks,
  LoaderCircle,
  LockKeyhole,
  Menu,
  MessageSquareText,
  Pencil,
  Plus,
  Radio,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Upload,
  Video,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";

/* -------------------------------------------------------------------------- */
/*                                  Types                                     */
/* -------------------------------------------------------------------------- */

type AdminTab = "overview" | "classes" | "subjects" | "content" | "tests" | "settings";
type Entity = "classes" | "subjects" | "materials" | "live_classes" | "mock_tests" | "app_config";
type Notice = { type: "success" | "error"; message: string } | null;

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
  category: string;
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

type McqQuestion = {
  q: string;
  options: string[];
  ans: number;
  explanation: string;
};

type MockTest = {
  id: string;
  subject_id: string;
  title: string;
  duration_minutes: number;
  questions_json: string | McqQuestion[];
};

type AppConfig = {
  id: number;
  latest_version: string;
  min_required_version: string;
  force_update_active: number;
  update_url: string;
  update_message: string;
  notice_banner: string;
  ai_worker_url?: string | null;
  ai_system_prompt?: string | null;
};

type ContentResponse = {
  classes: ClassItem[];
  subjects: Subject[];
  materials: Material[];
  live_classes: LiveClass[];
  mock_tests: MockTest[];
  app_config: AppConfig | null;
  leaderboard: Array<{ id: string; name: string; xp_points: number }>;
  source?: string;
};

type SettingsDraft = {
  latest_version: string;
  min_required_version: string;
  force_update_active: number;
  update_url: string;
  update_message: string;
  notice_banner: string;
  ai_worker_url: string;
  ai_system_prompt: string;
};

const EMPTY_SETTINGS: SettingsDraft = {
  latest_version: "1.0.0",
  min_required_version: "1.0.0",
  force_update_active: 0,
  update_url: "https://play.google.com",
  update_message: "নতুন ফিচার ও সাজেশন পেতে অ্যাপটি আপডেট কর!",
  notice_banner: "WBSCTVESD Class 12 Semester Suggestion Live Now!",
  ai_worker_url: "",
  ai_system_prompt:
    "You are a friendly WBSCTVESD Vocational teacher from West Bengal. Explain concepts clearly in colloquial Bengali and English.",
};

const EMPTY_QUESTION: McqQuestion = {
  q: "",
  options: ["", "", "", ""],
  ans: 0,
  explanation: "",
};

/* -------------------------------------------------------------------------- */
/*                               API helpers                                  */
/* -------------------------------------------------------------------------- */

async function fetchAdminContent(): Promise<ContentResponse> {
  const response = await fetch("/api/content", { cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error ?? `Content request failed (${response.status})`);
  return body as ContentResponse;
}

async function mutateAdmin(
  method: "POST" | "PUT" | "DELETE",
  entity: Entity,
  data?: Record<string, unknown>,
  id?: string | number
) {
  const response = await fetch("/api/admin", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entity, data, id }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error ?? `${method} request failed (${response.status})`);
  return body;
}

function parseQuestions(value: string | McqQuestion[]): McqQuestion[] {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((question) => ({
      q: typeof question.q === "string" ? question.q : "",
      options: Array.isArray(question.options)
        ? [...question.options.map(String), "", "", "", ""].slice(0, 4)
        : ["", "", "", ""],
      ans: typeof question.ans === "number" ? question.ans : Number(question.ans) || 0,
      explanation: typeof question.explanation === "string" ? question.explanation : "",
    }));
  } catch {
    return [];
  }
}

function settingsFromConfig(config: AppConfig | null): SettingsDraft {
  if (!config) return EMPTY_SETTINGS;
  return {
    latest_version: config.latest_version ?? "1.0.0",
    min_required_version: config.min_required_version ?? "1.0.0",
    force_update_active: Number(config.force_update_active) || 0,
    update_url: config.update_url ?? "",
    update_message: config.update_message ?? "",
    notice_banner: config.notice_banner ?? "",
    ai_worker_url: config.ai_worker_url ?? "",
    ai_system_prompt: config.ai_system_prompt ?? "",
  };
}

/* -------------------------------------------------------------------------- */
/*                                Main page                                   */
/* -------------------------------------------------------------------------- */

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [content, setContent] = useState<ContentResponse | null>(null);
  const [settings, setSettings] = useState<SettingsDraft>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [mobileMenu, setMobileMenu] = useState(false);

  const applyContent = useCallback((data: ContentResponse, syncSettings = false) => {
    setContent(data);
    if (syncSettings) setSettings(settingsFromConfig(data.app_config));
  }, []);

  const refresh = useCallback(async (syncSettings = false) => {
    setRefreshing(true);
    try {
      const data = await fetchAdminContent();
      applyContent(data, syncSettings);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Could not refresh data" });
    } finally {
      setRefreshing(false);
    }
  }, [applyContent]);

  useEffect(() => {
    fetchAdminContent()
      .then((data) => applyContent(data, true))
      .catch((error: unknown) =>
        setNotice({ type: "error", message: error instanceof Error ? error.message : "Could not load admin data" })
      )
      .finally(() => setLoading(false));
  }, [applyContent]);

  const runMutation = useCallback(
    async (
      method: "POST" | "PUT" | "DELETE",
      entity: Entity,
      data?: Record<string, unknown>,
      id?: string | number,
      successMessage = "Changes saved"
    ) => {
      try {
        await mutateAdmin(method, entity, data, id);
        setNotice({ type: "success", message: successMessage });
        await refresh(entity === "app_config");
        return true;
      } catch (error) {
        setNotice({ type: "error", message: error instanceof Error ? error.message : "Request failed" });
        return false;
      }
    },
    [refresh]
  );

  const changeTab = (tab: AdminTab) => {
    setActiveTab(tab);
    setMobileMenu(false);
  };

  return (
    <main className="min-h-screen bg-[#050711] font-sans text-white selection:bg-cyan-400/30">
      <AdminBackground />
      <AdminSidebar active={activeTab} onChange={changeTab} open={mobileMenu} onClose={() => setMobileMenu(false)} />

      <div className="relative z-10 min-h-screen lg:pl-72">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-white/8 bg-[#070913]/75 px-4 backdrop-blur-2xl sm:px-7 lg:px-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileMenu(true)} aria-label="Open navigation" className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.06] lg:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <p className="text-[10px] font-bold tracking-[0.18em] text-cyan-300/70 uppercase">Super Admin</p>
              <h1 className="mt-1 text-lg font-bold capitalize sm:text-xl">{activeTab === "content" ? "Study Content" : activeTab}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`hidden rounded-full border px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase sm:inline-flex ${content?.source === "turso" ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-200" : "border-amber-300/20 bg-amber-400/10 text-amber-200"}`}>
              {content?.source === "turso" ? "Turso connected" : "Demo mode"}
            </span>
            <button onClick={() => void refresh()} disabled={refreshing} aria-label="Refresh content" className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-white/60 transition hover:bg-white/10 hover:text-white disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <Link href="/" className="hidden items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-cyan-100 sm:flex">
              Student App <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
            </Link>
          </div>
        </header>

        <div className="mx-auto max-w-[1500px] p-4 sm:p-7 lg:p-10">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid min-h-[65vh] place-items-center">
                <div className="text-center"><LoaderCircle className="mx-auto h-8 w-8 animate-spin text-cyan-300" /><p className="mt-4 text-sm text-white/40">Loading control center...</p></div>
              </motion.div>
            ) : (
              <motion.div key={activeTab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
                {activeTab === "overview" && <OverviewTab content={content} onNavigate={changeTab} />}
                {activeTab === "classes" && <ClassesTab classes={content?.classes ?? []} runMutation={runMutation} />}
                {activeTab === "subjects" && <SubjectsTab classes={content?.classes ?? []} subjects={content?.subjects ?? []} runMutation={runMutation} setNotice={setNotice} />}
                {activeTab === "content" && <ContentTab classes={content?.classes ?? []} subjects={content?.subjects ?? []} materials={content?.materials ?? []} liveClasses={content?.live_classes ?? []} runMutation={runMutation} />}
                {activeTab === "tests" && <TestsTab subjects={content?.subjects ?? []} tests={content?.mock_tests ?? []} runMutation={runMutation} />}
                {activeTab === "settings" && <SettingsTab settings={settings} setSettings={setSettings} runMutation={runMutation} />}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>{notice && <Toast notice={notice} onClose={() => setNotice(null)} />}</AnimatePresence>
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/*                                Navigation                                  */
/* -------------------------------------------------------------------------- */

const NAV_ITEMS: Array<{ id: AdminTab; label: string; Icon: typeof LayoutDashboard }> = [
  { id: "overview", label: "Overview", Icon: LayoutDashboard },
  { id: "classes", label: "Classes", Icon: GraduationCap },
  { id: "subjects", label: "Subjects", Icon: BookOpen },
  { id: "content", label: "Notes & Live", Icon: FileText },
  { id: "tests", label: "Mock Tests", Icon: ListChecks },
  { id: "settings", label: "App Controls", Icon: Settings2 },
];

function AdminSidebar({ active, onChange, open, onClose }: { active: AdminTab; onChange: (tab: AdminTab) => void; open: boolean; onClose: () => void }) {
  const sidebar = (
    <aside className="flex h-full w-72 flex-col border-r border-white/8 bg-[#090b16]/88 p-5 backdrop-blur-3xl">
      <div className="flex items-center justify-between">
        <Link href="/admin" className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/15 bg-gradient-to-br from-cyan-400/25 to-violet-500/25 shadow-lg shadow-cyan-950/40"><ShieldCheck className="h-6 w-6 text-cyan-200" /></span>
          <span><span className="block font-black">SahajSkill</span><span className="block text-[9px] tracking-[0.2em] text-white/35 uppercase">Control Center</span></span>
        </Link>
        <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl hover:bg-white/10 lg:hidden"><X className="h-4 w-4" /></button>
      </div>

      <nav className="mt-10 space-y-1.5">
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => onChange(id)} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold transition ${active === id ? "bg-white text-slate-950 shadow-lg shadow-black/20" : "text-white/48 hover:bg-white/[0.07] hover:text-white"}`}>
            <Icon className="h-4.5 w-4.5" /> {label}
            {active === id && <ChevronDown className="ml-auto h-3.5 w-3.5 -rotate-90" />}
          </button>
        ))}
      </nav>

      <div className="mt-auto rounded-2xl border border-cyan-300/10 bg-cyan-400/[0.055] p-4">
        <div className="flex items-center gap-2 text-xs font-bold text-cyan-200"><Database className="h-4 w-4" /> Dynamic CMS</div>
        <p className="mt-2 text-[10px] leading-4 text-white/35">Every change is reflected in the student dashboard after refresh.</p>
      </div>
    </aside>
  );

  return (
    <>
      <div className="fixed inset-y-0 left-0 z-40 hidden lg:block">{sidebar}</div>
      <AnimatePresence>{open && <><motion.button aria-label="Close navigation" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm lg:hidden" /><motion.div initial={{ x: -288 }} animate={{ x: 0 }} exit={{ x: -288 }} transition={{ type: "spring", stiffness: 280, damping: 28 }} className="fixed inset-y-0 left-0 z-50 lg:hidden">{sidebar}</motion.div></>}</AnimatePresence>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*                               Shared UI                                    */
/* -------------------------------------------------------------------------- */

function AdminBackground() {
  return <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden"><div className="absolute -left-56 -top-56 h-[38rem] w-[38rem] rounded-full bg-cyan-500/10 blur-[140px]" /><div className="absolute -right-64 top-1/3 h-[42rem] w-[42rem] rounded-full bg-violet-600/10 blur-[150px]" /><div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.018)_1px,transparent_1px)] bg-[size:64px_64px]" /></div>;
}

function GlassPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[1.75rem] border border-white/10 bg-white/[0.055] shadow-2xl shadow-black/15 backdrop-blur-2xl ${className}`}>{children}</div>;
}

function TabTitle({ icon: Icon, title, description, action }: { icon: typeof Settings2; title: string; description: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="mb-3 flex items-center gap-2 text-xs font-bold tracking-[0.16em] text-cyan-300/70 uppercase"><Icon className="h-4 w-4" /> Management</div><h2 className="text-3xl font-black tracking-tight sm:text-4xl">{title}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-white/42">{description}</p></div>{action}</div>;
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="block"><span className="mb-2 block text-xs font-semibold text-white/55">{label}</span>{children}{hint && <span className="mt-1.5 block text-[10px] leading-4 text-white/28">{hint}</span>}</label>;
}

const inputClass = "w-full rounded-xl border border-white/10 bg-black/25 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-cyan-300/35 focus:bg-black/35";
const selectClass = `${inputClass} appearance-none`;
const primaryButton = "inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-40";
const secondaryButton = "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm font-semibold text-white/65 transition hover:bg-white/10 hover:text-white disabled:opacity-40";

function StatusPill({ status }: { status: string }) {
  const active = status === "ACTIVE" || status === "LIVE";
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-black tracking-wider uppercase ${active ? "bg-emerald-400/10 text-emerald-200" : status === "HIDDEN" ? "bg-white/[0.06] text-white/35" : "bg-amber-400/10 text-amber-200"}`}><span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-400" : status === "HIDDEN" ? "bg-white/30" : "bg-amber-400"}`} />{status.replaceAll("_", " ")}</span>;
}

function EmptyState({ icon: Icon, title, text }: { icon: typeof FileText; title: string; text: string }) {
  return <div className="grid min-h-52 place-items-center p-8 text-center"><div><Icon className="mx-auto h-8 w-8 text-white/18" /><p className="mt-4 text-sm font-bold text-white/65">{title}</p><p className="mt-2 text-xs text-white/30">{text}</p></div></div>;
}

function Toast({ notice, onClose }: { notice: NonNullable<Notice>; onClose: () => void }) {
  return <motion.div initial={{ opacity: 0, y: 20, x: "-50%" }} animate={{ opacity: 1, y: 0, x: "-50%" }} exit={{ opacity: 0, y: 15, x: "-50%" }} className={`fixed bottom-6 left-1/2 z-[100] flex w-[calc(100%-2rem)] max-w-md items-center gap-3 rounded-2xl border p-4 shadow-2xl backdrop-blur-2xl ${notice.type === "success" ? "border-emerald-300/20 bg-emerald-950/85 text-emerald-100" : "border-rose-300/20 bg-rose-950/85 text-rose-100"}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${notice.type === "success" ? "bg-emerald-400/15" : "bg-rose-400/15"}`}>{notice.type === "success" ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}</span><p className="flex-1 text-sm font-medium">{notice.message}</p><button onClick={onClose} aria-label="Close notification" className="p-1 opacity-60 hover:opacity-100"><X className="h-4 w-4" /></button></motion.div>;
}

/* -------------------------------------------------------------------------- */
/*                                Overview                                    */
/* -------------------------------------------------------------------------- */

function OverviewTab({ content, onNavigate }: { content: ContentResponse | null; onNavigate: (tab: AdminTab) => void }) {
  const stats = [
    { label: "Classes", value: content?.classes.length ?? 0, Icon: GraduationCap, color: "from-cyan-400 to-blue-600", tab: "classes" as AdminTab },
    { label: "Subjects", value: content?.subjects.length ?? 0, Icon: BookOpen, color: "from-violet-400 to-fuchsia-600", tab: "subjects" as AdminTab },
    { label: "Resources", value: content?.materials.length ?? 0, Icon: FileText, color: "from-amber-300 to-orange-600", tab: "content" as AdminTab },
    { label: "Mock Tests", value: content?.mock_tests.length ?? 0, Icon: ListChecks, color: "from-emerald-400 to-teal-600", tab: "tests" as AdminTab },
  ];
  const activeClasses = content?.classes.filter((item) => item.status === "ACTIVE").length ?? 0;
  const liveNow = content?.live_classes.filter((item) => item.is_live === 1).length ?? 0;

  return <div><TabTitle icon={CircleGauge} title="Control center" description="Manage every part of the SahajSkill student experience from one place." />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map(({ label, value, Icon, color, tab }) => <motion.button whileHover={{ y: -4 }} key={label} onClick={() => onNavigate(tab)} className="rounded-[1.6rem] border border-white/10 bg-white/[0.055] p-5 text-left backdrop-blur-2xl"><span className={`grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br ${color} shadow-lg`}><Icon className="h-5 w-5" /></span><p className="mt-7 text-3xl font-black">{value}</p><p className="mt-1 text-xs text-white/38">{label}</p></motion.button>)}</div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
      <GlassPanel className="p-6"><div className="flex items-center justify-between"><div><h3 className="font-bold">System snapshot</h3><p className="mt-1 text-xs text-white/35">Current platform configuration</p></div><Database className="h-5 w-5 text-cyan-300" /></div><div className="mt-6 grid gap-3 sm:grid-cols-2"><OverviewMetric label="Active classes" value={String(activeClasses)} /><OverviewMetric label="Live now" value={String(liveNow)} /><OverviewMetric label="Leaderboard users" value={String(content?.leaderboard.length ?? 0)} /><OverviewMetric label="Minimum version" value={content?.app_config?.min_required_version ?? "1.0.0"} /></div></GlassPanel>
      <GlassPanel className="overflow-hidden p-6"><div className="absolute" /><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-400/12 text-violet-200"><Sparkles className="h-5 w-5" /></span><div><h3 className="font-bold">Quick actions</h3><p className="text-xs text-white/35">Common admin workflows</p></div></div><div className="mt-5 space-y-2"><QuickAction label="Add a new subject" Icon={BookOpen} onClick={() => onNavigate("subjects")} /><QuickAction label="Publish a suggestion" Icon={CloudUpload} onClick={() => onNavigate("content")} /><QuickAction label="Create a mock test" Icon={ListChecks} onClick={() => onNavigate("tests")} /><QuickAction label="Configure force update" Icon={Settings2} onClick={() => onNavigate("settings")} /></div></GlassPanel>
    </div>
    {content?.source !== "turso" && <div className="mt-5 flex gap-3 rounded-2xl border border-amber-300/15 bg-amber-400/[0.06] p-4 text-amber-100/80"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="text-sm font-bold">Demo mode is active</p><p className="mt-1 text-xs leading-5 text-amber-100/50">Add valid Turso credentials to .env.local before saving. The content API is currently showing safe fallback data.</p></div></div>}
  </div>;
}

function OverviewMetric({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-white/8 bg-black/20 p-4"><p className="text-xs text-white/35">{label}</p><p className="mt-2 text-xl font-black">{value}</p></div>; }
function QuickAction({ label, Icon, onClick }: { label: string; Icon: typeof BookOpen; onClick: () => void }) { return <button onClick={onClick} className="flex w-full items-center gap-3 rounded-xl border border-white/8 bg-black/15 p-3 text-left text-xs font-semibold text-white/60 transition hover:bg-white/[0.06] hover:text-white"><Icon className="h-4 w-4 text-cyan-300" />{label}<Plus className="ml-auto h-3.5 w-3.5" /></button>; }

/* -------------------------------------------------------------------------- */
/*                                 Classes                                    */
/* -------------------------------------------------------------------------- */

function ClassesTab({ classes, runMutation }: { classes: ClassItem[]; runMutation: AdminMutation }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClassItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ title: "", subtitle: "", status: "ACTIVE", banner_url: "", sort_order: "1" });

  const openCreate = () => { setEditing(null); setDraft({ title: "", subtitle: "", status: "ACTIVE", banner_url: "", sort_order: String(classes.length + 1) }); setFormOpen(true); };
  const openEdit = (item: ClassItem) => { setEditing(item); setDraft({ title: item.title, subtitle: item.subtitle ?? "", status: item.status, banner_url: item.banner_url ?? "", sort_order: String(item.sort_order) }); setFormOpen(true); };
  async function save(event: FormEvent) { event.preventDefault(); setSaving(true); const data = { ...draft, sort_order: Number(draft.sort_order) || 1 }; const ok = await runMutation(editing ? "PUT" : "POST", "classes", data, editing?.id, editing ? "Class updated" : "Class created"); setSaving(false); if (ok) setFormOpen(false); }
  async function toggle(item: ClassItem) { await runMutation("PUT", "classes", { status: item.status === "ACTIVE" ? "COMING_SOON" : "ACTIVE" }, item.id, `${item.title} is now ${item.status === "ACTIVE" ? "coming soon" : "active"}`); }

  return <div><TabTitle icon={GraduationCap} title="Classes" description="Add classes and control which learning paths students can open." action={<button onClick={openCreate} className={primaryButton}><Plus className="h-4 w-4" /> Add class</button>} />
    <div className="grid gap-4 lg:grid-cols-2">{classes.map((item) => <GlassPanel key={item.id} className="relative overflow-hidden p-5"><div className="absolute inset-0 bg-gradient-to-br from-cyan-400/[0.055] to-transparent" /><div className="relative flex items-start gap-4"><span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${item.status === "ACTIVE" ? "bg-cyan-400/12 text-cyan-200" : "bg-amber-400/10 text-amber-200"}`}>{item.status === "ACTIVE" ? <GraduationCap className="h-6 w-6" /> : <LockKeyhole className="h-5 w-5" />}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{item.title}</h3><StatusPill status={item.status} /></div><p className="mt-2 text-xs text-white/38">{item.subtitle || "No subtitle"}</p><p className="mt-3 text-[10px] text-white/25">Sort order: {item.sort_order}</p></div></div><div className="relative mt-5 flex flex-wrap gap-2"><button onClick={() => void toggle(item)} className={secondaryButton}>{item.status === "ACTIVE" ? <ToggleRight className="h-4 w-4 text-emerald-300" /> : <ToggleLeft className="h-4 w-4 text-amber-300" />} {item.status === "ACTIVE" ? "Set coming soon" : "Activate"}</button><button onClick={() => openEdit(item)} className={secondaryButton}><Pencil className="h-4 w-4" /> Edit</button><button onClick={() => { if (window.confirm(`Delete ${item.title}?`)) void runMutation("DELETE", "classes", undefined, item.id, "Class deleted"); }} className="ml-auto rounded-xl border border-rose-300/10 p-3 text-rose-300/60 hover:bg-rose-400/10 hover:text-rose-200"><Trash2 className="h-4 w-4" /></button></div></GlassPanel>)}</div>
    {!classes.length && <GlassPanel><EmptyState icon={GraduationCap} title="No classes yet" text="Add Class 11, Class 12, VOCLET or another learning path." /></GlassPanel>}
    <EditorModal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? "Edit class" : "Add class"}><form onSubmit={save} className="space-y-4"><Field label="Class title"><input required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className={inputClass} placeholder="Class 12 (HS Vocational)" /></Field><Field label="Subtitle"><input value={draft.subtitle} onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })} className={inputClass} placeholder="WBSCTVESD Semester 3 & 4" /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Status"><select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })} className={selectClass}><option value="ACTIVE">Active</option><option value="COMING_SOON">Coming soon</option><option value="HIDDEN">Hidden</option></select></Field><Field label="Sort order"><input type="number" min="1" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: e.target.value })} className={inputClass} /></Field></div><Field label="Banner image URL"><input type="url" value={draft.banner_url} onChange={(e) => setDraft({ ...draft, banner_url: e.target.value })} className={inputClass} placeholder="https://..." /></Field><button disabled={saving} className={`${primaryButton} w-full`}>{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save class</button></form></EditorModal>
  </div>;
}

/* -------------------------------------------------------------------------- */
/*                                 Subjects                                   */
/* -------------------------------------------------------------------------- */

type AdminMutation = (method: "POST" | "PUT" | "DELETE", entity: Entity, data?: Record<string, unknown>, id?: string | number, successMessage?: string) => Promise<boolean>;

function SubjectsTab({ classes, subjects, runMutation, setNotice }: { classes: ClassItem[]; subjects: Subject[]; runMutation: AdminMutation; setNotice: (notice: Notice) => void }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [classFilter, setClassFilter] = useState("ALL");
  const [draft, setDraft] = useState({ class_id: "", name: "", trade_code: "", icon_url: "", teacher_name: "", status: "ACTIVE" });
  const filtered = classFilter === "ALL" ? subjects : subjects.filter((item) => item.class_id === classFilter);
  const classNameById = Object.fromEntries(classes.map((item) => [item.id, item.title]));

  const openCreate = () => { setEditing(null); setDraft({ class_id: classes.find((item) => item.status === "ACTIVE")?.id ?? classes[0]?.id ?? "", name: "", trade_code: "", icon_url: "", teacher_name: "", status: "ACTIVE" }); setFormOpen(true); };
  const openEdit = (item: Subject) => { setEditing(item); setDraft({ class_id: item.class_id, name: item.name, trade_code: item.trade_code ?? "", icon_url: item.icon_url ?? "", teacher_name: item.teacher_name ?? "", status: item.status }); setFormOpen(true); };
  async function uploadIcon(file: File) { setUploading(true); try { const form = new FormData(); form.append("file", file); const response = await fetch("/api/upload", { method: "POST", body: form }); const result = await response.json(); if (!response.ok) throw new Error(result?.error ?? "Image upload failed"); setDraft((current) => ({ ...current, icon_url: result.url })); setNotice({ type: "success", message: "Icon uploaded to ImgBB" }); } catch (error) { setNotice({ type: "error", message: error instanceof Error ? error.message : "Upload failed" }); } finally { setUploading(false); } }
  async function save(event: FormEvent) { event.preventDefault(); setSaving(true); const ok = await runMutation(editing ? "PUT" : "POST", "subjects", draft, editing?.id, editing ? "Subject updated" : "Subject created"); setSaving(false); if (ok) setFormOpen(false); }

  return <div><TabTitle icon={BookOpen} title="Subjects" description="Create trades and common subjects, assign teachers, and upload icons directly to ImgBB." action={<button onClick={openCreate} className={primaryButton}><Plus className="h-4 w-4" /> Add subject</button>} />
    <div className="mb-5 flex gap-2 overflow-x-auto pb-1"><button onClick={() => setClassFilter("ALL")} className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${classFilter === "ALL" ? "bg-white text-slate-950" : "border border-white/10 bg-white/[0.04] text-white/45"}`}>All classes</button>{classes.map((item) => <button key={item.id} onClick={() => setClassFilter(item.id)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${classFilter === item.id ? "bg-white text-slate-950" : "border border-white/10 bg-white/[0.04] text-white/45"}`}>{item.title}</button>)}</div>
    <GlassPanel className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="border-b border-white/8 bg-black/15 text-[10px] tracking-wider text-white/30 uppercase"><tr><th className="px-5 py-4">Subject</th><th className="px-5 py-4">Class</th><th className="px-5 py-4">Teacher</th><th className="px-5 py-4">Status</th><th className="px-5 py-4 text-right">Actions</th></tr></thead><tbody>{filtered.map((item, index) => <tr key={item.id} className={index < filtered.length - 1 ? "border-b border-white/[0.055]" : ""}><td className="px-5 py-4"><div className="flex items-center gap-3">{item.icon_url ? <img src={item.icon_url} alt="" className="h-10 w-10 rounded-xl object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-400/10 text-violet-200"><BookOpen className="h-4 w-4" /></span>}<div><p className="text-sm font-bold">{item.name}</p><p className="mt-1 text-[10px] text-white/30">{item.trade_code || "No trade code"}</p></div></div></td><td className="px-5 py-4 text-xs text-white/45">{classNameById[item.class_id] ?? item.class_id}</td><td className="px-5 py-4 text-xs text-white/45">{item.teacher_name || "Not assigned"}</td><td className="px-5 py-4"><StatusPill status={item.status} /></td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button onClick={() => openEdit(item)} className="rounded-lg border border-white/8 p-2 text-white/45 hover:bg-white/10 hover:text-white"><Pencil className="h-3.5 w-3.5" /></button><button onClick={() => { if (window.confirm(`Delete ${item.name}?`)) void runMutation("DELETE", "subjects", undefined, item.id, "Subject deleted"); }} className="rounded-lg border border-rose-300/8 p-2 text-rose-300/45 hover:bg-rose-400/10 hover:text-rose-200"><Trash2 className="h-3.5 w-3.5" /></button></div></td></tr>)}</tbody></table></div>{!filtered.length && <EmptyState icon={BookOpen} title="No subjects found" text="Add a subject or change the class filter." />}</GlassPanel>
    <EditorModal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? "Edit subject" : "Add subject"} wide><form onSubmit={save} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Class"><select required value={draft.class_id} onChange={(e) => setDraft({ ...draft, class_id: e.target.value })} className={selectClass}><option value="">Select class</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></Field><Field label="Status"><select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })} className={selectClass}><option value="ACTIVE">Active</option><option value="HIDDEN">Hidden</option></select></Field></div><Field label="Subject name"><input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputClass} placeholder="ETIT (Computer Application)" /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Trade code"><input value={draft.trade_code} onChange={(e) => setDraft({ ...draft, trade_code: e.target.value.toUpperCase() })} className={inputClass} placeholder="ETIT / COMMON" /></Field><Field label="Teacher name"><input value={draft.teacher_name} onChange={(e) => setDraft({ ...draft, teacher_name: e.target.value })} className={inputClass} placeholder="Teacher name" /></Field></div><Field label="Subject icon" hint="Upload directly to ImgBB or paste an existing image URL."><div className="flex gap-3"><label className={`${secondaryButton} shrink-0 cursor-pointer`}>{uploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload<input type="file" accept="image/*" disabled={uploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadIcon(file); }} className="hidden" /></label><input type="url" value={draft.icon_url} onChange={(e) => setDraft({ ...draft, icon_url: e.target.value })} className={inputClass} placeholder="ImgBB CDN URL" /></div>{draft.icon_url && <img src={draft.icon_url} alt="Subject icon preview" className="mt-3 h-16 w-16 rounded-2xl border border-white/10 object-cover" />}</Field><button disabled={saving || uploading} className={`${primaryButton} w-full`}>{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save subject</button></form></EditorModal>
  </div>;
}

/* -------------------------------------------------------------------------- */
/*                           Materials & live classes                         */
/* -------------------------------------------------------------------------- */

function ContentTab({ classes, subjects, materials, liveClasses, runMutation }: { classes: ClassItem[]; subjects: Subject[]; materials: Material[]; liveClasses: LiveClass[]; runMutation: AdminMutation }) {
  const [mode, setMode] = useState<"materials" | "live">("materials");
  return <div><TabTitle icon={CloudUpload} title="Notes, suggestions & live" description="Publish study resources and launch live classrooms from YouTube or Google Meet." action={<div className="flex rounded-xl border border-white/10 bg-black/20 p-1"><button onClick={() => setMode("materials")} className={`rounded-lg px-3 py-2 text-xs font-bold ${mode === "materials" ? "bg-white text-slate-950" : "text-white/40"}`}>Materials</button><button onClick={() => setMode("live")} className={`rounded-lg px-3 py-2 text-xs font-bold ${mode === "live" ? "bg-white text-slate-950" : "text-white/40"}`}>Live classes</button></div>} />{mode === "materials" ? <MaterialsManager subjects={subjects} materials={materials} runMutation={runMutation} /> : <LiveManager classes={classes} liveClasses={liveClasses} runMutation={runMutation} />}</div>;
}

function MaterialsManager({ subjects, materials, runMutation }: { subjects: Subject[]; materials: Material[]; runMutation: AdminMutation }) {
  const [open, setOpen] = useState(false); const [editing, setEditing] = useState<Material | null>(null); const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ subject_id: "", title: "", category: "NOTE", file_url: "", thumbnail_url: "", is_important: 0 });
  const subjectNames = Object.fromEntries(subjects.map((item) => [item.id, item.name]));
  const create = () => { setEditing(null); setDraft({ subject_id: subjects[0]?.id ?? "", title: "", category: "NOTE", file_url: "", thumbnail_url: "", is_important: 0 }); setOpen(true); };
  const edit = (item: Material) => { setEditing(item); setDraft({ subject_id: item.subject_id, title: item.title, category: item.category, file_url: item.file_url, thumbnail_url: item.thumbnail_url ?? "", is_important: item.is_important }); setOpen(true); };
  async function save(event: FormEvent) { event.preventDefault(); setSaving(true); const ok = await runMutation(editing ? "PUT" : "POST", "materials", draft, editing?.id, editing ? "Material updated" : "Material published"); setSaving(false); if (ok) setOpen(false); }
  return <><div className="mb-5 flex justify-end"><button onClick={create} className={primaryButton}><Plus className="h-4 w-4" /> Add material</button></div><div className="grid gap-4 lg:grid-cols-2">{materials.map((item) => <GlassPanel key={item.id} className="p-5"><div className="flex gap-4"><span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${item.category === "SUGGESTION" ? "bg-amber-400/10 text-amber-200" : "bg-cyan-400/10 text-cyan-200"}`}><FileText className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-[9px] font-black tracking-wider text-white/35 uppercase">{item.category}</span>{item.is_important === 1 && <span className="rounded-full bg-rose-400/10 px-2 py-0.5 text-[9px] font-bold text-rose-200">IMPORTANT</span>}</div><h3 className="mt-1 truncate font-bold">{item.title}</h3><p className="mt-2 truncate text-xs text-white/32">{subjectNames[item.subject_id] ?? item.subject_id}</p></div></div><div className="mt-4 flex items-center gap-2"><a href={item.file_url} target="_blank" rel="noreferrer" className={secondaryButton}><Link2 className="h-4 w-4" /> Open</a><button onClick={() => edit(item)} className={secondaryButton}><Pencil className="h-4 w-4" /> Edit</button><button onClick={() => { if (window.confirm(`Delete ${item.title}?`)) void runMutation("DELETE", "materials", undefined, item.id, "Material deleted"); }} className="ml-auto rounded-xl p-3 text-rose-300/50 hover:bg-rose-400/10 hover:text-rose-200"><Trash2 className="h-4 w-4" /></button></div></GlassPanel>)}</div>{!materials.length && <GlassPanel><EmptyState icon={FileText} title="No study materials" text="Publish the first note or exam suggestion." /></GlassPanel>}<EditorModal open={open} onClose={() => setOpen(false)} title={editing ? "Edit material" : "Publish material"} wide><form onSubmit={save} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Subject"><select required value={draft.subject_id} onChange={(e) => setDraft({ ...draft, subject_id: e.target.value })} className={selectClass}><option value="">Select subject</option>{subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Category"><select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className={selectClass}><option value="NOTE">Note</option><option value="SUGGESTION">Suggestion</option><option value="VIDEO">Recorded video</option><option value="PROJECT">Project</option></select></Field></div><Field label="Title"><input required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className={inputClass} placeholder="Semester 4 Final Suggestion" /></Field><Field label="Google Drive / GitHub / video URL" hint="Google Drive /view links are converted to /preview automatically by the API."><input required type="url" value={draft.file_url} onChange={(e) => setDraft({ ...draft, file_url: e.target.value })} className={inputClass} placeholder="https://drive.google.com/file/d/.../view" /></Field><Field label="Thumbnail URL (optional)"><input type="url" value={draft.thumbnail_url} onChange={(e) => setDraft({ ...draft, thumbnail_url: e.target.value })} className={inputClass} placeholder="https://..." /></Field><label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-4"><input type="checkbox" checked={draft.is_important === 1} onChange={(e) => setDraft({ ...draft, is_important: e.target.checked ? 1 : 0 })} className="h-4 w-4 accent-cyan-400" /><span><span className="block text-sm font-semibold">Mark as important</span><span className="mt-1 block text-[10px] text-white/30">Highlight this resource for students.</span></span></label><button disabled={saving} className={`${primaryButton} w-full`}>{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />} Publish material</button></form></EditorModal></>;
}

function LiveManager({ classes, liveClasses, runMutation }: { classes: ClassItem[]; liveClasses: LiveClass[]; runMutation: AdminMutation }) {
  const [open, setOpen] = useState(false); const [editing, setEditing] = useState<LiveClass | null>(null); const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ class_id: "", subject_name: "", title: "", teacher_name: "", stream_url: "", is_live: 1, scheduled_time: "" });
  const classNames = Object.fromEntries(classes.map((item) => [item.id, item.title]));
  const create = () => { setEditing(null); setDraft({ class_id: classes.find((item) => item.status === "ACTIVE")?.id ?? classes[0]?.id ?? "", subject_name: "", title: "", teacher_name: "", stream_url: "", is_live: 1, scheduled_time: "" }); setOpen(true); };
  const edit = (item: LiveClass) => { setEditing(item); setDraft({ class_id: item.class_id, subject_name: item.subject_name, title: item.title, teacher_name: item.teacher_name, stream_url: item.stream_url, is_live: item.is_live, scheduled_time: item.scheduled_time ?? "" }); setOpen(true); };
  async function save(event: FormEvent) { event.preventDefault(); setSaving(true); const ok = await runMutation(editing ? "PUT" : "POST", "live_classes", draft, editing?.id, editing ? "Live class updated" : "Live class published"); setSaving(false); if (ok) setOpen(false); }
  return <><div className="mb-5 flex justify-end"><button onClick={create} className={primaryButton}><Plus className="h-4 w-4" /> Add live class</button></div><div className="space-y-4">{liveClasses.map((item) => <GlassPanel key={item.id} className="p-5"><div className="flex flex-col gap-5 sm:flex-row sm:items-center"><span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${item.is_live ? "bg-rose-500 text-white shadow-lg shadow-rose-950/40" : "bg-white/[0.06] text-white/35"}`}><Radio className={`h-6 w-6 ${item.is_live ? "animate-pulse" : ""}`} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2">{item.is_live === 1 && <StatusPill status="LIVE" />}<span className="text-[10px] text-white/30">{classNames[item.class_id] ?? item.class_id}</span></div><h3 className="mt-2 truncate font-bold">{item.title}</h3><p className="mt-1 text-xs text-white/38">{item.subject_name} • {item.teacher_name}</p></div><div className="flex gap-2"><button onClick={() => void runMutation("PUT", "live_classes", { is_live: item.is_live ? 0 : 1 }, item.id, item.is_live ? "Live class ended" : "Live class is now live")} className={secondaryButton}>{item.is_live ? "End class" : "Go live"}</button><button onClick={() => edit(item)} className="rounded-xl border border-white/10 p-3 text-white/50 hover:bg-white/10"><Pencil className="h-4 w-4" /></button><button onClick={() => { if (window.confirm(`Delete ${item.title}?`)) void runMutation("DELETE", "live_classes", undefined, item.id, "Live class deleted"); }} className="rounded-xl border border-rose-300/10 p-3 text-rose-300/50 hover:bg-rose-400/10"><Trash2 className="h-4 w-4" /></button></div></div></GlassPanel>)}</div>{!liveClasses.length && <GlassPanel><EmptyState icon={Video} title="No live classes" text="Add a YouTube Live or Google Meet session." /></GlassPanel>}<EditorModal open={open} onClose={() => setOpen(false)} title={editing ? "Edit live class" : "Add live class"} wide><form onSubmit={save} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Class"><select required value={draft.class_id} onChange={(e) => setDraft({ ...draft, class_id: e.target.value })} className={selectClass}><option value="">Select class</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></Field><Field label="Subject name"><input required value={draft.subject_name} onChange={(e) => setDraft({ ...draft, subject_name: e.target.value })} className={inputClass} placeholder="ETIT" /></Field></div><Field label="Class title"><input required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className={inputClass} placeholder="Web Design Revision" /></Field><Field label="Teacher name"><input required value={draft.teacher_name} onChange={(e) => setDraft({ ...draft, teacher_name: e.target.value })} className={inputClass} placeholder="Teacher name" /></Field><Field label="YouTube Live or Google Meet URL"><input required type="url" value={draft.stream_url} onChange={(e) => setDraft({ ...draft, stream_url: e.target.value })} className={inputClass} placeholder="https://youtube.com/watch?v=..." /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Status"><select value={draft.is_live} onChange={(e) => setDraft({ ...draft, is_live: Number(e.target.value) })} className={selectClass}><option value={1}>Live now</option><option value={0}>Scheduled / ended</option></select></Field><Field label="Scheduled time"><input type="datetime-local" value={draft.scheduled_time} onChange={(e) => setDraft({ ...draft, scheduled_time: e.target.value })} className={inputClass} /></Field></div><button disabled={saving} className={`${primaryButton} w-full`}>{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />} Save live class</button></form></EditorModal></>;
}

/* -------------------------------------------------------------------------- */
/*                              Mock test builder                             */
/* -------------------------------------------------------------------------- */

function TestsTab({ subjects, tests, runMutation }: { subjects: Subject[]; tests: MockTest[]; runMutation: AdminMutation }) {
  const [open, setOpen] = useState(false); const [editing, setEditing] = useState<MockTest | null>(null); const [saving, setSaving] = useState(false);
  const [subjectId, setSubjectId] = useState(""); const [title, setTitle] = useState(""); const [duration, setDuration] = useState("15"); const [questions, setQuestions] = useState<McqQuestion[]>([{ ...EMPTY_QUESTION, options: [...EMPTY_QUESTION.options] }]);
  const subjectNames = Object.fromEntries(subjects.map((item) => [item.id, item.name]));
  const create = () => { setEditing(null); setSubjectId(subjects[0]?.id ?? ""); setTitle(""); setDuration("15"); setQuestions([{ ...EMPTY_QUESTION, options: [...EMPTY_QUESTION.options] }]); setOpen(true); };
  const edit = (item: MockTest) => { const parsed = parseQuestions(item.questions_json); setEditing(item); setSubjectId(item.subject_id); setTitle(item.title); setDuration(String(item.duration_minutes)); setQuestions(parsed.length ? parsed : [{ ...EMPTY_QUESTION, options: [...EMPTY_QUESTION.options] }]); setOpen(true); };
  const updateQuestion = (index: number, update: Partial<McqQuestion>) => setQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...update } : item));
  const updateOption = (questionIndex: number, optionIndex: number, value: string) => setQuestions((current) => current.map((question, index) => index === questionIndex ? { ...question, options: question.options.map((option, i) => i === optionIndex ? value : option) } : question));
  async function save(event: FormEvent) { event.preventDefault(); const invalid = questions.some((question) => !question.q.trim() || question.options.some((option) => !option.trim())); if (invalid) return; setSaving(true); const data = { subject_id: subjectId, title, duration_minutes: Number(duration) || 15, questions_json: questions }; const ok = await runMutation(editing ? "PUT" : "POST", "mock_tests", data, editing?.id, editing ? "Mock test updated" : "Mock test created"); setSaving(false); if (ok) setOpen(false); }
  return <div><TabTitle icon={ListChecks} title="Mock tests" description="Build timed bilingual MCQ tests with correct answers and explanations." action={<button onClick={create} className={primaryButton}><Plus className="h-4 w-4" /> Create test</button>} />
    <div className="grid gap-4 lg:grid-cols-2">{tests.map((item) => { const count = parseQuestions(item.questions_json).length; return <GlassPanel key={item.id} className="p-5"><div className="flex gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-400/10 text-emerald-200"><FlaskConical className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="text-[10px] text-white/30">{subjectNames[item.subject_id] ?? item.subject_id}</p><h3 className="mt-1 truncate font-bold">{item.title}</h3><p className="mt-2 text-xs text-white/35">{count} questions • {item.duration_minutes} minutes</p></div></div><div className="mt-5 flex gap-2"><button onClick={() => edit(item)} className={secondaryButton}><Pencil className="h-4 w-4" /> Edit test</button><button onClick={() => { if (window.confirm(`Delete ${item.title}?`)) void runMutation("DELETE", "mock_tests", undefined, item.id, "Mock test deleted"); }} className="ml-auto rounded-xl p-3 text-rose-300/50 hover:bg-rose-400/10 hover:text-rose-200"><Trash2 className="h-4 w-4" /></button></div></GlassPanel>; })}</div>{!tests.length && <GlassPanel><EmptyState icon={ListChecks} title="No mock tests" text="Create the first timed MCQ assessment." /></GlassPanel>}
    <EditorModal open={open} onClose={() => setOpen(false)} title={editing ? "Edit mock test" : "Create mock test"} extraWide><form onSubmit={save} className="space-y-5"><div className="grid gap-4 sm:grid-cols-[1fr_1fr_140px]"><Field label="Subject"><select required value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={selectClass}><option value="">Select subject</option>{subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Test title"><input required value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="Semester 4 Practice" /></Field><Field label="Minutes"><input required type="number" min="1" max="180" value={duration} onChange={(e) => setDuration(e.target.value)} className={inputClass} /></Field></div><div className="space-y-4">{questions.map((question, questionIndex) => <div key={questionIndex} className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5"><div className="mb-4 flex items-center justify-between"><span className="text-xs font-black tracking-wider text-cyan-300 uppercase">Question {questionIndex + 1}</span>{questions.length > 1 && <button type="button" onClick={() => setQuestions((current) => current.filter((_, index) => index !== questionIndex))} className="p-2 text-rose-300/50 hover:text-rose-200"><Trash2 className="h-4 w-4" /></button>}</div><Field label="Question (Bengali or English)"><textarea required rows={2} value={question.q} onChange={(e) => updateQuestion(questionIndex, { q: e.target.value })} className={inputClass} placeholder="প্রশ্নটি এখানে লিখুন..." /></Field><div className="mt-4 grid gap-3 sm:grid-cols-2">{question.options.map((option, optionIndex) => <label key={optionIndex} className={`flex items-center gap-3 rounded-xl border p-3 transition ${question.ans === optionIndex ? "border-emerald-300/25 bg-emerald-400/[0.06]" : "border-white/8 bg-black/15"}`}><input type="radio" name={`answer-${questionIndex}`} checked={question.ans === optionIndex} onChange={() => updateQuestion(questionIndex, { ans: optionIndex })} className="accent-emerald-400" /><input required value={option} onChange={(e) => updateOption(questionIndex, optionIndex, e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/20" placeholder={`Option ${String.fromCharCode(65 + optionIndex)}`} /></label>)}</div><div className="mt-4"><Field label="Answer explanation"><textarea rows={2} value={question.explanation} onChange={(e) => updateQuestion(questionIndex, { explanation: e.target.value })} className={inputClass} placeholder="Explain why the selected answer is correct." /></Field></div></div>)}</div><button type="button" onClick={() => setQuestions((current) => [...current, { ...EMPTY_QUESTION, options: [...EMPTY_QUESTION.options] }])} className={`${secondaryButton} w-full border-dashed`}><Plus className="h-4 w-4" /> Add another question</button><button disabled={saving} className={`${primaryButton} w-full`}>{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save {questions.length}-question test</button></form></EditorModal>
  </div>;
}

/* -------------------------------------------------------------------------- */
/*                              App configuration                             */
/* -------------------------------------------------------------------------- */

function SettingsTab({ settings, setSettings, runMutation }: { settings: SettingsDraft; setSettings: (settings: SettingsDraft) => void; runMutation: AdminMutation }) {
  const [saving, setSaving] = useState(false);
  async function save(event: FormEvent) { event.preventDefault(); setSaving(true); await runMutation("PUT", "app_config", settings, 1, "App controls updated"); setSaving(false); }
  return <div><TabTitle icon={Settings2} title="App controls" description="Manage forced updates, the global notice, and how the AI teacher responds." />
    <form onSubmit={save} className="grid gap-5 xl:grid-cols-2">
      <GlassPanel className="p-5 sm:p-6"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-rose-400/10 text-rose-200"><RefreshCw className="h-5 w-5" /></span><div><h3 className="font-bold">Force update</h3><p className="mt-1 text-xs text-white/35">Block outdated clients until they update.</p></div></div><button type="button" onClick={() => setSettings({ ...settings, force_update_active: settings.force_update_active ? 0 : 1 })} className={`mt-6 flex w-full items-center justify-between rounded-2xl border p-4 text-left transition ${settings.force_update_active ? "border-rose-300/20 bg-rose-400/[0.07]" : "border-white/10 bg-black/20"}`}><span><span className="block text-sm font-bold">Force update is {settings.force_update_active ? "ON" : "OFF"}</span><span className="mt-1 block text-[10px] text-white/35">Students below the minimum version will see a blocker.</span></span>{settings.force_update_active ? <ToggleRight className="h-8 w-8 text-rose-300" /> : <ToggleLeft className="h-8 w-8 text-white/25" />}</button><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Latest version"><input required value={settings.latest_version} onChange={(e) => setSettings({ ...settings, latest_version: e.target.value })} className={inputClass} placeholder="1.1.0" /></Field><Field label="Minimum required"><input required value={settings.min_required_version} onChange={(e) => setSettings({ ...settings, min_required_version: e.target.value })} className={inputClass} placeholder="1.0.0" /></Field></div><div className="mt-4"><Field label="Update URL"><input required type="url" value={settings.update_url} onChange={(e) => setSettings({ ...settings, update_url: e.target.value })} className={inputClass} placeholder="https://play.google.com/..." /></Field></div><div className="mt-4"><Field label="Update message"><textarea required rows={3} value={settings.update_message} onChange={(e) => setSettings({ ...settings, update_message: e.target.value })} className={inputClass} /></Field></div></GlassPanel>
      <GlassPanel className="p-5 sm:p-6"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-400/10 text-violet-200"><MessageSquareText className="h-5 w-5" /></span><div><h3 className="font-bold">AI teacher</h3><p className="mt-1 text-xs text-white/35">Control the worker and system personality.</p></div></div><div className="mt-6"><Field label="Cloudflare Worker URL"><input type="url" value={settings.ai_worker_url} onChange={(e) => setSettings({ ...settings, ai_worker_url: e.target.value })} className={inputClass} placeholder="https://your-worker.workers.dev/v1/chat" /></Field></div><div className="mt-4"><Field label="AI system prompt" hint="Tell the AI which board, language, tone and teaching method to use."><textarea required rows={8} value={settings.ai_system_prompt} onChange={(e) => setSettings({ ...settings, ai_system_prompt: e.target.value })} className={inputClass} /></Field></div></GlassPanel>
      <GlassPanel className="p-5 sm:p-6 xl:col-span-2"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-200"><Zap className="h-5 w-5" /></span><div><h3 className="font-bold">Global notice banner</h3><p className="mt-1 text-xs text-white/35">This message scrolls across the top of the student dashboard.</p></div></div><div className="mt-5"><Field label="Notice text"><input required value={settings.notice_banner} onChange={(e) => setSettings({ ...settings, notice_banner: e.target.value })} className={inputClass} /></Field></div></GlassPanel>
      <div className="flex justify-end xl:col-span-2"><button disabled={saving} className={`${primaryButton} min-w-44`}>{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save controls</button></div>
    </form>
  </div>;
}

/* -------------------------------------------------------------------------- */
/*                                  Modal                                     */
/* -------------------------------------------------------------------------- */

function EditorModal({ open, onClose, title, children, wide = false, extraWide = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean; extraWide?: boolean }) {
  return <AnimatePresence>{open && <div className="fixed inset-0 z-[80] grid place-items-center p-3 sm:p-6"><motion.button aria-label="Close editor" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/75 backdrop-blur-md" /><motion.div initial={{ opacity: 0, scale: 0.96, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 12 }} transition={{ type: "spring", stiffness: 260, damping: 25 }} className={`relative max-h-[92vh] w-full overflow-y-auto rounded-[1.75rem] border border-white/12 bg-[#10131f]/96 shadow-2xl backdrop-blur-3xl ${extraWide ? "max-w-5xl" : wide ? "max-w-2xl" : "max-w-lg"}`}><div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#10131f]/92 p-5 backdrop-blur-2xl"><div><p className="text-[9px] font-bold tracking-[0.18em] text-cyan-300/65 uppercase">Content editor</p><h3 className="mt-1 text-xl font-black">{title}</h3></div><button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-white/50 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button></div><div className="p-5 sm:p-6">{children}</div></motion.div></div>}</AnimatePresence>;
}
