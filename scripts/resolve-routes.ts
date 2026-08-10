#!/usr/bin/env ts-node
/**
 * @fileoverview Preflight resolver for Module 4 route ARNs.
 *
 * Run this BEFORE `cdk deploy`. It reads lib/api/route-manifest.ts, checks
 * SSM Parameter Store for each route's Lambda ARN.
 *
 * For Module 13 (Approval), it uses the Foundation's ApprovalParameters
 * which defines both the Foundation convention (create-request-function-arn)
 * and M4 binding convention (start-fn-arn). M13 publishes to BOTH.
 *
 * For other modules, it uses the generic convention:
 *   /prajna/{stage}/{moduleId}/{routeId}-fn-arn
 *
 * and writes two files:
 *
 *   build/resolved-routes.<stage>.json   — consumed by RouteManager at synth
 *   build/M4-ROUTE-REPORT.<stage>.md     — the handoff report for Bhanu
 *
 * Usage:
 *   npx ts-node scripts/resolve-routes.ts --stage dev
 *
 * @module scripts/resolve-routes
 */

import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import * as fs from 'fs';
import * as path from 'path';
import { ROUTE_MANIFEST, RouteDefinition, RouteAuth } from '../lib/api/route-manifest';
import { M13M4BindingPaths } from '../lib/api/m13-ssm-paths';
import { Stage } from '@prajna-platform/platform-foundation';

type RouteStatus = 'BOUND' | 'MISSING-ARN' | 'HOLD' | 'AUTH-TODO';

interface ResolvedRoute extends RouteDefinition {
  status: RouteStatus;
  arn?: string;
  ssmPath: string;
}

// M13 routeId -> Foundation M4 convention method mapping
const M13_M4_PATH_MAP: Record<string, (stage: Stage) => string> = {
  'start': M13M4BindingPaths.startFnArn,
  'submit-action': M13M4BindingPaths.submitActionFnArn,
  'resubmit': M13M4BindingPaths.resubmitFnArn,
  'get-status': M13M4BindingPaths.getStatusFnArn,
  'get-pending': M13M4BindingPaths.getPendingFnArn,
  'pending-mine-count': M13M4BindingPaths.pendingMineCountFnArn,
  'health': M13M4BindingPaths.healthFnArn,
};

function getSsmPath(route: RouteDefinition, stage: string): string {
  const stageEnum = stage.toUpperCase() as Stage;
  
  if (route.moduleId === 'approval' && M13_M4_PATH_MAP[route.routeId]) {
    return M13_M4_PATH_MAP[route.routeId](stageEnum);
  }
  
  // Generic convention for other modules
  return `/prajna/${stage}/${route.moduleId}/${route.routeId}-fn-arn`;
}

async function main() {
  const stageArgIdx = process.argv.indexOf('--stage');
  const stage = stageArgIdx !== -1 ? process.argv[stageArgIdx + 1] : 'dev';
  if (!stage) {
    console.error('Usage: ts-node scripts/resolve-routes.ts --stage <dev|qa|prod>');
    process.exit(1);
  }

  const ssm = new SSMClient({});
  const resolved: ResolvedRoute[] = [];

  for (const route of ROUTE_MANIFEST) {
    const ssmPath = getSsmPath(route, stage);

    if (route.hold) {
      resolved.push({ ...route, status: 'HOLD', ssmPath });
      continue;
    }

    if (route.auth === RouteAuth.NONE && route.path !== '/approval/health') {
      resolved.push({ ...route, status: 'AUTH-TODO', ssmPath });
      continue;
    }

    try {
      const result = await ssm.send(new GetParameterCommand({ Name: ssmPath }));
      resolved.push({ ...route, status: 'BOUND', arn: result.Parameter?.Value, ssmPath });
    } catch (err: any) {
      if (err.name === 'ParameterNotFound') {
        resolved.push({ ...route, status: 'MISSING-ARN', ssmPath });
      } else {
        throw err;
      }
    }
  }

  const buildDir = path.join(__dirname, '..', 'build');
  fs.mkdirSync(buildDir, { recursive: true });

  fs.writeFileSync(
    path.join(buildDir, `resolved-routes.${stage}.json`),
    JSON.stringify(resolved, null, 2),
  );

  const boundCount = resolved.filter((r) => r.status === 'BOUND').length;
  const missingModules = [...new Set(
    resolved.filter((r) => r.status === 'MISSING-ARN').map((r) => r.moduleId),
  )];

  const lines: string[] = [];
  lines.push(`# Module 4 — Route Binding Report (${stage})`);
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Bound: ${boundCount} / ${resolved.length}`);
  lines.push('');
  lines.push('| Route | Method | Path | Auth | Status | SSM Path |');
  lines.push('|---|---|---|---|---|---|');
  for (const r of resolved) {
    lines.push(`| ${r.moduleId}/${r.routeId} | ${r.method} | ${r.path} | ${r.auth} | **${r.status}** | \`${r.ssmPath}\` |`);
  }
  lines.push('');
  lines.push('## Modules with no ARNs in SSM yet');
  lines.push(missingModules.length ? missingModules.map((m) => `- ${m}`).join('\n') : '_None._');
  lines.push('');
  lines.push('## Answers to Bhanu\'s 3 questions');
  lines.push('1. **v2 or v1?** v1 — built on the existing `SharedApi` (apigateway.RestApi) in lib/foundation. Reusing it, not rebuilding as HttpApi. Flag if this is a hard blocker on your side.');
  lines.push('2. **IAM or M2M?** AWS_IAM, as you recommended.');
  lines.push(`3. **Go-live for /prajna/${stage}/api/api-endpoint?** Published as soon as this stack deploys clean — not gated on bound-route count. Bindable is 14/28 with holds on, 28/28 once M16+M18 lift.`);
  lines.push('');


  fs.writeFileSync(path.join(buildDir, `M4-ROUTE-REPORT.${stage}.md`), lines.join('\n'));

  console.log(`Resolved ${boundCount}/${resolved.length} routes for stage=${stage}`);
  console.log(`Report: build/M4-ROUTE-REPORT.${stage}.md`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});