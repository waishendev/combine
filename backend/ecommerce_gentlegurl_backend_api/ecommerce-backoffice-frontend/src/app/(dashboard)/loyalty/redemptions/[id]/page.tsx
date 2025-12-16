'use client';

import { useParams } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import FormSection from '@/components/ui/FormSection';

export default function RedemptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="space-y-4">
      <PageHeader title={`Redemption ${id}`} description="Review redemption status" />
      <FormSection title="Status Actions">
        <div className="flex items-center gap-3">
          <button className="rounded bg-blue-600 px-3 py-2 text-white">Approve</button>
          <button className="rounded border px-3 py-2">Reject</button>
        </div>
      </FormSection>
    </div>
  );
}
