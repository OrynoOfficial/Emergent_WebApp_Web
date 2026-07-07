import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { PermissionsProvider } from './contexts/PermissionsContext';
import ProtectedRoute from './components/ProtectedRoute';
import MobileAppGate from './components/MobileAppGate';
import OfflineBanner from './components/OfflineBanner';
import NativeBridge from './components/NativeBridge';
import ScrollToTop from './components/ScrollToTop';
import AccessibilityBridge from './components/AccessibilityBridge';
import { resolveLandingPath } from './utils/operatorLandingPath';

// Auth Pages
import Login from './pages/Login';
import TrackPackage from './pages/TrackPackage';
import Register from './pages/Register';
import VerifyAccount from './pages/auth/VerifyAccount';

// Smart redirect based on user role + operator service type
function RoleBasedRedirect() {
  const cachedUser = (() => { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } })();
  if (!cachedUser) return <Navigate to="/dashboard" replace />;
  return <Navigate to={resolveLandingPath(cachedUser)} replace />;
}

// Main Pages
import Dashboard from './pages/Dashboard';
import Services from './pages/Services';
import BrowseServices from './pages/BrowseServices';
import Orders from './pages/Orders';
import Receipts from './pages/Receipts';
import Transactions from './pages/Transactions';
import Settings from './pages/Settings';
import Support from './pages/Support';
import Ratings from './pages/Ratings';
import Loyalty from './pages/Loyalty';
import Notifications from './pages/Notifications';
import Alerts from './pages/Alerts';

// Static Pages
import HelpCenter from './pages/static/HelpCenter';
import ContactUs from './pages/static/ContactUs';
import TermsAndConditions from './pages/static/TermsAndConditions';
import News from './pages/static/News';
import PrivacyPolicy from './pages/static/PrivacyPolicy';
import About from './pages/static/About';
import Impressum from './pages/static/Impressum';
import LegalInformation from './pages/static/LegalInformation';

// Admin Pages
import CommissionManagement from './pages/admin/CommissionManagement';
import AuditLogs from './pages/admin/AuditLogs';
import AdminRefunds from './pages/admin/AdminRefunds';
import SystemCleanup from './pages/admin/SystemCleanup';
import APIKeysStatus from './pages/admin/APIKeysStatus';
import Permissions from './pages/admin/Permissions';
import OperatorsManagement from './pages/admin/OperatorsManagement';
import OperatorCategoriesPage from './pages/admin/OperatorCategoriesPage';
import EmployeesManagement from './pages/admin/EmployeesManagement';
import BookingAnalytics from './pages/admin/BookingAnalytics';
import Reporting from './pages/admin/Reporting';
import BillsManagement from './pages/admin/BillsManagement';
import SalesManagement from './pages/admin/SalesManagement';
import ValidationManagement from './pages/admin/ValidationManagement';
import SystemReports from './pages/admin/SystemReports';
import GeographyManagement from './pages/admin/GeographyManagement';
import PodManagement from './pages/admin/PodManagement';
import EmployeeScopeManagement from './pages/admin/EmployeeScopeManagement';
import MarketSegmentManagement from './pages/admin/MarketSegmentManagement';

// Utility Pages
import Scanner from './pages/utility/Scanner';
import Confirmation from './pages/utility/Confirmation';
import BookingConfirmation from './pages/utility/BookingConfirmation';

// Management Pages
import TravelManagement from './pages/management/TravelManagement';
import HotelManagement from './pages/management/HotelManagement';
import CarRentalManagement from './pages/management/CarRentalManagement';
import RestaurantManagement from './pages/management/RestaurantManagement';
import EventsManagement from './pages/management/EventsManagement';
import LaundryManagement from './pages/management/LaundryManagement';
import BanquetManagement from './pages/management/BanquetManagement';
import CinemaManagement from './pages/management/CinemaManagement';
import PackageManagement from './pages/management/PackageManagement';
import OperatorRefundPolicies from './pages/management/OperatorRefundPolicies';
import PackageShipments from './pages/management/PackageShipments';
import CustomerServiceManagement from './pages/management/CustomerServiceManagement';
import AccessGroupManagement from './pages/management/AccessGroupManagement';
import TeamRolesManagement from './pages/management/TeamRolesManagement';
import DocumentTemplates from './pages/admin/DocumentTemplates';

