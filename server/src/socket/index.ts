import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { PrismaClient } from '@prisma/client';
import { getRoomState, markReady, submitAttack, submitDefense, advanceRound } from '../services/sessionActions';
import { buildAssessmentReport } from '../services/reportBuilder';
import { SessionState } from '../services/stateMachine';

const prisma = new PrismaClient();

// Exported io instance so REST routes can emit events too
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

    // ── joinSession ───────────────────────────────────────────────────────────
    socket.on('joinSession', async (data: { sessionId: string }) => {
      try {
        const { sessionId } = data;
        const session = await prisma.session.findUnique({
          where: { id: sessionId },
          include: { attacker: true, defender: true }
        });
        if (!session) return socket.emit('sessionError', { message: 'Session not found' });

        const isAttacker = session.attackerId === user.id;
        const isDefender = session.defenderId === user.id;
        if (!isAttacker && !isDefender) {
          return socket.emit('sessionError', { message: 'You are not a participant in this session' });
        }

        socket.join(sessionId);
        const role = isAttacker ? 'attacker' : 'defender';

        socket.to(sessionId).emit('partnerConnected', {
          role,
          userName: user.name,
        });

        socket.emit('sessionState', {
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

        // Reconnect mid-round: replay what the client would have missed.
        const midRoundStatuses: string[] = [
          SessionState.ATTACK_SELECTION,
          SessionState.DEFENSE_SELECTION,
          SessionState.RULE_PROCESSING,
          SessionState.RESULT_GENERATED,
        ];
        if (midRoundStatuses.includes(session.status)) {
          const room = getRoomState(sessionId);
          if (room?.currentScenario) {
            socket.emit('scenarioLoaded', {
              sessionId,
              scenario: room.currentScenario,
              roundNumber: session.currentScenarioIndex + 1,
              totalRounds: session.totalScenarios,
              status: session.status,
            });
            if (isDefender && room.attackChoice && session.status !== SessionState.ATTACK_SELECTION) {
              socket.emit('attackSubmitted', {
                sessionId,
                attackOptionId: room.attackChoice,
                attackOptionName: room.attackOptionName,
                attackOptionDescription: room.attackOptionDescription,
              });
            }
          }
        }
      } catch (err: any) {
        socket.emit('sessionError', { message: err.message });
      }
    });

    // ── markReady ────────────────────────────────────────────────────────────
    socket.on('markReady', async (data: { sessionId: string }) => {
      try {
        const { sessionId } = data;
        const { attackerReady, defenderReady, startedRound } = await markReady(sessionId, user.id);

        io.to(sessionId).emit('participantReady', { attackerReady, defenderReady });

        if (startedRound) {
          io.to(sessionId).emit('scenarioLoaded', startedRound);
        }
      } catch (err: any) {
        socket.emit('sessionError', { message: err.message });
      }
    });

    // ── submitAttack ─────────────────────────────────────────────────────────
    socket.on('submitAttack', async (data: {
      sessionId: string;
      attackOptionId: string;
    }) => {
      try {
        const result = await submitAttack(data.sessionId, user.id, data.attackOptionId);
        io.to(data.sessionId).emit('attackSubmitted', result);
      } catch (err: any) {
        socket.emit('sessionError', { message: err.message });
      }
    });

    // ── submitDefense ────────────────────────────────────────────────────────
    socket.on('submitDefense', async (data: {
      sessionId: string;
      defenseOptionId: string;
    }) => {
      try {
        io.to(data.sessionId).emit('defenseSubmitted', {
          sessionId: data.sessionId,
          defenseOptionId: data.defenseOptionId,
        });

        const result = await submitDefense(data.sessionId, user.id, data.defenseOptionId);

        io.to(data.sessionId).emit('ruleProcessed', {
          sessionId: data.sessionId,
          outcome: result.outcome,
          explanation: result.explanation,
        });

        io.to(data.sessionId).emit('roundCompleted', result);
      } catch (err: any) {
        console.error('submitDefense error:', err);
        socket.emit('sessionError', { message: err.message });
      }
    });

    // ── nextRound ────────────────────────────────────────────────────────────
    socket.on('nextRound', async (data: { sessionId: string }) => {
      try {
        const outcome = await advanceRound(data.sessionId, user.id);
        if (outcome.complete) {
          const report = await buildAssessmentReport(data.sessionId);
          io.to(data.sessionId).emit('assessmentCompleted', { sessionId: data.sessionId, report });
        } else {
          io.to(data.sessionId).emit('scenarioLoaded', outcome.startedRound);
        }
      } catch (err: any) {
        socket.emit('sessionError', { message: err.message });
      }
    });

    // ── leaveSession ─────────────────────────────────────────────────────────
    socket.on('leaveSession', (data: { sessionId: string }) => {
      socket.leave(data.sessionId);
    });

    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${user.id} (${socket.id})`);
      // Notify rooms the user was in (socket.io handles room cleanup automatically)
    });
  });
};
