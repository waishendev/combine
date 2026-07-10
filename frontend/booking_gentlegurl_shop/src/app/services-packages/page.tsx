"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ServicePackageDetailModal } from "@/components/booking/ServicePackageDetailModal";
import { addPackageCartItem, getServicePackages } from "@/lib/apiClient";
import {
  buildPackageLoginRedirect,
  clearPendingPackageId,
  openBookingCart,
  readPendingPackageId,
  shouldOpenCartFromUrl,
  syncCartCount,
} from "@/lib/packageCartFlow";
import type { ServicePackage } from "@/lib/types";

function formatRm(price: number) {
  const n = Number(price);
  if (Number.isNaN(n)) return String(price);
  return n.toFixed(2);
}

type PageNotice =
  | { type: "error"; text: string }
  | null;

export default function ServicePackagesPage() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<PageNotice>(null);
  const [detailPkg, setDetailPkg] = useState<ServicePackage | null>(null);
  const [addingPackageId, setAddingPackageId] = useState<number | null>(null);
  const pendingPackageHandledRef = useRef(false);

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
    if (!user || loading || pendingPackageHandledRef.current) return;

    const pendingId = readPendingPackageId();
    const shouldOpenCart = shouldOpenCartFromUrl();
    if (!pendingId && !shouldOpenCart) return;

    pendingPackageHandledRef.current = true;

    const run = async () => {
      try {
        if (pendingId) {
          const updatedCart = await addPackageCartItem({ service_package_id: pendingId, qty: 1 });
          syncCartCount(updatedCart);
        }
        clearPendingPackageId();
        if (pendingId || shouldOpenCart) {
          openBookingCart();
        }
      } catch (err) {
        clearPendingPackageId();
        setNotice({
          type: "error",
          text: err instanceof Error ? err.message : "Unable to add package into cart.",
        });
      }
    };

    void run();
  }, [user, loading]);

  const onAddToCart = async (pkg: ServicePackage): Promise<boolean> => {
    setNotice(null);

    if (!user) {
      router.push(buildPackageLoginRedirect(pathname || "/services-packages", pkg.id));
      return false;
    }

    setAddingPackageId(pkg.id);
    try {
      const updatedCart = await addPackageCartItem({ service_package_id: pkg.id, qty: 1 });
      syncCartCount(updatedCart);
      openBookingCart();
      return true;
    } catch (err) {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : "Unable to add package into cart.",
      });
      return false;
    } finally {
      setAddingPackageId(null);
    }
  };

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">Packages</p>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl">Service Packages</h1>
        <div className="h-px max-w-xs bg-gradient-to-r from-[var(--accent-strong)]/50 to-transparent" />
      </div>

      {notice?.type === "error" ? (
        <div
          className="rounded-2xl border border-[var(--status-error-border)] bg-[var(--status-error-bg)] px-4 py-3 text-sm text-[var(--status-error)]"
          role="alert"
        >
          {notice.text}
        </div>
      ) : null}

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
            const isAdding = addingPackageId === pkg.id;

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
                    disabled={isAdding}
                    className="inline-flex h-12 w-full shrink-0 touch-manipulation items-center justify-center rounded-full bg-[var(--accent-strong)] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-stronger)] hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:h-11 sm:flex-1"
                  >
                    {isAdding ? "Adding..." : "Add to Cart"}
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
