/**
 * @fileoverview SSM Parameter Store path registry for cross-module resource discovery.
 *
 * This is the platform's service discovery contract. When Module 3 (Auth)
 * creates a Cognito User Pool, it stores the pool ID at the path defined here.
 * When Module 9 (Research) needs that pool ID to validate tokens, it reads
 * from the exact same path reference — eliminating mismatched-path bugs.
 *
 * Rules:
 * 1. Every SSM parameter published by a module MUST have its path registered here.
 * 2. Modules MUST NOT construct SSM paths manually — always import from this file.
 * 3. Paths follow the hierarchy: /{app}/{stage}/{module}/{parameter-name}
 * 4. Path functions accept a {@link Stage} to generate environment-specific paths.
 *
 * @module foundation/constants/ssm-parameters
 */

import { Stage } from '../config/environment';
import { ResourceNames } from './resource-names';
import { ModuleIdentifier } from './naming';

// ─────────────────────────────────────────────────────────────────────────────
// Foundation Parameters (Module 1)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SSM parameter paths published by the Foundation module.
 *
 * These parameters expose platform-level configuration that every module
 * may need, such as the deployment stage and the platform event bus ARN.
 */
export class FoundationParameters {

  private constructor() {}

  /** The active deployment stage identifier. */
  static stage(stage: Stage): string {
    return ResourceNames.ssmParameter(stage, ModuleIdentifier.FOUNDATION, 'stage');
  }

  /** The platform-wide EventBridge event bus name. */
  static eventBusName(stage: Stage): string {
    return ResourceNames.ssmParameter(stage, ModuleIdentifier.FOUNDATION, 'event-bus-name');
  }

  /** The platform-wide EventBridge event bus ARN. */
  static eventBusArn(stage: Stage): string {
    return ResourceNames.ssmParameter(stage, ModuleIdentifier.FOUNDATION, 'event-bus-arn');
  }

