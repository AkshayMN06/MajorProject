import { Request } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type SecurityEventType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'ACCOUNT_LOCKED'
  | 'PASSWORD_CHANGED'
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_RESET_COMPLETED';

export interface LogSecurityEventInput {
  userId?: string | null;
  email?: string | null;
  type: SecurityEventType;
  req: Request;
}

// Mirrors EventLogger's style (eventLogger.ts) — a thin, fire-and-forget
// write, never in the critical path of the auth flow it's called from.
export async function logSecurityEvent({ userId, email, type, req }: LogSecurityEventInput) {
  return prisma.securityEvent.create({
    data: {
      userId: userId ?? null,
      email: email ?? null,
      type,
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    },
  });
}
