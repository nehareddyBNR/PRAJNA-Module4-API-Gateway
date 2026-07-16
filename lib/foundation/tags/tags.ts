/**
 * @fileoverview Automated resource tagging system for the PRAJNA platform.
 *
 * This module ensures every AWS resource deployed by the platform receives
 * a mandatory set of tags for cost allocation, compliance, operational
 * visibility, and incident response.
 *
 * The tagging system operates at two levels:
 * 1. **Platform Tags** — applied to the CDK App via {@link PrajnaTags.applyToApp},
 *    inherited by every stack and every resource in the platform.
 * 2. **Module Tags** — applied per-stack via {@link PrajnaTags.applyToStack},
 *    adding module-specific context on top of platform tags.
 *
 * No resource should ever be deployed without all 8 mandatory tags.
 *
 * @module foundation/tags/tags
 */

import { App, Stack, Tags } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Stage } from '../config/environment';
import {
  APPLICATION_NAME,
  APPLICATION_TITLE,
  ModuleIdentifier,
} from '../constants/naming';
import {
  PLATFORM_VERSION,
  PLATFORM_OWNER,
  COST_CENTER,
} from '../constants/defaults';

// ─────────────────────────────────────────────────────────────────────────────
// Tag Key Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical tag key names used across the platform.
 *
 * Using an enum prevents typos in tag keys — a misspelled tag key
 * silently creates a new tag instead of updating the intended one.
 */
export enum TagKey {
  /** The application this resource belongs to. */
  APPLICATION = 'Application',

  /** The project identifier for cost tracking. */
  PROJECT = 'Project',

  /** The deployment environment (dev, qa, prod). */
  ENVIRONMENT = 'Environment',

  /** The owning module within the platform. */
  MODULE = 'Module',

  /** The team or individual responsible for this resource. */
  OWNER = 'Owner',

  /** The IaC tool used to manage this resource. */
  MANAGED_BY = 'ManagedBy',

  /** The cost center for financial allocation. */
  COST_CENTER = 'CostCenter',

  /** The platform version that deployed this resource. */
  VERSION = 'Version',
}

// ─────────────────────────────────────────────────────────────────────────────
// Tag Configuration Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The mandatory tag set that every PRAJNA resource must carry.
 *
 * This interface enforces at compile time that no mandatory tag is omitted.
 * All properties are readonly to prevent mutation after construction.
 */
export interface PrajnaTagConfig {
  /** The application name (e.g., "PRAJNA - AI Powered Faculty Companion Platform"). */
  readonly application: string;

  /** The project identifier (e.g., "prajna"). */
  readonly project: string;

  /** The deployment stage (e.g., "dev", "qa", "prod"). */
  readonly environment: string;

  /** The owning module (e.g., "auth", "storage", "research"). */
  readonly module: string;

  /** The responsible team or owner. */
  readonly owner: string;

  /** The infrastructure management tool (e.g., "AWS-CDK"). */
  readonly managedBy: string;

  /** The cost center for billing. */
  readonly costCenter: string;

  /** The platform version string. */
  readonly version: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tagging Engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Centralized tagging engine for the PRAJNA platform.
 *
 * Provides methods to apply consistent, mandatory tags at the App level
 * (inherited by all stacks) and at the Stack level (for module-specific tags).
 *
 * @example
 * ```typescript
 * // In bin/prajna.ts — apply platform-wide tags
 * const app = new cdk.App();
 * PrajnaTags.applyToApp(app, Stage.DEVELOPMENT);
 *
 * // In a module stack constructor — apply module-specific tags
 * PrajnaTags.applyToStack(this, Stage.DEVELOPMENT, ModuleIdentifier.AUTH);
 * ```
 */
export class PrajnaTags {

  /** This class is not instantiable — all methods are static. */
  private constructor() {}

