/**
 * Centralized, safe error handler middleware.
 *
 * Rules:
 * - Never expose stack traces or raw DB errors in production.
 * - Never echo back values that could be credentials or PII.
 * - Always include the requestId for log correlation.
 * - 4xx errors log at info level; 5xx errors log at error level.
 *
 * @module middleware/errorHandler
 */

import { env } from '../config/env.js';

/**
 * Map of known error codes / names to HTTP status codes.
 * @type {Object.<string,number>}
 */
const ERROR_STATUS_MAP = {
  ValidationError: 400,        // Mongoose validation
  CastError: 400,              // Invalid ObjectId / type cast
  MongoServerError: 409,       // Duplicate key (code 11000)
  ZodError: 422,               // Schema validation
};

/**
 * Express centralized error handler.
 * Must be registered LAST with app.use().
 *
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next  - Required 4-arg signature
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  // ── Determine status code ─────────────────────────────────────────────────
  let statusCode = err.statusCode || err.status || 500;

  // Override from the map when the status hasn't been set explicitly.
  if (statusCode === 500 && ERROR_STATUS_MAP[err.name]) {
    statusCode = ERROR_STATUS_MAP[err.name];
  }

  // MongoDB duplicate-key error
  if (err.code === 11000) {
    statusCode = 409;
  }

  // ── Build the safe response message ─────────────────────────────────────────
  let message;

  if (env.NODE_ENV === 'production') {
    // In production: generic message for 5xx; client message for 4xx.
    message =
      statusCode >= 500
        ? 'An internal error occurred. Please try again later.'
        : err.message || 'Request failed.';
  } else {
    // In development: more detail helps debugging.
    message = err.message || 'Unknown error.';
  }

  // Zod validation errors — surface field-level details safely.
  let details;
  const zodIssues = err.issues || err.errors;
  if (err.name === 'ZodError' && Array.isArray(zodIssues)) {
    details = zodIssues.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
  }

  // Mongoose validation errors.
  if (err.name === 'ValidationError' && err.errors) {
    details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  }

  // ── Log ───────────────────────────────────────────────────────────────────
  const logPayload = {
    requestId: req.id,
    method: req.method,
    path: req.path,
    statusCode,
    errorName: err.name,
    // Only include stack in non-production.
    ...(env.NODE_ENV !== 'production' && { stack: err.stack }),
  };

  if (statusCode >= 500) {
    console.error('[error]', JSON.stringify(logPayload));
  } else {
    console.info('[request-error]', JSON.stringify(logPayload));
  }

  // ── Respond ───────────────────────────────────────────────────────────────
  res.status(statusCode).json({
    success: false,
    requestId: req.id,
    message,
    ...(details && { details }),
  });
}
