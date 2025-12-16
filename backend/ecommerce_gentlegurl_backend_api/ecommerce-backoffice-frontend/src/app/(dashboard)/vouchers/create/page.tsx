'use client';

import VoucherForm from '@/components/forms/VoucherForm';
import PageHeader from '@/components/ui/PageHeader';

export default function CreateVoucherPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Create Voucher" description="Set up a new promotion code" />
      <VoucherForm />
    </div>
  );
}
