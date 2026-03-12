// file này dùng để import dữ liệu Từ mockData.ts vào DynamoDB
import dotenv from "dotenv"
import path from "path"

// Load .env từ thư mục server/ (cha của script/) không có là lỗi do không load được file env vì không được import trong dự án
dotenv.config({ path: path.resolve(__dirname, "../.env") })

import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { PutCommand, DynamoDBDocument } from "@aws-sdk/lib-dynamodb"
import { mockUsers, mockConversations, mockMessages } from "../../apps/web/src/data/mockData"
import { log } from "node:console"


const client = new DynamoDBClient({
    region: process.env.REGION,
    credentials: {
        accessKeyId: process.env.ACCESS_KEY_ID!,
        secretAccessKey: process.env.SECRET_ACCESS_KEY!,
    }
})


const docClient = DynamoDBDocument.from(client)


async function seedUser() {
    for (const user of mockUsers) {
        await docClient.send(new PutCommand({
            TableName: "User",
            Item: {
                userId: user.id,
                email: user.email,
                phone: user.phone,
                fullName: user.fullName,
                avatarUrl: user.avatarUrl,
                bio: user.bio,
                status: user.status,
                lastSeen: user.lastSeen,
                createdAt: user.createdAt
            }
        }))
    }
}


async function seedConversation() {
    for (const conversation of mockConversations) {
        await docClient.send(new PutCommand({
            TableName: "Conversation",
            Item: {
                _id: conversation.id,
                type: conversation.type,
                participants: conversation.participants,
                lastMessage: conversation.lastMessage,
                unreadCount: conversation.unreadCount,
                createdAt: conversation.createdAt,
                updatedAt: conversation.updatedAt
            }
        }))
    }
}


async function seedMessages() {
    for (const convId in mockMessages) {
        const messages = mockMessages[convId]
        for (const message of messages) {
            await docClient.send(new PutCommand({
                TableName: "Message",
                Item: {
                    _id: message.id,
                    conversationId: message.conversationId,
                    senderId: message.senderId,
                    content: message.content,
                    type: message.type,
                    reactions: message.reactions,
                    readBy: message.readBy,
                    isDeleted: message.isDeleted,
                    createdAt: message.createdAt
                }
            }))
        }
    }
}


async function main() {
    await seedUser()
    await seedConversation()
    await seedMessages()

    console.log("Seed complete")
}

main()


