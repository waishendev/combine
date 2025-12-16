'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import DataTable, { Column } from '@/components/ui/DataTable';
import PageHeader from '@/components/ui/PageHeader';
import { Order } from '@/lib/types';
import { apiGet } from '@/lib/api-client';

const fallbackOrders: Order[] = [
  {
    id: 1,
    order_number: 'ORD-1001',
    customer: 'Alice',
    grand_total: 120,
    status: 'pending',
    payment_status: 'unpaid',
    placed_at: '2024-01-02',
  },
  {
    id: 2,
    order_number: 'ORD-1002',
    customer: 'Bob',
    grand_total: 85,
    status: 'paid',
    payment_status: 'paid',
    placed_at: '2024-01-03',
  },
];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>(fallbackOrders);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiGet<Order[]>('/ecommerce/orders');
        setOrders(res.data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  const columns: Column<Order>[] = [
    { key: 'order_number', header: 'Order #' },
    { key: 'customer', header: 'Customer' },
    { key: 'grand_total', header: 'Total', render: (row) => `$${row.grand_total}` },
    { key: 'status', header: 'Status' },
    { key: 'payment_status', header: 'Payment' },
    { key: 'placed_at', header: 'Placed' },
    {
      key: 'id',
      header: 'Actions',
      render: (row) => (
        <Link className="text-blue-600 hover:underline" href={`/dashboard/orders/${row.id}`}>
          View
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Orders" description="Manage ecommerce orders" />
      {loading && <div className="text-sm text-gray-600">Loading orders...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      <DataTable columns={columns} data={orders} />
    </div>
  );
}
