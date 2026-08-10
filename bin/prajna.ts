#!/usr/bin/env node
/**
 * @fileoverview CDK Entry Point for the PRAJNA platform.
 *
 * This is the starting point for all CDK operations (synth, deploy, destroy).
 * It resolves the deployment stage, loads the environment configuration,
 * applies platform-wide tags, and instantiates all module stacks.
 *
 * Usage:
 *   cdk synth                              # Defaults to dev
 *   PRAJNA_STAGE=qa cdk synth              # Targets QA
 *   cdk deploy -c stage=prod               # Targets production
 *
 * @module bin/prajna
 */

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { EnvironmentLoader, PrajnaTags, FoundationStack, ModuleIdentifier, ResourceNames } from '@prajna-platform/platform-foundation';
import { AuthStack } from '../lib/auth/auth-stack';
import { StorageStack } from '../lib/storage/storage-stack';
import { ApiGatewayStack } from '../lib/api/api-gateway-stack';

// ── Bootstrap CDK App ──────────────────────────────────────────────────────
const app = new cdk.App();

// ── Resolve Environment ────────────────────────────────────────────────────
const config = EnvironmentLoader.load(app);

// ── Apply Platform-Wide Tags ───────────────────────────────────────────────
PrajnaTags.applyToApp(app, config.stage);

// ── Foundation Stack (Module 1) ────────────────────────────────────────────
const foundationStackName = ResourceNames.stackName(config.stage, ModuleIdentifier.FOUNDATION);

new FoundationStack(app, foundationStackName, {
  env: {
    account: config.deploymentTarget.account,
    region: config.deploymentTarget.region,
  },
  config,
  description: `PRAJNA Foundation Stack (${config.environmentName})`,
});

// ── Future Module Stacks ───────────────────────────────────────────────────

const authStackName = ResourceNames.stackName(config.stage, ModuleIdentifier.AUTH);
const authStack = new AuthStack(app, authStackName, {
  env: {
    account: config.deploymentTarget.account,
    region: config.deploymentTarget.region,
  },
  config,
  description: `PRAJNA Auth Stack (${config.environmentName})`,
});

// Module 6: Storage Stack
const storageStackName = ResourceNames.stackName(config.stage, ModuleIdentifier.STORAGE);
new StorageStack(app, storageStackName, {
  env: {
    account: config.deploymentTarget.account,
    region: config.deploymentTarget.region,
  },
  config,
  description: `PRAJNA Storage Stack (${config.environmentName})`,
});

// Module 4: API Gateway & Middleware
const apiStackName = ResourceNames.stackName(config.stage, ModuleIdentifier.API);
const apiStack = new ApiGatewayStack(app, apiStackName, {
  env: {
    account: config.deploymentTarget.account,
    region: config.deploymentTarget.region,
  },
  config,
  description: `PRAJNA API Gateway Stack (${config.environmentName})`,
  corsAllowedOrigins: config.isProduction
    ? ['https://dashboard.prajna.gitam.edu']
    : ['http://localhost:3000'],
});
apiStack.addDependency(authStack);

// Business modules will be registered here as they are developed.

// ── Synthesize ─────────────────────────────────────────────────────────────
app.synth();
