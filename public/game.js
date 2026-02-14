/* ========================================
   MEMORY BATTLE ROYALE — MULTIPLAYER
   Client-side game engine
   ======================================== */

const API_BASE = window.location.origin;
const TOTAL_ROUNDS = 10;
const ROUND_DURATION = 15; // seconds

class MemoryGame {
    constructor() {
        this.username = '';
        this.userId = null;
        this.token = null;
        this.selectedGameType = null;
        this.sessionId = null;
        this.predictedScore = 0;
        this.currentElo = 1200;
        
        // Auto-rotation state
        this.gameTypeRotation = ['pattern', 'sequence', 'spatial'];
        this.currentGameTypeIndex = 0;
        this.autoPlayMode = false;
        
        // Charts
        this.charts = {
            pattern: null,
            sequence: null,
            spatial: null,
            elo: null
        };
        this.performanceData = {
            pattern: [],
            sequence: [],
            spatial: [],
            eloHistory: []
        };
        
        this.currentRound = 0;
        this.totalScore = 0;
        this.streak = 0;
        this.maxStreak = 0;
        this.roundScores = [];
        this.roundTypes = [];
        this.roundSpeeds = [];
        this.roundStartTimes = []; // Track round start times

        // Current round state
        this.roundType = null;
        this.roundData = null;
        this.phase = 'idle'; // idle | memorize | recall | submitted
        this.startTime = 0;
        this.timerInterval = null;
        this.timeRemaining = ROUND_DURATION;

        // Player answers
        this.patternAnswer = [];
        this.sequenceAnswer = [];
        this.spatialPositions = [];

        // Spatial drag state
        this._dragTarget = null;
        this._dragOffsetX = 0;
        this._dragOffsetY = 0;

        // Audio context
        this.audioCtx = null;
        this.loaderNoiseInterval = null;

        this.initParticles();
        this.initKeyboardHandlers();
        
        // Show login screen by default
        this.showScreen('loginScreen');
        this.showLoginForm();
        
        // Then check for existing auth
        this.checkAuth();
    }
    
    /* =====================
       AUTHENTICATION
       ===================== */
    checkAuth() {
        const token = localStorage.getItem('authToken');
        if (token) {
            this.token = token;
            // Try to auto-login, but don't block page if it fails
            this.verifyToken().catch(() => {
                // Silently fail and show login screen
                this.token = null;
                localStorage.removeItem('authToken');
                this.showScreen('loginScreen');
                this.showLoginForm();
            });
        }
    }
    
