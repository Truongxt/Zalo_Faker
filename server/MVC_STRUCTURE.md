# 🏗️ Backend MVC Structure - Zalo Faker

## Cấu Trúc Thư Mục MVC

```
server/src/
├── config/              # Cấu hình (database, env, ...)
│   ├── database.ts
│   ├── supabase.ts
│   └── cloudinary.ts
│
├── models/              # M - Models (Database schemas)
│   ├── User.ts
│   ├── Message.ts
│   ├── Conversation.ts
│   └── index.ts
│
├── controllers/         # C - Controllers (Xử lý request)
│   ├── authController.ts
│   ├── userController.ts
│   ├── chatController.ts
│   ├── groupController.ts
│   ├── mediaController.ts
│   └── aiController.ts
│
├── routes/              # Routes (Định nghĩa endpoints)
│   ├── authRoutes.ts
│   ├── userRoutes.ts
│   ├── chatRoutes.ts
│   ├── groupRoutes.ts
│   ├── mediaRoutes.ts
│   ├── aiRoutes.ts
│   └── index.ts
│
├── middlewares/         # Middleware (Auth, validation)
│   ├── authMiddleware.ts
│   ├── errorMiddleware.ts
│   └── validateMiddleware.ts
│
├── socket/              # Socket.io handlers
│   ├── chatSocket.ts
│   ├── callSocket.ts
│   └── index.ts
│
├── utils/               # Helper functions
│   ├── response.ts
│   ├── errors.ts
│   └── helpers.ts
│
└── app.ts               # Entry point
```

## Giải Thích MVC

```
    Request
       │
       ▼
┌─────────────┐
│   ROUTES    │ ── Định nghĩa URL endpoints
└─────────────┘
       │
       ▼
┌─────────────┐
│ CONTROLLERS │ ── Xử lý logic, gọi Model
└─────────────┘
       │
       ▼
┌─────────────┐
│   MODELS    │ ── Tương tác Database
└─────────────┘
       │
       ▼
    Response
```

## So Sánh

| Cũ (Modular) | Mới (MVC) |
|--------------|-----------|
| `modules/chat/chat.model.ts` | `models/Message.ts` |
| `modules/chat/chat.controller.ts` | `controllers/chatController.ts` |
| `modules/chat/chat.routes.ts` | `routes/chatRoutes.ts` |
