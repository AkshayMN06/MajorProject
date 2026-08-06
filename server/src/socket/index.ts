import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { ruleEngine } from '../services/ruleEngine';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// In-memory state per session room
interface RoomState {
  attackChoice: string | null;         // option id e.g. 'a1'
  attackOptionName: string | null;
  attackOptionDescription: string | null;
  attackParams: Record<string, string>;
  attackStartTime: number;
  defenseStartTime: number;
  currentScenario: any | null;         // full scenario object from DB
}

const roomStates = new Map<string, RoomState>();

// Exported io instance so routes can emit events
let _io: Server;
export const getIO = () => _io;

export const setupSocket = (httpServer: HttpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN,
      methods: ['GET', 'POST'],
    }
  });
  _io = io;

  // Auth middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token ||
        socket.handshake.headers['authorization']?.split(' ')[1];
      if (!token) return next(new Error('Authentication error: Missing token'));
      const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string };
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });
      if (!user) return next(new Error('Authentication error: User not found'));
      (socket as any).user = user;
      next();
    } catch {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user;
    console.log(`User connected: ${user.id} (${socket.id})`);

    // ── join_session ──────────────────────────────────────────────────────────
    socket.on('join_session', async (data: { sessionId: string }) => {
      try {
        const { sessionId } = data;
        const session = await prisma.session.findUnique({
          where: { id: sessionId },
          include: { attacker: true, defender: true }
        });
        if (!session) return socket.emit('session_error', { message: 'Session not found' });

        const isAttacker = session.attackerId === user.id;
        const isDefender = session.defenderId === user.id;
        if (!isAttacker && !isDefender) {
          return socket.emit('session_error', { message: 'You are not a participant in this session' });
        }

        socket.join(sessionId);
        const role = isAttacker ? 'attacker' : 'defender';

        // Notify partner
        socket.to(sessionId).emit('partner_connected', {
          role,
          userName: user.name,
        });

        // Send current session state to the joining user
        socket.emit('session_state', {
          sessionId,
          sessionCode: session.sessionCode,
          status: session.status,
          role,
          difficulty: session.difficulty,
          module: session.module,
          totalRounds: session.totalScenarios,
          currentRound: session.currentScenarioIndex + 1,
          attackerScore: session.attackerScore,
          defenderScore: session.defenderScore,
          attackerName: session.attacker.name,
          defenderName: session.defender?.name ?? null,
          attackerReady: session.attackerReady,
          defenderReady: session.defenderReady,
        });

        // If session is already in progress, send the current scenario
        if (
          session.status === 'ATTACK_SELECTION' ||
          session.status === 'DEFENSE_SELECTION'
        ) {
          const room = roomStates.get(sessionId);
          if (room?.currentScenario) {
            socket.emit('scenario_loaded', {
              sessionId,
              scenario: room.currentScenario,
              roundNumber: session.currentScenarioIndex + 1,
              totalRounds: session.totalScenarios,
              status: session.status,
            });
            // If defense is awaited and this is the defender reconnecting, re-emit attack_submitted
            if (session.status === 'DEFENSE_SELECTION' && isDefender && room.attackChoice) {
              socket.emit('attack_submitted', {
                sessionId,
                attackOptionId: room.attackChoice,
                attackOptionName: room.attackOptionName,
                attackOptionDescription: room.attackOptionDescription,
              });
            }
          }
        }
      } catch (err: any) {
        socket.emit('session_error', { message: err.message });
      }
    });

    // ── participant_ready ──────────────────────────────────────────────────────
    socket.on('participant_ready', async (data: { sessionId: string }) => {
      try {
        const { sessionId } = data;
        const session = await prisma.session.findUnique({ where: { id: sessionId } });
        if (!session) return socket.emit('session_error', { message: 'Session not found' });

        const isAttacker = session.attackerId === user.id;
        const updateData = isAttacker
          ? { attackerReady: true }
          : { defenderReady: true };

        const updated = await prisma.session.update({
          where: { id: sessionId },
          data: updateData,
        });

        // Broadcast ready state
        io.to(sessionId).emit('ready_update', {
          attackerReady: updated.attackerReady,
          defenderReady: updated.defenderReady,
        });

        // Both ready → start assessment
        if (updated.attackerReady && updated.defenderReady) {
          await startNextRound(io, sessionId, updated);
        }
      } catch (err: any) {
        socket.emit('session_error', { message: err.message });
      }
    });

    // ── submit_attack ──────────────────────────────────────────────────────────
    socket.on('submit_attack', async (data: {
      sessionId: string;
      attackOptionId: string;
      parameters?: Record<string, string>;
    }) => {
      try {
        const { sessionId, attackOptionId, parameters = {} } = data;
        const session = await prisma.session.findUnique({ where: { id: sessionId } });
        if (!session) return socket.emit('session_error', { message: 'Session not found' });
        if (session.attackerId !== user.id) return socket.emit('session_error', { message: 'Only the attacker can submit an attack' });
        if (session.status !== 'ATTACK_SELECTION') return socket.emit('session_error', { message: 'Not in attack selection phase' });

        const room = roomStates.get(sessionId);
        if (!room) return socket.emit('session_error', { message: 'Room state not found' });

        // Find option details from the current scenario
        const attackOptions: any[] = room.currentScenario?.attackOptions ?? [];
        const attackOption = attackOptions.find((o: any) => o.id === attackOptionId);
        if (!attackOption) return socket.emit('session_error', { message: 'Invalid attack option' });

        // Update room state
        room.attackChoice = attackOptionId;
        room.attackOptionName = attackOption.name;
        room.attackOptionDescription = attackOption.description;
        room.attackParams = parameters;
        room.defenseStartTime = Date.now();

        // Update DB state
        await prisma.session.update({
          where: { id: sessionId },
          data: { status: 'DEFENSE_SELECTION' },
        });

        // Notify room — defender sees the attack, attacker sees confirmation
        io.to(sessionId).emit('attack_submitted', {
          sessionId,
          attackOptionId,
          attackOptionName: attackOption.name,
          attackOptionDescription: attackOption.description,
          attackCategory: attackOption.category,
          attackDifficulty: attackOption.difficulty,
        });
      } catch (err: any) {
        socket.emit('session_error', { message: err.message });
      }
    });

    // ── submit_defense ────────────────────────────────────────────────────────
    socket.on('submit_defense', async (data: {
      sessionId: string;
      defenseOptionId: string;
      parameters?: Record<string, string>;
    }) => {
      try {
        const { sessionId, defenseOptionId, parameters = {} } = data;
        const session = await prisma.session.findUnique({ where: { id: sessionId } });
        if (!session) return socket.emit('session_error', { message: 'Session not found' });
        if (session.defenderId !== user.id) return socket.emit('session_error', { message: 'Only the defender can submit a defense' });
        if (session.status !== 'DEFENSE_SELECTION') return socket.emit('session_error', { message: 'Not in defense selection phase' });

        const room = roomStates.get(sessionId);
        if (!room || !room.attackChoice) return socket.emit('session_error', { message: 'No attack to defend against' });

        const defenseOptions: any[] = room.currentScenario?.defenseOptions ?? [];
        const defenseOption = defenseOptions.find((o: any) => o.id === defenseOptionId);
        if (!defenseOption) return socket.emit('session_error', { message: 'Invalid defense option' });

        const timeTaken = Math.floor((Date.now() - room.defenseStartTime) / 1000);

        // Evaluate via rule engine
        await prisma.session.update({ where: { id: sessionId }, data: { status: 'RULE_EVALUATION' } });

        const evaluationResult = await ruleEngine.evaluate(
          sessionId,
          room.currentScenario.id,
          room.attackChoice,
          defenseOptionId,
          room.attackParams,
          parameters,
          timeTaken
        );

        // Compute attacker score too
        const attackerRoundScore = computeAttackerScore(
          evaluationResult.outcome,
          Object.keys(room.attackParams).length > 0
        );

        // Update cumulative scores in DB
        const newAttackerTotal = session.attackerScore + attackerRoundScore;
        const newDefenderTotal = session.defenderScore + evaluationResult.scoreBreakdown.total;

        await prisma.session.update({
          where: { id: sessionId },
          data: {
            attackerScore: newAttackerTotal,
            defenderScore: newDefenderTotal,
            status: 'NEXT_ROUND',
          },
        });

        // Find option names
        const attackOptions: any[] = room.currentScenario?.attackOptions ?? [];
        const attackOption = attackOptions.find((o: any) => o.id === room.attackChoice);

        // Emit round result to both
        io.to(sessionId).emit('round_result', {
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
          attackerRoundScore,
          defenderRoundScore: evaluationResult.scoreBreakdown.total,
          attackerTotalScore: newAttackerTotal,
          defenderTotalScore: newDefenderTotal,
          scoreBreakdown: evaluationResult.scoreBreakdown,
        });

        // Reset room attack state
        room.attackChoice = null;
        room.attackOptionName = null;
        room.attackOptionDescription = null;
        room.attackParams = {};
      } catch (err: any) {
        console.error('submit_defense error:', err);
        socket.emit('session_error', { message: err.message });
      }
    });

    // ── next_round ─────────────────────────────────────────────────────────────
    socket.on('next_round', async (data: { sessionId: string }) => {
      try {
        const { sessionId } = data;
        // Only attacker triggers next round (or we can allow either)
        const session = await prisma.session.findUnique({ where: { id: sessionId } });
        if (!session) return;

        const nextIndex = session.currentScenarioIndex + 1;

        if (nextIndex >= session.totalScenarios) {
          // Complete the assessment
          await prisma.session.update({
            where: { id: sessionId },
            data: { status: 'SESSION_COMPLETE', completedAt: new Date() },
          });

          // Build report
          const report = await buildAssessmentReport(sessionId);
          io.to(sessionId).emit('assessment_complete', { sessionId, report });
        } else {
          await prisma.session.update({
            where: { id: sessionId },
            data: { currentScenarioIndex: nextIndex },
          });
          const updatedSession = await prisma.session.findUnique({ where: { id: sessionId } });
          await startNextRound(io, sessionId, updatedSession!);
        }
      } catch (err: any) {
        socket.emit('session_error', { message: err.message });
      }
    });

    // ── leave_session ──────────────────────────────────────────────────────────
    socket.on('leave_session', (data: { sessionId: string }) => {
      socket.leave(data.sessionId);
    });

    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${user.id} (${socket.id})`);
      // Notify rooms the user was in (socket.io handles room cleanup automatically)
    });
  });
};

// ── Helpers ────────────────────────────────────────────────────────────────────

async function startNextRound(io: Server, sessionId: string, session: any) {
  try {
    const scenarioIds: string[] = session.scenarioIds as string[];
    const idx = session.currentScenarioIndex;

    if (!scenarioIds || idx >= scenarioIds.length) {
      // Fallback: fetch from DB by index
      const scenarios = await prisma.scenario.findMany({
        take: session.totalScenarios,
        orderBy: { id: 'asc' },
      });
      const scenario = scenarios[idx];
      if (!scenario) return;

      let room = roomStates.get(sessionId);
      if (!room) {
        room = {
          attackChoice: null,
          attackOptionName: null,
          attackOptionDescription: null,
          attackParams: {},
          attackStartTime: Date.now(),
          defenseStartTime: Date.now(),
          currentScenario: null,
        };
        roomStates.set(sessionId, room);
      }
      room.currentScenario = scenario;
      room.attackStartTime = Date.now();

      await prisma.session.update({
        where: { id: sessionId },
        data: { status: 'ATTACK_SELECTION' },
      });

      io.to(sessionId).emit('scenario_loaded', {
        sessionId,
        scenario,
        roundNumber: idx + 1,
        totalRounds: session.totalScenarios,
        status: 'ATTACK_SELECTION',
      });
      return;
    }

    const scenarioId = scenarioIds[idx];
    const scenario = await prisma.scenario.findUnique({ where: { id: scenarioId } });
    if (!scenario) return;

    let room = roomStates.get(sessionId);
    if (!room) {
      room = {
        attackChoice: null,
        attackOptionName: null,
        attackOptionDescription: null,
        attackParams: {},
        attackStartTime: Date.now(),
        defenseStartTime: Date.now(),
        currentScenario: null,
      };
      roomStates.set(sessionId, room);
    }
    room.currentScenario = scenario;
    room.attackStartTime = Date.now();

    await prisma.session.update({
      where: { id: sessionId },
      data: { status: 'ATTACK_SELECTION' },
    });

    io.to(sessionId).emit('scenario_loaded', {
      sessionId,
      scenario,
      roundNumber: idx + 1,
      totalRounds: session.totalScenarios,
      status: 'ATTACK_SELECTION',
    });
  } catch (err: any) {
    console.error('startNextRound error:', err);
  }
}

function computeAttackerScore(outcome: string, hasParams: boolean): number {
  let base = 0;
  if (outcome === 'breached') base = 30;
  else if (outcome === 'partially_defended') base = 15;
  else base = 5; // defended — attacker still gets points for choosing a relevant attack
  if (hasParams) base += 5; // bonus for filling in parameters
  return base;
}

async function buildAssessmentReport(sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { attacker: true, defender: true },
  });
  if (!session) return null;

  const events = await prisma.event.findMany({
    where: { sessionId },
    orderBy: { turnId: 'asc' },
  });

  const totalRounds = events.length;
  const attackerWins = events.filter((e) => e.outcome === 'breached').length;
  const defenderWins = events.filter((e) => e.outcome === 'defended').length;
  const partials = events.filter((e) => e.outcome === 'partially_defended').length;

  // Category analysis
  const categoryMap: Record<string, { total: number; defended: number }> = {};
  for (const event of events) {
    const scenario = await prisma.scenario.findUnique({ where: { id: event.scenarioId } });
    if (!scenario) continue;
    const cat = scenario.category;
    if (!categoryMap[cat]) categoryMap[cat] = { total: 0, defended: 0 };
    categoryMap[cat].total += 1;
    if (event.outcome === 'defended') categoryMap[cat].defended += 1;
  }

  const categories = Object.entries(categoryMap).map(([cat, { total, defended }]) => ({
    category: cat,
    total,
    defended,
    accuracy: Math.round((defended / total) * 100),
  }));

  const strongTopics = categories.filter((c) => c.accuracy >= 70).map((c) => c.category);
  const weakTopics = categories.filter((c) => c.accuracy < 50).map((c) => c.category);

  return {
    sessionId,
    attackerName: session.attacker.name,
    defenderName: session.defender?.name ?? 'Unknown',
    totalRounds,
    attackerFinalScore: session.attackerScore,
    defenderFinalScore: session.defenderScore,
    attackerWins,
    defenderWins,
    partials,
    defenderAccuracy: totalRounds > 0 ? Math.round((defenderWins / totalRounds) * 100) : 0,
    categories,
    strongTopics,
    weakTopics,
    events: events.map((e) => ({
      turnId: e.turnId,
      scenarioId: e.scenarioId,
      attackerChoice: e.attackerChoice,
      defenderChoice: e.defenderChoice,
      outcome: e.outcome,
      score: e.score,
      timeTaken: e.timeTaken,
      timestamp: e.timestamp,
    })),
  };
}
