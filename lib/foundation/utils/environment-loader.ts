/**
 * @fileoverview Environment resolution and configuration loading for the PRAJNA platform.
 *
 * This module bridges the gap between runtime environment (process.env, CDK context)
 * and the type-safe configuration system. It resolves the deployment stage from
 * external inputs and returns a fully-typed {@link PrajnaEnvironmentConfig}.
 *
 * Resolution Order:
 * 1. CDK context (`-c stage=prod`)
 * 2. Environment variable (`PRAJNA_STAGE=prod`)
 * 3. Default: {@link Stage.DEVELOPMENT}
 *
 * @example
 * ```typescript
 * // In bin/prajna.ts:
 * import { EnvironmentLoader } from '@foundation/utils';
 *
 * const app = new cdk.App();
 * const config = EnvironmentLoader.load(app);
 * ```
 *
 * @module foundation/utils/environment-loader
 */

import { App, Annotations } from 'aws-cdk-lib';
import { Stage, PrajnaEnvironmentConfig } from '../config/environment';
import { getEnvironmentConfig } from '../config';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The environment variable name used to specify the deployment stage.
 *
 * Set this in CI/CD pipelines: `PRAJNA_STAGE=prod cdk deploy`
 */
export const STAGE_ENV_VARIABLE = 'PRAJNA_STAGE' as const;

/**
 * The CDK context key used to specify the deployment stage.
 *
 * Set this via CLI: `cdk deploy -c stage=prod`
 */
export const STAGE_CONTEXT_KEY = 'stage' as const;

/**
 * The default stage when no explicit stage is provided.
 *
 * This ensures that running `cdk synth` without any configuration
 * defaults to the development environment — the safest default.
 */
export const DEFAULT_STAGE = Stage.DEVELOPMENT;

/**
 * Placeholder account IDs that indicate the environment config has not
 * been updated with real AWS account IDs. Deploying with these values
 * will target non-existent accounts or yield unpredictable results.
 *
 * @internal
 */
const DUMMY_ACCOUNT_IDS: ReadonlySet<string> = new Set([
  '123456789012',
  '234567890123',
  '345678901234',
  '000000000000',
]);

/**
 * Valid stage string values accepted from external inputs.
 */
const VALID_STAGE_VALUES: ReadonlySet<string> = new Set(
  Object.values(Stage),
);

// ─────────────────────────────────────────────────────────────────────────────
// Stage Resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses and validates a raw string into a {@link Stage} enum value.
 *
 * @param value - The raw string from env var or CDK context.
 * @returns The corresponding {@link Stage} enum value.
 * @throws {Error} If the value is not a recognized stage.
 */
function parseStage(value: string): Stage {
  const normalized = value.trim().toLowerCase();

  if (!VALID_STAGE_VALUES.has(normalized)) {
    const validValues = Array.from(VALID_STAGE_VALUES).join(', ');
    throw new Error(
      `[PRAJNA] Invalid stage value: "${value}". ` +
      `Valid values are: ${validValues}. ` +
      `Set the stage via environment variable (${STAGE_ENV_VARIABLE}=<stage>) ` +
      `or CDK context (-c ${STAGE_CONTEXT_KEY}=<stage>).`,
    );
  }

  return normalized as Stage;
}

/**
 * Resolves the deployment stage from CDK context and environment variables.
 *
 * Resolution order (first match wins):
 * 1. CDK context: `-c stage=prod`
 * 2. Environment variable: `PRAJNA_STAGE=prod`
 * 3. Default: {@link Stage.DEVELOPMENT}
 *
 * @param app - The CDK App (used to read context values).
 * @returns The resolved {@link Stage} enum value.
 */
export function resolveStage(app: App): Stage {
  // 1. Try CDK context first (explicit CLI flag takes priority)
  const contextValue = app.node.tryGetContext(STAGE_CONTEXT_KEY) as string | undefined;
  if (contextValue !== undefined && contextValue !== null && contextValue.trim().length > 0) {
    return parseStage(contextValue);
  }

  // 2. Try environment variable
  const envValue = process.env[STAGE_ENV_VARIABLE];
  if (envValue !== undefined && envValue.trim().length > 0) {
    return parseStage(envValue);
  }

  // 3. Default to development
  return DEFAULT_STAGE;
}

