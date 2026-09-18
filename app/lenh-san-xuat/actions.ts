'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { batBuocDangNhap } from '@/lib/session'

const DUOC_TAO = ['PLANNER', 'SHOP_MANAGER', 'DEPUTY_DIRECTOR', 'DIRECTOR'] as const

/**
 * Tạo lệnh sản xuất và sinh danh sách nguyên công của lệnh.
 * Định mức được CHỤP LẠI tại thời điểm phát lệnh, nên sau này kỹ thuật sửa định mức
 * cũng không làm thay đổi cách tính năng suất của lệnh đang chạy.
 */
export async function taoLenh(formData: FormData): Promise<void> {
  const u = await batBuocDangNhap(...DUOC_TAO)

  const code = String(formData.get('code') ?? '').trim().toUpperCase()
  const productId = String(formData.get('productId') ?? '')
  const quantity = Number(String(formData.get('quantity') ?? '0'))
  const dueDate = String(formData.get('dueDate') ?? '').trim()
  const note = String(formData.get('note') ?? '').trim()

  if (!code || !productId || !Number.isFinite(quantity) || quantity <= 0) return
  const trung = await prisma.productionOrder.findUnique({ where: { code } })
  if (trung) return

  const product = await prisma.product.findUniqueOrThrow({
    where: { id: productId },
    include: {
      sections: {
        where: { isActive: true },
        orderBy: { seq: 'asc' },
        include: { operations: { where: { isActive: true }, orderBy: { seq: 'asc' } } },
      },
    },
  })

  await prisma.$transaction(async (tx) => {
    const order = await tx.productionOrder.create({
      data: {
        code,
        productId,
        quantity,
        dueDate: dueDate ? new Date(`${dueDate}T00:00:00.000+07:00`) : null,
        note: note || null,
        status: 'RELEASED',
        releasedAt: new Date(),
        createdById: u.id,
      },
    })

    for (const s of product.sections) {
      for (const o of s.operations) {
        await tx.orderOperation.create({
          data: {
            orderId: order.id,
            operationId: o.id,
            sectionCode: s.code,
            seq: o.seq,
            targetQty: quantity,
            standardSeconds: o.standardSeconds,
          },
        })
      }
    }

    await tx.auditLog.create({
      data: {
        userId: u.id,
        action: 'TAO_LENH',
        entityType: 'ProductionOrder',
        entityId: order.id,
        after: { code, quantity },
      },
    })
  })

  revalidatePath('/lenh-san-xuat')
}

export async function doiTrangThai(formData: FormData): Promise<void> {
  const u = await batBuocDangNhap(...DUOC_TAO)
  const id = String(formData.get('id') ?? '')
  const trangThai = String(formData.get('status') ?? '')
  if (!id || !['IN_PROGRESS', 'COMPLETED', 'CLOSED', 'CANCELLED'].includes(trangThai)) return

  await prisma.productionOrder.update({
    where: { id },
    data: {
      status: trangThai as 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED' | 'CANCELLED',
      closedAt: trangThai === 'CLOSED' ? new Date() : undefined,
    },
  })

  await prisma.auditLog.create({
    data: {
      userId: u.id,
      action: 'DOI_TRANG_THAI_LENH',
      entityType: 'ProductionOrder',
      entityId: id,
      after: { status: trangThai },
    },
  })

  revalidatePath('/lenh-san-xuat')
}
