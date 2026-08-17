import { describe, it, expect } from 'vitest';
import { canTransition, transition, transitionThrough, SessionState } from '../../src/services/stateMachine';

describe('stateMachine', () => {
  describe('canTransition', () => {
    it('START -> WAITING_FOR_PARTICIPANT is valid', () => {
      expect(canTransition(SessionState.START, SessionState.WAITING_FOR_PARTICIPANT)).toBe(true);
    });

    it('START -> ASSESSMENT_COMPLETE is invalid (cannot skip the pipeline)', () => {
      expect(canTransition(SessionState.START, SessionState.ASSESSMENT_COMPLETE)).toBe(false);
    });

    it('SCENARIO_LOADED -> ATTACK_SELECTION is valid', () => {
      expect(canTransition(SessionState.SCENARIO_LOADED, SessionState.ATTACK_SELECTION)).toBe(true);
    });

    it('NEXT_ROUND -> SCENARIO_LOADED is valid (loop into another round)', () => {
      expect(canTransition(SessionState.NEXT_ROUND, SessionState.SCENARIO_LOADED)).toBe(true);
    });

    it('NEXT_ROUND -> ASSESSMENT_COMPLETE is valid (end after the last round)', () => {
      expect(canTransition(SessionState.NEXT_ROUND, SessionState.ASSESSMENT_COMPLETE)).toBe(true);
    });

    it('ASSESSMENT_COMPLETE has no valid outgoing transitions (terminal state)', () => {
      expect(canTransition(SessionState.ASSESSMENT_COMPLETE, SessionState.START)).toBe(false);
      expect(canTransition(SessionState.ASSESSMENT_COMPLETE, SessionState.SCENARIO_LOADED)).toBe(false);
    });
  });

  describe('transition', () => {
    it('a valid hop returns the destination state', () => {
      expect(transition(SessionState.RULE_PROCESSING, SessionState.RESULT_GENERATED)).toBe(SessionState.RESULT_GENERATED);
    });

    it('an invalid hop throws', () => {
      expect(() => transition(SessionState.START, SessionState.RESULT_GENERATED)).toThrow(
        'Invalid session state transition: START -> RESULT_GENERATED'
      );
    });

    it('an unknown "from" state throws', () => {
      expect(() => transition('NOT_A_REAL_STATE', SessionState.START)).toThrow('Unknown session state: NOT_A_REAL_STATE');
    });
  });

  describe('transitionThrough', () => {
    it('validates and follows a multi-hop chain, returning the final state', () => {
      const result = transitionThrough(SessionState.SESSION_READY, [SessionState.SCENARIO_LOADED, SessionState.ATTACK_SELECTION]);
      expect(result).toBe(SessionState.ATTACK_SELECTION);
    });

    it('throws on the first invalid hop in the chain, without silently skipping it', () => {
      expect(() =>
        transitionThrough(SessionState.SESSION_READY, [SessionState.ATTACK_SELECTION, SessionState.SCENARIO_LOADED])
      ).toThrow('Invalid session state transition: SESSION_READY -> ATTACK_SELECTION');
    });

    it('walks the full 10-state round pipeline in sequence', () => {
      const result = transitionThrough(SessionState.START, [
        SessionState.WAITING_FOR_PARTICIPANT,
        SessionState.SESSION_READY,
        SessionState.SCENARIO_LOADED,
        SessionState.ATTACK_SELECTION,
        SessionState.DEFENSE_SELECTION,
        SessionState.RULE_PROCESSING,
        SessionState.RESULT_GENERATED,
        SessionState.NEXT_ROUND,
        SessionState.ASSESSMENT_COMPLETE,
      ]);
      expect(result).toBe(SessionState.ASSESSMENT_COMPLETE);
    });
  });
});
