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

// --- Analytics API ---
export interface AnalyticsSummary {
  totalSessions: number;
  scenariosAttempted: number;
  correctDecisions: number;
  incorrectDecisions: number;
  averageScore: number;
  averageResponseTime: number;
  accuracyChangeVsLastWeek: number | null;
  responseTimeStats: { fastest: number; median: number; slowest: number } | null;
}

export interface PerformanceTrendPoint {
  date: string;
  accuracy: number;
  responseTime: number;
}

export interface CategoryAccuracy {
  category: string;
  accuracy: number;
}

export interface RecentActivityItem {
  id: string;
  date: string;
  scenario: string;
  role: string;
  accuracy: number;
  time: number;
}

export const analyticsApi = {
  get: () => unwrap<any>(apiClient.get('/analytics')),
  getSummary: () => unwrap<AnalyticsSummary>(apiClient.get('/analytics/summary')),
  getTrends: () => unwrap<PerformanceTrendPoint[]>(apiClient.get('/analytics/trends')),
  getCategories: () => unwrap<CategoryAccuracy[]>(apiClient.get('/analytics/categories')),
  getActivity: () => unwrap<RecentActivityItem[]>(apiClient.get('/analytics/activity')),
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

// --- Labs API ---
export const labsApi = {
  chat: (message: string, history: { role: 'user' | 'assistant'; content: string }[]) =>
    unwrap<{ reply: string }>(apiClient.post('/labs/chat', { message, history })),
};

// --- Quiz (Pre-test / Post-test) API ---
export type QuizTestType = 'PRE' | 'POST';

export interface QuizQuestion {
  id: string;
  questionId: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  topic: string;
  moduleTag: string;
  topicTag: string;
  difficulty: string;
}

export interface CompletedAttemptSummary {
  id: string;
  score: number;
  totalQuestions: number;
  completedAt: string;
}

export interface QuizResultResponseItem {
  questionId: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  selectedOption: string;
  correctOption: string;
  isCorrect: boolean;
  explanation: string;
  topic: string;
  moduleTag: string;
}

export interface QuizResult {
  attemptId: string;
  testType: QuizTestType;
  testForm: string;
  score: number;
  totalQuestions: number;
  completedAt: string;
  responses: QuizResultResponseItem[];
}

export const quizApi = {
  getQuestions: (testType: QuizTestType) =>
    unwrap<{ testType: QuizTestType; testForm: string; questions: QuizQuestion[]; completedAttempt: CompletedAttemptSummary | null }>(
      apiClient.get('/quiz/questions', { params: { testType } })
    ),
  start: (testType: QuizTestType) =>
    unwrap<{ attemptId: string; testType: QuizTestType; testForm: string; totalQuestions: number }>(
      apiClient.post('/quiz/start', { testType })
    ),
  submit: (attemptId: string, responses: { questionId: string; selectedOption: string }[]) =>
    unwrap<{ attemptId: string; score: number; totalQuestions: number }>(
      apiClient.post('/quiz/submit', { attemptId, responses })
    ),
  getResult: (attemptId: string) => unwrap<QuizResult>(apiClient.get(`/quiz/result/${attemptId}`)),
};

// --- CSV Export API ---
// These return raw CSV blobs (not the {success,data} envelope), so they
// bypass `unwrap` and are consumed directly by the caller.
export const exportApi = {
  downloadEventsCsv: (sessionId: string) =>
    apiClient.get(`/export/session/${sessionId}/events.csv`, { responseType: 'blob' }),
  downloadAttemptsCsv: (sessionId: string) =>
    apiClient.get(`/export/session/${sessionId}/attempts.csv`, { responseType: 'blob' }),
  downloadResultsCsv: (sessionId: string) =>
    apiClient.get(`/export/session/${sessionId}/results.csv`, { responseType: 'blob' }),
};

export { apiClient };
