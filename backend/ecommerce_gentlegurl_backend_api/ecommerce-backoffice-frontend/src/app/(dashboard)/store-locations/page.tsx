'use client';

import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { Column } from '@/components/ui/DataTable';
import { SimpleRecord } from '@/lib/types';

const locations: SimpleRecord[] = [
  { id: 1, name: 'Central Store', status: 'active' },
  { id: 2, name: 'Airport Kiosk', status: 'active' },
];

export default function StoreLocationsPage() {
  const columns: Column<SimpleRecord>[] = [
    { key: 'name', header: 'Name' },
    { key: 'status', header: 'Status' },
    {
      key: 'id',
      header: 'Actions',
      render: (row) => (
        <Link className="text-blue-600 hover:underline" href={`/dashboard/store-locations/${row.id}`}>
          Edit
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <PageHeader title="Store Locations" description="Manage offline stores" />
        <Link className="rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white" href="/dashboard/store-locations/create">
          Add Location
        </Link>
      </div>
      <DataTable columns={columns} data={locations} />
    </div>
  );
}
