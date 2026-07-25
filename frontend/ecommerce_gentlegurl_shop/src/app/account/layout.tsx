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
    <div className="bg-[var(--muted)]/30 py-6 sm:py-8 lg:py-10">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-5 sm:mb-8">
          <p className="text-xs uppercase tracking-[0.08em] text-[var(--foreground)]/70 sm:text-sm">
            Member Center
          </p>
          <h1 className="text-2xl font-semibold text-[var(--foreground)] sm:text-3xl">Account</h1>
        </div>
        <AccountLayoutShell user={user}>{children}</AccountLayoutShell>
      </div>
    </div>
  );
}
