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
  { label: "Wallet Activity", href: "/account/wallet" },
  { label: "My Orders", href: "/account/orders" },
  { label: "My Returns", href: "/account/returns" },
  // { label: "Points History", href: "/account/points/history" },
];

type AccountLayoutShellProps = {
  user: AccountOverview;
  children: ReactNode;
};

function isNavActive(pathname: string, href: string) {
  const isExactMatch = pathname === href;
  const isPrefixMatch = pathname.startsWith(`${href}/`);
  const hasBetterMatch = navItems.some(
    (other) =>
      other.href !== href &&
      other.href.length > href.length &&
      (pathname === other.href || pathname.startsWith(`${other.href}/`)),
  );
  return isExactMatch || (isPrefixMatch && !hasBetterMatch);
}

export function AccountLayoutShell({ user, children }: AccountLayoutShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, customer } = useAuth();
  const { resetAfterLogout } = useCart();

  const overview = customer ?? user;
  const profile = overview?.profile;

  const handleLogout = async () => {
    await logout();
    await resetAfterLogout();
    router.push("/");
    router.refresh();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr] lg:gap-6">
      {/* Desktop only — mobile uses header account sheet */}
      <aside className="hidden h-fit rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4 shadow-sm sm:p-5 lg:block lg:p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="relative h-12 w-12 flex-none overflow-hidden rounded-full border border-[var(--muted)] bg-[var(--muted)]/40">
            <Image
              src={profile?.avatar || "/images/default_user_image.jpg"}
              alt={profile?.name || "User"}
              fill
              sizes="48px"
              className="rounded-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-semibold text-[var(--foreground)]">
              {profile?.name}
            </div>
            <div className="truncate text-sm text-[var(--foreground)]/70">{profile?.email}</div>
          </div>
        </div>

        <nav aria-label="Account" className="space-y-1 text-sm">
          {navItems.map((item) => {
            const isActive = isNavActive(pathname, item.href);
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
                {isActive ? <span className="h-2 w-2 rounded-full bg-[var(--accent-strong)]" /> : null}
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
              aria-hidden
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

      <section className="min-w-0 space-y-5 rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4 shadow-sm sm:space-y-6 sm:p-5 lg:p-6">
        {children}
      </section>
    </div>
  );
}
