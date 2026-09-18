'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { batBuocDangNhap } from '@/lib/session'

const KY_THUAT = ['ENGINEER', 'SHOP_MANAGER', 'DEPUTY_DIRECTOR', 'DIRECTOR'] as const

/**
 * Sửa định mức của một nguyên công.
 * Lệnh ĐANG CHẠY không bị ảnh hưởng: mỗi lệnh đã chụp lại định mức lúc phát hành
 * (OrderOperation.standardSeconds). Thay đổi ở đây chỉ áp dụng cho lệnh phát hành sau này.
 */
export async function suaDinhMuc(formData: FormData): Promise<void> {
  const u = await batBuocDangNhap(...KY_THUAT)

  const id = String(formData.get('id') ?? '')
  const giay = Number(String(formData.get('standardSeconds') ?? ''))
  const nguong = Number(String(formData.get('targetPercent') ?? '100'))
  const conDung = formData.get('isActive') === 'on'
  if (!id || !Number.isFinite(giay) || giay < 0 || giay > 100000) return
  if (!Number.isFinite(nguong) || nguong < 50 || nguong > 300) return

  const cu = await prisma.operation.findUnique({ where: { id } })
  if (!cu) return

  await prisma.operation.update({
    where: { id },
    data: { standardSeconds: giay, targetPercent: nguong, isActive: conDung },
  })

  await prisma.auditLog.create({
    data: {
      userId: u.id,
      action: 'SUA_DINH_MUC',
      entityType: 'Operation',
      entityId: id,
      before: { standardSeconds: cu.standardSeconds, targetPercent: cu.targetPercent, isActive: cu.isActive },
      after: { standardSeconds: giay, targetPercent: nguong, isActive: conDung },
    },
  })

  revalidatePath('/ky-thuat')
}

export async function themNguyenCong(formData: FormData): Promise<void> {
  const u = await batBuocDangNhap(...KY_THUAT)

  const sectionId = String(formData.get('sectionId') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const giay = Number(String(formData.get('standardSeconds') ?? ''))
  const detail = String(formData.get('detail') ?? '').trim()
  const isQC = formData.get('isQC') === 'on'
  if (!sectionId || !name || !Number.isFinite(giay) || giay < 0) return

  const section = await prisma.productSection.findUnique({
    where: { id: sectionId },
    include: { operations: { orderBy: { seq: 'desc' }, take: 1 } },
  })
  if (!section) return

  const seq = (section.operations[0]?.seq ?? 0) + 10
  const op = await prisma.operation.create({
    data: {
      sectionId,
      seq,
      code: `${section.code}-${String(seq / 10).padStart(2, '0')}`,
      name,
      detail: detail || null,
      standardSeconds: giay,
      isQC,
    },
  })

  await prisma.auditLog.create({
    data: {
      userId: u.id,
      action: 'THEM_NGUYEN_CONG',
      entityType: 'Operation',
      entityId: op.id,
      after: { name, standardSeconds: giay },
    },
  })

  revalidatePath('/ky-thuat')
}

export async function themSanPham(formData: FormData): Promise<void> {
  const u = await batBuocDangNhap(...KY_THUAT)

  const code = String(formData.get('code') ?? '').trim().toUpperCase()
  const name = String(formData.get('name') ?? '').trim()
  const unit = String(formData.get('unit') ?? 'sp').trim() || 'sp'
  const isKit = formData.get('isKit') === 'on'
  if (!code || !name) return
  if (await prisma.product.findUnique({ where: { code } })) return

  const p = await prisma.product.create({ data: { code, name, unit, isKit } })
  // Sản phẩm đơn thì tạo sẵn một bộ phận duy nhất để có chỗ thêm nguyên công
  if (!isKit) {
    await prisma.productSection.create({
      data: { productId: p.id, code, name: 'Toàn bộ nguyên công', seq: 10 },
    })
  }

  await prisma.auditLog.create({
    data: { userId: u.id, action: 'THEM_SAN_PHAM', entityType: 'Product', entityId: p.id, after: { code, name } },
  })

  revalidatePath('/ky-thuat')
}

export async function themBoPhan(formData: FormData): Promise<void> {
  const u = await batBuocDangNhap(...KY_THUAT)

  const productId = String(formData.get('productId') ?? '')
  const code = String(formData.get('code') ?? '').trim().toUpperCase()
  const name = String(formData.get('name') ?? '').trim()
  const bongGoi = formData.get('dependsOnAllSections') === 'on'
  if (!productId || !code || !name) return

  const daCo = await prisma.productSection.findMany({
    where: { productId },
    orderBy: { seq: 'desc' },
    take: 1,
  })

  const s = await prisma.productSection.create({
    data: {
      productId,
      code,
      name,
      seq: (daCo[0]?.seq ?? 0) + 10,
      dependsOnAllSections: bongGoi,
    },
  })

  await prisma.auditLog.create({
    data: { userId: u.id, action: 'THEM_BO_PHAN', entityType: 'ProductSection', entityId: s.id, after: { code, name } },
  })

  revalidatePath('/ky-thuat')
}

/** Kỹ thuật xác định nguyên nhân và hướng xử lý cho một phiếu lỗi. */
export async function xuLyPhieuLoi(formData: FormData): Promise<void> {
  const u = await batBuocDangNhap(...KY_THUAT, 'TEAM_LEADER')

  const id = String(formData.get('id') ?? '')
  const causeId = String(formData.get('causeId') ?? '')
  const disposition = String(formData.get('disposition') ?? '')
  const note = String(formData.get('engineerNote') ?? '').trim()
  const hopLe = ['REWORK', 'SCRAP', 'USE_AS_IS', 'RETURN_SUPPLIER', 'PENDING']
  if (!id || !hopLe.includes(disposition)) return

  await prisma.defectRecord.update({
    where: { id },
    data: {
      causeId: causeId || null,
      disposition: disposition as 'REWORK' | 'SCRAP' | 'USE_AS_IS' | 'RETURN_SUPPLIER' | 'PENDING',
      engineerNote: note || null,
      resolvedById: disposition === 'PENDING' ? null : u.id,
      resolvedAt: disposition === 'PENDING' ? null : new Date(),
    },
  })

  await prisma.auditLog.create({
    data: {
      userId: u.id,
      action: 'XU_LY_PHIEU_LOI',
      entityType: 'DefectRecord',
      entityId: id,
      after: { causeId, disposition },
    },
  })

  revalidatePath('/ky-thuat')
}
