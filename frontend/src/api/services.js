// Service-specific API clients for user-facing pages
import api from './client';

// Location filter helper - reads stored customer location
function getLocationParam() {
  try {
    const stored = localStorage.getItem('oryno_user_location');
    if (!stored) return {};
    const loc = JSON.parse(stored);
    if (loc.is_in_africa && loc.country_code) {
      return { country: loc.country_code };
    }
  } catch { /* ignore */ }
  return {};
}

// Hotels API
export const hotelsApi = {
  search: (params = {}) => api.get('/hotels/', { params: { ...getLocationParam(), ...params } }),
  getById: (id) => api.get(`/hotels/${id}`),
  getRooms: (hotelId, params = {}) => api.get('/rooms/', { params: { hotel_id: hotelId, ...params } }),
  checkAvailability: (params) => api.get('/rooms/availability', { params }),
  bookRoom: (data) => api.post('/rooms/bookings/reserve', data),
};

// Restaurants API
export const restaurantsApi = {
  search: (params = {}) => api.get('/restaurants/', { params }),
  getById: (id) => api.get(`/restaurants/${id}`),
  book: (id, data) => api.post(`/restaurants/${id}/book`, data),
};

// Travel API
export const travelApi = {
  searchRoutes: (params = {}) => api.get('/travel/routes', { params }),
  getRoute: (id) => api.get(`/travel/routes/${id}`),
  getSeatAvailability: (routeId, travelDate) => 
    api.get('/seat-bookings/availability', { params: { route_id: routeId, travel_date: travelDate } }),
  reserveSeats: (data) => api.post('/seat-bookings/reserve', data),
  confirmBooking: (data) => api.post('/seat-bookings/confirm', data),
};

// Car Rental API  
export const carRentalApi = {
  search: (params = {}) => api.get('/vehicles/', { params }),
  getById: (id) => api.get(`/vehicles/${id}`),
  book: (data) => api.post('/car-rental/book', data),
};

// Events API
export const eventsApi = {
  search: (params = {}) => api.get('/events/', { params }),
  getById: (id) => api.get(`/events/${id}`),
  book: (id, data) => api.post(`/events/${id}/book`, null, { params: data }),
};

// Packages API
export const packagesApi = {
  search: (params = {}) => api.get('/packages/', { params }),
  getById: (id) => api.get(`/packages/${id}`),
  book: (id, data) => api.post(`/packages/${id}/book`, null, { params: data }),
};

// Banquet API
export const banquetApi = {
  search: (params = {}) => api.get('/banquets/', { params }),
  getById: (id) => api.get(`/banquets/${id}`),
  checkAvailability: (id, date) => api.get(`/banquets/${id}/availability`, { params: { date } }),
  book: (id, data) => api.post(`/banquets/${id}/book`, null, { params: data }),
};

// Cinema API
export const cinemaApi = {
  getCinemas: (params = {}) => api.get('/cinema/', { params }),
  getCinema: (id) => api.get(`/cinema/${id}`),
  getFilms: (params = {}) => api.get('/cinema/films', { params }),
  getFilm: (id) => api.get(`/cinema/films/${id}`),
  getShowtimes: (cinemaId, params = {}) => api.get(`/cinema/${cinemaId}/showtimes`, { params }),
  bookSeats: (showtimeId, seats) => api.post(`/cinema/showtimes/${showtimeId}/book`, null, { params: { seats } }),
};

// Laundry/Pressing API
export const laundryApi = {
  search: (params = {}) => api.get('/pressing/', { params }),
  getById: (id) => api.get(`/pressing/${id}`),
  createOrder: (id, data) => api.post(`/pressing/${id}/orders`, data),
};

// Helper to fetch with mock fallback
export const fetchWithFallback = async (apiCall, mockData) => {
  try {
    const response = await apiCall();
    const data = response.data;
    // Return mock data if API returns empty/null
    if (!data || (Array.isArray(data) && data.length === 0)) {
      return mockData;
    }
    // Handle nested response structures
    const key = Object.keys(data).find(k => Array.isArray(data[k]));
    if (key && data[key].length === 0) {
      return mockData;
    }
    return data;
  } catch (error) {
    console.error('API call failed, using mock data:', error.message);
    return mockData;
  }
};
