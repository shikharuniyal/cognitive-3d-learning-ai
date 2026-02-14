/**
 * Score Prediction Model
 * Uses linear regression on time-series features
 */

/**
 * Predict next score based on player's session history
 * @param {Object} playerStats - PlayerStats document with sessionVector
 * @returns {number} Predicted score for next game
 */
function predictNextScore(playerStats) {
    const sessions = playerStats.sessionVector;
    
    if (sessions.length === 0) {
        // No history - return a default prediction
        return 500; // Baseline score
    }
    
    const scores = sessions.map(s => s.score);
    
    // Simple weighted average with more weight on recent games
    if (scores.length < 5) {
        // Not enough data - use simple average
        return Math.round(avg(scores));
    }
    
    // Calculate features
    const avgLast5 = avg(scores.slice(-5));
    const avgLast10 = avg(scores.slice(-10));
    const avgLast25 = avg(scores.slice(-25));
    const trend = calculateTrend(scores.slice(-10));
    const variance = calculateVariance(scores.slice(-10));
    
    // Weighted prediction model
    // More weight on recent performance + trend adjustment
    let prediction = (
        avgLast5 * 0.5 +
        avgLast10 * 0.3 +
        avgLast25 * 0.2
    );
    
    // Trend adjustment
    // If improving, add bonus; if declining, subtract
    prediction += trend * 5;
    
    // Consistency adjustment
    // High variance means less predictable - regress toward mean
    if (variance > 1000) {
        const globalAvg = playerStats.averageScore || 500;
        prediction = prediction * 0.7 + globalAvg * 0.3;
    }
    
    // Bounds checking
    prediction = Math.max(0, Math.min(10000, prediction));
    
    return Math.round(prediction);
}

/**
 * Advanced prediction with linear regression
 * @param {Array} scores - Array of recent scores
 * @returns {number} Predicted next score
 */
function predictWithLinearRegression(scores) {
    if (scores.length < 3) {
        return avg(scores);
    }
    
    const n = scores.length;
    const indices = Array.from({ length: n }, (_, i) => i);
    
    const meanX = avg(indices);
    const meanY = avg(scores);
    
    // Calculate slope (β₁)
    const numerator = indices.reduce((sum, x, i) => 
        sum + (x - meanX) * (scores[i] - meanY), 0);
    const denominator = indices.reduce((sum, x) => 
        sum + Math.pow(x - meanX, 2), 0);
    
    const slope = denominator === 0 ? 0 : numerator / denominator;
    
    // Calculate intercept (β₀)
    const intercept = meanY - slope * meanX;
    
    // Predict next value (x = n)
    const prediction = intercept + slope * n;
    
    return Math.round(Math.max(0, prediction));
}

/**
 * Calculate time-weighted average (exponential moving average)
 * Recent games have more weight
 */
function exponentialMovingAverage(scores, alpha = 0.3) {
    if (scores.length === 0) return 0;
    
    let ema = scores[0];
    for (let i = 1; i < scores.length; i++) {
        ema = alpha * scores[i] + (1 - alpha) * ema;
    }
    
    return ema;
}

// Helper functions
function avg(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function calculateVariance(arr) {
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
    
    const numerator = indices.reduce((sum, x, i) => 
        sum + (x - meanX) * (arr[i] - meanY), 0);
    const denominator = indices.reduce((sum, x) => 
        sum + Math.pow(x - meanX, 2), 0);
    
    return denominator === 0 ? 0 : numerator / denominator;
}

module.exports = {
    predictNextScore,
    predictWithLinearRegression,
    exponentialMovingAverage
};
