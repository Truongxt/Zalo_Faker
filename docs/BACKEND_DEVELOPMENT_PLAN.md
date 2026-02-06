# 🛠️ Backend Development Plan - Zalo Faker

> Kế hoạch chi tiết để team 4 người phát triển Backend

---

## 📋 Mục Lục

1. [Kiến trúc tổng quan](#1-kiến-trúc-tổng-quan)
2. [Cấu trúc thư mục](#2-cấu-trúc-thư-mục)
3. [Coding Conventions](#3-coding-conventions)
4. [API Design Standards](#4-api-design-standards)
5. [Database Schema](#5-database-schema)
6. [Phân công công việc](#6-phân-công-công-việc)
7. [Quy trình làm việc](#7-quy-trình-làm-việc)
8. [Testing Strategy](#8-testing-strategy)

---

## 1. Kiến Trúc Tổng Quan

### 1.1 Tech Stack

| Layer | Technology | Lý do chọn |
|-------|------------|------------|
| Runtime | Node.js 20+ | Event-driven, non-blocking I/O |
| Framework | Express.js | Đơn giản, flexible, nhiều middleware |
| Language | TypeScript | Type safety, IDE support tốt |
| Real-time | Socket.io | WebSocket với fallback, rooms support |
| Auth | Supabase Auth | Free, OAuth built-in |
| Database (Users) | PostgreSQL (Supabase) | Relational, ACID compliance |
| Database (Chat) | MongoDB Atlas | Flexible schema cho messages |
| Media | Cloudinary | CDN, image optimization |
| AI | Google Gemini | Free tier lớn |

### 1.2 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                           CLIENTS                                │
│              (Web App, Mobile App, Admin Dashboard)              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API GATEWAY                               │
│                    (Express.js Server)                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   REST API  │  │  Socket.io  │  │  Middleware │              │
│  │   Routes    │  │   Server    │  │  (Auth,CORS)│              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   SUPABASE      │  │   MONGODB       │  │   CLOUDINARY    │
│  (Auth + Users) │  │  (Chat Data)    │  │    (Media)      │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### 1.3 Request Flow

```
Client Request
     │
     ▼
┌─────────────┐
│   Router    │ ─── Route matching
└─────────────┘
     │
     ▼
┌─────────────┐
│ Middleware  │ ─── Auth, Validation, Rate Limiting
└─────────────┘
     │
     ▼
┌─────────────┐
│ Controller  │ ─── Handle request, call services
└─────────────┘
     │
     ▼
┌─────────────┐
│  Service    │ ─── Business logic
└─────────────┘
     │
     ▼
┌─────────────┐
│   Model     │ ─── Database operations
└─────────────┘
     │
     ▼
  Response
```

---

## 2. Cấu Trúc Thư Mục

```
server/
├── src/
│   ├── config/           # Configuration files
│   │   ├── env.ts        # Environment variables
│   │   ├── database.ts   # MongoDB connection
│   │   ├── supabase.ts   # Supabase client
│   │   ├── cloudinary.ts # Cloudinary config
│   │   └── ai.ts         # Gemini AI config
│   │
│   ├── middleware/       # Express middleware
│   │   ├── auth.ts       # JWT verification
│   │   ├── validate.ts   # Request validation
│   │   ├── error.ts      # Error handling
│   │   └── rateLimit.ts  # Rate limiting
│   │
│   ├── modules/          # Feature modules (Domain-driven)
│   │   ├── auth/
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   └── auth.validation.ts
│   │   │
│   │   ├── user/
│   │   │   ├── user.routes.ts
│   │   │   ├── user.controller.ts
│   │   │   ├── user.service.ts
│   │   │   ├── user.model.ts        # MongoDB model
│   │   │   └── user.validation.ts
│   │   │
│   │   ├── chat/
│   │   │   ├── chat.routes.ts
│   │   │   ├── chat.controller.ts
│   │   │   ├── chat.service.ts
│   │   │   ├── message.model.ts
│   │   │   ├── conversation.model.ts
│   │   │   └── chat.validation.ts
│   │   │
│   │   ├── group/
│   │   │   └── ... (same pattern)
│   │   │
│   │   ├── media/
│   │   │   └── ...
│   │   │
│   │   └── ai/
│   │       └── ...
│   │
│   ├── socket/           # Socket.io handlers
│   │   ├── index.ts      # Socket setup
│   │   ├── chat.socket.ts
│   │   ├── call.socket.ts
│   │   └── presence.socket.ts
│   │
│   ├── utils/            # Helper functions
│   │   ├── response.ts   # Standard response format
│   │   ├── errors.ts     # Custom error classes
│   │   └── helpers.ts    # General helpers
│   │
│   ├── types/            # TypeScript types
│   │   └── index.ts
│   │
│   └── app.ts            # Entry point
│
├── tests/                # Test files
│   ├── unit/
│   └── integration/
│
├── .env.example
├── package.json
└── tsconfig.json
```

### Giải thích Pattern

**Modular Architecture**: Mỗi feature là 1 module độc lập với:
- `routes.ts`: Định nghĩa endpoints
- `controller.ts`: Xử lý request/response
- `service.ts`: Business logic
- `model.ts`: Database schema
- `validation.ts`: Input validation

---

## 3. Coding Conventions

### 3.1 Naming Conventions

```typescript
// Files: kebab-case
user.controller.ts
chat.service.ts

// Classes: PascalCase
class UserService {}
class MessageController {}

// Functions/Variables: camelCase
async function getUserById() {}
const accessToken = 'xxx'

// Constants: UPPER_SNAKE_CASE
const MAX_MESSAGE_LENGTH = 5000
const API_VERSION = 'v1'

// Interfaces: PascalCase with 'I' prefix (optional)
interface IUser {}
interface User {} // cũng OK

// Types: PascalCase
type MessageType = 'text' | 'image' | 'video'
```

### 3.2 File Structure Template

**Controller Template:**
```typescript
// user.controller.ts
import { Request, Response, NextFunction } from 'express'
import { UserService } from './user.service.js'
import { successResponse, errorResponse } from '@/utils/response.js'

export class UserController {
  private userService: UserService

  constructor() {
    this.userService = new UserService()
  }

  // GET /api/users/:id
  getUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params
      const user = await this.userService.findById(id)
      
      if (!user) {
        return errorResponse(res, 404, 'User not found')
      }
      
      return successResponse(res, 200, 'User retrieved', user)
    } catch (error) {
      next(error)
    }
  }

  // POST /api/users
  createUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.userService.create(req.body)
      return successResponse(res, 201, 'User created', user)
    } catch (error) {
      next(error)
    }
  }
}
```

**Service Template:**
```typescript
// user.service.ts
import { User, IUser } from './user.model.js'

export class UserService {
  async findById(id: string): Promise<IUser | null> {
    return User.findById(id)
  }

  async create(data: Partial<IUser>): Promise<IUser> {
    const user = new User(data)
    return user.save()
  }

  async update(id: string, data: Partial<IUser>): Promise<IUser | null> {
    return User.findByIdAndUpdate(id, data, { new: true })
  }

  async delete(id: string): Promise<boolean> {
    const result = await User.findByIdAndDelete(id)
    return !!result
  }
}
```

**Routes Template:**
```typescript
// user.routes.ts
import { Router } from 'express'
import { UserController } from './user.controller.js'
import { authMiddleware } from '@/middleware/auth.js'
import { validate } from '@/middleware/validate.js'
import { createUserSchema, updateUserSchema } from './user.validation.js'

const router = Router()
const controller = new UserController()

router.get('/:id', authMiddleware, controller.getUser)
router.post('/', authMiddleware, validate(createUserSchema), controller.createUser)
router.patch('/:id', authMiddleware, validate(updateUserSchema), controller.updateUser)
router.delete('/:id', authMiddleware, controller.deleteUser)

export default router
```

### 3.3 Error Handling

```typescript
// utils/errors.ts
export class AppError extends Error {
  statusCode: number
  isOperational: boolean

  constructor(message: string, statusCode: number) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = true
    Error.captureStackTrace(this, this.constructor)
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401)
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed') {
    super(message, 400)
  }
}
```

### 3.4 Response Format

```typescript
// utils/response.ts
import { Response } from 'express'

interface ApiResponse<T> {
  success: boolean
  message: string
  data?: T
  error?: string
  meta?: {
    page?: number
    limit?: number
    total?: number
  }
}

export function successResponse<T>(
  res: Response, 
  statusCode: number, 
  message: string, 
  data?: T,
  meta?: ApiResponse<T>['meta']
) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    meta
  })
}

export function errorResponse(
  res: Response,
  statusCode: number,
  message: string,
  error?: string
) {
  return res.status(statusCode).json({
    success: false,
    message,
    error
  })
}
```

---

## 4. API Design Standards

### 4.1 RESTful Conventions

| Method | Path | Action | Response Code |
|--------|------|--------|---------------|
| GET | /api/users | List all | 200 |
| GET | /api/users/:id | Get one | 200, 404 |
| POST | /api/users | Create | 201, 400 |
| PATCH | /api/users/:id | Update partial | 200, 404 |
| PUT | /api/users/:id | Update full | 200, 404 |
| DELETE | /api/users/:id | Delete | 204, 404 |

### 4.2 API Endpoints

```yaml
# Authentication
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh

# Users
GET    /api/users/:id
PATCH  /api/users/:id
GET    /api/users/search?q=...
POST   /api/users/:id/block
DELETE /api/users/:id/block

# Conversations
GET    /api/conversations
POST   /api/conversations
GET    /api/conversations/:id
DELETE /api/conversations/:id

# Messages
GET    /api/conversations/:id/messages?before=...&limit=50
POST   /api/conversations/:id/messages
PATCH  /api/conversations/:id/messages/:msgId
DELETE /api/conversations/:id/messages/:msgId
POST   /api/conversations/:id/messages/:msgId/reactions

# Groups
POST   /api/groups
PATCH  /api/groups/:id
DELETE /api/groups/:id
POST   /api/groups/:id/members
DELETE /api/groups/:id/members/:userId
POST   /api/groups/:id/leave

# Media
POST   /api/media/image
POST   /api/media/video
POST   /api/media/document
POST   /api/media/avatar

# AI
POST   /api/ai/chat
POST   /api/ai/suggest-replies
POST   /api/ai/translate
POST   /api/ai/summarize
```

### 4.3 Request/Response Examples

**Request:**
```http
POST /api/conversations/123/messages
Authorization: Bearer <token>
Content-Type: application/json

{
  "type": "text",
  "content": {
    "text": "Xin chào!"
  },
  "replyTo": null
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Message sent",
  "data": {
    "id": "msg_456",
    "conversationId": "123",
    "senderId": "user_789",
    "type": "text",
    "content": {
      "text": "Xin chào!"
    },
    "createdAt": "2024-01-01T10:00:00Z"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Validation failed",
  "error": "Message content is required"
}
```

---

## 5. Database Schema

### 5.1 PostgreSQL (Supabase) - User Data

```sql
-- Managed by Supabase Auth
-- Table: auth.users (auto-created)

-- Custom profile table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  phone TEXT UNIQUE,
  status TEXT DEFAULT 'offline',
  last_seen TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Friends/Contacts
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  contact_id UUID REFERENCES profiles(id),
  nickname TEXT,
  is_blocked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, contact_id)
);
```

### 5.2 MongoDB - Chat Data

```typescript
// Conversation Schema
{
  _id: ObjectId,
  type: 'private' | 'group',
  name: String,           // For groups
  avatar: String,         // For groups
  participants: [{
    userId: String,       // Reference to Supabase user
    role: 'admin' | 'member',
    joinedAt: Date,
    lastRead: Date
  }],
  lastMessage: {
    content: String,
    type: String,
    senderId: String,
    timestamp: Date
  },
  createdAt: Date,
  updatedAt: Date
}

// Message Schema
{
  _id: ObjectId,
  conversationId: ObjectId,
  senderId: String,
  type: 'text' | 'image' | 'video' | 'file' | 'sticker' | 'voice',
  content: {
    text: String,
    mediaUrl: String,
    thumbnail: String,
    fileName: String,
    fileSize: Number,
    duration: Number
  },
  replyTo: ObjectId,
  reactions: [{
    userId: String,
    emoji: String
  }],
  readBy: [{
    userId: String,
    readAt: Date
  }],
  isDeleted: Boolean,
  createdAt: Date
}
```

---

## 6. Phân Công Công Việc

### Team Members & Roles

| Thành viên | Role | Modules phụ trách |
|------------|------|-------------------|
| **Member 1** | Backend Lead | Auth, User, Setup |
| **Member 2** | Backend Dev | Chat, Messages |
| **Member 3** | Backend Dev | Group, Media |
| **Member 4** | Backend Dev | AI, Socket.io |

### 6.1 Sprint 1 (Tuần 1-2): Foundation

#### Member 1 - Backend Lead
- [ ] Setup project structure hoàn chỉnh
- [ ] Cấu hình TypeScript, ESLint, Prettier
- [ ] Tạo utility functions (response, errors)
- [ ] Setup Supabase connection
- [ ] Implement Auth middleware

#### Member 2
- [ ] Setup MongoDB connection
- [ ] Tạo Message model
- [ ] Tạo Conversation model
- [ ] Viết base CRUD cho models

#### Member 3
- [ ] Setup Cloudinary
- [ ] Implement media upload service
- [ ] Tạo Group model (extend Conversation)

#### Member 4
- [ ] Setup Socket.io server
- [ ] Implement connection handling
- [ ] Setup room management
- [ ] Setup Gemini AI config

---

### 6.2 Sprint 2 (Tuần 3-4): Core APIs

#### Member 1
- [ ] Auth routes (register, login, logout)
- [ ] User routes (profile, update, search)
- [ ] Input validation với Zod

#### Member 2
- [ ] Conversation routes (CRUD)
- [ ] Message routes (send, list, delete)
- [ ] Pagination cho messages

#### Member 3
- [ ] Group routes (create, update, delete)
- [ ] Member management routes
- [ ] Media upload routes

#### Member 4
- [ ] Chat socket events
- [ ] Typing indicator
- [ ] Read receipts
- [ ] Online presence

---

### 6.3 Sprint 3 (Tuần 5-6): Advanced Features

#### Member 1
- [ ] OAuth integration (Google)
- [ ] Password reset flow
- [ ] Session management

#### Member 2
- [ ] Message reactions
- [ ] Reply to message
- [ ] Message search

#### Member 3
- [ ] Group permissions
- [ ] Image/video processing
- [ ] File upload limits

#### Member 4
- [ ] AI chat endpoint
- [ ] Smart replies
- [ ] Translation API
- [ ] Call signaling (WebRTC)

---

## 7. Quy Trình Làm Việc

### 7.1 Git Workflow

```
main (production)
  │
  └── develop (integration)
        │
        ├── feature/auth-login
        ├── feature/chat-messages
        ├── feature/group-management
        └── feature/ai-chatbot
```

**Branch Naming:**
```
feature/module-feature   # Tính năng mới
bugfix/module-issue      # Sửa bug
hotfix/urgent-fix        # Sửa khẩn cấp
refactor/module-name     # Tái cấu trúc
```

### 7.2 Commit Convention

```
<type>(<scope>): <subject>

Types:
- feat: Tính năng mới
- fix: Sửa bug
- docs: Documentation
- style: Formatting
- refactor: Refactoring
- test: Thêm tests
- chore: Maintenance

Examples:
feat(auth): implement login with Supabase
fix(chat): resolve message ordering issue
docs(api): add API documentation
```

### 7.3 Code Review Checklist

- [ ] Code follows naming conventions
- [ ] No hardcoded values (use config)
- [ ] Error handling implemented
- [ ] Input validation present
- [ ] No console.log in production code
- [ ] Types properly defined
- [ ] Comments for complex logic

### 7.4 Daily Workflow

```
1. Pull latest develop
   git checkout develop
   git pull origin develop

2. Create/switch to feature branch
   git checkout -b feature/your-feature

3. Code & commit frequently
   git add .
   git commit -m "feat(module): description"

4. Push & create PR
   git push origin feature/your-feature
   # Create Pull Request on GitHub

5. Code review & merge
   # After approval, merge to develop
```

---

## 8. Testing Strategy

### 8.1 Test Structure

```
tests/
├── unit/
│   ├── services/
│   │   ├── user.service.test.ts
│   │   └── chat.service.test.ts
│   └── utils/
│       └── helpers.test.ts
│
└── integration/
    ├── auth.test.ts
    ├── chat.test.ts
    └── group.test.ts
```

### 8.2 Unit Test Example

```typescript
// tests/unit/services/user.service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { UserService } from '@/modules/user/user.service'

describe('UserService', () => {
  let userService: UserService

  beforeEach(() => {
    userService = new UserService()
  })

  describe('findById', () => {
    it('should return user when found', async () => {
      const mockUser = { id: '1', fullName: 'Test User' }
      vi.spyOn(userService, 'findById').mockResolvedValue(mockUser)

      const result = await userService.findById('1')
      
      expect(result).toEqual(mockUser)
    })

    it('should return null when not found', async () => {
      vi.spyOn(userService, 'findById').mockResolvedValue(null)

      const result = await userService.findById('999')
      
      expect(result).toBeNull()
    })
  })
})
```

### 8.3 API Test Example

```typescript
// tests/integration/auth.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '@/app'

describe('Auth API', () => {
  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('accessToken')
    })

    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        })

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
    })
  })
})
```

---

## 📌 Quick Reference

### Commands
```bash
# Development
pnpm dev:server        # Start dev server with hot reload

# Build
pnpm build:server      # Build for production

# Test
pnpm test              # Run all tests
pnpm test:unit         # Unit tests only
pnpm test:integration  # Integration tests

# Lint
pnpm lint              # Check code style
pnpm lint:fix          # Auto-fix issues
```

### Environment Variables
```env
# Required
PORT=4000
NODE_ENV=development
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
MONGODB_URI=

# Optional
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
GEMINI_API_KEY=
```

### Useful Links
- [Express.js Docs](https://expressjs.com/)
- [MongoDB Node.js Driver](https://mongodb.github.io/node-mongodb-native/)
- [Socket.io Docs](https://socket.io/docs/)
- [Supabase Docs](https://supabase.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

> 💡 **Tip**: Mỗi thành viên nên đọc kỹ phần Coding Conventions và API Standards trước khi bắt đầu code!
