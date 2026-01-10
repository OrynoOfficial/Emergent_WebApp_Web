// Management API client for all CRUD operations
import api from './client';

// Vehicles
export const vehicleApi = {
  list: (params = {}) => api.get('/vehicles/', { params }),
  get: (id) => api.get(`/vehicles/${id}`),
  create: (data) => api.post('/vehicles/', data),
  update: (id, data) => api.put(`/vehicles/${id}`, data),
  delete: (id) => api.delete(`/vehicles/${id}`),
};

// Operators
export const operatorApi = {
  list: (params = {}) => api.get('/operators/', { params }),
  get: (id) => api.get(`/operators/${id}`),
  create: (data) => api.post('/operators/', data),
  update: (id, data) => api.put(`/operators/${id}`, data),
  delete: (id) => api.delete(`/operators/${id}`),
  approve: (id) => api.post(`/operators/${id}/approve`),
  suspend: (id) => api.post(`/operators/${id}/suspend`),
};

// Travel Routes
export const travelRouteApi = {
  list: (params = {}) => api.get('/travel/management/my-routes', { params }),
  listAll: (params = {}) => api.get('/travel/routes', { params }),
  get: (id) => api.get(`/travel/routes/${id}`),
  create: (data) => api.post('/travel/routes', data),
  update: (id, data) => api.put(`/travel/routes/${id}`, data),
  delete: (id) => api.delete(`/travel/routes/${id}`),
  approve: (id) => api.post(`/travel/routes/${id}/approve`),
  suspend: (id) => api.post(`/travel/routes/${id}/suspend`),
  operatorRoutes: (params = {}) => api.get('/travel/management/my-routes', { params }),
  operatorStats: () => api.get('/travel/operator/stats'),
};

// Seat Bookings
export const seatBookingApi = {
  getAvailability: (routeId, travelDate) => api.get('/seat-bookings/availability', { params: { route_id: routeId, travel_date: travelDate } }),
  reserve: (data) => api.post('/seat-bookings/reserve', data),
  confirm: (data) => api.post('/seat-bookings/confirm', data),
  release: (routeId, travelDate, seatNumbers) => api.post('/seat-bookings/release', { route_id: routeId, travel_date: travelDate, seat_numbers: seatNumbers }),
  myBookings: (params = {}) => api.get('/seat-bookings/my-bookings', { params }),
};

// Rooms
export const roomApi = {
  list: (hotelId, params = {}) => api.get('/rooms/', { params: { hotel_id: hotelId, ...params } }),
  get: (id) => api.get(`/rooms/${id}`),
  create: (data) => api.post('/rooms/', data),
  update: (id, data) => api.put(`/rooms/${id}`, data),
  delete: (id) => api.delete(`/rooms/${id}`),
  availability: (params) => api.get('/rooms/availability', { params }),
  reserve: (data) => api.post('/rooms/bookings/reserve', data),
  confirm: (data) => api.post('/rooms/bookings/confirm', data),
  myBookings: (params = {}) => api.get('/rooms/bookings/my', { params }),
};

// Commission
export const commissionApi = {
  list: (params = {}) => api.get('/commission-config/', { params }),
  create: (data) => api.post('/commission-config/', data),
  update: (id, data) => api.put(`/commission-config/${id}`, data),
  delete: (id) => api.delete(`/commission-config/${id}`),
  calculate: (serviceType, amount, operatorId) => api.get('/commission-config/calculate', { params: { service_type: serviceType, amount, operator_id: operatorId } }),
};

// Loyalty
export const loyaltyApi = {
  getProgram: () => api.get('/loyalty/program'),
  earnPoints: (data) => api.post('/loyalty/earn', null, { params: data }),
  getTransactions: (params = {}) => api.get('/loyalty/transactions', { params }),
  getRewards: () => api.get('/loyalty/rewards'),
  redeemReward: (rewardId) => api.post(`/loyalty/redeem/${rewardId}`),
  getRedemptions: (params = {}) => api.get('/loyalty/redemptions', { params }),
};

// Promo Codes
export const promoCodeApi = {
  list: (params = {}) => api.get('/promo-codes/', { params }),
  create: (data) => api.post('/promo-codes/', data),
  validate: (data) => api.post('/promo-codes/validate', data),
  use: (code, orderId, discountAmount) => api.post('/promo-codes/use', null, { params: { code, order_id: orderId, discount_amount: discountAmount } }),
  toggle: (code, isActive) => api.put(`/promo-codes/${code}`, null, { params: { is_active: isActive } }),
  delete: (code) => api.delete(`/promo-codes/${code}`),
};

// Employees
export const employeeApi = {
  list: (params = {}) => api.get('/employees/', { params }),
  get: (id) => api.get(`/employees/${id}`),
  create: (data) => api.post('/employees/', data),
  update: (id, data) => api.put(`/employees/${id}`, data),
  delete: (id) => api.delete(`/employees/${id}`),
  addDocument: (id, data) => api.post(`/employees/${id}/documents`, null, { params: data }),
  getDocuments: (id) => api.get(`/employees/${id}/documents`),
};

// Events Management
export const eventsManagementApi = {
  list: (params = {}) => api.get('/events/', { params }),
  listForManagement: (params = {}) => api.get('/events/management/my-events', { params }),
  get: (id) => api.get(`/events/${id}`),
  create: (data) => api.post('/events/', data),
  update: (id, data) => api.put(`/events/${id}`, data),
  delete: (id) => api.delete(`/events/${id}`),
  publish: (id) => api.post(`/events/${id}/publish`),
  book: (id, data) => api.post(`/events/${id}/book`, null, { params: data }),
  operatorEvents: (params = {}) => api.get('/events/management/my-events', { params }),
};

