/**
 * @fileoverview Resource name generators for the PRAJNA platform.
 *
 * This file provides deterministic, pure factory functions that produce
 * fully-qualified AWS resource names following the platform naming convention:
 *
 *   Standard:  {app}-{stage}-{module}-{service}-{identifier}
 *   SSM:       /{app}/{stage}/{module}/{identifier}
 *   LogGroup:  /{app}/{stage}/{module}/{service}/{identifier}
 *
 * Every module MUST use these generators instead of constructing resource names
 * manually. This guarantees naming consistency across all 30+ modules and enables
 * cross-module resource discovery via predictable SSM paths.
 *
 * @module foundation/constants/resource-names
 */

import { Stage } from '../config/environment';
import {
  APPLICATION_NAME,
  NAMING_SEPARATOR,
  SSM_PATH_SEPARATOR,
  ServicePrefix,
  ModuleIdentifier,
} from './naming';

/**
 * Centralized resource name generators for all AWS services used by the platform.
 *
 * All methods are static, pure, and deterministic. The same inputs always
 * produce the same output, making resource names predictable and discoverable
 * without runtime lookups.
 *
 * @example
 * ```typescript
 * import { ResourceNames } from '@foundation/constants';
 * import { Stage } from '@foundation/config';
 * import { ModuleIdentifier } from '@foundation/constants';
 *
 * const fnName = ResourceNames.lambdaFunction(Stage.DEVELOPMENT, ModuleIdentifier.AUTH, 'authorizer');
 * // → "prajna-dev-auth-fn-authorizer"
 *
 * const bucketName = ResourceNames.s3Bucket(Stage.PRODUCTION, ModuleIdentifier.STORAGE, 'documents');
 * // → "prajna-prod-storage-s3-documents"
 * ```
 */
export class ResourceNames {

  /** This class is not instantiable — all methods are static. */
  private constructor() {}

  // ── Core Name Builder ──────────────────────────────────────────────────

  /**
   * Builds a standard resource name following the platform convention.
   *
   * Pattern: `{app}-{stage}-{module}-{servicePrefix}-{identifier}`
   *
   * @param stage - The deployment stage.
   * @param module - The owning module identifier.
   * @param servicePrefix - The AWS service short code.
   * @param identifier - The resource-specific identifier.
   * @returns The fully-qualified resource name.
   */
  private static buildName(
    stage: Stage,
    module: ModuleIdentifier,
    servicePrefix: ServicePrefix,
    identifier: string,
    accountSuffix?: string,
  ): string {
    const parts = [
      APPLICATION_NAME,
      stage,
      module,
      servicePrefix,
      identifier,
    ];
    if (accountSuffix) {
      parts.push(accountSuffix);
    }
    return parts.join(NAMING_SEPARATOR);
  }

  /**
   * Builds an SSM parameter path following the platform convention.
   *
   * Pattern: `/{app}/{stage}/{module}/{identifier}`
   *
   * @param stage - The deployment stage.
   * @param module - The owning module identifier.
   * @param identifier - The parameter-specific identifier.
   * @returns The fully-qualified SSM parameter path.
   */
  private static buildSsmPath(
    stage: Stage,
    module: ModuleIdentifier,
    identifier: string,
  ): string {
    return [
      '',
      APPLICATION_NAME,
      stage,
      module,
      identifier,
    ].join(SSM_PATH_SEPARATOR);
  }

  /**
   * Builds a CloudWatch log group name following AWS conventions.
   *
   * Pattern: `/{app}/{stage}/{module}/{service}/{identifier}`
   *
   * @param stage - The deployment stage.
   * @param module - The owning module identifier.
   * @param servicePrefix - The AWS service short code.
   * @param identifier - The log-group-specific identifier.
   * @returns The fully-qualified log group name.
   */
  private static buildLogGroupName(
    stage: Stage,
    module: ModuleIdentifier,
    servicePrefix: ServicePrefix,
    identifier: string,
  ): string {
    return [
      '',
      APPLICATION_NAME,
      stage,
      module,
      servicePrefix,
      identifier,
    ].join(SSM_PATH_SEPARATOR);
  }

