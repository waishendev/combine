'use client';

import { FormEvent, useState } from 'react';
import FormSection from '../ui/FormSection';

export default function NotificationTemplateForm({
  onSubmit,
}: {
  onSubmit?: (data: Record<string, string>) => Promise<void> | void;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [channel, setChannel] = useState('email');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      await onSubmit?.({ title, body, channel });
      setMessage('Saved successfully');
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormSection title="Notification Template">
        <div className="space-y-2">
          <label className="block text-sm font-medium">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded border px-3 py-2" required />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium">Channel</label>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className="w-full rounded border px-3 py-2">
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="push">Push</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium">Body</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full rounded border px-3 py-2"
            rows={4}
          />
        </div>
      </FormSection>
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Saving...' : 'Save Template'}
      </button>
      {message && <div className="text-sm text-gray-700">{message}</div>}
    </form>
  );
}
