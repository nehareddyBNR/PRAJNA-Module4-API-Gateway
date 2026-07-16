/**
 * @fileoverview Barrel export and environment resolver for platform configuration.
 *
 * This module is the single import point for all configuration concerns across
 * the PRAJNA platform. Every stack, construct, and module imports from here
 * rather than reaching into individual config files.
 *
 * Usage:
 * ```typescript
 * import { Stage, getEnvironmentConfig, PrajnaEnvironmentConfig } from '@foundation/config';
 *
 * const config = getEnvironmentConfig(Stage.DEVELOPMENT);
 * ```
 *
 * The {@link getEnvironmentConfig} function uses an exhaustive switch to guarantee
 * that every {@link Stage} variant has a corresponding configuration. Adding a new
 * stage to the enum without providing a config file will cause a compile-time error.
 *
 * @module foundation/config
 */

// ── Type & Interface Re-exports ────────────────────────────────────────────
export {
  Stage,
  DeploymentTarget,
  LambdaConfig,
  S3Config,
  DynamoDbConfig,
  ApiGatewayConfig,
  MonitoringConfig,
  CognitoConfig,
  PrajnaEnvironmentConfig,
  EnvironmentConfig,
} from './environment';

// ── Concrete Configuration Re-exports ──────────────────────────────────────
export { devConfig } from './dev';
export { qaConfig } from './qa';
export { prodConfig } from './prod';

// ── Internal Imports for Resolver ──────────────────────────────────────────
import { Stage, PrajnaEnvironmentConfig } from './environment';
import { devConfig } from './dev';
import { qaConfig } from './qa';
import { prodConfig } from './prod';

/**
 * Resolves the complete environment configuration for the given deployment stage.
 *
 * This is the primary entry point used by the CDK app to obtain stage-specific
 * configuration. The function uses an exhaustive switch statement — if a new
 * {@link Stage} variant is added without a corresponding config, the TypeScript
 * compiler will produce an error at the `assertNever` call.
 *
 * @param stage - The deployment stage to resolve configuration for.
 * @returns The complete, immutable environment configuration for the stage.
 *
 * @throws {Error} If an unrecognized stage value is provided at runtime
 *   (should never happen if TypeScript compilation succeeds).
 *
 * @example
 * ```typescript
 * // In bin/prajna.ts
 * const stage = (process.env.STAGE as Stage) || Stage.DEVELOPMENT;
 * const config = getEnvironmentConfig(stage);
 *
 * new FoundationStack(app, `Prajna-Foundation-${config.stage}`, {
 *   env: {
 *     account: config.deploymentTarget.account,
 *     region: config.deploymentTarget.region,
 *   },
 *   config,
 * });
 * ```
 */
export function getEnvironmentConfig(stage: Stage): PrajnaEnvironmentConfig {
  switch (stage) {
    case Stage.DEVELOPMENT:
      return devConfig;

    case Stage.QA:
      return qaConfig;

    case Stage.PRODUCTION:
      return prodConfig;

    default:
      return assertNever(stage);
  }
}

/**
 * Compile-time exhaustiveness check.
 *
 * If all enum cases are handled, the `default` branch is unreachable and
 * `value` narrows to `never`. If a new enum variant is added without a
 * corresponding case, TypeScript will report a type error here because
 * the new variant cannot be assigned to `never`.
 *
 * @param value - The unhandled enum value (typed as `never` when exhaustive).
 * @throws {Error} Always — this function is a safety net for runtime.
 */
function assertNever(value: never): never {
  throw new Error(
    `[PRAJNA] Unhandled environment stage: "${String(value)}". ` +
    'Add a configuration file for this stage and update getEnvironmentConfig().'
  );
}
