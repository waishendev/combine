import localFont from "next/font/local";
import { Suspense } from "react";
import BookingPageContent from "./BookingPageContent";

const justBreathe = localFont({
  src: "../../../public/fonts/just_breathe/JustBreathe.otf",
});

export default function BookingPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl px-4 py-10">
          <p className="text-sm text-[var(--text-muted)]">Loading…</p>
        </main>
      }
    >
      <BookingPageContent headingFontClassName={justBreathe.className} />
    </Suspense>
  );
}
