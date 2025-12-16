'use client';

import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { Column } from '@/components/ui/DataTable';
import { SimpleRecord } from '@/lib/types';

const redemptions: SimpleRecord[] = [
  { id: 1, name: 'Alice - Free Drink', status: 'pending' },
  { id: 2, name: 'Bob - Coupon', status: 'approved' },
];

export default function LoyaltyRedemptionsPage() {
  const columns: Column<SimpleRecord>[] = [
    { key: 'name', header: 'Redemption' },
    { key: 'status', header: 'Status' },
    {
      key: 'id',
      header: 'Actions',
      render: (row) => (
        <Link className="text-blue-600 hover:underline" href={`/dashboard/loyalty/redemptions/${row.id}`}>
          Review
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Redemptions" description="Approve or reject redemption requests" />
      <DataTable columns={columns} data={redemptions} />
    </div>
  );
}
