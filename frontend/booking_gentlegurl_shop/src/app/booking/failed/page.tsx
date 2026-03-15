import Link from "next/link";

export default function BookingFailedPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-4xl font-semibold">Payment failed</h1>
      <p className="mt-4 text-[var(--text-muted)]">Your slot may expire soon. Retry checkout to confirm your appointment.</p>
      <Link href="/booking/cart" className="mt-8 inline-flex rounded-full border border-[var(--card-border)] px-6 py-3 hover:bg-[var(--muted)] transition-colors">Return to cart</Link>
    </main>
  );
}
