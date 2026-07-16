/**
 * @fileoverview Shared S3 Bucket construct for the PRAJNA platform.
 *
 * This construct enforces platform S3 standards for every bucket created
 * across all modules:
 *
 * - Public access is ALWAYS blocked (no override)
 * - Server-side encryption is ALWAYS enabled
 * - Versioning follows environment configuration
 * - CORS is pre-configured for pre-signed URL workflows
 * - Removal policy follows environment configuration
 * - Consistent naming and tagging
 *
 * Modules MUST use this construct instead of creating `aws_s3.Bucket` directly.
 *
 * @example
 * ```typescript
 * const docBucket = new SharedBucket(this, 'DocumentBucket', {
 *   config,
 *   module: ModuleIdentifier.STORAGE,
 *   identifier: 'documents',
 *   cors: true,
 *   lifecycleRules: [
 *     {
 *       id: 'archive-old-documents',
 *       transitions: [
 *         { storageClass: s3.StorageClass.INFREQUENT_ACCESS, transitionAfter: Duration.days(90) },
 *       ],
 *     },
 *   ],
 * });
 * ```
 *
 * @module foundation/constructs/shared-bucket
 */

import { Construct } from 'constructs';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as iam from 'aws-cdk-lib/aws-iam';
import { PrajnaEnvironmentConfig } from '../config/environment';
import { ModuleIdentifier } from '../constants/naming';
import { ResourceNames } from '../constants/resource-names';
import { PrajnaTags } from '../tags/tags';
import { requireNonEmpty } from '../utils/validation';

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle Rule Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simplified lifecycle rule configuration for the SharedBucket.
 *
 * Wraps the CDK `LifecycleRule` type with sensible defaults to reduce
 * boilerplate for common lifecycle patterns.
 */
export interface SharedBucketLifecycleRule {
  /** Unique identifier for the lifecycle rule. */
  readonly id: string;

  /**
   * Whether the rule is enabled.
   * @default true
   */
  readonly enabled?: boolean;

  /**
   * Object key prefix to scope the rule.
   * @default - Applies to all objects.
   */
  readonly prefix?: string;

  /**
   * Storage class transitions.
   * @default - No transitions.
   */
  readonly transitions?: s3.Transition[];

  /**
   * Number of days after which objects expire (are deleted).
   * @default - Objects do not expire.
   */
  readonly expirationDays?: number;

  /**
   * Number of days after which non-current object versions expire.
   * Only applies when versioning is enabled.
   * @default - Non-current versions do not expire.
   */
  readonly noncurrentVersionExpirationDays?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Props Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuration properties for the {@link SharedBucket} construct.
 */
export interface SharedBucketProps {
  /** The environment configuration. */
  readonly config: PrajnaEnvironmentConfig;

  /** The owning module identifier. */
  readonly module: ModuleIdentifier;

  /** The bucket-specific identifier (e.g., "documents", "exports"). */
  readonly identifier: string;

  /**
   * Whether to enable CORS for pre-signed URL workflows.
   *
   * When enabled, allows GET, PUT, POST, HEAD methods from any origin
   * with common headers. Customize via {@link corsRules} for fine-grained control.
   *
   * @default false
   */
  readonly cors?: boolean;

  /**
   * Custom CORS rules (overrides the default when {@link cors} is true).
   * @default - Default CORS rules for pre-signed URL workflows.
   */
  readonly corsRules?: s3.CorsRule[];

  /**
   * Lifecycle rules for storage class transitions and object expiration.
   * @default - No lifecycle rules.
   */
  readonly lifecycleRules?: SharedBucketLifecycleRule[];

  /**
   * Override versioning from the environment configuration.
   * @default - Uses {@link S3Config.versioned} from the environment config.
   */
  readonly versioned?: boolean;

  /**
   * KMS key for server-side encryption (SSE-KMS).
   *
   * When provided, objects are encrypted with this KMS key.
   * When omitted, S3-managed encryption (SSE-S3) is used.
   *
   * @default - SSE-S3 encryption.
   */
  readonly encryptionKey?: kms.IKey;

