/**
 * Native HTTP Response Compression Middleware.
 *
 * Implements:
 * - Transparent on-the-fly Gzip and Deflate compression for API responses >= 1024 bytes.
 * - Respects client's `Accept-Encoding` header and sets `Vary: Accept-Encoding`.
 * - Uses Node.js native `zlib` with zero external dependencies.
 * - Safely handles Buffers, strings, and JSON objects.
 *
 * @module middleware/compression
 */

import zlib from 'zlib';

const MIN_COMPRESS_BYTES = 1024; // 1 KB threshold

export function compressionMiddleware(req, res, next) {
  const acceptEncoding = req.headers['accept-encoding'] || '';

  // Skip if client does not support gzip or deflate
  if (!acceptEncoding.includes('gzip') && !acceptEncoding.includes('deflate')) {
    return next();
  }

  const originalSend = res.send;

  res.send = function (body) {
    if (res.headersSent || body === undefined || body === null) {
      return originalSend.call(this, body);
    }

    let buffer;
    if (Buffer.isBuffer(body)) {
      buffer = body;
    } else if (typeof body === 'string') {
      buffer = Buffer.from(body);
    } else if (typeof body === 'object') {
      try {
        const jsonStr = JSON.stringify(body);
        if (!res.getHeader('Content-Type')) {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
        }
        buffer = Buffer.from(jsonStr);
      } catch {
        return originalSend.call(this, body);
      }
    } else {
      return originalSend.call(this, body);
    }

    // Only compress if buffer size is >= 1 KB
    if (buffer.length < MIN_COMPRESS_BYTES) {
      return originalSend.call(this, buffer);
    }

    res.setHeader('Vary', 'Accept-Encoding');

    if (acceptEncoding.includes('gzip')) {
      try {
        const compressed = zlib.gzipSync(buffer, { level: 6 });
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('Content-Length', compressed.length);
        return originalSend.call(this, compressed);
      } catch (err) {
        console.warn('[compression] Gzip compression fallback:', err.message);
        return originalSend.call(this, buffer);
      }
    } else if (acceptEncoding.includes('deflate')) {
      try {
        const compressed = zlib.deflateSync(buffer, { level: 6 });
        res.setHeader('Content-Encoding', 'deflate');
        res.setHeader('Content-Length', compressed.length);
        return originalSend.call(this, compressed);
      } catch (err) {
        console.warn('[compression] Deflate compression fallback:', err.message);
        return originalSend.call(this, buffer);
      }
    }

    return originalSend.call(this, buffer);
  };

  next();
}

