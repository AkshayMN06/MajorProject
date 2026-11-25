import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from './auth';

const prisma = new PrismaClient();

/**
 * Only a session's own attacker/defender may read its data (details, round
 * results, reports, CSV exports). Sends 404/403 and returns null when the
 * caller may not proceed. In SOLO mode the human is both attacker and
 * defender, so either check admits them.
 */
export async function authorizeSessionAccess(req: AuthRequest, res: Response, sessionId: string) {
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
