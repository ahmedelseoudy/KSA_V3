import type { NavItem } from './types';

export const HIDE_DELAY = 3000; // 3 seconds

export const NAV_ITEMS: NavItem[] = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: '📈',
    roles: ['user', 'admin', 'super_admin']
  },
  {
    path: '/products',
    label: 'Products Database',
    icon: '📦',
    roles: ['admin', 'super_admin']
  },
  {
    path: '/companies',
    label: 'Companies',
    icon: '🏢',
    roles: ['admin', 'super_admin']
  },
  {
    path: '/admin/invite',
    label: 'Invites',
    icon: '✉️',
    roles: ['super_admin']
  },
  {
    path: '/orders',
    label: 'Order Batches',
    icon: '📋',
    roles: ['admin', 'super_admin']
  },
  {
    path: '/availability',
    label: 'Availability',
    icon: '✅',
    roles: ['admin', 'super_admin']
  },
  {
    path: '/purchase-orders',
    label: 'Purchase Orders',
    icon: '📝',
    roles: ['admin', 'super_admin']
  },
  {
    path: '/comparison',
    label: 'Comparison',
    icon: '🔀',
    roles: ['admin', 'super_admin']
  },
  {
    path: '/deliveries',
    label: 'Deliveries',
    icon: '🚚',
    roles: ['admin', 'super_admin']
  },
  {
    path: '/analytics',
    label: 'Analytics',
    icon: '📊',
    roles: ['admin', 'super_admin']
  },
  {
    path: '/admin',
    label: 'Admin Panel',
    icon: '⚙️',
    roles: ['admin', 'super_admin']
  },
  {
    path: '/portal',
    label: 'My Dashboard',
    icon: '🏠',
    roles: ['company']
  },
  {
    path: '/portal/availability',
    label: 'Availability Requests',
    icon: '✅',
    roles: ['company']
  },
  {
    path: '/portal/purchase-orders',
    label: 'Purchase Orders',
    icon: '📝',
    roles: ['company']
  },
  {
    path: '/portal/deliveries',
    label: 'Deliveries',
    icon: '🚚',
    roles: ['company']
  }
];
