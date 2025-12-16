'use client';

import PageHeader from '@/components/ui/PageHeader';
import DailySalesChart from '@/components/charts/DailySalesChart';

const data = [
  { date: 'Mon', total: 1200 },
  { date: 'Tue', total: 1500 },
  { date: 'Wed', total: 980 },
  { date: 'Thu', total: 1760 },
  { date: 'Fri', total: 2200 },
];

export default function ReportsDailyPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Daily Sales" description="Recent daily sales totals" />
      <DailySalesChart data={data} />
    </div>
  );
}
