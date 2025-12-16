'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import FormSection from '@/components/ui/FormSection';
import { apiGet, apiPut } from '@/lib/api-client';

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<any>(null);
  const [status, setStatus] = useState('pending');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await apiGet<any>(`/ecommerce/orders/${id}`);
        setOrder(res.data);
        setStatus(res.data.status);
      } catch (err) {
        setMessage((err as Error).message);
      }
    };
    fetchOrder();
  }, [id]);

  const updateStatus = async () => {
    try {
      await apiPut(`/ecommerce/orders/${id}/status`, { status });
      setMessage('Status updated');
    } catch (err) {
      setMessage((err as Error).message);
    }
  };

  const confirmPayment = async () => {
    try {
      await apiPut(`/ecommerce/orders/${id}/confirm-payment`);
      setMessage('Payment confirmed');
    } catch (err) {
      setMessage((err as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title={`Order ${id}`} description="Order detail and actions" />
      {message && <div className="text-sm text-gray-700">{message}</div>}
      <FormSection title="Status">
        <div className="flex items-center gap-3">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border px-3 py-2">
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="packed">Packed</option>
            <option value="shipped">Shipped</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button className="rounded bg-blue-600 px-3 py-2 text-white" onClick={updateStatus}>
            Update Status
          </button>
          <button className="rounded border px-3 py-2" onClick={confirmPayment}>
            Confirm Payment
          </button>
        </div>
      </FormSection>
      <FormSection title="Order Items">
        {order?.order_items?.length ? (
          <ul className="list-disc space-y-1 pl-4 text-sm">
            {order.order_items.map((item: any) => (
              <li key={item.id}>
                {item.name} – {item.quantity} x ${item.price}
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-gray-600">No items</div>
        )}
      </FormSection>
    </div>
  );
}
