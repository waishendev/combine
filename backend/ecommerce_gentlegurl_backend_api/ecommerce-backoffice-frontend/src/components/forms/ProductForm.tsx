'use client';

import { FormEvent, useState } from 'react';
import FormSection from '../ui/FormSection';

export default function ProductForm({ onSubmit }: { onSubmit?: (data: Record<string, string>) => Promise<void> | void }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [sku, setSku] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      await onSubmit?.({ name, price, sku });
      setMessage('Saved successfully');
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormSection title="Product Details">
        <div className="space-y-2">
          <label className="block text-sm font-medium">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border px-3 py-2"
            required
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium">SKU</label>
          <input value={sku} onChange={(e) => setSku(e.target.value)} className="w-full rounded border px-3 py-2" required />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium">Price</label>
          <input
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full rounded border px-3 py-2"
            required
          />
        </div>
      </FormSection>
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Saving...' : 'Save Product'}
      </button>
      {message && <div className="text-sm text-gray-700">{message}</div>}
    </form>
  );
}
