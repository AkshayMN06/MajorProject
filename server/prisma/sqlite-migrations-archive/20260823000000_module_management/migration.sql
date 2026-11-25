-- Teacher/Admin Module Management (CLIENT-002).
-- Extends modules with lifecycle (status DRAFT/PUBLISHED/ARCHIVED, deletedAt),
-- authoring metadata and creator; adds module_files for uploaded materials.
-- Existing rows are copied unchanged and default to status 'PUBLISHED', so the
-- predefined curriculum, its lessons and all lesson_progress stay as they are.

-- CreateTable
CREATE TABLE "module_files" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "moduleId" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "storedFileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "extractedText" TEXT,
    "processingStatus" TEXT NOT NULL,
    "processingNote" TEXT,
    "uploadedById" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "module_files_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "module_files_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

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
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
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
INSERT INTO "new_modules" ("category", "content", "description", "difficulty", "duration", "id", "name", "order", "type") SELECT "category", "content", "description", "difficulty", "duration", "id", "name", "order", "type" FROM "modules";
DROP TABLE "modules";
ALTER TABLE "new_modules" RENAME TO "modules";
CREATE INDEX "modules_status_idx" ON "modules"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "module_files_storedFileName_key" ON "module_files"("storedFileName");

-- CreateIndex
CREATE INDEX "module_files_moduleId_idx" ON "module_files"("moduleId");