  /**
   * Override the removal policy from the environment configuration.
   * @default - DESTROY for non-production, RETAIN for production.
   */
  readonly removalPolicy?: RemovalPolicy;

  /**
   * Whether to enable S3 event notifications.
   *
   * When true, the bucket is configured to allow event notifications
   * (e.g., object-created triggers for virus scanning).
   *
   * @default false
   */
  readonly eventBridgeEnabled?: boolean;

  /**
   * Whether to enforce SSL-only access via bucket policy.
   * @default true
   */
  readonly enforceSSL?: boolean;

  /**
   * Whether to enable S3 access logging.
   *
   * When provided, access logs are written to this target bucket.
   *
   * @default - No access logging.
   */
  readonly serverAccessLogsBucket?: s3.IBucket;

  /**
   * Prefix for server access log objects.
   * @default - No prefix.
   */
  readonly serverAccessLogsPrefix?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Construct
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Platform-standard S3 Bucket construct.
 *
 * Creates an S3 bucket with all platform security and compliance standards
 * pre-applied. Public access is always blocked. Encryption is always enabled.
 * Versioning and removal policies follow the environment configuration.
 *
 * The underlying CDK `Bucket` is exposed via the {@link bucket} property
 * for cases where modules need direct access to the native CDK API.
 */
export class SharedBucket extends Construct {

  /** The underlying CDK S3 Bucket. */
  public readonly bucket: s3.Bucket;

  /** The generated bucket name. */
  public readonly bucketName: string;

  /** The bucket ARN. */
  public readonly bucketArn: string;

  /** The IPv4 DNS name of the specified bucket. */
  public readonly bucketDomainName: string;

  /** The regional domain name of the specified bucket. */
  public readonly bucketRegionalDomainName: string;

  constructor(scope: Construct, id: string, props: SharedBucketProps) {
    super(scope, id);

    // ── Validation ───────────────────────────────────────────────────────
    requireNonEmpty(props.identifier, 'SharedBucket identifier');

    // ── Name Generation ──────────────────────────────────────────────────
    this.bucketName = ResourceNames.s3Bucket(
      props.config.stage,
      props.module,
      props.identifier,
      props.config.deploymentTarget.account,
    );

    // ── Resolve Configuration ────────────────────────────────────────────
    const versioned = props.versioned ?? props.config.s3.versioned;
    const removalPolicy = props.removalPolicy ?? props.config.s3.removalPolicy;
    const autoDeleteObjects = removalPolicy === RemovalPolicy.DESTROY;
    const enforceSSL = props.enforceSSL !== false;

    // ── Encryption ───────────────────────────────────────────────────────
    const encryption = props.encryptionKey
      ? s3.BucketEncryption.KMS
      : s3.BucketEncryption.S3_MANAGED;

    // ── CORS Configuration ───────────────────────────────────────────────
    const corsRules = SharedBucket.buildCorsRules(props);

    // ── Lifecycle Rules ──────────────────────────────────────────────────
    const lifecycleRules = SharedBucket.buildLifecycleRules(props.lifecycleRules);

    // ── Bucket Creation ──────────────────────────────────────────────────
    this.bucket = new s3.Bucket(this, 'Bucket', {
      bucketName: this.bucketName,
      versioned,
      encryption,
      encryptionKey: props.encryptionKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy,
      autoDeleteObjects,
      enforceSSL,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      cors: corsRules,
      lifecycleRules,
      eventBridgeEnabled: props.eventBridgeEnabled ?? false,
      serverAccessLogsBucket: props.serverAccessLogsBucket,
      serverAccessLogsPrefix: props.serverAccessLogsPrefix,
    });

    this.bucketArn = this.bucket.bucketArn;
    this.bucketDomainName = this.bucket.bucketDomainName;
    this.bucketRegionalDomainName = this.bucket.bucketRegionalDomainName;

    // ── Tagging ──────────────────────────────────────────────────────────
    PrajnaTags.applyToStack(this, props.config.stage, props.module);
  }

