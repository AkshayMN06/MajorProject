-- CreateTable
CREATE TABLE "assessment_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "module" TEXT,
    "totalRounds" INTEGER NOT NULL,
    "finalScore" INTEGER NOT NULL,
    "accuracy" REAL NOT NULL,
    "correctRounds" INTEGER NOT NULL,
    "incorrectRounds" INTEGER NOT NULL,
    "averageTime" REAL NOT NULL,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "assessment_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "assessment_snapshots_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
