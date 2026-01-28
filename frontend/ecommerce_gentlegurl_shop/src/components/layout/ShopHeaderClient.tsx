"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useEffect, useCallback } from "react";
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
  const fallbackLogo = "/images/logo.png";
  const storageKey = "branding.shop_logo_url";
  const [resolvedLogoUrl, setResolvedLogoUrl] = useState(logoUrl || fallbackLogo);
  const [logoLoaded, setLogoLoaded] = useState(resolvedLogoUrl === fallbackLogo);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const hasShopMenu = shopMenu.length > 0;
  const hasServicesMenu = servicesMenu.length > 0;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const cachedLogo = window.sessionStorage.getItem(storageKey);
    if (cachedLogo && !logoUrl) {
      setResolvedLogoUrl(cachedLogo);
    }
  }, [logoUrl]);

  useEffect(() => {
    if (!logoUrl) return;
    setResolvedLogoUrl(logoUrl);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(storageKey, logoUrl);
    }
  }, [logoUrl]);

  useEffect(() => {
    if (resolvedLogoUrl === fallbackLogo) {
      setLogoLoaded(true);
    } else {
      setLogoLoaded(false);
    }
  }, [resolvedLogoUrl, fallbackLogo]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
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

    // Use click instead of mousedown to allow links to work properly
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
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

  const getSearchImageSrc = (imageSrc: string) =>
    searchImageErrors.has(imageSrc) ? "/images/placeholder.png" : imageSrc;

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
      <header className="sticky top-0 z-40 border-b border-[var(--muted)]/50 bg-[var(--background)]/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          {/* Desktop: Logo + Navigation */}
          <div className="flex items-center gap-6">
            {/* Logo - Desktop */}
            <Link href="/" className="hidden items-center md:flex">
              <span
                className="flex h-8 w-[120px] items-center justify-center bg-center bg-no-repeat"
                style={{
                  backgroundImage: `url(${fallbackLogo})`,
                  backgroundSize: "contain",
                }}
              >
                <Image
                  src={resolvedLogoUrl}
                  alt="Gentlegurl Shop"
                  width={120}
                  height={40}
                  className={`h-8 w-auto object-contain transition-opacity duration-300 ${
                    logoLoaded ? "opacity-100" : "opacity-0"
                  }`}
                  priority
                  onLoadingComplete={() => setLogoLoaded(true)}
                  onError={() => {
                    setResolvedLogoUrl(fallbackLogo);
                    setLogoLoaded(true);
                  }}
                />
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden gap-6 text-sm text-[var(--foreground)]/80 md:flex">
            <Link href="/">Home</Link>

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
                    className="flex items-center gap-1 transition-colors hover:text-[var(--accent-strong)]"
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
                  className="flex items-center gap-1 transition-colors hover:text-[var(--accent-strong)]"
                >
                  <span>Services & Courses</span>
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
                className="flex items-center gap-1 transition-colors hover:text-[var(--accent-strong)]"
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

            <Link href="/tracking">Tracking</Link>
            <Link href="/reviews">Store Reviews</Link>
          </nav>
        </div>

          {/* Mobile: Hamburger + Logo + User/Cart */}
          <div className="flex w-full items-center gap-4 md:hidden">
            {/* Hamburger Menu Button */}
            <button
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="flex items-center text-[var(--foreground)]/80 transition-colors hover:text-[var(--accent-strong)]"
              aria-label="Toggle menu"
            >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>

            {/* Logo - Mobile */}
            <Link href="/" className="flex items-center">
              <span
                className="flex h-7 w-[120px] items-center justify-center bg-center bg-no-repeat"
                style={{
                  backgroundImage: `url(${fallbackLogo})`,
                  backgroundSize: "contain",
                }}
              >
                <Image
                  src={resolvedLogoUrl}
                  alt="Gentlegurl Shop"
                  width={120}
                  height={40}
                  className={`h-7 w-auto object-contain transition-opacity duration-300 ${
                    logoLoaded ? "opacity-100" : "opacity-0"
                  }`}
                  priority
                  onLoadingComplete={() => setLogoLoaded(true)}
                  onError={() => {
                    setResolvedLogoUrl(fallbackLogo);
                    setLogoLoaded(true);
                  }}
                />
              </span>
            </Link>

            {/* Mobile Right Side: User/Cart */}
            <div className="ml-auto flex items-center gap-3">
              {isLoading ? (
                <div className="h-8 w-8 animate-pulse rounded-full bg-[var(--muted)]/50" />
              ) : profile ? (
                /* Mobile User Menu */
                <div className="relative" data-mobile-user-menu>
                  <button
                    onClick={() => setMobileUserMenuOpen((prev) => !prev)}
                    className="h-8 w-8 overflow-hidden rounded-full border-2 border-[var(--muted)] transition-colors hover:border-[var(--accent-strong)]"
                  >
                    <Image
                      src={avatarUrl}
                      alt={profile?.name ?? "User avatar"}
                      width={32}
                      height={32}
                      className="h-full w-full object-cover"
                    />
                  </button>

                  {mobileUserMenuOpen && (
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
                        onClick={() => setMobileUserMenuOpen(false)}
                      >
                        My Account
                      </Link>
                  <Link
                    href="/account/orders"
                    className="block rounded-lg px-3 py-2 text-sm text-[var(--foreground)]/80 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
                    onClick={() => setMobileUserMenuOpen(false)}
                  >
                    My Orders
                  </Link>
                  <Link
                    href="/account/returns"
                    className="block rounded-lg px-3 py-2 text-sm text-[var(--foreground)]/80 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
                    onClick={() => setMobileUserMenuOpen(false)}
                  >
                    My Returns
                  </Link>
                  {/* <Link
                    href="/account/points/history"
                    className="block rounded-lg px-3 py-2 text-sm text-[var(--foreground)]/80 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
                    onClick={() => setMobileUserMenuOpen(false)}
                  >
                    Points History
                  </Link> */}
                      <div className="my-1 border-t border-[var(--muted)]/50" />
                      <button
                        onClick={() => {
                          handleLogout();
                          setMobileUserMenuOpen(false);
                        }}
                        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--accent-strong)] transition-colors hover:bg-[var(--muted)]/50"
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  href={loginHref}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--foreground)]/80 transition-colors hover:text-[var(--accent-strong)]"
                  aria-label="Login"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7Z" />
                  </svg>
                </Link>
              )}

              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--foreground)]/80 transition-colors hover:text-[var(--accent-strong)]"
                aria-label="Open search"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
              </button>

              {/* Mobile Wishlist */}
              <Link
                href="/wishlist"
                className="relative flex items-center text-[var(--foreground)]/80 transition-colors hover:text-[var(--accent-strong)]"
                aria-label="Wishlist"
              >
                <svg className="h-5 w-5" fill={wishlistCount > 0 ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                </svg>
                {wishlistCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent-strong)] text-[10px] font-semibold text-white shadow-sm">
                    {wishlistCount > 99 ? "99+" : wishlistCount}
                  </span>
                )}
              </Link>

              {/* Mobile Cart */}
              <Link
                href="/cart"
                className="relative flex items-center text-[var(--foreground)]/80 transition-colors hover:text-[var(--accent-strong)]"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
                </svg>
                {badgeCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent-strong)] text-[10px] font-semibold text-white shadow-sm">
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </Link>
            </div>
          </div>

          {/* Desktop: Right Side Actions */}
          <div className="hidden items-center gap-4 md:flex">
            {isLoading ? (
              <div className="h-8 w-24 animate-pulse rounded bg-[var(--muted)]/50" />
            ) : profile ? (
              /* User Menu - Desktop */
              <div className="relative" data-menu>
                <button
                  onClick={() => setUserMenuOpen((prev) => !prev)}
                  className="flex items-center gap-2 rounded-lg border border-[var(--card-border)]/60 bg-[var(--card)]/50 px-3 py-1.5 transition-colors hover:border-[var(--accent-strong)]/50 hover:bg-[var(--muted)]/30"
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
                  <span className="text-sm font-medium text-[var(--foreground)]/80">{profile?.name}</span>
                  <svg className={`h-3 w-3 transition-transform ${userMenuOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>

              {userMenuOpen && (
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
                    className="block rounded-lg px-3 py-2 text-sm text-[var(--foreground)]/80 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
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
              )}
            </div>
            ) : (
              <Link
                href={loginHref}
                 className="relative flex items-center text-[var(--foreground)]/80 transition-colors hover:text-[var(--accent-strong)]"
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
              className="relative flex items-center text-[var(--foreground)]/80 transition-colors hover:text-[var(--accent-strong)]"
              aria-label="Open search"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </button>

            {/* Wishlist - Desktop */}
            <Link
              href="/wishlist"
              className="relative flex items-center text-[var(--foreground)]/80 transition-colors hover:text-[var(--accent-strong)]"
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
              className="relative flex items-center text-[var(--foreground)]/80 transition-colors hover:text-[var(--accent-strong)]"
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
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
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
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
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
                      const image = getPrimaryProductImage(product);
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
            className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Menu Panel */}
          <div data-mobile-menu className="fixed left-0 top-0 z-40 h-full w-80 max-w-[85vw] overflow-y-auto border-r border-[var(--card-border)]/50 bg-[var(--card)]/95 backdrop-blur-sm shadow-xl md:hidden">
            <div className="flex h-16 items-center justify-between border-b border-[var(--muted)]/50 px-4">
              <span className="text-sm font-semibold text-[var(--foreground)]">Menu</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center text-[var(--foreground)]/80 transition-colors hover:text-[var(--accent-strong)]"
                aria-label="Close menu"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-4 py-4">
              {/* Mobile Navigation Links */}
              <nav className="space-y-1">
              <Link
                href="/"
                className="block rounded-lg px-3 py-2 text-sm text-[var(--foreground)]/80 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
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
                    className="block rounded-lg px-3 py-2 text-sm text-[var(--foreground)]/80 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
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
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-[var(--foreground)]/80 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
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
                href="/tracking"
                className="block rounded-lg px-3 py-2 text-sm text-[var(--foreground)]/80 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
                onClick={() => setMobileMenuOpen(false)}
              >
                Tracking
              </Link>

              <Link
                href="/reviews"
                className="block rounded-lg px-3 py-2 text-sm text-[var(--foreground)]/80 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
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
