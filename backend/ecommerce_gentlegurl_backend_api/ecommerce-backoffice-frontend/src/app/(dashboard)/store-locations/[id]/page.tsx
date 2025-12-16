'use client';

import { useParams } from 'next/navigation';
import StoreLocationForm from '@/components/forms/StoreLocationForm';
import PageHeader from '@/components/ui/PageHeader';

export default function EditStoreLocationPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="space-y-4">
      <PageHeader title={`Store Location ${id}`} description="Edit store details" />
      <StoreLocationForm />
    </div>
  );
}
