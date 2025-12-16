'use client';

import LoyaltySettingsForm from '@/components/forms/LoyaltySettingsForm';
import PageHeader from '@/components/ui/PageHeader';

export default function LoyaltySettingsPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Loyalty Settings" description="Configure how customers earn points" />
      <LoyaltySettingsForm />
    </div>
  );
}
