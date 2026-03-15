"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { addPackageCartItem, checkoutPackageCart, getPackageCart, getServicePackages, removePackageCartItem } from "@/lib/apiClient";
import { PackageCart, ServicePackage } from "@/lib/types";

export default function BookingPackagesPage() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [cart, setCart] = useState<PackageCart>({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<number | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  const goLogin = () => {
    router.push(`/login?redirect=${encodeURIComponent(pathname || "/booking/packages")}`);
  };

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await getServicePackages();
        const list = Array.isArray(rows) ? rows : [];
        setPackages(list.filter((pkg) => pkg.is_active !== false));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load service packages");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, []);

  useEffect(() => {
    if (!user) {
      setCart({ items: [], total: 0 });
      return;
    }

    const run = async () => {
      try {
        const data = await getPackageCart();
        setCart(data ?? { items: [], total: 0 });
      } catch {
        setCart({ items: [], total: 0 });
      }
    };

    void run();
  }, [user]);

  const onAddToCart = async (pkg: ServicePackage) => {
    if (!user) {
      goLogin();
      return;
    }

    setMessage(null);
    setWorkingId(pkg.id);
    try {
      const nextCart = await addPackageCartItem({ service_package_id: pkg.id, qty: 1 });
      setCart(nextCart ?? { items: [], total: 0 });
      setMessage(`${pkg.name} added to cart.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to add package to cart.");
    } finally {
      setWorkingId(null);
    }
  };

  const onRemove = async (itemId: number) => {
    setWorkingId(itemId);
    try {
      const nextCart = await removePackageCartItem(itemId);
      setCart(nextCart ?? { items: [], total: 0 });
    } finally {
      setWorkingId(null);
    }
  };

  const onCheckout = async () => {
    if (!user) {
      goLogin();
      return;
    }

    setCheckingOut(true);
    setMessage(null);
    try {
      const response = await checkoutPackageCart();
      const data = (response && typeof response === "object" && "data" in response)
        ? (response as { data?: { payment_url?: string } }).data
        : (response as { payment_url?: string });

      if (data?.payment_url) {
        window.location.href = data.payment_url;
        return;
      }

      setMessage("Checkout created. Please complete payment.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to checkout package cart.");
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-4 text-sm">
        <Link href="/booking" className="text-neutral-500 hover:text-black">Booking</Link>
        <span className="mx-2 text-neutral-400">/</span>
        <span className="font-semibold">Packages</span>
      </div>

      <h1 className="text-3xl font-semibold">Service Packages</h1>
      <p className="mt-2 text-neutral-600">Add package to cart, then payment success will count as purchased.</p>

      {!user ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You are not logged in. Add to cart and checkout require login.
          <button type="button" onClick={goLogin} className="ml-2 font-semibold underline">Login now</button>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Logged in as <span className="font-semibold">{user.name}</span>. You can track purchases at
          <Link href="/account/packages" className="ml-1 font-semibold underline">My Packages</Link>.
        </div>
      )}

      {message ? <p className="mt-4 text-sm text-blue-700">{message}</p> : null}
      {loading ? <p className="mt-4">Loading packages...</p> : null}
      {error ? <p className="mt-4 text-red-500">{error}</p> : null}

      {user ? (
        <section className="mt-6 rounded-2xl border border-neutral-200 p-4">
          <h2 className="text-lg font-semibold">Package Cart</h2>
          {cart.items.length === 0 ? <p className="mt-2 text-sm text-neutral-500">No package in cart.</p> : null}
          <div className="mt-3 space-y-2">
            {cart.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium">{item.service_package?.name || `Package #${item.service_package_id}`}</p>
                  <p className="text-xs text-neutral-600">Qty {item.qty} • RM {item.line_total.toFixed(2)}</p>
                </div>
                <button
                  type="button"
                  disabled={workingId === item.id}
                  onClick={() => void onRemove(item.id)}
                  className="rounded border px-3 py-1 text-xs"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between border-t pt-3">
            <p className="font-semibold">Total RM {Number(cart.total ?? 0).toFixed(2)}</p>
            <button
              type="button"
              disabled={checkingOut || cart.items.length === 0}
              onClick={() => void onCheckout()}
              className="rounded-full bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {checkingOut ? "Processing..." : "Proceed to Payment"}
            </button>
          </div>
        </section>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {packages.map((pkg) => (
          <article key={pkg.id} className="rounded-2xl border border-neutral-200 p-5 shadow-sm">
            <h2 className="font-semibold">{pkg.name}</h2>
            <p className="mt-1 text-sm text-neutral-600">{pkg.description || "Service package"}</p>
            <p className="mt-2 text-sm text-neutral-500">Sessions: {pkg.total_sessions} • Valid: {pkg.valid_days ?? "-"} days</p>
            <p className="mt-2 text-lg font-semibold">RM {pkg.selling_price}</p>
            <button
              type="button"
              disabled={workingId === pkg.id}
              onClick={() => void onAddToCart(pkg)}
              className="mt-3 rounded-full bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {workingId === pkg.id ? "Adding..." : "Add to Cart"}
            </button>
          </article>
        ))}
      </div>
    </main>
  );
}
