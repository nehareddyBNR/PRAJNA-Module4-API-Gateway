/**
 * @fileoverview General-purpose validation utilities for the PRAJNA platform.
 *
 * These validators catch common CDK configuration mistakes at synth time
 * with clear, actionable error messages. They prevent invalid inputs from
 * reaching CloudFormation, where errors are cryptic and expensive to debug.
 *
 * All validators follow an assert-style API: they throw on invalid input
 * and return void on success. This enables guard-clause patterns at the
 * top of construct constructors.
 *
 * @example
 * ```typescript
 * import { Validators } from '@foundation/utils';
 *
 * // In a construct constructor:
 * Validators.requireNonEmpty(props.tableName, 'DynamoDB table name');
 * Validators.requireValidArn(props.roleArn, 'Lambda execution role ARN');
 * Validators.requireInRange(props.memorySize, 128, 10240, 'Lambda memory');
 * ```
 *
 * @module foundation/utils/validation
 */

import { PrajnaEnvironmentConfig, Stage } from '../config/environment';

// ─────────────────────────────────────────────────────────────────────────────
// String Validators
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Asserts that a string value is non-empty and non-whitespace.
 *
 * @param value - The string to validate.
 * @param fieldName - Human-readable field name for error messages.
 * @throws {Error} If the value is undefined, null, empty, or whitespace-only.
 */
export function requireNonEmpty(value: string | undefined | null, fieldName: string): asserts value is string {
  if (value === undefined || value === null || value.trim().length === 0) {
    throw new Error(
      `[PRAJNA] ${fieldName} is required but was ${value === undefined ? 'undefined' : value === null ? 'null' : 'empty'}. ` +
      'Provide a non-empty string value.',
    );
  }
}

/**
 * Asserts that a string matches a given regular expression pattern.
 *
 * @param value - The string to validate.
 * @param pattern - The regex pattern to match against.
 * @param fieldName - Human-readable field name for error messages.
 * @param patternDescription - Human-readable description of the expected pattern.
 * @throws {Error} If the value does not match the pattern.
 */
export function requirePattern(
  value: string,
  pattern: RegExp,
  fieldName: string,
  patternDescription: string,
): void {
  if (!pattern.test(value)) {
    throw new Error(
      `[PRAJNA] ${fieldName} has invalid format: "${value}". ` +
      `Expected pattern: ${patternDescription}.`,
    );
  }
}

/**
 * Asserts that a string does not exceed a maximum length.
 *
 * @param value - The string to validate.
 * @param maxLength - The maximum allowed length.
 * @param fieldName - Human-readable field name for error messages.
 * @throws {Error} If the string exceeds the maximum length.
 */
