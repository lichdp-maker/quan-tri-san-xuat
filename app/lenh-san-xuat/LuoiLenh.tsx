'use client'

import { useMemo, useState } from 'react'
import { doiTrangThai } from './actions'

export type DongLenh = {
  id: string
  ma: string
  sanPham: string
  maSP: string
  soLuong: number
  donVi: string
  xong: number
  hong: number
  soNC: number
  han: string | null // YYYY-MM-DD
  conNgay: number | null // số ngày tới hạn, âm = quá hạn
  trangThai: string
  chuyen: string[]
  taoLuc: string // YYYY-MM-DD
}

const TEN_TRANG_THAI: Record<string, string> = {
  DRAFT: 'Nháp',
  RELEASED: 'Đã phát hành',
  IN_PROGRESS: 'Đang chạy',
  COMPLETED: 'Đã xong',
  CLOSED: 'Đã đóng',
  CANCELLED: 'Đã huỷ',
}

const MAU_TRANG_THAI: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
  RELEASED: 'bg-sky-50 text-sky-700 border-sky-200',
  IN_PROGRESS: 'bg-brand-50 text-brand-700 border-brand-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CLOSED: 'bg-slate-100 text-slate-500 border-slate-200',
  CANCELLED: 'bg-red-50 text-red-600 border-red-200',
}

const DANG_MO = ['RELEASED', 'IN_PROGRESS']

type Cot = 'ma' | 'sanPham' | 'soLuong' | 'xong' | 'conLai' | 'pct' | 'hong' | 'han' | 'trangThai'

