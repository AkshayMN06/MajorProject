import { useEffect, useRef, useCallback, useReducer } from 'react';
import { io, Socket } from 'socket.io-client';
import { apiClient, backendOrigin } from '../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SessionPhase =
  | 'landing'
  | 'resuming'                  // hard refresh mid-round: socket replay pending
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

export interface ScoreBreakdown {
  correctChoice: number;
  timeEfficiency: number;
  consistency: number;
  repeatedMistakes: number;
  total: number;
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
  attackerScoreBreakdown: ScoreBreakdown;
  defenderScoreBreakdown: ScoreBreakdown;
}

export interface CategoryStat {
  category: string;
  total: number;
  succeeded: number;
  accuracy: number;
}

export interface PerformancePoint {
  round: number;
  attackerRoundScore: number;
  defenderRoundScore: number;
  attackerCumulativeScore: number;
  defenderCumulativeScore: number;
}

export interface ReportRecommendation {
  category: string;
  title: string;
  description: string;
}

export interface ModulePerformance {
  moduleTag: string;
  preAccuracy: number | null;
  postAccuracy: number | null;
}

export interface LearningRecommendation {
  title: string;
  description: string;
}

export interface LearningOutcomes {
  hasPreTest: boolean;
  hasPostTest: boolean;
  preTestScore: number | null;
  postTestScore: number | null;
  learningGain: number | null;
  learningGainPercent: number | null;
  modulePerformance: ModulePerformance[];
  weakTopics: string[];
  recommendations: LearningRecommendation[];
}

export interface AssessmentReport {
  sessionId: string;
  sessionCode: string;
  mode?: string; // persisted Session.mode: 'PAIRED' | 'SOLO'
  attackerName: string;
  defenderName: string;
  totalRounds: number;
  attackerFinalScore: number;
  defenderFinalScore: number;
  attackerWins: number;
  defenderWins: number;
  partials: number;
  attackerAccuracy: number;
  defenderAccuracy: number;
  averageAccuracy: number;
  attackerCategories: CategoryStat[];
  defenderCategories: CategoryStat[];
  attackerStrongTopics: string[];
  attackerWeakTopics: string[];
  defenderStrongTopics: string[];
  defenderWeakTopics: string[];
  attackerRecommendations: ReportRecommendation[];
  defenderRecommendations: ReportRecommendation[];
  attackerLearningOutcomes: LearningOutcomes;
  defenderLearningOutcomes: LearningOutcomes;
  performanceTimeline: PerformancePoint[];
  events: any[];
}

// User-facing assessment mode. Persisted/API values stay 'PAIRED' | 'SOLO'.
export type AssessmentMode = 'collaborative' | 'individual';

export function assessmentModeOf(apiMode: string | null | undefined): AssessmentMode | null {
  if (apiMode === 'SOLO') return 'individual';
  if (apiMode === 'PAIRED') return 'collaborative';
  return null;
}

export interface SessionState {
  phase: SessionPhase;
  mode: AssessmentMode | null;
  role: 'attacker' | 'defender' | null;
  sessionId: string | null;
  sessionCode: string | null;
  difficulty: string;
  module: string | null;
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
  // Set while phase === 'resuming' when the replay failed (rejected,
  // unreachable, or timed out); the page shows retry/leave instead of a spinner.
  resumeError: string | null;
}

// How long a resuming client waits for the socket replay before offering retry.
export const RESUME_TIMEOUT_MS = 10_000;

// ─── Reducer ──────────────────────────────────────────────────────────────────

