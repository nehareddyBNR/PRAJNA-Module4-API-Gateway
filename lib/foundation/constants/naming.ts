/**
 * @fileoverview Centralized naming conventions for the PRAJNA platform.
 *
 * This file defines the structural components used to generate consistent
 * resource names across all 30+ modules. The actual name generation logic
 * lives in {@link @foundation/utils/naming-helper}; this file provides the
 * building blocks: application prefix, separator, service identifiers, and
 * AWS service name-length constraints.
 *
 * Naming Pattern:
 *   {app}-{stage}-{module}-{service}-{identifier}
 *
 * Examples:
 *   prajna-dev-auth-fn-authorizer
 *   prajna-prod-storage-s3-documents
 *   prajna-qa-foundation-role-lambda-execution
 *   prajna-dev-research-table-publications
 *
 * Design Decisions:
 * - Hyphen separator chosen for cross-service compatibility (S3, SSM, IAM).
 * - Left-to-right scoping (app → stage → module → service → id) enables
 *   intuitive CloudWatch log group browsing and Cost Explorer filtering.
 * - Service prefix enum prevents string-literal typos across modules.
 * - Max length constants encode AWS service limits for validation.
 *
 * @module foundation/constants/naming
 */

// ─────────────────────────────────────────────────────────────────────────────
// Application Identity
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The canonical application name used as the first segment in every resource name.
 *
 * This value appears in:
 * - Resource names (e.g., `prajna-dev-auth-fn-authorizer`)
 * - CloudWatch namespaces (e.g., `Prajna/Auth`)
 * - SSM parameter paths (e.g., `/prajna/dev/auth/user-pool-id`)
 * - Cost allocation tags
 */
export const APPLICATION_NAME = 'prajna' as const;

/**
 * Human-readable application title for dashboards, descriptions, and documentation.
 */
export const APPLICATION_TITLE = 'PRAJNA - AI Powered Faculty Companion Platform' as const;

/**
 * Separator used between naming segments.
 *
 * Hyphen is chosen because it is:
 * - Valid in S3 bucket names
 * - Valid in CloudWatch log group names
 * - Valid in IAM role/policy names
 * - Readable in the AWS Console
 */
export const NAMING_SEPARATOR = '-' as const;

/**
 * Separator used in SSM Parameter Store paths.
 */
export const SSM_PATH_SEPARATOR = '/' as const;

// ─────────────────────────────────────────────────────────────────────────────
// Service Prefix Identifiers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Short identifiers for AWS service types used in resource naming.
 *
 * These appear as the fourth segment in the naming pattern:
 *   {app}-{stage}-{module}-{SERVICE_PREFIX}-{identifier}
 *
 * @example
 * ```typescript
 * // Lambda:  prajna-dev-auth-fn-authorizer
 * // S3:      prajna-dev-storage-s3-documents
 * // Table:   prajna-dev-research-table-publications
 * // Role:    prajna-dev-auth-role-lambda-execution
 * ```
 */
export enum ServicePrefix {
  /** AWS Lambda function. */
  LAMBDA = 'fn',

  /** Amazon S3 bucket. */
  S3 = 's3',

  /** Amazon DynamoDB table. */
  DYNAMODB = 'table',

  /** Amazon API Gateway REST API. */
  API_GATEWAY = 'api',

  /** AWS IAM role. */
  IAM_ROLE = 'role',

  /** AWS IAM policy. */
  IAM_POLICY = 'policy',

  /** Amazon CloudWatch log group. */
  LOG_GROUP = 'log',

  /** Amazon CloudWatch alarm. */
  ALARM = 'alarm',

  /** Amazon EventBridge event bus. */
  EVENT_BUS = 'bus',

  /** Amazon EventBridge rule. */
  EVENT_RULE = 'rule',

  /** AWS Systems Manager parameter. */
  SSM_PARAMETER = 'param',

  /** Amazon Cognito user pool. */
  COGNITO_USER_POOL = 'userpool',

  /** Amazon Cognito user pool client. */
  COGNITO_CLIENT = 'client',

  /** AWS Lambda layer. */
  LAMBDA_LAYER = 'layer',

  /** Amazon SQS queue. */
  SQS = 'queue',

  /** Amazon SNS topic. */
  SNS = 'topic',

