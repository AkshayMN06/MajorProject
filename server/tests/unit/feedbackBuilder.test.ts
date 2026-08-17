import { describe, it, expect } from 'vitest';
import { buildFeedback } from '../../src/services/feedbackBuilder';

describe('feedbackBuilder.buildFeedback', () => {
  it('defended — no recommended control (already the right defense)', () => {
    const text = buildFeedback({
      outcome: 'defended',
      baseExplanation: 'Parameterized queries separate SQL code from user-supplied data, so injected SQL is treated as a literal value rather than executable syntax — this directly neutralizes SQL injection.',
      attackName: 'SQL Injection',
      defenseName: 'Parameterized Queries',
      concept: 'Web Security',
      recommendedControl: null,
    });

    expect(text).toContain('Outcome: Defended.');
    expect(text).toContain('SQL Injection');
    expect(text).toContain('Parameterized Queries');
    expect(text).toContain('Concept: Web Security.');
    expect(text).not.toContain('Recommended control');
  });

  it('partially_defended — includes a recommended control', () => {
    const text = buildFeedback({
      outcome: 'partially_defended',
      baseExplanation: "Object-level authorization does not stop the forged request from being processed, but it does verify the forged request is only allowed to act on resources the victim actually owns.",
      attackName: 'Cross-Site Request Forgery (CSRF)',
      defenseName: 'Object-Level Authorization',
      concept: 'Web Security',
      recommendedControl: { name: 'Anti-CSRF Tokens', description: 'Validate a unique token on state-changing requests.' },
    });

    expect(text).toContain('Outcome: Partially Defended.');
    expect(text).toContain('Recommended control: Anti-CSRF Tokens');
  });

  it('breached — names attack and defense, gives the exact bug-report reasoning, and recommends the real control', () => {
    const text = buildFeedback({
      outcome: 'breached',
      baseExplanation: "Anti-CSRF tokens verify that a request originated from the application's own form, not that its parameters are safe to use in a database query. A forged-request check does nothing to stop malicious SQL inside a legitimately-submitted field.",
      attackName: 'SQL Injection',
      defenseName: 'Anti-CSRF Tokens',
      concept: 'Web Security',
      recommendedControl: { name: 'Parameterized Queries', description: 'Use prepared statements for all queries.' },
    });

    expect(text).toContain('Outcome: Breached.');
    expect(text).toContain('SQL Injection');
    expect(text).toContain('Anti-CSRF Tokens');
    expect(text).toContain('Concept: Web Security.');
    expect(text).toContain('Recommended control: Parameterized Queries — Use prepared statements for all queries.');
  });

  it('is deterministic — same input always produces the same string', () => {
    const input = {
      outcome: 'breached',
      baseExplanation: 'reason',
      attackName: 'A',
      defenseName: 'D',
      concept: 'C',
      recommendedControl: { name: 'R', description: 'desc' },
    };
    expect(buildFeedback(input)).toBe(buildFeedback(input));
  });
});
