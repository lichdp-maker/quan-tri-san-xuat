-- CreateEnum
CREATE TYPE "TinhTrangNhanSu" AS ENUM ('DANG_LAM', 'TANG_CUONG', 'MUA_VU', 'NGHI_DAI_HAN', 'NGHI_VIEC');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "ghiChu" TEXT,
ADD COLUMN     "quyenBot" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "quyenThem" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "tinhTrang" "TinhTrangNhanSu" NOT NULL DEFAULT 'DANG_LAM';

-- CreateIndex
CREATE INDEX "User_tinhTrang_idx" ON "User"("tinhTrang");
