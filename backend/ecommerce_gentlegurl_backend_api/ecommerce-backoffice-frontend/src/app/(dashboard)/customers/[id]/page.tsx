'use client';

import { useParams } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import FormSection from '@/components/ui/FormSection';

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="space-y-4">
      <PageHeader title={`Customer ${id}`} description="Profile and loyalty overview" />
      <FormSection title="Profile">
        <div className="text-sm text-gray-700">Customer info will load from /ecommerce/customers/{id}</div>
      </FormSection>
      <FormSection title="Loyalty Summary">
        <div className="text-sm text-gray-700">Points and tier from /ecommerce/customers/{id}/loyalty-summary</div>
      </FormSection>
      <FormSection title="Loyalty History">
        <div className="text-sm text-gray-700">Transactions from /ecommerce/customers/{id}/loyalty-history</div>
      </FormSection>
    </div>
  );
}
