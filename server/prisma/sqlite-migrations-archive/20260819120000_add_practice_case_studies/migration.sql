-- Practice Labs v2: case-study/question-pool hierarchy. The existing
-- practice_* tables hold only dev-seed mock data (250 flat questions, a
-- handful of test sessions) which seedPractice.ts fully regenerates anyway,
-- so this drops and recreates them against the new shape rather than
-- attempting a complex in-place migration for disposable content.

-- DropTable (FK-dependent order: responses -> sessions/questions)
DROP TABLE IF EXISTS "practice_responses";
DROP TABLE IF EXISTS "practice_sessions";
DROP TABLE IF EXISTS "practice_questions";

-- CreateTable
CREATE TABLE "case_studies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "module" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "practice_question_pools" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseStudyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "practice_question_pools_caseStudyId_fkey" FOREIGN KEY ("caseStudyId") REFERENCES "case_studies" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "practice_questions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "poolId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "optionA" TEXT NOT NULL,
    "optionB" TEXT NOT NULL,
    "optionC" TEXT NOT NULL,
    "optionD" TEXT NOT NULL,
    "correctOption" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "topicTag" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'Easy',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "practice_questions_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "practice_question_pools" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "practice_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "caseStudyId" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "questionIds" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "score" INTEGER,
    "totalQuestions" INTEGER NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "practice_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "practice_sessions_caseStudyId_fkey" FOREIGN KEY ("caseStudyId") REFERENCES "case_studies" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "practice_sessions_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "practice_question_pools" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "practice_responses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedOption" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "practice_responses_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "practice_sessions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "practice_responses_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "practice_questions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "practice_responses_sessionId_questionId_key" ON "practice_responses"("sessionId", "questionId");
