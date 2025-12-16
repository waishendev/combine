'use client';

import { FormEvent, useState } from 'react';
import FormSection from '../ui/FormSection';

export default function LoyaltySettingsForm({
  onSubmit,
}: {
  onSubmit?: (data: Record<string, string>) => Promise<void> | void;
}) {
  const [earnRate, setEarnRate] = useState('1');
  const [expiry, setExpiry] = useState('12');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      await onSubmit?.({ earnRate, expiry });
      setMessage('Saved successfully');
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormSection title="Loyalty Settings">
        <div className="space-y-2">
          <label className="block text-sm font-medium">Earn Rate (points per currency unit)</label>
          <input
            type="number"
            value={earnRate}
            onChange={(e) => setEarnRate(e.target.value)}
            className="w-full rounded border px-3 py-2"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium">Points Expiry (months)</label>
          <input
            type="number"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            className="w-full rounded border px-3 py-2"
          />
        </div>
      </FormSection>
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Saving...' : 'Save Settings'}
      </button>
      {message && <div className="text-sm text-gray-700">{message}</div>}
    </form>
  );
}