  /**
   * Builds the complete tag configuration for a given stage and module.
   *
   * @param stage - The deployment stage.
   * @param module - The owning module identifier.
   * @returns The complete, immutable tag configuration.
   */
  static buildTagConfig(stage: Stage, module: ModuleIdentifier): PrajnaTagConfig {
    return {
      application: APPLICATION_TITLE,
      project: APPLICATION_NAME,
      environment: stage,
      module: module,
      owner: PLATFORM_OWNER,
      managedBy: 'AWS-CDK',
      costCenter: COST_CENTER,
      version: PLATFORM_VERSION,
    };
  }

  /**
   * Applies platform-wide tags to the CDK App.
   *
   * These tags are inherited by every stack and every resource in the
   * application. They provide the baseline tag set that module-specific
   * tags build upon.
   *
   * Call this ONCE in `bin/prajna.ts` before synthesizing any stacks.
   *
   * @param app - The CDK App construct.
   * @param stage - The deployment stage.
   */
  static applyToApp(app: App, stage: Stage): void {
    const tags = Tags.of(app);

    tags.add(TagKey.APPLICATION, APPLICATION_TITLE);
    tags.add(TagKey.PROJECT, APPLICATION_NAME);
    tags.add(TagKey.ENVIRONMENT, stage);
    tags.add(TagKey.OWNER, PLATFORM_OWNER);
    tags.add(TagKey.MANAGED_BY, 'AWS-CDK');
    tags.add(TagKey.COST_CENTER, COST_CENTER);
    tags.add(TagKey.VERSION, PLATFORM_VERSION);
  }

  /**
   * Applies module-specific tags to a CDK Stack.
   *
   * This adds the {@link TagKey.MODULE} tag and ensures all mandatory
   * platform tags are present. Module tags are applied on top of
   * App-level tags, so the module tag narrows the scope for cost
   * allocation and operational filtering.
   *
   * Call this in the constructor of every module stack.
   *
   * @param scope - The stack or construct to tag.
   * @param stage - The deployment stage.
   * @param module - The owning module identifier.
   */
  static applyToStack(scope: Stack | Construct, stage: Stage, module: ModuleIdentifier): void {
    const tags = Tags.of(scope);

    tags.add(TagKey.APPLICATION, APPLICATION_TITLE);
    tags.add(TagKey.PROJECT, APPLICATION_NAME);
    tags.add(TagKey.ENVIRONMENT, stage);
    tags.add(TagKey.MODULE, module);
    tags.add(TagKey.OWNER, PLATFORM_OWNER);
    tags.add(TagKey.MANAGED_BY, 'AWS-CDK');
    tags.add(TagKey.COST_CENTER, COST_CENTER);
    tags.add(TagKey.VERSION, PLATFORM_VERSION);
  }

  /**
   * Applies custom additional tags to any construct.
   *
   * Use this for resource-specific tags beyond the mandatory set
   * (e.g., `DataClassification: Confidential` on an S3 bucket).
   *
   * @param scope - The construct to tag.
   * @param customTags - A record of additional tag key-value pairs.
   */
  static applyCustomTags(scope: Construct, customTags: Readonly<Record<string, string>>): void {
    const tags = Tags.of(scope);

    for (const [key, value] of Object.entries(customTags)) {
      tags.add(key, value);
    }
  }

  /**
   * Converts a {@link PrajnaTagConfig} into a flat key-value record.
   *
   * Useful for passing tags to AWS SDK calls, Lambda environment
   * variables, or CloudFormation parameters that expect a plain object.
   *
   * @param config - The tag configuration to convert.
   * @returns A flat record of tag key-value pairs.
   */
  static toRecord(config: PrajnaTagConfig): Record<string, string> {
    return {
      [TagKey.APPLICATION]: config.application,
      [TagKey.PROJECT]: config.project,
      [TagKey.ENVIRONMENT]: config.environment,
      [TagKey.MODULE]: config.module,
      [TagKey.OWNER]: config.owner,
      [TagKey.MANAGED_BY]: config.managedBy,
      [TagKey.COST_CENTER]: config.costCenter,
      [TagKey.VERSION]: config.version,
    };
  }
}
