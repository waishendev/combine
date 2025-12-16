'use client';

import PageHeader from '@/components/ui/PageHeader';
import CategorySalesChart from '@/components/charts/CategorySalesChart';

const data = [
  { category: 'Beverage', total: 18000 },
  { category: 'Snacks', total: 13200 },
  { category: 'Fresh', total: 8200 },
];

export default function ReportsByCategoryPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Sales by Category" description="Category level sales totals" />
      <CategorySalesChart data={data} />
    </div>
  );
}
