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
  Percent, HeadphonesIcon, Film, Briefcase, Database, FileText,
  QrCode, MapPin, Globe, Building2, PartyPopper
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
  laundry: '#A855F7', cinema: '#06B6D4', banquet: '#14B8A6',
  orders: '#9575CD', receipts: '#2962FF', loyalty: '#AB47BC',
  management: '#7E57C2', analytics: '#4D96FF', bookings: '#FF7043',
  users: '#757575', operators: '#64748b', employees: '#757575',
  commission: '#22C55E', 'audit-logs': '#F59E0B', permissions: '#EF4444',
  'access-groups': '#7E57C2', ratings: '#FBBF24', support: '#22C55E',
  settings: '#64748b', 'customer-service': '#06B6D4',
  'booking-analytics': '#EC4899', reporting: '#3B82F6',
  'trip-report': '#FF7043', 'data-analytics': '#7E57C2',
  database: '#10B981', validation: '#F59E0B', bills: '#2962FF', sales: '#22C55E'
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
        if (operatorServiceTypes.length > 0) return operatorServiceTypes.includes(serviceType);
        if (operatorType) return operatorType === serviceType;
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
    items.push({ key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: isAdmin && !isSuperAdmin ? '/admin/admin-dashboard' : '/analytics' });

    // Sales (Operator + Super Admin)
    if (isSuperAdmin || isOperator) {
      items.push({ key: 'sales', label: 'Sales', icon: TrendingUp, path: '/admin/sales' });
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

    // Orders/Receipts/Bookings
    if (isSuperAdmin || isAdmin) {
      items.push({ key: 'orders', label: 'All Orders', icon: Ticket, path: '/orders' });
      items.push({ key: 'receipts', label: 'All Receipts', icon: Receipt, path: '/receipts' });
      items.push({ key: 'bookings', label: 'All Bookings', icon: QrCode, path: '/admin/bookings' });
    } else if (isOperator) {
      items.push({ key: 'orders', label: 'My Orders', icon: Ticket, path: '/orders' });
      items.push({ key: 'receipts', label: 'Receipts', icon: Receipt, path: '/receipts' });
    }

    // Loyalty
    if (isSuperAdmin || isAdmin) {
      items.push({ key: 'loyalty', label: 'Loyalty Program', icon: Award, path: '/loyalty' });
    }

    // Admin Config
    const adminSubmenu = [];
    if (isSuperAdmin) {
      adminSubmenu.push({ key: 'admin-dashboard', label: 'Dashboard for Admins', path: '/admin/admin-dashboard', icon: LayoutDashboard });
    }
    if (canViewUsers) adminSubmenu.push({ key: 'users', label: 'User Management', path: '/admin/users', icon: Users });
    if (canViewOperators) adminSubmenu.push({ key: 'operators', label: 'Operators', path: '/admin/operators', icon: Building2 });
    if (isSuperAdmin && canViewEmployees) adminSubmenu.push({ key: 'employees', label: 'Employees', path: '/admin/employees', icon: Users });
    if (isSuperAdmin && canViewCommission) adminSubmenu.push({ key: 'commission', label: 'Commission', path: '/admin/commission', icon: Percent });
    if (isAdmin || isSuperAdmin) adminSubmenu.push({ key: 'bills', label: 'Bills', path: '/admin/bills', icon: Receipt });
    if (isAdmin && !isSuperAdmin) adminSubmenu.push({ key: 'admin-sales', label: 'Sales', path: '/admin/sales', icon: TrendingUp });
    if (canViewActivity) adminSubmenu.push({ key: 'audit-logs', label: 'Audit Logs', path: '/admin/audit-log', icon: History });
    if (canViewPermissions) adminSubmenu.push({ key: 'permissions', label: 'Permissions', path: '/admin/permissions', icon: ShieldCheck });
    if (isSuperAdmin) adminSubmenu.push({ key: 'database', label: 'Database', path: '/admin/database', icon: Database });
    if (canViewValidation) adminSubmenu.push({ key: 'validation', label: 'Validation', path: '/admin/validation', icon: FileText });

    // Operator-specific admin items
    if (isOperator) {
      adminSubmenu.push({ key: 'team-roles', label: 'Team & Roles', path: '/admin/team-roles', icon: Users });
      if (canViewActivity) adminSubmenu.push({ key: 'audit-logs', label: 'Audit Logs', path: '/admin/audit-log', icon: History });
    }

    // Access Control items (Super Admin only)
    if (isSuperAdmin) {
      adminSubmenu.push({ key: 'pods', label: 'Pod Management', path: '/admin/pods', icon: Users });
      adminSubmenu.push({ key: 'access-scopes', label: 'Access Scopes', path: '/admin/employee-scopes', icon: ShieldCheck });
      adminSubmenu.push({ key: 'geography', label: 'Geography', path: '/admin/geography', icon: Globe });
    }

    if (adminSubmenu.length > 0) {
      items.push({ key: 'admin-config', label: 'Admin Config', icon: Settings, isDropdown: true, submenu: adminSubmenu });
    }

    // Ratings
    if (isSuperAdmin || isAdmin) {
      items.push({ key: 'ratings', label: 'All Ratings', icon: Star, path: '/ratings' });
    } else if (isOperator) {
      items.push({ key: 'ratings', label: 'My Ratings', icon: Star, path: '/ratings' });
    }

    // Support/CS
    if (isSuperAdmin || isAdmin) {
      items.push({ key: 'customer-service', label: 'Customer Service', icon: HeadphonesIcon, path: '/management/customer-service' });
    } else if (isOperator) {
      items.push({ key: 'support', label: 'Support', icon: HelpCircle, path: '/support' });
    }

    items.push({ key: 'settings', label: 'Settings', icon: Settings, path: '/settings' });
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

export { USER_ROLES };
