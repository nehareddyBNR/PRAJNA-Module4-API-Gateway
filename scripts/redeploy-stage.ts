#!/usr/bin/env ts-node
/**
 * @fileoverview Publish the shared REST API's current resources to its stage.
 *
 * INFRA-2 — "registered != live". API Gateway REST keeps a stage pointed at a
 * specific *deployment snapshot*. CDK creates a new `AWS::ApiGateway::Deployment`
 * only when something in THIS stack changes, so when a partner module (M13-M18)
 * adds resources to the gateway from its own stack, the routes exist on the API
 * and still 404 on the stage until someone calls CreateDeployment. A module that
 * does not own the gateway has no way to trigger that.
 *
 * BL hit this on 2026-08-07 (deployment `ni4ocd` -> `34u8bz`, resolved by hand)
 * and it recurs on every partner deploy. M4 owns the gateway, so M4 owns the
 * redeploy. Run this after any partner module deploys routes:
 *
 *   npm run redeploy -- --stage dev
 *
 * Reads the API id from the SSM parameter M4 itself publishes
 * (/prajna/{stage}/api/api-id), so there is nothing to hardcode. Uses the AWS
 * CLI for the CreateDeployment call to avoid pulling in another SDK client.
 *
 * @module scripts/redeploy-stage
 */

import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { execFileSync } from 'child_process';

async function main(): Promise<void> {
  const stageArgIdx = process.argv.indexOf('--stage');
  const stage = stageArgIdx !== -1 ? process.argv[stageArgIdx + 1] : 'dev';
  if (!stage) {
    console.error('Usage: ts-node scripts/redeploy-stage.ts --stage <dev|qa|prod>');
    process.exit(1);
  }

  const apiIdParam = `/prajna/${stage}/api/api-id`;
  const ssm = new SSMClient({});

  let apiId: string | undefined;
  try {
    const result = await ssm.send(new GetParameterCommand({ Name: apiIdParam }));
    apiId = result.Parameter?.Value;
  } catch (err: any) {
    if (err.name === 'ParameterNotFound') {
      console.error(
        `[Module 4] ${apiIdParam} not found — deploy the API stack for stage=${stage} first.`,
      );
      process.exit(1);
    }
    throw err;
  }

  if (!apiId) {
    console.error(`[Module 4] ${apiIdParam} is empty.`);
    process.exit(1);
  }

  const description = `M4 partner-route publish ${new Date().toISOString()}`;
  const out = execFileSync(
    'aws',
    [
      'apigateway', 'create-deployment',
      '--rest-api-id', apiId,
      '--stage-name', stage,
      '--description', description,
      '--output', 'json',
    ],
    { encoding: 'utf-8' },
  );

  const deploymentId = JSON.parse(out).id;
  console.log(`Published ${apiId} -> stage ${stage} (deployment ${deploymentId})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
