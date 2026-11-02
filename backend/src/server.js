/**
 

 
 
 
 
 
 
 
 
 
 

 * @module server
 */

// ── 1. Environment (MUST be first) ────────────────────────────────────────────
import 'dotenv/config';           // loads backend/.env (dotenv 18.x ES-module style)
import { env } from './config/env.js';    // validates and exports typed env

// ── Core imports ───────────────────────────────────────────────────────────────
import http from 'http';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import cookieParser from 'cookie-parser';

// ── Internal modules ──────────────────────────────────────────────────────────
import { connectDB, disconnectDB, isDBConnected } from './config/db.js';
import { initSocket, closeSocket } from './socket.js';
import { requestId } from './middleware/requestId.js';
import { errorHandler } from './middleware/errorHandler.js';
import foodRoutes from './routes/foodRoutes.js';
import authRoutes from './routes/authRoutes.js';
import catalogRoutes from './routes/catalogRoutes.js';
import deliveryRoutes from './routes/deliveryRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import storeRoutes from './routes/storeRoutes.js';
import contentRoutes from './routes/contentRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import bannerRoutes from './routes/bannerRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import { ensureInitialAdminBootstrap } from './services/adminBootstrapService.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─────────────────────────────────────────────────────────────────────────────
// App instance
// ─────────────────────────────────────────────────────────────────────────────
const app = express();

// Trust the first proxy (needed for accurate IP in rate limiters on Nginx/Render).
// Set to the actual number of proxies in front of this app; 1 is correct for
// a single Nginx reverse-proxy. Never use 'true' in production.
app.set('trust proxy', 1);

// ─────────────────────────────────────────────────────────────────────────────
// 2a. Request ID — attach before any other middleware so errors include it.
// ─────────────────────────────────────────────────────────────────────────────
app.use(requestId);

// ─────────────────────────────────────────────────────────────────────────────
// 2b. Helmet — sets secure HTTP headers.
//
// Content-Security-Policy is intentionally relaxed here because the frontend
// is served separately. Once the frontend is served through the same origin,
// tighten the CSP to remove 'unsafe-inline' for scripts.
// ─────────────────────────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://checkout.razorpay.com'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: [
          "'self'",
          'blob:',
          'data:',
          'https://images.unsplash.com',
          'https://*.tile.openstreetmap.org',
          'https://*.razorpay.com',
        ],
        connectSrc: [
          "'self'",
          'https://nominatim.openstreetmap.org',
          'https://api.razorpay.com',
          'https://lumberjack.razorpay.com',
          'ws:',
          'wss:',
          'http://localhost:*',
          'ws://localhost:*',
          'http://127.0.0.1:*',
          'ws://127.0.0.1:*',
        ],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        frameSrc: ["'self'", 'https://api.razorpay.com'],
        objectSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,   // relaxed for image embeds
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// 2c. CORS — explicit allowlist from environment.
//
// CLIENT_URL is a single origin for now (one frontend). When multiple origins
// are needed, change env to a comma-separated list and parse it here.
// ─────────────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = new Set([env.CLIENT_URL]);

// Always allow localhost during development regardless of CLIENT_URL.
if (env.NODE_ENV !== 'production') {
  ALLOWED_ORIGINS.add('http://localhost:5173');
  ALLOWED_ORIGINS.add('http://127.0.0.1:5173');
  ALLOWED_ORIGINS.add('http://localhost:5174');
  ALLOWED_ORIGINS.add('http://127.0.0.1:5174');
}

