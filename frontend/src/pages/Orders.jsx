import { useEffect, useState, useMemo } from 'react';
import { formatDate, formatDateTime, formatDateLong } from '../utils/dateUtils';
import { Link } from 'react-router-dom';
import { ordersAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  Search,
  Calendar,
  Package,
  X,
  Eye,
  Star,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  Clock,
  CheckCircle,
  XCircle,
  ArrowUpDown,
  Filter,
  Tag,
  Hash,
  User,
  SlidersHorizontal,
  Plus,
  Building2
} from 'lucide-react';
import OrderDetailModal from '../components/modals/OrderDetailModal';
import { activityLogger } from '../utils/activityLogger';
import { formatFCFA } from '../utils/currency';

const ITEMS_PER_PAGE = 10;

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All Categories' },
  { value: 'hotel', label: 'Hotels' },
  { value: 'restaurant', label: 'Restaurants' },
  { value: 'travel', label: 'Travel' },
  { value: 'car_rental', label: 'Car Rental' },
  { value: 'event', label: 'Events' },
  { value: 'package', label: 'Packages' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'highest', label: 'Amount: High to Low' },
  { value: 'lowest', label: 'Amount: Low to High' },
];

export default function Orders() {
  const { user, isOperatorUser } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Determine view mode based on user role
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isOperator = user?.role === 'operator' || isOperatorUser;
  const isAllOrdersView = isAdmin; // Admin sees all orders

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchOrders();
    activityLogger.pageView(isAllOrdersView ? 'All Orders' : 'My Orders', '/orders');
  }, [isAllOrdersView]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, categoryFilter, sortBy]);

  const fetchOrders = async () => {
    try {
      let response;
      if (isAllOrdersView) {
        // Admin: fetch all orders from all users/operators
        response = await ordersAPI.getAll({ limit: 500 });
      } else if (isOperator) {
        // Operator: fetch orders for their assigned services
        response = await ordersAPI.getOperatorOrders({ limit: 500, operator_id: user?.operator_id });
      } else {
        // Customer: fetch only their orders
        response = await ordersAPI.getMyOrders({ limit: 500 });
      }
      setOrders(response.data?.orders || []);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async (orderId) => {
    if (!confirm('Are you sure you want to cancel this order?')) return;

    try {
      await ordersAPI.cancel(orderId);
      const order = orders.find(o => (o.id || o._id) === orderId);
      activityLogger.orderCancel(orderId, order?.order_number, 'User requested cancellation');
      fetchOrders();
      setIsDetailModalOpen(false);
    } catch (error) {
      alert('Failed to cancel order');
    }
  };

  const handleViewOrder = (order) => {
    setSelectedOrder(order);
    setIsDetailModalOpen(true);
    activityLogger.orderView(order.id || order._id, order.order_number);
  };

  const handleCloseModal = () => {
    setIsDetailModalOpen(false);
    setSelectedOrder(null);
  };

  // Filter and search logic
  const filteredAndSortedOrders = useMemo(() => {
    let result = [...orders];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(order =>
        order.order_number?.toLowerCase().includes(query) ||
        order.service_name?.toLowerCase().includes(query) ||
        order.service_title?.toLowerCase().includes(query) ||
        order.customer_name?.toLowerCase().includes(query) ||
        (order.service_category || order.service_type)?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(order => order.status === statusFilter);
    }

    // Category filter
    if (categoryFilter !== 'all') {
      result = result.filter(order =>
        (order.service_category || order.service_type) === categoryFilter
      );
    }

    // Sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.created_at) - new Date(b.created_at);
        case 'highest':
          return (b.total_amount || 0) - (a.total_amount || 0);
        case 'lowest':
          return (a.total_amount || 0) - (b.total_amount || 0);
        default: // newest
          return new Date(b.created_at) - new Date(a.created_at);
      }
    });

    return result;
  }, [orders, searchQuery, statusFilter, categoryFilter, sortBy]);

  // Pagination logic
  const totalPages = Math.ceil(filteredAndSortedOrders.length / ITEMS_PER_PAGE);
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedOrders.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAndSortedOrders, currentPage]);

  // Stats
  const stats = useMemo(() => {
    const total = filteredAndSortedOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const pending = filteredAndSortedOrders.filter(o => o.status === 'pending').length;
    const completed = filteredAndSortedOrders.filter(o => ['completed', 'delivered'].includes(o.status)).length;
    const cancelled = filteredAndSortedOrders.filter(o => o.status === 'cancelled').length;
    return { total, pending, completed, cancelled, count: filteredAndSortedOrders.length };
  }, [filteredAndSortedOrders]);

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-amber-100 text-amber-700 border-amber-200',
      confirmed: 'bg-blue-100 text-blue-700 border-blue-200',
      completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      delivered: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      cancelled: 'bg-red-100 text-red-700 border-red-200',
      reserved: 'bg-purple-100 text-purple-700 border-purple-200',
      processing: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    };
    return colors[status] || 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const getCategoryColor = (category) => {
    const colors = {
      hotel: 'bg-purple-500',
      restaurant: 'bg-pink-500',
      travel: 'bg-blue-500',
      car_rental: 'bg-orange-500',
      event: 'bg-cyan-500',
      package: 'bg-indigo-500',
    };
    return colors[category] || 'bg-slate-500';
  };

  const getCategoryIcon = (category) => {
    const icons = {
      hotel: '🏨',
      restaurant: '🍽️',
      travel: '🚌',
      car_rental: '🚗',
      event: '🎫',
      package: '📦',
    };
    return icons[category] || '📦';
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setCategoryFilter('all');
    setSortBy('newest');
  };

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || categoryFilter !== 'all' || sortBy !== 'newest';

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'N/A';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3" data-testid="orders-title">
            <div className="p-2 bg-[#082c59] rounded-lg">
              <ShoppingBag className="h-6 w-6 text-white" />
            </div>
            {isAllOrdersView ? 'All Orders' : 'My Orders'}
          </h1>
          <p className="text-slate-500 mt-1">
            {isAllOrdersView 
              ? 'View and manage all orders across the platform'
              : isOperator
              ? 'Track and manage orders for your services'
              : 'Track and manage your bookings'}
          </p>
        </div>
        {!isAllOrdersView && !isOperator && (
          <Link to="/services">
            <Button className="bg-[#082c59] hover:bg-[#0a3a75]">
              <Plus className="h-4 w-4 mr-2" />
              Book New Service
            </Button>
          </Link>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">Total Orders</p>
                <p className="text-2xl font-bold text-slate-900">{stats.count}</p>
              </div>
              <div className="p-3 bg-slate-200 rounded-full">
                <ShoppingBag className="h-5 w-5 text-slate-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-600 font-medium">Pending</p>
                <p className="text-2xl font-bold text-amber-700">{stats.pending}</p>
              </div>
              <div className="p-3 bg-amber-200 rounded-full">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-600 font-medium">Completed</p>
                <p className="text-2xl font-bold text-emerald-700">{stats.completed}</p>
              </div>
              <div className="p-3 bg-emerald-200 rounded-full">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600 font-medium">Cancelled</p>
                <p className="text-2xl font-bold text-red-700">{stats.cancelled}</p>
              </div>
              <div className="p-3 bg-red-200 rounded-full">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-[#082c59]/5 to-[#082c59]/10 border-[#082c59]/20 col-span-2 lg:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#082c59] font-medium">Total Spent</p>
                <p className="text-xl font-bold text-[#082c59]">{formatFCFA(stats.total)}</p>
              </div>
              <div className="p-3 bg-[#082c59]/20 rounded-full">
                <Package className="h-5 w-5 text-[#082c59]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters Section */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search Input */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by order number, service name, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white border-slate-200 focus:border-[#082c59] focus:ring-[#082c59]/20"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filter Toggle Button (Mobile) */}
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="lg:hidden border-slate-200"
            >
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Filters
              {hasActiveFilters && (
                <span className="ml-2 px-1.5 py-0.5 bg-[#082c59] text-white text-xs rounded-full">!</span>
              )}
            </Button>

            {/* Desktop Filters */}
            <div className="hidden lg:flex items-center gap-3">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[150px] bg-white border-slate-200">
                  <Tag className="h-4 w-4 mr-2 text-slate-400" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {CATEGORY_OPTIONS.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] bg-white border-slate-200">
                  <Filter className="h-4 w-4 mr-2 text-slate-400" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {STATUS_OPTIONS.map(status => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[170px] bg-white border-slate-200">
                  <ArrowUpDown className="h-4 w-4 mr-2 text-slate-400" />
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {SORT_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-slate-500 hover:text-slate-700"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Mobile Filters Panel */}
          {showFilters && (
            <div className="lg:hidden mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="bg-white border-slate-200">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {CATEGORY_OPTIONS.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-white border-slate-200">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {STATUS_OPTIONS.map(status => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="bg-white border-slate-200">
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {SORT_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  className="sm:col-span-3"
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear All Filters
                </Button>
              )}
            </div>
          )}

          {/* Search hints */}
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-xs text-slate-400">Search by:</span>
            <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              <Hash className="h-3 w-3" /> Order #
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              <Package className="h-3 w-3" /> Service
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              <Tag className="h-3 w-3" /> Category
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Results Count */}
      {!loading && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            Showing {paginatedOrders.length} of {filteredAndSortedOrders.length} orders
            {hasActiveFilters && ` (filtered from ${orders.length} total)`}
          </span>
        </div>
      )}

      {/* Orders List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-[#082c59] mb-4" />
          <p className="text-slate-500">Loading orders...</p>
        </div>
      ) : paginatedOrders.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200">
          <CardContent className="py-16">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <Package className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No orders found</h3>
              <p className="text-slate-500 mb-4">
                {hasActiveFilters
                  ? "No orders match your current filters."
                  : "You haven't placed any orders yet."}
              </p>
              {hasActiveFilters ? (
                <Button variant="outline" onClick={clearFilters}>
                  Clear Filters
                </Button>
              ) : (
                <Link to="/services">
                  <Button className="bg-[#082c59] hover:bg-[#0a3a75]">
                    <Package className="h-4 w-4 mr-2" />
                    Browse Services
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {paginatedOrders.map((order) => (
            <Card
              key={order.id || order._id}
              className="group bg-white border border-slate-200 hover:border-[#082c59]/30 hover:shadow-md transition-all duration-200 overflow-hidden"
            >
              <CardContent className="p-0">
                <div className="flex items-stretch">
                  {/* Color indicator */}
                  <div className={`w-1.5 ${getCategoryColor(order.service_category || order.service_type)}`} />

                  <div className="flex-1 p-4 sm:p-5">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      {/* Left side - Icon and Info */}
                      <div className="flex gap-4 flex-1 min-w-0">
                        {/* Category Icon */}
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-2xl shrink-0 group-hover:scale-105 transition-transform duration-200">
                          {getCategoryIcon(order.service_category || order.service_type)}
                        </div>

                        {/* Order Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-mono text-sm font-bold text-[#082c59]">
                              #{order.order_number}
                            </span>
                            <Badge variant="outline" className={`text-xs ${getStatusColor(order.status)}`}>
                              {order.status}
                            </Badge>
                            {(order.service_category || order.service_type) && (
                              <Badge variant="outline" className="text-xs bg-slate-100 text-slate-600 border-slate-200 capitalize">
                                {(order.service_category || order.service_type).replace('_', ' ')}
                              </Badge>
                            )}
                          </div>

                          <h3 className="font-semibold text-slate-900 group-hover:text-[#082c59] transition-colors truncate">
                            {order.service_name || order.service_title || 'Service'}
                          </h3>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-slate-500">
                            <span className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5" />
                              {formatDate(order.created_at)}
                            </span>
                          </div>

                          {/* Price breakdown - compact */}
                          <div className="flex flex-wrap items-center gap-4 mt-3 text-sm">
                            <div>
                              <span className="text-slate-400">Subtotal:</span>
                              <span className="ml-1 font-medium text-slate-700">{formatFCFA(order.subtotal || order.total_amount || 0)}</span>
                            </div>
                            {order.tax > 0 && (
                              <div>
                                <span className="text-slate-400">Tax:</span>
                                <span className="ml-1 font-medium text-slate-700">{formatFCFA(order.tax)}</span>
                              </div>
                            )}
                            {(order.discount > 0 || order.promo_discount > 0) && (
                              <div>
                                <span className="text-slate-400">Discount:</span>
                                <span className="ml-1 font-medium text-emerald-600">-{formatFCFA(order.discount || order.promo_discount)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right side - Total & Actions */}
                      <div className="flex items-center gap-4 sm:gap-6 lg:flex-col lg:items-end lg:gap-3">
                        <div className="text-right">
                          <p className="text-xs text-slate-400 uppercase tracking-wide">Total</p>
                          <p className="text-xl sm:text-2xl font-bold text-[#082c59]">
                            {formatFCFA(order.total_amount || order.final_amount || 0)}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {order.status === 'pending' && (
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelOrder(order.id || order._id);
                              }}
                              variant="outline"
                              size="sm"
                              className="border-red-200 text-red-600 hover:bg-red-50"
                            >
                              <XCircle className="h-4 w-4 sm:mr-1.5" />
                              <span className="hidden sm:inline">Cancel</span>
                            </Button>
                          )}
                          <Button
                            onClick={() => handleViewOrder(order)}
                            variant="outline"
                            size="sm"
                            className="border-slate-200 hover:border-[#082c59] hover:text-[#082c59]"
                          >
                            <Eye className="h-4 w-4 sm:mr-1.5" />
                            <span className="hidden sm:inline">View</span>
                          </Button>
                          {(order.status === 'completed' || order.status === 'delivered') && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-amber-200 text-amber-600 hover:bg-amber-50"
                            >
                              <Star className="h-4 w-4 sm:mr-1.5" />
                              <span className="hidden sm:inline">Review</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Customer notes */}
                    {order.customer_notes && (
                      <div className="mt-3 p-2 bg-slate-50 rounded-lg border-l-2 border-slate-300">
                        <p className="text-sm text-slate-600 italic">&ldquo;{order.customer_notes}&rdquo;</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-slate-500">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="border-slate-200"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>

                {/* Page numbers */}
                <div className="hidden sm:flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className={currentPage === pageNum
                          ? "bg-[#082c59] hover:bg-[#0a3a75]"
                          : "border-slate-200"
                        }
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="border-slate-200"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Order Detail Modal */}
      <OrderDetailModal
        order={selectedOrder}
        isOpen={isDetailModalOpen}
        onClose={handleCloseModal}
        onCancel={handleCancelOrder}
      />
    </div>
  );
}
