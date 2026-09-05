"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getBookingCart, getCustomerWallet, getServicePackages } from "@/lib/apiClient";
import { CartDrawer } from "@/components/booking/CartDrawer";

const PACKAGES_PATH = "/services-packages";

export function Header({ logoUrl }: { logoUrl?: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, loading: authLoading } = useAuth();
  const [cartOpen, setCartOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileUserMenuOpen, setMobileUserMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hasPackages, setHasPackages] = useState(false);
  const [walletBalance, setWalletBalance] = useState<string | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const packagesHref = PACKAGES_PATH;
  const ecommerceHref = process.env.NEXT_PUBLIC_ECOMMERCE_BASE_URL?.trim() || "/";

  const isActive = (path: string) => (pathname === path || pathname?.startsWith(`${path}/`) ? "text-[var(--foreground)]" : "text-[var(--text-muted)]");
  const packagesNavClass =
    pathname === PACKAGES_PATH || pathname?.startsWith(`${PACKAGES_PATH}/`)
      ? "text-[var(--foreground)]"
      : "text-[var(--text-muted)]";
  const fallbackLogo = "/images/logo.png";
  const resolvedLogoUrl = logoUrl || fallbackLogo;
  
  const onLogout = async () => {
    await logout();
    setUserMenuOpen(false);
    setMobileUserMenuOpen(false);
    router.push("/");
  };

  useEffect(() => {
    if (!user) { const id = window.setTimeout(() => setWalletBalance(null), 0); return () => window.clearTimeout(id); }
    let cancelled = false;
    const loadWallet = async () => {
      try { const wallet = await getCustomerWallet(); if (!cancelled) setWalletBalance(wallet.wallet_balance ?? wallet.balance ?? "0.00"); } catch { if (!cancelled) setWalletBalance(null); }
    };
    void loadWallet();
    window.addEventListener("walletBalanceUpdated", loadWallet);
    return () => { cancelled = true; window.removeEventListener("walletBalanceUpdated", loadWallet); };
  }, [user]);

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

  // Prevent body scroll when mobile menu / account sheet is open
  useEffect(() => {
    if (mobileMenuOpen || mobileUserMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen, mobileUserMenuOpen]);

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
    // NEW ENHANCEMENT — booking-shop-query-v1: softer poll; skip static/policy pages
    const staticPath =
      typeof window !== "undefined" &&
      /\/(privacy-policy|shipping-policy|return-refund|contact|flush)(\/|$)/.test(window.location.pathname);
    const intervalMs = staticPath ? 60_000 : 15_000;
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void loadCartCount();
    }, intervalMs);
    
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

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[var(--muted)]/50 bg-[var(--background)]/90 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-[var(--background)]/80">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-4 sm:gap-3 sm:px-6 md:h-16 lg:gap-4 lg:px-8">
          {/* Desktop: Logo + Navigation */}
          <div className="hidden min-w-0 flex-1 items-center gap-6 md:flex">
            <Link href="/" className="flex h-8 w-[120px] shrink-0 items-center md:h-9 lg:w-[130px]">
              <Image
                src={resolvedLogoUrl}
                alt="Gentlegurl Shop"
                width={120}
                height={40}
                className="h-full w-auto max-w-full object-contain object-left"
                priority
              />
            </Link>

            <nav className="hidden gap-1 text-sm font-medium md:flex xl:gap-2">
              <Link
                href="/"
                className={`${isActive("/")} whitespace-nowrap rounded-lg px-2.5 py-2 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]`}
              >
                Home
              </Link>
              {hasPackages ? (
                <Link
                  href={packagesHref}
                  className={`${packagesNavClass} whitespace-nowrap rounded-lg px-2.5 py-2 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]`}
                >
                  Packages
                </Link>
              ) : null}
              <Link
                href="/booking"
                className={`${isActive("/booking")} whitespace-nowrap rounded-lg px-2.5 py-2 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]`}
              >
                Book
              </Link>
              <Link
                href={ecommerceHref}
                className="whitespace-nowrap rounded-lg px-2.5 py-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
              >
                Ecommerce
              </Link>
            </nav>
          </div>

          {/* Mobile: Hamburger + Logo + Actions */}
          <div className="flex w-full min-w-0 items-center gap-2 sm:gap-3 md:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="inline-flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full text-[var(--foreground)]/80 transition-colors hover:bg-[var(--muted)]/60 hover:text-[var(--accent-strong)]"
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              <svg className="pointer-events-none h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                )}
              </svg>
            </button>

            <Link href="/" className="flex h-8 w-[72px] min-w-0 shrink items-center sm:w-[96px]">
              <Image
                src={resolvedLogoUrl}
                alt="Gentlegurl Shop"
                width={120}
                height={40}
                className="h-full w-auto max-w-full object-contain object-left"
                priority
              />
            </Link>

            <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-2">
              {authLoading ? (
                <div className="h-9 w-[6.5rem] animate-pulse rounded-lg bg-[var(--muted)]/50" />
              ) : user ? (
                <div className="relative" data-mobile-user-menu>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setMobileUserMenuOpen((prev) => !prev);
                    }}
                    className="flex max-w-[7.25rem] touch-manipulation items-center gap-1 rounded-lg border border-[var(--card-border)]/60 bg-[var(--card)]/50 px-1.5 py-1 transition-colors hover:border-[var(--accent-strong)]/50 hover:bg-[var(--muted)]/30"
                    aria-expanded={mobileUserMenuOpen}
                    aria-label="Account menu"
                  >
                    <div className="h-6 w-6 shrink-0 overflow-hidden rounded-full border border-[var(--muted)] bg-[var(--muted)]/30">
                      <Image
                        src="/images/default_user_image.jpg"
                        alt={user?.name ?? "User avatar"}
                        width={24}
                        height={24}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-[11px] font-medium leading-tight text-[var(--foreground)]/80">{user?.name}</span>
                      {walletBalance !== null && (
                        <span className="block truncate text-[9px] font-semibold leading-tight text-[var(--accent-strong)]">
                          Balance RM {Number(walletBalance).toFixed(2)}
                        </span>
                      )}
                    </span>
                    <svg
                      className={`h-2.5 w-2.5 shrink-0 transition-transform ${mobileUserMenuOpen ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                </div>
              ) : (
                <Link
                  href={`/login?redirect=${encodeURIComponent(pathname || "/booking")}`}
                  className="inline-flex h-11 w-11 touch-manipulation items-center justify-center rounded-full text-[var(--foreground)]/80 transition-colors hover:bg-[var(--muted)]/60 hover:text-[var(--accent-strong)]"
                  aria-label="Login"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7Z" />
                  </svg>
                </Link>
              )}

              <button
                type="button"
                onClick={() => setCartOpen(true)}
                className="relative inline-flex h-11 w-11 touch-manipulation items-center justify-center rounded-full text-[var(--foreground)]/80 transition-colors hover:bg-[var(--muted)]/60 hover:text-[var(--accent-strong)]"
                aria-label="Open cart"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
                </svg>
                {cartCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent-strong)] text-[10px] font-semibold text-white shadow-sm">
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Desktop: Right Side Actions */}
          <div className="hidden shrink-0 items-center gap-2 md:flex md:gap-3">
            {authLoading ? (
              <div className="h-8 w-24 animate-pulse rounded bg-[var(--muted)]/50" />
            ) : user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((prev) => !prev)}
                  className="flex touch-manipulation items-center gap-2 rounded-lg border border-[var(--card-border)]/60 bg-[var(--card)]/50 px-3 py-1.5 transition-colors hover:border-[var(--accent-strong)]/50 hover:bg-[var(--muted)]/30"
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
                  <span className="max-w-[10rem] text-left">
                    <span className="block truncate text-sm font-medium text-[var(--foreground)]/80">{user?.name}</span>
                    {walletBalance !== null && (
                      <span className="block text-[11px] font-semibold text-[var(--accent-strong)]">
                        Balance RM {Number(walletBalance).toFixed(2)}
                      </span>
                    )}
                  </span>
                  <svg
                    className={`h-3 w-3 shrink-0 transition-transform ${userMenuOpen ? "rotate-180" : ""}`}
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
                        {walletBalance !== null && (
                          <div className="mt-1 text-xs font-semibold text-[var(--accent-strong)]">
                            Balance RM {Number(walletBalance).toFixed(2)}
                          </div>
                        )}
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
                      href="/account/wallet"
                      className="block rounded-lg px-3 py-2 text-sm text-[var(--foreground)]/80 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      Wallet Activity
                    </Link>
                    <Link
                      href="/account/bookings"
                      className="block rounded-lg px-3 py-2 text-sm text-[var(--foreground)]/80 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      My Bookings
                    </Link>
                    <Link
                      href="/account/transactions"
                      className="block rounded-lg px-3 py-2 text-sm text-[var(--foreground)]/80 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      My Transactions
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
                      type="button"
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
                className="inline-flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full text-[var(--foreground)]/80 transition-colors hover:bg-[var(--muted)]/60 hover:text-[var(--accent-strong)]"
                aria-label="Login"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21a8 8 0 0 0-16 0" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </Link>
            )}

            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="relative inline-flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full text-[var(--foreground)]/80 transition-colors hover:bg-[var(--muted)]/60 hover:text-[var(--accent-strong)]"
              aria-label="Open cart"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
              </svg>
              {cartCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent-strong)] text-[10px] font-semibold text-white shadow-sm">
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
          <div className="fixed left-0 top-0 z-40 flex h-[100dvh] w-[min(22rem,90vw)] flex-col border-r border-[var(--card-border)]/50 bg-[var(--card)]/98 shadow-2xl backdrop-blur-md md:hidden">
            <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--muted)]/50 px-4 md:h-16">
              <Link href="/" className="flex h-8 w-[110px] items-center" onClick={() => setMobileMenuOpen(false)}>
                <Image
                  src={resolvedLogoUrl}
                  alt="Gentlegurl Shop"
                  width={110}
                  height={36}
                  className="h-full w-auto object-contain object-left"
                />
              </Link>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex h-11 w-11 touch-manipulation items-center justify-center rounded-full text-[var(--foreground)]/80 transition-colors hover:bg-[var(--muted)]/60 hover:text-[var(--accent-strong)]"
                aria-label="Close menu"
              >
                <svg className="pointer-events-none h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch]">
              <nav className="space-y-1">
                <Link
                  href="/"
                  className="flex min-h-[48px] touch-manipulation items-center rounded-xl px-4 py-3 text-base font-medium text-[var(--foreground)]/85 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)] active:bg-[var(--muted)]/70"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Home
                </Link>
                {hasPackages ? (
                  <Link
                    href={packagesHref}
                    className="flex min-h-[48px] touch-manipulation items-center rounded-xl px-4 py-3 text-base font-medium text-[var(--foreground)]/85 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)] active:bg-[var(--muted)]/70"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Packages
                  </Link>
                ) : null}
                <Link
                  href="/booking"
                  className="flex min-h-[48px] touch-manipulation items-center rounded-xl px-4 py-3 text-base font-medium text-[var(--foreground)]/85 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)] active:bg-[var(--muted)]/70"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Book
                </Link>
                <Link
                  href={ecommerceHref}
                  className="flex min-h-[48px] touch-manipulation items-center rounded-xl px-4 py-3 text-base font-medium text-[var(--foreground)]/85 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)] active:bg-[var(--muted)]/70"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Ecommerce
                </Link>
              </nav>
            </div>
          </div>
        </>
      )}
      {/* Mobile account bottom sheet */}
      {mobileUserMenuOpen && user ? (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm md:hidden"
            onClick={() => setMobileUserMenuOpen(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Account menu"
            className="fixed inset-x-0 bottom-0 z-[51] max-h-[min(78vh,560px)] overflow-hidden rounded-t-2xl border border-[var(--card-border)]/60 bg-[var(--card)] shadow-2xl md:hidden"
            style={{ animation: "account-sheet-up 0.22s ease-out" }}
          >
            <div className="flex justify-center pt-2.5">
              <div className="h-1 w-10 rounded-full bg-[var(--muted)]" />
            </div>
            <div className="flex items-start justify-between gap-3 border-b border-[var(--muted)]/50 px-4 pb-3 pt-2">
              <div className="flex min-w-0 items-center gap-3">
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-[var(--muted)] bg-[var(--muted)]/30">
                  <Image
                    src="/images/default_user_image.jpg"
                    alt={user?.name ?? "User avatar"}
                    width={44}
                    height={44}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[var(--foreground)]">{user?.name}</div>
                  {user?.email ? <div className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{user.email}</div> : null}
                  {walletBalance !== null && (
                    <div className="mt-1 text-xs font-semibold text-[var(--accent-strong)]">
                      Balance RM {Number(walletBalance).toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileUserMenuOpen(false)}
                className="inline-flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-full text-[var(--foreground)]/70 transition-colors hover:bg-[var(--muted)]/60"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto overscroll-contain px-3 py-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <nav className="space-y-1">
                <Link
                  href="/account"
                  className="flex min-h-[48px] touch-manipulation items-center rounded-xl px-4 py-3 text-base font-medium text-[var(--foreground)]/85 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
                  onClick={() => setMobileUserMenuOpen(false)}
                >
                  My Account
                </Link>
                <Link
                  href="/account/wallet"
                  className="flex min-h-[48px] touch-manipulation items-center rounded-xl px-4 py-3 text-base font-medium text-[var(--foreground)]/85 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
                  onClick={() => setMobileUserMenuOpen(false)}
                >
                  Wallet Activity
                </Link>
                <Link
                  href="/account/bookings"
                  className="flex min-h-[48px] touch-manipulation items-center rounded-xl px-4 py-3 text-base font-medium text-[var(--foreground)]/85 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
                  onClick={() => setMobileUserMenuOpen(false)}
                >
                  My Bookings
                </Link>
                <Link
                  href="/account/transactions"
                  className="flex min-h-[48px] touch-manipulation items-center rounded-xl px-4 py-3 text-base font-medium text-[var(--foreground)]/85 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
                  onClick={() => setMobileUserMenuOpen(false)}
                >
                  My Transactions
                </Link>
                <Link
                  href="/account/packages"
                  className="flex min-h-[48px] touch-manipulation items-center rounded-xl px-4 py-3 text-base font-medium text-[var(--foreground)]/85 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
                  onClick={() => setMobileUserMenuOpen(false)}
                >
                  My Packages
                </Link>
                <div className="my-1 border-t border-[var(--muted)]/50" />
                <button
                  type="button"
                  onClick={onLogout}
                  className="flex min-h-[48px] w-full touch-manipulation items-center rounded-xl px-4 py-3 text-left text-base font-medium text-[var(--accent-strong)] transition-colors hover:bg-[var(--muted)]/50"
                >
                  Logout
                </button>
              </nav>
            </div>
          </div>
          <style>{`@keyframes account-sheet-up{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
        </>
      ) : null}
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
