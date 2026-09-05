"use client";

import { useCallback, useEffect, useState } from "react";
import { getCustomerWallet } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";
import {
  clearCachedWalletBalance,
  loadSharedWalletBalance,
  setCachedWalletBalance,
} from "@/lib/walletSharedCache";
import { walletMoney } from "@/lib/walletUi";
import WalletTopupModal from "@/components/account/WalletTopupModal";
import WalletSuccessModal, { type WalletSuccessState } from "@/components/account/WalletSuccessModal";

type Props = { workspaceType: "ecommerce" | "booking" };

export default function WalletBalanceSection({ workspaceType }: Props) {
  const { customer } = useAuth();
  const [balance, setBalance] = useState("0.00");
  const [topupOpen, setTopupOpen] = useState(false);
  const [success, setSuccess] = useState<WalletSuccessState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (force = false) => {
    const customerId = Number(customer?.profile?.id ?? 0);
    if (force) {
      clearCachedWalletBalance();
    }
    if (!customerId) {
      const wallet = await getCustomerWallet();
      const next = wallet.wallet_balance ?? wallet.balance ?? "0.00";
      setBalance(next);
      window.dispatchEvent(new CustomEvent("walletBalanceUpdated"));
      return;
    }
    const next = await loadSharedWalletBalance(customerId, async () => {
      const wallet = await getCustomerWallet();
      return wallet.wallet_balance ?? wallet.balance ?? "0.00";
    });
    setBalance(next);
    setCachedWalletBalance(customerId, next);
    window.dispatchEvent(new CustomEvent("walletBalanceUpdated"));
  }, [customer?.profile?.id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    refresh(false)
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
        <div className="relative flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-strong)]">
              Customer Balance
            </p>
            <p className="mt-1.5 text-2xl font-semibold tracking-tight text-[var(--accent-stronger)] tabular-nums sm:text-[2rem]">
              {loading ? "…" : walletMoney(balance)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setTopupOpen(true);
            }}
            className="min-h-[44px] shrink-0 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-stronger)] sm:min-h-0 sm:px-5"
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
        onRefresh={() => refresh(true)}
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
