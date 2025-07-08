/*
  Warnings:

  - A unique constraint covering the columns `[studentId]` on the table `AllottedRooms` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "AllottedRooms_studentId_key" ON "AllottedRooms"("studentId");
