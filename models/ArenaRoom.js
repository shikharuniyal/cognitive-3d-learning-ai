const mongoose = require('mongoose');

const arenaPlayerSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    username: String,
    elo: Number,
    joinedAt: { type: Date, default: Date.now },
    ready: { type: Boolean, default: false }
}, { _id: false });

const arenaRoomSchema = new mongoose.Schema({
    roomId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    gameType: {
        type: String,
        required: true,
        enum: ['pattern', 'sequence', 'spatial']
    },
    status: {
        type: String,
        required: true,
        enum: ['waiting', 'playing', 'completed'],
        default: 'waiting',
        index: true
    },
    maxPlayers: {
        type: Number,
        default: 4,
        min: 2,
        max: 10
    },
    currentPlayers: {
        type: Number,
        default: 0
    },
    
    players: [arenaPlayerSchema],
    
    // ELO-based matchmaking range
    eloMin: Number,
    eloMax: Number,
    
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    startedAt: Date,
    expiresAt: {
        type: Date,
        index: true
    }
});

// Compound index for matchmaking queries
arenaRoomSchema.index({ gameType: 1, status: 1, eloMin: 1, eloMax: 1 });

// Automatically set expiration (10 minutes for waiting rooms)
arenaRoomSchema.pre('save', function(next) {
    if (this.isNew && this.status === 'waiting') {
        this.expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    }
    next();
});

module.exports = mongoose.model('ArenaRoom', arenaRoomSchema);
