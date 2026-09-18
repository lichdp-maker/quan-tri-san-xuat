# Hệ thống theo dõi sản xuất — Đặc tả kỹ thuật (v1)

> Phạm vi giai đoạn 1: **Lõi sản xuất + Quản lý sai hỏng chi tiết**
> Stack: Next.js (App Router) + PostgreSQL (Neon) + Prisma, deploy qua GitHub → Vercel
> Quy mô: ~100 người dùng đồng thời ở mức thấp (đỉnh vào các mốc giờ chốt số)

---

## 1. Quyết định nền tảng đã chốt

| Vấn đề | Quyết định |
|---|---|
| Công nhân nhập liệu | Mỗi người 1 tài khoản, nhập trên điện thoại (mobile-first, PWA) |
| Định mức | **Đã có sẵn**, tính bằng **giây/đơn vị** — G6: 25 nguyên công / 1.050s; GS06 V2: 58 nguyên công / 1.711s một bộ |
| Đánh giá năng suất | **Theo từng nguyên công**, đạt khi **> 100%**; chỉ tiêu sản lượng ca là phụ |
| Mốc giờ | 5 mốc: **9h30 – 11h40 – 14h30 – 16h20 – 19h40**, nhập sản lượng **làm được trong khoảng** (không lũy kế) |
| Một người, nhiều việc | Một công nhân có thể làm **nhiều nguyên công và nhiều lệnh** trong cùng một mốc |
| Thời gian dừng | Có ở một số nguyên công → mỗi bản ghi có phút dừng + lý do, trừ ra trước khi tính năng suất |
| Phạm vi v1 | Lõi sản xuất + phân loại sai hỏng / nguyên nhân / xử lý |
| Ngôn ngữ / múi giờ | Tiếng Việt, `Asia/Ho_Chi_Minh` |

> **Cấu trúc sản phẩm:** GS06 V2 là **bộ** gồm 3 bộ phận chạy song song (đầu báo khói 563s, đầu báo nhiệt 322s, chuông đèn 487s) rồi **bao gói** 339s chốt cuối. G6 là sản phẩm đơn, một luồng nguyên công. Vì vậy mô hình dữ liệu có thêm tầng **Bộ phận** giữa Sản phẩm và Nguyên công — xem `prisma/schema.prisma`.

---

## 2. Vai trò và quyền

8 vai trò, phân quyền theo **hành động × phạm vi dữ liệu**.

| Vai trò | Phạm vi dữ liệu | Quyền chính |
|---|---|---|
| **Công nhân** (`WORKER`) | Chỉ bản thân | Xem phân công của mình; nhập sản lượng đạt/hỏng theo mốc giờ; sửa bản ghi của mình khi chưa được duyệt; xem năng suất cá nhân |
| **Tổ trưởng** (`TEAM_LEADER`) | Tổ của mình | Gán công nhân vào nguyên công theo lệnh sản xuất; đặt chỉ tiêu ca; duyệt/sửa bản ghi của tổ; nhập hộ khi công nhân vắng; xem bảng năng suất tổ |
| **Nhân viên kỹ thuật** (`ENGINEER`) | Toàn xưởng | Khai báo sản phẩm, quy trình nguyên công, **định mức giờ công**; xử lý phiếu sai hỏng (nguyên nhân kỹ thuật, biện pháp khắc phục) |
| **Nhân viên kho** (`WAREHOUSE`) | Toàn xưởng | Xem lệnh sản xuất và tiến độ; xác nhận nhập thành phẩm cuối chuyền (v1 chỉ ghi nhận, chưa quản trị tồn kho) |
| **Nhân viên kinh tế** (`PLANNER`) | Toàn xưởng | Tạo và đóng lệnh sản xuất; gắn sản phẩm, số lượng, hạn giao; xuất báo cáo sản lượng (đơn giá/lương sản phẩm để giai đoạn 2) |
| **Quản lý xưởng** (`SHOP_MANAGER`) | Toàn xưởng | Toàn quyền vận hành: duyệt lệnh, điều chỉnh phân công liên tổ, cấu hình mốc giờ, phê duyệt phiếu sai hỏng, xem mọi báo cáo |
| **Phó giám đốc** (`DEPUTY_DIRECTOR`) | Toàn công ty | Chỉ đọc + phê duyệt cấp cao; dashboard tổng hợp, cảnh báo chậm tiến độ |
| **Giám đốc** (`DIRECTOR`) | Toàn công ty | Chỉ đọc; dashboard tổng hợp, xu hướng, xếp hạng năng suất |

