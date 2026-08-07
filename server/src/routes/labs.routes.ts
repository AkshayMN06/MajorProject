import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { chatSchema } from '../validation/labsSchemas';
import { chatWithTutor } from '../services/aiTutorService';

const router = Router();

router.use(authenticate);

// POST /api/labs/chat — AI Tutor for Practice Labs. Explains attacks,
// defenses, and CyberLearn's own scenarios, and answers general
// cybersecurity terminology questions.
router.post('/chat', validate(chatSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { message, history } = req.body;
    const reply = await chatWithTutor(message, history ?? []);
    res.json({ success: true, data: { reply } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
