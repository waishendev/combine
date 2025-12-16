import Link from "next/link";
import { redirect } from "next/navigation";

type ThankYouPageProps = {
  searchParams: Promise<{
    order_no?: string;
    order_id?: string;
    payment_method?: string;
  }>;
};

export default async function ThankYouPage({ searchParams }: ThankYouPageProps) {
  const params = await searchParams;
  const { order_no, payment_method } = params;

  if (!order_no) {
    redirect("/");
  }

  const isManual = payment_method === "manual_transfer";

  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center text-[var(--foreground)]">
      <h1 className="text-3xl font-semibold">Thank you for your order!</h1>

      <p className="mt-4 text-sm text-[var(--foreground)]/80">
        Your order number is{" "}
        <span className="font-mono font-semibold">{order_no}</span>.
      </p>

      {isManual ? (
        <div className="mt-6 rounded-lg border border-[var(--muted)] bg-white/80 p-4 text-left text-sm text-[var(--foreground)]">
          <p className="font-medium">Payment Instructions</p>
          <p className="mt-2">
            Please transfer the total amount to our bank account and upload your
            bank-in slip for verification.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
            <li>Bank: (TODO: fill later)</li>
            <li>Account Name: (TODO)</li>
            <li>Account Number: (TODO)</li>
          </ul>
          <p className="mt-3 text-xs text-[var(--foreground)]/60">
            After payment, our team will verify your order within 1–2 working
            days.
          </p>
        </div>
      ) : (
        <p className="mt-6 text-sm text-[var(--foreground)]/80">
          If you have completed the online payment, you will receive an email
          confirmation shortly.
        </p>
      )}

      <div className="mt-8 flex justify-center gap-3 text-sm">
        <Link
          href="/shop"
          className="rounded border border-[var(--accent)] bg-white/70 px-4 py-2 text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/70"
        >
          Continue Shopping
        </Link>
        <Link
          href="/orders"
          className="rounded bg-[var(--accent)] px-4 py-2 text-white transition-colors hover:bg-[var(--accent-strong)]"
        >
          View My Orders
        </Link>
      </div>
    </main>
  );
}
