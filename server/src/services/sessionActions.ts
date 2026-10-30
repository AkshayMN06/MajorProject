import { PrismaClient } from '@prisma/client';
import { ruleEngine } from './ruleEngine';
import { RecommendationEngine } from './recommendationEngine';
import { AnalyticsEngine } from './analyticsEngine';
import { transition, transitionThrough, SessionState } from './stateMachine';

const prisma = new PrismaClient();

// In-memory per-session round state (current scenario + in-flight attack
// choice). Shared by the socket handlers and the REST action endpoints so
// neither path duplicates the other's bookkeeping.
export interface RoomState {
  attackChoice: string | null;
  attackOptionName: string | null;
  attackOptionDescription: string | null;
  attackStartTime: number;
  defenseStartTime: number;
  currentScenario: any | null;
}

const roomStates = new Map<string, RoomState>();

export function getRoomState(sessionId: string) {
  return roomStates.get(sessionId);
}

// Attack/defense options are seeded in a fixed order where option N's
// "intended" countermeasure is also option N — shown in raw order, position
// alone reveals the answer. Shuffling each side independently on every load
// removes that shortcut without touching which option IDs are actually valid.
function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function ensureRoomState(sessionId: string): RoomState {
  let room = roomStates.get(sessionId);
  if (!room) {
    room = {
      attackChoice: null,
      attackOptionName: null,
      attackOptionDescription: null,
      attackStartTime: Date.now(),
      defenseStartTime: Date.now(),
      currentScenario: null,
    };
    roomStates.set(sessionId, room);
  }
  return room;
}

// Solo mode picks the system-controlled side uniformly at random from the
// scenario's own option pool — approximating an unpredictable opponent
// rather than always feeding the human the easiest or the "correct" match.
function pickSystemOption(options: any[]): any {
  return options[Math.floor(Math.random() * options.length)];
}

export async function markReady(sessionId: string, userId: string) {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error('Session not found');

  const isAttacker = session.attackerId === userId;
  const isDefender = session.defenderId === userId;
  if (!isAttacker && !isDefender) throw new Error('You are not a participant in this session');

  // In SOLO mode attackerId === defenderId (the same human occupies both
  // slots), so the one ready action satisfies both flags at once.
  const updateData =
    session.mode === 'SOLO' ? { attackerReady: true, defenderReady: true } : isAttacker ? { attackerReady: true } : { defenderReady: true };
  const updated = await prisma.session.update({ where: { id: sessionId }, data: updateData });

  let startedRound: Awaited<ReturnType<typeof loadNextScenario>> | null = null;
  if (updated.attackerReady && updated.defenderReady) {
    startedRound = await loadNextScenario(sessionId, updated);
  }

  return {
    attackerReady: updated.attackerReady,
    defenderReady: updated.defenderReady,
    startedRound,
  };
}

export async function loadNextScenario(
  sessionId: string,
  session: {
    scenarioIds: unknown;
    currentScenarioIndex: number;
    totalScenarios: number;
    status: string;
    attackerId?: string;
    mode?: string;
    soloRole?: string | null;
  }
) {
  const scenarioIds: string[] = (session.scenarioIds as string[]) ?? [];
  const idx = session.currentScenarioIndex;

  let scenario;
  if (scenarioIds[idx]) {
    scenario = await prisma.scenario.findUnique({ where: { id: scenarioIds[idx] } });
  } else {
    const scenarios = await prisma.scenario.findMany({ take: session.totalScenarios, orderBy: { id: 'asc' } });
    scenario = scenarios[idx];
  }
  if (!scenario) throw new Error('No scenario available for this round');

  const shuffledScenario = {
    ...scenario,
    attackOptions: shuffle((scenario.attackOptions as any[]) ?? []),
    defenseOptions: shuffle((scenario.defenseOptions as any[]) ?? []),
  };

  const room = ensureRoomState(sessionId);
  room.currentScenario = shuffledScenario;
  room.attackChoice = null;
  room.attackOptionName = null;
  room.attackOptionDescription = null;
  room.attackStartTime = Date.now();

  // SESSION_READY/NEXT_ROUND -> SCENARIO_LOADED -> ATTACK_SELECTION: the
  // scenario is loaded and the attacker's turn opens in the same request,
  // so only the final state is persisted, but both hops are validated.
  let nextStatus = transitionThrough(session.status, [SessionState.SCENARIO_LOADED, SessionState.ATTACK_SELECTION]);
  await prisma.session.update({ where: { id: sessionId }, data: { status: nextStatus } });

  let systemAttack: {
    attackOptionId: string;
    attackOptionName: string;
    attackOptionDescription: string;
    attackCategory: string;
    attackDifficulty: string;
  } | null = null;

  // Solo-as-defender: there is no live attacker, so the system picks the
  // attack immediately so the human can go straight to defense selection.
  if (session.mode === 'SOLO' && session.soloRole === 'DEFENDER' && session.attackerId) {
    const attackOption = pickSystemOption(shuffledScenario.attackOptions);
    const attackResult = await performAttack(sessionId, { ...session, status: nextStatus }, attackOption.id);
    nextStatus = attackResult.status as SessionState;
    systemAttack = {
      attackOptionId: attackResult.attackOptionId,
      attackOptionName: attackResult.attackOptionName,
      attackOptionDescription: attackResult.attackOptionDescription,
      attackCategory: attackResult.attackCategory,
      attackDifficulty: attackResult.attackDifficulty,
    };
  }

  return {
    sessionId,
    scenario: shuffledScenario,
    roundNumber: idx + 1,
    totalRounds: session.totalScenarios,
    status: nextStatus,
    systemAttack,
  };
}

