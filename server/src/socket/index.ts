import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/postgres-adapter';
import pg from 'pg';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { PrismaClient } from '@prisma/client';
import { getRoomState, markReady, submitAttack, submitDefense, advanceRound, finalizeCompletedAssessment } from '../services/sessionActions';
import { buildAssessmentReport } from '../services/reportBuilder';
import { SessionState } from '../services/stateMachine';

const prisma = new PrismaClient();

// Exported io instance so REST routes can emit events too
let _io: Server;
export const getIO = () => _io;

// Shared by the submitAttack socket event and POST /api/attack so both push
// the same events. Individual-as-attacker: submitAttack already chained a
// system defense and resolved the round, so go straight to the round result
// instead of the "waiting for a live defender" event.
export function broadcastAttackResult(
  io: Pick<Server, 'to'>,
  sessionId: string,
  result: Awaited<ReturnType<typeof submitAttack>>
) {
  if ('roundResult' in result) {
    io.to(sessionId).emit('ruleProcessed', {
      sessionId,
      outcome: result.roundResult.outcome,
      explanation: result.roundResult.explanation,
    });
    io.to(sessionId).emit('roundCompleted', result.roundResult);
  } else {
    io.to(sessionId).emit('attackSubmitted', result);
  }
}

export const setupSocket = (httpServer: HttpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN,
      methods: ['GET', 'POST'],
    }
  });
  _io = io;

  // Several Vercel instances may serve one assessment: the Postgres adapter
  // relays room broadcasts (and attachments for large payloads) between them.
  if (env.SOCKET_ADAPTER_URL) {
    const pool = new pg.Pool({ connectionString: env.SOCKET_ADAPTER_URL, max: 3 });
    pool.on('error', (err) => console.error('[socket adapter] pool error', err.message));
    pool
      .query('CREATE TABLE IF NOT EXISTS socket_io_attachments (id bigserial UNIQUE, created_at timestamptz DEFAULT NOW(), payload bytea)')
      // 23505: another instance created it at the same moment — fine.
      .catch((err) => { if (err.code !== '23505') console.error('[socket adapter] could not prepare attachments table', err.message); });
    io.adapter(createAdapter(pool));
  }

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
        // In SOLO mode attackerId === defenderId, so identity alone can't
        // tell the roles apart — defer to the session's own soloRole.
        const role =
          session.mode === 'SOLO' ? (session.soloRole === 'DEFENDER' ? 'defender' : 'attacker') : isAttacker ? 'attacker' : 'defender';

        socket.to(sessionId).emit('partnerConnected', {
          role,
          userName: user.name,
        });

        socket.emit('sessionState', {
          sessionId,
          sessionCode: session.sessionCode,
          mode: session.mode,
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
          const room = getRoomState(session.roundState);
          if (room?.currentScenario) {
            socket.emit('scenarioLoaded', {
              sessionId,
              scenario: room.currentScenario,
              roundNumber: session.currentScenarioIndex + 1,
              totalRounds: session.totalScenarios,
              status: session.status,
            });
            if (session.status === SessionState.RESULT_GENERATED && room.result) {
              socket.emit('roundCompleted', room.result);
            } else if (room.attack && session.status === SessionState.DEFENSE_SELECTION) {
              socket.emit('attackSubmitted', {
                sessionId,
                attackOptionId: room.attack.id,
                attackOptionName: room.attack.name,
                attackOptionDescription: room.attack.description,
                attackCategory: room.attack.category,
                attackDifficulty: room.attack.difficulty,
              });
            }
          }
        }
        if (session.status === SessionState.ASSESSMENT_COMPLETE) {
          await finalizeCompletedAssessment(session);
          const report = await buildAssessmentReport(sessionId);
          socket.emit('assessmentCompleted', { sessionId, report });
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
        broadcastAttackResult(io, data.sessionId, result);
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
        const result = await submitDefense(data.sessionId, user.id, data.defenseOptionId);

        io.to(data.sessionId).emit('defenseSubmitted', {
          sessionId: data.sessionId,
          defenseOptionId: data.defenseOptionId,
        });

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
