import type { NavItem } from './types';

export const HIDE_DELAY = 3000; // 3 seconds

export const NAV_ITEMS: NavItem[] = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: 'home',
    roles: ['user', 'admin', 'super_admin'],
    group: 'Overview'
  },
  {
    path: '/products',
    label: 'Products',
    icon: 'cube',
    roles: ['admin', 'super_admin'],
    group: 'Catalog'
  },
  {
    path: '/companies',
    label: 'Companies',
    icon: 'building',
    roles: ['admin', 'super_admin'],
    group: 'Catalog'
  },
  {
    path: '/orders',
    label: 'Order Batches',
    icon: 'clipboard',
    roles: ['admin', 'super_admin'],
    group: 'Order Workflow'
  },
  {
    path: '/availability',
    label: 'Availability',
    icon: 'check-circle',
    roles: ['admin', 'super_admin'],
    group: 'Order Workflow'
  },
  {
    path: '/purchase-orders',
    label: 'Purchase Orders',
    icon: 'document',
    roles: ['admin', 'super_admin'],
    group: 'Order Workflow'
  },
  {
    path: '/deliveries',
    label: 'Deliveries',
    icon: 'truck',
    roles: ['admin', 'super_admin'],
    group: 'Order Workflow'
  },
  {
    path: '/comparison',
    label: 'Comparison',
    icon: 'scale',
    roles: ['admin', 'super_admin'],
    group: 'Insights'
  },
  {
    path: '/analytics',
    label: 'Analytics',
    icon: 'chart',
    roles: ['admin', 'super_admin'],
    group: 'Insights'
  },
  {
    path: '/admin',
    label: 'User Management',
    icon: 'users',
    roles: ['admin', 'super_admin'],
    group: 'Administration'
  },
  {
    path: '/admin/invite',
    label: 'Invites',
    icon: 'mail',
    roles: ['super_admin'],
    group: 'Administration'
  },
  {
    path: '/portal',
    label: 'My Dashboard',
    icon: 'home',
    roles: ['company'],
    group: 'Portal'
  },
  {
    path: '/portal/availability',
    label: 'Availability Requests',
    icon: 'check-circle',
    roles: ['company'],
    group: 'Portal'
  },
  {
    path: '/portal/purchase-orders',
    label: 'Purchase Orders',
    icon: 'document',
    roles: ['company'],
    group: 'Portal'
  },
  {
    path: '/portal/deliveries',
    label: 'Deliveries',
    icon: 'truck',
    roles: ['company'],
    group: 'Portal'
  },
  {
    path: '/portal/comparison',
    label: 'Order Comparison',
    icon: 'scale',
    roles: ['company'],
    group: 'Portal'
  }
];
