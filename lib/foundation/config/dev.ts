/**
 * @fileoverview Development environment configuration for the PRAJNA platform.
 *
 * This file provides the complete infrastructure configuration for the
 * development stage. Values are tuned for developer productivity, fast
 * iteration, and cost efficiency rather than durability or scale.
 *
 * Key Characteristics:
 * - Resources are disposable (DESTROY removal policy).
 * - Lower memory and timeout defaults to reduce cost.
 * - X-Ray tracing enabled for debugging.
 * - Alarms disabled to avoid noise.
 * - Short log retention (1 week).
 * - Relaxed Cognito policies for testing convenience.
 *
 * @module foundation/config/dev
 */

import { RemovalPolicy } from 'aws-cdk-lib';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { PrajnaEnvironmentConfig, Stage } from './environment';

/**
 * Complete environment configuration for the PRAJNA Development stage.
 *
 * Update the `account` field in `deploymentTarget` to match your
 * organization's AWS development account before first deployment.
 */
export const devConfig: PrajnaEnvironmentConfig = {

  // ── Stage Identity ───────────────────────────────────────────────────────
  stage: Stage.DEVELOPMENT,
  environmentName: 'Development',
  isProduction: false,

  // ── AWS Target ───────────────────────────────────────────────────────────
  deploymentTarget: {
    account: process.env.CDK_DEFAULT_ACCOUNT ?? '123456789012',
    region: 'ap-south-1',
  },

  // ── Lambda Defaults ──────────────────────────────────────────────────────
  lambda: {
    memorySize: 256,
    timeoutSeconds: 30,
    tracingEnabled: true,
    reservedConcurrency: undefined,
    insightsEnabled: false,
  },

  // ── S3 Defaults ──────────────────────────────────────────────────────────
  s3: {
    versioned: false,
    encryptionEnabled: true,
    blockPublicAccess: true,
    removalPolicy: RemovalPolicy.DESTROY,
    autoDeleteObjects: true,
  },

  // ── DynamoDB Defaults ────────────────────────────────────────────────────
  dynamoDb: {
    pointInTimeRecovery: false,
    removalPolicy: RemovalPolicy.DESTROY,
    contributorInsights: false,
  },

  // ── API Gateway Defaults ─────────────────────────────────────────────────
  apiGateway: {
    throttleRateLimit: 100,
    throttleBurstLimit: 50,
    metricsEnabled: true,
    tracingEnabled: true,
    stageName: Stage.DEVELOPMENT,
  },

  // ── Monitoring Defaults ──────────────────────────────────────────────────
  monitoring: {
    logRetention: RetentionDays.ONE_WEEK,
    alarmsEnabled: false,
    dashboardEnabled: false,
    alarmEvaluationPeriods: 1,
    structuredLogging: true,
  },

  // ── Cognito Defaults ─────────────────────────────────────────────────────
  cognito: {
    passwordMinLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireDigits: true,
    requireSymbols: false,
    selfSignUpEnabled: true,
    autoVerifyEmail: true,
    accessTokenValidityHours: 24,
    refreshTokenValidityDays: 7,
  },
};
