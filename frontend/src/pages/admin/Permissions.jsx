import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Checkbox } from '../../components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Separator } from '../../components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { 
  ShieldCheck, Users, Plus, Edit, Trash2, Hotel, Bus, Car, Utensils, 
  Calendar, Package, Settings, BarChart, UserCog, Loader2, Save, Search,
  Eye, EyeOff, Lock, Unlock, Check, X, AlertTriangle, Shield, Key,
  Database, FileText, CreditCard, Bell, Globe, Sparkles, Gift, Film,
  Ticket, Receipt, TrendingUp, History, MessageSquare, HelpCircle,
  LayoutDashboard, ShoppingBag, Award, Briefcase, Percent, QrCode, 
  ChevronRight, ChevronDown, UserCheck, ShieldAlert, Clock, Filter
} from 'lucide-react';
import api from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import AuditLogs from './AuditLogs';

// Available system roles for assignment
const SYSTEM_ROLES = [
  { value: 'user', label: 'User', description: 'Basic user access' },
  { value: 'employee', label: 'Employee', description: 'Employee access with limited features' },
  { value: 'operator', label: 'Operator', description: 'Service operator with management access' },
  { value: 'admin', label: 'Admin', description: 'Administrative access to most features' },
  { value: 'super_admin', label: 'Super Admin', description: 'Full system access' }
];

