import { describe, it, expect, vi } from 'vitest';
import { requireAdmin } from '../../src/middleware/requireAdmin';

function fakeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('requireAdmin middleware', () => {
  it('403s a normal user without calling next()', () => {
    const req: any = { user: { id: 'u1', role: 'USER' } };
    const res = fakeRes();
    const next = vi.fn();

    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Forbidden: admin access required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() for an admin user without writing any response', () => {
    const req: any = { user: { id: 'u1', role: 'ADMIN' } };
    const res = fakeRes();
    const next = vi.fn();

    requireAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('403s rather than crashing when req.user is undefined', () => {
    const req: any = {};
    const res = fakeRes();
    const next = vi.fn();

    expect(() => requireAdmin(req, res, next)).not.toThrow();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('403s any non-ADMIN role string, not just "USER"', () => {
    const req: any = { user: { id: 'u1', role: 'SOMETHING_ELSE' } };
    const res = fakeRes();
    const next = vi.fn();

    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
