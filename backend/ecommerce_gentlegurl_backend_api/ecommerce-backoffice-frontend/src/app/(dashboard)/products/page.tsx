'use client';

import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { Column } from '@/components/ui/DataTable';
import { SimpleRecord } from '@/lib/types';

const sampleProducts: SimpleRecord[] = [
  { id: 1, name: 'Green Tea', status: 'active' },
  { id: 2, name: 'Oolong Tea', status: 'draft' },
];

export default function ProductsPage() {
  const columns: Column<SimpleRecord>[] = [
    { key: 'name', header: 'Name' },
    { key: 'status', header: 'Status' },
    {
      key: 'id',
      header: 'Actions',
      render: (row) => (
        <Link className="text-blue-600 hover:underline" href={`/dashboard/products/${row.id}`}>
          Edit
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <PageHeader title="Products" description="Manage catalog products" />
        <Link className="rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white" href="/dashboard/products/create">
          New Product
        </Link>
      </div>
      <DataTable columns={columns} data={sampleProducts} />
    </div>
  );
}