  /** Amazon CloudWatch dashboard. */
  DASHBOARD = 'dashboard',
}

// ─────────────────────────────────────────────────────────────────────────────
// Module Identifiers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical module identifiers used as the third segment in resource names.
 *
 * Every module in the PRAJNA platform has a registered identifier here.
 * This prevents naming collisions and enables cross-module resource discovery
 * via predictable SSM parameter paths.
 *
 * @example
 * ```typescript
 * // prajna-dev-{MODULE_ID}-fn-handler
 * // /prajna/dev/{MODULE_ID}/user-pool-id
 * ```
 */
export enum ModuleIdentifier {
  /** Module 1: CDK Foundation — shared constructs and platform config. */
  FOUNDATION = 'foundation',

  /** Module 2: CI/CD Pipeline. */
  CICD = 'cicd',

  /** Module 3: Authentication & User Management. */
  AUTH = 'auth',

  /** Module 4: API Gateway. */
  API = 'api',

  /** Module 5: Database. */
  DATABASE = 'database',

  /** Module 6: File Storage & Document Vault. */
  STORAGE = 'storage',

  /** Faculty Profile management. */
  PROFILE = 'profile',

  /** Teaching workload management. */
  TEACHING = 'teaching',

  /** Research and publications. */
  RESEARCH = 'research',

  /** Achievements and awards. */
  ACHIEVEMENTS = 'achievements',

  /** Faculty Development Programs. */
  FDP = 'fdp',

  /** Administrative tasks. */
  ADMINISTRATION = 'admin',

  /** Approval engine and workflows. */
  APPROVAL = 'approval',

  /** Reports and analytics. */
  REPORTS = 'reports',

  /** Notifications and alerts. */
  NOTIFICATION = 'notification',

  /** Scoring and evaluation. */
  SCORE = 'score',

  /** Module 15: Leaderboard and rankings. */
  LEADERBOARD = 'leaderboard',

  /** Module 18: Annual Performance Appraisal Report. */
  APAR = 'apar',

  /** AI Career Coach. */
  CAREER_COACH = 'career-coach',

  /** AI Morning Briefing. */
  MORNING_BRIEFING = 'briefing',

  /** AI ToDo Engine. */
  TODO = 'todo',

  /** Dashboards. */
  DASHBOARD = 'dashboard',

  /** Platform monitoring. */
  MONITORING = 'monitoring',

  /** Security and compliance. */
  SECURITY = 'security',

  /** Data migration. */
  MIGRATION = 'migration',
}

// ─────────────────────────────────────────────────────────────────────────────
// AWS Service Name Length Limits
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maximum character lengths for AWS resource names, per service.
 *
 * These limits are used by the naming helper and validation utilities to
 * ensure generated names do not exceed AWS API constraints. Exceeding
 * these limits causes deployment failures that are difficult to debug
 * from CloudFormation error messages alone.
 */
export const ResourceNameMaxLength = {
  /** S3 bucket names: 3–63 characters. */
  S3_BUCKET: 63,

  /** Lambda function names: max 64 characters. */
  LAMBDA_FUNCTION: 64,

  /** IAM role names: max 64 characters. */
  IAM_ROLE: 64,

  /** IAM policy names: max 128 characters. */
  IAM_POLICY: 128,

  /** DynamoDB table names: max 255 characters. */
  DYNAMODB_TABLE: 255,

  /** CloudWatch log group names: max 512 characters. */
  LOG_GROUP: 512,

  /** CloudWatch alarm names: max 255 characters. */
  ALARM: 255,

  /** SSM parameter names: max 1011 characters (including hierarchy). */
  SSM_PARAMETER: 1011,

  /** API Gateway REST API names: max 255 characters. */
  API_GATEWAY: 255,

  /** EventBridge rule names: max 64 characters. */
  EVENT_RULE: 64,

  /** Cognito User Pool names: max 128 characters. */
  COGNITO_USER_POOL: 128,

  /** SQS queue names: max 80 characters. */
  SQS_QUEUE: 80,

  /** SNS topic names: max 256 characters. */
  SNS_TOPIC: 256,
} as const;

/**
 * Type representing the keys of {@link ResourceNameMaxLength}.
 * Used by the validation layer to accept any supported service type.
 */
export type ResourceNameService = keyof typeof ResourceNameMaxLength;
