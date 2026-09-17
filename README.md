# Hãy xây dựng một hệ thống quản lý văn phòng và tự động hóa tác vụ hành chính dạng Web App, giao...

Hãy xây dựng một hệ thống quản lý văn phòng và tự động hóa tác vụ hành chính dạng Web App, giao diện chuyên nghiệp, dễ sử dụng, phù hợp cho doanh nghiệp Việt Nam.

1. MỤC TIÊU HỆ THỐNG

Xây dựng một trang quản lý văn phòng tập trung, trong đó các nghiệp vụ được chia thành từng module độc lập nhưng có thể liên kết dữ liệu với nhau.

Hệ thống phải có khả năng:

Tiếp nhận file PDF scan, hình ảnh, Word, Excel.

OCR và nhận dạng thông tin từ tài liệu scan/hình ảnh.

Tự động phân loại tài liệu.

Trích xuất dữ liệu từ tài liệu.

Đối chiếu dữ liệu với các trường thông tin cần quản lý.

Tự động điền dữ liệu vào template có sẵn.

Theo dõi trạng thái xử lý hồ sơ.

Thống kê và tạo báo cáo.

Theo dõi thời hạn hợp đồng.

Cảnh báo các hợp đồng sắp đến hạn.

Tự động tạo hồ sơ/file thanh toán từ dữ liệu đã có.

Cho phép người dùng kiểm tra và chỉnh sửa dữ liệu trước khi xuất bản chính thức.

Lưu lịch sử thao tác và phiên bản tài liệu.

2. CẤU TRÚC TRANG CHÍNH

Thiết kế Dashboard gồm các module chính:

A. Thương mại – Đấu thầu

B. Hợp đồng

C. Thanh toán

D. Văn bản – Hồ sơ

E. Báo cáo – Thống kê

F. Quản lý tài liệu

G. Cài đặt hệ thống

Trong phiên bản đầu tiên, tập trung triển khai sâu nhất module:

THƯƠNG MẠI – ĐẤU THẦU

Các module khác cần được thiết kế kiến trúc sẵn để có thể mở rộng sau này.

3. MODULE THƯƠNG MẠI – ĐẤU THẦU

3.1. Dashboard

Tạo dashboard riêng cho bộ phận Thương mại – Đấu thầu.

Hiển thị các KPI:

Tổng số gói thầu.

Số gói đang chuẩn bị.

Số gói đã nộp.

Số gói đang đánh giá.

Số gói trúng thầu.

Số gói không trúng.

Tổng giá trị dự thầu.

Tổng giá trị trúng thầu.

Tỷ lệ trúng thầu.

Số hợp đồng đang thực hiện.

Số hợp đồng sắp hết hạn.

Số hồ sơ đang chờ xử lý.

Số hồ sơ thanh toán đang chờ.

Có biểu đồ:

Kết quả đấu thầu theo tháng/quý/năm.

Giá trị dự thầu và giá trị trúng thầu.

Tỷ lệ trúng thầu.

Phân loại theo khách hàng/chủ đầu tư.

Phân loại theo loại hình dự án.

Phân loại theo nhân viên phụ trách.

4. QUẢN LÝ HỒ SƠ ĐẤU THẦU

Cho phép người dùng:

Upload tài liệu

Các loại file hỗ trợ:

PDF.

PDF scan.

JPG.

PNG.

Word.

Excel.

Sau khi upload:

Bước 1 – OCR

Hệ thống tự động đọc nội dung tài liệu.

Đối với tài liệu scan/hình ảnh:

OCR tiếng Việt.

Nhận dạng số.

Nhận dạng ngày tháng.

Nhận dạng bảng.

Nhận dạng tên công ty.

Nhận dạng số hợp đồng.

Nhận dạng giá trị tiền.

Nhận dạng thông tin người ký.

Nhận dạng thời hạn.

Nhận dạng thông tin gói thầu.

Bước 2 – Phân loại tài liệu

AI tự động xác định loại tài liệu:

Hồ sơ mời thầu.

Hồ sơ dự thầu.