// Service Pages
import Hotels from './pages/services/Hotels';
import HotelsSearch from './pages/services/HotelsSearch';
import HotelsResults from './pages/services/HotelsResults';
import HotelDetails from './pages/services/HotelDetails';
import HotelBooking from './pages/services/HotelBooking';
import Restaurants from './pages/services/Restaurants';
import RestaurantsSearch from './pages/services/RestaurantsSearch';
import RestaurantsResults from './pages/services/RestaurantsResults';
import RestaurantDetails from './pages/services/RestaurantDetails';
import RestaurantBooking from './pages/services/RestaurantBooking';
import Travel from './pages/services/Travel';
import TravelSearch from './pages/services/TravelSearch';
import TravelResults from './pages/services/TravelResults';
import TravelBooking from './pages/services/TravelBooking';
import CarRental from './pages/services/CarRental';
import CarRentalSearch from './pages/services/CarRentalSearch';
import CarRentalResults from './pages/services/CarRentalResults';
import CarRentalDetails from './pages/services/CarRentalDetails';
import CarRentalBooking from './pages/services/CarRentalBooking';
import Events from './pages/services/Events';
import EventsSearch from './pages/services/EventsSearch';
import EventsResults from './pages/services/EventsResults';
import EventBooking from './pages/services/EventBooking';
import ShowtimeDetails from './pages/services/ShowtimeDetails';

// New Service Pages
import BanquetSearch from './pages/services/BanquetSearch';
import BanquetResults from './pages/services/BanquetResults';
import BanquetBooking from './pages/services/BanquetBooking';
import BanquetCheckout from './pages/services/BanquetCheckout';
import CinemaSearch from './pages/services/CinemaSearch';
import CinemaResults from './pages/services/CinemaResults';
import FilmDetails from './pages/services/FilmDetails';
import CinemaBooking from './pages/services/CinemaBooking';
import LaundrySearch from './pages/services/LaundrySearch';
import LaundryResults from './pages/services/LaundryResults';
import LaundryBooking from './pages/services/LaundryBooking';
import PackagesSearch from './pages/services/PackagesSearch';
import PackagesResults from './pages/services/PackagesResults';
import PackageBooking from './pages/services/PackageBooking';
import RestaurantMenu from './pages/services/RestaurantMenu';

