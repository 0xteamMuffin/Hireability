/*
  Warnings:

  - You are about to drop the column `jobLink` on the `target_companies` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "target_companies" DROP COLUMN "jobLink",
ADD COLUMN     "websiteLink" TEXT;