  // ── Lambda ─────────────────────────────────────────────────────────────

  /**
   * Generates a Lambda function name.
   *
   * @example `prajna-dev-auth-fn-authorizer`
   */
  static lambdaFunction(stage: Stage, module: ModuleIdentifier, identifier: string): string {
    return ResourceNames.buildName(stage, module, ServicePrefix.LAMBDA, identifier);
  }

  /**
   * Generates a Lambda layer name.
   *
   * @example `prajna-dev-foundation-layer-shared-utils`
   */
  static lambdaLayer(stage: Stage, module: ModuleIdentifier, identifier: string): string {
    return ResourceNames.buildName(stage, module, ServicePrefix.LAMBDA_LAYER, identifier);
  }

  // ── S3 ─────────────────────────────────────────────────────────────────

  /**
   * Generates an S3 bucket name.
   *
   * Note: S3 bucket names are globally unique. We append the AWS account ID
   * to guarantee uniqueness across all AWS customers and regions.
   *
   * @example `prajna-dev-storage-s3-documents-123456789012`
   */
  static s3Bucket(stage: Stage, module: ModuleIdentifier, identifier: string, accountId: string): string {
    return ResourceNames.buildName(stage, module, ServicePrefix.S3, identifier, accountId);
  }

  // ── DynamoDB ───────────────────────────────────────────────────────────

  /**
   * Generates a DynamoDB table name.
   *
   * @example `prajna-dev-research-table-publications`
   */
  static dynamoDbTable(stage: Stage, module: ModuleIdentifier, identifier: string): string {
    return ResourceNames.buildName(stage, module, ServicePrefix.DYNAMODB, identifier);
  }

  // ── API Gateway ────────────────────────────────────────────────────────

  /**
   * Generates an API Gateway REST API name.
   *
   * @example `prajna-dev-api-api-faculty`
   */
  static apiGateway(stage: Stage, module: ModuleIdentifier, identifier: string): string {
    return ResourceNames.buildName(stage, module, ServicePrefix.API_GATEWAY, identifier);
  }

  // ── IAM ────────────────────────────────────────────────────────────────

  /**
   * Generates an IAM role name.
   *
   * @example `prajna-dev-auth-role-lambda-execution`
   */
  static iamRole(stage: Stage, module: ModuleIdentifier, identifier: string): string {
    return ResourceNames.buildName(stage, module, ServicePrefix.IAM_ROLE, identifier);
  }

  /**
   * Generates an IAM policy name.
   *
   * @example `prajna-dev-auth-policy-cognito-access`
   */
  static iamPolicy(stage: Stage, module: ModuleIdentifier, identifier: string): string {
    return ResourceNames.buildName(stage, module, ServicePrefix.IAM_POLICY, identifier);
  }

  // ── CloudWatch ─────────────────────────────────────────────────────────

  /**
   * Generates a CloudWatch log group name.
   *
   * Uses path separators (`/`) to enable hierarchical browsing in the
   * CloudWatch console.
   *
   * @example `/prajna/dev/auth/fn/authorizer`
   */
  static logGroup(stage: Stage, module: ModuleIdentifier, identifier: string): string {
    return ResourceNames.buildLogGroupName(stage, module, ServicePrefix.LAMBDA, identifier);
  }

  /**
   * Generates a CloudWatch alarm name.
   *
   * @example `prajna-dev-auth-alarm-authorizer-errors`
   */
  static alarm(stage: Stage, module: ModuleIdentifier, identifier: string): string {
    return ResourceNames.buildName(stage, module, ServicePrefix.ALARM, identifier);
  }

