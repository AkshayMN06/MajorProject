import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import { validate } from '../middleware/validate';
import { adminAnalyticsQuerySchema, adminUsersQuerySchema, adminExportQuerySchema } from '../validation/adminSchemas';
import {
  fetchCompletedPairs,
  computeOverall,
  computeModuleSummary,
  computeDifficultySummary,
  computePairMath,
  type CompletedPairFilters,
} from '../services/adminAnalytics';

const prisma = new PrismaClient();
const router = Router();

router.use(authenticate);
router.use(requireAdmin);

function handleError(res: Response, err: any) {
  const status = typeof err.status === 'number' ? err.status : 500;
  res.status(status).json({ success: false, error: err.message });
}

// validate() only checks shape (discards the coerced result), so parsing
// query values into real types happens here, same convention as every other
// route file in this codebase (e.g. quiz.routes.ts's `String(req.query...)`).
function parseFilters(req: AuthRequest): CompletedPairFilters {
  const filters: CompletedPairFilters = {};
  if (typeof req.query.module === 'string' && req.query.module) filters.module = req.query.module;
  if (typeof req.query.difficulty === 'string' && req.query.difficulty) filters.difficulty = req.query.difficulty;
  if (typeof req.query.startDate === 'string' && req.query.startDate) filters.startDate = new Date(req.query.startDate);
  if (typeof req.query.endDate === 'string' && req.query.endDate) filters.endDate = new Date(req.query.endDate);
  return filters;
}

// GET /api/admin/stats — global, unfiltered summary cards.
router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const [totalUsers, pairs] = await Promise.all([prisma.user.count(), fetchCompletedPairs(prisma)]);
    const overall = computeOverall(pairs);
    res.json({ success: true, data: { totalUsers, ...overall } });
  } catch (err: any) {
    handleError(res, err);
  }
});

// GET /api/admin/analytics?module=&difficulty=&startDate=&endDate=
// One fetch feeds overall/rows/moduleSummary/difficultySummary — they
// cannot drift apart from each other or from the Excel export, which uses
// the exact same fetch + pure functions.
router.get('/analytics', validate(adminAnalyticsQuerySchema), async (req: AuthRequest, res: Response) => {
  try {
    const filters = parseFilters(req);
    const pairs = await fetchCompletedPairs(prisma, filters);
    const overall = computeOverall(pairs);
    const moduleSummary = computeModuleSummary(pairs);
    const difficultySummary = computeDifficultySummary(pairs);
    const rows = pairs
      .map((p) => {
        const math = computePairMath(p);
        return {
          sessionId: p.sessionId,
          userId: p.userId,
          userName: p.userName,
          userEmail: p.userEmail,
          moduleTag: p.moduleTag,
          difficulty: p.difficulty,
          preScore: p.preScore,
          preTotal: p.preTotal,
          postScore: p.postScore,
          postTotal: p.postTotal,
          ...math,
          completedAt: p.postCompletedAt,
        };
      })
      .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
    res.json({ success: true, data: { overall, rows, moduleSummary, difficultySummary } });
  } catch (err: any) {
    handleError(res, err);
  }
});

// GET /api/admin/users?search=&page=&pageSize= — server-side paginated,
// never loads the full user table into one response.
router.get('/users', validate(adminUsersQuerySchema), async (req: AuthRequest, res: Response) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));

    // Prisma's SQLite connector doesn't support `mode: 'insensitive'`; SQLite's
    // own LIKE (which `contains` compiles to) is already ASCII-case-insensitive.
    const where = search ? { OR: [{ name: { contains: search } }, { email: { contains: search } }] } : undefined;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          _count: { select: { quizAttempts: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        users: users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          createdAt: u.createdAt,
          quizAttemptCount: u._count.quizAttempts,
        })),
        total,
        page,
        pageSize,
      },
    });
  } catch (err: any) {
    handleError(res, err);
  }
});

