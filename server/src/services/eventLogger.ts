import { PrismaClient } from '@prisma/client';
import { Outcome } from '../../../shared/types';

const prisma = new PrismaClient();

export interface EventData {
  turnId: number;
  sessionId: string;
  scenarioId: string;
  attackerChoice: string;
  defenderChoice: string;
  resolvedRule: string;
  outcome: Outcome;
  score: number;
  timeTaken: number;
  timestamp: string;
}

export class EventLogger {
  static async logEvent(data: EventData) {
    return prisma.event.create({
      data: {
        turnId: data.turnId,
        sessionId: data.sessionId,
        scenarioId: data.scenarioId,
        attackerChoice: data.attackerChoice,
        defenderChoice: data.defenderChoice,
        resolvedRule: data.resolvedRule,
        outcome: data.outcome,
        score: data.score,
        timeTaken: data.timeTaken,
      },
    });
  }

  static async getSessionEvents(sessionId: string) {
    return prisma.event.findMany({
      where: { sessionId },
      orderBy: { turnId: 'asc' },
    });
  }

  static async getUserEvents(userId: string, limit?: number) {
    return prisma.event.findMany({
      where: {
        session: {
          OR: [
            { attackerId: userId },
            { defenderId: userId },
          ],
        },
      },
      orderBy: { timestamp: 'desc' },
      ...(limit && { take: limit }),
    });
  }
}
