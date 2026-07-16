/**
 * @fileoverview Shared CloudWatch Log Group construct for the PRAJNA platform.
 *
 * This construct enforces platform logging standards for every log group
 * created across all 30+ modules. It provides:
 * - Hierarchical naming for CloudWatch console browsability
 * - Environment-appropriate retention (1 week dev → 1 year prod)
 * - Consistent removal policies (DESTROY in dev → RETAIN in prod)
 * - Optional KMS encryption for sensitive log data
 *
 * Modules MUST use this construct instead of creating `aws_logs.LogGroup` directly.
 * The {@link SharedLambda} construct creates a SharedLogGroup automatically for
 * each Lambda function.
 *
 * @example
 * ```typescript
 * const logGroup = new SharedLogGroup(this, 'AuthorizerLogs', {
 *   config,
 *   module: ModuleIdentifier.AUTH,
 *   identifier: 'authorizer',
 * });
 * ```
 *
 * @module foundation/constructs/shared-log-group
 */

import { Construct } from 'constructs';
import { RemovalPolicy, Annotations } from 'aws-cdk-lib';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as kms from 'aws-cdk-lib/aws-kms';
import { PrajnaEnvironmentConfig } from '../config/environment';
import { ModuleIdentifier } from '../constants/naming';
import { ResourceNames } from '../constants/resource-names';
import { PrajnaTags } from '../tags/tags';
import { requireNonEmpty } from '../utils/validation';

// ─────────────────────────────────────────────────────────────────────────────
// Props Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuration properties for the {@link SharedLogGroup} construct.
 */
export interface SharedLogGroupProps {
  /** The environment configuration. */
  readonly config: PrajnaEnvironmentConfig;

  /** The owning module identifier. */
  readonly module: ModuleIdentifier;

  /** The log-group-specific identifier (e.g., "authorizer", "upload-handler"). */
  readonly identifier: string;

  /**
   * Override the log retention period from the environment configuration.
   * @default - Uses {@link MonitoringConfig.logRetention} from the environment config.
   */
  readonly retention?: logs.RetentionDays;

  /**
   * Override the removal policy from the environment configuration.
   * @default - DESTROY for non-production, RETAIN for production.
   */
  readonly removalPolicy?: RemovalPolicy;

  /**
   * Optional KMS key for encrypting log data at rest.
   *
   * Recommended for log groups that may contain PII or sensitive
   * faculty data (e.g., auth logs, profile update logs).
   *
   * @default - No encryption (uses CloudWatch Logs default encryption).
   */
  readonly encryptionKey?: kms.IKey;
}

// ─────────────────────────────────────────────────────────────────────────────
// Construct
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Platform-standard CloudWatch Log Group construct.
 *
 * Wraps `aws_logs.LogGroup` with automatic hierarchical naming, environment-
 * appropriate retention, consistent removal policies, and optional KMS encryption.
 *
 * Log group names follow the hierarchical pattern:
 *   `/prajna/{stage}/{module}/fn/{identifier}`
 *
 * This enables:
 * - Tree-based browsing in the CloudWatch console
 * - IAM policies scoped to `/prajna/{stage}/{module}/*`
 * - Metric filter queries across all functions in a module
 */
export class SharedLogGroup extends Construct {

  /** The underlying CDK CloudWatch Log Group. */
  public readonly logGroup: logs.LogGroup;

  /** The generated log group name. */
  public readonly logGroupName: string;

  /** The log group ARN. */
  public readonly logGroupArn: string;

