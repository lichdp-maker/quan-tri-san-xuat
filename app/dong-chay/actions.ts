'use server'

import { revalidatePath } from 'next/cache'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { batBuocDangNhap } from '@/lib/session'

const DUOC_SUA = ['ENGINEER', 'SHOP_MANAGER', 'DEPUTY_DIRECTOR', 'DIRECTOR'] as const

export type KetQua = { ok?: boolean; loi?: string }

/**
 * Đánh số lại toàn bộ nguyên công của một bộ phận.
 * Làm hai vòng (âm rồi dương) vì cặp (bộ phận, thứ tự) là duy nhất trong CSDL.
 * Nguyên công đã bỏ được đẩy xuống cuối để không chiếm mất số thứ tự.
 */
async function danhSoLai(
  tx: Prisma.TransactionClient,
  sectionId: string,
  thuTuDangDung: string[],
) {
  const tatCa = await tx.operation.findMany({
    where: { sectionId },
    select: { id: true, seq: true, isActive: true },
    orderBy: { seq: 'asc' },
  })
  const conLai = tatCa.filter((o) => !thuTuDangDung.includes(o.id)).map((o) => o.id)
  const day = [...thuTuDangDung, ...conLai]

  for (const [i, id] of day.entries()) {
    await tx.operation.update({ where: { id }, data: { seq: -(i + 1) } })
  }
  for (const [i, id] of day.entries()) {
    await tx.operation.update({ where: { id }, data: { seq: i + 1 } })
  }
}

/** Đổi thứ tự nguyên công trong một bộ phận — dùng khi kéo thả hoặc bấm mũi tên. */
export async function doiThuTuNguyenCong(sectionId: string, thuTu: string[]): Promise<KetQua> {
  const u = await batBuocDangNhap(...DUOC_SUA)
  if (!sectionId || thuTu.length === 0) return { loi: 'Thiếu dữ liệu để đổi thứ tự.' }

  const thuoc = await prisma.operation.count({ where: { sectionId, id: { in: thuTu } } })
  if (thuoc !== thuTu.length) return { loi: 'Có nguyên công không thuộc bộ phận này.' }

  await prisma.$transaction(
    async (tx) => {
      await danhSoLai(tx, sectionId, thuTu)
      await tx.auditLog.create({
        data: {
          userId: u.id,
          action: 'DOI_THU_TU_NGUYEN_CONG',
          entityType: 'ProductSection',
          entityId: sectionId,
          after: { thuTu },
        },
      })
    },
    { timeout: 30000, maxWait: 15000 },
  )

  revalidatePath('/dong-chay')
  revalidatePath('/ky-thuat')
  return { ok: true }
}

/** Thêm một nguyên công mới vào cuối bộ phận. */
export async function themNguyenCong(input: {
  sectionId: string
  name: string
  giay: number
  detail?: string
  isQC?: boolean
}): Promise<KetQua> {
  const u = await batBuocDangNhap(...DUOC_SUA)

  const name = input.name.trim()
  const giay = Math.round(Number(input.giay))
  if (!name) return { loi: 'Chưa nhập tên nguyên công.' }
  if (!Number.isFinite(giay) || giay <= 0 || giay > 36000) {
    return { loi: 'Định mức phải là số giây lớn hơn 0.' }
  }

  const section = await prisma.productSection.findUnique({
    where: { id: input.sectionId },
    include: { product: true },
  })
  if (!section) return { loi: 'Không tìm thấy bộ phận.' }

  const cuoi = await prisma.operation.findFirst({
    where: { sectionId: section.id },
    orderBy: { seq: 'desc' },
    select: { seq: true },
  })
  const soMoi = (cuoi?.seq ?? 0) + 1

  // Mã nguyên công giữ nguyên suốt đời, không đánh lại khi đổi thứ tự
  const daCo = new Set(
    (await prisma.operation.findMany({ where: { sectionId: section.id }, select: { code: true } })).map(
      (o) => o.code,
    ),
  )
  let n = soMoi
  let code = `${section.code}-${String(n).padStart(2, '0')}`
  while (daCo.has(code)) {
    n++
    code = `${section.code}-${String(n).padStart(2, '0')}`
  }

  const op = await prisma.operation.create({
    data: {
      sectionId: section.id,
      seq: soMoi,
      code,
      name,
      detail: input.detail?.trim() || null,
      standardSeconds: giay,
      isQC: !!input.isQC,
    },
  })

  await prisma.auditLog.create({
    data: {
      userId: u.id,
      action: 'THEM_NGUYEN_CONG',
      entityType: 'Operation',
      entityId: op.id,
      after: { code, name, giay, sectionId: section.id },
    },
  })

  revalidatePath('/dong-chay')
  revalidatePath('/ky-thuat')
  return { ok: true }
}

