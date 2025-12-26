'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'


type SidebarProps = {
  collapsed: boolean
  permissions: string[]
  onToggleSidebar?: () => void
}

type MenuItem = {
  key: string
  label: string
  icon: string
  href: string
  requiredPermission?: string
}

export default function Sidebar({ collapsed, permissions, onToggleSidebar }: SidebarProps) {
  const pathname = usePathname()

  const menuItems: MenuItem[] = [
    {
      key: 'dashboard',
      label: 'Dashboard',
      icon: 'fa-solid fa-gauge',
      href: '/dashboard',
    },
    {
      key: 'admins',
      label: 'Admins',
      icon: 'fa-solid fa-user-shield',
      href: '/admins',
    },
    {
      key: 'permissions',
      label: 'Permissions',
      icon: 'fa-solid fa-user-tag',
      href: '/permission',
      requiredPermission: 'permissions.view',
    },
    {
      key: 'permission-groups',
      label: 'Permission Groups',
      icon: 'fa-solid fa-layer-group',
      href: '/permission-groups',
      requiredPermission: 'permission-groups.view',
    },
    {
      key: 'roles',
      label: 'Roles',
      icon: 'fa-solid fa-user-tag',
      href: '/roles',
      requiredPermission: 'roles.view',
    },
    {
      key: 'customers',
      label: 'Customers',
      icon: 'fa-solid fa-users',
      href: '/customers',
      requiredPermission: 'customers.view',
    },
    {
      key: 'shop-menu',
      label: 'SHOP MENU',
      icon: 'fa-solid fa-list',
      href: '/shop-menu',
      requiredPermission: 'ecommerce.shop-menu.view',
    },
    {
      key: 'categories',
      label: 'Categories',
      icon: 'fa-solid fa-list',
      href: '/categories',
      requiredPermission: 'ecommerce.categories.view',
    },
    {
      key: 'product',
      label: 'Product',
      icon: 'fa-solid fa-box',
      href: '/product',
      requiredPermission: 'ecommerce.products.view',
    },
    {
      key: 'store',
      label: 'Store',
      icon: 'fa-solid fa-store',
      href: '/store',
      requiredPermission: 'ecommerce.stores.view',
    },
    {
      key: 'shop-settings',
      label: 'Shop Settings',
      icon: 'fa-solid fa-gear',
      href: '/shop-settings',
      requiredPermission: 'ecommerce.settings.view',
    },
    {
      key: 'seo',
      label: 'SEO',
      icon: 'fa-solid fa-magnifying-glass-chart',
      href: '/seo',
      requiredPermission: 'ecommerce.seo.view',
    },
    {
      key: 'membership',
      label: 'Membership',
      icon: 'fa-solid fa-id-card',
      href: '/membership',
      requiredPermission: 'ecommerce.loyalty.tiers.view',
    },
    {
      key: 'announcements',
      label: 'Announcements',
      icon: 'fa-solid fa-id-card',
      href: '/announcements',
      requiredPermission: 'ecommerce.announcements.view',
    },
    {
      key: 'marquee',
      label: 'Marquee',
      icon: 'fa-solid fa-scroll',
      href: '/marquee',
      requiredPermission: 'ecommerce.marquees.view',
    },
    {
      key: 'voucher',
      label: 'Voucher',
      icon: 'fa-solid fa-ticket',
      href: '/voucher',
      requiredPermission: 'ecommerce.vouchers.view',
    },
    {
      key: 'loyalty-settings',
      label: 'Settings',
      icon: 'fa-solid fa-gear',
      href: '/settings',
      requiredPermission: 'ecommerce.loyalty.settings.update',
    },
    {
      key: 'slides',
      label: 'Slides',
      icon: 'fa-solid fa-images',
      href: '/slides',
      requiredPermission: 'ecommerce.sliders.view',
    },
  ]

  const visibleItems = menuItems.filter(
    (item) => !item.requiredPermission || permissions.includes(item.requiredPermission)
  )

  const matchesPath = (currentPath: string, href: string) =>
    currentPath === href || currentPath.startsWith(`${href}/`)

  return (
    <>
      {/* Mobile overlay backdrop */}
      {!collapsed && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onToggleSidebar}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed md:static top-16 left-0 h-[calc(100vh-4rem)] bg-white border-r border-slate-200 transition-all duration-300 ease-in-out flex flex-col shadow-sm z-50 ${
          collapsed
            ? 'w-20 -translate-x-full md:translate-x-0'
            : 'w-64 translate-x-0'
        }`}
      >
        <nav className="flex-1 overflow-y-auto px-3 py-6 text-sm text-slate-600">
          <div className="space-y-1">
            {visibleItems.map((item) => {
              const isActive = matchesPath(pathname, item.href)

              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`flex items-center rounded-lg px-3 py-2 transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  } ${collapsed ? 'justify-center' : ''}`}
                  title={collapsed ? item.label : undefined}
                >
                  <i className={`${item.icon} text-lg`} />
                  {!collapsed && <span className="ml-3 font-medium">{item.label}</span>}
                </Link>
              )
            })}
          </div>
        </nav>
      </aside>
    </>
  )
}
