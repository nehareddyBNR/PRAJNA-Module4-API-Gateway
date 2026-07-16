/**
 * @fileoverview Foundation Stack — the core infrastructure stack for the PRAJNA platform.
 *
 * This is the first stack deployed in every environment. It provisions
 * platform-wide shared resources that all 30+ modules depend on:
 *
 * - Platform-wide EventBridge event bus
 * - Foundation SSM parameters (stage, event bus, platform version)
 * - Platform tags applied to the stack
 *
 * Every other module stack depends on this stack being deployed first.
 * The Foundation Stack exports its outputs to SSM Parameter Store so
 * downstream modules can discover them without cross-stack references.
 *
 * @example
 * ```typescript
 * // In bin/prajna.ts:
 * const config = EnvironmentLoader.load(app);
 *
 * new FoundationStack(app, NamingHelper.stackName(config, ModuleIdentifier.FOUNDATION), {
 *   env: {
 *     account: config.deploymentTarget.account,
 *     region: config.deploymentTarget.region,
 *   },
 *   config,
 * });
 * ```
 *
 * @module foundation/foundation-stack
 */

import { Stack, StackProps, CfnOutput, Annotations } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as events from 'aws-cdk-lib/aws-events';
import { PrajnaEnvironmentConfig } from './config/environment';
import { ModuleIdentifier } from './constants/naming';
import { ResourceNames } from './constants/resource-names';
import { PLATFORM_VERSION } from './constants/defaults';
import { FoundationParameters } from './constants/ssm-parameters';
import { PrajnaTags } from './tags/tags';
import { SharedParameter } from './constructs/shared-parameter';

// ─────────────────────────────────────────────────────────────────────────────
// Stack Props
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Properties for the Foundation Stack.
 */
export interface FoundationStackProps extends StackProps {
  /** The environment configuration for this deployment. */
  readonly config: PrajnaEnvironmentConfig;
}

// ─────────────────────────────────────────────────────────────────────────────
// Foundation Stack
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The Foundation Stack — first stack deployed, provides platform-wide resources.
 *
 * Resources provisioned:
 * - Platform EventBridge event bus for cross-module event-driven communication
 * - SSM parameters publishing stage, event bus details, and platform version
 * - Platform-wide tags
 *
 * All downstream module stacks depend on these resources being available.
 */
export class FoundationStack extends Stack {

  /** The platform-wide EventBridge event bus. */
  public readonly eventBus: events.EventBus;

  /** The environment configuration. */
  public readonly config: PrajnaEnvironmentConfig;

  constructor(scope: Construct, id: string, props: FoundationStackProps) {
    super(scope, id, props);

    this.config = props.config;

    // ── Platform Tags ────────────────────────────────────────────────────
    PrajnaTags.applyToStack(this, props.config.stage, ModuleIdentifier.FOUNDATION);

    // ── EventBridge Event Bus ────────────────────────────────────────────
    const eventBusName = ResourceNames.eventBus(
      props.config.stage,
      ModuleIdentifier.FOUNDATION,
      'platform',
    );

    this.eventBus = new events.EventBus(this, 'PlatformEventBus', {
      eventBusName,
    });

    // ── SSM Parameters — Cross-Module Discovery ──────────────────────────

    // Stage parameter
    new SharedParameter(this, 'StageParam', {
      config: props.config,
      module: ModuleIdentifier.FOUNDATION,
      identifier: 'stage',
      description: 'Current deployment stage',
      value: props.config.stage,
    });

    // Event bus name parameter
    new SharedParameter(this, 'EventBusNameParam', {
      config: props.config,
      module: ModuleIdentifier.FOUNDATION,
      identifier: 'event-bus-name',
      description: 'Platform EventBridge event bus name',
      value: this.eventBus.eventBusName,
    });

    // Event bus ARN parameter
    new SharedParameter(this, 'EventBusArnParam', {
      config: props.config,
      module: ModuleIdentifier.FOUNDATION,
      identifier: 'event-bus-arn',
      description: 'Platform EventBridge event bus ARN',
      value: this.eventBus.eventBusArn,
    });

    // Platform version parameter
    new SharedParameter(this, 'PlatformVersionParam', {
      config: props.config,
      module: ModuleIdentifier.FOUNDATION,
      identifier: 'platform-version',
      description: 'Platform version deployed',
      value: PLATFORM_VERSION,
    });

    // ── CloudFormation Outputs ────────────────────────────────────────────

    new CfnOutput(this, 'EventBusNameOutput', {
      exportName: `${id}-EventBusName`,
      value: this.eventBus.eventBusName,
      description: 'Platform EventBridge event bus name',
    });

    new CfnOutput(this, 'EventBusArnOutput', {
      exportName: `${id}-EventBusArn`,
      value: this.eventBus.eventBusArn,
      description: 'Platform EventBridge event bus ARN',
    });

    new CfnOutput(this, 'StageOutput', {
      exportName: `${id}-Stage`,
      value: props.config.stage,
      description: 'Deployment stage',
    });

    new CfnOutput(this, 'VersionOutput', {
      exportName: `${id}-Version`,
      value: PLATFORM_VERSION,
      description: 'Platform version',
    });

    // ── Deployment Annotation ────────────────────────────────────────────
    // Use CDK Annotations instead of console.log to integrate with CDK's
    // output pipeline and avoid exposing config in public CI/CD logs.
    Annotations.of(this).addInfo(
      `Foundation Stack initialized: ${id} | ` +
      `Stage: ${props.config.stage} | ` +
      `Event Bus: ${eventBusName} | ` +
      `Version: ${PLATFORM_VERSION}`,
    );
  }
}