// Comprehensive permission categories organized by module
// Permissions marked with enforced:true have corresponding backend API enforcement
const PERMISSION_MODULES = [
  {
    module: 'hotels',
    label: 'Hotels Management',
    icon: Hotel,
    color: 'text-purple-600',
    permissions: [
      { key: 'hotels.view', label: 'View Hotels', description: 'See hotel listings' },
      { key: 'hotels.create', label: 'Create Hotels', description: 'Add new hotels', enforced: true },
      { key: 'hotels.edit', label: 'Edit Hotels', description: 'Modify hotel details', enforced: true },
      { key: 'hotels.delete', label: 'Delete Hotels', description: 'Remove hotels', enforced: true },
      { key: 'hotels.manage_rooms', label: 'Manage Rooms', description: 'Create, edit, delete hotel rooms', enforced: true },
      { key: 'hotels.view_bookings', label: 'View Bookings', description: 'See hotel bookings' },
      { key: 'hotels.manage_bookings', label: 'Manage Bookings', description: 'Handle hotel bookings' },
    ]
  },
  {
    module: 'travel',
    label: 'Travel & Transport',
    icon: Bus,
    color: 'text-blue-600',
    permissions: [
      { key: 'travel.view', label: 'View Routes', description: 'See travel routes' },
      { key: 'travel.create', label: 'Create Routes', description: 'Add new routes', enforced: true },
      { key: 'travel.edit', label: 'Edit Routes', description: 'Modify route details', enforced: true },
      { key: 'travel.delete', label: 'Delete Routes', description: 'Remove routes', enforced: true },
      { key: 'travel.view_bookings', label: 'View Bookings', description: 'See travel bookings' },
      { key: 'travel.manage_bookings', label: 'Manage Bookings', description: 'Handle travel bookings' },
      { key: 'travel.manage_routes', label: 'Manage Routes', description: 'Full route management' },
      { key: 'travel.manage_schedules', label: 'Manage Schedules', description: 'Set departure times' },
    ]
  },
  {
    module: 'car_rental',
    label: 'Car Rental',
    icon: Car,
    color: 'text-emerald-600',
    permissions: [
      { key: 'car_rental.view', label: 'View Cars', description: 'See car listings' },
      { key: 'car_rental.create', label: 'Add Cars', description: 'Add new vehicles', enforced: true },
      { key: 'car_rental.edit', label: 'Edit Cars', description: 'Modify car details', enforced: true },
      { key: 'car_rental.delete', label: 'Delete Cars', description: 'Remove vehicles', enforced: true },
      { key: 'car_rental.view_bookings', label: 'View Bookings', description: 'See rental bookings' },
      { key: 'car_rental.manage_bookings', label: 'Manage Bookings', description: 'Handle rental bookings' },
    ]
  },
  {
    module: 'restaurants',
    label: 'Restaurants',
    icon: Utensils,
    color: 'text-orange-600',
    permissions: [
      { key: 'restaurants.view', label: 'View Restaurants', description: 'See restaurant listings' },
      { key: 'restaurants.create', label: 'Create Restaurants', description: 'Add new restaurants', enforced: true },
      { key: 'restaurants.edit', label: 'Edit Restaurants', description: 'Modify restaurant details', enforced: true },
      { key: 'restaurants.delete', label: 'Delete Restaurants', description: 'Remove restaurants', enforced: true },
      { key: 'restaurants.manage_menu', label: 'Manage Menu', description: 'Add/edit/delete menu items', enforced: true },
      { key: 'restaurants.manage_reservations', label: 'Manage Reservations', description: 'Handle restaurant bookings', enforced: true },
    ]
  },
  {
    module: 'events',
    label: 'Events Management',
    icon: Calendar,
    color: 'text-pink-600',
    permissions: [
      { key: 'events.view', label: 'View Events', description: 'See event listings' },
      { key: 'events.create', label: 'Create Events', description: 'Add new events', enforced: true },
      { key: 'events.edit', label: 'Edit Events', description: 'Modify event details', enforced: true },
      { key: 'events.delete', label: 'Delete Events', description: 'Remove events', enforced: true },
      { key: 'events.view_bookings', label: 'View Bookings', description: 'See event bookings' },
      { key: 'events.manage_tickets', label: 'Manage Tickets', description: 'Handle ticket sales' },
    ]
  },
  {
    module: 'cinema',
    label: 'Cinema',
    icon: Film,
    color: 'text-rose-600',
    permissions: [
      { key: 'cinema.view', label: 'View Cinemas', description: 'See cinema listings' },
      { key: 'cinema.create', label: 'Create Cinemas', description: 'Add new cinemas', enforced: true },
      { key: 'cinema.edit', label: 'Edit Cinemas', description: 'Modify cinema details', enforced: true },
      { key: 'cinema.delete', label: 'Delete Cinemas', description: 'Remove cinemas', enforced: true },
      { key: 'cinema.manage_screenings', label: 'Manage Screenings', description: 'Films and showtimes', enforced: true },
      { key: 'cinema.manage_seats', label: 'Manage Seats', description: 'Configure cinema seating' },
    ]
  },
  {
    module: 'packages',
    label: 'Packages',
    icon: Package,
    color: 'text-indigo-600',
    permissions: [
      { key: 'packages.view', label: 'View Packages', description: 'See package listings' },
      { key: 'packages.create', label: 'Create Packages', description: 'Add new packages', enforced: true },
      { key: 'packages.edit', label: 'Edit Packages', description: 'Modify package details', enforced: true },
      { key: 'packages.delete', label: 'Delete Packages', description: 'Remove packages', enforced: true },
    ]
  },
  {
    module: 'pressing',
    label: 'Laundry / Pressing',
    icon: Sparkles,
    color: 'text-cyan-600',
    permissions: [
      { key: 'pressing.view', label: 'View Services', description: 'See laundry listings' },
      { key: 'pressing.create', label: 'Create Services', description: 'Add new services', enforced: true },
      { key: 'pressing.edit', label: 'Edit Services', description: 'Modify service details', enforced: true },
      { key: 'pressing.delete', label: 'Delete Services', description: 'Remove services', enforced: true },
      { key: 'pressing.manage_orders', label: 'Manage Orders', description: 'Handle laundry orders' },
    ]
  },
  {
    module: 'banquets',
    label: 'Banquet Halls',
    icon: Gift,
    color: 'text-amber-600',
    permissions: [
      { key: 'banquets.view', label: 'View Venues', description: 'See venue listings' },
      { key: 'banquets.create', label: 'Create Venues', description: 'Add new venues', enforced: true },
      { key: 'banquets.edit', label: 'Edit Venues', description: 'Modify venue details', enforced: true },
      { key: 'banquets.delete', label: 'Delete Venues', description: 'Remove venues', enforced: true },
      { key: 'banquets.manage_bookings', label: 'Manage Bookings', description: 'Handle venue bookings' },
    ]
  },
  {
    module: 'orders',
    label: 'Orders & Bookings',
    icon: Ticket,
    color: 'text-violet-600',
    permissions: [
      { key: 'orders.view', label: 'View Orders', description: 'See orders' },
      { key: 'orders.view_all', label: 'View All Orders', description: 'See all platform orders' },
      { key: 'orders.edit', label: 'Edit Orders', description: 'Modify order details', enforced: true },
      { key: 'orders.cancel', label: 'Cancel Orders', description: 'Cancel orders' },
      { key: 'orders.process', label: 'Process Orders', description: 'Confirm pending orders', enforced: true },
    ]
  },
  {
    module: 'users',
    label: 'User Management',
    icon: Users,
    color: 'text-slate-600',
    permissions: [
      { key: 'users.view', label: 'View Users', description: 'See user list', enforced: true },
      { key: 'users.create', label: 'Create Users', description: 'Add new users', enforced: true },
      { key: 'users.edit', label: 'Edit Users', description: 'Modify user details', enforced: true },
      { key: 'users.delete', label: 'Delete Users', description: 'Remove users', enforced: true },
      { key: 'users.manage_roles', label: 'Manage Roles', description: 'Change user roles', enforced: true },
      { key: 'users.assign_permissions', label: 'Assign Permissions', description: 'Assign permissions to users' },
      { key: 'users.view_activity', label: 'View Activity', description: 'See user activity logs', enforced: true },
    ]
  },
  {
    module: 'employees',
    label: 'Employee Management',
    icon: UserCog,
    color: 'text-blue-600',
    permissions: [
      { key: 'employees.view', label: 'View Employees', description: 'See employee list', enforced: true },
      { key: 'employees.create', label: 'Create Employees', description: 'Add new employees', enforced: true },
      { key: 'employees.edit', label: 'Edit Employees', description: 'Modify employee details', enforced: true },
      { key: 'employees.delete', label: 'Delete Employees', description: 'Remove employees', enforced: true },
      { key: 'employees.manage_schedules', label: 'Manage Schedules', description: 'Set work schedules' },
    ]
  },
  {
    module: 'operators',
    label: 'Operators',
    icon: Briefcase,
    color: 'text-amber-600',
    permissions: [
      { key: 'operators.view', label: 'View Operators', description: 'See operator list', enforced: true },
      { key: 'operators.create', label: 'Create Operators', description: 'Add new operators', enforced: true },
      { key: 'operators.edit', label: 'Edit Operators', description: 'Modify operator details', enforced: true },
      { key: 'operators.delete', label: 'Delete Operators', description: 'Remove operators', enforced: true },
      { key: 'operators.approve', label: 'Approve Operators', description: 'Approve pending operators', enforced: true },
      { key: 'operators.manage_services', label: 'Manage Services', description: 'Manage operator services' },
      { key: 'operators.view_reports', label: 'View Reports', description: 'See operator reports' },
    ]
  },
  {
    module: 'loyalty',
    label: 'Loyalty Program',
    icon: Award,
    color: 'text-yellow-600',
    permissions: [
      { key: 'loyalty.view', label: 'View Program', description: 'See loyalty program data', enforced: true },
      { key: 'loyalty.manage_programs', label: 'Manage Program', description: 'Configure loyalty settings', enforced: true },
      { key: 'loyalty.manage_rewards', label: 'Manage Rewards', description: 'Create/edit/delete rewards', enforced: true },
      { key: 'loyalty.adjust_points', label: 'Adjust Points', description: 'Add/remove member points' },
    ]
  },
  {
    module: 'promo',
    label: 'Promo Codes',
    icon: Percent,
    color: 'text-emerald-600',
    permissions: [
      { key: 'promo.view', label: 'View Promo Codes', description: 'See promo code list', enforced: true },
      { key: 'promo.create', label: 'Create Promo Codes', description: 'Add new promo codes', enforced: true },
      { key: 'promo.edit', label: 'Edit Promo Codes', description: 'Modify promo codes', enforced: true },
      { key: 'promo.delete', label: 'Delete Promo Codes', description: 'Remove promo codes', enforced: true },
    ]
  },
  {
    module: 'analytics',
    label: 'Analytics & Reports',
    icon: BarChart,
    color: 'text-blue-600',
    permissions: [
      { key: 'analytics.view', label: 'View Analytics', description: 'Access analytics' },
      { key: 'analytics.view_dashboard', label: 'Analytics Dashboard', description: 'Access analytics overview', enforced: true },
      { key: 'analytics.view_revenue', label: 'Revenue Analytics', description: 'Revenue breakdowns' },
      { key: 'analytics.view_bookings', label: 'Booking Analytics', description: 'Booking statistics' },
      { key: 'analytics.view_customers', label: 'Customer Analytics', description: 'Customer insights' },
      { key: 'analytics.export', label: 'Export Data', description: 'Export analytics data' },
    ]
  },
  {
    module: 'activity',
    label: 'Activity & Audit Logs',
    icon: History,
    color: 'text-amber-600',
    permissions: [
      { key: 'activity.view', label: 'View Activity Logs', description: 'See all activity logs', enforced: true },
      { key: 'activity.export', label: 'Export Logs', description: 'Download activity log data', enforced: true },
    ]
  },
  {
    module: 'validation',
    label: 'Validation Center',
    icon: QrCode,
    color: 'text-teal-600',
    permissions: [
      { key: 'validation.view', label: 'View Pending', description: 'See pending validations', enforced: true },
      { key: 'validation.approve', label: 'Approve', description: 'Approve pending items', enforced: true },
      { key: 'validation.reject', label: 'Reject', description: 'Reject pending items', enforced: true },
    ]
  },
  {
    module: 'access',
    label: 'Access Control',
    icon: Shield,
    color: 'text-red-600',
    permissions: [
      { key: 'access.view_roles', label: 'View Roles', description: 'See role list', enforced: true },
      { key: 'access.create_roles', label: 'Create Roles', description: 'Add custom roles', enforced: true },
      { key: 'access.edit_roles', label: 'Edit Roles', description: 'Modify role permissions', enforced: true },
      { key: 'access.delete_roles', label: 'Delete Roles', description: 'Remove custom roles', enforced: true },
      { key: 'access.assign_roles', label: 'Assign Roles', description: 'Assign roles to users', enforced: true },
      { key: 'access.view_permissions', label: 'View Permissions', description: 'See all permissions', enforced: true },
      { key: 'access.manage_permissions', label: 'Manage Permissions', description: 'Assign individual permissions', enforced: true },
    ]
  },
  {
    module: 'pods',
    label: 'Pod Management',
    icon: Users,
    color: 'text-indigo-600',
    permissions: [
      { key: 'pods.view', label: 'View Pods', description: 'See pod list', enforced: true },
      { key: 'pods.create', label: 'Create Pods', description: 'Add new pods', enforced: true },
      { key: 'pods.edit', label: 'Edit Pods', description: 'Modify pod details', enforced: true },
      { key: 'pods.delete', label: 'Delete Pods', description: 'Remove pods', enforced: true },
      { key: 'pods.manage_members', label: 'Manage Members', description: 'Add/remove pod members', enforced: true },
      { key: 'pods.manage_operators', label: 'Manage Operators', description: 'Assign operators to pods', enforced: true },
    ]
  },
  {
    module: 'employee_scopes',
    label: 'Access Scopes',
    icon: Globe,
    color: 'text-violet-600',
    permissions: [
      { key: 'employee_scopes.view', label: 'View Scopes', description: 'See access scopes', enforced: true },
      { key: 'employee_scopes.create', label: 'Create Scopes', description: 'Add access scopes', enforced: true },
      { key: 'employee_scopes.edit', label: 'Edit Scopes', description: 'Modify access scopes', enforced: true },
      { key: 'employee_scopes.delete', label: 'Delete Scopes', description: 'Remove access scopes', enforced: true },
      { key: 'employee_scopes.assign', label: 'Assign Scopes', description: 'Assign scopes to employees', enforced: true },
    ]
  },
  {
    module: 'geography',
    label: 'Geography',
    icon: Globe,
    color: 'text-green-600',
    permissions: [
      { key: 'geography.view', label: 'View Geography', description: 'See countries and regions' },
      { key: 'geography.create', label: 'Create Geography', description: 'Add countries/regions', enforced: true },
      { key: 'geography.edit', label: 'Edit Geography', description: 'Modify countries/regions', enforced: true },
      { key: 'geography.delete', label: 'Delete Geography', description: 'Remove countries/regions', enforced: true },
    ]
  },
  {
    module: 'commission',
    label: 'Commission',
    icon: CreditCard,
    color: 'text-green-600',
    permissions: [
      { key: 'commission.view', label: 'View Commission', description: 'See commission settings', enforced: true },
      { key: 'commission.edit', label: 'Edit Commission', description: 'Modify commission rates', enforced: true },
      { key: 'commission.process_payouts', label: 'Process Payouts', description: 'Process operator payouts' },
    ]
  },
  {
    module: 'settings',
    label: 'System Settings',
    icon: Settings,
    color: 'text-slate-600',
    permissions: [
      { key: 'settings.view', label: 'View Settings', description: 'See system settings' },
      { key: 'settings.edit', label: 'Edit Settings', description: 'Modify system settings' },
      { key: 'settings.manage_integrations', label: 'Manage Integrations', description: 'Configure integrations' },
      { key: 'settings.manage_notifications', label: 'Notification Settings', description: 'Configure notifications' },
      { key: 'settings.manage_branding', label: 'Branding Settings', description: 'Logo and theme settings' },
    ]
  },
  {
    module: 'support',
    label: 'Support',
    icon: HelpCircle,
    color: 'text-cyan-600',
    permissions: [
      { key: 'support.view_tickets', label: 'View Tickets', description: 'See support tickets' },
      { key: 'support.manage_tickets', label: 'Manage Tickets', description: 'Respond and close tickets' },
      { key: 'support.view_chat', label: 'View Chat', description: 'Access live chat' },
      { key: 'support.respond_chat', label: 'Respond Chat', description: 'Reply in live chat' },
    ]
  },
  {
    module: 'notifications',
    label: 'Notifications',
    icon: Bell,
    color: 'text-yellow-600',
    permissions: [
      { key: 'notifications.view', label: 'View Notifications', description: 'See notifications' },
      { key: 'notifications.send', label: 'Send Notifications', description: 'Send system notifications' },
      { key: 'notifications.manage_templates', label: 'Manage Templates', description: 'Edit notification templates' },
    ]
  },
];

