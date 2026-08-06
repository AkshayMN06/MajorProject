import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AnalyticsEngine } from '../services/analyticsEngine';

const prisma = new PrismaClient();
const router = Router();

router.use(authenticate);

// GET /api/users/:id — get user by ID
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    const { password, ...userWithoutPass } = user;
    res.json({ success: true, data: userWithoutPass });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/users/me — update the authenticated user's own profile
router.put('/me', async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const updateData = { ...req.body };
    // Strip fields that must never be updated via this endpoint
    delete updateData.password;
    delete updateData.id;
    delete updateData.email;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
    });

    const { password, ...userWithoutPass } = user;
    res.json({ success: true, data: userWithoutPass });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/users/:id — update user profile fields
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (req.user.id !== req.params.id) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    const updateData = { ...req.body };
    delete updateData.password;
    delete updateData.id;
    delete updateData.email;

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: updateData
    });
    
    const { password, ...userWithoutPass } = user;
    res.json({ success: true, data: userWithoutPass });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/users/:id/stats — get user analytics summary
router.get('/:id/stats', async (req: AuthRequest, res: Response) => {
  try {
    const summary = await AnalyticsEngine.getAnalyticsSummary(req.params.id);
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

    // Cascade delete all user data then the user record
    await prisma.$transaction([
      prisma.recommendation.deleteMany({ where: { userId: user.id } }),
      prisma.analytics.deleteMany({ where: { userId: user.id } }),
      prisma.score.deleteMany({ where: { userId: user.id } }),
      prisma.attempt.deleteMany({ where: { userId: user.id } }),
      prisma.session.deleteMany({
        where: { OR: [{ attackerId: user.id }, { defenderId: user.id }] }
      }),
      prisma.user.delete({ where: { id: user.id } }),
    ]);

    res.json({ success: true, message: 'Account permanently deleted.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
