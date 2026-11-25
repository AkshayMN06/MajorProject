import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authorizeSessionAccess } from '../middleware/sessionAccess';
import { validate } from '../middleware/validate';
import { createSessionSchema, createSoloSessionSchema, joinSessionSchema, readySchema } from '../validation/sessionSchemas';
import { getIO } from '../socket';
import { markReady, loadNextScenario, getRoomState } from '../services/sessionActions';
import { buildAssessmentReport } from '../services/reportBuilder';
import { transition, SessionState } from '../services/stateMachine';
import { buildInterleavedScenarioSet } from '../services/interleavedScenarios';

const prisma = new PrismaClient();
const router = Router();

router.use(authenticate);

// Participants are exposed as id + name only — never credential hashes or
// account-security metadata.
const participantSelect = { select: { id: true, name: true } } as const;

// Client-safe session scalars. Deliberately omits scenarioIds (the upcoming
// round plan), roundState (persisted in-flight round, incl. the attacker's
// pending choice) and completionArtifactsAt (internal bookkeeping).
const safeSessionSelect = {
  id: true,
  sessionCode: true,
  attackerId: true,
  defenderId: true,
  status: true,
  mode: true,
  soloRole: true,
  difficulty: true,
  module: true,
  currentScenarioIndex: true,
  totalScenarios: true,
  attackerReady: true,
  defenderReady: true,
  attackerScore: true,
  defenderScore: true,
  createdAt: true,
  completedAt: true,
} as const;

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

// Shared by /create and /solo. Interleaved sessions ignore the single-
// category `moduleCategory` filter entirely (mixing categories is the
// point) and round-robin across every category present instead of the
// normal flat shuffle over one category's scenarios.
async function selectScenarioIds({
  difficulty,
  moduleCategory,
  totalScenarios,
  interleaved,
}: {
  difficulty: string;
  moduleCategory?: string;
  totalScenarios: number;
  interleaved?: boolean;
}): Promise<string[]> {
  const allScenarios = await prisma.scenario.findMany({
    where: {
      ...(difficulty !== 'All' ? { difficulty } : {}),
      ...(!interleaved && moduleCategory && moduleCategory !== 'All Modules' ? { category: moduleCategory } : {}),
    },
  });

  if (interleaved) {
    return buildInterleavedScenarioSet(allScenarios, totalScenarios);
  }

  const shuffled = allScenarios.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(totalScenarios, shuffled.length)).map((s) => s.id);
}

