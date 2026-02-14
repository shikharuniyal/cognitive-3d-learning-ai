const mongoose = require('mongoose');

let cachedConnection = null;

async function connectDB() {
    if (cachedConnection && mongoose.connection.readyState === 1) {
        console.log('Using cached database connection');
        return cachedConnection;
    }

    try {
        const MONGODB_URI = process.env.MONGODB_URI;
        
        if (!MONGODB_URI) {
            throw new Error('MONGODB_URI environment variable is not defined');
        }

        console.log('Establishing new database connection...');
        
        const connection = await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            // Optimized for serverless (Vercel)
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });

        cachedConnection = connection;
        console.log('✅ MongoDB connected successfully');
        
        return connection;
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        throw error;
    }
}

module.exports = { connectDB };
