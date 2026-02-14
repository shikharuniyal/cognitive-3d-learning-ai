const express = require('express');
const router = express.Router();
const { connectDB } = require('../lib/db');
const PlayerStats = require('../models/PlayerStats');
const User = require('../models/User');

// GET /api/leaderboard/global - Global leaderboard (all game types)
router.get('/global', async (req, res) => {
    try {
        await connectDB();
        
        const limit = parseInt(req.query.limit) || 100;
        
        const topPlayers = await User.find()
            .sort({ globalElo: -1 })
            .limit(limit)
            .select('username globalElo totalGamesPlayed');
        
        // For each player, find their best game type based on last 10 matches
        const leaderboardWithBestGame = await Promise.all(topPlayers.map(async (player, index) => {
            // Get stats for all game types
            const allStats = await PlayerStats.find({ userId: player._id });
            
            let bestGameType = 'N/A';
            let maxScore = 0;
            
            for (const stats of allStats) {
                // Calculate aggregate score from last 10 sessions
                const last10 = stats.sessionVector.slice(-10);
                const aggregateScore = last10.reduce((sum, session) => sum + session.score, 0);
                
                if (aggregateScore > maxScore) {
                    maxScore = aggregateScore;
                    bestGameType = stats.gameType;
                }
            }
            
            return {
                rank: index + 1,
                username: player.username,
                globalElo: player.globalElo,
                totalGamesPlayed: player.totalGamesPlayed,
                bestGameType: bestGameType.charAt(0).toUpperCase() + bestGameType.slice(1)
            };
        }));
        
        res.json({
            leaderboard: leaderboardWithBestGame
        });
        
    } catch (error) {
        console.error('Global leaderboard error:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

// GET /api/leaderboard/:gameType - Game type specific leaderboard
router.get('/:gameType', async (req, res) => {
    try {
        await connectDB();
        
        const { gameType } = req.params;
        const limit = parseInt(req.query.limit) || 100;
        
        if (!['pattern', 'sequence', 'spatial'].includes(gameType)) {
            return res.status(400).json({ error: 'Invalid game type' });
        }
        
        const topPlayers = await PlayerStats.find({ gameType })
            .sort({ elo: -1 })
            .limit(limit)
            .populate('userId', 'username');
        
        res.json({
            gameType,
            leaderboard: topPlayers.map((stats, index) => ({
                rank: index + 1,
                username: stats.userId.username,
                elo: stats.elo,
                gamesPlayed: stats.gamesPlayed,
                averageScore: Math.round(stats.averageScore),
                bestScore: stats.bestScore,
                recentTrend: stats.recentTrend
            }))
        });
        
    } catch (error) {
        console.error('Game type leaderboard error:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

module.exports = router;
