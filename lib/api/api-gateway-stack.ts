/**
 * @fileoverview ApiGatewayStack -- Module 4 -- PRAJNA (REST API v1).
 *
 * Fronts every business module's Lambda behind one shared REST API.
 * Owns: routing, auth wiring, throttling, CORS, WAF, access logging.
 * Does NOT own: business logic, Lambdas (those belong to M13-M18 etc).
 *
 * Built on Balaji's SharedApi construct (lib/foundation/constructs/shared-api.ts),
 * per his integration guide, and confirmed with Bhanu (BL) as the locked
 * direction over HTTP API v2 -- see B-002 thread, 2026-07.
 *
 * @module lib/api/api-gateway-stack
 */

import { Construct } from 'constructs';
import { Stack, StackProps, Annotations } from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as sns from 'aws-cdk-lib/aws-sns';
import { PrajnaEnvironmentConfig } from '../foundation/config/environment';
import { ModuleIdentifier } from '../foundation/constants/naming';
import { MonitoringParameters } from '../foundation/constants/ssm-parameters';
import { SharedApi } from '../foundation/constructs/shared-api';
import { AlarmFactory } from '../foundation/monitoring/alarms';
import { ApiAuthorizer } from './api-authorizer';
import { RouteManager } from './route-manager';
import { ApiWaf } from './waf';
import { ApiOutputs } from './outputs';

export interface ApiGatewayStackProps extends StackProps {
  readonly config: PrajnaEnvironmentConfig;
  readonly corsAllowedOrigins?: string[];
}

export class ApiGatewayStack extends Stack {
  public readonly sharedApi: SharedApi;
  public readonly routeManager: RouteManager;

  constructor(scope: Construct, id: string, props: ApiGatewayStackProps) {
    super(scope, id, props);

    const { config } = props;

    this.sharedApi = new SharedApi(this, 'PlatformApi', {
      config,
      module: ModuleIdentifier.API,
      identifier: 'faculty',
      description: 'PRAJNA shared platform API -- fronts all business modules',
      corsAllowedOrigins: props.corsAllowedOrigins,
      accessLogging: true,
    });

    const authorizer = new ApiAuthorizer(this, 'Authorizer', {
      config,
      restApi: this.sharedApi.api,
    });

    this.routeManager = new RouteManager(this, 'Routes', {
      config,
      restApi: this.sharedApi.api,
      jwtAuthorizer: authorizer.jwtAuthorizer,
    });

    if (this.routeManager.skipped.length > 0) {
      Annotations.of(this).addWarning(
        `[Module 4] ${this.routeManager.skipped.length} route(s) not bound this deploy -- ` +
        `see build/M4-ROUTE-REPORT.${config.stage}.md for MISSING-ARN / HOLD / AUTH-TODO detail.`,
      );
    }

    new ApiWaf(this, 'Waf', {
      config,
      restApi: this.sharedApi.api,
    });

    new ApiOutputs(this, 'Outputs', {
      config,
      restApi: this.sharedApi.api,
    });

    // ── Alarms ─────────────────────────────────────────────────────────
    const opsAlarmTopicArn = ssm.StringParameter.valueForStringParameter(
      this,
      MonitoringParameters.opsAlarmTopicArn(config.stage),
    );
    const opsAlarmTopic = sns.Topic.fromTopicArn(this, 'ImportedOpsAlarmTopic', opsAlarmTopicArn);

    AlarmFactory.forApiGateway(this, config, ModuleIdentifier.API, 'platform', this.sharedApi.apiName, opsAlarmTopic);
  }
}
