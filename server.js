const express = require('express');
const path = require('path');
const https = require('https');
const fs = require('fs');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cors()); // Enable CORS for frontend

// Database connection (lazy load)
const { connectDB } = require('./lib/db');

// Import routes
const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/game');
const leaderboardRoutes = require('./routes/leaderboard');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Ensure generated directory exists
// Vercel/serverless filesystems are read-only except /tmp
function resolveGeneratedDir() {
    const candidates = [
        path.join(__dirname, 'public', 'generated'),
        path.join('/tmp', 'generated')
    ];

    for (const dir of candidates) {
        try {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            return dir;
        } catch (err) {
            console.warn(`Generated dir unavailable: ${dir} (${err.code || err.message})`);
        }
    }

    throw new Error('No writable directory available for generated content');
}

const generatedDir = resolveGeneratedDir();
app.use('/generated', express.static(generatedDir));

// ============================================
// Gemini API Configuration
// ============================================
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_ENABLED = Boolean(GEMINI_API_KEY && GEMINI_API_KEY !== 'placeholder_key');
if (!GEMINI_ENABLED) {
    console.warn('Warning: GEMINI_API_KEY is not set. Running in DEV mode — learning API will return sample content. Set GEMINI_API_KEY to enable real generation.');
}
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = GEMINI_ENABLED ? `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}` : null;

function callGemini(prompt) {
    return new Promise((resolve, reject) => {
        if (!GEMINI_ENABLED) {
            return reject(new Error('Gemini API key not configured'));
        }
        const body = JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 16384
            }
        });

        const url = new URL(GEMINI_URL);
        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                console.log('Gemini API Response Status:', res.statusCode);
                console.log('Gemini API Response:', data.substring(0, 500));
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.error) {
                        console.error('Gemini API Error Details:', JSON.stringify(parsed.error, null, 2));
                        reject(new Error(parsed.error.message || 'Gemini API error'));
                        return;
                    }
                    let text = '';
                    if (parsed.candidates && parsed.candidates[0] && parsed.candidates[0].content && parsed.candidates[0].content.parts && parsed.candidates[0].content.parts[0]) {
                        text = parsed.candidates[0].content.parts[0].text;
                    }
                    resolve(text);
                } catch (e) {
                    console.error('Parse error:', e.message, 'Raw data:', data);
                    reject(new Error('Failed to parse Gemini response'));
                }
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

