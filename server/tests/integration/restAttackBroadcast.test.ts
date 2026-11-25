import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { IncomingMessage, ServerResponse } from 'http';
import { Socket } from 'net';

// POST /api/attack must push the same events as the submitAttack socket
// event: an Individual-as-attacker round resolves immediately, so the room
// gets ruleProcessed + roundCompleted; a Collaborative attack gets
// attackSubmitted. Real router, auth and broadcast helper; in-process, no port.
const mocks = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  submitAttack: vi.fn(),
  emitted: [] as Array<{ room: string; event: string; payload: any }>,
}));

vi.mock('@prisma/client', () => ({ PrismaClient: vi.fn(() => ({ user: mocks.user })) }));
vi.mock('../../src/services/sessionActions', () => ({
  submitAttack: mocks.submitAttack,
  submitDefense: vi.fn(),
  markReady: vi.fn(),
  advanceRound: vi.fn(),
  getRoomState: vi.fn(),
  finalizeCompletedAssessment: vi.fn(),
}));
vi.mock('../../src/socket', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/socket')>();
  const io = { to: (room: string) => ({ emit: (event: string, payload: any) => mocks.emitted.push({ room, event, payload }) }) };
  return { ...actual, getIO: () => io };
});

import { env } from '../../src/config/env';
import actionRoutes from '../../src/routes/action.routes';

const app = express();
app.use(express.json());
app.use('/api', actionRoutes);

function post(path: string, body: unknown): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const req = new IncomingMessage(new Socket());
    const payload = JSON.stringify(body);
    req.method = 'POST';
    req.url = path;
    req.headers = {
      authorization: `Bearer ${jwt.sign({ id: 'u1' }, env.JWT_SECRET)}`,
      'content-type': 'application/json',
      'content-length': String(Buffer.byteLength(payload)),
    };
    req.push(payload);
    req.push(null);
    const res = new ServerResponse(req);
    res.end = ((chunk?: any) => {
      resolve({ status: res.statusCode, body: JSON.parse(String(chunk)) });
      return res;
    }) as any;
    (app as any)(req, res, reject);
  });
}

const attack = { sessionId: 's1', attackOptionId: 'a1', attackOptionName: 'A', attackOptionDescription: 'd', status: 'DEFENSE_SELECTION' };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.emitted.length = 0;
  mocks.user.findUnique.mockResolvedValue({ id: 'u1', name: 'U1' });
});

describe('POST /api/attack broadcast parity', () => {
  it('Individual attacker: pushes ruleProcessed then roundCompleted (not attackSubmitted)', async () => {
    const roundResult = { roundNumber: 1, outcome: 'breached', explanation: 'Why.', attackerTotalScore: 40 };
    mocks.submitAttack.mockResolvedValue({ ...attack, roundResult });

    const { status, body } = await post('/api/attack', { sessionId: 's1', attackOptionId: 'a1' });

    expect(status).toBe(200);
    expect(body.data.roundResult).toEqual(roundResult); // response unchanged
    expect(mocks.emitted.map((e) => [e.room, e.event])).toEqual([
      ['s1', 'ruleProcessed'],
      ['s1', 'roundCompleted'],
    ]);
    expect(mocks.emitted[0].payload).toEqual({ sessionId: 's1', outcome: 'breached', explanation: 'Why.' });
    expect(mocks.emitted[1].payload).toEqual(roundResult);
  });

  it('Collaborative attacker: pushes attackSubmitted only', async () => {
    mocks.submitAttack.mockResolvedValue(attack);

    const { status } = await post('/api/attack', { sessionId: 's1', attackOptionId: 'a1' });

    expect(status).toBe(200);
    expect(mocks.emitted).toEqual([{ room: 's1', event: 'attackSubmitted', payload: attack }]);
  });

  it('a rejected attack emits nothing', async () => {
    mocks.submitAttack.mockRejectedValue(new Error('Not in attack selection phase'));
    const { status } = await post('/api/attack', { sessionId: 's1', attackOptionId: 'a1' });
    expect(status).toBe(400);
    expect(mocks.emitted).toEqual([]);
  });
});
