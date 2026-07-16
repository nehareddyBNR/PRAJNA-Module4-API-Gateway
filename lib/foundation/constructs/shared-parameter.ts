/**
 * @fileoverview Shared SSM Parameter construct for the PRAJNA platform.
 *
 * This construct standardizes how modules publish resource metadata
 * (ARNs, names, endpoints) to SSM Parameter Store for cross-module
 * discovery. Every parameter follows the platform path hierarchy:
 *   /{app}/{stage}/{module}/{identifier}
 *
 * @example
 * ```typescript
 * new SharedParameter(this, 'UserPoolIdParam', {
 *   config,
 *   module: ModuleIdentifier.AUTH,
 *   identifier: 'user-pool-id',
 *   description: 'Cognito User Pool ID',
 *   value: userPool.userPoolId,
 * });
 * ```
 *
 * @module foundation/constructs/shared-parameter
 */

import { Construct } from 'constructs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { PrajnaEnvironmentConfig } from '../config/environment';
import { ModuleIdentifier } from '../constants/naming';
import { ResourceNames } from '../constants/resource-names';
import { PrajnaTags } from '../tags/tags';
import { requireNonEmpty } from '../utils/validation';

// ─────────────────────────────────────────────────────────────────────────────
// Props Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuration properties for the {@link SharedParameter} construct.
 */
export interface SharedParameterProps {
  /** The environment configuration. */
  readonly config: PrajnaEnvironmentConfig;

  /** The owning module identifier. */
  readonly module: ModuleIdentifier;

  /** The parameter-specific identifier (e.g., "user-pool-id", "bucket-arn"). */
  readonly identifier: string;

  /** Human-readable description of the parameter. */
  readonly description: string;

  /** The parameter value to store. */
  readonly value: string;

  /**
   * The SSM parameter type.
   * @default STRING
   * @deprecated The type property is deprecated in AWS CDK. StringParameter always uses type 'String'.
   */
  readonly type?: ssm.ParameterType;

  /**
   * The SSM parameter tier.
   * @default STANDARD
   */
  readonly tier?: ssm.ParameterTier;
}

// ─────────────────────────────────────────────────────────────────────────────
// Construct
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Platform-standard SSM Parameter construct.
 *
 * Creates an SSM parameter with the platform path hierarchy and tagging.
 * Used by modules to publish resource metadata for cross-module discovery.
 *
 * The parameter path is generated automatically:
 *   `/{app}/{stage}/{module}/{identifier}`
 *
 * Consuming modules read these parameters using the path constants
 * defined in {@link @foundation/constants/ssm-parameters}.
 */
export class SharedParameter extends Construct {

  /** The underlying CDK SSM StringParameter. */
  public readonly parameter: ssm.StringParameter;

  /** The generated parameter name (path). */
  public readonly parameterName: string;

  /** The parameter ARN. */
  public readonly parameterArn: string;

  constructor(scope: Construct, id: string, props: SharedParameterProps) {
    super(scope, id);

    // ── Validation ───────────────────────────────────────────────────────
    requireNonEmpty(props.identifier, 'SharedParameter identifier');
    requireNonEmpty(props.description, 'SharedParameter description');

    // ── Path Generation ──────────────────────────────────────────────────
    this.parameterName = ResourceNames.ssmParameter(
      props.config.stage,
      props.module,
      props.identifier,
    );

    // ── Parameter Creation ───────────────────────────────────────────────
    this.parameter = new ssm.StringParameter(this, 'Parameter', {
      parameterName: this.parameterName,
      description: `[${props.config.stage.toUpperCase()}] ${props.description}`,
      stringValue: props.value,
      tier: props.tier ?? ssm.ParameterTier.STANDARD,
    });

    this.parameterArn = this.parameter.parameterArn;

    // ── Tagging ──────────────────────────────────────────────────────────
    PrajnaTags.applyToStack(this, props.config.stage, props.module);
  }

  /**
   * Grants the given principal permission to read this parameter.
   *
   * @param grantee - The principal to grant read access to.
   */
  grantRead(grantee: import('aws-cdk-lib/aws-iam').IGrantable): void {
    this.parameter.grantRead(grantee);
  }

  /**
   * Grants the given principal permission to write to this parameter.
   *
   * @param grantee - The principal to grant write access to.
   */
  grantWrite(grantee: import('aws-cdk-lib/aws-iam').IGrantable): void {
    this.parameter.grantWrite(grantee);
  }

  /**
   * Retrieves an SSM parameter value at synth time using a CDK token.
   *
   * This is a convenience method for consuming modules that need to read
   * a parameter published by another module without importing the stack.
   *
   * @param scope - The construct scope.
   * @param id - The construct ID.
   * @param parameterName - The full SSM parameter path.
   * @returns The parameter value as a CDK token (resolved at deploy time).
   */
  static valueFromLookup(scope: Construct, id: string, parameterName: string): string {
    return ssm.StringParameter.valueFromLookup(scope, parameterName);
  }

  /**
   * Creates a CDK token that resolves to the parameter value at deploy time.
   *
   * Use this when you need a deploy-time reference to a parameter created
   * by another stack.
   *
   * @param scope - The construct scope.
   * @param parameterName - The full SSM parameter path.
   * @returns A CDK token representing the parameter value.
   */
  static valueForStringParameter(scope: Construct, parameterName: string): string {
    return ssm.StringParameter.valueForStringParameter(scope, parameterName);
  }
}
