"use client";

import { ReactNode } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import type { AuthUser } from "@/lib/types";

export function Providers({
  children,
  initialUser,
}: {
  children: ReactNode;
  initialUser?: AuthUser | null;
}) {
  return <AuthProvider initialUser={initialUser}>{children}</AuthProvider>;
}