// Admin Pages
import Analytics from './pages/admin/Analytics';
import OperatorComparison from './pages/admin/OperatorComparison';
import AdminBookings from './pages/admin/Bookings';
import UserManagement from './pages/admin/Users';
import AdminDashboard from './pages/admin/AdminDashboard';
import InvitationsManagement from './pages/admin/InvitationsManagement';
import PaymentSuccess from './pages/payment/PaymentSuccess';
import PaymentCancel from './pages/payment/PaymentCancel';
import StripeCheckoutConfirm from './pages/payment/StripeCheckoutConfirm';
import { RouteTitleSync } from './components/shared/PageTitle';
import ResetPassword from './pages/auth/ResetPassword';

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <NativeBridge />
      <RouteTitleSync />
      {/* Global toast portal — every `toast(...)` call from sonner across the
          app surfaces through this single mounted instance. */}
      <Toaster position="top-right" richColors closeButton expand={false} />
      <AuthProvider>
        <PermissionsProvider>
        <NotificationProvider>
          {/* Salesforce-style mobile gate. Lives at the root so it can fire on
              every route — login, signup, dashboards — the moment the global
              policy is `mobile_only` and the user is on a phone/tablet web
              browser. Self-renders to `null` otherwise. */}
          <MobileAppGate />
          {/* Site-wide accessibility prefs (reduce_motion / high_contrast /
              font_scale) — paints data-* attrs on <html> that CSS picks up. */}
          <AccessibilityBridge />
          {/* Native-aware offline strip. Renders null whenever the device is
              online; on Capacitor it listens to true network status, on web
              it falls back to navigator.onLine. */}
          <OfflineBanner />
          <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/track" element={<TrackPackage />} />
          <Route path="/track/:trackingNumber" element={<TrackPackage />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-account" element={<VerifyAccount />} />
          
          {/* Protected Routes - All Users */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/services"
            element={
              <ProtectedRoute>
                <BrowseServices />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/receipts"
            element={
              <ProtectedRoute>
                <Receipts />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/loyalty"
            element={
              <ProtectedRoute>
                <Loyalty />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/orders"
            element={
              <ProtectedRoute>
                <Orders />
              </ProtectedRoute>
            }
          />

          <Route
            path="/transactions"
            element={
              <ProtectedRoute>
                <Transactions />
              </ProtectedRoute>
            }
          />
          
          {/* Payment Routes */}
          <Route
            path="/payment/success"
            element={
              <ProtectedRoute>
                <PaymentSuccess />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/payment/cancel"
            element={
              <ProtectedRoute>
                <PaymentCancel />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/payment/checkout"
            element={
              <ProtectedRoute bare>
                <StripeCheckoutConfirm />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/support"
            element={
              <ProtectedRoute>
                <Support />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/ratings"
            element={
              <ProtectedRoute>
                <Ratings />
              </ProtectedRoute>
            }
          />
          
          {/* Service Category Pages */}
          <Route
            path="/services/hotels"
            element={
              <ProtectedRoute>
                <HotelsSearch />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/services/hotels/results"
            element={
              <ProtectedRoute>
                <HotelsResults />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/services/hotels/details/:id"
            element={
              <ProtectedRoute>
                <HotelDetails />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/services/hotels/booking"
            element={
              <ProtectedRoute>
                <HotelBooking />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/services/restaurants"
            element={
              <ProtectedRoute>
                <RestaurantsSearch />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/services/restaurants/results"
            element={
              <ProtectedRoute>
                <RestaurantsResults />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/services/restaurants/details/:id"
            element={
              <ProtectedRoute>
                <RestaurantDetails />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/services/restaurants/booking"
            element={
              <ProtectedRoute>
                <RestaurantBooking />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/services/restaurants/menu"
            element={
              <ProtectedRoute>
                <RestaurantMenu />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/services/travel"
            element={
              <ProtectedRoute>
                <TravelSearch />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/services/travel/results"
            element={
              <ProtectedRoute>
                <TravelResults />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/services/travel/booking"
            element={
              <ProtectedRoute>
                <TravelBooking />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/services/car-rental"
            element={
              <ProtectedRoute>
                <CarRentalSearch />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/services/car-rental/results"
            element={
              <ProtectedRoute>
                <CarRentalResults />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/services/car-rental/details/:id"
            element={
              <ProtectedRoute>
                <CarRentalDetails />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/services/car-rental/booking"
            element={
              <ProtectedRoute>
                <CarRentalBooking />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/services/events"
            element={
              <ProtectedRoute>
                <EventsSearch />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/services/events/results"
            element={
              <ProtectedRoute>
                <EventsResults />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/services/events/booking"
            element={
              <ProtectedRoute>
                <EventBooking />
              </ProtectedRoute>
            }
          />

          <Route
            path="/services/showtimes/:id"
            element={
              <ProtectedRoute>
                <ShowtimeDetails />
              </ProtectedRoute>
            }
          />

          {/* Banquet Routes */}
          <Route
            path="/services/banquet"
            element={
              <ProtectedRoute>
                <BanquetSearch />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/services/banquet/results"
            element={
              <ProtectedRoute>
                <BanquetResults />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/services/banquet/booking/:id"
            element={
              <ProtectedRoute>
                <BanquetBooking />
              </ProtectedRoute>
            }
          />

          <Route
            path="/services/banquet/checkout"
            element={
              <ProtectedRoute>
                <BanquetCheckout />
              </ProtectedRoute>
            }
          />
          
          {/* Cinema Routes */}
          <Route
            path="/services/cinema"
            element={
              <ProtectedRoute>
                <CinemaSearch />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/services/cinema/results"
            element={
              <ProtectedRoute>
                <CinemaResults />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/services/cinema/film/:id"
            element={
              <ProtectedRoute>
                <FilmDetails />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/services/cinema/booking/:showtimeId"
            element={
              <ProtectedRoute>
                <CinemaBooking />
              </ProtectedRoute>
            }
          />
          
          {/* Laundry Routes */}
          <Route
            path="/services/laundry"
            element={
              <ProtectedRoute>
                <LaundrySearch />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/services/laundry/results"
            element={
              <ProtectedRoute>
                <LaundryResults />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/services/laundry/booking/:id"
            element={
              <ProtectedRoute>
                <LaundryBooking />
              </ProtectedRoute>
            }
          />
          
          {/* Packages Routes */}
          <Route
            path="/services/packages"
            element={
              <ProtectedRoute>
                <PackagesSearch />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/services/packages/results"
            element={
              <ProtectedRoute>
                <PackagesResults />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/services/packages/booking/:id"
            element={
              <ProtectedRoute>
                <PackageBooking />
              </ProtectedRoute>
            }
          />
          
          {/* Admin Routes */}
          <Route
            path="/admin/analytics"
            element={
              <ProtectedRoute requiredRoles={['admin', 'super_admin', 'operator']}>
                <Analytics />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/admin/admin-dashboard"
            element={
              <ProtectedRoute requiredRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/admin/bookings"
            element={
              <ProtectedRoute requiredRoles={['admin', 'operator']}>
                <AdminBookings />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute requiredRoles={['admin']}>
                <UserManagement />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/admin/users/invitations"
            element={
              <ProtectedRoute requiredRoles={['admin']}>
                <UserManagement />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/admin/commission"
            element={
              <ProtectedRoute requiredRoles={['admin']}>
                <CommissionManagement />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/admin/audit-logs"
            element={
              <ProtectedRoute requiredRoles={['admin', 'operator']}>
                <AuditLogs />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/admin/audit-log"
            element={
              <ProtectedRoute requiredRoles={['admin', 'operator']}>
                <AuditLogs />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/refunds"
            element={
              <ProtectedRoute requiredRoles={['admin']}>
                <AdminRefunds />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/ops/cleanup"
            element={
              <ProtectedRoute requiredRoles={['admin']}>
                <SystemCleanup />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/api-keys"
            element={
              <ProtectedRoute requiredRoles={['admin']}>
                <APIKeysStatus />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/permissions"
            element={
              <ProtectedRoute requiredRoles={['admin']}>
                <Permissions />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/admin/users/permissions"
            element={
              <ProtectedRoute requiredRoles={['admin']}>
                <Permissions />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/admin/operators"
            element={
              <ProtectedRoute requiredRoles={['admin']}>
                <OperatorsManagement />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/admin/employees"
            element={
              <ProtectedRoute requiredRoles={['admin']}>
                <EmployeesManagement />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/admin/employees/templates"
            element={
              <ProtectedRoute requiredRoles={['admin']}>
                <DocumentTemplates />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/admin/booking-analytics"
            element={
              <ProtectedRoute requiredRoles={['admin', 'operator']}>
                <BookingAnalytics />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/operator-comparison"
            element={
              <ProtectedRoute requiredRoles={['admin', 'super_admin']}>
                <OperatorComparison />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/admin/reporting"
            element={
              <ProtectedRoute requiredRoles={['admin']}>
                <Reporting />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/admin/bills"
            element={
              <ProtectedRoute requiredRoles={['admin', 'operator']}>
                <BillsManagement />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/invitations"
            element={
              <ProtectedRoute requiredRoles={['admin', 'super_admin', 'operator']}>
                <InvitationsManagement />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/admin/sales"
            element={
              <ProtectedRoute requiredRoles={['admin', 'operator']}>
                <SalesManagement />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/admin/reports"
            element={
              <ProtectedRoute requiredRoles={['admin', 'operator']}>
                <SystemReports />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/admin/validation"
            element={
              <ProtectedRoute requiredRoles={['admin', 'operator']}>
                <ValidationManagement />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/admin/geography"
            element={
              <ProtectedRoute requiredRoles={['admin']}>
                <GeographyManagement />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/admin/operators/geography"
            element={
              <ProtectedRoute requiredRoles={['admin']}>
                <GeographyManagement />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/admin/market-segments"
            element={
              <ProtectedRoute requiredRoles={['admin']}>
                <MarketSegmentManagement />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/operators/market-segments"
            element={
              <ProtectedRoute requiredRoles={['admin']}>
                <MarketSegmentManagement />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/operators/categories"
            element={
              <ProtectedRoute requiredRoles={['admin']}>
                <OperatorCategoriesPage />
              </ProtectedRoute>
            }
          />

          
          <Route
            path="/admin/pods"
            element={
              <ProtectedRoute requiredRoles={['admin']}>
                <PodManagement />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/admin/employees/pods"
            element={
              <ProtectedRoute requiredRoles={['admin']}>
                <PodManagement />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/admin/employee-scopes"
            element={
              <ProtectedRoute requiredRoles={['admin']}>
                <EmployeeScopeManagement />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/admin/employees/access-scopes"
            element={
              <ProtectedRoute requiredRoles={['admin']}>
                <EmployeeScopeManagement />
              </ProtectedRoute>
            }
          />
          
          
          {/* Management Routes */}
          <Route
            path="/management/travel"
            element={
              <ProtectedRoute requiredRoles={['admin', 'operator']}>
                <TravelManagement />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/management/hotels"
            element={
              <ProtectedRoute requiredRoles={['admin', 'operator']}>
                <HotelManagement />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/management/car-rental"
            element={
              <ProtectedRoute requiredRoles={['admin', 'operator']}>
                <CarRentalManagement />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/management/restaurants"
            element={
              <ProtectedRoute requiredRoles={['admin', 'operator']}>
                <RestaurantManagement />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/management/events"
            element={
              <ProtectedRoute requiredRoles={['admin', 'operator']}>
                <EventsManagement />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/management/laundry"
            element={
              <ProtectedRoute requiredRoles={['admin', 'operator']}>
                <LaundryManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/management/pressing"
            element={
              <ProtectedRoute requiredRoles={['admin', 'operator']}>
                <LaundryManagement />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/management/banquet"
            element={
              <ProtectedRoute requiredRoles={['admin', 'operator']}>
                <BanquetManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/management/banquets"
            element={
              <ProtectedRoute requiredRoles={['admin', 'operator']}>
                <BanquetManagement />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/management/cinema"
            element={
              <ProtectedRoute requiredRoles={['admin', 'operator']}>
                <CinemaManagement />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/management/packages"
            element={
              <ProtectedRoute requiredRoles={['admin', 'operator']}>
                <PackageManagement />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/management/shipments"
            element={
              <ProtectedRoute requiredRoles={['admin', 'operator']}>
                <PackageShipments />
              </ProtectedRoute>
            }
          />

          <Route
            path="/management/refund-policies"
            element={
              <ProtectedRoute requiredRoles={['admin', 'operator']}>
                <OperatorRefundPolicies />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/management/customer-service"
            element={
              <ProtectedRoute requiredRoles={['admin', 'operator']}>
                <CustomerServiceManagement />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/management/access-groups"
            element={
              <ProtectedRoute requiredRoles={['admin']}>
                <AccessGroupManagement />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/management/team-roles"
            element={
              <ProtectedRoute requiredRoles={['operator', 'admin']}>
                <TeamRolesManagement />
              </ProtectedRoute>
            }
          />
          
          {/* Static Pages */}
          <Route path="/help" element={<HelpCenter />} />
          <Route path="/contact" element={<ContactUs />} />
          <Route path="/terms" element={<TermsAndConditions />} />
          <Route path="/news" element={<News />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/about" element={<About />} />
          <Route path="/impressum" element={<Impressum />} />
          <Route path="/legal" element={<LegalInformation />} />
          <Route path="/data-protection" element={<PrivacyPolicy />} />
          
          {/* Utility Pages */}
          <Route path="/scanner" element={<ProtectedRoute requiredRoles={['admin', 'operator']}><Scanner /></ProtectedRoute>} />
          <Route path="/confirmation" element={<Confirmation />} />
          <Route path="/booking-confirmation" element={<ProtectedRoute><BookingConfirmation /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><Navigate to="/ratings?tab=messages&subtab=notifications" replace /></ProtectedRoute>} />
          <Route path="/alerts" element={<ProtectedRoute><Navigate to="/ratings?tab=messages&subtab=alerts" replace /></ProtectedRoute>} />
          
          {/* Redirects */}
          <Route path="/" element={<RoleBasedRedirect />} />
          <Route path="*" element={<RoleBasedRedirect />} />
        </Routes>
        </NotificationProvider>
        </PermissionsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
