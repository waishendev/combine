"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { CartDrawer } from "@/components/booking/CartDrawer";

export function Header({ logoUrl }: { logoUrl?: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [isCartOpen, setIsCartOpen] = useState(false);


  const isActive = (path: string) => {
    if (path === "/") {
      return pathname === "/" ? "text-black" : "text-neutral-500";
    }

    return pathname === path || pathname?.startsWith(`${path}/`) ? "text-black" : "text-neutral-500";
  };
  const fallbackLogo = "/images/logo.png";
  const resolvedLogoUrl = logoUrl || fallbackLogo;
  
  const onLogout = async () => {
    await logout();
    router.push("/");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/95 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="hidden items-center md:flex h-8 w-[120px] shrink-0">
              <Image
                src={resolvedLogoUrl}
                alt="Gentlegurl Shop"
                width={120}
                height={40}
                className="h-8 w-auto object-contain"
                priority
              />
            </Link>
        <div className="flex items-center gap-4 text-sm font-medium">
          <Link href="/" className={isActive("/")}>Home</Link>
          <Link href="/booking" className={isActive("/booking")}>Book Appointment</Link>
          <Link href="/account/bookings" className={isActive("/account/bookings")}>My Bookings</Link>
          <button type="button" onClick={() => setIsCartOpen(true)} className={isCartOpen ? "text-black" : isActive("/booking/cart")}>Cart</button>
          {user ? (
            <>
              <button type="button" onClick={onLogout} className="rounded-full border border-neutral-200 px-4 py-2">Logout</button>
            </>
          ) : (
            <Link href={`/login?redirect=${encodeURIComponent(pathname || "/booking")}`} className="rounded-full bg-black px-4 py-2 text-white">Login</Link>
          )}
        </div>
      </nav>
      <CartDrawer open={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </header>
  );
}
