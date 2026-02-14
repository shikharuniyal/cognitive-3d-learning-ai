# 🚀 Deployment Guide - Memory Battle Royale Multiplayer

## Overview
This guide covers deploying the multiplayer version to Vercel with MongoDB Atlas (both FREE tier).

---

## Step 1: Setup MongoDB Atlas (Free Tier Database)

### 1.1 Create MongoDB Atlas Account
1. Visit https://www.mongodb.com/cloud/atlas/register
2. Sign up for free
3. Choose "Shared" (FREE tier - 512MB storage)

### 1.2 Create a Cluster
1. After logging in, click "Build a Database"
2. Choose "M0 FREE" tier
3. Select a cloud provider and region (choose closest to your users)
4. Name your cluster (e.g., "MemoryBattleRoyale")
5. Click "Create"

### 1.3 Create Database User
1. Go to "Database Access" in left menu
2. Click "Add New Database User"
3. Choose "Password" authentication
4. Username: `memoryuser` (or any name)
5. Password: Generate a secure password (SAVE THIS!)
6. Database User Privileges: "Atlas admin"
7. Click "Add User"

### 1.4 Whitelist IP Addresses
1. Go to "Network Access" in left menu
2. Click "Add IP Address"
3. Click "Allow Access from Anywhere" (0.0.0.0/0)
   - For production, restrict to specific IPs
4. Click "Confirm"

### 1.5 Get Connection String
1. Go back to "Database" in left menu
2. Click "Connect" on your cluster
3. Choose "Connect your application"
4. Copy the connection string:
   ```
   mongodb+srv://memoryuser:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
5. Replace `<password>` with your actual password
6. Add database name: `...mongodb.net/memory-battle-royale?retryWrites...`
7. **SAVE THIS CONNECTION STRING!**

---

## Step 2: Setup Vercel Account

### 2.1 Create Vercel Account
1. Visit https://vercel.com/signup
2. Sign up with GitHub (recommended)
3. Authorize Vercel to access your repositories

### 2.2 Install Vercel CLI (Optional, for local testing)
```powershell
npm install -g vercel
```

---

## Step 3: Push Code to GitHub

### 3.1 Initialize Git Repository
```powershell
cd E:\#EditorCodes\ApacheH\cognitive-3d-learning-ai
git init
git add .
git commit -m "Initial commit - Multiplayer version"
```

### 3.2 Create GitHub Repository
1. Go to https://github.com/new
2. Name: `cognitive-3d-learning-ai-multiplayer`
3. Keep it Public or Private
4. Do NOT initialize with README (we already have code)
5. Click "Create repository"

### 3.3 Push to GitHub
```powershell
git remote add origin https://github.com/YOUR_USERNAME/cognitive-3d-learning-ai-multiplayer.git
git branch -M main
git push -u origin main
```

---

## Step 4: Deploy to Vercel

### 4.1 Import Project
1. Log in to https://vercel.com/dashboard
2. Click "Add New..." → "Project"
3. Import your GitHub repository
4. Framework Preset: **Other** (or Node.js)
5. Root Directory: `./`
6. Build Command: (leave empty or `npm install`)
7. Output Directory: (leave empty)

### 4.2 Add Environment Variables
**CRITICAL:** Click "Environment Variables" and add these:

| Name | Value | Example |
|------|-------|---------|
| `MONGODB_URI` | Your MongoDB Atlas connection string | `mongodb+srv://memoryuser:pass@cluster.mongodb.net/memory-battle-royale` |
| `GEMINI_API_KEY` | Your Gemini API key | `AIzaSy...` |
| `JWT_SECRET` | Random secret string (generate one!) | `7f8a9b2c1d4e5f6g8h9i0j1k2l3m4n5o6p` |
| `NODE_ENV` | `production` | `production` |
| `PORT` | `3000` | `3000` |

**Generate JWT Secret:**
```powershell
# In PowerShell:
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

### 4.3 Deploy
1. Click "Deploy"
2. Wait for deployment (2-3 minutes)
3. Once complete, you'll get a URL: `https://your-project.vercel.app`

---

## Step 5: Test Deployment

### 5.1 Test API Endpoints
```powershell
# Register a new user
Invoke-WebRequest -Uri "https://your-project.vercel.app/api/auth/register" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"username":"testplayer","email":"test@example.com","password":"test123456"}'

# Expected response: {"success":true,"token":"...","user":{...}}
```

