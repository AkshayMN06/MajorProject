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

export interface ExistingAttemptSummary {
  id: string;
  status: 'in_progress' | 'completed';
  score: number | null;
  totalQuestions: number;
  completedAt: string | null;
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
  moduleTag: string | null;
  difficulty: string | null;
  score: number;
  totalQuestions: number;
  completedAt: string;
  responses: QuizResultResponseItem[];
}

export const quizApi = {
  getQuestions: (testType: QuizTestType, sessionId: string) =>
    unwrap<{
      testType: QuizTestType;
      moduleTag: string | null;
      difficulty: string | null;
      existingAttempt: ExistingAttemptSummary | null;
      questions: QuizQuestion[];
    }>(apiClient.get('/quiz/questions', { params: { testType, sessionId } })),
  start: (testType: QuizTestType, sessionId: string) =>
    unwrap<{
      attemptId: string;
      testType: QuizTestType;
      moduleTag: string | null;
      difficulty: string | null;
      totalQuestions: number;
      status: 'in_progress' | 'completed';
      questions: QuizQuestion[];
    }>(apiClient.post('/quiz/start', { testType, sessionId })),
  submit: (attemptId: string, responses: { questionId: string; selectedOption: string }[]) =>
    unwrap<{ attemptId: string; score: number; totalQuestions: number }>(
      apiClient.post('/quiz/submit', { attemptId, responses })
    ),
  getResult: (attemptId: string) => unwrap<QuizResult>(apiClient.get(`/quiz/result/${attemptId}`)),
};

// --- Practice Labs API ---
// Role-neutral MCQ practice, reusing Scenario Assessment's own modules
// (Scenario.category) — never a separately maintained module list. Practice
// sessions/results are entirely isolated from assessment analytics.
export interface PracticeModule {
  module: string;
  questionCount: number;
  questionsPerSession: number;
  difficulty: string;
}

export interface PracticeQuestion {
  id: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  topicTag: string;
  difficulty: string;
}

export interface PracticeResultResponseItem {
  questionId: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  selectedOption: string | null;
  correctOption: string;
  isCorrect: boolean;
  explanation: string;
  topic: string;
  moduleTag: string;
}

export interface PracticeResult {
  sessionId: string;
  module: string;
  score: number;
  totalQuestions: number;
  responses: PracticeResultResponseItem[];
}

export interface PracticeCaseStudy {
  id: string;
  title: string;
  description: string;
}

export const practiceApi = {
  getModules: () => unwrap<PracticeModule[]>(apiClient.get('/practice/modules')),
  startSession: (module: string) =>
    unwrap<{ sessionId: string; module: string; caseStudy: PracticeCaseStudy; totalQuestions: number; questions: PracticeQuestion[] }>(
      apiClient.post(`/practice/${encodeURIComponent(module)}/session`)
    ),
  submitSession: (sessionId: string, responses: { questionId: string; selectedOption: string }[]) =>
    unwrap<PracticeResult>(apiClient.post(`/practice/session/${sessionId}/submit`, { responses })),
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

// --- Admin Dashboard API ---
// Every endpoint here requires an ADMIN-role account server-side
// (requireAdmin middleware) — a normal user's token gets a real 403 from
// the API regardless of whether the frontend route guard is reached.
export interface AdminOverallStats {
  pairCount: number;
  avgPrePct: number;
  avgPostPct: number;
  avgImprovementPP: number;
  improved: number;
  unchanged: number;
  decreased: number;
}

export interface AdminStats extends AdminOverallStats {
  totalUsers: number;
}

export interface AdminImprovementRow {
  sessionId: string;
  userId: string;
  userName: string;
  userEmail: string;
  moduleTag: string | null;
  difficulty: string | null;
  preScore: number;
  preTotal: number;
  postScore: number;
  postTotal: number;
  prePct: number;
  postPct: number;
  rawImprovement: number;
  ppImprovement: number;
  category: 'improved' | 'unchanged' | 'decreased';
  completedAt: string;
}

export interface AdminCategoryAggregate {
  category: string;
  attempts: number;
  avgPrePct: number;
  avgPostPct: number;
  avgImprovementPP: number;
}

export interface AdminAnalyticsFilters {
  module?: string;
  difficulty?: string;
  startDate?: string;
  endDate?: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  quizAttemptCount: number;
}

export const adminApi = {
  getStats: () => unwrap<AdminStats>(apiClient.get('/admin/stats')),
  getAnalytics: (filters: AdminAnalyticsFilters = {}) =>
    unwrap<{ overall: AdminOverallStats; rows: AdminImprovementRow[]; moduleSummary: AdminCategoryAggregate[]; difficultySummary: AdminCategoryAggregate[] }>(
      apiClient.get('/admin/analytics', { params: filters })
    ),
  getUsers: (params: { search?: string; page?: number; pageSize?: number } = {}) =>
    unwrap<{ users: AdminUser[]; total: number; page: number; pageSize: number }>(apiClient.get('/admin/users', { params })),
  // Bypasses unwrap for a raw blob download, matching exportApi's pattern.
  // Overrides the default 10s apiClient timeout — the full export can take
  // longer than that.
  exportExcel: (filters: AdminAnalyticsFilters = {}) =>
    apiClient.get('/admin/export', { params: filters, responseType: 'blob', timeout: 60000 }),
};

export { apiClient };
