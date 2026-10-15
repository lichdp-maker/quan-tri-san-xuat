'use client'

/**
 * Lớp 1 của Sơ đồ sắp xếp nhân sự: toàn bộ chuyền trên một màn hình.
 * Mỗi chuyền một thẻ: đã có bao nhiêu người, còn trống mấy chỗ, đang thiếu gì.
 * Bấm vào thẻ để mở chuyền đó ra xếp (lớp 2).
 */

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { chepPhanCong } from './actions'
import { themNgay, nhanNgay, cachNgay, SO_NGAY_TOI_DA } from '@/lib/ngay-xep'

export type TheChuyen = {
  id: string
  ten: string
  loai: string
  tang: number
  to: string | null
  laCuaToi: boolean
  tongCho: number
  coNguoi: number
  choTrong: number
  chuaNC: number
  coLenh: boolean
  lenh: string | null
  ca: string | null
  /** Từng chỗ, theo thứ tự mặt A rồi mặt B — để vẽ dải ô nhỏ trên thẻ */
  ghe: Array<{ mat: 'A' | 'B'; coNguoi: boolean; coNC: boolean }>
  /** Số người đã xếp ở chuyền này ngày liền trước */
  homTruoc: number
}

type TrangThai = { nhan: string; mau: string; canXuLy: boolean; thuTu: number }

function trangThaiCua(c: TheChuyen): TrangThai {
  if (c.tongCho === 0) return { nhan: 'Chưa có chỗ ngồi', mau: 'bg-slate-100 text-slate-600 border-slate-200', canXuLy: true, thuTu: 1 }
  if (!c.coLenh) return { nhan: 'Chưa chọn lệnh / ca', mau: 'bg-amber-50 text-amber-800 border-amber-200', canXuLy: true, thuTu: 2 }
  if (c.coNguoi === 0) return { nhan: 'Chưa xếp người', mau: 'bg-red-50 text-red-700 border-red-200', canXuLy: true, thuTu: 0 }
  if (c.choTrong > 0) return { nhan: `Thiếu ${c.choTrong} người`, mau: 'bg-amber-50 text-amber-800 border-amber-200', canXuLy: true, thuTu: 3 }
  if (c.chuaNC > 0) return { nhan: `${c.chuaNC} chỗ chưa gán NC`, mau: 'bg-amber-50 text-amber-800 border-amber-200', canXuLy: true, thuTu: 4 }
  return { nhan: 'Đủ người', mau: 'bg-emerald-50 text-emerald-700 border-emerald-200', canXuLy: false, thuTu: 9 }
}

const TEN_LOAI: Record<string, string> = { CHUYEN: 'Băng chuyền', BAN: 'Dãy bàn', MAY: 'Máy' }

function ngayDai(ymd: string) {
  const [y, m, d] = ymd.split('-')
  return `${d}/${m}/${y}`
}

