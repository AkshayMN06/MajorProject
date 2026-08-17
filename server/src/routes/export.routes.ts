import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { toCsv } from '../utils/csv';
import { buildAssessmentReport } from '../services/reportBuilder';

const prisma = new PrismaClient();
const router = Router();

router.use(authenticate);

/**
 * Only a session's own attacker/defender may export its data — these files
 * contain per-round choices and quiz results, not something any logged-in
 * user should be able to pull for an arbitrary sessionId.
 */
async function authorizeSessionAccess(req: AuthRequest, res: Response, sessionId: string) {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) {
    res.status(404).json({ success: false, error: 'Session not found' });
    return null;
  }
  if (session.attackerId !== req.user.id && session.defenderId !== req.user.id) {
    res.status(403).json({ success: false, error: 'You are not a participant in this session' });
    return null;
  }
  return session;
}

function sendCsv(res: Response, filename: string, csv: string) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

// GET /api/export/session/:sessionId/events.csv
// One row per completed round (Event table) — the raw outcome log.
router.get('/session/:sessionId/events.csv', async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = String(req.params.sessionId);
    const session = await authorizeSessionAccess(req, res, sessionId);
    if (!session) return;

    const events = await prisma.event.findMany({
      where: { sessionId },
      include: { scenario: true },
      orderBy: { turnId: 'asc' },
    });

    const rows = events.map((e) => {
      const attackOptions = (e.scenario.attackOptions as any[]) ?? [];
      const defenseOptions = (e.scenario.defenseOptions as any[]) ?? [];
      const attack = attackOptions.find((a) => a.id === e.attackerChoice);
      const defense = defenseOptions.find((d) => d.id === e.defenderChoice);
      return {
        sessionId: session.id,
        turnId: e.turnId,
        scenarioId: e.scenarioId,
        scenarioName: e.scenario.name,
        category: e.scenario.category,
        attackerId: session.attackerId,
        defenderId: session.defenderId ?? '',
        attackChoiceId: e.attackerChoice,
        attackChoiceName: attack?.name ?? '',
        defenseChoiceId: e.defenderChoice,
        defenseChoiceName: defense?.name ?? '',
        outcome: e.outcome,
        score: e.score,
        timeTakenSec: e.timeTaken,
        timestamp: e.timestamp.toISOString(),
      };
    });

    const csv = toCsv(rows, [
      'sessionId', 'turnId', 'scenarioId', 'scenarioName', 'category',
      'attackerId', 'defenderId', 'attackChoiceId', 'attackChoiceName',
      'defenseChoiceId', 'defenseChoiceName', 'outcome', 'score', 'timeTakenSec', 'timestamp',
    ]);

    sendCsv(res, `events-${sessionId}.csv`, csv);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/export/session/:sessionId/attempts.csv
// One row per user action (Attempt table) — both roles, every round.
router.get('/session/:sessionId/attempts.csv', async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = String(req.params.sessionId);
    const session = await authorizeSessionAccess(req, res, sessionId);
    if (!session) return;

    const attempts = await prisma.attempt.findMany({
      where: { sessionId },
      include: { scenario: true },
      orderBy: { createdAt: 'asc' },
    });

    const rows = attempts.map((a) => {
      const options = (a.role === 'attacker' ? a.scenario.attackOptions : a.scenario.defenseOptions) as any[];
      const chosen = options.find((o) => o.id === a.choice);
      return {
        attemptId: a.id,
        sessionId: a.sessionId,
        scenarioId: a.scenarioId,
        scenarioName: a.scenario.name,
        userId: a.userId,
        role: a.role,
        choiceId: a.choice,
        choiceName: chosen?.name ?? '',
        outcome: a.outcome,
        score: a.score,
        timeTakenSec: a.timeTaken,
        explanation: a.explanation,
        createdAt: a.createdAt.toISOString(),
      };
    });

    const csv = toCsv(rows, [
      'attemptId', 'sessionId', 'scenarioId', 'scenarioName', 'userId', 'role',
      'choiceId', 'choiceName', 'outcome', 'score', 'timeTakenSec', 'explanation', 'createdAt',
    ]);

    sendCsv(res, `attempts-${sessionId}.csv`, csv);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/export/session/:sessionId/results.csv
// One row per participant — the assessment-report summary, including
// pre/post-test learning outcomes. Reuses buildAssessmentReport() (the same
// source of truth as the on-screen report) rather than recomputing anything.
router.get('/session/:sessionId/results.csv', async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = String(req.params.sessionId);
    const session = await authorizeSessionAccess(req, res, sessionId);
    if (!session) return;

    const report = await buildAssessmentReport(sessionId);
    if (!report) {
      res.status(404).json({ success: false, error: 'Report not available for this session' });
      return;
    }

    const participants = [
      {
        userId: session.attackerId,
        role: 'attacker',
        finalScore: report.attackerFinalScore,
        accuracy: report.attackerAccuracy,
        learningOutcomes: report.attackerLearningOutcomes,
      },
      ...(session.defenderId
        ? [{
            userId: session.defenderId,
            role: 'defender',
            finalScore: report.defenderFinalScore,
            accuracy: report.defenderAccuracy,
            learningOutcomes: report.defenderLearningOutcomes,
          }]
        : []),
    ];

    // Module columns are derived from whatever modules actually appear in
    // either participant's data — never a hardcoded module list.
    const moduleSet = new Set<string>();
    for (const p of participants) {
      for (const m of p.learningOutcomes.modulePerformance) moduleSet.add(m.moduleTag);
    }
    const modules = Array.from(moduleSet).sort();

    const rows = participants.map((p) => {
      const row: Record<string, unknown> = {
        sessionId: session.id,
        userId: p.userId,
        role: p.role,
        finalScore: p.finalScore,
        accuracy: p.accuracy,
        totalRounds: report.totalRounds,
        preTestScore: p.learningOutcomes.hasPreTest ? p.learningOutcomes.preTestScore : '',
        postTestScore: p.learningOutcomes.hasPostTest ? p.learningOutcomes.postTestScore : '',
        learningGain: p.learningOutcomes.learningGain ?? '',
        learningGainPercent: p.learningOutcomes.learningGainPercent ?? '',
        weakTopics: p.learningOutcomes.weakTopics.join('; '),
      };
      for (const mod of modules) {
        const entry = p.learningOutcomes.modulePerformance.find((m) => m.moduleTag === mod);
        row[`${mod} Pre %`] = entry?.preAccuracy ?? '';
        row[`${mod} Post %`] = entry?.postAccuracy ?? '';
      }
      return row;
    });

    const columns = [
      'sessionId', 'userId', 'role', 'finalScore', 'accuracy', 'totalRounds',
      'preTestScore', 'postTestScore', 'learningGain', 'learningGainPercent', 'weakTopics',
      ...modules.flatMap((m) => [`${m} Pre %`, `${m} Post %`]),
    ];

    const csv = toCsv(rows, columns);
    sendCsv(res, `results-${sessionId}.csv`, csv);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
