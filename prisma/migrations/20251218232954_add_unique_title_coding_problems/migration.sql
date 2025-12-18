/*
  Warnings:

  - A unique constraint covering the columns `[title]` on the table `coding_problems` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "user_settings" ALTER COLUMN "defaultRounds" SET DEFAULT ARRAY['BEHAVIORAL', 'TECHNICAL', 'CODING']::TEXT[];

-- CreateIndex
CREATE UNIQUE INDEX "coding_problems_title_key" ON "coding_problems"("title");
