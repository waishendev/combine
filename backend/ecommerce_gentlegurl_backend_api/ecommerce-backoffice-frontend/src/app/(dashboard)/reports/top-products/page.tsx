'use client';

import PageHeader from '@/components/ui/PageHeader';
import DataTable, { Column } from '@/components/ui/DataTable';

const data = [
  { id: 1, name: 'Green Tea', status: '320 sales' },
  { id: 2, name: 'Oolong Tea', status: '280 sales' },
];

type Row = (typeof data)[number];

export default function ReportsTopProductsPage() {
  const columns: Column<Row>[] = [
    { key: 'name', header: 'Product' },
    { key: 'status', header: 'Sales' },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Top Products" description="Best performing products" />
      <DataTable columns={columns} data={data} />
    </div>
  );
}
