# 📚 Hướng Dẫn Cài Đặt Zalo Faker

## 📋 Yêu Cầu Hệ Thống

- **Node.js** 18.0 trở lên
- **pnpm** 8.0 trở lên (hoặc npm 9+)
- **Git**

## 🔑 Tạo Tài Khoản Dịch Vụ (Miễn Phí)

### 1. Supabase (Auth + PostgreSQL)

1. Truy cập [supabase.com](https://supabase.com) và đăng ký
2. Tạo project mới
3. Lấy các keys từ **Settings > API**:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_KEY`

### 2. MongoDB Atlas (Chat Database)

1. Truy cập [mongodb.com/atlas](https://mongodb.com/atlas) và đăng ký
2. Tạo cluster mới (chọn **M0 Sandbox - Free**)
3. Tạo database user
4. Thêm IP `0.0.0.0/0` vào whitelist (hoặc IP cụ thể)
5. Lấy connection string:
   ```
   mongodb+srv://<username>:<password>@cluster.mongodb.net/zalo-faker
   ```

### 3. Cloudinary (Media Storage)

1. Truy cập [cloudinary.com](https://cloudinary.com) và đăng ký
2. Từ Dashboard, lấy:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`

### 4. Google AI (Gemini API)

1. Truy cập [aistudio.google.com](https://aistudio.google.com)
2. Click **Get API Key**
3. Tạo API key và lưu lại: `GEMINI_API_KEY`

## 🚀 Cài Đặt Dự Án

### Bước 1: Clone repository

```bash
git clone https://github.com/your-team/zalo-faker.git
cd zalo-faker
```

### Bước 2: Cài đặt pnpm (nếu chưa có)

```bash
npm install -g pnpm
```

### Bước 3: Cài đặt dependencies

```bash
pnpm install
```

### Bước 4: Cấu hình environment

```bash
# Copy file mẫu
cp server/.env.example server/.env

# Mở và điền các API keys
```

Nội dung file `.env`:
```env
PORT=4000
NODE_ENV=development

# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIs...

# MongoDB Atlas
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/zalo-faker

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=123456789
CLOUDINARY_API_SECRET=abc123xyz

# Google Gemini AI
GEMINI_API_KEY=AIzaSy...

# JWT Secret (đổi sang chuỗi random dài)
JWT_SECRET=your-super-secret-key-here

# Client URL
CLIENT_URL=http://localhost:3000
```

### Bước 5: Tạo file .env cho Web app

```bash
# Tạo file apps/web/.env
```

Nội dung:
```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
VITE_API_URL=http://localhost:4000/api
VITE_SOCKET_URL=http://localhost:4000
```

### Bước 6: Chạy development server

```bash
# Chạy tất cả apps
pnpm dev

# Hoặc chạy riêng từng app
pnpm dev:server  # Backend: http://localhost:4000
pnpm dev:web     # Web: http://localhost:3000
pnpm dev:mobile  # Mobile: Expo DevTools
```

## ✅ Kiểm Tra Hoạt Động

### 1. Backend Health Check
```bash
curl http://localhost:4000/health
# Response: {"status":"ok","timestamp":"..."}
```

### 2. Web App
- Mở http://localhost:3000
- Trang Login hiển thị đẹp với gradient

### 3. Mobile App (Expo)
- Cài Expo Go trên điện thoại
- Scan QR code từ terminal

## 🔧 Troubleshooting

### Lỗi MongoDB connection
- Kiểm tra connection string
- Đảm bảo IP đã được whitelist trong Atlas

### Lỗi Supabase auth
- Kiểm tra SUPABASE_URL và keys
- Đảm bảo bật Email auth trong Supabase Dashboard

### Lỗi pnpm install
```bash
# Clear cache và thử lại
pnpm store prune
pnpm install
```

### Port đang bị sử dụng
```bash
# Đổi port trong .env hoặc kill process
npx kill-port 4000
npx kill-port 3000
```

## 📱 Setup Mobile Development

### iOS (Mac only)
```bash
cd apps/mobile
npx expo run:ios
```

### Android
1. Cài Android Studio
2. Tạo Android Emulator
3. Chạy:
```bash
cd apps/mobile
npx expo run:android
```

### Expo Go (Nhanh nhất)
1. Cài app **Expo Go** từ App Store / Play Store
2. Chạy `pnpm dev:mobile`
3. Scan QR code

## 🌐 Deploy Production

Xem [DEPLOYMENT.md](./DEPLOYMENT.md) để biết cách deploy lên:
- Vercel (Web)
- Railway (Backend)
- Expo EAS (Mobile)
