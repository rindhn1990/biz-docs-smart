# Quên mật khẩu và bắt buộc đổi mật khẩu

## Phương án an toàn
Không gửi mật khẩu tạm dạng chữ qua email vì mật khẩu có thể bị lộ trong hộp thư và lịch sử chuyển tiếp. Dùng email khôi phục bảo mật sẵn có của nền tảng; người nhận mở liên kết một lần để tự đặt mật khẩu mới. Mọi phản hồi vẫn trung tính để không tiết lộ email nào có tài khoản.

## Triển khai
- Thêm form “Quên mật khẩu?” trên trang đăng nhập, yêu cầu đúng email đăng ký.
- Tạo xử lý phía máy chủ để gửi email khôi phục, không ghi email đầy đủ hoặc thông tin nhạy cảm vào log.
- Giới hạn tối đa 3 yêu cầu mỗi giờ theo email và địa chỉ mạng đã băm; phản hồi luôn giống nhau kể cả email không tồn tại hoặc vượt giới hạn.
- Thêm trạng thái `must_change_password` vào hồ sơ người dùng; chỉ máy chủ đặc quyền được đặt, người dùng chỉ được tự xoá cờ sau khi đổi mật khẩu thành công.
- Tạo trang công khai `/reset-password` nhận phiên khôi phục, nhập mật khẩu mới và xác nhận, tối thiểu 8 ký tự.
- Chặn toàn bộ giao diện chính khi tài khoản còn phải đổi mật khẩu; hiển thị màn đổi mật khẩu bắt buộc.
- Thêm nút “Cấp lại mật khẩu” cho quản trị viên khác. Nút gửi email khôi phục, không hiển thị mật khẩu; không cho tự cấp lại.
- Ghi nhật ký người thực hiện, tài khoản nhận và thời điểm; tuyệt đối không lưu mật khẩu hoặc mã khôi phục.
- Giữ nguyên trạng thái kích hoạt, vai trò và quyền phân hệ.

## Dữ liệu và bảo mật
- Bảng giới hạn yêu cầu khôi phục chỉ máy chủ truy cập.
- Bảng nhật ký cấp lại chỉ quản trị viên được xem; chỉ máy chủ được ghi.
- Hàm hoàn tất đổi mật khẩu chỉ cho phép người dùng xoá cờ của chính mình.
- Email khôi phục dùng hệ thống email xác thực mặc định của nền tảng; không cần khoá API email riêng.

## Kiểm tra
- Kiểm tra kiểu mã và bản dựng.
- Thử các trạng thái: email hợp lệ/không tồn tại, mật khẩu không khớp, mật khẩu yếu, quản trị viên tự cấp lại, và tài khoản bị chặn tới khi đổi xong.
