-- CreateEnum
CREATE TYPE "SeatSide" AS ENUM ('A', 'B');

-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "seatId" TEXT;

-- CreateTable
CREATE TABLE "Line" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "soGhe" INTEGER NOT NULL DEFAULT 20,
    "teamId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "currentOrderId" TEXT,
    "shiftId" TEXT,

    CONSTRAINT "Line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Seat" (
    "id" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "side" "SeatSide" NOT NULL,
    "label" TEXT,
    "operationId" TEXT,

    CONSTRAINT "Seat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Line_code_key" ON "Line"("code");

-- CreateIndex
CREATE INDEX "Seat_lineId_idx" ON "Seat"("lineId");

-- CreateIndex
CREATE UNIQUE INDEX "Seat_lineId_side_seq_key" ON "Seat"("lineId", "side", "seq");

-- AddForeignKey
ALTER TABLE "Line" ADD CONSTRAINT "Line_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Line" ADD CONSTRAINT "Line_currentOrderId_fkey" FOREIGN KEY ("currentOrderId") REFERENCES "ProductionOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Line" ADD CONSTRAINT "Line_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seat" ADD CONSTRAINT "Seat_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "Line"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seat" ADD CONSTRAINT "Seat_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "Operation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "Seat"("id") ON DELETE SET NULL ON UPDATE CASCADE;
