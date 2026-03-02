"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getBookingCart } from "@/lib/apiClient";
import { BOOKING_CART_CHANGED_EVENT, OPEN_BOOKING_CART_DRAWER_EVENT } from "@/lib/bookingCartEvents";
import { CartDrawer } from "@/components/booking/CartDrawer";

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [cartCount, setCartCount] = useState(0);
  const [cartOpen, setCartOpen] = useState(false);

  const loadCartCount = async () => {
    try {
      const cart = await getBookingCart();
      setCartCount(cart.items?.length ?? 0);
    } catch {
      setCartCount(0);
    }
  };

  useEffect(() => {
    loadCartCount();
  }, [pathname]);

  useEffect(() => {
    const refresh = () => loadCartCount();
    const open = () => setCartOpen(true);

    window.addEventListener(BOOKING_CART_CHANGED_EVENT, refresh);
    window.addEventListener(OPEN_BOOKING_CART_DRAWER_EVENT, open);

    return () => {
      window.removeEventListener(BOOKING_CART_CHANGED_EVENT, refresh);
      window.removeEventListener(OPEN_BOOKING_CART_DRAWER_EVENT, open);
    };
  }, []);

  const isActive = (path: string) => (pathname === path ? "text-black" : "text-neutral-500");

  const onLogout = async () => {
    await logout();
    router.push("/");
  };

  const cartLabel = useMemo(() => (cartCount > 99 ? "99+" : String(cartCount)), [cartCount]);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-lg font-semibold tracking-wide">GentleGurls</Link>
          <div className="flex items-center gap-4 text-sm font-medium">
            <Link href="/" className={isActive("/")}>Home</Link>
            <Link href="/booking" className={isActive("/booking")}>Book</Link>
            <Link href="/services" className={isActive("/services")}>Services</Link>
            <button onClick={() => setCartOpen(true)} className="relative rounded-full border border-neutral-200 px-4 py-2">
              <span role="img" aria-label="cart">🛍️</span> Cart
              {cartCount > 0 ? (
                <span className="absolute -right-2 -top-2 rounded-full bg-black px-2 py-0.5 text-xs text-white">
                  {cartLabel}
                </span>
              ) : null}
            </button>
            {user ? (
              <>
                <Link href="/account/bookings" className={isActive("/account/bookings")}>My Bookings</Link>
                <button onClick={onLogout} className="rounded-full border border-neutral-200 px-4 py-2">Logout</button>
              </>
            ) : (
              <Link href={`/login?redirect=${encodeURIComponent(pathname || "/booking")}`} className="rounded-full bg-black px-4 py-2 text-white">Login</Link>
            )}
          </div>
        </nav>
      </header>
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
