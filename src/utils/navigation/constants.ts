import type { NavItem } from './types';

export const HIDE_DELAY = 3000; // 3 seconds

export const NAV_ITEMS: NavItem[] = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: 'home',
    roles: ['user', 'admin', 'super_admin'],
    group: 'Overview',
    accent: 'purple'
  },
  {
    path: '/products',
    label: 'Products',
    icon: 'cube',
    roles: ['admin', 'super_admin'],
    group: 'Catalog',
    accent: 'cyan'
  },
  {
    path: '/companies',
    label: 'Companies',
    icon: 'building',
    roles: ['admin', 'super_admin'],
    group: 'Catalog',
    accent: 'sky'
  },
  {
    path: '/orders',
    label: 'Order Batches',
    icon: 'clipboard',
    roles: ['admin', 'super_admin'],
    group: 'Order Workflow',
    accent: 'purple'
  },
  {
    path: '/availability',
    label: 'Availability',
    icon: 'check-circle',
    roles: ['admin', 'super_admin'],
    group: 'Order Workflow',
    accent: 'emerald'
  },
  {
    path: '/purchase-orders',
    label: 'Purchase Orders',
    icon: 'document',
    roles: ['admin', 'super_admin'],
    group: 'Order Workflow',
    accent: 'amber'
  },
  {
    path: '/deliveries',
    label: 'Deliveries',
    icon: 'truck',
    roles: ['admin', 'super_admin'],
    group: 'Order Workflow',
    accent: 'orange'
  },
  {
    path: '/comparison',
    label: 'Comparison',
    icon: 'scale',
    roles: ['admin', 'super_admin'],
    group: 'Insights',
    accent: 'fuchsia'
  },
  {
    path: '/analytics',
    label: 'Analytics',
    icon: 'chart',
    roles: ['admin', 'super_admin'],
    group: 'Insights',
    accent: 'fuchsia'
  },
  {
    path: '/admin',
    label: 'User Management',
    icon: 'users',
    roles: ['admin', 'super_admin'],
    group: 'Administration',
    accent: 'rose'
  },
  {
    path: '/admin/invite',
    label: 'Invites',
    icon: 'mail',
    roles: ['super_admin'],
    group: 'Administration',
    accent: 'rose'
  },
  {
    path: '/portal',
    label: 'My Dashboard',
    icon: 'home',
    roles: ['company'],
    group: 'Portal',
    accent: 'purple'
  },
  {
    path: '/portal/availability',
    label: 'Availability Requests',
    icon: 'check-circle',
    roles: ['company'],
    group: 'Portal',
    accent: 'emerald'
  },
  {
    path: '/portal/purchase-orders',
    label: 'Purchase Orders',
    icon: 'document',
    roles: ['company'],
    group: 'Portal',
    accent: 'amber'
  },
  {
    path: '/portal/deliveries',
    label: 'Deliveries',
    icon: 'truck',
    roles: ['company'],
    group: 'Portal',
    accent: 'orange'
  },
  {
    path: '/portal/comparison',
    label: 'Order Comparison',
    icon: 'scale',
    roles: ['company'],
    group: 'Portal',
    accent: 'fuchsia'
  }
];
