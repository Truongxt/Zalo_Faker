# Kế Hoạch Kiểm Thử Hệ Thống ChatR

## 1. Thông tin chung

| Mục | Nội dung |
| --- | --- |
| Project Name | ChatR |
| Project Code | Module01 |
| Số lượng chức năng kiểm thử | 9 |
| Môi trường kiểm thử | Sử dụng kết nối mạng |
| Hình thức kiểm thử | Kiểm thử chức năng, kiểm thử giao diện, kiểm thử tích hợp và kiểm thử real-time |

## 2. Mục tiêu kiểm thử

Kế hoạch này được xây dựng để kiểm thử 9 chức năng chính của hệ thống ChatR/Zalo_Faker. Mục tiêu là xác nhận các chức năng hoạt động đúng theo yêu cầu, dữ liệu được xử lý chính xác, người dùng nhận được phản hồi phù hợp và các luồng real-time như gọi video, gửi âm thanh, thu hồi tin nhắn được đồng bộ ổn định giữa các tài khoản.

Các mục tiêu cụ thể:

- Đảm bảo người dùng có thể thao tác đúng với 9 chức năng được chọn.
- Phát hiện lỗi chức năng, lỗi giao diện và lỗi xử lý dữ liệu.
- Kiểm tra các điều kiện hợp lệ, không hợp lệ và trường hợp biên.
- Xác minh quyền truy cập, trạng thái đăng nhập và điều kiện tiền đề của từng chức năng.
- Ghi nhận kết quả kiểm thử để phục vụ báo cáo và sửa lỗi.

## 3. Phạm vi kiểm thử

### 3.1 Chức năng trong phạm vi

| STT | Requirement Name | Class Name | Function Name | Function Code | Sheet Name | Điều kiện tiền đề |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Kiểm chứng chức năng đăng ký tài khoản | Feature01 | Đăng ký | F01_REGISTER | UT Lab 1 | Người dùng chưa đăng nhập; SMS/OTP, API và database hoạt động |
| 2 | Kiểm chứng chức năng gọi video | Feature02 | Video call | F02_VIDEO_CALL | UT Lab 2 | Hai tài khoản đã là bạn bè; thiết bị có camera, micro và mạng ổn định |
| 3 | Kiểm chứng chức năng tạo nhóm chat | Feature03 | Tạo nhóm | F03_CREATE_GROUP | UT Lab 3 | Người dùng đã đăng nhập và có danh sách bạn bè |
| 4 | Kiểm chứng chức năng tóm tắt trò chuyện | Feature04 | Tóm tắt trò chuyện | F04_CHAT_SUMMARY | UT Lab 4 | Người dùng có quyền xem chat; dịch vụ tóm tắt hoạt động |
| 5 | Kiểm chứng chức năng thêm bạn bè | Feature05 | Thêm bạn bè | F05_ADD_FRIEND | UT Lab 5 | Người dùng đã đăng nhập |
| 6 | Kiểm chứng chức năng tạo bình chọn | Feature06 | Tạo bình chọn | F06_CREATE_POLL | UT Lab 6 | Người dùng là thành viên chat/nhóm có hỗ trợ poll |
| 7 | Kiểm chứng chức năng thu hồi tin nhắn | Feature07 | Thu hồi tin nhắn | F07_RECALL_MESSAGE | UT Lab 7 | Người dùng đã đăng nhập và có tin nhắn trong chat |
| 8 | Kiểm chứng chức năng đăng tải khoảnh khắc | Feature08 | Đăng tải khoảnh khắc | F08_POST_MOMENT | UT Lab 8 | Người dùng đã đăng nhập |
| 9 | Kiểm chứng chức năng gửi âm thanh | Feature09 | Gửi âm thanh | F09_SEND_AUDIO | UT Lab 9 | Người dùng đã đăng nhập trong trò chuyện |

### 3.2 Chức năng ngoài phạm vi

- Đăng nhập, đăng xuất, quên mật khẩu, đổi mật khẩu nếu không liên quan trực tiếp đến điều kiện tiền đề.
- Quản lý hồ sơ cá nhân.
- Quản lý thông báo nâng cao.
- AI Assistant ngoài chức năng tóm tắt trò chuyện.
- Kiểm thử tải nặng quy mô lớn.
- Kiểm thử bảo mật chuyên sâu như pentest.