    async verifyToken() {
        if (!this.token) return;
        
        try {
            const res = await fetch(`${API_BASE}/api/game/stats/pattern`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            if (res.ok) {
                const data = await res.json();
                // Extract username from token or use placeholder
                this.username = 'Player'; // Will be set properly on login
                await this.showMainMenu();
            } else {
                throw new Error('Invalid token');
            }
        } catch (error) {
            localStorage.removeItem('authToken');
            this.token = null;
            throw error;
        }
    }
    
    showLoginForm() {
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('registerForm').style.display = 'none';
        document.getElementById('loginError').style.display = 'none';
    }
    
    showRegisterForm() {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'block';
        document.getElementById('loginError').style.display = 'none';
    }
    
    showError(message) {
        const errorEl = document.getElementById('loginError');
        errorEl.textContent = message;
        errorEl.style.display = 'block';
        setTimeout(() => errorEl.style.display = 'none', 5000);
    }
    
    async register() {
        const username = document.getElementById('registerUsername').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value;
        
        if (!username || !email || !password) {
            this.showError('All fields are required');
            return;
        }
        
        if (password.length < 6) {
            this.showError('Password must be at least 6 characters');
            return;
        }
        
        try {
            const res = await fetch(`${API_BASE}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });
            
            const data = await res.json();
            
            if (!res.ok) {
                this.showError(data.error || 'Registration failed');
                return;
            }
            
            this.token = data.token;
            this.username = data.user.username;
            this.userId = data.user.id;
            localStorage.setItem('authToken', this.token);
            
            await this.showMainMenu();
        } catch (error) {
            console.error('Register error:', error);
            this.showError('Network error. Please try again.');
        }
    }
    
    async login() {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        
        if (!username || !password) {
            this.showError('Username and password required');
            return;
        }
        
        try {
            const res = await fetch(`${API_BASE}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            const data = await res.json();
            
            if (!res.ok) {
                this.showError(data.error || 'Login failed');
                return;
            }
            
            this.token = data.token;
            this.username = data.user.username;
            this.userId = data.user.id;
            localStorage.setItem('authToken', this.token);
            
            await this.showMainMenu();
        } catch (error) {
            console.error('Login error:', error);
            this.showError('Network error. Please try again.');
        }
    }
    
    logout() {
        localStorage.removeItem('authToken');
        this.token = null;
        this.username = '';
        this.userId = null;
        this.autoPlayMode = false;
        this.showScreen('loginScreen');
        this.showLoginForm();
    }
    
    /* =====================
       KEYBOARD HANDLERS
       ===================== */
    initKeyboardHandlers() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.phase !== 'idle') {
                this.exitToMenu();
            }
        });
    }
    
    async exitToMenu() {
        // Save progress if there are any completed rounds
        console.log('ESC pressed - Checking save conditions:', {
            hasToken: !!this.token,
            hasSessionId: !!this.sessionId,
            sessionId: this.sessionId,
            roundsPlayed: this.roundScores.length
        });
        
        if (this.roundScores.length === 0) {
            console.log('⚠️ No rounds completed, skipping save');
        } else if (!this.token) {
            console.error('❌ Cannot save: No auth token');
        } else if (!this.sessionId) {
            console.error('❌ Cannot save: No session ID');
        } else {
            console.log(`✅ Saving ${this.roundScores.length} rounds before exit...`);
            await this.submitScore(true); // Silent save
        }
        
        // Stop any running timers
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        
        // Reset game state
        this.phase = 'idle';
        this.autoPlayMode = false;
        
        // Return to main menu and refresh
        await this.showMainMenu();
    }
    
    /* =====================
       AUTO-PLAY MODE
       ===================== */
    startAutoPlayMode() {
        this.autoPlayMode = true;
        this.currentGameTypeIndex = 0;
        this.selectNextGameType();
    }
    
    selectNextGameType() {
        // Cycle through game types
        this.selectedGameType = this.gameTypeRotation[this.currentGameTypeIndex];
        this.currentGameTypeIndex = (this.currentGameTypeIndex + 1) % this.gameTypeRotation.length;
        
        // Start the game
        this.selectGameType(this.selectedGameType);
    }
    
    async showMainMenu() {
        const startTime = (typeof performance !== 'undefined' && performance.now)
            ? performance.now()
            : Date.now();
        this.showDashboardLoader('CALIBRATING IQ RANKERS...');
        this.showScreen('mainMenuScreen');
        document.getElementById('welcomePlayer').textContent = `WELCOME, ${this.username.toUpperCase()}`;

        try {
            await this.fetchUserStats();
            await this.fetchLeaderboard();
            this.renderCharts();
        } catch (error) {
            console.error('Failed to prepare dashboard:', error);
        } finally {
            const elapsed = ((typeof performance !== 'undefined' && performance.now)
                ? performance.now()
                : Date.now()) - startTime;
            const minDuration = 1200;
            if (elapsed < minDuration) {
                await new Promise((resolve) => setTimeout(resolve, minDuration - elapsed));
            }
            this.hideDashboardLoader();
        }
    }

    showDashboardLoader(message = 'CALIBRATING IQ RANKERS...') {
        const loader = document.getElementById('dashboardLoader');
        if (!loader) return;

        const messageEl = document.getElementById('dashboardLoaderMessage');
        if (messageEl) {
            messageEl.textContent = message;
        }

        const noiseEl = document.getElementById('loaderNoiseMatrix');
        if (noiseEl) {
            noiseEl.textContent = this.generateAsciiNoise();
            if (this.loaderNoiseInterval) {
                clearInterval(this.loaderNoiseInterval);
            }
            this.loaderNoiseInterval = setInterval(() => {
                noiseEl.textContent = this.generateAsciiNoise();
            }, 120);
        }

        loader.classList.add('active');
    }

    hideDashboardLoader() {
        const loader = document.getElementById('dashboardLoader');
        if (!loader) return;

        loader.classList.remove('active');
        if (this.loaderNoiseInterval) {
            clearInterval(this.loaderNoiseInterval);
            this.loaderNoiseInterval = null;
        }
    }

    generateAsciiNoise(lines = 6, width = 32) {
        const chars = ['.', ':', '*', '+', '=', '-', '_', '|', '/', '\\'];
        let result = '';
        for (let i = 0; i < lines; i++) {
            let line = '';
            for (let j = 0; j < width; j++) {
                line += chars[Math.floor(Math.random() * chars.length)];
            }
            result += line + (i < lines - 1 ? '\n' : '');
        }
        return result;
    }
    
    async fetchUserStats() {
        if (!this.token) return;
        
        try {
            // Fetch stats for all game types
            const gameTypes = ['pattern', 'sequence', 'spatial'];
            
            for (const gameType of gameTypes) {
                const res = await fetch(`${API_BASE}/api/game/stats/${gameType}`, {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                });
                
                if (res.ok) {
                    const stats = await res.json();
                    this.updateGameTypeStats(gameType, stats);
                    
                    // Store performance data for charts
                    if (stats.sessionHistory && stats.sessionHistory.length > 0) {
                        this.performanceData[gameType] = stats.sessionHistory
                            .slice(-20) // Last 20 games
                            .map(session => ({
                                score: session.score,
                                elo: session.finalElo,
                                date: new Date(session.completedAt)
                            }));
                        
                        // Collect ELO history (combined from all game types)
                        stats.sessionHistory.slice(-10).forEach(session => {
                            this.performanceData.eloHistory.push({
                                gameType,
                                elo: session.finalElo,
                                date: new Date(session.completedAt)
                            });
                        });
                    }
                }
            }
            
            // Sort ELO history by date
            this.performanceData.eloHistory.sort((a, b) => a.date - b.date);
            
            // Update global stats
            // Calculate total games from all types
            const totalGames = this.performanceData.pattern.length + 
                             this.performanceData.sequence.length + 
                             this.performanceData.spatial.length;
            document.getElementById('gamesPlayed').textContent = totalGames;
            
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    }
    
    updateGameTypeStats(gameType, stats) {
        // Update ELO
        document.getElementById(`${gameType}Elo`).textContent = stats.elo || 1200;
        
        // Update trend with color classes
        const trendEl = document.getElementById(`${gameType}Trend`);
        if (stats.recentTrend) {
            trendEl.textContent = stats.recentTrend.toUpperCase();
            trendEl.className = 'summary-trend ' + stats.recentTrend;
        } else {
            trendEl.textContent = '--';
            trendEl.className = 'summary-trend';
        }
        
        // Update global ELO (use highest across all game types)
        const currentGlobalElo = parseInt(document.getElementById('globalElo').textContent) || 1200;
        if (stats.elo > currentGlobalElo) {
            document.getElementById('globalElo').textContent = stats.elo;
        }
    }
    
    /* =====================
       CHARTS & ANALYTICS
       ===================== */
    renderCharts() {
        this.renderPerformanceChart('pattern', 'patternChart', 'Pattern Recall');
        this.renderPerformanceChart('sequence', 'sequenceChart', 'Sequence Memory');
        this.renderPerformanceChart('spatial', 'spatialChart', 'Spatial Memory');
        this.renderEloChart();
    }
    
    renderPerformanceChart(gameType, canvasId, label) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        
        // Destroy existing chart
        if (this.charts[gameType]) {
            this.charts[gameType].destroy();
        }
        
        const data = this.performanceData[gameType] || [];
        
        // If no data, show placeholder
        if (data.length === 0) {
            this.charts[gameType] = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['No data yet'],
                    datasets: [{
                        label: 'Score',
                        data: [0],
                        borderColor: '#a855f7',
                        backgroundColor: 'rgba(168, 85, 247, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: { 
                            beginAtZero: true,
                            ticks: { color: '#00f3ff' },
                            grid: { color: 'rgba(0, 243, 255, 0.1)' }
                        },
                        x: {
                            ticks: { color: '#00f3ff' },
                            grid: { color: 'rgba(0, 243, 255, 0.1)' }
                        }
                    }
                }
            });
            return;
        }
        
        // Calculate dynamic Y-axis range with buffer
        const scores = data.map(d => d.score);
        const minScore = Math.min(...scores);
        const maxScore = Math.max(...scores);
        const buffer = (maxScore - minScore) * 0.2 || 100; // 20% buffer or 100 if all same
        
        this.charts[gameType] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map((d, i) => `Game ${i + 1}`),
                datasets: [{
                    label: 'Score',
                    data: scores,
                    borderColor: '#a855f7',
                    backgroundColor: 'rgba(168, 85, 247, 0.2)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#00f3ff',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(10, 10, 26, 0.9)',
                        titleColor: '#00f3ff',
                        bodyColor: '#fff',
                        borderColor: '#a855f7',
                        borderWidth: 2
                    }
                },
                scales: {
                    y: {
                        min: Math.max(0, minScore - buffer),
                        max: maxScore + buffer,
                        ticks: { color: '#00f3ff', font: { size: 11 } },
                        grid: { color: 'rgba(0, 243, 255, 0.1)' }
                    },
                    x: {
                        ticks: { color: '#00f3ff', font: { size: 10 }, maxRotation: 0 },
                        grid: { color: 'rgba(0, 243, 255, 0.1)' }
                    }
                }
            }
        });
    }
    
    renderEloChart() {
        const ctx = document.getElementById('eloChart');
        if (!ctx) return;
        
        // Destroy existing chart
        if (this.charts.elo) {
            this.charts.elo.destroy();
        }
        
        const data = this.performanceData.eloHistory || [];
        
        if (data.length === 0) {
            this.charts.elo = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['No games yet'],
                    datasets: [{
                        label: 'ELO',
                        data: [1200],
                        borderColor: '#00f3ff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: { legend: { display: false } }
                }
            });
            return;
        }
        
        // Calculate dynamic range
        const elos = data.map(d => d.elo);
        const minElo = Math.min(...elos);
        const maxElo = Math.max(...elos);
        const buffer = (maxElo - minElo) * 0.1 || 50;
        
        this.charts.elo = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map((d, i) => `${d.gameType[0].toUpperCase()}${i + 1}`),
                datasets: [{
                    label: 'ELO Rating',
                    data: elos,
                    borderColor: '#00f3ff',
                    backgroundColor: 'rgba(0, 243, 255, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#a855f7',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true,
                        labels: { color: '#00f3ff', font: { size: 13 } }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(10, 10, 26, 0.9)',
                        titleColor: '#00f3ff',
                        bodyColor: '#fff',
                        borderColor: '#00f3ff',
                        borderWidth: 2
                    }
                },
                scales: {
                    y: {
                        min: Math.max(1000, minElo - buffer),
                        max: maxElo + buffer,
                        ticks: { color: '#00f3ff', font: { size: 12 } },
                        grid: { color: 'rgba(0, 243, 255, 0.1)' }
                    },
                    x: {
                        ticks: { color: '#00f3ff', font: { size: 10 } },
                        grid: { color: 'rgba(0, 243, 255, 0.1)' }
                    }
                }
            }
        });
    }
    
    /* =====================
       LEADERBOARD
       ===================== */
    async fetchLeaderboard() {
        try {
            const res = await fetch(`${API_BASE}/api/leaderboard/global`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            
            if (!res.ok) return;
            
            const data = await res.json();
            this.renderLeaderboard(data.leaderboard || []);
        } catch (error) {
            console.error('Failed to fetch leaderboard:', error);
        }
    }
    
    renderLeaderboard(players) {
        const container = document.getElementById('leaderboardList');
        if (!container) return;
        
        if (players.length === 0) {
            container.innerHTML = '<div class="loading-text">No players yet</div>';
            return;
        }
        
        container.innerHTML = players.slice(0, 10).map((player, index) => {
            const rankClass = index === 0 ? 'top1' : index === 1 ? 'top2' : index === 2 ? 'top3' : '';
            const isCurrentUser = player.username === this.username;
            const highlightClass = isCurrentUser ? 'style="background: rgba(0, 243, 255, 0.2);"' : '';
            
            return `
                <div class="leaderboard-item" ${highlightClass}>
                    <div class="leaderboard-rank ${rankClass}">#${index + 1}</div>
                    <div class="leaderboard-username">${player.username}${isCurrentUser ? ' (You)' : ''}</div>
                    <div class="leaderboard-elo">${player.globalElo || player.elo || 1200}</div>
                    <div class="leaderboard-games">${player.bestGameType || 'N/A'}</div>
                </div>
            `;
        }).join('');
    }
    
    async selectGameType(gameType) {
        this.selectedGameType = gameType; // Store for reference but rounds will rotate
        
        // Generate a base session ID (will be prefixed with actual game type during submit)
        const userId = this.token ? JSON.parse(atob(this.token.split('.')[1])).userId : 'guest';
        const timestamp = Date.now();
        this.sessionId = `${userId}_${timestamp}`;
        
        // Set default prediction (will be updated per game type)
        this.predictedScore = 500;
        this.currentElo = 1200;
        
        console.log('✅ Mixed-type game session started:', {
            sessionId: this.sessionId,
            mixedTypes: ['pattern', 'sequence', 'spatial']
        });
        
        // Show prediction notification
        this.showPredictionOverlay();
        
        setTimeout(() => this.startGame(), 3000);
    }
    
    showPredictionOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'prediction-overlay';
        overlay.innerHTML = `
            <div class="prediction-card">
                <div class="prediction-title">AI PREDICTION</div>
                <div class="prediction-score">${Math.round(this.predictedScore)}</div>
                <div class="prediction-label">Expected Score</div>
                <div class="prediction-elo">Current ELO: ${this.currentElo}</div>
            </div>
        `;
        document.body.appendChild(overlay);
        
        setTimeout(() => overlay.classList.add('show'), 100);
        setTimeout(() => {
            overlay.classList.remove('show');
            setTimeout(() => overlay.remove(), 500);
        }, 2500);
    }

    /* =====================
       SCREEN MANAGEMENT
       ===================== */
    showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(id).classList.add('active');
    }

    /* =====================
       GAME FLOW
       ===================== */
    startGame() {
        // Reset game state
        console.log('🎮 Starting new game session:', this.sessionId);
        this.currentRound = 0;
        this.totalScore = 0;
        this.streak = 0;
        this.maxStreak = 0;
        this.roundScores = [];
        this.roundTypes = [];
        this.roundSpeeds = [];
        this.roundStartTimes = [];

        this.initAudio();
        this.showCountdown();
    }

    showCountdown() {
        this.showScreen('countdownScreen');
        document.getElementById('playerGreeting').textContent = `Prepare yourself, ${this.username}`;
        let count = 3;
        document.getElementById('countdownNumber').textContent = count;
        this.playSound('countdown');

        const interval = setInterval(() => {
            count--;
            if (count > 0) {
                document.getElementById('countdownNumber').textContent = count;
                this.playSound('countdown');
            } else {
                clearInterval(interval);
                document.getElementById('countdownNumber').textContent = 'GO!';
                this.playSound('start');
                setTimeout(() => this.nextRound(), 600);
            }
        }, 1000);
    }

    nextRound() {
        this.currentRound++;
        if (this.currentRound > TOTAL_ROUNDS) {
            this.showGameOver();
            return;
        }

        // Track round start time
        this.roundStartTimes.push(new Date());

        // Determine round type
        const types = ['pattern', 'sequence', 'spatial'];
        this.roundType = types[(this.currentRound - 1) % types.length];

        // Difficulty scales with round
        const difficulty = Math.floor((this.currentRound - 1) / 3) + 1;
        this.roundData = this.generateRoundData(this.roundType, difficulty);

        // Reset answers
        this.patternAnswer = [];
        this.sequenceAnswer = [];
        this.spatialPositions = [];
        this.phase = 'memorize';

        // Update UI
        this.showScreen('gameScreen');
        document.getElementById('roundNumber').textContent = this.currentRound;
        document.getElementById('totalScore').textContent = this.totalScore;
        this.updateStreak();

        const typeLabels = { pattern: 'PATTERN RECALL', sequence: 'SEQUENCE MEMORY', spatial: 'SPATIAL MEMORY' };
        document.getElementById('challengeTypeBadge').textContent = typeLabels[this.roundType];

        // Show memorize phase
        this.showPhase('MEMORIZE');
        this.showChallenge();
        this.displayMemorizePhase();
    }

    showPhase(text) {
        const banner = document.getElementById('phaseBanner');
        const phaseText = document.getElementById('phaseText');
        phaseText.textContent = text;
        banner.classList.toggle('recall', text === 'RECALL');
    }

    showChallenge() {
        document.querySelectorAll('.challenge').forEach(c => c.classList.add('hidden'));
        const challengeId = this.roundType + 'Challenge';
        document.getElementById(challengeId).classList.remove('hidden');
    }

    /* =====================
       MEMORIZE + RECALL PHASES
       ===================== */
    displayMemorizePhase() {
        switch (this.roundType) {
            case 'pattern': this.displayPatternMemorize(); break;
            case 'sequence': this.displaySequenceMemorize(); break;
            case 'spatial': this.displaySpatialMemorize(); break;
        }

        // Transition to recall after display time
        const displayTime = this.roundData.displayTime;
        setTimeout(() => {
            if (this.phase !== 'memorize') return;
            this.phase = 'recall';
            this.showPhase('RECALL');
            this.playSound('phase');
            this.displayRecallPhase();
            this.startTimer();
        }, displayTime);
    }

    displayRecallPhase() {
        switch (this.roundType) {
            case 'pattern': this.displayPatternRecall(); break;
            case 'sequence': this.displaySequenceRecall(); break;
            case 'spatial': this.displaySpatialRecall(); break;
        }
    }

    /* =====================
       TIMER
       ===================== */
    startTimer() {
        this.startTime = Date.now();
        this.timeRemaining = ROUND_DURATION;
        document.getElementById('timerText').textContent = ROUND_DURATION;

        const circumference = 2 * Math.PI * 45; // r=45
        const progress = document.getElementById('timerProgress');
        progress.style.strokeDashoffset = '0';
        progress.classList.remove('warning', 'danger');

        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            const elapsed = (Date.now() - this.startTime) / 1000;
            this.timeRemaining = Math.max(0, ROUND_DURATION - elapsed);
            document.getElementById('timerText').textContent = Math.ceil(this.timeRemaining);

            const fraction = elapsed / ROUND_DURATION;
            progress.style.strokeDashoffset = (fraction * circumference).toString();

            if (this.timeRemaining <= 3) {
                progress.classList.add('danger');
                progress.classList.remove('warning');
            } else if (this.timeRemaining <= 7) {
                progress.classList.add('warning');
            }

            if (this.timeRemaining <= 0) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
                this.submitAnswer();
            }
        }, 100);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    /* =====================
       PATTERN CHALLENGE
       ===================== */
    generatePatternData(difficulty) {
        const gridSize = Math.min(5 + difficulty, 8);
        const sequenceLength = Math.min(4 + difficulty * 2, 16);
        const sequence = [];
        for (let i = 0; i < sequenceLength; i++) {
            const x = Math.floor(Math.random() * gridSize);
            const y = Math.floor(Math.random() * gridSize);
            sequence.push({ x, y, order: i });
        }
        return { gridSize, sequence, displayTime: 2000 + difficulty * 500 };
    }

    displayPatternMemorize() {
        const { gridSize, sequence, displayTime } = this.roundData;
        const grid = document.getElementById('patternGrid');
        grid.innerHTML = '';
        grid.style.gridTemplateColumns = `repeat(${gridSize}, 56px)`;
        document.getElementById('patternInstruction').textContent = `Memorize the highlighted sequence (${sequence.length} cells)`;

        // Create cells
        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                const cell = document.createElement('div');
                cell.className = 'pattern-cell';
                cell.dataset.x = x;
                cell.dataset.y = y;
                grid.appendChild(cell);
            }
        }

        // Animate sequence highlight
        const staggerDelay = Math.min(300, (displayTime - 500) / sequence.length);
        sequence.forEach((pos, idx) => {
            setTimeout(() => {
                const cell = grid.querySelector(`[data-x="${pos.x}"][data-y="${pos.y}"]`);
                if (cell) {
                    cell.classList.add('highlighted');
                    cell.textContent = idx + 1;
                    cell.style.color = 'var(--neon-blue)';
                    this.playSound('blip');
                }
            }, idx * staggerDelay);
        });
    }

    displayPatternRecall() {
        const grid = document.getElementById('patternGrid');
        // Remove all highlights
        grid.querySelectorAll('.pattern-cell').forEach(cell => {
            cell.classList.remove('highlighted');
            cell.textContent = '';
            cell.style.color = 'transparent';
        });
        document.getElementById('patternInstruction').textContent =
            `Click cells in the order they were highlighted (${this.roundData.sequence.length} cells)`;

        // Enable clicking
        grid.querySelectorAll('.pattern-cell').forEach(cell => {
            cell.onclick = () => {
                if (this.phase !== 'recall') return;
                const x = parseInt(cell.dataset.x);
                const y = parseInt(cell.dataset.y);

                // Toggle selection
                const existingIdx = this.patternAnswer.findIndex(p => p.x === x && p.y === y);
                if (existingIdx !== -1) {
                    this.patternAnswer.splice(existingIdx, 1);
                    cell.classList.remove('selected');
                    cell.textContent = '';
                    cell.style.color = 'transparent';
                    // Re-number
                    this.renumberPatternCells(grid);
                    this.playSound('click');
                } else {
                    this.patternAnswer.push({ x, y });
                    cell.classList.add('selected');
                    cell.textContent = this.patternAnswer.length;
                    cell.style.color = 'var(--neon-green)';
                    this.playSound('select');
                }
            };
        });
    }

    renumberPatternCells(grid) {
        // Clear all numbering first
        grid.querySelectorAll('.pattern-cell.selected').forEach(c => {
            c.textContent = '';
        });
        // Re-assign numbers
        this.patternAnswer.forEach((pos, idx) => {
            const c = grid.querySelector(`[data-x="${pos.x}"][data-y="${pos.y}"]`);
            if (c) c.textContent = idx + 1;
        });
    }

    clearPatternAnswer() {
        this.patternAnswer = [];
        const grid = document.getElementById('patternGrid');
        grid.querySelectorAll('.pattern-cell').forEach(c => {
            c.classList.remove('selected');
            c.textContent = '';
            c.style.color = 'transparent';
        });
        this.playSound('click');
    }

    /* =====================
       SEQUENCE CHALLENGE
       ===================== */
    generateSequenceData(difficulty) {
        const length = Math.min(5 + difficulty * 2, 15);
        const items = [];
        const types = ['number', 'symbol', 'color'];
        const symbols = ['★', '◆', '●', '■', '▲', '♠', '♣', '♥', '♦'];
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F'];

        for (let i = 0; i < length; i++) {
            const type = types[Math.floor(Math.random() * types.length)];
            let value;
            if (type === 'number') {
                value = Math.floor(Math.random() * 9) + 1;
            } else if (type === 'symbol') {
                value = symbols[Math.floor(Math.random() * symbols.length)];
            } else {
                value = colors[Math.floor(Math.random() * colors.length)];
            }
            items.push({ type, value, order: i });
        }

        const challengeType = ['forward', 'reverse', 'filter'][Math.floor(Math.random() * 3)];
        const filterType = challengeType === 'filter' ? types[Math.floor(Math.random() * types.length)] : null;

        return { items, challengeType, filterType, displayTime: 3000 + difficulty * 500 };
    }

    displaySequenceMemorize() {
        const { items, challengeType, filterType, displayTime } = this.roundData;
        const display = document.getElementById('sequenceDisplay');
        const options = document.getElementById('sequenceOptions');
        const answerArea = document.getElementById('sequenceAnswer');
        display.innerHTML = '';
        options.innerHTML = '';
        answerArea.style.display = 'none';

        let instruction = 'Memorize the sequence!';
        if (challengeType === 'reverse') instruction = 'Memorize the sequence — you\'ll recall it in REVERSE!';
        else if (challengeType === 'filter') {
            const typeLabel = filterType === 'number' ? 'NUMBERS' : filterType === 'symbol' ? 'SYMBOLS' : 'COLORS';
            instruction = `Memorize only the ${typeLabel} in order!`;
        }
        document.getElementById('sequenceInstruction').textContent = instruction;

        // Show items one by one
        const stagger = Math.min(400, (displayTime - 500) / items.length);
        items.forEach((item, idx) => {
            setTimeout(() => {
                const el = document.createElement('div');
                el.className = `sequence-item ${item.type}`;
                el.style.animationDelay = '0s';
                if (item.type === 'color') {
                    el.style.backgroundColor = item.value;
                    el.style.borderColor = item.value;
                } else {
                    el.textContent = item.value;
                }
                display.appendChild(el);
                this.playSound('blip');
            }, idx * stagger);
        });
    }

    displaySequenceRecall() {
        const { items, challengeType, filterType } = this.roundData;
        const display = document.getElementById('sequenceDisplay');
        const options = document.getElementById('sequenceOptions');
        const answerArea = document.getElementById('sequenceAnswer');

        display.innerHTML = ''; // Hide the memorized items
        answerArea.style.display = 'flex';
        document.getElementById('sequenceAnswerItems').innerHTML = '';

        let instruction = 'Click items in the correct order';
        if (challengeType === 'reverse') instruction = 'Click items in REVERSE order';
        else if (challengeType === 'filter') {
            const typeLabel = filterType === 'number' ? 'NUMBERS' : filterType === 'symbol' ? 'SYMBOLS' : 'COLORS';
            instruction = `Click only the ${typeLabel} in order`;
        }
        document.getElementById('sequenceInstruction').textContent = instruction;

        // Build option pool — show unique values from items, shuffled
        const uniqueValues = [];
        const seen = new Set();
        items.forEach(item => {
            const key = `${item.type}:${item.value}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueValues.push(item);
            }
        });

        // Also add a few distractors
        this.addDistractors(uniqueValues, items);

        // Shuffle
        for (let i = uniqueValues.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [uniqueValues[i], uniqueValues[j]] = [uniqueValues[j], uniqueValues[i]];
        }

        uniqueValues.forEach(item => {
            const el = document.createElement('div');
            el.className = `sequence-option ${item.type}`;
            if (item.type === 'color') {
                el.style.backgroundColor = item.value;
                el.style.borderColor = item.value;
            } else {
                el.textContent = item.value;
            }
            el.onclick = () => {
                if (this.phase !== 'recall') return;
                this.sequenceAnswer.push(item.value);
                this.renderSequenceAnswer();
                this.playSound('select');
            };
            options.appendChild(el);
        });
    }

    addDistractors(pool, items) {
        const symbols = ['★', '◆', '●', '■', '▲', '♠', '♣', '♥', '♦'];
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F'];
        const existingKeys = new Set(pool.map(i => `${i.type}:${i.value}`));

        // Add 2-3 distractors
        let added = 0;
        while (added < 3) {
            const types = ['number', 'symbol', 'color'];
            const type = types[Math.floor(Math.random() * types.length)];
            let value;
            if (type === 'number') value = Math.floor(Math.random() * 9) + 1;
            else if (type === 'symbol') value = symbols[Math.floor(Math.random() * symbols.length)];
            else value = colors[Math.floor(Math.random() * colors.length)];

            const key = `${type}:${value}`;
            if (!existingKeys.has(key)) {
                existingKeys.add(key);
                pool.push({ type, value });
                added++;
            }
        }
    }

    renderSequenceAnswer() {
        const container = document.getElementById('sequenceAnswerItems');
        container.innerHTML = '';
        this.sequenceAnswer.forEach((val, idx) => {
            const chip = document.createElement('div');
            chip.className = 'answer-chip';
            chip.textContent = typeof val === 'string' && val.startsWith('#') ? '●' : val;
            if (typeof val === 'string' && val.startsWith('#')) {
                chip.style.color = val;
            }
            chip.onclick = () => {
                if (this.phase !== 'recall') return;
                this.sequenceAnswer.splice(idx, 1);
                this.renderSequenceAnswer();
                this.playSound('click');
            };
            container.appendChild(chip);
        });
    }

    clearSequenceAnswer() {
        this.sequenceAnswer = [];
        this.renderSequenceAnswer();
        this.playSound('click');
    }

    /* =====================
       SPATIAL CHALLENGE
       ===================== */
    generateSpatialData(difficulty) {
        const objectCount = Math.min(4 + difficulty, 12);
        const objects = [];
        const objectTypes = ['circle', 'square', 'triangle', 'star', 'diamond'];
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F'];

        for (let i = 0; i < objectCount; i++) {
            objects.push({
                id: i,
                type: objectTypes[Math.floor(Math.random() * objectTypes.length)],
                color: colors[Math.floor(Math.random() * colors.length)],
                x: Math.random() * 80 + 10,
                y: Math.random() * 80 + 10
            });
        }
        return { objects, displayTime: 3000 + difficulty * 500 };
    }

    getShapeSymbol(type) {
        const map = { circle: '●', square: '■', triangle: '▲', star: '★', diamond: '◆' };
        return map[type] || '●';
    }

    displaySpatialMemorize() {
        const { objects } = this.roundData;
        const area = document.getElementById('spatialArea');
        area.innerHTML = '';
        document.getElementById('spatialInstruction').textContent =
            `Memorize the positions of ${objects.length} objects!`;

        objects.forEach((obj, idx) => {
            const el = document.createElement('div');
            el.className = 'spatial-object preview';
            el.style.left = `calc(${obj.x}% - 20px)`;
            el.style.top = `calc(${obj.y}% - 20px)`;
            el.style.color = obj.color;
            el.style.animationDelay = `${idx * 0.1}s`;
            el.textContent = this.getShapeSymbol(obj.type);
            el.dataset.id = obj.id;
            area.appendChild(el);
        });
    }

    displaySpatialRecall() {
        const { objects } = this.roundData;
        const area = document.getElementById('spatialArea');
        area.innerHTML = '';
        document.getElementById('spatialInstruction').textContent =
            `Drag each object to its remembered position!`;

        // Randomize positions
        this.spatialPositions = objects.map(obj => ({
            id: obj.id,
            x: Math.random() * 80 + 10,
            y: Math.random() * 80 + 10
        }));

        this.spatialPositions.forEach((pos, idx) => {
            const obj = objects.find(o => o.id === pos.id);
            const el = document.createElement('div');
            el.className = 'spatial-object';
            el.style.left = `calc(${pos.x}% - 20px)`;
            el.style.top = `calc(${pos.y}% - 20px)`;
            el.style.color = obj.color;
            el.textContent = this.getShapeSymbol(obj.type);
            el.dataset.id = obj.id;

            // Drag handling (pointer events for touch + mouse)
            el.addEventListener('pointerdown', (e) => this.spatialDragStart(e, el));
            area.appendChild(el);
        });

        // Global move/up
        document.addEventListener('pointermove', this._boundSpatialDragMove = (e) => this.spatialDragMove(e));
        document.addEventListener('pointerup', this._boundSpatialDragEnd = () => this.spatialDragEnd());
    }

    spatialDragStart(e, el) {
        if (this.phase !== 'recall') return;
        e.preventDefault();
        this._dragTarget = el;
        const area = document.getElementById('spatialArea');
        const rect = area.getBoundingClientRect();
        this._dragOffsetX = e.clientX - el.offsetLeft - rect.left;
        this._dragOffsetY = e.clientY - el.offsetTop - rect.top;
        el.style.zIndex = '10';
        el.style.transition = 'none';
    }

    spatialDragMove(e) {
        if (!this._dragTarget) return;
        e.preventDefault();
        const area = document.getElementById('spatialArea');
        const rect = area.getBoundingClientRect();
        let x = e.clientX - rect.left - this._dragOffsetX;
        let y = e.clientY - rect.top - this._dragOffsetY;

        // Clamp
        x = Math.max(0, Math.min(rect.width - 40, x));
        y = Math.max(0, Math.min(rect.height - 40, y));

        this._dragTarget.style.left = x + 'px';
        this._dragTarget.style.top = y + 'px';
    }

    spatialDragEnd() {
        if (!this._dragTarget) return;
        const area = document.getElementById('spatialArea');
        const rect = area.getBoundingClientRect();
        const el = this._dragTarget;
        const id = parseInt(el.dataset.id);

        // Update stored position as percentage
        const xPct = (el.offsetLeft + 20) / rect.width * 100;
        const yPct = (el.offsetTop + 20) / rect.height * 100;

        const posEntry = this.spatialPositions.find(p => p.id === id);
        if (posEntry) {
            posEntry.x = xPct;
            posEntry.y = yPct;
        }

        el.style.zIndex = '2';
        el.style.transition = 'transform 0.15s ease, box-shadow 0.2s ease';
        this._dragTarget = null;
        this.playSound('click');
    }

    resetSpatialPositions() {
        const { objects } = this.roundData;
        this.spatialPositions = objects.map(obj => ({
            id: obj.id,
            x: Math.random() * 80 + 10,
            y: Math.random() * 80 + 10
        }));

        const area = document.getElementById('spatialArea');
        this.spatialPositions.forEach(pos => {
            const el = area.querySelector(`[data-id="${pos.id}"]`);
            if (el) {
                el.style.left = `calc(${pos.x}% - 20px)`;
                el.style.top = `calc(${pos.y}% - 20px)`;
            }
        });
        this.playSound('click');
    }

    /* =====================
       ROUND DATA GENERATION
       ===================== */
    generateRoundData(type, difficulty) {
        switch (type) {
            case 'pattern': return this.generatePatternData(difficulty);
            case 'sequence': return this.generateSequenceData(difficulty);
            case 'spatial': return this.generateSpatialData(difficulty);
            default: return null;
        }
    }

    /* =====================
       SUBMIT + SCORING
       ===================== */
    submitAnswer() {
        if (this.phase === 'submitted' || this.phase === 'memorize') return;
        this.phase = 'submitted';
        this.stopTimer();

        const responseTime = Date.now() - this.startTime;
        let answer;

        switch (this.roundType) {
            case 'pattern': answer = this.patternAnswer; break;
            case 'sequence': answer = this.sequenceAnswer; break;
            case 'spatial': answer = this.spatialPositions; break;
        }

        // Clean up spatial event listeners
        if (this.roundType === 'spatial') {
            document.removeEventListener('pointermove', this._boundSpatialDragMove);
            document.removeEventListener('pointerup', this._boundSpatialDragEnd);
        }

        const accuracy = this.checkAccuracy(answer);
        const speedBonus = Math.max(0, 100 - (responseTime / 100));
        const score = Math.round(Math.max(0, Math.min(100, (accuracy * 70) + (speedBonus * 0.3))));

        // Update stats
        this.totalScore += score;
        this.roundScores.push(score);
        this.roundTypes.push(this.roundType);
        this.roundSpeeds.push(responseTime);

        if (score > 50) {
            this.streak++;
            if (this.streak > this.maxStreak) this.maxStreak = this.streak;
        } else {
            this.streak = 0;
        }

        this.playSound(score > 50 ? 'correct' : 'wrong');
        this.showRoundResult(score, accuracy, responseTime);
    }

    /* =====================
       ACCURACY CHECKING
       ===================== */
    checkAccuracy(answer) {
        if (!answer || !this.roundData) return 0;
        switch (this.roundType) {
            case 'pattern': return this.checkPatternAccuracy(answer);
            case 'sequence': return this.checkSequenceAccuracy(answer);
            case 'spatial': return this.checkSpatialAccuracy(answer);
            default: return 0;
        }
    }

    checkPatternAccuracy(answer) {
        if (!Array.isArray(answer)) return 0;
        const correct = this.roundData.sequence;
        let matches = 0;
        const minLen = Math.min(answer.length, correct.length);
        for (let i = 0; i < minLen; i++) {
            if (answer[i]?.x === correct[i]?.x && answer[i]?.y === correct[i]?.y) {
                matches++;
            }
        }
        return correct.length === 0 ? 0 : matches / correct.length;
    }

    checkSequenceAccuracy(answer) {
        if (!Array.isArray(answer)) return 0;
        let expected = this.roundData.items.map(i => i.value);

        if (this.roundData.challengeType === 'reverse') {
            expected = expected.reverse();
        } else if (this.roundData.challengeType === 'filter') {
            expected = this.roundData.items
                .filter(i => i.type === this.roundData.filterType)
                .map(i => i.value);
        }

        let matches = 0;
        const minLen = Math.min(answer.length, expected.length);
        for (let i = 0; i < minLen; i++) {
            if (answer[i] === expected[i]) matches++;
        }
        return expected.length === 0 ? 0 : matches / expected.length;
    }

    checkSpatialAccuracy(answer) {
        if (!Array.isArray(answer)) return 0;
        const correct = this.roundData.objects;
        let totalError = 0;
        let matches = 0;

        answer.forEach(ans => {
            const obj = correct.find(o => o.id === ans.id);
            if (obj) {
                const dist = Math.sqrt(
                    Math.pow(ans.x - obj.x, 2) + Math.pow(ans.y - obj.y, 2)
                );
                if (dist < 15) {
                    matches++;
                    totalError += dist / 15;
                }
            }
        });

        if (matches === 0) return 0;
        return (matches / correct.length) * (1 - totalError / matches);
    }

    /* =====================
       ROUND RESULT
       ===================== */
    showRoundResult(score, accuracy, responseTime) {
        this.showScreen('resultScreen');
        document.getElementById('resultRound').textContent = `Round ${this.currentRound}`;
        document.getElementById('roundScoreValue').textContent = score;
        document.getElementById('resultAccuracy').textContent = Math.round(accuracy * 100) + '%';
        document.getElementById('resultSpeed').textContent = (responseTime / 1000).toFixed(1) + 's';
        document.getElementById('resultStreak').textContent = this.streak;
        document.getElementById('resultTotal').textContent = this.totalScore;

        // Animate score ring
        const circumference = 2 * Math.PI * 54;
        const fill = document.getElementById('scoreRingFill');
        fill.style.strokeDashoffset = circumference.toString(); // reset
        requestAnimationFrame(() => {
            fill.style.strokeDashoffset = (circumference * (1 - score / 100)).toString();
        });

        // Result message
        const msg = document.getElementById('resultMessage');
        if (score >= 90) { msg.textContent = '🔥 INCREDIBLE!'; msg.style.color = 'var(--neon-green)'; }
        else if (score >= 70) { msg.textContent = '⚡ Great work!'; msg.style.color = 'var(--neon-blue)'; }
        else if (score >= 50) { msg.textContent = '👍 Not bad!'; msg.style.color = 'var(--neon-yellow)'; }
        else if (score >= 25) { msg.textContent = '💪 Keep trying!'; msg.style.color = 'var(--neon-orange)'; }
        else { msg.textContent = '😬 Better luck next round'; msg.style.color = 'var(--neon-pink)'; }

        // Auto-advance to next round
        setTimeout(() => this.nextRound(), 3500);
    }

    /* =====================
       GAME OVER
       ===================== */
    async showGameOver() {
        this.showScreen('gameOverScreen');
        this.playSound('victory');
        this.spawnConfetti();

        document.getElementById('gameoverPlayer').textContent = this.username;
        document.getElementById('finalScore').textContent = this.totalScore;

        // Calculate stats
        const totalAccuracy = this.roundScores.filter(s => s > 50).length / this.roundScores.length * 100;
        const avgSpeed = this.roundSpeeds.reduce((a, b) => a + b, 0) / this.roundSpeeds.length / 1000;

        document.getElementById('finalAccuracy').textContent = Math.round(totalAccuracy) + '%';
        document.getElementById('finalAvgSpeed').textContent = avgSpeed.toFixed(1) + 's';
        document.getElementById('finalMaxStreak').textContent = this.maxStreak;
        document.getElementById('finalRounds').textContent = TOTAL_ROUNDS;

        // Submit score to backend
        console.log('Game Over - Checking save conditions:', {
            hasToken: !!this.token,
            hasSessionId: !!this.sessionId,
            sessionId: this.sessionId,
            roundsPlayed: this.roundScores.length,
            totalScore: this.totalScore
        });
        
        if (!this.token) {
            console.error('❌ Cannot save: No auth token');
        } else if (!this.sessionId) {
            console.error('❌ Cannot save: No session ID');
        } else {
            console.log('✅ Conditions met, calling submitScore()');
            await this.submitScore();
        }

        // Round breakdown
        const list = document.getElementById('breakdownList');
        list.innerHTML = '';
        this.roundScores.forEach((score, idx) => {
            const row = document.createElement('div');
            row.className = 'breakdown-row';
            const typeLabel = { pattern: 'PATTERN', sequence: 'SEQUENCE', spatial: 'SPATIAL' };
            row.innerHTML = `
                <span class="breakdown-round">R${idx + 1}</span>
                <span class="breakdown-type">${typeLabel[this.roundTypes[idx]]}</span>
                <div class="breakdown-bar">
                    <div class="breakdown-bar-fill" style="width: 0%"></div>
                </div>
                <span class="breakdown-score">${score}</span>
            `;
            list.appendChild(row);

            // Animate bar
            setTimeout(() => {
                row.querySelector('.breakdown-bar-fill').style.width = score + '%';
            }, 100 + idx * 120);
        });
        
        // If in auto-play mode, continue to next game type after 5 seconds
        if (this.autoPlayMode) {
            setTimeout(() => {
                this.selectNextGameType();
            }, 5000);
        }
    }
    
    async submitScore(silent = false) {
        try {
            console.log(`📤 Submitting game with ${this.roundScores.length} rounds across types:`, this.roundTypes);
            
            // Group rounds by game type
            const gameTypes = ['pattern', 'sequence', 'spatial'];
            const submissions = [];
            
            for (const gameType of gameTypes) {
                // Filter rounds for this game type
                const typeIndices = this.roundTypes
                    .map((type, index) => type === gameType ? index : -1)
                    .filter(index => index !== -1);
                
                if (typeIndices.length === 0) continue; // Skip if no rounds of this type
                
                const roundScores = typeIndices.map((index) => ({
                    roundNumber: index + 1,
                    score: this.roundScores[index],
                    timeSpent: this.roundSpeeds[index] || 0,
                    correct: this.roundScores[index] > 50,
                    timestamp: this.roundStartTimes[index] || new Date()
                }));
                
                const typeScore = typeIndices.reduce((sum, index) => sum + this.roundScores[index], 0);
                
                console.log(`  ${gameType}: ${roundScores.length} rounds, score=${typeScore}`);
                
                // Generate unique session ID for this game type
                const uniqueSessionId = `${gameType}_${this.sessionId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                
                submissions.push({
                    sessionId: uniqueSessionId,
                    gameType: gameType,
                    score: typeScore,
                    roundData: {
                        rounds: roundScores.length,
                        maxStreak: this.maxStreak,
                        roundScores: roundScores
                    }
                });
            }
            
            console.log(`📤 Submitting ${submissions.length} separate game sessions...`);
            
            // Submit all game types
            const results = [];
            for (const submission of submissions) {
                const res = await fetch(`${API_BASE}/api/game/submit`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.token}`
                    },
                    body: JSON.stringify(submission)
                });
                
                if (res.ok) {
                    const data = await res.json();
                    results.push({ ...data, gameType: submission.gameType });
                    console.log(`✅ ${submission.gameType} saved: ${data.score} points, ELO ${data.oldElo}→${data.newElo} (${data.eloChange >= 0 ? '+' : ''}${data.eloChange})`);
                } else {
                    const errorText = await res.text();
                    console.error(`❌ ${submission.gameType} failed:`, res.status, errorText);
                }
            }
            
            // Refresh stats after all submissions
            await this.fetchUserStats();
            this.renderCharts();
            
            if (!silent && results.length > 0) {
                // Show combined results
                this.showCombinedResults(results);
            } else {
                console.log('Progress saved:', results);
            }
            
        } catch (error) {
            console.error('Submit score error:', error);
        }
    }
    
    showCombinedResults(results) {
        const overlay = document.createElement('div');
        overlay.className = 'score-results-overlay';
        
        const totalScore = results.reduce((sum, r) => sum + r.score, 0);
        const totalEloChange = results.reduce((sum, r) => sum + r.eloChange, 0);
        const eloChangeText = totalEloChange >= 0 ? `+${totalEloChange}` : `${totalEloChange}`;
        const eloClass = totalEloChange >= 0 ? 'positive' : 'negative';
        
        const resultsHtml = results.map(r => `
            <div class="result-item">
                <div class="result-label">${r.gameType.toUpperCase()}</div>
                <div class="result-value">${r.score} pts</div>
                <div class="result-stat-value ${r.eloChange >= 0 ? 'positive' : 'negative'}">
                    ELO ${r.eloChange >= 0 ? '+' : ''}${r.eloChange}
                </div>
            </div>
        `).join('');
        
        overlay.innerHTML = `
            <div class="score-results-card">
                <div class="results-title">GAME RESULTS</div>
                <div class="results-grid">
                    <div class="result-item">
                        <div class="result-label">Total Score</div>
                        <div class="result-value">${totalScore}</div>
                    </div>
                    <div class="result-item ${eloClass}">
                        <div class="result-label">Total ELO Change</div>
                        <div class="result-value">${eloChangeText}</div>
                    </div>
                </div>
                <div class="results-stats">
                    ${resultsHtml}
                </div>
                <button class="btn-close" onclick="this.parentElement.parentElement.remove()">CONTINUE</button>
            </div>
        `;
        
        document.body.appendChild(overlay);
        setTimeout(() => overlay.classList.add('show'), 10);
    }
    
    showScoreResults(data) {
        const overlay = document.createElement('div');
        overlay.className = 'score-results-overlay';
        
        const eloChange = data.eloChange;
        const eloChangeText = eloChange >= 0 ? `+${eloChange}` : `${eloChange}`;
        const eloClass = eloChange >= 0 ? 'positive' : 'negative';
        
        overlay.innerHTML = `
            <div class="score-results-card">
                <div class="results-title">GAME RESULTS</div>
                <div class="results-grid">
                    <div class="result-item">
                        <div class="result-label">Your Score</div>
                        <div class="result-value">${data.score}</div>
                    </div>
                    <div class="result-item">
                        <div class="result-label">Predicted</div>
                        <div class="result-value">${Math.round(this.predictedScore)}</div>
                    </div>
                    <div class="result-item ${eloClass}">
                        <div class="result-label">ELO Change</div>
                        <div class="result-value">${eloChangeText}</div>
                    </div>
                    <div class="result-item">
                        <div class="result-label">New ELO</div>
                        <div class="result-value">${data.newElo}</div>
                    </div>
                </div>
                <div class="results-stats">
                    <div class="stat-mini">Games Played: ${data.stats.gamesPlayed}</div>
                    <div class="stat-mini">Avg Last 10: ${data.stats.avgLast10}</div>
                    <div class="stat-mini">Trend: ${data.stats.recentTrend.toUpperCase()}</div>
                </div>
                <button class="btn-close" onclick="this.parentElement.parentElement.remove()">CLOSE</button>
            </div>
        `;
        
        document.body.appendChild(overlay);
        setTimeout(() => overlay.classList.add('show'), 100);
    }

    async restart() {
        await this.showMainMenu();
        // Clean up confetti
        document.querySelectorAll('.confetti-piece').forEach(c => c.remove());
    }

    /* =====================
       STREAK UI
       ===================== */
    updateStreak() {
        const el = document.getElementById('streakDisplay');
        document.getElementById('streakCount').textContent = this.streak;
        el.classList.toggle('visible', this.streak > 0);
    }

    /* =====================
       CONFETTI
       ===================== */
    spawnConfetti() {
        const colors = ['#00f3ff', '#ff006e', '#a855f7', '#00ff88', '#f7dc6f', '#ff8c42'];
        for (let i = 0; i < 80; i++) {
            const piece = document.createElement('div');
            piece.className = 'confetti-piece';
            piece.style.left = Math.random() * 100 + 'vw';
            piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            piece.style.width = (Math.random() * 8 + 4) + 'px';
            piece.style.height = (Math.random() * 8 + 4) + 'px';
            piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
            piece.style.animationDuration = (Math.random() * 2 + 2) + 's';
            piece.style.animationDelay = (Math.random() * 1.5) + 's';
            document.body.appendChild(piece);
        }
        setTimeout(() => {
            document.querySelectorAll('.confetti-piece').forEach(c => c.remove());
        }, 6000);
    }

    /* =====================
       PARTICLES BACKGROUND
       ===================== */
    initParticles() {
        const canvas = document.getElementById('particleCanvas');
        const ctx = canvas.getContext('2d');
        let particles = [];

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener('resize', resize);

        for (let i = 0; i < 60; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.4,
                vy: (Math.random() - 0.5) * 0.4,
                r: Math.random() * 2 + 0.5,
                alpha: Math.random() * 0.4 + 0.1
            });
        }

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < 0) p.x = canvas.width;
                if (p.x > canvas.width) p.x = 0;
                if (p.y < 0) p.y = canvas.height;
                if (p.y > canvas.height) p.y = 0;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(0, 243, 255, ${p.alpha})`;
                ctx.fill();
            });

            // Draw lines between close particles
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 120) {
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.strokeStyle = `rgba(0, 243, 255, ${0.06 * (1 - dist / 120)})`;
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                }
            }

            requestAnimationFrame(draw);
        };
        draw();
    }

    /* =====================
       AUDIO (Web Audio API)
       ===================== */
    initAudio() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    playSound(type) {
        if (!this.audioCtx) return;
        try {
            const ctx = this.audioCtx;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            const now = ctx.currentTime;

            switch (type) {
                case 'countdown':
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(440, now);
                    gain.gain.setValueAtTime(0.15, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                    osc.start(now);
                    osc.stop(now + 0.3);
                    break;
                case 'start':
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(523, now);
                    osc.frequency.setValueAtTime(659, now + 0.1);
                    osc.frequency.setValueAtTime(784, now + 0.2);
                    gain.gain.setValueAtTime(0.2, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
                    osc.start(now);
                    osc.stop(now + 0.5);
                    break;
                case 'blip':
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(800 + Math.random() * 400, now);
                    gain.gain.setValueAtTime(0.08, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                    osc.start(now);
                    osc.stop(now + 0.1);
                    break;
                case 'select':
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(600, now);
                    osc.frequency.exponentialRampToValueAtTime(900, now + 0.08);
                    gain.gain.setValueAtTime(0.12, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                    osc.start(now);
                    osc.stop(now + 0.15);
                    break;
                case 'click':
                    osc.type = 'square';
                    osc.frequency.setValueAtTime(300, now);
                    gain.gain.setValueAtTime(0.05, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
                    osc.start(now);
                    osc.stop(now + 0.05);
                    break;
                case 'phase':
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(200, now);
                    osc.frequency.exponentialRampToValueAtTime(600, now + 0.2);
                    gain.gain.setValueAtTime(0.1, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                    osc.start(now);
                    osc.stop(now + 0.3);
                    break;
                case 'correct':
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(523, now);
                    osc.frequency.setValueAtTime(659, now + 0.12);
                    osc.frequency.setValueAtTime(784, now + 0.24);
                    gain.gain.setValueAtTime(0.15, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
                    osc.start(now);
                    osc.stop(now + 0.5);
                    break;
                case 'wrong':
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(200, now);
                    osc.frequency.exponentialRampToValueAtTime(100, now + 0.3);
                    gain.gain.setValueAtTime(0.1, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
                    osc.start(now);
                    osc.stop(now + 0.4);
                    break;
                case 'victory':
                    osc.type = 'sine';
                    const notes = [523, 587, 659, 784, 880, 1047];
                    notes.forEach((freq, i) => {
                        osc.frequency.setValueAtTime(freq, now + i * 0.12);
                    });
                    gain.gain.setValueAtTime(0.15, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 1);
                    osc.start(now);
                    osc.stop(now + 1);
                    break;
            }
        } catch (e) {
            // Audio not available
        }
    }

    /* =====================
       LEARNING MODE
       ===================== */
    showLearnInput() {
        this.showScreen('learnInputScreen');
        document.getElementById('topicInput').value = '';
        document.getElementById('topicInput').focus();
    }

    setTopic(topic) {
        document.getElementById('topicInput').value = topic;
    }

    async submitTopic() {
        const input = document.getElementById('topicInput');
        const topic = input.value.trim();
        if (!topic) {
            input.style.borderColor = 'var(--neon-pink)';
            setTimeout(() => { input.style.borderColor = ''; }, 1000);
            return;
        }

        // Show loading screen
        this.showScreen('learnLoadingScreen');
        document.getElementById('loadingTopic').textContent = `"${topic}"`;

        // Reset loading steps
        const steps = ['loadStep1', 'loadStep2', 'loadStep3'];
        steps.forEach(id => {
            const el = document.getElementById(id);
            el.classList.remove('active', 'done');
        });
        document.getElementById('loadStep1').classList.add('active');

        // Animate steps with timers
        const stepTimers = [];
        stepTimers.push(setTimeout(() => {
            document.getElementById('loadStep1').classList.remove('active');
            document.getElementById('loadStep1').classList.add('done');
            document.getElementById('loadStep2').classList.add('active');
        }, 2000));

        stepTimers.push(setTimeout(() => {
            document.getElementById('loadStep2').classList.remove('active');
            document.getElementById('loadStep2').classList.add('done');
            document.getElementById('loadStep3').classList.add('active');
        }, 5000));

        try {
            const response = await fetch('/api/learn', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic })
            });

            const data = await response.json();

            // Clear timers
            stepTimers.forEach(t => clearTimeout(t));

            // Mark all steps done
            steps.forEach(id => {
                const el = document.getElementById(id);
                el.classList.remove('active');
                el.classList.add('done');
            });

            // Small delay for visual effect
            await new Promise(r => setTimeout(r, 500));

            if (data.error) {
                // Show detailed error message
                const errorMsg = data.error.includes('quota') 
                    ? `⚠️ API Quota Exceeded\n\nThe free tier limit (20 requests) has been reached.\n\nPlease try again later or contact the administrator to upgrade the API key.`
                    : data.error.includes('rate limit')
                    ? `⏱️ Rate Limit\n\nToo many requests. Please wait a moment and try again.`
                    : `❌ Error\n\n${data.error}`;
                
                alert(errorMsg);
                this.showLearnInput();
                return;
            }

            if (!data.needs3d) {
                this.showNoVisualization(data.reason, data.title);
            } else {
                this.showVisualization(data.url, data.title);
            }

        } catch (err) {
            console.error('Learning mode error:', err);
            stepTimers.forEach(t => clearTimeout(t));
            alert('❌ Network Error\n\nFailed to connect to the server. Please check your connection and try again.');
            this.showLearnInput();
        }
    }

    showVisualization(url, title) {
        this.showScreen('learnVisScreen');
        document.getElementById('visTitle').textContent = title.toUpperCase();
        const iframe = document.getElementById('visIframe');
        iframe.src = url;
    }

    showNoVisualization(reason, title) {
        this.showScreen('learnNo3dScreen');
        document.getElementById('no3dReason').textContent = reason;
    }

    backToLearnInput() {
        // Clear iframe to stop any running animations
        document.getElementById('visIframe').src = 'about:blank';
        this.showLearnInput();
    }

    toggleFullscreen() {
        const wrapper = document.getElementById('visIframeWrapper');
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            wrapper.requestFullscreen().catch(() => { });
        }
    }
}

// Initialize game
const game = new MemoryGame();

// Add Enter key listeners for login/register forms
document.addEventListener('DOMContentLoaded', () => {
    const loginUsername = document.getElementById('loginUsername');
    const loginPassword = document.getElementById('loginPassword');
    const registerUsername = document.getElementById('registerUsername');
    const registerEmail = document.getElementById('registerEmail');
    const registerPassword = document.getElementById('registerPassword');
    
    if (loginUsername) {
        loginUsername.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') game.login();
        });
    }
    
    if (loginPassword) {
        loginPassword.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') game.login();
        });
    }
    
    if (registerPassword) {
        registerPassword.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') game.register();
        });
    }
    
    // Topic input for learn mode
    const topicInput = document.getElementById('topicInput');
    if (topicInput) {
        topicInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') game.submitTopic();
        });
    }
});
