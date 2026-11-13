/**
 * Zod validation middleware factory.
 *
 * Usage in routes:
 *   router.post('/', validate({ body: myZodSchema }), controller);
 *
 * Strips unknown keys from the body (strict mode via .strict() on the schema,
 * or pass stripUnknown option). Parsed data is written back to req.body /
 * req.query / req.params so downstream middleware sees clean data.
 *
 * @module middleware/validate
 */

import { ZodError } from 'zod';

/**
 * @typedef {Object} ValidateTargets
 * @property {import('zod').ZodSchema} [body]
 * @property {import('zod').ZodSchema} [query]
 * @property {import('zod').ZodSchema} [params]
 */

/**
 * Returns an Express middleware that validates the specified targets.
 *
 * @param {ValidateTargets} targets
 * @returns {import('express').RequestHandler}
 */
export function validate(targets) {
  return (req, res, next) => {
    try {
      if (targets.body) {
        req.body = targets.body.parse(req.body);
      }
      if (targets.query) {
        const parsedQuery = targets.query.parse(req.query);
        req.validatedQuery = parsedQuery;
      }
      if (targets.params) {
        req.params = targets.params.parse(req.params);
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const issues = err.issues || err.errors || [];
        const primaryMessage = issues[0]?.message || 'Validation failed';
        // Pass as a structured error to the centralized error handler.
        const validationErr = Object.assign(new Error(primaryMessage), {
          name: 'ZodError',
          issues,
          errors: issues,
          statusCode: 422,
        });
        next(validationErr);
      } else {
        next(err);
      }
    }
  };
}
