'use client';

import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { Column } from '@/components/ui/DataTable';
import { SimpleRecord } from '@/lib/types';

const templates: SimpleRecord[] = [
  { id: 1, name: 'Order Confirmation', status: 'active' },
  { id: 2, name: 'Shipping Update', status: 'active' },
];

export default function NotificationTemplatesPage() {
  const columns: Column<SimpleRecord>[] = [
    { key: 'name', header: 'Template' },
    { key: 'status', header: 'Status' },
    {
      key: 'id',
      header: 'Actions',
      render: (row) => (
        <Link className="text-blue-600 hover:underline" href={`/dashboard/notifications/templates/${row.id}`}>
          Edit
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Notification Templates" description="Manage customer communications" />
      <DataTable columns={columns} data={templates} />
    </div>
  );
}