**Nguyên tắc kỹ thuật:** phân quyền kiểm tra ở **server** (middleware + kiểm tra trong mỗi Server Action / Route Handler), không chỉ ẩn nút ở giao diện. Mỗi truy vấn dữ liệu đều kèm điều kiện phạm vi (`teamId`, `userId`).

### Đăng nhập
- Công nhân: **mã nhân viên + PIN 6 số**, nhớ đăng nhập 30 ngày trên điện thoại (không phải gõ lại mỗi ca).
- Từ tổ trưởng trở lên: mã nhân viên + mật khẩu, khuyến nghị bật xác thực 2 bước cho cấp quản lý.
- Toàn bộ session dùng cookie HttpOnly, không lưu token trong `localStorage`.

---

## 3. Mô hình dữ liệu

### 3.1 Sơ đồ quan hệ (rút gọn)

```
Product 1─n Operation (nguyên công, có seq + định mức phút/đơn vị)
   │
   └─ 1─n ProductionOrder (lệnh sản xuất)
              │
              └─ 1─n OrderOperation (nguyên công của lệnh: targetQty, doneQty)
                        │
                        └─ 1─n Assignment (phân công: ai làm, ca nào, chỉ tiêu ca)
                                  │
                                  └─ 1─n ProductionEntry (nhập theo mốc giờ: qtyOk, qtyDefect)
                                            │
                                            └─ 1─n DefectRecord (loại lỗi, nguyên nhân, số lượng)
```

### 3.2 Prisma schema (khởi điểm)

```prisma
// ===== Người dùng & tổ chức =====
enum Role {
  WORKER
  TEAM_LEADER
  ENGINEER
  WAREHOUSE
  PLANNER
  SHOP_MANAGER
  DEPUTY_DIRECTOR
  DIRECTOR
}

model User {
  id           String   @id @default(cuid())
  employeeCode String   @unique            // mã nhân viên, dùng để đăng nhập
  fullName     String
  role         Role
  passwordHash String                       // PIN (công nhân) hoặc mật khẩu, hash argon2
  teamId       String?
  team         Team?    @relation(fields: [teamId], references: [id])
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())

  assignments      Assignment[]
  entriesCreated   ProductionEntry[] @relation("EntryCreatedBy")
  entriesApproved  ProductionEntry[] @relation("EntryApprovedBy")

  @@index([teamId, isActive])
}

model Team {                                // tổ sản xuất
  id       String  @id @default(cuid())
  code     String  @unique
  name     String
  leaderId String?
  members  User[]
  isActive Boolean @default(true)
}

// ===== Sản phẩm & quy trình =====
model Product {
  id        String      @id @default(cuid())
  code      String      @unique
  name      String
  unit      String      @default("cái")
  isActive  Boolean     @default(true)
  operations Operation[]
  orders     ProductionOrder[]
}

model Operation {                           // nguyên công thuộc sản phẩm
  id              String  @id @default(cuid())
  productId       String
  product         Product @relation(fields: [productId], references: [id])
  seq             Int                       // thứ tự trong quy trình: 10, 20, 30...
  code            String
  name            String
  standardMinutes Decimal @db.Decimal(10,3) // ĐỊNH MỨC: phút/đơn vị — gốc tính năng suất
  unitPrice       Decimal? @db.Decimal(12,2) // đơn giá nguyên công (giai đoạn 2: lương SP)
  isActive        Boolean @default(true)

  orderOperations OrderOperation[]

  @@unique([productId, seq])
  @@index([productId, isActive])
}

// ===== Lệnh sản xuất =====
enum OrderStatus { DRAFT RELEASED IN_PROGRESS COMPLETED CLOSED CANCELLED }

model ProductionOrder {
  id         String      @id @default(cuid())
  code       String      @unique            // số lệnh sản xuất
  productId  String
  product    Product     @relation(fields: [productId], references: [id])
  quantity   Int                            // số lượng lệnh
  priority   Int         @default(0)
  dueDate    DateTime?
  status     OrderStatus @default(DRAFT)
  note       String?
  createdById String
  createdAt  DateTime    @default(now())
  releasedAt DateTime?
  closedAt   DateTime?

  operations OrderOperation[]

  @@index([status, dueDate])
}

model OrderOperation {                      // nguyên công cụ thể của 1 lệnh
  id              String  @id @default(cuid())
  orderId         String
  order           ProductionOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)
  operationId     String
  operation       Operation @relation(fields: [operationId], references: [id])
  seq             Int
  targetQty       Int                        // thường = order.quantity
  standardMinutes Decimal @db.Decimal(10,3)  // COPY từ Operation lúc phát lệnh (chốt định mức)
  doneQtyOk       Int     @default(0)        // cache, cập nhật khi duyệt bản ghi
  doneQtyDefect   Int     @default(0)

  assignments Assignment[]

  @@unique([orderId, seq])
  @@index([orderId])
}
```