// GET /api/admin/export?module=&difficulty=&startDate=&endDate= — a real
// .xlsx built from the same fetch + pure functions as /analytics, so the
// downloaded numbers can never disagree with what the dashboard shows.
router.get('/export', validate(adminExportQuerySchema), async (req: AuthRequest, res: Response) => {
  try {
    const filters = parseFilters(req);
    const [totalUsers, pairs] = await Promise.all([prisma.user.count(), fetchCompletedPairs(prisma, filters)]);
    const overall = computeOverall(pairs);
    const moduleSummary = computeModuleSummary(pairs);
    const difficultySummary = computeDifficultySummary(pairs);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CyberLearn Admin Dashboard';
    workbook.created = new Date();

    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 32 },
      { header: 'Value', key: 'value', width: 20 },
    ];
    summarySheet.addRows([
      { metric: 'Total Users', value: totalUsers },
      { metric: 'Total Assessment Attempts', value: overall.pairCount },
      { metric: 'Average Pre-Test Score', value: `${overall.avgPrePct}%` },
      { metric: 'Average Post-Test Score', value: `${overall.avgPostPct}%` },
      { metric: 'Average Improvement', value: `${overall.avgImprovementPP >= 0 ? '+' : ''}${overall.avgImprovementPP} pp` },
      { metric: 'Improved Attempts', value: overall.improved },
      { metric: 'Unchanged Attempts', value: overall.unchanged },
      { metric: 'Decreased Attempts', value: overall.decreased },
    ]);
    summarySheet.getRow(1).font = { bold: true };

    const userSheet = workbook.addWorksheet('User Results');
    userSheet.columns = [
      { header: 'User Name', key: 'userName', width: 22 },
      { header: 'Email', key: 'userEmail', width: 28 },
      { header: 'Session ID', key: 'sessionId', width: 26 },
      { header: 'Module', key: 'moduleTag', width: 20 },
      { header: 'Difficulty', key: 'difficulty', width: 14 },
      { header: 'Pre-Test Score', key: 'preScoreLabel', width: 14 },
      { header: 'Pre-Test %', key: 'prePct', width: 12 },
      { header: 'Post-Test Score', key: 'postScoreLabel', width: 14 },
      { header: 'Post-Test %', key: 'postPct', width: 12 },
      { header: 'Improvement (pp)', key: 'ppImprovement', width: 16 },
      { header: 'Improvement (raw)', key: 'rawImprovement', width: 16 },
      { header: 'Assessment Date', key: 'date', width: 18 },
    ];
    for (const p of pairs) {
      const math = computePairMath(p);
      userSheet.addRow({
        userName: p.userName,
        userEmail: p.userEmail,
        sessionId: p.sessionId,
        moduleTag: p.moduleTag ?? 'Not Available',
        difficulty: p.difficulty ?? 'Not Available',
        preScoreLabel: `${p.preScore}/${p.preTotal}`,
        prePct: `${math.prePct}%`,
        postScoreLabel: `${p.postScore}/${p.postTotal}`,
        postPct: `${math.postPct}%`,
        ppImprovement: `${math.ppImprovement >= 0 ? '+' : ''}${math.ppImprovement} pp`,
        rawImprovement: math.rawImprovement >= 0 ? `+${math.rawImprovement}` : `${math.rawImprovement}`,
        date: p.postCompletedAt.toISOString().slice(0, 10),
      });
    }
    userSheet.getRow(1).font = { bold: true };

    const moduleSheet = workbook.addWorksheet('Module Summary');
    moduleSheet.columns = [
      { header: 'Module', key: 'category', width: 22 },
      { header: 'Attempts', key: 'attempts', width: 12 },
      { header: 'Average Pre-Test', key: 'avgPrePct', width: 16 },
      { header: 'Average Post-Test', key: 'avgPostPct', width: 16 },
      { header: 'Average Improvement', key: 'avgImprovementPP', width: 18 },
    ];
    for (const m of moduleSummary) {
      moduleSheet.addRow({
        category: m.category,
        attempts: m.attempts,
        avgPrePct: `${m.avgPrePct}%`,
        avgPostPct: `${m.avgPostPct}%`,
        avgImprovementPP: `${m.avgImprovementPP >= 0 ? '+' : ''}${m.avgImprovementPP} pp`,
      });
    }
    moduleSheet.getRow(1).font = { bold: true };

    const difficultySheet = workbook.addWorksheet('Difficulty Summary');
    difficultySheet.columns = [
      { header: 'Difficulty', key: 'category', width: 16 },
      { header: 'Attempts', key: 'attempts', width: 12 },
      { header: 'Average Pre-Test', key: 'avgPrePct', width: 16 },
      { header: 'Average Post-Test', key: 'avgPostPct', width: 16 },
      { header: 'Average Improvement', key: 'avgImprovementPP', width: 18 },
    ];
    for (const d of difficultySummary) {
      difficultySheet.addRow({
        category: d.category,
        attempts: d.attempts,
        avgPrePct: `${d.avgPrePct}%`,
        avgPostPct: `${d.avgPostPct}%`,
        avgImprovementPP: `${d.avgImprovementPP >= 0 ? '+' : ''}${d.avgImprovementPP} pp`,
      });
    }
    difficultySheet.getRow(1).font = { bold: true };

    // Build fully in memory rather than streaming — a mid-serialization
    // error can't be turned into a clean JSON error response once headers
    // are already committed by a stream.
    const buffer = await workbook.xlsx.writeBuffer();

    const dateStamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="admin-report-${dateStamp}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (err: any) {
    handleError(res, err);
  }
});

export default router;
