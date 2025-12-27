'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

type SidebarProps = {
  collapsed: boolean
  permissions: string[]
  onToggleSidebar?: () => void
}

type MenuItem = {
  key: string
  label: string
  icon: string
  href?: string
  requiredPermission?: string
  children?: MenuChild[]
}

type MenuChild = {
  key: string
  label: string
  href: string
  requiredPermission?: string
}

export default function Sidebar({ collapsed, permissions, onToggleSidebar }: SidebarProps) {
  const pathname = usePathname()

  const menuItems: MenuItem[] = useMemo(
    () => [
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
      {
        key: 'orders',
        label: 'Orders',
        icon: 'fa-solid fa-bag-shopping',
        children: [
          {
            key: 'orders-all',
            label: 'All Orders',
            href: '/orders',
            requiredPermission: 'ecommerce.orders.view',
          },
          {
            key: 'orders-returns',
            label: 'Return Orders',
            href: '/returns',
            requiredPermission: 'ecommerce.returns.view',
          },
        ],
      },
    ],
    [],
  )

  const visibleItems = useMemo(() => {
    return menuItems
      .map((item) => {
        if (item.children) {
          const visibleChildren = item.children.filter(
            (child) => !child.requiredPermission || permissions.includes(child.requiredPermission),
          )
          if (visibleChildren.length === 0) {
            return null
          }
          return { ...item, children: visibleChildren }
        }
        if (item.requiredPermission && !permissions.includes(item.requiredPermission)) {
          return null
        }
        return item
      })
      .filter((item): item is MenuItem => Boolean(item))
  }, [menuItems, permissions])

  const matchesPath = (currentPath: string, href: string) =>
    currentPath === href || currentPath.startsWith(`${href}/`)

  const activeParentKeys = useMemo(() => {
    const keys = new Set<string>()
    visibleItems.forEach((item) => {
      if (!item.children) return
      if (item.children.some((child) => matchesPath(pathname, child.href))) {
        keys.add(item.key)
      }
    })
    return keys
  }, [visibleItems, pathname])

  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setOpenMenus((prev) => {
      const next = { ...prev }
      activeParentKeys.forEach((key) => {
        if (next[key] === undefined) {
          next[key] = true
        }
      })
      return next
    })
  }, [activeParentKeys])

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
              if (item.children) {
                const isExpanded = openMenus[item.key] ?? false
                const isChildActive = activeParentKeys.has(item.key)

                return (
                  <div key={item.key} className="space-y-1">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenMenus((prev) => ({
                          ...prev,
                          [item.key]: !(prev[item.key] ?? false),
                        }))
                      }
                      className={`flex w-full items-center rounded-lg px-3 py-2 transition-colors ${
                        isChildActive
                          ? 'bg-blue-50 text-blue-600'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      } ${collapsed ? 'justify-center' : ''}`}
                      title={collapsed ? item.label : undefined}
                    >
                      <i className={`${item.icon} text-lg`} />
                      {!collapsed && (
                        <>
                          <span className="ml-3 font-medium">{item.label}</span>
                          <i
                            className={`fa-solid fa-chevron-down ml-auto text-xs transition-transform ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                          />
                        </>
                      )}
                    </button>
                    {!collapsed && isExpanded && (
                      <div className="space-y-1 pl-9">
                        {item.children.map((child) => {
                          const isActive = matchesPath(pathname, child.href)
                          return (
                            <Link
                              key={child.key}
                              href={child.href}
                              className={`flex items-center rounded-lg px-3 py-2 text-sm transition-colors ${
                                isActive
                                  ? 'bg-blue-50 text-blue-600'
                                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                              }`}
                            >
                              <span className="font-medium">{child.label}</span>
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              }

              if (!item.href) {
                return null
              }

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
