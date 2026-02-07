import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { usePermissions } from '../contexts/PermissionsContext';
import api from '../api/client';
import LocationSelectionModal, { useUserLocation } from './LocationSelectionModal';
import {
  LayoutDashboard,
  ShoppingBag,
  Ticket,
  Receipt,
  Settings,
  LogOut,
  Menu,
  X,
  Users,
  BarChart,
  Star,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Bus,
  Hotel,
  Car,
  Utensils,
  Package,
  Gift,
  Calendar,
  Sparkles,
  Bell,
  Award,
  TrendingUp,
  ShieldCheck,
  History,
  Percent,
  HeadphonesIcon,
  Film,
  Briefcase,
  Database,
  FileText,
  QrCode,
  MapPin,
  Search,
  Clock,
  ArrowRight,
  Building2,
  User,
  PartyPopper,
  Loader2,
  Globe
} from 'lucide-react';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';

const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  OPERATOR: 'operator',
  CUSTOMER: 'customer'
};

// Icon color mapping for sidebar
const ICON_COLORS = {
  dashboard: '#4D96FF',
  services: '#00C853',
  browse: '#00C853',
  hotels: '#EC4899',
  restaurants: '#F59E0B',
  travel: '#3B82F6',
  'car-rental': '#10B981',
  events: '#F97316',
  packages: '#EF4444',
  laundry: '#A855F7',
  cinema: '#06B6D4',
  banquet: '#14B8A6',
  orders: '#9575CD',
  receipts: '#2962FF',
  loyalty: '#AB47BC',
  management: '#7E57C2',
  analytics: '#4D96FF',
  bookings: '#FF7043',
  users: '#757575',
  operators: '#64748b',
  employees: '#757575',
  commission: '#22C55E',
  'audit-logs': '#F59E0B',
  permissions: '#EF4444',
  'access-groups': '#7E57C2',
  ratings: '#FBBF24',
  support: '#22C55E',
  settings: '#64748b',
  'customer-service': '#06B6D4',
  'booking-analytics': '#EC4899',
  reporting: '#3B82F6',
  'trip-report': '#FF7043',
  'data-analytics': '#7E57C2',
  database: '#10B981',
  validation: '#F59E0B',
  bills: '#2962FF',
  sales: '#22C55E'
};

