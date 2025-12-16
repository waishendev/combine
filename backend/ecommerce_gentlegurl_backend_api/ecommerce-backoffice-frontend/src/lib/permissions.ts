export type MenuItem = {
  label: string;
  href: string;
  icon?: string;
  requiredPermissions?: string[];
  children?: MenuItem[];
};

export const MENU_ITEMS: MenuItem[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Orders', href: '/dashboard/orders', requiredPermissions: ['ecommerce.orders.view'] },
  { label: 'Returns', href: '/dashboard/returns', requiredPermissions: ['ecommerce.returns.view'] },
  { label: 'Products', href: '/dashboard/products', requiredPermissions: ['ecommerce.products.view'] },
  { label: 'Categories', href: '/dashboard/categories', requiredPermissions: ['ecommerce.categories.view'] },
  { label: 'Shop Menu', href: '/dashboard/shop-menu', requiredPermissions: ['ecommerce.shop-menu.view'] },
  { label: 'Store Locations', href: '/dashboard/store-locations', requiredPermissions: ['ecommerce.stores.view'] },
  { label: 'Customers', href: '/dashboard/customers', requiredPermissions: ['ecommerce.customers.view'] },
  {
    label: 'Loyalty',
    href: '#',
    children: [
      { label: 'Settings', href: '/dashboard/loyalty/settings', requiredPermissions: ['ecommerce.loyalty.settings.view'] },
      { label: 'Tiers', href: '/dashboard/loyalty/tiers', requiredPermissions: ['ecommerce.loyalty.tiers'] },
      { label: 'Rewards', href: '/dashboard/loyalty/rewards', requiredPermissions: ['ecommerce.loyalty.rewards.view'] },
      { label: 'Redemptions', href: '/dashboard/loyalty/redemptions', requiredPermissions: ['ecommerce.loyalty.redemptions.view'] },
    ],
  },
  { label: 'Vouchers', href: '/dashboard/vouchers', requiredPermissions: ['ecommerce.vouchers.view'] },
  { label: 'SEO Global', href: '/dashboard/seo/global', requiredPermissions: ['ecommerce.seo.view'] },
  { label: 'Notifications', href: '/dashboard/notifications/templates', requiredPermissions: ['ecommerce.notifications.templates.view'] },
  {
    label: 'Reports',
    href: '#',
    children: [
      { label: 'Overview', href: '/dashboard/reports/overview', requiredPermissions: ['ecommerce.reports.sales.view'] },
      { label: 'Daily', href: '/dashboard/reports/daily', requiredPermissions: ['ecommerce.reports.sales.view'] },
      { label: 'By Category', href: '/dashboard/reports/by-category', requiredPermissions: ['ecommerce.reports.sales.view'] },
      { label: 'Top Products', href: '/dashboard/reports/top-products', requiredPermissions: ['ecommerce.reports.sales.view'] },
      { label: 'Top Customers', href: '/dashboard/reports/top-customers', requiredPermissions: ['ecommerce.reports.sales.view'] },
    ],
  },
  {
    label: 'Settings',
    href: '/dashboard/settings',
    requiredPermissions: ['ecommerce.loyalty.settings.update'],
  },
];

export function filterMenuByPermissions(menu: MenuItem[], permissions: string[]): MenuItem[] {
  return menu
    .filter((item) =>
      item.requiredPermissions?.length ? item.requiredPermissions.every((p) => permissions.includes(p)) : true,
    )
    .map((item) =>
      item.children
        ? {
            ...item,
            children: filterMenuByPermissions(item.children, permissions),
          }
        : item,
    )
    .filter((item) => item.href !== '#' || (item.children && item.children.length > 0));
}
