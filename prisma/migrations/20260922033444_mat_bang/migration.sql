-- CreateEnum
CREATE TYPE "LoaiViTri" AS ENUM ('CHUYEN', 'BAN', 'MAY');

-- AlterTable
ALTER TABLE "Line" ADD COLUMN     "cao" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "loai" "LoaiViTri" NOT NULL DEFAULT 'CHUYEN',
ADD COLUMN     "rong" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "tang" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "viTriX" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "viTriY" INTEGER NOT NULL DEFAULT 5;

-- CreateTable
CREATE TABLE "LineOperation" (
    "id" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LineOperation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LineOperation_lineId_idx" ON "LineOperation"("lineId");

-- CreateIndex
CREATE UNIQUE INDEX "LineOperation_lineId_operationId_key" ON "LineOperation"("lineId", "operationId");

-- CreateIndex
CREATE INDEX "Line_tang_isActive_idx" ON "Line"("tang", "isActive");

-- AddForeignKey
ALTER TABLE "LineOperation" ADD CONSTRAINT "LineOperation_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "Line"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineOperation" ADD CONSTRAINT "LineOperation_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "Operation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
