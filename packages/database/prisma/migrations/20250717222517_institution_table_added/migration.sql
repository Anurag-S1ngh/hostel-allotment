/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `Hostel` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `instituteId` to the `Admin` table without a default value. This is not possible if the table is not empty.
  - Added the required column `institutionId` to the `Admin` table without a default value. This is not possible if the table is not empty.
  - Added the required column `institutionId` to the `Group` table without a default value. This is not possible if the table is not empty.
  - Added the required column `institute` to the `Hostel` table without a default value. This is not possible if the table is not empty.
  - Added the required column `institutionId` to the `Hostel` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `name` on the `Hostel` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `institutionId` to the `Student` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Admin" ADD COLUMN     "instituteId" TEXT NOT NULL,
ADD COLUMN     "institutionId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "institutionId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Hostel" ADD COLUMN     "institute" TEXT NOT NULL,
ADD COLUMN     "institutionId" TEXT NOT NULL,
DROP COLUMN "name",
ADD COLUMN     "name" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "institutionId" TEXT NOT NULL;

-- DropEnum
DROP TYPE "HostelName";

-- CreateTable
CREATE TABLE "Institution" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Institution_name_key" ON "Institution"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Hostel_name_key" ON "Hostel"("name");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hostel" ADD CONSTRAINT "Hostel_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
