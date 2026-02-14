const mongoose = require('mongoose');

const sessionEntrySchema = new mongoose.Schema({
    sessionId: String,
    score: Number,
    timestamp: { type: Date, default: Date.now },
    opponentElo: { type: Number, default: null },
    result: { 
        type: String, 
        enum: ['win', 'loss', 'draw', 'solo'],
        default: 'solo'
    }
}, { _id: false });

const playerStatsSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    gameType: {
        type: String,
        required: true,
        enum: ['pattern', 'sequence', 'spatial'],
        index: true
    },
    elo: {
        type: Number,
        default: 1200
    },
    predictedNextScore: {
        type: Number,
        default: 0
    },
    
    // Rolling window of last 100 sessions (FIFO queue)
    sessionVector: {
        type: [sessionEntrySchema],
        default: [],
        validate: [arrayLimit, 'Session vector exceeds 100 entries']
    },
    
    // Aggregated statistics
    gamesPlayed: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    draws: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 },
    bestScore: { type: Number, default: 0 },
    worstScore: { type: Number, default: null },
    
    // Time-series features for ML prediction
    recentTrend: {
        type: String,
        enum: ['improving', 'declining', 'stable', 'unknown'],
        default: 'unknown'
    },
    avgLast10: { type: Number, default: 0 },
    avgLast25: { type: Number, default: 0 },
    avgLast50: { type: Number, default: 0 },
    scoreVariance: { type: Number, default: 0 },
    
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Compound index for userId + gameType (each user has one stats doc per game type)
playerStatsSchema.index({ userId: 1, gameType: 1 }, { unique: true });

// Validator to limit sessionVector to 100 entries
function arrayLimit(val) {
    return val.length <= 100;
}

// Method to add a new session and maintain rolling window
playerStatsSchema.methods.addSession = function(sessionData) {
    // Add new session
    this.sessionVector.push(sessionData);
    
    // Maintain rolling window (max 100)
    if (this.sessionVector.length > 100) {
        this.sessionVector.shift(); // Remove oldest
    }
    
    // Recalculate aggregated stats
    this.recalculateStats();
};

// Method to recalculate all statistics
playerStatsSchema.methods.recalculateStats = function() {
    const sessions = this.sessionVector;
    const scores = sessions.map(s => s.score);
    
    if (scores.length === 0) return;
    
    // Update game counts
    this.gamesPlayed = sessions.length;
    this.wins = sessions.filter(s => s.result === 'win').length;
    this.losses = sessions.filter(s => s.result === 'loss').length;
    this.draws = sessions.filter(s => s.result === 'draw').length;
    
    // Score statistics
    this.averageScore = avg(scores);
    this.bestScore = Math.max(...scores);
    this.worstScore = Math.min(...scores);
    
    // Time-series averages
    this.avgLast10 = avg(scores.slice(-10));
    this.avgLast25 = avg(scores.slice(-25));
    this.avgLast50 = avg(scores.slice(-50));
    
    // Variance
    this.scoreVariance = variance(scores);
    
    // Trend calculation (linear regression on recent scores)
    const recentScores = scores.slice(-25);
    if (recentScores.length >= 5) {
        const trend = calculateTrend(recentScores);
        if (trend > 0.5) this.recentTrend = 'improving';
        else if (trend < -0.5) this.recentTrend = 'declining';
        else this.recentTrend = 'stable';
    }
    
    this.updatedAt = new Date();
};

// Helper functions
function avg(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function variance(arr) {
    if (arr.length === 0) return 0;
    const mean = avg(arr);
    return avg(arr.map(x => Math.pow(x - mean, 2)));
}

function calculateTrend(arr) {
    if (arr.length < 2) return 0;
    
    const n = arr.length;
    const indices = Array.from({ length: n }, (_, i) => i);
    
    const meanX = avg(indices);
    const meanY = avg(arr);
    
    const numerator = indices.reduce((sum, x, i) => sum + (x - meanX) * (arr[i] - meanY), 0);
    const denominator = indices.reduce((sum, x) => sum + Math.pow(x - meanX, 2), 0);
    
    return denominator === 0 ? 0 : numerator / denominator;
}

module.exports = mongoose.model('PlayerStats', playerStatsSchema);
