const fs = require('fs');
const path = require('path');

const targetFile = 'd:/CNM/Zalo_Faker/apps/web/src/pages/ChatRoom.tsx';
let content = fs.readFileSync(targetFile, 'utf8');

const replacements = [
    { from: /Chá» n má»™t cuá»™c trĂ² chuyá»‡n/g, to: 'Chọn một cuộc trò chuyện' },
    { from: /thĂ nh viĂªn/g, to: 'thành viên' },
    { from: /Ä Ă³ng tĂ¬m kiáº¿m tin nhắn/g, to: 'Đóng tìm kiếm tin nhắn' },
    { from: /TĂ¬m kiáº¿m tin nhắn/g, to: 'Tìm kiếm tin nhắn' },
    { from: /Quáº£n trá»‹ nhĂ³m/g, to: 'Quản trị nhóm' },
    { from: /Ä á»•i tĂªn gá»£i nhá»›/g, to: 'Đổi tên gợi nhớ' },
    { from: /Bật thĂ´ng bĂ¡o/g, to: 'Bật thông báo' },
    { from: /Táº¯t thĂ´ng bĂ¡o/g, to: 'Tắt thông báo' },
    { from: /Ä á»•i hĂ¬nh ná» n/g, to: 'Đổi hình nền' },
    { from: /XĂ³a lá»‹ch sá»­ trĂ² chuyá»‡n/g, to: 'Xóa lịch sử trò chuyện' },
    { from: /KhĂ´ng cĂ³ káº¿t ná»‘i/g, to: 'Không có kết nối' },
    { from: /tin nhắn chá» /g, to: 'tin nhắn chờ' },
    { from: /Không t\?m th\?y tin nh\?n nào ch\?a/g, to: 'Không tìm thấy tin nhắn nào chứa' },
    { from: /Nháº­p tá»« khĂ³a tĂ¬m kiáº¿m.../g, to: 'Nhập từ khóa tìm kiếm...' },
    { from: /Nháº­p tá»« khĂ³a Ä‘á»ƒ tĂ¬m trong cuá»™c trĂ² chuyá»‡n/g, to: 'Nhập từ khóa để tìm trong cuộc trò chuyện' },
    { from: /Tin nhắn Ä‘Ă£ ghim/g, to: 'Tin nhắn đã ghim' },
    { from: /Bá»  ghim/g, to: 'Bỏ ghim' },
    { from: /ThĂ´ng bĂ¡o/g, to: 'Thông báo' },
    { from: /Quan trọng/g, to: 'Quan trọng' },
    { from: /NhĂ£n dĂ¡n/g, to: 'Nhãn dán' },
    { from: /Tin nhắn thoáº¡i/g, to: 'Tin nhắn thoại' },
    { from: /HĂ¬nh áº£nh/g, to: 'Hình ảnh' },
    { from: /Ä ang thu Ă¢m.../g, to: 'Đang thu âm...' },
    { from: /Nháº­p ná»™i dung thĂ´ng bĂ¡o.../g, to: 'Nhập nội dung thông báo...' },
    { from: /Nháº­p tin nhắn.../g, to: 'Nhập tin nhắn...' },
    { from: /Táº¯t cháº¿ Ä‘á»™ thĂ´ng bĂ¡o/g, to: 'Tắt chế độ thông báo' },
    { from: /Bật cháº¿ Ä‘á»™ thĂ´ng bĂ¡o/g, to: 'Bật chế độ thông báo' },
    { from: /Táº¯t cháº¿ Ä‘á»™ tin nhắn quan trọng/g, to: 'Tắt chế độ tin nhắn quan trọng' },
    { from: /Bật cháº¿ Ä‘á»™ tin nhắn quan trọng/g, to: 'Bật chế độ tin nhắn quan trọng' },
    { from: /Ä ang gá»­i.../g, to: 'Đang gửi...' },
    { from: /Báº¡n khĂ´ng cĂ³ quyá» n gá»­i media/g, to: 'Bạn không có quyền gửi media' },
    { from: /Báº¡n khĂ´ng cĂ³ quyá» n gá»­i thĂ´ng bĂ¡o/g, to: 'Bạn không có quyền gửi thông báo' },
    { from: /Há»§y tá»‡p/g, to: 'Hủy tệp' },
    { from: /Gá»­i hĂ¬nh áº£nh\/video/g, to: 'Gửi hình ảnh/video' },
    { from: /Gá»­i file/g, to: 'Gửi file' },
    { from: /Xem trĂ°á»›c tá»‡p/g, to: 'Xem trước tệp' },
    { from: /Nháº¥n gá»­i Ä‘á»ƒ gá»­i vĂ o Ä‘oáº¡n chat/g, to: 'Nhấn gửi để gửi vào đoạn chat' },
    { from: /TĂ­nh nÄƒng gá» i video nhĂ³m Ä‘ang Ä‘Æ°á»£c phĂ¡t triá»ƒn!/g, to: 'Tính năng gọi video nhóm đang được phát triển!' },
    { from: /TĂ­nh nÄƒng gá» i thoáº¡i nhĂ³m Ä‘ang Ä‘Æ°á»£c phĂ¡t triá»ƒn!/g, to: 'Tính năng gọi thoại nhóm đang được phát triển!' },
    { from: /Cuá»™c trĂ² chuyá»‡n/g, to: 'Cuộc trò chuyện' },
];

replacements.forEach(r => {
    content = content.replace(r.from, r.to);
});

fs.writeFileSync(targetFile, content, 'utf8');
console.log('Rebuild applied successfully');