export default function TongQuanChuyen({
  ymd,
  homNay,
  chiXem,
  chuyens,
  tongChuaCoCho,
  tongCongNhan,
  oThemChuyen,
}: {
  ymd: string
  homNay: string
  chiXem: boolean
  chuyens: TheChuyen[]
  tongChuaCoCho: number
  tongCongNhan: number
  oThemChuyen: React.ReactNode
}) {
  const router = useRouter()
  const [loc, setLoc] = useState<'tat-ca' | 'can-xu-ly' | 'du'>('tat-ca')
  const [thongBao, setThongBao] = useState<{ loai: 'ok' | 'loi'; chu: string } | null>(null)
  const [dangChep, batDau] = useTransition()

  const lech = cachNgay(homNay, ymd)
  const homTruocYmd = themNgay(ymd, -1)

  function diNgay(moi: string) {
    const l = cachNgay(homNay, moi)
    if (l < -30 || l > SO_NGAY_TOI_DA) return
    router.push(`/day-chuyen?ngay=${moi}`)
  }

  const coTrangThai = useMemo(() => chuyens.map((c) => ({ c, tt: trangThaiCua(c) })), [chuyens])

  const tong = chuyens.reduce(
    (a, c) => ({ cho: a.cho + c.tongCho, nguoi: a.nguoi + c.coNguoi }),
    { cho: 0, nguoi: 0 },
  )
  const soDu = coTrangThai.filter((x) => !x.tt.canXuLy).length
  const soCan = coTrangThai.length - soDu

  // Chuyền chưa xếp ai ngày này nhưng hôm trước có người — chép được ngay
  const chepDuoc = chuyens.filter((c) => c.coLenh && c.coNguoi === 0 && c.homTruoc > 0)

  const hien = coTrangThai.filter(
    (x) => loc === 'tat-ca' || (loc === 'can-xu-ly' ? x.tt.canXuLy : !x.tt.canXuLy),
  )
  const cuaToi = hien.filter((x) => x.c.laCuaToi)
  const khac = hien.filter((x) => !x.c.laCuaToi)

  function chepTatCa() {
    setThongBao(null)
    batDau(async () => {
      let soNguoi = 0
      const loi: string[] = []
      for (const c of chepDuoc) {
        const kq = await chepPhanCong({ tuNgay: homTruocYmd, denNgay: ymd, lineId: c.id, ghiDe: false })
        if (kq.loi) loi.push(`${c.ten}: ${kq.loi}`)
        else soNguoi += c.homTruoc
      }
      setThongBao(
        loi.length > 0
          ? { loai: 'loi', chu: loi.join(' · ') }
          : { loai: 'ok', chu: `Đã chép khoảng ${soNguoi} người cho ${chepDuoc.length} chuyền từ ngày ${ngayDai(homTruocYmd)}.` },
      )
      router.refresh()
    })
  }

  return (
    <div>
      {/* ---------- Ngày + tổng quan ---------- */}
      <div className="the mb-4 flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50">
          <button onClick={() => diNgay(themNgay(ymd, -1))} aria-label="Ngày trước" className="px-3 py-2 text-slate-500 hover:text-slate-900">
            ◀
          </button>
          <label className="relative cursor-pointer px-1 py-1.5 text-center">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {nhanNgay(ymd, homNay)}
            </span>
            <span className="block text-sm font-bold leading-tight">{ngayDai(ymd)}</span>
            <input
              type="date"
              value={ymd}
              min={themNgay(homNay, -30)}
              max={themNgay(homNay, SO_NGAY_TOI_DA)}
              onChange={(e) => e.target.value && diNgay(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="Chọn ngày"
            />
          </label>
          <button onClick={() => diNgay(themNgay(ymd, 1))} aria-label="Ngày sau" className="px-3 py-2 text-slate-500 hover:text-slate-900">
            ▶
          </button>
        </div>
        {lech !== 0 && (
          <button onClick={() => diNgay(homNay)} className="chip-tat">
            Về hôm nay
          </button>
        )}
        {lech !== 1 && (
          <button onClick={() => diNgay(themNgay(homNay, 1))} className="chip-tat">
            Xếp cho ngày mai
          </button>
        )}

        <span className="hidden h-10 w-px bg-slate-200 md:block" />

        <dl className="flex flex-wrap gap-x-6 gap-y-2">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Người đã xếp</dt>
            <dd className="text-xl font-bold leading-tight tabular-nums">
              {tong.nguoi}
              <span className="text-sm font-medium text-slate-400"> / {tong.cho} chỗ</span>
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Chuyền đủ người</dt>
            <dd className="text-xl font-bold leading-tight tabular-nums">
              <span className="text-emerald-600">{soDu}</span>
              <span className="text-sm font-medium text-slate-400"> / {chuyens.length}</span>
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Chưa có chỗ</dt>
            <dd className="text-xl font-bold leading-tight tabular-nums">
              <span className={tongChuaCoCho > 0 ? 'text-amber-600' : 'text-emerald-600'}>{tongChuaCoCho}</span>
              <span className="text-sm font-medium text-slate-400"> / {tongCongNhan} người</span>
            </dd>
          </div>
        </dl>

        <span className="flex-1" />
        {oThemChuyen}
      </div>

      {chiXem && (
        <p className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Ngày đã qua — chỉ xem lại.
        </p>
      )}

      {/* Chép một chạm cho mọi chuyền còn trống */}
      {!chiXem && chepDuoc.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3">
          <p className="text-sm text-brand-900">
            <strong>{chepDuoc.length} chuyền</strong> chưa xếp ai ngày {ngayDai(ymd)} nhưng ngày {ngayDai(homTruocYmd)} đã
            có người: {chepDuoc.map((c) => c.ten).join(', ')}.
          </p>
          <button disabled={dangChep} onClick={chepTatCa} className="nut-nho shrink-0">
            {dangChep ? 'Đang chép…' : `Chép y như ${ngayDai(homTruocYmd).slice(0, 5)} cho ${chepDuoc.length} chuyền`}
          </button>
        </div>
      )}

      {thongBao && (
        <p
          className={`mb-4 rounded-xl px-3 py-2 text-sm ${
            thongBao.loai === 'loi' ? 'border border-red-200 bg-red-50 text-red-700' : 'border border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {thongBao.chu}
        </p>
      )}

      {/* ---------- Bộ lọc ---------- */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        <button onClick={() => setLoc('tat-ca')} className={loc === 'tat-ca' ? 'chip-bat' : 'chip-tat'}>
          Tất cả <span className="ml-1 opacity-70">{chuyens.length}</span>
        </button>
        <button onClick={() => setLoc('can-xu-ly')} className={loc === 'can-xu-ly' ? 'chip-bat' : 'chip-tat'}>
          Cần xử lý <span className="ml-1 opacity-70">{soCan}</span>
        </button>
        <button onClick={() => setLoc('du')} className={loc === 'du' ? 'chip-bat' : 'chip-tat'}>
          Đủ người <span className="ml-1 opacity-70">{soDu}</span>
        </button>
      </div>

      {hien.length === 0 && <p className="the text-sm text-slate-500">Không có chuyền nào khớp bộ lọc.</p>}

      {cuaToi.length > 0 && khac.length > 0 && (
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Chuyền của tổ bạn</p>
      )}
      <LuoiThe ds={cuaToi} ymd={ymd} />
      {cuaToi.length > 0 && khac.length > 0 && (
        <p className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Chuyền khác</p>
      )}
      <LuoiThe ds={khac} ymd={ymd} />
    </div>
  )
}

function LuoiThe({ ds, ymd }: { ds: Array<{ c: TheChuyen; tt: TrangThai }>; ymd: string }) {
  if (ds.length === 0) return null
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {ds.map(({ c, tt }) => {
        const pct = c.tongCho > 0 ? Math.round((c.coNguoi / c.tongCho) * 100) : 0
        const matA = c.ghe.filter((g) => g.mat === 'A')
        const matB = c.ghe.filter((g) => g.mat === 'B')
        return (
          <Link
            key={c.id}
            href={`/day-chuyen?dc=${c.id}&ngay=${ymd}`}
            className="the-bam group flex flex-col gap-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-bold leading-tight">{c.ten}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {c.to ?? 'Chưa gán tổ'} · {TEN_LOAI[c.loai] ?? c.loai} · Tầng {c.tang}
                </p>
              </div>
              <span className={`shrink-0 rounded-lg border px-2 py-0.5 text-xs font-semibold ${tt.mau}`}>{tt.nhan}</span>
            </div>

            <div className="flex items-end justify-between gap-3">
              <p className="leading-none">
                <span className="text-3xl font-bold tabular-nums">{c.coNguoi}</span>
                <span className="text-base font-medium text-slate-400"> / {c.tongCho} người</span>
              </p>
              <span className="text-sm font-semibold tabular-nums text-slate-500">{pct}%</span>
            </div>

            {/* Dải ô chỗ ngồi: xanh = có người, trắng = trống, vàng = chưa gán nguyên công */}
            {c.ghe.length > 0 && (
              <div className="flex flex-col gap-1">
                {[matA, matB].map((mat, i) =>
                  mat.length === 0 ? null : (
                    <div key={i} className="flex flex-wrap gap-[3px]">
                      {mat.map((g, k) => (
                        <span
                          key={k}
                          className={`h-3.5 w-3.5 rounded-[3px] border ${
                            g.coNguoi
                              ? 'border-emerald-600 bg-emerald-500'
                              : g.coNC
                                ? 'border-dashed border-slate-300 bg-white'
                                : 'border-dashed border-amber-400 bg-amber-100'
                          }`}
                        />
                      ))}
                    </div>
                  ),
                )}
              </div>
            )}

            <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
              {c.choTrong > 0 && <span>{c.choTrong} chỗ trống</span>}
              {c.chuaNC > 0 && <span className="text-amber-700">{c.chuaNC} chưa gán nguyên công</span>}
              {c.homTruoc > 0 && <span>hôm trước {c.homTruoc} người</span>}
            </p>

            <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
              <p className="min-w-0 truncate text-xs text-slate-600">
                {c.lenh ? (
                  <>
                    {c.lenh}
                    {c.ca ? <span className="text-slate-400"> · {c.ca}</span> : null}
                  </>
                ) : (
                  <span className="text-amber-700">Chưa chọn lệnh sản xuất</span>
                )}
              </p>
              <span className="shrink-0 text-sm font-semibold text-brand-700 group-hover:translate-x-0.5">
                Mở chuyền →
              </span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
