/**
 * @fileoverview Reusable IAM policy statements for AWS Systems Manager Parameter Store.
 *
 * Provides least-privilege SSM policy statements scoped to the platform's
 * parameter path hierarchy: /{app}/{stage}/{module}/*
 *
 * @module foundation/iam/ssm-policy
 */

import * as iam from 'aws-cdk-lib/aws-iam';
import { Stage } from '../config/environment';
import { APPLICATION_NAME } from '../constants/naming';

/**
 * Reusable IAM policy statements for SSM Parameter Store operations.
 */
export class SsmPolicy {

  private constructor() {}

  /**
   * Allows reading SSM parameters scoped to a specific module path.
   *
   * @param accountId - The AWS account ID.
   * @param region - The AWS region.
   * @param stage - The deployment stage.
   * @param modulePath - The module path segment (e.g., "auth", "storage").
   * @returns A policy statement granting SSM read access.
   */
  static readStatement(
    accountId: string,
    region: string,
    stage: Stage,
    modulePath: string,
  ): iam.PolicyStatement {
    const parameterArn = `arn:aws:ssm:${region}:${accountId}:parameter/${APPLICATION_NAME}/${stage}/${modulePath}/*`;

    return new iam.PolicyStatement({
      sid: 'SSMReadParameters',
      effect: iam.Effect.ALLOW,
      actions: [
        'ssm:GetParameter',
        'ssm:GetParameters',
        'ssm:GetParametersByPath',
      ],
      resources: [parameterArn],
    });
  }

  /**
   * Allows writing SSM parameters scoped to a specific module path.
   *
   * @param accountId - The AWS account ID.
   * @param region - The AWS region.
   * @param stage - The deployment stage.
   * @param modulePath - The module path segment.
   * @returns A policy statement granting SSM write access.
   */
  static writeStatement(
    accountId: string,
    region: string,
    stage: Stage,
    modulePath: string,
  ): iam.PolicyStatement {
    const parameterArn = `arn:aws:ssm:${region}:${accountId}:parameter/${APPLICATION_NAME}/${stage}/${modulePath}/*`;

    return new iam.PolicyStatement({
      sid: 'SSMWriteParameters',
      effect: iam.Effect.ALLOW,
      actions: ['ssm:PutParameter', 'ssm:DeleteParameter'],
      resources: [parameterArn],
    });
  }

  /**
   * Allows reading all platform SSM parameters for a given stage.
   *
   * Use sparingly — prefer module-scoped reads.
   *
   * @param accountId - The AWS account ID.
   * @param region - The AWS region.
   * @param stage - The deployment stage.
   * @returns A policy statement granting platform-wide SSM read access.
   */
  static readAllPlatformStatement(
    accountId: string,
    region: string,
    stage: Stage,
  ): iam.PolicyStatement {
    const parameterArn = `arn:aws:ssm:${region}:${accountId}:parameter/${APPLICATION_NAME}/${stage}/*`;

    return new iam.PolicyStatement({
      sid: 'SSMReadAllPlatform',
      effect: iam.Effect.ALLOW,
      actions: [
        'ssm:GetParameter',
        'ssm:GetParameters',
        'ssm:GetParametersByPath',
      ],
      resources: [parameterArn],
    });
  }

  /**
   * Allows describing SSM parameters (metadata only).
   *
   * @deprecated WARNING: This policy uses a wildcard (`*`) resource. Any role
   * with this statement can list and describe EVERY SSM parameter in the account.
   * AWS IAM requires `*` for list actions, but this should only be granted when
   * explicitly required by a service. Standard Lambda functions generally do not
   * need this; they should use `readStatement` to fetch specific values.
   *
   * @returns A policy statement granting describe access.
   */
  static describeStatement(): iam.PolicyStatement {
    return new iam.PolicyStatement({
      sid: 'SSMDescribeParameters',
      effect: iam.Effect.ALLOW,
      actions: ['ssm:DescribeParameters'],
      resources: ['*'],
    });
  }
}
