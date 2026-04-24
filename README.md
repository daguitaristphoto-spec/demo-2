# Speak Up Đại Nam 2026 - MVP chấm điểm vòng 1

Bộ mã nguồn này là **starter pack** cho web app chấm điểm vòng sơ loại của cuộc thi MC.

Phạm vi MVP hiện tại:
- Đăng nhập bằng email/password
- 2 vai trò: `admin`, `judge`
- Admin phân công **1 thí sinh = 1 giám khảo**
- Admin upload video lên hệ thống
- Giám khảo chỉ xem đúng thí sinh được phân công
- Video hiển thị ngay trong giao diện chấm
- Giám khảo lưu nháp / nộp phiếu
- Sau khi nộp, giám khảo **không sửa được** trừ khi admin mở lại
- Tính điểm tự động theo bảng điểm vòng 1

## Kiến trúc đề xuất
- Frontend/backend web: **Next.js App Router**
- Auth + Database + Storage: **Supabase**
- Phân quyền dữ liệu: **Row Level Security (RLS)**
- Video riêng tư: **Supabase Storage** + signed URL

## Khởi tạo dự án
Tạo một app Next.js mới rồi chép thư mục `src/` và file `.env.example` này vào:

```bash
npx create-next-app@latest speakup-admin --ts --tailwind --app
cd speakup-admin
npm install @supabase/supabase-js @supabase/ssr
```

Sau đó:
1. chép toàn bộ thư mục `src/` trong bộ starter này vào project
2. chép `.env.example` thành `.env.local`
3. tạo project Supabase
4. chạy file `src/database/schema.sql` trong SQL Editor của Supabase
5. tạo bucket storage tên `contestant-videos` (private bucket)
6. tạo user trong Supabase Auth, sau đó thêm bản ghi vào bảng `profiles`

## Biến môi trường
Tạo `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_VIDEO_BUCKET=contestant-videos
```

## Luồng nghiệp vụ
### 1. Admin
- tạo tài khoản judge trong Supabase Auth
- thêm `profiles.role = 'judge'`
- import thí sinh vào bảng `contestants`
- vào `/admin/assignments` để gán giám khảo
- vào `/admin/upload` để upload video cho từng thí sinh

### 2. Judge
- đăng nhập ở `/login`
- vào `/judge`
- chỉ thấy danh sách thí sinh của mình
- mở trang chấm để vừa xem video vừa nhập điểm
- lưu nháp hoặc nộp phiếu

### 3. Mở lại phiếu đã nộp
Admin sửa `assignments.can_edit = true` để cho phép chấm lại.

## Tính điểm
Mỗi nhóm tiêu chí được quy về thang 10 rồi nhân trọng số:

- Giọng nói: 25%
- Nội dung và tư duy khai thác: 20%
- Khả năng diễn đạt và dẫn dắt: 25%
- Phong thái và ngôn ngữ hình thể: 15%
- Dấu ấn cá nhân và sáng tạo: 15%

Công thức cuối cùng:

```ts
finalScore100 = (
  group1 * 0.25 +
  group2 * 0.20 +
  group3 * 0.25 +
  group4 * 0.15 +
  group5 * 0.15
) * 10
```

## Gợi ý mở rộng ở vòng sau
- import Excel danh sách thí sinh
- mở/khóa vòng thi theo ngày
- xuất Excel/PDF bảng điểm
- xếp hạng Top 20 tự động
- tích hợp điểm truyền thông / lượt tương tác fanpage
- audit log đầy đủ cho admin

## Lưu ý
Đây là starter pack MVP để bắt đầu triển khai nhanh. Khi đưa vào chạy thật, nên bổ sung thêm:
- xác thực email
- reset mật khẩu
- import/export Excel
- trang admin mở lại phiếu bằng nút bấm
- kiểm soát dung lượng video, định dạng file, và log thao tác
