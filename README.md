# 🎮 Memory Battle Royale - Multiplayer Edition

An AI-powered cognitive training game with **ELO ratings**, **ML score predictions**, and **competitive multiplayer**.

[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black)](https://vercel.com)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB_Atlas-green)](https://www.mongodb.com/cloud/atlas)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

---

## 🌟 Features

### 🎯 Game Modes
- **Pattern Recall** - Visual pattern memory challenges
- **Sequence Memory** - Order-based memory tests  
- **Spatial Memory** - Position memory challenges

### 🏆 Multiplayer Features
- ✅ **User Authentication** - Secure JWT-based login/register
- ✅ **ELO Rating System** - Dynamic skill-based ratings (K-factor: 20-40)
- ✅ **Score Prediction** - ML predictions using time-series analysis
- ✅ **Rolling Session Vectors** - Last 100 games tracked per player per game type
- ✅ **Leaderboards** - Global and game-type specific rankings
- ✅ **Performance Analytics** - Trend detection, variance analysis
- 🚧 **Arena Mode** - Real-time multiplayer battles (coming soon)

### 🤖 AI Learning Mode
- **3D Visualizations** - Gemini AI generates interactive Three.js lessons
- **On-Demand Generation** - Topics: DNA, Solar System, Physics, etc.

---

## 🚀 Quick Start

### Option 1: Docker (Fastest)
```powershell
# Build image
.\build.ps1

# Run container
.\run.ps1

# Access at http://localhost:3000
```

### Option 2: Local Development
```powershell
# Install dependencies
npm install

# Configure environment (see .env.example)
cp .env.example .env
# Edit .env with your MongoDB URI and API keys

# Start server
npm start

# Access at http://localhost:3000
```

### Option 3: Deploy to Vercel (Free)
See **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** for complete step-by-step instructions.

---

## 📊 How It Works

### 1. **Rolling Session Vectors**
Each player stores their last 100 game sessions per game type in a FIFO queue:

```javascript
{
  userId: "...",
  gameType: "pattern",
  sessionVector: [
    { sessionId, score: 850, timestamp, result: "solo" },
    // ... up to 100 entries
  ]
}
```

When a new session is added, the oldest is automatically removed.

### 2. **ELO Rating System**
Dynamic K-factor based on experience:

| Games Played | K-Factor | Rating Change Speed |
|--------------|----------|---------------------|
| < 30 games   | 40       | Fast (new players)  |
| 30-100 games | 30       | Medium              |
| 100+ games   | 20       | Slow (stable)       |

**Formula:**
```
ExpectedScore = 1 / (1 + 10^((OpponentElo - PlayerElo) / 400))
NewElo = OldElo + K × (ActualScore - ExpectedScore)
```

### 3. **ML Score Prediction**
Weighted time-series model:

```javascript
prediction = (
  avgLast5  × 0.5 +  // Recent performance (50% weight)
  avgLast10 × 0.3 +  // Medium-term (30%)
  avgLast25 × 0.2    // Long-term baseline (20%)
) + trendAdjustment
```

Features used:
- **Trend Analysis** - Linear regression on recent scores
- **Variance** - Consistency score
- **Recency Weighting** - More weight on recent games

---

## 🗄️ Database Schema

### Collections

#### `users`
```javascript
{
  username: String (unique),
  email: String (unique),
  passwordHash: String,
  globalElo: Number,
  totalGamesPlayed: Number
}
```

#### `playerstats` (one per user per game type)
```javascript
{
  userId: ObjectId,
  gameType: "pattern" | "sequence" | "spatial",
  elo: Number,
  predictedNextScore: Number,
  sessionVector: Array[100], // Rolling window
  gamesPlayed: Number,
  averageScore: Number,
  recentTrend: "improving" | "declining" | "stable"
}
```

#### `gamesessions`
```javascript
{
  sessionId: String,
  gameType: String,
  players: [{ userId, score, eloChange, placement }],
  completedAt: Date
}
```

---

## 🎯 API Endpoints

### Authentication
```
POST /api/auth/register
POST /api/auth/login
```

### Game Management
```
POST /api/game/start          - Start session, get prediction
POST /api/game/submit         - Submit score, update ELO
GET  /api/game/stats/:gameType - Get player statistics
```

### Leaderboards
```
GET /api/leaderboard/global
GET /api/leaderboard/pattern
GET /api/leaderboard/sequence
GET /api/leaderboard/spatial
```

### AI Learning
```
POST /api/learn - Generate 3D visualization
```

---

## 🔧 Environment Variables

```env
# Required
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/memory-battle-royale
GEMINI_API_KEY=AIzaSy...
JWT_SECRET=your-random-secret-key

# Optional
PORT=3000
NODE_ENV=development
```

**Get Free Credentials:**
- **MongoDB Atlas**: https://www.mongodb.com/cloud/atlas/register (512MB free)
- **Gemini API**: https://aistudio.google.com/app/apikey (free tier)
- **JWT Secret**: Generate with `openssl rand -base64 32`

---

## 🏗️ Architecture

### Tech Stack
- **Frontend**: Vanilla JS, Three.js
- **Backend**: Node.js + Express
- **Database**: MongoDB (Mongoose ODM)
- **Auth**: JWT + bcrypt
- **Deployment**: Vercel (serverless)
- **AI**: Google Gemini API

### Project Structure
```
cognitive-3d-learning-ai/
├── models/              # Database schemas
│   ├── User.js
│   ├── PlayerStats.js
│   ├── GameSession.js
│   └── ArenaRoom.js
├── routes/              # API endpoints
│   ├── auth.js
│   ├── game.js
│   └── leaderboard.js
├── lib/                 # Core utilities
│   ├── db.js           # MongoDB connection
│   ├── elo.js          # ELO calculations
│   ├── prediction.js   # ML predictions
│   └── auth.js         # JWT & bcrypt
├── public/              # Frontend
│   ├── index.html
│   ├── game.js
│   └── styles.css
├── server.js            # Main server
├── Dockerfile
├── vercel.json
└── package.json
```

---

## 🧪 Testing

### Test with PowerShell
```powershell
# 1. Register user
$res = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/register" `
  -Method POST -ContentType "application/json" `
  -Body (@{username="player1"; email="p1@test.com"; password="test123"} | ConvertTo-Json)

$token = $res.token

# 2. Start game
$gameStart = Invoke-RestMethod -Uri "http://localhost:3000/api/game/start" `
  -Method POST -ContentType "application/json" `
  -Headers @{Authorization="Bearer $token"} `
  -Body (@{gameType="pattern"} | ConvertTo-Json)

# 3. Submit score
Invoke-RestMethod -Uri "http://localhost:3000/api/game/submit" `
  -Method POST -ContentType "application/json" `
  -Headers @{Authorization="Bearer $token"} `
  -Body (@{
    sessionId=$gameStart.sessionId
    gameType="pattern"
    score=850
  } | ConvertTo-Json)

# 4. View leaderboard
Invoke-RestMethod -Uri "http://localhost:3000/api/leaderboard/global"
```

---

## 📈 Roadmap

### Phase 1: ✅ Solo Mode with Stats
- [x] User authentication
- [x] ELO rating system
- [x] Score prediction
- [x] Session vectors
- [x] Leaderboards
- [x] Database integration
- [x] Vercel deployment

### Phase 2: 🚧 Real-time Arena Mode
- [ ] WebSocket/Supabase Realtime
- [ ] Matchmaking system
- [ ] Live game rooms
- [ ] Multiplayer ELO
- [ ] Real-time rankings

### Phase 3: 🔮 Advanced Features
- [ ] Friends system
- [ ] Private tournaments
- [ ] Achievements
- [ ] Daily challenges
- [ ] Social sharing
- [ ] Mobile app

---

## 📚 Documentation

- **[MULTIPLAYER_ARCHITECTURE.md](MULTIPLAYER_ARCHITECTURE.md)** - System design & database schema
- **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** - Step-by-step deployment to Vercel + MongoDB Atlas
- **[.env.example](.env.example)** - Environment variable template

---

## 🤝 Contributing

Contributions welcome! Please read the architecture docs before submitting PRs.

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Three.js** - 3D graphics library
- **Google Gemini** - AI content generation
- **MongoDB Atlas** - Database hosting
- **Vercel** - Serverless deployment
- **Express.js** - Web framework

---

## 📞 Support

- **Issues**: https://github.com/YOUR_USERNAME/cognitive-3d-learning-ai/issues
- **Discussions**: https://github.com/YOUR_USERNAME/cognitive-3d-learning-ai/discussions
- **Email**: your-email@example.com

---

**Made with ❤️ for cognitive science and competitive gaming**

🎮 Happy Gaming! 🧠
