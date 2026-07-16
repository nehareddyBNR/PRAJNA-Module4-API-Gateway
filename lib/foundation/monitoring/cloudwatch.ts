/**
 * @fileoverview CloudWatch monitoring utilities for the PRAJNA platform.
 *
 * Provides helper functions for creating CloudWatch dashboards, custom
 * metrics, and metric widgets following platform standards.
 *
 * @module foundation/monitoring/cloudwatch
 */

import { Duration } from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { PrajnaEnvironmentConfig } from '../config/environment';
import { ModuleIdentifier } from '../constants/naming';
import { ResourceNames } from '../constants/resource-names';
import { DEFAULT_ALARM_PERIOD, DEFAULT_METRICS_NAMESPACE } from '../constants/defaults';
import { PrajnaTags } from '../tags/tags';

// ─────────────────────────────────────────────────────────────────────────────
// Custom Metric Builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builder for creating custom CloudWatch metrics following platform naming conventions.
 */
export class PrajnaMetric {

  private constructor() {}

  /**
   * Creates a custom CloudWatch metric under the platform namespace.
   *
   * @param module - The owning module.
   * @param metricName - The metric name.
   * @param dimensions - Optional metric dimensions.
   * @param statistic - The statistic to apply.
   * @param period - The metric period.
   * @returns A CloudWatch Metric.
   */
  static custom(
    module: ModuleIdentifier,
    metricName: string,
    dimensions?: Record<string, string>,
    statistic: string = 'Sum',
    period: Duration = DEFAULT_ALARM_PERIOD,
  ): cloudwatch.Metric {
    return new cloudwatch.Metric({
      namespace: ResourceNames.cloudWatchNamespace(module),
      metricName,
      dimensionsMap: {
        Module: module,
        ...dimensions,
      },
      statistic,
      period,
    });
  }

  /**
   * Creates an error count metric for a module.
   *
   * @param module - The owning module.
   * @param functionIdentifier - The function identifier for dimensioning.
   * @returns A CloudWatch Metric tracking error counts.
   */
  static errorCount(module: ModuleIdentifier, functionIdentifier: string): cloudwatch.Metric {
    return PrajnaMetric.custom(module, 'ErrorCount', {
      Function: functionIdentifier,
    });
  }

  /**
   * Creates a latency metric for a module.
   *
   * @param module - The owning module.
   * @param operationName - The operation name for dimensioning.
   * @returns A CloudWatch Metric tracking latency (p99).
   */
  static latency(module: ModuleIdentifier, operationName: string): cloudwatch.Metric {
    return PrajnaMetric.custom(
      module,
      'Latency',
      { Operation: operationName },
      'p99',
    );
  }

  /**
   * Creates an invocation count metric for a module.
   *
   * @param module - The owning module.
   * @param operationName - The operation name.
   * @returns A CloudWatch Metric tracking invocation counts.
   */
  static invocationCount(module: ModuleIdentifier, operationName: string): cloudwatch.Metric {
    return PrajnaMetric.custom(module, 'InvocationCount', {
      Operation: operationName,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builder for creating CloudWatch dashboards following platform standards.
 */
export class PrajnaDashboard {

  private constructor() {}

  /**
   * Creates a module-level CloudWatch dashboard.
   *
   * @param scope - The construct scope.
   * @param id - The construct ID.
   * @param config - The environment configuration.
   * @param module - The owning module.
   * @param widgets - The dashboard widget rows.
   * @returns The CloudWatch Dashboard, or undefined if dashboards are disabled.
   */
  static create(
    scope: Construct,
    id: string,
    config: PrajnaEnvironmentConfig,
    module: ModuleIdentifier,
    widgets: cloudwatch.IWidget[][],
  ): cloudwatch.Dashboard | undefined {
    if (!config.monitoring.dashboardEnabled) {
      return undefined;
    }

    const dashboardName = ResourceNames.dashboard(
      config.stage,
      module,
      'overview',
    );

    const dashboard = new cloudwatch.Dashboard(scope, id, {
      dashboardName,
      defaultInterval: Duration.hours(3),
      widgets: widgets.map((row) => row),
    });

    PrajnaTags.applyToStack(scope, config.stage, module);

    return dashboard;
  }

  /**
   * Creates a standard Lambda function widget row for a dashboard.
   *
   * Shows invocations, errors, duration, and throttles in a single row.
   *
   * @param title - The widget title.
   * @param lambdaFunction - The Lambda function to monitor.
   * @returns An array of widgets forming one dashboard row.
   */
  static lambdaWidgetRow(
    title: string,
    lambdaFunction: lambda.IFunction,
  ): cloudwatch.IWidget[] {
    return [
      new cloudwatch.GraphWidget({
        title: `${title} - Invocations`,
        left: [lambdaFunction.metricInvocations({ period: DEFAULT_ALARM_PERIOD })],
        width: 6,
      }),
      new cloudwatch.GraphWidget({
        title: `${title} - Errors`,
        left: [lambdaFunction.metricErrors({ period: DEFAULT_ALARM_PERIOD })],
        width: 6,
      }),
      new cloudwatch.GraphWidget({
        title: `${title} - Duration`,
        left: [lambdaFunction.metricDuration({ period: DEFAULT_ALARM_PERIOD })],
        width: 6,
      }),
      new cloudwatch.GraphWidget({
        title: `${title} - Throttles`,
        left: [lambdaFunction.metricThrottles({ period: DEFAULT_ALARM_PERIOD })],
        width: 6,
      }),
    ];
  }
}
