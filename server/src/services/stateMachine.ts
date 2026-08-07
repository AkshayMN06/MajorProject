// Backend-only session state machine. Stateless by design — the database
// (Session.status) is the single source of truth, not an in-memory map, so
// it stays correct across server restarts and multiple sessions.

export enum SessionState {
  START = 'START',
  WAITING_FOR_PARTICIPANT = 'WAITING_FOR_PARTICIPANT',
  SESSION_READY = 'SESSION_READY',
  SCENARIO_LOADED = 'SCENARIO_LOADED',
  ATTACK_SELECTION = 'ATTACK_SELECTION',
  DEFENSE_SELECTION = 'DEFENSE_SELECTION',
  RULE_PROCESSING = 'RULE_PROCESSING',
  RESULT_GENERATED = 'RESULT_GENERATED',
  NEXT_ROUND = 'NEXT_ROUND',
  ASSESSMENT_COMPLETE = 'ASSESSMENT_COMPLETE',
}

const VALID_TRANSITIONS: Record<SessionState, SessionState[]> = {
  [SessionState.START]: [SessionState.WAITING_FOR_PARTICIPANT],
  [SessionState.WAITING_FOR_PARTICIPANT]: [SessionState.SESSION_READY],
  [SessionState.SESSION_READY]: [SessionState.SCENARIO_LOADED],
  [SessionState.SCENARIO_LOADED]: [SessionState.ATTACK_SELECTION],
  [SessionState.ATTACK_SELECTION]: [SessionState.DEFENSE_SELECTION],
  [SessionState.DEFENSE_SELECTION]: [SessionState.RULE_PROCESSING],
  [SessionState.RULE_PROCESSING]: [SessionState.RESULT_GENERATED],
  [SessionState.RESULT_GENERATED]: [SessionState.NEXT_ROUND],
  [SessionState.NEXT_ROUND]: [SessionState.SCENARIO_LOADED, SessionState.ASSESSMENT_COMPLETE],
  [SessionState.ASSESSMENT_COMPLETE]: [],
};

export function canTransition(from: SessionState, to: SessionState): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Validates a single hop and returns the destination state, or throws.
 */
export function transition(from: string, to: SessionState): SessionState {
  const fromState = from as SessionState;
  if (!VALID_TRANSITIONS[fromState]) {
    throw new Error(`Unknown session state: ${from}`);
  }
  if (!canTransition(fromState, to)) {
    throw new Error(`Invalid session state transition: ${from} -> ${to}`);
  }
  return to;
}

/**
 * Validates a multi-hop chain (e.g. SESSION_READY -> SCENARIO_LOADED -> ATTACK_SELECTION)
 * without requiring every intermediate state to be persisted. Returns the final state.
 */
export function transitionThrough(from: string, path: SessionState[]): SessionState {
  let current = from;
  for (const next of path) {
    current = transition(current, next);
  }
  return current as SessionState;
}