  /**
   * Generates a CloudWatch dashboard name.
   *
   * @example `prajna-dev-monitoring-dashboard-platform`
   */
  static dashboard(stage: Stage, module: ModuleIdentifier, identifier: string): string {
    return ResourceNames.buildName(stage, module, ServicePrefix.DASHBOARD, identifier);
  }

  // ── EventBridge ────────────────────────────────────────────────────────

  /**
   * Generates an EventBridge event bus name.
   *
   * @example `prajna-dev-foundation-bus-platform`
   */
  static eventBus(stage: Stage, module: ModuleIdentifier, identifier: string): string {
    return ResourceNames.buildName(stage, module, ServicePrefix.EVENT_BUS, identifier);
  }

  /**
   * Generates an EventBridge rule name.
   *
   * @example `prajna-dev-notification-rule-email-trigger`
   */
  static eventRule(stage: Stage, module: ModuleIdentifier, identifier: string): string {
    return ResourceNames.buildName(stage, module, ServicePrefix.EVENT_RULE, identifier);
  }

  // ── SSM Parameter Store ────────────────────────────────────────────────

  /**
   * Generates an SSM parameter path.
   *
   * Uses forward-slash hierarchy to enable IAM policies scoped to
   * `/prajna/{stage}/{module}/*`.
   *
   * @example `/prajna/dev/auth/user-pool-id`
   */
  static ssmParameter(stage: Stage, module: ModuleIdentifier, identifier: string): string {
    return ResourceNames.buildSsmPath(stage, module, identifier);
  }

  // ── Cognito ────────────────────────────────────────────────────────────

  /**
   * Generates a Cognito User Pool name.
   *
   * @example `prajna-dev-auth-userpool-faculty`
   */
  static cognitoUserPool(stage: Stage, module: ModuleIdentifier, identifier: string): string {
    return ResourceNames.buildName(stage, module, ServicePrefix.COGNITO_USER_POOL, identifier);
  }

  /**
   * Generates a Cognito User Pool Client name.
   *
   * @example `prajna-dev-auth-client-web`
   */
  static cognitoClient(stage: Stage, module: ModuleIdentifier, identifier: string): string {
    return ResourceNames.buildName(stage, module, ServicePrefix.COGNITO_CLIENT, identifier);
  }

  // ── SQS ────────────────────────────────────────────────────────────────

  /**
   * Generates an SQS queue name.
   *
   * @example `prajna-dev-notification-queue-email`
   */
  static sqsQueue(stage: Stage, module: ModuleIdentifier, identifier: string): string {
    return ResourceNames.buildName(stage, module, ServicePrefix.SQS, identifier);
  }

  // ── SNS ────────────────────────────────────────────────────────────────

  /**
   * Generates an SNS topic name.
   *
   * @example `prajna-dev-notification-topic-alerts`
   */
  static snsTopic(stage: Stage, module: ModuleIdentifier, identifier: string): string {
    return ResourceNames.buildName(stage, module, ServicePrefix.SNS, identifier);
  }

  // ── Stack Names ────────────────────────────────────────────────────────

  /**
   * Generates a CloudFormation stack name for a module.
   *
   * Stack names use PascalCase convention to match CDK defaults.
   *
   * @example `Prajna-Dev-Auth`
   */
  static stackName(stage: Stage, module: ModuleIdentifier): string {
    const capitalize = (s: string): string =>
      s.split(NAMING_SEPARATOR).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(NAMING_SEPARATOR);

    return [
      capitalize(APPLICATION_NAME),
      capitalize(stage),
      capitalize(module),
    ].join(NAMING_SEPARATOR);
  }

  // ── CloudWatch Namespace ───────────────────────────────────────────────

  /**
   * Generates a CloudWatch custom metric namespace for a module.
   *
   * @example `Prajna/Auth`
   */
  static cloudWatchNamespace(module: ModuleIdentifier): string {
    const capitalize = (s: string): string =>
      s.charAt(0).toUpperCase() + s.slice(1);

    return `${capitalize(APPLICATION_NAME)}/${capitalize(module)}`;
  }
}
