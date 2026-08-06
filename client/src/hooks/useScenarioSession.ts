import { useEffect, useRef, useCallback, useReducer } from 'react';
import { io, Socket } from 'socket.io-client';
import { apiClient } from '../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SessionPhase =
  | 'landing'
  | 'waiting_for_participant'   // attacker waiting for defender to join
  | 'waiting_room'              // both joined, not ready
  | 'attack_selection'
  | 'waiting_for_defense'       // attacker submitted, waiting for defender
  | 'defense_selection'
  | 'waiting_for_result'        // defender submitted, evaluation in progress
  | 'round_result'
  | 'assessment_complete';

export interface AttackOption {
  id: string;
  name: string;
  description: string;
  difficulty: string;
  category: string;
}

export interface DefenseOption {
  id: string;
  name: string;
  description: string;
  effectiveness: string;
  category: string;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: string;
  targetSystem: string;
  context: string;
  attackOptions: AttackOption[];
  defenseOptions: DefenseOption[];
}

export interface RoundResult {
  roundNumber: number;
  totalRounds: number;
  scenarioName: string;
  attackOptionName: string;
  attackOptionDescription: string;
  defenseOptionName: string;
  defenseOptionDescription: string;
  outcome: 'defended' | 'partially_defended' | 'breached';
  explanation: string;
  attackerRoundScore: number;
  defenderRoundScore: number;
  attackerTotalScore: number;
  defenderTotalScore: number;
  scoreBreakdown: {
    correctConceptUsage: number;
    correctDefense: number;
    timeEfficiency: number;
    consistency: number;
    repeatedMistakes: number;
    total: number;
  };
}

export interface CategoryStat {
  category: string;
  total: number;
  defended: number;
  accuracy: number;
}

export interface AssessmentReport {
  sessionId: string;
  attackerName: string;
  defenderName: string;
  totalRounds: number;
  attackerFinalScore: number;
  defenderFinalScore: number;
  attackerWins: number;
  defenderWins: number;
  partials: number;
  defenderAccuracy: number;
  categories: CategoryStat[];
  strongTopics: string[];
  weakTopics: string[];
  events: any[];
}

