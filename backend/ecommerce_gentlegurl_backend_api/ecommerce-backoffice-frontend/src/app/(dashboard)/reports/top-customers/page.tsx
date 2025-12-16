'use client';

import PageHeader from '@/components/ui/PageHeader';
import DataTable, { Column } from '@/components/ui/DataTable';

const data = [
  { id: 1, name: 'Alice', status: '$3,200' },
  { id: 2, name: 'Bob', status: '$2,780' },
];

type Row = (typeof data)[number];

export default function ReportsTopCustomersPage() {
  const columns: Column<Row>[] = [
    { key: 'name', header: 'Customer' },
    { key: 'status', header: 'Lifetime Spend' },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Top Customers" description="Best customers by revenue" />
      <DataTable columns={columns} data={data} />
    </div>
  );
}