Quyết định.

Thông báo.

Hợp đồng.

Phụ lục hợp đồng.

Biên bản.

Báo giá.

Đề nghị thanh toán.

Hóa đơn.

Chứng từ.

Các loại tài liệu khác.

Nếu AI không chắc chắn, yêu cầu người dùng xác nhận loại tài liệu.

5. TRÍCH XUẤT DỮ LIỆU

Sau khi OCR, AI phải tự động trích xuất dữ liệu thành các trường có cấu trúc.

Ví dụ:

Thông tin gói thầu

Mã gói thầu.

Tên gói thầu.

Tên dự án.

Chủ đầu tư.

Bên mời thầu.

Địa điểm.

Loại gói thầu.

Nguồn vốn.

Giá gói thầu.

Giá dự thầu.

Giá trúng thầu.

Thời gian thực hiện.

Ngày phát hành hồ sơ.

Hạn nộp hồ sơ.

Ngày mở thầu.

Kết quả.

Nhân viên phụ trách.

Thông tin nhà thầu

Tên doanh nghiệp.

Mã số thuế.

Địa chỉ.

Người đại diện.

Chức vụ.

Số điện thoại.

Email.

Tài khoản ngân hàng.

Thông tin hợp đồng

Số hợp đồng.

Ngày ký.

Ngày bắt đầu.

Ngày kết thúc.

Giá trị hợp đồng.

Giá trị trước VAT.

VAT.

Giá trị sau VAT.

Thời gian thực hiện.

Điều khoản thanh toán.

Bảo lãnh.

Tạm ứng.

Bảo hành.

Người phụ trách.

6. CƠ CHẾ KIỂM TRA DỮ LIỆU

Đây là chức năng bắt buộc.

Không được tự động đưa dữ liệu OCR vào hồ sơ chính thức ngay lập tức.

Thiết kế quy trình:

Upload → OCR → AI Extract → Validation → User Review → Approve → Save

Hiển thị độ tin cậy của từng trường.

Ví dụ:

Tên hợp đồng: ABC-2026-001
Confidence: 99%

Giá trị hợp đồng: 12.500.000.000 VNĐ
Confidence: 96%

Ngày kết thúc: 30/12/2026
Confidence: 88%

Các trường có độ tin cậy thấp phải được đánh dấu để người dùng kiểm tra.

Cho phép người dùng:

Sửa dữ liệu.

Xác nhận dữ liệu.

Từ chối dữ liệu.

Yêu cầu OCR lại.

Xem ảnh gốc ngay bên cạnh dữ liệu OCR.

Thiết kế màn hình dạng:

Bên trái: tài liệu scan

Bên phải: dữ liệu đã nhận dạng

Khi click vào một trường dữ liệu, hệ thống highlight vị trí tương ứng trên tài liệu gốc nếu có thể xác định được.

7. TỰ ĐỘNG ĐIỀN TEMPLATE

Hệ thống phải cho phép Admin upload các template có sẵn.

Ví dụ:

Template báo cáo đấu thầu.

Template hợp đồng.

Template đề nghị thanh toán.

Template biên bản.

Template công văn.

Template bảng theo dõi.

Template Excel.

Template sử dụng placeholder:

{{TEN_GOI_THAU}}

{{CHU_DAU_TU}}

{{SO_HOP_DONG}}

{{NGAY_KY}}

{{GIA_TRI_HOP_DONG}}

{{THOI_GIAN_THUC_HIEN}}

{{NGAY_KET_THUC}}

{{NGUOI_PHU_TRACH}}

AI/system tự động mapping dữ liệu đã trích xuất vào các placeholder.

Ví dụ:

Template:

"Số hợp đồng: {{SO_HOP_DONG}}"

Sau khi xử lý:

"Số hợp đồng: 125/2026/HĐKT"

8. QUẢN LÝ TEMPLATE

Admin có thể:

Upload template.

Tạo template mới.

Chỉnh sửa template.

Xóa template.

Tạo phiên bản template.

Xem lịch sử template.

Đặt template mặc định.

