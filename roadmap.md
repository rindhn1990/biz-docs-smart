# Roadmap cải tiến OfficeFlow

Nguồn: khảo sát app tham khảo xsanguyen5.lovable.app (11/09/2026) + nhu cầu thực tế của người dùng.
Nguyên tắc: không sửa code khi chưa chốt hạng mục; ưu tiên module hoá để dễ mở rộng (Nhân sự, Mua sắm, Tài sản, Công văn, Kế toán, Dự án).

## Trạng thái hiện tại (đã có)

- [x] Yêu cầu 11/11: bỏ hỏi reset sau xuất; giữ nút đặt lại chủ động; giá trị trống giữ placeholder Word, không dùng ví dụ.
- [x] Yêu cầu 11/11: bổ sung nguồn từ mẫu Word vào Dữ liệu chung, tự lưu trước xuất và ghi lịch sử theo tender_id; 167/167 tests, kiểm tra tự động sạch. UI viewer thấy 27 trường bổ sung và preview mẫu thật đúng tên/số/ngày, giữ placeholder thiếu.
- [ ] Yêu cầu 11/11: thử lưu/đặt lại/xuất và đọc lại lịch sử qua UI; chờ phiên writer/admin (phiên hiện tại viewer). Không thay đổi dữ liệu thật.

- [x] Yêu cầu 10/11: sửa nguồn vùng Word đã xác nhận; nút lên/xuống cho vùng mẫu và trường hồ sơ; lưu nguồn trực tiếp. Xuất Word mẫu thật có số/ngày chủ trương đúng; ví dụ vẫn không xuất.
- [x] Yêu cầu 10/11: chọn gói cả khi chưa có hồ sơ, nhận dữ liệu chung đúng gói; liên kết từ chi tiết gói, ghi tender_id khi xuất. Thử hai gói không lẫn dữ liệu; 164 kiểm thử đạt.
- [ ] Yêu cầu 10/11: thử lưu nguồn/đổi thứ tự và ghi lịch sử qua giao diện; chờ phiên writer/admin (phiên hiện tại viewer). Tải Word thật đã đạt, không thay dữ liệu thật.

- [x] Hiển thị: thời gian tải mẫu; tách tên gói/số hợp đồng trong Tổng quan; lọc gói và thời gian nhập ở theo dõi thanh toán. Đã thử dữ liệu thật qua phiên viewer, 124/124 kiểm thử đạt, build OK.

- [x] Word: sửa regex w:t, kiểm thử tab/bảng, chặn lưu XML hỏng và thay ngoài phạm vi; 124/124 kiểm thử, tsgo sạch và build OK.
- [x] Word: sao lưu bản gần nhất trước ghi đè, hoàn tác admin có xác nhận, thông báo số vị trí; ba lần thay vùng bằng DOMParser trình duyệt giữ bảng/nội dung cuối.
- [ ] Word: thử lưu 2–3 vùng, đóng/mở lại và hoàn tác qua giao diện với storage thật; chờ phiên admin (phiên thử hiện chỉ viewer). Không tạo dữ liệu thử trong database/storage.

- [x] A: kiểm chứng khoanh riêng Số tài khoản và Quét lại từ đầu bằng trình duyệt (lượt trước đã đạt).
- [x] Notice: sửa lỗi import tải file để trang mở được, không sửa replacePhraseWithToken/regex trong docx.ts; bỏ khóa nội bộ khỏi dữ liệu xuất, tên ZIP trùng khớp lịch sử, chặn ngày hàng loạt rỗng.
- [x] B1-2: module notice, tab Thông báo nhà thầu, ngày nhận hồ sơ, quét/nhập riêng, Word/ZIP và lịch sử đã có; xác nhận các cột updated_by/bid_received_date và constraint notice trên dữ liệu thật.
- [x] B3: quét đăng ký doanh nghiệp chuẩn/mất dấu, 19 tests; payment 22 tests không hồi quy; giá trị notice/ZIP/Word có-trống ngày được kiểm thử.
- [x] B4: 155/155 tests, build OK; UI viewer chọn nhà thầu/mẫu thật, xem trước đúng tên/MST/ngày nhận và giữ placeholder trống; kho mẫu chuyển sang notice được. Không AI/email, không tạo hay thay dữ liệu thử.
- [ ] Notice: UI lưu ngày bằng popup, upload mẫu thử, xuất DOCX/ZIP, ghi lịch sử và Xuất lại; chờ phiên writer/admin (phiên hiện tại viewer). Chưa chạy tsgo riêng.