## 4. Chiến lược kiểm thử

### 4.1 Kiểm thử chức năng

Mỗi chức năng sẽ được kiểm thử theo các nhóm trường hợp:

- Trường hợp hợp lệ: người dùng nhập đúng dữ liệu và thao tác đúng luồng.
- Trường hợp không hợp lệ: thiếu dữ liệu, nhập sai định dạng hoặc không đủ quyền.
- Trường hợp biên: dữ liệu quá dài, file lớn, nhiều thành viên, mạng yếu.
- Trường hợp khôi phục: reload trang, mất kết nối tạm thời, thao tác lại sau khi lỗi.

### 4.2 Kiểm thử giao diện

Kiểm tra giao diện trên Web và Mobile nếu chức năng có mặt trên cả hai nền tảng:

- Nút, form, modal, thông báo lỗi và toast hiển thị đúng.
- Nội dung không bị tràn, không bị che khuất.
- Trạng thái loading, disabled, success, error rõ ràng.
- Người dùng dễ hiểu thao tác tiếp theo.

### 4.3 Kiểm thử tích hợp

Các chức năng cần kiểm tra sự phối hợp giữa frontend, backend, database, storage và socket:

- Đăng ký ghi dữ liệu tài khoản vào hệ thống.
- Gọi video sử dụng kết nối real-time và thiết bị camera/micro.
- Tạo nhóm cập nhật danh sách thành viên.
- Tạo bình chọn và thu hồi tin nhắn cập nhật đồng bộ trong cuộc trò chuyện.
- Đăng khoảnh khắc và gửi âm thanh có thể cần upload media.

### 4.4 Kiểm thử real-time

Dùng tối thiểu 2 tài khoản kiểm thử đăng nhập đồng thời để kiểm tra:

- Cuộc gọi video được gửi, nhận, từ chối và kết thúc đúng.
- Tin nhắn bị thu hồi được cập nhật trên màn hình của các thành viên khác.
- Bình chọn mới xuất hiện trong nhóm/chat.
- Âm thanh gửi đi được người nhận nhìn thấy và phát lại.

## 5. Môi trường kiểm thử

| Thành phần | Mô tả |
| --- | --- |
| Backend | Node.js/Express server đang chạy ổn định |
| Web client | Trình duyệt Chrome hoặc Edge |
| Mobile client | Android emulator hoặc thiết bị Android thật nếu có |
| Kết nối mạng | Có Internet, ưu tiên mạng ổn định khi kiểm thử video call |
| Database | Database test có dữ liệu người dùng, bạn bè, nhóm và tin nhắn |
| Storage/media | Dịch vụ upload hoạt động nếu kiểm thử ảnh, video, âm thanh |

## 6. Dữ liệu kiểm thử đề xuất

| Mã dữ liệu | Mô tả | Dùng cho chức năng |
| --- | --- | --- |
| U01 | Tài khoản người dùng A đã đăng nhập | Tạo nhóm, thêm bạn, bình chọn, thu hồi tin nhắn, đăng khoảnh khắc, gửi âm thanh |
| U02 | Tài khoản người dùng B đã đăng nhập | Video call, thêm bạn, nhận tin nhắn, nhận âm thanh |
| U03 | Tài khoản chưa là bạn bè với U01 | Thêm bạn bè |
| U04 | Email/số điện thoại chưa tồn tại trong hệ thống | Đăng ký |
| U05 | Email/số điện thoại đã tồn tại | Đăng ký lỗi |
| G01 | Nhóm chat có U01 và U02 | Tạo bình chọn, thu hồi tin nhắn, gửi âm thanh |
| MSG01 | Tin nhắn do U01 gửi | Thu hồi tin nhắn |
| POLL01 | Nội dung bình chọn gồm từ 2 lựa chọn trở lên | Tạo bình chọn |
| MEDIA01 | File ảnh/video hợp lệ | Đăng tải khoảnh khắc |
| AUDIO01 | File ghi âm hợp lệ | Gửi âm thanh |

