/**
 * ELO Rating System
 * Standard ELO formula with dynamic K-factor
 */

// K-factor determines how much ratings change after each game
function getKFactor(gamesPlayed) {
    if (gamesPlayed < 30) return 40;  // New players - ratings change quickly
    if (gamesPlayed < 100) return 30; // Intermediate
    return 20; // Experienced - ratings stabilize
}

/**
 * Calculate expected score for player A vs player B
 * @param {number} eloA - Player A's current ELO
 * @param {number} eloB - Player B's current ELO (or average opponent ELO)
 * @returns {number} Expected score between 0 and 1
 */
function calculateExpectedScore(eloA, eloB) {
    return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

/**
 * Update ELO rating after a game
 * @param {number} currentElo - Player's current ELO
 * @param {number} opponentElo - Opponent's ELO (or average for multiplayer)
 * @param {number} actualScore - Actual result (1 = win, 0.5 = draw, 0 = loss)
 * @param {number} gamesPlayed - Total games played (for K-factor)
 * @returns {object} { newElo, eloChange, expectedScore }
 */
function updateElo(currentElo, opponentElo, actualScore, gamesPlayed) {
    const kFactor = getKFactor(gamesPlayed);
    const expectedScore = calculateExpectedScore(currentElo, opponentElo);
    const eloChange = Math.round(kFactor * (actualScore - expectedScore));
    const newElo = currentElo + eloChange;
    
    return {
        newElo: Math.max(100, newElo), // Minimum ELO of 100
        eloChange,
        expectedScore
    };
}

/**
 * Calculate ELO changes for multiplayer arena (free-for-all)
 * @param {Array} players - Array of { userId, username, elo, score, placement }
 * @returns {Array} Updated players with newElo and eloChange
 */
function calculateMultiplayerElo(players) {
    const n = players.length;
    
    // Calculate average opponent ELO for each player
    const avgOpponentElo = (playerElo) => {
        const others = players.filter(p => p.elo !== playerElo);
        return others.reduce((sum, p) => sum + p.elo, 0) / others.length;
    };
    
    return players.map(player => {
        // Convert placement to actual score
        // 1st place = 1.0, 2nd = 0.66, 3rd = 0.33, last = 0
        const actualScore = (n - player.placement) / (n - 1);
        
        const opponentAvgElo = avgOpponentElo(player.elo);
        const { newElo, eloChange, expectedScore } = updateElo(
            player.elo,
            opponentAvgElo,
            actualScore,
            player.gamesPlayed || 0
        );
        
        return {
            ...player,
            newElo,
            eloChange,
            expectedScore
        };
    });
}

/**
 * Solo mode ELO update (vs. predicted score)
 * In solo mode, we compare against the player's predicted score
 * @param {number} currentElo - Current ELO
 * @param {number} actualScore - Actual game score
 * @param {number} predictedScore - ML-predicted score
 * @param {number} gamesPlayed - Total games played
 * @returns {object} { newElo, eloChange }
 */
function updateSoloElo(currentElo, actualScore, predictedScore, gamesPlayed) {
    // Convert scores to win/loss ratio
    // If actual > predicted, it's a "win" against yourself
    const performanceRatio = predictedScore > 0 
        ? Math.min(actualScore / predictedScore, 2) 
        : 1;
    
    // Convert to ELO score (0 to 1)
    // 1 = exceeded prediction, 0.5 = met prediction, 0 = underperformed
    const actualEloScore = Math.min(1, performanceRatio / 2);
    
    // Use a baseline ELO (e.g., 1200) as the "opponent"
    const baselineElo = 1200;
    const { newElo, eloChange } = updateElo(
        currentElo,
        baselineElo,
        actualEloScore,
        gamesPlayed
    );
    
    return { newElo, eloChange };
}

module.exports = {
    calculateExpectedScore,
    updateElo,
    calculateMultiplayerElo,
    updateSoloElo,
    getKFactor
};
