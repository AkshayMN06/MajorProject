import { create } from 'zustand';
import { sessionApi, scenarioApi } from '../services/api';
import { socketService } from '../services/socket';

export interface Session {
  id: string;
  status: string;
  createdAt: string;
  [key: string]: any;
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  [key: string]: any;
}

export interface ScoreBreakdown {
  effectiveness: number;
  time: number;
  [key: string]: number;
}

export interface EvaluationResult {
  winner: 'attacker' | 'defender' | 'tie';
  attackerScore: number;
  defenderScore: number;
  feedback: string;
  attackerBreakdown?: ScoreBreakdown;
  defenderBreakdown?: ScoreBreakdown;
}

export interface TimelineEvent {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  data?: any;
}

interface SessionState {
  activeSession: Session | null;
  role: 'attacker' | 'defender' | null;
  sessionState: string;
  
  currentScenario: Scenario | null;
  scenarioIndex: number;
  totalScenarios: number;
  
  selectedAttack: string | null;
  selectedDefense: string | null;
  attackParameters: Record<string, unknown>;
  defenseParameters: Record<string, unknown>;
  
  evaluationResult: EvaluationResult | null;
  attackerScore: number;
  defenderScore: number;
  
  timeline: TimelineEvent[];
  
  partnerConnected: boolean;
  isLoading: boolean;
  error: string | null;
  timeRemaining: number;

  createSession: (role: 'attacker' | 'defender', totalScenarios?: number) => Promise<void>;
  joinSession: (sessionId: string, role: 'attacker' | 'defender') => Promise<void>;
  leaveSession: () => void;
  selectAttack: (choice: string) => void;
  selectDefense: (choice: string) => void;
  setAttackParameters: (params: Record<string, unknown>) => void;
  setDefenseParameters: (params: Record<string, unknown>) => void;
  requestNextScenario: () => void;
  addTimelineEvent: (event: TimelineEvent) => void;
  resetSession: () => void;
  setupSocketListeners: () => void;
  cleanupSocketListeners: () => void;
}

const initialState = {
  activeSession: null,
  role: null as 'attacker' | 'defender' | null,
  sessionState: 'idle',
  
  currentScenario: null,
  scenarioIndex: 0,
  totalScenarios: 0,
  
  selectedAttack: null,
  selectedDefense: null,
  attackParameters: {},
  defenseParameters: {},
  
  evaluationResult: null,
  attackerScore: 0,
  defenderScore: 0,
  
  timeline: [],
  
  partnerConnected: false,
  isLoading: false,
  error: null,
  timeRemaining: 0,
};

export const useSessionStore = create<SessionState>((set, get) => ({
  ...initialState,

  createSession: async (role, totalScenarios = 3) => {
    set({ isLoading: true, error: null });
    try {
      const session = await sessionApi.create({ totalScenarios });
      set({ activeSession: session, role, isLoading: false });
      socketService.joinSession(session.id, role);
      get().setupSocketListeners();
    } catch (err: any) {
      set({ error: err.message || 'Failed to create session', isLoading: false });
    }
  },

  joinSession: async (sessionId, role) => {
    set({ isLoading: true, error: null });
    try {
      const session = await sessionApi.get(sessionId);
      set({ activeSession: session, role, isLoading: false });
      socketService.joinSession(sessionId, role);
      get().setupSocketListeners();
    } catch (err: any) {
      set({ error: err.message || 'Failed to join session', isLoading: false });
    }
  },

  leaveSession: () => {
    const { activeSession } = get();
    if (activeSession) {
      socketService.leaveSession(activeSession.id);
    }
    get().cleanupSocketListeners();
    set(initialState);
  },

  selectAttack: (choice) => {
    set({ selectedAttack: choice });
    socketService.emit('select_attack', { choice, parameters: get().attackParameters });
  },

  selectDefense: (choice) => {
    set({ selectedDefense: choice });
    socketService.emit('select_defense', { choice, parameters: get().defenseParameters });
  },

  setAttackParameters: (params) => {
    set((state) => ({ attackParameters: { ...state.attackParameters, ...params } }));
  },

  setDefenseParameters: (params) => {
    set((state) => ({ defenseParameters: { ...state.defenseParameters, ...params } }));
  },

  requestNextScenario: () => {
    socketService.emit('request_next_scenario', {});
  },

  addTimelineEvent: (event) => {
    set((state) => ({ timeline: [...state.timeline, event] }));
  },

  resetSession: () => {
    set(initialState);
  },

  setupSocketListeners: () => {
    socketService.on('session_state_change', (data: any) => {
      set({ sessionState: data.state });
    });

    socketService.on('attack_selected', (data: any) => {
      set({ selectedAttack: data.choice });
      get().addTimelineEvent({
        id: Date.now().toString(),
        type: 'attack',
        message: 'Attack selected',
        timestamp: new Date().toISOString(),
        data
      });
    });

    socketService.on('defense_selected', (data: any) => {
      set({ selectedDefense: data.choice });
      get().addTimelineEvent({
        id: Date.now().toString(),
        type: 'defense',
        message: 'Defense selected',
        timestamp: new Date().toISOString(),
        data
      });
    });

    socketService.on('evaluation_result', (data: { result: EvaluationResult }) => {
      set({ 
        evaluationResult: data.result,
        attackerScore: data.result.attackerScore,
        defenderScore: data.result.defenderScore
      });
    });

    socketService.on('scenario_loaded', (data: { scenario: Scenario, index: number }) => {
      set({ 
        currentScenario: data.scenario,
        scenarioIndex: data.index,
        selectedAttack: null,
        selectedDefense: null,
        attackParameters: {},
        defenseParameters: {}
      });
    });

    socketService.on('session_complete', () => {
      set({ sessionState: 'complete' });
    });

    socketService.on('partner_connected', () => {
      set({ partnerConnected: true });
      get().addTimelineEvent({
        id: Date.now().toString(),
        type: 'system',
        message: 'Partner connected',
        timestamp: new Date().toISOString(),
      });
    });

    socketService.on('partner_disconnected', () => {
      set({ partnerConnected: false });
      get().addTimelineEvent({
        id: Date.now().toString(),
        type: 'system',
        message: 'Partner disconnected',
        timestamp: new Date().toISOString(),
      });
    });

    socketService.on('timer_update', (data: { timeRemaining: number }) => {
      set({ timeRemaining: data.timeRemaining });
    });
  },

  cleanupSocketListeners: () => {
    socketService.off('session_state_change');
    socketService.off('attack_selected');
    socketService.off('defense_selected');
    socketService.off('evaluation_result');
    socketService.off('scenario_loaded');
    socketService.off('session_complete');
    socketService.off('partner_connected');
    socketService.off('partner_disconnected');
    socketService.off('timer_update');
  }
}));
