# Quy tắc dự án — NHÀ MÁY THÔNG MINH EMIC (web theo dõi sản xuất)

File này Claude Code tự đọc mỗi khi mở dự án. Mọi thay đổi mã phải theo các quy tắc dưới đây.

## Công nghệ

- Next.js 15 App Router, React 19, Server Actions, TypeScript, Tailwind.
- Prisma 6 + Neon Postgres. Triển khai: GitHub → Vercel (tự build khi push nhánh `main`).
- Đặt tên biến, hàm, file bằng tiếng Việt không dấu (vd `ganNguoiVaoGhe`, `BanXepCho.tsx`). Chú thích và chữ trên giao diện bằng tiếng Việt có dấu.

## Giao diện — BẮT BUỘC theo skill điện thoại

Người dùng chính là công nhân và tổ trưởng dùng **điện thoại một tay ngoài xưởng**.

- Khi tạo hoặc sửa BẤT KỲ trang / component nào trong `app/` hay `components/`: đọc và làm theo skill **`thiet-ke-giao-dien-dien-thoai`** (`.claude/skills/thiet-ke-giao-dien-dien-thoai/SKILL.md`).
- Khi được nhờ soát, đánh giá, hoặc "làm cho dễ dùng hơn trên điện thoại": dùng skill **`soat-giao-dien-dien-thoai`** trước, báo lỗi, rồi mới sửa.
- Nếu đã cài skill **`web-design-guidelines`** (Vercel) hoặc **`ui-ux-pro-max`**: dùng thêm để soát chuẩn chung. Khi hai bên mâu thuẫn, quy tắc của skill điện thoại xưởng thắng (nút to hơn, chữ to hơn, ít chữ hơn).
- Bản gốc của hai skill nằm ở `docs/skills/` (có trong git); `.claude/skills/` chỉ là bản chép để Claude Code nạp. Sửa skill thì sửa ở `docs/skills/` rồi chép lại.
- Tái dùng lớp có sẵn trong `app/globals.css`: `.the`, `.nut-nho`, `.nut-phu`, `.chip-bat`, `.chip-tat`, `.o-nhap`, `.o-chon`. Không thêm thư viện giao diện mới khi chưa hỏi.

## Quyền và bảo mật

- Server action kiểm quyền bằng `batBuocQuyen('<MA_CHUC_NANG>')` (danh mục ở `lib/chuc-nang.ts`), không kiểm theo vai trò.
- Tổ trưởng chỉ thao tác trên tổ của mình: dùng `ngoaiPhamViTo(...)` trong `lib/quyen.ts`.
- Không bao giờ in, commit hay dán chuỗi kết nối Neon / `AUTH_SECRET`. `.env`, `.env.test`, `prisma/.thu-nghiem.json` không được commit.

## Dữ liệu

- Đổi `prisma/schema.prisma` thì phải kèm migration trong `prisma/migrations/` — nếu không, web trên Vercel sẽ sập vì thiếu cột.
- Không dùng `prisma migrate dev` trên cơ sở dữ liệu thật (có thể đòi reset). Dùng `migrate deploy`.

## Trước khi giao

1. `npx tsc --noEmit` phải sạch.
2. `npm test` phải qua.
3. `npm run build` phải qua (giống hệt Vercel).
4. Lệnh gửi cho người dùng là một khối PowerShell, dòng đầu tiên luôn là
   `cd "D:\Xưởng CNC\QUẢN LÝ SẢN PHẨM EMIC-GEIC\AI QUAN TRI NMTM"`, các bước đánh số `[1/n]`, dừng ngay khi có bước lỗi, chặn file bí mật trước khi commit.
