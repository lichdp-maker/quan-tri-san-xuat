-- CreateEnum
CREATE TYPE "LoaiYKien" AS ENUM ('VUONG_MAC', 'CAI_TIEN');

-- CreateEnum
CREATE TYPE "TrangThaiYKien" AS ENUM ('MOI', 'DANG_XU_LY', 'DA_XU_LY');

-- CreateTable
CREATE TABLE "YKien" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "loai" "LoaiYKien" NOT NULL,
    "noiDung" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "lineId" TEXT,
    "operationId" TEXT,
    "trangThai" "TrangThaiYKien" NOT NULL DEFAULT 'MOI',
    "phanHoi" TEXT,
    "xuLyBoiId" TEXT,
    "xuLyLuc" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YKien_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "YKien_trangThai_createdAt_idx" ON "YKien"("trangThai", "createdAt");

-- CreateIndex
CREATE INDEX "YKien_userId_createdAt_idx" ON "YKien"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "YKien" ADD CONSTRAINT "YKien_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YKien" ADD CONSTRAINT "YKien_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "Line"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YKien" ADD CONSTRAINT "YKien_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "Operation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YKien" ADD CONSTRAINT "YKien_xuLyBoiId_fkey" FOREIGN KEY ("xuLyBoiId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
