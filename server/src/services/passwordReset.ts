import { PrismaClient } from '@prisma/client';

/**
 * Consumes a reset token and sets the new password in one transaction.
 * The token is claimed with a conditional update (unused + unexpired), so
 * of any number of concurrent submissions exactly one can win; if any later
 * write fails, the claim rolls back and the token stays usable.
 * Returns the user id on success, null for an invalid/used/expired token.
 */
export async function consumeResetToken(prisma: PrismaClient, tokenHash: string, hashedPassword: string) {
  return prisma.$transaction(async (tx) => {
    const resetToken = await tx.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!resetToken) return null;

    const now = new Date();
    const claimed = await tx.passwordResetToken.updateMany({
      where: { id: resetToken.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) return null;

    await tx.user.update({
      where: { id: resetToken.userId },
      data: { password: hashedPassword, failedLoginCount: 0, lockedUntil: null },
    });
    // Invalidate any other outstanding tokens for this user.
    await tx.passwordResetToken.updateMany({
      where: { userId: resetToken.userId, usedAt: null },
      data: { usedAt: now },
    });
    return resetToken.userId;
  });
}
