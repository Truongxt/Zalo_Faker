const fs = require('fs');
const path = 'd:/CNM/Zalo_Faker/apps/web/src/pages/ChatRoom.tsx';

// 1. Read as binary first to detect BOM or issues if needed, but let's try utf8 first
let content = fs.readFileSync(path, 'utf8');

// 2. Fix the corrupted strings seen in screenshot
// Zalo Faker strings:
// "Nhập tin nhắn..." -> "Nháº­p tin nháº¯n..."
// "Đang hoạt động" -> "Äang hoáº¡t Ä‘á»™ng"
// "Tắt chế độ tin nhắn quan trọng" -> "Tắt chế độ tin nhắn quan trọng"
// "Bật chế độ tin nhắn quan trọng" -> "Bật chế độ tin nhắn quan trọng"

// Helper to fix specific moji patterns
function fixMojibake(text) {
    return text
        .replace(/Nháº­p/g, 'Nhập')
        .replace(/Nháº¯p/g, 'Nhập')
        .replace(/nháº¯n/g, 'nhắn')
        .replace(/Äang hoáº¡t Ä‘á»™ng/g, 'Đang hoạt động')
        .replace(/Báº­t/g, 'Bật')
        .replace(/táº¯t/g, 'tắt')
        .replace(/biá»ƒu tá»£ng/g, 'biểu tượng')
        .replace(/quan trá»ng/g, 'quan trọng');
}

content = fixMojibake(content);

// 3. Technical Fixes
// Stacking context
content = content.replace(/z-50/g, 'z-[1000]');
// Ensure input area is above message list
if (!content.includes('p-4 border-t border-gray-200 dark:border-gray-800 relative z-20')) {
    content = content.replace('p-4 border-t border-gray-200 dark:border-gray-800', 'p-4 border-t border-gray-200 dark:border-gray-800 relative z-20');
}

// Ensure sticker picker closes
if (!content.includes('addMessage(conversationId, stickerMsg); setShowStickerPicker(false)')) {
    content = content.replace('addMessage(conversationId, stickerMsg)', 'addMessage(conversationId, stickerMsg); setShowStickerPicker(false)');
}

// 4. Save
fs.writeFileSync(path, content, 'utf8');
console.log('Fix applied successfully');
