import { describe, it, expect } from 'vitest';
import { transition, transitionThrough, SessionState } from '../../src/services/stateMachine';

/**
 * The state machine is stateless by design (see src/services/stateMachine.ts)
 * — Session.status in the database is the single source of truth, not an
 * in-memory map. These tests exercise the same transition sequences
 * src/services/sessionActions.ts drives a real session through, to prove the
 * guard behaves correctly across a full multi-round session lifecycle.
 */
describe('Session lifecycle integration (stateMachine transitions)', () => {
  it('a full single round: SESSION_READY through RESULT_GENERATED', () => {
    let status: SessionState = transitionThrough(SessionState.SESSION_READY, [
      SessionState.SCENARIO_LOADED,
      SessionState.ATTACK_SELECTION,
    ]);
    expect(status).toBe(SessionState.ATTACK_SELECTION);

    status = transition(status, SessionState.DEFENSE_SELECTION);
    status = transition(status, SessionState.RULE_PROCESSING);
    status = transition(status, SessionState.RESULT_GENERATED);
    expect(status).toBe(SessionState.RESULT_GENERATED);
  });

  it('looping into a second round: NEXT_ROUND -> SCENARIO_LOADED -> ATTACK_SELECTION', () => {
    const afterRoundOne = transition(SessionState.RESULT_GENERATED, SessionState.NEXT_ROUND);
    const roundTwoStatus = transitionThrough(afterRoundOne, [SessionState.SCENARIO_LOADED, SessionState.ATTACK_SELECTION]);
    expect(roundTwoStatus).toBe(SessionState.ATTACK_SELECTION);
  });

  it('ending after the final round: NEXT_ROUND -> ASSESSMENT_COMPLETE', () => {
    const afterLastRound = transition(SessionState.RESULT_GENERATED, SessionState.NEXT_ROUND);
    const completed = transition(afterLastRound, SessionState.ASSESSMENT_COMPLETE);
    expect(completed).toBe(SessionState.ASSESSMENT_COMPLETE);
  });

  it('a completed session cannot be advanced further (terminal state)', () => {
    expect(() => transition(SessionState.ASSESSMENT_COMPLETE, SessionState.SCENARIO_LOADED)).toThrow(
      'Invalid session state transition: ASSESSMENT_COMPLETE -> SCENARIO_LOADED'
    );
  });

  it('skipping a step (e.g. straight to RULE_PROCESSING without a defense) is rejected', () => {
    expect(() => transition(SessionState.ATTACK_SELECTION, SessionState.RULE_PROCESSING)).toThrow(
      'Invalid session state transition: ATTACK_SELECTION -> RULE_PROCESSING'
    );
  });

  it('two sessions advancing interleaved never interfere — the guard is stateless', () => {
    // sessionActions.ts persists status per-session in the database; the
    // guard itself holds no memory, so interleaving two independent chains
    // must not let one affect the other's next valid move.
    let sessionA = SessionState.SESSION_READY;
    let sessionB = SessionState.START;

    sessionA = transition(sessionA, SessionState.SCENARIO_LOADED);
    sessionB = transition(sessionB, SessionState.WAITING_FOR_PARTICIPANT);
    sessionA = transition(sessionA, SessionState.ATTACK_SELECTION);
    sessionB = transition(sessionB, SessionState.SESSION_READY);

    expect(sessionA).toBe(SessionState.ATTACK_SELECTION);
    expect(sessionB).toBe(SessionState.SESSION_READY);
  });
});
