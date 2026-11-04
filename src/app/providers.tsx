"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";

/** Client-side providers (next-auth session) for the whole app. */
export function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
