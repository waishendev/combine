"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getBookingCart, getServicePackages } from "@/lib/apiClient";
import { SERVICE_PACKAGES_SECTION_ID } from "@/lib/landingAnchors";
import { CartDrawer } from "@/components/booking/CartDrawer";

export function Header({ logoUrl }: { logoUrl?: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, loading: authLoading } = useAuth();
  const [cartOpen, setCartOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hasPackages, setHasPackages] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const packagesHref = `/#${SERVICE_PACKAGES_SECTION_ID}`;

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

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

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

    // Listen for open cart drawer (e.g. after adding from slots page)
    const handleOpenCart = () => setCartOpen(true);
    window.addEventListener("openCart", handleOpenCart);

    return () => {
      clearInterval(interval);
      window.removeEventListener("cartUpdated", handleCartUpdate as EventListener);
      window.removeEventListener("openCart", handleOpenCart);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await getServicePackages();
        const list = Array.isArray(rows) ? rows : [];
        const active = list.filter((p) => p.is_active !== false);
        if (!cancelled) setHasPackages(active.length > 0);
      } catch {
        if (!cancelled) setHasPackages(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const scrollToServicePackages = () => {
    document.getElementById(SERVICE_PACKAGES_SECTION_ID)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const onPackagesNavClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (pathname === "/" && hasPackages) {
      e.preventDefault();
      scrollToServicePackages();
    }
    setMobileMenuOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[var(--muted)]/50 bg-[var(--background)]/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          {/* Desktop: Logo + Navigation */}
          <div className="hidden items-center gap-6 md:flex">
            <Link href="/" className="flex h-8 w-[120px] shrink-0 items-center">
              <Image
                src={resolvedLogoUrl}
                alt="Gentlegurl Shop"
                width={120}
                height={40}
                className="h-8 w-auto object-contain"
                priority
              />
            </Link>

            <nav className="hidden gap-6 text-sm font-medium md:flex">
              <Link href="/" className={isActive("/")}>
                Home
              </Link>
              {hasPackages ? (
                <Link
                  href={packagesHref}
                  onClick={onPackagesNavClick}
                  className="text-[var(--text-muted)] transition-colors hover:text-[var(--foreground)]"
                >
                  Packages
                </Link>
              ) : null}
              <Link href="/booking" className={isActive("/booking")}>
                Book
              </Link>
            </nav>
          </div>

          {/* Mobile: Hamburger + Logo + Actions */}
          <div className="flex w-full items-center gap-4 md:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="flex items-center text-[var(--text-muted)] transition-colors hover:text-[var(--foreground)]"
              aria-label="Toggle menu"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>

            <Link href="/" className="flex h-7 w-[120px] shrink-0 items-center">
              <Image
                src={resolvedLogoUrl}
                alt="Gentlegurl Shop"
                width={120}
                height={40}
                className="h-7 w-auto object-contain"
                priority
              />
            </Link>

            <div className="ml-auto flex items-center gap-3">
              {authLoading ? (
                <div className="h-8 w-8 animate-pulse rounded-full bg-[var(--muted)]/50" />
              ) : user ? (
                <Link
                  href="/account"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:text-[var(--foreground)]"
                  aria-label="Account"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7Z" />
                  </svg>
                </Link>
              ) : (
                <Link
                  href={`/login?redirect=${encodeURIComponent(pathname || "/booking")}`}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:text-[var(--foreground)]"
                  aria-label="Login"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7Z" />
                  </svg>
                </Link>
              )}

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
          </div>

          {/* Desktop: Right Side Actions */}
          <div className="hidden items-center gap-4 md:flex">
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
                  <svg
                    className={`h-3 w-3 transition-transform ${userMenuOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
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
                    {/* <Link
                      href="/account/packages"
                      className="block rounded-lg px-3 py-2 text-sm text-[var(--foreground)]/80 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      My Packages
                    </Link> */}
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
              <Link
                href={`/login?redirect=${encodeURIComponent(pathname || "/booking")}`}
                className="relative flex items-center text-[var(--text-muted)] transition-colors hover:text-[var(--foreground)]"
                aria-label="Login"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21a8 8 0 0 0-16 0" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </Link>
            )}

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
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed left-0 top-0 z-40 h-full w-80 max-w-[85vw] overflow-y-auto border-r border-[var(--card-border)]/50 bg-[var(--card)]/95 backdrop-blur-sm shadow-xl md:hidden">
            <div className="flex h-16 items-center justify-between border-b border-[var(--muted)]/50 px-4">
              <span className="text-sm font-semibold text-[var(--foreground)]">Menu</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center text-[var(--text-muted)] transition-colors hover:text-[var(--foreground)]"
                aria-label="Close menu"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-4 py-4">
              <nav className="space-y-1">
                <Link
                  href="/"
                  className="block rounded-lg px-3 py-2 text-sm text-[var(--foreground)]/80 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Home
                </Link>
                {hasPackages ? (
                  <Link
                    href={packagesHref}
                    className="block rounded-lg px-3 py-2 text-sm text-[var(--foreground)]/80 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
                    onClick={onPackagesNavClick}
                  >
                    Packages
                  </Link>
                ) : null}
                <Link
                  href="/booking"
                  className="block rounded-lg px-3 py-2 text-sm text-[var(--foreground)]/80 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Book
                </Link>
              </nav>
            </div>
          </div>
        </>
      )}
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
