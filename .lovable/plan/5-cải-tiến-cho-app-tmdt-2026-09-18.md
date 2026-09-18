# 5 cải tiến cho App_TMDT

## 1. Tự động định dạng số tiền + tự điền "bằng chữ"

Hiện `FieldGroupEditor` đã format khi gõ và cập nhật ô "bằng chữ" lúc lưu. Sẽ chuẩn hoá lại:

- Ô "bằng chữ" cập nhật **ngay khi gõ** (hiển thị tức thì trong ô tương ứng), không chờ lưu.
- Ô "bằng chữ" chuyển thành chỉ đọc (tự sinh) để tránh lệch số/chữ.
- Áp dụng cùng logic cho các form nhập tiền khác: Thanh toán, Data Center của gói thầu, thông tin gói thầu (giá gói/giá trúng thầu).

## 2. Nút xóa trong Gói thầu + siết quyền về Admin

- Trang danh sách gói thầu: nút xóa từng gói (xóa kèm các bước, nguồn dữ liệu, dữ liệu trung tâm, nhà thầu của gói).
- Trang chi tiết gói thầu: xóa từng bước trong checklist, từng nguồn dữ liệu, từng nhà thầu, từng mục dữ liệu trung tâm.
- Mọi thao tác xóa trong toàn app chuyển điều kiện từ `canWrite` sang `isAdmin`: xóa trường dữ liệu (`FieldGroupEditor`), xóa trùng lắp trường ở tab Dữ liệu, xóa nhà thầu, xóa nguồn dữ liệu, xóa mẫu văn bản/ánh xạ, xóa hồ sơ nhân sự nếu có.
- Dùng `AlertDialog` (shadcn) xác nhận trước khi xóa, thay cho `window.confirm`.
- Bổ sung quy tắc ở cơ sở dữ liệu: chỉ tài khoản admin được xóa các bảng nghiệp vụ chính.

## 3. Chọn ngày bằng lịch thay vì gõ tay

- Thêm component dùng chung `DateField` (Popover + Calendar), hiển thị và lưu theo `dd/mm/yyyy` đúng như hiện nay.
- Nhận diện trường ngày qua tiền tố `Date_` hoặc nhãn bắt đầu bằng "Ngày"; `FieldGroupEditor` tự render lịch cho các trường này.
- Các ô ngày khác trong app (tạo gói thầu, hợp đồng, thanh toán) chuyển sang cùng component.

## 4. Làm mới biểu mẫu sau khi xuất file

- Sau khi tải file Word thành công, hiện hộp xác nhận "Đã xuất xong — xóa dữ liệu để nhập hồ sơ mới?".
- Nếu đồng ý: toàn bộ giá trị các trường của hồ sơ đó về trống (giữ nguyên danh sách trường), sẵn sàng nhập hồ sơ mới.
- Bản đã xuất luôn được lưu vào lịch sử trước khi xóa, nên dữ liệu không mất.

Giả định: chỉ xóa **giá trị**, không xóa hồ sơ hay danh sách trường. Nếu bạn muốn tự động xóa không cần hỏi, tôi bỏ bước xác nhận.

## 5. Lịch sử xuất file và mở lại để chỉnh sửa

- Thêm bảng `export_history`: tên file, mẫu dùng, thời điểm, người xuất, `tender_id`, `document_id`, và ảnh chụp dữ liệu (JSON) đã dùng.
- Mỗi lần xuất/tải file ở tab Dữ liệu, Thanh toán, bước gói thầu đều ghi một dòng lịch sử.
- Trang mới "Lịch sử xuất file": nhóm theo gói thầu là đầu mục chính, trong mỗi gói liệt kê các lần xuất theo thời gian.
- Mở lại một bản đã xuất: xem bảng dữ liệu đã dùng, sửa trực tiếp, xem trước và xuất lại (lần xuất lại tạo bản ghi lịch sử mới).
- Chỉ admin được xóa bản ghi lịch sử.

## Chi tiết kỹ thuật

- Migration: bảng `public.export_history` (id, tender_id → tenders, document_id → documents, template_id → templates, file_name, module, data jsonb, exported_by, created_at/updated_at) + GRANT + RLS (đọc: người dùng đã đăng nhập; tạo: `can_write`; sửa/xóa: `has_role(auth.uid(),'admin')`).
- Rà soát và thêm policy DELETE theo admin cho `tenders`, `tender_steps`, `tender_sources`, `tender_contractors`, `tender_data`, `document_fields`, `contractors`.
- Component mới: `src/components/DateField.tsx`, `src/components/ConfirmDelete.tsx`, `src/lib/export-history.ts`.
- Route mới: `src/routes/_app/lich-su-xuat.tsx` (+ mục trong sidebar).
- Dùng lại `formatThousands`, `readVietnameseMoney`, `moneyTextKey` trong `src/lib/money.ts`; không tạo hệ màu/component UI mới.

## Thứ tự triển khai

1. Migration + quyền xóa.
2. Số tiền và lịch chọn ngày.
3. Nút xóa trong gói thầu, đồng bộ quyền admin.
4. Lịch sử xuất file + làm mới biểu mẫu.
