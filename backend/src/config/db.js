/**
 * MongoDB connection module.
 *
 * Connects once at startup. If the connection fails, the process exits so
 * the server never starts in a broken state. Credentials are NEVER logged.
 *
 * @module config/db
 */

import mongoose from 'mongoose';
import { env } from './env.js';

/**
 * Establish the MongoDB connection and block until ready.
 * Exits the process on failure so the caller does not need to handle it.
 */
export async function connectDB() {
  // Mask the URI for logging: show only the host/db, never credentials.
  const safeUri = env.MONGO_URI.replace(
    /mongodb(?:\+srv)?:\/\/[^@]+@/,
    'mongodb+srv://***:***@'
  );

  try {
    // Optimized connection pooling & fail-fast timeouts for production resilience
    await mongoose.connect(env.MONGO_URI, {
      maxPoolSize: 50,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.info(`[db] ✅ Connected to MongoDB at ${safeUri}`);
  } catch (err) {
    // Log the message only — never the URI or credentials.
    console.error('[db] ❌ MongoDB connection failed:', err.message);
    process.exit(1);
  }
}

/**
 * Gracefully close the MongoDB connection.
 * Called on process shutdown signals.
 */
export async function disconnectDB() {
  try {
    await mongoose.connection.close();
    console.info('[db] MongoDB connection closed.');
  } catch (err) {
    console.error('[db] Error closing MongoDB connection:', err.message);
  }
}

/**
 * Returns true if Mongoose is currently connected to MongoDB.
 * @returns {boolean}
 */
export function isDBConnected() {
  return mongoose.connection.readyState === 1;
}
