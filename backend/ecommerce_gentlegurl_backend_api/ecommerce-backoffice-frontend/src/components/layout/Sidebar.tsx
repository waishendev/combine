'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { MENU_ITEMS, filterMenuByPermissions, MenuItem } from '@/lib/permissions';

function SidebarLink({ item }: { item: MenuItem }) {
  const pathname = usePathname();
  const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);

  return (
    <Link
      href={item.href}
      className={`block rounded px-3 py-2 text-sm transition hover:bg-gray-200 ${isActive ? 'bg-gray-200 font-semibold' : ''}`}
    >
      {item.label}
    </Link>
  );
}

export default function Sidebar() {
  const { adminUser } = useAuth();
  const items = useMemo(() => filterMenuByPermissions(MENU_ITEMS, adminUser?.permissions || []), [adminUser]);

  return (
    <aside className="w-64 border-r bg-white p-4 shadow-sm">
      <div className="mb-6 text-lg font-semibold">Ecommerce Admin</div>
      <nav className="space-y-2">
        {items.map((item) => (
          <div key={item.label}>
            <SidebarLink item={item} />
            {item.children && item.children.length > 0 && (
              <div className="ml-4 space-y-1 border-l pl-3">
                {item.children.map((child) => (
                  <SidebarLink key={child.label} item={child} />
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
}
