"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createCustomerWalletTopup,
  getCustomerWallet,
  getCustomerWalletPaymentGateways,
  getCustomerWalletTransactions,
  uploadCustomerWalletPaymentProof,
  type CustomerWalletBankAccount,
  type CustomerWalletGateway,
  type CustomerWalletTransaction,
} from "@/lib/apiClient";

type Props = { workspaceType: "ecommerce" | "booking" };
type Filter = "all" | "credit" | "debit" | "pending" | "completed";

const quickAmounts = [20, 50, 100, 200];

function money(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return `RM ${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"}`;
}

function txLabel(tx: CustomerWalletTransaction) {
  if (tx.type === "topup") return "Balance Top Up";
  if (tx.type === "admin_credit") return "CRM Deposit";
  if (tx.type === "admin_debit") return "CRM Withdrawal";
  if (tx.type === "refund_credit") return "Refund Credit";
  if (tx.type === "reversal") return "Reversal";
  return "Balance Adjustment";
}

function statusLabel(status: string) {
  if (status === "pending") return "Waiting for Verification";
  if (status === "failed") return "Rejected / Failed";
  return status.replaceAll("_", " ").replace(/^./, (char) => char.toUpperCase());
}

function receiptTitle(tx: CustomerWalletTransaction) {
  if (tx.status !== "completed" && tx.status !== "reversed") return "Transaction Details";
  if (tx.type === "topup") return "Balance Top Up Receipt";
  if (tx.type === "refund_credit") return "Customer Credit Receipt";
  return "Balance Adjustment Receipt";
}