## 7. Ma trận ưu tiên kiểm thử

| Chức năng | Mức ưu tiên | Lý do |
| --- | --- | --- |
| Đăng ký | P0 | Là bước đầu để người dùng có tài khoản sử dụng hệ thống |
| Thêm bạn bè | P0 | Là điều kiện quan trọng để chat, gọi và tạo nhóm |
| Tạo nhóm | P0 | Là chức năng nền cho chat nhóm, bình chọn và gửi media |
| Thu hồi tin nhắn | P1 | Ảnh hưởng trực tiếp đến dữ liệu hội thoại và real-time |
| Gửi âm thanh | P1 | Chức năng chat media quan trọng |
| Video call | P1 | Chức năng real-time phụ thuộc thiết bị và mạng |
| Tạo bình chọn | P1 | Chức năng tương tác trong nhóm/chat |
| Đăng tải khoảnh khắc | P1 | Chức năng đăng nội dung media của người dùng |
| Tóm tắt trò chuyện | P2 | Có thể phụ thuộc dịch vụ AI/tóm tắt bên ngoài |

## 8. Test case tổng quan theo chức năng

### 8.1 F01_REGISTER - Đăng ký tài khoản

| Mã TC | Mục tiêu kiểm thử | Dữ liệu đầu vào | Kết quả mong đợi |
| --- | --- | --- | --- |
| TC-F01-001 | Đăng ký thành công với dữ liệu hợp lệ | Tên, email/số điện thoại, mật khẩu, OTP hợp lệ | Tài khoản được tạo thành công và có thể đăng nhập |
| TC-F01-002 | Đăng ký với email/số điện thoại đã tồn tại | Email/số điện thoại đã có trong hệ thống | Hệ thống báo lỗi trùng thông tin |
| TC-F01-003 | Đăng ký khi bỏ trống trường bắt buộc | Thiếu email, số điện thoại hoặc mật khẩu | Hệ thống hiển thị lỗi bắt buộc nhập |
| TC-F01-004 | Xác thực OTP sai hoặc hết hạn | OTP không đúng hoặc quá hạn | Hệ thống không cho hoàn tất đăng ký |
| TC-F01-005 | Mật khẩu không đạt yêu cầu | Mật khẩu quá ngắn hoặc yếu | Hệ thống báo lỗi quy tắc mật khẩu |

### 8.2 F02_VIDEO_CALL - Gọi video

| Mã TC | Mục tiêu kiểm thử | Dữ liệu đầu vào | Kết quả mong đợi |
| --- | --- | --- | --- |
| TC-F02-001 | Gọi video thành công giữa hai bạn bè | U01 gọi U02 | U02 nhận lời mời, hai bên nhìn/nghe được nhau |
| TC-F02-002 | Người nhận từ chối cuộc gọi | U02 chọn từ chối | U01 nhận trạng thái cuộc gọi bị từ chối |
| TC-F02-003 | Người gọi hủy trước khi người nhận bắt máy | U01 hủy cuộc gọi | U02 không còn lời mời gọi đang chờ |
| TC-F02-004 | Thiết bị không cấp quyền camera/micro | Từ chối quyền thiết bị | Hệ thống báo lỗi quyền truy cập thiết bị |
| TC-F02-005 | Mạng yếu hoặc mất kết nối trong khi gọi | Ngắt mạng tạm thời | Cuộc gọi báo lỗi, kết thúc hoặc khôi phục theo thiết kế |

### 8.3 F03_CREATE_GROUP - Tạo nhóm chat

