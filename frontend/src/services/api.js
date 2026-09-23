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

  // Handle Axios / Fetch response details
  const detail = error.response?.data?.detail ?? error.response?.data?.message;

  // 1. If detail is an array of Pydantic validation error objects (FastAPI 422)
  if (Array.isArray(detail)) {
    const formatted = detail
      .map((err) => {
        if (typeof err === 'string') return err;
        if (typeof err === 'object' && err !== null) {
          const loc = Array.isArray(err.loc)
            ? err.loc.filter((part) => part !== 'body').join('.')
            : '';
          const msg = err.msg || err.message || JSON.stringify(err);
          return loc ? `${loc}: ${msg}` : msg;
        }
        return String(err);
      })
      .filter(Boolean)
      .join('; ');
    if (formatted) return formatted;
  }

  // 2. If detail is a single object
  if (typeof detail === 'object' && detail !== null) {
    if (detail.msg) return String(detail.msg);
    if (detail.message) return String(detail.message);
    return JSON.stringify(detail);
  }

  // 3. If detail is a non-empty string
  if (typeof detail === 'string' && detail.trim()) {
    return detail.trim();
  }

  // 4. Check error.message (e.g., Network Error, timeout)
  if (typeof error.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }

  return fallback;
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
      if (typeof window !== 'undefined' && window.location && process.env.NODE_ENV !== 'test') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ── Auth API ───────────────────────────────────────────────────────────────
export const authAPI = {
  /** Request passwordless OTP via Email or WhatsApp */
  requestOtp: (email, role = 'buyer', channel = 'email', phone = null) =>
    api.post('/auth/otp/request', { email, role, channel, phone }),

  /** Verify OTP and authenticate */
  verifyOtp: (email, otp, name = null, role = 'buyer') =>
    api.post('/auth/otp/verify', { email, otp, name, role }),

  /** Register a new user */
  register: (email, password, name, role = 'buyer') =>
    api.post('/auth/register', { email, password, name, role }),

  /** Login with email and password */
  login: (email, password, role = null) =>
    api.post('/auth/login', { email, password, ...(role ? { role } : {}) }),

  /** Switch active role between buyer and seller */
  switchRole: (targetRole = null) =>
    api.post('/auth/switch-role', { target_role: targetRole }),

  /** Refresh JWT */
  refresh: (refreshToken) =>
    api.post('/auth/refresh', { refresh_token: refreshToken }),

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

  /** Update own seller profile (bio, photo, upi_id, upi_account_name) */
  updateProfile: (data) => api.put('/sellers/me', data),

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

  /** Toggle item availability and optional portion count */
  toggleAvailability: (menuId, isAvailable, quantity = null) =>
    api.patch(`/menus/${menuId}/availability`, {
      is_available: isAvailable,
      ...(quantity !== null ? { quantity } : {}),
    }),

  /** Update portion count directly */
  updatePortions: (menuId, quantity) =>
    api.patch(`/menus/${menuId}/availability`, {
      is_available: quantity > 0,
      quantity,
    }),

  /** Upload image for a menu item */
  uploadImage: (menuId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/menus/${menuId}/image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

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

  /** List open cravings matched for the authenticated seller's kitchen */
  listMatched: (minScore = 35, limit = 30) =>
    api.get('/suggestions/matched', { params: { min_score: minScore, limit } }),

  /** Propose a new dish suggestion */
  create: (data) => api.post('/suggestions/', data),

  /** Toggle upvote on a suggestion */
  upvote: (suggestionId) => api.post(`/suggestions/${suggestionId}/upvote`),

  /** Chef claims suggestion and launches pre-order batch or links existing item */
  claim: (suggestionId, data) =>
    api.post(`/suggestions/${suggestionId}/claim`, data),
};


// ── Payments & Financial Ledger API ─────────────────────────────────────────
export const paymentsAPI = {
  /** Initiate direct P2PM UPI payment intent */
  initiateDirectUPI: (orderId) => api.post(`/payments/orders/${orderId}/direct-upi`),

  /** Buyer submits 12-digit UPI UTR reference */
  submitUTR: (orderId, utrNumber) =>
    api.post(`/payments/orders/${orderId}/submit-utr`, { utr_number: utrNumber }),

  /** Seller confirms receipt of direct UPI payment in bank account */
  confirmReceived: (orderId) =>
    api.post(`/payments/orders/${orderId}/confirm-received`),

  /** Get chef's SaaS pass quota, free orders remaining, and balance */
  getMaintenanceStatus: () => api.get('/payments/maintenance/status'),

  /** Chef recharges maintenance credit balance */
  topupMaintenance: (amount, utrNumber) =>
    api.post('/payments/maintenance/topup', { amount, utr_number: utrNumber }),

  /** Initiate payment for an order (Razorpay fallback) */
  initiate: (orderId) => api.post(`/payments/orders/${orderId}/initiate`),

  /** Capture payment with Razorpay signature */
  capture: (orderId, providerPaymentId, providerSignature) =>
    api.post(`/payments/orders/${orderId}/capture`, {
      provider_payment_id: providerPaymentId,
      provider_signature: providerSignature,
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
  create: (orderId, estimatedMinutes = 15, notes = null) =>
    api.post(`/deliveries/orders/${orderId}`, {
      estimated_minutes: estimatedMinutes,
      notes: notes,
    }),

  /** Update delivery status (seller) */
  updateStatus: (deliveryId, newStatus, notes = null) =>
    api.patch(`/deliveries/${deliveryId}/status`, {
      new_status: newStatus,
      notes: notes,
    }),

  /** Dispatch delivery (en route to flat) */
  dispatch: (deliveryId, notes = null) =>
    api.patch(`/deliveries/${deliveryId}/status`, {
      new_status: 'dispatched',
      notes: notes,
    }),

  /** Mark delivery completed at flat door */
  deliver: (deliveryId, notes = null) =>
    api.patch(`/deliveries/${deliveryId}/status`, {
      new_status: 'delivered',
      notes: notes,
    }),
};

// ── Ratings API ────────────────────────────────────────────────────────────
export const ratingsAPI = {
  /** Rate a completed order */
  create: (orderId, score, reviewText = null) =>
    api.post(`/ratings/orders/${orderId}`, {
      score: parseInt(score, 10),
      review_text: reviewText || null,
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

