"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getBookingCart } from "@/lib/apiClient";
import { CartDrawer } from "@/components/booking/CartDrawer";

export function Header({ logoUrl }: { logoUrl?: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [cartOpen, setCartOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  const isActive = (path: string) => (pathname === path || pathname?.startsWith(`${path}/`) ? "text-black" : "text-neutral-500");
  const fallbackLogo = "/images/logo.png";
  const resolvedLogoUrl = logoUrl || fallbackLogo;
  
  const onLogout = async () => {
    await logout();
    router.push("/");
  };

  // Load cart count
  useEffect(() => {
    const loadCartCount = async () => {
      try {
        const cart = await getBookingCart();
        setCartCount(cart?.items?.length || 0);
      } catch {
        setCartCount(0);
      }
    };

    loadCartCount();
    // Refresh cart count periodically
    const interval = setInterval(loadCartCount, 5000);
    
    // Listen for cart update events
    const handleCartUpdate = (event: CustomEvent<number>) => {
      setCartCount(event.detail);
    };
    window.addEventListener("cartUpdated", handleCartUpdate as EventListener);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener("cartUpdated", handleCartUpdate as EventListener);
    };
  }, []);

  return (
    <>
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
            <Link href="/booking" className={isActive("/booking")}>Book</Link>
            <Link href="/booking/packages" className={isActive("/booking/packages")}>Packages</Link>
            {user ? (
              <>
                <Link href="/account/bookings" className={isActive("/account/bookings")}>My Bookings</Link>
                <button onClick={onLogout} className="rounded-full border border-neutral-200 px-4 py-2">Logout</button>
              </>
            ) : (
              <Link href={`/login?redirect=${encodeURIComponent(pathname || "/booking")}`} className="rounded-full bg-black px-4 py-2 text-white">Login</Link>
            )}
            {/* Cart Icon */}
            <button
              onClick={() => setCartOpen(true)}
              className="relative flex items-center text-neutral-500 transition-colors hover:text-black"
              aria-label="Open cart"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
              </svg>
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black text-[10px] font-semibold text-white shadow-sm">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </button>
          </div>
        </nav>
      </header>
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