| Mã TC | Mục tiêu kiểm thử | Dữ liệu đầu vào | Kết quả mong đợi |
| --- | --- | --- | --- |
| TC-F03-001 | Tạo nhóm thành công | Tên nhóm và danh sách thành viên hợp lệ | Nhóm mới được tạo, thành viên nhìn thấy nhóm |
| TC-F03-002 | Tạo nhóm không nhập tên | Danh sách thành viên có, tên nhóm trống | Hệ thống báo lỗi tên nhóm |
| TC-F03-003 | Tạo nhóm không chọn thành viên | Chỉ nhập tên nhóm | Hệ thống báo lỗi chưa chọn thành viên |
| TC-F03-004 | Tạo nhóm với nhiều thành viên | Tên nhóm và nhiều bạn bè | Nhóm được tạo đủ thành viên |
| TC-F03-005 | Tạo nhóm khi mất kết nối | Ngắt mạng lúc gửi yêu cầu | Hệ thống báo lỗi hoặc không tạo nhóm trùng |

### 8.4 F04_CHAT_SUMMARY - Tóm tắt trò chuyện

| Mã TC | Mục tiêu kiểm thử | Dữ liệu đầu vào | Kết quả mong đợi |
| --- | --- | --- | --- |
| TC-F04-001 | Tóm tắt cuộc trò chuyện có nhiều tin nhắn | Cuộc trò chuyện có lịch sử chat | Hệ thống trả về nội dung tóm tắt chính xác, dễ hiểu |
| TC-F04-002 | Tóm tắt cuộc trò chuyện ít hoặc không có tin nhắn | Chat trống hoặc rất ít tin | Hệ thống báo không đủ dữ liệu hoặc trả tóm tắt phù hợp |
| TC-F04-003 | Người không có quyền xem chat yêu cầu tóm tắt | User không thuộc conversation | Hệ thống từ chối truy cập |
| TC-F04-004 | Dịch vụ tóm tắt/AI lỗi | Giả lập lỗi dịch vụ | Hệ thống hiển thị lỗi, không treo giao diện |
| TC-F04-005 | Tóm tắt sau khi có tin nhắn mới | Thêm tin nhắn rồi tóm tắt lại | Nội dung tóm tắt phản ánh dữ liệu mới |

### 8.5 F05_ADD_FRIEND - Thêm bạn bè

| Mã TC | Mục tiêu kiểm thử | Dữ liệu đầu vào | Kết quả mong đợi |
| --- | --- | --- | --- |
| TC-F05-001 | Tìm và gửi lời mời kết bạn thành công | Số điện thoại/email của U03 | Lời mời được gửi, trạng thái chuyển sang đang chờ |
| TC-F05-002 | Tìm người dùng không tồn tại | Số điện thoại/email không có trong hệ thống | Hệ thống báo không tìm thấy người dùng |
| TC-F05-003 | Gửi lời mời trùng lặp | Gửi lại cho user đang chờ | Hệ thống không tạo lời mời trùng |
| TC-F05-004 | Chấp nhận lời mời kết bạn | U03 chấp nhận lời mời từ U01 | Hai người trở thành bạn bè |
| TC-F05-005 | Từ chối lời mời kết bạn | U03 từ chối lời mời | Trạng thái lời mời được cập nhật đúng |

### 8.6 F06_CREATE_POLL - Tạo bình chọn

| Mã TC | Mục tiêu kiểm thử | Dữ liệu đầu vào | Kết quả mong đợi |
| --- | --- | --- | --- |
| TC-F06-001 | Tạo bình chọn thành công | Câu hỏi và ít nhất 2 lựa chọn | Bình chọn xuất hiện trong chat/nhóm |
| TC-F06-002 | Tạo bình chọn thiếu câu hỏi | Chỉ nhập lựa chọn | Hệ thống báo lỗi câu hỏi |
| TC-F06-003 | Tạo bình chọn thiếu lựa chọn | Chỉ nhập câu hỏi hoặc 1 lựa chọn | Hệ thống báo cần tối thiểu 2 lựa chọn |
| TC-F06-004 | Thành viên chọn một phương án | User chọn option | Số phiếu được cập nhật đúng |
| TC-F06-005 | Người không thuộc nhóm tạo bình chọn | User không có quyền | Hệ thống từ chối thao tác |

### 8.7 F07_RECALL_MESSAGE - Thu hồi tin nhắn

