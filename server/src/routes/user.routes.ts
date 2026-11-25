import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AnalyticsEngine } from '../services/analyticsEngine';
import { buildUserDeletionOps } from '../services/userDeletion';

const prisma = new PrismaClient();
const router = Router();

router.use(authenticate);

const profileUpdate = z.object({
  name: z.string().optional(),
  usn: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  semester: z.number().int().nullable().optional(),
  college: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  preferredRole: z.string().nullable().optional(),
  timezone: z.string().nullable().optional(),
}).strict();

router.get('/:id', async (req: AuthRequest, res: Response) => {
  if (req.user.id !== req.params.id && req.user.role !== 'ADMIN') {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }
  try {
    const user = await prisma.user.findUnique({ where: { id: String(req.params.id) } });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    const { password, failedLoginCount, lockedUntil, ...profile } = user;
    res.json({ success: true, data: profile });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

async function updateProfile(req: AuthRequest, res: Response) {
  const data = profileUpdate.safeParse(req.body);
  if (!data.success) {
    return res.status(400).json({ success: false, error: 'Invalid profile fields' });
  }
  try {
    const user = await prisma.user.update({ where: { id: req.user.id }, data: data.data });
    const { password, failedLoginCount, lockedUntil, ...profile } = user;
    res.json({ success: true, data: profile });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

router.put('/me', updateProfile);
router.put('/:id', (req: AuthRequest, res: Response) => {
  if (req.user.id !== req.params.id) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }
  return updateProfile(req, res);
});

router.get('/:id/stats', async (req: AuthRequest, res: Response) => {
  if (req.user.id !== req.params.id && req.user.role !== 'ADMIN') {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }
  try {
    const summary = await AnalyticsEngine.getAnalyticsSummary(String(req.params.id));
    res.json({ success: true, data: summary });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/users/me — permanently delete the authenticated user's account
router.delete('/me', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, error: 'Password is required to delete your account' });
    }

    // Re-fetch user with password to verify
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(400).json({ success: false, error: 'Incorrect password. Account not deleted.' });
    }

    // Cascade delete all user data then the user record — see
    // userDeletion.ts for why this needs to be a full ordered cascade
    // rather than a handful of ad-hoc deleteMany calls (shared sessions,
    // RESTRICT-only FKs).
    await prisma.$transaction(buildUserDeletionOps(prisma, user.id));

    res.json({ success: true, message: 'Account permanently deleted.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
