/*
  Warnings:

  - A unique constraint covering the columns `[roomId]` on the table `AllottedRooms` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `roomId` to the `AllottedRooms` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AllottedRooms" ADD COLUMN     "roomId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "AllottedRooms_roomId_key" ON "AllottedRooms"("roomId");

-- AddForeignKey
ALTER TABLE "AllottedRooms" ADD CONSTRAINT "AllottedRooms_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
