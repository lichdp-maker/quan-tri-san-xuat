import { redirect } from 'next/navigation'
import Link from 'next/link'
import { nguoiDangDangNhap, TEN_VAI_TRO } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { soPhut } from '@/lib/date'
import { dangXuat } from '../dang-nhap/actions'
import {
  themNguoiDung,
  themNhieuNguoiDung,
  suaNguoiDung,
  datLaiMatKhau,
  themTo,
  ganToTruong,
  suaCa,
  suaMocGio,
  themMocGio,
} from './actions'

export const dynamic = 'force-dynamic'

const DUOC_VAO = ['SHOP_MANAGER', 'DEPUTY_DIRECTOR', 'DIRECTOR']
const TABS = { 'nguoi-dung': 'Người dùng', to: 'Tổ sản xuất', ca: 'Ca & mốc giờ' } as const

export default async function TrangQuanTri({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const u = await nguoiDangDangNhap()
  if (!u) redirect('/dang-nhap')
  if (!DUOC_VAO.includes(u.role)) redirect('/')

  const { tab } = await searchParams
  const tabHienTai = (tab && tab in TABS ? tab : 'nguoi-dung') as keyof typeof TABS

  const [nguoiDung, tos, cas] = await Promise.all([
    prisma.user.findMany({ include: { team: true }, orderBy: [{ role: 'asc' }, { employeeCode: 'asc' }] }),
    prisma.team.findMany({ include: { leader: true, _count: { select: { members: true } } }, orderBy: { code: 'asc' } }),
    prisma.shift.findMany({ include: { timeSlots: { orderBy: { seq: 'asc' } } }, orderBy: { code: 'asc' } }),
  ])

  const toTruongs = nguoiDung.filter((n) => n.role === 'TEAM_LEADER' && n.isActive)

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-5">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold leading-tight">Quản trị hệ thống</h1>
          <p className="text-sm text-slate-500">
            {u.fullName} · {TEN_VAI_TRO[u.role]}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/bang-dieu-khien" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600">
            Bảng tổng hợp
          </Link>
          <form action={dangXuat}>
            <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600">Thoát</button>
          </form>
        </div>
      </header>

      <div className="mb-5 flex flex-wrap gap-2">
        {Object.entries(TABS).map(([k, v]) => (
          <Link
            key={k}
            href={`/quan-tri?tab=${k}`}
            className={[
              'rounded-lg border px-3 py-1.5 text-sm font-medium',
              k === tabHienTai ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700',
            ].join(' ')}
          >
            {v}
          </Link>
        ))}
      </div>

      {tabHienTai === 'nguoi-dung' && (
        <>
          <section className="mb-6 grid gap-4 sm:grid-cols-2">
            <form action={themNguoiDung} className="the flex flex-col gap-2">
              <p className="font-medium">Thêm một người</p>
              <input name="employeeCode" required placeholder="Mã nhân viên" className="rounded-lg border-2 border-slate-300 px-3 py-1.5 uppercase" />
              <input name="fullName" required placeholder="Họ và tên" className="rounded-lg border-2 border-slate-300 px-3 py-1.5" />
              <select name="role" className="rounded-lg border-2 border-slate-300 px-3 py-1.5">
                {Object.entries(TEN_VAI_TRO).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <select name="teamId" className="rounded-lg border-2 border-slate-300 px-3 py-1.5">
                <option value="">— không thuộc tổ nào —</option>
                {tos.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <input name="password" required defaultValue="123456" placeholder="PIN / mật khẩu" className="rounded-lg border-2 border-slate-300 px-3 py-1.5" />
              <button className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white">Tạo tài khoản</button>
            </form>

            <form action={themNhieuNguoiDung} className="the flex flex-col gap-2">
              <p className="font-medium">Thêm hàng loạt</p>
              <p className="text-xs text-slate-500">
                Mỗi dòng một người, ngăn bằng dấu phẩy:
                <br />
                <code className="text-[11px]">MÃ, Họ tên, VAI_TRO, MÃ_TỔ, PIN</code>
                <br />
                Bỏ trống vai trò thì mặc định là công nhân, bỏ trống PIN thì mặc định 123456. Dán
                thẳng từ Excel được (cột ngăn bằng dấu phẩy).
              </p>
              <textarea
                name="danhSach"
                rows={8}
                required
                placeholder={'CN010, Nguyễn Văn A, WORKER, TO1, 123456\nCN011, Trần Thị B'}
                className="rounded-lg border-2 border-slate-300 px-3 py-2 font-mono text-xs"
              />
              <button className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white">
                Tạo tất cả
              </button>
            </form>
          </section>

          <h2 className="mb-2 font-semibold">Danh sách tài khoản ({nguoiDung.length})</h2>
          <div className="flex flex-col gap-2">
            {nguoiDung.map((n) => (
              <div key={n.id} className="the">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">
                    {n.employeeCode} — {n.fullName}
                    {!n.isActive && <span className="ml-2 text-xs text-red-600">đã khoá</span>}
                  </p>
                  <p className="text-xs text-slate-500">
                    {TEN_VAI_TRO[n.role]}
                    {n.team && ` · ${n.team.name}`}
                  </p>
                </div>

                <div className="flex flex-wrap gap-4">
                  <form action={suaNguoiDung} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="id" value={n.id} />
                    <select name="role" defaultValue={n.role} className="rounded-lg border border-slate-300 px-2 py-1 text-sm">
                      {Object.entries(TEN_VAI_TRO).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                    <select name="teamId" defaultValue={n.teamId ?? ''} className="rounded-lg border border-slate-300 px-2 py-1 text-sm">
                      <option value="">không thuộc tổ</option>
                      {tos.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1 text-xs text-slate-600">
                      <input type="checkbox" name="isActive" defaultChecked={n.isActive} /> đang dùng
                    </label>
                    <button className="rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-700">Lưu</button>
                  </form>

                  <form action={datLaiMatKhau} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={n.id} />
                    <input name="password" placeholder="PIN mới" className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-sm" />
                    <button className="rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-700">Đặt lại</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tabHienTai === 'to' && (
        <>
          <form action={themTo} className="the mb-6 flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-600">Mã tổ</span>
              <input name="code" required placeholder="TO2" className="w-28 rounded-lg border-2 border-slate-300 px-3 py-1.5 uppercase" />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs text-slate-600">Tên tổ</span>
              <input name="name" required placeholder="Tổ lắp ráp 2" className="rounded-lg border-2 border-slate-300 px-3 py-1.5" />
            </label>
            <button className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white">Thêm tổ</button>
          </form>

          <div className="flex flex-col gap-2">
            {tos.map((t) => (
              <div key={t.id} className="the flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {t.code} — {t.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {t._count.members} người · tổ trưởng: {t.leader?.fullName ?? 'chưa gán'}
                  </p>
                </div>
                <form action={ganToTruong} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={t.id} />
                  <select name="leaderId" defaultValue={t.leaderId ?? ''} className="rounded-lg border border-slate-300 px-2 py-1 text-sm">
                    <option value="">— chưa gán —</option>
                    {toTruongs.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.employeeCode} — {l.fullName}
                      </option>
                    ))}
                  </select>
                  <button className="rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-700">Lưu</button>
                </form>
              </div>
            ))}
          </div>
        </>
      )}

      {tabHienTai === 'ca' && (
        <>
          <p className="mb-4 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
            <strong>Nghỉ giữa khoảng</strong> được trừ khỏi thời gian của mốc trước khi tính năng
            suất — đặt sai là mọi phần trăm năng suất sai theo. Sửa mốc giờ ở đây{' '}
            <strong>không làm đổi số liệu cũ</strong>: mỗi bản ghi đã lưu lại mốc thật lúc nhập.
          </p>

          {cas.map((c) => (
            <section key={c.id} className="mb-6">
              <form action={suaCa} className="the mb-3 flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={c.id} />
                <label className="flex flex-1 flex-col gap-1">
                  <span className="text-xs text-slate-600">Tên ca ({c.code})</span>
                  <input name="name" defaultValue={c.name} className="rounded-lg border-2 border-slate-300 px-3 py-1.5" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-slate-600">Bắt đầu</span>
                  <input name="startTime" defaultValue={c.startTime} className="w-24 rounded-lg border-2 border-slate-300 px-2 py-1.5 text-center" />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-slate-600">Kết thúc</span>
                  <input name="endTime" defaultValue={c.endTime} className="w-24 rounded-lg border-2 border-slate-300 px-2 py-1.5 text-center" />
                </label>
                <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700">Lưu ca</button>
              </form>

              <div className="the">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="pb-2 font-medium">Mốc</th>
                      <th className="pb-2 font-medium">Từ</th>
                      <th className="pb-2 font-medium">Đến</th>
                      <th className="pb-2 font-medium">Nghỉ (phút)</th>
                      <th className="pb-2 font-medium">Thời gian làm</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {c.timeSlots.map((s) => (
                      <tr key={s.id} className="border-b border-slate-100 last:border-0">
                        <td colSpan={6} className="py-2">
                          <form action={suaMocGio} className="flex flex-wrap items-center gap-2">
                            <input type="hidden" name="id" value={s.id} />
                            <input name="label" defaultValue={s.label} className="w-20 rounded-lg border-2 border-slate-300 px-2 py-1 text-center" />
                            <input name="startTime" defaultValue={s.startTime} className="w-20 rounded-lg border-2 border-slate-300 px-2 py-1 text-center" />
                            <input name="endTime" defaultValue={s.endTime} className="w-20 rounded-lg border-2 border-slate-300 px-2 py-1 text-center" />
                            <input name="breakMinutes" defaultValue={s.breakMinutes} inputMode="numeric" className="w-16 rounded-lg border-2 border-slate-300 px-2 py-1 text-center tabular-nums" />
                            <span className="text-sm tabular-nums text-slate-600">
                              = {soPhut(s.startTime, s.endTime, s.breakMinutes)} phút
                            </span>
                            <label className="flex items-center gap-1 text-xs text-slate-600">
                              <input type="checkbox" name="isActive" defaultChecked={s.isActive} /> dùng
                            </label>
                            <button className="rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-700">Lưu</button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <form action={themMocGio} className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-200 pt-3">
                  <input type="hidden" name="shiftId" value={c.id} />
                  <input name="label" required placeholder="Tên mốc" className="w-24 rounded-lg border-2 border-slate-300 px-2 py-1.5 text-center" />
                  <input name="startTime" required placeholder="16:20" className="w-20 rounded-lg border-2 border-slate-300 px-2 py-1.5 text-center" />
                  <input name="endTime" required placeholder="19:40" className="w-20 rounded-lg border-2 border-slate-300 px-2 py-1.5 text-center" />
                  <input name="breakMinutes" placeholder="nghỉ" inputMode="numeric" className="w-16 rounded-lg border-2 border-slate-300 px-2 py-1.5 text-center" />
                  <button className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white">Thêm mốc</button>
                </form>
              </div>
            </section>
          ))}
        </>
      )}
    </main>
  )
}
