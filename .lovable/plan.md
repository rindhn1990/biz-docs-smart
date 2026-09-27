# Khoanh nhiều vùng trước khi quét dữ liệu

## Mục tiêu
Cho phép người dùng chọn ảnh hoặc PDF, xem tài liệu trực tiếp trong hộp quét, phóng to/thu nhỏ, kéo để di chuyển và khoanh nhiều vùng cần đọc. Chỉ nội dung trong các vùng đã chọn được đưa qua OCR local và bước AI bổ sung hiện có.

## Phạm vi triển khai
- Thêm màn hình chọn vùng cho ảnh và PDF trước khi bắt đầu quét.
- Hỗ trợ nhiều trang PDF, chuyển trang và giữ riêng các vùng đã khoanh theo từng trang.
- Công cụ gồm: chọn vùng, kéo tài liệu, phóng to, thu nhỏ, đặt lại góc nhìn, xoá một vùng và xoá toàn bộ vùng.
- Vùng khoanh được lưu theo tọa độ tương đối, nên vẫn đúng khi thay đổi mức phóng.
- Hiển thị số thứ tự trên từng vùng và tổng số vùng đã chọn.
- Khi bấm quét, cắt từng vùng ở độ phân giải gốc rồi ghép kết quả OCR theo đúng thứ tự trang/vùng.
- Nếu không khoanh vùng, vẫn cho phép quét toàn bộ tệp như hiện tại.
- File Word tiếp tục đọc toàn bộ nội dung vì không có bề mặt ảnh ổn định để khoanh trực tiếp.

## Luồng quét
1. Người dùng chọn ảnh/PDF.
2. Tài liệu mở ở chế độ xem và khoanh vùng.
3. Người dùng phóng to, kéo tài liệu, khoanh một hoặc nhiều vùng.
4. Bấm “Quét các vùng đã chọn” hoặc “Quét toàn bộ”.
5. OCR local và trích xuất từ khóa chỉ xử lý ảnh cắt; chế độ AI chỉ bổ sung các trường còn thiếu như hiện tại.
6. Bảng kết quả và bước xác nhận điền dữ liệu giữ nguyên.

## Kỹ thuật
- Tạo thành phần chọn vùng độc lập để `ScanFileDialog` không tiếp tục phình lớn.
- Dùng Pointer Events cho thao tác khoanh và kéo; wheel zoom theo độ lớn delta, neo tại vị trí con trỏ và chặn cuộn trang trên vùng xem.
- PDF được render bằng `pdfjs-dist`; ảnh cắt được tạo bằng canvas và chuyển thành `File`/`Blob` để tái sử dụng OCR hiện có.
- Mở rộng `local-ocr.ts` để OCR danh sách vùng ảnh và trả văn bản ghép; không thay đổi API AI phía máy chủ.
- Thêm quyết định kiến trúc vào `AGENTS.md`, cập nhật `roadmap.md`, chạy kiểm tra kiểu và kiểm tra giao diện trên desktop/mobile.
