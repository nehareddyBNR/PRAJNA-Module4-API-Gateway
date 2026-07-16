/**
 * @fileoverview Pre-built alarm factory for common PRAJNA platform alarm patterns.
 *
 * Provides factory methods for creating standard alarms for Lambda functions,
 * API Gateway, DynamoDB, and S3. Each factory method creates a fully-configured
 * {@link SharedAlarm} with environment-appropriate thresholds.
 *
 * @module foundation/monitoring/alarms
 */

import { Duration } from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import { PrajnaEnvironmentConfig } from '../config/environment';
import { ModuleIdentifier } from '../constants/naming';
import { DEFAULT_ALARM_PERIOD } from '../constants/defaults';
import { SharedAlarm } from '../constructs/shared-alarm';

/**
 * Standard alarm thresholds that scale by environment.
 */
export interface AlarmThresholds {
  /** Lambda error count threshold. */
  readonly lambdaErrors: number;
  /** Lambda throttle count threshold. */
  readonly lambdaThrottles: number;
  /** Lambda duration threshold in milliseconds (p99). */
  readonly lambdaDurationMs: number;
  /** API Gateway 5XX error count threshold. */
  readonly api5xxErrors: number;
  /** API Gateway 4XX error count threshold. */
  readonly api4xxErrors: number;
  /** API Gateway latency threshold in milliseconds (p99). */
  readonly apiLatencyMs: number;
}

/**
 * Returns environment-appropriate alarm thresholds.
 *
 * Production thresholds are tighter because real users are affected.
 * Dev thresholds are relaxed to reduce noise during development.
 *
 * @param config - The environment configuration.
 * @returns Alarm thresholds appropriate for the environment.
 */
export function getAlarmThresholds(config: PrajnaEnvironmentConfig): AlarmThresholds {
  if (config.isProduction) {
    return {
      lambdaErrors: 3,
      lambdaThrottles: 1,
      lambdaDurationMs: 5000,
      api5xxErrors: 5,
      api4xxErrors: 50,
      apiLatencyMs: 3000,
    };
  }

  return {
    lambdaErrors: 10,
    lambdaThrottles: 5,
    lambdaDurationMs: 10000,
    api5xxErrors: 20,
    api4xxErrors: 100,
    apiLatencyMs: 10000,
  };
}

/**
 * Factory for creating standard alarm sets for common AWS resources.
 */
export class AlarmFactory {

  private constructor() {}

  /**
   * Creates a standard set of alarms for a Lambda function.
   *
   * Creates three alarms:
   * - Error count exceeds threshold
   * - Throttle count exceeds threshold
   * - P99 duration exceeds threshold
   *
   * @param scope - The construct scope.
   * @param config - The environment configuration.
   * @param module - The owning module.
   * @param identifier - The function identifier.
   * @param lambdaFunction - The Lambda function to monitor.
   * @param notificationTopic - Optional SNS topic for alarm notifications.
   * @returns An object containing the three alarms.
   */
  static forLambda(
    scope: Construct,
    config: PrajnaEnvironmentConfig,
    module: ModuleIdentifier,
    identifier: string,
    lambdaFunction: lambda.IFunction,
    notificationTopic?: sns.ITopic,
  ): {
    readonly errorAlarm: SharedAlarm;
    readonly throttleAlarm: SharedAlarm;
    readonly durationAlarm: SharedAlarm;
  } {
    const thresholds = getAlarmThresholds(config);

    const errorAlarm = new SharedAlarm(scope, `${identifier}ErrorAlarm`, {
      config,
      module,
      identifier: `${identifier}-errors`,
      description: `Lambda ${identifier} error count exceeds ${thresholds.lambdaErrors}`,
      metric: lambdaFunction.metricErrors({ period: DEFAULT_ALARM_PERIOD }),
      threshold: thresholds.lambdaErrors,
      notificationTopic,
    });

    const throttleAlarm = new SharedAlarm(scope, `${identifier}ThrottleAlarm`, {
      config,
      module,
      identifier: `${identifier}-throttles`,
      description: `Lambda ${identifier} throttle count exceeds ${thresholds.lambdaThrottles}`,
      metric: lambdaFunction.metricThrottles({ period: DEFAULT_ALARM_PERIOD }),
      threshold: thresholds.lambdaThrottles,
      notificationTopic,
    });

    const durationAlarm = new SharedAlarm(scope, `${identifier}DurationAlarm`, {
      config,
      module,
      identifier: `${identifier}-duration`,
      description: `Lambda ${identifier} p99 duration exceeds ${thresholds.lambdaDurationMs}ms`,
      metric: lambdaFunction.metricDuration({
        period: DEFAULT_ALARM_PERIOD,
        statistic: 'p99',
      }),
      threshold: thresholds.lambdaDurationMs,
      notificationTopic,
    });

    return { errorAlarm, throttleAlarm, durationAlarm };
  }

  /**
   * Creates a standard set of alarms for an API Gateway.
   *
   * Creates two alarms:
   * - 5XX error count exceeds threshold
   * - P99 latency exceeds threshold
   *
   * @param scope - The construct scope.
   * @param config - The environment configuration.
   * @param module - The owning module.
   * @param identifier - The API identifier.
   * @param apiName - The API Gateway REST API name.
   * @param notificationTopic - Optional SNS topic for alarm notifications.
   * @returns An object containing the alarms.
   */
  static forApiGateway(
    scope: Construct,
    config: PrajnaEnvironmentConfig,
    module: ModuleIdentifier,
    identifier: string,
    apiName: string,
    notificationTopic?: sns.ITopic,
  ): {
    readonly error5xxAlarm: SharedAlarm;
    readonly latencyAlarm: SharedAlarm;
  } {
    const thresholds = getAlarmThresholds(config);

    const error5xxAlarm = new SharedAlarm(scope, `${identifier}5xxAlarm`, {
      config,
      module,
      identifier: `${identifier}-5xx`,
      description: `API ${identifier} 5XX error count exceeds ${thresholds.api5xxErrors}`,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: '5XXError',
        dimensionsMap: { ApiName: apiName },
        statistic: 'Sum',
        period: DEFAULT_ALARM_PERIOD,
      }),
      threshold: thresholds.api5xxErrors,
      notificationTopic,
    });

    const latencyAlarm = new SharedAlarm(scope, `${identifier}LatencyAlarm`, {
      config,
      module,
      identifier: `${identifier}-latency`,
      description: `API ${identifier} p99 latency exceeds ${thresholds.apiLatencyMs}ms`,
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ApiGateway',
        metricName: 'Latency',
        dimensionsMap: { ApiName: apiName },
        statistic: 'p99',
        period: DEFAULT_ALARM_PERIOD,
      }),
      threshold: thresholds.apiLatencyMs,
      notificationTopic,
    });

    return { error5xxAlarm, latencyAlarm };
  }
}
