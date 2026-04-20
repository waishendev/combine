'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { getWorkspace, type Workspace } from '@/lib/workspace'

type SidebarProps = {
  collapsed: boolean
  overlayMode: boolean
  permissions: string[]
  staffId?: number | null
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

export default function Sidebar({ collapsed, overlayMode, permissions, staffId, onToggleSidebar }: SidebarProps) {
  const pathname = usePathname()
  const [workspace, setWorkspaceState] = useState<Workspace>(() => getWorkspace())

  useEffect(() => {
    const handleWorkspaceChanged = () => setWorkspaceState(getWorkspace())
    window.addEventListener('crm_workspace_changed', handleWorkspaceChanged)

    return () => window.removeEventListener('crm_workspace_changed', handleWorkspaceChanged)
  }, [])

  const ecommerceMenuItems: MenuItem[] = useMemo(
    () => [
      // ======================
      // Overview
      // ======================
      // {
      //   key: 'dashboard',
      //   label: 'Dashboard',
      //   icon: 'fa-solid fa-gauge',
      //   href: '/dashboard',
      // },
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
            requiredPermission: 'users.view'
          },
          {
            key: 'roles',
            label: 'Roles',
            href: '/roles',
            requiredPermission: 'roles.view',
          },
          {
            key: 'permission-groups',
            label: 'Permission Groups',
            href: '/permission-groups',
            requiredPermission: 'permission-groups.view',
          },
          {
            key: 'permissions',
            label: 'Permissions',
            href: '/permission',
            requiredPermission: 'permissions.view',
          },
          {
            key: 'staffs',
            label: 'Staffs',
            href: '/staffs',
            requiredPermission: 'staff.view',
          },
          {
            key: 'ecommerce-commission-tiers',
            label: 'Product Commission Tiers',
            href: '/ecommerce/commission-tiers',
            requiredPermission: 'ecommerce.reports.sales.view',
          },
        ],
      },
      // ======================
      // Sales
      // ======================
      {
        key: 'online-orders',
        label: 'Online Orders',
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
            key: 'services-menu',
            label: 'Services Menu',
            href: '/services-menu',
            requiredPermission: 'ecommerce.services-menu.view',
          },
          {
            key: 'services-pages',
            label: 'Services Pages',
            href: '/services-pages',
            requiredPermission: 'ecommerce.services-pages.view',
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
            key: 'customer-types',
            label: 'Customer Types',
            href: '/customer-types',
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
            key: 'promotions',
            label: 'Promotions',
            href: '/promotions',
            requiredPermission: 'ecommerce.promotions.view',
          },
          // {
          //   key: 'voucher-assign-logs',
          //   label: 'Voucher Assign Logs',
          //   href: '/vouchers/assign-logs',
          //   requiredPermission: 'ecommerce.vouchers.assign.logs.view',
          // },
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

          // {
          //   key: 'sales-customers-ecommerce',
          //   label: 'Ecommerce Customer Sales',
          //   href: '/reports/sales/customers-ecommerce',
          //   requiredPermission: 'ecommerce.reports.sales.view',
          // },
          // {
          //   key: 'sales-customers-booking',
          //   label: 'Booking Customer Sales',
          //   href: '/reports/sales/customers-booking',
          //   requiredPermission: 'ecommerce.reports.sales.view',
          // },
          // {
          //   key: 'sales-ecommerce',
          //   label: 'Ecommerce Sales',
          //   href: '/reports/sales/ecommerce',
          //   requiredPermission: 'ecommerce.reports.sales.view',
          // },
          // {
          //   key: 'sales-booking',
          //   label: 'Booking Sales',
          //   href: '/reports/sales/booking',
          //   requiredPermission: 'ecommerce.reports.sales.view',
          // },
          
          // {
          //   key: 'sales-daily',
          //   label: 'Daily Sales',
          //   href: '/reports/sales/daily',
          //   requiredPermission: 'ecommerce.reports.sales.view',
          // },
          // {
          //   key: 'sales-by-category',
          //   label: 'Category Sales',
          //   href: '/reports/sales/by-category',
          //   requiredPermission: 'ecommerce.reports.sales.view',
          // },
          // {
          //   key: 'sales-by-product',
          //   label: 'Product Sales',
          //   href: '/reports/sales/by-product',
          //   requiredPermission: 'ecommerce.reports.sales.view',
          // },
          // {
          //   key: 'sales-by-customer',
          //   label: 'Customer Sales',
          //   href: '/reports/sales/by-customer',
          //   requiredPermission: 'ecommerce.reports.sales.view',
          // },
         
          // {
          //   key: 'staff-commission',
          //   label: 'Staff Commission',
          //   href: '/reports/staff-commission',
          //   requiredPermission: 'ecommerce.reports.sales.view',
          // },
          {
            key: 'staff-commission',
            label: 'Staff Product Commissions',
            href: '/ecommerce/commissions',
            requiredPermission: 'ecommerce.reports.sales.view',
          },
          {
            key: 'my-pos-summary',
            label: 'My POS Summary',
            href: '/reports/my-pos-summary',
            requiredPermission: 'reports.my-pos-summary.view',
          },
          {
            key: 'pos-summary',
            label: 'POS Summary Report',
            href: '/reports/pos-summary',
            requiredPermission: 'reports.pos-summary.view',
          },
        ],
      },
      // {
      //   key: 'daily-reports',
      //   label: 'Daily Reports',
      //   icon: 'fa-solid fa-chart-line',
      //   children: [
      
      //         {
      //           key: 'sales-daily-customers-ecommerce',
      //           label: 'Ecommerce Customer Sales',
      //           href: '/reports/sales/daily/customers-ecommerce',
      //           requiredPermission: 'ecommerce.reports.sales.view',
      //         },
      //         {
      //           key: 'sales-daily-customers-booking',
      //           label: 'Booking Customer Sales',
      //           href: '/reports/sales/daily/customers-booking',
      //           requiredPermission: 'ecommerce.reports.sales.view',
      //         },
      //         {
      //           key: 'sales-daily-ecommerce',
      //           label: 'Ecommerce Sales',
      //           href: '/reports/sales/daily/ecommerce',
      //           requiredPermission: 'ecommerce.reports.sales.view',
      //         },
      //         {
      //           key: 'sales-daily-booking',
      //           label: 'Booking Sales',
      //           href: '/reports/sales/daily/booking',
      //           requiredPermission: 'ecommerce.reports.sales.view',
      //         },

      //   ],
      // },

      {
        key: 'logs',
        label: 'Logs',
        icon: 'fa-solid fa-clipboard-list',
        children: [
          {
            key: 'product-stock-movements',
            label: 'Stock Movements Logs',
            href: '/products/stock-movements',
            requiredPermission: 'ecommerce.products.view',
          },
          {
            key: 'ecommerce-commission-logs',
            label: 'Commission Logs',
            href: '/booking/commissions/logs',
            requiredPermission: 'ecommerce.reports.sales.view',
          },
        ],
      },


       // ======================
      // Payment Gateway
      // ======================
      {
        key: 'payment-gateway',
        label: 'Payment Gateway',
        icon: 'fa-solid fa-credit-card',
        children: [
          {
            key: 'payment-gateways',
            label: 'Payment Gateway',
            href: '/payment-gateways',
            requiredPermission: 'ecommerce.payment-gateways.view',
          },
          {
            key: 'bank-accounts',
            label: 'Bank (Manual Transfer)',
            href: '/bank-accounts',
            requiredPermission: 'ecommerce.bank-accounts.view',
          },
          {
            key: 'billplz-payment-options',
            label: 'Billplz Payment Options',
            href: '/billplz-payment-options',
            requiredPermission: 'ecommerce.payment-gateways.view',
          },
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
            key: 'shop-logo',
            label: 'Upload Logo',
            href: '/shop-logo',
            requiredPermission: 'ecommerce.settings.view',
          },

        ],
      },
      // ======================
      // Settings
      // ======================
      {
        key: 'crm-settings',
        label: 'Settings',
        icon: 'fa-solid fa-sliders',
        children: [
          {
            key: 'crm-logo',
            label: 'Upload Logo (CRM)',
            href: '/crm-logo',
            requiredPermission: 'ecommerce.settings.view',
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

  const bookingMenuItems: MenuItem[] = useMemo(
    () => [
      // {
      //   key: 'booking-dashboard',
      //   label: 'Booking Dashboard',
      //   icon: 'fa-solid fa-calendar-days',
      //   href: '/booking/reports',
      // },
      {
        key: 'booking-management',
        label: 'Booking',
        icon: 'fa-solid fa-calendar-check',
        children: [
          // {
          //   key: 'booking-appointments',
          //   label: 'Appointments',
          //   href: '/booking/appointments',
          //   requiredPermission: 'booking.appointments.view',
          // },
          // {
          //   key: 'booking-cancellation-requests',
          //   label: 'Cancellation Requests',
          //   href: '/booking/cancellation-requests',
          //   requiredPermission: 'booking.appointments.view',
          // },
          {
            key: 'booking-services',
            label: 'Services',
            href: '/booking/services',
            requiredPermission: 'booking.services.view',
          },
          {
            key: 'booking-categories',
            label: 'Categories',
            href: '/booking/categories',
            requiredPermission: 'booking.services.view',
          },
          {
            key: 'booking-service-packages',
            label: 'Service Packages',
            href: '/booking/service-packages',
            requiredPermission: 'service-packages.view',
          },
          {
            key: 'booking-schedules',
            label: 'Staff Schedules',
            href: '/booking/staff-schedules',
            requiredPermission: 'booking.schedules.view',
          },
          // {
          //   key: 'booking-blocks',
          //   label: 'Blocks',
          //   href: '/booking/blocks',
          //   requiredPermission: 'booking.blocks.view',
          // },
          {
            key: 'booking-commission-tiers',
            label: 'Booking Commission Tiers',
            href: '/booking/commission-tiers',
          },
          {
            key: 'booking-customer-service-packages',
            label: 'Customer Packages',
            href: '/booking/customer-service-packages',
            requiredPermission: 'customer-service-packages.view',
          },
        ],
      },
      ...(staffId
        ? ([
            {
              key: 'booking-my-leave',
              label: 'My Leave',
              icon: 'fa-solid fa-calendar-minus',
              href: '/booking/my-leave',
            },
          ] as const)
        : []),

      {
        key: 'staff-leave-management',
        label: 'Staff Leave Management',
        icon: 'fa-solid fa-user-clock',
        children: [
          {
            key: 'booking-leave-requests',
            label: 'Leave Requests',
            href: '/booking/leave-requests',
            requiredPermission: 'booking.schedules.view',
          },
          {
            key: 'booking-leave-balances',
            label: 'Leave Balances',
            href: '/booking/leave-balances',
            requiredPermission: 'booking.schedules.view',
          },
          {
            key: 'booking-leave-calendar',
            label: 'Leave Calendar',
            href: '/booking/leave-calendar',
            requiredPermission: 'booking.schedules.view',
          },
          {
            key: 'booking-leave-logs',
            label: 'Leave Logs',
            href: '/booking/leave-logs',
            requiredPermission: 'booking.leave.logs.view',
          }
        ],
      },
      {
        key: 'marketing',
        label: 'Marketing',
        icon: 'fa-solid fa-bullhorn',
        children: [
          {
            key: 'booking-announcements',
            label: 'Announcements',
            href: '/booking/announcements',
            requiredPermission: 'booking.settings.view',
          },
          {
            key: 'booking-marquee',
            label: 'Marquee',
            href: '/booking/marquee',
            requiredPermission: 'booking.settings.view',
          },
        ],
      },









      {
        key: 'booking-landing-page',
        label: 'Landing Page',
        icon: 'fa-solid fa-palette',
        href: '/booking/landing-page',
        requiredPermission: 'booking.landing-page.view',
      },
      {
        key: 'logs',
        label: 'Logs',
        icon: 'fa-solid fa-clipboard-list',
        children: [
          {
            key: 'booking-logs',
            label: 'Booking Audit Logs',
            icon: 'fa-solid fa-clipboard-list',
            href: '/booking/logs',
            requiredPermission: 'booking.logs.view',
          },
          {
            key: 'booking-commission-logs',
            label: 'Commission Logs',
            href: '/booking/commissions/logs',
          },
        ],
      },
      {
        key: 'booking-payment-gateway',
        label: 'Payment Gateway',
        icon: 'fa-solid fa-credit-card',
        children: [
          {
            key: 'booking-payment-gateways',
            label: 'Payment Gateway',
            href: '/payment-gateways',
            requiredPermission: 'booking.payment-gateways.view',
          },
          {
            key: 'booking-bank-accounts',
            label: 'Bank (Manual Transfer)',
            href: '/bank-accounts',
            requiredPermission: 'booking.bank-accounts.view',
          },
        ],
      },
      {
        key: 'reports',
        label: 'Reports',
        icon: 'fa-solid fa-chart-line',
        children: [
          {
            key: 'booking-commissions',
            label: 'Staff Booking Commissions',
            href: '/booking/commissions',
          },
          {
            key: 'booking-reports',
            label: 'Daily Deposit Reports',
            href: '/booking/reports',
            requiredPermission: 'booking.reports.view',
          },
        ],
      },





      {
        key: 'settings',
        label: 'Shop Settings',
        icon: 'fa-solid fa-gear',
        children: [
          {
            key: 'shop-settings',
            label: 'General Settings',
            href: '/booking/general-settings',
            requiredPermission: 'booking.settings.view',
          },
          {
            key: 'seo-settings',
            label: 'Global SEO',
            href: '/booking/seo-settings',
            requiredPermission: 'booking.seo.view',
          },
          {
            key: 'shop-logo',
            label: 'Upload Logo',
            href: '/booking/shop-logo',
            requiredPermission: 'booking.settings.view',
          },
        ],
      },
    ],
    [],
  )

  const menuItems = useMemo(
    () => (workspace === 'booking' ? bookingMenuItems : ecommerceMenuItems),
    [bookingMenuItems, ecommerceMenuItems, workspace],
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
      if (pathname.startsWith('/reports/sales/daily')) {
        next['reports-sales-daily-group'] = true
      }
      return next
    })
  }, [activeParentKeys, pathname])

  return (
    <>
      {/* Mobile overlay backdrop */}
      {!collapsed && overlayMode && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={onToggleSidebar}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed top-16 left-0 h-[calc(100vh-4rem)] bg-white border-r border-slate-200 transition-all duration-300 ease-in-out flex flex-col shadow-sm z-50 ${
          overlayMode
            ? collapsed
              ? 'w-20 -translate-x-full'
              : 'w-64 translate-x-0'
            : collapsed
              ? 'w-20 -translate-x-full lg:translate-x-0 lg:static'
              : 'w-64 translate-x-0 lg:static'
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
