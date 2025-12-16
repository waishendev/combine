'use client';

import { useParams } from 'next/navigation';
import NotificationTemplateForm from '@/components/forms/NotificationTemplateForm';
import PageHeader from '@/components/ui/PageHeader';

export default function NotificationTemplateDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="space-y-4">
      <PageHeader title={`Template ${id}`} description="Edit notification template" />
      <NotificationTemplateForm />
    </div>
  );
}
