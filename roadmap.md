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
