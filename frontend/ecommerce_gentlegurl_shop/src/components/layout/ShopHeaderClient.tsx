"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import { getWishlistItems } from "@/lib/apiClient";
import { useAuth } from "../../contexts/AuthContext";
import { useCart } from "../../contexts/CartContext";
import {
  HomepageServicesMenuItem,
  HomepageShopMenuItem,
} from "@/lib/server/getHomepage";
import { buildRedirectTarget } from "@/lib/auth/redirect";
import { getOrCreateSessionToken } from "@/lib/sessionToken";
import { getPrimaryProductImage } from "@/lib/productMedia";

type ShopHeaderClientProps = {
  shopMenu: HomepageShopMenuItem[];
  servicesMenu: HomepageServicesMenuItem[];
  logoUrl?: string | null;
};

export function ShopHeaderClient({ shopMenu, servicesMenu, logoUrl }: ShopHeaderClientProps) {
  const { customer, logout, isLoading } = useAuth();
  const { items, resetAfterLogout } = useCart();
  const [shopOpen, setShopOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [membershipOpen, setMembershipOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileUserMenuOpen, setMobileUserMenuOpen] = useState(false);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{
      id: number | string;
      name: string;
      slug?: string;
      price_display?: string | null;
      sale_price_display?: string | null;
      price?: number | string;
      sale_price?: number | string | null;
      original_price?: number | string | { min: number; max: number } | null;
      cover_image_url?: string | null;
      images?: Array<{ image_path?: string | null; url?: string | null; sort_order?: number | null }>;
      media?: Array<{ type?: string; url?: string | null; sort_order?: number | null }>;
    }>
  >([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchImageErrors, setSearchImageErrors] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const fallbackLogo = "/images/logo.png";
  // 直接使用服务端传递的 logo，如果没有则使用 fallback
  const resolvedLogoUrl = logoUrl || fallbackLogo;
  const bookingHref = useMemo(() => {
    const rawBase = process.env.NEXT_PUBLIC_BOOKING_BASE_URL;
    const base = rawBase?.trim().replace(/\/+$/, "");
  
    return base || "#";
  }, []);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const hasShopMenu = shopMenu.length > 0;
  const hasServicesMenu = servicesMenu.length > 0;
  const navRef = useRef<HTMLElement>(null);
  const leftClusterRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLAnchorElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const navWrapsRef = useRef(true);
  const [isWideViewport, setIsWideViewport] = useState(false);
  /** When inline nav would wrap to 2+ rows, use hamburger drawer instead. */
  const [navWrapsToTwoLines, setNavWrapsToTwoLines] = useState(true);

  const useDrawerNav = !isWideViewport || navWrapsToTwoLines;
  const showInlineNav = isWideViewport && !navWrapsToTwoLines;

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsWideViewport(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const measureNavWrap = useCallback(() => {
    if (!isWideViewport) {
      if (navWrapsRef.current) {
        navWrapsRef.current = false;
        setNavWrapsToTwoLines(false);
      }
      return;
    }

    const nav = navRef.current;
    const leftCluster = leftClusterRef.current;
    const logo = logoRef.current;
    const actions = actionsRef.current;
    const headerRow = leftCluster?.parentElement;
    if (!nav || !logo || !actions || !headerRow) return;

    const logoWidth = logo.getBoundingClientRect().width;
    const actionsWidth = actions.getBoundingClientRect().width;
    const rowGap = parseFloat(window.getComputedStyle(headerRow).columnGap || "0") || 8;
    const navAvailableWidth = Math.max(0, headerRow.clientWidth - logoWidth - actionsWidth - rowGap * 2);

    const prevCssText = nav.style.cssText;
    nav.style.cssText = [
      "position:fixed",
      "left:-10000px",
      "top:0",
      `width:${navAvailableWidth}px`,
      "display:flex",
      "flex-wrap:wrap",
      "visibility:hidden",
      "pointer-events:none",
    ].join(";");

    const wraps = nav.getBoundingClientRect().height > 52;
    nav.style.cssText = prevCssText;

    if (wraps === navWrapsRef.current) return;
    navWrapsRef.current = wraps;
    setNavWrapsToTwoLines(wraps);
  }, [isWideViewport]);

  useLayoutEffect(() => {
    measureNavWrap();
  }, [measureNavWrap, shopMenu.length, servicesMenu.length]);

  useEffect(() => {
    let timeoutId: number | undefined;
    const onResize = () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(measureNavWrap, 200);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("resize", onResize);
    };
  }, [measureNavWrap]);

  useEffect(() => {
    if (!useDrawerNav) return;
    setShopOpen(false);
    setServicesOpen(false);
    setMembershipOpen(false);
  }, [useDrawerNav]);

  useEffect(() => {
    if (showInlineNav && mobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  }, [showInlineNav, mobileMenuOpen]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement;
      
      // Don't close if clicking on a link (let the link navigate)
      if (target.closest('a')) {
        return;
      }
      
      // Don't close dropdowns if clicking inside mobile menu panel
      const isInMobileMenu = target.closest('[data-mobile-menu]');
      
      // Only close desktop menus if not clicking inside desktop menu area
      if (!target.closest('[data-menu]') && !isInMobileMenu) {
        setShopOpen(false);
        setServicesOpen(false);
        setMembershipOpen(false);
        setUserMenuOpen(false);
      }
      if (!target.closest('[data-mobile-user-menu]')) {
        setMobileUserMenuOpen(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
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

  const overview = customer ?? null;
  const profile = overview?.profile;
  const loyalty = overview?.loyalty;

  const badgeCount = items.length;

  const loadWishlistCount = useCallback(() => {
    return getWishlistItems()
      .then((data) => {
        setWishlistCount(data.items?.length ?? 0);
      })
      .catch(() => {
        setWishlistCount(0);
      });
  }, []);

  useEffect(() => {
    loadWishlistCount();
  }, [customer?.profile?.id, loadWishlistCount]);

  useEffect(() => {
    const handler = () => {
      loadWishlistCount();
    };

    window.addEventListener("wishlist:updated", handler);
    return () => window.removeEventListener("wishlist:updated", handler);
  }, [loadWishlistCount]);

  const avatarUrl = profile?.avatar ?? "/images/default_user_image.jpg";
  const tierName = loyalty?.current_tier?.name ?? profile?.tier ?? "-";
  const availablePoints = loyalty?.points?.available;

  const redirectTarget = useMemo(() => {
    return buildRedirectTarget(pathname, searchParams?.toString());
  }, [pathname, searchParams]);

  const loginHref = `/login?redirect=${encodeURIComponent(redirectTarget)}`;

  const handleLogout = async () => {
    await logout();
    await resetAfterLogout();
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
    router.push("/");
    router.refresh();
  };

  useEffect(() => {
    if (!searchOpen) return;

    const t = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSearchOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [searchOpen]);

  const navigateToShopSearch = useCallback(
    (rawQuery?: string) => {
      const q = (rawQuery ?? searchQuery).trim();
      if (!q) return;
      setSearchOpen(false);
      router.push(`/shop?q=${encodeURIComponent(q)}`);
    },
    [router, searchQuery],
  );

  useEffect(() => {
    if (!searchOpen) {
      setSearchQuery("");
      setSearchResults([]);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }

    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    setSearchLoading(true);
    setSearchError(null);

    const timeout = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        params.set("page", "1");
        params.set("per_page", "8");
        params.set("q", query);

        const sessionToken = getOrCreateSessionToken();
        if (sessionToken) {
          params.set("session_token", sessionToken);
        }

        const res = await fetch(`/api/proxy/public/shop/products?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`Failed to search products (${res.status})`);
        }

        const json = await res.json();
        const payload = json.data ?? json;
        const items = Array.isArray(payload) ? payload : payload.data ?? payload.items ?? [];
        setSearchResults(items);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("[ShopHeader] search error", err);
        setSearchError("Unable to load search results right now.");
        setSearchResults([]);
      } finally {
        if (!controller.signal.aborted) {
          setSearchLoading(false);
        }
      }
    }, 350);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [searchOpen, searchQuery]);

  const handleSearchImageError = (imageSrc: string) => {
    setSearchImageErrors((prev) => new Set(prev).add(imageSrc));
  };

  const getSearchImageSrc = (imageSrc?: string | null) => {
    if (!imageSrc) return "/images/placeholder.png";
    return searchImageErrors.has(imageSrc) ? "/images/placeholder.png" : imageSrc;
  };

  const resolvePriceText = (
    value?: number | string | { min: number; max: number } | null,
  ): string | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === "object") {
      return `${value.min} - ${value.max}`;
    }
    return String(value);
  };

  return (
    <>
      <header className="shop-header sticky top-0 z-40 border-b border-[var(--muted)]/50 bg-[var(--background)]/90 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-[var(--background)]/80">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-4 sm:gap-3 sm:px-6 md:h-16 lg:gap-4 lg:px-8">
          <div ref={leftClusterRef} className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 lg:gap-6">
            <button
              type="button"
              data-nav-hamburger
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className={`${useDrawerNav ? "inline-flex" : "hidden"} h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full text-[var(--foreground)]/80 transition-colors hover:bg-[var(--muted)]/60 hover:text-[var(--accent-strong)]`}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
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

            <Link ref={logoRef} href="/" className="flex h-8 w-[96px] shrink-0 items-center sm:w-[120px] md:h-9 lg:w-[130px]">
              <Image
                src={resolvedLogoUrl}
                alt="Gentlegurl Shop"
                width={120}
                height={40}
                className="h-full w-auto max-w-full object-contain object-left"
                priority
              />
            </Link>

            <nav
              ref={navRef}
              aria-hidden={!showInlineNav}
              className={`${showInlineNav ? "flex" : "hidden"} min-w-0 flex-1 flex-nowrap items-center gap-x-0.5 text-sm text-[var(--foreground)]/80 xl:gap-x-1`}
            >
            <Link href="/" className="whitespace-nowrap rounded-lg px-2.5 py-2 font-medium transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]">Home</Link>

            {/* SHOP + Dropdown */}
            <div className="relative" data-menu>
              {hasShopMenu ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setShopOpen((prev) => !prev);
                      setServicesOpen(false);
                    }}
                    className="flex min-h-[44px] touch-manipulation items-center gap-1 rounded-lg px-2.5 py-2 font-medium transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
                  >
                    <span>Shop</span>
                    <svg
                      className="h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>

                  {shopOpen && (
                    <div className="absolute left-0 z-20 mt-2 w-56 rounded-md border border-[var(--muted)] bg-[var(--background)] shadow-lg">
                      <Link
                        href="/shop"
                        className="block px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)]/60"
                        onClick={() => setShopOpen(false)}
                      >
                        All Products
                      </Link>

                      <div className="my-1 border-t border-[var(--muted)]" />

                      {shopMenu
                        .slice()
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map((item) => (
                          <Link
                            key={item.id}
                            href={`/shop/${item.slug}`}
                            className="block px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)]/60"
                            onClick={() => setShopOpen(false)}
                          >
                            {item.label}
                          </Link>
                        ))}
                    </div>
                  )}
                </>
              ) : (
                <Link
                  href="/shop"
                  className="flex items-center gap-1 transition-colors hover:text-[var(--accent-strong)]"
                >
                  Shop
                </Link>
              )}
            </div>

            {/* Services & Courses Dropdown */}
            {hasServicesMenu && (
              <div className="relative" data-menu>
                <button
                  type="button"
                  onClick={() => {
                    setServicesOpen((prev) => !prev);
                    setShopOpen(false);
                  }}
                  className="flex min-h-[44px] touch-manipulation items-center gap-1 rounded-lg px-2.5 py-2 font-medium transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
                >
                  <span className="whitespace-nowrap">Services & Courses</span>
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>

                {servicesOpen && (
                  <div className="absolute left-0 z-20 mt-2 w-64 rounded-md border border-[var(--muted)] bg-[var(--background)] shadow-lg">
                    {servicesMenu.map((item) => (
                      <Link
                        key={item.id}
                        href={`/services/${item.slug}`}
                        className="block px-4 py-2 text-sm text-[var(--foreground)] transition hover:bg-[var(--muted)]/60"
                        onClick={() => setServicesOpen(false)}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Membership Dropdown */}
            <div className="relative" data-menu>
              <button
                type="button"
                onClick={() => {
                  setMembershipOpen((prev) => !prev);
                  setShopOpen(false);
                  setServicesOpen(false);
                }}
                className="flex min-h-[44px] touch-manipulation items-center gap-1 rounded-lg px-2.5 py-2 font-medium transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
              >
                <span>Membership</span>
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {membershipOpen && (
                <div className="absolute left-0 z-20 mt-2 w-56 rounded-md border border-[var(--muted)] bg-[var(--background)] shadow-lg">
                  <Link
                    href="/membership"
                    className="block px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)]/60"
                    onClick={() => setMembershipOpen(false)}
                  >
                    Membership Tiers
                  </Link>
                  <Link
                    href="/rewards"
                    className="block px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)]/60"
                    onClick={() => setMembershipOpen(false)}
                  >
                    Rewards Center
                  </Link>
                </div>
              )}
            </div>
            <Link
              href={bookingHref}
              className="whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
            >
              Appointments
            </Link>
            <Link href="/tracking" className="whitespace-nowrap rounded-lg px-2.5 py-2 font-medium transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]">
              Tracking
            </Link>
            <Link href="/reviews" className="whitespace-nowrap rounded-lg px-2.5 py-2 font-medium transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]">
              Store Reviews
            </Link>
          </nav>
        </div>

          <div ref={actionsRef} className="flex shrink-0 items-center gap-1 sm:gap-2 md:gap-3">
            {isLoading ? (
              <div className="h-8 w-24 animate-pulse rounded bg-[var(--muted)]/50" />
            ) : profile ? (
              <>
              <div className={`relative ${useDrawerNav ? "" : "hidden"}`} data-mobile-user-menu>
                <button
                  type="button"
                  onClick={() => setMobileUserMenuOpen((prev) => !prev)}
                  className="h-11 w-11 overflow-hidden rounded-full border-2 border-[var(--muted)] touch-manipulation transition-colors hover:border-[var(--accent-strong)]"
                >
                  <Image src={avatarUrl} alt={profile?.name ?? "User avatar"} width={44} height={44} className="h-full w-full object-cover" />
                </button>
                {mobileUserMenuOpen ? (
                  <div className="absolute right-0 z-50 mt-2 w-60 rounded-2xl border border-[var(--card-border)]/60 bg-[var(--card)]/98 p-2 shadow-xl backdrop-blur-md">
                    <div className="mb-2 border-b border-[var(--muted)]/50 px-3 py-2">
                      <div className="text-sm font-semibold text-[var(--foreground)]">{profile?.name}</div>
                    </div>
                    <Link href="/account" className="flex min-h-[44px] items-center rounded-xl px-4 py-2.5 text-sm hover:bg-[var(--muted)]/50" onClick={() => setMobileUserMenuOpen(false)}>My Account</Link>
                    <Link href="/account/orders" className="flex min-h-[44px] items-center rounded-xl px-4 py-2.5 text-sm hover:bg-[var(--muted)]/50" onClick={() => setMobileUserMenuOpen(false)}>My Orders</Link>
                    <Link href="/account/returns" className="flex min-h-[44px] items-center rounded-xl px-4 py-2.5 text-sm hover:bg-[var(--muted)]/50" onClick={() => setMobileUserMenuOpen(false)}>My Returns</Link>
                    <button type="button" onClick={() => { void handleLogout(); setMobileUserMenuOpen(false); }} className="mt-1 flex min-h-[44px] w-full items-center rounded-xl px-4 py-2.5 text-left text-sm text-[var(--accent-strong)] hover:bg-[var(--muted)]/50">Logout</button>
                  </div>
                ) : null}
              </div>
              <div className={`relative ${showInlineNav ? "block" : "hidden"}`} data-menu>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((prev) => !prev)}
                  className="flex touch-manipulation items-center gap-2 rounded-lg border border-[var(--card-border)]/60 bg-[var(--card)]/50 px-3 py-1.5 transition-colors hover:border-[var(--accent-strong)]/50 hover:bg-[var(--muted)]/30"
                >
                  <div className="h-8 w-8 overflow-hidden rounded-full border border-[var(--muted)] bg-[var(--muted)]/30">
                    <Image
                      src={avatarUrl}
                      alt={profile?.name ?? "User avatar"}
                      width={32}
                      height={32}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <span className="max-w-[10rem] truncate text-sm font-medium text-[var(--foreground)]/80">{profile?.name}</span>
                  <svg className={`h-3 w-3 shrink-0 transition-transform ${userMenuOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>

              {userMenuOpen ? (
                <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-[var(--card-border)]/60 bg-[var(--card)]/95 p-2 shadow-lg backdrop-blur-sm">
                  <div className="mb-2 border-b border-[var(--muted)]/50 pb-2">
                      <div className="px-3 py-1.5">
                        <div className="text-sm font-semibold text-[var(--foreground)]">{profile?.name}</div>
                        {availablePoints != null && (
                          <div className="mt-1 text-xs font-semibold text-[var(--accent-strong)]">
                            Points: {availablePoints.toLocaleString()} pts
                          </div>
                        )}
                        {tierName && tierName !== "-" && (
                          <div className="mt-1 text-[10px] uppercase tracking-wide text-[var(--accent-strong)]">
                            {tierName}
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
                    href="/account/orders"
                    className="block rounded-lg px-3 py-2 text-sm text-[var(--foreground)]/80 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    My Orders
                  </Link>
                  <Link
                    href="/account/returns"
                    className="block rounded-lg px-3 py-2 text-sm text-[var(--foreground)]/80 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    My Returns
                  </Link>
                  {/* <Link
                    href="/account/points/history"
                    className="flex min-h-[48px] touch-manipulation items-center rounded-xl px-4 py-3 text-base font-medium text-[var(--foreground)]/85 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)] active:bg-[var(--muted)]/70"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    Points History
                  </Link> */}
                  <div className="my-1 border-t border-[var(--muted)]/50" />
                  <button
                    onClick={handleLogout}
                    className="block w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--accent-strong)] transition-colors hover:bg-[var(--muted)]/50"
                  >
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
              </>
            ) : (
              <Link
                href={loginHref}
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
              onClick={() => setSearchOpen(true)}
              className="inline-flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full text-[var(--foreground)]/80 transition-colors hover:bg-[var(--muted)]/60 hover:text-[var(--accent-strong)] relative"
              aria-label="Open search"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </button>

            {/* Wishlist - Desktop */}
            <Link
              href="/wishlist"
              className="inline-flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full text-[var(--foreground)]/80 transition-colors hover:bg-[var(--muted)]/60 hover:text-[var(--accent-strong)] relative"
            >
              <svg className="h-5 w-5" fill={wishlistCount > 0 ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
              </svg>
              {wishlistCount > 0 && (
                <span className="absolute -right-2 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent-strong)] text-[10px] font-semibold text-white shadow-sm">
                  {wishlistCount > 99 ? "99+" : wishlistCount}
                </span>
              )}
            </Link>

            {/* Cart - Desktop (Last item) */}
            <Link
              href="/cart"
              className="inline-flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full text-[var(--foreground)]/80 transition-colors hover:bg-[var(--muted)]/60 hover:text-[var(--accent-strong)] relative"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
              </svg>
              {badgeCount > 0 && (
                <span className="absolute -right-2 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent-strong)] text-[10px] font-semibold text-white shadow-sm">
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {searchOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={() => setSearchOpen(false)}
          />
          <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-[var(--card-border)]/60 bg-[var(--card)]/95 shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between border-b border-[var(--muted)]/50 px-5 py-4">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Search</h2>
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--foreground)]/70 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
                aria-label="Close search"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex flex-1 flex-col gap-5 overflow-hidden px-5 py-4">
              <div className="relative">
                <svg className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--foreground)]/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      navigateToShopSearch();
                    }
                  }}
                  placeholder="Search products"
                  className="w-full rounded-full border border-[var(--card-border)] bg-[var(--card)] px-11 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent-strong)]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-[var(--foreground)]/70 transition hover:text-[var(--accent-strong)]"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-4 overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold uppercase tracking-wide text-[var(--foreground)]/70">
                    Products
                  </span>
                  {searchLoading && (
                    <span className="text-xs text-[var(--foreground)]/60">Searching...</span>
                  )}
                </div>

                {searchError && (
                  <div className="rounded-lg border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-4 py-3 text-xs text-[var(--status-error)]">
                    {searchError}
                  </div>
                )}

                <div className="flex-1 overflow-y-auto pr-1">
                  {searchResults.length === 0 && !searchLoading && searchQuery && !searchError && (
                    <div className="rounded-lg border border-[var(--muted)]/50 bg-[var(--background)]/60 px-4 py-6 text-center text-sm text-[var(--foreground)]/60">
                      No products found. Try another keyword.
                    </div>
                  )}

                  <div className="space-y-4">
                    {searchResults.map((product) => {
                      const normalizedSlug =
                        typeof product.slug === "string"
                          ? product.slug.trim().toLowerCase()
                          : null;
                      const resolvedSlug =
                        normalizedSlug && !["null", "undefined"].includes(normalizedSlug)
                          ? product.slug!.trim()
                          : product.id
                            ? String(product.id)
                            : "";
                      const image = getPrimaryProductImage(product) || "/images/placeholder.png";
                      const priceText = resolvePriceText(
                        product.price_display ?? product.original_price ?? product.price,
                      );
                      const saleText = resolvePriceText(
                        product.sale_price_display ?? product.sale_price,
                      );

                      return (
                        <Link
                          key={product.id}
                          href={`/product/${resolvedSlug}`}
                          className="flex gap-4 rounded-xl border border-[var(--card-border)]/60 bg-[var(--background)]/80 p-3 transition hover:border-[var(--accent-strong)]/60"
                          onClick={() => setSearchOpen(false)}
                        >
                          <div className="h-20 w-16 overflow-hidden rounded-lg bg-[var(--muted)]/40">
                            <img
                              src={getSearchImageSrc(image)}
                              alt={product.name}
                              className="h-full w-full object-cover"
                              onError={() => handleSearchImageError(image)}
                            />
                          </div>
                          <div className="flex flex-1 flex-col justify-center gap-2">
                            <p className="text-sm font-semibold text-[var(--foreground)]">
                              {product.name}
                            </p>
                            <div className="flex items-center gap-2 text-xs">
                              {saleText ? (
                                <>
                                  <span className="font-semibold text-[var(--accent-strong)]">
                                   RM {saleText}
                                  </span>
                                  {priceText && (
                                    <span className="text-[var(--foreground)]/50 line-through">
                                     RM {priceText}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="font-semibold text-[var(--accent-strong)]">
                                  {priceText ?? "-"}
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>

                {searchQuery && (
                  <Link
                    href={`/shop?q=${encodeURIComponent(searchQuery)}`}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent-strong)] transition hover:opacity-80"
                    onClick={() => setSearchOpen(false)}
                  >
                    See all results for “{searchQuery}”
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Menu Panel */}
          <div data-mobile-menu className="fixed left-0 top-0 z-40 flex h-[100dvh] w-[min(22rem,90vw)] flex-col border-r border-[var(--card-border)]/50 bg-[var(--card)]/98 shadow-2xl backdrop-blur-md">
            <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-[var(--muted)]/50 px-4">
              <Link href="/" className="flex h-8 w-[110px] items-center" onClick={() => setMobileMenuOpen(false)}>
                <Image src={resolvedLogoUrl} alt="Gentlegurl Shop" width={110} height={36} className="h-full w-auto object-contain object-left" />
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

              {/* Shop Menu */}
              <div>
                {hasShopMenu ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setShopOpen((prev) => !prev)}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-[var(--foreground)]/80 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
                    >
                      <span>Shop</span>
                      <svg
                        className={`h-3 w-3 transition-transform ${shopOpen ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>
                    {shopOpen && (
                      <div className="ml-4 mt-1 space-y-1 border-l border-[var(--muted)]/50 pl-4">
                        <Link
                          href="/shop"
                          className="block rounded-lg px-3 py-2 text-sm text-[var(--foreground)]/70 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
                          onClick={() => {
                            setShopOpen(false);
                            setMobileMenuOpen(false);
                          }}
                        >
                          All Products
                        </Link>
                        {shopMenu
                          .slice()
                          .sort((a, b) => a.sort_order - b.sort_order)
                          .map((item) => (
                            <Link
                              key={item.id}
                              href={`/shop/${item.slug}`}
                              className="block rounded-lg px-3 py-2 text-sm text-[var(--foreground)]/70 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
                              onClick={() => {
                                setShopOpen(false);
                                setMobileMenuOpen(false);
                              }}
                            >
                              {item.label}
                            </Link>
                          ))}
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    href="/shop"
                    className="flex min-h-[48px] touch-manipulation items-center rounded-xl px-4 py-3 text-base font-medium text-[var(--foreground)]/85 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)] active:bg-[var(--muted)]/70"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Shop
                  </Link>
                )}
              </div>

              {/* Services Menu */}
              {hasServicesMenu && (
                <div>
                  <button
                    type="button"
                    onClick={() => setServicesOpen((prev) => !prev)}
                    className="flex min-h-[48px] w-full touch-manipulation items-center justify-between rounded-xl px-4 py-3 text-base font-medium text-[var(--foreground)]/85 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
                  >
                    <span>Services & Courses</span>
                    <svg className={`h-3 w-3 transition-transform ${servicesOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                  {servicesOpen && (
                    <div className="ml-4 mt-1 space-y-1 border-l border-[var(--muted)]/50 pl-4">
                      {servicesMenu.map((item) => (
                        <Link
                          key={`mobile-${item.id}`}
                          href={`/services/${item.slug}`}
                          className="block rounded-lg px-3 py-2 text-sm text-[var(--foreground)]/70 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
                          onClick={() => {
                            setServicesOpen(false);
                            setMobileMenuOpen(false);
                          }}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Membership Menu - Mobile */}
              <div>
                <button
                  type="button"
                  onClick={() => setMembershipOpen((prev) => !prev)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-[var(--foreground)]/80 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
                >
                  <span>Membership</span>
                  <svg className={`h-3 w-3 transition-transform ${membershipOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                {membershipOpen && (
                  <div className="ml-4 mt-1 space-y-1 border-l border-[var(--muted)]/50 pl-4">
                    <Link
                      href="/membership"
                      className="block rounded-lg px-3 py-2 text-sm text-[var(--foreground)]/70 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
                      onClick={() => {
                        setMembershipOpen(false);
                        setMobileMenuOpen(false);
                      }}
                    >
                      Membership Tiers
                    </Link>
                    <Link
                      href="/rewards"
                      className="block rounded-lg px-3 py-2 text-sm text-[var(--foreground)]/70 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
                      onClick={() => {
                        setMembershipOpen(false);
                        setMobileMenuOpen(false);
                      }}
                    >
                      Rewards Center
                    </Link>
                  </div>
                )}
              </div>
              
              <Link
                href={bookingHref}
                className="flex min-h-[48px] touch-manipulation items-center rounded-xl px-4 py-3 text-base font-medium text-[var(--foreground)]/85 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)] active:bg-[var(--muted)]/70"
                onClick={() => setMobileMenuOpen(false)}
              >
                Appointments
              </Link>

              <Link
                href="/tracking"
                className="flex min-h-[48px] touch-manipulation items-center rounded-xl px-4 py-3 text-base font-medium text-[var(--foreground)]/85 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)] active:bg-[var(--muted)]/70"
                onClick={() => setMobileMenuOpen(false)}
              >
                Tracking
              </Link>

              <Link
                href="/reviews"
                className="flex min-h-[48px] touch-manipulation items-center rounded-xl px-4 py-3 text-base font-medium text-[var(--foreground)]/85 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)] active:bg-[var(--muted)]/70"
                onClick={() => setMobileMenuOpen(false)}
              >
                Store Reviews
              </Link>
            </nav>
            </div>
          </div>
        </>
      )}
    </>
  );
}
