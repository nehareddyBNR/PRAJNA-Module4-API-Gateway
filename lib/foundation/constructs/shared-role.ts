/**
 * @fileoverview Shared IAM Role construct for the PRAJNA platform.
 *
 * This construct enforces platform IAM standards for every role created
 * across all 30+ modules. It provides:
 * - Consistent naming via {@link ResourceNames}
 * - Automatic platform tagging
 * - Managed policy attachment
 * - Inline policy support
 * - Configurable max session duration
 * - Trust policy enforcement
 *
 * Modules MUST use this construct instead of creating `aws_iam.Role` directly.
 *
 * @example
 * ```typescript
 * const lambdaRole = new SharedRole(this, 'LambdaExecRole', {
 *   config,
 *   module: ModuleIdentifier.AUTH,
 *   identifier: 'lambda-execution',
 *   assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
 *   description: 'Execution role for Auth module Lambda functions',
 *   managedPolicies: [
 *     iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
 *   ],
 * });
 * ```
 *
 * @module foundation/constructs/shared-role
 */

import { Construct } from 'constructs';
import { Duration } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { PrajnaEnvironmentConfig } from '../config/environment';
import { ModuleIdentifier } from '../constants/naming';
import { ResourceNames } from '../constants/resource-names';
import { PrajnaTags } from '../tags/tags';
import { requireNonEmpty } from '../utils/validation';

// ─────────────────────────────────────────────────────────────────────────────
// Props Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuration properties for the {@link SharedRole} construct.
 */
export interface SharedRoleProps {
  /** The environment configuration. */
  readonly config: PrajnaEnvironmentConfig;

  /** The owning module identifier. */
  readonly module: ModuleIdentifier;

  /** The role-specific identifier (e.g., "lambda-execution", "api-invoke"). */
  readonly identifier: string;

  /** The principal that is allowed to assume this role. */
  readonly assumedBy: iam.IPrincipal;

  /** Human-readable description of the role's purpose. */
  readonly description: string;

  /**
   * AWS managed policies to attach to the role.
   * @default - No managed policies attached.
   */
  readonly managedPolicies?: iam.IManagedPolicy[];

  /**
   * Inline policy statements to attach to the role.
   * @default - No inline policies attached.
   */
  readonly inlinePolicies?: Record<string, iam.PolicyDocument>;

  /**
   * Individual policy statements to add to the role's default policy.
   * @default - No additional statements.
   */
  readonly policyStatements?: iam.PolicyStatement[];

  /**
   * Maximum session duration for the role.
   * @default Duration.hours(1)
   */
  readonly maxSessionDuration?: Duration;

  /**
   * The path for the IAM role.
   * @default "/"
   */
  readonly path?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Construct
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Platform-standard IAM Role construct.
 *
 * Wraps `aws_iam.Role` with automatic naming, tagging, and policy attachment.
 * Every module that needs an IAM role should use this construct to ensure
 * consistency across the platform.
 *
 * The underlying CDK `Role` is exposed via the {@link role} property for
 * cases where modules need direct access to the native CDK API.
 */
export class SharedRole extends Construct {

  /** The underlying CDK IAM Role. */
  public readonly role: iam.Role;

  /** The generated role name. */
  public readonly roleName: string;

  /** The role ARN. */
  public readonly roleArn: string;

  constructor(scope: Construct, id: string, props: SharedRoleProps) {
    super(scope, id);

    // ── Validation ───────────────────────────────────────────────────────
    requireNonEmpty(props.identifier, 'SharedRole identifier');
    requireNonEmpty(props.description, 'SharedRole description');

    // ── Name Generation ──────────────────────────────────────────────────
    this.roleName = ResourceNames.iamRole(
      props.config.stage,
      props.module,
      props.identifier,
    );

    // ── Role Creation ────────────────────────────────────────────────────
    this.role = new iam.Role(this, 'Role', {
      roleName: this.roleName,
      assumedBy: props.assumedBy,
      description: `[${props.config.stage.toUpperCase()}] ${props.description}`,
      maxSessionDuration: props.maxSessionDuration ?? Duration.hours(1),
      path: props.path ?? '/',
      inlinePolicies: props.inlinePolicies,
    });

    this.roleArn = this.role.roleArn;

    // ── Managed Policies ─────────────────────────────────────────────────
    if (props.managedPolicies) {
      for (const policy of props.managedPolicies) {
        this.role.addManagedPolicy(policy);
      }
    }

    // ── Inline Policy Statements ─────────────────────────────────────────
    if (props.policyStatements) {
      for (const statement of props.policyStatements) {
        this.role.addToPolicy(statement);
      }
    }

    // ── Tagging ──────────────────────────────────────────────────────────
    PrajnaTags.applyToStack(this, props.config.stage, props.module);
  }

  /**
   * Adds a managed policy to the role.
   *
   * @param policy - The managed policy to attach.
   */
  addManagedPolicy(policy: iam.IManagedPolicy): void {
    this.role.addManagedPolicy(policy);
  }

  /**
   * Adds an inline policy statement to the role.
   *
   * @param statement - The policy statement to add.
   */
  addToPolicy(statement: iam.PolicyStatement): void {
    this.role.addToPolicy(statement);
  }

  /**
   * Grants the specified principal permission to assume this role.
   *
   * @param principal - The principal to grant assume-role permission to.
   * @returns The grant result.
   */
  grantAssumeRole(principal: iam.IPrincipal): iam.Grant {
    return this.role.grantAssumeRole(principal);
  }

  /**
   * Grants the role permission to pass itself to an AWS service.
   *
   * @param grantee - The principal that needs to pass this role.
   * @returns The grant result.
   */
  grantPassRole(grantee: iam.IPrincipal): iam.Grant {
    return this.role.grantPassRole(grantee);
  }

  /**
   * Creates a Lambda-optimized role with the basic execution policy pre-attached.
   *
   * Convenience factory method for the most common role type in the platform.
   *
   * @param scope - The construct scope.
   * @param id - The construct ID.
   * @param props - Role properties (without assumedBy, which is set to Lambda).
   * @returns A new SharedRole configured for Lambda execution.
   */
  static forLambda(
    scope: Construct,
    id: string,
    props: Omit<SharedRoleProps, 'assumedBy'> & {
      /** Whether to attach the X-Ray write policy. @default true */
      readonly xrayEnabled?: boolean;
    },
  ): SharedRole {
    const managedPolicies: iam.IManagedPolicy[] = [
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        'service-role/AWSLambdaBasicExecutionRole',
      ),
      ...(props.managedPolicies ?? []),
    ];

    // Add X-Ray write policy if tracing is enabled
    if (props.xrayEnabled !== false) {
      managedPolicies.push(
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'),
      );
    }

    return new SharedRole(scope, id, {
      ...props,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies,
      maxSessionDuration: props.maxSessionDuration ?? Duration.hours(1),
    });
  }
}
