/*
  Warnings:

  - A unique constraint covering the columns `[categoryId,planId]` on the table `CategoryRule` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "CategoryRule_categoryId_planId_key" ON "CategoryRule"("categoryId", "planId");
