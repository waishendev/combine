"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMyServicePackages } from "@/lib/apiClient";
import { MyServicePackage } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";

export default function MyServicePackagesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<MyServicePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/account/packages");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getMyServicePackages();
        setRows(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load my service packages");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [user]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-semibold">My Packages</h1>
      {loading ? <p className="mt-4">Loading packages...</p> : null}
      {error ? <p className="mt-4 text-red-500">{error}</p> : null}

      <div className="mt-6 space-y-3">
        {rows.length === 0 && !loading ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 p-5 text-sm text-neutral-600">No package purchased yet.</div>
        ) : null}

        {rows.map((row) => (
          <div key={row.id} className="rounded-2xl border border-neutral-200 p-5">
            <p className="font-semibold">{row.service_package?.name || `Package #${row.id}`}</p>
            <p className="text-sm text-neutral-600">Status: {row.status}</p>
            <p className="text-sm text-neutral-600">Expires: {row.expires_at || "-"}</p>

            <div className="mt-3 space-y-1 text-sm">
              {(row.balances ?? []).map((bal) => (
                <p key={bal.id}>
                  {bal.booking_service?.name || `Service #${bal.booking_service_id}`}: remaining {bal.remaining_qty} / {bal.total_qty}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
