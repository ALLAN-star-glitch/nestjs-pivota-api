/*
  Warnings:

  - The `houseCondition` column on the `HouseAd` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[slug]` on the table `Category` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[slug]` on the table `HouseAd` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[slug]` on the table `Plan` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slug` to the `Category` table without a default value. This is not possible if the table is not empty.
  - Added the required column `planId` to the `CategoryRule` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slug` to the `HouseAd` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `houseType` on the `HouseAd` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `houseRentalCapacity` on the `HouseAd` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `slug` to the `Plan` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "HouseType" AS ENUM ('ROOM', 'APARTMENT', 'SHARED');

-- CreateEnum
CREATE TYPE "RentalCapacity" AS ENUM ('SINGLE_TENANT', 'FAMILY');

-- CreateEnum
CREATE TYPE "HouseCondition" AS ENUM ('NEW', 'USED', 'NEEDS_REPAIRS');

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_planId_fkey";

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "slug" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "CategoryRule" ADD COLUMN     "planId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "HouseAd" ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "slug" TEXT NOT NULL,
ADD COLUMN     "updatedBy" TEXT,
DROP COLUMN "houseType",
ADD COLUMN     "houseType" "HouseType" NOT NULL,
DROP COLUMN "houseRentalCapacity",
ADD COLUMN     "houseRentalCapacity" "RentalCapacity" NOT NULL,
DROP COLUMN "houseCondition",
ADD COLUMN     "houseCondition" "HouseCondition";

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "slug" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "PlanFeature" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT,

    CONSTRAINT "PlanFeature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "HouseAd_slug_key" ON "HouseAd"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_slug_key" ON "Plan"("slug");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryRule" ADD CONSTRAINT "CategoryRule_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanFeature" ADD CONSTRAINT "PlanFeature_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
