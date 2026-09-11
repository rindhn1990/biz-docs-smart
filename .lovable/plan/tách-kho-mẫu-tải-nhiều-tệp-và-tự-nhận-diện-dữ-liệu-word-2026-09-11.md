# Tách kho mẫu, tải nhiều tệp và tự nhận diện dữ liệu Word

## Phạm vi đã chốt

- Tách hoàn toàn kho mẫu **Đấu thầu** và **Hợp đồng nhân sự**.
- Tải nhiều tệp trong một lần tại cả ba nơi: Kho mẫu Word, Hồ sơ đấu thầu và Hồ sơ nhân sự.
- Với file Word hoàn chỉnh, người dùng **chọn một mẫu gốc**; hệ thống đối chiếu và đề xuất giá trị tương ứng từng placeholder để người dùng duyệt trước khi lưu.

## Các bước thực hiện

### 1. Tách mẫu theo phân hệ

- Thêm trường phân hệ cho mẫu: `tender` hoặc `hr`; gán toàn bộ mẫu hiện hữu đúng phân hệ bằng dữ liệu/mục đích hiện tại.
- Điều hướng “Mẫu văn bản” trong sidebar mang theo phân hệ đang mở, nên từ Nhân sự sẽ không còn nhảy sang kho Đấu thầu.
- Trang mẫu hiển thị bộ lọc 5 hình thức chỉ trong Đấu thầu; Nhân sự có danh sách mẫu và trường nguồn riêng.
- Khi đổi thông tin mẫu, chỉ cho phép chuyển trong phạm vi hợp lệ của phân hệ hiện tại.

### 2. Tải nhiều tệp

- Kho mẫu Word: cho chọn nhiều `.docx`; mỗi file tạo một mẫu độc lập, tự dò placeholder và hiển thị kết quả thành công/thất bại theo file.
- Hồ sơ đấu thầu: cho chọn nhiều PDF/ảnh trong một lượt; mỗi file đi qua quy trình xử lý hiện có độc lập.
- Hồ sơ nhân sự: cho chọn nhiều PDF/ảnh trong một lượt; giữ lựa chọn loại hồ sơ/nhân viên hiện tại và áp dụng cho từng file.
- Một file lỗi không làm hỏng cả lô; làm mới danh sách một lần sau khi hoàn tất.

### 3. Nhận diện dữ liệu từ file Word hoàn chỉnh

- Thêm thao tác “Quét từ file hoàn chỉnh” trên mẫu có placeholder.
- Người dùng chọn mẫu gốc trước, rồi tải file hoàn chỉnh tương ứng.
- Đọc cấu trúc văn bản của hai file, dùng các đoạn cố định quanh từng placeholder để tìm giá trị đã điền; xử lý placeholder nằm trong nhiều Word run.
- Hiển thị bảng đề xuất gồm placeholder, nhãn, giá trị tìm được và trạng thái tin cậy; cho sửa/bỏ chọn từng dòng.
- Chỉ lưu các giá trị vào ánh xạ sau khi quản trị viên xác nhận; không tự thay đổi file mẫu gốc.
- Nếu cấu trúc khác quá nhiều, báo rõ các trường chưa nhận diện và để người dùng nhập tay thay vì đoán dữ liệu.

### 4. Kiểm tra

- Kiểm tra từ sidebar: Đấu thầu và Nhân sự mở đúng kho mẫu riêng, không lẫn dữ liệu.
- Kiểm tra tải nhiều file tại ba khu vực, gồm trường hợp một file không hợp lệ.
- Kiểm tra một cặp mẫu gốc/file hoàn chỉnh: nhận diện, sửa đề xuất, xác nhận và xuất lại Word.
- Chạy kiểm tra kiểu dữ liệu, bản dựng và trình duyệt; rà lỗi giao diện và console.

## Chi tiết kỹ thuật

- Giữ `templates.method` cho 5 hình thức đấu thầu; thêm `templates.module` để phân tách nghiệp vụ.
- Không cần bảng file con: mỗi file tải lên vẫn là một mẫu độc lập, phù hợp mô hình hiện tại và tránh thay đổi không cần thiết.
- Logic đối chiếu DOCX đặt trong tiện ích Word phía trình duyệt; kết quả luôn qua bước duyệt thủ công trước khi ghi `template_mappings.value`.
- Migration có constraint/index, cập nhật dữ liệu cũ và giữ nguyên RLS/phân quyền admin hiện tại.
