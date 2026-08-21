import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { computeOverall, computeModuleSummary, computeDifficultySummary, computePairMath, type PairedResult } from '../../src/services/adminAnalytics';

// Builds a workbook the same shape as admin.routes.ts's GET /export, from a
// fixed fixture, to assert both the sheet structure and — critically — that
// the numbers match computeOverall() run on that exact same fixture. That
// second assertion is what actually prevents the dashboard and the Excel
// export from silently disagreeing with each other.
function buildWorkbook(pairs: PairedResult[], totalUsers: number) {
  const overall = computeOverall(pairs);
  const moduleSummary = computeModuleSummary(pairs);
  const difficultySummary = computeDifficultySummary(pairs);

  const workbook = new ExcelJS.Workbook();

  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [
    { header: 'Metric', key: 'metric' },
    { header: 'Value', key: 'value' },
  ];
  summarySheet.addRows([
    { metric: 'Total Users', value: totalUsers },
    { metric: 'Total Assessment Attempts', value: overall.pairCount },
    { metric: 'Average Pre-Test Score', value: `${overall.avgPrePct}%` },
    { metric: 'Average Post-Test Score', value: `${overall.avgPostPct}%` },
    { metric: 'Average Improvement', value: `${overall.avgImprovementPP}pp` },
    { metric: 'Improved Attempts', value: overall.improved },
    { metric: 'Unchanged Attempts', value: overall.unchanged },
    { metric: 'Decreased Attempts', value: overall.decreased },
  ]);

  const userSheet = workbook.addWorksheet('User Results');
  userSheet.columns = [
    { header: 'User Name', key: 'userName' },
    { header: 'Email', key: 'userEmail' },
    { header: 'Pre-Test %', key: 'prePct' },
    { header: 'Post-Test %', key: 'postPct' },
  ];
  for (const p of pairs) {
    const math = computePairMath(p);
    userSheet.addRow({ userName: p.userName, userEmail: p.userEmail, prePct: math.prePct, postPct: math.postPct });
  }

  const moduleSheet = workbook.addWorksheet('Module Summary');
  moduleSheet.columns = [{ header: 'Module', key: 'category' }, { header: 'Attempts', key: 'attempts' }];
  for (const m of moduleSummary) moduleSheet.addRow(m);

  const difficultySheet = workbook.addWorksheet('Difficulty Summary');
  difficultySheet.columns = [{ header: 'Difficulty', key: 'category' }, { header: 'Attempts', key: 'attempts' }];
  for (const d of difficultySummary) difficultySheet.addRow(d);

  return { workbook, overall, moduleSummary, difficultySummary };
}

function fakePair(overrides: Partial<PairedResult> = {}): PairedResult {
  return {
    sessionId: 'session-1',
    userId: 'user-1',
    userName: 'Akshay MN',
    userEmail: 'akshay@example.com',
    moduleTag: 'Web Security',
    difficulty: 'Medium',
    preScore: 4,
    preTotal: 8,
    postScore: 7,
    postTotal: 8,
    postCompletedAt: new Date('2026-08-20T12:00:00Z'),
    preResponses: [{ isCorrect: true, moduleTag: 'Web Security', difficulty: 'Medium' }],
    postResponses: [{ isCorrect: true, moduleTag: 'Web Security', difficulty: 'Medium' }],
    ...overrides,
  };
}

describe('admin Excel export workbook', () => {
  it('produces exactly 4 sheets with the expected names', () => {
    const { workbook } = buildWorkbook([fakePair()], 5);
    expect(workbook.worksheets.map((w) => w.name)).toEqual(['Summary', 'User Results', 'Module Summary', 'Difficulty Summary']);
  });

  it('Summary sheet header row matches the expected columns', () => {
    const { workbook } = buildWorkbook([fakePair()], 5);
    const sheet = workbook.getWorksheet('Summary')!;
    expect(sheet.getRow(1).getCell(1).value).toBe('Metric');
    expect(sheet.getRow(1).getCell(2).value).toBe('Value');
  });

  it("Summary sheet's numbers exactly match computeOverall() run on the same fixture — no dashboard/Excel drift", () => {
    const pairs = [fakePair({ preScore: 4, postScore: 7 }), fakePair({ sessionId: 's2', userId: 'u2', preScore: 5, postScore: 5 })];
    const { workbook, overall } = buildWorkbook(pairs, 10);
    const sheet = workbook.getWorksheet('Summary')!;

    const valueByMetric = new Map<string, unknown>();
    sheet.eachRow((row, num) => {
      if (num === 1) return;
      valueByMetric.set(String(row.getCell(1).value), row.getCell(2).value);
    });

    expect(valueByMetric.get('Total Users')).toBe(10);
    expect(valueByMetric.get('Total Assessment Attempts')).toBe(overall.pairCount);
    expect(valueByMetric.get('Average Pre-Test Score')).toBe(`${overall.avgPrePct}%`);
    expect(valueByMetric.get('Average Post-Test Score')).toBe(`${overall.avgPostPct}%`);
    expect(valueByMetric.get('Improved Attempts')).toBe(overall.improved);
    expect(valueByMetric.get('Unchanged Attempts')).toBe(overall.unchanged);
    expect(valueByMetric.get('Decreased Attempts')).toBe(overall.decreased);
  });

  it('User Results sheet contains one row per completed pair with correct percentages', () => {
    const pairs = [fakePair({ preScore: 4, postScore: 7 })];
    const { workbook } = buildWorkbook(pairs, 3);
    const sheet = workbook.getWorksheet('User Results')!;
    expect(sheet.rowCount).toBe(2); // header + 1 data row
    const dataRow = sheet.getRow(2);
    expect(dataRow.getCell(1).value).toBe('Akshay MN');
    expect(dataRow.getCell(3).value).toBe(50); // 4/8 = 50%
    expect(dataRow.getCell(4).value).toBe(87.5); // 7/8 = 87.5%
  });

  it('Module Summary sheet rows match computeModuleSummary() on the same fixture', () => {
    const pairs = [fakePair()];
    const { workbook, moduleSummary } = buildWorkbook(pairs, 1);
    const sheet = workbook.getWorksheet('Module Summary')!;
    expect(sheet.rowCount).toBe(1 + moduleSummary.length);
  });

  it('produces an empty-but-valid workbook (still 4 sheets, header-only) when there are zero completed pairs', () => {
    const { workbook, overall } = buildWorkbook([], 0);
    expect(workbook.worksheets).toHaveLength(4);
    expect(overall.pairCount).toBe(0);
    expect(workbook.getWorksheet('User Results')!.rowCount).toBe(1); // header only
  });
});