| Mã TC | Mục tiêu kiểm thử | Dữ liệu đầu vào | Kết quả mong đợi |
| --- | --- | --- | --- |
| TC-F07-001 | Thu hồi tin nhắn của chính mình | MSG01 do U01 gửi | Tin nhắn chuyển sang trạng thái đã thu hồi |
| TC-F07-002 | Thu hồi tin nhắn của người khác | U01 chọn tin nhắn của U02 | Hệ thống từ chối nếu không có quyền |
| TC-F07-003 | Thu hồi tin nhắn đã thu hồi trước đó | Chọn lại tin đã thu hồi | Hệ thống không xử lý trùng hoặc báo trạng thái hiện tại |
| TC-F07-004 | Thu hồi tin nhắn và kiểm tra client khác | U01 thu hồi, U02 đang mở chat | Màn hình U02 cập nhật real-time |
| TC-F07-005 | Thu hồi khi mất mạng | Ngắt mạng lúc thao tác | Hệ thống báo lỗi, dữ liệu không bị sai lệch |

### 8.8 F08_POST_MOMENT - Đăng tải khoảnh khắc

| Mã TC | Mục tiêu kiểm thử | Dữ liệu đầu vào | Kết quả mong đợi |
| --- | --- | --- | --- |
| TC-F08-001 | Đăng khoảnh khắc dạng văn bản | Nội dung text hợp lệ | Bài đăng xuất hiện trên feed |
| TC-F08-002 | Đăng khoảnh khắc có ảnh/video | Text kèm media hợp lệ | Media upload thành công và hiển thị đúng |
| TC-F08-003 | Đăng khoảnh khắc với nội dung trống | Không nhập text, không chọn media | Hệ thống báo lỗi nội dung |
| TC-F08-004 | Upload media không hợp lệ | File sai định dạng hoặc quá dung lượng | Hệ thống báo lỗi upload |
| TC-F08-005 | Kiểm tra bài đăng sau khi reload | Reload feed sau khi đăng | Bài đăng vẫn hiển thị đúng dữ liệu |

### 8.9 F09_SEND_AUDIO - Gửi âm thanh

| Mã TC | Mục tiêu kiểm thử | Dữ liệu đầu vào | Kết quả mong đợi |
| --- | --- | --- | --- |
| TC-F09-001 | Gửi tin nhắn âm thanh thành công | File ghi âm hợp lệ | Tin nhắn âm thanh xuất hiện trong cuộc trò chuyện |
| TC-F09-002 | Người nhận phát lại âm thanh | U02 mở và phát file âm thanh | Âm thanh phát được, hiển thị đúng thời lượng nếu có |
| TC-F09-003 | Gửi âm thanh khi file quá lớn | File vượt giới hạn | Hệ thống báo lỗi dung lượng |
| TC-F09-004 | Gửi âm thanh khi mất mạng | Ngắt mạng lúc gửi | Hệ thống báo lỗi hoặc đưa vào hàng chờ nếu có hỗ trợ |
| TC-F09-005 | Kiểm tra đồng bộ real-time | U01 gửi, U02 đang mở chat | U02 nhận tin nhắn âm thanh ngay hoặc sau khi đồng bộ |

## 9. Tiêu chí bắt đầu kiểm thử

- Backend, Web và Mobile chạy được trên môi trường test.
- Có ít nhất 2 tài khoản test đã đăng nhập được.
- Có dữ liệu bạn bè, nhóm chat và tin nhắn phục vụ kiểm thử.
- Camera, micro và kết nối mạng sẵn sàng cho kiểm thử video call.
- Dịch vụ upload và dịch vụ tóm tắt trò chuyện hoạt động.

## 10. Tiêu chí kết thúc kiểm thử

- 100% test case mức P0 đã được thực thi.
- Ít nhất 90% test case mức P1 đã pass.
- Không còn lỗi Blocker hoặc Critical đang mở.
- Các lỗi Major còn lại đã có ghi chú, workaround hoặc được nhóm chấp nhận.
- Có báo cáo kết quả kiểm thử gồm Pass/Fail, Bug ID và ghi chú.

## 11. Phân loại mức độ lỗi

