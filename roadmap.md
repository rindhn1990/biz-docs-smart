# Roadmap cải tiến OfficeFlow

Nguồn: khảo sát app tham khảo xsanguyen5.lovable.app (11/09/2026) + nhu cầu thực tế của người dùng.
Nguyên tắc: không sửa code khi chưa chốt hạng mục; ưu tiên module hoá để dễ mở rộng (Nhân sự, Mua sắm, Tài sản, Công văn, Kế toán, Dự án).

## Trạng thái hiện tại (đã có)

- [x] App shell, sidebar mode-aware, auth + phân quyền theo vai trò (admin/user), trang Quản trị gán vai trò
- [x] Hồ sơ đấu thầu: danh sách, review 2 cột (PDF + form), lưu debounce/blur, confidence badge, bbox highlight
- [x] Mẫu văn bản: 5 tab hình thức, upload .docx, dò placeholder `{{}}`/`[[]]`, thêm/xoá mapping tay, chọn vùng bằng bôi đen văn bản, sửa tên/mô tả/hình thức, thay file Word, xoá mẫu (admin)
- [x] Tờ trình KHLCNT: docx mẫu sinh tự động, 39 trường / 5 nhóm, trang /du-lieu tổng hợp + xuất Word thật
- [x] Tab Hợp đồng nhân sự: employees / hợp đồng / tài liệu / review
- [x] Báo cáo đấu thầu: KPI trạng thái, tiến độ theo tháng, chất lượng nhận dạng, xuất CSV/Excel

## Giai đoạn 1 — Trải nghiệm lõi đấu thầu (học từ app tham khảo)

- [ ] **Checklist bước theo quy trình thật**: mỗi hồ sơ gói thầu gắn quy trình 18–19 bước (Công văn chủ trương → … → Quyết toán/thanh lý), mỗi bước có trạng thái, nút Upload/Mở/Duyệt, tiến độ "x/19 đã duyệt", nút "Sinh toàn bộ hồ sơ" + "Tải toàn bộ hồ sơ"
- [ ] **Editor từng bước 2 cột**: form dữ liệu bên trái, live preview Word bên phải (realtime), nút Lưu / Xuất Word / Xem trước, cảnh báo liệt kê rõ trường còn thiếu (phân biệt bắt buộc / tuỳ chọn)
- [ ] **Data Center theo gói thầu**: form chuẩn hoá thông tin gói (tên, giá, giá bằng chữ, đơn vị, nguồn vốn, số/ngày văn bản, người ký/chức vụ); 3 section nhà thầu (báo giá dự toán / chào giá dự thầu / trúng thầu) với liên kết-copy nhanh; nút "Lưu Data Center"
- [ ] **Nguồn dữ liệu theo loại**: upload nhiều file theo nhóm (ĐKKD, báo giá, giá chào thầu, giá trúng thầu); định dạng hỗ trợ tuỳ loại; AI trích xuất cho ĐKKD, parser thường cho Word/Excel; giá trúng thầu tự đổ vào Data Center

## Giai đoạn 2 — Quản trị nhà thầu & mẫu

- [ ] **Module Nhà thầu**: danh sách (tên, MST, địa chỉ, người đại diện, tài khoản/ngân hàng, số gói tham gia, trúng thầu), thêm mới, gắn vào gói thầu; phân biệt nguồn "Báo giá" / "Nhập tay"
- [ ] **Kho template theo hình thức nâng cao**: mỗi hình thức có quy trình bước riêng, mỗi bước gắn loại hồ sơ + template chính thức; thao tác Chèn trên/Chèn dưới/Xoá bước/Hoàn tác/Lưu; template chỉ "chính thức" sau khi Lưu
- [ ] Banner nhắc việc động trên đầu app (số quyết định chưa cấp số, deadline gần nhất)

## Giai đoạn 3 — Báo cáo, trang chủ, tiện ích

- [ ] Trang chủ: "Việc cần xử lý hôm nay" (công việc + tiến độ %), lời chào + ngày hiện tại
- [ ] Nhật ký công việc (work log): tab Hôm nay / Inbox / Định kỳ / Lịch sử, tạo nhanh bằng Enter, KPI đang làm / chưa cập nhật / streak, nhắc cập nhật, việc từ module khác
- [ ] Trang Hướng dẫn: tab "Tóm tắt workflow" + "Hướng dẫn chi tiết" (mô tả 8 bước: chuẩn bị template → tạo hồ sơ → upload/OCR → chuẩn hoá → chọn nhà thầu trúng → điền từng bước → xuất Word → tải toàn bộ)
- [ ] Chế độ sáng/tối
- [ ] Module Quyết định (soạn QĐ, thống kê QĐ) + Quản lý công tác + Danh sách cán bộ — hiện app tham khảo cũng đang khoá theo quyền

## Bài học cần TRÁNH (không mang sang OfficeFlow)

- Bảng quá nhiều cột chữ dài, dòng cao, khó đọc; nền gradient cầu vồng làm số liệu kém tương phản
- Lộ nhãn kỹ thuật cho người dùng (`project.selectionStartTime`, `contractorId`, `chu_truong`)
- Hai nút cùng nhãn ("Đăng nhập" mở form vs submit) gây bối rối
- Mỗi dòng quá nhiều nút thao tác (tới 6) → dễ bấm nhầm; nên gom vào menu

## Ghi chú kỹ thuật

- Quy trình bước: bảng `workflow_steps` (theo hình thức) + `project_steps` (theo hồ sơ) với status, sort_order
- Data Center: bảng `project_data` (jsonb theo gói) hoặc mở rộng `document_fields` theo case
- Nhà thầu: bảng `contractors` + bảng nối `project_contractors`
- Mọi bảng public mới: GRANT + RLS theo vai trò như hiện hữu