/** Sửa một nguyên công. Đổi bộ phận thì nguyên công được đưa xuống cuối bộ phận mới. */
export async function suaNguyenCong(input: {
  id: string
  name?: string
  giay?: number
  detail?: string | null
  targetPercent?: number
  isQC?: boolean
  sectionId?: string
}): Promise<KetQua> {
  const u = await batBuocDangNhap(...DUOC_SUA)

  const cu = await prisma.operation.findUnique({ where: { id: input.id } })
  if (!cu) return { loi: 'Không tìm thấy nguyên công.' }

  const data: Record<string, unknown> = {}
  if (input.name !== undefined) {
    const t = input.name.trim()
    if (!t) return { loi: 'Tên nguyên công không được để trống.' }
    data.name = t
  }
  if (input.giay !== undefined) {
    const g = Math.round(Number(input.giay))
    if (!Number.isFinite(g) || g <= 0 || g > 36000) return { loi: 'Định mức phải là số giây lớn hơn 0.' }
    data.standardSeconds = g
  }
  if (input.detail !== undefined) data.detail = input.detail?.trim() || null
  if (input.targetPercent !== undefined) {
    const p = Math.round(Number(input.targetPercent))
    if (!Number.isFinite(p) || p < 50 || p > 200) return { loi: 'Ngưỡng đạt phải từ 50 đến 200%.' }
    data.targetPercent = p
  }
  if (input.isQC !== undefined) data.isQC = !!input.isQC

  // Chuyển sang bộ phận khác: xuống cuối bộ phận mới
  if (input.sectionId && input.sectionId !== cu.sectionId) {
    const moi = await prisma.productSection.findUnique({ where: { id: input.sectionId } })
    if (!moi) return { loi: 'Bộ phận đích không tồn tại.' }
    const cuoi = await prisma.operation.findFirst({
      where: { sectionId: moi.id },
      orderBy: { seq: 'desc' },
      select: { seq: true },
    })
    data.sectionId = moi.id
    data.seq = (cuoi?.seq ?? 0) + 1
  }

  await prisma.operation.update({ where: { id: cu.id }, data })
  await prisma.auditLog.create({
    data: {
      userId: u.id,
      action: 'SUA_NGUYEN_CONG',
      entityType: 'Operation',
      entityId: cu.id,
      before: { name: cu.name, standardSeconds: cu.standardSeconds, sectionId: cu.sectionId },
      after: data as object,
    },
  })

  // Đổi bộ phận xong thì bộ phận cũ bị hụt số — đánh số lại cho liền mạch
  if (data.sectionId) {
    const conLai = await prisma.operation.findMany({
      where: { sectionId: cu.sectionId, isActive: true },
      orderBy: { seq: 'asc' },
      select: { id: true },
    })
    await prisma.$transaction(
      async (tx) => danhSoLai(tx, cu.sectionId, conLai.map((o) => o.id)),
      { timeout: 30000, maxWait: 15000 },
    )
  }

  revalidatePath('/dong-chay')
  revalidatePath('/ky-thuat')
  return { ok: true }
}

