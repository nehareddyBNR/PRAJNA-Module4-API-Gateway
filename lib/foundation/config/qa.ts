/**
 * @fileoverview QA environment configuration for the PRAJNA platform.
 *
 * The QA stage is the pre-production validation gate. Its configuration
 * mirrors production closely enough to produce meaningful integration,
 * load, and user-acceptance test results while remaining cost-efficient
 * and teardown-safe.
 *
 * Key Characteristics:
 * - Resources are still destroyable (DESTROY removal policy).
 * - Alarms enabled to validate alerting pipelines.
 * - S3 versioning and DynamoDB PITR enabled to test data durability workflows.
 * - Cognito password policy matches production strictness.
 * - 30-day log retention for post-mortem analysis.
 * - Higher API throttle limits than dev to simulate realistic traffic.
 *
 * @module foundation/config/qa
 */

import { RemovalPolicy } from 'aws-cdk-lib';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { PrajnaEnvironmentConfig, Stage } from './environment';

/**
 * Complete environment configuration for the PRAJNA QA stage.
 *
 * Update the `account` field in `deploymentTarget` to match your
 * organization's AWS QA account before first deployment.
 */
export const qaConfig: PrajnaEnvironmentConfig = {

  // ── Stage Identity ───────────────────────────────────────────────────────
  stage: Stage.QA,
  environmentName: 'Quality Assurance',
  isProduction: false,

  // ── AWS Target ───────────────────────────────────────────────────────────
  deploymentTarget: {
    account: process.env.CDK_DEFAULT_ACCOUNT ?? '234567890123',
    region: 'ap-south-1',
  },

  // ── Lambda Defaults ──────────────────────────────────────────────────────
  lambda: {
    memorySize: 512,
    timeoutSeconds: 30,
    tracingEnabled: true,
    reservedConcurrency: undefined,
    insightsEnabled: true,
  },

  // ── S3 Defaults ──────────────────────────────────────────────────────────
  s3: {
    versioned: true,
    encryptionEnabled: true,
    blockPublicAccess: true,
    removalPolicy: RemovalPolicy.DESTROY,
    autoDeleteObjects: true,
  },

  // ── DynamoDB Defaults ────────────────────────────────────────────────────
  dynamoDb: {
    pointInTimeRecovery: true,
    removalPolicy: RemovalPolicy.DESTROY,
    contributorInsights: true,
  },

  // ── API Gateway Defaults ─────────────────────────────────────────────────
  apiGateway: {
    throttleRateLimit: 500,
    throttleBurstLimit: 250,
    metricsEnabled: true,
    tracingEnabled: true,
    stageName: Stage.QA,
  },

  // ── Monitoring Defaults ──────────────────────────────────────────────────
  monitoring: {
    logRetention: RetentionDays.ONE_MONTH,
    alarmsEnabled: true,
    dashboardEnabled: true,
    alarmEvaluationPeriods: 3,
    structuredLogging: true,
  },

  // ── Cognito Defaults ─────────────────────────────────────────────────────
  cognito: {
    passwordMinLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireDigits: true,
    requireSymbols: true,
    selfSignUpEnabled: false,
    autoVerifyEmail: true,
    accessTokenValidityHours: 8,
    refreshTokenValidityDays: 7,
  },
};
