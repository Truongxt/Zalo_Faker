# 📊 Class Diagram - Zalo Faker

> Sơ đồ lớp chi tiết cho ứng dụng chat

---

## 1. Tổng Quan Hệ Thống

```mermaid
classDiagram
    direction TB
    
    %% ==================== MODELS ====================
    class User {
        +String supabaseId
        +String email
        +String fullName
        +String phone
        +String avatarUrl
        +String bio
        +String status
        +Date lastSeen
        +Date createdAt
        +Date updatedAt
    }

    class Conversation {
        +ObjectId _id
        +String type
        +String name
        +String avatar
        +Participant[] participants
        +LastMessage lastMessage
        +String createdBy
        +Date createdAt
        +Date updatedAt
    }

    class Message {
        +ObjectId _id
        +ObjectId conversationId
        +String senderId
        +String type
        +Content content
        +ObjectId replyTo
        +Reaction[] reactions
        +ReadReceipt[] readBy
        +Boolean isDeleted
        +Date createdAt
    }

    %% ==================== SUB-TYPES ====================
    class Participant {
        +String userId
        +String role
        +String nickname
        +Date joinedAt
        +Date lastRead
    }

    class Content {
        +String text
        +String mediaUrl
        +String thumbnail
        +String fileName
        +Number fileSize
        +Number duration
    }

    class Reaction {
        +String userId
        +String emoji
    }

    class ReadReceipt {
        +String userId
        +Date readAt
    }

    class LastMessage {
        +String content
        +String type
        +String senderId
        +Date timestamp
    }

    %% ==================== RELATIONSHIPS ====================
    User "1" --> "*" Conversation : participates
    Conversation "1" --> "*" Message : contains
    Conversation "1" --> "*" Participant : has
    Message "1" --> "1" Content : has
    Message "1" --> "*" Reaction : has
    Message "1" --> "*" ReadReceipt : has
    Conversation "1" --> "0..1" LastMessage : has
    Message "0..1" --> "0..1" Message : replyTo
```

---

## 2. Chi Tiết Từng Class

### 2.1 User Class

```mermaid
classDiagram
    class User {
        <<Model>>
        -ObjectId _id
        +String supabaseId
        +String email
        +String fullName
        +String phone
        +String avatarUrl
        +String bio
        +UserStatus status
        +Date lastSeen
        +Date createdAt
        +Date updatedAt
        
        +findBySupabaseId(id) User
        +updateStatus(status) void
        +updateProfile(data) User
        +search(keyword) User[]
    }

    class UserStatus {
        <<enumeration>>
        online
        offline
        away
    }

    User --> UserStatus
```

| Thuộc tính | Kiểu | Mô tả | Bắt buộc |
|------------|------|-------|----------|
| `supabaseId` | String | ID từ Supabase Auth | ✅ |
| `email` | String | Email đăng nhập | ✅ |
| `fullName` | String | Họ tên | ✅ |
| `phone` | String | Số điện thoại | ❌ |
| `avatarUrl` | String | URL ảnh đại diện | ❌ |
| `bio` | String | Giới thiệu bản thân (max 200 ký tự) | ❌ |
| `status` | Enum | Trạng thái: online/offline/away | ✅ |
| `lastSeen` | Date | Thời điểm online cuối | ❌ |

---

### 2.2 Conversation Class

```mermaid
classDiagram
    class Conversation {
        <<Model>>
        -ObjectId _id
        +ConversationType type
        +String name
        +String avatar
        +Participant[] participants
        +LastMessage lastMessage
        +String createdBy
        +Date createdAt
        +Date updatedAt
        
        +create(data) Conversation
        +findByUserId(userId) Conversation[]
        +addParticipant(userId) void
        +removeParticipant(userId) void
        +updateLastMessage(message) void
    }

    class ConversationType {
        <<enumeration>>
        private
        group
    }

    class Participant {
        <<embedded>>
        +String userId
        +ParticipantRole role
        +String nickname
        +Date joinedAt
        +Date lastRead
    }

    class ParticipantRole {
        <<enumeration>>
        admin
        member
    }

    class LastMessage {
        <<embedded>>
        +String content
        +String type
        +String senderId
        +Date timestamp
    }

    Conversation --> ConversationType
    Conversation "1" *-- "*" Participant : contains
    Conversation "1" *-- "0..1" LastMessage : has
    Participant --> ParticipantRole
```

