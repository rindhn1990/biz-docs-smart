# Quên mật khẩu và bắt buộc đổi mật khẩu

## Phương án an toàn
Không gửi mật khẩu tạm dạng chữ qua email vì mật khẩu có thể bị lộ trong hộp thư và lịch sử chuyển tiếp. Dùng email khôi phục bảo mật sẵn có của nền tảng; người nhận mở liên kết một lần để tự đặt mật khẩu mới. Mọi phản hồi vẫn trung tính để không tiết lộ email nào có tài khoản.

## Triển khai
- Thêm form “Quên mật khẩu?” trên trang đăng nhập, yêu cầu đúng email đăng ký.
- Tạo xử lý phía máy chủ để gửi email khôi phục, không ghi email đầy đủ hoặc thông tin nhạy cảm vào log.
- Kiểm tra giới hạn hoàn toàn ở máy chủ theo email và địa chỉ mạng đã băm: cách nhau tối thiểu 5 phút, tối đa 3 lần trong cửa sổ trượt 60 phút.
- Lưu cả yêu cầu cho email không tồn tại để hạn chế dò tài khoản. Khi vượt giới hạn, trả thời gian chờ thực tế để giao diện khóa nút và đếm ngược.
- Thông báo rõ email chưa đăng ký; email hợp lệ báo thư khôi phục đã được gửi.
- Thêm trạng thái `must_change_password` vào hồ sơ người dùng; chỉ máy chủ đặc quyền được đặt, người dùng chỉ được tự xoá cờ sau khi đổi mật khẩu thành công.
- Tạo trang công khai `/reset-password` nhận phiên khôi phục, nhập mật khẩu mới và xác nhận, tối thiểu 8 ký tự.
- Chặn toàn bộ giao diện chính khi tài khoản còn phải đổi mật khẩu; hiển thị màn đổi mật khẩu bắt buộc.
- Quản trị viên dùng cùng form “Quên mật khẩu” như mọi tài khoản; không thêm nút cấp lại trong trang phân quyền.
- Giữ nguyên trạng thái kích hoạt, vai trò và quyền phân hệ.

## Dữ liệu và bảo mật
- Bảng lịch sử yêu cầu khôi phục chỉ máy chủ truy cập, lưu email chuẩn hoá, địa chỉ mạng đã băm và thời điểm; không lưu mật khẩu hoặc mã khôi phục.
- Hàm hoàn tất đổi mật khẩu chỉ cho phép người dùng xoá cờ của chính mình.
- Email khôi phục dùng hệ thống email xác thực mặc định của nền tảng; không cần khoá API email riêng.

## Kiểm tra
- Kiểm tra kiểu mã và bản dựng.
- Thử các trạng thái: email hợp lệ/không tồn tại, yêu cầu dưới 5 phút, quá 3 lần/60 phút, đếm ngược, mật khẩu không khớp, mật khẩu yếu và tài khoản bị chặn tới khi đổi xong.
