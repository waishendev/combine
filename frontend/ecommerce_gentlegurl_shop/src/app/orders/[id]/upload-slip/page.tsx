import UploadSlipForm from "@/components/orders/UploadSlipForm";

type UploadSlipPageProps = {
  params: Promise<{ id: string }>;
};

export default async function UploadSlipPage({ params }: UploadSlipPageProps) {
  const resolvedParams = await params;

  return <UploadSlipForm orderId={resolvedParams.id} />;
}

