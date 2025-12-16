'use client';

import { useParams } from 'next/navigation';
import VoucherForm from '@/components/forms/VoucherForm';
import PageHeader from '@/components/ui/PageHeader';

export default function VoucherDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="space-y-4">
      <PageHeader title={`Voucher ${id}`} description="Edit voucher" />
      <VoucherForm />
    </div>
  );
}