  constructor(scope: Construct, id: string, props: SharedLogGroupProps) {
    super(scope, id);

    // ── Validation ───────────────────────────────────────────────────────
    requireNonEmpty(props.identifier, 'SharedLogGroup identifier');

    // ── Name Generation ──────────────────────────────────────────────────
    this.logGroupName = ResourceNames.logGroup(
      props.config.stage,
      props.module,
      props.identifier,
    );

    // ── Resolve Defaults from Environment Config ─────────────────────────
    const retention = props.retention ?? props.config.monitoring.logRetention;
    const removalPolicy = props.removalPolicy ?? (
      props.config.isProduction ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY
    );

    // ── Production Encryption Check ──────────────────────────────────
    // Faculty PII and audit events may flow into production log groups.
    // KMS encryption is strongly recommended for GDPR/FERPA compliance.
    if (props.config.isProduction && !props.encryptionKey) {
      Annotations.of(this).addWarning(
        `[PRAJNA] SharedLogGroup "${this.logGroupName}" is deployed to production ` +
        'without a KMS encryption key. This log group may contain sensitive data ' +
        '(faculty PII, auth events, document metadata). Provide an encryptionKey ' +
        'for compliance with data protection requirements (GDPR/FERPA).',
      );
    }

    // ── Log Group Creation ───────────────────────────────────────────────
    this.logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName: this.logGroupName,
      retention,
      removalPolicy,
      encryptionKey: props.encryptionKey,
    });

    this.logGroupArn = this.logGroup.logGroupArn;

    // ── Tagging ──────────────────────────────────────────────────────────
    PrajnaTags.applyToStack(this, props.config.stage, props.module);
  }

  /**
   * Grants the given principal permission to write logs to this log group.
   *
   * @param grantee - The principal that needs write access.
   * @returns The log group for chaining.
   */
  grantWrite(grantee: import('aws-cdk-lib/aws-iam').IGrantable): logs.LogGroup {
    this.logGroup.grant(grantee, 'logs:CreateLogStream', 'logs:PutLogEvents');
    return this.logGroup;
  }

  /**
   * Adds a metric filter to this log group.
   *
   * Useful for extracting custom CloudWatch metrics from structured log data.
   *
   * @param id - The construct ID for the metric filter.
   * @param props - The metric filter configuration.
   * @returns The created metric filter.
   *
   * @example
   * ```typescript
   * logGroup.addMetricFilter('ErrorCount', {
   *   filterPattern: logs.FilterPattern.literal('{ $.level = "ERROR" }'),
   *   metricNamespace: 'Prajna/Auth',
   *   metricName: 'AuthorizerErrors',
   *   metricValue: '1',
   * });
   * ```
   */
  addMetricFilter(id: string, props: Omit<logs.MetricFilterProps, 'logGroup'>): logs.MetricFilter {
    return new logs.MetricFilter(this, id, {
      ...props,
      logGroup: this.logGroup,
    });
  }

  /**
   * Adds a subscription filter to this log group.
   *
   * Useful for streaming logs to Lambda, Kinesis, or Elasticsearch.
   *
   * @param id - The construct ID for the subscription filter.
   * @param props - The subscription filter configuration.
   * @returns The created subscription filter.
   */
  addSubscriptionFilter(
    id: string,
    props: Omit<logs.SubscriptionFilterProps, 'logGroup'>,
  ): logs.SubscriptionFilter {
    return new logs.SubscriptionFilter(this, id, {
      ...props,
      logGroup: this.logGroup,
    });
  }

  /**
   * Creates a log group specifically for a Lambda function.
   *
   * Convenience factory that sets the identifier to match the Lambda
   * function name, ensuring the log group and function are discoverable
   * together in CloudWatch.
   *
   * @param scope - The construct scope.
   * @param id - The construct ID.
   * @param props - Log group properties.
   * @returns A new SharedLogGroup configured for a Lambda function.
   */
  static forLambda(
    scope: Construct,
    id: string,
    props: SharedLogGroupProps,
  ): SharedLogGroup {
    return new SharedLogGroup(scope, id, props);
  }

  /**
   * Creates a log group for API Gateway access logs.
   *
   * Uses a distinct naming pattern to separate API access logs from
   * Lambda execution logs in the CloudWatch hierarchy.
   *
   * @param scope - The construct scope.
   * @param id - The construct ID.
   * @param props - Log group properties.
   * @returns A new SharedLogGroup configured for API Gateway access logs.
   */
  static forApiGateway(
    scope: Construct,
    id: string,
    props: Omit<SharedLogGroupProps, 'identifier'> & {
      /** The API identifier (e.g., "faculty-api"). */
      readonly apiIdentifier: string;
    },
  ): SharedLogGroup {
    return new SharedLogGroup(scope, id, {
      ...props,
      identifier: `api-access-${props.apiIdentifier}`,
    });
  }
}
