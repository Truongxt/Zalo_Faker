# 🚀 Hướng Dẫn Deploy Zalo Faker

## Tổng Quan

Tất cả đều sử dụng free tier:
- **Web App**: Vercel (hoặc Netlify)
- **Backend**: Railway (hoặc Render)
- **Mobile**: Expo EAS Build

## 📦 Deploy Backend lên Railway

### Bước 1: Chuẩn bị

1. Đăng ký [railway.app](https://railway.app) bằng GitHub
2. Connect GitHub repository

### Bước 2: Tạo Project

1. Click **New Project** → **Deploy from GitHub repo**
2. Chọn repository `zalo-faker`
3. Chọn folder `server` làm root directory

### Bước 3: Cấu hình Environment Variables

Thêm tất cả variables từ `.env`:
```
PORT=4000
NODE_ENV=production
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...
MONGODB_URI=...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
GEMINI_API_KEY=...
JWT_SECRET=...
CLIENT_URL=https://your-app.vercel.app
```

### Bước 4: Deploy

Railway sẽ tự động detect Node.js và deploy. URL sẽ có dạng:
```
https://your-app.up.railway.app
```

## 🌐 Deploy Web lên Vercel

### Bước 1: Chuẩn bị

1. Đăng ký [vercel.com](https://vercel.com) bằng GitHub
2. Cài Vercel CLI (optional):
   ```bash
   npm i -g vercel
   ```

### Bước 2: Import Project

1. Click **Add New** → **Project**
2. Import GitHub repository
3. Cấu hình:
   - **Root Directory**: `apps/web`
   - **Framework Preset**: Vite
   - **Build Command**: `pnpm build`
   - **Output Directory**: `dist`

### Bước 3: Environment Variables

```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
VITE_API_URL=https://your-app.up.railway.app/api
VITE_SOCKET_URL=https://your-app.up.railway.app
```

### Bước 4: Deploy

Click **Deploy**. URL sẽ có dạng:
```
https://your-app.vercel.app
```

## 📱 Build Mobile với Expo EAS

### Bước 1: Chuẩn bị

1. Tạo tài khoản [expo.dev](https://expo.dev)
2. Cài EAS CLI:
   ```bash
   npm install -g eas-cli
   eas login
   ```

### Bước 2: Cấu hình

```bash
cd apps/mobile
eas build:configure
```

Tạo file `eas.json`:
```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  },
  "submit": {
    "production": {}
  }
}
```

### Bước 3: Build

```bash
# Build cho Android
eas build --platform android --profile preview

# Build cho iOS
eas build --platform ios --profile preview

# Build cả hai
eas build --platform all --profile preview
```

### Bước 4: Download & Install

- Android: Download APK từ Expo Dashboard
- iOS: Cần Apple Developer account ($99/năm) hoặc dùng Simulator

## 🔄 CI/CD với GitHub Actions

Tạo file `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to Railway
        uses: bervProject/railway-deploy@main
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: server

  deploy-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: apps/web
```

## 📊 Monitoring

### Free Monitoring Options:

1. **UptimeRobot** - Monitor uptime
2. **Sentry** - Error tracking
3. **LogTail** - Log management

## 💰 Chi Phí Ước Tính

| Service | Free Tier | Đủ cho |
|---------|-----------|--------|
| Railway | 500h/month | 24/7 nếu 1 instance |
| Vercel | Unlimited | Unlimited traffic |
| Supabase | 500MB | ~10,000 users |
| MongoDB Atlas | 512MB | ~50,000 messages |
| Cloudinary | 25GB | ~5,000 images |

**Tổng chi phí: $0/tháng** (trong giới hạn free tier)

## ⚠️ Lưu Ý Quan Trọng

1. **Railway sleep**: Free tier sẽ sleep sau 5 phút không hoạt động. Dùng cron job để keep alive.

2. **Supabase pause**: Free tier sẽ pause sau 1 tuần không hoạt động. Cần vào dashboard để unpause.

3. **MongoDB Atlas**: Free tier chỉ có 512MB. Monitor usage thường xuyên.

4. **Custom domain**: 
   - Vercel: Miễn phí
   - Railway: Miễn phí

5. **SSL**: Tự động bao gồm ở cả Vercel và Railway.