type Action =
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SESSION_CREATED'; sessionId: string; sessionCode: string; difficulty: string; module: string | null; totalRounds: number; role: 'attacker' }
  | { type: 'SESSION_JOINED'; sessionId: string; sessionCode: string; difficulty: string; module: string | null; totalRounds: number; attackerName: string; defenderName: string; role: 'defender' }
  | {
      type: 'SOLO_SESSION_CREATED';
      sessionId: string;
      sessionCode: string;
      difficulty: string;
      module: string | null;
      totalRounds: number;
      role: 'attacker' | 'defender';
      scenario: Scenario;
      roundNumber: number;
      status: string;
      incomingAttack: SessionState['incomingAttack'];
    }
  | { type: 'SESSION_STATE'; data: Partial<SessionState> }
  | { type: 'SESSION_REHYDRATED'; phase: 'waiting_for_participant' | 'waiting_room' | 'resuming'; sessionId: string; sessionCode: string; difficulty: string; module: string | null; totalRounds: number; currentRound: number; attackerScore: number; defenderScore: number; attackerName: string | null; defenderName: string | null; role: 'attacker' | 'defender'; mode: AssessmentMode | null }
  | { type: 'POST_TEST_REHYDRATED'; sessionId: string; role: 'attacker' | 'defender'; report: AssessmentReport }
  | { type: 'PARTNER_JOINED'; defenderName: string }
  | { type: 'PARTNER_CONNECTED'; role: string; userName: string }
  | { type: 'READY_UPDATE'; attackerReady: boolean; defenderReady: boolean }
  | { type: 'MY_READY' }
  | { type: 'SCENARIO_LOADED'; scenario: Scenario; roundNumber: number; totalRounds: number; incomingAttack?: SessionState['incomingAttack'] }
  | { type: 'ATTACK_SUBMITTED'; attackOptionId: string; attackOptionName: string; attackOptionDescription: string; attackCategory: string; attackDifficulty: string }
  | { type: 'DEFENSE_SUBMITTED' }
  | { type: 'ROUND_RESULT'; result: RoundResult }
  | { type: 'ASSESSMENT_COMPLETE'; report: AssessmentReport }
  | { type: 'RESUME_FAILED'; error: string }
  | { type: 'RESUME_RETRY' }
  | { type: 'RESET' };

const initialState: SessionState = {
  phase: 'landing',
  mode: null,
  role: null,
  sessionId: null,
  sessionCode: null,
  difficulty: 'Medium',
  module: null,
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
  resumeError: null,
};

export function reducer(state: SessionState, action: Action): SessionState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.loading, error: null };
    case 'SET_ERROR':
      return { ...state, error: action.error, isLoading: false };
    case 'SESSION_CREATED':
      return {
        ...state,
        mode: 'collaborative',
        phase: 'waiting_for_participant',
        role: action.role,
        sessionId: action.sessionId,
        sessionCode: action.sessionCode,
        difficulty: action.difficulty,
        module: action.module,
        totalRounds: action.totalRounds,
        isLoading: false,
        error: null,
      };
    case 'SESSION_JOINED':
      return {
        ...state,
        mode: 'collaborative',
        phase: 'waiting_room',
        role: action.role,
        sessionId: action.sessionId,
        sessionCode: action.sessionCode,
        difficulty: action.difficulty,
        module: action.module,
        totalRounds: action.totalRounds,
        attackerName: action.attackerName,
        defenderName: action.defenderName,
        partnerConnected: true,
        isLoading: false,
        error: null,
      };
    case 'SOLO_SESSION_CREATED':
      return {
        ...state,
        mode: 'individual',
        phase: action.status === 'DEFENSE_SELECTION' ? 'defense_selection' : 'attack_selection',
        role: action.role,
        sessionId: action.sessionId,
        sessionCode: action.sessionCode,
        difficulty: action.difficulty,
        module: action.module,
        totalRounds: action.totalRounds,
        currentRound: action.roundNumber,
        scenario: action.scenario,
        incomingAttack: action.incomingAttack,
        roundResult: null,
        isLoading: false,
        error: null,
      };
    case 'SESSION_STATE':
      return { ...state, ...action.data };
    case 'SESSION_REHYDRATED':
      return {
        ...state,
        mode: action.mode,
        phase: action.phase,
        role: action.role,
        sessionId: action.sessionId,
        sessionCode: action.sessionCode,
        difficulty: action.difficulty,
        module: action.module,
        totalRounds: action.totalRounds,
        currentRound: action.currentRound,
        attackerScore: action.attackerScore,
        defenderScore: action.defenderScore,
        attackerName: action.attackerName,
        defenderName: action.defenderName,
        partnerConnected: action.phase !== 'waiting_for_participant',
        isLoading: false,
        error: null,
        resumeError: null,
      };
    case 'POST_TEST_REHYDRATED':
      return {
        ...state,
        mode: assessmentModeOf(action.report.mode),
        phase: 'assessment_complete',
        sessionId: action.sessionId,
        role: action.role,
        report: action.report,
        isLoading: false,
        error: null,
      };
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
        incomingAttack: action.incomingAttack ?? null,
        roundResult: null,
        resumeError: null,
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
    case 'DEFENSE_SUBMITTED':
      // Both sides move to a "waiting for evaluation" state until the rule
      // engine finishes and roundCompleted arrives.
      return { ...state, phase: 'waiting_for_result' };
    case 'ROUND_RESULT':
      return {
        ...state,
        phase: 'round_result',
        roundResult: action.result,
        attackerScore: action.result.attackerTotalScore,
        defenderScore: action.result.defenderTotalScore,
      };
    case 'ASSESSMENT_COMPLETE':
      return { ...state, phase: 'assessment_complete', report: action.report, resumeError: null, mode: assessmentModeOf(action.report?.mode) ?? state.mode };
    case 'RESUME_FAILED':
      // Only meaningful while resuming; a late failure after a successful
      // replay must not knock the user out of a live round.
      return state.phase === 'resuming' ? { ...state, resumeError: action.error, isLoading: false } : state;
    case 'RESUME_RETRY':
      return state.phase === 'resuming' ? { ...state, resumeError: null } : state;
    case 'RESET':
      return { ...initialState };
    default:
      return state;
  }
}