```prisma
// ===== Mốc giờ (cấu hình được) =====
model Shift {                               // ca làm việc
  id        String @id @default(cuid())
  code      String @unique                  // CA1, CA2, CA3
  name      String
  startTime String                          // "07:30"
  endTime   String                          // "16:30"
  isActive  Boolean @default(true)
  timeSlots TimeSlot[]
}

model TimeSlot {                            // mốc chốt số trong ca — THÊM/SỬA ĐƯỢC
  id        String  @id @default(cuid())
  shiftId   String
  shift     Shift   @relation(fields: [shiftId], references: [id])
  seq       Int                             // 1, 2, 3...
  label     String                          // "9h30", "11h30", "14h00", "16h30"
  startTime String                          // mốc trước (khoảng bắt đầu)
  endTime   String                          // mốc này
  graceMinutes Int  @default(30)            // trễ quá mức này thì báo "chưa nhập"
  isActive  Boolean @default(true)

  entries ProductionEntry[]

  @@unique([shiftId, seq])
}
```

> **Quan trọng:** thêm/sửa mốc giờ **không được sửa dữ liệu quá khứ**. Mỗi `ProductionEntry` lưu kèm `slotStartAt`/`slotEndAt` là mốc thật lúc nhập, nên báo cáo cũ giữ nguyên khi cấu hình đổi.

```prisma
// ===== Phân công & nhập liệu =====
model Assignment {                          // tổ trưởng gán công nhân vào nguyên công
  id               String   @id @default(cuid())
  orderOperationId String
  orderOperation   OrderOperation @relation(fields: [orderOperationId], references: [id], onDelete: Cascade)
  userId           String
  user             User     @relation(fields: [userId], references: [id])
  teamId           String
  shiftId          String
  workDate         DateTime @db.Date         // ngày làm việc
  plannedMinutes   Int      @default(480)    // giờ công dự kiến trong ca cho phân công này
  targetQty        Int?                      // chỉ tiêu ca (phụ, dùng khi chưa có định mức)
  assignedById     String
  createdAt        DateTime @default(now())

  entries ProductionEntry[]

  @@unique([orderOperationId, userId, workDate, shiftId])
  @@index([userId, workDate])
  @@index([teamId, workDate])
}

enum EntryStatus { PENDING APPROVED REJECTED }

model ProductionEntry {                     // công nhân post theo mốc giờ
  id           String   @id @default(cuid())
  assignmentId String
  assignment   Assignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
  timeSlotId   String
  timeSlot     TimeSlot @relation(fields: [timeSlotId], references: [id])
  workDate     DateTime @db.Date
  slotStartAt  DateTime                      // snapshot mốc giờ thật
  slotEndAt    DateTime
  qtyOk        Int                           // SẢN LƯỢNG TRONG KHOẢNG (không lũy kế)
  qtyDefect    Int      @default(0)
  workedMinutes Int                          // giờ công thực tế trong khoảng này
  note         String?
  status       EntryStatus @default(PENDING)
  createdById  String
  createdBy    User     @relation("EntryCreatedBy", fields: [createdById], references: [id])
  approvedById String?
  approvedBy   User?    @relation("EntryApprovedBy", fields: [approvedById], references: [id])
  approvedAt   DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  defects DefectRecord[]

  @@unique([assignmentId, timeSlotId, workDate])   // 1 người / 1 nguyên công / 1 mốc = 1 bản ghi
  @@index([workDate, status])
}

// ===== Sai hỏng =====
enum DefectDisposition { REWORK SCRAP USE_AS_IS RETURN_SUPPLIER PENDING }

model DefectType {
  id       String @id @default(cuid())
  code     String @unique
  name     String                            // "sai kích thước", "xước bề mặt", "mẻ dao"...
  group    String                            // nhóm lỗi: kích thước / bề mặt / lắp ráp / vật tư
  isActive Boolean @default(true)
  records  DefectRecord[]
}

model DefectCause {
  id       String @id @default(cuid())
  code     String @unique
  name     String                            // "dao mòn", "phôi lỗi", "thao tác sai", "chương trình sai"
  category String                            // CON NGƯỜI / MÁY / VẬT TƯ / PHƯƠNG PHÁP / ĐO LƯỜNG / MÔI TRƯỜNG
  isActive Boolean @default(true)
  records  DefectRecord[]
}

model DefectRecord {
  id            String @id @default(cuid())
  entryId       String
  entry         ProductionEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)
  defectTypeId  String
  defectType    DefectType @relation(fields: [defectTypeId], references: [id])
  qty           Int
  causeId       String?
  cause         DefectCause? @relation(fields: [causeId], references: [id])
  disposition   DefectDisposition @default(PENDING)
  photoUrl      String?
  engineerNote  String?                       // kỹ thuật điền khi xử lý
  resolvedById  String?
  resolvedAt    DateTime?

  @@index([defectTypeId])
  @@index([causeId])
}

model AuditLog {
  id         String   @id @default(cuid())
  userId     String
  action     String                           // CREATE_ENTRY / APPROVE_ENTRY / EDIT_ASSIGNMENT...
  entityType String
  entityId   String
  before     Json?
  after      Json?
  createdAt  DateTime @default(now())

  @@index([entityType, entityId])
  @@index([userId, createdAt])
}
```