- [ ] Quét thường: sửa nhận diện văn bản A/B, kiểm thử đầy đủ và kiểm tra kiểu.
- [ ] Quét thêm vùng: giữ tài liệu, gộp nguồn/giữ sửa tay, khoanh riêng từng trường, bộ nhớ OCR và cảnh báo tiền; thử giao diện không AI/email.

- [x] Thông báo lương: giới hạn 10 người/lô, giãn cách 350ms, xử lý nhật ký riêng từng người, giữ sent cũ khi gửi lại thất bại, khoá bấm đúp; Email chỉ admin trên giao diện; 33 kiểm thử giả/quyền menu đạt và kiểm tra tự động báo build OK.
- [x] Thông báo lương: phiên viewer bị chặn trang, ẩn menu và ô sửa Email; kiểm tra RLS ba bảng chỉ admin. Không tạo dữ liệu thử và không gửi thư thật; ba bảng vẫn trống.
- [ ] Thông báo lương: thử nhập lương, lưu mẫu, xem trước, trạng thái/chọn đầu mục, banner/nút gửi và Dừng qua giao diện; chờ phiên admin. Gửi thật chưa thử vì chưa có RESEND_API_KEY/SALARY_MAIL_FROM/PASSWORD_RESET_FROM_EMAIL; không gửi trong lượt này.

- [x] Kiểu ngày từng vùng Word: chỉ slash/vn_full, tự động theo nhãn, chuyển Date_Thanhtoan sang vn_full; 43 kiểm tra đạt, xuất mẫu thanh toán thật có/trống ngày đạt; giao diện viewer hiển thị đúng.
- [ ] Kiểu ngày: thử mở 3 lựa chọn, lưu Tự động và bôi đen/lưu qua giao diện; chờ phiên admin (tài khoản thử hiện tại chỉ viewer).

- [x] Nhân sự: sửa lỗi kiểu dữ liệu và rà soát JSX; xác minh cascade hồ sơ/trường/hợp đồng, quyền xoá admin và kiểm thử helper giữ file dùng chung.
- [x] Nhân sự: thử đầu mục trên dữ liệu tạm, đổi tên/thứ tự/gán hàng loạt qua công cụ dữ liệu, xoá đầu mục đưa nhân sự về Chưa phân loại; trình duyệt xác minh lọc/đếm/nhóm, Excel có Đầu mục và viewer không được xoá; dọn dữ liệu thử.
- [ ] Nhân sự: thử nút quản trị tạo/đổi tên/lên xuống/gán hàng loạt/xoá và dọn file storage thật qua luồng xoá; chờ phiên có quyền quản trị (phiên hiện tại chỉ viewer, không được cấp phiên admin).

- [x] Thanh toán: trường quét theo mẫu, ưu tiên dữ liệu quét, nhận diện số/ngày hợp đồng; thử giao diện và Word với dữ liệu trống/có giá trị.

- [ ] Cuộn ngang tài liệu quét/xem trước, tab và bảng; kiểm thử màn hình 1100px/768px.

- [ ] Ví dụ hướng dẫn tab Dữ liệu: placeholder riêng, sửa ví dụ admin, kiểm tra lưu và xuất không dùng ví dụ.

- [x] Đồng nhất dấu phẩy trong số tiền bằng chữ; kiểm tra và cập nhật riêng giá trị lưu theo cách đọc cũ, bảo vệ chữ sửa tay.

