#!/usr/bin/env ts-node
/**
 * @fileoverview Preflight resolver for Module 4 route ARNs.
 *
 * Run this BEFORE `cdk deploy`. It reads lib/api/route-manifest.ts, checks
 * SSM Parameter Store for each route's Lambda ARN at
 *   /prajna/{stage}/{moduleId}/{routeId}-fn-arn
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

type RouteStatus = 'BOUND' | 'MISSING-ARN' | 'HOLD' | 'AUTH-TODO';

interface ResolvedRoute extends RouteDefinition {
  status: RouteStatus;
  arn?: string;
  ssmPath: string;
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
    const ssmPath = `/prajna/${stage}/${route.moduleId}/${route.routeId}-fn-arn`;

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
  lines.push('## Known conflict — needs your input');
  lines.push('`ROUTE_MANIFEST` assumes ARN path `/prajna/{stage}/{moduleId}/{routeId}-fn-arn` for every route. `lib/foundation/constants/ssm-parameters.ts` → `ApprovalParameters` already publishes M13 params under different, hand-named identifiers (e.g. `create-request-function-arn`, not `start-fn-arn`). These will show MISSING-ARN even once M13 is deployed, until one of us renames. Recommend BL modules standardize on the manifest\'s `{routeId}-fn-arn` pattern going forward.');

  fs.writeFileSync(path.join(buildDir, `M4-ROUTE-REPORT.${stage}.md`), lines.join('\n'));

  console.log(`Resolved ${boundCount}/${resolved.length} routes for stage=${stage}`);
  console.log(`Report: build/M4-ROUTE-REPORT.${stage}.md`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});