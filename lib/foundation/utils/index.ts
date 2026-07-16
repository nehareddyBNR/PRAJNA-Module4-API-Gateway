/**
 * @fileoverview Barrel export for the PRAJNA platform utilities layer.
 *
 * @example
 * ```typescript
 * import {
 *   NamingHelper,
 *   Validators,
 *   EnvironmentLoader,
 *   sanitizeIdentifier,
 * } from '@foundation/utils';
 * ```
 *
 * @module foundation/utils
 */

// ── Naming Helpers ─────────────────────────────────────────────────────────
export {
  NamingHelper,
  sanitizeIdentifier,
  validateResourceName,
  validateIdentifier,
} from './naming-helper';

// ── Validation Utilities ───────────────────────────────────────────────────
export {
  Validators,
  requireNonEmpty,
  requirePattern,
  requireMaxLength,
  requireValidArn,
  requireInRange,
  requirePositiveInteger,
  assertNotProduction,
  assertProduction,
  isProduction,
  isNonProduction,
  requireValidAccountId,
  requireDefined,
  requireNonEmptyArray,
} from './validation';

// ── Environment Loader ─────────────────────────────────────────────────────
export {
  EnvironmentLoader,
  resolveStage,
  STAGE_ENV_VARIABLE,
  STAGE_CONTEXT_KEY,
  DEFAULT_STAGE,
} from './environment-loader';
