import axios from 'axios';

// Base API URL is proxied via Vite
const apiClient = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

// Request interceptor to attach JWT
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('cyberlearn_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle 401s
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('cyberlearn_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

/**
 * Helper to unwrap the response data.
 * Backend returns { success: boolean, data?: T, error?: string }
 */
const unwrap = async <T>(promise: Promise<any>): Promise<T> => {
  const response = await promise;
  if (!response.data.success && response.data.error) {
    throw new Error(response.data.error);
  }
  return response.data.data as T;
};

// --- Auth API ---
export const authApi = {
  register: (data: any) => unwrap<any>(apiClient.post('/auth/register', data)),
  login: (data: any) => unwrap<any>(apiClient.post('/auth/login', data)),
  getMe: () => unwrap<any>(apiClient.get('/auth/me')),
  changePassword: (data: any) => unwrap<any>(apiClient.put('/auth/password', data)),
};

// --- Users API ---
export const userApi = {
  getProfile: (id: string) => unwrap<any>(apiClient.get(`/users/${id}`)),
  updateProfile: (data: any) => unwrap<any>(apiClient.put(`/users/me`, data)),
  getStats: (id: string) => unwrap<any>(apiClient.get(`/users/${id}/stats`)),
  deleteAccount: (password: string) => unwrap<any>(apiClient.delete('/users/me', { data: { password } })),
};

// --- Sessions API ---
export const sessionApi = {
  create: (data: { totalScenarios?: number }) => unwrap<any>(apiClient.post('/sessions', data)),
  getById: (id: string) => unwrap<any>(apiClient.get(`/sessions/${id}`)),
  getActive: () => unwrap<any>(apiClient.get('/sessions/active')),
};

// --- Scenarios API ---
export const scenarioApi = {
  getAll: (category?: string) => unwrap<any>(apiClient.get(`/scenarios${category ? `?category=${category}` : ''}`)),
  getById: (id: string) => unwrap<any>(apiClient.get(`/scenarios/${id}`)),
};

// --- Analytics API ---
export const analyticsApi = {
  get: () => unwrap<any>(apiClient.get('/analytics')),
  getSummary: () => unwrap<any>(apiClient.get('/analytics/summary')),
  getTrends: () => unwrap<any>(apiClient.get('/analytics/trends')),
  getCategories: () => unwrap<any>(apiClient.get('/analytics/categories')),
};

// --- Recommendations API ---
export const recommendationApi = {
  get: () => unwrap<any>(apiClient.get('/recommendations')),
  generate: () => unwrap<any>(apiClient.post('/recommendations/generate')),
  markComplete: (id: string) => unwrap<any>(apiClient.patch(`/recommendations/${id}/complete`)),
};

// --- Modules API ---
export const moduleApi = {
  getAll: () => unwrap<any>(apiClient.get('/modules')),
  getById: (id: string) => unwrap<any>(apiClient.get(`/modules/${id}`)),
};

export { apiClient };
