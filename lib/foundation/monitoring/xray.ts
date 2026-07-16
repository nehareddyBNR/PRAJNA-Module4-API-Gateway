/**
 * @fileoverview X-Ray distributed tracing configuration for the PRAJNA platform.
 *
 * Provides utilities for configuring X-Ray tracing across Lambda functions,
 * API Gateway, and other AWS services. Centralizes X-Ray sampling rules
 * and tracing configuration.
 *
 * @module foundation/monitoring/xray
 */

import * as iam from 'aws-cdk-lib/aws-iam';
import { Tracing } from 'aws-cdk-lib/aws-lambda';
import { PrajnaEnvironmentConfig } from '../config/environment';

// ─────────────────────────────────────────────────────────────────────────────
// X-Ray Configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * X-Ray tracing configuration for the PRAJNA platform.
 */
export class XRayConfig {

  private constructor() {}

  /**
   * Returns the Lambda tracing mode based on environment configuration.
   *
   * @param config - The environment configuration.
   * @returns `Tracing.ACTIVE` if tracing is enabled, otherwise `Tracing.DISABLED`.
   */
  static getLambdaTracing(config: PrajnaEnvironmentConfig): Tracing {
    return config.lambda.tracingEnabled ? Tracing.ACTIVE : Tracing.DISABLED;
  }

  /**
   * Returns whether API Gateway tracing is enabled.
   *
   * @param config - The environment configuration.
   * @returns `true` if API Gateway X-Ray tracing is enabled.
   */
  static isApiTracingEnabled(config: PrajnaEnvironmentConfig): boolean {
    return config.apiGateway.tracingEnabled;
  }

  /**
   * Creates an IAM policy statement granting X-Ray write access.
   *
   * Use this when creating custom IAM roles that need X-Ray permissions
   * (the {@link SharedRole.forLambda} factory includes this automatically).
   *
   * @returns A policy statement granting X-Ray write actions.
   */
  static writeAccessStatement(): iam.PolicyStatement {
    return new iam.PolicyStatement({
      sid: 'XRayWriteAccess',
      effect: iam.Effect.ALLOW,
      actions: [
        'xray:PutTraceSegments',
        'xray:PutTelemetryRecords',
        'xray:GetSamplingRules',
        'xray:GetSamplingTargets',
        'xray:GetSamplingStatisticSummaries',
      ],
      resources: ['*'],
    });
  }

  /**
   * Creates an IAM policy statement granting X-Ray read access.
   *
   * Useful for dashboards or services that need to query trace data.
   *
   * @returns A policy statement granting X-Ray read actions.
   */
  static readAccessStatement(): iam.PolicyStatement {
    return new iam.PolicyStatement({
      sid: 'XRayReadAccess',
      effect: iam.Effect.ALLOW,
      actions: [
        'xray:GetTraceSummaries',
        'xray:BatchGetTraces',
        'xray:GetTraceGraph',
        'xray:GetGroups',
        'xray:GetGroup',
        'xray:GetServiceGraph',
        'xray:GetTimeSeriesServiceStatistics',
        'xray:GetInsight',
        'xray:GetInsightSummaries',
      ],
      resources: ['*'],
    });
  }

  /**
   * Returns environment variables to configure the X-Ray SDK in Lambda.
   *
   * @param config - The environment configuration.
   * @param serviceName - The service name for X-Ray segments.
   * @returns A record of environment variables for X-Ray SDK configuration.
   */
  static getLambdaEnvironment(
    config: PrajnaEnvironmentConfig,
    serviceName: string,
  ): Record<string, string> {
    if (!config.lambda.tracingEnabled) {
      return {};
    }

    return {
      AWS_XRAY_TRACING_NAME: serviceName,
      AWS_XRAY_CONTEXT_MISSING: 'LOG_ERROR',
    };
  }
}
