/*
  Warnings:

  - You are about to drop the column `correctConcepts` on the `scores` table. All the data in the column will be lost.
  - You are about to drop the column `correctDefenses` on the `scores` table. All the data in the column will be lost.
  - Added the required column `correctChoice` to the `scores` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_scores" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'defender',
    "roundNumber" INTEGER,
    "totalScore" INTEGER NOT NULL,
    "correctChoice" INTEGER NOT NULL,
    "configuration" INTEGER NOT NULL DEFAULT 0,
    "reasoning" INTEGER NOT NULL DEFAULT 0,
    "timeEfficiency" INTEGER NOT NULL,
    "consistency" INTEGER NOT NULL,
    "repeatedMistakes" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "scores_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "scores_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_scores" ("consistency", "createdAt", "id", "repeatedMistakes", "sessionId", "timeEfficiency", "totalScore", "userId") SELECT "consistency", "createdAt", "id", "repeatedMistakes", "sessionId", "timeEfficiency", "totalScore", "userId" FROM "scores";
DROP TABLE "scores";
ALTER TABLE "new_scores" RENAME TO "scores";
CREATE TABLE "new_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionCode" TEXT,
    "attackerId" TEXT NOT NULL,
    "defenderId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'WAITING_FOR_PARTICIPANT',
    "difficulty" TEXT,
    "module" TEXT,
    "currentScenarioIndex" INTEGER NOT NULL DEFAULT 0,
    "totalScenarios" INTEGER NOT NULL DEFAULT 5,
    "attackerReady" BOOLEAN NOT NULL DEFAULT false,
    "defenderReady" BOOLEAN NOT NULL DEFAULT false,
    "scenarioIds" JSONB,
    "attackerScore" INTEGER NOT NULL DEFAULT 0,
    "defenderScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "sessions_attackerId_fkey" FOREIGN KEY ("attackerId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "sessions_defenderId_fkey" FOREIGN KEY ("defenderId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_sessions" ("attackerId", "completedAt", "createdAt", "currentScenarioIndex", "defenderId", "id", "status", "totalScenarios") SELECT "attackerId", "completedAt", "createdAt", "currentScenarioIndex", "defenderId", "id", "status", "totalScenarios" FROM "sessions";
DROP TABLE "sessions";
ALTER TABLE "new_sessions" RENAME TO "sessions";
CREATE UNIQUE INDEX "sessions_sessionCode_key" ON "sessions"("sessionCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