// Default roles
const DEFAULT_ROLES = [
  { 
    id: 'super_admin', 
    name: 'Super Admin', 
    description: 'Full system access with all permissions',
    userCount: 1,
    isSystem: true,
    color: 'bg-red-100 text-red-700 border-red-200',
    permissions: PERMISSION_MODULES.flatMap(m => m.permissions.map(p => p.key))
  },
  { 
    id: 'admin', 
    name: 'Admin', 
    description: 'Administrative access excluding critical settings',
    userCount: 3,
    isSystem: true,
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    permissions: PERMISSION_MODULES.flatMap(m => m.permissions.map(p => p.key))
      .filter(p => !p.startsWith('settings.') && !p.startsWith('permissions.delete'))
  },
  { 
    id: 'operator', 
    name: 'Operator', 
    description: 'Service management and booking operations',
    userCount: 12,
    isSystem: true,
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    permissions: [
      'dashboard.view', 'dashboard.analytics',
      'services.browse', 'services.book',
      'orders.view_all', 'orders.edit', 'orders.cancel',
      'validation.view', 'validation.approve_tickets', 'validation.reject_tickets',
    ]
  },
  { 
    id: 'hotel_operator', 
    name: 'Hotel Operator', 
    description: 'Manage hotel listings and bookings',
    userCount: 5,
    isSystem: false,
    color: 'bg-purple-100 text-purple-700 border-purple-200',
    permissions: [
      'dashboard.view', 'hotels.view', 'hotels.create', 'hotels.edit', 
      'hotels.rooms', 'hotels.pricing', 'orders.view_all', 'analytics.dashboard'
    ]
  },
  { 
    id: 'travel_operator', 
    name: 'Travel Operator', 
    description: 'Manage travel routes and transport',
    userCount: 8,
    isSystem: false,
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    permissions: [
      'dashboard.view', 'travel.view', 'travel.create', 'travel.edit',
      'travel.vehicles', 'travel.scheduling', 'orders.view_all', 'analytics.dashboard'
    ]
  },
  { 
    id: 'customer_support', 
    name: 'Customer Support', 
    description: 'Handle customer inquiries and basic operations',
    userCount: 15,
    isSystem: false,
    color: 'bg-green-100 text-green-700 border-green-200',
    permissions: [
      'dashboard.view', 'services.browse', 'orders.view_all', 'orders.edit',
      'users.view', 'audit.view_own'
    ]
  },
  { 
    id: 'customer', 
    name: 'Customer', 
    description: 'Standard customer account',
    userCount: 1250,
    isSystem: true,
    color: 'bg-slate-100 text-slate-700 border-slate-200',
    permissions: [
      'dashboard.view', 'services.browse', 'services.book', 'services.search',
      'orders.view_own', 'orders.create', 'orders.cancel', 'audit.view_own'
    ]
  },
];

