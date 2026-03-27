import { redirect } from "next/navigation";

type LegacyPaymentResultPageProps = {
  searchParams: Promise<{
    booking_id?: string;
    order_id?: string;
    order_no?: string;
    payment_method?: string;
    provider?: string;
  }>;
};

export default async function LegacyBookingPaymentResultPage({ searchParams }: LegacyPaymentResultPageProps) {
  const params = await searchParams;
  const bookingId = params.booking_id || params.order_id;

  if (!bookingId) {
    redirect("/");
  }

  const nextParams = new URLSearchParams();
  nextParams.set("order_id", bookingId);
  if (params.order_no) nextParams.set("order_no", params.order_no);
  if (params.payment_method) nextParams.set("payment_method", params.payment_method);
  if (params.provider) nextParams.set("provider", params.provider);

  redirect(`/payment-result?${nextParams.toString()}`);
}