// POST /api/sessions/create
router.post('/create', validate(createSessionSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { difficulty = 'Medium', totalScenarios = 5, module: moduleCategory, interleaved } = req.body;

    const scenarioIds = await selectScenarioIds({ difficulty, moduleCategory, totalScenarios, interleaved });
    if (scenarioIds.length === 0) {
      return res.status(400).json({ success: false, error: 'No scenarios found for the selected module/difficulty' });
    }
    const actualTotal = scenarioIds.length;

    const sessionCode = await generateSessionCode();
    const initialStatus = transition(SessionState.START, SessionState.WAITING_FOR_PARTICIPANT);

    const session = await prisma.session.create({
      data: {
        sessionCode,
        attackerId: req.user.id,
        status: initialStatus,
        difficulty,
        module: interleaved ? null : moduleCategory ?? null,
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

// POST /api/sessions/solo — single-player practice: the creator occupies
// both attacker and defender slots, and whichever role they didn't pick is
// played by the system each round (see sessionActions.ts). Skips the
// WAITING_FOR_PARTICIPANT/join handshake entirely and returns round 1
// already loaded.
router.post('/solo', validate(createSoloSessionSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { difficulty = 'Medium', totalScenarios = 5, module: moduleCategory, soloRole, interleaved } = req.body;

    const scenarioIds = await selectScenarioIds({ difficulty, moduleCategory, totalScenarios, interleaved });
    if (scenarioIds.length === 0) {
      return res.status(400).json({ success: false, error: 'No scenarios found for the selected module/difficulty' });
    }
    const actualTotal = scenarioIds.length;

    const sessionCode = await generateSessionCode();
    const readyStatus = transition(
      transition(SessionState.START, SessionState.WAITING_FOR_PARTICIPANT),
      SessionState.SESSION_READY
    );

    const session = await prisma.session.create({
      data: {
        sessionCode,
        attackerId: req.user.id,
        defenderId: req.user.id,
        mode: 'SOLO',
        soloRole,
        status: readyStatus,
        attackerReady: true,
        defenderReady: true,
        difficulty,
        module: interleaved ? null : moduleCategory ?? null,
        totalScenarios: actualTotal,
        scenarioIds,
      },
    });

    const startedRound = await loadNextScenario(session.id, session);

    res.status(201).json({
      success: true,
      data: {
        sessionId: session.id,
        sessionCode: session.sessionCode,
        difficulty: session.difficulty,
        module: session.module,
        totalScenarios: session.totalScenarios,
        soloRole: session.soloRole,
        startedRound,
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

    // Conditional claim: of any number of concurrent joins, only the one
    // whose write still sees an empty defender slot succeeds.
    const claimed = await prisma.session.updateMany({
      where: { id: session.id, status: SessionState.WAITING_FOR_PARTICIPANT, defenderId: null },
      data: { defenderId: req.user.id, status: nextStatus },
    });
    if (!claimed.count) {
      return res.status(400).json({ success: false, error: 'This session already has a defender.' });
    }

    const updated = await prisma.session.findUniqueOrThrow({
      where: { id: session.id },
      include: { attacker: participantSelect, defender: participantSelect },
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

// In SOLO mode attackerId === defenderId, so identity can't tell the roles
// apart — use soloRole, as the socket's joinSession does.
function roleOf(session: { mode: string; soloRole: string | null; attackerId: string }, userId: string) {
  if (session.mode === 'SOLO') return session.soloRole === 'DEFENDER' ? 'defender' : 'attacker';
  return session.attackerId === userId ? 'attacker' : 'defender';
}

// Statuses a hard-refreshed client can resume. Pre-play states need nothing
// persisted; mid-round states are only resumable when the persisted round
// (Session.roundState) exists, because the socket's joinSession replays the
// scenario/attack/result from it. Legacy rows without it, and transient
// RULE_PROCESSING/NEXT_ROUND rows, are not offered.
const PRE_PLAY_STATUSES: string[] = [SessionState.WAITING_FOR_PARTICIPANT, SessionState.SESSION_READY];
const MID_ROUND_STATUSES: string[] = [SessionState.ATTACK_SELECTION, SessionState.DEFENSE_SELECTION, SessionState.RESULT_GENERATED];

// GET /api/sessions/resumable
// Rehydrates a hard-refreshed client: `activeSession` is the caller's most
// recent unfinished session (pre-play or recoverable mid-round), and
// `pendingPostTestSession` is a completed assessment whose Post-Test this
// user hasn't finished yet. Only safe metadata is returned — round content
// is delivered by the socket's participant-checked joinSession replay.
router.get('/resumable', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user.id;

    const candidates = await prisma.session.findMany({
      where: {
        OR: [{ attackerId: userId }, { defenderId: userId }],
        status: { in: [...PRE_PLAY_STATUSES, ...MID_ROUND_STATUSES] },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        ...safeSessionSelect,
        roundState: true, // read for the recoverability check only, never returned
        attacker: participantSelect,
        defender: participantSelect,
      },
    });
    const activeSession = candidates.find(
      (s) => PRE_PLAY_STATUSES.includes(s.status) || getRoomState(s.roundState) !== null
    );

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
              mode: activeSession.mode,
              difficulty: activeSession.difficulty,
              module: activeSession.module,
              totalScenarios: activeSession.totalScenarios,
              currentRound: activeSession.currentScenarioIndex + 1,
              attackerScore: activeSession.attackerScore,
              defenderScore: activeSession.defenderScore,
              attackerName: activeSession.attacker.name,
              defenderName: activeSession.defender?.name ?? null,
              role: roleOf(activeSession, userId),
            }
          : null,
        pendingPostTestSession: pendingPostTestSession
          ? {
              sessionId: pendingPostTestSession.id,
              role: roleOf(pendingPostTestSession, userId),
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
      select: safeSessionSelect,
    });
    res.json({ success: true, data: sessions });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/sessions/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = String(req.params.id);
    if (!(await authorizeSessionAccess(req, res, sessionId))) return;
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        ...safeSessionSelect,
        attacker: participantSelect,
        defender: participantSelect,
        events: true,
      },
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
    if (!(await authorizeSessionAccess(req, res, String(req.params.id)))) return;
    const report = await buildAssessmentReport(String(req.params.id));
    if (!report) return res.status(404).json({ success: false, error: 'Session not found' });
    res.json({ success: true, data: report });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
