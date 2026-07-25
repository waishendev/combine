"use client";

import { useCallback, useEffect, useState } from "react";
import { getCustomerWallet } from "@/lib/apiClient";
import { walletMoney } from "@/lib/walletUi";
import WalletTopupModal from "@/components/account/WalletTopupModal";
import WalletSuccessModal, { type WalletSuccessState } from "@/components/account/WalletSuccessModal";

type Props = { workspaceType: "ecommerce" | "booking" };

export default function WalletBalanceSection({ workspaceType }: Props) {
  const [balance, setBalance] = useState("0.00");
  const [topupOpen, setTopupOpen] = useState(false);
  const [success, setSuccess] = useState<WalletSuccessState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const wallet = await getCustomerWallet();
    setBalance(wallet.wallet_balance ?? wallet.balance ?? "0.00");
    window.dispatchEvent(new CustomEvent("walletBalanceUpdated"));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    refresh()
      .catch(() => {
        if (!cancelled) setError("Unable to load customer balance. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)]/70 shadow-sm">
      <div className="relative overflow-hidden px-5 py-5 sm:px-6 sm:py-5">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(ellipse at top right, rgba(var(--accent-rgb), 0.16), transparent 55%), radial-gradient(ellipse at bottom left, rgba(var(--background-soft-rgb), 0.85), transparent 50%)",
          }}
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-strong)]">
              Customer Balance
            </p>
            <p className="mt-1.5 text-3xl font-semibold tracking-tight text-[var(--accent-stronger)] tabular-nums sm:text-[2rem]">
              {loading ? "…" : walletMoney(balance)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setTopupOpen(true);
            }}
            className="w-full rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-stronger)] sm:w-auto"
          >
            Top Up
          </button>
        </div>
      </div>

      {error && !topupOpen ? (
        <div className="border-t border-[var(--input-border)] bg-rose-50 px-5 py-3 text-sm text-rose-700 sm:px-6">
          {error}
        </div>
      ) : null}

      <WalletTopupModal
        open={topupOpen}
        onClose={() => setTopupOpen(false)}
        workspaceType={workspaceType}
        balance={balance}
        onRefresh={refresh}
        onCompleted={(result) => setSuccess(result)}
      />

      <WalletSuccessModal
        state={success}
        onClose={() => setSuccess(null)}
        activityHref="/account/wallet"
      />
    </section>
  );
}
