/**
 * @fileoverview Shared Lambda Function construct for the PRAJNA platform.
 *
 * This is the most widely used construct in the platform. It wraps
 * `aws_lambda.Function` with every platform standard pre-applied:
 *
 * - Node.js 20 runtime (ARM64 Graviton2)
 * - AWS X-Ray active tracing
 * - Structured logging via Powertools environment variables
 * - Dedicated CloudWatch Log Group with environment-appropriate retention
 * - IAM execution role with BasicExecution and X-Ray policies
 * - Platform environment variables merged with module-specific vars
 * - Consistent naming and tagging
 *
 * Modules MUST use this construct instead of creating `aws_lambda.Function`
 * or `aws_lambda_nodejs.NodejsFunction` directly.
 *
 * @example
 * ```typescript
 * const authorizer = new SharedLambda(this, 'Authorizer', {
 *   config,
 *   module: ModuleIdentifier.AUTH,
 *   identifier: 'authorizer',
 *   description: 'JWT token authorizer for API Gateway',
 *   entry: path.join(__dirname, '../../src/auth/authorizer/index.ts'),
 *   handler: 'handler',
 * });
 *
 * // Access the underlying Lambda function:
 * authorizer.function.addEnvironment('USER_POOL_ID', userPoolId);
 * ```
 *
 * @module foundation/constructs/shared-lambda
 */

import * as path from 'path';
import { Construct } from 'constructs';
import { Duration } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { PrajnaEnvironmentConfig } from '../config/environment';
import { ModuleIdentifier } from '../constants/naming';
import { ResourceNames } from '../constants/resource-names';
import {
  DEFAULT_LAMBDA_RUNTIME,
  DEFAULT_LAMBDA_ARCHITECTURE,
  DEFAULT_LAMBDA_TRACING,
  DEFAULT_LAMBDA_ENVIRONMENT,
} from '../constants/defaults';
import { PrajnaTags } from '../tags/tags';
import { requireNonEmpty } from '../utils/validation';
import { SharedRole } from './shared-role';
import { SharedLogGroup } from './shared-log-group';

// ─────────────────────────────────────────────────────────────────────────────
// Props Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuration properties for the {@link SharedLambda} construct.
 */
export interface SharedLambdaProps {
  /** The environment configuration. */
  readonly config: PrajnaEnvironmentConfig;

  /** The owning module identifier. */
  readonly module: ModuleIdentifier;

  /** The function-specific identifier (e.g., "authorizer", "upload-url"). */
  readonly identifier: string;

  /** Human-readable description of the function's purpose. */
  readonly description: string;

  /**
   * Path to the Lambda handler source code entry point.
   *
   * For inline code, use {@link code} instead.
   */
  readonly entry?: string;

  /**
   * The name of the exported handler function.
   * @default "handler"
   */
  readonly handler?: string;

  /**
   * Pre-built Lambda code asset.
   *
   * Use this instead of {@link entry} when providing a pre-packaged
   * code asset (e.g., from `lambda.Code.fromAsset()`).
   */
  readonly code?: lambda.Code;

  /**
   * Override the memory allocation from the environment configuration.
   * @default - Uses {@link LambdaConfig.memorySize} from the environment config.
   */
  readonly memorySize?: number;

  /**
   * Override the timeout from the environment configuration.
   * @default - Uses {@link LambdaConfig.timeoutSeconds} from the environment config.
   */
  readonly timeoutSeconds?: number;

  /**
   * Module-specific environment variables.
   *
   * These are merged with platform defaults. Module-specific variables
   * take precedence over platform defaults.
   *
   * @default - Only platform default environment variables are applied.
   */
  readonly environment?: Record<string, string>;

  /**
   * Override the reserved concurrent executions.
   * @default - Uses {@link LambdaConfig.reservedConcurrency} from the environment config.
   */
  readonly reservedConcurrency?: number;

  /**
   * Lambda layers to attach to the function.
   * @default - No layers attached.
   */
  readonly layers?: lambda.ILayerVersion[];

  /**
   * Additional IAM policy statements to attach to the execution role.
   * @default - Only BasicExecution and X-Ray policies.
   */
  readonly policyStatements?: iam.PolicyStatement[];

  /**
   * Additional managed policies to attach to the execution role.
   * @default - Only BasicExecution and X-Ray managed policies.
   */
  readonly managedPolicies?: iam.IManagedPolicy[];

