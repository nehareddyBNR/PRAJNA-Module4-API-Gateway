/**
 * @fileoverview Module 4 (REST API v1) -- imports the Module 3 Lambda
 * Authorizer via SSM and exposes it as a RequestAuthorizer, matching
 * Balaji's tested integration guide exactly (Section: "For API Gateway
 * Modules (Module 4)"). M3's authorizer Lambda generates a classic IAM
 * Allow policy response -- that is a REQUEST-authorizer-shaped output,
 * not a TOKEN authorizer or v2 SIMPLE response, so the authorizer class
 * used here matters and is not interchangeable.
 *
 * @module lib/api/api-authorizer
 */

import { Construct } from 'constructs';
import { Duration } from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { SharedParameter } from '../foundation/constructs/shared-parameter';
import { AuthParameters } from '../foundation/constants/ssm-parameters';
import { PrajnaEnvironmentConfig } from '../foundation/config/environment';

export interface ApiAuthorizerProps {
  readonly config: PrajnaEnvironmentConfig;
  readonly restApi: apigateway.RestApi;
}

export class ApiAuthorizer extends Construct {
  public readonly authorizerFunction: lambda.IFunction;
  public readonly jwtAuthorizer: apigateway.RequestAuthorizer;

  constructor(scope: Construct, id: string, props: ApiAuthorizerProps) {
    super(scope, id);

    const authorizerArn = SharedParameter.valueForStringParameter(
      this,
      AuthParameters.authorizerFunctionArn(props.config.stage),
    );

    this.authorizerFunction = lambda.Function.fromFunctionAttributes(this, 'ImportedAuthorizerFn', {
      functionArn: authorizerArn,
      sameEnvironment: true,
    });

    this.jwtAuthorizer = new apigateway.RequestAuthorizer(this, 'PlatformAuthorizer', {
      handler: this.authorizerFunction,
      identitySources: [apigateway.IdentitySource.header('Authorization')],
      resultsCacheTtl: Duration.minutes(5),
    });

    this.authorizerFunction.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));

    (this.jwtAuthorizer as unknown as { _attachToApi(restApi: apigateway.IRestApi): void })
      ._attachToApi(props.restApi);
  }
}
