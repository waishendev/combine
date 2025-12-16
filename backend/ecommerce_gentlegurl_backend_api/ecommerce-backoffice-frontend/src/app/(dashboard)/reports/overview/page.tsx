'use client';

import PageHeader from '@/components/ui/PageHeader';
import SalesOverviewChart from '@/components/charts/SalesOverviewChart';

const data = [
  { label: 'Revenue', value: 82000 },
  { label: 'Orders', value: 2210 },
  { label: 'Returning Customers', value: 320 },
];

export default function ReportsOverviewPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Sales Overview" description="Snapshot of recent performance" />
      <SalesOverviewChart data={data} />
    </div>
  );
}
