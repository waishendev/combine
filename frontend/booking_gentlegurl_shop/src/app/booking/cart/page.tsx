"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy route: cart is opened from the header when the guest is ready to pay. */
export default function BookingCartPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/booking");
  }, [router]);

  return (
    <main className="mx-auto flex min-h-[40vh] max-w-3xl items-center justify-center px-4 py-16">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
    </main>
  );
}
