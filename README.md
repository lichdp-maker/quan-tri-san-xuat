# Hệ thống theo dõi sản xuất — khung dự án

Tầng dữ liệu đã dựng xong theo định mức thật của G6 và GS06 V2. Phần giao diện dựng tiếp ở bước sau.

## Đã có trong này

| File | Nội dung |
|---|---|
| `prisma/schema.prisma` | Toàn bộ mô hình dữ liệu: người dùng, tổ, sản phẩm → bộ phận → nguyên công, ca & mốc giờ, lệnh sản xuất, phân công, bản ghi theo mốc giờ, sai hỏng, nhật ký |
| `prisma/dinh-muc.json` | **83 nguyên công** với định mức giây, trích thẳng từ file kế hoạch: G6 25 nguyên công / 1.050s; GS06 V2 gồm đầu báo khói 20/563s, đầu báo nhiệt 14/322s, chuông đèn 17/487s, bao gói 7/339s = 1.711s/bộ |
| `prisma/seed.ts` | Nạp định mức, ca + 5 mốc giờ (9h30, 11h40, 14h30, 16h20, 19h40), 7 lý do dừng máy, 10 loại lỗi, 9 nhóm nguyên nhân, tài khoản mẫu |
| `lib/productivity.ts` | Công thức năng suất dùng chung cho mọi màn hình và báo cáo |
| `package.json`, `.env.example` | Phụ thuộc và biến môi trường |

## Cài đặt (chạy trên máy của bạn)

```bash
# 1. Tạo database trên Neon, copy 2 chuỗi kết nối vào .env
cp .env.example .env

# 2. Cài phụ thuộc
npm install

# 3. Tạo bảng và nạp dữ liệu nền
npx prisma migrate dev --name init
npx prisma db seed

# 4. Xem dữ liệu đã nạp
npx prisma studio
```

Tài khoản mẫu sau khi seed: `GD01`, `PGD01`, `QLX01`, `KT01`, `KTE01`, `KHO01`, `TT01` (mật khẩu `doi-mat-khau`), `CN001`, `CN002` (PIN `123456`). **Đổi toàn bộ trước khi dùng thật.**

## Cần kiểm tra lại trong `prisma/seed.ts`

1. **Nghỉ giữa khoảng của mốc giờ** — hiện đặt: nghỉ trưa 60 phút nằm trong khoảng 11h40–14h30, nghỉ tối 30 phút trong khoảng 16h20–19h40. Sửa `breakMinutes` cho khớp thực tế.
2. **Giờ bắt đầu ca** đang để 08:00, khớp với file kế hoạch.
3. **Nguyên công "In laze" của G6** (0 giây, ghi chú *bỏ, không in tại nhà máy*) được nạp với `isActive = false` — không hiện khi phân công, không tính năng suất.
4. **Loại lỗi và nguyên nhân** là danh mục khởi điểm do tôi đề xuất theo đặc thù lắp ráp điện tử; kỹ thuật nên rà lại trước khi chạy thật.

## Bước tiếp theo

1. Xác thực đăng nhập bằng mã nhân viên + PIN
2. Màn hình nhập liệu của công nhân theo mốc giờ (mobile)
3. Màn hình phân công + duyệt số của tổ trưởng
4. Dashboard tiến độ lệnh và bảng năng suất
