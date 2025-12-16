'use client';

import { useAuth } from '@/components/auth/AuthProvider';

export default function HeaderBar() {
  const { adminUser, logout } = useAuth();

  return (
    <header className="flex items-center justify-between border-b bg-white px-6 py-3 shadow-sm">
      <div>
        <p className="text-sm text-gray-500">Backoffice</p>
        <p className="text-lg font-semibold">CRM Console</p>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <div className="text-right">
          <div className="font-medium">{adminUser?.name || 'Guest'}</div>
          <div className="text-gray-500">{adminUser?.email || 'Not signed in'}</div>
        </div>
        {adminUser && (
          <button
            onClick={logout}
            className="rounded border border-gray-300 px-3 py-1 text-sm font-medium hover:bg-gray-100"
          >
            Logout
          </button>
        )}
      </div>
    </header>
  );
}