// ─────────────────────────────────────────────────────────────────────────────
// Environment Loader
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Central environment loader for the PRAJNA platform.
 *
 * Resolves the deployment stage from external inputs and returns the
 * complete, type-safe environment configuration. This is the primary
 * entry point used in `bin/prajna.ts`.
 *
 * @example
 * ```typescript
 * // bin/prajna.ts
 * import * as cdk from 'aws-cdk-lib';
 * import { EnvironmentLoader } from './lib/foundation/utils';
 * import { FoundationStack } from './lib/foundation/foundation-stack';
 *
 * const app = new cdk.App();
 * const config = EnvironmentLoader.load(app);
 *
 * new FoundationStack(app, `Prajna-Foundation-${config.stage}`, {
 *   env: {
 *     account: config.deploymentTarget.account,
 *     region: config.deploymentTarget.region,
 *   },
 *   config,
 * });
 *
 * app.synth();
 * ```
 */
export class EnvironmentLoader {

  /** This class is not instantiable — all methods are static. */
  private constructor() {}

  /**
   * Loads the complete environment configuration for the current deployment.
   *
   * @param app - The CDK App construct.
   * @returns The fully-resolved {@link PrajnaEnvironmentConfig}.
   */
  static load(app: App): PrajnaEnvironmentConfig {
    const stage = resolveStage(app);
    const config = getEnvironmentConfig(stage);

    // Guard against placeholder account IDs that indicate the environment
    // config has not been updated for this deployment target.
    if (DUMMY_ACCOUNT_IDS.has(config.deploymentTarget.account)) {
      Annotations.of(app).addWarning(
        `[PRAJNA] Placeholder account ID "${config.deploymentTarget.account}" detected ` +
        `for stage "${stage}". Update the account field in lib/foundation/config/${stage}.ts ` +
        'to the real 12-digit AWS account ID before deploying.',
      );
    }

    EnvironmentLoader.logResolution(stage, config);

    return config;
  }

  /**
   * Loads configuration for a specific stage (bypasses resolution).
   *
   * Useful in tests and scripts where you want to explicitly target
   * a stage without relying on env vars or CDK context.
   *
   * @param stage - The target stage.
   * @returns The environment configuration for the given stage.
   */
  static loadForStage(stage: Stage): PrajnaEnvironmentConfig {
    return getEnvironmentConfig(stage);
  }

  /**
   * Returns the resolved stage without loading the full configuration.
   *
   * @param app - The CDK App construct.
   * @returns The resolved {@link Stage} enum value.
   */
  static resolveStage(app: App): Stage {
    return resolveStage(app);
  }

  /**
   * Logs the environment resolution result for operational visibility.
   *
   * This log line appears during `cdk synth` and `cdk deploy`, confirming
   * which environment configuration is active. Critical for catching
   * accidental production deployments from developer workstations.
   *
   * @param stage - The resolved stage.
   * @param config - The loaded configuration.
   */
  private static logResolution(stage: Stage, config: PrajnaEnvironmentConfig): void {
    const source = process.env[STAGE_ENV_VARIABLE]
      ? `environment variable (${STAGE_ENV_VARIABLE})`
      : 'default';

    // Mask the middle 4 digits of the account ID to reduce exposure
    // in CI/CD logs that may be publicly accessible.
    const maskedAccount = config.deploymentTarget.account.replace(
      /^(\d{4})\d{4}(\d{4})$/,
      '$1-XXXX-$2',
    );

    console.log(
      `[PRAJNA] Environment resolved: ${config.environmentName} (${stage}) | ` +
      `Account: ${maskedAccount} | ` +
      `Region: ${config.deploymentTarget.region} | ` +
      `Source: ${source} | ` +
      `Production: ${config.isProduction}`,
    );
  }
}
