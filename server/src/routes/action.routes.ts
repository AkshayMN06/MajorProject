import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { attackSchema, defenseSchema, roundResultQuerySchema } from '../validation/sessionSchemas';
import { getIO } from '../socket';
import { submitAttack, submitDefense } from '../services/sessionActions';
import { buildAssessmentReport } from '../services/reportBuilder';

const prisma = new PrismaClient();
const router = Router();

router.use(authenticate);

// POST /api/attack — same underlying logic as the submitAttack socket
// event; the live UI keeps using sockets, this exists for spec-completeness
// and non-socket clients, and pushes the identical broadcast either way.
router.post('/attack', validate(attackSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId, attackOptionId } = req.body;
    const result = await submitAttack(sessionId, req.user.id, attackOptionId);

    const io = getIO();
    if (io) io.to(sessionId).emit('attackSubmitted', result);

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/defense
router.post('/defense', validate(defenseSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId, defenseOptionId } = req.body;

    const io = getIO();
    if (io) io.to(sessionId).emit('defenseSubmitted', { sessionId, defenseOptionId });

    const result = await submitDefense(sessionId, req.user.id, defenseOptionId);

    if (io) {
      io.to(sessionId).emit('ruleProcessed', { sessionId, outcome: result.outcome, explanation: result.explanation });
      io.to(sessionId).emit('roundCompleted', result);
    }

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/round-result?sessionId=... — latest round result for the
// session, for reconnect/non-socket clients (round_result itself is
// push-only and transient).
router.get('/round-result', validate(roundResultQuerySchema), async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = String(req.query.sessionId);
    const lastEvent = await prisma.event.findFirst({
      where: { sessionId },
      orderBy: { turnId: 'desc' },
    });
    if (!lastEvent) return res.status(404).json({ success: false, error: 'No round result yet for this session' });

    const [attackerScore, defenderScore] = await Promise.all([
      prisma.score.findFirst({ where: { sessionId, role: 'attacker', roundNumber: lastEvent.turnId } }),
      prisma.score.findFirst({ where: { sessionId, role: 'defender', roundNumber: lastEvent.turnId } }),
    ]);

    res.json({
      success: true,
      data: {
        sessionId,
        turnId: lastEvent.turnId,
        scenarioId: lastEvent.scenarioId,
        attackerChoice: lastEvent.attackerChoice,
        defenderChoice: lastEvent.defenderChoice,
        outcome: lastEvent.outcome,
        timeTaken: lastEvent.timeTaken,
        timestamp: lastEvent.timestamp,
        attackerScoreBreakdown: attackerScore,
        defenderScoreBreakdown: defenderScore,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/assessment-report/:sessionId
router.get('/assessment-report/:sessionId', async (req: AuthRequest, res: Response) => {
  try {
    const report = await buildAssessmentReport(req.params.sessionId);
    if (!report) return res.status(404).json({ success: false, error: 'Session not found' });
    res.json({ success: true, data: report });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
