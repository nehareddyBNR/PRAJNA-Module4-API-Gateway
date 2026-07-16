/**
 * @fileoverview Reusable IAM policy statements for Amazon EventBridge.
 *
 * @module foundation/iam/eventbridge-policy
 */

import * as iam from 'aws-cdk-lib/aws-iam';

/**
 * Reusable IAM policy statements for EventBridge operations.
 */
export class EventBridgePolicy {

  private constructor() {}

  /**
   * Allows publishing events to a specific event bus.
   *
   * @param eventBusArn - The EventBridge event bus ARN.
   * @returns A policy statement granting PutEvents.
   */
  static putEventsStatement(eventBusArn: string): iam.PolicyStatement {
    return new iam.PolicyStatement({
      sid: 'EventBridgePutEvents',
      effect: iam.Effect.ALLOW,
      actions: ['events:PutEvents'],
      resources: [eventBusArn],
    });
  }

  /**
   * Allows managing rules on a specific event bus.
   *
   * @param eventBusArn - The EventBridge event bus ARN.
   * @returns A policy statement granting rule management.
   */
  static manageRulesStatement(eventBusArn: string): iam.PolicyStatement {
    return new iam.PolicyStatement({
      sid: 'EventBridgeManageRules',
      effect: iam.Effect.ALLOW,
      actions: [
        'events:PutRule',
        'events:DeleteRule',
        'events:DescribeRule',
        'events:EnableRule',
        'events:DisableRule',
        'events:ListRules',
        'events:PutTargets',
        'events:RemoveTargets',
        'events:ListTargetsByRule',
      ],
      resources: [eventBusArn, `${eventBusArn}/*`],
    });
  }

  /**
   * Allows describing event buses (read-only discovery).
   *
   * @deprecated WARNING: This policy uses a wildcard (`*`) resource. Any role
   * with this statement can list and describe EVERY EventBridge bus in the account.
   * AWS IAM requires `*` for list actions, but this should only be granted when
   * explicitly required by a service. Do not add this to standard execution roles.
   *
   * @returns A policy statement granting describe access.
   */
  static describeStatement(): iam.PolicyStatement {
    return new iam.PolicyStatement({
      sid: 'EventBridgeDescribe',
      effect: iam.Effect.ALLOW,
      actions: [
        'events:DescribeEventBus',
        'events:ListEventBuses',
      ],
      resources: ['*'],
    });
  }
}
