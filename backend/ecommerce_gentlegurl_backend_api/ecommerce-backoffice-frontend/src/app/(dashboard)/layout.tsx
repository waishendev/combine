'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/ui/PageHeader';
import { useAuth } from '@/components/auth/AuthProvider';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { adminUser, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !adminUser && pathname !== '/login') {
      router.replace('/login');
    }
  }, [adminUser, loading, pathname, router]);

  if (!adminUser) {
    return (
      <div className="flex min-h-screen items-center justify-center">{loading ? 'Loading profile...' : 'Redirecting...'}</div>
    );
  }

  return <AppShell>{children}</AppShell>;
}

export function PermissionDenied() {
  return (
    <div className="rounded border bg-white p-6 shadow-sm">
      <PageHeader title="Permission denied" description="You do not have access to this module." />
    </div>
  );
}
