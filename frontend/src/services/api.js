/**
 * api.js — Centralised Axios API client
 *
 * All API calls go through this instance.
 * - Base URL read from REACT_APP_API_URL env var (set in docker-compose)
 * - Authorization header automatically added from localStorage token
 * - 401 responses automatically clear token and redirect to /login
 */

import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getErrorMessage = (error, fallback = 'Something went wrong.') => {
  if (!error) return fallback;
  const detail = error.response?.data?.detail || error.response?.data?.message;
  return detail || error.message || fallback;
};

// ── Request interceptor — attach JWT token ─────────────────────────────────
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

// ── Response interceptor — handle auth errors ──────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ── Auth API ───────────────────────────────────────────────────────────────
export const authAPI = {
  /** Register a new user */
  register: (email, password, name, role = 'buyer', phone = null, flat_number = null) =>
    api.post('/auth/register', { email, password, name, role, phone, flat_number }),

  /** Login with email and password */
  login: (email, password) =>
    api.post('/auth/login', { email, password }),

  /** Refresh JWT */
  refresh: (refresh_token) =>
    api.post('/auth/refresh', { refresh_token }),

  /** Get current authenticated user */
  me: () => api.get('/auth/me'),

  /** Logout */
  logout: () => api.post('/auth/logout'),
};

// ── Sellers API ────────────────────────────────────────────────────────────
export const sellersAPI = {
  /** List all approved sellers */
  list: (skip = 0, limit = 20) =>
    api.get('/sellers/', { params: { skip, limit } }),

  /** Get a specific seller profile */
  get: (sellerId) => api.get(`/sellers/${sellerId}`),

  /** Get current authenticated seller profile */
  getMe: () => api.get('/sellers/me'),

  /** Toggle store open/closed status */
  setOpenStatus: (isOpen) =>
    api.patch('/sellers/me/open', { is_open: isOpen }),

  /** Register as a seller */
  register: (data) => api.post('/sellers/register', data),
};

// ── Menus API ──────────────────────────────────────────────────────────────
export const menusAPI = {
  /** Get menus for a seller */
  bySeller: (sellerId, category = null, search = null, availableOnly = false) =>
    api.get(`/menus/sellers/${sellerId}`, {
      params: { category, search, available_only: availableOnly },
    }),

  /** Create a new menu item (supports pre-order attributes) */
  create: (data) => api.post('/menus/', data),

  /** Update a menu item */
  update: (menuId, data) => api.put(`/menus/${menuId}`, data),

  /** Toggle item availability */
  toggleAvailability: (menuId, isAvailable) =>
    api.patch(`/menus/${menuId}/availability`, { is_available: isAvailable }),

  /** Delete a menu item */
  delete: (menuId) => api.delete(`/menus/${menuId}`),
};

// ── Orders API ─────────────────────────────────────────────────────────────
export const ordersAPI = {
  /** Place a new order / pre-order */
  create: (data) => api.post('/orders/', data),

  /** Get current user's orders (buyer or seller) */
  list: (skip = 0, limit = 20, status = null) =>
    api.get('/orders/', { params: { skip, limit, status } }),

  /** Get order detail */
  get: (orderId) => api.get(`/orders/${orderId}`),

  /** Update order status (seller) */
  updateStatus: (orderId, status) =>
    api.put(`/orders/${orderId}/status`, { status }),

  /** Cancel order (buyer) */
  cancel: (orderId) => api.delete(`/orders/${orderId}`),
};

// ── Suggestions & Wishlist API ───────────────────────────────────────────────
export const suggestionsAPI = {
  /** List community dish suggestions */
  list: (status = null, category = null, skip = 0, limit = 30) =>
    api.get('/suggestions/', { params: { status, category, skip, limit } }),

  /** Propose a new dish suggestion */
  create: (data) => api.post('/suggestions/', data),

  /** Toggle upvote on a suggestion */
  upvote: (suggestionId) => api.post(`/suggestions/${suggestionId}/upvote`),

  /** Chef claims suggestion and launches pre-order batch */
  claim: (suggestionId, data) =>
    api.post(`/suggestions/${suggestionId}/claim`, data),
};

// ── Payments & Financial Ledger API ─────────────────────────────────────────
export const paymentsAPI = {
  /** Initiate payment for an order */
  initiate: (orderId) => api.post(`/payments/orders/${orderId}/initiate`),

  /** Capture payment with Razorpay signature */
  capture: (orderId, paymentId, signature) =>
    api.post(`/payments/orders/${orderId}/capture`, {
      payment_id: paymentId,
      signature: signature,
    }),

  /** Get current seller's ledger balance */
  getBalance: () => api.get('/payments/balance/me'),

  /** Get seller's ledger transaction history */
  getLedger: (skip = 0, limit = 20) =>
    api.get('/payments/ledger/me', { params: { skip, limit } }),
};

// ── In-Building Delivery API ────────────────────────────────────────────────
export const deliveryAPI = {
  /** Get delivery status for an order */
  get: (orderId) => api.get(`/deliveries/orders/${orderId}`),

  /** Initiate delivery (seller) */
  create: (data) => api.post('/deliveries/', data),

  /** Dispatch delivery (en route to flat) */
  dispatch: (deliveryId) => api.patch(`/deliveries/${deliveryId}/dispatch`),

  /** Mark delivery completed at flat door */
  deliver: (deliveryId) => api.patch(`/deliveries/${deliveryId}/deliver`),
};

// ── Ratings API ────────────────────────────────────────────────────────────
export const ratingsAPI = {
  /** Rate a completed order */
  create: (orderId, rating, comment = null) =>
    api.post(`/ratings/orders/${orderId}`, {
      rating,
      comment,
    }),

  /** Get seller ratings */
  bySeller: (sellerId, skip = 0, limit = 20) =>
    api.get(`/ratings/sellers/${sellerId}`, { params: { skip, limit } }),
};

// ── AI / Multimodal ──────────────────────────────────────────────────────────
export const aiAPI = {
  /** Multimodal dish analysis (dietary tags, allergens, calories, price guidance) */
  analyzeDish: (data) => api.post('/ai/analyze-dish', data),

  /** AI meal advisory */
  mealAdvisor: (data) => api.post('/ai/meal-advisor', data),

  /** Multimodal search */
  multimodalSearch: (data) =>
    api.post('/ai/search', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

export default api;


