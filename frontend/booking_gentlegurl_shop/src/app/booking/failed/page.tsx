import Link from "next/link";

export default function BookingFailedPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-4xl font-semibold">Payment failed</h1>
      <p className="mt-4 text-neutral-600">Your slot may expire soon. Retry checkout to confirm your appointment.</p>
      <Link href="/booking" className="mt-8 inline-flex rounded-full border border-neutral-300 px-6 py-3">Back to booking</Link>
    </main>
  );
}