---

## 4. Quy tắc nghiệp vụ

### 4.1 Tính năng suất (cốt lõi)

Đơn vị tính là **giây/đơn vị** đúng như bảng định mức công nghệ. Mỗi bản ghi = **một người × một nguyên công × một mốc giờ**:

```
Giây chuẩn làm được = qtyOk × standardSeconds
Phút công thực tế   = workedMinutes − downtimeMinutes
Năng suất (%)       = (giây chuẩn ÷ 60) ÷ phút công thực tế × 100
Đạt                 = Năng suất > targetPercent của nguyên công (mặc định 100)
```

- **Đánh giá theo từng nguyên công**, không gộp cả ca. Một người có thể đạt ở nguyên công này và không đạt ở nguyên công khác trong cùng một mốc — đó chính là thông tin cần cho tổ trưởng.
- Vì một người làm nhiều nguyên công trong một mốc, công nhân phải khai **số phút cho từng nguyên công**. Giao diện tự gợi ý chia đều phần thời gian còn lại của mốc, công nhân sửa lại nếu khác. Hệ thống chặn khi tổng phút khai vượt độ dài mốc.
- **Thời gian dừng** (chờ vật tư, hỏng máy, mất điện, chờ kiểm, set-up, họp) trừ khỏi phút công trước khi tính — người chờ vật tư không bị đánh giá không đạt oan.
- Số liệu gộp theo **người → tổ → nguyên công → lệnh → xưởng** dùng công thức tổng: Σ giây chuẩn ÷ Σ phút công. Chỉ dùng để xem xu hướng, **không** dùng để kết luận đạt/không đạt.
- Nguyên công `isActive = false` (ví dụ *In laze* của G6, định mức 0 giây, đã bỏ) không hiện khi phân công và không tính năng suất.
- Sản phẩm hỏng **không cộng** vào giây chuẩn, nhưng có thống kê riêng **tỷ lệ đạt = qtyOk / (qtyOk + qtyDefect)**.
- Công thức nằm ở một chỗ duy nhất: `lib/productivity.ts`. Mọi màn hình và báo cáo gọi hàm ở đó, không tự tính lại.

### 4.2 Nhập liệu theo mốc giờ
- Công nhân chỉ thấy phân công của mình trong ngày và **mốc giờ đang mở**.
- Mỗi mốc chỉ nhập **1 lần** (`@@unique`), nhập số làm được **trong khoảng**, không phải lũy kế.
- Quá `graceMinutes` mà chưa nhập → vào danh sách **"chưa chốt số"** của tổ trưởng, kèm cảnh báo.
- Nhập xong ở trạng thái `PENDING`; tổ trưởng **duyệt** thì mới cộng vào `doneQtyOk` của lệnh. (Có thể bật chế độ tự duyệt cho tổ đã ổn định.)
- Công nhân sửa được bản ghi của mình **khi chưa duyệt**; sau khi duyệt chỉ tổ trưởng trở lên sửa, mọi thay đổi ghi `AuditLog`.

