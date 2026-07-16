/**
 * @fileoverview Shared CloudWatch Alarm construct for the PRAJNA platform.
 *
 * This construct standardizes alarm creation across all modules with
 * consistent naming, tagging, evaluation periods from the environment
 * config, and environment-aware alarm enablement (disabled in dev).
 *
 * @example
 * ```typescript
 * new SharedAlarm(this, 'AuthErrors', {
 *   config,
 *   module: ModuleIdentifier.AUTH,
 *   identifier: 'authorizer-errors',
 *   description: 'Fires when the authorizer Lambda error rate exceeds threshold',
 *   metric: authorizerFunction.metricErrors(),
 *   threshold: 5,
 *   evaluationPeriods: 3,
 *   comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
 * });
 * ```
 *
 * @module foundation/constructs/shared-alarm
 */

import { Construct } from 'constructs';
import { Duration } from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import { PrajnaEnvironmentConfig } from '../config/environment';
import { ModuleIdentifier } from '../constants/naming';
import { ResourceNames } from '../constants/resource-names';
import { DEFAULT_ALARM_PERIOD } from '../constants/defaults';
import { PrajnaTags } from '../tags/tags';
import { requireNonEmpty } from '../utils/validation';

// ─────────────────────────────────────────────────────────────────────────────
// Props Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuration properties for the {@link SharedAlarm} construct.
 */
export interface SharedAlarmProps {
  /** The environment configuration. */
  readonly config: PrajnaEnvironmentConfig;

  /** The owning module identifier. */
  readonly module: ModuleIdentifier;

  /** The alarm-specific identifier (e.g., "authorizer-errors", "upload-latency"). */
  readonly identifier: string;

  /** Human-readable description of what the alarm monitors. */
  readonly description: string;

  /** The CloudWatch metric to alarm on. */
  readonly metric: cloudwatch.IMetric;

  /** The threshold value that triggers the alarm. */
  readonly threshold: number;

  /**
   * Number of evaluation periods before the alarm fires.
   * @default - Uses {@link MonitoringConfig.alarmEvaluationPeriods} from environment config.
   */
  readonly evaluationPeriods?: number;

  /**
   * The comparison operator for the threshold.
   * @default GREATER_THAN_OR_EQUAL_TO_THRESHOLD
   */
  readonly comparisonOperator?: cloudwatch.ComparisonOperator;

  /**
   * How to treat missing data points.
   *
   * Defaults to `NOT_BREACHING` because for error and throttle alarms,
   * missing data means the function was not invoked — which is not an
   * error condition. Using `MISSING` (the CDK default) would leave the
   * alarm in its previous state, potentially masking a deployment failure
   * where the function stops being invoked entirely.
   *
   * Override with `TreatMissingData.BREACHING` for alarms that must fire
   * when data stops arriving (e.g., heartbeat/watchdog alarms).
   *
   * @default NOT_BREACHING
   */
  readonly treatMissingData?: cloudwatch.TreatMissingData;

  /**
   * The statistic period for the metric.
   * @default Duration.minutes(5)
   */
  readonly period?: Duration;

  /**
   * SNS topic to send alarm notifications to.
   * @default - No notifications sent.
   */
  readonly notificationTopic?: sns.ITopic;

  /**
   * SNS topic to send OK notifications to.
   * @default - No OK notifications sent.
   */
  readonly okTopic?: sns.ITopic;

  /**
   * Override the environment-based alarm enablement.
   *
   * When false, the alarm is created but with `actionsEnabled: false`,
   * preventing notifications. Useful for testing alarm configurations
   * in non-production without triggering alerts.
   *
   * @default - Uses {@link MonitoringConfig.alarmsEnabled} from environment config.
   */
  readonly actionsEnabled?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Construct
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Platform-standard CloudWatch Alarm construct.
 *
 * Creates a CloudWatch alarm with environment-aware configuration:
 * - Alarms are disabled in dev (no notifications)
 * - Evaluation periods scale by environment
 * - Consistent naming and tagging
 *
 * The underlying CDK `Alarm` is exposed via the {@link alarm} property.
 */
export class SharedAlarm extends Construct {

  /** The underlying CDK CloudWatch Alarm. */
  public readonly alarm: cloudwatch.Alarm;

  /** The generated alarm name. */
  public readonly alarmName: string;

  /** The alarm ARN. */
  public readonly alarmArn: string;

