import React, { useState, useEffect } from 'react';
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
  ChevronRight, ChevronDown, UserCheck
} from 'lucide-react';
import api from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Available system roles for assignment
const SYSTEM_ROLES = [
  { value: 'user', label: 'User', description: 'Basic user access' },
  { value: 'employee', label: 'Employee', description: 'Employee access with limited features' },
  { value: 'operator', label: 'Operator', description: 'Service operator with management access' },
  { value: 'admin', label: 'Admin', description: 'Administrative access to most features' },
  { value: 'super_admin', label: 'Super Admin', description: 'Full system access' }
];

// Comprehensive permission categories organized by module
const PERMISSION_MODULES = [
  {
    module: 'dashboard',
    label: 'Dashboard & Overview',
    icon: LayoutDashboard,
    color: 'text-blue-600',
    permissions: [
      { key: 'dashboard.view', label: 'View Dashboard', description: 'Access main dashboard' },
      { key: 'dashboard.analytics', label: 'View Analytics', description: 'See analytics data' },
      { key: 'dashboard.reports', label: 'View Reports', description: 'Access report summaries' },
      { key: 'dashboard.widgets', label: 'Customize Widgets', description: 'Add/remove dashboard widgets' },
      { key: 'dashboard.export', label: 'Export Dashboard', description: 'Export dashboard data' },
    ]
  },
  {
    module: 'services',
    label: 'Service Browsing',
    icon: ShoppingBag,
    color: 'text-green-600',
    permissions: [
      { key: 'services.browse', label: 'Browse Services', description: 'View all services' },
      { key: 'services.book', label: 'Make Bookings', description: 'Create new bookings' },
      { key: 'services.search', label: 'Search Services', description: 'Use search functionality' },
      { key: 'services.compare', label: 'Compare Services', description: 'Compare multiple services' },
      { key: 'services.reviews', label: 'Write Reviews', description: 'Submit service reviews' },
      { key: 'services.wishlist', label: 'Manage Wishlist', description: 'Save services to wishlist' },
    ]
  },
  {
    module: 'hotels',
    label: 'Hotels Management',
    icon: Hotel,
    color: 'text-purple-600',
    permissions: [
      { key: 'hotels.view', label: 'View Hotels', description: 'See hotel listings' },
      { key: 'hotels.create', label: 'Create Hotels', description: 'Add new hotels' },
      { key: 'hotels.edit', label: 'Edit Hotels', description: 'Modify hotel details' },
      { key: 'hotels.delete', label: 'Delete Hotels', description: 'Remove hotels' },
      { key: 'hotels.rooms', label: 'Manage Rooms', description: 'Manage hotel rooms' },
      { key: 'hotels.pricing', label: 'Manage Pricing', description: 'Set room prices' },
      { key: 'hotels.availability', label: 'Manage Availability', description: 'Set room availability' },
      { key: 'hotels.amenities', label: 'Manage Amenities', description: 'Configure hotel amenities' },
      { key: 'hotels.photos', label: 'Manage Photos', description: 'Upload/delete hotel photos' },
      { key: 'hotels.promotions', label: 'Manage Promotions', description: 'Create hotel promotions' },
      { key: 'hotels.reviews', label: 'Manage Reviews', description: 'Moderate hotel reviews' },
    ]
  },
  {
    module: 'travel',
    label: 'Travel & Transport',
    icon: Bus,
    color: 'text-blue-600',
    permissions: [
      { key: 'travel.view', label: 'View Routes', description: 'See travel routes' },
      { key: 'travel.create', label: 'Create Routes', description: 'Add new routes' },
      { key: 'travel.edit', label: 'Edit Routes', description: 'Modify route details' },
      { key: 'travel.delete', label: 'Delete Routes', description: 'Remove routes' },
      { key: 'travel.vehicles', label: 'Manage Vehicles', description: 'Manage vehicle fleet' },
      { key: 'travel.scheduling', label: 'Manage Schedules', description: 'Set departure times' },
      { key: 'travel.pricing', label: 'Manage Pricing', description: 'Set ticket prices' },
      { key: 'travel.seats', label: 'Manage Seats', description: 'Configure seat layouts' },
      { key: 'travel.drivers', label: 'Manage Drivers', description: 'Assign drivers to routes' },
      { key: 'travel.tracking', label: 'Live Tracking', description: 'Access vehicle tracking' },
    ]
  },
  {
    module: 'car_rental',
    label: 'Car Rental',
    icon: Car,
    color: 'text-emerald-600',
    permissions: [
      { key: 'car_rental.view', label: 'View Cars', description: 'See car listings' },
      { key: 'car_rental.create', label: 'Add Cars', description: 'Add new vehicles' },
      { key: 'car_rental.edit', label: 'Edit Cars', description: 'Modify car details' },
      { key: 'car_rental.delete', label: 'Delete Cars', description: 'Remove vehicles' },
      { key: 'car_rental.availability', label: 'Manage Availability', description: 'Set availability' },
      { key: 'car_rental.pricing', label: 'Manage Pricing', description: 'Set rental prices' },
      { key: 'car_rental.maintenance', label: 'Manage Maintenance', description: 'Track vehicle maintenance' },
      { key: 'car_rental.insurance', label: 'Manage Insurance', description: 'Configure insurance options' },
      { key: 'car_rental.drivers', label: 'Manage Drivers', description: 'Optional driver services' },
    ]
  },
  {
    module: 'restaurants',
    label: 'Restaurants',
    icon: Utensils,
    color: 'text-orange-600',
    permissions: [
      { key: 'restaurants.view', label: 'View Restaurants', description: 'See restaurant listings' },
      { key: 'restaurants.create', label: 'Create Restaurants', description: 'Add new restaurants' },
      { key: 'restaurants.edit', label: 'Edit Restaurants', description: 'Modify restaurant details' },
      { key: 'restaurants.delete', label: 'Delete Restaurants', description: 'Remove restaurants' },
      { key: 'restaurants.menu', label: 'Manage Menu', description: 'Edit menu items' },
      { key: 'restaurants.reservations', label: 'Manage Reservations', description: 'Handle bookings' },
      { key: 'restaurants.tables', label: 'Manage Tables', description: 'Configure seating' },
      { key: 'restaurants.hours', label: 'Manage Hours', description: 'Set operating hours' },
      { key: 'restaurants.promotions', label: 'Manage Promotions', description: 'Create special offers' },
    ]
  },
  {
    module: 'events',
    label: 'Events Management',
    icon: Calendar,
    color: 'text-pink-600',
    permissions: [
      { key: 'events.view', label: 'View Events', description: 'See event listings' },
      { key: 'events.create', label: 'Create Events', description: 'Add new events' },
      { key: 'events.edit', label: 'Edit Events', description: 'Modify event details' },
      { key: 'events.delete', label: 'Delete Events', description: 'Remove events' },
      { key: 'events.tickets', label: 'Manage Tickets', description: 'Handle ticket sales' },
      { key: 'events.pricing', label: 'Manage Pricing', description: 'Set ticket prices' },
      { key: 'events.capacity', label: 'Manage Capacity', description: 'Set event capacity' },
      { key: 'events.checkin', label: 'Check-in Attendees', description: 'Manage event check-in' },
      { key: 'events.promotions', label: 'Manage Promotions', description: 'Create event promotions' },
    ]
  },
  {
    module: 'cinema',
    label: 'Cinema',
    icon: Film,
    color: 'text-rose-600',
    permissions: [
      { key: 'cinema.view', label: 'View Cinemas', description: 'See cinema listings' },
      { key: 'cinema.create', label: 'Create Cinemas', description: 'Add new cinemas' },
      { key: 'cinema.edit', label: 'Edit Cinemas', description: 'Modify cinema details' },
      { key: 'cinema.delete', label: 'Delete Cinemas', description: 'Remove cinemas' },
      { key: 'cinema.movies', label: 'Manage Movies', description: 'Handle movie listings' },
      { key: 'cinema.showtimes', label: 'Manage Showtimes', description: 'Set screening times' },
      { key: 'cinema.screens', label: 'Manage Screens', description: 'Configure cinema screens' },
      { key: 'cinema.pricing', label: 'Manage Pricing', description: 'Set ticket prices' },
      { key: 'cinema.concessions', label: 'Manage Concessions', description: 'Handle food & drinks' },
    ]
  },
  {
    module: 'packages',
    label: 'Packages',
    icon: Package,
    color: 'text-indigo-600',
    permissions: [
      { key: 'packages.view', label: 'View Packages', description: 'See package listings' },
      { key: 'packages.create', label: 'Create Packages', description: 'Add new packages' },
      { key: 'packages.edit', label: 'Edit Packages', description: 'Modify package details' },
      { key: 'packages.delete', label: 'Delete Packages', description: 'Remove packages' },
      { key: 'packages.pricing', label: 'Manage Pricing', description: 'Set package prices' },
      { key: 'packages.components', label: 'Manage Components', description: 'Add/remove package items' },
    ]
  },
  {
    module: 'laundry',
    label: 'Laundry Services',
    icon: Sparkles,
    color: 'text-cyan-600',
    permissions: [
      { key: 'laundry.view', label: 'View Services', description: 'See laundry listings' },
      { key: 'laundry.create', label: 'Create Services', description: 'Add new services' },
      { key: 'laundry.edit', label: 'Edit Services', description: 'Modify service details' },
      { key: 'laundry.delete', label: 'Delete Services', description: 'Remove services' },
      { key: 'laundry.pricing', label: 'Manage Pricing', description: 'Set service prices' },
      { key: 'laundry.orders', label: 'Manage Orders', description: 'Handle laundry orders' },
      { key: 'laundry.delivery', label: 'Manage Delivery', description: 'Track pickup/delivery' },
    ]
  },
  {
    module: 'banquet',
    label: 'Banquet Halls',
    icon: Gift,
    color: 'text-amber-600',
    permissions: [
      { key: 'banquet.view', label: 'View Venues', description: 'See venue listings' },
      { key: 'banquet.create', label: 'Create Venues', description: 'Add new venues' },
      { key: 'banquet.edit', label: 'Edit Venues', description: 'Modify venue details' },
      { key: 'banquet.delete', label: 'Delete Venues', description: 'Remove venues' },
      { key: 'banquet.pricing', label: 'Manage Pricing', description: 'Set rental prices' },
      { key: 'banquet.availability', label: 'Manage Availability', description: 'Set availability' },
      { key: 'banquet.catering', label: 'Manage Catering', description: 'Configure catering options' },
    ]
  },
  {
    module: 'orders',
    label: 'Orders & Bookings',
    icon: Ticket,
    color: 'text-violet-600',
    permissions: [
      { key: 'orders.view_own', label: 'View Own Orders', description: 'See personal orders' },
      { key: 'orders.view_all', label: 'View All Orders', description: 'See all system orders' },
      { key: 'orders.create', label: 'Create Orders', description: 'Create new orders' },
      { key: 'orders.edit', label: 'Edit Orders', description: 'Modify order details' },
      { key: 'orders.cancel', label: 'Cancel Orders', description: 'Cancel orders' },
      { key: 'orders.refund', label: 'Process Refunds', description: 'Handle refund requests' },
      { key: 'orders.confirm', label: 'Confirm Orders', description: 'Confirm pending orders' },
      { key: 'orders.assign', label: 'Assign Orders', description: 'Assign orders to operators' },
      { key: 'orders.export', label: 'Export Orders', description: 'Export order data' },
      { key: 'orders.history', label: 'View History', description: 'See order history' },
    ]
  },
  {
    module: 'receipts',
    label: 'Receipts & Invoices',
    icon: Receipt,
    color: 'text-emerald-600',
    permissions: [
      { key: 'receipts.view_own', label: 'View Own Receipts', description: 'See personal receipts' },
      { key: 'receipts.view_all', label: 'View All Receipts', description: 'See all receipts' },
      { key: 'receipts.generate', label: 'Generate Receipts', description: 'Create new receipts' },
      { key: 'receipts.download', label: 'Download Receipts', description: 'Download receipt PDFs' },
      { key: 'receipts.email', label: 'Email Receipts', description: 'Send receipts via email' },
      { key: 'receipts.void', label: 'Void Receipts', description: 'Cancel issued receipts' },
    ]
  },
  {
    module: 'loyalty',
    label: 'Loyalty Program',
    icon: Award,
    color: 'text-yellow-600',
    permissions: [
      { key: 'loyalty.view_own', label: 'View Own Points', description: 'See personal points' },
      { key: 'loyalty.view_all', label: 'View All Members', description: 'See all loyalty members' },
      { key: 'loyalty.redeem', label: 'Redeem Points', description: 'Use points for rewards' },
      { key: 'loyalty.manage', label: 'Manage Program', description: 'Configure loyalty settings' },
      { key: 'loyalty.adjust', label: 'Adjust Points', description: 'Add/remove member points' },
      { key: 'loyalty.tiers', label: 'Manage Tiers', description: 'Configure membership tiers' },
      { key: 'loyalty.rewards', label: 'Manage Rewards', description: 'Configure available rewards' },
    ]
  },
  {
    module: 'validation',
    label: 'Validation Center',
    icon: QrCode,
    color: 'text-teal-600',
    permissions: [
      { key: 'validation.view', label: 'View Pending', description: 'See pending validations' },
      { key: 'validation.approve_tickets', label: 'Approve Tickets', description: 'Approve ticket requests' },
      { key: 'validation.reject_tickets', label: 'Reject Tickets', description: 'Reject ticket requests' },
      { key: 'validation.verify_payments', label: 'Verify Payments', description: 'Manually verify payments' },
      { key: 'validation.approve_services', label: 'Approve Services', description: 'Approve new services' },
      { key: 'validation.approve_operators', label: 'Approve Operators', description: 'Approve new operators' },
      { key: 'validation.scan_qr', label: 'Scan QR Codes', description: 'Validate tickets via QR' },
    ]
  },
  {
    module: 'users',
    label: 'User Management',
    icon: Users,
    color: 'text-slate-600',
    permissions: [
      { key: 'users.view', label: 'View Users', description: 'See user list' },
      { key: 'users.create', label: 'Create Users', description: 'Add new users' },
      { key: 'users.edit', label: 'Edit Users', description: 'Modify user details' },
      { key: 'users.delete', label: 'Delete Users', description: 'Remove users' },
      { key: 'users.roles', label: 'Manage Roles', description: 'Change user roles' },
      { key: 'users.suspend', label: 'Suspend Users', description: 'Suspend/activate accounts' },
      { key: 'users.reset_password', label: 'Reset Passwords', description: 'Reset user passwords' },
      { key: 'users.export', label: 'Export Users', description: 'Export user data' },
      { key: 'users.import', label: 'Import Users', description: 'Bulk import users' },
      { key: 'users.verify', label: 'Verify Users', description: 'Manually verify users' },
    ]
  },
  {
    module: 'employees',
    label: 'Employee Management',
    icon: UserCog,
    color: 'text-blue-600',
    permissions: [
      { key: 'employees.view', label: 'View Employees', description: 'See employee list' },
      { key: 'employees.create', label: 'Create Employees', description: 'Add new employees' },
      { key: 'employees.edit', label: 'Edit Employees', description: 'Modify employee details' },
      { key: 'employees.delete', label: 'Delete Employees', description: 'Remove employees' },
      { key: 'employees.schedule', label: 'Manage Schedule', description: 'Set work schedules' },
      { key: 'employees.performance', label: 'View Performance', description: 'See performance metrics' },
      { key: 'employees.payroll', label: 'View Payroll', description: 'Access payroll data' },
    ]
  },
  {
    module: 'operators',
    label: 'Operators',
    icon: Briefcase,
    color: 'text-amber-600',
    permissions: [
      { key: 'operators.view', label: 'View Operators', description: 'See operator list' },
      { key: 'operators.create', label: 'Create Operators', description: 'Add new operators' },
      { key: 'operators.edit', label: 'Edit Operators', description: 'Modify operator details' },
      { key: 'operators.delete', label: 'Delete Operators', description: 'Remove operators' },
      { key: 'operators.approve', label: 'Approve Operators', description: 'Approve pending operators' },
      { key: 'operators.suspend', label: 'Suspend Operators', description: 'Suspend operator accounts' },
      { key: 'operators.commission', label: 'Set Commission', description: 'Configure commission rates' },
      { key: 'operators.documents', label: 'Manage Documents', description: 'Review operator documents' },
      { key: 'operators.performance', label: 'View Performance', description: 'See operator metrics' },
    ]
  },
  {
    module: 'finance',
    label: 'Finance & Payments',
    icon: CreditCard,
    color: 'text-green-600',
    permissions: [
      { key: 'finance.view_revenue', label: 'View Revenue', description: 'See revenue reports' },
      { key: 'finance.view_commissions', label: 'View Commissions', description: 'See commission data' },
      { key: 'finance.manage_payments', label: 'Manage Payments', description: 'Handle payment settings' },
      { key: 'finance.export_reports', label: 'Export Reports', description: 'Download financial reports' },
      { key: 'finance.bills', label: 'Manage Bills', description: 'Handle billing' },
      { key: 'finance.sales', label: 'View Sales', description: 'See sales data' },
      { key: 'finance.refunds', label: 'Process Refunds', description: 'Handle refund requests' },
      { key: 'finance.payouts', label: 'Manage Payouts', description: 'Process operator payouts' },
      { key: 'finance.reconciliation', label: 'Reconciliation', description: 'Financial reconciliation' },
      { key: 'finance.budgets', label: 'Manage Budgets', description: 'Set and track budgets' },
    ]
  },
  {
    module: 'analytics',
    label: 'Analytics & Reports',
    icon: BarChart,
    color: 'text-blue-600',
    permissions: [
      { key: 'analytics.dashboard', label: 'Analytics Dashboard', description: 'Access analytics overview' },
      { key: 'analytics.detailed', label: 'Detailed Analytics', description: 'Deep analytics access' },
      { key: 'analytics.export', label: 'Export Data', description: 'Export analytics data' },
      { key: 'analytics.trip_report', label: 'Trip Reports', description: 'View trip reports' },
      { key: 'analytics.booking', label: 'Booking Analytics', description: 'Booking statistics' },
      { key: 'analytics.revenue', label: 'Revenue Analytics', description: 'Revenue breakdowns' },
      { key: 'analytics.customer', label: 'Customer Analytics', description: 'Customer insights' },
      { key: 'analytics.operator', label: 'Operator Analytics', description: 'Operator performance' },
      { key: 'analytics.custom', label: 'Custom Reports', description: 'Create custom reports' },
    ]
  },
  {
    module: 'audit',
    label: 'Audit & Logs',
    icon: History,
    color: 'text-amber-600',
    permissions: [
      { key: 'audit.view_own', label: 'View Own Activity', description: 'See personal activity' },
      { key: 'audit.view_all', label: 'View All Activity', description: 'See all system activity' },
      { key: 'audit.export', label: 'Export Logs', description: 'Download audit logs' },
      { key: 'audit.filter', label: 'Advanced Filtering', description: 'Use advanced log filters' },
      { key: 'audit.security', label: 'Security Logs', description: 'View security events' },
      { key: 'audit.api', label: 'API Logs', description: 'View API call logs' },
    ]
  },
  {
    module: 'notifications',
    label: 'Notifications',
    icon: Bell,
    color: 'text-yellow-600',
    permissions: [
      { key: 'notifications.view_own', label: 'View Own Notifications', description: 'See personal notifications' },
      { key: 'notifications.manage', label: 'Manage Notifications', description: 'Configure notification settings' },
      { key: 'notifications.send', label: 'Send Notifications', description: 'Send system notifications' },
      { key: 'notifications.broadcast', label: 'Broadcast Messages', description: 'Send to all users' },
      { key: 'notifications.templates', label: 'Manage Templates', description: 'Edit notification templates' },
    ]
  },
  {
    module: 'support',
    label: 'Support & Help',
    icon: HelpCircle,
    color: 'text-cyan-600',
    permissions: [
      { key: 'support.create_ticket', label: 'Create Tickets', description: 'Submit support tickets' },
      { key: 'support.view_own', label: 'View Own Tickets', description: 'See personal tickets' },
      { key: 'support.view_all', label: 'View All Tickets', description: 'See all support tickets' },
      { key: 'support.respond', label: 'Respond to Tickets', description: 'Reply to tickets' },
      { key: 'support.close', label: 'Close Tickets', description: 'Mark tickets as resolved' },
      { key: 'support.escalate', label: 'Escalate Tickets', description: 'Escalate to higher support' },
      { key: 'support.chat', label: 'Live Chat', description: 'Access live chat support' },
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
      { key: 'settings.api_keys', label: 'Manage API Keys', description: 'Handle API integrations' },
      { key: 'settings.database', label: 'Database Access', description: 'Database management' },
      { key: 'settings.email', label: 'Email Settings', description: 'Configure email settings' },
      { key: 'settings.payment', label: 'Payment Settings', description: 'Configure payment gateways' },
      { key: 'settings.branding', label: 'Branding Settings', description: 'Logo and theme settings' },
      { key: 'settings.localization', label: 'Localization', description: 'Language and currency' },
      { key: 'settings.backup', label: 'Backup & Restore', description: 'System backup management' },
    ]
  },
  {
    module: 'permissions',
    label: 'Access Control',
    icon: Shield,
    color: 'text-red-600',
    permissions: [
      { key: 'permissions.view', label: 'View Permissions', description: 'See role permissions' },
      { key: 'permissions.create_roles', label: 'Create Roles', description: 'Add new roles' },
      { key: 'permissions.edit_roles', label: 'Edit Roles', description: 'Modify role permissions' },
      { key: 'permissions.delete_roles', label: 'Delete Roles', description: 'Remove roles' },
      { key: 'permissions.assign', label: 'Assign Permissions', description: 'Assign roles to users' },
      { key: 'permissions.audit', label: 'Permission Audit', description: 'Review permission changes' },
    ]
  },
  {
    module: 'integrations',
    label: 'Integrations',
    icon: Globe,
    color: 'text-indigo-600',
    permissions: [
      { key: 'integrations.view', label: 'View Integrations', description: 'See active integrations' },
      { key: 'integrations.configure', label: 'Configure Integrations', description: 'Set up integrations' },
      { key: 'integrations.enable', label: 'Enable/Disable', description: 'Toggle integrations on/off' },
      { key: 'integrations.logs', label: 'View Logs', description: 'See integration logs' },
      { key: 'integrations.webhooks', label: 'Manage Webhooks', description: 'Configure webhooks' },
    ]
  },
  {
    module: 'marketing',
    label: 'Marketing & Promotions',
    icon: TrendingUp,
    color: 'text-pink-600',
    permissions: [
      { key: 'marketing.view', label: 'View Campaigns', description: 'See marketing campaigns' },
      { key: 'marketing.create', label: 'Create Campaigns', description: 'Create new campaigns' },
      { key: 'marketing.edit', label: 'Edit Campaigns', description: 'Modify campaigns' },
      { key: 'marketing.delete', label: 'Delete Campaigns', description: 'Remove campaigns' },
      { key: 'marketing.coupons', label: 'Manage Coupons', description: 'Create discount codes' },
      { key: 'marketing.analytics', label: 'Campaign Analytics', description: 'View campaign performance' },
      { key: 'marketing.email', label: 'Email Campaigns', description: 'Send marketing emails' },
      { key: 'marketing.sms', label: 'SMS Campaigns', description: 'Send marketing SMS' },
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
  const [roles, setRoles] = useState(DEFAULT_ROLES);
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('roles');
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
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: 'bg-slate-100 text-slate-700 border-slate-200',
    permissions: []
  });

  const [userPermissions, setUserPermissions] = useState([]);
  const [selectedUserRole, setSelectedUserRole] = useState('');
  const [selectedUserRoles, setSelectedUserRoles] = useState([]);

  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin' || isSuperAdmin;

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
        // Keep default roles if fetch fails
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, []);

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

  // Filter permissions in role dialog based on search
  const filteredRoleDialogModules = PERMISSION_MODULES.filter(module =>
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

  const filteredModules = PERMISSION_MODULES.filter(module => 
    searchQuery === '' || 
    module.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    module.permissions.some(p => p.label.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <ShieldCheck className="h-7 w-7 text-[#082c59]" />
            Permissions & Access Control
          </h1>
          <p className="text-slate-600 mt-1">Manage roles and permissions for your organization</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2 bg-[#082c59] hover:bg-[#0a3a75]">
          <Plus className="h-4 w-4" />
          Create Role
        </Button>
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
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="roles" className="gap-2">
            <Shield className="h-4 w-4" />
            Roles ({roles.length})
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <UserCog className="h-4 w-4" />
            User Permissions
          </TabsTrigger>
          <TabsTrigger value="permissions" className="gap-2">
            <Key className="h-4 w-4" />
            Matrix
          </TabsTrigger>
        </TabsList>

        {/* Roles Tab */}
        <TabsContent value="roles" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {roles.map((role) => (
              <Card key={role.id} className="relative overflow-hidden hover:shadow-lg transition-shadow">
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
                      <span>{role.userCount} users</span>
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
                </CardContent>
                <CardFooter className="pt-2 border-t">
                  <div className="flex justify-end gap-2 w-full">
                    <Button variant="outline" size="sm" onClick={() => handleOpenDialog(role)}>
                      <Edit className="h-4 w-4 mr-1" /> Edit
                    </Button>
                    {!role.isSystem && (
                      <Button variant="outline" size="sm" className="text-red-600" onClick={() => handleDelete(role.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardFooter>
              </Card>
            ))}
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

        {/* Permission Matrix Tab */}
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
                                      <div>
                                        <p className="font-medium text-slate-900">{perm.label}</p>
                                        <p className="text-xs text-slate-500">{perm.description}</p>
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
