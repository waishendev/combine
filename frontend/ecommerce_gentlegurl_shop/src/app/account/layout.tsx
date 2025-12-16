import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AccountLayoutShell } from "@/components/account/AccountLayoutShell";
import { getUser } from "@/lib/server/getUser";

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const user = await getUser();

  if (!user) {
    redirect("/login");
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
