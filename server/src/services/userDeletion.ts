import { PrismaClient, Prisma } from '@prisma/client';

/**
 * Builds the ordered list of delete operations needed to fully remove a user
 * and every row that would otherwise be left dangling — every FK in this
 * schema is RESTRICT (no onDelete: Cascade anywhere), so child rows must be
 * deleted before their parents, in dependency order.
 *
 * Sessions are two-sided (Session.attackerId is required, defenderId
 * optional), and session-scoped child rows (Attempt/Event/Score/
 * AssessmentSnapshot/QuizAttempt) can belong to EITHER participant, not just
 * the user being deleted. Deleting only the target user's own rows and then
 * deleting the session would leave the other participant's rows still
 * pointing at a session that no longer exists, violating the FK constraint.
 * So for every session the target user touched, every child row of that
 * session — regardless of whose userId it carries — is deleted first, then
 * the session itself.
 */
export function buildUserDeletionOps(prisma: PrismaClient, userId: string): Prisma.PrismaPromise<any>[] {
  const sessionWhere = { OR: [{ attackerId: userId }, { defenderId: userId }] };

  return [
    // Quiz (Pre/Post-test) rows for sessions the user touched (both sides).
    prisma.quizResponse.deleteMany({ where: { attempt: { session: sessionWhere } } }),
    prisma.quizAttempt.deleteMany({ where: { session: sessionWhere } }),
    // Practice Labs is session-independent (own tables, own userId) — only
    // the target user's own rows are ever affected.
    prisma.practiceResponse.deleteMany({ where: { session: { userId } } }),
    prisma.practiceSession.deleteMany({ where: { userId } }),
    // Round-by-round and report rows for sessions the user touched (both sides).
    prisma.assessmentSnapshot.deleteMany({ where: { session: sessionWhere } }),
    prisma.event.deleteMany({ where: { session: sessionWhere } }),
    prisma.attempt.deleteMany({ where: { session: sessionWhere } }),
    prisma.score.deleteMany({ where: { session: sessionWhere } }),
    // Any quiz/score/assessment rows belonging to the user but NOT tied to a
    // session they were a participant of (legacy null-sessionId rows, or a
    // Score row with no sessionId) — a defensive catch-all so nothing of the
    // user's own is left behind even outside the session-cascade above.
    prisma.quizResponse.deleteMany({ where: { attempt: { userId } } }),
    prisma.quizAttempt.deleteMany({ where: { userId } }),
    prisma.score.deleteMany({ where: { userId } }),
    prisma.attempt.deleteMany({ where: { userId } }),
    prisma.assessmentSnapshot.deleteMany({ where: { userId } }),
    // Now safe to delete the sessions themselves — every child row is gone.
    prisma.session.deleteMany({ where: sessionWhere }),
    // Account-level rows with a direct, non-session FK to the user.
    prisma.recommendation.deleteMany({ where: { userId } }),
    prisma.analytics.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ];
}
