import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getIO } from '../socket';

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
router.post('/create', async (req: AuthRequest, res: Response) => {
  try {
    const { difficulty = 'Medium', totalScenarios = 5, module: moduleName } = req.body;

    // Select random scenarios matching difficulty
    const allScenarios = await prisma.scenario.findMany({
      where: difficulty !== 'All' ? { difficulty } : undefined,
    });

    if (allScenarios.length === 0) {
      return res.status(400).json({ success: false, error: 'No scenarios found for the selected difficulty' });
    }

    // Shuffle and pick N
    const shuffled = allScenarios.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(totalScenarios, shuffled.length));
    const scenarioIds = selected.map((s) => s.id);
    const actualTotal = scenarioIds.length;

    const sessionCode = await generateSessionCode();

    const session = await prisma.session.create({
      data: {
        sessionCode,
        attackerId: req.user.id,
        status: 'WAITING_FOR_PARTICIPANT',
        difficulty,
        module: moduleName ?? null,
        totalScenarios: actualTotal,
        scenarioIds,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        sessionId: session.id,
        sessionCode: session.sessionCode,
        status: session.status,
        difficulty: session.difficulty,
        totalScenarios: session.totalScenarios,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/sessions/join
router.post('/join', async (req: AuthRequest, res: Response) => {
  try {
    const { sessionCode } = req.body;
    if (!sessionCode) return res.status(400).json({ success: false, error: 'Session code is required' });

    const session = await prisma.session.findUnique({
      where: { sessionCode: sessionCode.toUpperCase() },
      include: { attacker: true },
    });

    if (!session) return res.status(404).json({ success: false, error: 'Session not found. Check the code and try again.' });
    if (session.status !== 'WAITING_FOR_PARTICIPANT') {
      return res.status(400).json({ success: false, error: 'This session is no longer accepting participants.' });
    }
    if (session.attackerId === req.user.id) {
      return res.status(400).json({ success: false, error: 'You cannot join your own session as defender.' });
    }
    if (session.defenderId) {
      return res.status(400).json({ success: false, error: 'This session already has a defender.' });
    }

    const updated = await prisma.session.update({
      where: { id: session.id },
      data: { defenderId: req.user.id, status: 'SESSION_READY' },
      include: { attacker: true, defender: true },
    });

    // Notify attacker via socket
    try {
      const io = getIO();
      if (io) {
        io.to(session.id).emit('participant_joined', {
          sessionId: session.id,
          defenderName: req.user.name,
          status: 'SESSION_READY',
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
        totalScenarios: updated.totalScenarios,
        attackerName: updated.attacker.name,
        defenderName: updated.defender?.name,
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
        status: { not: 'SESSION_COMPLETE' },
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
      where: { id: req.params.id },
      include: { attacker: true, defender: true, events: true },
    });
    if (!session) return res.status(404).json({ success: false, error: 'Session not found' });
    res.json({ success: true, data: session });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/sessions/:id/report
router.get('/:id/report', async (req: AuthRequest, res: Response) => {
  try {
    const session = await prisma.session.findUnique({
      where: { id: req.params.id },
      include: { attacker: true, defender: true, events: { orderBy: { turnId: 'asc' } } },
    });
    if (!session) return res.status(404).json({ success: false, error: 'Session not found' });

    const events = session.events;
    const totalRounds = events.length;
    const defenderWins = events.filter((e) => e.outcome === 'defended').length;
    const attackerWins = events.filter((e) => e.outcome === 'breached').length;
    const partials = events.filter((e) => e.outcome === 'partially_defended').length;

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        sessionCode: session.sessionCode,
        attackerName: session.attacker.name,
        defenderName: session.defender?.name ?? 'Unknown',
        totalRounds,
        attackerFinalScore: session.attackerScore,
        defenderFinalScore: session.defenderScore,
        attackerWins,
        defenderWins,
        partials,
        defenderAccuracy: totalRounds > 0 ? Math.round((defenderWins / totalRounds) * 100) : 0,
        events,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
