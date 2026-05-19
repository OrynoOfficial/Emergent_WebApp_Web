/**
 * Sidebar menu configuration hook.
 * Extracts the massive menu building logic from Layout.jsx.
 */
import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionsContext';
import {
  LayoutDashboard, ShoppingBag, Ticket, Receipt, Settings, Users,
  BarChart, Star, HelpCircle, Bus, Hotel, Car, Utensils, Package, Gift,
  Calendar, Sparkles, Bell, Award, TrendingUp, ShieldCheck, History,
  Percent, HeadphonesIcon, Film, Briefcase, FileText,
  QrCode, MapPin, Globe, Building2, PartyPopper, CreditCard, UserPlus,
  Monitor, BarChart3, Megaphone
} from 'lucide-react';

const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  OPERATOR: 'operator',
  CUSTOMER: 'customer'
};

export const ICON_COLORS = {
  dashboard: '#4D96FF', services: '#00C853', browse: '#00C853',
  hotels: '#EC4899', restaurants: '#F59E0B', travel: '#3B82F6',
  'car-rental': '#10B981', events: '#F97316', packages: '#EF4444',
  shipments: '#EF4444',
  laundry: '#A855F7', cinema: '#06B6D4', banquet: '#14B8A6',
  orders: '#9575CD', receipts: '#2962FF', loyalty: '#AB47BC',
  management: '#7E57C2', analytics: '#4D96FF', bookings: '#FF7043',
  transactions: '#7C3AED', 'all-orders': '#9575CD', 'all-receipts': '#2962FF', 'all-bookings': '#FF7043', 'all-bills': '#2962FF',
  revenue: '#22C55E',
  users: '#757575', operators: '#64748b', employees: '#757575',
  commission: '#22C55E', 'audit-logs': '#F59E0B', permissions: '#EF4444',
  'access-groups': '#7E57C2', ratings: '#FBBF24', support: '#22C55E',
  settings: '#64748b', 'customer-service': '#06B6D4',
  'booking-analytics': '#EC4899', reporting: '#3B82F6',
  'trip-report': '#FF7043', 'data-analytics': '#7E57C2',
  validation: '#F59E0B', bills: '#2962FF', sales: '#22C55E',
  system: '#6366F1', 'sys-config': '#64748b', reports: '#3B82F6'
};

