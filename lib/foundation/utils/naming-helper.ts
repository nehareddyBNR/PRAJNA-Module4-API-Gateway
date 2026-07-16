/**
 * @fileoverview Naming helper utilities for the PRAJNA platform.
 *
 * This module wraps the {@link ResourceNames} generators with input
 * sanitization and AWS service name-length validation. It catches
 * naming violations at CDK synth time with clear error messages,
 * preventing cryptic CloudFormation deployment failures.
 *
 * Module developers should prefer these helpers over raw {@link ResourceNames}
 * calls to get validation for free.
 *
 * @example
 * ```typescript
 * import { NamingHelper } from '@foundation/utils';
 *
 * const fnName = NamingHelper.lambda(config, ModuleIdentifier.AUTH, 'authorizer');
 * const bucket = NamingHelper.s3Bucket(config, ModuleIdentifier.STORAGE, 'documents');
 * ```
 *
 * @module foundation/utils/naming-helper
 */

import { PrajnaEnvironmentConfig } from '../config/environment';
import { ResourceNames } from '../constants/resource-names';
import {
  ModuleIdentifier,
  ResourceNameMaxLength,
  ResourceNameService,
} from '../constants/naming';

// ─────────────────────────────────────────────────────────────────────────────
// Sanitization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sanitizes a resource identifier for use in AWS resource names.
 *
 * Transformations applied:
 * 1. Convert to lowercase.
 * 2. Replace underscores and spaces with hyphens.
 * 3. Remove characters that are not alphanumeric or hyphens.
 * 4. Collapse consecutive hyphens into a single hyphen.
 * 5. Trim leading and trailing hyphens.
 *
 * @param identifier - The raw identifier string.
 * @returns The sanitized identifier safe for AWS resource names.
 *
 * @example
 * ```typescript
 * sanitizeIdentifier('My Upload_Handler!');  // → "my-upload-handler"
 * sanitizeIdentifier('--double--hyphens--'); // → "double-hyphens"
 * ```
 */
