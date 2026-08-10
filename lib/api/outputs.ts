/**
 * @fileoverview Module 4 (REST API v1) -- publishes API Gateway outputs.
 *
 * Writes to the exact paths `ApiParameters` already declares in
 * lib/foundation/constants/ssm-parameters.ts (apiId, rootResourceId,
 * apiEndpoint, apiExecutionArn), matching Balaji's integration guide.
 *
 * @module lib/api/outputs
 */

import { Construct } from 'constructs';
import { CfnOutput } from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { SharedParameter, ModuleIdentifier, PrajnaEnvironmentConfig } from '@prajna-platform/platform-foundation';

export interface ApiOutputsProps {
  readonly config: PrajnaEnvironmentConfig;
  readonly restApi: apigateway.RestApi;
}

export class ApiOutputs extends Construct {
  constructor(scope: Construct, id: string, props: ApiOutputsProps) {
    super(scope, id);

    const { config, restApi } = props;

    new SharedParameter(this, 'ApiIdParam', {
      config, module: ModuleIdentifier.API,
      identifier: 'api-id',
      description: 'PRAJNA shared API Gateway REST API ID',
      value: restApi.restApiId,
    });

    new SharedParameter(this, 'RootResourceIdParam', {
      config, module: ModuleIdentifier.API,
      identifier: 'root-resource-id',
      description: 'PRAJNA shared API Gateway root resource ID',
      value: restApi.restApiRootResourceId,
    });

    new SharedParameter(this, 'ApiEndpointParam', {
      config, module: ModuleIdentifier.API,
      identifier: 'api-endpoint',
      description: 'PRAJNA shared API Gateway invoke URL',
      value: restApi.url,
    });

    new SharedParameter(this, 'ApiExecutionArnParam', {
      config, module: ModuleIdentifier.API,
      identifier: 'api-execution-arn',
      description: 'PRAJNA shared API Gateway execution ARN (for Lambda permissions)',
      value: restApi.arnForExecuteApi(),
    });

    new CfnOutput(this, 'ApiEndpointOutput', {
      value: restApi.url,
      description: 'PRAJNA shared API Gateway invoke URL',
      exportName: `prajna-${config.stage}-api-endpoint`,
    });

    new CfnOutput(this, 'ApiIdOutput', {
      value: restApi.restApiId,
      exportName: `prajna-${config.stage}-api-id`,
    });
  }
}
