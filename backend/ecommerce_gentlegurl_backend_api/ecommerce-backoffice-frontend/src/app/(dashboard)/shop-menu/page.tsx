'use client';

import PageHeader from '@/components/ui/PageHeader';
import DataTable, { Column } from '@/components/ui/DataTable';
import { SimpleRecord } from '@/lib/types';

const menuItems: SimpleRecord[] = [
  { id: 1, name: 'Home', status: 'visible' },
  { id: 2, name: 'Beverages', status: 'visible' },
];

export default function ShopMenuPage() {
  const columns: Column<SimpleRecord>[] = [
    { key: 'name', header: 'Label' },
    { key: 'status', header: 'Status' },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Shop Menu" description="Configure storefront navigation" />
      <DataTable columns={columns} data={menuItems} />
    </div>
  );
}
