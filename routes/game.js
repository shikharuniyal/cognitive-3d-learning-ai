const express = require('express');
const router = express.Router();
const { connectDB } = require('../lib/db');
const { authMiddleware } = require('../lib/auth');
const { updateSoloElo } = require('../lib/elo');
const { predictNextScore } = require('../lib/prediction');
const User = require('../models/User');
const PlayerStats = require('../models/PlayerStats');
const GameSession = require('../models/GameSession');

// POST /api/game/start - Start a new game session
router.post('/start', authMiddleware, async (req, res) => {
    try {
        await connectDB();
        
        const { gameType } = req.body;
        const userId = req.user.userId;
        
        console.log(`🎮 Game START: User=${req.user.username}, Type=${gameType}`);
        
        if (!['pattern', 'sequence', 'spatial'].includes(gameType)) {
            return res.status(400).json({ error: 'Invalid game type' });
        }
        
        // Get or create player stats for this game type
        let stats = await PlayerStats.findOne({ userId, gameType });
        
        if (!stats) {
            stats = new PlayerStats({
                userId,
                gameType
            });
            await stats.save();
        }
        
        // Generate session ID
        const sessionId = `${gameType}_${userId}_${Date.now()}`;
        
        // Get prediction for next score
        const predictedScore = predictNextScore(stats);
        
        console.log(`✅ Session created: ${sessionId}, ELO=${stats.elo}, Predicted=${Math.round(predictedScore)}`);
        
        res.json({
            success: true,
            sessionId,
            predictedScore,
            currentElo: stats.elo,
            stats: {
                gamesPlayed: stats.gamesPlayed,
                averageScore: Math.round(stats.averageScore),
                bestScore: stats.bestScore,
                recentTrend: stats.recentTrend
            }
        });
        
    } catch (error) {
        console.error('Start game error:', error);
        res.status(500).json({ error: 'Failed to start game' });
    }
});

// POST /api/game/submit - Submit game results
router.post('/submit', authMiddleware, async (req, res) => {
    try {
        await connectDB();
        
        const { sessionId, gameType, score, roundData } = req.body;
        const userId = req.user.userId;
        
        console.log(`📊 Game submission: User=${req.user.username}, Type=${gameType}, Score=${score}, Rounds=${roundData?.rounds || 0}`);
        
        if (!sessionId || !gameType || typeof score !== 'number') {
            return res.status(400).json({ error: 'Invalid submission data' });
        }
        
        // Get player stats
        let stats = await PlayerStats.findOne({ userId, gameType });
        
        if (!stats) {
            // Create new stats if this is the first game of this type
            stats = new PlayerStats({
                userId,
                gameType,
                elo: 1200,
                predictedNextScore: 500
            });
            console.log(`  ℹ️ Creating new PlayerStats for ${gameType}`);
        }
        
        // Calculate new ELO
        const predictedScore = stats.predictedNextScore || 500;
        const { newElo, eloChange } = updateSoloElo(
            stats.elo,
            score,
            predictedScore,
            stats.gamesPlayed
        );
        
        // Add session to vector (rolling window)
        stats.addSession({
            sessionId,
            score,
            timestamp: new Date(),
            opponentElo: null,
            result: 'solo'
        });
        
        // Update ELO
        stats.elo = newElo;
        
        // Update prediction for next game
        stats.predictedNextScore = predictNextScore(stats);
        
        await stats.save();
        
        // Update user's global stats
        await User.findByIdAndUpdate(userId, {
            $inc: { totalGamesPlayed: 1 },
            $max: { globalElo: newElo }
        });
        
        // Save game session
        const gameSession = new GameSession({
            sessionId,
            gameType,
            mode: 'solo',
            players: [{
                userId,
                username: req.user.username,
                startingElo: stats.elo - eloChange,
                finalElo: newElo,
                score,
                placement: 1,
                eloChange,
                roundScores: roundData.roundScores || [] // Store individual round data
            }],
            roundData,
            completedAt: new Date()
        });
        
        await gameSession.save();
        
        console.log(`✅ Saved to DB: ELO ${stats.elo - eloChange} → ${newElo} (${eloChange >= 0 ? '+' : ''}${eloChange})`);
        
        res.json({
            success: true,
            score,
            oldElo: stats.elo - eloChange,
            eloChange,
            newElo,
            predictedNextScore: stats.predictedNextScore,
            stats: {
                gamesPlayed: stats.gamesPlayed,
                averageScore: Math.round(stats.averageScore),
                bestScore: stats.bestScore,
                recentTrend: stats.recentTrend,
                avgLast10: Math.round(stats.avgLast10)
            }
        });
        
    } catch (error) {
        console.error('Submit game error:', error);
        res.status(500).json({ error: 'Failed to submit game results' });
    }
});

// GET /api/game/stats/:gameType - Get player stats for a game type
router.get('/stats/:gameType', authMiddleware, async (req, res) => {
    try {
        await connectDB();
        
        const { gameType } = req.params;
        const userId = req.user.userId;
        
        const stats = await PlayerStats.findOne({ userId, gameType });
        
        if (!stats) {
            return res.json({
                elo: 1200,
                gamesPlayed: 0,
                averageScore: 0,
                bestScore: 0,
                sessionHistory: []
            });
        }
        
        // Fetch actual game sessions with full details
        const gameSessions = await GameSession.find({
            gameType,
            'players.userId': userId
        })
        .sort({ completedAt: -1 })
        .limit(20)
        .lean();
        
        // Transform sessions to include finalElo and completedAt
        const sessionHistory = gameSessions.map(session => {
            const player = session.players.find(p => p.userId.toString() === userId.toString());
            return {
                sessionId: session.sessionId,
                score: player.score,
                finalElo: player.finalElo,
                completedAt: session.completedAt,
                eloChange: player.eloChange,
                roundScores: player.roundScores || []
            };
        }).reverse(); // Reverse to get oldest first
        
        res.json({
            elo: stats.elo,
            gamesPlayed: stats.gamesPlayed,
            wins: stats.wins,
            losses: stats.losses,
            draws: stats.draws,
            averageScore: Math.round(stats.averageScore),
            bestScore: stats.bestScore,
            worstScore: stats.worstScore,
            recentTrend: stats.recentTrend,
            avgLast10: Math.round(stats.avgLast10),
            avgLast25: Math.round(stats.avgLast25),
            predictedNextScore: stats.predictedNextScore,
            sessionHistory: sessionHistory
        });
        
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

module.exports = router;