app.use(
  cors({
    origin(requestOrigin, callback) {
      // Allow requests with no origin (curl, Postman, server-to-server).
      if (!requestOrigin) {
        return callback(null, true);
      }
      if (ALLOWED_ORIGINS.has(requestOrigin)) {
        return callback(null, true);
      }
      console.warn(`[cors] Blocked origin: ${requestOrigin}`);
      callback(new Error('CORS: origin not allowed'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// 2d. Global rate limit — broad protection before heavy middleware.
//
// NOTE: In-memory rate limiter only; it does NOT coordinate across multiple
// Node processes/replicas. A Redis store is needed for multi-instance deployments.
// Single-instance deployments (Nginx + PM2 in cluster mode using sticky sessions)
// may still use in-memory limiters with acceptable accuracy.
// ─────────────────────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: env.NODE_ENV === 'development' ? 10000 : 1000, // higher limit in development
  skip: (req) => env.NODE_ENV === 'development' && (req.ip === '::1' || req.ip === '127.0.0.1' || req.ip === '::ffff:127.0.0.1'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests from this IP. Please try again later.' },
});
app.use(globalLimiter);

// ─────────────────────────────────────────────────────────────────────────────
// 3a. Body parsers — strict limits to prevent oversized payload abuse.
// ─────────────────────────────────────────────────────────────────────────────
app.use(
  express.json({
    limit: '100kb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '50kb' }));
app.use(cookieParser());

// ─────────────────────────────────────────────────────────────────────────────
// 3b. NoSQL injection sanitization.
//
// Strips keys that start with '$' or contain '.' from req.body, req.query,
// and req.params. This is a defence-in-depth layer; Zod schemas validate types
// first. Both are needed.
// ─────────────────────────────────────────────────────────────────────────────
// In Express 5, req.query is a getter-only property. The default express-mongo-sanitize
// middleware reassigns `req.query = target`, which throws TypeError. We sanitize
// objects in-place instead.
app.use((req, _res, next) => {
  ['body', 'params', 'headers', 'query'].forEach((key) => {
    if (req[key] && typeof req[key] === 'object') {
      if (mongoSanitize.has(req[key])) {
        console.warn(`[mongo-sanitize] Blocked potential injection attempt in ${key}. requestId=${req.id}`);
      }
      mongoSanitize.sanitize(req[key], { replaceWith: '_' });
    }
  });
  next();
});

// ─────────────────────────────────────────────────────────────────────────────
// Health and readiness endpoints — BEFORE routes, no auth required.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /health — liveness probe.
 * Returns 200 if the process is running.
 * Does NOT reveal infrastructure details.
 */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

/**
 * GET /ready — readiness probe.
 * Returns 200 only when the database connection is active.
 * Returns 503 if not ready (used by load balancers and Nginx upstream checks).
 */
app.get('/ready', (_req, res) => {
  if (isDBConnected()) {
    return res.json({ status: 'ready', db: 'connected' });
  }
  return res.status(503).json({ status: 'unavailable', db: 'disconnected' });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. API Routes — versioned base path.
// ─────────────────────────────────────────────────────────────────────────────
// ── Static Assets & Public Uploads ───────────────────────────────────────────
const uploadsDir = path.resolve(__dirname, '../uploads');

// Strict access control: Prohibit direct static access to private documents & temporary staging
app.use(['/uploads/documents', '/uploads/temporary'], (req, res) => {
  return res.status(403).json({
    success: false,
    message: 'Direct static access to private storage is prohibited. Use authenticated API endpoints.',
  });
});

// Serve public uploads securely with CORP and nosniff headers
app.use(
  '/uploads',
  express.static(uploadsDir, {
    setHeaders: (res) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  })
);

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/delivery', deliveryRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/store', storeRoutes);
app.use('/api/v1/content', contentRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/banners', bannerRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1', catalogRoutes);
app.use('/api/v1/foods', foodRoutes);

// ── Legacy / un-versioned routes (preserved for compatibility) ────────────────
app.use('/api/auth', authRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api', catalogRoutes);
app.use('/api/foods', foodRoutes);

// ─────────────────────────────────────────────────────────────────────────────
// 5. 404 — catch all unmatched routes.
// ─────────────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    requestId: req.id,
    message: `Route ${req.method} ${req.path} not found.`,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Centralized error handler — MUST be last.
// ─────────────────────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─────────────────────────────────────────────────────────────────────────────
// 7–8. Connect DB, then start listening.
// ─────────────────────────────────────────────────────────────────────────────
let server;

async function start() {
  await connectDB();   // exits process on failure (see db.js)

  try {
    const adminInit = await ensureInitialAdminBootstrap();
    if (adminInit.status === 'CREATED') {
      console.info('[server] Initial administrative account initialized from environment configuration.');
    }
  } catch (adminErr) {
    console.error('[server] Warning: Initial admin bootstrap check encountered an error:', adminErr.message);
  }

  server = http.createServer(app);
  initSocket(server, ALLOWED_ORIGINS);

  server.listen(env.PORT, () => {
    console.info(
      `[server] ✅ ${env.NODE_ENV} server listening on http://localhost:${env.PORT}`
    );
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Graceful shutdown — close DB and HTTP server on signals.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gracefully shut down: stop accepting new requests, close DB and Socket.IO.
 * @param {string} signal
 */
async function shutdown(signal) {
  console.info(`[server] ${signal} received — shutting down gracefully.`);
  try {
    await closeSocket();
  } catch (err) {
    console.error('[server] Error closing socket.io:', err);
  }

  if (server) {
    server.close(async () => {
      await disconnectDB();
      console.info('[server] Shutdown complete.');
      process.exit(0);
    });
  } else {
    await disconnectDB();
    process.exit(0);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// Catch unhandled rejections so they don't silently swallow errors.
process.on('unhandledRejection', (reason) => {
  console.error('[server] Unhandled rejection:', reason);
  // Do NOT exit here — let PM2/the OS manage restarts; some rejections are transient.
});

// ─────────────────────────────────────────────────────────────────────────────
// Start!
// ─────────────────────────────────────────────────────────────────────────────
start().catch((err) => {
  console.error('[server] Fatal startup error:', err.message);
  process.exit(1);
});

export { app, server };