  /** The platform version deployed. */
  static platformVersion(stage: Stage): string {
    return ResourceNames.ssmParameter(stage, ModuleIdentifier.FOUNDATION, 'platform-version');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Authentication Parameters (Module 3)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SSM parameter paths published by the Authentication module.
 *
 * These parameters are consumed by every module that needs to authenticate
 * requests, validate JWT tokens, or look up user identities. This is the
 * most widely consumed set of parameters in the platform.
 */
export class AuthParameters {

  private constructor() {}

  /** The Cognito User Pool ID. */
  static userPoolId(stage: Stage): string {
    return ResourceNames.ssmParameter(stage, ModuleIdentifier.AUTH, 'user-pool-id');
  }

  /** The Cognito User Pool ARN. */
  static userPoolArn(stage: Stage): string {
    return ResourceNames.ssmParameter(stage, ModuleIdentifier.AUTH, 'user-pool-arn');
  }

  /** The Cognito User Pool Client ID (web application client). */
  static userPoolClientId(stage: Stage): string {
    return ResourceNames.ssmParameter(stage, ModuleIdentifier.AUTH, 'user-pool-client-id');
  }

  /** The Cognito User Pool domain (for hosted UI). */
  static userPoolDomain(stage: Stage): string {
    return ResourceNames.ssmParameter(stage, ModuleIdentifier.AUTH, 'user-pool-domain');
  }

  /**
   * The Lambda Authorizer function ARN.
   *
   * @note Path corrected 2026-06-27 — deployed infra (lib/auth/authorizer.ts:80)
   * uses identifier `authorizer-lambda-arn`, not `authorizer-function-arn`.
   */
  static authorizerFunctionArn(stage: Stage): string {
    return ResourceNames.ssmParameter(stage, ModuleIdentifier.AUTH, 'authorizer-lambda-arn');
  }

  /** The Cognito Identity Pool ID (if applicable). */
  static identityPoolId(stage: Stage): string {
    return ResourceNames.ssmParameter(stage, ModuleIdentifier.AUTH, 'identity-pool-id');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// API Gateway Parameters (Module 4)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SSM parameter paths published by the API Gateway module.
 *
 * Consumed by every module that registers API routes or needs to
 * construct full endpoint URLs.
 */
export class ApiParameters {

  private constructor() {}

  /** The API Gateway REST API ID. */
  static apiId(stage: Stage): string {
    return ResourceNames.ssmParameter(stage, ModuleIdentifier.API, 'api-id');
  }

  /** The API Gateway root resource ID. */
  static rootResourceId(stage: Stage): string {
    return ResourceNames.ssmParameter(stage, ModuleIdentifier.API, 'root-resource-id');
  }

  /** The API Gateway invoke URL. */
  static apiEndpoint(stage: Stage): string {
    return ResourceNames.ssmParameter(stage, ModuleIdentifier.API, 'api-endpoint');
  }

  /** The API Gateway execution ARN (for Lambda permissions). */
  static apiExecutionArn(stage: Stage): string {
    return ResourceNames.ssmParameter(stage, ModuleIdentifier.API, 'api-execution-arn');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Database Parameters (Module 5)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SSM parameter paths published by the Database module.
 *
 * Consumed by business modules that read/write to shared DynamoDB tables.
 */
export class DatabaseParameters {

  private constructor() {}

  /** The primary data table name. */
  static primaryTableName(stage: Stage): string {
    return ResourceNames.ssmParameter(stage, ModuleIdentifier.DATABASE, 'primary-table-name');
  }

  /** The primary data table ARN. */
  static primaryTableArn(stage: Stage): string {
    return ResourceNames.ssmParameter(stage, ModuleIdentifier.DATABASE, 'primary-table-arn');
  }

  /** The GSI index name for query patterns. */
  static gsiIndexName(stage: Stage, indexName: string): string {
    return ResourceNames.ssmParameter(stage, ModuleIdentifier.DATABASE, `gsi-${indexName}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage Parameters (Module 6)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SSM parameter paths published by the Storage module.
 *
 * Consumed by Research, FDP, Awards, APAR, Teaching, and many other modules
 * that need to upload or download documents from the platform document vault.
 */
export class StorageParameters {

  private constructor() {}

  /**
   * The document storage S3 bucket name.
   *
   * @note Path corrected 2026-06-27 — deployed infra (lib/storage/outputs.ts:65)
   * uses identifier `documents-bucket-name` (plural), not `document-bucket-name`.
   */
  static documentBucketName(stage: Stage): string {
    return ResourceNames.ssmParameter(stage, ModuleIdentifier.STORAGE, 'documents-bucket-name');
  }

  /**
   * The document storage S3 bucket ARN.
   *
   * @note Path corrected 2026-06-27 — deployed infra (lib/storage/outputs.ts:73)
   * uses identifier `documents-bucket-arn` (plural), not `document-bucket-arn`.
   */
  static documentBucketArn(stage: Stage): string {
    return ResourceNames.ssmParameter(stage, ModuleIdentifier.STORAGE, 'documents-bucket-arn');
  }

  /**
   * The upload pre-signed URL generator Lambda function ARN.
   *
   * @note Path corrected 2026-06-29 — deployed infra (lib/storage/api.ts:114)
   * uses identifier `upload-lambda-arn`, not `upload-function-arn`.
   */
  static uploadFunctionArn(stage: Stage): string {
    return ResourceNames.ssmParameter(stage, ModuleIdentifier.STORAGE, 'upload-lambda-arn');
  }

  /**
   * The download pre-signed URL generator Lambda function ARN.
   *
   * @note Path corrected 2026-06-29 — deployed infra (lib/storage/api.ts:122)
   * uses identifier `download-lambda-arn`, not `download-function-arn`.
   */
  static downloadFunctionArn(stage: Stage): string {
    return ResourceNames.ssmParameter(stage, ModuleIdentifier.STORAGE, 'download-lambda-arn');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Notification Parameters (Module 16)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SSM parameter paths published by the Notification module.
 *
 * Consumed by modules that need to trigger notifications (email, SMS, push).
 */
export class NotificationParameters {

  private constructor() {}

  /** The notification SNS topic ARN. */
  static topicArn(stage: Stage): string {
    return ResourceNames.ssmParameter(stage, ModuleIdentifier.NOTIFICATION, 'topic-arn');
  }

  /** The notification SQS queue URL. */
  static queueUrl(stage: Stage): string {
    return ResourceNames.ssmParameter(stage, ModuleIdentifier.NOTIFICATION, 'queue-url');
  }

  /** The notification SQS queue ARN. */
  static queueArn(stage: Stage): string {
    return ResourceNames.ssmParameter(stage, ModuleIdentifier.NOTIFICATION, 'queue-arn');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Approval Parameters (Module 13)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SSM parameter paths published by the Approval Workflow module.
 *
 * Consumed by business modules that need to create approval requests,
 * check approval status, or integrate with the workflow engine.
 *
 * Published by Module 13 (Approval) — consumed cross-team by Modules
 * 9 (Research), 10 (Achievements), 11 (FDP), 14 (Score), and others.
 */
export class ApprovalParameters {

  private constructor() {}

  /** The approvals DynamoDB table name. */
  static tableName(stage: Stage): string {
    return ResourceNames.ssmParameter(stage, ModuleIdentifier.APPROVAL, 'approvals-table-name');
  }

  /** The approvals DynamoDB table ARN. */
  static tableArn(stage: Stage): string {
    return ResourceNames.ssmParameter(stage, ModuleIdentifier.APPROVAL, 'approvals-table-arn');
  }

  /** The approval workflow Step Functions state machine ARN. */
  static workflowStateMachineArn(stage: Stage): string {
    return ResourceNames.ssmParameter(stage, ModuleIdentifier.APPROVAL, 'workflow-state-machine-arn');
  }

  /** The create-request Lambda function ARN. */
  static createRequestFunctionArn(stage: Stage): string {
    return ResourceNames.ssmParameter(stage, ModuleIdentifier.APPROVAL, 'create-request-function-arn');
  }

  /** The get-status Lambda function ARN. */
  static getStatusFunctionArn(stage: Stage): string {
    return ResourceNames.ssmParameter(stage, ModuleIdentifier.APPROVAL, 'get-status-function-arn');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregated Export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Namespace aggregating all module-specific SSM parameter path registries.
 *
 * This provides a single entry point for cross-module resource discovery:
 *
 * @example
 * ```typescript
 * import { SsmPaths } from '@foundation/constants';
 * import { Stage } from '@foundation/config';
 *
 * // Module 9 (Research) looking up the Auth user pool:
 * const userPoolId = ssm.StringParameter.valueForStringParameter(
 *   this,
 *   SsmPaths.Auth.userPoolId(Stage.DEVELOPMENT),
 * );
 *
 * // Module 14 (Score) looking up the Storage bucket:
 * const bucketName = ssm.StringParameter.valueForStringParameter(
 *   this,
 *   SsmPaths.Storage.documentBucketName(Stage.PRODUCTION),
 * );
 * ```
 */
export const SsmPaths = {
  Foundation: FoundationParameters,
  Auth: AuthParameters,
  Api: ApiParameters,
  Database: DatabaseParameters,
  Storage: StorageParameters,
  Notification: NotificationParameters,
  Approval: ApprovalParameters,
} as const;
