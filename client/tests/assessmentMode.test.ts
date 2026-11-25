import { describe, it, expect } from 'vitest';
import { reducer, assessmentModeOf, type SessionState } from '../src/hooks/useScenarioSession';

// Collaborative / Individual labelling: every way a client learns about a
// session must set the user-facing mode, from fresh state or from history.
const landing = reducer(undefined as unknown as SessionState, { type: 'RESET' });
const base = { sessionId: 's1', sessionCode: 'CYB-1', difficulty: 'Easy', module: null, totalRounds: 2 };

describe('assessmentModeOf', () => {
  it('maps persisted values to user-facing modes', () => {
    expect(assessmentModeOf('PAIRED')).toBe('collaborative');
    expect(assessmentModeOf('SOLO')).toBe('individual');
    expect(assessmentModeOf(undefined)).toBeNull();
    expect(assessmentModeOf('SOMETHING_ELSE')).toBeNull();
  });
});

describe('mode in session state', () => {
  it('starts unknown', () => expect(landing.mode).toBeNull());

  it('create and join are Collaborative', () => {
    expect(reducer(landing, { type: 'SESSION_CREATED', ...base, role: 'attacker' }).mode).toBe('collaborative');
    expect(reducer(landing, { type: 'SESSION_JOINED', ...base, attackerName: 'A', defenderName: 'D', role: 'defender' }).mode).toBe('collaborative');
  });

  it('starting against the system is Individual', () => {
    const s = reducer(landing, {
      type: 'SOLO_SESSION_CREATED', ...base, role: 'defender', scenario: {} as any, roundNumber: 1, status: 'DEFENSE_SELECTION', incomingAttack: null,
    });
    expect(s.mode).toBe('individual');
  });

  it('a historical report sets the mode from the report itself', () => {
    const post = reducer(landing, { type: 'POST_TEST_REHYDRATED', sessionId: 's1', role: 'attacker', report: { mode: 'SOLO' } as any });
    expect(post.mode).toBe('individual');
    const done = reducer({ ...landing, mode: null }, { type: 'ASSESSMENT_COMPLETE', report: { mode: 'PAIRED' } as any });
    expect(done.mode).toBe('collaborative');
  });

  it('a report without a mode keeps the mode already known', () => {
    const s = reducer({ ...landing, mode: 'individual' }, { type: 'ASSESSMENT_COMPLETE', report: {} as any });
    expect(s.mode).toBe('individual');
  });

  it('reset clears it', () => {
    const s = reducer({ ...landing, mode: 'individual' }, { type: 'RESET' });
    expect(s.mode).toBeNull();
  });
});
