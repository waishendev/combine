"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export function Header({ logoUrl }: { logoUrl?: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const fallbackLogo = "/images/logo.png";
  const resolvedLogoUrl = logoUrl || fallbackLogo;

  const navClass = (path: string) =>
    pathname === path ? "text-neutral-900" : "text-neutral-500 transition hover:text-neutral-900";

  const onLogout = async () => {
    await logout();
    router.push("/");
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[#e8dfd4]/70 bg-[#f7f3ee]/95 backdrop-blur">
      <nav className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-4 md:px-8">
        <Link href="/" className="flex h-8 w-[124px] shrink-0 items-center">
          <Image
            src={resolvedLogoUrl}
            alt="Gentlegurl Shop"
            width={124}
            height={42}
            className="h-8 w-auto object-contain"
            priority
          />
        </Link>

        <div className="flex items-center gap-3 md:gap-6">
          <Link href="/" className={`text-xs font-medium uppercase tracking-[0.16em] ${navClass("/")}`}>
            Home
          </Link>
          <Link href="/services" className={`hidden text-xs font-medium uppercase tracking-[0.16em] sm:block ${navClass("/services")}`}>
            Services
          </Link>
          <Link href="/booking" className={`text-xs font-medium uppercase tracking-[0.16em] ${navClass("/booking")}`}>
            Booking
          </Link>

          {user ? (
            <>
              <Link
                href="/account/bookings"
                className={`hidden text-xs font-medium uppercase tracking-[0.16em] md:block ${navClass("/account/bookings")}`}
              >
                My Bookings
              </Link>
              <button
                onClick={onLogout}
                className="rounded-full border border-neutral-900 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.15em] text-neutral-900 transition hover:bg-neutral-900 hover:text-white"
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              href={`/login?redirect=${encodeURIComponent(pathname || "/booking")}`}
              className="rounded-full border border-neutral-900 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.15em] text-neutral-900 transition hover:bg-neutral-900 hover:text-white"
            >
              Login
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
