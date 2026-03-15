"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AccountLayoutShell } from "@/components/account/AccountLayoutShell";
import { useAuth } from "@/contexts/AuthContext";

export default function AccountLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login?redirect=/account");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="bg-[var(--muted)]/30 py-10">
        <div className="mx-auto max-w-6xl px-4">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--muted)]/30 py-10">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.08em] text-[var(--foreground)]/70">Member Center</p>
          <h1 className="text-3xl font-semibold text-[var(--foreground)]">Account</h1>
        </div>
        <AccountLayoutShell user={user}>{children}</AccountLayoutShell>
      </div>
    </div>
  );
}