### 4.3 Kiểm soát tính hợp lệ
- Tổng `qtyOk` của một nguyên công **không vượt** `targetQty` của lệnh.
- Nguyên công sau **không vượt** sản lượng đạt của nguyên công trước (chặn nhập khống): `doneQtyOk(seq n) ≤ doneQtyOk(seq n-1)`.
- Cảnh báo (không chặn) khi năng suất một mốc vượt **200%** — dấu hiệu nhập nhầm.
- Toàn bộ cập nhật `doneQtyOk` chạy trong **transaction**, tránh sai số khi nhiều người duyệt cùng lúc.

### 4.4 Sai hỏng
- Khi `qtyDefect > 0`, bắt buộc chọn **loại lỗi** và số lượng cho từng loại (tổng phải bằng `qtyDefect`).
- Nguyên nhân + hướng xử lý (sửa lại / phế / dùng nguyên trạng / trả NCC) do **kỹ thuật** hoặc **tổ trưởng** điền, có thể để sau.
- Hàng sửa lại (`REWORK`) khi hoàn thành được nhập bổ sung như một bản ghi đạt, đánh dấu nguồn từ phiếu lỗi.
- Báo cáo: **Pareto lỗi theo loại**, theo nguyên nhân, theo nguyên công, theo người, theo ca.

---

## 5. Màn hình theo vai trò

**Công nhân (điện thoại)** — 1 màn hình chính
- Thẻ "Hôm nay": nguyên công đang được giao, lệnh sản xuất, sản phẩm
- Nút lớn: **Nhập sản lượng** cho mốc giờ đang mở → 2 ô số (đạt / hỏng) → nếu có hỏng thì chọn loại lỗi
- Dải tiến trình các mốc trong ca (đã nhập / đang mở / sắp tới)
- Năng suất cá nhân hôm nay và trong tuần

**Tổ trưởng**
- Bảng phân công trong ngày: kéo công nhân vào nguyên công của lệnh, đặt chỉ tiêu ca
- Bảng chốt số theo mốc: ai đã nhập / chưa nhập, duyệt hàng loạt
- Bảng năng suất tổ theo người, đánh dấu đạt / không đạt
- Danh sách lỗi phát sinh trong tổ

**Kỹ thuật**
- Khai báo sản phẩm và quy trình nguyên công, nhập định mức
- Hàng chờ phiếu sai hỏng cần xác định nguyên nhân và hướng xử lý
- Thống kê lỗi theo nguyên công để đề xuất cải tiến

**Kinh tế**
- Tạo / phát hành / đóng lệnh sản xuất
- Báo cáo sản lượng theo lệnh, theo sản phẩm, theo kỳ; xuất Excel

**Kho**
- Tiến độ lệnh và danh sách thành phẩm chờ nhập kho; xác nhận nhập

**Quản lý xưởng**
- Dashboard xưởng: tiến độ tất cả lệnh đang chạy, lệnh trễ hạn, nút thắt (nguyên công tồn đọng nhiều nhất)
- Bảng xếp hạng năng suất theo tổ và theo người
- Cấu hình ca, mốc giờ, ngưỡng năng suất

**Phó giám đốc / Giám đốc**
- Một trang tổng hợp: sản lượng ngày/tuần/tháng, % hoàn thành kế hoạch, tỷ lệ đạt chất lượng, xu hướng năng suất, top và bottom năng suất, các lệnh có nguy cơ trễ

---

## 6. Chỉ số hệ thống phải trả lời được

Đúng 5 câu hỏi đã nêu, ánh xạ sang truy vấn:

| Câu hỏi | Nguồn dữ liệu |
|---|---|
| Lệnh số lượng bao nhiêu | `ProductionOrder.quantity` |
| Đã làm được bao nhiêu | `OrderOperation.doneQtyOk` theo từng nguyên công; tiến độ lệnh = nguyên công cuối / `quantity` |
| Ai làm vị trí nguyên công nào | `Assignment` (user × orderOperation × ngày × ca) |
| Ai đạt năng suất | `earnedMinutes / actualMinutes ≥ ngưỡng`, gộp theo `userId` và kỳ |
| Ai không đạt | như trên, lọc `< ngưỡng`, kèm số lỗi và số mốc chưa nhập |

Bổ sung nên có ngay từ v1: **nút thắt chuyền** (nguyên công có chênh lệch `doneQty` lớn nhất so với nguyên công trước) và **cảnh báo lệnh trễ hạn** (tốc độ hiện tại × ngày còn lại < số lượng còn lại).

---

## 7. Kiến trúc kỹ thuật

