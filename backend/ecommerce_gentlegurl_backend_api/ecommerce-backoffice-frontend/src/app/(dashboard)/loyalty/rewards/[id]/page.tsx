'use client';

import { useParams } from 'next/navigation';
import LoyaltyRewardForm from '@/components/forms/LoyaltyRewardForm';
import PageHeader from '@/components/ui/PageHeader';

export default function LoyaltyRewardDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="space-y-4">
      <PageHeader title={`Reward ${id}`} description="Edit loyalty reward" />
      <LoyaltyRewardForm />
    </div>
  );
}
