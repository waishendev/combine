'use client';

import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { Column } from '@/components/ui/DataTable';
import { SimpleRecord } from '@/lib/types';

const rewards: SimpleRecord[] = [
  { id: 1, name: 'Free Drink', status: 'active' },
  { id: 2, name: 'Discount Coupon', status: 'inactive' },
];

export default function LoyaltyRewardsPage() {
  const columns: Column<SimpleRecord>[] = [
    { key: 'name', header: 'Reward' },
    { key: 'status', header: 'Status' },
    {
      key: 'id',
      header: 'Actions',
      render: (row) => (
        <Link className="text-blue-600 hover:underline" href={`/dashboard/loyalty/rewards/${row.id}`}>
          Edit
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Loyalty Rewards" description="Create and manage rewards" />
      <DataTable columns={columns} data={rewards} />
    </div>
  );
}
