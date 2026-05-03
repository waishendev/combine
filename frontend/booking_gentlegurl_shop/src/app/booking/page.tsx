import { Suspense } from "react";
import BookingPageContent from "./BookingPageContent";

export default function BookingPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl px-4 py-10">
          <p className="text-sm text-[var(--text-muted)]">Loading…</p>
        </main>
      }
    >
      <BookingPageContent />
    </Suspense>
  );
}