Khai báo placeholder.

Mapping placeholder với trường dữ liệu.

Không hard-code template trong code.

9. QUẢN LÝ HỢP ĐỒNG

Tự động tạo database hợp đồng từ hồ sơ đấu thầu.

Bảng quản lý gồm:

Số hợp đồngKhách hàngGiá trịNgày kýNgày bắt đầuNgày kết thúcPhụ tráchTrạng thái

Trạng thái:

Chưa bắt đầu.

Đang thực hiện.

Sắp hết hạn.

Đã hết hạn.

Đã hoàn thành.

Thanh lý.

Cảnh báo thời hạn

Hệ thống tự động tính:

Còn 180 ngày.

Còn 90 ngày.

Còn 60 ngày.

Còn 30 ngày.

Còn 15 ngày.

Còn 7 ngày.

Đã quá hạn.

Màu cảnh báo thay đổi theo mức độ.

Cho phép cấu hình số ngày cảnh báo.

10. LỊCH HỢP ĐỒNG

Tạo Calendar View.

Hiển thị:

Ngày ký.

Ngày bắt đầu.

Ngày kết thúc.

Ngày nghiệm thu.

Ngày thanh toán.

Ngày hết hạn bảo lãnh.

Ngày hết hạn bảo hành.

Có bộ lọc theo:

Khách hàng.

Nhân viên.

Loại hợp đồng.

Trạng thái.

Khoảng thời gian.

11. MODULE THANH TOÁN

Từ dữ liệu hợp đồng, hệ thống tự động tạo hồ sơ thanh toán.

Ví dụ quy trình:

Hợp đồng → Nghiệm thu → Đề nghị thanh toán → Hồ sơ thanh toán → Xuất file

Thông tin thanh toán:

Số hợp đồng.

Tên khách hàng.

Giá trị hợp đồng.

Giá trị đã thanh toán.

Giá trị lần này.

Giá trị còn lại.

VAT.

Số tiền đề nghị thanh toán.

Ngày đề nghị.

Người phụ trách.

Tự động tính:

Giá trị còn lại = Giá trị hợp đồng – Tổng giá trị đã thanh toán

Kiểm tra không cho phép đề nghị thanh toán vượt quá giá trị còn lại nếu chưa được Admin override.

12. TỰ ĐỘNG TẠO FILE THANH TOÁN

Sau khi người dùng xác nhận dữ liệu:

Hệ thống tự động tạo:

Excel thanh toán.

Word đề nghị thanh toán.

PDF hồ sơ nếu cần.

Bảng kê.

Phiếu đề nghị.

Các biểu mẫu liên quan.

Cho phép:

Preview → Edit → Approve → Export

13. QUẢN LÝ TRẠNG THÁI

Mỗi hồ sơ phải có Workflow.

Ví dụ:

Mới tạo

↓

Đã OCR

↓

Đã trích xuất dữ liệu

↓

Chờ kiểm tra

↓

Đã xác nhận

↓

Đã tạo hồ sơ

↓

Đang xử lý

↓

Hoàn thành

Mỗi trạng thái phải ghi:

Người thực hiện.

Thời gian.

Hành động.

Ghi chú.

14. TÌM KIẾM TOÀN HỆ THỐNG

Xây dựng Global Search.

Cho phép tìm kiếm:

Tên dự án.

Tên khách hàng.

Số hợp đồng.

Mã gói thầu.

Mã số thuế.

Người phụ trách.

Nội dung tài liệu.

Có thể tìm kiếm cả nội dung bên trong file PDF scan sau khi OCR.

15. QUẢN LÝ TÀI LIỆU

Mỗi hồ sơ có Document Folder.

Ví dụ:

PROJECT-001

├── 01_Ho_so_moi_thau

├── 02_Ho_so_du_thau

├── 03_Ket_qua

├── 04_Hop_dong

├── 05_Nghiem_thu

├── 06_Thanh_toan

└── 07_Thanh_ly

Cho phép:

Preview.

Download.

Upload.

Replace.

Versioning.

Rename.