export default function WalletBalanceSection({ workspaceType }: Props) {
  const [balance, setBalance] = useState("0.00");
  const [transactions, setTransactions] = useState<CustomerWalletTransaction[]>([]);
  const [gateways, setGateways] = useState<CustomerWalletGateway[]>([]);
  const [bankAccounts, setBankAccounts] = useState<CustomerWalletBankAccount[]>([]);
  const [selectedGateway, setSelectedGateway] = useState("");
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<number | null>(null);
  const [amount, setAmount] = useState("50");
  const [filter, setFilter] = useState<Filter>("all");
  const [topupOpen, setTopupOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [detailTx, setDetailTx] = useState<CustomerWalletTransaction | null>(null);
  const [pendingTopup, setPendingTopup] = useState<CustomerWalletTransaction | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const selectedGatewayRecord = gateways.find((gateway) => gateway.key === selectedGateway) ?? null;
  const selectedBank = bankAccounts.find((bank) => bank.id === selectedBankAccountId) ?? null;
  const isManual = selectedGateway === "manual_transfer";
  const topupAmount = Number(amount || 0);
  const filteredTransactions = useMemo(() => {
    if (filter === "credit" || filter === "debit") return transactions.filter((tx) => tx.direction === filter);
    if (filter === "pending") return transactions.filter((tx) => tx.status === "pending");
    if (filter === "completed") return transactions.filter((tx) => tx.status === "completed");
    return transactions;
  }, [filter, transactions]);

  const refresh = useCallback(async () => {
    const [wallet, txRows, gatewayPayload] = await Promise.all([
      getCustomerWallet(),
      getCustomerWalletTransactions("all"),
      getCustomerWalletPaymentGateways(workspaceType),
    ]);
    setBalance(wallet.wallet_balance ?? wallet.balance ?? "0.00");
    setTransactions(txRows);
    setGateways(gatewayPayload.payment_gateways);
    setBankAccounts(gatewayPayload.bank_accounts);
    setSelectedGateway((prev) => prev || gatewayPayload.payment_gateways.find((gateway) => gateway.key === "manual_transfer")?.key || gatewayPayload.payment_gateways[0]?.key || "");
    setSelectedBankAccountId((prev) => prev ?? gatewayPayload.bank_accounts.find((bank) => bank.is_default)?.id ?? gatewayPayload.bank_accounts[0]?.id ?? null);
    window.dispatchEvent(new CustomEvent("walletBalanceUpdated"));
  }, [workspaceType]);

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

  const submitTopup = async () => {
    setError(null);
    setMessage(null);
    if (!selectedGatewayRecord) {
      setError("No payment method selected.");
      return;
    }
    if (!Number.isFinite(topupAmount) || topupAmount <= 0) {
      setError("Enter a valid top-up amount.");
      return;
    }
    if (isManual && !selectedBankAccountId) {
      setError("Please select a bank account for manual transfer.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await createCustomerWalletTopup({
        amount,
        payment_gateway_key: selectedGateway,
        payment_method_label: selectedGatewayRecord.name,
        workspace_type: workspaceType,
        bank_account_id: isManual ? selectedBankAccountId ?? undefined : undefined,
      });
      const topup = response.data?.topup ?? null;
      setPendingTopup(topup);
      setMessage(response.message ?? "Top-up request submitted. Your balance will be credited after payment is successfully verified.");
      await refresh();
      if (!isManual) {
        setTopupOpen(false);
      }
    } catch {
      setError("Unable to submit top-up request. Please check the amount and payment method.");
    } finally {
      setSubmitting(false);
    }
  };

  const uploadProof = async () => {
    if (!pendingTopup || !proofFile) return;
    setSubmitting(true);
    setError(null);
    try {
      await uploadCustomerWalletPaymentProof(pendingTopup.id, proofFile);
      setMessage("Payment proof uploaded. Waiting for staff verification.");
      setProofFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await refresh();
    } catch {
      setError("Payment proof upload failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-[var(--input-border)] bg-[var(--input-bg)]/80 p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent-strong)]">Customer Balance</p>
          <p className="mt-2 text-4xl font-bold text-[var(--accent-stronger)]">{loading ? "Loading..." : money(balance)}</p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">Balance is shared between Ecommerce and Booking.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setTopupOpen(true)} className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-stronger)]">Top Up</button>
          <button type="button" onClick={() => setHistoryOpen((prev) => !prev)} className="rounded-full border border-[var(--input-border)] px-5 py-2 text-sm font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--background-soft)]">Transaction History</button>
        </div>
      </div>

      {message ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div> : null}
      {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {historyOpen ? (
        <div className="mt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-[var(--accent-stronger)]">Balance Transactions</h2>
            <div className="flex flex-wrap gap-2">
              {(["all", "credit", "debit", "pending", "completed"] as Filter[]).map((option) => (
                <button key={option} type="button" onClick={() => setFilter(option)} className={`rounded-full border px-3 py-1 text-xs font-semibold ${filter === option ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--input-border)] text-[var(--text-muted)]"}`}>{option === "credit" ? "Credits" : option === "debit" ? "Debits" : option[0].toUpperCase() + option.slice(1)}</button>
              ))}
            </div>
          </div>
          {filteredTransactions.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-[var(--input-border)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">No balance transactions yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-[920px] w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-[var(--text-muted)]"><tr><th className="py-2">Date/time</th><th>Transaction No</th><th>Type</th><th>Description</th><th>Workspace</th><th>Payment Method</th><th>Credit</th><th>Debit</th><th>Balance After</th><th>Status</th><th>Receipt</th></tr></thead>
                <tbody>{filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="border-t border-[var(--muted)]/50"><td className="py-3">{new Date(tx.created_at).toLocaleString()}</td><td>{tx.transaction_no}</td><td>{txLabel(tx)}</td><td>{tx.remark || txLabel(tx)}</td><td>{tx.workspace_type || "-"}</td><td>{tx.payment_method_label || "-"}</td><td className="font-semibold text-emerald-700">{tx.direction === "credit" ? `+ ${money(tx.amount)}` : "-"}</td><td className="font-semibold text-red-700">{tx.direction === "debit" ? `- ${money(tx.amount)}` : "-"}</td><td>{money(tx.balance_after)}</td><td>{statusLabel(tx.status)}</td><td><button type="button" onClick={() => setDetailTx(tx)} className="text-[var(--accent-strong)] underline">{tx.status === "completed" ? "Receipt" : "View Details"}</button></td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {topupOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-0 backdrop-blur-sm sm:items-center sm:px-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-[var(--input-border)] bg-[var(--input-bg)] p-5 shadow-2xl sm:rounded-3xl sm:p-6">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--muted)]/60 pb-4">
              <div><h3 className="text-xl font-semibold text-[var(--accent-stronger)]">Top Up Balance</h3><p className="mt-1 text-sm text-[var(--text-muted)]">Current Balance: <span className="font-semibold text-[var(--foreground)]">{money(balance)}</span></p></div>
              <button type="button" onClick={() => setTopupOpen(false)} className="rounded-full p-2 text-[var(--text-muted)] hover:bg-[var(--background-soft)]">✕</button>
            </div>
            <div className="space-y-5 py-5">
              <div><p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Amount</p><div className="flex flex-wrap gap-2">{quickAmounts.map((value) => <button key={value} type="button" onClick={() => setAmount(String(value))} className={`rounded-full border px-4 py-2 text-sm font-semibold ${Number(amount) === value ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--input-border)]"}`}>RM{value}</button>)}</div><input value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-3 w-full rounded-xl border border-[var(--input-border)] bg-[var(--background)] px-4 py-3 text-sm" placeholder="Custom amount" /></div>
              <div><p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Payment Method</p>{gateways.length === 0 ? <p className="rounded-xl border border-dashed border-[var(--input-border)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">No payment methods are currently available. Please contact the salon.</p> : <div className="space-y-2">{gateways.map((gateway) => <label key={gateway.key} className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 text-sm font-medium transition-all ${selectedGateway === gateway.key ? "border-[var(--accent-strong)] bg-[var(--muted)]/60 shadow-sm ring-2 ring-[var(--accent)]/25" : "border-[var(--card-border)] bg-[var(--card)] hover:border-[var(--accent)]/50"}`}><input type="radio" name="wallet_payment_method" className="h-4 w-4 accent-[var(--accent-strong)]" checked={selectedGateway === gateway.key} onChange={() => setSelectedGateway(gateway.key)} /><span>{gateway.name}</span></label>)}</div>}</div>
              {isManual ? <div><p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Bank Account</p>{bankAccounts.length === 0 ? <p className="rounded-xl border border-dashed border-[var(--input-border)] px-4 py-4 text-sm text-[var(--text-muted)]">No bank account is configured for manual transfer.</p> : <div className="space-y-2">{bankAccounts.map((bank) => <label key={bank.id} className={`block cursor-pointer rounded-xl border-2 p-4 text-sm ${selectedBankAccountId === bank.id ? "border-[var(--accent-strong)] bg-[var(--muted)]/40 ring-2 ring-[var(--accent)]/20" : "border-[var(--card-border)] bg-[var(--card)]"}`}><div className="flex gap-3"><input type="radio" className="mt-1 h-4 w-4 accent-[var(--accent-strong)]" checked={selectedBankAccountId === bank.id} onChange={() => setSelectedBankAccountId(bank.id)} /><div><p className="font-semibold">{bank.label || bank.bank_name}</p><p className="text-[var(--text-muted)]">{bank.account_name} · {bank.account_number || bank.account_no}</p>{bank.instructions ? <p className="mt-2 text-xs text-[var(--text-muted)]">{bank.instructions}</p> : null}</div></div></label>)}</div>}{selectedBank ? <p className="mt-3 rounded-xl bg-[var(--background-soft)] px-4 py-3 text-xs text-[var(--text-muted)]">Transfer to {selectedBank.bank_name} and upload proof below after submitting.</p> : null}</div> : null}
              <div className="rounded-2xl bg-[var(--background-soft)] p-4 text-sm"><div className="flex justify-between"><span>Current Balance</span><strong>{money(balance)}</strong></div><div className="mt-2 flex justify-between"><span>Top Up Amount</span><strong>{money(topupAmount)}</strong></div><div className="mt-2 flex justify-between border-t border-[var(--muted)] pt-2"><span>Balance After Successful Top Up</span><strong>{money(Number(balance) + (Number.isFinite(topupAmount) ? topupAmount : 0))}</strong></div><p className="mt-3 text-xs text-[var(--text-muted)]">Balance will only be credited after payment is successfully verified.</p></div>
              {pendingTopup && isManual ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p className="font-semibold">Waiting for Verification</p><p className="mt-1">Top-up request {pendingTopup.transaction_no} is pending. Upload payment proof for staff review.</p><input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={(event) => setProofFile(event.target.files?.[0] ?? null)} className="mt-3 block w-full text-sm" /><button type="button" disabled={!proofFile || submitting} onClick={uploadProof} className="mt-3 rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Upload Payment Proof</button></div> : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--muted)]/60 pt-4"><button type="button" onClick={() => setTopupOpen(false)} className="rounded-full border border-[var(--input-border)] px-5 py-2 text-sm font-semibold">Cancel</button><button type="button" disabled={submitting || gateways.length === 0} onClick={submitTopup} className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{submitting ? "Submitting..." : "Continue / Top Up"}</button></div>
          </div>
        </div>
      ) : null}

      {detailTx ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"><div className="w-full max-w-xl rounded-3xl border border-[var(--input-border)] bg-[var(--input-bg)] p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><h3 className="text-xl font-semibold text-[var(--accent-stronger)]">{receiptTitle(detailTx)}</h3><button type="button" onClick={() => setDetailTx(null)} className="rounded-full p-2 text-[var(--text-muted)] hover:bg-[var(--background-soft)]">✕</button></div><div className="mt-5 grid gap-3 text-sm">{[["Receipt No", `${detailTx.status === "completed" ? "RCPT-" : "DETAIL-"}${detailTx.transaction_no}`], ["Transaction No", detailTx.transaction_no], ["Type", txLabel(detailTx)], ["Amount", money(detailTx.amount)], ["Direction", detailTx.direction], ["Previous Balance", money(detailTx.balance_before)], ["New Balance", money(detailTx.balance_after)], ["Payment Method", detailTx.payment_method_label || "-"], ["Workspace", detailTx.workspace_type || "-"], ["Payment Reference", detailTx.reference_no || "-"], ["Source Reference", detailTx.source_id || "-"], ["Status", statusLabel(detailTx.status)], ["Created At", new Date(detailTx.created_at).toLocaleString()], ["Completed At", detailTx.completed_at ? new Date(detailTx.completed_at).toLocaleString() : "-"], ["Remark", detailTx.remark || "-"]].map(([label, value]) => <div key={label} className="flex justify-between gap-4 border-b border-[var(--muted)]/40 pb-2"><span className="text-[var(--text-muted)]">{label}</span><span className="text-right font-medium">{value}</span></div>)}</div></div></div> : null}
    </section>
  );
}
