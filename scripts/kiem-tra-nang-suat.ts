/**
 * Kiểm chứng công thức năng suất bằng số liệu định mức thật.
 * Chạy: npm run test:nangsuat
 */
import { calcEntry, qualityRate, slotMinutes, validateSlotAllocation } from '../lib/productivity'

let loi = 0

function kiemTra(ten: string, thuc: unknown, mong: unknown) {
  const ok = JSON.stringify(thuc) === JSON.stringify(mong)
  if (!ok) loi++
  console.log(`${ok ? 'OK  ' : 'SAI '} ${ten}${ok ? '' : ` — nhận ${JSON.stringify(thuc)}, cần ${JSON.stringify(mong)}`}`)
}

// Độ dài các mốc giờ thật: 9h30 - 11h40 - 14h30 - 16h20 - 19h40
kiemTra('mốc 08:00-09:30', slotMinutes('08:00', '09:30'), 90)
kiemTra('mốc 09:30-11:40', slotMinutes('09:30', '11:40'), 130)
kiemTra('mốc 11:40-14:30 trừ nghỉ trưa 60', slotMinutes('11:40', '14:30', 60), 110)
kiemTra('mốc 14:30-16:20', slotMinutes('14:30', '16:20'), 110)
kiemTra('mốc 16:20-19:40 trừ nghỉ tối 30', slotMinutes('16:20', '19:40', 30), 170)

// G6 nguyên công "Lắp bo mạch vào vỏ" = 113 giây/sp
const g6 = 113
kiemTra(
  'G6 113s: 60 sp trong 130 phút -> chưa đạt',
  calcEntry({ qtyOk: 60, standardSeconds: g6, workedMinutes: 130 }).isAchieved,
  false,
)
kiemTra(
  'G6 113s: 60 sp trong 130 phút -> 86.92%',
  calcEntry({ qtyOk: 60, standardSeconds: g6, workedMinutes: 130 }).performance,
  86.92,
)
kiemTra(
  'G6 113s: 60 sp, 130 phút, dừng 20 -> đạt (trừ thời gian dừng)',
  calcEntry({ qtyOk: 60, standardSeconds: g6, workedMinutes: 130, downtimeMinutes: 20 }).isAchieved,
  true,
)

// GS06 V2 bao gói "Lắp đế, bọc túi CPE" = 120 giây/bộ
const bg = 120
kiemTra(
  'GS06 120s: đúng 100% thì CHƯA đạt (ngưỡng là trên 100%)',
  calcEntry({ qtyOk: 55, standardSeconds: bg, workedMinutes: 110 }).isAchieved,
  false,
)
kiemTra(
  'GS06 120s: 56 bộ trong 110 phút -> đạt',
  calcEntry({ qtyOk: 56, standardSeconds: bg, workedMinutes: 110 }).isAchieved,
  true,
)

// Trường hợp không tính được
kiemTra(
  'nguyên công đã bỏ (định mức 0) -> không xếp loại',
  calcEntry({ qtyOk: 10, standardSeconds: 0, workedMinutes: 60 }).isAchieved,
  null,
)
kiemTra(
  'dừng hết cả mốc -> không xếp loại',
  calcEntry({ qtyOk: 0, standardSeconds: g6, workedMinutes: 60, downtimeMinutes: 60 }).isAchieved,
  null,
)

// Sản phẩm hỏng không được tính vào giờ chuẩn
kiemTra(
  'hỏng không cộng vào giờ chuẩn',
  calcEntry({ qtyOk: 50, standardSeconds: g6, workedMinutes: 130 }).earnedSeconds,
  50 * g6,
)
kiemTra('tỷ lệ đạt 50/(50+2)', qualityRate(50, 2), 96.15)

// Một người nhiều nguyên công trong một mốc: tổng phút không vượt độ dài mốc
kiemTra(
  'tổng 140 phút trong mốc 130 phút -> chặn',
  validateSlotAllocation([{ workedMinutes: 90 }, { workedMinutes: 50 }], 130).ok,
  false,
)
kiemTra(
  'tổng 130 phút trong mốc 130 phút -> cho qua',
  validateSlotAllocation([{ workedMinutes: 80 }, { workedMinutes: 50 }], 130).ok,
  true,
)

console.log(loi === 0 ? '\nTất cả đều đúng.' : `\n${loi} phép kiểm tra sai.`)
process.exit(loi === 0 ? 0 : 1)
