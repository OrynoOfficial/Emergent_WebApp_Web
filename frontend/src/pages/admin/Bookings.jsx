import { useEffect, useState } from 'react';
import { ordersAPI } from '../../api/client';
import { Search, Filter, Calendar, Package, Check, X, Eye, ArrowUpDown } from 'lucide-react';
import { formatFCFA } from '../../utils/currency';
import { formatDate } from '../../utils/dateUtils';

export default function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    category: 'all'
  });

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const response = await ordersAPI.getMyOrders({ all: true });
      setBookings(response.data?.orders || []);
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
      // Mock data
      setBookings([
        {
          id: '1',
          order_number: 'ORD-2024-001',
          customer_name: 'John Doe',
          customer_email: 'john@example.com',
          service_name: 'Grand Palace Hotel',
          service_category: 'hotel',
          status: 'pending',
          total_amount: 450,
          created_at: '2024-06-15T10:30:00'
        },
        {
          id: '2',
          order_number: 'ORD-2024-002',
          customer_name: 'Jane Smith',
          customer_email: 'jane@example.com',
          service_name: 'Express Bus - NY to Boston',
          service_category: 'travel',
          status: 'confirmed',
          total_amount: 85,
          created_at: '2024-06-14T15:45:00'
        },
        {
          id: '3',
          order_number: 'ORD-2024-003',
          customer_name: 'Bob Wilson',
          customer_email: 'bob@example.com',
          service_name: 'La Bella Italia',
          service_category: 'restaurant',
          status: 'completed',
          total_amount: 120,
          created_at: '2024-06-13T19:00:00'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (bookingId, newStatus) => {
    try {
      await ordersAPI.updateStatus(bookingId, newStatus);
      fetchBookings();
    } catch (error) {
      alert('Failed to update status');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-amber-100 text-amber-700',
      confirmed: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700'
    };
    return colors[status] || 'bg-slate-100 text-slate-700';
  };

  const getCategoryIcon = (category) => {
    const icons = {
      hotel: '🏨',
      restaurant: '🍽️',
      travel: '🚌',
      car_rental: '🚗',
      event: '🎫'
    };
    return icons[category] || '📦';
  };

  const filteredBookings = bookings.filter(b => {
    if (filters.status !== 'all' && b.status !== filters.status) return false;
    if (filters.category !== 'all' && b.service_category !== filters.category) return false;
    if (filters.search) {
      const search = filters.search.toLowerCase();
      return (
        b.order_number?.toLowerCase().includes(search) ||
        b.customer_name?.toLowerCase().includes(search) ||
        b.service_name?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Booking Management</h1>
        <p className="text-slate-600">View and manage all bookings</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search bookings..."
              className="input pl-10 w-full"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
          <select
            className="input w-40"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            className="input w-40"
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
          >
            <option value="all">All Categories</option>
            <option value="hotel">Hotels</option>
            <option value="restaurant">Restaurants</option>
            <option value="travel">Travel</option>
            <option value="car_rental">Car Rental</option>
            <option value="event">Events</option>
          </select>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="font-bold text-slate-900">No bookings found</h3>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left py-4 px-6 text-sm font-medium text-slate-600">Order</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-slate-600">Customer</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-slate-600">Service</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-slate-600">Status</th>
                  <th className="text-right py-4 px-6 text-sm font-medium text-slate-600">Amount</th>
                  <th className="text-right py-4 px-6 text-sm font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-slate-50">
                    <td className="py-4 px-6">
                      <div>
                        <p className="font-medium text-slate-900">{booking.order_number}</p>
                        <p className="text-sm text-slate-500">
                          {formatDate(booking.created_at)}
                        </p>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div>
                        <p className="font-medium text-slate-900">{booking.customer_name}</p>
                        <p className="text-sm text-slate-500">{booking.customer_email}</p>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{getCategoryIcon(booking.service_category)}</span>
                        <div>
                          <p className="font-medium text-slate-900">{booking.service_name}</p>
                          <p className="text-sm text-slate-500 capitalize">{booking.service_category}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(booking.status)}`}>
                        {booking.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <p className="font-bold text-slate-900">{formatFCFA(booking.total_amount)}</p>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-2 hover:bg-slate-100 rounded-lg" title="View">
                          <Eye className="h-4 w-4 text-slate-600" />
                        </button>
                        {booking.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleStatusUpdate(booking.id, 'confirmed')}
                              className="p-2 hover:bg-green-100 rounded-lg"
                              title="Confirm"
                            >
                              <Check className="h-4 w-4 text-green-600" />
                            </button>
                            <button
                              onClick={() => handleStatusUpdate(booking.id, 'cancelled')}
                              className="p-2 hover:bg-red-100 rounded-lg"
                              title="Cancel"
                            >
                              <X className="h-4 w-4 text-red-600" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
