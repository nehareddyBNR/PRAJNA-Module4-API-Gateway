/**
 * @fileoverview Reusable IAM policy statements for Lambda functions.
 *
 * This file provides pre-built, least-privilege IAM policy statements for
 * the most common Lambda permissions. Modules import these statements
 * instead of constructing their own PolicyStatement objects.
 *
 * Design Principles:
 * - Always scope to specific resources, never `*` unless unavoidable.
 * - Group statements by AWS service action category.
 * - Accept resource ARNs as parameters to enforce scoping at call site.
 *
 * @module foundation/iam/lambda-policy
 */

import * as iam from 'aws-cdk-lib/aws-iam';

// ─────────────────────────────────────────────────────────────────────────────
// Lambda Invocation Policies
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Policy statements for invoking other Lambda functions.
 */
export class LambdaPolicy {

  private constructor() {}

  /**
   * Allows invoking a specific Lambda function.
   *
   * @param functionArn - The ARN of the Lambda function to invoke.
   * @returns A policy statement granting `lambda:InvokeFunction`.
   */
  static invokeFunctionStatement(functionArn: string): iam.PolicyStatement {
    return new iam.PolicyStatement({
      sid: 'InvokeLambdaFunction',
      effect: iam.Effect.ALLOW,
      actions: ['lambda:InvokeFunction'],
      resources: [functionArn],
    });
  }

  /**
   * Allows getting/listing Lambda functions (read-only discovery).
   *
   * @deprecated WARNING: This policy uses a wildcard (`*`) resource, meaning any role
   * with this statement can read the configuration and environment variables
   * of EVERY Lambda function in the account. Environment variables often
   * contain sensitive secrets.
   *
   * Use {@link scopedReadStatement} instead when the target function ARNs are known.
   * Only use this wildcard statement when building a service that requires
   * account-wide Lambda discovery (e.g., a custom monitoring module) and
   * explicitly document its usage.
   *
   * @returns A policy statement granting Lambda list/get actions account-wide.
   */
  static readOnlyStatement(): iam.PolicyStatement {
    return new iam.PolicyStatement({
      sid: 'LambdaReadOnlyAccountWide',
      effect: iam.Effect.ALLOW,
      actions: [
        'lambda:GetFunction',
        'lambda:ListFunctions',
        'lambda:GetFunctionConfiguration',
      ],
      resources: ['*'],
    });
  }

  /**
   * Allows reading the configuration of specific Lambda functions.
   *
   * This is the secure, least-privilege alternative to {@link readOnlyStatement}.
   * Note that `lambda:ListFunctions` cannot be scoped to specific resources,
   * so it is omitted here.
   *
   * @param functionArns - The ARNs of the Lambda functions to read.
   * @returns A policy statement granting targeted read actions.
   */
  static scopedReadStatement(functionArns: string[]): iam.PolicyStatement {
    return new iam.PolicyStatement({
      sid: 'LambdaScopedRead',
      effect: iam.Effect.ALLOW,
      actions: [
        'lambda:GetFunction',
        'lambda:GetFunctionConfiguration',
      ],
      resources: functionArns,
    });
  }

  /**
   * Allows getting/putting function concurrency configuration.
   *
   * @param functionArn - The ARN of the Lambda function.
   * @returns A policy statement granting concurrency management actions.
   */
  static manageConcurrencyStatement(functionArn: string): iam.PolicyStatement {
    return new iam.PolicyStatement({
      sid: 'ManageLambdaConcurrency',
      effect: iam.Effect.ALLOW,
      actions: [
        'lambda:PutFunctionConcurrency',
        'lambda:GetFunctionConcurrency',
        'lambda:DeleteFunctionConcurrency',
      ],
      resources: [functionArn],
    });
  }

  /**
   * Returns all commonly needed Lambda statements for an orchestrator function
   * that invokes other Lambda functions.
   *
   * @param functionArns - The ARNs of the Lambda functions to invoke.
   * @returns An array of policy statements.
   */
  static orchestratorStatements(functionArns: string[]): iam.PolicyStatement[] {
    return [
      new iam.PolicyStatement({
        sid: 'InvokeLambdaFunctions',
        effect: iam.Effect.ALLOW,
        actions: ['lambda:InvokeFunction', 'lambda:InvokeAsync'],
        resources: functionArns,
      }),
    ];
  }
}