export interface SessionState {
  phase: SessionPhase;
  role: 'attacker' | 'defender' | null;
  sessionId: string | null;
  sessionCode: string | null;
  difficulty: string;
  totalRounds: number;
  currentRound: number;
  attackerName: string | null;
  defenderName: string | null;
  attackerScore: number;
  defenderScore: number;
  partnerConnected: boolean;
  partnerReady: boolean;
  myReady: boolean;
  scenario: Scenario | null;
  incomingAttack: { id: string; name: string; description: string; category: string; difficulty: string } | null;
  roundResult: RoundResult | null;
  report: AssessmentReport | null;
  isLoading: boolean;
  error: string | null;
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

type Action =
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SESSION_CREATED'; sessionId: string; sessionCode: string; difficulty: string; totalRounds: number; role: 'attacker' }
  | { type: 'SESSION_JOINED'; sessionId: string; sessionCode: string; difficulty: string; totalRounds: number; attackerName: string; defenderName: string; role: 'defender' }
  | { type: 'SESSION_STATE'; data: Partial<SessionState> }
  | { type: 'PARTNER_JOINED'; defenderName: string }
  | { type: 'PARTNER_CONNECTED'; role: string; userName: string }
  | { type: 'READY_UPDATE'; attackerReady: boolean; defenderReady: boolean }
  | { type: 'MY_READY' }
  | { type: 'SCENARIO_LOADED'; scenario: Scenario; roundNumber: number; totalRounds: number }
  | { type: 'ATTACK_SUBMITTED'; attackOptionId: string; attackOptionName: string; attackOptionDescription: string; attackCategory: string; attackDifficulty: string }
  | { type: 'ROUND_RESULT'; result: RoundResult }
  | { type: 'ASSESSMENT_COMPLETE'; report: AssessmentReport }
  | { type: 'RESET' };

const initialState: SessionState = {
  phase: 'landing',
  role: null,
  sessionId: null,
  sessionCode: null,
  difficulty: 'Medium',
  totalRounds: 5,
  currentRound: 1,
  attackerName: null,
  defenderName: null,
  attackerScore: 0,
  defenderScore: 0,
  partnerConnected: false,
  partnerReady: false,
  myReady: false,
  scenario: null,
  incomingAttack: null,
  roundResult: null,
  report: null,
  isLoading: false,
  error: null,
};

function reducer(state: SessionState, action: Action): SessionState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.loading, error: null };
    case 'SET_ERROR':
      return { ...state, error: action.error, isLoading: false };
    case 'SESSION_CREATED':
      return {
        ...state,
        phase: 'waiting_for_participant',
        role: action.role,
        sessionId: action.sessionId,
        sessionCode: action.sessionCode,
        difficulty: action.difficulty,
        totalRounds: action.totalRounds,
        isLoading: false,
        error: null,
      };
    case 'SESSION_JOINED':
      return {
        ...state,
        phase: 'waiting_room',
        role: action.role,
        sessionId: action.sessionId,
        sessionCode: action.sessionCode,
        difficulty: action.difficulty,
        totalRounds: action.totalRounds,
        attackerName: action.attackerName,
        defenderName: action.defenderName,
        partnerConnected: true,
        isLoading: false,
        error: null,
      };
    case 'SESSION_STATE':
      return { ...state, ...action.data };
    case 'PARTNER_JOINED':
      return {
        ...state,
        phase: 'waiting_room',
        partnerConnected: true,
        defenderName: action.defenderName,
      };
    case 'PARTNER_CONNECTED':
      return { ...state, partnerConnected: true };
    case 'READY_UPDATE':
      return {
        ...state,
        attackerReady: action.attackerReady ?? false,
        defenderReady: action.defenderReady ?? false,
        partnerReady: state.role === 'attacker' ? action.defenderReady : action.attackerReady,
      } as any;
    case 'MY_READY':
      return { ...state, myReady: true };
    case 'SCENARIO_LOADED':
      return {
        ...state,
        phase: state.role === 'attacker' ? 'attack_selection' : 'defense_selection',
        scenario: action.scenario,
        currentRound: action.roundNumber,
        totalRounds: action.totalRounds,
        incomingAttack: null,
        roundResult: null,
      };
    case 'ATTACK_SUBMITTED':
      return state.role === 'attacker'
        ? { ...state, phase: 'waiting_for_defense' }
        : {
            ...state,
            phase: 'defense_selection',
            incomingAttack: {
              id: action.attackOptionId,
              name: action.attackOptionName,
              description: action.attackOptionDescription,
              category: action.attackCategory,
              difficulty: action.attackDifficulty,
            },
          };
    case 'ROUND_RESULT':
      return {
        ...state,
        phase: 'round_result',
        roundResult: action.result,
        attackerScore: action.result.attackerTotalScore,
        defenderScore: action.result.defenderTotalScore,
      };
    case 'ASSESSMENT_COMPLETE':
      return { ...state, phase: 'assessment_complete', report: action.report };
    case 'RESET':
      return { ...initialState };
    default:
      return state;
  }
}

