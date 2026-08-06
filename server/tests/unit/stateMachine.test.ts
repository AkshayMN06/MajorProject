import { describe, it, expect, beforeEach, vi } from 'vitest';
import { stateMachine, SessionState } from '../../src/services/stateMachine';

describe('StateMachine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initialises a session to START state', () => {
    const sessionId = 'session-1';
    stateMachine.initSession(sessionId);
    expect(stateMachine.getState(sessionId)).toBe(SessionState.START);
  });

  it('getState returns START after init', () => {
    const sessionId = 'session-2';
    stateMachine.initSession(sessionId);
    expect(stateMachine.getState(sessionId)).toBe(SessionState.START);
  });

  it('getState on unknown session throws error', () => {
    expect(() => stateMachine.getState('unknown')).toThrow('Session unknown not found');
  });

  it('canTransition(START, WAITING_FOR_PLAYERS) -> true', () => {
    expect(stateMachine.canTransition(SessionState.START, SessionState.WAITING_FOR_PLAYERS)).toBe(true);
  });

  it('canTransition(START, SESSION_COMPLETE) -> false (invalid skip)', () => {
    expect(stateMachine.canTransition(SessionState.START, SessionState.SESSION_COMPLETE)).toBe(false);
  });

  it('canTransition(SCENARIO_LOADED, ATTACK_SELECTION) -> true', () => {
    expect(stateMachine.canTransition(SessionState.SCENARIO_LOADED, SessionState.ATTACK_SELECTION)).toBe(true);
  });

  it('transition(START -> WAITING_FOR_PLAYERS) -> valid, state changes', () => {
    const sessionId = 'session-3';
    stateMachine.initSession(sessionId);
    stateMachine.transition(sessionId, SessionState.START, SessionState.WAITING_FOR_PLAYERS);
    expect(stateMachine.getState(sessionId)).toBe(SessionState.WAITING_FOR_PLAYERS);
  });

  it('transition(START -> SESSION_COMPLETE) -> throws invalid transition', () => {
    const sessionId = 'session-4';
    stateMachine.initSession(sessionId);
    expect(() => stateMachine.transition(sessionId, SessionState.START, SessionState.SESSION_COMPLETE)).toThrow(/Invalid state transition/);
  });

  it('transition with wrong fromState (mismatch) -> throws error', () => {
    const sessionId = 'session-5';
    stateMachine.initSession(sessionId);
    expect(() => stateMachine.transition(sessionId, SessionState.WAITING_FOR_PLAYERS, SessionState.SCENARIO_LOADED)).toThrow(/Cannot transition from/);
  });

  it('Full happy path: walk through all 10 states in sequence', () => {
    const sessionId = 'session-happy';
    stateMachine.initSession(sessionId);

    const sequence = [
      SessionState.START,
      SessionState.WAITING_FOR_PLAYERS,
      SessionState.SCENARIO_LOADED,
      SessionState.ATTACK_SELECTION,
      SessionState.DEFENSE_SELECTION,
      SessionState.RULE_EVALUATION,
      SessionState.SCORE_UPDATE,
      SessionState.EVENT_LOGGING,
      SessionState.NEXT_SCENARIO,
      SessionState.SESSION_COMPLETE
    ];

    for (let i = 0; i < sequence.length - 1; i++) {
      stateMachine.transition(sessionId, sequence[i], sequence[i + 1]);
    }
  });

  it('After SESSION_COMPLETE, getState should throw (session deleted)', () => {
    const sessionId = 'session-complete';
    stateMachine.initSession(sessionId);
    
    const sequence = [
      SessionState.START,
      SessionState.WAITING_FOR_PLAYERS,
      SessionState.SCENARIO_LOADED,
      SessionState.ATTACK_SELECTION,
      SessionState.DEFENSE_SELECTION,
      SessionState.RULE_EVALUATION,
      SessionState.SCORE_UPDATE,
      SessionState.EVENT_LOGGING,
      SessionState.NEXT_SCENARIO,
      SessionState.SESSION_COMPLETE
    ];

    for (let i = 0; i < sequence.length - 1; i++) {
      stateMachine.transition(sessionId, sequence[i], sequence[i + 1]);
    }

    expect(() => stateMachine.getState(sessionId)).toThrow(/not found/);
  });

  it('state_changed event is emitted on transitions', () => {
    const sessionId = 'session-event';
    stateMachine.initSession(sessionId);
    
    const spy = vi.fn();
    stateMachine.on('state_changed', spy);
    
    stateMachine.transition(sessionId, SessionState.START, SessionState.WAITING_FOR_PLAYERS);
    
    expect(spy).toHaveBeenCalledWith(sessionId, SessionState.WAITING_FOR_PLAYERS);
  });

  it('NEXT_SCENARIO -> SCENARIO_LOADED (loop for next scenario) is valid', () => {
    const sessionId = 'session-loop';
    stateMachine.initSession(sessionId);
    
    const sequenceToNext = [
      SessionState.START,
      SessionState.WAITING_FOR_PLAYERS,
      SessionState.SCENARIO_LOADED,
      SessionState.ATTACK_SELECTION,
      SessionState.DEFENSE_SELECTION,
      SessionState.RULE_EVALUATION,
      SessionState.SCORE_UPDATE,
      SessionState.EVENT_LOGGING,
      SessionState.NEXT_SCENARIO
    ];

    for (let i = 0; i < sequenceToNext.length - 1; i++) {
      stateMachine.transition(sessionId, sequenceToNext[i], sequenceToNext[i + 1]);
    }

    stateMachine.transition(sessionId, SessionState.NEXT_SCENARIO, SessionState.SCENARIO_LOADED);
    expect(stateMachine.getState(sessionId)).toBe(SessionState.SCENARIO_LOADED);
  });
});