  constructor(scope: Construct, id: string, props: SharedAlarmProps) {
    super(scope, id);

    // ── Validation ───────────────────────────────────────────────────────
    requireNonEmpty(props.identifier, 'SharedAlarm identifier');
    requireNonEmpty(props.description, 'SharedAlarm description');

    // ── Name Generation ──────────────────────────────────────────────────
    this.alarmName = ResourceNames.alarm(
      props.config.stage,
      props.module,
      props.identifier,
    );

    // ── Resolve Configuration ────────────────────────────────────────────
    const evaluationPeriods = props.evaluationPeriods
      ?? props.config.monitoring.alarmEvaluationPeriods;
    const actionsEnabled = props.actionsEnabled
      ?? props.config.monitoring.alarmsEnabled;
    const comparisonOperator = props.comparisonOperator
      ?? cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD;
    const treatMissingData = props.treatMissingData
      ?? cloudwatch.TreatMissingData.NOT_BREACHING;

    // ── Alarm Creation ───────────────────────────────────────────────────
    this.alarm = new cloudwatch.Alarm(this, 'Alarm', {
      alarmName: this.alarmName,
      alarmDescription: `[${props.config.stage.toUpperCase()}] ${props.description}`,
      metric: props.metric,
      threshold: props.threshold,
      evaluationPeriods,
      comparisonOperator,
      treatMissingData,
      actionsEnabled,
    });

    this.alarmArn = this.alarm.alarmArn;

    // ── Alarm Actions ────────────────────────────────────────────────────
    if (props.notificationTopic && actionsEnabled) {
      this.alarm.addAlarmAction(
        new cloudwatch_actions.SnsAction(props.notificationTopic),
      );
    }

    if (props.okTopic && actionsEnabled) {
      this.alarm.addOkAction(
        new cloudwatch_actions.SnsAction(props.okTopic),
      );
    }

    // ── Tagging ──────────────────────────────────────────────────────────
    PrajnaTags.applyToStack(this, props.config.stage, props.module);
  }

  /**
   * Adds an alarm action (notification on ALARM state).
   *
   * @param action - The alarm action.
   */
  addAlarmAction(action: cloudwatch.IAlarmAction): void {
    this.alarm.addAlarmAction(action);
  }

  /**
   * Adds an OK action (notification when returning to OK state).
   *
   * @param action - The OK action.
   */
  addOkAction(action: cloudwatch.IAlarmAction): void {
    this.alarm.addOkAction(action);
  }

  /**
   * Creates a standard Lambda error alarm.
   *
   * Convenience factory for the most common alarm type in the platform.
   *
   * @param scope - The construct scope.
   * @param id - The construct ID.
   * @param props - Alarm configuration plus the Lambda function.
   * @returns A new SharedAlarm configured for Lambda errors.
   */
  static forLambdaErrors(
    scope: Construct,
    id: string,
    props: {
      readonly config: PrajnaEnvironmentConfig;
      readonly module: ModuleIdentifier;
      readonly identifier: string;
      readonly lambdaFunction: import('aws-cdk-lib/aws-lambda').IFunction;
      readonly threshold?: number;
      readonly notificationTopic?: sns.ITopic;
    },
  ): SharedAlarm {
    return new SharedAlarm(scope, id, {
      config: props.config,
      module: props.module,
      identifier: `${props.identifier}-errors`,
      description: `Lambda function ${props.identifier} error count exceeds threshold`,
      metric: props.lambdaFunction.metricErrors({
        period: DEFAULT_ALARM_PERIOD,
      }),
      threshold: props.threshold ?? 5,
      notificationTopic: props.notificationTopic,
    });
  }

  /**
   * Creates a standard Lambda throttle alarm.
   *
   * @param scope - The construct scope.
   * @param id - The construct ID.
   * @param props - Alarm configuration plus the Lambda function.
   * @returns A new SharedAlarm configured for Lambda throttles.
   */
  static forLambdaThrottles(
    scope: Construct,
    id: string,
    props: {
      readonly config: PrajnaEnvironmentConfig;
      readonly module: ModuleIdentifier;
      readonly identifier: string;
      readonly lambdaFunction: import('aws-cdk-lib/aws-lambda').IFunction;
      readonly threshold?: number;
      readonly notificationTopic?: sns.ITopic;
    },
  ): SharedAlarm {
    return new SharedAlarm(scope, id, {
      config: props.config,
      module: props.module,
      identifier: `${props.identifier}-throttles`,
      description: `Lambda function ${props.identifier} throttle count exceeds threshold`,
      metric: props.lambdaFunction.metricThrottles({
        period: DEFAULT_ALARM_PERIOD,
      }),
      threshold: props.threshold ?? 3,
      notificationTopic: props.notificationTopic,
    });
  }
}
