# Bang Chuc Nang He Thong va Cach Su Dung

Tai lieu nay tong hop cac chuc nang chinh cua he thong Zalo_Faker de:

- Huan luyen AI tro ly noi bo
- Huong dan nguoi dung cuoi thao tac nhanh
- Lam checklist khi test UAT

## Bang Tong Hop

| STT | Nhom chuc nang    | Chuc nang                                            | Doi tuong su dung              | Cach su dung (nguoi dung)                                                        | Dau vao can co                               | Ket qua mong doi                                 |
| --- | ----------------- | ---------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------ |
| 1   | Tai khoan         | Dang ky tai khoan                                    | Nguoi dung moi                 | Vao man hinh Dang ky -> nhap thong tin -> xac thuc OTP email -> hoan tat dang ky | Email, mat khau, ten hien thi, so dien thoai | Tao tai khoan thanh cong va dang nhap duoc       |
| 2   | Tai khoan         | Dang nhap                                            | Tat ca nguoi dung              | Vao Dang nhap -> nhap email + mat khau -> bam Dang nhap                          | Email + mat khau dung                        | Vao he thong, co access token                    |
| 3   | Tai khoan         | Dang xuat                                            | Tat ca nguoi dung              | Vao Ca nhan -> Dang xuat                                                         | Token dang nhap hop le                       | Phien dang nhap bi huy                           |
| 4   | Tai khoan         | Quen mat khau                                        | Nguoi dung quen mat khau       | Vao Quen mat khau -> yeu cau OTP -> xac thuc OTP -> dat mat khau moi             | Email hop le                                 | Dat lai mat khau thanh cong                      |
| 5   | Tai khoan         | Doi mat khau                                         | Nguoi dung da dang nhap        | Vao Cai dat tai khoan -> Doi mat khau -> nhap mat khau cu va moi                 | Mat khau cu dung                             | Mat khau moi co hieu luc                         |
| 6   | Tai khoan         | Khoa tai khoan tam thoi/vinh vien                    | Nguoi dung can bao mat         | Vao Cai dat bao mat -> chon khoa tai khoan -> (neu vinh vien thi xac thuc OTP)   | Token hop le, OTP (neu co)                   | Tai khoan bi gioi han truy cap theo che do khoa  |
| 7   | Ho so             | Cap nhat thong tin ca nhan                           | Tat ca nguoi dung              | Vao trang ca nhan -> Chinh sua -> luu                                            | Thong tin hop le                             | Ho so duoc cap nhat                              |
| 8   | Ban be            | Tim kiem nguoi dung theo SDT                         | Tat ca nguoi dung              | Vao Them ban -> nhap so dien thoai -> tim                                        | So dien thoai ton tai                        | Hien thong tin nguoi dung                        |
| 9   | Ban be            | Gui loi moi ket ban                                  | Tat ca nguoi dung              | Tu ket qua tim kiem -> bam Ket ban                                               | userId doi phuong                            | Loi moi duoc tao                                 |
| 10  | Ban be            | Chap nhan/Tu choi loi moi                            | Tat ca nguoi dung              | Vao Danh sach loi moi -> chap nhan hoac tu choi                                  | Loi moi dang cho xu ly                       | Cap nhat trang thai moi                          |
| 11  | Ban be            | Xoa ban                                              | Tat ca nguoi dung              | Vao danh sach ban be -> chon ban -> Xoa ban                                      | Quan he ban be da ton tai                    | Hai ben khong con la ban                         |
| 12  | Ban be            | Chan/Bo chan nguoi dung                              | Tat ca nguoi dung              | Vao chi tiet ban be -> Chan; de bo chan vao danh sach da chan                    | targetUserId                                 | Chan thanh cong hoac bo chan thanh cong          |
| 13  | Chat ca nhan/nhom | Tao cuoc tro chuyen                                  | Tat ca nguoi dung              | Vao Chat -> tao hoi thoai moi (1-1/nhom)                                         | Danh sach thanh vien                         | Tao conversation thanh cong                      |
| 14  | Chat ca nhan/nhom | Gui tin nhan van ban/media/file/sticker              | Tat ca nguoi dung              | Mo hoi thoai -> nhap noi dung hoac chon tep -> Gui                               | conversationId + noi dung                    | Tin nhan moi xuat hien trong cuoc tro chuyen     |
| 15  | Chat ca nhan/nhom | Xem lich su tin nhan                                 | Tat ca nguoi dung              | Mo hoi thoai -> cuon de xem lich su                                              | conversationId                               | Danh sach tin nhan theo thu tu                   |
| 16  | Nhom              | Tao nhom                                             | Thanh vien duoc phep           | Vao tao nhom -> dat ten -> chon thanh vien -> tao                                | Ten nhom + members                           | Nhom duoc tao                                    |
| 17  | Nhom              | Quan tri nhom (doi ten, avatar, thanh vien, vai tro) | Admin/Deputy                   | Vao cai dat nhom -> thuc hien tac vu quan tri                                    | Quyen admin/deputy                           | Cap nhat cai dat nhom                            |
| 18  | Nhom              | Loi moi vao nhom bang ma invite                      | Nguoi dung + admin nhom        | Nguoi dung gui yeu cau bang ma moi; admin duyet yeu cau                          | Invite code hop le                           | Gia nhap nhom neu duoc duyet                     |
| 19  | Moments           | Dang bai viet moment                                 | Tat ca nguoi dung              | Vao tab Moments -> Tao bai -> dang noi dung/anh/video                            | Noi dung hop le                              | Bai viet hien tren feed                          |
| 20  | Moments           | Tuong tac moment (thich, binh luan, chia se)         | Tat ca nguoi dung              | Mo bai viet -> thao tac tuong tac                                                | momentId                                     | Tuong tac duoc ghi nhan                          |
| 21  | Upload            | Tai file len he thong                                | Tat ca nguoi dung              | Chon tep trong man chat/moment -> tai len                                        | File hop le                                  | Nhan URL file de gan vao tin nhan/bai viet       |
| 22  | AI Assistant      | Hoi dap voi AI                                       | Tat ca nguoi dung da dang nhap | Vao tab Discover -> nhap cau hoi -> Gui                                          | Cac cau hoi text                             | AI tra loi dua tren ngu canh va du lieu cho phep |
| 23  | AI Assistant      | Tao thread AI moi                                    | Tat ca nguoi dung              | Vao tab Discover -> bam nut +                                                    | Dang dang nhap                               | Bat dau cuoc hoi thoai AI moi                    |
| 24  | AI Assistant      | Mo/xem lich su thread AI                             | Tat ca nguoi dung              | Vao tab Discover -> bam icon lich su -> chon thread can xem                      | Co lich su truoc do                          | Nap lai noi dung hoi dap cua thread              |
| 25  | AI Assistant      | Xoa 1 thread AI                                      | Tat ca nguoi dung              | Trong danh sach thread -> giu de hien menu xoa -> xac nhan                       | conversationId hop le                        | Xoa metadata thread va toan bo Q/A trong thread  |