export function requireMaxLength(value: string, maxLength: number, fieldName: string): void {
  if (value.length > maxLength) {
    throw new Error(
      `[PRAJNA] ${fieldName} exceeds maximum length of ${maxLength} characters ` +
      `(got ${value.length}): "${value}".`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ARN Validators
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Regex pattern for validating AWS ARN format.
 *
 * Format: arn:{partition}:{service}:{region}:{account}:{resource-type}/{resource-id}
 */
const ARN_PATTERN = /^arn:(?:aws|aws-cn|aws-us-gov):[a-zA-Z0-9-]+:[a-z0-9-]*:\d{12}:.+$/;

/**
 * Asserts that a string is a valid AWS ARN.
 *
 * This validates the ARN format, not whether the resource actually exists.
 * Use this to catch obviously malformed ARNs before they reach CloudFormation.
 *
 * @param value - The ARN string to validate.
 * @param fieldName - Human-readable field name for error messages.
 * @throws {Error} If the value is not a valid ARN format.
 */
export function requireValidArn(value: string, fieldName: string): void {
  requireNonEmpty(value, fieldName);

  if (!ARN_PATTERN.test(value)) {
    throw new Error(
      `[PRAJNA] ${fieldName} is not a valid ARN: "${value}". ` +
      'Expected format: arn:{partition}:{service}:{region}:{account}:{resource}.',
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Numeric Validators
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Asserts that a number falls within an inclusive range.
 *
 * @param value - The number to validate.
 * @param min - The minimum allowed value (inclusive).
 * @param max - The maximum allowed value (inclusive).
 * @param fieldName - Human-readable field name for error messages.
 * @throws {Error} If the value is outside the allowed range.
 */
export function requireInRange(value: number, min: number, max: number, fieldName: string): void {
  if (value < min || value > max) {
    throw new Error(
      `[PRAJNA] ${fieldName} must be between ${min} and ${max} (got ${value}).`,
    );
  }
}

/**
 * Asserts that a number is a positive integer.
 *
 * @param value - The number to validate.
 * @param fieldName - Human-readable field name for error messages.
 * @throws {Error} If the value is not a positive integer.
 */
export function requirePositiveInteger(value: number, fieldName: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      `[PRAJNA] ${fieldName} must be a positive integer (got ${value}).`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Environment Validators
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Asserts that the current environment is NOT production.
 *
 * Use this to guard destructive operations (e.g., `RemovalPolicy.DESTROY`,
 * auto-delete objects, data wipe scripts) from accidentally running in
 * production.
 *
 * @param config - The environment configuration.
 * @param operationDescription - Description of the guarded operation.
 * @throws {Error} If the environment is production.
 *
 * @example
 * ```typescript
 * // In a test data seeder:
 * assertNotProduction(config, 'Seeding test data');
 * ```
 */
export function assertNotProduction(
  config: PrajnaEnvironmentConfig,
  operationDescription: string,
): void {
  if (config.isProduction) {
    throw new Error(
      `[PRAJNA] Forbidden: "${operationDescription}" is not allowed in the ` +
      `${config.environmentName} (${config.stage}) environment. ` +
      'This operation is restricted to non-production environments only.',
    );
  }
}

/**
 * Asserts that the current environment IS production.
 *
 * Use this to guard operations that should ONLY run in production
 * (e.g., enabling WAF, configuring production-only alarms).
 *
 * @param config - The environment configuration.
 * @param operationDescription - Description of the guarded operation.
 * @throws {Error} If the environment is not production.
 */
export function assertProduction(
  config: PrajnaEnvironmentConfig,
  operationDescription: string,
): void {
  if (!config.isProduction) {
    throw new Error(
      `[PRAJNA] "${operationDescription}" is only allowed in the Production environment ` +
      `(currently running in ${config.environmentName}).`,
    );
  }
}

/**
 * Checks whether the given stage is production.
 *
 * Non-throwing variant for conditional logic rather than guard clauses.
 *
 * @param stage - The deployment stage.
 * @returns `true` if the stage is production.
 */
export function isProduction(stage: Stage): boolean {
  return stage === Stage.PRODUCTION;
}

/**
 * Checks whether the given stage is a non-production environment.
 *
 * @param stage - The deployment stage.
 * @returns `true` if the stage is development or QA.
 */
export function isNonProduction(stage: Stage): boolean {
  return stage !== Stage.PRODUCTION;
}

// ─────────────────────────────────────────────────────────────────────────────
// AWS Account Validators
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Regex pattern for a valid 12-digit AWS account ID.
 */
const AWS_ACCOUNT_PATTERN = /^\d{12}$/;

/**
 * Asserts that a string is a valid 12-digit AWS account ID.
 *
 * @param accountId - The account ID to validate.
 * @param fieldName - Human-readable field name for error messages.
 * @throws {Error} If the account ID is not exactly 12 digits.
 */
export function requireValidAccountId(accountId: string, fieldName: string): void {
  requireNonEmpty(accountId, fieldName);

  if (!AWS_ACCOUNT_PATTERN.test(accountId)) {
    throw new Error(
      `[PRAJNA] ${fieldName} must be a 12-digit AWS account ID (got "${accountId}").`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// General Purpose Validators
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Asserts that a value is defined (not undefined and not null).
 *
 * @param value - The value to check.
 * @param fieldName - Human-readable field name for error messages.
 * @throws {Error} If the value is undefined or null.
 */
export function requireDefined<T>(value: T | undefined | null, fieldName: string): asserts value is T {
  if (value === undefined || value === null) {
    throw new Error(
      `[PRAJNA] ${fieldName} is required but was ${value === undefined ? 'undefined' : 'null'}.`,
    );
  }
}

/**
 * Asserts that an array is non-empty.
 *
 * @param value - The array to validate.
 * @param fieldName - Human-readable field name for error messages.
 * @throws {Error} If the array is empty or not defined.
 */
export function requireNonEmptyArray<T>(value: T[] | undefined | null, fieldName: string): asserts value is T[] {
  requireDefined(value, fieldName);

  if (value.length === 0) {
    throw new Error(
      `[PRAJNA] ${fieldName} must contain at least one element.`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregated Validators Namespace
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aggregated namespace for all validation functions.
 *
 * Provides a single import for all validators:
 *
 * @example
 * ```typescript
 * import { Validators } from '@foundation/utils';
 *
 * Validators.requireNonEmpty(name, 'Function name');
 * Validators.requireInRange(memory, 128, 10240, 'Memory size');
 * Validators.assertNotProduction(config, 'Data wipe');
 * ```
 */
export const Validators = {
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
} as const;
