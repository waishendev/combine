'use client';

import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { Column } from '@/components/ui/DataTable';
import { SimpleRecord } from '@/lib/types';

const customers: SimpleRecord[] = [
  { id: 1, name: 'Alice', status: 'active' },
  { id: 2, name: 'Bob', status: 'inactive' },
];

export default function CustomersPage() {
  const columns: Column<SimpleRecord>[] = [
    { key: 'name', header: 'Name' },
    { key: 'status', header: 'Status' },
    {
      key: 'id',
      header: 'Actions',
      render: (row) => (
        <Link className="text-blue-600 hover:underline" href={`/dashboard/customers/${row.id}`}>
          View
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Customers" description="Administer customer profiles" />
      <DataTable columns={columns} data={customers} />
    </div>
  );
}
