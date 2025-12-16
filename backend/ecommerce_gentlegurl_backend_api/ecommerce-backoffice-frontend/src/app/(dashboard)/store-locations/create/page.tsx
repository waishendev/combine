'use client';

import StoreLocationForm from '@/components/forms/StoreLocationForm';
import PageHeader from '@/components/ui/PageHeader';

export default function CreateStoreLocationPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Create Store Location" description="Add a new physical store" />
      <StoreLocationForm />
    </div>
  );
}
