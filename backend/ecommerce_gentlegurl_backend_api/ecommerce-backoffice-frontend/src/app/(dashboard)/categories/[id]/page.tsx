'use client';

import { useParams } from 'next/navigation';
import CategoryForm from '@/components/forms/CategoryForm';
import PageHeader from '@/components/ui/PageHeader';

export default function EditCategoryPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="space-y-4">
      <PageHeader title={`Category ${id}`} description="Edit category details" />
      <CategoryForm />
    </div>
  );
}
