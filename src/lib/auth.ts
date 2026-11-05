import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

/**
 * next-auth (v4) configuration for SahajSkill.
 *
 * - Google OAuth via GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.
 * - JWT sessions signed with NEXTAUTH_SECRET.
 * - On sign-in, the user is inserted into the Turso `users` table (INSERT OR
 *   IGNORE). A failing DB sync is logged and never blocks the login.
 * - The role is 'admin' when the email matches NEXT_PUBLIC_ADMIN_EMAIL,
 *   otherwise 'student'. The env var is the single source of truth: changing
 *   it demotes the previous admin on their next sign-in or session refresh.
 * - The session exposes `user.id`, `user.role` and `user.xp_points`.
 */

type Role = "admin" | "student";

type DbUser = { id: string; role: Role; xp_points: number };

export function isTursoConfigured(): boolean {
  const url = process.env.TURSO_DATABASE_URL;
  return !!url && !url.includes("your-db.turso.io");
}

export function isAdminEmail(email: string | null | undefined): boolean {
  const admin = process.env.NEXT_PUBLIC_ADMIN_EMAIL?.trim().toLowerCase();
  const candidate = email?.trim().toLowerCase();
  return !!admin && !!candidate && admin === candidate;
}

/**
 * Load the db module lazily: `@/lib/db` throws at import time when
 * TURSO_DATABASE_URL is missing, which must not break sign-in.
 */
async function getDb() {
  const { db, initDatabase } = await import("@/lib/db");
  await initDatabase();
  return db;
}

/**
 * Insert the Google user into `users` (id, name, email, image -> avatar_url).
 * INSERT OR IGNORE skips existing rows (id or email conflict) instead of
 * throwing. The effective role always comes from isAdminEmail() in the jwt
 * callback, so the stored role is informational only.
 */
async function syncUser(params: {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: Role;
}): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: `INSERT OR IGNORE INTO users (id, name, email, avatar_url, role)
          VALUES (?, ?, ?, ?, ?)`,
    args: [params.id, params.name, params.email, params.avatarUrl, params.role],
  });
}

export async function findUserByEmail(email: string): Promise<DbUser | null> {
  const db = await getDb();
  const res = await db.execute({
    sql: "SELECT id, role, xp_points FROM users WHERE email = ?",
    args: [email],
  });
  const row = res.rows[0] as
    | { id?: unknown; role?: unknown; xp_points?: unknown }
    | undefined;
  if (!row) return null;
  return {
    id: String(row.id),
    role: row.role === "admin" ? "admin" : "student",
    xp_points: Number(row.xp_points ?? 0) || 0,
  };
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user, profile }) {
      // The Turso sync is best effort: any failure is logged and the user is
      // still allowed to sign in.
      try {
        const email = user.email?.trim().toLowerCase();
        if (!email || !isTursoConfigured()) return true;

        await syncUser({
          id: profile?.sub ?? user.id ?? crypto.randomUUID(),
          name: user.name ?? email.split("@")[0],
          email,
          avatarUrl: user.image ?? null,
          role: isAdminEmail(email) ? "admin" : "student",
        });
      } catch (err) {
        console.error("[auth] Turso user sync failed, allowing sign-in:", err);
      }
      return true;
    },

    async jwt({ token, user, trigger }) {
      const email = (user?.email ?? token.email)?.trim().toLowerCase();

      // Refresh DB-backed fields on sign-in and on explicit session updates.
      if (email && (user || trigger === "update" || !token.role)) {
        token.role = isAdminEmail(email) ? "admin" : "student";
        token.uid = token.uid ?? user?.id ?? token.sub;
        token.xp_points = token.xp_points ?? 0;

        if (isTursoConfigured()) {
          try {
            const dbUser = await findUserByEmail(email);
            if (dbUser) {
              token.uid = dbUser.id;
              token.xp_points = dbUser.xp_points;
            }
          } catch (err) {
            console.error("[auth] user lookup failed:", err);
          }
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid ?? token.sub ?? "";
        session.user.role = token.role ?? "student";
        session.user.xp_points = token.xp_points ?? 0;
      }
      return session;
    },
  },
};
