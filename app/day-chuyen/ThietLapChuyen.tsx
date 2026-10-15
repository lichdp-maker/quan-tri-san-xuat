'use client'

import { useTransition } from 'react'
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

export type Tab = 'lenh' | 'nguyencong' | 'chuyen'


/**
 * Bảng cài đặt chuyền (lệnh & ca, nguyên công, thông tin chuyền).
 * Chỉ là hộp thoại — trang xếp chỗ tự quyết khi nào mở và mở ở tab nào.
 */
export default function ThietLapChuyen({
  line,
  lenhs,
  cas,
  tos,
  ncTatCa,
  ncDangChon,
  duocSuaChuyen,
  tab,
  setTab,
}: {
  line: { id: string; ten: string; ma: string; soGhe: number; teamId: string | null; loai: string; orderId: string | null; shiftId: string | null }
  lenhs: LenhChon[]
  cas: Chon[]
  tos: Chon[]
  ncTatCa: NC[]
  ncDangChon: string[]
  duocSuaChuyen: boolean
  tab: Tab | null
  setTab: (t: Tab | null) => void
}) {
  const [dangLuu, batDau] = useTransition()

  function luu(fd: FormData, viec: () => Promise<void>) {
    batDau(async () => {
      await viec()
      setTab(null)
    })
  }

  return (
    <>
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
