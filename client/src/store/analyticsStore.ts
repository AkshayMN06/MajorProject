import { create } from 'zustand';
import { analyticsApi, recommendationApi } from '../services/api';
import type { AnalyticsSummary, CategoryAccuracy, PerformanceTrendPoint, Recommendation } from '../services/api';

export type { AnalyticsSummary, CategoryAccuracy, PerformanceTrendPoint as PerformanceTrend, Recommendation } from '../services/api';

interface AnalyticsState {
  summary: AnalyticsSummary | null;
  categoryAccuracy: CategoryAccuracy[];
  performanceTrends: PerformanceTrendPoint[];
  recommendations: Recommendation[];
  isLoading: boolean;
  error: string | null;

  fetchSummary: () => Promise<void>;
  fetchCategoryAccuracy: () => Promise<void>;
  fetchPerformanceTrends: () => Promise<void>;
  fetchRecommendations: () => Promise<void>;
  generateRecommendations: () => Promise<void>;
  fetchAll: () => Promise<void>;
  clearError: () => void;
}

export const useAnalyticsStore = create<AnalyticsState>((set) => ({
  summary: null,
  categoryAccuracy: [],
  performanceTrends: [],
  recommendations: [],
  isLoading: false,
  error: null,

  fetchSummary: async () => {
    set({ isLoading: true, error: null });
    try {
      const summary = await analyticsApi.getSummary();
      set({ summary, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch summary', isLoading: false });
    }
  },

  fetchCategoryAccuracy: async () => {
    set({ isLoading: true, error: null });
    try {
      const categoryAccuracy = await analyticsApi.getCategories();
      set({ categoryAccuracy, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch category accuracy', isLoading: false });
    }
  },

  fetchPerformanceTrends: async () => {
    set({ isLoading: true, error: null });
    try {
      const performanceTrends = await analyticsApi.getTrends();
      set({ performanceTrends, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch performance trends', isLoading: false });
    }
  },

  fetchRecommendations: async () => {
    set({ isLoading: true, error: null });
    try {
      const recommendations = await recommendationApi.get();
      set({ recommendations, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch recommendations', isLoading: false });
    }
  },

  generateRecommendations: async () => {
    set({ isLoading: true, error: null });
    try {
      const recommendations = await recommendationApi.generate();
      set({ recommendations, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to generate recommendations', isLoading: false });
    }
  },

  fetchAll: async () => {
    set({ isLoading: true, error: null });
    try {
      const [summary, categoryAccuracy, performanceTrends, recommendations] = await Promise.all([
        analyticsApi.getSummary(),
        analyticsApi.getCategories(),
        analyticsApi.getTrends(),
        recommendationApi.get()
      ]);
      set({
        summary,
        categoryAccuracy,
        performanceTrends,
        recommendations,
        isLoading: false
      });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch analytics data', isLoading: false });
    }
  },

  clearError: () => set({ error: null })
}));
