'use client';

import { useParams } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import FormSection from '@/components/ui/FormSection';

export default function ReturnDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="space-y-4">
      <PageHeader title={`Return ${id}`} description="Update return status" />
      <FormSection title="Status">
        <select className="rounded border px-3 py-2">
          <option>requested</option>
          <option>approved</option>
          <option>rejected</option>
          <option>completed</option>
        </select>
      </FormSection>
    </div>
  );
}