// Core attack-submission logic, shared by the real (human) submitAttack
// entry point and the solo-mode system auto-attack in loadNextScenario.
// Ownership is checked by the public wrapper, not here.
async function performAttack(
  sessionId: string,
  session: { status: string },
  attackOptionId: string
) {
  if (session.status !== SessionState.ATTACK_SELECTION) throw new Error('Not in attack selection phase');

  const room = roomStates.get(sessionId);
  if (!room || !room.currentScenario) throw new Error('Room state not found');

  const attackOptions: any[] = room.currentScenario?.attackOptions ?? [];
  const attackOption = attackOptions.find((o: any) => o.id === attackOptionId);
  if (!attackOption) throw new Error('Invalid attack option');

  room.attackChoice = attackOptionId;
  room.attackOptionName = attackOption.name;
  room.attackOptionDescription = attackOption.description;
  room.defenseStartTime = Date.now();

  const nextStatus = transition(session.status, SessionState.DEFENSE_SELECTION);
  await prisma.session.update({ where: { id: sessionId }, data: { status: nextStatus } });

  return {
    sessionId,
    attackOptionId,
    attackOptionName: attackOption.name,
    attackOptionDescription: attackOption.description,
    attackCategory: attackOption.category,
    attackDifficulty: attackOption.difficulty,
    status: nextStatus,
  };
}

export async function submitAttack(
  sessionId: string,
  userId: string,
  attackOptionId: string
) {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error('Session not found');
  if (session.attackerId !== userId) throw new Error('Only the attacker can submit an attack');

  const attackResult = await performAttack(sessionId, session, attackOptionId);

  // Solo-as-attacker: there is no live defender, so the system immediately
  // picks a defense and the round resolves in the same request.
  if (session.mode === 'SOLO' && session.soloRole === 'ATTACKER' && session.defenderId) {
    const room = roomStates.get(sessionId)!;
    const defenseOption = pickSystemOption(room.currentScenario.defenseOptions);
    const roundResult = await performDefense(
      sessionId,
      { ...session, status: attackResult.status },
      defenseOption.id
    );
    return { ...attackResult, roundResult };
  }

  return attackResult;
}

