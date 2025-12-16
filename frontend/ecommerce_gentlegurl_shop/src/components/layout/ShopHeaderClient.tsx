"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { AccountOverview } from "@/lib/apiClient";
import { useAuth } from "../../contexts/AuthContext";
import { useCart } from "../../contexts/CartContext";
import { HomepageShopMenuItem } from "@/lib/server/getHomepage";

type ShopHeaderClientProps = {
  overview: AccountOverview | null;
  shopMenu: HomepageShopMenuItem[];
};

export function ShopHeaderClient({ overview: initialOverview, shopMenu }: ShopHeaderClientProps) {
  const { customer, logout, isLoading } = useAuth();
  const { totalQuantity, resetAfterLogout } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const overview = customer ?? initialOverview ?? null;
  const profile = overview?.profile;
  const loyalty = overview?.loyalty;

  const avatarUrl = profile?.avatar ?? "/images/default_user_image.jpg";
  const tierName = loyalty?.current_tier?.name ?? profile?.tier ?? "-";
  const isLoginPage = pathname === "/login";
  const isRegisterPage = pathname === "/register";

  const handleLogout = async () => {
    await logout();
    await resetAfterLogout();
    setMenuOpen(false);
    router.push("/");
    router.refresh();
  };

  return (
    <header className="bg-[var(--background)]/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-semibold text-[var(--foreground)]">
            Gentlegurl Shop
          </Link>
          <nav className="hidden gap-6 text-sm text-[var(--foreground)]/80 md:flex">
            <Link href="/">Home</Link>

            {/* SHOP + Dropdown */}
            <div className="relative">
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
            <div className="relative">
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
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-[200px] min-w-[180px] max-w-[220px]">
            {isLoading ? (
              <div className="h-10 w-full animate-pulse rounded-full bg-[var(--muted)]" />
            ) : profile ? (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen((prev) => !prev)}
                  className="flex h-10 w-full items-center gap-2 rounded-full bg-white/70 px-3 text-sm text-[var(--foreground)] shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.08)]"
                >
                  <div className="flex h-full items-center gap-2">
                    <div className="h-7 w-7 overflow-hidden rounded-full bg-gray-100">
                      <Image
                        src={avatarUrl}
                        alt={profile?.name ?? "User avatar"}
                        width={28}
                        height={28}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1 leading-tight">
                      <div className="truncate text-[10px] text-[var(--foreground)]/60">{tierName}</div>
                      <div className="truncate text-sm font-medium text-[var(--foreground)]">{profile?.name}</div>
                    </div>
                  </div>

                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="h-4 w-4 text-gray-500"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                  </svg>
                </button>

                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-[230px] rounded-xl border border-[var(--muted)] bg-[var(--background)] shadow-md">
                    <Link
                      href="/account"
                      className="block px-4 py-2 text-sm text-[var(--foreground)] transition hover:bg-[var(--muted)]/60"
                      onClick={() => setMenuOpen(false)}
                    >
                      My Account / Profile
                    </Link>
                    <Link
                      href="/orders"
                      className="block px-4 py-2 text-sm text-[var(--foreground)] transition hover:bg-[var(--muted)]/60"
                      onClick={() => setMenuOpen(false)}
                    >
                      Orders
                    </Link>
                    <Link
                      href="/wishlist"
                      className="block px-4 py-2 text-sm text-[var(--foreground)] transition hover:bg-[var(--muted)]/60"
                      onClick={() => setMenuOpen(false)}
                    >
                      Wishlist
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="block w-full px-4 py-2 text-left text-sm text-[#c26686] transition hover:bg-[var(--muted)]/70"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-10 items-center gap-2 text-sm">
                {!isLoginPage && (
                  <Link
                    className="flex-1 h-10 rounded-full bg-white/70 px-4 text-center font-medium leading-10 text-[var(--foreground)] shadow-[0_4px_20px_rgba(0,0,0,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_35px_rgba(0,0,0,0.08)]"
                    href="/login"
                  >
                    Login
                  </Link>
                )}
                {!isRegisterPage && (
                  <Link
                    className="flex-1 h-10 rounded-full bg-gradient-to-r from-[var(--accent)] via-[#d0699d] to-[var(--accent-strong)] px-4 text-center font-medium leading-10 text-white shadow-[0_10px_30px_rgba(191,82,122,0.45)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_38px_rgba(191,82,122,0.55)]"
                    href="/register"
                  >
                    Register
                  </Link>
                )}
              </div>
            )}
          </div>

          <Link
            href="/cart"
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-[var(--foreground)] shadow-[0_4px_20px_rgba(0,0,0,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(0,0,0,0.1)]"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25h11.218c.97 0 1.694-.908 1.46-1.852l-1.383-5.527a1.125 1.125 0 0 0-1.088-.848H6.178"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25 5.647 5.272" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 20.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm12.75 0a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" />
            </svg>
            {totalQuantity > 0 && (
              <span className="absolute -right-2 -top-1 rounded-full bg-[var(--accent-strong)] px-2 text-xs text-white shadow-sm">
                {totalQuantity}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
