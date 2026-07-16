/**
 * @fileoverview Barrel export for the PRAJNA platform monitoring layer.
 *
 * @example
 * ```typescript
 * import { PrajnaMetric, PrajnaDashboard, XRayConfig, AlarmFactory } from '@foundation/monitoring';
 * ```
 *
 * @module foundation/monitoring
 */

export { PrajnaMetric, PrajnaDashboard } from './cloudwatch';
export { XRayConfig } from './xray';
export { AlarmFactory, getAlarmThresholds, type AlarmThresholds } from './alarms';
