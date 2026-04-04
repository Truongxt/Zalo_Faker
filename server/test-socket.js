// server/test-socket.js
const { io } = require("socket.io-client");

const SERVER_URL = "http://localhost:3000";
const TEST_CONVERSATION_ID = "conv-5"; // ← thay bằng conversationId thật của bạn
const USER_1 = "user-1";
const USER_2 = "user-2";

console.log("🔌 Đang kết nối tới server...\n");

const client1 = io(SERVER_URL);
const client2 = io(SERVER_URL);

// Lưu lại messageId từ Test 1 để dùng cho Test 4
let savedMessageId = null;

// ── CLIENT 1 ─────────────────────────────────────────
client1.on("connect", () => {
    console.log(`✅ Client 1 kết nối thành công (${client1.id})`);
    client1.emit("user:join", USER_1);
    client1.emit("room:join", TEST_CONVERSATION_ID);
    console.log(`📥 Client 1 đã vào phòng: ${TEST_CONVERSATION_ID}`);
});

client1.on("chat:message", (msg) => {
    console.log("\n📨 Client 1 nhận được tin nhắn:");
    console.log(`   - ID     : ${msg.id}`);
    console.log(`   - Nội dung: ${msg.content?.text}`);
    console.log(`   - Từ     : ${msg.senderId}`);
    console.log(`   - Lúc    : ${msg.createdAt}`);
});

client1.on("chat:typing", ({ userId }) => {
    console.log(`\n✏️  Client 1 thấy: ${userId} đang gõ...`);
});

client1.on("chat:recalled", ({ messageId }) => {
    console.log(`\n🗑️  Client 1 thấy tin nhắn bị thu hồi: ${messageId}`);
});

// ── CLIENT 2 ─────────────────────────────────────────
client2.on("connect", () => {
    console.log(`✅ Client 2 kết nối thành công (${client2.id})`);
    client2.emit("user:join", USER_2);
    client2.emit("room:join", TEST_CONVERSATION_ID);
    console.log(`📥 Client 2 đã vào phòng: ${TEST_CONVERSATION_ID}\n`);

    setTimeout(() => runTests(), 1000);
});

client2.on("chat:message", (msg) => {
    console.log("\n📨 Client 2 nhận được tin nhắn:");
    console.log(`   - ID     : ${msg.id}`);
    console.log(`   - Nội dung: ${msg.content?.text}`);
    console.log(`   - Từ     : ${msg.senderId}`);
});

client2.on("chat:recalled", ({ messageId }) => {
    console.log(`\n🗑️  Client 2 thấy tin nhắn bị thu hồi: ${messageId}`);
});

// ── CHẠY CÁC BÀI TEST ────────────────────────────────
async function runTests() {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🧪 Bắt đầu test...\n");

    // ── Test 1: Gửi tin nhắn từ Client 1 ──────────────
    console.log("📤 Test 1: Client 1 gửi tin nhắn văn bản...");
    client1.emit("chat:send", {
        conversationId: TEST_CONVERSATION_ID,
        senderId: USER_1,
        type: "text",
        content: { text: "Xin chào từ Client 1!" },
    }, (res) => {
        if (res.success) {
            savedMessageId = res.message.id  // ← lưu lại để test thu hồi
            console.log("   ✅ Server xác nhận: lưu DB thành công");
            console.log(`   📌 MessageId lưu lại: ${savedMessageId}`);
        } else {
            console.log("   ❌ Server lỗi:", res.error);
        }
    });

    await delay(1000);

    // ── Test 2: Typing indicator ───────────────────────
    console.log("\n📤 Test 2: Client 2 đang gõ...");
    client2.emit("chat:typing", {
        conversationId: TEST_CONVERSATION_ID,
        userId: USER_2,
    });

    await delay(1000);

    // ── Test 3: Client 2 gửi tin nhắn ─────────────────
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

    // ── Test 4: Thu hồi tin nhắn ──────────────────────
    console.log("\n📤 Test 4: Client 1 thu hồi tin nhắn của mình...");

    if (!savedMessageId) {
        console.log("   ⚠️  Chưa có messageId — Test 1 chưa lưu được, bỏ qua Test 4");
    } else {
        client1.emit("chat:recall", {
            messageId: savedMessageId,
            conversationId: TEST_CONVERSATION_ID,
            senderId: USER_1,
        }, (res) => {
            if (res.success) {
                console.log("   ✅ Thu hồi thành công!");
            } else {
                console.log("   ❌ Thất bại:", res.error);
            }
        });
    }

    await delay(1000);

    // ── Test 5: Thu hồi tin nhắn không phải của mình ──
    console.log("\n📤 Test 5: Client 2 thử thu hồi tin nhắn của Client 1 (phải bị từ chối)...");

    if (savedMessageId) {
        client2.emit("chat:recall", {
            messageId: savedMessageId,
            conversationId: TEST_CONVERSATION_ID,
            senderId: USER_2,  // ← sai người gửi
        }, (res) => {
            if (!res.success) {
                console.log("   ✅ Server từ chối đúng:", res.error);
            } else {
                console.log("   ❌ Lỗi: Server không nên cho phép thu hồi!");
            }
        });
    }

    await delay(2000);

    // Kết thúc
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ Test hoàn thành! Đóng kết nối...\n");
    client1.disconnect();
    client2.disconnect();
    process.exit(0);
}

// ── Lỗi kết nối ──────────────────────────────────────
client1.on("connect_error", (err) => {
    console.error("❌ Client 1 lỗi kết nối:", err.message);
    console.error("   → Kiểm tra server có đang chạy ở port 3000 không?");
    process.exit(1);
});

client2.on("connect_error", (err) => {
    console.error("❌ Client 2 lỗi kết nối:", err.message);
    process.exit(1);
});

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}