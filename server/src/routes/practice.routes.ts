import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { practiceStartSessionSchema, practiceSubmitSchema } from '../validation/practiceSchemas';
import { getModules, startSession, submitSession } from '../services/practiceEngine';

const router = Router();

router.use(authenticate);

// GET /api/practice/modules — same modules as Scenario Assessment
// (Scenario.category), no attacker/defender split.
router.get('/modules', async (_req: AuthRequest, res: Response) => {
  try {
    const data = await getModules();
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/practice/:module/session — selects one case study and one of
// its question pools, then returns the case study plus 8 randomly selected
// questions from that pool. This is purely a learning activity: nothing
// here writes to Score/Analytics/AssessmentSnapshot/Attempt/Event.
router.post('/:module/session', validate(practiceStartSessionSchema), async (req: AuthRequest, res: Response) => {
  try {
    const data = await startSession(req.user.id, String(req.params.module));
    res.status(201).json({ success: true, data });
  } catch (err: any) {
    res.status(err.status ?? 400).json({ success: false, error: err.message });
  }
});

// POST /api/practice/session/:sessionId/submit
router.post('/session/:sessionId/submit', validate(practiceSubmitSchema), async (req: AuthRequest, res: Response) => {
  try {
    const data = await submitSession(String(req.params.sessionId), req.user.id, req.body.responses);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(err.status ?? 400).json({ success: false, error: err.message });
  }
});

export default router;
