# 📱 Zalo Faker

> Modern messaging application with chat, voice/video calls, and AI chatbot

## ✨ Features

- 💬 **Real-time Chat** - 1-1 and group messaging with text, images, videos, and files
- 📹 **Voice/Video Calls** - WebRTC-powered calls (1-1 and group)
- 🤖 **AI Chatbot** - Powered by Google Gemini
- 👥 **Group Management** - Create and manage group conversations
- 📊 **Analytics** - User activity statistics
- 🌐 **Cross-platform** - Web (React) + Mobile (React Native)

## 🛠️ Tech Stack

### Frontend
- **Web**: React.js + Vite + TypeScript + Tailwind CSS
- **Mobile**: React Native + Expo
- **State**: Zustand
- **Real-time**: Socket.io-client
- **Video Call**: WebRTC + PeerJS

### Backend
- **Runtime**: Node.js + Express
- **Real-time**: Socket.io
- **Auth**: Supabase Auth
- **Database**: PostgreSQL (Supabase) + MongoDB Atlas
- **Storage**: Cloudinary
- **AI**: Google Gemini API

## 📁 Project Structure

```
zalo-faker/
├── apps/
│   ├── web/          # React.js web application
│   └── mobile/       # React Native mobile app
├── packages/
│   └── shared/       # Shared types, utils, constants
├── server/           # Node.js backend
└── docs/             # Documentation
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- pnpm 8+
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/zalo-faker.git
cd zalo-faker

# Install dependencies
pnpm install

# Setup environment variables
cp server/.env.example server/.env
# Edit .env with your API keys

# Start development
pnpm dev
```

### Available Scripts

```bash
# Development
pnpm dev           # Start all apps in development mode
pnpm dev:web       # Start web app only
pnpm dev:mobile    # Start mobile app only
pnpm dev:server    # Start server only

# Build
pnpm build         # Build all apps
pnpm build:web     # Build web app
pnpm build:server  # Build server

# Other
pnpm lint          # Run linting
pnpm test          # Run tests
pnpm clean         # Clean all build outputs
```

## 🔧 Environment Setup

### Required Accounts (All FREE)

1. **Supabase** - https://supabase.com
   - Create project
   - Get `SUPABASE_URL` and `SUPABASE_ANON_KEY`

2. **MongoDB Atlas** - https://mongodb.com/atlas
   - Create cluster (M0 free tier)
   - Get connection string

3. **Cloudinary** - https://cloudinary.com
   - Create account
   - Get Cloud Name, API Key, API Secret

4. **Google AI Studio** - https://aistudio.google.com
   - Create API key for Gemini

## 📖 Documentation

- [API Documentation](./docs/API.md)
- [Setup Guide](./docs/SETUP.md)
- [Deployment Guide](./docs/DEPLOYMENT.md)

## 👥 Team

- Member 1 - Team Lead + Backend
- Member 2 - Frontend Web
- Member 3 - Mobile Developer
- Member 4 - Full-stack + DevOps

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details
