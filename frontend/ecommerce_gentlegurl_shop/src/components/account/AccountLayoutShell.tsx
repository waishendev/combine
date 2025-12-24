"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode } from "react";
import { AccountOverview } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";

const navItems = [
  { label: "My Account", href: "/account" },
  { label: "My Orders", href: "/account/orders" },
  // { label: "Points History", href: "/account/points/history" },
];

type AccountLayoutShellProps = {
  user: AccountOverview;
  children: ReactNode;
};

export function AccountLayoutShell({ user, children }: AccountLayoutShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, customer } = useAuth();
  const { resetAfterLogout } = useCart();

  const overview = customer ?? user;
  const profile = overview?.profile;

  const initial = profile?.name ? profile.name.trim().charAt(0).toUpperCase() : "?";

  const handleLogout = async () => {
    await logout();
    await resetAfterLogout();
    router.push("/");
    router.refresh();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="h-fit rounded-xl border border-[var(--muted)] bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="relative h-12 w-12 flex-none overflow-hidden rounded-full border border-[var(--muted)] bg-[var(--muted)]/40">
            <Image
              src={profile?.avatar || "/images/default_user_image.jpg"}
              alt={profile.name}
              fill
              sizes="48px"
              className="rounded-full object-cover"
            />
          </div>
          <div>
            <div className="text-base font-semibold text-[var(--foreground)]">{profile?.name}</div>
            <div className="text-sm text-[var(--foreground)]/70">{profile?.email}</div>
          </div>
        </div>

        <nav className="space-y-1 text-sm">
          {navItems.map((item) => {
            // Only highlight exact match, or if pathname starts with this href but no other nav item is a better match
            const isExactMatch = pathname === item.href;
            const isPrefixMatch = pathname.startsWith(`${item.href}/`);
            const hasBetterMatch = navItems.some(other => 
              other.href !== item.href && 
              other.href.length > item.href.length &&
              (pathname === other.href || pathname.startsWith(`${other.href}/`))
            );
            const isActive = isExactMatch || (isPrefixMatch && !hasBetterMatch);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between rounded-lg px-3 py-2 transition-colors ${
                  isActive
                    ? "border-l-4 border-[var(--accent-strong)] bg-[var(--muted)]/60 font-semibold text-[var(--foreground)]"
                    : "text-[var(--foreground)]/80 hover:bg-[var(--muted)]/50"
                }`}
              >
                <span>{item.label}</span>
                {isActive && <span className="h-2 w-2 rounded-full bg-[var(--accent-strong)]" />}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={handleLogout}
            className="mt-2 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[var(--accent-strong)] transition-colors hover:bg-[var(--muted)]/60"
          >
            <span>Logout</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              className="h-4 w-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6A2.25 2.25 0 0 0 5.25 5.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="m12 9 3-3m0 0 3 3m-3-3v12" />
            </svg>
          </button>
        </nav>
      </aside>

      <section className="space-y-6 rounded-xl border border-[var(--muted)] bg-white p-6 shadow-sm">
        {children}
      </section>
    </div>
  );
}
