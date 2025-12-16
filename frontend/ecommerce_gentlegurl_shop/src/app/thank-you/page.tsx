import ThankYouClient from "@/components/thank-you/ThankYouClient";
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
  const { order_no, payment_method, order_id } = params;

  if (!order_no) {
    redirect("/");
  }

  const parsedOrderId = order_id ? Number(order_id) : null;

  return (
    <ThankYouClient
      orderNo={order_no}
      orderId={Number.isNaN(parsedOrderId) ? null : parsedOrderId}
      paymentMethod={payment_method}
    />
  );
}