| Thành phần | Lựa chọn | Lý do |
|---|---|---|
| Framework | Next.js App Router + TypeScript | Một codebase cho cả giao diện và API, deploy thẳng lên Vercel |
| CSDL | Neon Postgres | Serverless, hợp với Vercel; có branch DB cho môi trường test |
| ORM | Prisma + Neon serverless driver | Cần bật **connection pooling** (chuỗi `-pooler`) vì serverless mở nhiều kết nối |
| Xác thực | Auth.js (Credentials) + argon2 | Mã nhân viên + PIN, cookie HttpOnly |
| Giao diện | Tailwind + shadcn/ui, mobile-first, PWA | Công nhân dùng điện thoại, cần nút to, ít thao tác |
| Biểu đồ | Recharts | Dashboard tiến độ và năng suất |
| Múi giờ | Lưu UTC, hiển thị `Asia/Ho_Chi_Minh` | Tránh lệch ngày khi chốt ca đêm |

**Lưu ý vận hành**
- Sóng wifi xưởng chập chờn: bật PWA + hàng đợi gửi lại khi mất mạng (giai đoạn 2 nếu v1 chưa kịp).
- 100 người nhập dồn vào mốc giờ → đỉnh tải ngắn; giữ transaction nhỏ, index đúng như schema trên là đủ.
- Sao lưu: Neon giữ point-in-time; thêm job xuất Excel sản lượng hàng tuần để có bản cứng.

---

## 8. Lộ trình

**Giai đoạn 1 — Nền (1–2 tuần)**
Khởi tạo dự án, schema, đăng nhập, quản lý người dùng/tổ, khai báo sản phẩm + nguyên công + định mức, cấu hình ca và mốc giờ.

**Giai đoạn 2 — Lõi sản xuất (2–3 tuần)**
Lệnh sản xuất, phân công của tổ trưởng, màn hình nhập liệu của công nhân, duyệt bản ghi, tiến độ lệnh.

**Giai đoạn 3 — Năng suất & sai hỏng (1–2 tuần)**
Tính năng suất mọi cấp, bảng đạt/không đạt, phân loại lỗi, nguyên nhân, hướng xử lý, Pareto lỗi.

**Giai đoạn 4 — Dashboard quản lý & chạy thử (1–2 tuần)**
Dashboard xưởng và ban giám đốc, cảnh báo trễ hạn và nút thắt, xuất Excel; chạy thử **1 tổ** trước khi mở toàn xưởng.

**Giai đoạn 5 (sau v1)**
Kho vật tư và bán thành phẩm; lương sản phẩm theo đơn giá nguyên công; hoạt động ngoại tuyến đầy đủ; quét QR lệnh sản xuất.

---

## 9. Trạng thái dữ liệu nền

Đã nạp từ file kế hoạch chạy đồng thời G6 / GS06 V2:

| Sản phẩm | Bộ phận | Số nguyên công | Định mức |
|---|---|---|---|
| G6 / G4 | Toàn bộ | 25 | 1.050 giây/sp = 17,5 phút |
| GS06 V2 | Đầu báo khói | 20 | 563 giây |
| GS06 V2 | Đầu báo nhiệt | 14 | 322 giây |
| GS06 V2 | Chuông đèn | 17 | 487 giây |
| GS06 V2 | Bao gói | 7 | 339 giây |
| **GS06 V2 — cả bộ** | | **58** | **1.711 giây/bộ = 28,5 phút** |

Toàn bộ nằm trong `prisma/dinh-muc.json`, nạp bằng `prisma/seed.ts`. Sửa định mức về sau làm ở màn hình kỹ thuật, và **không ảnh hưởng lệnh đang chạy** vì mỗi lệnh chụp lại định mức lúc phát lệnh (`OrderOperation.standardSeconds`).

### Còn cần xác nhận
1. **Nghỉ giữa khoảng của từng mốc**: đang đặt nghỉ trưa 60 phút trong khoảng 11h40–14h30 và nghỉ tối 30 phút trong khoảng 16h20–19h40. Con số này ảnh hưởng trực tiếp đến % năng suất.
2. **Giờ bắt đầu ca** đang lấy 08:00 theo file kế hoạch.
3. **Ngưỡng đạt** đang đặt 100% cho mọi nguyên công; có nguyên công nào cần ngưỡng khác không (ví dụ nguyên công mới, người mới học việc)?
4. **Danh mục loại lỗi và nguyên nhân** trong seed là đề xuất khởi điểm cho lắp ráp điện tử — kỹ thuật cần rà lại.
