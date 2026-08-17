// Explicit, hand-authored attack/defense outcome mappings — the only
// source of "partially_defended" or non-primary "defended" outcomes in the
// seeded Rule data. Nothing in this file is inferred from category tags;
// every entry is a deliberate, individually-justified security judgment.
//
// Coverage model: for a scenario with N attacks and M defenses, there are
// N*M possible pairings. Some are already unambiguous by construction —
// each attack's *designated* counter (matched by array position, e.g.
// attack "a1" paired with defense "d1") is authored as "defended" directly
// in the seed generator (server/prisma/reseedScenarios.ts /
// server/prisma/seed.ts), since that relationship was deliberately designed
// when the scenario's content was written. Every OTHER pairing — attacks
// facing a defense that wasn't built for them — needs an explicit,
// individually-reasoned outcome here, or it defaults to "breached" (a safe,
// conservative default: an unreviewed pairing gets no unearned credit).
//
// This file currently covers two scenarios end-to-end as a fully worked
// reference pattern, directly addressing the two examples from the bug
// report (SQL Injection + Anti-CSRF Tokens; BGP Hijacking + Frequency
// Hopping Spread Spectrum). Extending this file to the remaining scenarios
// is a content-authoring task, not a code change — add more ScenarioRuleSet
// entries following the same pattern; nothing else needs to change.

export type RuleOutcome = 'defended' | 'partially_defended' | 'breached';

export interface ExplicitRule {
  attackId: string;
  defenseId: string;
  outcome: RuleOutcome;
  /** Why this specific defense succeeds, partly mitigates, or fails against this specific attack. */
  explanation: string;
  scoreModifier: number;
}

export interface ScenarioRuleSet {
  /** Must exactly match a Scenario.name from scenarioData.ts. */
  scenarioName: string;
  rules: ExplicitRule[];
}

