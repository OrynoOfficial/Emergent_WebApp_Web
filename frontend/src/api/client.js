import axios from 'axios';

// Get base URL - VITE_API_URL already includes /api
const API_URL = import.meta.env.VITE_API_URL || 'https://booking-revamp-9.preview.emergentagent.com/api';
console.log('API_URL:', API_URL);

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
});

// Token refresh function
const refreshAccessToken = async () => {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) {
    throw new Error('No refresh token');
  }
  
  try {
    const response = await axios.post(`${API_URL}/auth/refresh`, {
      refresh_token: refreshToken
    });
    
    const { access_token, refresh_token: newRefreshToken } = response.data;
    localStorage.setItem('access_token', access_token);
    if (newRefreshToken) {
      localStorage.setItem('refresh_token', newRefreshToken);
    }
    
    return access_token;
  } catch (error) {
    // Refresh failed, clear tokens
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    throw error;
  }
};

// Add auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle auth errors with automatic token refresh
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Don't intercept network errors - let them bubble up
    if (!error.response) {
      return Promise.reject(error);
    }
    
    // If 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }
      
      originalRequest._retry = true;
      isRefreshing = true;
      
      try {
        const newToken = await refreshAccessToken();
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        
        // Refresh failed, clear tokens
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        
        // Only redirect if not already on login page and not a silent request
        if (!window.location.pathname.includes('/login') && !originalRequest._silent) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getCurrentUser: () => api.get('/auth/me'),
  refreshToken: (refreshToken) => api.post('/auth/refresh', { refresh_token: refreshToken }),
};

// Services API
export const servicesAPI = {
  getAll: (params) => api.get('/services/', { params }),
  getById: (id) => api.get(`/services/${id}`),
  create: (data) => api.post('/services/', data),
  update: (id, data) => api.put(`/services/${id}`, data),
  delete: (id) => api.delete(`/services/${id}`),
  getByCategory: (category, params) => api.get(`/services/category/${category}`, { params }),
};

// Orders API
export const ordersAPI = {
  create: (data) => api.post('/orders/', data),
  getMyOrders: (params) => api.get('/orders/', { params }),
  getAll: (params) => api.get('/orders/', { params }), // Admin: backend filters by role
  getOperatorOrders: (params) => api.get('/orders/', { params }), // Operator: backend filters by role
  getById: (id) => api.get(`/orders/${id}`),
  cancel: (id) => api.put(`/orders/${id}/cancel`),
  updateStatus: (id, status) => api.put(`/orders/${id}/status`, { status }),
  getPaymentMethods: (params) => api.get('/orders/analytics/payment-methods', { params }),
};

// Analytics API
export const analyticsAPI = {
  getDashboard: () => api.get('/analytics/dashboard'),
  getStats: (params) => api.get('/analytics/overview', { params }),
  getOverview: (params) => api.get('/analytics/overview', { params }),
};

// Hotels API
export const hotelsAPI = {
  getAll: (params) => api.get('/hotels/', { params }),
  getById: (id) => api.get(`/hotels/${id}`),
  search: (params) => api.get('/hotels/search', { params }),
  create: (data) => api.post('/hotels/', data),
  update: (id, data) => api.put(`/hotels/${id}`, data),
};

// Restaurants API
export const restaurantsAPI = {
  getAll: (params) => api.get('/restaurants/', { params }),
  getById: (id) => api.get(`/restaurants/${id}`),
  search: (params) => api.get('/restaurants/search', { params }),
};

// Travel API
export const travelAPI = {
  getRoutes: (params) => api.get('/travel/', { params }),
  getRouteById: (id) => api.get(`/travel/${id}`),
  searchRoutes: (params) => api.get('/travel/search', { params }),
};

// Car Rental API
export const carRentalAPI = {
  getAll: (params) => api.get('/car-rental/', { params }),
  getById: (id) => api.get(`/car-rental/${id}`),
  search: (params) => api.get('/car-rental/search', { params }),
};

// Events API
export const eventsAPI = {
  getAll: (params) => api.get('/events/', { params }),
  getById: (id) => api.get(`/events/${id}`),
  search: (params) => api.get('/events/search', { params }),
};

// Ratings API
export const ratingsAPI = {
  create: (data) => api.post('/ratings/', data),
  getMyRatings: () => api.get('/ratings/my'),
  getServiceRatings: (serviceId) => api.get(`/ratings/service/${serviceId}`),
};

// Payments API
export const paymentsAPI = {
  createIntent: (data) => api.post('/payments/create-intent', data),
  confirm: (paymentId) => api.post(`/payments/${paymentId}/confirm`),
  getHistory: () => api.get('/payments/history'),
};

// Users API (Admin)
export const usersAPI = {
  getAll: (params) => api.get('/users/', { params }),
  getById: (id) => api.get(`/users/${id}`),
  update: (id, data) => api.put(`/users/${id}`, data),
  updateRole: (id, role) => api.put(`/users/${id}/role`, { role }),
  updateStatus: (id, status) => api.put(`/users/${id}/status`, { status }),
  create: (data) => api.post('/users/create', data),
  checkPermissions: (targetRole) => api.get('/users/permissions/check', { params: { target_role: targetRole } }),
};

// Operators API (Admin)
export const operatorsAPI = {
  getAll: (params) => api.get('/operators/', { params }),
  getById: (id) => api.get(`/operators/${id}`),
  create: (data) => api.post('/operators/', data),
  update: (id, data) => api.put(`/operators/${id}`, data),
  delete: (id) => api.delete(`/operators/${id}`),
  approve: (id) => api.post(`/operators/${id}/approve`),
  suspend: (id) => api.post(`/operators/${id}/suspend`),
};

export default api;

// Export as apiClient for compatibility
export { api as apiClient };
