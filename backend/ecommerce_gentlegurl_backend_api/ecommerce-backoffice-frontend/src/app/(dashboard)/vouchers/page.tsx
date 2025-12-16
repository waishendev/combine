'use client';

import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { Column } from '@/components/ui/DataTable';
import { SimpleRecord } from '@/lib/types';

const vouchers: SimpleRecord[] = [
  { id: 1, name: 'WELCOME10', status: 'active' },
  { id: 2, name: 'SUMMER20', status: 'expired' },
];

export default function VouchersPage() {
  const columns: Column<SimpleRecord>[] = [
    { key: 'name', header: 'Code' },
    { key: 'status', header: 'Status' },
    {
      key: 'id',
      header: 'Actions',
      render: (row) => (
        <Link className="text-blue-600 hover:underline" href={`/dashboard/vouchers/${row.id}`}>
          Edit
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <PageHeader title="Vouchers" description="Manage promotion codes" />
        <Link className="rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white" href="/dashboard/vouchers/create">
          New Voucher
        </Link>
      </div>
      <DataTable columns={columns} data={vouchers} />
    </div>
  );
}
