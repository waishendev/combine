"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import type { ShopMenuItem } from "@/lib/shop-types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL!;

export function Header() {
  const { user, logout, loading } = useAuth();
  const { cart } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [shopMenuOpen, setShopMenuOpen] = useState(false);
  const [shopMenus, setShopMenus] = useState<ShopMenuItem[]>([]);
  const router = useRouter();
  const pathname = usePathname();
  const cartCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) || 0;

  useEffect(() => {
    async function fetchMenus() {
      try {
        const res = await fetch(`${API_BASE}/public/shop/menu`);
        if (res.ok) {
          const data = await res.json();
          setShopMenus(data.data || []);
        }
      } catch (error) {
        console.error("Failed to fetch shop menus:", error);
      }
    }
    fetchMenus();
  }, []);

  async function handleLogout() {
    await logout();
    setMenuOpen(false);
    router.push("/");
  }

  return (
    <header className="border-b bg-white shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-xl font-semibold">
          ecommerce-crm
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium">
          <Link href="/" className="hover:text-blue-600">
            Home
          </Link>
          {shopMenus.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShopMenuOpen((v) => !v)}
                onBlur={() => setTimeout(() => setShopMenuOpen(false), 200)}
                className="flex items-center gap-1 hover:text-blue-600"
              >
                Shop
                <span aria-hidden>▾</span>
              </button>
              {shopMenuOpen && (
                <div className="absolute left-0 top-full mt-2 w-48 rounded-lg border bg-white py-2 shadow-lg z-50">
                  {shopMenus.map((menu) => (
                    <Link
                      key={menu.id}
                      href={`/shop/${menu.slug}`}
                      onClick={() => setShopMenuOpen(false)}
                      className="block px-4 py-2 text-sm text-slate-800 hover:bg-blue-50 hover:text-blue-600"
                    >
                      {menu.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
          <Link href="/cart" className="relative hover:text-blue-600">
            Cart
            {cartCount > 0 && (
              <span className="absolute -right-3 -top-2 rounded-full bg-blue-600 px-2 py-0.5 text-xs text-white">
                {cartCount}
              </span>
            )}
          </Link>
          <Link href="/checkout" className="hover:text-blue-600">
            Checkout
          </Link>
          {!loading && !user && (
            <div className="flex items-center gap-3">
              <Link
                href={`/auth/login?returnTo=${encodeURIComponent(pathname)}`}
                className="rounded-full border border-blue-200 px-3 py-1 text-blue-700 hover:bg-blue-50"
              >
                Login
              </Link>
              <Link
                href={`/auth/register?returnTo=${encodeURIComponent(pathname)}`}
                className="rounded-full bg-blue-600 px-3 py-1 text-white hover:bg-blue-700"
              >
                Register
              </Link>
            </div>
          )}
          {!loading && user && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 hover:bg-slate-50"
              >
                <span className="text-sm text-slate-600">Hi,</span>
                <span className="font-semibold text-slate-900">{user.name}</span>
                <span aria-hidden>▾</span>
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-lg border bg-white py-2 shadow-lg">
                  <Link
                    href="/account"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2 text-sm text-slate-800 hover:bg-slate-50"
                  >
                    My Account
                  </Link>
                  <Link
                    href="/account/orders"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2 text-sm text-slate-800 hover:bg-slate-50"
                  >
                    Orders
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-slate-50"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
