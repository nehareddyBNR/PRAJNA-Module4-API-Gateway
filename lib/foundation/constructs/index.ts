/**
 * @fileoverview Barrel export for the PRAJNA platform shared constructs.
 *
 * @example
 * ```typescript
 * import {
 *   SharedLambda, SharedLambdaProps,
 *   SharedBucket, SharedBucketProps,
 *   SharedRole, SharedRoleProps,
 *   SharedApi, SharedApiProps,
 *   SharedLogGroup, SharedLogGroupProps,
 *   SharedParameter, SharedParameterProps,
 *   SharedAlarm, SharedAlarmProps,
 * } from '@foundation/constructs';
 * ```
 *
 * @module foundation/constructs
 */

export { SharedRole, type SharedRoleProps } from './shared-role';
export { SharedLogGroup, type SharedLogGroupProps } from './shared-log-group';
export { SharedLambda, type SharedLambdaProps } from './shared-lambda';
export { SharedBucket, SharedBucket as default, type SharedBucketProps, type SharedBucketLifecycleRule } from './shared-bucket';
export { SharedApi, type SharedApiProps } from './shared-api';
export { SharedParameter, type SharedParameterProps } from './shared-parameter';
export { SharedAlarm, type SharedAlarmProps } from './shared-alarm';