export const EXPLICIT_RULE_SETS: ScenarioRuleSet[] = [
  {
    scenarioName: 'Online Banking Portal',
    // a1 SQL Injection · a2 CSRF · a3 IDOR
    // d1 Parameterized Queries · d2 Anti-CSRF Tokens · d3 Object-Level Authorization
    rules: [
      {
        attackId: 'a1', defenseId: 'd1', outcome: 'defended', scoreModifier: 20,
        explanation: 'Parameterized queries separate SQL code from user-supplied data, so injected SQL is treated as a literal value rather than executable syntax — this directly neutralizes SQL injection.',
      },
      {
        attackId: 'a1', defenseId: 'd2', outcome: 'breached', scoreModifier: -10,
        explanation: 'Anti-CSRF tokens verify that a request originated from the application\'s own form, not that its parameters are safe to use in a database query. A forged-request check does nothing to stop malicious SQL inside a legitimately-submitted field.',
      },
      {
        attackId: 'a1', defenseId: 'd3', outcome: 'breached', scoreModifier: -10,
        explanation: 'Object-level authorization checks whether a user is allowed to touch a given record; it does not sanitize or parametrize the query itself. An authenticated, authorized user can still submit an injection payload through a legitimate request.',
      },
      {
        attackId: 'a2', defenseId: 'd1', outcome: 'breached', scoreModifier: -10,
        explanation: 'Parameterized queries protect against malicious query content, not against who is allowed to submit the request. A forged cross-site request is still a well-formed, safely-parameterized query — the injection defense has nothing to do with request origin.',
      },
      {
        attackId: 'a2', defenseId: 'd2', outcome: 'defended', scoreModifier: 20,
        explanation: 'Anti-CSRF tokens require a per-session, unpredictable token on every state-changing request; a forged cross-site request cannot supply a valid token, so it is rejected before it executes.',
      },
      {
        attackId: 'a2', defenseId: 'd3', outcome: 'partially_defended', scoreModifier: 5,
        explanation: 'Object-level authorization does not stop the forged request from being processed, but it does verify the forged request is only allowed to act on resources the victim actually owns — this limits (but does not prevent) the blast radius of a successful CSRF, so it earns partial credit rather than full or zero credit.',
      },
      {
        attackId: 'a3', defenseId: 'd1', outcome: 'breached', scoreModifier: -10,
        explanation: 'Parameterized queries prevent malicious SQL from altering a query\'s structure; they do not check whether the record id being requested belongs to the requesting user. A syntactically valid, safely-parameterized query can still leak another user\'s record.',
      },
      {
        attackId: 'a3', defenseId: 'd2', outcome: 'breached', scoreModifier: -10,
        explanation: 'CSRF tokens confirm a request came from the application\'s own UI; they say nothing about which record id the legitimate, token-carrying user is allowed to access. A same-site, correctly-tokened request can still walk another user\'s record ids.',
      },
      {
        attackId: 'a3', defenseId: 'd3', outcome: 'defended', scoreModifier: 20,
        explanation: 'Verifying ownership on every resource access is the direct, purpose-built countermeasure for IDOR — it rejects any request for a record the authenticated user does not own, regardless of how the id was guessed or altered.',
      },
    ],
  },
  {
    scenarioName: 'Internet Exchange Point',
    // a1 BGP Hijacking · a2 Advanced Evasion via Protocol Manipulation · a3 Signal Jamming
    // d1 RPKI Route Validation · d2 Deep Packet Inspection · d3 Frequency Hopping Spread Spectrum
    rules: [
      {
        attackId: 'a1', defenseId: 'd1', outcome: 'defended', scoreModifier: 20,
        explanation: 'RPKI cryptographically ties a route announcement to the network that legitimately owns the address block, so a forged BGP announcement fails validation and is rejected by RPKI-enforcing routers — the standard real-world countermeasure for BGP hijacking.',
      },
      {
        attackId: 'a1', defenseId: 'd2', outcome: 'breached', scoreModifier: -10,
        explanation: 'Deep packet inspection validates that traffic conforms to expected protocol structure; a hijacked BGP route announcement is a syntactically well-formed BGP update. DPI has no basis to distinguish a forged route from a legitimate one — it inspects packet shape, not route ownership.',
      },
      {
        attackId: 'a1', defenseId: 'd3', outcome: 'breached', scoreModifier: -10,
        explanation: 'Frequency hopping is a radio-layer technique for evading RF jamming. BGP hijacking is an internet-routing-protocol attack with no radio component whatsoever — the two operate at entirely different layers and have no relationship.',
      },
      {
        attackId: 'a2', defenseId: 'd1', outcome: 'breached', scoreModifier: -10,
        explanation: 'RPKI validates the authenticity of a route\'s origin; it does not parse or inspect general protocol traffic for edge-case abuse. A protocol-evasion technique that never forges a route announcement passes through RPKI validation untouched.',
      },
      {
        attackId: 'a2', defenseId: 'd2', outcome: 'defended', scoreModifier: 20,
        explanation: 'Deep packet inspection fully parses traffic against the protocol specification, which is exactly what is needed to catch edge-case abuse designed to slip past shallower inspection — this is the direct, purpose-built countermeasure here.',
      },
      {
        attackId: 'a2', defenseId: 'd3', outcome: 'breached', scoreModifier: -10,
        explanation: 'Frequency hopping addresses RF-layer jamming, not application/network-layer protocol manipulation. It provides no packet inspection or protocol validation capability at all.',
      },
      {
        attackId: 'a3', defenseId: 'd1', outcome: 'breached', scoreModifier: -10,
        explanation: 'RPKI is a routing-security mechanism operating on BGP announcements; it has no visibility into or effect on the physical radio spectrum, so it does nothing against RF jamming.',
      },
      {
        attackId: 'a3', defenseId: 'd2', outcome: 'breached', scoreModifier: -10,
        explanation: 'Deep packet inspection operates on packets that have already been successfully received over the network. Jamming prevents the radio signal from being received at all — there is no packet yet for DPI to inspect.',
      },
      {
        attackId: 'a3', defenseId: 'd3', outcome: 'defended', scoreModifier: 20,
        explanation: 'Frequency hopping spread spectrum rapidly switches transmission frequency in a pattern the jammer cannot predict or fully cover, directly evading the jamming attempt — the standard real-world countermeasure for signal jamming.',
      },
    ],
  },
];

export function findExplicitRule(
  scenarioName: string,
  attackId: string,
  defenseId: string
): ExplicitRule | undefined {
  const set = EXPLICIT_RULE_SETS.find((r) => r.scenarioName === scenarioName);
  return set?.rules.find((r) => r.attackId === attackId && r.defenseId === defenseId);
}
