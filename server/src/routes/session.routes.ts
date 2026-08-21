import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createSessionSchema, joinSessionSchema, readySchema } from '../validation/sessionSchemas';
import { getIO } from '../socket';
import { markReady } from '../services/sessionActions';
import { buildAssessmentReport } from '../services/reportBuilder';
import { transition, SessionState } from '../services/stateMachine';

const prisma = new PrismaClient();
const router = Router();

router.use(authenticate);

// Generate human-readable session code like CYB-7428
const generateSessionCode = async (): Promise<string> => {
  let code: string;
  let exists = true;
  do {
    const num = Math.floor(Math.random() * 9000) + 1000;
    code = `CYB-${num}`;
    const existing = await prisma.session.findUnique({ where: { sessionCode: code } });
    exists = !!existing;
  } while (exists);
  return code;
};

// POST /api/sessions/create
router.post('/create', validate(createSessionSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { difficulty = 'Medium', totalScenarios = 5, module: moduleCategory } = req.body;

    const allScenarios = await prisma.scenario.findMany({
      where: {
        ...(difficulty !== 'All' ? { difficulty } : {}),
        ...(moduleCategory && moduleCategory !== 'All Modules' ? { category: moduleCategory } : {}),
      },
    });

    if (allScenarios.length === 0) {
      return res.status(400).json({ success: false, error: 'No scenarios found for the selected module/difficulty' });
    }

    const shuffled = allScenarios.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(totalScenarios, shuffled.length));
    const scenarioIds = selected.map((s) => s.id);
    const actualTotal = scenarioIds.length;

    const sessionCode = await generateSessionCode();
    const initialStatus = transition(SessionState.START, SessionState.WAITING_FOR_PARTICIPANT);

    const session = await prisma.session.create({
      data: {
        sessionCode,
        attackerId: req.user.id,
        status: initialStatus,
        difficulty,
        module: moduleCategory ?? null,
        totalScenarios: actualTotal,
        scenarioIds,
      },
    });

    // sessionCreated is delivered synchronously over REST (the creator isn't
    // in a socket room yet — no defender exists to notify).
    res.status(201).json({
      success: true,
      data: {
        sessionId: session.id,
        sessionCode: session.sessionCode,
        status: session.status,
        difficulty: session.difficulty,
        module: session.module,
        totalScenarios: session.totalScenarios,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/sessions/join
router.post('/join', validate(joinSessionSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { sessionCode } = req.body;

    const session = await prisma.session.findUnique({
      where: { sessionCode: sessionCode.toUpperCase() },
      include: { attacker: true },
    });

    if (!session) return res.status(404).json({ success: false, error: 'Session not found. Check the code and try again.' });
    if (session.status !== SessionState.WAITING_FOR_PARTICIPANT) {
      return res.status(400).json({ success: false, error: 'This session is no longer accepting participants.' });
    }
    if (session.attackerId === req.user.id) {
      return res.status(400).json({ success: false, error: 'You cannot join your own session as defender.' });
    }
    if (session.defenderId) {
      return res.status(400).json({ success: false, error: 'This session already has a defender.' });
    }

    const nextStatus = transition(session.status, SessionState.SESSION_READY);

    const updated = await prisma.session.update({
      where: { id: session.id },
      data: { defenderId: req.user.id, status: nextStatus },
      include: { attacker: true, defender: true },
    });

    try {
      const io = getIO();
      if (io) {
        io.to(session.id).emit('participantJoined', {
          sessionId: session.id,
          defenderName: req.user.name,
          status: nextStatus,
        });
      }
    } catch { /* socket may not be ready */ }

    res.json({
      success: true,
      data: {
        sessionId: updated.id,
        sessionCode: updated.sessionCode,
        status: updated.status,
        difficulty: updated.difficulty,
        module: updated.module,
        totalScenarios: updated.totalScenarios,
        attackerName: updated.attacker.name,
        defenderName: updated.defender?.name,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/sessions/ready
router.post('/ready', validate(readySchema), async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId } = req.body;
    const { attackerReady, defenderReady, startedRound } = await markReady(sessionId, req.user.id);

    const io = getIO();
    if (io) {
      io.to(sessionId).emit('participantReady', { attackerReady, defenderReady });
      if (startedRound) io.to(sessionId).emit('scenarioLoaded', startedRound);
    }

    res.json({ success: true, data: { attackerReady, defenderReady, startedRound } });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/sessions/resumable
// Rehydrates a hard-refreshed client for the two windows a Pre-Test or
// Post-Test can occupy: `activeSession` covers the pre-round-play window
// (WAITING_FOR_PARTICIPANT/SESSION_READY — where the Pre-Test gate lives),
// and `pendingPostTestSession` covers a completed assessment whose Post-Test
// this user hasn't finished yet. Scoped deliberately to just these two
// windows — full mid-round (attack/defense-selection) resume is a
// pre-existing, separate gap this endpoint does not address.
router.get('/resumable', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user.id;

    const activeSession = await prisma.session.findFirst({
      where: {
        OR: [{ attackerId: userId }, { defenderId: userId }],
        status: { in: [SessionState.WAITING_FOR_PARTICIPANT, SessionState.SESSION_READY] },
      },
      orderBy: { createdAt: 'desc' },
      include: { attacker: true, defender: true },
    });

    let pendingPostTestSession = null;
    const completedSessions = await prisma.session.findMany({
      where: {
        OR: [{ attackerId: userId }, { defenderId: userId }],
        status: SessionState.ASSESSMENT_COMPLETE,
      },
      orderBy: { completedAt: 'desc' },
      take: 5,
    });
    for (const session of completedSessions) {
      const postAttempt = await prisma.quizAttempt.findUnique({
        where: { sessionId_userId_testType: { sessionId: session.id, userId, testType: 'POST' } },
      });
      if (!postAttempt || postAttempt.status !== 'completed') {
        pendingPostTestSession = session;
        break;
      }
    }

    res.json({
      success: true,
      data: {
        activeSession: activeSession
          ? {
              sessionId: activeSession.id,
              sessionCode: activeSession.sessionCode,
              status: activeSession.status,
              difficulty: activeSession.difficulty,
              module: activeSession.module,
              totalScenarios: activeSession.totalScenarios,
              attackerName: activeSession.attacker.name,
              defenderName: activeSession.defender?.name ?? null,
              role: activeSession.attackerId === userId ? 'attacker' : 'defender',
            }
          : null,
        pendingPostTestSession: pendingPostTestSession
          ? {
              sessionId: pendingPostTestSession.id,
              role: pendingPostTestSession.attackerId === userId ? 'attacker' : 'defender',
            }
          : null,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/sessions/active
router.get('/active', async (req: AuthRequest, res: Response) => {
  try {
    const sessions = await prisma.session.findMany({
      where: {
        OR: [{ attackerId: req.user.id }, { defenderId: req.user.id }],
        status: { not: SessionState.ASSESSMENT_COMPLETE },
      },
    });
    res.json({ success: true, data: sessions });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/sessions/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const session = await prisma.session.findUnique({
      where: { id: String(req.params.id) },
      include: { attacker: true, defender: true, events: true },
    });
    if (!session) return res.status(404).json({ success: false, error: 'Session not found' });
    res.json({ success: true, data: session });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/sessions/:id/report — alias of GET /api/assessment-report/:sessionId
router.get('/:id/report', async (req: AuthRequest, res: Response) => {
  try {
    const report = await buildAssessmentReport(String(req.params.id));
    if (!report) return res.status(404).json({ success: false, error: 'Session not found' });
    res.json({ success: true, data: report });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
