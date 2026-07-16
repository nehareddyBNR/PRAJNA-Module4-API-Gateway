import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { SharedParameter } from '../foundation/constructs/shared-parameter';
import { PrajnaEnvironmentConfig } from '../foundation/config/environment';
import { ModuleIdentifier } from '../foundation/constants/naming';
import { PrajnaTags } from '../foundation/tags/tags';
import { requireNonEmpty } from '../foundation/utils/validation';

export interface PrajnaAuthOutputsProps {
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
 * Publishes the Auth module outputs to AWS Systems Manager (SSM) Parameter Store
 * so that other modules (like API Gateway and Business Logic) can discover them.
 */
export class PrajnaAuthOutputs extends Construct {
  
  public readonly userPoolIdParameter: SharedParameter;
  public readonly userPoolArnParameter: SharedParameter;
  public readonly userPoolClientIdParameter: SharedParameter;

  constructor(scope: Construct, id: string, props: PrajnaAuthOutputsProps) {
    super(scope, id);

    const { config, module, userPool, webClient } = props;

    // Validation
    requireNonEmpty(userPool.userPoolId, 'userPoolId');
    requireNonEmpty(userPool.userPoolArn, 'userPoolArn');
    requireNonEmpty(webClient.userPoolClientId, 'userPoolClientId');

    // ── User Pool Parameters ─────────────────────────────────────────────
    
    this.userPoolIdParameter = new SharedParameter(this, 'UserPoolIdParam', {
      config,
      module,
      identifier: 'user-pool-id',
      value: userPool.userPoolId,
      description: 'Platform Cognito User Pool ID',
    });

    this.userPoolArnParameter = new SharedParameter(this, 'UserPoolArnParam', {
      config,
      module,
      identifier: 'user-pool-arn',
      value: userPool.userPoolArn,
      description: 'Platform Cognito User Pool ARN',
    });

    this.userPoolClientIdParameter = new SharedParameter(this, 'UserPoolClientIdParam', {
      config,
      module,
      identifier: 'user-pool-client-id',
      value: webClient.userPoolClientId,
      description: 'Platform Cognito App Client ID',
    });

    // ── Tagging ──────────────────────────────────────────────────────────
    PrajnaTags.applyToStack(this, config.stage, module);
  }
}
