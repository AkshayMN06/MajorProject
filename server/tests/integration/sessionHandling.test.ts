import { describe, it, expect, beforeEach, vi } from 'vitest';
import { stateMachine, SessionState } from '../../src/services/stateMachine';

describe('Session Handling Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Two parallel sessions (different IDs) don\'t interfere with each other', () => {
    stateMachine.initSession('s1');
    stateMachine.initSession('s2');

    stateMachine.transition('s1', SessionState.START, SessionState.WAITING_FOR_PLAYERS);
    
    expect(stateMachine.getState('s1')).toBe(SessionState.WAITING_FOR_PLAYERS);
    expect(stateMachine.getState('s2')).toBe(SessionState.START);
  });

  it('Session completes: state is removed from memory after SESSION_COMPLETE', () => {
    stateMachine.initSession('s3');
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
      stateMachine.transition('s3', sequence[i], sequence[i + 1]);
    }

    expect(() => stateMachine.getState('s3')).toThrow('Session s3 not found');
  });

  it('Cannot transition a deleted/completed session', () => {
    stateMachine.initSession('s4');
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
      stateMachine.transition('s4', sequence[i], sequence[i + 1]);
    }

    // Try transitioning a deleted session
    expect(() => stateMachine.transition('s4', SessionState.SESSION_COMPLETE, SessionState.START)).toThrow('Session s4 not found');
  });

  it('Full multi-scenario simulation and emits state_changed events at each transition', () => {
    const sId = 's5';
    stateMachine.initSession(sId);
    
    const eventSpy = vi.fn();
    stateMachine.on('state_changed', eventSpy);

    const fullLoop = [
      SessionState.START,
      SessionState.WAITING_FOR_PLAYERS,
      SessionState.SCENARIO_LOADED,
      SessionState.ATTACK_SELECTION,
      SessionState.DEFENSE_SELECTION,
      SessionState.RULE_EVALUATION,
      SessionState.SCORE_UPDATE,
      SessionState.EVENT_LOGGING,
      SessionState.NEXT_SCENARIO,
      // Load next
      SessionState.SCENARIO_LOADED,
      SessionState.ATTACK_SELECTION,
      SessionState.DEFENSE_SELECTION,
      SessionState.RULE_EVALUATION,
      SessionState.SCORE_UPDATE,
      SessionState.EVENT_LOGGING,
      SessionState.NEXT_SCENARIO,
      // Complete
      SessionState.SESSION_COMPLETE
    ];

    for (let i = 0; i < fullLoop.length - 1; i++) {
      stateMachine.transition(sId, fullLoop[i], fullLoop[i + 1]);
      expect(eventSpy).toHaveBeenLastCalledWith(sId, fullLoop[i + 1]);
    }

    expect(() => stateMachine.getState(sId)).toThrow();
  });
});
