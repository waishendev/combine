'use client';

import { useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import FormSection from '@/components/ui/FormSection';

export default function SeoGlobalPage() {
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [keywords, setKeywords] = useState('');
  const [ogImage, setOgImage] = useState('');

  return (
    <div className="space-y-4">
      <PageHeader title="SEO Global" description="Manage global SEO metadata" />
      <FormSection title="Metadata">
        <div className="space-y-2">
          <label className="text-sm font-medium">Meta Title</label>
          <input className="w-full rounded border px-3 py-2" value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Meta Description</label>
          <textarea
            className="w-full rounded border px-3 py-2"
            rows={3}
            value={metaDescription}
            onChange={(e) => setMetaDescription(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Meta Keywords</label>
          <input className="w-full rounded border px-3 py-2" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">OG Image URL</label>
          <input className="w-full rounded border px-3 py-2" value={ogImage} onChange={(e) => setOgImage(e.target.value)} />
        </div>
      </FormSection>
    </div>
  );
}
