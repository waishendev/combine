/** Request-scoped client cache so header + account wallet share one fetch. */

type WalletCacheEntry = {
  customerId: number;
  balance: string;
  fetchedAt: number;
};

const TTL_MS = 30_000;
let entry: WalletCacheEntry | null = null;
let inflight: Promise<string> | null = null;

export function peekCachedWalletBalance(customerId: number): string | null {
  if (!entry || entry.customerId !== customerId) return null;
  if (Date.now() - entry.fetchedAt > TTL_MS) return null;
  return entry.balance;
}

export function setCachedWalletBalance(customerId: number, balance: string): void {
  entry = { customerId, balance, fetchedAt: Date.now() };
}

export function clearCachedWalletBalance(): void {
  entry = null;
  inflight = null;
}

export async function loadSharedWalletBalance(
  customerId: number,
  loader: () => Promise<string>,
): Promise<string> {
  const cached = peekCachedWalletBalance(customerId);
  if (cached !== null) return cached;

  if (inflight) return inflight;

  inflight = loader()
    .then((balance) => {
      setCachedWalletBalance(customerId, balance);
      return balance;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}
