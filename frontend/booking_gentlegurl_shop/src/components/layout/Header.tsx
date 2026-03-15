"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getBookingCart } from "@/lib/apiClient";
import { CartDrawer } from "@/components/booking/CartDrawer";

export function Header({ logoUrl }: { logoUrl?: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, loading: authLoading } = useAuth();
  const [cartOpen, setCartOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const isActive = (path: string) => (pathname === path || pathname?.startsWith(`${path}/`) ? "text-[var(--foreground)]" : "text-[var(--text-muted)]");
  const fallbackLogo = "/images/logo.png";
  const resolvedLogoUrl = logoUrl || fallbackLogo;
  
  const onLogout = async () => {
    await logout();
    setUserMenuOpen(false);
    router.push("/");
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load cart count
  useEffect(() => {
    const loadCartCount = async () => {
      try {
        const cart = await getBookingCart();
        const nextCount = (cart?.items?.length || 0) + (cart?.package_items?.length || 0);
        setCartCount(nextCount);
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
      <header className="sticky top-0 z-40 border-b border-[var(--muted)]/50 bg-[var(--background)]/80 backdrop-blur">
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
            {authLoading ? (
              <div className="h-8 w-24 animate-pulse rounded bg-[var(--muted)]/50" />
            ) : user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen((prev) => !prev)}
                  className="flex items-center gap-2 rounded-lg border border-[var(--card-border)]/60 bg-[var(--card)]/50 px-3 py-1.5 transition-colors hover:border-[var(--accent-strong)]/50 hover:bg-[var(--muted)]/30"
                >
                  <div className="h-8 w-8 overflow-hidden rounded-full border border-[var(--muted)] bg-[var(--muted)]/30">
                    <Image
                      src="/images/default_user_image.jpg"
                      alt={user?.name ?? "User avatar"}
                      width={32}
                      height={32}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <span className="text-sm font-medium text-[var(--foreground)]/80">{user?.name}</span>
                  <svg className={`h-3 w-3 transition-transform ${userMenuOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-[var(--card-border)]/60 bg-[var(--card)]/95 p-2 shadow-lg backdrop-blur-sm">
                    <div className="mb-2 border-b border-[var(--muted)]/50 pb-2">
                      <div className="px-3 py-1.5">
                        <div className="text-sm font-semibold text-[var(--foreground)]">{user?.name}</div>
                        <div className="mt-1 text-xs text-[var(--text-muted)]">{user?.email}</div>
                      </div>
                    </div>
                    <Link
                      href="/account"
                      className="block rounded-lg px-3 py-2 text-sm text-[var(--foreground)]/80 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      My Account
                    </Link>
                    <Link
                      href="/account/bookings"
                      className="block rounded-lg px-3 py-2 text-sm text-[var(--foreground)]/80 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      My Bookings
                    </Link>
                    <Link
                      href="/account/packages"
                      className="block rounded-lg px-3 py-2 text-sm text-[var(--foreground)]/80 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      My Packages
                    </Link>
                    <div className="my-1 border-t border-[var(--muted)]/50" />
                    <button
                      onClick={onLogout}
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--accent-strong)] transition-colors hover:bg-[var(--muted)]/50"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link href={`/login?redirect=${encodeURIComponent(pathname || "/booking")}`} className="rounded-full bg-[var(--accent-strong)] px-4 py-2 text-white hover:bg-[var(--accent-stronger)] transition-colors">Login</Link>
            )}
            {/* Cart Icon */}
            <button
              onClick={() => setCartOpen(true)}
              className="relative flex items-center text-[var(--text-muted)] transition-colors hover:text-[var(--foreground)]"
              aria-label="Open cart"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
              </svg>
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent-strong)] text-[10px] font-semibold text-white shadow-sm">
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