  /**
   * Builds CORS rules based on props configuration.
   */
  private static buildCorsRules(props: SharedBucketProps): s3.CorsRule[] | undefined {
    if (props.corsRules) {
      return props.corsRules;
    }

    if (props.cors) {
      return [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.HEAD,
          ],
          allowedOrigins: ['*'],
          allowedHeaders: [
            'Content-Type',
            'Content-Disposition',
            'Content-Length',
            'Authorization',
            'x-amz-date',
            'x-amz-security-token',
            'x-amz-content-sha256',
          ],
          exposedHeaders: [
            'ETag',
            'x-amz-request-id',
            'x-amz-id-2',
          ],
          maxAge: 3600,
        },
      ];
    }

    return undefined;
  }

  /**
   * Converts simplified lifecycle rules to CDK lifecycle rule format.
   */
  private static buildLifecycleRules(
    rules?: SharedBucketLifecycleRule[],
  ): s3.LifecycleRule[] | undefined {
    if (!rules || rules.length === 0) {
      return undefined;
    }

    return rules.map((rule) => {
      if (
        (!rule.transitions || rule.transitions.length === 0) &&
        !rule.expirationDays &&
        !rule.noncurrentVersionExpirationDays
      ) {
        throw new Error(
          `[PRAJNA] Invalid lifecycle configuration for rule "${rule.id}": ` +
          'A rule must specify at least one transition or expiration action.',
        );
      }

      return {
        id: rule.id,
        enabled: rule.enabled !== false,
        prefix: rule.prefix,
        transitions: rule.transitions,
        expiration: rule.expirationDays
          ? Duration.days(rule.expirationDays)
          : undefined,
        noncurrentVersionExpiration: rule.noncurrentVersionExpirationDays
          ? Duration.days(rule.noncurrentVersionExpirationDays)
          : undefined,
      };
    });
  }

  // ── Grant Methods ────────────────────────────────────────────────────────

  /**
   * Grants read access to the bucket.
   *
   * @param identity - The principal to grant read access to.
   * @param objectsKeyPattern - Optional key pattern to scope access.
   * @returns The grant result.
   */
  grantRead(identity: iam.IGrantable, objectsKeyPattern?: string): iam.Grant {
    return this.bucket.grantRead(identity, objectsKeyPattern);
  }

  /**
   * Grants write access to the bucket.
   *
   * @param identity - The principal to grant write access to.
   * @param objectsKeyPattern - Optional key pattern to scope access.
   * @returns The grant result.
   */
  grantWrite(identity: iam.IGrantable, objectsKeyPattern?: string): iam.Grant {
    return this.bucket.grantWrite(identity, objectsKeyPattern);
  }

  /**
   * Grants read/write access to the bucket.
   *
   * @param identity - The principal to grant access to.
   * @param objectsKeyPattern - Optional key pattern to scope access.
   * @returns The grant result.
   */
  grantReadWrite(identity: iam.IGrantable, objectsKeyPattern?: string): iam.Grant {
    return this.bucket.grantReadWrite(identity, objectsKeyPattern);
  }

  /**
   * Grants the given principal permission to put objects into the bucket.
   *
   * @param identity - The principal to grant put access to.
   * @param objectsKeyPattern - Optional key pattern to scope access.
   * @returns The grant result.
   */
  grantPut(identity: iam.IGrantable, objectsKeyPattern?: string): iam.Grant {
    return this.bucket.grantPut(identity, objectsKeyPattern);
  }

  /**
   * Grants the given principal permission to delete objects from the bucket.
   *
   * @param identity - The principal to grant delete access to.
   * @param objectsKeyPattern - Optional key pattern to scope access.
   * @returns The grant result.
   */
  grantDelete(identity: iam.IGrantable, objectsKeyPattern?: string): iam.Grant {
    return this.bucket.grantDelete(identity, objectsKeyPattern);
  }

  /**
   * Adds an event notification to the bucket.
   *
   * @param event - The S3 event type to listen for.
   * @param dest - The notification destination.
   * @param filters - Optional key filters.
   */
  addEventNotification(
    event: s3.EventType,
    dest: s3.IBucketNotificationDestination,
    ...filters: s3.NotificationKeyFilter[]
  ): void {
    this.bucket.addEventNotification(event, dest, ...filters);
  }
}
