import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { forgotPasswordSchema, resetPasswordSchema } from '../validation/authSchemas';
import { logSecurityEvent } from '../services/securityEventLogger';
import { sendPasswordResetEmail } from '../services/emailService';

const prisma = new PrismaClient();
const router = Router();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

// Applied only to /login and /register — brute-force/enumeration surfaces,
// not the rest of the API, which doesn't need it.
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please try again in a minute.' },
});

function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

router.post('/register', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password, name, usn, department, semester, college } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ success: false, error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name, usn, department, semester, college },
    });

    const token = jwt.sign({ id: user.id }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] });
    const { password: _, ...userWithoutPass } = user;

    res.status(201).json({ success: true, data: { user: userWithoutPass, token } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/login', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      await logSecurityEvent({ email, type: 'LOGIN_FAILURE', req });
      return res.status(400).json({ success: false, error: 'Invalid credentials' });
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      await logSecurityEvent({ userId: user.id, email, type: 'LOGIN_FAILURE', req });
      return res.status(423).json({
        success: false,
        error: 'Account temporarily locked. Try again later.',
        lockedUntil: user.lockedUntil,
      });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      const failedLoginCount = user.failedLoginCount + 1;
      const locking = failedLoginCount >= MAX_FAILED_ATTEMPTS;
      const lockedUntil = locking ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null;

      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: locking ? 0 : failedLoginCount, lockedUntil },
      });
      await logSecurityEvent({ userId: user.id, email, type: 'LOGIN_FAILURE', req });
      if (locking) {
        await logSecurityEvent({ userId: user.id, email, type: 'ACCOUNT_LOCKED', req });
        return res.status(423).json({
          success: false,
          error: 'Account temporarily locked. Try again later.',
          lockedUntil,
        });
      }
      return res.status(400).json({ success: false, error: 'Invalid credentials' });
    }

    if (user.failedLoginCount > 0 || user.lockedUntil) {
      await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
    }
    await logSecurityEvent({ userId: user.id, email, type: 'LOGIN_SUCCESS', req });

    const token = jwt.sign({ id: user.id }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] });
    const { password: _, ...userWithoutPass } = user;

    res.json({ success: true, data: { user: userWithoutPass, token } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ success: false });
  const { password, ...userWithoutPass } = req.user;
  res.json({ success: true, data: userWithoutPass });
});

router.put('/password', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!req.user) return res.status(401).json({ success: false });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ success: false });

    const valid = await bcrypt.compare(oldPassword, user.password);
    if (!valid) return res.status(400).json({ success: false, error: 'Invalid old password' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });
    await logSecurityEvent({ userId: user.id, email: user.email, type: 'PASSWORD_CHANGED', req });

    res.json({ success: true, message: 'Password updated' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/forgot-password — always returns the same generic success
// message regardless of whether the email matches an account, so this
// endpoint can never be used to enumerate registered emails.
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), async (req: Request, res: Response) => {
  const GENERIC_MESSAGE = 'If an account exists, a reset link has been sent.';
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashToken(rawToken);
      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
      });
      await logSecurityEvent({ userId: user.id, email, type: 'PASSWORD_RESET_REQUESTED', req });

      const resetLink = `${env.CLIENT_APP_URL}/reset-password?token=${rawToken}`;
      await sendPasswordResetEmail(email, resetLink);
    }

    res.json({ success: true, message: GENERIC_MESSAGE });
  } catch (err: any) {
    // Even on an unexpected error, don't leak whether the email existed.
    res.json({ success: true, message: GENERIC_MESSAGE });
  }
});

// POST /api/auth/reset-password — consumes a single-use token minted by
// forgot-password above.
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;
    const tokenHash = hashToken(token);

    const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!resetToken || resetToken.usedAt || resetToken.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({ success: false, error: 'This reset link is invalid or has expired.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.$transaction([
      prisma.user.update({ where: { id: resetToken.userId }, data: { password: hashedPassword, failedLoginCount: 0, lockedUntil: null } }),
      prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
      // Invalidate any other outstanding tokens for this user.
      prisma.passwordResetToken.updateMany({
        where: { userId: resetToken.userId, usedAt: null, id: { not: resetToken.id } },
        data: { usedAt: new Date() },
      }),
    ]);

    const user = await prisma.user.findUnique({ where: { id: resetToken.userId } });
    await logSecurityEvent({ userId: resetToken.userId, email: user?.email, type: 'PASSWORD_RESET_COMPLETED', req });

    res.json({ success: true, message: 'Password reset successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
