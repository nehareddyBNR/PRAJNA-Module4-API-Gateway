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
 *   cdk deploy -c region=ap-south-2        # Override the config's region
 *   cdk deploy -c corsOrigins=https://a,https://b
 *
 * @module bin/prajna
 */

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { EnvironmentLoader } from '../lib/foundation/utils';
import { PrajnaTags } from '../lib/foundation/tags';
import { FoundationStack } from '../lib/foundation/foundation-stack';
import { ResourceNames } from '../lib/foundation/constants';
import { ModuleIdentifier } from '../lib/foundation/constants';
import { AuthStack } from '../lib/auth/auth-stack';
import { StorageStack } from '../lib/storage/storage-stack';
import { ApiGatewayStack } from '../lib/api/api-gateway-stack';

// ── Bootstrap CDK App ──────────────────────────────────────────────────────
const app = new cdk.App();

// ── Resolve Environment ────────────────────────────────────────────────────
const config = EnvironmentLoader.load(app);

// ── Apply Platform-Wide Tags ───────────────────────────────────────────────
PrajnaTags.applyToApp(app, config.stage);

// ── Deployment Target ──────────────────────────────────────────────────────
// The foundation package pins a region per stage. The shared PRAJNA account is
// in ap-south-2 while the package still defaults dev to ap-south-1, and every
// team that hit this patched it locally instead (faculty-data B-088). Honour an
// explicit override so a region move is a deploy flag, not a package release.
const env = {
  account: app.node.tryGetContext('account') ?? config.deploymentTarget.account,
  region:
    app.node.tryGetContext('region') ??
    process.env.CDK_DEPLOY_REGION ??
    config.deploymentTarget.region,
};

// ── CORS Origins ───────────────────────────────────────────────────────────
// B-052: the confirmed production origin is `https://prajna.gitam.edu` — the
// `dashboard.` subdomain previously hardcoded here was never real (confirmed by
// Hemanth, M24, 2026-08-01). Dev allows all origins, so a wrong value here is
// invisible until prod cutover; `-c corsOrigins=` makes it a deploy parameter
// rather than a code change plus a review cycle.
const corsContext: string | undefined = app.node.tryGetContext('corsOrigins');
const corsAllowedOrigins = corsContext
  ? corsContext.split(',').map((o) => o.trim()).filter(Boolean)
  : config.isProduction
    ? ['https://prajna.gitam.edu']
    : ['http://localhost:3000'];

// ── Foundation Stack (Module 1) ────────────────────────────────────────────
const foundationStackName = ResourceNames.stackName(config.stage, ModuleIdentifier.FOUNDATION);

new FoundationStack(app, foundationStackName, {
  env,
  config,
  description: `PRAJNA Foundation Stack (${config.environmentName})`,
});

// ── Future Module Stacks ───────────────────────────────────────────────────

const authStackName = ResourceNames.stackName(config.stage, ModuleIdentifier.AUTH);
const authStack = new AuthStack(app, authStackName, {
  env,
  config,
  description: `PRAJNA Auth Stack (${config.environmentName})`,
});

// Module 6: Storage Stack
const storageStackName = ResourceNames.stackName(config.stage, ModuleIdentifier.STORAGE);
new StorageStack(app, storageStackName, {
  env,
  config,
  description: `PRAJNA Storage Stack (${config.environmentName})`,
});

// Module 4: API Gateway & Middleware
const apiStackName = ResourceNames.stackName(config.stage, ModuleIdentifier.API);
const apiStack = new ApiGatewayStack(app, apiStackName, {
  env,
  config,
  description: `PRAJNA API Gateway Stack (${config.environmentName})`,
  corsAllowedOrigins,
});
apiStack.addDependency(authStack);

// Business modules will be registered here as they are developed.

// ── Synthesize ─────────────────────────────────────────────────────────────
app.synth();
