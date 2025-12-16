'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { PermissionDenied } from '@/app/(dashboard)/layout';
import { useAuth } from '@/components/auth/AuthProvider';
import FormSection from '@/components/ui/FormSection';
import PageHeader from '@/components/ui/PageHeader';
import { apiGet, apiPut } from '@/lib/api-client';
import { LoyaltySetting, LoyaltySettingsResponse } from '@/lib/types';

const fallbackSetting: LoyaltySetting = {
  id: 1,
  base_multiplier: '1.00',
  expiry_months: 12,
  evaluation_cycle_months: 6,
  rules_effective_at: null,
  created_at: '',
  updated_at: '',
};

export default function SettingsPage() {
  const { adminUser } = useAuth();
  const canManage = useMemo(
    () =>
      (adminUser?.permissions || []).some((permission) =>
        ['ecommerce.loyalty.settings.create', 'ecommerce.loyalty.settings.update'].includes(permission),
      ),
    [adminUser?.permissions],
  );

  const [currentSetting, setCurrentSetting] = useState<LoyaltySetting | null>(null);
  const [history, setHistory] = useState<LoyaltySetting[]>([]);
  const [baseMultiplier, setBaseMultiplier] = useState('');
  const [expiryMonths, setExpiryMonths] = useState('');
  const [evaluationMonths, setEvaluationMonths] = useState('');
  const [rulesEffectiveAt, setRulesEffectiveAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiGet<LoyaltySettingsResponse>('/ecommerce/loyalty-settings');
        const setting = res.data.current || fallbackSetting;
        setCurrentSetting(setting);
        setHistory(
          (res.data.history || []).sort(
            (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
          ),
        );
        setBaseMultiplier(setting.base_multiplier);
        setExpiryMonths(setting.expiry_months.toString());
        setEvaluationMonths(setting.evaluation_cycle_months.toString());
        setRulesEffectiveAt(setting.rules_effective_at ? setting.rules_effective_at.slice(0, 10) : '');
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!currentSetting) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const payload = {
        base_multiplier: parseFloat(baseMultiplier),
        expiry_months: parseInt(expiryMonths, 10),
        evaluation_cycle_months: parseInt(evaluationMonths, 10),
        rules_effective_at: rulesEffectiveAt || null,
      };

      const res = await apiPut<LoyaltySetting>(`/ecommerce/loyalty-settings/${currentSetting.id}`, payload);
      setCurrentSetting(res.data);
      setHistory((prev) =>
        [res.data, ...prev]
          .filter((item, index, array) => array.findIndex((entry) => entry.id === item.id && entry.updated_at === item.updated_at) === index)
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
      );
      setMessage(res.message || 'Settings updated successfully.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) {
    return <PermissionDenied />;
  }

  const displaySetting = currentSetting || fallbackSetting;

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" description="Configure loyalty settings and effective rules" />
      {loading && <div className="text-sm text-gray-600">Loading settings...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      {message && <div className="text-sm text-green-700">{message}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <FormSection title="Current Rules">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Base Multiplier</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={baseMultiplier}
                onChange={(e) => setBaseMultiplier(e.target.value)}
                className="w-full rounded border px-3 py-2"
                required
              />
              <p className="text-xs text-gray-500">How many points are earned per currency unit.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Points Expiry (months)</label>
              <input
                type="number"
                min="1"
                value={expiryMonths}
                onChange={(e) => setExpiryMonths(e.target.value)}
                className="w-full rounded border px-3 py-2"
                required
              />
              <p className="text-xs text-gray-500">How long points remain valid.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Evaluation Cycle (months)</label>
              <input
                type="number"
                min="1"
                value={evaluationMonths}
                onChange={(e) => setEvaluationMonths(e.target.value)}
                className="w-full rounded border px-3 py-2"
                required
              />
              <p className="text-xs text-gray-500">Frequency for reviewing tier eligibility.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Rules Effective From</label>
              <input
                type="date"
                value={rulesEffectiveAt}
                onChange={(e) => setRulesEffectiveAt(e.target.value)}
                className="w-full rounded border px-3 py-2"
              />
              <p className="text-xs text-gray-500">Optional date for when changes should take effect.</p>
            </div>
          </div>
          <div className="flex items-center justify-between rounded border bg-gray-50 px-3 py-2 text-sm text-gray-700">
            <span>
              Last updated: {displaySetting.updated_at ? new Date(displaySetting.updated_at).toLocaleString() : 'Not set'}
            </span>
            <span>Current multiplier: {displaySetting.base_multiplier}</span>
          </div>
        </FormSection>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          {saving && <span className="text-sm text-gray-600">Updating settings...</span>}
        </div>
      </form>

      <FormSection title="Change History">
        {history.length === 0 ? (
          <div className="text-sm text-gray-600">No history available yet.</div>
        ) : (
          <div className="overflow-hidden rounded border">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left font-semibold">
                <tr>
                  <th className="px-4 py-2">Effective From</th>
                  <th className="px-4 py-2">Base Multiplier</th>
                  <th className="px-4 py-2">Expiry (months)</th>
                  <th className="px-4 py-2">Evaluation (months)</th>
                  <th className="px-4 py-2">Updated At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {history.map((entry) => (
                  <tr key={`${entry.id}-${entry.updated_at}`} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      {entry.rules_effective_at
                        ? new Date(entry.rules_effective_at).toLocaleDateString()
                        : 'Immediate'}
                    </td>
                    <td className="px-4 py-2">{entry.base_multiplier}</td>
                    <td className="px-4 py-2">{entry.expiry_months}</td>
                    <td className="px-4 py-2">{entry.evaluation_cycle_months}</td>
                    <td className="px-4 py-2">
                      {entry.updated_at ? new Date(entry.updated_at).toLocaleString() : 'Unknown'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </FormSection>
    </div>
  );
}
