/**
 * @fileoverview Production environment configuration for the PRAJNA platform.
 *
 * This is the most critical configuration file in the platform. Every setting
 * is tuned for maximum data durability, security, and operational visibility.
 * Changes to this file should be reviewed by at least two senior engineers.
 *
 * Key Characteristics:
 * - Resources are retained on stack deletion (RETAIN removal policy).
 * - S3 buckets cannot be auto-emptied by CDK.
 * - Lambda functions have reserved concurrency to prevent account-wide exhaustion.
 * - Lambda Insights enabled for enhanced operational monitoring.
 * - All alarms and dashboards are active.
 * - 1-year log retention for compliance and audit requirements.
 * - Strict Cognito password policy (14 chars, all complexity classes).
 * - Short access token validity (1 hour) for session security.
 * - Self-signup disabled — users are provisioned by administrators.
 *
 * @module foundation/config/prod
 */

import { RemovalPolicy } from 'aws-cdk-lib';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { PrajnaEnvironmentConfig, Stage } from './environment';

/**
 * Complete environment configuration for the PRAJNA Production stage.
 *
 * ⚠️  WARNING: Modifying this file affects live faculty users.
 * All changes must pass peer review and be deployed through the CI/CD pipeline.
 *
 * Update the `account` field in `deploymentTarget` to match your
 * organization's AWS production account before first deployment.
 */
export const prodConfig: PrajnaEnvironmentConfig = {

  // ── Stage Identity ───────────────────────────────────────────────────────
  stage: Stage.PRODUCTION,
  environmentName: 'Production',
  isProduction: true,

  // ── AWS Target ───────────────────────────────────────────────────────────
  deploymentTarget: {
    account: process.env.CDK_DEFAULT_ACCOUNT ?? '345678901234',
    region: 'ap-south-1',
  },

  // ── Lambda Defaults ──────────────────────────────────────────────────────
  lambda: {
    memorySize: 1024,
    timeoutSeconds: 30,
    tracingEnabled: true,
    reservedConcurrency: 100,
    insightsEnabled: true,
  },

  // ── S3 Defaults ──────────────────────────────────────────────────────────
  s3: {
    versioned: true,
    encryptionEnabled: true,
    blockPublicAccess: true,
    removalPolicy: RemovalPolicy.RETAIN,
    autoDeleteObjects: false,
  },

  // ── DynamoDB Defaults ────────────────────────────────────────────────────
  dynamoDb: {
    pointInTimeRecovery: true,
    removalPolicy: RemovalPolicy.RETAIN,
    contributorInsights: true,
  },

  // ── API Gateway Defaults ─────────────────────────────────────────────────
  apiGateway: {
    throttleRateLimit: 1000,
    throttleBurstLimit: 500,
    metricsEnabled: true,
    tracingEnabled: true,
    stageName: Stage.PRODUCTION,
  },

  // ── Monitoring Defaults ──────────────────────────────────────────────────
  monitoring: {
    logRetention: RetentionDays.ONE_YEAR,
    alarmsEnabled: true,
    dashboardEnabled: true,
    alarmEvaluationPeriods: 5,
    structuredLogging: true,
  },

  // ── Cognito Defaults ─────────────────────────────────────────────────────
  cognito: {
    passwordMinLength: 14,
    requireUppercase: true,
    requireLowercase: true,
    requireDigits: true,
    requireSymbols: true,
    selfSignUpEnabled: false,
    autoVerifyEmail: true,
    accessTokenValidityHours: 1,
    refreshTokenValidityDays: 30,
  },
};