| Thuộc tính | Kiểu | Mô tả | Bắt buộc |
|------------|------|-------|----------|
| `type` | Enum | private (1-1) hoặc group | ✅ |
| `name` | String | Tên nhóm (chỉ cho group) | ❌ |
| `avatar` | String | Avatar nhóm | ❌ |
| `participants` | Array | Danh sách thành viên | ✅ |
| `lastMessage` | Object | Tin nhắn cuối cùng | ❌ |
| `createdBy` | String | ID người tạo | ✅ |

---

### 2.3 Message Class

```mermaid
classDiagram
    class Message {
        <<Model>>
        -ObjectId _id
        +ObjectId conversationId
        +String senderId
        +MessageType type
        +Content content
        +ObjectId replyTo
        +Reaction[] reactions
        +ReadReceipt[] readBy
        +Boolean isDeleted
        +Date createdAt
        
        +create(data) Message
        +findByConversation(id, options) Message[]
        +softDelete() void
        +addReaction(userId, emoji) void
        +removeReaction(userId) void
        +markAsRead(userId) void
    }

    class MessageType {
        <<enumeration>>
        text
        image
        video
        file
        sticker
        voice
    }

    class Content {
        <<embedded>>
        +String text
        +String mediaUrl
        +String thumbnail
        +String fileName
        +Number fileSize
        +Number duration
    }

    class Reaction {
        <<embedded>>
        +String userId
        +String emoji
    }

    class ReadReceipt {
        <<embedded>>
        +String userId
        +Date readAt
    }

    Message --> MessageType
    Message "1" *-- "1" Content : has
    Message "1" *-- "*" Reaction : has
    Message "1" *-- "*" ReadReceipt : has
    Message "0..1" --> "0..1" Message : replyTo
```

| Thuộc tính | Kiểu | Mô tả | Bắt buộc |
|------------|------|-------|----------|
| `conversationId` | ObjectId | ID cuộc hội thoại | ✅ |
| `senderId` | String | ID người gửi (supabaseId) | ✅ |
| `type` | Enum | Loại tin nhắn | ✅ |
| `content` | Object | Nội dung tin nhắn | ✅ |
| `replyTo` | ObjectId | ID tin nhắn được trả lời | ❌ |
| `reactions` | Array | Danh sách reactions | ❌ |
| `readBy` | Array | Danh sách đã đọc | ❌ |
| `isDeleted` | Boolean | Đã xóa (soft delete) | ✅ |

---

## 3. MVC Architecture

```mermaid
classDiagram
    direction LR

    %% ==================== CONTROLLERS ====================
    class AuthController {
        <<Controller>>
        +register(req, res) Response
        +login(req, res) Response
        +logout(req, res) Response
        +refreshToken(req, res) Response
    }

    class UserController {
        <<Controller>>
        +getUser(req, res) Response
        +getMe(req, res) Response
        +updateMe(req, res) Response
        +searchUsers(req, res) Response
    }

    class ChatController {
        <<Controller>>
        +getConversations(req, res) Response
        +createConversation(req, res) Response
        +getMessages(req, res) Response
        +sendMessage(req, res) Response
        +deleteMessage(req, res) Response
        +addReaction(req, res) Response
    }

    class GroupController {
        <<Controller>>
        +createGroup(req, res) Response
        +updateGroup(req, res) Response
        +deleteGroup(req, res) Response
        +addMembers(req, res) Response
        +removeMember(req, res) Response
        +leaveGroup(req, res) Response
    }

    %% ==================== MODELS ====================
    class User {
        <<Model>>
    }

    class Conversation {
        <<Model>>
    }

    class Message {
        <<Model>>
    }

    %% ==================== RELATIONSHIPS ====================
    AuthController --> User : uses
    UserController --> User : uses
    ChatController --> Conversation : uses
    ChatController --> Message : uses
    GroupController --> Conversation : uses
```

---

## 4. Routes Mapping

```mermaid
flowchart LR
    subgraph "Auth Routes"
        A1[POST /api/auth/register]
        A2[POST /api/auth/login]
        A3[POST /api/auth/logout]
        A4[POST /api/auth/refresh]
    end

    subgraph "User Routes"
        U1[GET /api/users/me]
        U2[PATCH /api/users/me]
        U3[GET /api/users/search]
        U4[GET /api/users/:id]
    end

    subgraph "Chat Routes"
        C1[GET /api/conversations]
        C2[POST /api/conversations]
        C3[GET /api/conversations/:id/messages]
        C4[POST /api/conversations/:id/messages]
        C5[DELETE /api/conversations/:id/messages/:msgId]
        C6[POST /api/conversations/:id/messages/:msgId/reactions]
    end

    subgraph "Group Routes"
        G1[POST /api/groups]
        G2[PATCH /api/groups/:id]
        G3[DELETE /api/groups/:id]
        G4[POST /api/groups/:id/members]
        G5[DELETE /api/groups/:id/members/:memberId]
        G6[POST /api/groups/:id/leave]
    end

    A1 --> AuthController
    A2 --> AuthController
    A3 --> AuthController
    A4 --> AuthController

    U1 --> UserController
    U2 --> UserController
    U3 --> UserController
    U4 --> UserController

    C1 --> ChatController
    C2 --> ChatController
    C3 --> ChatController
    C4 --> ChatController
    C5 --> ChatController
    C6 --> ChatController

    G1 --> GroupController
    G2 --> GroupController
    G3 --> GroupController
    G4 --> GroupController
    G5 --> GroupController
    G6 --> GroupController
```

