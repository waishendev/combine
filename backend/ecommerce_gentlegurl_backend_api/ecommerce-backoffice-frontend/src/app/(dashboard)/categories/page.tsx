'use client';

import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { Column } from '@/components/ui/DataTable';
import { SimpleRecord } from '@/lib/types';

const sampleCategories: SimpleRecord[] = [
  { id: 1, name: 'Beverage', status: 'active' },
  { id: 2, name: 'Snacks', status: 'active' },
];

export default function CategoriesPage() {
  const columns: Column<SimpleRecord>[] = [
    { key: 'name', header: 'Name' },
    { key: 'status', header: 'Status' },
    {
      key: 'id',
      header: 'Actions',
      render: (row) => (
        <Link className="text-blue-600 hover:underline" href={`/dashboard/categories/${row.id}`}>
          Edit
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <PageHeader title="Categories" description="Organize products into groups" />
        <Link className="rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white" href="/dashboard/categories/create">
          New Category
        </Link>
      </div>
      <DataTable columns={columns} data={sampleCategories} />
    </div>
  );
}
