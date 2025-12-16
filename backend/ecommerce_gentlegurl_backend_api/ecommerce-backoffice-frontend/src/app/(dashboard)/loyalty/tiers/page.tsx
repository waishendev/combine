'use client';

import PageHeader from '@/components/ui/PageHeader';
import DataTable, { Column } from '@/components/ui/DataTable';

const tiers = [
  { id: 1, name: 'Normal', threshold_amount: 0, multiplier: 1, product_discount_percent: 0 },
  { id: 2, name: 'Silver', threshold_amount: 500, multiplier: 1.2, product_discount_percent: 2 },
  { id: 3, name: 'Gold', threshold_amount: 1500, multiplier: 1.5, product_discount_percent: 5 },
];

type Tier = (typeof tiers)[number];

export default function LoyaltyTiersPage() {
  const columns: Column<Tier>[] = [
    { key: 'name', header: 'Tier' },
    { key: 'threshold_amount', header: 'Threshold' },
    { key: 'multiplier', header: 'Multiplier' },
    { key: 'product_discount_percent', header: 'Discount %' },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Membership Tiers" description="Adjust thresholds and rewards" />
      <DataTable columns={columns} data={tiers} />
    </div>
  );
}
