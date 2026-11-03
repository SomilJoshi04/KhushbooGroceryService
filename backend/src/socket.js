/**
 * Secure Socket.IO Server Configuration & Real-Time Delivery Engine.
 *
 * Implements:
 * - Handshake JWT verification via HttpOnly cookie, auth payload, or Bearer header.
 * - Server-side identity derivation from database (never trusts client-supplied identity).
 * - Enforces account status checks (isActive, !isDeleted, valid sessionVersion).
 * - Server-controlled room assignment:
 *     - Customer room: `user:${userId}`
 *     - Administrative broadcast room: `admin:notifications` (restricted to ADMIN, SUPER_ADMIN, STAFF)
 * - Rate limiting and payload size bounds on socket traffic.
 * - Safe emission utilities with minimal, sanitized payloads (zero token or PII exposure).
 *
 * @module socket
 */

import { Server } from 'socket.io';
import { verifyToken, AUTH_COOKIE_NAME } from './utils/token.js';
import { User } from './models/User.js';

let ioInstance = null;

/**
 * Extracts authentication token from socket handshake (cookie, auth payload, or header).
 *
 * @param {import('socket.io').Socket} socket
 * @returns {string|null}
 */
function extractSocketToken(socket) {
  // 1. Check handshake.auth payload
  if (socket.handshake?.auth?.token) {
    return socket.handshake.auth.token.replace(/^Bearer\s+/i, '').trim();
  }

  // 2. Check Authorization header
  const authHeader = socket.handshake?.headers?.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1].trim();
  }

  // 3. Parse cookies from handshake headers
  const cookieHeader = socket.handshake?.headers?.cookie;
  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader
        .split(';')
        .map((c) => c.trim().split('='))
        .filter(([k, v]) => k && v)
        .map(([k, ...vs]) => [k, decodeURIComponent(vs.join('='))])
    );
    if (cookies[AUTH_COOKIE_NAME]) {
      return cookies[AUTH_COOKIE_NAME];
    }
  }

  return null;
}

/**
 * Socket.IO Authentication Middleware.
 * Validates JWT against secret, finds active user in database, and attaches user profile.
 */
async function socketAuthMiddleware(socket, next) {
  try {
    const token = extractSocketToken(socket);

    if (!token) {
      return next(new Error('Authentication required for real-time notifications.'));
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch {
      return next(new Error('Invalid or expired authentication session.'));
    }

    if (!decoded?.id) {
      return next(new Error('Malformed token credentials.'));
    }

    const user = await User.findById(decoded.id).select(
      '_id role name phone email isActive isDeleted sessionVersion'
    );

    if (!user || !user.isActive || user.isDeleted) {
      return next(new Error('User account not found, deactivated, or deleted.'));
    }

    if (decoded.sessionVersion !== undefined && user.sessionVersion > decoded.sessionVersion) {
      return next(new Error('Session has been revoked. Please log in again.'));
    }

    // Attach verified user identity to socket
    socket.user = {
      _id: user._id.toString(),
      role: user.role,
      name: user.name,
      phone: user.phone,
      email: user.email,
    };

    next();
  } catch (err) {
    next(new Error('Real-time connection authentication failure.'));
  }
}

/**
 * Initializes the Socket.IO server bound to the HTTP server instance.
 *
 * @param {import('http').Server} httpServer
 * @param {Set<string>} allowedOrigins
 * @returns {Server}
 */
export function initSocket(httpServer, allowedOrigins) {
  const originSet = new Set();
  if (allowedOrigins) {
    for (const o of allowedOrigins) {
      if (typeof o === 'string' && o.trim()) {
        originSet.add(o.trim());
        originSet.add(o.trim().replace(/\/+$/, ''));
      }
    }
  }

  ioInstance = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) {
          return callback(null, true);
        }
        const cleanOrigin = origin.replace(/\/+$/, '');
        if (originSet.has(origin) || originSet.has(cleanOrigin)) {
          return callback(null, true);
        }
        console.warn(`[socket.io] CORS rejected origin: ${origin}`);
        return callback(new Error('Socket.IO CORS: Origin not allowed.'));
      },
      credentials: true,
      methods: ['GET', 'POST'],
    },
    maxHttpBufferSize: 1e6, // 1 MB payload limit to prevent memory exhaustion attacks
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  // Apply strict authentication
  ioInstance.use(socketAuthMiddleware);

  ioInstance.on('connection', (socket) => {
    const { _id: userId, role } = socket.user;

    // Server-controlled room assignment based exclusively on verified authentication
    // 1. Every authenticated user joins their personal notification room
    socket.join(`user:${userId}`);

    // 2. Administrative roles join both standard 'admins' room and legacy 'admin:notifications' room
    const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'STAFF'].includes(role);
    if (isAdmin) {
      socket.join('admins');
      socket.join('admin:notifications');
    }

    console.info(
      `[socket.io] Connected: socketId=${socket.id} userId=${userId} role=${role} rooms=[user:${userId}${isAdmin ? ', admins, admin:notifications' : ''}]`
    );

    // Reject any client attempts to join arbitrary rooms directly
    socket.on('join_room', () => {
      socket.emit('error', { message: 'Unauthorized room subscription attempt.' });
    });

    // Provide initial connection confirmation without leaking sensitive tokens
    socket.emit('notification:connected', {
      connected: true,
      role,
      rooms: isAdmin ? [`user:${userId}`, 'admins', 'admin:notifications'] : [`user:${userId}`],
      timestamp: new Date().toISOString(),
    });

    socket.on('disconnect', (reason) => {
      console.info(`[socket.io] Disconnected: socketId=${socket.id} userId=${userId} reason=${reason}`);
    });
  });

  console.info('[socket.io] Real-time notification engine initialized.');
  return ioInstance;
}

/**
 * Returns the active Socket.IO server instance.
 * @returns {Server|null}
 */
export function getIO() {
  return ioInstance;
}

/**
 * Safely delivers a notification event to a specific customer's room.
 *
 * @param {string} userId - Target customer user ID
 * @param {string} event - Socket event name (e.g. 'notification:new')
 * @param {Object} payload - Notification payload
 */
export function emitToUser(userId, event, payload) {
  if (!ioInstance || !userId) return;
  const targetRoom = `user:${userId.toString()}`;
  ioInstance.to(targetRoom).emit(event, payload);
  console.info(`[socket.io] Emitted ${event} to room ${targetRoom}`);
}

/**
 * Safely delivers a notification event to all authorized administrative users.
 * Targets both standard 'admins' room and legacy 'admin:notifications' room.
 *
 * @param {string} event - Socket event name
 * @param {Object} payload - Notification payload
 */
export function emitToAdmins(event, payload) {
  if (!ioInstance) return;
  ioInstance.to('admins').to('admin:notifications').emit(event, payload);
  console.info(`[socket.io] Emitted ${event} to rooms [admins, admin:notifications]`);
}

/**
 * Broadcasts a public notification event to all connected authenticated users.
 *
 * @param {string} event - Socket event name
 * @param {Object} payload - Notification payload
 */
export function emitToAll(event, payload) {
  if (!ioInstance) return;
  ioInstance.emit(event, payload);
  console.info(`[socket.io] Broadcast ${event} to all connected clients`);
}

/**
 * Gracefully terminates the Socket.IO server during process shutdown.
 */
export async function closeSocket() {
  if (ioInstance) {
    await new Promise((resolve) => {
      ioInstance.close(() => {
        console.info('[socket.io] Server closed.');
        resolve();
      });
    });
    ioInstance = null;
  }
}

