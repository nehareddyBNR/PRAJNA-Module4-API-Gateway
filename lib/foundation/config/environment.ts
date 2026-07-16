/**
 * @fileoverview Central environment type definitions for the PRAJNA platform.
 *
 * This file establishes the canonical contract that every environment configuration
 * must satisfy. All 30+ modules across the platform import these types to ensure
 * type-safe, consistent infrastructure configuration.
 *
 * Design Decisions:
 * - Stage is an enum to prevent string-based typos in environment selection.
 * - All configuration interfaces use readonly properties to enforce immutability.
 * - Configuration is grouped by AWS service domain (Lambda, S3, DynamoDB, etc.)
 *   to keep concerns separated and make partial lookups ergonomic.
 * - No optional fields on critical configuration — incomplete environments fail
 *   at compile time, not at deployment time.
 *
 * @module foundation/config/environment
 */

import { RemovalPolicy } from 'aws-cdk-lib';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';

// ─────────────────────────────────────────────────────────────────────────────
// Stage Enum
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deployment stages supported by the PRAJNA platform.
 *
 * Each stage maps to a dedicated AWS account (or account partition) and carries
 * distinct infrastructure configuration. The enum value is the canonical
 * lowercase identifier used in resource naming, tagging, and SSM paths.
 */
export enum Stage {
  /** Local development and feature-branch deployments. */
  DEVELOPMENT = 'dev',

  /** Quality assurance and integration testing. */
  QA = 'qa',

  /** Production workloads serving live faculty users. */
  PRODUCTION = 'prod',
}

// ─────────────────────────────────────────────────────────────────────────────
// AWS Account & Region
// ─────────────────────────────────────────────────────────────────────────────

/**
 * AWS deployment target for a given stage.
 *
 * Every stack synthesized by the platform resolves its account and region
 * from this interface rather than relying on ambient CLI credentials.
 */
export interface DeploymentTarget {
  /** The 12-digit AWS account ID (e.g. "123456789012"). */
  readonly account: string;

  /** The AWS region identifier (e.g. "ap-south-1"). */
  readonly region: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lambda Configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Platform-wide Lambda defaults for a given stage.
 *
 * Individual modules may override these via their own construct props,
 * but every Lambda created through {@link SharedLambda} inherits these
 * values unless explicitly overridden.
 */
export interface LambdaConfig {
  /** Default memory allocation in MB. */
  readonly memorySize: number;

  /** Default timeout in seconds. */
  readonly timeoutSeconds: number;

  /** Whether AWS X-Ray active tracing is enabled. */
  readonly tracingEnabled: boolean;

  /** Reserved concurrent executions (undefined = unreserved). */
  readonly reservedConcurrency: number | undefined;

  /** Whether Lambda Insights is enabled for enhanced monitoring. */
  readonly insightsEnabled: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// S3 Configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Platform-wide S3 defaults for a given stage.
 */
export interface S3Config {
  /** Whether versioning is enabled on buckets. */
  readonly versioned: boolean;

  /** Whether server-side encryption with S3-managed keys is enforced. */
  readonly encryptionEnabled: boolean;

  /** Whether public access is blocked at the bucket level. */
  readonly blockPublicAccess: boolean;

  /** CDK removal policy applied to buckets (RETAIN for prod, DESTROY for dev). */
  readonly removalPolicy: RemovalPolicy;

  /** Whether objects are automatically deleted when the bucket is destroyed. */
  readonly autoDeleteObjects: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// DynamoDB Configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Platform-wide DynamoDB defaults for a given stage.
 */
export interface DynamoDbConfig {
  /** Whether point-in-time recovery is enabled. */
  readonly pointInTimeRecovery: boolean;

  /** CDK removal policy applied to tables. */
  readonly removalPolicy: RemovalPolicy;

  /** Whether contributor insights (CloudWatch) are enabled. */
  readonly contributorInsights: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// API Gateway Configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Platform-wide API Gateway defaults for a given stage.
 */
export interface ApiGatewayConfig {
  /** Throttle rate limit (requests per second). */
  readonly throttleRateLimit: number;

  /** Throttle burst limit (maximum concurrent requests). */
  readonly throttleBurstLimit: number;

  /** Whether detailed CloudWatch metrics are enabled. */
  readonly metricsEnabled: boolean;

  /** Whether X-Ray tracing is enabled on the API stage. */
  readonly tracingEnabled: boolean;

  /** API Gateway stage name (matches the deployment stage). */
  readonly stageName: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Monitoring Configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Platform-wide monitoring and observability configuration.
 */
export interface MonitoringConfig {
  /** CloudWatch Logs retention period. */
  readonly logRetention: RetentionDays;

  /** Whether CloudWatch alarms are created for critical metrics. */
  readonly alarmsEnabled: boolean;

  /** Whether the CloudWatch dashboard is provisioned. */
  readonly dashboardEnabled: boolean;

  /** Default alarm evaluation periods. */
  readonly alarmEvaluationPeriods: number;

  /** Whether structured JSON logging is enforced in Lambda functions. */
  readonly structuredLogging: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cognito Configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Platform-wide Cognito configuration for user authentication.
 * Used by Module 3 (Auth) but defined here so environment files
 * can centrally control auth strictness per stage.
 */
export interface CognitoConfig {
  /** Minimum password length. */
  readonly passwordMinLength: number;

  /** Whether passwords require uppercase characters. */
  readonly requireUppercase: boolean;

  /** Whether passwords require lowercase characters. */
  readonly requireLowercase: boolean;

  /** Whether passwords require digits. */
  readonly requireDigits: boolean;

  /** Whether passwords require symbols. */
  readonly requireSymbols: boolean;

  /** Whether self-sign-up is enabled. */
  readonly selfSignUpEnabled: boolean;

  /** Whether email verification is required. */
  readonly autoVerifyEmail: boolean;

  /** Token validity duration in hours (access token). */
  readonly accessTokenValidityHours: number;

  /** Token validity duration in days (refresh token). */
  readonly refreshTokenValidityDays: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Top-Level Environment Configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Complete environment configuration for a PRAJNA deployment stage.
 *
 * This is the master interface that every environment file (`dev.ts`, `qa.ts`,
 * `prod.ts`) must fully implement. The Foundation Stack reads from this to
 * configure shared infrastructure, and every downstream module receives the
 * relevant subset.
 *
 * @example
 * ```typescript
 * import { PrajnaEnvironmentConfig, Stage } from '@foundation/config';
 *
 * const config: PrajnaEnvironmentConfig = getEnvironmentConfig(Stage.DEVELOPMENT);
 * new FoundationStack(app, 'FoundationStack', { config });
 * ```
 */
export type EnvironmentConfig = PrajnaEnvironmentConfig;

export interface PrajnaEnvironmentConfig {
  /** The deployment stage. */
  readonly stage: Stage;

  /** Human-readable environment name for logging and dashboards. */
  readonly environmentName: string;

  /** AWS account and region target. */
  readonly deploymentTarget: DeploymentTarget;

  /** Whether this is a production environment (enables safety guards). */
  readonly isProduction: boolean;

  /** Lambda function defaults. */
  readonly lambda: LambdaConfig;

  /** S3 bucket defaults. */
  readonly s3: S3Config;

  /** DynamoDB table defaults. */
  readonly dynamoDb: DynamoDbConfig;

  /** API Gateway defaults. */
  readonly apiGateway: ApiGatewayConfig;

  /** Monitoring and observability defaults. */
  readonly monitoring: MonitoringConfig;

  /** Cognito authentication defaults. */
  readonly cognito: CognitoConfig;
}