// ─── Socket join binding ──────────────────────────────────────────────────────

// Joins the session room on every (re)connect of this socket. The server only
// adds a socket to the room and replays round state in response to
// joinSession, and a fresh connection is a fresh server-side socket — so a
// join sent just before a drop is lost unless it is re-sent on reconnect.
export function bindSessionJoin(
  socket: { on(event: 'connect', fn: () => void): unknown; emit(event: string, payload: unknown): unknown },
  getSessionId: () => string | null
) {
  socket.on('connect', () => {
    const sessionId = getSessionId();
    if (sessionId) socket.emit('joinSession', { sessionId });
  });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useScenarioSession() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const socketRef = useRef<Socket | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  // The session the socket should be in; read on every (re)connect. Cleared
  // by reset/unmount so a dropped socket can never rejoin after leaving.
  const joinTargetRef = useRef<string | null>(null);
  // Incremented by every resume attempt, reset and unmount: async resume work
  // that finishes after a newer generation started is discarded.
  const resumeGenRef = useRef(0);

  // Connect socket once, with auth. A socket that exists but is still
  // connecting/reconnecting is reused (socket.io retries on its own and
  // buffers emits) rather than replaced, which would duplicate listeners.
  const connectSocket = useCallback(() => {
    if (socketRef.current) return;

    const token = localStorage.getItem('cyberlearn_token');
    // A deployed backend (Vercel Functions) supports WebSocket only — no
    // HTTP long-polling fallback; locally the dev proxy handles both.
    const socket = io(backendOrigin || '/', {
      auth: { token },
      transports: backendOrigin ? ['websocket'] : ['websocket', 'polling'],
    });

    bindSessionJoin(socket, () => joinTargetRef.current);

    socket.on('sessionState', (data: any) => {
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
          mode: assessmentModeOf(data.mode) ?? s.mode,
        },
      });
    });

    socket.on('participantJoined', (data: any) => {
      dispatch({ type: 'PARTNER_JOINED', defenderName: data.defenderName });
    });

    socket.on('partnerConnected', (data: any) => {
      dispatch({ type: 'PARTNER_CONNECTED', role: data.role, userName: data.userName });
    });

    socket.on('participantReady', (data: any) => {
      dispatch({ type: 'READY_UPDATE', attackerReady: data.attackerReady, defenderReady: data.defenderReady });
      // If both ready, server will emit scenarioLoaded soon
    });

    socket.on('scenarioLoaded', (data: any) => {
      dispatch({
        type: 'SCENARIO_LOADED',
        scenario: data.scenario,
        roundNumber: data.roundNumber,
        totalRounds: data.totalRounds,
        incomingAttack: data.systemAttack
          ? {
              id: data.systemAttack.attackOptionId,
              name: data.systemAttack.attackOptionName,
              description: data.systemAttack.attackOptionDescription,
              category: data.systemAttack.attackCategory,
              difficulty: data.systemAttack.attackDifficulty,
            }
          : undefined,
      });
    });

    socket.on('attackSubmitted', (data: any) => {
      dispatch({
        type: 'ATTACK_SUBMITTED',
        attackOptionId: data.attackOptionId,
        attackOptionName: data.attackOptionName,
        attackOptionDescription: data.attackOptionDescription,
        attackCategory: data.attackCategory,
        attackDifficulty: data.attackDifficulty,
      });
    });

    socket.on('defenseSubmitted', () => {
      dispatch({ type: 'DEFENSE_SUBMITTED' });
    });

    // ruleProcessed carries a preview of the outcome before roundCompleted's
    // full payload arrives; no separate UI state needed today, but the
    // listener is here for parity with the spec's event list.
    socket.on('ruleProcessed', () => {});

    socket.on('roundCompleted', (data: any) => {
      dispatch({ type: 'ROUND_RESULT', result: data as RoundResult });
    });

    socket.on('assessmentCompleted', (data: any) => {
      dispatch({ type: 'ASSESSMENT_COMPLETE', report: data.report });
    });

    socket.on('sessionError', (data: any) => {
      const message = data?.message ?? 'An error occurred';
      // A rejected replay while resuming gets the retry/leave screen; a
      // toast alone would leave the page on the spinner.
      if (stateRef.current.phase === 'resuming') dispatch({ type: 'RESUME_FAILED', error: message });
      else dispatch({ type: 'SET_ERROR', error: message });
    });

    socket.on('connect_error', (err: Error) => {
      if (stateRef.current.phase === 'resuming') {
        dispatch({ type: 'RESUME_FAILED', error: `Could not connect to the game server (${err.message}).` });
      }
    });

    socketRef.current = socket;
  }, []);

  // Targets a session room. A socket that's already connected joins now; a
  // new or reconnecting one joins from its 'connect' handler — exactly once
  // per connection either way, with no timers to outlive the caller.
  const joinRoom = useCallback((sessionId: string) => {
    joinTargetRef.current = sessionId;
    connectSocket();
    if (socketRef.current?.connected) socketRef.current.emit('joinSession', { sessionId });
  }, [connectSocket]);

  // Drop the socket and invalidate any in-flight resume work.
  const teardown = useCallback(() => {
    resumeGenRef.current += 1;
    joinTargetRef.current = null;
    socketRef.current?.disconnect();
    socketRef.current = null;
  }, []);

  // Cleanup socket on unmount
  useEffect(() => teardown, [teardown]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const createSession = useCallback(async (opts: {
    difficulty: string;
    totalScenarios: number;
    module?: string;
    interleaved?: boolean;
  }) => {
    dispatch({ type: 'SET_LOADING', loading: true });
    try {
      const res = await apiClient.post('/sessions/create', opts);
      if (!res.data.success) throw new Error(res.data.error);
      const { sessionId, sessionCode, difficulty, module, totalScenarios } = res.data.data;

      dispatch({
        type: 'SESSION_CREATED',
        sessionId,
        sessionCode,
        difficulty,
        module: module ?? null,
        totalRounds: totalScenarios,
        role: 'attacker',
      });

      joinRoom(sessionId);
    } catch (err: any) {
      dispatch({ type: 'SET_ERROR', error: err.response?.data?.error ?? err.message });
    }
  }, [joinRoom]);

  const createSoloSession = useCallback(async (opts: {
    difficulty: string;
    totalScenarios: number;
    module?: string;
    soloRole: 'ATTACKER' | 'DEFENDER';
    interleaved?: boolean;
  }) => {
    dispatch({ type: 'SET_LOADING', loading: true });
    try {
      const res = await apiClient.post('/sessions/solo', opts);
      if (!res.data.success) throw new Error(res.data.error);
      const { sessionId, sessionCode, difficulty, module, totalScenarios, soloRole, startedRound } = res.data.data;

      dispatch({
        type: 'SOLO_SESSION_CREATED',
        sessionId,
        sessionCode,
        difficulty,
        module: module ?? null,
        totalRounds: totalScenarios,
        role: soloRole === 'DEFENDER' ? 'defender' : 'attacker',
        scenario: startedRound.scenario,
        roundNumber: startedRound.roundNumber,
        status: startedRound.status,
        incomingAttack: startedRound.systemAttack
          ? {
              id: startedRound.systemAttack.attackOptionId,
              name: startedRound.systemAttack.attackOptionName,
              description: startedRound.systemAttack.attackOptionDescription,
              category: startedRound.systemAttack.attackCategory,
              difficulty: startedRound.systemAttack.attackDifficulty,
            }
          : null,
      });

      joinRoom(sessionId);
    } catch (err: any) {
      dispatch({ type: 'SET_ERROR', error: err.response?.data?.error ?? err.message });
    }
  }, [joinRoom]);

  const joinSession = useCallback(async (sessionCode: string) => {
    dispatch({ type: 'SET_LOADING', loading: true });
    try {
      const res = await apiClient.post('/sessions/join', { sessionCode: sessionCode.toUpperCase() });
      if (!res.data.success) throw new Error(res.data.error);
      const { sessionId, sessionCode: code, difficulty, module, totalScenarios, attackerName, defenderName } = res.data.data;

      dispatch({
        type: 'SESSION_JOINED',
        sessionId,
        sessionCode: code,
        difficulty,
        module: module ?? null,
        totalRounds: totalScenarios,
        attackerName,
        defenderName,
        role: 'defender',
      });

      joinRoom(sessionId);
    } catch (err: any) {
      dispatch({ type: 'SET_ERROR', error: err.response?.data?.error ?? err.message });
    }
  }, [joinRoom]);

  // Rehydrates a hard-refreshed client (see GET /sessions/resumable). Pre-play
  // sessions land straight in the waiting room; mid-round sessions show a
  // 'resuming' state until the socket's joinSession replays the persisted
  // scenario / attack / round result, which then sets the real phase.
  // Returns 'active' | 'post_test' | null (nothing to resume) | 'error'
  // (the check itself failed) | 'stale' (superseded by a newer attempt,
  // reset or unmount — nothing was dispatched or connected).
  const rehydrateActiveSession = useCallback(async (): Promise<'active' | 'post_test' | 'error' | 'stale' | null> => {
    const generation = ++resumeGenRef.current;
    const isStale = () => generation !== resumeGenRef.current;
    try {
      const res = await apiClient.get('/sessions/resumable');
      if (isStale()) return 'stale';
      if (!res.data.success) return null;
      const { activeSession, pendingPostTestSession } = res.data.data;

      if (activeSession) {
        dispatch({
          type: 'SESSION_REHYDRATED',
          phase:
            activeSession.status === 'SESSION_READY' ? 'waiting_room'
            : activeSession.status === 'WAITING_FOR_PARTICIPANT' ? 'waiting_for_participant'
            : 'resuming',
          sessionId: activeSession.sessionId,
          sessionCode: activeSession.sessionCode,
          difficulty: activeSession.difficulty,
          module: activeSession.module ?? null,
          totalRounds: activeSession.totalScenarios,
          currentRound: activeSession.currentRound ?? 1,
          attackerScore: activeSession.attackerScore ?? 0,
          defenderScore: activeSession.defenderScore ?? 0,
          attackerName: activeSession.attackerName,
          defenderName: activeSession.defenderName,
          role: activeSession.role,
          mode: assessmentModeOf(activeSession.mode),
        });
        joinRoom(activeSession.sessionId);
        return 'active';
      }

      if (pendingPostTestSession) {
        const reportRes = await apiClient.get(`/sessions/${pendingPostTestSession.sessionId}/report`);
        if (isStale()) return 'stale';
        if (reportRes.data.success) {
          dispatch({
            type: 'POST_TEST_REHYDRATED',
            sessionId: pendingPostTestSession.sessionId,
            role: pendingPostTestSession.role,
            report: reportRes.data.data,
          });
          return 'post_test';
        }
      }

      return null;
    } catch {
      return isStale() ? 'stale' : 'error';
    }
  }, [joinRoom]);

  // Replay watchdog: armed whenever we're resuming without an error, and
  // cleared by any phase change (successful replay), a failure, retry, or
  // unmount — the effect cleanup owns the timer, nothing else does.
  useEffect(() => {
    if (state.phase !== 'resuming' || state.resumeError) return;
    const timer = setTimeout(() => {
      dispatch({ type: 'RESUME_FAILED', error: 'The session did not respond in time.' });
    }, RESUME_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [state.phase, state.resumeError]);

  // Retry from the resume error screen: drop the old socket, re-check what
  // is resumable (the session may have moved on or finished), reconnect.
  // Never writes to the session itself.
  const retryResume = useCallback(async () => {
    teardown();
    dispatch({ type: 'RESUME_RETRY' });
    const outcome = await rehydrateActiveSession();
    if (outcome === 'stale') return; // left or retried again meanwhile
    if (outcome === 'error') {
      dispatch({ type: 'RESUME_FAILED', error: 'Could not reach the server. Check your connection and try again.' });
    } else if (outcome === null) {
      dispatch({ type: 'RESET' });
      dispatch({ type: 'SET_ERROR', error: 'That session can no longer be resumed.' });
    }
  }, [rehydrateActiveSession, teardown]);

  const markReady = useCallback(() => {
    const { sessionId } = stateRef.current;
    if (!sessionId) return;
    dispatch({ type: 'MY_READY' });
    socketRef.current?.emit('markReady', { sessionId });
  }, []);

  const submitAttack = useCallback((attackOptionId: string) => {
    const { sessionId } = stateRef.current;
    if (!sessionId) return;
    socketRef.current?.emit('submitAttack', { sessionId, attackOptionId });
    // Phase change will come from 'attackSubmitted' event
  }, []);

  const submitDefense = useCallback((defenseOptionId: string) => {
    const { sessionId } = stateRef.current;
    if (!sessionId) return;
    dispatch({ type: 'SESSION_STATE', data: { phase: 'waiting_for_result' } });
    socketRef.current?.emit('submitDefense', { sessionId, defenseOptionId });
  }, []);

  const continueToNextRound = useCallback(() => {
    const { sessionId } = stateRef.current;
    if (!sessionId) return;
    socketRef.current?.emit('nextRound', { sessionId });
  }, []);

  // The report attached to the 'assessmentCompleted' socket event is built
  // the instant the last round finishes — necessarily BEFORE the Post-test
  // has been taken, so its learningOutcomes always show no Post-test score
  // at that point. Call this after the Post-test is submitted to replace
  // the stale cached report with a freshly-built one that reflects it.
  const refreshReport = useCallback(async () => {
    const { sessionId } = stateRef.current;
    if (!sessionId) return;
    try {
      const res = await apiClient.get(`/sessions/${sessionId}/report`);
      if (res.data.success) {
        dispatch({ type: 'SESSION_STATE', data: { report: res.data.data } });
      }
    } catch {
      // Leave the existing (stale) report in place rather than blanking it.
    }
  }, []);

  const reset = useCallback(() => {
    teardown();
    dispatch({ type: 'RESET' });
  }, [teardown]);

  const clearError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', error: null });
  }, []);

  return {
    state,
    createSession,
    createSoloSession,
    joinSession,
    rehydrateActiveSession,
    retryResume,
    markReady,
    submitAttack,
    submitDefense,
    continueToNextRound,
    refreshReport,
    reset,
    clearError,
  };
}