// Pressing/Laundry
export const pressingApi = {
  list: (params = {}) => api.get('/pressing/', { params }),
  get: (id) => api.get(`/pressing/${id}`),
  create: (data) => api.post('/pressing/', data),
  update: (id, data) => api.put(`/pressing/${id}`, data),
  delete: (id) => api.delete(`/pressing/${id}`),
  createOrder: (id, items, config = {}) => api.post(`/pressing/${id}/orders`, items, config),
  myOrders: (params = {}) => api.get('/pressing/orders/my', { params }),
};

// Banquets
export const banquetApi = {
  list: (params = {}) => api.get('/banquets/', { params }),
  get: (id) => api.get(`/banquets/${id}`),
  create: (data) => api.post('/banquets/', data),
  update: (id, data) => api.put(`/banquets/${id}`, data),
  delete: (id) => api.delete(`/banquets/${id}`),
  checkAvailability: (id, date) => api.get(`/banquets/${id}/availability`, { params: { date } }),
  book: (id, data) => api.post(`/banquets/${id}/book`, null, { params: data }),
  myBookings: (params = {}) => api.get('/banquets/bookings/my', { params }),
};

// Cinema
export const cinemaApi = {
  list: (params = {}) => api.get('/cinema/', { params }),
  get: (id) => api.get(`/cinema/${id}`),
  create: (data) => api.post('/cinema/', data),
  update: (id, data) => api.put(`/cinema/${id}`, data),
  delete: (id) => api.delete(`/cinema/${id}`),
  // Films
  listFilms: (params = {}) => api.get('/cinema/films', { params }),
  getFilm: (id) => api.get(`/cinema/films/${id}`),
  createFilm: (data) => api.post('/cinema/films', null, { params: data }),
  // Showtimes
  getShowtimes: (cinemaId, params = {}) => api.get(`/cinema/${cinemaId}/showtimes`, { params }),
  createShowtime: (cinemaId, data) => api.post(`/cinema/${cinemaId}/showtimes`, null, { params: data }),
  bookSeats: (showtimeId, seats) => api.post(`/cinema/showtimes/${showtimeId}/book`, null, { params: { seats } }),
  myBookings: (params = {}) => api.get('/cinema/bookings/my', { params }),
};

// Packages
export const packageApi = {
  list: (params = {}) => api.get('/packages/', { params }),
  get: (id) => api.get(`/packages/${id}`),
  create: (data) => api.post('/packages/', data),
  update: (id, data) => api.put(`/packages/${id}`, data),
  delete: (id) => api.delete(`/packages/${id}`),
  publish: (id) => api.post(`/packages/${id}/publish`),
  book: (id, data) => api.post(`/packages/${id}/book`, null, { params: data }),
  myBookings: (params = {}) => api.get('/packages/bookings/my', { params }),
  operatorPackages: (params = {}) => api.get('/packages/operator/packages', { params }),
};

// Car Rental Management
export const carRentalManagementApi = {
  list: (params = {}) => api.get('/car-rental/', { params }),
  get: (id) => api.get(`/car-rental/${id}`),
  create: (data) => api.post('/car-rental/', data),
  update: (id, data) => api.put(`/car-rental/${id}`, data),
  delete: (id) => api.delete(`/car-rental/${id}`),
};

// Restaurants Management
export const restaurantManagementApi = {
  list: (params = {}) => api.get('/restaurants/', { params }),
  get: (id) => api.get(`/restaurants/${id}`),
  create: (data) => api.post('/restaurants/', data),
  update: (id, data) => api.put(`/restaurants/${id}`, data),
  delete: (id) => api.delete(`/restaurants/${id}`),
};

// Access Control
export const accessApi = {
  // Permissions
  listPermissions: (params = {}) => api.get('/access/permissions', { params }),
  createPermission: (data) => api.post('/access/permissions', null, { params: data }),
  // Access Groups
  listGroups: (params = {}) => api.get('/access/groups', { params }),
  getGroup: (id) => api.get(`/access/groups/${id}`),
  createGroup: (data) => api.post('/access/groups', data),
  updateGroup: (id, data) => api.put(`/access/groups/${id}`, data),
  deleteGroup: (id) => api.delete(`/access/groups/${id}`),
  // User Access
  getUserGroups: (userId) => api.get(`/access/users/${userId}/groups`),
  assignUserToGroup: (userId, groupId) => api.post(`/access/users/${userId}/groups`, null, { params: { group_id: groupId } }),
  removeUserFromGroup: (userId, groupId) => api.delete(`/access/users/${userId}/groups/${groupId}`),
  checkPermission: (permissionCode) => api.get('/access/check', { params: { permission_code: permissionCode } }),
};

// Notifications
export const notificationApi = {
  list: (params = {}) => api.get('/notifications/', { params }),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put('/notifications/read-all'),
  delete: (id) => api.delete(`/notifications/${id}`),
  // Support Chat
  createSupportChat: (data) => api.post('/notifications/support', null, { params: data }),
  listSupportChats: (params = {}) => api.get('/notifications/support', { params }),
  addSupportMessage: (chatId, message) => api.post(`/notifications/support/${chatId}/message`, null, { params: { message } }),
  resolveSupportChat: (chatId) => api.put(`/notifications/support/${chatId}/resolve`),
};