| Mức độ | Định nghĩa | Ví dụ |
| --- | --- | --- |
| Blocker | Không thể tiếp tục kiểm thử hoặc không thể sử dụng hệ thống | Server không chạy, không đăng ký được tài khoản |
| Critical | Lỗi nghiêm trọng ảnh hưởng chức năng chính hoặc dữ liệu | Người dùng thu hồi được tin nhắn của người khác |
| Major | Chức năng chính hoạt động sai nhưng vẫn có thể tiếp tục kiểm thử | Gửi âm thanh thành công nhưng người nhận không thấy real-time |
| Minor | Lỗi nhỏ, chủ yếu ảnh hưởng trải nghiệm | Thông báo lỗi chưa rõ ràng |
| Trivial | Lỗi rất nhỏ, không ảnh hưởng nghiệp vụ | Khoảng cách giao diện chưa đều |

## 12. Lịch trình kiểm thử đề xuất

| Giai đoạn | Thời lượng | Nội dung |
| --- | --- | --- |
| Chuẩn bị | 0.5 ngày | Tạo tài khoản test, kiểm tra môi trường, chuẩn bị dữ liệu |
| Smoke test | 0.5 ngày | Kiểm tra nhanh đăng ký, thêm bạn, tạo nhóm, gửi âm thanh |
| Functional test | 1.5 ngày | Chạy test case cho đủ 9 chức năng |
| Real-time/integration test | 1 ngày | Kiểm tra video call, thu hồi tin nhắn, bình chọn, gửi âm thanh trên nhiều client |
| Regression test | 0.5-1 ngày | Kiểm thử lại sau khi sửa lỗi |
| Tổng hợp báo cáo | 0.5 ngày | Tổng hợp Pass/Fail, bug và kết luận |

## 13. Mẫu báo cáo kết quả kiểm thử

| Mã TC | Chức năng | Tên test case | Ưu tiên | Kết quả | Bug ID | Ghi chú |
| --- | --- | --- | --- | --- | --- | --- |
| TC-F01-001 | Đăng ký | Đăng ký thành công với dữ liệu hợp lệ | P0 | Pass/Fail | | |
| TC-F02-001 | Video call | Gọi video thành công giữa hai bạn bè | P1 | Pass/Fail | | |
| TC-F03-001 | Tạo nhóm | Tạo nhóm thành công | P0 | Pass/Fail | | |
| TC-F04-001 | Tóm tắt trò chuyện | Tóm tắt cuộc trò chuyện có nhiều tin nhắn | P2 | Pass/Fail | | |
| TC-F05-001 | Thêm bạn bè | Gửi lời mời kết bạn thành công | P0 | Pass/Fail | | |
| TC-F06-001 | Tạo bình chọn | Tạo bình chọn thành công | P1 | Pass/Fail | | |
| TC-F07-001 | Thu hồi tin nhắn | Thu hồi tin nhắn của chính mình | P1 | Pass/Fail | | |
| TC-F08-001 | Đăng khoảnh khắc | Đăng khoảnh khắc dạng văn bản | P1 | Pass/Fail | | |
| TC-F09-001 | Gửi âm thanh | Gửi tin nhắn âm thanh thành công | P1 | Pass/Fail | | |

## 14. Rủi ro và biện pháp giảm thiểu

| Rủi ro | Ảnh hưởng | Biện pháp giảm thiểu |
| --- | --- | --- |
| Mạng yếu khi kiểm thử video call | Cuộc gọi không ổn định, khó xác định lỗi | Kiểm thử trên mạng ổn định trước, sau đó mới kiểm thử mạng yếu |
| Dữ liệu test bị thay đổi | Khó tái hiện lỗi | Chuẩn bị sẵn tài khoản và dữ liệu test cố định |
| Dịch vụ upload hoặc tóm tắt bị lỗi | Không kiểm thử được chức năng media/summary | Ghi nhận trạng thái dịch vụ và kiểm thử lại khi dịch vụ hoạt động |
| Thiết bị không có camera/micro | Không kiểm thử được video call | Dùng thiết bị khác hoặc emulator có cấu hình phù hợp |
| Chức năng real-time không đồng bộ | Người dùng thấy dữ liệu khác nhau | Kiểm thử song song trên hai client và ghi lại thời điểm thao tác |