Delete theo quyền.

16. PHÂN QUYỀN

Thiết kế Role-Based Access Control.

Các role:

Admin

Toàn quyền.

Manager

Xem toàn bộ dữ liệu, duyệt hồ sơ, xem báo cáo.

Nhân viên thương mại

Tạo và xử lý hồ sơ đấu thầu.

Nhân viên hợp đồng

Quản lý hợp đồng.

Nhân viên thanh toán

Xử lý hồ sơ thanh toán.

Viewer

Chỉ xem.

Phải ghi Audit Log cho các thao tác quan trọng.

17. AI ASSISTANT

Tích hợp một AI Assistant bên trong hệ thống.

Người dùng có thể hỏi:

"Cho tôi danh sách hợp đồng sẽ hết hạn trong 60 ngày tới."

"Tháng này có bao nhiêu gói thầu?"

"Tỷ lệ trúng thầu quý II là bao nhiêu?"

"Hợp đồng ABC còn bao nhiêu tiền chưa thanh toán?"

"Những hồ sơ nào đang chờ tôi xử lý?"

"Liệt kê các hợp đồng có giá trị trên 10 tỷ."

AI phải trả lời dựa trên database thực tế của hệ thống.

18. BÁO CÁO

Cho phép tạo báo cáo theo:

Ngày.

Tuần.

Tháng.

Quý.

Năm.

Các báo cáo chính:

Báo cáo đấu thầu

Số lượng gói thầu.

Tổng giá trị.

Số trúng.

Số trượt.

Tỷ lệ trúng.

Báo cáo hợp đồng

Tổng số hợp đồng.

Tổng giá trị.

Hợp đồng đang thực hiện.

Hợp đồng sắp hết hạn.

Hợp đồng đã hoàn thành.

Báo cáo thanh toán

Tổng giá trị phải thu.

Đã thanh toán.

Chưa thanh toán.

Quá hạn.

Cho phép Export:

Excel.

PDF.

CSV.

19. GIAO DIỆN

Thiết kế UI theo phong cách:

Enterprise Dashboard / Office Management System

Ưu tiên:

Đơn giản.

Sạch.

Ít thao tác.

Dễ sử dụng.

Responsive.

Hỗ trợ desktop là chính.

Sidebar:

Dashboard

├── Tổng quan

├── Thương mại – Đấu thầu

│ ├── Dashboard

│ ├── Hồ sơ đấu thầu

│ ├── Gói thầu

│ ├── Hợp đồng

│ └── Thanh toán

├── Văn bản – Hồ sơ

├── Báo cáo

├── Tài liệu

└── Cài đặt

20. KIẾN TRÚC DỮ LIỆU

Thiết kế database có quan hệ giữa:

User

Project

Tender

Customer

Contract

Payment

Document

DocumentType

Template

TemplateField

Workflow

Notification

AuditLog

Mỗi bảng phải có:

ID.

CreatedAt.

UpdatedAt.

CreatedBy.

UpdatedBy.

Không tạo dữ liệu giả khi triển khai production.

21. OCR + AI EXTRACTION

Thiết kế hệ thống OCR theo dạng abstraction layer để có thể thay đổi OCR provider.

Ví dụ:

OCR Provider

→ Google Vision / Azure Document Intelligence / AWS Textract / Tesseract / AI Vision

AI Extraction

→ LLM

→ Structured JSON

→ Validation

→ Database

AI không được tự ý suy đoán dữ liệu.

Nếu thông tin không tồn tại trong tài liệu:

null

Không được tự bịa dữ liệu.

Nếu phát hiện nhiều giá trị có khả năng đúng:

Trả về:

extracted_value

confidence

source_text

source_page

needs_review

22. DATA EXTRACTION JSON

Kết quả AI extraction phải có cấu trúc tương tự:

{
"contract_number": {
"value": "125/2026/HĐKT",
"confidence": 0.98,
"source_page": 3,
"needs_review": false
},
"contract_value": {
"value": 12500000000,
"currency": "VND",
"confidence": 0.96,
"source_page": 5,
"needs_review": false
}
}