function khongDau(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

function ngay(ymd: string) {
  const [y, m, d] = ymd.split('-')
  return `${d}/${m}/${y}`
}

function pctCua(l: DongLenh) {
  return l.soLuong > 0 ? Math.round((l.xong / l.soLuong) * 100) : 0
}

export default function LuoiLenh({ lenhs }: { lenhs: DongLenh[] }) {
  const [loc, setLoc] = useState<string>('dang-mo')
  const [tim, setTim] = useState('')
  const [sapXep, setSapXep] = useState<{ cot: Cot; tang: boolean }>({ cot: 'han', tang: true })

  const dem = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of lenhs) m.set(l.trangThai, (m.get(l.trangThai) ?? 0) + 1)
    return m
  }, [lenhs])
  const soDangMo = lenhs.filter((l) => DANG_MO.includes(l.trangThai)).length

  const k = khongDau(tim.trim())
  const ds = useMemo(() => {
    const loc1 = lenhs
      .filter((l) =>
        loc === 'tat-ca' ? true : loc === 'dang-mo' ? DANG_MO.includes(l.trangThai) : l.trangThai === loc,
      )
      .filter(
        (l) =>
          !k ||
          khongDau(l.ma).includes(k) ||
          khongDau(l.sanPham).includes(k) ||
          khongDau(l.maSP).includes(k),
      )

    const gt = (l: DongLenh): number | string => {
      switch (sapXep.cot) {
        case 'ma':
          return l.ma
        case 'sanPham':
          return l.sanPham
        case 'soLuong':
          return l.soLuong
        case 'xong':
          return l.xong
        case 'conLai':
          return l.soLuong - l.xong
        case 'pct':
          return pctCua(l)
        case 'hong':
          return l.hong
        case 'han':
          // Lệnh không có hạn luôn xếp cuối
          return l.han ?? '9999-12-31'
        case 'trangThai':
          return TEN_TRANG_THAI[l.trangThai] ?? l.trangThai
      }
    }
    return [...loc1].sort((a, b) => {
      const x = gt(a)
      const y = gt(b)
      const s = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'vi')
      return sapXep.tang ? s : -s
    })
  }, [lenhs, loc, k, sapXep])

  const tong = ds.reduce(
    (a, l) => ({ sl: a.sl + l.soLuong, xong: a.xong + l.xong, hong: a.hong + l.hong }),
    { sl: 0, xong: 0, hong: 0 },
  )

  function TieuDe({ cot, children, phai }: { cot: Cot; children: React.ReactNode; phai?: boolean }) {
    const dang = sapXep.cot === cot
    return (
      <th className={`whitespace-nowrap px-3 py-2.5 font-medium ${phai ? 'text-right' : 'text-left'}`}>
        <button
          onClick={() => setSapXep((s) => ({ cot, tang: s.cot === cot ? !s.tang : true }))}
          className={`inline-flex items-center gap-1 hover:text-slate-900 ${dang ? 'text-slate-900' : ''}`}
        >
          {children}
          <span className={dang ? 'opacity-100' : 'opacity-25'}>{dang && !sapXep.tang ? '▼' : '▲'}</span>
        </button>
      </th>
    )
  }

  return (
    <section>
      {/* Bộ lọc */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <button onClick={() => setLoc('dang-mo')} className={loc === 'dang-mo' ? 'chip-bat' : 'chip-tat'}>
          Đang mở <span className="ml-1 opacity-70">{soDangMo}</span>
        </button>
        {Object.keys(TEN_TRANG_THAI)
          .filter((t) => (dem.get(t) ?? 0) > 0)
          .map((t) => (
            <button key={t} onClick={() => setLoc(t)} className={loc === t ? 'chip-bat' : 'chip-tat'}>
              {TEN_TRANG_THAI[t]} <span className="ml-1 opacity-70">{dem.get(t)}</span>
            </button>
          ))}
        <button onClick={() => setLoc('tat-ca')} className={loc === 'tat-ca' ? 'chip-bat' : 'chip-tat'}>
          Tất cả <span className="ml-1 opacity-70">{lenhs.length}</span>
        </button>
        <span className="flex-1" />
        <input
          value={tim}
          onChange={(e) => setTim(e.target.value)}
          placeholder="Tìm số lệnh, sản phẩm…"
          className="o-nhap w-full py-2 sm:w-64"
        />
      </div>

      {/* Lưới */}
      <div className="the overflow-x-auto p-0">
        <table className="w-full min-w-[60rem] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <TieuDe cot="ma">Số lệnh</TieuDe>
              <TieuDe cot="sanPham">Sản phẩm</TieuDe>
              <TieuDe cot="soLuong" phai>
                SL lệnh
              </TieuDe>
              <TieuDe cot="xong" phai>
                Đã xong
              </TieuDe>
              <TieuDe cot="conLai" phai>
                Còn lại
              </TieuDe>
              <TieuDe cot="pct">Tiến độ</TieuDe>
              <TieuDe cot="hong" phai>
                Hỏng
              </TieuDe>
              <TieuDe cot="han">Hạn giao</TieuDe>
              <th className="whitespace-nowrap px-3 py-2.5 text-left font-medium">Chuyền</th>
              <TieuDe cot="trangThai">Trạng thái</TieuDe>
            </tr>
          </thead>
          <tbody>
            {ds.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-slate-500">
                  Không có lệnh nào khớp bộ lọc.
                </td>
              </tr>
            ) : (
              ds.map((l) => {
                const pct = pctCua(l)
                const conLai = Math.max(0, l.soLuong - l.xong)
                const mo = DANG_MO.includes(l.trangThai)
                const quaHan = mo && l.conNgay !== null && l.conNgay < 0 && conLai > 0
                const sapHan = mo && l.conNgay !== null && l.conNgay >= 0 && l.conNgay <= 3 && conLai > 0
                return (
                  <tr key={l.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-3 py-2.5 font-semibold">{l.ma}</td>
                    <td className="max-w-[16rem] px-3 py-2.5">
                      <span className="block truncate" title={l.sanPham}>
                        {l.sanPham}
                      </span>
                      <span className="text-xs text-slate-400">
                        {l.maSP} · {l.soNC} NC
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{l.soLuong.toLocaleString('vi-VN')}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                      {l.xong.toLocaleString('vi-VN')}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                      {conLai.toLocaleString('vi-VN')}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-24 overflow-hidden rounded-full bg-slate-200">
                          <span
                            className={`block h-full rounded-full ${pct >= 100 ? 'bg-emerald-600' : quaHan ? 'bg-red-500' : 'bg-brand-600'}`}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </span>
                        <span className="w-9 text-right text-xs tabular-nums text-slate-600">{pct}%</span>
                      </span>
                    </td>
                    <td className={`px-3 py-2.5 text-right tabular-nums ${l.hong > 0 ? 'text-red-600' : 'text-slate-300'}`}>
                      {l.hong > 0 ? l.hong.toLocaleString('vi-VN') : '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      {l.han ? (
                        <>
                          <span className={quaHan ? 'font-semibold text-red-600' : sapHan ? 'font-medium text-amber-700' : ''}>
                            {ngay(l.han)}
                          </span>
                          {quaHan && <span className="block text-xs text-red-600">quá {-l.conNgay!} ngày</span>}
                          {sapHan && (
                            <span className="block text-xs text-amber-700">
                              {l.conNgay === 0 ? 'hạn hôm nay' : `còn ${l.conNgay} ngày`}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">
                      {l.chuyen.length > 0 ? l.chuyen.join(', ') : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      {mo ? (
                        <DoiTrangThai id={l.id} hienTai={l.trangThai} />
                      ) : (
                        <span className={`rounded-lg border px-2 py-0.5 text-xs font-medium ${MAU_TRANG_THAI[l.trangThai] ?? ''}`}>
                          {TEN_TRANG_THAI[l.trangThai] ?? l.trangThai}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
          {ds.length > 1 && (
            <tfoot className="border-t-2 border-slate-200 bg-slate-50 text-sm font-semibold">
              <tr>
                <td className="px-3 py-2.5" colSpan={2}>
                  Cộng {ds.length} lệnh
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{tong.sl.toLocaleString('vi-VN')}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{tong.xong.toLocaleString('vi-VN')}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {Math.max(0, tong.sl - tong.xong).toLocaleString('vi-VN')}
                </td>
                <td className="px-3 py-2.5 text-xs text-slate-600">
                  {tong.sl > 0 ? Math.round((tong.xong / tong.sl) * 100) : 0}%
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-red-600">
                  {tong.hong > 0 ? tong.hong.toLocaleString('vi-VN') : ''}
                </td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Bấm tên cột để sắp xếp. “Đã xong” là số sản phẩm đã qua hết mọi nguyên công của lệnh.
      </p>
    </section>
  )
}

/** Đổi trạng thái ngay trên dòng; nút Lưu chỉ hiện khi đã chọn khác, tránh bấm nhầm. */
function DoiTrangThai({ id, hienTai }: { id: string; hienTai: string }) {
  const [chon, setChon] = useState(hienTai)
  return (
    <form action={doiTrangThai} className="flex items-center gap-1.5">
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        value={chon}
        onChange={(e) => setChon(e.target.value)}
        className={`rounded-lg border px-2 py-1 text-xs font-medium ${MAU_TRANG_THAI[chon] ?? ''}`}
      >
        {hienTai === 'RELEASED' && <option value="RELEASED">Đã phát hành</option>}
        <option value="IN_PROGRESS">Đang chạy</option>
        <option value="COMPLETED">Đã xong</option>
        <option value="CLOSED">Đóng lệnh</option>
        <option value="CANCELLED">Huỷ lệnh</option>
      </select>
      {chon !== hienTai && (
        <button className="rounded-lg bg-brand-600 px-2 py-1 text-xs font-medium text-white">Lưu</button>
      )}
    </form>
  )
}
