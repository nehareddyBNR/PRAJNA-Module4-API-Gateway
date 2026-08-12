/**
 * @fileoverview RouteManager -- Module 4 (REST API v1).
 *
 * Reads build/resolved-routes.<stage>.json (written by
 * scripts/resolve-routes.ts) and, for every BOUND route:
 *   1. Creates/reuses the nested API Gateway resource for the path.
 *   2. Imports the Lambda by ARN (never hardcoded).
 *   3. Attaches a LambdaIntegration (proxy).
 *   4. Adds a CfnPermission so API Gateway can invoke the imported function
 *      -- imported functions do NOT get this automatically, and every call
 *      500s without it.
 *   5. Applies the route's auth mode (JWT via RequestAuthorizer / IAM / NONE).
 *
 * @module lib/api/route-manager
 */

import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as fs from 'fs';
import * as path from 'path';
import { RouteAuth } from './route-manifest';
import { PrajnaEnvironmentConfig } from '../foundation/config/environment';

interface ResolvedRoute {
  moduleId: string;
  routeId: string;
  method: string;
  path: string;
  auth: RouteAuth;
  status: 'BOUND' | 'MISSING-ARN' | 'HOLD' | 'AUTH-TODO';
  arn?: string;
  ssmPath: string;
  hold?: string;
}

export interface RouteManagerProps {
  readonly config: PrajnaEnvironmentConfig;
  readonly restApi: apigateway.RestApi;
  readonly jwtAuthorizer: apigateway.RequestAuthorizer;
}

export class RouteManager extends Construct {
  public readonly bound: ResolvedRoute[] = [];
  public readonly skipped: ResolvedRoute[] = [];

  constructor(scope: Construct, id: string, props: RouteManagerProps) {
    super(scope, id);

    const resolvedPath = path.join(
      __dirname, '..', '..', 'build', `resolved-routes.${props.config.stage}.json`,
    );

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(
        `[Module 4] Missing ${resolvedPath}. Run ` +
        `"npx ts-node scripts/resolve-routes.ts --stage ${props.config.stage}" before cdk synth/deploy.`,
      );
    }

    const routes: ResolvedRoute[] = JSON.parse(fs.readFileSync(resolvedPath, 'utf-8'));

    const resourceCache = new Map<string, apigateway.IResource>();
    resourceCache.set('/', props.restApi.root);

    const getOrCreateResource = (fullPath: string): apigateway.IResource => {
      if (resourceCache.has(fullPath)) return resourceCache.get(fullPath)!;

      const segments = fullPath.split('/').filter(Boolean);
      let current = props.restApi.root;
      let currentPath = '';

      for (const segment of segments) {
        currentPath += `/${segment}`;
        if (resourceCache.has(currentPath)) {
          current = resourceCache.get(currentPath)! as apigateway.Resource;
          continue;
        }
        const child = current.getResource(segment) ?? current.addResource(segment);
        resourceCache.set(currentPath, child);
        current = child as apigateway.Resource;
      }
      return current;
    };

    for (const route of routes) {
      if (route.status !== 'BOUND') {
        this.skipped.push(route);
        continue;
      }

      // Construct ids must be unique per (path, method), NOT per (routeId, method):
      // several routes deliberately share one Lambda -- M16's `get-notifications`
      // serves /notifications and /notifications/count, `mark-read` serves
      // /{notificationId}/read and /read-all, and M14's `scoring-config` serves
      // three methods across two paths. Keying on routeId alone throws
      // "There is already a Construct with name ..." the moment two rows share
      // a routeId + method, which is exactly what lifting the M16 hold does.
      const routeKey = `${route.moduleId}-${route.routeId}-${route.method}` +
        `-${route.path.replace(/[^A-Za-z0-9]/g, '')}`;

      const fn = lambda.Function.fromFunctionAttributes(
        this,
        `Fn-${routeKey}`,
        { functionArn: route.arn!, sameEnvironment: true },
      );

      const resource = getOrCreateResource(route.path);

      const authorizer: apigateway.IAuthorizer | undefined =
        route.auth === RouteAuth.JWT ? props.jwtAuthorizer : undefined;

      const authorizationType =
        route.auth === RouteAuth.JWT ? apigateway.AuthorizationType.CUSTOM :
        route.auth === RouteAuth.IAM ? apigateway.AuthorizationType.IAM :
        apigateway.AuthorizationType.NONE;

      resource.addMethod(
        route.method,
        new apigateway.LambdaIntegration(fn, { proxy: true, allowTestInvoke: false }),
        { authorizer, authorizationType },
      );
      new lambda.CfnPermission(this, `Perm-${routeKey}`, {
        action: 'lambda:InvokeFunction',
        functionName: route.arn!,
        principal: 'apigateway.amazonaws.com',
        sourceArn: props.restApi.arnForExecuteApi(
          route.method,
          route.path.replace(/\{[^}]*\}/g, '*'),
          props.config.apiGateway.stageName,
        ),
      });

      this.bound.push(route);
    }
  }
}