export default function Permissions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [roles, setRoles] = useState(DEFAULT_ROLES);
  const [users, setUsers] = useState([]);
  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin' || isSuperAdmin;
  const isRegularAdmin = user?.role === 'admin';
  // Admins can now access roles tab but with limited functionality
  const [activeTab, setActiveTab] = useState(isAdmin ? 'roles' : 'users');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isUserPermDialogOpen, setIsUserPermDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [roleDialogSearchQuery, setRoleDialogSearchQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState(null);

  // Audit Trail state
  const [auditTrail, setAuditTrail] = useState([]);
  const [auditStats, setAuditStats] = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditFilter, setAuditFilter] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: 'bg-slate-100 text-slate-700 border-slate-200',
    permissions: []
  });

  const [userPermissions, setUserPermissions] = useState([]);
  const [selectedUserRole, setSelectedUserRole] = useState('');
  const [selectedUserRoles, setSelectedUserRoles] = useState([]);

  // Permissions that Admins can assign (limited set)
  const ADMIN_ASSIGNABLE_PERMISSIONS = [
    'orders.view', 'orders.view_all', 'orders.edit', 'orders.cancel', 'orders.process',
    'loyalty.view',
    'activity.view',
    'validation.view', 'validation.approve', 'validation.reject',
    'analytics.view_dashboard',
    'users.view', 'users.create', 'users.edit', 'users.view_activity',
    'employees.view', 'employees.create', 'employees.edit', 'employees.delete',
    'operators.view', 'operators.create', 'operators.edit',
    'hotels.view', 'hotels.create', 'hotels.edit', 'hotels.delete', 'hotels.manage_rooms',
    'travel.view', 'travel.create', 'travel.edit', 'travel.delete',
    'car_rental.view', 'car_rental.create', 'car_rental.edit', 'car_rental.delete',
    'restaurants.view', 'restaurants.create', 'restaurants.edit', 'restaurants.delete', 'restaurants.manage_menu',
    'events.view', 'events.create', 'events.edit', 'events.delete',
    'pressing.view', 'pressing.create', 'pressing.edit', 'pressing.delete',
    'banquets.view', 'banquets.create', 'banquets.edit', 'banquets.delete',
    'cinema.view', 'cinema.create', 'cinema.edit', 'cinema.delete', 'cinema.manage_screenings',
    'packages.view', 'packages.create', 'packages.edit', 'packages.delete',
    'promo.view', 'promo.create', 'promo.edit',
    'pods.view', 'pods.create', 'pods.edit',
    'employee_scopes.view', 'employee_scopes.create', 'employee_scopes.edit',
    'geography.view', 'geography.create', 'geography.edit',
    'commission.view',
  ];

  // Filter permission modules for admins
  const getAvailablePermissionModules = () => {
    if (isSuperAdmin) {
      return PERMISSION_MODULES;
    }
    // For regular admins, filter to only show assignable permissions
    return PERMISSION_MODULES.map(module => ({
      ...module,
      permissions: module.permissions.filter(p => ADMIN_ASSIGNABLE_PERMISSIONS.includes(p.key))
    })).filter(module => module.permissions.length > 0);
  };

  // Fetch roles and users from backend
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch roles
        const rolesResponse = await api.get('/access/roles');
        if (rolesResponse.data.roles && rolesResponse.data.roles.length > 0) {
          setRoles(rolesResponse.data.roles);
        }
        
        // Fetch users for permission assignment
        const usersResponse = await api.get('/users/');
        if (usersResponse.data.users) {
          setUsers(usersResponse.data.users);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, []);

  // Load audit trail data
  const loadAuditTrail = async (page = 1) => {
    setAuditLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 30 });
      if (auditFilter) params.append('permission', auditFilter);
      const res = await api.get(`/access/audit-trail?${params}`);
      setAuditTrail(res.data.logs || []);
      setAuditTotal(res.data.total || 0);
      setAuditStats(res.data.stats || null);
      setAuditPage(page);
    } catch (error) {
      console.error('Failed to load audit trail:', error);
      setAuditTrail([]);
      setAuditStats(null);
    } finally {
      setAuditLoading(false);
    }
  };

  const handleOpenDialog = (role = null) => {
    if (role) {
      setEditingRole(role);
      setFormData({
        name: role.name,
        description: role.description,
        color: role.color,
        permissions: [...role.permissions]
      });
    } else {
      setEditingRole(null);
      setFormData({ 
        name: '', 
        description: '', 
        color: 'bg-slate-100 text-slate-700 border-slate-200',
        permissions: [] 
      });
    }
    setIsDialogOpen(true);
  };

  const handleOpenUserPermDialog = async (selectedUser) => {
    setEditingUser(selectedUser);
    setSelectedUserRole(selectedUser.role || 'user');
    // Set assigned roles from user data
    setSelectedUserRoles(selectedUser.assigned_roles || []);
    try {
      const response = await api.get(`/access/users/${selectedUser.id}/permissions`);
      setUserPermissions(response.data.custom_permissions || []);
      if (response.data.assigned_roles) {
        setSelectedUserRoles(response.data.assigned_roles);
      }
    } catch (error) {
      setUserPermissions(selectedUser.custom_permissions || []);
    }
    setIsUserPermDialogOpen(true);
  };

  const handlePermissionToggle = (permKey) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permKey)
        ? prev.permissions.filter(p => p !== permKey)
        : [...prev.permissions, permKey]
    }));
  };

  const handleModuleToggle = (module) => {
    const modulePerms = module.permissions.map(p => p.key);
    const allSelected = modulePerms.every(p => formData.permissions.includes(p));
    
    if (allSelected) {
      setFormData(prev => ({
        ...prev,
        permissions: prev.permissions.filter(p => !modulePerms.includes(p))
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        permissions: [...new Set([...prev.permissions, ...modulePerms])]
      }));
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Role name is required');
      return;
    }
    
    setIsSaving(true);
    try {
      if (editingRole) {
        // Update existing role
        await api.put(`/access/roles/${editingRole.id}`, {
          name: formData.name,
          description: formData.description,
          permissions: formData.permissions,
          color: formData.color
        });
        
        setRoles(prev => prev.map(r => r.id === editingRole.id ? {
          ...r,
          ...formData
        } : r));
        toast.success('Role updated successfully!');
      } else {
        // Create new role with JSON body
        const response = await api.post('/access/roles', {
          name: formData.name,
          description: formData.description,
          permissions: formData.permissions,
          color: formData.color
        });
        
        const newRole = response.data.role || {
          id: response.data.role_id,
          ...formData,
          userCount: 0,
          isSystem: false
        };
        setRoles(prev => [...prev, newRole]);
        toast.success('Role created successfully!');
      }

      setIsDialogOpen(false);
      setFormData({ 
        name: '', 
        description: '', 
        color: 'bg-slate-100 text-slate-700 border-slate-200',
        permissions: [] 
      });
    } catch (error) {
      console.error('Save error:', error);
      toast.error(error.response?.data?.detail || 'Failed to save role');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveUserPermissions = async () => {
    if (!editingUser) return;
    
    setIsSaving(true);
    try {
      // Save assigned roles instead of custom permissions
      await api.put(`/access/users/${editingUser.id}/permissions`, {
        assigned_roles: selectedUserRoles,
        permissions: [] // Clear custom permissions since we're using roles
      });
      
      // Update role if changed (only super_admin can assign admin/super_admin)
      if (selectedUserRole !== editingUser.role) {
        const canAssignRole = isSuperAdmin || 
          (isAdmin && !['admin', 'super_admin'].includes(selectedUserRole));
        
        if (canAssignRole) {
          await api.put(`/users/${editingUser.id}/role`, {
            role: selectedUserRole
          });
          toast.success(`User role updated to ${selectedUserRole}`);
        } else {
          toast.error('You do not have permission to assign this role');
        }
      }
      
      // Update local users state
      setUsers(prev => prev.map(u => u.id === editingUser.id ? {
        ...u,
        assigned_roles: selectedUserRoles,
        custom_permissions: [],
        role: selectedUserRole
      } : u));
      
      toast.success('User roles assigned successfully');
      setIsUserPermDialogOpen(false);
    } catch (error) {
      console.error('Save error:', error);
      toast.error(error.response?.data?.detail || 'Failed to update user roles');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUserPermissionToggle = (permKey) => {
    setUserPermissions(prev => 
      prev.includes(permKey)
        ? prev.filter(p => p !== permKey)
        : [...prev, permKey]
    );
  };

  // Toggle role assignment for users
  const handleUserRoleToggle = (roleId) => {
    setSelectedUserRoles(prev => 
      prev.includes(roleId)
        ? prev.filter(r => r !== roleId)
        : [...prev, roleId]
    );
  };

  // ── Drag & drop user → role assignment ─────────────────────────────────────
  const [draggingUserId, setDraggingUserId] = useState(null);
  const [hoverRoleId, setHoverRoleId] = useState(null);

  const assignRoleByDnd = async (userId, roleId) => {
    const targetUser = users.find(u => u.id === userId);
    const targetRole = roles.find(r => r.id === roleId);
    if (!targetUser || !targetRole) return;
    if ((targetUser.assigned_roles || []).includes(roleId)) {
      toast.info(`${targetUser.full_name || targetUser.email} already has the "${targetRole.name}" role`);
      return;
    }
    // Permission gate — block non-super-admins from assigning admin/super_admin
    if (!isSuperAdmin && ['admin', 'super_admin'].includes(roleId)) {
      toast.error('Only super admins can assign the admin or super admin role');
      return;
    }
    const nextRoles = [...(targetUser.assigned_roles || []), roleId];
    try {
      await api.put(`/access/users/${userId}/permissions`, {
        assigned_roles: nextRoles,
        permissions: [],
      });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, assigned_roles: nextRoles } : u));
      // Bump the role's user count in local state for an immediate visual update.
      setRoles(prev => prev.map(r => r.id === roleId ? { ...r, userCount: (r.userCount || r.user_count || 0) + 1 } : r));
      toast.success(`Assigned "${targetRole.name}" to ${targetUser.full_name || targetUser.email}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to assign role');
    }
  };

  // Get total permissions count from assigned roles
  const getTotalPermissionsFromRoles = (assignedRoleIds) => {
    const allPermissions = new Set();
    assignedRoleIds.forEach(roleId => {
      const role = roles.find(r => r.id === roleId);
      if (role) {
        role.permissions.forEach(p => allPermissions.add(p));
      }
    });
    return allPermissions.size;
  };

  // Get available modules based on user role
  const availableModules = getAvailablePermissionModules();

  // Filter permissions in role dialog based on search and user role
  const filteredRoleDialogModules = availableModules.filter(module =>
    roleDialogSearchQuery === '' ||
    module.label.toLowerCase().includes(roleDialogSearchQuery.toLowerCase()) ||
    module.permissions.some(p => 
      p.label.toLowerCase().includes(roleDialogSearchQuery.toLowerCase()) ||
      p.key.toLowerCase().includes(roleDialogSearchQuery.toLowerCase())
    )
  ).map(module => ({
    ...module,
    permissions: roleDialogSearchQuery === '' 
      ? module.permissions 
      : module.permissions.filter(p =>
          p.label.toLowerCase().includes(roleDialogSearchQuery.toLowerCase()) ||
          p.key.toLowerCase().includes(roleDialogSearchQuery.toLowerCase()) ||
          module.label.toLowerCase().includes(roleDialogSearchQuery.toLowerCase())
        )
  })).filter(module => module.permissions.length > 0);

  const handleDelete = async (id) => {
    const role = roles.find(r => r.id === id);
    if (role?.isSystem) {
      toast.error('System roles cannot be deleted');
      return;
    }
    if (!confirm(`Are you sure you want to delete the "${role?.name}" role?`)) return;
    
    try {
      await api.delete(`/access/roles/${id}`);
      setRoles(prev => prev.filter(r => r.id !== id));
      toast.success('Role deleted');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete role');
    }
  };

  const getModulePermissionCount = (module, selectedPerms) => {
    const modulePerms = module.permissions.map(p => p.key);
    const selected = modulePerms.filter(p => selectedPerms.includes(p)).length;
    return `${selected}/${modulePerms.length}`;
  };

  const filteredModules = availableModules.filter(module => 
    searchQuery === '' || 
    module.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    module.permissions.some(p => p.label.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Parent nav */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#082c59] mb-1">User Management</h1>
          <p className="text-slate-500">Manage system users, roles, and permissions</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2 bg-[#082c59] hover:bg-[#0a3a75]">
          <Plus className="h-4 w-4" />
          Create Role
        </Button>
      </div>
      <div>
        <Tabs value={location.pathname.includes('/permissions') ? 'permissions' : 'users'} onValueChange={(v) => {
          if (v === 'users') navigate('/admin/users');
          else if (v === 'permissions') navigate('/admin/users/permissions');
        }}>
          <TabsList className="grid w-full grid-cols-2 mb-6 bg-slate-100">
            <TabsTrigger value="users" className="flex items-center gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white" data-testid="tab-users">
              <Users className="w-4 h-4" />Users
            </TabsTrigger>
            <TabsTrigger value="permissions" className="flex items-center gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white" data-testid="tab-permissions">
              <ShieldCheck className="w-4 h-4" />Permissions
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500 rounded-lg">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-900">{roles.length}</p>
                <p className="text-sm text-blue-700">Total Roles</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-green-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500 rounded-lg">
                <Key className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-900">
                  {PERMISSION_MODULES.reduce((sum, m) => sum + m.permissions.length, 0)}
                </p>
                <p className="text-sm text-green-700">Total Permissions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500 rounded-lg">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-900">
                  {roles.reduce((sum, r) => sum + (r.userCount || r.user_count || 0), 0)}
                </p>
                <p className="text-sm text-purple-700">Users Assigned</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500 rounded-lg">
                <Database className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-900">{PERMISSION_MODULES.length}</p>
                <p className="text-sm text-amber-700">Modules</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); if (v === 'audit-trail') loadAuditTrail(); }}>
        <TabsList className={`grid w-full ${isSuperAdmin ? 'grid-cols-5' : 'grid-cols-2'} mb-6 bg-slate-100`}>
          <TabsTrigger value="roles" className="flex items-center gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white">
            <Shield className="h-4 w-4" />
            Roles ({roles.length})
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white">
            <UserCog className="h-4 w-4" />
            User Permissions
          </TabsTrigger>
          {isSuperAdmin && (
            <TabsTrigger value="permissions" className="flex items-center gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white">
              <Key className="h-4 w-4" />
              Matrix
            </TabsTrigger>
          )}
          {isSuperAdmin && (
            <TabsTrigger value="audit-trail" className="flex items-center gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white">
              <ShieldAlert className="h-4 w-4" />
              Audit Trail
            </TabsTrigger>
          )}
          {isSuperAdmin && (
            <TabsTrigger value="audit-logs" className="flex items-center gap-2 data-[state=active]:bg-[#082c59] data-[state=active]:text-white">
              <History className="h-4 w-4" />
              Audit Logs
            </TabsTrigger>
          )}
        </TabsList>

        {/* Roles Tab - Available to both Admin and Super Admin */}
        <TabsContent value="roles" className="mt-6">
          {/* Admin notice for limited access */}
          {isRegularAdmin && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
              <Shield className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium text-blue-900">Limited Role Management</p>
                <p className="text-sm text-blue-700">You can create and edit custom roles. System roles cannot be modified.</p>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6" data-testid="dnd-roles-tab">
            {/* Role cards — drop targets */}
            <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {roles.map((role) => {
              const isHover = hoverRoleId === role.id;
              const canDrop = !!draggingUserId && (isSuperAdmin || !['admin', 'super_admin'].includes(role.id));
              return (
              <Card
                key={role.id}
                onDragOver={(e) => { if (draggingUserId) { e.preventDefault(); e.dataTransfer.dropEffect = canDrop ? 'copy' : 'none'; setHoverRoleId(role.id); } }}
                onDragLeave={() => { if (hoverRoleId === role.id) setHoverRoleId(null); }}
                onDrop={(e) => {
                  e.preventDefault();
                  const uid = e.dataTransfer.getData('text/x-user-id') || draggingUserId;
                  setHoverRoleId(null);
                  setDraggingUserId(null);
                  if (uid && canDrop) assignRoleByDnd(uid, role.id);
                }}
                className={`relative overflow-hidden transition-all ${isHover && canDrop ? 'ring-2 ring-emerald-500 ring-offset-2 shadow-xl bg-emerald-50/50' : isHover && !canDrop ? 'ring-2 ring-red-300 ring-offset-2' : 'hover:shadow-lg'}`}
                data-testid={`role-drop-target-${role.id}`}
              >
                {role.isSystem && (
                  <div className="absolute top-0 right-0 bg-[#082c59] text-white text-xs px-3 py-1 rounded-bl-lg">
                    System
                  </div>
                )}
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Badge className={role.color}>{role.name}</Badge>
                      </CardTitle>
                      <CardDescription className="mt-2">{role.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-2">
                  <div className="flex items-center gap-4 text-sm text-slate-600">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>{role.userCount || role.user_count || 0} users</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Key className="h-4 w-4" />
                      <span>{role.permissions.length} permissions</span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-xs font-medium text-slate-500 uppercase mb-2">Access To</p>
                    <div className="flex flex-wrap gap-1">
                      {PERMISSION_MODULES.filter(m => 
                        m.permissions.some(p => role.permissions.includes(p.key))
                      ).slice(0, 5).map((module) => {
                        const IconComp = module.icon;
                        return (
                          <Badge key={module.module} variant="outline" className="gap-1 text-xs">
                            <IconComp className={`h-3 w-3 ${module.color}`} />
                            {module.label}
                          </Badge>
                        );
                      })}
                      {PERMISSION_MODULES.filter(m => 
                        m.permissions.some(p => role.permissions.includes(p.key))
                      ).length > 5 && (
                        <Badge variant="outline" className="text-xs">
                          +{PERMISSION_MODULES.filter(m => 
                            m.permissions.some(p => role.permissions.includes(p.key))
                          ).length - 5} more
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Drag hint when a user is being dragged */}
                  {draggingUserId && (
                    <div className={`mt-3 rounded-lg border-2 border-dashed p-2 text-center text-xs font-medium ${canDrop ? 'border-emerald-400 text-emerald-700 bg-emerald-50' : 'border-red-300 text-red-600 bg-red-50'}`}>
                      {canDrop ? 'Drop to assign this role' : 'Only super admins can assign'}
                    </div>
                  )}
                </CardContent>
                <CardFooter className="pt-2 border-t">
                  <div className="flex justify-end gap-2 w-full">
                    {/* Admin can only edit non-system roles */}
                    {(isSuperAdmin || !role.isSystem) && (
                      <Button variant="outline" size="sm" onClick={() => handleOpenDialog(role)}>
                        <Edit className="h-4 w-4 mr-1" /> Edit
                      </Button>
                    )}
                    {/* Only super admin or non-system roles can be deleted */}
                    {!role.isSystem && (isSuperAdmin || !role.isSystem) && (
                      <Button variant="outline" size="sm" className="text-red-600" onClick={() => handleDelete(role.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardFooter>
              </Card>
            );})}
            </div>

            {/* Draggable Users Sidebar */}
            <aside className="lg:col-span-1" data-testid="dnd-users-sidebar">
              <Card className="lg:sticky lg:top-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><UserCog className="h-4 w-4 text-[#082c59]" /> Drag users → role</CardTitle>
                  <CardDescription className="text-xs">Drop any user onto a role card to assign it. Existing roles are kept.</CardDescription>
                  <div className="relative mt-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      placeholder="Search users…"
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className="pl-8 bg-white h-8 text-xs"
                      data-testid="dnd-user-search"
                    />
                  </div>
                </CardHeader>
                <CardContent className="pt-2 max-h-[60vh] overflow-y-auto space-y-1.5">
                  {users
                    .filter(u =>
                      userSearchQuery === '' ||
                      u.email?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                      u.full_name?.toLowerCase().includes(userSearchQuery.toLowerCase())
                    )
                    .slice(0, 80)
                    .map(u => {
                    const isDragging = draggingUserId === u.id;
                    return (
                      <div
                        key={u.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = 'copy';
                          e.dataTransfer.setData('text/x-user-id', u.id);
                          setDraggingUserId(u.id);
                        }}
                        onDragEnd={() => { setDraggingUserId(null); setHoverRoleId(null); }}
                        className={`group flex items-center gap-2 p-2 rounded-lg border bg-white cursor-grab active:cursor-grabbing transition ${isDragging ? 'opacity-50 border-dashed border-emerald-400' : 'border-slate-200 hover:border-[#082c59] hover:shadow-sm'}`}
                        title={`Drag ${u.full_name || u.email} onto a role card`}
                        data-testid={`draggable-user-${u.id}`}
                      >
                        <div className="w-7 h-7 rounded-full bg-[#082c59]/10 flex items-center justify-center flex-shrink-0">
                          <Users className="h-3.5 w-3.5 text-[#082c59]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-900 truncate">{u.full_name || u.email}</p>
                          <p className="text-[10px] text-slate-500 truncate">{u.email}</p>
                        </div>
                        <Badge variant="outline" className="text-[9px] capitalize px-1.5 py-0">{(u.assigned_roles?.length || 0)}</Badge>
                      </div>
                    );
                  })}
                  {users.length === 0 && !isLoading && (
                    <p className="text-center text-xs text-slate-400 py-4">No users available</p>
                  )}
                </CardContent>
              </Card>
            </aside>
          </div>
        </TabsContent>

        {/* User Permissions Tab */}
        <TabsContent value="users" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>User Role Assignment</CardTitle>
                  <CardDescription>Assign roles to users - each role contains a set of permissions</CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search users..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="pl-10 bg-white"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-[#082c59]" />
                </div>
              ) : (
                <div className="space-y-2">
                  {users
                    .filter(u => 
                      userSearchQuery === '' ||
                      u.email?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                      u.full_name?.toLowerCase().includes(userSearchQuery.toLowerCase())
                    )
                    .map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-[#082c59]/10 flex items-center justify-center">
                          <Users className="h-5 w-5 text-[#082c59]" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{u.full_name || u.email}</p>
                          <p className="text-sm text-slate-500">{u.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge className={
                          u.role === 'super_admin' ? 'bg-red-100 text-red-700' :
                          u.role === 'admin' ? 'bg-amber-100 text-amber-700' :
                          u.role === 'operator' ? 'bg-blue-100 text-blue-700' :
                          'bg-slate-100 text-slate-700'
                        }>
                          {u.role}
                        </Badge>
                        <div className="text-sm text-slate-500">
                          {(u.assigned_roles?.length || 0)} roles assigned
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenUserPermDialog(u)}
                          disabled={u.role === 'super_admin' && !isSuperAdmin}
                        >
                          <Shield className="h-4 w-4 mr-1" />
                          Assign Roles
                        </Button>
                      </div>
                    </div>
                  ))}
                  {users.length === 0 && (
                    <div className="text-center py-12 text-slate-500">
                      No users found
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Permission Matrix Tab - Super Admin Only */}
        {isSuperAdmin && (
        <TabsContent value="permissions" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Permission Matrix</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search permissions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-white"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredModules.map((module) => {
                  const IconComp = module.icon;
                  return (
                    <div key={module.module} className="border rounded-lg overflow-hidden">
                      <button
                        onClick={() => setSelectedModule(selectedModule === module.module ? null : module.module)}
                        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <IconComp className={`h-5 w-5 ${module.color}`} />
                          <span className="font-medium">{module.label}</span>
                          <Badge variant="outline">{module.permissions.length} permissions</Badge>
                        </div>
                        <ChevronRight className={`h-5 w-5 text-slate-400 transition-transform ${
                          selectedModule === module.module ? 'rotate-90' : ''
                        }`} />
                      </button>
                      
                      {selectedModule === module.module && (
                        <div className="p-4 bg-white border-t">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b">
                                  <th className="text-left p-2 font-medium text-slate-600">Permission</th>
                                  {roles.slice(0, 5).map(role => (
                                    <th key={role.id} className="text-center p-2 font-medium text-slate-600 min-w-[100px]">
                                      <Badge className={`${role.color} text-xs`}>{role.name}</Badge>
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {module.permissions.map((perm) => (
                                  <tr key={perm.key} className="border-b last:border-0">
                                    <td className="p-2">
                                      <div className="flex items-center gap-2">
                                        <div>
                                          <p className="font-medium text-slate-900">{perm.label}</p>
                                          <p className="text-xs text-slate-500">{perm.description}</p>
                                        </div>
                                        {perm.enforced && <Badge className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0 h-4 shrink-0">API</Badge>}
                                      </div>
                                    </td>
                                    {roles.slice(0, 5).map(role => (
                                      <td key={role.id} className="text-center p-2">
                                        {role.permissions.includes(perm.key) ? (
                                          <Check className="h-5 w-5 text-green-600 mx-auto" />
                                        ) : (
                                          <X className="h-5 w-5 text-slate-300 mx-auto" />
                                        )}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {/* Audit Trail Tab */}
        {isSuperAdmin && (
        <TabsContent value="audit-trail" className="mt-6 space-y-6">
          {/* Stats Cards */}
          {auditStats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-gradient-to-br from-red-50 to-red-100/50 border-red-200">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-red-100 rounded-xl"><ShieldAlert className="h-5 w-5 text-red-600" /></div>
                    <div>
                      <p className="text-2xl font-bold text-red-700">{auditStats.total_denials?.toLocaleString()}</p>
                      <p className="text-xs text-red-600 font-medium">Total Denials</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-slate-200">
                <CardContent className="p-5">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Top Blocked Users</p>
                  <div className="space-y-2">
                    {(auditStats.top_denied_users || []).slice(0, 3).map((u, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-sm text-slate-700 truncate max-w-[180px]">{u.email}</span>
                        <Badge variant="outline" className="text-xs text-red-600 border-red-200">{u.count}</Badge>
                      </div>
                    ))}
                    {(!auditStats.top_denied_users || auditStats.top_denied_users.length === 0) && (
                      <p className="text-xs text-slate-400">No data yet</p>
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-slate-200">
                <CardContent className="p-5">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Most Blocked Permissions</p>
                  <div className="space-y-2">
                    {(auditStats.top_denied_permissions || []).slice(0, 3).map((p, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <code className="text-xs text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded truncate max-w-[180px]">{p.permission}</code>
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-200">{p.count}</Badge>
                      </div>
                    ))}
                    {(!auditStats.top_denied_permissions || auditStats.top_denied_permissions.length === 0) && (
                      <p className="text-xs text-slate-400">No data yet</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Audit Log Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-red-500" /> Permission Denial Log</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative w-56">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Filter by permission..."
                      value={auditFilter}
                      onChange={(e) => setAuditFilter(e.target.value)}
                      className="pl-10 bg-white text-sm"
                      data-testid="audit-filter-input"
                    />
                  </div>
                  <Button variant="outline" size="sm" onClick={() => loadAuditTrail(1)} data-testid="audit-refresh-btn">
                    <Search className="h-4 w-4 mr-1" /> Search
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {auditLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
              ) : auditTrail.length === 0 ? (
                <div className="text-center py-12">
                  <ShieldCheck className="h-12 w-12 text-emerald-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">No permission denials recorded</p>
                  <p className="text-xs text-slate-400 mt-1">All access attempts have been authorized</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="audit-trail-table">
                      <thead>
                        <tr className="border-b bg-slate-50">
                          <th className="text-left py-3 px-3 text-xs font-semibold text-slate-600 uppercase">Time</th>
                          <th className="text-left py-3 px-3 text-xs font-semibold text-slate-600 uppercase">User</th>
                          <th className="text-left py-3 px-3 text-xs font-semibold text-slate-600 uppercase">Role</th>
                          <th className="text-left py-3 px-3 text-xs font-semibold text-slate-600 uppercase">Required Permissions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditTrail.map((log, i) => (
                          <tr key={i} className="border-b hover:bg-red-50/30 transition-colors">
                            <td className="py-3 px-3 text-xs text-slate-500 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <Clock className="h-3 w-3 text-slate-400" />
                                {log.timestamp ? new Date(log.timestamp).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <p className="font-medium text-slate-900 text-sm">{log.user_email}</p>
                            </td>
                            <td className="py-3 px-3">
                              <Badge variant="outline" className="text-xs capitalize">{log.user_role}</Badge>
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex flex-wrap gap-1">
                                {(log.required_permissions || []).map((p, j) => (
                                  <code key={j} className="text-xs bg-red-50 text-red-700 px-1.5 py-0.5 rounded border border-red-200">{p}</code>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Pagination */}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-slate-500">{auditTotal} total denials</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={auditPage <= 1} onClick={() => loadAuditTrail(auditPage - 1)}>Previous</Button>
                      <Button variant="outline" size="sm" disabled={auditPage * 30 >= auditTotal} onClick={() => loadAuditTrail(auditPage + 1)}>Next</Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {/* Audit Logs Tab - Embedded Component */}
        {isSuperAdmin && (
        <TabsContent value="audit-logs" className="mt-6">
          <AuditLogs />
        </TabsContent>
        )}
      </Tabs>

      {/* Create/Edit Role Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#082c59] flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {editingRole ? 'Edit Role' : 'Create New Role'}
            </DialogTitle>
            <DialogDescription>Configure role details and assign permissions</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Role Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Hotel Manager"
                  className="bg-white mt-1"
                />
              </div>
              <div>
                <Label>Color Theme</Label>
                <select
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-full mt-1 p-2 border rounded-lg bg-white"
                >
                  <option value="bg-slate-100 text-slate-700 border-slate-200">Gray</option>
                  <option value="bg-blue-100 text-blue-700 border-blue-200">Blue</option>
                  <option value="bg-green-100 text-green-700 border-green-200">Green</option>
                  <option value="bg-purple-100 text-purple-700 border-purple-200">Purple</option>
                  <option value="bg-amber-100 text-amber-700 border-amber-200">Amber</option>
                  <option value="bg-red-100 text-red-700 border-red-200">Red</option>
                </select>
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of this role"
                className="bg-white mt-1"
              />
            </div>

            <Separator />

            {/* Permissions */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <Label className="text-base">Permissions</Label>
                <Badge variant="outline">
                  {formData.permissions.length} selected
                </Badge>
              </div>

              {/* Search box for permissions */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search permissions (e.g., 'hotels', 'create', 'view')..."
                  value={roleDialogSearchQuery}
                  onChange={(e) => setRoleDialogSearchQuery(e.target.value)}
                  className="pl-10 bg-white"
                />
                {roleDialogSearchQuery && (
                  <button
                    onClick={() => setRoleDialogSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {roleDialogSearchQuery && (
                <p className="text-sm text-slate-500 mb-3">
                  Found {filteredRoleDialogModules.reduce((sum, m) => sum + m.permissions.length, 0)} permissions in {filteredRoleDialogModules.length} modules
                </p>
              )}
              
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredRoleDialogModules.map((module) => {
                  const IconComp = module.icon;
                  // Get original module perms for toggle functionality
                  const originalModule = PERMISSION_MODULES.find(m => m.module === module.module);
                  const modulePerms = originalModule.permissions.map(p => p.key);
                  const selectedCount = modulePerms.filter(p => formData.permissions.includes(p)).length;
                  const allSelected = selectedCount === originalModule.permissions.length;
                  const someSelected = selectedCount > 0 && !allSelected;

                  return (
                    <div key={module.module} className="border rounded-lg overflow-hidden">
                      <div
                        className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
                          allSelected ? 'bg-blue-50' : someSelected ? 'bg-amber-50' : 'bg-slate-50'
                        }`}
                        onClick={() => handleModuleToggle(originalModule)}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox 
                            checked={allSelected}
                            className={someSelected ? 'bg-amber-500' : ''}
                          />
                          <IconComp className={`h-5 w-5 ${module.color}`} />
                          <span className="font-medium">{module.label}</span>
                        </div>
                        <Badge variant="outline">{getModulePermissionCount(originalModule, formData.permissions)}</Badge>
                      </div>
                      
                      <div className="p-3 bg-white space-y-2">
                        {module.permissions.map((perm) => {
                          const isChecked = formData.permissions.includes(perm.key);
                          return (
                            <div
                              key={perm.key}
                              className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                                isChecked ? 'bg-blue-50' : 'hover:bg-slate-50'
                              }`}
                              onClick={() => handlePermissionToggle(perm.key)}
                            >
                              <Checkbox checked={isChecked} />
                              <div className="flex-1">
                                <p className="text-sm font-medium">{perm.label}</p>
                                <p className="text-xs text-slate-500">{perm.description}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {filteredRoleDialogModules.length === 0 && roleDialogSearchQuery && (
                  <div className="text-center py-8 text-slate-500">
                    No permissions found matching &quot;{roleDialogSearchQuery}&quot;
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving || !formData.name} className="bg-[#082c59] hover:bg-[#0a3a75]">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {editingRole ? 'Update Role' : 'Create Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Permissions Dialog */}
      <Dialog open={isUserPermDialogOpen} onOpenChange={setIsUserPermDialogOpen}>
        <DialogContent className="max-w-3xl bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#082c59] flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              Assign Roles: {editingUser?.full_name || editingUser?.email}
            </DialogTitle>
            <DialogDescription>
              Assign roles to this user. Each role contains a predefined set of permissions.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {/* User Info */}
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg mb-6">
              <div className="w-12 h-12 rounded-full bg-[#082c59]/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-[#082c59]" />
              </div>
              <div>
                <p className="font-medium text-slate-900">{editingUser?.full_name || 'No Name'}</p>
                <p className="text-sm text-slate-500">{editingUser?.email}</p>
              </div>
              <Badge className={
                editingUser?.role === 'super_admin' ? 'bg-red-100 text-red-700 ml-auto' :
                editingUser?.role === 'admin' ? 'bg-amber-100 text-amber-700 ml-auto' :
                editingUser?.role === 'operator' ? 'bg-blue-100 text-blue-700 ml-auto' :
                'bg-slate-100 text-slate-700 ml-auto'
              }>
                {editingUser?.role}
              </Badge>
            </div>

            {/* System Role Assignment Section */}
            <div className="mb-6 p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <UserCheck className="h-5 w-5 text-[#082c59]" />
                <Label className="text-base font-semibold">System Role</Label>
              </div>
              <p className="text-sm text-slate-500 mb-3">
                {isSuperAdmin 
                  ? 'As Super Admin, you can assign any system role including Admin and Super Admin.' 
                  : 'You can assign system roles up to Admin level (requires Super Admin for higher).'}
              </p>
              <Select 
                value={selectedUserRole} 
                onValueChange={setSelectedUserRole}
                disabled={!isSuperAdmin && ['super_admin'].includes(editingUser?.role)}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select system role" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {SYSTEM_ROLES.map(role => (
                    <SelectItem 
                      key={role.value} 
                      value={role.value}
                      disabled={
                        !isSuperAdmin && ['admin', 'super_admin'].includes(role.value)
                      }
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{role.label}</span>
                        <span className="text-xs text-slate-500">- {role.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedUserRole !== editingUser?.role && (
                <p className="text-sm text-amber-600 mt-2 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  Role will change from &quot;{editingUser?.role}&quot; to &quot;{selectedUserRole}&quot;
                </p>
              )}
            </div>

            {/* Role Assignment Section */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <Label className="text-base font-semibold">Assign Permission Roles</Label>
                <p className="text-sm text-slate-500 mt-1">Select roles to grant their permissions to this user</p>
              </div>
              <Badge variant="outline" className="gap-1">
                <Key className="h-3 w-3" />
                {getTotalPermissionsFromRoles(selectedUserRoles)} permissions
              </Badge>
            </div>
            
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {roles.filter(r => !r.isSystem || ['operator', 'customer'].includes(r.id)).map((role) => {
                const isSelected = selectedUserRoles.includes(role.id);
                return (
                  <div 
                    key={role.id} 
                    className={`border rounded-lg overflow-hidden cursor-pointer transition-all ${
                      isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'hover:border-slate-300'
                    }`}
                    onClick={() => handleUserRoleToggle(role.id)}
                  >
                    <div className={`flex items-center justify-between p-4 ${isSelected ? 'bg-blue-50' : 'bg-white'}`}>
                      <div className="flex items-center gap-3">
                        <Checkbox checked={isSelected} />
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge className={role.color}>{role.name}</Badge>
                            {role.isSystem && (
                              <Badge variant="outline" className="text-xs">System</Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-500 mt-1">{role.description}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-sm text-slate-600">
                          <Key className="h-4 w-4" />
                          <span>{role.permissions.length} permissions</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                          <Users className="h-3 w-3" />
                          <span>{role.userCount} users</span>
                        </div>
                      </div>
                    </div>
                    
                    {isSelected && (
                      <div className="p-3 bg-blue-50/50 border-t border-blue-200">
                        <p className="text-xs font-medium text-slate-500 uppercase mb-2">Included Modules</p>
                        <div className="flex flex-wrap gap-1">
                          {PERMISSION_MODULES.filter(m => 
                            m.permissions.some(p => role.permissions.includes(p.key))
                          ).slice(0, 8).map((module) => {
                            const IconComp = module.icon;
                            return (
                              <Badge key={module.module} variant="outline" className="gap-1 text-xs bg-white">
                                <IconComp className={`h-3 w-3 ${module.color}`} />
                                {module.label}
                              </Badge>
                            );
                          })}
                          {PERMISSION_MODULES.filter(m => 
                            m.permissions.some(p => role.permissions.includes(p.key))
                          ).length > 8 && (
                            <Badge variant="outline" className="text-xs bg-white">
                              +{PERMISSION_MODULES.filter(m => 
                                m.permissions.some(p => role.permissions.includes(p.key))
                              ).length - 8} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              
              {roles.filter(r => !r.isSystem || ['operator', 'customer'].includes(r.id)).length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  <Shield className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                  <p>No custom roles available</p>
                  <p className="text-sm mt-1">Create roles in the Roles tab first</p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUserPermDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveUserPermissions} disabled={isSaving} className="bg-[#082c59] hover:bg-[#0a3a75]">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Roles
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
