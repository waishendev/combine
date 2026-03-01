import Link from "next/link";

export default function BookingSuccessPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-4xl font-semibold">Booking confirmed</h1>
      <p className="mt-4 text-neutral-600">Your appointment is secured. We look forward to seeing you.</p>
      <Link href="/account/bookings" className="mt-8 inline-flex rounded-full bg-black px-6 py-3 text-white">View My Bookings</Link>
    </main>
  );
}
