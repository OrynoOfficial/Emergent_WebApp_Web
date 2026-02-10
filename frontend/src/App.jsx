import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { PermissionsProvider } from './contexts/PermissionsContext';
import ProtectedRoute from './components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';

// Auth Pages
import Login from './pages/Login';
import Register from './pages/Register';

// Main Pages
import Dashboard from './pages/Dashboard';
import Services from './pages/Services';
import BrowseServices from './pages/BrowseServices';
import Orders from './pages/Orders';
import Receipts from './pages/Receipts';
import Settings from './pages/Settings';
import Support from './pages/Support';
import Ratings from './pages/Ratings';
import Loyalty from './pages/Loyalty';
import Notifications from './pages/Notifications';

// Static Pages
import HelpCenter from './pages/static/HelpCenter';
import ContactUs from './pages/static/ContactUs';
import TermsAndConditions from './pages/static/TermsAndConditions';
import News from './pages/static/News';
import PrivacyPolicy from './pages/static/PrivacyPolicy';

// Admin Pages
import CommissionManagement from './pages/admin/CommissionManagement';
import AuditLogs from './pages/admin/AuditLogs';
import Permissions from './pages/admin/Permissions';
import OperatorsManagement from './pages/admin/OperatorsManagement';
import EmployeesManagement from './pages/admin/EmployeesManagement';
import BookingAnalytics from './pages/admin/BookingAnalytics';
import Reporting from './pages/admin/Reporting';
import BillsManagement from './pages/admin/BillsManagement';
import SalesManagement from './pages/admin/SalesManagement';
import DatabaseManagement from './pages/admin/DatabaseManagement';
import ValidationManagement from './pages/admin/ValidationManagement';
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

// New Service Pages
import BanquetSearch from './pages/services/BanquetSearch';
import BanquetResults from './pages/services/BanquetResults';
import BanquetBooking from './pages/services/BanquetBooking';
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
import AdminBookings from './pages/admin/Bookings';
import UserManagement from './pages/admin/Users';
import AdminDashboard from './pages/admin/AdminDashboard';
import PaymentSuccess from './pages/payment/PaymentSuccess';
import PaymentCancel from './pages/payment/PaymentCancel';
import StripeCheckoutConfirm from './pages/payment/StripeCheckoutConfirm';

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AuthProvider>
        <PermissionsProvider>
        <NotificationProvider>
          <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          
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
              <ProtectedRoute>
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
              <ProtectedRoute requiredRoles={['admin', 'operator']}>
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
              <ProtectedRoute requiredRoles={['admin']}>
                <BillsManagement />
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
            path="/admin/database"
            element={
              <ProtectedRoute requiredRoles={['admin']}>
                <DatabaseManagement />
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
            path="/management/banquet"
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
          
          {/* Utility Pages */}
          <Route path="/scanner" element={<ProtectedRoute requiredRoles={['admin', 'operator']}><Scanner /></ProtectedRoute>} />
          <Route path="/confirmation" element={<Confirmation />} />
          <Route path="/booking-confirmation" element={<ProtectedRoute><BookingConfirmation /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          
          {/* Redirects */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        </NotificationProvider>
        </PermissionsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
