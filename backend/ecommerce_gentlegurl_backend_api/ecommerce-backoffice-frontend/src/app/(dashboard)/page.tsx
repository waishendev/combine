'use client';

import PageHeader from '@/components/ui/PageHeader';
import SalesOverviewChart from '@/components/charts/SalesOverviewChart';
import DailySalesChart from '@/components/charts/DailySalesChart';
import CategorySalesChart from '@/components/charts/CategorySalesChart';
import { DashboardMetric } from '@/lib/types';

const metrics: DashboardMetric[] = [
  { label: 'Today Orders', value: 42, helper: 'including 5 paid' },
  { label: 'Pending Payments', value: 7 },
  { label: 'Customers', value: 1320 },
  { label: 'Active Vouchers', value: 8 },
];

const overviewData = [
  { label: 'Revenue (30d)', value: 48000 },
  { label: 'Orders (30d)', value: 1210 },
  { label: 'Avg. Order Value', value: 75 },
];

const dailyData = [
  { date: 'Mon', total: 1200 },
  { date: 'Tue', total: 1820 },
  { date: 'Wed', total: 980 },
  { date: 'Thu', total: 2100 },
  { date: 'Fri', total: 1730 },
];

const categoryData = [
  { category: 'Beverage', total: 12000 },
  { category: 'Snacks', total: 8200 },
  { category: 'Fresh', total: 9800 },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Overview of ecommerce performance" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded border bg-white p-4 shadow-sm">
            <div className="text-sm text-gray-500">{metric.label}</div>
            <div className="text-2xl font-semibold">{metric.value}</div>
            {metric.helper && <div className="text-xs text-gray-500">{metric.helper}</div>}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SalesOverviewChart data={overviewData} />
        <DailySalesChart data={dailyData} />
      </div>
      <CategorySalesChart data={categoryData} />
    </div>
  );
}