// Core defense-submission + scoring logic, shared by the real (human)
// submitDefense entry point and the solo-mode system auto-defense chained
// from submitAttack. Ownership is checked by the public wrapper, not here.
async function performDefense(
  sessionId: string,
  session: {
    status: string;
    attackerId: string;
    defenderId: string | null;
    attackerScore: number;
    defenderScore: number;
    currentScenarioIndex: number;
    totalScenarios: number;
    mode?: string;
    soloRole?: string | null;
  },
  defenseOptionId: string
) {
  if (session.status !== SessionState.DEFENSE_SELECTION) throw new Error('Not in defense selection phase');

  const room = roomStates.get(sessionId);
  if (!room || !room.attackChoice || !room.currentScenario) throw new Error('No attack to defend against');

  const defenseOptions: any[] = room.currentScenario?.defenseOptions ?? [];
  const defenseOption = defenseOptions.find((o: any) => o.id === defenseOptionId);
  if (!defenseOption) throw new Error('Invalid defense option');

  const defenderTimeTaken = Math.floor((Date.now() - room.defenseStartTime) / 1000);
  const attackerTimeTaken = Math.floor((room.defenseStartTime - room.attackStartTime) / 1000);

  const processingStatus = transition(session.status, SessionState.RULE_PROCESSING);
  await prisma.session.update({ where: { id: sessionId }, data: { status: processingStatus } });

  const isSolo = session.mode === 'SOLO';
  const evaluationResult = await ruleEngine.evaluate({
    sessionId,
    scenarioId: room.currentScenario.id,
    attackerId: session.attackerId,
    defenderId: session.defenderId!,
    attackerChoice: room.attackChoice,
    defenderChoice: defenseOptionId,
    attackerTimeTaken,
    defenderTimeTaken,
    attackerIsSystem: isSolo && session.soloRole === 'DEFENDER',
    defenderIsSystem: isSolo && session.soloRole === 'ATTACKER',
  });

  const newAttackerTotal = session.attackerScore + evaluationResult.attackerScoreBreakdown.total;
  const newDefenderTotal = session.defenderScore + evaluationResult.defenderScoreBreakdown.total;

  const resultStatus = transition(processingStatus, SessionState.RESULT_GENERATED);
  await prisma.session.update({
    where: { id: sessionId },
    data: { attackerScore: newAttackerTotal, defenderScore: newDefenderTotal, status: resultStatus },
  });

  const attackOptions: any[] = room.currentScenario?.attackOptions ?? [];
  const attackOption = attackOptions.find((o: any) => o.id === room.attackChoice);

  const result = {
    sessionId,
    roundNumber: session.currentScenarioIndex + 1,
    totalRounds: session.totalScenarios,
    scenarioName: room.currentScenario.name,
    attackOptionId: room.attackChoice,
    attackOptionName: attackOption?.name ?? room.attackChoice,
    attackOptionDescription: attackOption?.description ?? '',
    defenseOptionId,
    defenseOptionName: defenseOption.name,
    defenseOptionDescription: defenseOption.description,
    outcome: evaluationResult.outcome,
    explanation: evaluationResult.explanation,
    attackerRoundScore: evaluationResult.attackerScoreBreakdown.total,
    defenderRoundScore: evaluationResult.defenderScoreBreakdown.total,
    attackerTotalScore: newAttackerTotal,
    defenderTotalScore: newDefenderTotal,
    attackerScoreBreakdown: evaluationResult.attackerScoreBreakdown,
    defenderScoreBreakdown: evaluationResult.defenderScoreBreakdown,
    status: resultStatus,
  };

  room.attackChoice = null;
  room.attackOptionName = null;
  room.attackOptionDescription = null;

  return result;
}

export async function submitDefense(
  sessionId: string,
  userId: string,
  defenseOptionId: string
) {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error('Session not found');
  if (session.defenderId !== userId) throw new Error('Only the defender can submit a defense');

  return performDefense(sessionId, session, defenseOptionId);
}

export async function advanceRound(sessionId: string, userId: string) {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error('Session not found');
  if (session.attackerId !== userId && session.defenderId !== userId) {
    throw new Error('You are not a participant in this session');
  }

  const nextRoundStatus = transition(session.status, SessionState.NEXT_ROUND);
  const nextIndex = session.currentScenarioIndex + 1;

  if (nextIndex >= session.totalScenarios) {
    const completeStatus = transition(nextRoundStatus, SessionState.ASSESSMENT_COMPLETE);
    await prisma.session.update({
      where: { id: sessionId },
      data: { status: completeStatus, completedAt: new Date() },
    });
    roomStates.delete(sessionId);

    // Recommendation + analytics-snapshot steps — once per completed
    // assessment, not per round.
    await RecommendationEngine.generateRecommendations(session.attackerId);
    // In SOLO mode defenderId === attackerId — skip the duplicate call.
    if (session.defenderId && session.defenderId !== session.attackerId) {
      await RecommendationEngine.generateRecommendations(session.defenderId);
    }
    await AnalyticsEngine.recordAssessmentCompletion(sessionId);

    return { complete: true as const, sessionId };
  }

  await prisma.session.update({
    where: { id: sessionId },
    data: { currentScenarioIndex: nextIndex, status: nextRoundStatus },
  });
  const updatedSession = await prisma.session.findUnique({ where: { id: sessionId } });
  const startedRound = await loadNextScenario(sessionId, updatedSession!);
  return { complete: false as const, startedRound };
}
