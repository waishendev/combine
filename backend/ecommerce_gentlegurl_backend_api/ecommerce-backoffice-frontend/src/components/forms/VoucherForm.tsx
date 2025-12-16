'use client';

import { FormEvent, useState } from 'react';
import FormSection from '../ui/FormSection';

export default function VoucherForm({ onSubmit }: { onSubmit?: (data: Record<string, string>) => Promise<void> | void }) {
  const [code, setCode] = useState('');
  const [discount, setDiscount] = useState('');
  const [type, setType] = useState('amount');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      await onSubmit?.({ code, discount, type });
      setMessage('Saved successfully');
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormSection title="Voucher">
        <div className="space-y-2">
          <label className="block text-sm font-medium">Code</label>
          <input value={code} onChange={(e) => setCode(e.target.value)} className="w-full rounded border px-3 py-2" required />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium">Discount</label>
          <input
            type="number"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            className="w-full rounded border px-3 py-2"
            required
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded border px-3 py-2">
            <option value="amount">Amount</option>
            <option value="percent">Percent</option>
          </select>
        </div>
      </FormSection>
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Saving...' : 'Save Voucher'}
      </button>
      {message && <div className="text-sm text-gray-700">{message}</div>}
    </form>
  );
}