- [x] App shell, sidebar mode-aware, auth + phân quyền theo vai trò (admin/user), trang Quản trị gán vai trò
- [x] Hồ sơ đấu thầu: danh sách, review 2 cột (PDF + form), lưu debounce/blur, confidence badge, bbox highlight
- [x] Mẫu văn bản: 5 tab hình thức, upload .docx, dò placeholder `{{}}`/`[[]]`, thêm/xoá mapping tay, chọn vùng bằng bôi đen văn bản, sửa tên/mô tả/hình thức, thay file Word, xoá mẫu (admin)
- [x] Tờ trình KHLCNT: docx mẫu sinh tự động, 39 trường / 5 nhóm, trang /du-lieu tổng hợp + xuất Word thật
- [x] Tab Hợp đồng nhân sự: employees / hợp đồng / tài liệu / review
- [x] Báo cáo đấu thầu: KPI trạng thái, tiến độ theo tháng, chất lượng nhận dạng, xuất CSV/Excel
- [x] Tách kho mẫu Đấu thầu/Nhân sự; tải nhiều file ở kho mẫu và hai loại hồ sơ
- [x] Đối chiếu mẫu gốc với file Word hoàn chỉnh, duyệt giá trị nhận diện trước khi lưu
- [x] Quét theo nhiều vùng: xem ảnh/PDF, phóng to/thu nhỏ, kéo tài liệu và khoanh nhiều vùng trước khi OCR
- [ ] Quên mật khẩu: giao diện + giới hạn + đổi mật khẩu bắt buộc XONG; chờ cấu hình gửi email (RESEND_API_KEY, PASSWORD_RESET_FROM_EMAIL, domain đã xác minh)
- [x] A. Dán ảnh Ctrl+V / kéo thả / nút "Dán từ clipboard" trong hộp quét
- [x] B1. Nhiều nhà thầu trúng + giá trúng từng nhà thầu
- [x] B2. contracts.contractor_id, chọn nhà thầu theo gói, cột nhà thầu
- [x] B3-5. Thanh toán chọn chuỗi Gói → Hợp đồng → Nhà thầu; STK/ngân hàng/số tiền theo file quét; nguồn mẫu mới
- [x] B6. Xuất thanh toán lưu payments + export_history (tender/contract/payment)
- [ ] B7. Báo cáo xuyên suốt theo gói thầu

## Giai đoạn 1 — Trải nghiệm lõi đấu thầu (ĐÃ XONG)

- [x] **Checklist bước theo quy trình thật**: `/goi-thau` + `/goi-thau/{gói}` — 18 bước theo hình thức, trạng thái từng bước, tiến độ "x/18 đã duyệt"
- [x] **Editor từng bước 2 cột**: `/goi-thau/{gói}/buoc/{bước}` — form trái, xem trước Word realtime bên phải, cảnh báo trường còn thiếu, Lưu / Duyệt / Xuất file Word
- [x] **Data Center theo gói thầu**: tab "Dữ liệu chung" lưu jsonb dùng lại cho mọi bước; nhà thầu theo vai trò báo giá / dự thầu / trúng thầu
- [x] **Nguồn dữ liệu theo loại**: tab "Nguồn dữ liệu" upload file theo nhóm (ĐKKD, báo giá, giá dự thầu, giá trúng thầu, khác)

## Giai đoạn 2 — Quản trị nhà thầu & mẫu (ĐÃ XONG)

- [x] **Module Nhà thầu**: `/nha-thau` — tên, MST, địa chỉ, đại diện, ngân hàng, số gói tham gia/trúng, nguồn Báo giá / Nhập tay
- [x] **Quy trình mẫu theo hình thức**: `/quy-trinh` (admin) — chèn trên/dưới, xoá bước, gắn mẫu Word, đánh dấu bắt buộc, Hoàn tác / Lưu quy trình
- [x] Banner nhắc việc động trên đầu app (bước chưa duyệt, hồ sơ chờ kiểm tra, hợp đồng sắp hết hạn)

## Giai đoạn 3 — Báo cáo, trang chủ, tiện ích

- [x] Báo cáo theo gói thầu (Tổng quan): giá gói, giá trúng, hợp đồng, đã thanh toán, còn lại, % giải ngân
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
