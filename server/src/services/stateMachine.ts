import { EventEmitter } from 'events';

export enum SessionState {
  START = 'START',
  WAITING_FOR_PLAYERS = 'WAITING_FOR_PLAYERS',
  SCENARIO_LOADED = 'SCENARIO_LOADED',
  ATTACK_SELECTION = 'ATTACK_SELECTION',
  DEFENSE_SELECTION = 'DEFENSE_SELECTION',
  RULE_EVALUATION = 'RULE_EVALUATION',
  SCORE_UPDATE = 'SCORE_UPDATE',
  EVENT_LOGGING = 'EVENT_LOGGING',
  NEXT_SCENARIO = 'NEXT_SCENARIO',
  SESSION_COMPLETE = 'SESSION_COMPLETE',
}

export class StateMachine extends EventEmitter {
  private sessions: Map<string, SessionState> = new Map();

  private validTransitions: Record<SessionState, SessionState[]> = {
    [SessionState.START]: [SessionState.WAITING_FOR_PLAYERS],
    [SessionState.WAITING_FOR_PLAYERS]: [SessionState.SCENARIO_LOADED],
    [SessionState.SCENARIO_LOADED]: [SessionState.ATTACK_SELECTION],
    [SessionState.ATTACK_SELECTION]: [SessionState.DEFENSE_SELECTION],
    [SessionState.DEFENSE_SELECTION]: [SessionState.RULE_EVALUATION],
    [SessionState.RULE_EVALUATION]: [SessionState.SCORE_UPDATE],
    [SessionState.SCORE_UPDATE]: [SessionState.EVENT_LOGGING],
    [SessionState.EVENT_LOGGING]: [SessionState.NEXT_SCENARIO],
    [SessionState.NEXT_SCENARIO]: [SessionState.SCENARIO_LOADED, SessionState.SESSION_COMPLETE],
    [SessionState.SESSION_COMPLETE]: []
  };

  /**
   * Initializes a new session state machine.
   */
  public initSession(sessionId: string): void {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, SessionState.START);
      this.emit('state_changed', sessionId, SessionState.START);
    }
  }

  /**
   * Returns current state for a session.
   */
  public getState(sessionId: string): SessionState {
    const state = this.sessions.get(sessionId);
    if (!state) {
      throw new Error(`Session ${sessionId} not found`);
    }
    return state;
  }

  /**
   * Checks if a transition is valid.
   */
  public canTransition(fromState: SessionState, toState: SessionState): boolean {
    const allowed = this.validTransitions[fromState];
    return allowed ? allowed.includes(toState) : false;
  }

  /**
   * Validates and transitions the state of a session.
   */
  public transition(sessionId: string, fromState: SessionState, toState: SessionState): void {
    const currentState = this.getState(sessionId);

    if (currentState !== fromState) {
      throw new Error(`Cannot transition from ${fromState} to ${toState}. Current state is ${currentState}.`);
    }

    if (!this.canTransition(fromState, toState)) {
      throw new Error(`Invalid state transition from ${fromState} to ${toState}.`);
    }

    this.sessions.set(sessionId, toState);
    this.emit('state_changed', sessionId, toState);

    if (toState === SessionState.SESSION_COMPLETE) {
      // Clean up when complete
      this.sessions.delete(sessionId);
    }
  }
}

export const stateMachine = new StateMachine();