## Quy uoc huong dan cho AI tro ly

- Neu nguoi dung hoi ve tai khoan: uu tien huong dan theo luong Dang ky, Dang nhap, Quen mat khau, Doi mat khau.
- Neu nguoi dung hoi "xoa tai khoan": thong bao he thong chua co luong xoa truc tiep trong app, huong dan vao Cai dat bao mat de khoa tai khoan tam thoi hoac vinh vien.
- Neu nguoi dung hoi ve chat: huong dan vao tab Chat, mo dung conversation, gui dung loai noi dung.
- Neu nguoi dung hoi ve AI Assistant: huong dan tab Discover, cach tao thread moi (+), mo lich su (icon dong ho), va giu de xoa thread.
- Neu nguoi dung gap loi 401/het phien: huong dan dang nhap lai.
- Khong huong dan thao tac co tinh nang quan tri nhom neu nguoi dung khong co quyen.

## Mau cau huong dan ngan cho CS/AI

- "Ban vao tab Discover, bam dau + de tao hoi thoai AI moi, sau do nhap cau hoi va bam gui."
- "De xem thread cu, bam icon lich su (hinh dong ho) o goc phai tren."
- "De xoa thread AI, nhan giu vao thread trong danh sach lich su roi chon Xoa."
- "Neu ung dung bao het phien, ban dang nhap lai de tiep tuc."
