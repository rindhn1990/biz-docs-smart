# Roadmap

## MVP Phase 1 (đang làm)
- [x] Design system, auth, shell, sidebar, Tổng quan
- [ ] Bảng `document_fields` (bbox, confidence) + `template_mappings` — migration
- [ ] Route `/ho-so-dau-thau` — danh sách hồ sơ + stepper 5 bước + nút tải lên (giả lập pipeline)
- [ ] Route `/ho-so-dau-thau/$documentId` — màn hình kiểm tra dữ liệu (review) 2 cột + highlight bbox
- [ ] Route `/mau-van-ban` — template, ánh xạ placeholder, xem trước
- [ ] Route `/hop-dong` — bảng hợp đồng + badge cảnh báo hạn + bộ lọc nhanh
- [ ] Seed: 8-10 gói thầu, 8 hợp đồng (trải đều mốc cảnh báo), 5 hồ sơ + document_fields mẫu
- [ ] AppSidebar: 4 mục chính trỏ đúng route, các mục còn lại khoá "Sắp mở rộng"

## Sau này
- Pipeline OCR/AI thật thay cho giả lập
- Thanh toán, Báo cáo, Quản lý tài liệu, Cài đặt
- Nhân sự, Mua sắm, Tài sản, Công văn, Kế toán, Quản lý dự án

## Module Hợp đồng nhân sự (xong)
- [x] Bảng employees, employee_contracts, employee_documents, employee_document_fields + dữ liệu mẫu
- [x] /nhan-su, /nhan-su/$documentId, /nhan-su/hop-dong
- [x] Tab Đấu thầu / Hợp đồng nhân sự + sidebar theo tab
- [x] Mẫu "Hợp đồng lao động" trong Mẫu văn bản

## Mẫu Word thật + Tờ trình KHLCNT (hoàn thành)
- [x] Cột `documents.doc_type`, `document_fields.field_group`, `templates.source_docx_path`/`delimiter_style`
- [x] Tải lên mẫu .docx → lưu Storage `templates/{id}/source.docx`, tự dò placeholder {{...}} và [[...]] (gộp run trong cùng đoạn)
- [x] Xuất file Word thật bằng docxtemplater + pizzip + file-saver
- [x] Loại hồ sơ "Tờ trình KHLCNT" với 39 trường chia 5 nhóm, review hiển thị theo nhóm
- [x] Mẫu "Tờ trình phê duyệt KHLCNT" (bản dựng tạm) + ánh xạ sẵn + hồ sơ mẫu đã xác nhận

## Trang Dữ liệu + phân loại mẫu theo hình thức LCNT (hoàn thành)
- [x] Component dùng chung `FieldGroupEditor` (nhóm + input + badge confidence)
- [x] Route `/du-lieu`: chọn hồ sơ Tờ trình KHLCNT, sửa 39 trường, xuất Word theo hình thức
- [x] Cột `templates.method` (5 hình thức) + tab lọc và dropdown khi tải mẫu lên
- [x] Mẫu KHLCNT gán "Chỉ định thầu rút gọn"; 4 hình thức còn lại hiển thị EmptyState


## Mẫu văn bản – phân quyền (hoàn thành)
- [x] Thêm/xoá chỗ trống thủ công cho mẫu chưa có placeholder
- [x] Tải mẫu lên gán đúng hình thức của tab đang mở (bỏ dropdown riêng)
- [x] Chỉ admin được sửa mẫu (RLS + UI); trang /quan-tri gán vai trò theo email
