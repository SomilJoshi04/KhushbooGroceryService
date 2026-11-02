/**
 * Request ID middleware.
 *
 * Attaches a unique ID to every request so log lines can be correlated
 * with API responses. The ID is returned in the `X-Request-Id` response header.
 *
 * @module middleware/requestId
 */

import { randomUUID } from 'crypto';

/**
 * Attaches `req.id` and `X-Request-Id` header to every request.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function requestId(req, res, next) {
  req.id = randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}