// ============================================
// Learning Mode API
// ============================================
app.post('/api/learn', async (req, res) => {
    const { topic } = req.body;
    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
        return res.status(400).json({ error: 'Topic is required' });
    }

    const cleanTopic = topic.trim();
    console.log(`\n🧠 Learning request: "${cleanTopic}"`);

    try {
        if (!GEMINI_ENABLED) {
            // DEV fallback: return a sample generated page if available
            const sampleFiles = fs.readdirSync(generatedDir).filter(f => f.endsWith('.html'));
            const sampleUrl = sampleFiles.length > 0 ? `/generated/${sampleFiles[0]}` : null;
            return res.json({
                needs3d: false,
                reason: 'Running in DEV mode — Gemini API disabled. This is a static sample response.',
                title: cleanTopic,
                url: sampleUrl
            });
        }
        // ---- Step 1: Determine if 3D visualization is needed ----
        console.log('  Step 1: Classifying topic...');
        const classifyPrompt = `You are an expert educator. Given the topic: "${cleanTopic}", determine if it would benefit from a 3D interactive visualization for learning.

Topics that benefit from 3D: physics concepts, chemistry (molecules, reactions), biology (cells, DNA, anatomy), geometry/math shapes, astronomy (solar system, orbits), engineering (mechanisms, structures), geography (terrain, tectonic plates), architecture, fluid dynamics, waves, optics, crystallography, robotics, etc.

Topics that do NOT benefit from 3D: history dates/events, literature analysis, language grammar rules, pure mathematics proofs, philosophy, law, politics, economics theory, etc.

Respond with ONLY valid JSON, no markdown fences:
{"needs3d": true or false, "reason": "one line explanation", "title": "short title for the visualization"}`;

        const classifyResult = await callGemini(classifyPrompt);
        console.log('  Classification result:', classifyResult.substring(0, 200));

        let classification;
        try {
            // Extract JSON from response (handle potential markdown fences)
            let jsonStr = classifyResult.trim();
            if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
            }
            classification = JSON.parse(jsonStr);
        } catch (e) {
            console.error('  Failed to parse classification:', e.message);
            return res.json({
                needs3d: false,
                reason: 'Could not analyze the topic. Please try rephrasing.',
                title: cleanTopic
            });
        }

        if (!classification.needs3d) {
            console.log('  ❌ Topic does not need 3D visualization');
            return res.json({
                needs3d: false,
                reason: classification.reason || 'This topic is better learned through text and diagrams.',
                title: classification.title || cleanTopic
            });
        }

        // ---- Step 2: Generate the 3D visualization ----
        console.log('  Step 2: Generating 3D visualization...');
        const generatePrompt = `You are an expert Three.js developer and educator. Generate a COMPLETE, STANDALONE HTML page that creates an interactive 3D visualization to teach: "${cleanTopic}"

CRITICAL REQUIREMENTS:
1. Use Three.js via CDN: <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
2. Include OrbitControls inline (copy the essential OrbitControls code or implement basic orbit camera with mouse events)
3. Create relevant 3D objects with proper geometry, materials, and colors
4. Add TEXT LABELS using HTML overlay divs (not 3D text) to label important parts
5. Add SMOOTH ANIMATIONS that demonstrate the concept (rotation, movement, pulsing, etc.)
6. Include an INFO PANEL (HTML overlay, top-left, max-width 320px) with:
   - Title of the visualization
   - Brief explanation (2-3 sentences)
   - Instructions: "Drag to rotate • Scroll to zoom • Click objects for info"
7. Make objects CLICKABLE — when clicked, show a tooltip with info about that part
8. Use a dark background (#0a0a1a) with subtle grid or stars
9. Style everything with a futuristic neon theme (cyan #00f3ff, purple #a855f7, pink #ff006e, green #00ff88)
10. Make it RESPONSIVE (fill the full viewport)
11. Add ambient light + directional light for good visibility
12. The page must work completely standalone — no external dependencies other than Three.js CDN

IMPORTANT FOR ORBIT CONTROLS:
Since OrbitControls is not in the core Three.js CDN, implement mouse-based camera rotation manually:
- Track mousedown/mousemove/mouseup for rotation
- Track wheel event for zoom
- This is simpler and avoids CDN issues

RESPOND WITH ONLY THE COMPLETE HTML CODE. No markdown fences, no explanation before or after. Start with <!DOCTYPE html> and end with </html>.`;

        const htmlResult = await callGemini(generatePrompt);
        console.log(`  Generated ${htmlResult.length} chars of HTML`);

        // Clean the response
        let html = htmlResult.trim();
        if (html.startsWith('```')) {
            html = html.replace(/```html?\n?/g, '').replace(/```$/g, '').trim();
        }

        // Validate it looks like HTML
        if (!html.includes('<!DOCTYPE') && !html.includes('<html')) {
            console.error('  ⚠ Generated content does not look like HTML');
            return res.status(500).json({ error: 'Failed to generate visualization. Please try again.' });
        }

        // Save to file
        const fileId = `learn_${Date.now()}`;
        const filePath = path.join(generatedDir, `${fileId}.html`);
        fs.writeFileSync(filePath, html, 'utf8');
        console.log(`  ✅ Saved to /generated/${fileId}.html`);

        return res.json({
            needs3d: true,
            url: `/generated/${fileId}.html`,
            title: classification.title || cleanTopic,
            reason: classification.reason || ''
        });

    } catch (error) {
        console.error('  ❗ Error in learning pipeline:', error.message);
        
        const errorMsg = (error.message || '').toLowerCase();
        
        // Check for quota exceeded error
        if (errorMsg.includes('quota') || errorMsg.includes('exceeded')) {
            return res.status(429).json({ 
                error: 'API quota exceeded. The free tier limit has been reached. Please try again later or upgrade your API key.' 
            });
        }
        
        // Check for rate limit error
        if (errorMsg.includes('rate limit')) {
            return res.status(429).json({ 
                error: 'Rate limit exceeded. Please wait a moment and try again.' 
            });
        }
        
        return res.status(500).json({ error: 'An error occurred while generating the visualization. Please try again later.' });
    }
});

// ============================================
// Start Server
// ============================================
const PORT = process.env.PORT || 3000;
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`🎮 Memory Battle Royale — Single Player + Learning Mode`);
        console.log(`🌐 Open http://localhost:${PORT} to play`);
    });
}

module.exports = app;
