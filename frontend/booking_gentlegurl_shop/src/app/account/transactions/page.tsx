import { BookingTransactionsClient } from "./BookingTransactionsClient";

export default function BookingAccountTransactionsPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--foreground)]">My Transactions</h2>
          <p className="text-sm text-[var(--foreground)]/70">
            Booking deposits, settlements, and related payments are shown here with full item details.
          </p>
        </div>
      </div>

      <BookingTransactionsClient />
    </div>
  );
}
