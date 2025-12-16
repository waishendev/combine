'use client';

import Sidebar from './Sidebar';
import HeaderBar from './HeaderBar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <HeaderBar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
