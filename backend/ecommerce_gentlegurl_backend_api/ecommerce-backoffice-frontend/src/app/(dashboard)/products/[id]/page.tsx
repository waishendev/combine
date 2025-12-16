'use client';

import { useParams } from 'next/navigation';
import ProductForm from '@/components/forms/ProductForm';
import PageHeader from '@/components/ui/PageHeader';

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="space-y-4">
      <PageHeader title={`Product ${id}`} description="Edit product information" />
      <ProductForm />
    </div>
  );
}
