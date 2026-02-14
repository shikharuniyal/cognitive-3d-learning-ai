const mongoose = require('mongoose');

const roundScoreSchema = new mongoose.Schema({
    roundNumber: Number,
    score: Number,
    timeSpent: Number, // milliseconds
    correct: Boolean,
    timestamp: Date
}, { _id: false });

const playerResultSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    username: String,
    startingElo: Number,
    finalElo: Number,
    score: Number,
    placement: Number, // 1 for 1st place, 2 for 2nd, etc.
    eloChange: Number,
    roundScores: [roundScoreSchema] // Individual round performance
}, { _id: false });

const gameSessionSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    gameType: {
        type: String,
        required: true,
        enum: ['pattern', 'sequence', 'spatial'],
        index: true
    },
    mode: {
        type: String,
        required: true,
        enum: ['solo', 'arena'],
        default: 'solo'
    },
    
    // Players array (1 player for solo, multiple for arena)
    players: [playerResultSchema],
    
    // Session details
    roundData: mongoose.Schema.Types.Mixed, // Game-specific data
    
    startedAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    completedAt: Date,
    duration: Number, // milliseconds
    
    // Arena-specific
    roomId: String,
    maxPlayers: { type: Number, default: 1 }
});

// Index for leaderboard queries
gameSessionSchema.index({ gameType: 1, startedAt: -1 });
gameSessionSchema.index({ 'players.userId': 1, startedAt: -1 });

module.exports = mongoose.model('GameSession', gameSessionSchema);
