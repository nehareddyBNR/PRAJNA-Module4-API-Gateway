/**
 * @fileoverview Module 4 (REST API v1) -- WAF for the shared API stage.
 * @module lib/api/waf
 */

import { Construct } from 'constructs';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { ResourceNames, ModuleIdentifier, PrajnaEnvironmentConfig } from '@prajna-platform/platform-foundation';

export interface ApiWafProps {
  readonly config: PrajnaEnvironmentConfig;
  readonly restApi: apigateway.RestApi;
  readonly rateLimitPerIp?: number;
}

export class ApiWaf extends Construct {
  public readonly webAcl: wafv2.CfnWebACL;

  constructor(scope: Construct, id: string, props: ApiWafProps) {
    super(scope, id);

    const aclName = ResourceNames.stackName(props.config.stage, ModuleIdentifier.API) + '-waf';

    this.webAcl = new wafv2.CfnWebACL(this, 'WebAcl', {
      name: aclName,
      scope: 'REGIONAL',
      defaultAction: { allow: {} },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: `${aclName}-default`,
      },
      rules: [
        {
          name: 'RateLimitPerIp',
          priority: 1,
          statement: {
            rateBasedStatement: {
              limit: props.rateLimitPerIp ?? 2000,
              aggregateKeyType: 'IP',
            },
          },
          action: { block: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: `${aclName}-rate-limit`,
          },
        },
        {
          name: 'AWSManagedCoreRuleSet',
          priority: 2,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: `${aclName}-core-rules`,
          },
        },
      ],
    });

    new wafv2.CfnWebACLAssociation(this, 'WebAclAssociation', {
      resourceArn: props.restApi.deploymentStage.stageArn,
      webAclArn: this.webAcl.attrArn,
    });
  }
}
