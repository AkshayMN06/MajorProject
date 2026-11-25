import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import { IncomingMessage, ServerResponse } from 'http';
import { Socket } from 'net';

// Forgot-password delivery: nothing secret in logs when SMTP is off, real
// delivery through a stubbed transport when it's on, and one generic
// response regardless of whether the account exists or the flow fails.
const mocks = vi.hoisted(() => ({
  sendMail: vi.fn(),
  createTransport: vi.fn(),
  prisma: {
    user: { findUnique: vi.fn() },
    passwordResetToken: { create: vi.fn() },
    securityEvent: { create: vi.fn() },
  },
}));

vi.mock('nodemailer', () => ({ default: { createTransport: mocks.createTransport } }));
vi.mock('@prisma/client', () => ({ PrismaClient: vi.fn(() => mocks.prisma) }));

import { env } from '../../src/config/env';
import authRoutes from '../../src/routes/auth.routes';

const EMAIL = 'learner@example.invalid';
const GENERIC = { success: true, message: 'If an account exists, a reset link has been sent.' };

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

// In-process request on an unconnected socket — no port bound.
function post(path: string, body: unknown): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const socket = new Socket();
    Object.defineProperty(socket, 'remoteAddress', { value: '127.0.0.1' });
    const req = new IncomingMessage(socket);
    const payload = JSON.stringify(body);
    req.method = 'POST';
    req.url = path;
    req.headers = { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(payload)) };
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

let logged: string[];

beforeEach(() => {
  vi.clearAllMocks();
  logged = [];
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: any[]) => { logged.push(args.map(String).join(' ')); });
  }
  mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail });
  mocks.sendMail.mockResolvedValue({});
  mocks.prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: EMAIL });
  mocks.prisma.passwordResetToken.create.mockResolvedValue({});
  mocks.prisma.securityEvent.create.mockResolvedValue({});
});

afterEach(() => {
  vi.restoreAllMocks();
});

function issuedRawToken(): string {
  // The route stores only sha256(raw); recover raw from the link it built.
  const call = mocks.sendMail.mock.calls[0]?.[0];
  return call ? /token=([0-9a-f]+)/.exec(call.text)![1] : '';
}

describe('forgot-password with SMTP disabled', () => {
  it('logs neither the reset link, the token nor the recipient', async () => {
    env.SMTP_HOST = '';
    const { body } = await post('/api/auth/forgot-password', { email: EMAIL });
    expect(body).toEqual(GENERIC);
    expect(mocks.prisma.passwordResetToken.create).toHaveBeenCalledTimes(1);
    expect(mocks.sendMail).not.toHaveBeenCalled();
    const all = logged.join('\n');
    expect(all).not.toMatch(/reset-password|token=|[0-9a-f]{64}/);
    expect(all).not.toContain(EMAIL);
  });
});

describe('forgot-password with SMTP configured (stub transport)', () => {
  beforeEach(() => { env.SMTP_HOST = 'smtp.stub.invalid'; });
  afterEach(() => { env.SMTP_HOST = ''; });

  it('sends the link to the account address and logs nothing secret', async () => {
    const { body } = await post('/api/auth/forgot-password', { email: EMAIL });
    expect(body).toEqual(GENERIC);
    expect(mocks.sendMail).toHaveBeenCalledTimes(1);
    const mail = mocks.sendMail.mock.calls[0][0];
    expect(mail.to).toBe(EMAIL);
    expect(mail.text).toContain(`${env.CLIENT_APP_URL}/reset-password?token=`);
    const raw = issuedRawToken();
    expect(raw).toMatch(/^[0-9a-f]{64}$/);
    // Only the hash is persisted, never the raw token.
    const stored = mocks.prisma.passwordResetToken.create.mock.calls[0][0].data;
    expect(stored.tokenHash).not.toBe(raw);
    expect(logged.join('\n')).not.toContain(raw);
  });

  it('returns the identical generic response for an unknown email and sends nothing', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(null);
    const { status, body } = await post('/api/auth/forgot-password', { email: 'nobody@example.invalid' });
    expect(status).toBe(200);
    expect(body).toEqual(GENERIC);
    expect(mocks.sendMail).not.toHaveBeenCalled();
    expect(mocks.prisma.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it('returns the identical generic response when delivery fails', async () => {
    mocks.sendMail.mockRejectedValue(new Error('smtp down'));
    const { status, body } = await post('/api/auth/forgot-password', { email: EMAIL });
    expect(status).toBe(200);
    expect(body).toEqual(GENERIC);
  });
});
