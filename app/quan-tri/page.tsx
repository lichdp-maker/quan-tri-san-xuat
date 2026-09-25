import { redirect } from 'next/navigation'
import Link from 'next/link'
import { nguoiDangDangNhap, TEN_VAI_TRO } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { soPhut } from '@/lib/date'
import { Header } from '@/components/Header'
import { coQuyen } from '@/lib/chuc-nang'
import DanhSachNhanSu from './DanhSachNhanSu'
import {
  themNguoiDung,
  themNhieuNguoiDung,
  themTo,
  ganToTruong,
  suaCa,
  suaMocGio,
  themMocGio,
  themCa,
  xoaMocGio,
} from './actions'

export const dynamic = 'force-dynamic'

const TABS = {
  'nguoi-dung': { nhan: 'Nhân sự · phân quyền', can: 'QT_NGUOI_DUNG' },
  to: { nhan: 'Tổ sản xuất', can: 'QT_TO' },
  ca: { nhan: 'Ca & mốc giờ', can: 'QT_CA' },
} as const

export default async function TrangQuanTri({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; loi?: string; ok?: string }>
}) {
  const u = await nguoiDangDangNhap()
  if (!u) redirect('/dang-nhap')
  if (!coQuyen(u.quyen, 'QT_NGUOI_DUNG', 'QT_TO', 'QT_CA')) redirect('/')

  const { tab, loi, ok } = await searchParams
  // Chỉ hiện tab mà người này thật sự có chức năng
  const tabDuoc = (Object.keys(TABS) as Array<keyof typeof TABS>).filter((k) =>
    coQuyen(u.quyen, TABS[k].can),
  )
  const tabHienTai =
    tab && tabDuoc.includes(tab as keyof typeof TABS)
      ? (tab as keyof typeof TABS)
      : tabDuoc[0]

  const [nguoiDung, tos, cas] = await Promise.all([
    prisma.user.findMany({ include: { team: true }, orderBy: [{ role: 'asc' }, { employeeCode: 'asc' }] }),
    prisma.team.findMany({ include: { leader: true, _count: { select: { members: true } } }, orderBy: { code: 'asc' } }),
    prisma.shift.findMany({
      include: {
        timeSlots: {
          orderBy: { seq: 'asc' },
          include: { _count: { select: { entries: true } } },
        },
        _count: { select: { assignments: true } },
      },
      orderBy: { code: 'asc' },
    }),
  ])

  const toTruongs = nguoiDung.filter((n) => n.role === 'TEAM_LEADER' && n.isActive)

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-5">
      <Header
        tieuDe="Quản trị hệ thống"
        phu={`${u.fullName} · ${TEN_VAI_TRO[u.role]}`}
        nguoiDung={u}
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {tabDuoc.map((k) => (
          <Link
            key={k}
            href={`/quan-tri?tab=${k}`}
            className={k === tabHienTai ? 'chip-bat' : 'chip-tat'}
          >
            {TABS[k].nhan}
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

          <h2 className="mb-3 font-semibold">Danh sách nhân sự ({nguoiDung.length})</h2>
          <DanhSachNhanSu
            duocThemTo={coQuyen(u.quyen, 'QT_TO')}
            tenVaiTro={TEN_VAI_TRO}
            tos={tos.map((t) => ({ id: t.id, ma: t.code, ten: t.name }))}
            nguoiDung={nguoiDung.map((n) => ({
              id: n.id,
              ma: n.employeeCode,
              ten: n.fullName,
              role: n.role,
              teamId: n.teamId,
              tenTo: n.team?.name ?? null,
              tinhTrang: n.tinhTrang,
              ghiChu: n.ghiChu,
              quyenThem: n.quyenThem,
              quyenBot: n.quyenBot,
            }))}
          />
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
          {loi && (
            <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {loi}
            </p>
          )}
          {ok && (
            <p className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {ok}
            </p>
          )}

          <p className="mb-4 rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600">
            Mỗi ca có bộ <strong>mốc giờ báo sản lượng</strong> riêng — công nhân nhập số theo đúng
            các mốc của ca mình. <strong>Nghỉ giữa khoảng</strong> được trừ khỏi thời gian của mốc
            trước khi tính năng suất, đặt sai là mọi phần trăm năng suất sai theo. Sửa mốc giờ ở đây{' '}
            <strong>không làm đổi số liệu cũ</strong>: mỗi bản ghi đã lưu lại mốc thật lúc nhập.
          </p>

          {/* Thêm ca mới */}
          <details className="the mb-5">
            <summary className="cursor-pointer font-semibold">+ Thêm ca làm việc</summary>
            <form action={themCa} className="mt-3 flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-slate-600">Mã ca</span>
                <input name="code" required placeholder="CA2" className="o-nhap w-24 py-2 uppercase" />
              </label>
              <label className="flex min-w-48 flex-1 flex-col gap-1">
                <span className="text-xs text-slate-600">Tên ca</span>
                <input name="name" required placeholder="Ca chiều" className="o-nhap py-2" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-slate-600">Bắt đầu</span>
                <input name="startTime" required placeholder="14:00" className="o-nhap w-24 py-2 text-center" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-slate-600">Kết thúc</span>
                <input name="endTime" required placeholder="22:00" className="o-nhap w-24 py-2 text-center" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-slate-600">Chép mốc giờ từ ca</span>
                <select name="chepTu" className="o-chon w-52">
                  <option value="">— tạo ca rỗng —</option>
                  {cas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.timeSlots.length} mốc)
                    </option>
                  ))}
                </select>
              </label>
              <button className="nut-nho">Tạo ca</button>
            </form>
            <p className="mt-2 text-xs text-slate-500">
              Chép mốc giờ từ một ca có sẵn rồi chỉnh lại giờ sẽ nhanh hơn là nhập từng mốc.
            </p>
          </details>

          {cas.length === 0 && (
            <p className="the text-sm text-slate-500">
              Chưa có ca nào. Bấm <strong>Thêm ca làm việc</strong> ở trên để tạo ca đầu tiên.
            </p>
          )}

          {cas.map((c) => {
            const mocDung = c.timeSlots.filter((s2) => s2.isActive)
            const tongPhut = mocDung.reduce(
              (a, s2) => a + soPhut(s2.startTime, s2.endTime, s2.breakMinutes),
              0,
            )
            return (
              <section key={c.id} className="the mb-4">
                {/* Thông tin ca */}
                <form action={suaCa} className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="id" value={c.id} />
                  <label className="flex min-w-48 flex-1 flex-col gap-1">
                    <span className="text-xs text-slate-600">Tên ca · mã {c.code}</span>
                    <input name="name" defaultValue={c.name} className="o-nhap py-2 font-semibold" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-slate-600">Bắt đầu</span>
                    <input name="startTime" defaultValue={c.startTime} className="o-nhap w-24 py-2 text-center" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-slate-600">Kết thúc</span>
                    <input name="endTime" defaultValue={c.endTime} className="o-nhap w-24 py-2 text-center" />
                  </label>
                  <label className="flex items-center gap-2 pb-2.5 text-sm text-slate-600">
                    <input type="checkbox" name="isActive" defaultChecked={c.isActive} />
                    Còn dùng
                  </label>
                  <button className="nut-phu">Lưu ca</button>
                </form>

                <p className="mt-2 text-xs text-slate-500">
                  {mocDung.length} mốc đang dùng · tổng {tongPhut} phút làm việc
                  {c._count.assignments > 0 && ` · ${c._count.assignments} lượt phân công đã dùng ca này`}
                  {!c.isActive && ' · ĐANG TẮT, không chọn được khi phân công'}
                </p>

                {/* Mốc giờ */}
                <div className="mt-3 border-t border-slate-200 pt-3">
                  <div className="hidden gap-2 px-1 pb-1 text-xs font-medium uppercase tracking-wide text-slate-400 sm:flex">
                    <span className="w-24">Tên mốc</span>
                    <span className="w-[4.5rem] text-center">Từ</span>
                    <span className="w-[4.5rem] text-center">Đến</span>
                    <span className="w-16 text-center">Nghỉ</span>
                    <span className="w-28">Thời gian làm</span>
                  </div>

                  {c.timeSlots.length === 0 ? (
                    <p className="px-1 py-2 text-sm text-slate-500">
                      Ca này chưa có mốc giờ nào — công nhân sẽ không nhập được sản lượng.
                    </p>
                  ) : (
                    <ul className="flex flex-col">
                      {c.timeSlots.map((s2) => {
                        const phut = soPhut(s2.startTime, s2.endTime, s2.breakMinutes)
                        return (
                          <li
                            key={s2.id}
                            className={`flex flex-wrap items-center gap-2 border-b border-slate-100 py-1.5 last:border-0 ${
                              s2.isActive ? '' : 'opacity-60'
                            }`}
                          >
                            <form action={suaMocGio} className="flex flex-wrap items-center gap-2">
                              <input type="hidden" name="id" value={s2.id} />
                              <input name="label" defaultValue={s2.label} className="o-nhap w-24 py-1.5 text-center" />
                              <input name="startTime" defaultValue={s2.startTime} className="o-nhap w-[4.5rem] py-1.5 text-center" />
                              <input name="endTime" defaultValue={s2.endTime} className="o-nhap w-[4.5rem] py-1.5 text-center" />
                              <input
                                name="breakMinutes"
                                defaultValue={s2.breakMinutes}
                                inputMode="numeric"
                                className="o-nhap w-16 py-1.5 text-center tabular-nums"
                              />
                              <span className="w-28 text-sm tabular-nums text-slate-600">
                                = {phut} phút
                              </span>
                              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                                <input type="checkbox" name="isActive" defaultChecked={s2.isActive} />
                                dùng
                              </label>
                              <button className="nut-phu px-3 py-1.5 text-xs">Lưu</button>
                            </form>
                            <form action={xoaMocGio}>
                              <input type="hidden" name="id" value={s2.id} />
                              <button
                                className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50"
                                title={
                                  s2._count.entries > 0
                                    ? `Mốc này đã có ${s2._count.entries} bản ghi — bấm sẽ tắt chứ không xoá`
                                    : 'Xoá mốc giờ'
                                }
                              >
                                {s2._count.entries > 0 ? 'Tắt' : 'Xoá'}
                              </button>
                            </form>
                          </li>
                        )
                      })}
                    </ul>
                  )}

                  <form
                    action={themMocGio}
                    className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-2"
                  >
                    <input type="hidden" name="shiftId" value={c.id} />
                    <input name="label" required placeholder="Tên mốc" className="o-nhap w-24 bg-white py-1.5 text-center" />
                    <input name="startTime" required placeholder="16:20" className="o-nhap w-[4.5rem] bg-white py-1.5 text-center" />
                    <input name="endTime" required placeholder="19:40" className="o-nhap w-[4.5rem] bg-white py-1.5 text-center" />
                    <input name="breakMinutes" placeholder="nghỉ" inputMode="numeric" className="o-nhap w-16 bg-white py-1.5 text-center" />
                    <button className="nut-nho">Thêm mốc</button>
                    <span className="text-xs text-slate-500">
                      Mốc mới tự xếp đúng thứ tự theo giờ bắt đầu.
                    </span>
                  </form>
                </div>
              </section>
            )
          })}
        </>
      )}

    </main>
  )
}