export default function useSidebarMenu() {
  const { user, operatorContext, isOperatorUser, operatorServiceTypes, operatorType } = useAuth();
  const { hasPermission, hasAnyPermission, isSuperAdmin: isSuperAdminPerm } = usePermissions();

  const userRole = user?.role || USER_ROLES.CUSTOMER;
  const isSuperAdmin = userRole === USER_ROLES.SUPER_ADMIN || isSuperAdminPerm;
  const isAdmin = userRole === USER_ROLES.ADMIN || isSuperAdmin;
  const isOperator = userRole === USER_ROLES.OPERATOR;

  const canManageHotels = hasAnyPermission(['hotels.view', 'hotels.create', 'hotels.edit', 'hotels.manage_rooms']);
  const canManageTravel = hasAnyPermission(['travel.view', 'travel.create', 'travel.edit', 'travel.manage_routes']);
  const canManageCars = hasAnyPermission(['car_rental.view', 'car_rental.create', 'car_rental.edit']);
  const canManageEvents = hasAnyPermission(['events.view', 'events.create', 'events.edit']);
  const canManageRestaurants = hasAnyPermission(['restaurants.view', 'restaurants.create', 'restaurants.edit']);
  const canManageBanquets = hasAnyPermission(['banquets.view', 'banquets.create', 'banquets.edit']);
  const canManageCinema = hasAnyPermission(['cinema.view', 'cinema.create', 'cinema.edit']);
  const canManagePressing = hasAnyPermission(['pressing.view', 'pressing.create', 'pressing.edit']);
  const canManagePackages = hasAnyPermission(['packages.view', 'packages.create', 'packages.edit']);
  const canViewAnalytics = hasAnyPermission(['analytics.view', 'analytics.view_dashboard']);
  const canViewUsers = hasPermission('users.view');
  const canViewOperators = hasPermission('operators.view');
  const canViewEmployees = hasPermission('employees.view');
  const canViewCommission = hasPermission('commission.view');
  const canViewValidation = hasPermission('validation.view');
  const canViewActivity = hasPermission('activity.view');
  const canViewPermissions = hasPermission('access.view_roles');
  const canManage = isSuperAdmin || canManageHotels || canManageTravel || canManageCars ||
    canManageEvents || canManageRestaurants || canManageBanquets ||
    canManageCinema || canManagePressing || canManagePackages;

  const navigationItems = useMemo(() => {
    const isCustomer = userRole === USER_ROLES.CUSTOMER || (!userRole && !isOperatorUser && !isSuperAdmin);
    const isAdminOrSuper = isSuperAdmin || userRole === USER_ROLES.ADMIN;

    const canOperatorAccessService = (serviceType) => {
      if (isAdminOrSuper) return true;
      if (isOperatorUser) {
        // Normalize service type names for matching (handle legacy plural/singular mismatches)
        const normalize = (types) => {
          const map = { hotels: 'hotel', restaurants: 'restaurant', event: 'events' };
          return types.map(t => map[t] || t);
        };
        const normalizedTypes = normalize(operatorServiceTypes);
        if (normalizedTypes.length > 0) return normalizedTypes.includes(serviceType);
        if (operatorType) {
          const normalizedOp = { hotels: 'hotel', restaurants: 'restaurant', event: 'events' }[operatorType] || operatorType;
          return normalizedOp === serviceType;
        }
        return false;
      }
      return true;
    };

    const items = [];

    // ==================== CUSTOMER NAVIGATION ====================
    if (isCustomer) {
      items.push({ key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' });
      const allServices = [
        { key: 'browse', label: 'Browse Services', path: '/services', icon: ShoppingBag, serviceType: null },
        { key: 'hotels', label: 'Hotels', path: '/services/hotels', icon: Hotel, serviceType: 'hotel' },
        { key: 'restaurants', label: 'Restaurants', path: '/services/restaurants', icon: Utensils, serviceType: 'restaurant' },
        { key: 'travel', label: 'Travel', path: '/services/travel', icon: Bus, serviceType: 'travel' },
        { key: 'car-rental', label: 'Car Rental', path: '/services/car-rental', icon: Car, serviceType: 'car_rental' },
        { key: 'events', label: 'Events', path: '/services/events', icon: Calendar, serviceType: 'events' },
        { key: 'packages', label: 'Packages', path: '/services/packages', icon: Package, serviceType: 'package' },
        { key: 'laundry', label: 'Laundry', path: '/services/laundry', icon: Sparkles, serviceType: 'laundry' },
        { key: 'cinema', label: 'Cinema', path: '/services/cinema', icon: Film, serviceType: 'cinema' },
        { key: 'banquet', label: 'Banquet', path: '/services/banquet', icon: Gift, serviceType: 'banquet' },
      ];
      items.push({ key: 'services', label: 'Services', icon: ShoppingBag, isDropdown: true, submenu: allServices });
      items.push({ key: 'orders', label: 'My Orders', icon: Ticket, path: '/orders' });
      items.push({ key: 'receipts', label: 'Receipts', icon: Receipt, path: '/receipts' });
      items.push({ key: 'loyalty', label: 'Loyalty', icon: Award, path: '/loyalty' });
      items.push({ key: 'ratings', label: 'My Ratings', icon: Star, path: '/ratings' });
      items.push({ key: 'support', label: 'Support', icon: HelpCircle, path: '/support' });
      items.push({ key: 'settings', label: 'Settings', icon: Settings, path: '/settings' });
      return items;
    }

    // ==================== NON-CUSTOMER (OPERATOR/ADMIN/SUPER) ====================
    // Dashboards submenu for admin/super admin
    if (isAdminOrSuper) {
      items.push({
        key: 'dashboards', label: 'Dashboards', icon: LayoutDashboard, isDropdown: true,
        submenu: [
          { key: 'analytics-dash', label: 'Analytics Dashboard', path: '/admin/analytics', icon: BarChart },
          ...(isSuperAdmin ? [{ key: 'admin-dash', label: 'Admin Dashboard', path: '/admin/admin-dashboard', icon: LayoutDashboard }] : []),
        ]
      });
    } else {
      items.push({ key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/admin/analytics' });
    }

    // Sales (Operator + Super Admin)
    if (isSuperAdmin || isOperator) {
      items.push({ key: 'revenue', label: 'Revenue', icon: TrendingUp, path: '/admin/sales' });
    }

    // Services
    const serviceItems = [
      { key: 'browse', label: 'Browse Services', path: '/services', icon: ShoppingBag, serviceType: null },
      { key: 'hotels', label: 'Hotels', path: '/services/hotels', icon: Hotel, serviceType: 'hotel' },
      { key: 'restaurants', label: 'Restaurants', path: '/services/restaurants', icon: Utensils, serviceType: 'restaurant' },
      { key: 'travel', label: 'Travel', path: '/services/travel', icon: Bus, serviceType: 'travel' },
      { key: 'car-rental', label: 'Car Rental', path: '/services/car-rental', icon: Car, serviceType: 'car_rental' },
      { key: 'events', label: 'Events', path: '/services/events', icon: Calendar, serviceType: 'events' },
      { key: 'packages', label: 'Packages', path: '/services/packages', icon: Package, serviceType: 'package' },
      { key: 'laundry', label: 'Laundry', path: '/services/laundry', icon: Sparkles, serviceType: 'laundry' },
      { key: 'cinema', label: 'Cinema', path: '/services/cinema', icon: Film, serviceType: 'cinema' },
      { key: 'banquet', label: 'Banquet', path: '/services/banquet', icon: Gift, serviceType: 'banquet' },
    ].filter(s => !s.serviceType || canOperatorAccessService(s.serviceType));
    items.push({ key: 'services', label: 'Services', icon: ShoppingBag, isDropdown: true, submenu: serviceItems });

    // Service Management
    if (canManage) {
      const allManagementItems = [
        { key: 'hotels-mgmt', label: 'Hotels', path: '/management/hotels', icon: Hotel, canManage: canManageHotels, serviceType: 'hotel' },
        { key: 'travel-mgmt', label: 'Travel', path: '/management/travel', icon: Bus, canManage: canManageTravel, serviceType: 'travel' },
        { key: 'cars-mgmt', label: 'Car Rental', path: '/management/car-rental', icon: Car, canManage: canManageCars, serviceType: 'car_rental' },
        { key: 'events-mgmt', label: 'Events', path: '/management/events', icon: Calendar, canManage: canManageEvents, serviceType: 'events' },
        { key: 'restaurants-mgmt', label: 'Restaurants', path: '/management/restaurants', icon: Utensils, canManage: canManageRestaurants, serviceType: 'restaurant' },
        { key: 'banquets-mgmt', label: 'Banquets', path: '/management/banquets', icon: Gift, canManage: canManageBanquets, serviceType: 'banquet' },
        { key: 'cinema-mgmt', label: 'Cinema', path: '/management/cinema', icon: Film, canManage: canManageCinema, serviceType: 'cinema' },
        { key: 'pressing-mgmt', label: 'Laundry', path: '/management/pressing', icon: Sparkles, canManage: canManagePressing, serviceType: 'laundry' },
        { key: 'packages-mgmt', label: 'Packages', path: '/management/packages', icon: Package, canManage: canManagePackages, serviceType: 'package' },
      ];
      let managementSubmenu = allManagementItems.filter(item => item.canManage);
      if (isOperator) {
        managementSubmenu = managementSubmenu.filter(item => !item.serviceType || canOperatorAccessService(item.serviceType));
      }
      if (managementSubmenu.length > 0) {
        items.push({ key: 'management', label: 'Service Management', icon: Briefcase, isDropdown: true, submenu: managementSubmenu });
      }
    }

    // Shipments — standalone page for admins/super admins and operators with package access
    const canSeeShipments = isAdminOrSuper || (isOperator && canOperatorAccessService('package') && canManagePackages);
    if (canSeeShipments) {
      items.push({ key: 'shipments', label: 'Shipments', icon: Package, path: '/management/shipments' });
    }

    // Transactions (Admin/Super Admin: All Orders, All Receipts, All Bookings as submenu)
    if (isSuperAdmin || isAdmin) {
      items.push({
        key: 'transactions', label: 'Transactions', icon: Receipt, isDropdown: true,
        submenu: [
          { key: 'all-orders', label: 'All Orders', path: '/orders', icon: Ticket },
          { key: 'all-receipts', label: 'All Receipts', path: '/receipts', icon: Receipt },
          { key: 'all-bookings', label: 'All Bookings', path: '/admin/bookings', icon: QrCode },
          { key: 'all-bills', label: 'All Bills', path: '/admin/bills', icon: CreditCard },
        ]
      });
    } else if (isOperator) {
      // Operators get a scoped Transactions submenu — Bookings + Bills only.
      // Customer "My Orders" / "Receipts" are intentionally hidden for operators.
      items.push({
        key: 'transactions', label: 'Transactions', icon: Receipt, isDropdown: true,
        submenu: [
          { key: 'all-bookings', label: 'All Bookings', path: '/admin/bookings', icon: QrCode },
          { key: 'all-bills', label: 'All Bills', path: '/admin/bills', icon: CreditCard },
        ]
      });
      items.push({ key: 'scanner', label: 'Ticket Scanner', icon: QrCode, path: '/scanner' });
    }

    // Loyalty / Promo & Alerts
    if (isSuperAdmin || isAdmin) {
      items.push({ key: 'loyalty', label: 'Loyalty Program', icon: Award, path: '/loyalty' });
    } else if (isOperator) {
      // Operators see a SKEWED view of /loyalty — just their own Promo & Alerts.
      // The label and icon are scoped accordingly.
      items.push({ key: 'loyalty', label: 'Promo & Alerts', icon: Megaphone, path: '/loyalty' });
    }

    // Admin Config (Reports first, no Validation — moved to standalone)
    const adminSubmenu = [];
    if (isAdmin) adminSubmenu.push({ key: 'reports', label: 'Reports', path: '/admin/reports', icon: BarChart3 });
    if (canViewUsers) adminSubmenu.push({ key: 'users', label: 'User Management', path: '/admin/users', icon: Users });
    if (canViewOperators) adminSubmenu.push({ key: 'operators', label: 'Operator Management', path: '/admin/operators', icon: Building2 });
    if (isSuperAdmin && canViewEmployees) adminSubmenu.push({ key: 'employees', label: 'Employee Management', path: '/admin/employees', icon: Users });
    if (isAdmin && !isSuperAdmin) adminSubmenu.push({ key: 'admin-revenue', label: 'Revenue', path: '/admin/sales', icon: TrendingUp });

    // Operator-specific admin items
    if (isOperator) {
      adminSubmenu.push({ key: 'team-roles', label: 'Team & Roles', path: '/management/team-roles', icon: Users });
    }

    // Ratings
    if (isSuperAdmin || isAdmin) {
      items.push({ key: 'ratings', label: 'All Ratings', icon: Star, path: '/ratings' });
    } else if (isOperator) {
      items.push({ key: 'ratings', label: 'My Ratings', icon: Star, path: '/ratings' });
    }

    // Validation (standalone, above Customer Service)
    if (canViewValidation) {
      items.push({ key: 'validation', label: 'Validation', icon: FileText, path: '/admin/validation' });
    }

    // Customer Service (Admin/Super Admin standalone)
    if (isSuperAdmin || isAdmin) {
      items.push({ key: 'customer-service', label: 'Customer Service', icon: HeadphonesIcon, path: '/management/customer-service' });
    }

    // Admin Config (below Customer Service)
    if (adminSubmenu.length > 0) {
      items.push({ key: 'admin-config', label: 'Admin Config', icon: Settings, isDropdown: true, submenu: adminSubmenu });
    }

    // Support/CS
    if (isOperator) {
      items.push({ key: 'support', label: 'Support', icon: HelpCircle, path: '/support' });
    }

    // System menu (Sys Config, Audit Logs, Commission)
    const systemSubmenu = [];
    systemSubmenu.push({ key: 'sys-config', label: 'Sys Config', path: '/settings', icon: Settings });
    if (canViewActivity || isOperator) systemSubmenu.push({ key: 'audit-logs', label: 'Audit Logs', path: '/admin/audit-log', icon: History });
    if (isSuperAdmin && canViewCommission) systemSubmenu.push({ key: 'commission', label: 'Commission', path: '/admin/commission', icon: Percent });

    items.push({ key: 'system', label: 'System', icon: Monitor, isDropdown: true, submenu: systemSubmenu });

    return items;
  }, [
    user, userRole, isSuperAdmin, canManage,
    canManageHotels, canManageTravel, canManageCars, canManageEvents,
    canManageRestaurants, canManageBanquets, canManageCinema, canManagePressing, canManagePackages,
    canViewAnalytics, canViewUsers, canViewOperators, canViewEmployees,
    canViewCommission, canViewValidation, canViewActivity, canViewPermissions,
    hasAnyPermission, hasPermission, isOperatorUser, operatorServiceTypes, operatorType, isAdmin
  ]);

  return { navigationItems, userRole, isSuperAdmin, isAdmin, isOperator, canManage };
}
