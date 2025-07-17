/*
  Warnings:

  - Added the required column `institutionId` to the `AllottedRooms` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AllottedRooms" ADD COLUMN     "institutionId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "AllottedRooms" ADD CONSTRAINT "AllottedRooms_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
