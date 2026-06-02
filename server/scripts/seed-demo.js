require("dotenv").config();
const AWS = require("aws-sdk");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");

AWS.config.update({
  region: process.env.REGION,
  accessKeyId: process.env.ACCESS_KEY_ID,
  secretAccessKey: process.env.SECRET_ACCESS_KEY,
});

const dynamodb = new AWS.DynamoDB.DocumentClient();

async function seedDemoData() {
    try {
        console.log("Starting seed demo data...");
        const hashedPassword = await bcrypt.hash("123456nhan123@@", 10);
        
        // 1. Users
        const users = [
            { id: "10001", email: "demo1@taklo.com", name: "Demo User 1" },
            { id: "10002", email: "demo2@taklo.com", name: "Demo User 2" },
            { id: "10003", email: "demo3@taklo.com", name: "Demo User 3" }
        ];

        for (const u of users) {
             await dynamodb.put({
                TableName: "User",
                Item: {
                    userId: u.id,
                    email: u.email,
                    userName: u.name,
                    password: hashedPassword,
                    avartarUrl: "https://i.pravatar.cc/300?img=" + u.id.slice(-1),
                    birthday: "1990-01-01",
                    gender: "male",
                    phone: "09000" + u.id,
                    status: "active",
                    createdAt: new Date().toISOString()
                }
            }).promise();
            console.log(`Created user: ${u.email}`);
        }

        // 2. Friends
        const friends = [
            { from: 10001, to: 10002 },
            { from: 10002, to: 10003 },
            { from: 10001, to: 10003 }
        ];

        for (const f of friends) {
             await dynamodb.put({
                TableName: "Friends",
                Item: {
                    fromUserId: f.from,
                    toUserId: f.to,
                    status: "accepted",
                    message: "Let's be friends",
                    createdAt: Date.now()
                }
            }).promise();
            
             await dynamodb.put({
                TableName: "Friends",
                Item: {
                    fromUserId: f.to,
                    toUserId: f.from,
                    status: "accepted",
                    message: "Let's be friends",
                    createdAt: Date.now()
                }
            }).promise();
            console.log(`Created friends: ${f.from} <-> ${f.to}`);
        }

        // 3. Conversations
        const privateConvId = uuidv4();
        await dynamodb.put({
            TableName: "Conversation",
            Item: {
                _id: privateConvId,
                type: "private",
                name: "Private Chat",
                avatar: "https://i.pravatar.cc/300?img=1",
                createdBy: "10001",
                createdAt: new Date().toISOString(),
                participants: [
                    { userId: "10001", role: "member", nickname: "Demo 1", joinedAt: new Date().toISOString(), lastRead: null },
                    { userId: "10002", role: "member", nickname: "Demo 2", joinedAt: new Date().toISOString(), lastRead: null }
                ],
                lastMessage: null
            }
        }).promise();
        console.log(`Created private conversation: 10001 & 10002`);

        const groupConvId = uuidv4();
        await dynamodb.put({
            TableName: "Conversation",
            Item: {
                _id: groupConvId,
                type: "group",
                name: "Demo Group Zalo",
                avatar: "https://i.pravatar.cc/300?img=9",
                createdBy: "10001",
                createdAt: new Date().toISOString(),
                participants: [
                    { userId: "10001", role: "admin", nickname: "Admin", joinedAt: new Date().toISOString(), lastRead: null },
                    { userId: "10002", role: "member", nickname: "Thành viên 2", joinedAt: new Date().toISOString(), lastRead: null },
                    { userId: "10003", role: "member", nickname: "Thành viên 3", joinedAt: new Date().toISOString(), lastRead: null }
                ],
                lastMessage: null
            }
        }).promise();
        console.log(`Created group conversation: ${groupConvId}`);

        console.log("\n=========================================");
        console.log("🔥 TẠO DỮ LIỆU MẪU THÀNH CÔNG! 🔥");
        console.log("Danh sách tài khoản test (Mật khẩu: 123456nhan123@@):");
        for (const u of users) {
             console.log(`  👉 Email: ${u.email} `);
        }
        console.log("=========================================\n");

    } catch (e) {
        console.error("Error seeding demo data:", e);
    }
}

seedDemoData();