### 5.2 Test Game
1. Open browser: `https://your-project.vercel.app`
2. The game should load
3. Try playing a round
4. Check MongoDB Atlas → Browse Collections to see data

---

## Step 6: Local Development with MongoDB Atlas

### 6.1 Update Local `.env`
```env
MONGODB_URI=mongodb+srv://memoryuser:password@cluster.mongodb.net/memory-battle-royale
GEMINI_API_KEY=AIzaSy...
JWT_SECRET=your-local-secret
NODE_ENV=development
PORT=3000
```

### 6.2 Install Dependencies
```powershell
npm install
```

### 6.3 Run Locally
```powershell
npm start
# or for development with auto-reload:
npm run dev
```

### 6.4 Test Locally
1. Open http://localhost:3000
2. Register/login
3. Play games
4. Check MongoDB Atlas to verify data is being saved

---

## Step 7: Verify Everything Works

### 7.1 Check MongoDB Collections
1. Go to MongoDB Atlas Dashboard
2. Click "Browse Collections"
3. You should see:
   - `users` collection
   - `playerstats` collection
   - `gamesessions` collection

### 7.2 Test Multiplayer Features
1. Register multiple users
2. Play games with each user
3. Check leaderboard: `https://your-project.vercel.app/api/leaderboard/global`
4. Check game-specific leaderboard: `https://your-project.vercel.app/api/leaderboard/pattern`

---

## Alternative Free Database Options

### Option 1: Supabase (PostgreSQL)
1. Sign up at https://supabase.com
2. Create new project
3. Get connection string from Settings → Database
4. Install `pg` instead of `mongoose`
5. Adapt models to use PostgreSQL

### Option 2: Neon (Serverless Postgres)
1. Sign up at https://neon.tech
2. Create project
3. Get connection string
4. Similar to Supabase setup

---

## Troubleshooting

### Database Connection Failed
- **Issue:** `MongoServerError: Authentication failed`
- **Fix:** 
  - Check username/password in connection string
  - Verify user created in MongoDB Atlas
  - Ensure IP whitelist includes 0.0.0.0/0

### Vercel Function Timeout
- **Issue:** `Function Execution Timeout`
- **Fix:**
  - Check database connection is successful
  - Reduce query complexity
  - Add connection pooling

### JWT Token Issues
- **Issue:** `Invalid or expired token`
- **Fix:**
  - Ensure `JWT_SECRET` is same across deployments
  - Check token expiration settings

### CORS Errors
- **Issue:** `CORS policy blocked`
- **Fix:** Already handled with `app.use(cors())` in server.js

---

## Monitoring & Analytics

### Vercel Analytics
1. Go to Vercel Dashboard → Your Project
2. Click "Analytics" tab
3. Enable Web Analytics (free)

### MongoDB Atlas Monitoring
1. Go to MongoDB Atlas Dashboard
2. Click "Metrics" tab
3. View connection stats, operations, storage

---

## Next Steps

### Implement Multiplayer Arena Mode
1. Add Socket.io or Supabase Realtime
2. Create matchmaking system
3. Real-time game rooms
4. Live leaderboards

### Add Features
- [ ] Email verification
- [ ] Password reset
- [ ] Friend system
- [ ] Achievements/badges
- [ ] Daily challenges
- [ ] Social sharing

### Scale to Production
- Use CDN for static assets
- Implement rate limiting
- Add caching (Redis)
- Upgrade database tier (if needed)
- Monitor performance

---

## Cost Breakdown (FREE Tier Limits)

| Service | Free Tier | Limits |
|---------|-----------|--------|
| **Vercel** | 100GB bandwidth/month | Serverless functions: 100GB-Hrs |
| **MongoDB Atlas** | 512MB storage | 1 cluster, Shared CPU |
| **Gemini API** | 60 requests/min | Free tier available |

**Total Cost:** $0/month for moderate usage

---

## Support

For issues or questions:
1. Check GitHub Issues
2. MongoDB Atlas Documentation: https://docs.atlas.mongodb.com/
3. Vercel Documentation: https://vercel.com/docs

Good luck with your deployment! 🎮🚀
