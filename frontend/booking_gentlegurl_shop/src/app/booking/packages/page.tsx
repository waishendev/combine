"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getServicePackages, purchaseServicePackage } from "@/lib/apiClient";
import { ServicePackage } from "@/lib/types";

export default function BookingPackagesPage() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [buyingId, setBuyingId] = useState<number | null>(null);

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

  const onBuy = async (pkg: ServicePackage) => {
    if (!user) return;

    setMessage(null);
    setBuyingId(pkg.id);
    try {
      await purchaseServicePackage({ service_package_id: pkg.id });
      setMessage(`Purchased ${pkg.name}. You can view it in My Packages.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to purchase package.");
    } finally {
      setBuyingId(null);
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
      <p className="mt-2 text-neutral-600">Choose package plan and purchase under your account.</p>

      {!user ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You are not logged in. Please login first before purchasing a package.
          <Link
            href={`/login?redirect=${encodeURIComponent(pathname || "/booking/packages")}`}
            className="ml-2 font-semibold underline"
          >
            Login now
          </Link>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Logged in as <span className="font-semibold">{user.name}</span>. Purchased packages will appear in
          <Link href="/account/packages" className="ml-1 font-semibold underline">My Packages</Link>.
        </div>
      )}

      {message ? <p className="mt-4 text-sm text-blue-700">{message}</p> : null}
      {loading ? <p className="mt-4">Loading packages...</p> : null}
      {error ? <p className="mt-4 text-red-500">{error}</p> : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {packages.map((pkg) => (
          <article key={pkg.id} className="rounded-2xl border border-neutral-200 p-5 shadow-sm">
            <h2 className="font-semibold">{pkg.name}</h2>
            <p className="mt-1 text-sm text-neutral-600">{pkg.description || "Service package"}</p>
            <p className="mt-2 text-sm text-neutral-500">Sessions: {pkg.total_sessions} • Valid: {pkg.valid_days ?? "-"} days</p>
            <p className="mt-2 text-lg font-semibold">RM {pkg.selling_price}</p>
            {user ? (
              <button
                type="button"
                disabled={buyingId === pkg.id}
                onClick={() => void onBuy(pkg)}
                className="mt-3 rounded-full bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {buyingId === pkg.id ? "Purchasing..." : "Buy Package"}
              </button>
            ) : (
              <p className="mt-2 text-xs text-amber-700">Please login first to purchase this package.</p>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}
