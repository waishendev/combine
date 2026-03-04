"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export function Header({ logoUrl }: { logoUrl?: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const isActive = (path: string) => (pathname === path ? "text-black" : "text-neutral-500");

  const onLogout = async () => {
    await logout();
    router.push("/");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/95 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-semibold tracking-wide">
          {logoUrl ? (
            <Image src={logoUrl} alt="Shop logo" width={140} height={40} className="h-10 w-auto object-contain" unoptimized />
          ) : (
            "GentleGurls"
          )}
        </Link>
        <div className="flex items-center gap-4 text-sm font-medium">
          <Link href="/" className={isActive("/")}>Home</Link>
          <Link href="/booking" className={isActive("/booking")}>Book</Link>
          <Link href="/services" className={isActive("/services")}>Services</Link>
          {user ? (
            <>
              <Link href="/account/bookings" className={isActive("/account/bookings")}>My Bookings</Link>
              <button onClick={onLogout} className="rounded-full border border-neutral-200 px-4 py-2">Logout</button>
            </>
          ) : (
            <Link href={`/login?redirect=${encodeURIComponent(pathname || "/booking")}`} className="rounded-full bg-black px-4 py-2 text-white">Login</Link>
          )}
        </div>
      </nav>
    </header>
  );
}