  /**
   * Whether to use a pre-existing IAM role instead of creating a new one.
   *
   * When provided, the construct skips role creation and uses this role.
   * The caller is responsible for ensuring the role has appropriate permissions.
   *
   * @default - A new SharedRole is created automatically.
   */
  readonly existingRole?: iam.IRole;

  /**
   * Whether to create a dedicated log group for this function.
   *
   * When true (default), a {@link SharedLogGroup} is created with
   * environment-appropriate retention and removal policy. When false,
   * Lambda creates its own log group with INFINITE retention.
   *
   * @default true
   */
  readonly createLogGroup?: boolean;

  /**
   * Dead letter queue for failed async invocations.
   * @default - No dead letter queue.
   */
  readonly deadLetterQueue?: lambda.IDestination;

  /**
   * Event source mappings for the function.
   * @default - No event sources.
   */
  readonly events?: lambda.IEventSource[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Construct
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Platform-standard Lambda Function construct.
 *
 * Creates a Lambda function with all platform standards pre-applied.
 * Internally composes {@link SharedRole} for the execution role and
 * {@link SharedLogGroup} for the dedicated log group.
 *
 * The underlying CDK `Function` is exposed via the {@link function} property
 * for cases where modules need direct access to the native CDK API
 * (e.g., adding event sources, granting permissions).
 */
export class SharedLambda extends Construct {

  /** The underlying CDK Lambda Function. */
  public readonly function: lambda.Function;

  /** The generated function name. */
  public readonly functionName: string;

  /** The function ARN. */
  public readonly functionArn: string;

  /** The IAM execution role (SharedRole wrapper or existing role). */
  public readonly role: iam.IRole;

  /** The dedicated CloudWatch Log Group (if created). */
  public readonly logGroup: SharedLogGroup | undefined;

  constructor(scope: Construct, id: string, props: SharedLambdaProps) {
    super(scope, id);

    // ── Validation ───────────────────────────────────────────────────────
    requireNonEmpty(props.identifier, 'SharedLambda identifier');
    requireNonEmpty(props.description, 'SharedLambda description');

    if (!props.entry && !props.code) {
      throw new Error(
        '[PRAJNA] SharedLambda requires either "entry" (source code path) or ' +
        '"code" (pre-built code asset). Neither was provided.',
      );
    }

    // Guard against TypeScript source files passed as entry points.
    // SharedLambda uses lambda.Code.fromAsset() which uploads the directory
    // as-is — the nodejs20.x runtime cannot execute TypeScript directly.
    // Use a pre-compiled JS directory via the "code" prop instead:
    //   code: lambda.Code.fromAsset('dist/auth/authorizer')
    // Or use the NodejsFunction construct if you need CDK-managed bundling.
    if (props.entry && props.entry.endsWith('.ts') && !props.code) {
      throw new Error(
        `[PRAJNA] SharedLambda "${props.identifier}": The "entry" prop points to ` +
        `a TypeScript file ("${props.entry}"). SharedLambda uses Code.fromAsset() ` +
        'which cannot execute TypeScript with the nodejs20.x runtime. ' +
        'Provide a pre-compiled JavaScript directory via the "code" prop ' +
        '(e.g., lambda.Code.fromAsset("dist/auth/authorizer")), or use the ' +
        'NodejsFunction construct for CDK-managed TypeScript bundling.',
      );
    }

    // ── Name Generation ──────────────────────────────────────────────────
    this.functionName = ResourceNames.lambdaFunction(
      props.config.stage,
      props.module,
      props.identifier,
    );

    // ── Log Group ────────────────────────────────────────────────────────
    const createLogGroup = props.createLogGroup !== false;

    if (createLogGroup) {
      this.logGroup = new SharedLogGroup(this, 'LogGroup', {
        config: props.config,
        module: props.module,
        identifier: props.identifier,
      });
    }

    // ── IAM Role ─────────────────────────────────────────────────────────
    let executionRole: iam.IRole;

    if (props.existingRole) {
      executionRole = props.existingRole;
    } else {
      const sharedRole = SharedRole.forLambda(this, 'ExecutionRole', {
        config: props.config,
        module: props.module,
        identifier: `${props.identifier}-exec`,
        description: `Execution role for ${props.identifier} Lambda function`,
        policyStatements: props.policyStatements,
        managedPolicies: props.managedPolicies,
        xrayEnabled: props.config.lambda.tracingEnabled,
      });
      executionRole = sharedRole.role;
    }

    this.role = executionRole;

    // ── Environment Variables ────────────────────────────────────────────
    const environment: Record<string, string> = {
      ...DEFAULT_LAMBDA_ENVIRONMENT,
      STAGE: props.config.stage,
      MODULE: props.module,
      FUNCTION_NAME: props.identifier,
      POWERTOOLS_SERVICE_NAME: `${props.module}-${props.identifier}`,
      ...(props.environment ?? {}),
    };

    // ── Resolve Configuration ────────────────────────────────────────────
    const memorySize = props.memorySize ?? props.config.lambda.memorySize;
    const timeout = Duration.seconds(
      props.timeoutSeconds ?? props.config.lambda.timeoutSeconds,
    );
    const reservedConcurrency = props.reservedConcurrency ?? props.config.lambda.reservedConcurrency;
    const tracing = props.config.lambda.tracingEnabled
      ? DEFAULT_LAMBDA_TRACING
      : lambda.Tracing.DISABLED;

    // ── Resolve Code Asset ───────────────────────────────────────────────
    const code = props.code ?? (props.entry ? lambda.Code.fromAsset(
      path.dirname(props.entry),
    ) : (() => { throw new Error('[PRAJNA] SharedLambda requires either "entry" or "code".'); })());

    const handler = props.code
      ? (props.handler ?? 'index.handler')
      : (props.entry ? `${path.basename(props.entry, path.extname(props.entry))}.${props.handler ?? 'handler'}` : 'index.handler');

    // ── Lambda Function Creation ─────────────────────────────────────────
    this.function = new lambda.Function(this, 'Function', {
      functionName: this.functionName,
      runtime: DEFAULT_LAMBDA_RUNTIME,
      architecture: DEFAULT_LAMBDA_ARCHITECTURE,
      code,
      handler,
      memorySize,
      timeout,
      tracing,
      role: executionRole,
      environment,
      reservedConcurrentExecutions: reservedConcurrency,
      description: `[${props.config.stage.toUpperCase()}] ${props.description}`,
      logGroup: this.logGroup?.logGroup,
      layers: props.layers,
      ...(props.config.lambda.insightsEnabled && {
        insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_229_0,
      }),
    });

    this.functionArn = this.function.functionArn;

    // ── Event Sources ────────────────────────────────────────────────────
    if (props.events) {
      for (const eventSource of props.events) {
        this.function.addEventSource(eventSource);
      }
    }

    // ── Tagging ──────────────────────────────────────────────────────────
    PrajnaTags.applyToStack(this, props.config.stage, props.module);
  }

  /**
   * Adds an environment variable to the Lambda function.
   *
   * @param key - The environment variable name.
   * @param value - The environment variable value.
   */
  addEnvironment(key: string, value: string): void {
    this.function.addEnvironment(key, value);
  }

  /**
   * Attaches a Lambda layer to the function.
   *
   * @param layer - The layer version to attach.
   */
  addLayer(layer: lambda.ILayerVersion): void {
    this.function.addLayers(layer);
  }

  /**
   * Adds an IAM policy statement to the function's execution role.
   *
   * @param statement - The policy statement to add.
   */
  addToRolePolicy(statement: iam.PolicyStatement): void {
    this.function.addToRolePolicy(statement);
  }

  /**
   * Adds an event source to the Lambda function.
   *
   * @param source - The event source to add.
   */
  addEventSource(source: lambda.IEventSource): void {
    this.function.addEventSource(source);
  }

  /**
   * Grants the given principal permission to invoke this function.
   *
   * @param grantee - The principal to grant invoke permission to.
   * @returns The grant result.
   */
  grantInvoke(grantee: iam.IGrantable): iam.Grant {
    return this.function.grantInvoke(grantee);
  }

  /**
   * Creates a Lambda function alias for traffic shifting.
   *
   * @param aliasName - The alias name (e.g., "live", "canary").
   * @returns The created alias.
   */
  createAlias(aliasName: string): lambda.Alias {
    return new lambda.Alias(this, `Alias-${aliasName}`, {
      aliasName,
      version: this.function.currentVersion,
    });
  }
}
