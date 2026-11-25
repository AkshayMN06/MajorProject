-- CLIENT-002 corrections: stable module origin (independent of the
-- nullable creator) and a database-enforced unique title among active
-- (non-archived) modules.

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_modules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "order" INTEGER NOT NULL,
    "origin" TEXT NOT NULL DEFAULT 'BUILTIN',
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "activeTitleKey" TEXT,
    "learningObjectives" TEXT,
    "thumbnailUrl" TEXT,
    "tags" JSONB,
    "referenceMaterials" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" DATETIME,
    "deletedAt" DATETIME,
    CONSTRAINT "modules_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_modules" ("category", "content", "createdAt", "createdById", "deletedAt", "description", "difficulty", "duration", "id", "learningObjectives", "name", "order", "publishedAt", "referenceMaterials", "status", "tags", "thumbnailUrl", "type", "updatedAt") SELECT "category", "content", "createdAt", "createdById", "deletedAt", "description", "difficulty", "duration", "id", "learningObjectives", "name", "order", "publishedAt", "referenceMaterials", "status", "tags", "thumbnailUrl", "type", "updatedAt" FROM "modules";
DROP TABLE "modules";
ALTER TABLE "new_modules" RENAME TO "modules";

-- Backfill origin. Every authored module was created with type 'custom',
-- so this also recovers authored modules whose creator account was deleted
-- (createdById already null).
UPDATE "modules" SET "origin" = 'AUTHORED' WHERE "type" = 'custom' OR "createdById" IS NOT NULL;

-- Backfill the active-title key for non-archived modules. If a legacy
-- database already holds duplicate active titles, only the earliest row of
-- each group gets the key (the others stay null, i.e. unconstrained) so the
-- unique index can be created without failing; rename those to bring them
-- under the rule.
UPDATE "modules" SET "activeTitleKey" = lower(trim("name"))
WHERE "status" <> 'ARCHIVED'
  AND "id" IN (SELECT MIN("id") FROM "modules" WHERE "status" <> 'ARCHIVED' GROUP BY lower(trim("name")));
CREATE UNIQUE INDEX "modules_activeTitleKey_key" ON "modules"("activeTitleKey");
CREATE INDEX "modules_status_idx" ON "modules"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

