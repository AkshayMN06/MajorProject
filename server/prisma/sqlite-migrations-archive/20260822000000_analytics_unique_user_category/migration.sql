-- One aggregate row per (userId, category).
--
-- Legacy databases can hold duplicate rows for the same pair: the old
-- read-then-create writer could race on a learner's first attempt in a
-- category. Fold each duplicate group into its lowest-id row before adding
-- the unique index, so no recorded attempt is dropped:
--   totalAttempts / correctAttempts : summed
--   averageTime                     : attempt-weighted mean
--   accuracy                        : recomputed from the summed counts
--   lastUpdated                     : latest of the group
-- Increments lost to the old read-modify-write race are not recoverable
-- from this table; see the FIX-006 notes for reconciling from attempts.

UPDATE "analytics" AS a SET
    "totalAttempts"   = g.total,
    "correctAttempts" = g.correct,
    "averageTime"     = CASE WHEN g.total > 0 THEN g.timeSum / g.total ELSE 0 END,
    "accuracy"        = CASE WHEN g.total > 0 THEN g.correct * 100.0 / g.total ELSE 0 END,
    "lastUpdated"     = g.lastUpdated
FROM (
    SELECT "userId", "category",
           MIN("id")                             AS keepId,
           SUM("totalAttempts")                  AS total,
           SUM("correctAttempts")                AS correct,
           SUM("averageTime" * "totalAttempts")  AS timeSum,
           MAX("lastUpdated")                    AS lastUpdated
    FROM "analytics"
    GROUP BY "userId", "category"
    HAVING COUNT(*) > 1
) AS g
WHERE a."id" = g.keepId;

DELETE FROM "analytics"
WHERE "id" NOT IN (SELECT MIN("id") FROM "analytics" GROUP BY "userId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_userId_category_key" ON "analytics"("userId", "category");
