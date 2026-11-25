import { describe, it, expect } from 'vitest';
import { reducer, type SessionState } from '../src/hooks/useScenarioSession';

// Resume-flow transitions of the scenario session reducer (FIX-009). The
// socket/timer wiring lives in the hook's effects; these cover the state
// rules those effects rely on.
const landing = reducer(undefined as unknown as SessionState, { type: 'RESET' });

function resuming(): SessionState {
  return reducer(landing, {
    type: 'SESSION_REHYDRATED',
    phase: 'resuming',
    sessionId: 's1',
    sessionCode: 'CYB-1234',
    difficulty: 'Easy',
    module: null,
    totalRounds: 5,
    currentRound: 2,
    attackerScore: 10,
    defenderScore: 4,
    attackerName: 'A',
    defenderName: 'D',
    role: 'defender',
    mode: 'collaborative',
  });
}

const scenario = { id: 'sc', name: 'S', description: '', category: 'Web Security', difficulty: 'Easy', targetSystem: '', context: '', attackOptions: [], defenseOptions: [] };

describe('resume flow', () => {
  it('rehydrates a mid-round session into resuming with restored round and scores', () => {
    const s = resuming();
    expect(s).toMatchObject({ phase: 'resuming', sessionId: 's1', role: 'defender', currentRound: 2, attackerScore: 10, defenderScore: 4, resumeError: null });
  });

  it('a failure while resuming keeps the session and exposes the error', () => {
    const failed = reducer(resuming(), { type: 'RESUME_FAILED', error: 'The session did not respond in time.' });
    expect(failed.phase).toBe('resuming');
    expect(failed.sessionId).toBe('s1');
    expect(failed.resumeError).toBe('The session did not respond in time.');
  });

  it('retry clears the error so the spinner (and watchdog) return', () => {
    const failed = reducer(resuming(), { type: 'RESUME_FAILED', error: 'x' });
    const retrying = reducer(failed, { type: 'RESUME_RETRY' });
    expect(retrying).toMatchObject({ phase: 'resuming', resumeError: null, sessionId: 's1' });
  });

  it('a successful replay leaves resuming and clears any error', () => {
    const failed = reducer(resuming(), { type: 'RESUME_FAILED', error: 'late' });
    const loaded = reducer(failed, { type: 'SCENARIO_LOADED', scenario: scenario as any, roundNumber: 2, totalRounds: 5 });
    expect(loaded).toMatchObject({ phase: 'defense_selection', resumeError: null, currentRound: 2 });
  });

  it('a late failure after a successful replay does not interrupt the live round', () => {
    const loaded = reducer(resuming(), { type: 'SCENARIO_LOADED', scenario: scenario as any, roundNumber: 2, totalRounds: 5 });
    const after = reducer(loaded, { type: 'RESUME_FAILED', error: 'timeout' });
    expect(after).toBe(loaded);
    expect(reducer(loaded, { type: 'RESUME_RETRY' })).toBe(loaded);
  });

  it('a completed session replays straight to the report', () => {
    const done = reducer(resuming(), { type: 'ASSESSMENT_COMPLETE', report: { sessionId: 's1' } as any });
    expect(done).toMatchObject({ phase: 'assessment_complete', resumeError: null });
  });

  it('leaving returns to a clean landing state (client-only; nothing is sent to the server)', () => {
    const failed = reducer(resuming(), { type: 'RESUME_FAILED', error: 'x' });
    const left = reducer(failed, { type: 'RESET' });
    expect(left).toEqual(landing);
    expect(left.phase).toBe('landing');
  });
});