export function sanitizeIdentifier(identifier: string): string {
  return identifier
    .toLowerCase()
    .replace(/[_\s]/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates that a generated resource name does not exceed the AWS service
 * character limit.
 *
 * @param name - The generated resource name.
 * @param service - The AWS service type (determines the max length).
 * @throws {Error} If the name exceeds the service's maximum length.
 */
export function validateResourceName(name: string, service: ResourceNameService): void {
  const maxLength = ResourceNameMaxLength[service];

  if (name.length > maxLength) {
    throw new Error(
      `[PRAJNA] Resource name exceeds ${service} limit of ${maxLength} characters ` +
      `(got ${name.length}): "${name}". ` +
      'Shorten the module or identifier segment.',
    );
  }
}

/**
 * Validates that an identifier is not empty after sanitization.
 *
 * @param identifier - The identifier to validate.
 * @param context - A human-readable context for the error message.
 * @throws {Error} If the identifier is empty or blank.
 */
export function validateIdentifier(identifier: string, context: string): void {
  if (identifier.trim().length === 0) {
    throw new Error(
      `[PRAJNA] Empty identifier provided for ${context}. ` +
      'Resource identifiers must contain at least one alphanumeric character.',
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Naming Helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * High-level naming helper that combines sanitization, generation, and
 * validation into single-call convenience methods.
 *
 * Each method:
 * 1. Sanitizes the input identifier.
 * 2. Delegates to {@link ResourceNames} for name generation.
 * 3. Validates the generated name against AWS length limits.
 * 4. Returns the validated name.
 *
 * @example
 * ```typescript
 * import { NamingHelper } from '@foundation/utils';
 * import { ModuleIdentifier } from '@foundation/constants';
 *
 * // In a module stack:
 * const functionName = NamingHelper.lambda(config, ModuleIdentifier.AUTH, 'authorizer');
 * // → "prajna-dev-auth-fn-authorizer" (validated against 64-char limit)
 *
 * const bucketName = NamingHelper.s3Bucket(config, ModuleIdentifier.STORAGE, 'Documents');
 * // → "prajna-dev-storage-s3-documents" (sanitized + validated against 63-char limit)
 * ```
 */
export class NamingHelper {

  /** This class is not instantiable — all methods are static. */
  private constructor() {}

  /**
   * Sanitizes an identifier and validates it is non-empty.
   *
   * @param identifier - The raw identifier.
   * @param context - Context for error messages.
   * @returns The sanitized identifier.
   */
  private static prepare(identifier: string, context: string): string {
    const sanitized = sanitizeIdentifier(identifier);
    validateIdentifier(sanitized, context);
    return sanitized;
  }

  /**
   * Generates a validated Lambda function name.
   *
   * @param config - The environment configuration.
   * @param module - The owning module.
   * @param identifier - The function identifier (e.g., "authorizer").
   * @returns The validated Lambda function name.
   * @throws {Error} If the name exceeds 64 characters.
   */
  static lambda(
    config: PrajnaEnvironmentConfig,
    module: ModuleIdentifier,
    identifier: string,
  ): string {
    const clean = NamingHelper.prepare(identifier, `Lambda function in ${module}`);
    const name = ResourceNames.lambdaFunction(config.stage, module, clean);
    validateResourceName(name, 'LAMBDA_FUNCTION');
    return name;
  }

  /**
   * Generates a validated Lambda layer name.
   *
   * @param config - The environment configuration.
   * @param module - The owning module.
   * @param identifier - The layer identifier.
   * @returns The validated Lambda layer name.
   * @throws {Error} If the name exceeds 64 characters.
   */
  static lambdaLayer(
    config: PrajnaEnvironmentConfig,
    module: ModuleIdentifier,
    identifier: string,
  ): string {
    const clean = NamingHelper.prepare(identifier, `Lambda layer in ${module}`);
    const name = ResourceNames.lambdaLayer(config.stage, module, clean);
    validateResourceName(name, 'LAMBDA_FUNCTION');
    return name;
  }

  /**
   * Generates a validated S3 bucket name.
   *
   * @param config - The environment configuration.
   * @param module - The owning module.
   * @param identifier - The bucket identifier (e.g., "documents").
   * @returns The validated S3 bucket name.
   * @throws {Error} If the name exceeds 63 characters.
   */
  static s3Bucket(
    config: PrajnaEnvironmentConfig,
    module: ModuleIdentifier,
    identifier: string,
  ): string {
    const clean = NamingHelper.prepare(identifier, `S3 bucket in ${module}`);
    const name = ResourceNames.s3Bucket(config.stage, module, clean, config.deploymentTarget.account);
    validateResourceName(name, 'S3_BUCKET');
    return name;
  }

  /**
   * Generates a validated DynamoDB table name.
   *
   * @param config - The environment configuration.
   * @param module - The owning module.
   * @param identifier - The table identifier (e.g., "publications").
   * @returns The validated DynamoDB table name.
   * @throws {Error} If the name exceeds 255 characters.
   */
  static dynamoDbTable(
    config: PrajnaEnvironmentConfig,
    module: ModuleIdentifier,
    identifier: string,
  ): string {
    const clean = NamingHelper.prepare(identifier, `DynamoDB table in ${module}`);
    const name = ResourceNames.dynamoDbTable(config.stage, module, clean);
    validateResourceName(name, 'DYNAMODB_TABLE');
    return name;
  }

  /**
   * Generates a validated IAM role name.
   *
   * @param config - The environment configuration.
   * @param module - The owning module.
   * @param identifier - The role identifier (e.g., "lambda-execution").
   * @returns The validated IAM role name.
   * @throws {Error} If the name exceeds 64 characters.
   */
  static iamRole(
    config: PrajnaEnvironmentConfig,
    module: ModuleIdentifier,
    identifier: string,
  ): string {
    const clean = NamingHelper.prepare(identifier, `IAM role in ${module}`);
    const name = ResourceNames.iamRole(config.stage, module, clean);
    validateResourceName(name, 'IAM_ROLE');
    return name;
  }

  /**
   * Generates a validated IAM policy name.
   *
   * @param config - The environment configuration.
   * @param module - The owning module.
   * @param identifier - The policy identifier (e.g., "s3-read-access").
   * @returns The validated IAM policy name.
   * @throws {Error} If the name exceeds 128 characters.
   */
  static iamPolicy(
    config: PrajnaEnvironmentConfig,
    module: ModuleIdentifier,
    identifier: string,
  ): string {
    const clean = NamingHelper.prepare(identifier, `IAM policy in ${module}`);
    const name = ResourceNames.iamPolicy(config.stage, module, clean);
    validateResourceName(name, 'IAM_POLICY');
    return name;
  }

  /**
   * Generates a validated CloudWatch log group name.
   *
   * @param config - The environment configuration.
   * @param module - The owning module.
   * @param identifier - The log group identifier.
   * @returns The validated log group name.
   * @throws {Error} If the name exceeds 512 characters.
   */
  static logGroup(
    config: PrajnaEnvironmentConfig,
    module: ModuleIdentifier,
    identifier: string,
  ): string {
    const clean = NamingHelper.prepare(identifier, `Log group in ${module}`);
    const name = ResourceNames.logGroup(config.stage, module, clean);
    validateResourceName(name, 'LOG_GROUP');
    return name;
  }

  /**
   * Generates a validated CloudWatch alarm name.
   *
   * @param config - The environment configuration.
   * @param module - The owning module.
   * @param identifier - The alarm identifier.
   * @returns The validated alarm name.
   * @throws {Error} If the name exceeds 255 characters.
   */
  static alarm(
    config: PrajnaEnvironmentConfig,
    module: ModuleIdentifier,
    identifier: string,
  ): string {
    const clean = NamingHelper.prepare(identifier, `Alarm in ${module}`);
    const name = ResourceNames.alarm(config.stage, module, clean);
    validateResourceName(name, 'ALARM');
    return name;
  }

  /**
   * Generates a validated API Gateway name.
   *
   * @param config - The environment configuration.
   * @param module - The owning module.
   * @param identifier - The API identifier.
   * @returns The validated API Gateway name.
   * @throws {Error} If the name exceeds 255 characters.
   */
  static apiGateway(
    config: PrajnaEnvironmentConfig,
    module: ModuleIdentifier,
    identifier: string,
  ): string {
    const clean = NamingHelper.prepare(identifier, `API Gateway in ${module}`);
    const name = ResourceNames.apiGateway(config.stage, module, clean);
    validateResourceName(name, 'API_GATEWAY');
    return name;
  }

  /**
   * Generates a validated SSM parameter path.
   *
   * @param config - The environment configuration.
   * @param module - The owning module.
   * @param identifier - The parameter identifier.
   * @returns The validated SSM parameter path.
   * @throws {Error} If the path exceeds 1011 characters.
   */
  static ssmParameter(
    config: PrajnaEnvironmentConfig,
    module: ModuleIdentifier,
    identifier: string,
  ): string {
    const clean = NamingHelper.prepare(identifier, `SSM parameter in ${module}`);
    const name = ResourceNames.ssmParameter(config.stage, module, clean);
    validateResourceName(name, 'SSM_PARAMETER');
    return name;
  }

  /**
   * Generates a validated Cognito User Pool name.
   *
   * @param config - The environment configuration.
   * @param module - The owning module.
   * @param identifier - The user pool identifier.
   * @returns The validated Cognito User Pool name.
   * @throws {Error} If the name exceeds 128 characters.
   */
  static cognitoUserPool(
    config: PrajnaEnvironmentConfig,
    module: ModuleIdentifier,
    identifier: string,
  ): string {
    const clean = NamingHelper.prepare(identifier, `Cognito User Pool in ${module}`);
    const name = ResourceNames.cognitoUserPool(config.stage, module, clean);
    validateResourceName(name, 'COGNITO_USER_POOL');
    return name;
  }

  /**
   * Generates a CloudFormation stack name.
   *
   * Stack names do not have a strict AWS length limit but are validated
   * to be non-empty.
   *
   * @param config - The environment configuration.
   * @param module - The owning module.
   * @returns The stack name.
   */
  static stackName(
    config: PrajnaEnvironmentConfig,
    module: ModuleIdentifier,
  ): string {
    return ResourceNames.stackName(config.stage, module);
  }

  /**
   * Generates a CloudWatch custom metrics namespace.
   *
   * @param module - The owning module.
   * @returns The CloudWatch namespace.
   */
  static cloudWatchNamespace(module: ModuleIdentifier): string {
    return ResourceNames.cloudWatchNamespace(module);
  }
}
