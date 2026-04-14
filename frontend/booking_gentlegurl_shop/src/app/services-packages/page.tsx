"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ServicePackageDetailModal } from "@/components/booking/ServicePackageDetailModal";
import { addPackageCartItem, getServicePackages } from "@/lib/apiClient";
import type { ServicePackage } from "@/lib/types";

function formatRm(price: number) {
  const n = Number(price);
  if (Number.isNaN(n)) return String(price);
  return n.toFixed(2);
}

export default function ServicePackagesPage() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [detailPkg, setDetailPkg] = useState<ServicePackage | null>(null);

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

  const onAddToCart = async (pkg: ServicePackage): Promise<boolean> => {
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(pathname || "/services-packages")}`);
      return false;
    }

    try {
      const updatedCart = await addPackageCartItem({ service_package_id: pkg.id, qty: 1 });
      const itemCount = (updatedCart?.items?.length || 0) + (updatedCart?.package_items?.length || 0);
      window.dispatchEvent(new CustomEvent("cartUpdated", { detail: itemCount }));
      setMessage(`Added ${pkg.name} to cart. Open the cart icon when you're ready to pay.`);
      return true;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to add package into cart.");
      return false;
    }
  };

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">Packages</p>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl">Service Packages</h1>
        <div className="h-px max-w-xs bg-gradient-to-r from-[var(--accent-strong)]/50 to-transparent" />
      </div>


      {/* {!user ? (
        <div className="rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-4 py-3 text-sm text-[var(--status-warning)]">
          Log in to add packages to your cart.{" "}
          <Link
            href={`/login?redirect=${encodeURIComponent(pathname || "/services-packages")}`}
            className="font-semibold underline"
          >
            Login
          </Link>
        </div>
      ) : null} */}

      {message ? <p className="text-sm text-[var(--accent)]">{message}</p> : null}
      {error ? <p className="text-sm text-[var(--status-error)]">{error}</p> : null}

      {loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-[280px] animate-pulse rounded-3xl border border-[var(--card-border)]/80 bg-[var(--muted)]/25 shadow-[var(--shadow)]"
            />
          ))}
        </div>
      ) : packages.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No service packages are available right now.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {packages.map((pkg) => {
            const lines = pkg.items?.filter((row) => row.quantity > 0) ?? [];
            const servicesBadge = lines.length === 1 ? "1 Service" : `${lines.length} Services`;
            const blurb = pkg.description?.trim() || "Bundle of salon services at a package rate.";

            return (
              <article
                key={pkg.id}
                className="group flex h-full min-h-[280px] flex-col rounded-3xl border border-[var(--card-border)] bg-[var(--card)] p-6 shadow-[var(--shadow)] ring-1 ring-black/[0.02] transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_50px_-28px_rgba(60,36,50,0.35)] sm:p-7"
              >
                <h2 className="text-lg font-semibold leading-snug tracking-tight text-[var(--foreground)] sm:text-xl">{pkg.name}</h2>
                <p className="mt-4 line-clamp-4 text-sm leading-relaxed text-[var(--text-muted)]">{blurb}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="inline-flex rounded-full border border-[var(--card-border)] bg-[var(--background)]/80 px-3.5 py-1.5 text-xs font-medium text-[var(--foreground)]/85">
                    Valid: {pkg.valid_days ?? "—"} days
                  </span>
                  {lines.length > 0 ? (
                    <span className="inline-flex rounded-full border border-[var(--card-border)] bg-[var(--background)]/80 px-3.5 py-1.5 text-xs font-medium text-[var(--foreground)]/85">
                      {servicesBadge}
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 text-xl font-semibold leading-snug tracking-tight text-[var(--foreground)] sm:text-2xl">
                  RM {formatRm(pkg.selling_price)}
                </div>

                <div className="mt-auto flex w-full flex-col gap-3 pt-2 sm:flex-row sm:items-stretch sm:gap-3 sm:pt-4">
                  <button
                    type="button"
                    onClick={() => void onAddToCart(pkg)}
                    className="inline-flex h-12 w-full shrink-0 touch-manipulation items-center justify-center rounded-full bg-[var(--accent-strong)] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-stronger)] hover:shadow-md active:scale-[0.99] sm:h-11 sm:flex-1"
                  >
                    Add to Cart
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailPkg(pkg)}
                    className="inline-flex h-12 w-full shrink-0 touch-manipulation items-center justify-center rounded-full border border-[var(--card-border)] bg-[var(--badge-background)] px-5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--muted)]/70 active:scale-[0.99] sm:h-11 sm:flex-1"
                  >
                    View
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ServicePackageDetailModal pkg={detailPkg} onClose={() => setDetailPkg(null)} onAddToCart={onAddToCart} />
    </main>
  );
}
