/*
  Warnings:

  - You are about to drop the column `groupId` on the `GroupMember` table. All the data in the column will be lost.
  - Added the required column `groupName` to the `GroupMember` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "GroupMember" DROP CONSTRAINT "GroupMember_groupId_fkey";

-- AlterTable
ALTER TABLE "GroupMember" DROP COLUMN "groupId",
ADD COLUMN     "groupName" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupName_fkey" FOREIGN KEY ("groupName") REFERENCES "Group"("name") ON DELETE RESTRICT ON UPDATE CASCADE;
