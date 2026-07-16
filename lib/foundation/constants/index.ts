/**
 * @fileoverview Barrel export for the PRAJNA platform constants layer.
 *
 * This module consolidates all naming conventions, resource name generators,
 * SSM parameter paths, and platform defaults into a single import path.
 *
 * @example
 * ```typescript
 * import {
 *   ResourceNames,
 *   SsmPaths,
 *   ModuleIdentifier,
 *   DEFAULT_LAMBDA_RUNTIME,
 * } from '@foundation/constants';
 * ```
 *
 * @module foundation/constants
 */

// ── Naming Conventions ─────────────────────────────────────────────────────
export {
  APPLICATION_NAME,
  APPLICATION_TITLE,
  NAMING_SEPARATOR,
  SSM_PATH_SEPARATOR,
  ServicePrefix,
  ModuleIdentifier,
  ResourceNameMaxLength,
  type ResourceNameService,
} from './naming';

// ── Resource Name Generators ───────────────────────────────────────────────
export { ResourceNames } from './resource-names';

// ── SSM Parameter Paths ────────────────────────────────────────────────────
export {
  FoundationParameters,
  AuthParameters,
  ApiParameters,
  DatabaseParameters,
  StorageParameters,
  NotificationParameters,
  SsmPaths,
} from './ssm-parameters';

// ── Platform Defaults ──────────────────────────────────────────────────────
export {
  DEFAULT_REGION,
  DEFAULT_LAMBDA_RUNTIME,
  DEFAULT_LAMBDA_ARCHITECTURE,
  DEFAULT_LAMBDA_MEMORY,
  DEFAULT_LAMBDA_TIMEOUT,
  MAX_LAMBDA_TIMEOUT,
  DEFAULT_LAMBDA_TRACING,
  DEFAULT_LAMBDA_ENVIRONMENT,
  DEFAULT_LOG_RETENTION,
  DEFAULT_ALARM_EVALUATION_PERIODS,
  DEFAULT_ALARM_PERIOD,
  DEFAULT_METRICS_NAMESPACE,
  MAX_UPLOAD_SIZE_BYTES,
  PRESIGNED_URL_EXPIRATION,
  DEFAULT_API_THROTTLE_RATE,
  DEFAULT_API_THROTTLE_BURST,
  NON_PRODUCTION_REMOVAL_POLICY,
  PRODUCTION_REMOVAL_POLICY,
  DEFAULT_DYNAMODB_READ_CAPACITY,
  DEFAULT_DYNAMODB_WRITE_CAPACITY,
  DEFAULT_ACCESS_TOKEN_VALIDITY,
  DEFAULT_ID_TOKEN_VALIDITY,
  DEFAULT_REFRESH_TOKEN_VALIDITY,
  DEFAULT_TAGS,
  PLATFORM_VERSION,
  PLATFORM_OWNER,
  COST_CENTER,
} from './defaults';
