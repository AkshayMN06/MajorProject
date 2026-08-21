import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

// Must run after authenticate — depends on req.user already being populated
// from a fresh DB read. Role is deliberately never carried in the JWT (see
// User.role in schema.prisma), so a promotion or demotion here takes effect
// on the very next request, without requiring the user to log in again.
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'ADMIN') {
    res.status(403).json({ success: false, error: 'Forbidden: admin access required' });
    return;
  }
  next();
}
