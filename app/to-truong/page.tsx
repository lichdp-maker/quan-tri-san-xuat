import { redirect } from 'next/navigation'
import Link from 'next/link'
import { nguoiDangDangNhap, TEN_VAI_TRO } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ngayHomNay, ngayLamViec, gioHienTai, dinhDangNgay } from '@/lib/date'
import { coQuyen } from '@/lib/chuc-nang'
import { Header } from '@/components/Header'
import { duyetBanGhi, tuChoiBanGhi } from './actions'

export const dynamic = 'force-dynamic'


export default async function TrangToTruong() {
  const u = await nguoiDangDangNhap()
  if (!u) redirect('/dang-nhap')
  if (!coQuyen(u.quyen, 'CHOT_SO')) redirect('/')

  const ymd = ngayHomNay()
  const workDate = ngayLamViec(ymd)
  const gio = gioHienTai()
  const locTo = u.role === 'TEAM_LEADER' ? { teamId: u.teamId ?? '' } : {}

  const [choDuyet, phanCong, lenhDangChay] = await Promise.all([
    prisma.productionEntry.findMany({
      where: { workDate, status: 'PENDING', assignment: locTo },
      include: {
        timeSlot: true,
        assignment: {
          include: {
            user: true,
            orderOperation: { include: { operation: true, order: true } },
          },
        },
      },
      orderBy: [{ timeSlot: { seq: 'asc' } }, { createdAt: 'asc' }],
    }),
    prisma.assignment.findMany({
      where: { workDate, ...locTo },
      include: {
        user: true,
        shift: { include: { timeSlots: { where: { isActive: true }, orderBy: { seq: 'asc' } } } },
        orderOperation: { include: { operation: true, order: true } },
        entries: { select: { timeSlotId: true } },
      },
    }),
    prisma.productionOrder.findMany({
      where: { status: { in: ['RELEASED', 'IN_PROGRESS'] } },
      include: {
        product: true,
        operations: { orderBy: [{ sectionCode: 'asc' }, { seq: 'asc' }] },
      },
      orderBy: { priority: 'desc' },
    }),
  ])

  // Ai chưa nhập ở các mốc đã qua
  const chuaNhap: Array<{ moc: string; ten: string; nguyenCong: string }> = []
  for (const a of phanCong) {
    for (const s of a.shift.timeSlots) {
      if (s.endTime > gio) continue // mốc chưa kết thúc thì chưa tính là trễ
      if (!a.entries.some((e) => e.timeSlotId === s.id)) {
        chuaNhap.push({
          moc: s.label,
          ten: a.user.fullName,
          nguyenCong: a.orderOperation.operation.name,
        })
      }
    }
  }

  // Nút thắt: nguyên công làm vượt nguyên công liền trước trong cùng bộ phận
  const nutThat: string[] = []
  for (const lenh of lenhDangChay) {
    let truoc: (typeof lenh.operations)[number] | null = null
    for (const oo of lenh.operations) {
      if (truoc && truoc.sectionCode === oo.sectionCode && oo.doneQtyOk > truoc.doneQtyOk) {
        nutThat.push(
          `Lệnh ${lenh.code}: nguyên công sau đang nhiều hơn nguyên công trước (${oo.doneQtyOk} so với ${truoc.doneQtyOk}) — kiểm tra lại số liệu.`,
        )
      }
      truoc = oo
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-5">
      <Header
        tieuDe="Chốt số · Phân công"
        phu={`${u.fullName} · ${TEN_VAI_TRO[u.role]} · ${dinhDangNgay(ymd)} · ${gio}`}
        nguoiDung={u}
        them={
          <Link href="/to-truong/phan-cong" className="nut-nho">
            Phân công
          </Link>
        }
      />

      <div className="mb-5 grid grid-cols-3 gap-3">
        <ThongSo nhan="Phân công hôm nay" giaTri={phanCong.length} />
        <ThongSo nhan="Chờ duyệt" giaTri={choDuyet.length} nhanManh={choDuyet.length > 0} />
        <ThongSo nhan="Chưa chốt số" giaTri={chuaNhap.length} nhanManh={chuaNhap.length > 0} />
      </div>

      {nutThat.map((c) => (
        <p key={c} className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {c}
        </p>
      ))}

      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Bản ghi chờ duyệt</h2>
          {choDuyet.length > 0 && (
            <form action={duyetBanGhi}>
              {choDuyet.map((e) => (
                <input key={e.id} type="hidden" name="id" value={e.id} />
              ))}
              <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white">
                Duyệt tất cả ({choDuyet.length})
              </button>
            </form>
          )}
        </div>

        {choDuyet.length === 0 ? (
          <p className="the text-sm text-slate-500">Không còn bản ghi nào chờ duyệt.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {choDuyet.map((e) => {
              const ns = e.performance === null ? null : Number(e.performance)
              return (
                <div key={e.id} className="the flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="min-w-[10rem] flex-1">
                    <p className="font-medium leading-tight">{e.assignment.user.fullName}</p>
                    <p className="text-xs text-slate-500">
                      {e.timeSlot.label} · {e.assignment.orderOperation.operation.name} · lệnh{' '}
                      {e.assignment.orderOperation.order.code}
                    </p>
                  </div>

                  <div className="text-sm tabular-nums">
                    <span className="font-semibold">{e.qtyOk}</span> đạt
                    {e.qtyDefect > 0 && (
                      <span className="text-red-600"> · {e.qtyDefect} hỏng</span>
                    )}
                    <span className="text-slate-500">
                      {' '}
                      · {e.workedMinutes}′
                      {e.downtimeMinutes > 0 && ` (dừng ${e.downtimeMinutes}′)`}
                    </span>
                  </div>

                  <div className="text-sm tabular-nums">
                    {ns === null ? (
                      <span className="text-slate-400">chưa xếp loại</span>
                    ) : (
                      <span className={e.isAchieved ? 'text-emerald-600' : 'text-amber-600'}>
                        {ns}% {e.isAchieved ? 'đạt' : 'chưa đạt'}
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <form action={duyetBanGhi}>
                      <input type="hidden" name="id" value={e.id} />
                      <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white">
                        Duyệt
                      </button>
                    </form>
                    <form action={tuChoiBanGhi}>
                      <input type="hidden" name="id" value={e.id} />
                      <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600">
                        Trả lại
                      </button>
                    </form>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">Chưa chốt số</h2>
        {chuaNhap.length === 0 ? (
          <p className="the text-sm text-slate-500">Mọi người đã nhập đủ các mốc đã qua.</p>
        ) : (
          <div className="the flex flex-col gap-1 text-sm">
            {chuaNhap.map((c, i) => (
              <p key={i}>
                <span className="inline-block w-16 font-medium">{c.moc}</span>
                {c.ten} — {c.nguyenCong}
              </p>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Tiến độ lệnh đang chạy</h2>
        {lenhDangChay.length === 0 ? (
          <p className="the text-sm text-slate-500">Chưa có lệnh nào được phát hành.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {lenhDangChay.map((l) => {
              const cuoi = l.operations.at(-1)
              const xong = cuoi?.doneQtyOk ?? 0
              const pct = l.quantity > 0 ? Math.round((xong / l.quantity) * 100) : 0
              return (
                <div key={l.id} className="the">
                  <div className="flex items-baseline justify-between">
                    <p className="font-medium">
                      {l.code} · {l.product.name}
                    </p>
                    <p className="text-sm tabular-nums text-slate-600">
                      {xong}/{l.quantity} ({pct}%)
                    </p>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full bg-brand-600" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}

function ThongSo({
  nhan,
  giaTri,
  nhanManh,
}: {
  nhan: string
  giaTri: number
  nhanManh?: boolean
}) {
  return (
    <div className="the text-center">
      <p className={`text-2xl font-bold tabular-nums ${nhanManh ? 'text-amber-600' : ''}`}>
        {giaTri}
      </p>
      <p className="text-xs text-slate-500">{nhan}</p>
    </div>
  )
}