export default function Layout({ children }) {
  const { user, logout, operatorContext, isOperatorUser, operatorServiceTypes, operatorType } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { hasPermission, hasAnyPermission, canAccessModule, isSuperAdmin: isSuperAdminPerm, loading: permissionsLoading } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState({});
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchInputRef = useRef(null);
  const searchDropdownRef = useRef(null);
  const searchDebounceRef = useRef(null);
  
  // Customer location state
  const { location: userLocation, showModal: showLocationModal, setShowModal: setShowLocationModal, updateLocation } = useUserLocation();
  
  // Show location modal for customers on first visit
  useEffect(() => {
    if (user?.role === 'customer' && !userLocation) {
      // Delay to avoid showing immediately on login
      const timer = setTimeout(() => {
        setShowLocationModal(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [user, userLocation, setShowLocationModal]);

  // Icon mapping for dynamic icons from API
  const iconMap = {
    MapPin, Bus, Hotel, Car, Utensils, Calendar, Package, Film, Gift, PartyPopper,
    Building2, User, Users, Receipt, LayoutDashboard, Ticket, Award, Star, 
    HelpCircle, Settings, Bell, BarChart, Briefcase, Percent, History, QrCode,
    HeadphonesIcon, Sparkles, Database, FileText
  };

  const getIconComponent = (iconName) => {
    return iconMap[iconName] || Search;
  };

  // User role checks - moved before searchableItems that depends on them
  const userRole = user?.role || USER_ROLES.CUSTOMER;
  const isSuperAdmin = userRole === USER_ROLES.SUPER_ADMIN || isSuperAdminPerm;
  const isAdmin = userRole === USER_ROLES.ADMIN || isSuperAdmin;
  const isOperator = userRole === USER_ROLES.OPERATOR;
  
  // Permission-based access checks
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
  
  // Check if user has any management permissions
  const canManage = isSuperAdmin || canManageHotels || canManageTravel || canManageCars || 
                    canManageEvents || canManageRestaurants || canManageBanquets || 
                    canManageCinema || canManagePressing || canManagePackages;
  
  // Check if user has any admin config permissions
  const canAccessAdminConfig = isSuperAdmin || canViewAnalytics || canViewUsers || canViewOperators || 
                               canViewEmployees || canViewCommission || canViewValidation || 
                               canViewActivity || canViewPermissions;

  // Static searchable items for navigation (fallback)
  const staticSearchItems = useMemo(() => [
    // Services
    { type: 'service', label: 'Hotels', description: 'Find and book hotels', path: '/services/hotels', icon: 'Hotel', color: '#EC4899', keywords: ['accommodation', 'stay', 'room', 'lodging'] },
    { type: 'service', label: 'Restaurants', description: 'Reserve tables at restaurants', path: '/services/restaurants', icon: 'Utensils', color: '#F59E0B', keywords: ['food', 'dining', 'eat', 'meal'] },
    { type: 'service', label: 'Travel', description: 'Book bus tickets', path: '/services/travel', icon: 'Bus', color: '#3B82F6', keywords: ['bus', 'trip', 'journey', 'transport'] },
    { type: 'service', label: 'Car Rental', description: 'Rent vehicles', path: '/services/car-rental', icon: 'Car', color: '#10B981', keywords: ['vehicle', 'drive', 'rent'] },
    { type: 'service', label: 'Events', description: 'Find and book events', path: '/services/events', icon: 'Calendar', color: '#F97316', keywords: ['concert', 'show', 'tickets', 'entertainment'] },
    { type: 'service', label: 'Packages', description: 'Courier & delivery services', path: '/services/packages', icon: 'Package', color: '#EF4444', keywords: ['delivery', 'courier', 'send', 'parcel'] },
    { type: 'service', label: 'Laundry', description: 'Laundry & pressing services', path: '/services/laundry', icon: 'Sparkles', color: '#A855F7', keywords: ['cleaning', 'wash', 'iron', 'dry clean'] },
    { type: 'service', label: 'Cinema', description: 'Book movie tickets', path: '/services/cinema', icon: 'Film', color: '#06B6D4', keywords: ['movie', 'film', 'theater', 'show'] },
    { type: 'service', label: 'Banquet', description: 'Book event venues', path: '/services/banquet', icon: 'PartyPopper', color: '#14B8A6', keywords: ['venue', 'hall', 'wedding', 'party', 'conference'] },
    
    // Pages
    { type: 'page', label: 'Dashboard', description: 'Overview & statistics', path: '/dashboard', icon: 'LayoutDashboard', color: '#4D96FF', keywords: ['home', 'overview', 'stats'] },
    { type: 'page', label: 'My Orders', description: 'View your orders', path: '/orders', icon: 'Ticket', color: '#9575CD', keywords: ['bookings', 'purchases', 'history'] },
    { type: 'page', label: 'Receipts', description: 'View your receipts', path: '/receipts', icon: 'Receipt', color: '#2962FF', keywords: ['invoice', 'payment', 'bill'] },
    { type: 'page', label: 'Loyalty', description: 'Loyalty rewards & points', path: '/loyalty', icon: 'Award', color: '#AB47BC', keywords: ['points', 'rewards', 'benefits'] },
    { type: 'page', label: 'My Ratings', description: 'Your reviews & ratings', path: '/ratings', icon: 'Star', color: '#FBBF24', keywords: ['review', 'feedback'] },
    { type: 'page', label: 'Support', description: 'Get help & support', path: '/support', icon: 'HelpCircle', color: '#22C55E', keywords: ['help', 'chat', 'contact', 'assistance'] },
    { type: 'page', label: 'Settings', description: 'Account settings', path: '/settings', icon: 'Settings', color: '#64748b', keywords: ['profile', 'account', 'preferences', 'password'] },
    { type: 'page', label: 'Notifications', description: 'View notifications', path: '/notifications', icon: 'Bell', color: '#F59E0B', keywords: ['alerts', 'messages'] },
    
    // Admin Pages (only shown to admin/operator)
    ...(canManage ? [
      { type: 'admin', label: 'Analytics', description: 'View analytics data', path: '/admin/analytics', icon: 'BarChart', color: '#4D96FF', keywords: ['reports', 'statistics', 'data'] },
      { type: 'admin', label: 'All Bookings', description: 'Manage all bookings', path: '/admin/bookings', icon: 'Calendar', color: '#FF7043', keywords: ['reservations', 'orders'] },
      { type: 'admin', label: 'Customer Service', description: 'Handle customer queries', path: '/management/customer-service', icon: 'HeadphonesIcon', color: '#06B6D4', keywords: ['support', 'queries'] },
    ] : []),
    
    ...(isAdmin ? [
      { type: 'admin', label: 'User Management', description: 'Manage users', path: '/admin/users', icon: 'Users', color: '#757575', keywords: ['customers', 'accounts'] },
      { type: 'admin', label: 'Operators', description: 'Manage operators', path: '/admin/operators', icon: 'Briefcase', color: '#64748b', keywords: ['partners', 'vendors'] },
      { type: 'admin', label: 'Employees', description: 'Manage employees', path: '/admin/employees', icon: 'Users', color: '#757575', keywords: ['staff', 'team'] },
      { type: 'admin', label: 'Commission', description: 'Commission settings', path: '/admin/commission', icon: 'Percent', color: '#22C55E', keywords: ['fees', 'percentage'] },
      { type: 'admin', label: 'Audit Logs', description: 'System audit logs', path: '/admin/audit-logs', icon: 'History', color: '#F59E0B', keywords: ['logs', 'activity', 'history'] },
      { type: 'admin', label: 'Validation', description: 'Service validation center', path: '/admin/validation', icon: 'QrCode', color: '#F59E0B', keywords: ['verify', 'check', 'qr'] },
    ] : []),
    
    // Management Pages
    ...(canManage ? [
      { type: 'management', label: 'Hotel Management', description: 'Manage hotels', path: '/management/hotels', icon: 'Hotel', color: '#EC4899', keywords: ['manage hotels'] },
      { type: 'management', label: 'Travel Management', description: 'Manage travel routes', path: '/management/travel', icon: 'Bus', color: '#3B82F6', keywords: ['manage buses', 'routes', 'seats'] },
      { type: 'management', label: 'Car Rental Management', description: 'Manage car rentals', path: '/management/car-rental', icon: 'Car', color: '#10B981', keywords: ['manage vehicles'] },
      { type: 'management', label: 'Restaurant Management', description: 'Manage restaurants', path: '/management/restaurants', icon: 'Utensils', color: '#F59E0B', keywords: ['manage dining'] },
      { type: 'management', label: 'Events Management', description: 'Manage events', path: '/management/events', icon: 'Calendar', color: '#F97316', keywords: ['manage shows'] },
    ] : []),
  ], [canManage, isAdmin]);

  // Perform global search (API + local static items)
  const performSearch = useCallback(async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    
    try {
      // Search API for dynamic content (routes, operators, hotels, etc.)
      const response = await api.get('/search/', { params: { q: query, limit: 15 } });
      const apiResults = response.data?.results || [];
      
      // Also search static items for navigation
      const queryLower = query.toLowerCase();
      const staticResults = staticSearchItems.filter(item => {
        const matchLabel = item.label.toLowerCase().includes(queryLower);
        const matchDesc = item.description.toLowerCase().includes(queryLower);
        const matchKeywords = item.keywords?.some(kw => kw.toLowerCase().includes(queryLower));
        return matchLabel || matchDesc || matchKeywords;
      });
      
      // Combine results - API results first, then static navigation items
      const combined = [...apiResults, ...staticResults];
      
      // Remove duplicates based on path
      const seen = new Set();
      const unique = combined.filter(item => {
        const key = item.path || item.label;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      
      setSearchResults(unique.slice(0, 12));
    } catch (error) {
      console.error('Search API error:', error);
      // Fallback to static search only
      const queryLower = query.toLowerCase();
      const staticResults = staticSearchItems.filter(item => {
        const matchLabel = item.label.toLowerCase().includes(queryLower);
        const matchDesc = item.description.toLowerCase().includes(queryLower);
        const matchKeywords = item.keywords?.some(kw => kw.toLowerCase().includes(queryLower));
        return matchLabel || matchDesc || matchKeywords;
      });
      setSearchResults(staticResults.slice(0, 8));
    } finally {
      setSearchLoading(false);
    }
  }, [staticSearchItems]);

  // Debounced search
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    
    if (searchQuery.trim()) {
      searchDebounceRef.current = setTimeout(() => {
        performSearch(searchQuery);
      }, 300);
    } else {
      setSearchResults([]);
    }
    
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchQuery, performSearch]);

  // Group results by type
  const groupedResults = useMemo(() => {
    const groups = {};
    searchResults.forEach(item => {
      if (!groups[item.type]) groups[item.type] = [];
      groups[item.type].push(item);
    });
    return groups;
  }, [searchResults]);

  // Handle search selection
  const handleSearchSelect = (item) => {
    // Add to recent searches
    setRecentSearches(prev => {
      const filtered = prev.filter(r => r.path !== item.path);
      return [item, ...filtered].slice(0, 5);
    });
    setSearchQuery('');
    setSearchOpen(false);
    navigate(item.path);
  };

  // Close search on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(event.target) &&
          searchInputRef.current && !searchInputRef.current.contains(event.target)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut for search (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getTypeLabel = (type) => {
    const labels = {
      service: 'Services',
      page: 'Pages',
      admin: 'Admin',
      management: 'Management',
      action: 'Quick Actions',
      location: 'Locations',
      operator: 'Operators',
      travel_route: 'Bus Routes',
      hotel: 'Hotels',
      restaurant: 'Restaurants',
      event: 'Events',
      car_rental: 'Car Rentals',
      cinema: 'Movies & Cinemas',
      banquet: 'Venues',
      user: 'Users',
      order: 'Orders'
    };
    return labels[type] || type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ');
  };
  
  // Get notifications from context (with safe fallback)
  const notificationData = useNotifications();
  const notificationsList = notificationData?.notifications || [];
  const unreadCount = notificationData?.unreadCount || 0;
  const clearAllNotifications = notificationData?.clearAll || (() => {});

  const toggleMenu = (key) => {
    setExpandedMenus(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getIconColor = (key) => ICON_COLORS[key] || '#94a3b8';

  const navigationItems = useMemo(() => {
    // Determine user's effective role
    const isCustomer = userRole === USER_ROLES.CUSTOMER || (!userRole && !isOperatorUser && !isSuperAdmin);
    const isAdminOrSuper = isSuperAdmin || userRole === USER_ROLES.ADMIN;
    
    // Helper function to check if operator can access a service type
    const canOperatorAccessService = (serviceType) => {
      // Super admin and admin can access all services
      if (isAdminOrSuper) return true;
      
      // Customer can browse all services
      if (isCustomer) return true;
      
      // Operator users can only access their assigned service types
      if (isOperatorUser) {
        if (operatorServiceTypes.length > 0) {
          return operatorServiceTypes.includes(serviceType);
        }
        // Fall back to operator_type if service_types not set
        if (operatorType) {
          return operatorType === serviceType;
        }
        return false;
      }
      
      return true;
    };

    const items = [];
    
    // ==================== CUSTOMER NAVIGATION ====================
    if (isCustomer) {
      // Dashboard
      items.push({ key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' });
      
      // Services - All services visible for customers
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
      
      items.push({
        key: 'services',
        label: 'Services',
        icon: ShoppingBag,
        isDropdown: true,
        submenu: allServices
      });
      
      // My Orders
      items.push({ key: 'orders', label: 'My Orders', icon: Ticket, path: '/orders' });
      
      // Receipts
      items.push({ key: 'receipts', label: 'Receipts', icon: Receipt, path: '/receipts' });
      
      // Loyalty
      items.push({ key: 'loyalty', label: 'Loyalty', icon: Award, path: '/loyalty' });
      
      // My Ratings
      items.push({ key: 'ratings', label: 'My Ratings', icon: Star, path: '/ratings' });
      
      // Support
      items.push({ key: 'support', label: 'Support', icon: HelpCircle, path: '/support' });
      
      // Settings
      items.push({ key: 'settings', label: 'Settings', icon: Settings, path: '/settings' });
      
      return items;
    }
    
    // ==================== OPERATOR NAVIGATION ====================
    if (isOperatorUser && !isAdminOrSuper) {
      // Dashboard - For operators, shows Analytics Dashboard (also landing page)
      items.push({ key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/admin/analytics' });
      
      // Sales - Personalized to current operator (between Dashboard and Services)
      items.push({ key: 'sales', label: 'Sales', icon: TrendingUp, path: '/admin/sales' });
      
      // Services - Only assigned services visible (no Browse Services for operators)
      const operatorServices = [
        { key: 'hotels', label: 'Hotels', path: '/services/hotels', icon: Hotel, serviceType: 'hotel' },
        { key: 'restaurants', label: 'Restaurants', path: '/services/restaurants', icon: Utensils, serviceType: 'restaurant' },
        { key: 'travel', label: 'Travel', path: '/services/travel', icon: Bus, serviceType: 'travel' },
        { key: 'car-rental', label: 'Car Rental', path: '/services/car-rental', icon: Car, serviceType: 'car_rental' },
        { key: 'events', label: 'Events', path: '/services/events', icon: Calendar, serviceType: 'events' },
        { key: 'packages', label: 'Packages', path: '/services/packages', icon: Package, serviceType: 'package' },
        { key: 'laundry', label: 'Laundry', path: '/services/laundry', icon: Sparkles, serviceType: 'laundry' },
        { key: 'cinema', label: 'Cinema', path: '/services/cinema', icon: Film, serviceType: 'cinema' },
        { key: 'banquet', label: 'Banquet', path: '/services/banquet', icon: Gift, serviceType: 'banquet' },
      ].filter(s => canOperatorAccessService(s.serviceType));
      
      if (operatorServices.length > 0) {
        items.push({
          key: 'services',
          label: 'Services',
          icon: ShoppingBag,
          isDropdown: true,
          submenu: operatorServices
        });
      }
      
      // Service Management - Only assigned services
      const managementItems = [
        { key: 'hotel-mgmt', label: 'Hotels', path: '/management/hotels', icon: Hotel, serviceType: 'hotel' },
        { key: 'travel-mgmt', label: 'Travel', path: '/management/travel', icon: Bus, serviceType: 'travel' },
        { key: 'car-mgmt', label: 'Car Rental', path: '/management/car-rental', icon: Car, serviceType: 'car_rental' },
        { key: 'restaurant-mgmt', label: 'Restaurants', path: '/management/restaurants', icon: Utensils, serviceType: 'restaurant' },
        { key: 'events-mgmt', label: 'Events', path: '/management/events', icon: Calendar, serviceType: 'events' },
        { key: 'laundry-mgmt', label: 'Laundry', path: '/management/laundry', icon: Sparkles, serviceType: 'laundry' },
        { key: 'banquet-mgmt', label: 'Banquet', path: '/management/banquet', icon: Gift, serviceType: 'banquet' },
        { key: 'cinema-mgmt', label: 'Cinema', path: '/management/cinema', icon: Film, serviceType: 'cinema' },
        { key: 'package-mgmt', label: 'Packages', path: '/management/packages', icon: Package, serviceType: 'package' },
      ].filter(item => canOperatorAccessService(item.serviceType));
      
      if (managementItems.length > 0) {
        items.push({
          key: 'service-mgmt',
          label: 'Service Management',
          icon: BarChart,
          isDropdown: true,
          submenu: managementItems
        });
      }
      
      // Admin Config - Limited for operators: Team & Roles (if owner/local_admin), Audit Log only
      // Removed: All Bookings, Bills (as requested)
      const operatorAdminSubmenu = [];
      
      // Team & Roles - Moved to Admin Config as submenu (only for owner or local_admin)
      if (user?.operator_id && ['owner', 'local_admin'].includes(user?.operator_role)) {
        operatorAdminSubmenu.push({ key: 'team-roles', label: 'Team & Roles', path: '/management/team-roles', icon: Users });
      }
      operatorAdminSubmenu.push({ key: 'audit-logs', label: 'Audit Log', path: '/admin/audit-logs', icon: History });
      
      items.push({
        key: 'management',
        label: 'Admin Config',
        icon: Settings,
        isDropdown: true,
        submenu: operatorAdminSubmenu
      });
      
      // My Orders (filtered by operator)
      items.push({ key: 'orders', label: 'My Orders', icon: Ticket, path: '/orders' });
      
      // Receipts (filtered by operator)
      items.push({ key: 'receipts', label: 'Receipts', icon: Receipt, path: '/receipts' });
      
      // NOTE: Loyalty removed for operators as requested
      
      // My Ratings (operator views their service ratings)
      items.push({ key: 'ratings', label: 'My Ratings', icon: Star, path: '/ratings' });
      
      // Support
      items.push({ key: 'support', label: 'Support', icon: HelpCircle, path: '/support' });
      
      // Settings
      items.push({ key: 'settings', label: 'Settings', icon: Settings, path: '/settings' });
      
      return items;
    }
    
    // ==================== ADMIN / SUPER ADMIN NAVIGATION ====================
    // Check if this is a regular admin (not super admin)
    const isRegularAdmin = userRole === USER_ROLES.ADMIN && !isSuperAdmin;
    
    // Dashboard - Different behavior for Admin vs Super Admin
    // Super Admin: Dashboard shows Analytics Dashboard
    // Admin: Dashboard shows Admin Dashboard (new metrics page)
    if (isSuperAdmin) {
      items.push({ key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/admin/analytics' });
      
      // Sales - for Super Admin (cumulative for all operators)
      items.push({ key: 'sales', label: 'Sales', icon: TrendingUp, path: '/admin/sales' });
    } else if (isRegularAdmin) {
      items.push({ key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/admin/admin-dashboard' });
    }
    
    // Services - All services visible
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
    
    items.push({
      key: 'services',
      label: 'Services',
      icon: ShoppingBag,
      isDropdown: true,
      submenu: allServices
    });

    // Service Management - All services (for both Admin and Super Admin, controlled by permissions)
    // Admins get access by default; Super Admin has full access
    if (canManage || isAdmin) {
      const allManagementItems = [
        { key: 'hotel-mgmt', label: 'Hotels', path: '/management/hotels', icon: Hotel, serviceType: 'hotel', canManage: isAdmin || canManageHotels },
        { key: 'travel-mgmt', label: 'Travel', path: '/management/travel', icon: Bus, serviceType: 'travel', canManage: isAdmin || canManageTravel },
        { key: 'car-mgmt', label: 'Car Rental', path: '/management/car-rental', icon: Car, serviceType: 'car_rental', canManage: isAdmin || canManageCars },
        { key: 'restaurant-mgmt', label: 'Restaurants', path: '/management/restaurants', icon: Utensils, serviceType: 'restaurant', canManage: isAdmin || canManageRestaurants },
        { key: 'events-mgmt', label: 'Events', path: '/management/events', icon: Calendar, serviceType: 'events', canManage: isAdmin || canManageEvents },
        { key: 'laundry-mgmt', label: 'Laundry', path: '/management/laundry', icon: Sparkles, serviceType: 'laundry', canManage: isAdmin || canManagePressing },
        { key: 'banquet-mgmt', label: 'Banquet', path: '/management/banquet', icon: Gift, serviceType: 'banquet', canManage: isAdmin || canManageBanquets },
        { key: 'cinema-mgmt', label: 'Cinema', path: '/management/cinema', icon: Film, serviceType: 'cinema', canManage: isAdmin || canManageCinema },
        { key: 'package-mgmt', label: 'Packages', path: '/management/packages', icon: Package, serviceType: 'package', canManage: isAdmin || canManagePackages },
      ];
      
      const managementSubmenu = allManagementItems.filter(item => item.canManage);
      
      if (managementSubmenu.length > 0) {
        items.push({
          key: 'service-mgmt',
          label: 'Service Management',
          icon: BarChart,
          isDropdown: true,
          submenu: managementSubmenu
        });
      }
    }

    // All Orders (Admin sees all orders from all users/operators)
    items.push({ key: 'orders', label: 'All Orders', icon: Ticket, path: '/orders' });
    
    // All Receipts (Admin sees all receipts from all users/operators)
    items.push({ key: 'receipts', label: 'All Receipts', icon: Receipt, path: '/receipts' });
    
    // All Bookings (moved from Admin Config)
    if (canViewAnalytics) {
      items.push({ key: 'bookings', label: 'All Bookings', icon: Calendar, path: '/admin/bookings' });
    }
    
    // Loyalty Program (Admin backend for managing loyalty program)
    items.push({ key: 'loyalty', label: 'Loyalty Program', icon: Award, path: '/loyalty' });

    // Admin Config - Different for Admin vs Super Admin
    if (canAccessAdminConfig || isRegularAdmin) {
      const adminSubmenu = [];
      
      if (isSuperAdmin) {
        // Super Admin gets full access
        // Dashboard for admins - visible to super admin in Admin Config
        adminSubmenu.push({ key: 'admin-dashboard', label: 'Dashboard for Admins', path: '/admin/admin-dashboard', icon: LayoutDashboard });
        
        // Admin-only items
        if (canViewUsers) adminSubmenu.push({ key: 'users', label: 'User Management', path: '/admin/users', icon: Users });
        if (canViewOperators) adminSubmenu.push({ key: 'operators', label: 'Operators', path: '/admin/operators', icon: Briefcase });
        if (canViewEmployees) {
          adminSubmenu.push({ 
            key: 'employees', 
            label: 'Employees', 
            icon: Users,
            isDropdown: true,
            submenu: [
              { key: 'employees-management', label: 'Management', path: '/admin/employees', icon: Users },
              { key: 'employees-templates', label: 'Templates', path: '/admin/employees/templates', icon: FileText }
            ]
          });
        }
        
        // Access Control Section - Pod Management, Employee Scopes, Geography
        adminSubmenu.push({ key: 'pods', label: 'Pod Management', path: '/admin/pods', icon: Users });
        adminSubmenu.push({ key: 'employee-scopes', label: 'Access Scopes', path: '/admin/employee-scopes', icon: ShieldCheck });
        adminSubmenu.push({ key: 'geography', label: 'Geography', path: '/admin/geography', icon: MapPin });
        
        if (canViewCommission) adminSubmenu.push({ key: 'commission', label: 'Commission', path: '/admin/commission', icon: Percent });
        if (hasPermission('payments.view')) adminSubmenu.push({ key: 'bills', label: 'Bills', path: '/admin/bills', icon: FileText });
        if (canViewActivity) adminSubmenu.push({ key: 'audit-logs', label: 'Audit Logs', path: '/admin/audit-logs', icon: History });
        if (canViewPermissions) adminSubmenu.push({ key: 'permissions', label: 'Permissions', path: '/admin/permissions', icon: ShieldCheck });
        adminSubmenu.push({ key: 'database', label: 'Database', path: '/admin/database', icon: Database });
        if (canViewValidation) adminSubmenu.push({ key: 'validation', label: 'Validation', path: '/admin/validation', icon: QrCode });
      } else if (isRegularAdmin) {
        // Regular Admin gets limited access
        // Admin-only items (excluding Employees, Commission, Database)
        adminSubmenu.push({ key: 'users', label: 'User Management', path: '/admin/users', icon: Users });
        adminSubmenu.push({ key: 'operators', label: 'Operators', path: '/admin/operators', icon: Briefcase });
        adminSubmenu.push({ key: 'bills', label: 'Bills', path: '/admin/bills', icon: FileText });
        adminSubmenu.push({ key: 'sales', label: 'Sales', path: '/admin/sales', icon: TrendingUp });
        adminSubmenu.push({ key: 'audit-logs', label: 'Audit Logs', path: '/admin/audit-logs', icon: History });
        adminSubmenu.push({ key: 'permissions', label: 'Permissions', path: '/admin/permissions', icon: ShieldCheck });
        adminSubmenu.push({ key: 'validation', label: 'Validation', path: '/admin/validation', icon: QrCode });
      }
      
      if (adminSubmenu.length > 0) {
        items.push({
          key: 'management',
          label: 'Admin Config',
          icon: Settings,
          isDropdown: true,
          submenu: adminSubmenu
        });
      }
    }

    // All Ratings (Admin sees all ratings from all users)
    items.push({ key: 'ratings', label: 'All Ratings', icon: Star, path: '/ratings' });
    
    // Customer Service (Admin backend for support - replaces Support menu for admins)
    items.push({ key: 'customer-service', label: 'Customer Service', icon: HeadphonesIcon, path: '/management/customer-service' });
    
    // Settings
    items.push({ key: 'settings', label: 'Settings', icon: Settings, path: '/settings' });

    return items;
  }, [
    user, userRole, isSuperAdmin, canManage, canAccessAdminConfig,
    canManageHotels, canManageTravel, canManageCars, canManageEvents,
    canManageRestaurants, canManageBanquets, canManageCinema, canManagePressing, canManagePackages,
    canViewAnalytics, canViewUsers, canViewOperators, canViewEmployees,
    canViewCommission, canViewValidation, canViewActivity, canViewPermissions,
    hasAnyPermission, hasPermission,
    isOperatorUser, operatorServiceTypes, operatorType, isAdmin
  ]);

  // State for flyout menus
  const [activeSubmenu, setActiveSubmenu] = useState(null);
  const submenuTimeoutRef = useRef(null);

  const handleSubmenuEnter = (key) => {
    if (submenuTimeoutRef.current) {
      clearTimeout(submenuTimeoutRef.current);
    }
    setActiveSubmenu(key);
  };

  const handleSubmenuLeave = () => {
    submenuTimeoutRef.current = setTimeout(() => {
      setActiveSubmenu(null);
    }, 150);
  };

  const renderNavItem = (item) => {
    const isActive = item.path && location.pathname === item.path;
    const hasActiveChild = item.submenu?.some(sub => location.pathname === sub.path);
    const isSubmenuOpen = activeSubmenu === item.key;
    const iconColor = getIconColor(item.key);

    if (item.isDropdown) {
      return (
        <div 
          key={item.key} 
          className="mb-1 relative group/menu"
          onMouseEnter={() => handleSubmenuEnter(item.key)}
          onMouseLeave={handleSubmenuLeave}
        >
          <button
            onClick={() => setActiveSubmenu(isSubmenuOpen ? null : item.key)}
            className={`
              w-full flex items-center justify-between px-4 py-3 rounded-lg
              transition-all duration-200 ease-out
              ${hasActiveChild || isSubmenuOpen
                ? 'bg-white/15 border-l-3 border-l-[#4D96FF]' 
                : 'hover:bg-white/10'
              }
              active:scale-[0.98]
            `}
          >
            <div className="flex items-center gap-3">
              <item.icon className="h-5 w-5 transition-transform duration-200" style={{ color: iconColor }} />
              <span className="font-medium text-slate-200">{item.label}</span>
            </div>
            <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isSubmenuOpen ? 'rotate-90' : ''}`} />
          </button>
          
          {/* Flyout Submenu - positioned fixed to escape overflow */}
          {isSubmenuOpen && (
            <div 
              className="fixed z-[9999] min-w-[280px] max-h-[80vh] overflow-y-auto
                         bg-gradient-to-br from-[#0a3566] to-[#082c59] rounded-xl shadow-2xl 
                         border border-white/20 backdrop-blur-sm"
              style={{ 
                left: '290px', 
                top: '120px'
              }}
              onMouseEnter={() => handleSubmenuEnter(item.key)}
              onMouseLeave={handleSubmenuLeave}
            >
              {/* Submenu header */}
              <div className="px-4 py-3 border-b border-white/10 bg-gradient-to-r from-white/10 to-transparent sticky top-0 backdrop-blur-sm rounded-t-xl">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-white/10 rounded-lg">
                    <item.icon className="h-4 w-4" style={{ color: iconColor }} />
                  </div>
                  <span className="font-semibold text-white">{item.label}</span>
                </div>
              </div>
            
                {/* Submenu items */}
                <div className="py-2 px-2">
                  {item.submenu.map((sub, idx) => {
                    if (sub.isDivider) {
                      return (
                        <div key={sub.key || idx} className="px-3 py-2 mt-2 text-xs text-slate-400 font-semibold uppercase tracking-wider border-t border-white/5 pt-3">
                          {sub.label}
                        </div>
                      );
                    }
                    const subIconColor = getIconColor(sub.key);
                    const isSubActive = location.pathname === sub.path;
                    return (
                      <Link
                        key={sub.key}
                        to={sub.path}
                        onClick={() => {
                          setSidebarOpen(false);
                          setActiveSubmenu(null);
                        }}
                        className={`
                          flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1
                          transition-all duration-150 ease-out
                          ${isSubActive
                            ? 'bg-[#4D96FF]/25 text-white border-l-2 border-l-[#4D96FF]'
                            : 'text-slate-300 hover:text-white hover:bg-white/10'
                          }
                          group
                        `}
                      >
                        <div className={`
                          p-1.5 rounded-lg transition-all duration-150
                          ${isSubActive ? 'bg-white/15' : 'bg-white/5 group-hover:bg-white/10'}
                        `}>
                          <sub.icon className="h-4 w-4" style={{ color: subIconColor }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium block truncate">{sub.label}</span>
                          {sub.description && (
                            <span className="text-xs text-slate-500 block truncate">{sub.description}</span>
                          )}
                        </div>
                        <ArrowRight className={`
                          h-3.5 w-3.5 text-slate-500 
                          transition-all duration-150
                          opacity-0 -translate-x-2
                          group-hover:opacity-100 group-hover:translate-x-0
                        `} />
                      </Link>
                    );
                  })}
                </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <Link
        key={item.key}
        to={item.path}
        onClick={() => setSidebarOpen(false)}
        className={`
          flex items-center gap-3 px-4 py-3 rounded-lg mb-1
          transition-all duration-200 ease-out
          ${isActive
            ? 'bg-white/15 border-l-3 border-l-[#4D96FF] text-white'
            : 'text-slate-300 hover:bg-white/10 hover:text-white'
          }
          active:scale-[0.98]
        `}
      >
        <item.icon 
          className="h-5 w-5 transition-transform duration-200 hover:scale-110" 
          style={{ color: iconColor }} 
        />
        <span className="font-medium">{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 
        bg-[#082c59] 
        transform transition-transform duration-300 ease-out
        lg:translate-x-0 
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        shadow-2xl overflow-visible
      `}>
        <div className="flex flex-col h-full overflow-visible">
          {/* Logo Header */}
          <div className="bg-[#082c59] px-6 py-5 border-b border-white/10">
            <div className="flex items-center gap-3">
              <img 
                src="https://customer-assets.emergentagent.com/job_base44rebuild/artifacts/411geuvq_Untitled%20picture.png" 
                alt="Oryno Logo" 
                className="w-10 h-10 rounded-xl object-contain bg-[#082c59]"
              />
              <div>
                <h2 className="text-white text-xl font-bold tracking-tight">Oryno</h2>
                <p className="text-[#93A7D3] text-xs">Convenient, Reliable</p>
              </div>
            </div>
            {/* Mobile close button */}
            <button
              className="lg:hidden absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-all"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto overflow-x-visible px-3 py-4 sidebar-scroll">
            {navigationItems.map(renderNavItem)}
          </nav>

          {/* Logout */}
          <div className="p-3 border-t border-white/10">
            <button
              onClick={logout}
              className="
                w-full flex items-center gap-3 px-4 py-3 rounded-lg
                text-red-400 hover:bg-red-500/15 
                transition-all duration-200 ease-out
                active:scale-[0.98]
              "
            >
              <LogOut className="h-5 w-5" />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 lg:ml-72">
        {/* Top bar */}
        <header className="bg-white/90 backdrop-blur-xl border-b border-slate-200/60 px-4 lg:px-8 py-4 sticky top-0 z-30 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                className="lg:hidden p-2 rounded-lg hover:bg-slate-100 active:scale-95 transition-all"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-6 w-6 text-slate-600" />
              </button>
              <div className="hidden md:block">
                <h1 className="text-xl lg:text-2xl font-bold text-[#082c59]">
                  Welcome back, {user?.full_name?.split(' ')[0] || 'User'}!
                </h1>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-slate-500 hidden sm:block">
                    {isOperatorUser && operatorContext ? (
                      <>Managing <span className="font-medium text-[#082c59]">{operatorContext.operator_name}</span></>
                    ) : (
                      'Manage your services and bookings'
                    )}
                  </p>
                  {isOperatorUser && operatorContext && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full hidden sm:inline-flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {operatorContext.operator_role || 'Team Member'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Global Search Bar */}
            <div className="flex-1 max-w-xl mx-4 relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search services, pages, actions... (Ctrl+K)"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#082c59]/20 focus:border-[#082c59] focus:bg-white transition-all"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden lg:flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 text-xs bg-slate-200 rounded text-slate-500 font-mono">⌘K</kbd>
                </div>
              </div>

              {/* Search Results Dropdown */}
              {searchOpen && (searchQuery || recentSearches.length > 0) && (
                <div 
                  ref={searchDropdownRef}
                  className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-fadeIn"
                >
                  {searchQuery ? (
                    <>
                      {searchLoading ? (
                        <div className="px-4 py-8 text-center">
                          <Loader2 className="h-8 w-8 text-[#082c59] mx-auto mb-2 animate-spin" />
                          <p className="text-sm text-slate-500">Searching...</p>
                        </div>
                      ) : searchResults.length > 0 ? (
                        <div className="max-h-96 overflow-y-auto">
                          {Object.entries(groupedResults).map(([type, items]) => (
                            <div key={type}>
                              <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                  {getTypeLabel(type)}
                                </span>
                              </div>
                              {items.map((item, idx) => {
                                const IconComponent = typeof item.icon === 'string' 
                                  ? getIconComponent(item.icon) 
                                  : (item.icon || Search);
                                return (
                                  <button
                                    key={item.path + idx}
                                    onClick={() => handleSearchSelect(item)}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left group"
                                  >
                                    <div 
                                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                      style={{ backgroundColor: `${item.color}15` }}
                                    >
                                      <IconComponent className="h-5 w-5" style={{ color: item.color }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-slate-800 truncate">{item.label}</p>
                                      <p className="text-xs text-slate-500 truncate">{item.description}</p>
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
                                  </button>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="px-4 py-8 text-center">
                          <Search className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                          <p className="text-sm text-slate-500">No results found for &ldquo;{searchQuery}&rdquo;</p>
                          <p className="text-xs text-slate-400 mt-1">Try searching for locations, operators, hotels, routes...</p>
                        </div>
                      )}
                    </>
                  ) : recentSearches.length > 0 ? (
                    <div>
                      <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          Recent Searches
                        </span>
                        <button 
                          onClick={() => setRecentSearches([])}
                          className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          Clear
                        </button>
                      </div>
                      {recentSearches.map((item, idx) => {
                        const IconComponent = typeof item.icon === 'string' 
                          ? getIconComponent(item.icon) 
                          : (item.icon || Clock);
                        return (
                          <button
                            key={item.path + idx}
                            onClick={() => handleSearchSelect(item)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left group"
                          >
                            <IconComponent className="h-4 w-4 text-slate-400" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-700 text-sm truncate">{item.label}</p>
                            </div>
                            <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                  
                  {/* Search Tips */}
                  <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <kbd className="px-1 py-0.5 bg-slate-200 rounded text-slate-600 font-mono">↵</kbd> to select
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className="px-1 py-0.5 bg-slate-200 rounded text-slate-600 font-mono">esc</kbd> to close
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Notification Bell with Dropdown */}
              <div className="relative">
                <button 
                  className="p-2 rounded-lg hover:bg-slate-100 active:scale-95 transition-all relative"
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                >
                  <Bell className="h-5 w-5 text-slate-600" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white notification-badge"></span>
                  )}
                </button>
                
                {/* Notification Dropdown */}
                {notificationsOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setNotificationsOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-fadeIn">
                      <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-slate-800">Notifications</h3>
                          {unreadCount > 0 && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs font-medium rounded-full">
                              {unreadCount} new
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notificationsList.length === 0 ? (
                          <div className="p-6 text-center">
                            <Bell className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                            <p className="text-sm text-slate-500">No notifications yet</p>
                          </div>
                        ) : (
                          notificationsList.map((notification) => (
                            <div 
                              key={notification.id}
                              className={`px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer ${!notification.read ? 'bg-blue-50/50' : ''}`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                                  notification.type === 'success' ? 'bg-green-500' :
                                  notification.type === 'promo' ? 'bg-amber-500' :
                                  'bg-blue-500'
                                }`}></div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm text-slate-800 truncate">{notification.title}</p>
                                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notification.message}</p>
                                  <p className="text-xs text-slate-400 mt-1">{notification.time}</p>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
                        <button 
                          onClick={() => {
                            setNotificationsOpen(false);
                            navigate('/notifications');
                          }}
                          className="text-sm text-[#082c59] hover:text-[#0a3a75] font-medium py-1 transition-colors"
                        >
                          View all notifications
                        </button>
                        {notificationsList.length > 0 && (
                          <button 
                            onClick={() => {
                              clearAllNotifications();
                              setNotificationsOpen(false);
                            }}
                            className="text-sm text-red-500 hover:text-red-600 font-medium py-1 transition-colors"
                          >
                            Clear all
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
              
              <div 
                onClick={() => navigate('/settings')}
                className="hidden sm:flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-all cursor-pointer"
              >
                {user?.avatar_url ? (
                  <img 
                    src={user.avatar_url.startsWith('data:') || user.avatar_url.startsWith('http') 
                      ? user.avatar_url 
                      : `${import.meta.env.VITE_BACKEND_URL || ''}${user.avatar_url}`
                    }
                    alt={user?.full_name || 'User'}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4D96FF] to-[#7E57C2] flex items-center justify-center text-white text-sm font-bold">
                    {user?.full_name?.charAt(0) || 'U'}
                  </div>
                )}
                <span className="text-sm font-medium text-slate-700">{user?.full_name}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          <div className="fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
