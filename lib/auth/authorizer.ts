import { Construct } from 'constructs';
import { Stack, Annotations } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';

import { PrajnaEnvironmentConfig } from '../foundation/config/environment';
import { ModuleIdentifier } from '../foundation/constants/naming';
import { PrajnaTags } from '../foundation/tags/tags';
import { requireNonEmpty } from '../foundation/utils/validation';
import { SharedLambda } from '../foundation/constructs/shared-lambda';
import { SharedRole } from '../foundation/constructs/shared-role';
import { SharedParameter } from '../foundation/constructs/shared-parameter';

export interface PrajnaAuthorizerProps {
  /** The full environment configuration object. */
  readonly config: PrajnaEnvironmentConfig;
  
  /** The module identifier. */
  readonly module: ModuleIdentifier;
  
  /** The User Pool. */
  readonly userPool: cognito.UserPool;
  
  /** The Web Application Client. */
  readonly webClient: cognito.UserPoolClient;
}

/**
 * Provisions the Lambda Authorizer infrastructure used by API Gateway.
 */
export class PrajnaAuthorizer extends Construct {
  
  public readonly lambdaFunction: SharedLambda;
  public readonly role: SharedRole;
  
  public readonly authorizerArnParameter: SharedParameter;
  public readonly authorizerNameParameter: SharedParameter;

  constructor(scope: Construct, id: string, props: PrajnaAuthorizerProps) {
    super(scope, id);

    const { config, module, userPool, webClient } = props;

    // Validation
    requireNonEmpty(userPool.userPoolId, 'userPoolId');
    requireNonEmpty(webClient.userPoolClientId, 'userPoolClientId');

    // 1. SharedRole (Execution role with CloudWatch and X-Ray)
    this.role = SharedRole.forLambda(this, 'AuthorizerRole', {
      config,
      module,
      identifier: 'authorizer-role',
      description: 'Execution role for the API Gateway Lambda Authorizer',
      xrayEnabled: true,
    });

    // 2. SharedLambda & 3. SharedLogGroup (automatically created by SharedLambda)
    this.lambdaFunction = new SharedLambda(this, 'AuthorizerLambda', {
      config,
      module,
      identifier: 'authorizer',
      description: 'API Gateway Lambda Authorizer for JWT validation and context injection',
      // The path to where the handler will be located.
      entry: path.join(__dirname, '../../src/auth/authorizer/index.ts'),
      // Use inline dummy code to bypass compilation errors until the handler is implemented in a future step.
      code: lambda.Code.fromInline('exports.handler = async () => { return { isAuthorized: false }; };'),
      existingRole: this.role.role,
      environment: {
        USER_POOL_ID: userPool.userPoolId,
        USER_POOL_CLIENT_ID: webClient.userPoolClientId,
      },
    });

    // 4. Publish Lambda ARN and Name via SSM for other modules to consume
    this.authorizerArnParameter = new SharedParameter(this, 'AuthorizerArnParam', {
      config,
      module,
      identifier: 'authorizer-lambda-arn',
      description: 'PRAJNA Platform API Gateway Authorizer Lambda ARN',
      value: this.lambdaFunction.functionArn,
    });

    this.authorizerNameParameter = new SharedParameter(this, 'AuthorizerNameParam', {
      config,
      module,
      identifier: 'authorizer-lambda-name',
      description: 'PRAJNA Platform API Gateway Authorizer Lambda Name',
      value: this.lambdaFunction.functionName,
    });

    // Apply Foundation tagging standards
    PrajnaTags.applyToStack(this, config.stage, module);

    // Add synth-time informational annotation
    Annotations.of(this).addInfo('Auth Authorizer initialized');
  }
}