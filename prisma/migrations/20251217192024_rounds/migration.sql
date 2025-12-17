-- CreateEnum
CREATE TYPE "RoundType" AS ENUM ('BEHAVIORAL', 'TECHNICAL', 'CODING', 'SYSTEM_DESIGN', 'HR');

-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- AlterTable
ALTER TABLE "interviews" ADD COLUMN     "roundOrder" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "roundType" "RoundType" NOT NULL DEFAULT 'BEHAVIORAL',
ADD COLUMN     "sessionId" TEXT,
ADD COLUMN     "status" "InterviewStatus" NOT NULL DEFAULT 'NOT_STARTED';

-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN     "defaultRounds" TEXT[] DEFAULT ARRAY['BEHAVIORAL', 'TECHNICAL']::TEXT[],
ADD COLUMN     "multiRoundEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "interview_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetId" TEXT,
    "status" "SessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "currentRound" INTEGER NOT NULL DEFAULT 1,
    "totalRounds" INTEGER NOT NULL DEFAULT 2,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_rounds" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "interviewId" TEXT,
    "roundType" "RoundType" NOT NULL,
    "order" INTEGER NOT NULL,
    "status" "InterviewStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "problemId" TEXT,
    "codeSubmission" TEXT,
    "codeLanguage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coding_problems" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "category" TEXT NOT NULL,
    "starterCode" JSONB,
    "testCases" JSONB,
    "hints" TEXT[],
    "solution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coding_problems_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "interview_rounds" ADD CONSTRAINT "interview_rounds_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "interview_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
