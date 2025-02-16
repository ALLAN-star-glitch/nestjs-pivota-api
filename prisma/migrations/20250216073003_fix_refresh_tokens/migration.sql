/*
  Warnings:

  - You are about to drop the column `location` on the `RefreshToken` table. All the data in the column will be lost.
  - Made the column `device` on table `RefreshToken` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "RefreshToken_userId_key";

-- AlterTable
ALTER TABLE "RefreshToken" DROP COLUMN "location",
ALTER COLUMN "device" SET NOT NULL;
