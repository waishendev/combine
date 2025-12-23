"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import type { AccountOverview } from "@/lib/apiClient";
import { getWishlistItems } from "@/lib/apiClient";
import { useAuth } from "../../contexts/AuthContext";
import { useCart } from "../../contexts/CartContext";
import { HomepageShopMenuItem } from "@/lib/server/getHomepage";

type ShopHeaderClientProps = {
  overview: AccountOverview | null;
  shopMenu: HomepageShopMenuItem[];
};

export function ShopHeaderClient({ overview: initialOverview, shopMenu }: ShopHeaderClientProps) {
  const { customer, logout, isLoading } = useAuth();
  const { items, resetAfterLogout } = useCart();
  const [shopOpen, setShopOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [membershipOpen, setMembershipOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileUserMenuOpen, setMobileUserMenuOpen] = useState(false);
  const [wishlistCount, setWishlistCount] = useState(0);
  const router = useRouter();

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Don't close if clicking on a link (let the link navigate)
      if (target.closest('a')) {
        return;
      }
      
      if (!target.closest('[data-menu]')) {
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

  const overview = customer ?? initialOverview ?? null;
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

  const handleLogout = async () => {
    await logout();
    await resetAfterLogout();
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
    router.push("/");
    router.refresh();
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[var(--muted)]/50 bg-[var(--background)]/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          {/* Desktop: Logo + Navigation */}
          <div className="flex items-center gap-6">
            {/* Logo - Desktop */}
            <Link href="/" className="hidden items-center md:flex">
              <Image
                src="/images/logo.png"
                alt="Gentlegurl Shop"
                width={120}
                height={40}
                className="h-8 w-auto object-contain"
                priority
              />
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden gap-6 text-sm text-[var(--foreground)]/80 md:flex">
            <Link href="/">Home</Link>

            {/* SHOP + Dropdown */}
            <div className="relative" data-menu>
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
                  className="h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {shopOpen && shopMenu.length > 0 && (
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
            </div>

            {/* Services & Courses Dropdown */}
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
                <svg
                  className="h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {servicesOpen && (
                <div className="absolute left-0 z-20 mt-2 w-64 rounded-md border border-[var(--muted)] bg-[var(--background)] shadow-lg">
                  <Link
                    href="/services/nail-services"
                    className="block px-4 py-2 text-sm text-[var(--foreground)] transition hover:bg-[var(--muted)]/60"
                    onClick={() => setServicesOpen(false)}
                  >
                    Nail Services
                  </Link>
                  <Link
                    href="/services/waxing-hair-removal"
                    className="block px-4 py-2 text-sm text-[var(--foreground)] transition hover:bg-[var(--muted)]/60"
                    onClick={() => setServicesOpen(false)}
                  >
                    Waxing &amp; Hair Removal
                  </Link>
                  <Link
                    href="/services/nail-courses"
                    className="block px-4 py-2 text-sm text-[var(--foreground)] transition hover:bg-[var(--muted)]/60"
                    onClick={() => setServicesOpen(false)}
                  >
                    Nail Courses
                  </Link>
                </div>
              )}
            </div>

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
                <svg
                  className="h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
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

          </nav>
        </div>

          {/* Mobile: Hamburger + Logo + User/Cart */}
          <div className="flex w-full items-center justify-between md:hidden">
            {/* Hamburger Menu Button */}
            <button
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="flex items-center text-[var(--foreground)]/80 transition-colors hover:text-[var(--accent-strong)]"
              aria-label="Toggle menu"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-6 w-6"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>

            {/* Logo - Mobile */}
            <Link href="/" className="flex items-center">
              <Image
                src="/images/logo.png"
                alt="Gentlegurl Shop"
                width={120}
                height={40}
                className="h-7 w-auto object-contain"
                priority
              />
            </Link>

            {/* Mobile Right Side: User/Cart */}
            <div className="flex items-center gap-3">
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
                    <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-[var(--muted)]/60 bg-white/95 p-2 shadow-lg backdrop-blur-sm">
                      <div className="mb-2 border-b border-[var(--muted)]/50 pb-2">
                        <div className="px-3 py-1.5">
                          <div className="text-sm font-semibold text-[var(--foreground)]">{profile?.name}</div>
                          <div className="text-xs text-[var(--foreground)]/60">{profile?.email}</div>
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
                        href="/orders"
                        className="block rounded-lg px-3 py-2 text-sm text-[var(--foreground)]/80 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
                        onClick={() => setMobileUserMenuOpen(false)}
                      >
                        My Orders
                      </Link>
                      <Link
                        href="/wishlist"
                        className="block rounded-lg px-3 py-2 text-sm text-[var(--foreground)]/80 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
                        onClick={() => setMobileUserMenuOpen(false)}
                      >
                        Wishlist
                      </Link>
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
                /* Mobile Login/Register */
                <div className="flex items-center gap-2 text-sm">
                  <Link
                    href="/login"
                    className="text-[var(--foreground)]/80 transition-colors hover:text-[var(--accent-strong)]"
                  >
                    Login
                  </Link>
                </div>
              )}

              {/* Mobile Wishlist */}
              <Link
                href="/wishlist"
                className="relative flex items-center text-[var(--foreground)]/80 transition-colors hover:text-[var(--accent-strong)]"
                aria-label="Wishlist"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill={wishlistCount > 0 ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="h-6 w-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                  />
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
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                  className="h-6 w-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25h11.218c.97 0 1.694-.908 1.46-1.852l-1.383-5.527a1.125 1.125 0 0 0-1.088-.848H6.178"
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25 5.647 5.272" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 20.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm12.75 0a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" />
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
                  className="flex items-center gap-2 rounded-lg border border-[var(--muted)]/60 bg-white/50 px-3 py-1.5 transition-colors hover:border-[var(--accent-strong)]/50 hover:bg-[var(--muted)]/30"
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
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`h-4 w-4 transition-transform ${userMenuOpen ? "rotate-180" : ""}`}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                  </svg>
                </button>

              {userMenuOpen && (
                <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-[var(--muted)]/60 bg-white/95 p-2 shadow-lg backdrop-blur-sm">
                  <div className="mb-2 border-b border-[var(--muted)]/50 pb-2">
                    <div className="px-3 py-1.5">
                      <div className="text-sm font-semibold text-[var(--foreground)]">{profile?.name}</div>
                      <div className="text-xs text-[var(--foreground)]/60">{profile?.email}</div>
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
                    href="/orders"
                    className="block rounded-lg px-3 py-2 text-sm text-[var(--foreground)]/80 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    My Orders
                  </Link>
                  <Link
                    href="/wishlist"
                    className="block rounded-lg px-3 py-2 text-sm text-[var(--foreground)]/80 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    Wishlist
                  </Link>
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
              /* Login/Register - Desktop */
              <div className="flex items-center gap-4 text-sm">
                <Link
                  href="/login"
                  className="text-[var(--foreground)]/80 transition-colors hover:text-[var(--accent-strong)]"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="text-[var(--foreground)]/80 transition-colors hover:text-[var(--accent-strong)]"
                >
                  Register
                </Link>
              </div>
            )}

            {/* Wishlist - Desktop */}
            <Link
              href="/wishlist"
              className="relative flex items-center text-[var(--foreground)]/80 transition-colors hover:text-[var(--accent-strong)]"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill={wishlistCount > 0 ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-6 w-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                />
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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                className="h-6 w-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25h11.218c.97 0 1.694-.908 1.46-1.852l-1.383-5.527a1.125 1.125 0 0 0-1.088-.848H6.178"
                />
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25 5.647 5.272" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 20.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm12.75 0a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" />
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

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Menu Panel */}
          <div className="fixed left-0 top-0 z-40 h-full w-80 max-w-[85vw] overflow-y-auto border-r border-[var(--muted)]/50 bg-white/95 backdrop-blur-sm shadow-xl md:hidden">
            <div className="flex h-16 items-center justify-between border-b border-[var(--muted)]/50 px-4">
              <span className="text-sm font-semibold text-[var(--foreground)]">Menu</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center text-[var(--foreground)]/80 transition-colors hover:text-[var(--accent-strong)]"
                aria-label="Close menu"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-6 w-6"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
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
                <button
                  type="button"
                  onClick={() => setShopOpen((prev) => !prev)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-[var(--foreground)]/80 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
                >
                  <span>Shop</span>
                  <svg
                    className={`h-4 w-4 transition-transform ${shopOpen ? "rotate-180" : ""}`}
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                {shopOpen && shopMenu.length > 0 && (
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
              </div>

              {/* Services Menu */}
              <div>
                <button
                  type="button"
                  onClick={() => setServicesOpen((prev) => !prev)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-[var(--foreground)]/80 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
                >
                  <span>Services & Courses</span>
                  <svg
                    className={`h-4 w-4 transition-transform ${servicesOpen ? "rotate-180" : ""}`}
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                {servicesOpen && (
                  <div className="ml-4 mt-1 space-y-1 border-l border-[var(--muted)]/50 pl-4">
                    <Link
                      href="/services/nail-services"
                      className="block rounded-lg px-3 py-2 text-sm text-[var(--foreground)]/70 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
                      onClick={() => {
                        setServicesOpen(false);
                        setMobileMenuOpen(false);
                      }}
                    >
                      Nail Services
                    </Link>
                    <Link
                      href="/services/waxing-hair-removal"
                      className="block rounded-lg px-3 py-2 text-sm text-[var(--foreground)]/70 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
                      onClick={() => {
                        setServicesOpen(false);
                        setMobileMenuOpen(false);
                      }}
                    >
                      Waxing &amp; Hair Removal
                    </Link>
                    <Link
                      href="/services/nail-courses"
                      className="block rounded-lg px-3 py-2 text-sm text-[var(--foreground)]/70 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
                      onClick={() => {
                        setServicesOpen(false);
                        setMobileMenuOpen(false);
                      }}
                    >
                      Nail Courses
                    </Link>
                  </div>
                )}
              </div>

              {/* Membership Menu - Mobile */}
              <div>
                <button
                  type="button"
                  onClick={() => setMembershipOpen((prev) => !prev)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-[var(--foreground)]/80 transition-colors hover:bg-[var(--muted)]/50 hover:text-[var(--accent-strong)]"
                >
                  <span>Membership</span>
                  <svg
                    className={`h-4 w-4 transition-transform ${membershipOpen ? "rotate-180" : ""}`}
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
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

            </nav>
            </div>
          </div>
        </>
      )}
    </>
  );
}
