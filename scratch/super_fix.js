const fs = require('fs');

const targetFile = 'd:/CNM/Zalo_Faker/apps/web/src/pages/ChatRoom.tsx';
let buf = fs.readFileSync(targetFile);

function replaceBuffer(original, replacement) {
    let start = 0;
    while ((start = buf.indexOf(original, start)) !== -1) {
        const head = buf.slice(0, start);
        const tail = buf.slice(start + original.length);
        buf = Buffer.concat([head, replacement, tail]);
        start += replacement.length;
    }
}

// Map of corrupted UTF-8 sequences to clean UTF-8
const patterns = [
    { 
        corrupted: Buffer.from('4368c3a1c2bbc28d6e206dc3a1c2bbe284a274206375c3a1c2bbe284a263207472c482c2b22063687579c3a1c2bbe280a16e', 'hex'), 
        clean: Buffer.from('Chọn một cuộc trò chuyện', 'utf8') 
    },
    {
        corrupted: Buffer.from('thc482c2a0nh vic482c2aa n', 'hex'), // This might vary
        clean: Buffer.from('thành viên', 'utf8')
    }
];

patterns.forEach(p => replaceBuffer(p.corrupted, p.clean));

// General mojibake fix
let text = buf.toString('utf8');
const moji = [
    [/thĂ nh viĂªn/g, 'thành viên'],
    [/Ä Ă³ng tĂ¬m kiáº¿m tin nhắn/g, 'Đóng tìm kiếm tin nhắn'],
    [/TĂ¬m kiáº¿m tin nhắn/g, 'Tìm kiếm tin nhắn'],
    [/Quáº£n trá»‹ nhĂ³m/g, 'Quản trị nhóm'],
    [/Ä á»•i tĂªn gá»£i nhá»›/g, 'Đổi tên gợi nhớ'],
    [/Bật thĂ´ng bĂ¡o/g, 'Bật thông báo'],
    [/Táº¯t thĂ´ng bĂ¡o/g, 'Tắt thông báo'],
    [/Ä á»•i hĂ¬nh ná» n/g, 'Đổi hình nền'],
    [/Chá» n má»™t cuá»™c trĂ² chuyá»‡n/g, 'Chọn một cuộc trò chuyện'],
    [/XĂ³a lá»‹ch sá»­ trĂ² chuyá»‡n/g, 'Xóa lịch sử trò chuyện'],
];

moji.forEach(([from, to]) => { text = text.replace(from, to); });

fs.writeFileSync(targetFile, text, 'utf8');
console.log('Super Rebuild applied');
