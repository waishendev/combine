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
  href?: string
  requiredPermission?: string
  children?: MenuChild[]
}

export default function Sidebar({ collapsed, permissions, onToggleSidebar }: SidebarProps) {
  const pathname = usePathname()

  const menuItems: MenuItem[] = useMemo(
    () => [
      // ======================
      // Overview
      // ======================
      {
        key: 'dashboard',
        label: 'Dashboard',
        icon: 'fa-solid fa-gauge',
        href: '/dashboard',
      },
        // ======================
      // Admin Management
      // ======================
      {
        key: 'admin-management',
        label: 'Admin Management',
        icon: 'fa-solid fa-user-shield',
        children: [
          {
            key: 'admins',
            label: 'Admins',
            href: '/admins',
          },
          {
            key: 'roles',
            label: 'Roles',
            href: '/roles',
            requiredPermission: 'roles.view',
          },
          // {
          //   key: 'permission-groups',
          //   label: 'Permission Groups',
          //   href: '/permission-groups',
          //   requiredPermission: 'permission-groups.view',
          // },
          // {
          //   key: 'permissions',
          //   label: 'Permissions',
          //   href: '/permission',
          //   requiredPermission: 'permissions.view',
          // },
        ],
      },
      // ======================
      // Sales
      // ======================
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
            key: 'orders-new',
            label: 'New Orders',
            href: '/orders/new',
            requiredPermission: 'ecommerce.orders.view',
          },
          {
            key: 'orders-completed',
            label: 'Completed Orders',
            href: '/orders/completed',
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
  
      // ======================
      // Catalog
      // ======================
      {
        key: 'catalog',
        label: 'Catalog',
        icon: 'fa-solid fa-boxes-stacked',
        children: [
          {
            key: 'shop-menu',
            label: 'Shop Menu',
            href: '/shop-menu',
            requiredPermission: 'ecommerce.shop-menu.view',
          },
          {
            key: 'categories',
            label: 'Categories',
            href: '/categories',
            requiredPermission: 'ecommerce.categories.view',
          },
          {
            key: 'product',
            label: 'Products',
            href: '/product',
            requiredPermission: 'ecommerce.products.view',
          },
          {
            key: 'store',
            label: 'Stores',
            href: '/store',
            requiredPermission: 'ecommerce.stores.view',
          },
        ],
      },
      
  
      // ======================
      // Customers & Loyalty
      // ======================
      {
        key: 'customers-loyalty',
        label: 'Customers & Loyalty',
        icon: 'fa-solid fa-users-gear',
        children: [
          {
            key: 'customers',
            label: 'Customers',
            href: '/customers',
            requiredPermission: 'customers.view',
          },
          {
            key: 'membership',
            label: 'Membership',
            href: '/membership',
            requiredPermission: 'ecommerce.loyalty.tiers.view',
          },
          {
            key: 'loyalty-settings',
            label: 'Loyalty Settings',
            href: '/loyalty-settings',
            requiredPermission: 'ecommerce.loyalty.settings.update',
          },
        ],
      },
      
  
      // ======================
      // Marketing
      // ======================
      {
        key: 'marketing',
        label: 'Marketing',
        icon: 'fa-solid fa-bullhorn',
        children: [
          {
            key: 'voucher',
            label: 'Vouchers',
            href: '/voucher',
            requiredPermission: 'ecommerce.vouchers.view',
          },
          {
            key: 'rewards',
            label: 'Rewards',
            children: [
              {
                key: 'rewards-vouchers',
                label: 'Redeem Vouchers',
                href: '/rewards/vouchers',
                requiredPermission: 'ecommerce.vouchers.view',
              },
              {
                key: 'rewards-products',
                label: 'Redeem Products',
                href: '/rewards/products',
                requiredPermission: 'ecommerce.products.view',
              },
            ],
          },
          {
            key: 'announcements',
            label: 'Announcements',
            href: '/announcements',
            requiredPermission: 'ecommerce.announcements.view',
          },
          {
            key: 'marquee',
            label: 'Marquee',
            href: '/marquee',
            requiredPermission: 'ecommerce.marquees.view',
          },
          {
            key: 'slides',
            label: 'Slides',
            href: '/slides',
            requiredPermission: 'ecommerce.sliders.view',
          },
        ],
      },
  
      // ======================
      // Reports
      // ======================
      {
        key: 'reports',
        label: 'Reports',
        icon: 'fa-solid fa-chart-line',
        children: [
          {
            key: 'sales-summary-daily',
            label: 'Sales Summary',
            href: '/reports/sales/daily',
            requiredPermission: 'ecommerce.reports.sales.view',
          },   {
            key: 'sales-by-category',
            label: 'Sales by Category',
            href: '/reports/sales/by-category',
            requiredPermission: 'ecommerce.reports.sales.view',
          },
          {
            key: 'sales-top-products',
            label: 'Top Products',
            href: '/reports/sales/top-products',
            requiredPermission: 'ecommerce.reports.sales.view',
          },
          {
            key: 'sales-top-customers',
            label: 'Top Customers',
            href: '/reports/sales/top-customers',
            requiredPermission: 'ecommerce.reports.sales.view',
          },
          // 以后可加：
          // sales-by-category
          // sales-top-products
          // sales-top-customers
          // orders-report
          // customers-report
          // loyalty-report
        ],
      },
  
      // ======================
      // Shop Settings
      // ======================
      {
        key: 'settings',
        label: 'Shop Settings',
        icon: 'fa-solid fa-gear',
        children: [
          {
            key: 'shop-settings',
            label: 'General Settings',
            href: '/general-settings',
            requiredPermission: 'ecommerce.settings.view',
          },
          {
            key: 'seo-settings',
            label: 'Global SEO',
            href: '/seo-settings',
            requiredPermission: 'ecommerce.seo.view',
          },
          {
            key: 'bank-accounts',
            label: 'Bank (Manual Transfer)',
            href: '/bank-accounts',
            requiredPermission: 'ecommerce.bank-accounts.view',
          },
        ],
      },
      // {
      //   key: 'shop-settings',
      //   icon: 'fa-solid fa-gear',
      //   label: 'Shop Settings',
      //   href: '/shop-settings',
      //   requiredPermission: 'ecommerce.settings.view',
      // },
    ],
    [],
  );

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
    const checkChild = (child: MenuChild, parentKey: string) => {
      if (child.href && matchesPath(pathname, child.href)) {
        keys.add(parentKey)
      }
      if (child.children) {
        child.children.forEach((subChild) => checkChild(subChild, parentKey))
      }
    }
    visibleItems.forEach((item) => {
      if (!item.children) return
      item.children.forEach((child) => checkChild(child, item.key))
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
                          if (child.children) {
                            const childKey = `${item.key}-${child.key}`
                            const isChildExpanded = openMenus[childKey] ?? false
                            const hasActiveChild = child.children.some(
                              (subChild) => subChild.href && matchesPath(pathname, subChild.href)
                            )
                            return (
                              <div key={child.key} className="space-y-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOpenMenus((prev) => ({
                                      ...prev,
                                      [childKey]: !(prev[childKey] ?? false),
                                    }))
                                  }
                                  className={`flex w-full items-center rounded-lg px-3 py-2 text-sm transition-colors ${
                                    hasActiveChild
                                      ? 'bg-blue-50 text-blue-600'
                                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                  }`}
                                >
                                  <span className="font-medium">{child.label}</span>
                                  <i
                                    className={`fa-solid fa-chevron-down ml-auto text-xs transition-transform ${
                                      isChildExpanded ? 'rotate-180' : ''
                                    }`}
                                  />
                                </button>
                                {isChildExpanded && (
                                  <div className="space-y-1 pl-6">
                                    {child.children.map((subChild) => {
                                      if (!subChild.href) return null
                                      const isActive = matchesPath(pathname, subChild.href)
                                      return (
                                        <Link
                                          key={subChild.key}
                                          href={subChild.href}
                                          className={`flex items-center rounded-lg px-3 py-2 text-sm transition-colors ${
                                            isActive
                                              ? 'bg-blue-50 text-blue-600'
                                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                          }`}
                                        >
                                          <span className="font-medium">{subChild.label}</span>
                                        </Link>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            )
                          }
                          if (!child.href) return null
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
