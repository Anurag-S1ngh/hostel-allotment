/*
  Warnings:

  - You are about to drop the column `groupName` on the `GroupMember` table. All the data in the column will be lost.
  - Added the required column `groupId` to the `GroupMember` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "GroupMember" DROP CONSTRAINT "GroupMember_groupName_fkey";

-- AlterTable
ALTER TABLE "GroupMember" DROP COLUMN "groupName",
ADD COLUMN     "groupId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