// Helper to read attackerReady/defenderReady without TS complaint
function getReadyFlags(state: SessionState): { attackerReady: boolean; defenderReady: boolean } {
  const s = state as any;
  return { attackerReady: !!s.attackerReady, defenderReady: !!s.defenderReady };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useScenarioSession() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const socketRef = useRef<Socket | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Connect socket once, with auth
  const connectSocket = useCallback(() => {
    if (socketRef.current?.connected) return;

    const token = localStorage.getItem('cyberlearn_token');
    const socket = io('/', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('session_state', (data: any) => {
      const s = stateRef.current;
      let phase: SessionPhase = s.phase;
      if (data.status === 'SESSION_READY' || data.status === 'WAITING_FOR_PARTICIPANT') {
        phase = data.status === 'SESSION_READY' ? 'waiting_room' : 'waiting_for_participant';
      }
      dispatch({
        type: 'SESSION_STATE',
        data: {
          phase,
          sessionCode: data.sessionCode ?? s.sessionCode,
          difficulty: data.difficulty ?? s.difficulty,
          totalRounds: data.totalRounds ?? s.totalRounds,
          currentRound: data.currentRound ?? s.currentRound,
          attackerScore: data.attackerScore ?? s.attackerScore,
          defenderScore: data.defenderScore ?? s.defenderScore,
          attackerName: data.attackerName ?? s.attackerName,
          defenderName: data.defenderName ?? s.defenderName,
          myReady: s.role === 'attacker' ? data.attackerReady : data.defenderReady,
          partnerReady: s.role === 'attacker' ? data.defenderReady : data.attackerReady,
          partnerConnected: !!data.defenderName,
        },
      });
    });

    socket.on('participant_joined', (data: any) => {
      dispatch({ type: 'PARTNER_JOINED', defenderName: data.defenderName });
    });

    socket.on('partner_connected', (data: any) => {
      dispatch({ type: 'PARTNER_CONNECTED', role: data.role, userName: data.userName });
    });

    socket.on('ready_update', (data: any) => {
      const s = stateRef.current;
      dispatch({ type: 'READY_UPDATE', attackerReady: data.attackerReady, defenderReady: data.defenderReady });
      // If both ready, server will emit scenario_loaded soon
    });

    socket.on('scenario_loaded', (data: any) => {
      dispatch({
        type: 'SCENARIO_LOADED',
        scenario: data.scenario,
        roundNumber: data.roundNumber,
        totalRounds: data.totalRounds,
      });
    });

    socket.on('attack_submitted', (data: any) => {
      dispatch({
        type: 'ATTACK_SUBMITTED',
        attackOptionId: data.attackOptionId,
        attackOptionName: data.attackOptionName,
        attackOptionDescription: data.attackOptionDescription,
        attackCategory: data.attackCategory,
        attackDifficulty: data.attackDifficulty,
      });
    });

    socket.on('round_result', (data: any) => {
      dispatch({ type: 'ROUND_RESULT', result: data as RoundResult });
    });

    socket.on('assessment_complete', (data: any) => {
      dispatch({ type: 'ASSESSMENT_COMPLETE', report: data.report });
    });

    socket.on('session_error', (data: any) => {
      dispatch({ type: 'SET_ERROR', error: data.message ?? 'An error occurred' });
    });

    socketRef.current = socket;
  }, []);

  // Cleanup socket on unmount
  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────────

  const createSession = useCallback(async (opts: {
    difficulty: string;
    totalScenarios: number;
    module?: string;
  }) => {
    dispatch({ type: 'SET_LOADING', loading: true });
    try {
      const res = await apiClient.post('/sessions/create', opts);
      if (!res.data.success) throw new Error(res.data.error);
      const { sessionId, sessionCode, difficulty, totalScenarios } = res.data.data;

      dispatch({
        type: 'SESSION_CREATED',
        sessionId,
        sessionCode,
        difficulty,
        totalRounds: totalScenarios,
        role: 'attacker',
      });

      connectSocket();
      setTimeout(() => {
        socketRef.current?.emit('join_session', { sessionId });
      }, 300);
    } catch (err: any) {
      dispatch({ type: 'SET_ERROR', error: err.response?.data?.error ?? err.message });
    }
  }, [connectSocket]);

  const joinSession = useCallback(async (sessionCode: string) => {
    dispatch({ type: 'SET_LOADING', loading: true });
    try {
      const res = await apiClient.post('/sessions/join', { sessionCode: sessionCode.toUpperCase() });
      if (!res.data.success) throw new Error(res.data.error);
      const { sessionId, sessionCode: code, difficulty, totalScenarios, attackerName, defenderName } = res.data.data;

      dispatch({
        type: 'SESSION_JOINED',
        sessionId,
        sessionCode: code,
        difficulty,
        totalRounds: totalScenarios,
        attackerName,
        defenderName,
        role: 'defender',
      });

      connectSocket();
      setTimeout(() => {
        socketRef.current?.emit('join_session', { sessionId });
      }, 300);
    } catch (err: any) {
      dispatch({ type: 'SET_ERROR', error: err.response?.data?.error ?? err.message });
    }
  }, [connectSocket]);

  const markReady = useCallback(() => {
    const { sessionId } = stateRef.current;
    if (!sessionId) return;
    dispatch({ type: 'MY_READY' });
    socketRef.current?.emit('participant_ready', { sessionId });
  }, []);

  const submitAttack = useCallback((attackOptionId: string, parameters: Record<string, string> = {}) => {
    const { sessionId } = stateRef.current;
    if (!sessionId) return;
    socketRef.current?.emit('submit_attack', { sessionId, attackOptionId, parameters });
    // Phase change will come from 'attack_submitted' event
  }, []);

  const submitDefense = useCallback((defenseOptionId: string, parameters: Record<string, string> = {}) => {
    const { sessionId } = stateRef.current;
    if (!sessionId) return;
    dispatch({ type: 'SESSION_STATE', data: { phase: 'waiting_for_result' } });
    socketRef.current?.emit('submit_defense', { sessionId, defenseOptionId, parameters });
  }, []);

  const continueToNextRound = useCallback(() => {
    const { sessionId } = stateRef.current;
    if (!sessionId) return;
    socketRef.current?.emit('next_round', { sessionId });
  }, []);

  const reset = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    dispatch({ type: 'RESET' });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', error: null });
  }, []);

  return {
    state,
    createSession,
    joinSession,
    markReady,
    submitAttack,
    submitDefense,
    continueToNextRound,
    reset,
    clearError,
  };
}