/**
 * Bỏ một nguyên công khỏi dòng chảy.
 * Nguyên công đã từng nằm trong lệnh sản xuất thì chỉ đánh dấu ngừng dùng,
 * để số liệu cũ của lệnh đó không bị mất.
 */
export async function boNguyenCong(id: string): Promise<KetQua> {
  const u = await batBuocDangNhap(...DUOC_SUA)

  const op = await prisma.operation.findUnique({
    where: { id },
    include: { _count: { select: { orderOperations: true, seats: true } } },
  })
  if (!op) return { loi: 'Không tìm thấy nguyên công.' }
  if (op._count.seats > 0) {
    return { loi: 'Nguyên công này đang gán cho vị trí ngồi trên dây chuyền. Gỡ khỏi sơ đồ trước đã.' }
  }

  if (op._count.orderOperations === 0) {
    await prisma.operation.delete({ where: { id } })
  } else {
    await prisma.operation.update({ where: { id }, data: { isActive: false } })
  }

  const conLai = await prisma.operation.findMany({
    where: { sectionId: op.sectionId, isActive: true, id: { not: id } },
    orderBy: { seq: 'asc' },
    select: { id: true },
  })
  await prisma.$transaction(
    async (tx) => danhSoLai(tx, op.sectionId, conLai.map((o) => o.id)),
    { timeout: 30000, maxWait: 15000 },
  )

  await prisma.auditLog.create({
    data: {
      userId: u.id,
      action: op._count.orderOperations === 0 ? 'XOA_NGUYEN_CONG' : 'NGUNG_NGUYEN_CONG',
      entityType: 'Operation',
      entityId: id,
      before: { code: op.code, name: op.name },
    },
  })

  revalidatePath('/dong-chay')
  revalidatePath('/ky-thuat')
  return { ok: true }
}

/** Dùng lại một nguyên công đã ngừng. */
export async function dungLaiNguyenCong(id: string): Promise<KetQua> {
  const u = await batBuocDangNhap(...DUOC_SUA)
  const op = await prisma.operation.findUnique({ where: { id } })
  if (!op) return { loi: 'Không tìm thấy nguyên công.' }

  await prisma.operation.update({ where: { id }, data: { isActive: true } })
  await prisma.auditLog.create({
    data: { userId: u.id, action: 'DUNG_LAI_NGUYEN_CONG', entityType: 'Operation', entityId: id },
  })

  revalidatePath('/dong-chay')
  return { ok: true }
}

/** Thêm một bộ phận mới cho sản phẩm (nhánh mới của dòng chảy). */
export async function themBoPhan(input: {
  productId: string
  code: string
  name: string
  phuThuocTatCa?: boolean
}): Promise<KetQua> {
  const u = await batBuocDangNhap(...DUOC_SUA)

  const code = input.code.trim().toUpperCase()
  const name = input.name.trim()
  if (!code || !name) return { loi: 'Thiếu mã hoặc tên bộ phận.' }

  const trung = await prisma.productSection.findUnique({
    where: { productId_code: { productId: input.productId, code } },
  })
  if (trung) return { loi: `Sản phẩm đã có bộ phận mã ${code}.` }

  const cuoi = await prisma.productSection.findFirst({
    where: { productId: input.productId },
    orderBy: { seq: 'desc' },
    select: { seq: true },
  })

  const s = await prisma.productSection.create({
    data: {
      productId: input.productId,
      code,
      name,
      seq: (cuoi?.seq ?? 0) + 10,
      dependsOnAllSections: !!input.phuThuocTatCa,
    },
  })

  await prisma.auditLog.create({
    data: { userId: u.id, action: 'THEM_BO_PHAN', entityType: 'ProductSection', entityId: s.id, after: { code, name } },
  })

  revalidatePath('/dong-chay')
  return { ok: true }
}
