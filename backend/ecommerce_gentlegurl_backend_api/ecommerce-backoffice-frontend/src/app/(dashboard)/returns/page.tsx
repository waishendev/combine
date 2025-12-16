'use client';

import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { Column } from '@/components/ui/DataTable';
import { SimpleRecord } from '@/lib/types';

const returnsData: SimpleRecord[] = [
  { id: 1, name: 'ORD-1001', status: 'requested' },
  { id: 2, name: 'ORD-1002', status: 'approved' },
];

export default function ReturnsPage() {
  const columns: Column<SimpleRecord>[] = [
    { key: 'name', header: 'Order #' },
    { key: 'status', header: 'Status' },
    {
      key: 'id',
      header: 'Actions',
      render: (row) => (
        <Link className="text-blue-600 hover:underline" href={`/dashboard/returns/${row.id}`}>
          Review
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Returns" description="Handle return requests" />
      <DataTable columns={columns} data={returnsData} />
    </div>
  );
}
