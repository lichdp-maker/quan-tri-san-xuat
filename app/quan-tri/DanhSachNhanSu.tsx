'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { luuNhanSu, themToNhanh, datLaiMatKhau } from './actions'
import {
  NHOM_CHUC_NANG,
  MAC_DINH,
  quyenCuaNguoi,
  MOI_CHUC_NANG,
  type MaChucNang,
} from '@/lib/chuc-nang'
import {
  TINH_TRANG,
  TEN_TINH_TRANG,
  NHAN_NGAN,
  MAU_TINH_TRANG,
  type TinhTrang,
} from '@/lib/tinh-trang'

type Role = keyof typeof MAC_DINH

export type Nguoi = {
  id: string
  ma: string
  ten: string
  role: Role
  teamId: string | null
  tenTo: string | null
  tinhTrang: TinhTrang
  ghiChu: string | null
  quyenThem: string[]
  quyenBot: string[]
}

type To = { id: string; ma: string; ten: string }

function khongDau(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

export default function DanhSachNhanSu({
  nguoiDung,
  tos,
  tenVaiTro,
  duocThemTo,
}: {
  nguoiDung: Nguoi[]
  tos: To[]
  tenVaiTro: Record<string, string>
  duocThemTo: boolean
}) {
  const router = useRouter()
  const [tabTo, setTabTo] = useState<string>('tat-ca')
  const [locTT, setLocTT] = useState<TinhTrang | 'tat-ca'>('tat-ca')
  const [tim, setTim] = useState('')
  const [dangSua, setDangSua] = useState<Nguoi | null>(null)
  const [moThemTo, setMoThemTo] = useState(false)

  const demTheoTo = useMemo(() => {
    const m = new Map<string, number>()
    for (const n of nguoiDung) {
      const k = n.teamId ?? 'khong-to'
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    return m
  }, [nguoiDung])

  const demTheoTinhTrang = useMemo(() => {
    const m = new Map<string, number>()
    for (const n of nguoiDung) m.set(n.tinhTrang, (m.get(n.tinhTrang) ?? 0) + 1)
    return m
  }, [nguoiDung])

  const k = khongDau(tim.trim())
  const ds = nguoiDung
    .filter((n) => {
      if (tabTo === 'khong-to') return n.teamId === null
      if (tabTo !== 'tat-ca') return n.teamId === tabTo
      return true
    })
    .filter((n) => locTT === 'tat-ca' || n.tinhTrang === locTT)
    .filter((n) => !k || khongDau(n.ten).includes(k) || khongDau(n.ma).includes(k))

  return (
    <>
      {/* ---- Tab tổ ---- */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setTabTo('tat-ca')}
          className={tabTo === 'tat-ca' ? 'chip-bat' : 'chip-tat'}
        >
          Tất cả <span className="ml-1 opacity-70">{nguoiDung.length}</span>
        </button>
        {tos.map((t) => (
          <button
            key={t.id}
            onClick={() => setTabTo(t.id)}
            className={tabTo === t.id ? 'chip-bat' : 'chip-tat'}
            title={t.ten}
          >
            {t.ma}
            <span className="ml-1 opacity-70">{demTheoTo.get(t.id) ?? 0}</span>
          </button>
        ))}
        {(demTheoTo.get('khong-to') ?? 0) > 0 && (
          <button
            onClick={() => setTabTo('khong-to')}
            className={tabTo === 'khong-to' ? 'chip-bat' : 'chip-tat'}
          >
            Chưa thuộc tổ <span className="ml-1 opacity-70">{demTheoTo.get('khong-to')}</span>
          </button>
        )}
        {duocThemTo && (
          <button
            onClick={() => setMoThemTo((v) => !v)}
            className="chip-tat border-dashed"
          >
            + Thêm tổ
          </button>
        )}
      </div>

      {moThemTo && <ThemTo dong={() => setMoThemTo(false)} />}

      {/* ---- Lọc tình trạng + tìm ---- */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setLocTT('tat-ca')}
          className={locTT === 'tat-ca' ? 'chip-bat' : 'chip-tat'}
        >
          Mọi tình trạng
        </button>
        {TINH_TRANG.map((t) => (
          <button
            key={t}
            onClick={() => setLocTT(locTT === t ? 'tat-ca' : t)}
            className={locTT === t ? 'chip-bat' : 'chip-tat'}
          >
            {NHAN_NGAN[t]}
            <span className="ml-1 opacity-70">{demTheoTinhTrang.get(t) ?? 0}</span>
          </button>
        ))}
        <span className="flex-1" />
        <input
          value={tim}
          onChange={(e) => setTim(e.target.value)}
          placeholder="Tìm tên hoặc mã…"
          className="o-nhap w-full py-2 sm:w-60"
        />
      </div>

      {/* ---- Danh sách ---- */}
      {ds.length === 0 ? (
        <p className="the text-sm text-slate-500">Không có ai khớp bộ lọc hiện tại.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {ds.map((n) => {
            const quyen = quyenCuaNguoi(n.role, n.quyenThem, n.quyenBot)
            const khac = n.quyenThem.length + n.quyenBot.length
            return (
              <li key={n.id}>
                <button
                  onClick={() => setDangSua(n)}
                  className="the flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-left transition hover:border-brand-300"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium leading-tight">
                      {n.ma} — {n.ten}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {tenVaiTro[n.role]}
                      {n.tenTo ? ` · ${n.tenTo}` : ' · chưa thuộc tổ'} · {quyen.length} chức năng
                      {khac > 0 && <span className="text-brand-700"> · đã chỉnh riêng {khac}</span>}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-lg border px-2 py-0.5 text-xs font-medium ${MAU_TINH_TRANG[n.tinhTrang]}`}
                  >
                    {NHAN_NGAN[n.tinhTrang]}
                  </span>
                  <span className="shrink-0 text-xs text-brand-700">Sửa →</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {dangSua && (
        <BangSua
          n={dangSua}
          tos={tos}
          tenVaiTro={tenVaiTro}
          dong={() => setDangSua(null)}
          xong={() => {
            setDangSua(null)
            router.refresh()
          }}
        />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */

function ThemTo({ dong }: { dong: () => void }) {
  const router = useRouter()
  const [ma, setMa] = useState('')
  const [ten, setTen] = useState('')
  const [loi, setLoi] = useState<string | null>(null)
  const [dangChay, batDau] = useTransition()

  return (
    <div className="the mb-3 flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-600">Mã tổ</span>
        <input
          value={ma}
          onChange={(e) => setMa(e.target.value)}
          placeholder="TSX8"
          className="o-nhap w-28 py-2 uppercase"
        />
      </label>
      <label className="flex min-w-48 flex-1 flex-col gap-1">
        <span className="text-xs font-medium text-slate-600">Tên tổ</span>
        <input
          value={ten}
          onChange={(e) => setTen(e.target.value)}
          placeholder="Tổ lắp ráp 8"
          className="o-nhap py-2"
        />
      </label>
      <button
        disabled={dangChay}
        onClick={() =>
          batDau(async () => {
            setLoi(null)
            const kq = await themToNhanh({ code: ma, name: ten })
            if (kq.loi) setLoi(kq.loi)
            else {
              setMa('')
              setTen('')
              dong()
              router.refresh()
            }
          })
        }
        className="nut-nho"
      >
        {dangChay ? 'Đang tạo…' : 'Tạo tổ'}
      </button>
      <button onClick={dong} className="nut-phu">
        Đóng
      </button>
      {loi && <p className="w-full text-sm text-red-700">{loi}</p>}
    </div>
  )
}

/* ------------------------------------------------------------------ */

function BangSua({
  n,
  tos,
  tenVaiTro,
  dong,
  xong,
}: {
  n: Nguoi
  tos: To[]
  tenVaiTro: Record<string, string>
  dong: () => void
  xong: () => void
}) {
  const [role, setRole] = useState<Role>(n.role)
  const [teamId, setTeamId] = useState(n.teamId ?? '')
  const [tinhTrang, setTinhTrang] = useState<TinhTrang>(n.tinhTrang)
  const [ghiChu, setGhiChu] = useState(n.ghiChu ?? '')
  const [chon, setChon] = useState<Set<string>>(
    () => new Set(quyenCuaNguoi(n.role, n.quyenThem, n.quyenBot)),
  )
  const [pin, setPin] = useState('')
  const [loi, setLoi] = useState<string | null>(null)
  const [dangChay, batDau] = useTransition()

  const macDinh = new Set<MaChucNang>(MAC_DINH[role] ?? [])

  function bat(ma: string) {
    setChon((cu) => {
      const m = new Set(cu)
      if (m.has(ma)) m.delete(ma)
      else m.add(ma)
      return m
    })
  }

  function batNhom(ds: MaChucNang[]) {
    const duCa = ds.every((m) => chon.has(m))
    setChon((cu) => {
      const m = new Set(cu)
      for (const x of ds) {
        if (duCa) m.delete(x)
        else m.add(x)
      }
      return m
    })
  }

  function theoVaiTro() {
    setChon(new Set(MAC_DINH[role] ?? []))
  }

  function luu() {
    setLoi(null)
    batDau(async () => {
      const kq = await luuNhanSu({
        id: n.id,
        role,
        teamId,
        tinhTrang,
        ghiChu,
        chucNang: [...chon],
      })
      if (kq.loi) setLoi(kq.loi)
      else xong()
    })
  }

  const soChinhRieng = MOI_CHUC_NANG.filter((m) => chon.has(m) !== macDinh.has(m)).length

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-slate-900/40" onClick={dong} />
      <div className="relative flex max-h-[92dvh] w-full max-w-3xl flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">
              {n.ma} — {n.ten}
            </p>
            <p className="text-xs text-slate-500">
              {chon.size} chức năng
              {soChinhRieng > 0 && ` · ${soChinhRieng} mục khác bộ mặc định của vai trò`}
            </p>
          </div>
          <button onClick={dong} aria-label="Đóng" className="nut-phu px-2.5 py-1">
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {loi && (
            <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{loi}</p>
          )}

          {/* Thông tin chung */}
          <div className="mb-4 flex flex-wrap gap-3">
            <label className="flex min-w-44 flex-1 flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Vai trò</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="o-chon"
              >
                {Object.entries(tenVaiTro).map(([k2, v]) => (
                  <option key={k2} value={k2}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-44 flex-1 flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Tổ sản xuất</span>
              <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="o-chon">
                <option value="">— chưa thuộc tổ —</option>
                {tos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.ma} — {t.ten}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-52 flex-1 flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Tình trạng làm việc</span>
              <select
                value={tinhTrang}
                onChange={(e) => setTinhTrang(e.target.value as TinhTrang)}
                className="o-chon"
              >
                {TINH_TRANG.map((t) => (
                  <option key={t} value={t}>
                    {TEN_TINH_TRANG[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-full flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Ghi chú</span>
              <input
                value={ghiChu}
                onChange={(e) => setGhiChu(e.target.value)}
                placeholder="Tăng cường từ xưởng cơ khí, hết mùa vụ 31/12…"
                className="o-nhap py-2"
              />
            </label>
          </div>

          {tinhTrang === 'NGHI_VIEC' && (
            <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Chọn “Đã nghỉ việc” là tài khoản ngừng đăng nhập được ngay và không xếp vào chỗ
              ngồi được nữa. Toàn bộ sản lượng, năng suất đã ghi vẫn giữ nguyên trong báo cáo.
            </p>
          )}
          {tinhTrang === 'NGHI_DAI_HAN' && (
            <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Nghỉ phép dài hạn: vẫn đăng nhập xem được, nhưng không hiện ra trong danh sách xếp
              chỗ và không bị chép sang ngày mới.
            </p>
          )}

          {/* Phân quyền chi tiết */}
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">Phân quyền chi tiết</p>
            <button onClick={theoVaiTro} className="nut-phu px-3 py-1.5 text-xs">
              Đặt lại theo vai trò {tenVaiTro[role]}
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {NHOM_CHUC_NANG.map((nh) => {
              const ds = nh.muc.map((m) => m.ma)
              const so = ds.filter((m) => chon.has(m)).length
              return (
                <div key={nh.nhom} className="rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                      <input
                        type="checkbox"
                        checked={so === ds.length}
                        ref={(el) => {
                          if (el) el.indeterminate = so > 0 && so < ds.length
                        }}
                        onChange={() => batNhom(ds)}
                        className="h-4 w-4"
                      />
                      {nh.nhom}
                    </label>
                    <span className="text-xs text-slate-500">
                      {so}/{ds.length}
                    </span>
                  </div>
                  <ul className="grid gap-x-4 px-3 py-2 sm:grid-cols-2">
                    {nh.muc.map((m) => (
                      <li key={m.ma}>
                        <label className="flex cursor-pointer items-start gap-2 py-1.5 text-sm">
                          <input
                            type="checkbox"
                            checked={chon.has(m.ma)}
                            onChange={() => bat(m.ma)}
                            className="mt-0.5 h-4 w-4 shrink-0"
                          />
                          <span className="min-w-0">
                            <span className="block leading-tight">
                              {m.ten}
                              {macDinh.has(m.ma) !== chon.has(m.ma) && (
                                <span className="ml-1.5 text-[11px] font-medium text-brand-700">
                                  {chon.has(m.ma) ? '+ thêm' : '− cắt'}
                                </span>
                              )}
                            </span>
                            <span className="block text-xs text-slate-400">{m.moTa}</span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>

          {/* Đặt lại mật khẩu */}
          <form action={datLaiMatKhau} className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-200 pt-4">
            <input type="hidden" name="id" value={n.id} />
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">Đặt lại mật khẩu</span>
              <input
                name="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="PIN mới"
                className="o-nhap w-40 py-2"
              />
            </label>
            <button className="nut-phu">Đặt lại</button>
            <span className="text-xs text-slate-500">
              Người được cấp lại phải tự đổi ngay lần đăng nhập sau.
            </span>
          </form>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <button onClick={dong} className="nut-phu">
            Đóng
          </button>
          <button disabled={dangChay} onClick={luu} className="nut-nho">
            {dangChay ? 'Đang lưu…' : 'Lưu nhân sự'}
          </button>
        </div>
      </div>
    </div>
  )
}