Không lưu kết quả AI trực tiếp vào dữ liệu chính thức nếu chưa qua bước validation.

23. ERROR HANDLING

Hệ thống phải xử lý:

File không đọc được.

OCR thất bại.

File quá lớn.

Không nhận diện được tài liệu.

Thiếu dữ liệu.

Dữ liệu mâu thuẫn.

Sai định dạng ngày.

Sai định dạng tiền.

Trùng số hợp đồng.

Trùng hồ sơ.

Mọi lỗi phải có thông báo rõ ràng cho người dùng.

24. AUTOMATION

Thiết kế Automation Engine để sau này có thể tạo các Rule:

Ví dụ:

IF hợp đồng còn 30 ngày

→ tạo notification

→ gửi email cho người phụ trách

→ gửi email cho Manager.

IF hồ sơ thanh toán được duyệt

→ tự động tạo file thanh toán.

IF upload hợp đồng mới

→ OCR

→ Extract

→ Validate

→ tạo Contract Draft.

IF hợp đồng hết hạn

→ chuyển trạng thái "Expired".

25. YÊU CẦU QUAN TRỌNG VỀ TÍNH AN TOÀN

Không được tự động gửi email hoặc phát hành tài liệu chính thức nếu chưa có bước Approval của người có quyền.

Các thao tác:

Xóa.

Phê duyệt.

Phát hành.

Gửi email.

Thay đổi dữ liệu tài chính.

phải có xác nhận hoặc phân quyền phù hợp.

26. YÊU CẦU VỀ TEMPLATE

Hệ thống phải hỗ trợ template thực tế của doanh nghiệp.

Không thiết kế template giả định cố định trong code.

Tạo chức năng:

Template Manager

cho phép người dùng upload template Word/Excel và khai báo các trường dữ liệu cần mapping.

27. MVP PHASE 1

Không xây dựng tất cả chức năng cùng lúc.

Trước tiên hãy xây dựng MVP với 5 chức năng cốt lõi:

1. Upload tài liệu

PDF / JPG / PNG / Word / Excel.

2. OCR + AI Extraction

Tự động đọc và trích xuất dữ liệu.

3. Review

Cho người dùng kiểm tra dữ liệu AI.

4. Template Automation

Tự động điền dữ liệu vào template.

5. Contract Tracking

Theo dõi hợp đồng và cảnh báo ngày hết hạn.

Sau khi 5 chức năng này hoạt động ổn định mới phát triển:

Payment → Reporting → Automation Engine → AI Assistant

28. YÊU CẦU KHI LẬP TRÌNH

Trước khi viết code:

Phân tích yêu cầu.

Đề xuất kiến trúc hệ thống.

Đề xuất database schema.

Đề xuất UI/UX.

Đề xuất workflow.

Xác định các API cần thiết.

Xác định OCR/AI architecture.

Xác định cách quản lý file.

Xác định cơ chế authentication/authorization.

Sau đó mới bắt đầu code.

Không được xây dựng một prototype chỉ có giao diện.

Các nút chức năng phải được kết nối với logic thực tế.

29. OUTPUT MONG MUỐN

Hãy xây dựng hệ thống theo hướng có thể triển khai production.

Cần cung cấp:

Source code.

Database schema.

API.

Frontend.

Backend.

Authentication.

File storage.

OCR pipeline.

AI extraction pipeline.

Template engine.

Workflow engine.

Notification engine.

Audit log.

README hướng dẫn cài đặt.

Hướng dẫn cấu hình API key.

Hướng dẫn deploy.

Nếu có điểm nào chưa đủ thông tin, hãy tự đưa ra giả định hợp lý, ghi rõ các giả định và tiếp tục triển khai, không dừng lại chỉ để hỏi lại.

Ưu tiên kiến trúc modular, scalable, maintainable, để sau này có thể bổ sung các module khác như Nhân sự, Mua sắm, Tài sản, Công văn, Kế toán và Quản lý dự án.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/68286842-5f7c-4f96-bf4e-741a62ac780c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
