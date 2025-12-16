'use client';

import CategoryForm from '@/components/forms/CategoryForm';
import PageHeader from '@/components/ui/PageHeader';

export default function CreateCategoryPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Create Category" description="Add a new category" />
      <CategoryForm />
    </div>
  );
}
