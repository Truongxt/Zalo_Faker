// server/test-socket.js
const { io } = require("socket.io-client");

const SERVER_URL = "http://localhost:3000";

// ── Thay bằng conversationId thật trong DB của bạn ──
const TEST_CONVERSATION_ID = "conv-5";
const USER_1 = "user-1";
const USER_2 = "user-2";

console.log("🔌 Đang kết nối tới server...\n");

// Tạo 2 client giả lập 2 người dùng
const client1 = io(SERVER_URL);
const client2 = io(SERVER_URL);

// ── CLIENT 1 ─────────────────────────────────────────
client1.on("connect", () => {
    console.log(`✅ Client 1 kết nối thành công (${client1.id})`);

    // Join với userId
    client1.emit("user:join", USER_1);

    // Vào phòng chat
    client1.emit("room:join", TEST_CONVERSATION_ID);
    console.log(`📥 Client 1 đã vào phòng: ${TEST_CONVERSATION_ID}`);
});

// Client 1 lắng nghe tin nhắn
client1.on("chat:message", (msg) => {
    console.log("\n📨 Client 1 nhận được tin nhắn:");
    console.log(`   - ID     : ${msg.id}`);
    console.log(`   - Nội dung: ${msg.content?.text}`);
    console.log(`   - Từ     : ${msg.senderId}`);
    console.log(`   - Lúc    : ${msg.createdAt}`);
});

// Client 1 lắng nghe typing
client1.on("chat:typing", ({ userId }) => {
    console.log(`\n✏️  Client 1 thấy: ${userId} đang gõ...`);
});

// ── CLIENT 2 ─────────────────────────────────────────
client2.on("connect", () => {
    console.log(`✅ Client 2 kết nối thành công (${client2.id})`);

    client2.emit("user:join", USER_2);
    client2.emit("room:join", TEST_CONVERSATION_ID);
    console.log(`📥 Client 2 đã vào phòng: ${TEST_CONVERSATION_ID}\n`);

    // Chờ 1 giây rồi bắt đầu test
    setTimeout(() => runTests(), 1000);
});

// Client 2 lắng nghe tin nhắn
client2.on("chat:message", (msg) => {
    console.log("\n📨 Client 2 nhận được tin nhắn:");
    console.log(`   - ID     : ${msg.id}`);
    console.log(`   - Nội dung: ${msg.content?.text}`);
    console.log(`   - Từ     : ${msg.senderId}`);
});

// ── CHẠY CÁC BÀI TEST ────────────────────────────────
async function runTests() {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🧪 Bắt đầu test...\n");

    // Test 1: Gửi tin nhắn từ Client 1
    console.log("📤 Test 1: Client 1 gửi tin nhắn văn bản...");
    client1.emit("chat:send", {
        conversationId: TEST_CONVERSATION_ID,
        senderId: USER_1,
        type: "text",
        content: { text: "Xin chào từ Client 1!" },
    }, (res) => {
        if (res.success) {
            console.log("   ✅ Server xác nhận: lưu DB thành công");
        } else {
            console.log("   ❌ Server lỗi:", res.error);
        }
    });

    // Chờ 1 giây
    await delay(1000);

    // Test 2: Typing indicator
    console.log("\n📤 Test 2: Client 2 đang gõ...");
    client2.emit("chat:typing", {
        conversationId: TEST_CONVERSATION_ID,
        userId: USER_2,
    });

    await delay(1000);

    // Test 3: Client 2 gửi tin nhắn
    console.log("\n📤 Test 3: Client 2 gửi tin nhắn...");
    client2.emit("chat:send", {
        conversationId: TEST_CONVERSATION_ID,
        senderId: USER_2,
        type: "text",
        content: { text: "Client 2 trả lời!" },
    }, (res) => {
        if (res.success) {
            console.log("   ✅ Server xác nhận: lưu DB thành công");
        } else {
            console.log("   ❌ Server lỗi:", res.error);
        }
    });

    await delay(1000);

    // Kết thúc test
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ Test hoàn thành! Đóng kết nối...\n");
    client1.disconnect();
    client2.disconnect();
    process.exit(0);
}

// Lắng nghe lỗi kết nối
client1.on("connect_error", (err) => {
    console.error("❌ Client 1 lỗi kết nối:", err.message);
    console.error("   → Kiểm tra server có đang chạy ở port 4000 không?");
    process.exit(1);
});

client2.on("connect_error", (err) => {
    console.error("❌ Client 2 lỗi kết nối:", err.message);
    process.exit(1);
});

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}