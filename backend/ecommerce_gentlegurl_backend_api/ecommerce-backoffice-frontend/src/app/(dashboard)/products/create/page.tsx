'use client';

import ProductForm from '@/components/forms/ProductForm';
import PageHeader from '@/components/ui/PageHeader';

export default function CreateProductPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Create Product" description="Add a new item to the catalog" />
      <ProductForm />
    </div>
  );
}
