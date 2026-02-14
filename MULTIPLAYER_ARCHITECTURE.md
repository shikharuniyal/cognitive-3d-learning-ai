# Multiplayer Architecture Design

## Game Types
1. **Pattern Recall** - Visual pattern memory
2. **Sequence Memory** - Order-based memory
3. **Spatial Memory** - Position memory

## Database Schema (MongoDB)

### Users Collection
```javascript
{
  _id: ObjectId,
  username: String (unique, indexed),
  email: String (unique),
  passwordHash: String,
  createdAt: Date,
  lastLogin: Date,
  totalGamesPlayed: Number,
  globalElo: Number // Overall ELO across all game types
}
```

### PlayerStats Collection (one per user per game type)
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: Users),
  gameType: String, // 'pattern', 'sequence', 'spatial'
  elo: Number, // Current ELO rating
  predictedNextScore: Number, // ML-predicted next score
  
  // Rolling window of last 100 sessions
  sessionVector: [{
    sessionId: String,
    score: Number,
    timestamp: Date,
    opponentElo: Number (null for solo),
    result: String // 'win', 'loss', 'draw', 'solo'
  }], // Max 100 entries, FIFO
  
  // Aggregated statistics
  gamesPlayed: Number,
  wins: Number,
  losses: Number,
  draws: Number,
  averageScore: Number,
  bestScore: Number,
  worstScore: Number,
  
  // Time-series features for prediction
  recentTrend: String, // 'improving', 'declining', 'stable'
  avgLast10: Number,
  avgLast25: Number,
  avgLast50: Number,
  
  updatedAt: Date
}
```

### GameSessions Collection
```javascript
{
  _id: ObjectId,
  sessionId: String (unique),
  gameType: String,
  mode: String, // 'solo', 'arena'
  
  // Players (array for multiplayer support)
  players: [{
    userId: ObjectId,
    username: String,
    startingElo: Number,
    finalElo: Number,
    score: Number,
    placement: Number, // 1st, 2nd, 3rd...
    eloChange: Number
  }],
  
  // Session details
  roundData: Object, // Game-specific data
  startedAt: Date,
  completedAt: Date,
  duration: Number, // milliseconds
  
  // For arena mode
  roomId: String,
  maxPlayers: Number
}
```

### ArenaRooms Collection (for matchmaking)
```javascript
{
  _id: ObjectId,
  roomId: String (unique),
  gameType: String,
  status: String, // 'waiting', 'playing', 'completed'
  maxPlayers: Number,
  currentPlayers: Number,
  
  players: [{
    userId: ObjectId,
    username: String,
    elo: Number,
    joinedAt: Date,
    ready: Boolean
  }],
  
  // ELO-based matchmaking range
  eloMin: Number,
  eloMax: Number,
  
  createdAt: Date,
  startedAt: Date,
  expiresAt: Date
}
```

## ELO Rating System

### Formula
```
Expected Score: E = 1 / (1 + 10^((OpponentElo - PlayerElo) / 400))
New ELO: NewElo = OldElo + K * (ActualScore - ExpectedScore)
```

### K-Factor (dynamic)
- New players (< 30 games): K = 40
- Intermediate (30-100 games): K = 30
- Experienced (100+ games): K = 20

### Multiplayer ELO
- Compare each player against average ELO of opponents
- Actual score: 1 for 1st place, 0.66 for 2nd, 0.33 for 3rd, 0 for last

## Score Prediction Model

### Features
1. Last 10 game average
2. Last 25 game average
3. Last 50 game average
4. Trend (linear regression slope)
5. Variance/consistency
6. Time of day pattern
7. Win streak

### Simple Linear Regression
```
PredictedScore = β₀ + β₁(AvgLast10) + β₂(Trend) + β₃(Variance)
```

## Free Database Options

### Recommended: **MongoDB Atlas** (Free Tier)
- 512 MB storage
- Shared cluster
- Perfect for this use case
- Built-in authentication
- Good Node.js support

### Alternative: **Supabase** (PostgreSQL)
- 500 MB database
- Real-time subscriptions (great for multiplayer)
- Built-in auth
- RESTful API

### Alternative: **Neon** (Serverless Postgres)
- 512 MB storage
- Serverless (scales to zero)
- Great for Vercel

## Vercel Deployment Architecture

### Problem: Vercel doesn't support WebSockets well
### Solution: Use serverless functions + polling or Supabase Realtime

### Option A: Supabase Realtime (Recommended)
- Use Supabase for database + real-time
- No WebSocket server needed
- Players subscribe to room updates
- Fully serverless

### Option B: Pusher/Ably (Free Tier)
- External real-time service
- Vercel serverless functions trigger updates
- Players receive via Pusher channels

### Vercel Project Structure
```
/api
  /auth
    login.js
    register.js
    me.js
  /game
    start.js
    submit.js
    stats.js
  /arena
    join.js
    rooms.js
    leave.js
  /leaderboard
    global.js
    [gameType].js
/lib
  db.js
  elo.js
  prediction.js
  auth.js
/models
  User.js
  PlayerStats.js
  GameSession.js
/public
  (existing frontend files)
vercel.json
```

## Implementation Plan

### Phase 1: Database Setup
1. Create MongoDB Atlas account
2. Setup connection string
3. Create models with Mongoose
4. Add database connection utility

### Phase 2: Authentication
1. JWT-based auth
2. bcrypt for passwords
3. Login/register endpoints
4. Protected routes middleware

### Phase 3: Solo Mode with Stats
1. Save game sessions to DB
2. Update player stats after each game
3. Calculate ELO (vs. predicted score)
4. Update session vectors (rolling window)

### Phase 4: ELO & Prediction
1. Implement ELO calculation
2. Build prediction model
3. Update predictions after each game

### Phase 5: Multiplayer Arena
1. Create matchmaking system
2. Room creation/joining
3. Real-time updates (Supabase or Pusher)
4. Multiplayer ELO calculation

### Phase 6: Leaderboards
1. Global leaderboard
2. Per-game-type leaderboards
3. Friends leaderboard

### Phase 7: Vercel Deployment
1. Convert to serverless functions
2. Add vercel.json config
3. Environment variables setup
4. Deploy and test

## Rolling Window Implementation

```javascript
// Add new session to vector
function addSessionToVector(playerStats, newSession) {
  playerStats.sessionVector.push(newSession);
  
  // Keep only last 100
  if (playerStats.sessionVector.length > 100) {
    playerStats.sessionVector.shift(); // Remove oldest
  }
  
  // Update aggregated stats
  recalculateStats(playerStats);
}

// Recalculate time-series features
function recalculateStats(playerStats) {
  const sessions = playerStats.sessionVector;
  const scores = sessions.map(s => s.score);
  
  playerStats.avgLast10 = avg(scores.slice(-10));
  playerStats.avgLast25 = avg(scores.slice(-25));
  playerStats.avgLast50 = avg(scores.slice(-50));
  playerStats.averageScore = avg(scores);
  
  // Calculate trend
  playerStats.recentTrend = calculateTrend(scores.slice(-25));
}
```

## Next Steps

1. Choose database (MongoDB Atlas recommended)
2. Implement Phase 1-3 first (single player with stats)
3. Test ELO and predictions
4. Add multiplayer
5. Deploy to Vercel

Would you like me to proceed with implementation?