---

## 5. Socket Events

```mermaid
classDiagram
    class SocketHandler {
        <<Handler>>
        -Map~String,String~ onlineUsers
        +setupSocket(io) void
        +joinUserRooms(socket, userId) void
        +getSocketId(userId) String
        +isUserOnline(userId) Boolean
    }

    class ClientEvents {
        <<Events>>
        message_send
        typing_start
        typing_stop
        message_read
        message_delete
        message_reaction
    }

    class ServerEvents {
        <<Events>>
        message_new
        typing_start
        typing_stop
        message_read
        message_deleted
        message_reaction
        user_online
        user_offline
        error
    }

    SocketHandler --> ClientEvents : listens
    SocketHandler --> ServerEvents : emits
```

| Client Event | Server Response | Mô tả |
|--------------|-----------------|-------|
| `message:send` | `message:new` | Gửi tin nhắn mới |
| `typing:start` | `typing:start` | Bắt đầu gõ |
| `typing:stop` | `typing:stop` | Dừng gõ |
| `message:read` | `message:read` | Đánh dấu đã đọc |
| `message:delete` | `message:deleted` | Xóa tin nhắn |
| `message:reaction` | `message:reaction` | Thêm reaction |
| (connect) | `user:online` | User online |
| (disconnect) | `user:offline` | User offline |

---

## 6. Middleware Chain

```mermaid
flowchart LR
    Request --> Helmet
    Helmet --> CORS
    CORS --> Morgan
    Morgan --> JSON["express.json()"]
    JSON --> Router
    Router --> AuthMiddleware
    AuthMiddleware --> Controller
    Controller --> Model
    Model --> Response
    
    Controller -.-> ErrorMiddleware
    ErrorMiddleware -.-> ErrorResponse
```

---

## 7. Relationships Summary

```mermaid
erDiagram
    USER ||--o{ CONVERSATION : participates
    CONVERSATION ||--o{ MESSAGE : contains
    CONVERSATION ||--o{ PARTICIPANT : has
    MESSAGE ||--o{ REACTION : has
    MESSAGE ||--o{ READ_RECEIPT : has
    MESSAGE ||--o| MESSAGE : replies_to

    USER {
        string supabaseId PK
        string email UK
        string fullName
        string phone UK
        string avatarUrl
        string bio
        enum status
        datetime lastSeen
    }

    CONVERSATION {
        ObjectId _id PK
        enum type
        string name
        string avatar
        string createdBy FK
    }

    PARTICIPANT {
        string userId FK
        enum role
        string nickname
        datetime joinedAt
        datetime lastRead
    }

    MESSAGE {
        ObjectId _id PK
        ObjectId conversationId FK
        string senderId FK
        enum type
        json content
        ObjectId replyTo FK
        boolean isDeleted
    }

    REACTION {
        string userId FK
        string emoji
    }

    READ_RECEIPT {
        string userId FK
        datetime readAt
    }
```

---

## 8. Hướng Dẫn Triển Khai

### Thứ Tự Implement

```
1. User Model      → Quan trọng nhất, là nền tảng
2. Conversation    → Phụ thuộc User
3. Message         → Phụ thuộc Conversation
4. Controllers     → Sau khi có Models
5. Routes          → Sau khi có Controllers
6. Socket          → Cuối cùng, cho real-time
```

### Mapping File ↔ Class

| Class | File Location |
|-------|---------------|
| `User` | `server/src/models/User.ts` |
| `Conversation` | `server/src/models/Conversation.ts` |
| `Message` | `server/src/models/Message.ts` |
| `AuthController` | `server/src/controllers/authController.ts` |
| `UserController` | `server/src/controllers/userController.ts` |
| `ChatController` | `server/src/controllers/chatController.ts` |
| `GroupController` | `server/src/controllers/groupController.ts` |
