'use client'

import { useState, useTransition } from 'react'
import { datLenhChoDayChuyen, doiDayChuyen } from './actions'
import NguyenCongCuaChuyen from './NguyenCongCuaChuyen'

type Chon = { id: string; ten: string }
type LenhChon = { id: string; nhan: string }

type NC = {
  id: string
  ma: string
  ten: string
  giay: number
  sanPham: string
  maSanPham: string
  boPhan: string
}

export type DangChay = {
  ma: string
  sanPham: string
  maSanPham: string
  soLuong: number
  donVi: string
  xong: number
  soNguyenCongLenh: number
}

type Tab = 'lenh' | 'nguyencong' | 'chuyen'

const TEN_LOAI: Record<string, string> = { CHUYEN: 'Băng chuyền', BAN: 'Dãy bàn', MAY: 'Máy' }

export default function ThietLapChuyen({
  line,
  lenhs,
  cas,
  tos,
  dangChay,
  tenCa,
  ncTatCa,
  ncDangChon,
  daXep,
  tongGhe,
  duocSuaChuyen,
}: {
  line: { id: string; ten: string; ma: string; soGhe: number; teamId: string | null; loai: string; orderId: string | null; shiftId: string | null }
  lenhs: LenhChon[]
  cas: Chon[]
  tos: Chon[]
  dangChay: DangChay | null
  tenCa: string | null
  ncTatCa: NC[]
  ncDangChon: string[]
  daXep: number
  tongGhe: number
  duocSuaChuyen: boolean
}) {
  const [tab, setTab] = useState<Tab | null>(null)
  const [dangLuu, batDau] = useTransition()

  const xongLenh = !!line.orderId && !!line.shiftId
  const xongNC = ncDangChon.length > 0
  const xongXep = daXep > 0 && daXep >= tongGhe

  const pt =
    dangChay && dangChay.soLuong > 0
      ? Math.min(100, Math.round((dangChay.xong / dangChay.soLuong) * 100))
      : 0

  function luu(fd: FormData, viec: () => Promise<void>) {
    batDau(async () => {
      await viec()
      setTab(null)
    })
  }

  return (
    <>
      {/* ---------- Thẻ tóm tắt chuyền ---------- */}
      <section className="the mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold leading-tight">{line.ten}</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {TEN_LOAI[line.loai] ?? line.loai} · {tongGhe} chỗ · mã {line.ma}
            </p>
          </div>
          <button onClick={() => setTab('lenh')} className="nut-phu shrink-0">
            ⚙ Cài đặt chuyền
          </button>
        </div>

        {/* Lệnh đang chạy */}
        {dangChay ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="min-w-0">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Đang sản xuất
                </span>
                <span className="block truncate font-semibold leading-tight">
                  {dangChay.sanPham}
                </span>
                <span className="text-xs text-slate-500">
                  Lệnh {dangChay.ma} · {dangChay.maSanPham} · {dangChay.soNguyenCongLenh} nguyên
                  công{tenCa ? ` · ${tenCa}` : ''}
                </span>
              </p>
              <p className="shrink-0 text-sm tabular-nums text-slate-700">
                <strong>{dangChay.xong.toLocaleString('vi-VN')}</strong>
                <span className="text-slate-400">
                  {' '}
                  / {dangChay.soLuong.toLocaleString('vi-VN')} {dangChay.donVi}
                </span>
                <span className="ml-2 text-slate-500">còn {(dangChay.soLuong - dangChay.xong).toLocaleString('vi-VN')}</span>
              </p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-brand-600" style={{ width: `${pt}%` }} />
            </div>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
            <p className="text-sm text-amber-900">
              <strong>Chưa chọn lệnh sản xuất.</strong> Chọn lệnh thì mới có nguyên công để gán cho
              từng chỗ ngồi.
            </p>
            <button onClick={() => setTab('lenh')} className="nut-nho shrink-0">
              Chọn lệnh
            </button>
          </div>
        )}

        {/* Ba bước thao tác */}
        <ol className="mt-3 grid gap-2 sm:grid-cols-3">
          <Buoc
            so={1}
            ten="Lệnh và ca"
            phu={xongLenh ? `${dangChay?.ma ?? ''} · ${tenCa ?? ''}` : 'chưa chọn'}
            xong={xongLenh}
            bam={() => setTab('lenh')}
          />
          <Buoc
            so={2}
            ten="Nguyên công của chuyền"
            phu={
              xongNC
                ? `${ncDangChon.length} nguyên công`
                : 'chưa giới hạn — hiện mọi nguyên công của lệnh'
            }
            xong={xongNC}
            bam={duocSuaChuyen ? () => setTab('nguyencong') : undefined}
          />
          <Buoc
            so={3}
            ten="Xếp người vào chỗ"
            phu={`${daXep}/${tongGhe} chỗ đã có người`}
            xong={xongXep}
            href="#so-do-cho-ngoi"
          />
        </ol>
      </section>

      {/* ---------- Bảng cài đặt ---------- */}
      {tab && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setTab(null)} />
          <div className="relative flex max-h-[90dvh] w-full max-w-3xl flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <p className="min-w-0 truncate font-semibold">Cài đặt chuyền {line.ten}</p>
              <button onClick={() => setTab(null)} aria-label="Đóng" className="nut-phu px-2.5 py-1">
                ✕
              </button>
            </div>

            <div className="flex gap-1.5 overflow-x-auto border-b border-slate-200 px-4 py-2">
              <TabNut dang={tab === 'lenh'} bam={() => setTab('lenh')}>
                1 · Lệnh và ca
              </TabNut>
              {duocSuaChuyen && (
                <>
                  <TabNut dang={tab === 'nguyencong'} bam={() => setTab('nguyencong')}>
                    2 · Nguyên công
                  </TabNut>
                  <TabNut dang={tab === 'chuyen'} bam={() => setTab('chuyen')}>
                    Thông tin chuyền
                  </TabNut>
                </>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {tab === 'lenh' && (
                <form
                  key={`lenh-${line.id}`}
                  action={(fd) => luu(fd, () => datLenhChoDayChuyen(fd))}
                  className="flex flex-col gap-3"
                >
                  <input type="hidden" name="lineId" value={line.id} />
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-600">Lệnh sản xuất</span>
                    <select name="orderId" defaultValue={line.orderId ?? ''} className="o-chon">
                      <option value="">— chưa chọn —</option>
                      {lenhs.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.nhan}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-600">Ca làm việc</span>
                    <select name="shiftId" defaultValue={line.shiftId ?? ''} className="o-chon">
                      <option value="">— chưa chọn —</option>
                      {cas.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.ten}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="text-xs text-slate-500">
                    Đổi lệnh không xoá chỗ ngồi đã xếp, nhưng nguyên công gán cho từng chỗ sẽ phải
                    chọn lại theo lệnh mới.
                  </p>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setTab(null)} className="nut-phu">
                      Đóng
                    </button>
                    <button disabled={dangLuu} className="nut-nho">
                      {dangLuu ? 'Đang lưu…' : 'Lưu lệnh và ca'}
                    </button>
                  </div>
                </form>
              )}

              {tab === 'nguyencong' && duocSuaChuyen && (
                <NguyenCongCuaChuyen
                  nhung
                  lineId={line.id}
                  tenChuyen={line.ten}
                  duocSua={duocSuaChuyen}
                  dangChon={ncDangChon}
                  tatCa={ncTatCa}
                  xongThi={() => setTab(null)}
                />
              )}

              {tab === 'chuyen' && duocSuaChuyen && (
                <form
                  key={`sua-${line.id}`}
                  action={(fd) => luu(fd, () => doiDayChuyen(fd))}
                  className="flex flex-col gap-3"
                >
                  <input type="hidden" name="lineId" value={line.id} />
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-600">Tên chuyền</span>
                    <input name="name" required defaultValue={line.ten} className="o-nhap py-2" />
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-slate-600">Số chỗ ngồi</span>
                      <input
                        name="soGhe"
                        defaultValue={String(line.soGhe)}
                        inputMode="numeric"
                        className="o-nhap w-24 py-2 text-center"
                      />
                    </label>
                    <label className="flex flex-1 flex-col gap-1">
                      <span className="text-xs font-medium text-slate-600">Tổ phụ trách</span>
                      <select name="teamId" defaultValue={line.teamId ?? ''} className="o-chon">
                        <option value="">— chung —</option>
                        {tos.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.ten}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-slate-600">Kiểu vị trí</span>
                      <select name="loai" defaultValue={line.loai} className="o-chon w-40">
                        <option value="CHUYEN">Băng chuyền</option>
                        <option value="BAN">Dãy bàn</option>
                        <option value="MAY">Máy</option>
                      </select>
                    </label>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" name="conDung" value="co" defaultChecked />
                    Còn dùng
                  </label>
                  <p className="text-xs text-slate-500">
                    Bỏ tích “Còn dùng” thì chuyền bị ẩn khỏi danh sách, số liệu cũ vẫn giữ nguyên.
                    Giảm số chỗ chỉ bỏ được những chỗ chưa có ai ngồi.
                  </p>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setTab(null)} className="nut-phu">
                      Đóng
                    </button>
                    <button disabled={dangLuu} className="nut-nho">
                      {dangLuu ? 'Đang lưu…' : 'Lưu thông tin chuyền'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function TabNut({
  dang,
  bam,
  children,
}: {
  dang: boolean
  bam: () => void
  children: React.ReactNode
}) {
  return (
    <button onClick={bam} className={dang ? 'chip-bat shrink-0' : 'chip-tat shrink-0'}>
      {children}
    </button>
  )
}

function Buoc({
  so,
  ten,
  phu,
  xong,
  bam,
  href,
}: {
  so: number
  ten: string
  phu: string
  xong: boolean
  bam?: () => void
  href?: string
}) {
  const bamDuoc = !!bam || !!href
  const noiDung = (
    <>
      <span
        className={[
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
          xong ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600',
        ].join(' ')}
      >
        {xong ? '✓' : so}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium leading-tight">{ten}</span>
        <span className="block truncate text-xs text-slate-500">{phu}</span>
      </span>
    </>
  )
  const lop =
    'flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition ' +
    (xong ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-white') +
    (bamDuoc ? ' hover:border-brand-400 hover:bg-brand-50/50' : '')

  return (
    <li className="min-w-0">
      {href ? (
        <a href={href} className={lop}>
          {noiDung}
        </a>
      ) : bam ? (
        <button onClick={bam} className={lop}>
          {noiDung}
        </button>
      ) : (
        <div className={lop}>{noiDung}</div>
      )}
    </li>
  )
}
