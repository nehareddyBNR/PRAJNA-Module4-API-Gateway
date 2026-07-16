/**
 * @fileoverview Barrel export for the PRAJNA platform IAM policy layer.
 *
 * @example
 * ```typescript
 * import { S3Policy, DynamoDbPolicy, LambdaPolicy, SsmPolicy, EventBridgePolicy } from '@foundation/iam';
 * ```
 *
 * @module foundation/iam
 */

export { LambdaPolicy } from './lambda-policy';
export { S3Policy } from './s3-policy';
export { DynamoDbPolicy } from './dynamodb-policy';
export { SsmPolicy } from './ssm-policy';
export { EventBridgePolicy } from './eventbridge-policy';
