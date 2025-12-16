"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const { itemCount, resetAfterLogout } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const router = useRouter();

  const overview = customer ?? initialOverview ?? null;
  const profile = overview?.profile;
  const loyalty = overview?.loyalty;

  const avatarUrl = profile?.avatar ?? "/images/default_user_image.jpg";
  const tierName = loyalty?.current_tier?.name ?? profile?.tier ?? "-";

  const handleLogout = async () => {
    await logout();
    await resetAfterLogout();
    setMenuOpen(false);
    router.push("/");
    router.refresh();
  };

  return (
    <header className="border-b border-[var(--muted)] bg-[var(--background)]/80 backdrop-blur">
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

        <div className="flex items-center gap-4">
          {isLoading ? (
            <div className="h-10 w-32 animate-pulse rounded-full bg-[var(--muted)]" />
          ) : profile ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-full border px-3 py-1 text-sm hover:border-gray-400 bg-white/80"
              >
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 overflow-hidden rounded-full bg-gray-200">
                    <Image
                      src={avatarUrl}
                      alt={profile?.name ?? "User avatar"}
                      width={28}
                      height={28}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex flex-col leading-tight">
                    <span className="text-[10px] uppercase tracking-wide text-gray-500">{tierName}</span>
                    <span className="max-w-[120px] truncate text-xs text-gray-800">{profile?.name}</span>
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
                <div className="absolute right-0 mt-2 w-44 rounded-md border border-[var(--muted)] bg-[var(--background)] shadow-lg">
                  <Link
                    href="/account"
                    className="block px-4 py-2 text-sm text-[var(--foreground)] transition hover:bg-[var(--muted)]/80"
                    onClick={() => setMenuOpen(false)}
                  >
                    My Account
                  </Link>
                  <Link
                    href="/orders"
                    className="block px-4 py-2 text-sm text-[var(--foreground)] transition hover:bg-[var(--muted)]/80"
                    onClick={() => setMenuOpen(false)}
                  >
                    My Orders
                  </Link>
                  <Link
                    href="/wishlist"
                    className="block px-4 py-2 text-sm text-[var(--foreground)] transition hover:bg-[var(--muted)]/80"
                    onClick={() => setMenuOpen(false)}
                  >
                    Wishlist
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="block w-full px-4 py-2 text-left text-sm text-[#c26686] transition hover:bg-[var(--muted)]/90"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <Link
                className="rounded-full border border-[var(--accent)] bg-white/70 px-4 py-2 text-[var(--foreground)] transition-colors hover:border-[var(--accent-strong)] hover:bg-[var(--muted)]/70"
                href="/login"
              >
                Login
              </Link>
              <Link
                className="rounded-full bg-[var(--accent)] px-4 py-2 text-white transition-colors hover:bg-[var(--accent-strong)]"
                href="/register"
              >
                Register
              </Link>
            </div>
          )}

          <Link
            href="/cart"
            className="relative flex items-center rounded-full border border-[var(--accent)] bg-white/70 px-3 py-2 text-[var(--foreground)] transition-colors hover:border-[var(--accent-strong)] hover:bg-[var(--muted)]/80"
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
            {itemCount > 0 && (
              <span className="absolute -right-2 -top-1 rounded-full bg-[var(--accent-strong)] px-2 text-xs text-white shadow-sm">
                {itemCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
