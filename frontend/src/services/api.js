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
  /** Register / request OTP for an email */
  register: (email, role = 'buyer') =>
    api.post('/auth/register', { email, role }),

  /** Verify OTP and get JWT token */
  login: (email, otp) =>
    api.post('/auth/login', { email, otp }),

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

  /** Register as a seller */
  register: (data) => api.post('/sellers/register', data),
};

// ── Menus API ──────────────────────────────────────────────────────────────
export const menusAPI = {
  /** Get menus for a seller */
  bySeller: (sellerId) => api.get(`/menus/sellers/${sellerId}`),

  /** Create a new menu item */
  create: (data) => api.post('/menus/', data),

  /** Update a menu item */
  update: (menuId, data) => api.put(`/menus/${menuId}`, data),

  /** Toggle item availability */
  toggleAvailability: (menuId, isAvailable) =>
    api.patch(`/menus/${menuId}/availability`, { is_available: isAvailable }),
};

// ── Orders API ─────────────────────────────────────────────────────────────
export const ordersAPI = {
  /** Place a new order */
  create: (data) => api.post('/orders/', data),

  /** Get current user's orders */
  list: (skip = 0, limit = 20) =>
    api.get('/orders/', { params: { skip, limit } }),

  /** Get order detail */
  get: (orderId) => api.get(`/orders/${orderId}`),

  /** Update order status (seller) */
  updateStatus: (orderId, status) =>
    api.put(`/orders/${orderId}/status`, { status }),
};

// ── Ratings API ────────────────────────────────────────────────────────────
export const ratingsAPI = {
  /** Rate a completed order */
  create: (orderId, score, reviewText) =>
    api.post(`/ratings/orders/${orderId}/rate`, {
      score,
      review: reviewText,
    }),

  /** Get seller ratings */
  bySeller: (sellerId, skip = 0, limit = 20) =>
    api.get(`/ratings/sellers/${sellerId}`, { params: { skip, limit } }),
};

export default api;
