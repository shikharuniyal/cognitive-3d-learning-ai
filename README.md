# Cognitive 3D Learning AI ???

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-green.svg)

Cognitive 3D Learning AI is an interactive multiplayer cognitive framework that blends real-time AI performance prediction, Elo-rated matchmaking, and immersive 3D visualizations to optimize human learning. Developed with Node.js, socket.io, MongoDB, and WebGL, this project dynamically adjusts cognitive challenges based on a user's developmental trajectory.

## ?? Visualizing Learning in 3D

The platform features dynamically generated interactive 3D modules that simplify complex concepts into exploratory mini-worlds.

| DNA Double Helix Structure | Möbius Strip Edge Explorer |
| :---: | :---: |
| ![DNA Double Helix](docs/images/test_image_1.jpg) | ![Möbius Strip](docs/images/test_image_2.jpg) |
| *Exploration of molecular structures and base complementary pairs.* | *Interactive topological visualization proving single-edge continuous surfaces.* |

*(Note: Ensure you add your screenshot images as 	est_image_1.jpg and 	est_image_2.jpg within a docs/images/ directory before pushing.)*

## ?? How It Works: The Pipeline

### 1. The Database Integration (MongoDB)
- **State Management:** User progress, cognitive metrics, and gameplay history are ingested continuously into **MongoDB** using Mongoose ORMs.
- **Data Vectoring:** Stores normalized sessionVectors per user, representing a chronological timeframe of learning outcomes, scores, and categorical proficiencies.
- **Scalable Document Models:** Distinguishes models into User, PlayerStats, ArenaRoom, and GameSession ensuring ACID-compliant tracking of complex multiplayer states.

### 2. The AI Pipeline & Machine Learning
- **Dynamic Performance Prediction:** The core AI engine applies custom algorithms using **Time-Weighted Exponential Moving Averages (EWMA)** and **Linear Regression** on time-series feature vectors (lib/prediction.js).
- **Variance & Trend Analysis:** Extracts behavioral features (trend improvement/decline, score variance) from the user's historical sliding window (last $ games) to regress their next optimal cognitive challenge tier.
- **Matchmaking Engine:** Applies a custom **Elo Rating System** (lib/elo.js) to pair learners of similar predicted trajectories to cultivate competitive, healthy cognitive evolution in real-time.

### 3. Solution Provided
- **Adaptive Difficulty:** Prevents cognitive burnout or boredom by matching the difficulty of the 3D learning modules directly with the calculated user capability.
- **Interactive Reinforcement:** Converts static textbook knowledge (e.g., DNA, Topology) into exploratory, visually arresting 3D JavaScript canvases (Three.js/WebGL engines).
- **Gamified Engagement:** Promotes retention by injecting real-time competitive elements (Socket.io) mapped directly to intellectual growth.

## ??? Tech Stack
- **Backend:** Node.js, Express, Socket.io
- **AI / Math:** Custom JS Regression Models, Elo Rating implementations 
- **Database:** MongoDB, Mongoose
- **Frontend / Graphics:** Canvas APIs, WebGL, Modern CSS/HTML5

---
*Created by [Shikhar Uniyal](https://github.com/shikharuniyal)*
