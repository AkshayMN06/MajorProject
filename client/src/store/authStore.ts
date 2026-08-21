import { create } from 'zustand';
import { authApi, userApi } from '../services/api';

export interface User {
  id: string;
  email: string;
  name: string;
  usn?: string;
  department?: string;
  semester?: number;
  college?: string;
  avatar?: string;
  bio?: string;
  phone?: string;
  location?: string;
  preferredRole?: string;
  timezone?: string;
  role?: string; // 'USER' | 'ADMIN'
  createdAt: string;
}

export interface RegisterData {
  email: string;
  password?: string;
  name: string;
  usn?: string;
  department?: string;
  college?: string;
  [key: string]: any;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  login: (email: string, password?: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
  clearError: () => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('cyberlearn_token'),
  isAuthenticated: !!localStorage.getItem('cyberlearn_token'),
  isLoading: false,
  error: null,

  login: async (email: string, password?: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authApi.login({ email, password });
      const { token, user } = response;
      localStorage.setItem('cyberlearn_token', token);
      set({ user, token, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Login failed', isLoading: false });
      throw err;
    }
  },

  register: async (data: RegisterData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authApi.register(data);
      const { token, user } = response;
      localStorage.setItem('cyberlearn_token', token);
      set({ user, token, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Registration failed', isLoading: false });
      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem('cyberlearn_token');
    set({ user: null, token: null, isAuthenticated: false, error: null });
    window.location.href = '/login';
  },

  loadUser: async () => {
    const token = localStorage.getItem('cyberlearn_token');
    if (!token) {
      set({ isAuthenticated: false, isLoading: false });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const user = await authApi.getMe();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      localStorage.removeItem('cyberlearn_token');
      set({ user: null, token: null, isAuthenticated: false, error: null, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),

  updateProfile: async (data: Partial<User>) => {
    set({ isLoading: true, error: null });
    try {
      const updatedUser = await userApi.updateProfile(data);
      set({ user: updatedUser, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to update profile', isLoading: false });
      throw err;
    }
  },

  changePassword: async (oldPassword: string, newPassword: string) => {
    set({ isLoading: true, error: null });
    try {
      await authApi.changePassword({ oldPassword, newPassword });
      set({ isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to change password', isLoading: false });
      throw err;
    }
  },

  deleteAccount: async (password: string) => {
    set({ isLoading: true, error: null });
    try {
      await userApi.deleteAccount(password);
      localStorage.removeItem('cyberlearn_token');
      set({ user: null, token: null, isAuthenticated: false, isLoading: false, error: null });
      window.location.href = '/login';
    } catch (err: any) {
      set({ error: err.message || 'Failed to delete account', isLoading: false });
      throw err;
    }
  },
}));
