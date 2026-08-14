import { Annotations, CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sns from 'aws-cdk-lib/aws-sns';
import { PrajnaEnvironmentConfig } from '../foundation/config/environment';
import { ModuleIdentifier } from '../foundation/constants/naming';
import { ResourceNames } from '../foundation/constants/resource-names';
import { PLATFORM_VERSION } from '../foundation/constants/defaults';
import { PrajnaTags } from '../foundation/tags/tags';
import { requireNonEmpty } from '../foundation/utils/validation';
import { AlarmFactory } from '../foundation/monitoring/alarms';
import { SharedParameter } from '../foundation/constructs/shared-parameter';
import { PrajnaCognito } from './cognito';
import { PrajnaCognitoGroups } from './groups';
import { PrajnaAuthOutputs } from './outputs';
import { PrajnaAuthorizer } from './authorizer';

export interface AuthStackProps extends StackProps {
  /** The fully resolved environment configuration. */
  readonly config: PrajnaEnvironmentConfig;
}

/**
 * The Auth Stack provisions authentication and user management 
 * resources for the PRAJNA platform.
 * 
 * It depends on the CDK Foundation layer (Module 1) for conventions
 * and standards.
 */
export class AuthStack extends Stack {
  
  /** The core Cognito construct containing User Pool and App Client. */
  public readonly cognito: PrajnaCognito;
  
  /** The User Groups construct. */
  public readonly groups: PrajnaCognitoGroups;

  /** The Outputs construct. */
  public readonly outputs: PrajnaAuthOutputs;

  /** The API Gateway Lambda Authorizer construct. */
  public readonly authorizer: PrajnaAuthorizer;

  /**
   * The platform-wide ops alarm topic. Every {@link AlarmFactory}-created
   * alarm across every module notifies here, so on-call has one place to
   * subscribe instead of per-module topics. Owned here (not FoundationStack)
   * because `Prajna-Dev-Foundation` is stuck in `REVIEW_IN_PROGRESS` with an
   * unexecuted changeset that would try to recreate the already-live
   * EventBridge bus and fail — see AGENTS.md §8 item 9. AuthStack deploys
   * cleanly and deploys before Storage/Api in bin/prajna.ts, so it's a safe
   * home for this until Foundation is fixed. Subscribe an email/SMS/
   * PagerDuty endpoint to this topic per stage — not done automatically,
   * since who gets paged is an operational decision, not an infra one.
   */
  public readonly opsAlarmTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    const { config } = props;
    
    // Validation
    requireNonEmpty(config.stage, 'config.stage');

    const stage = config.stage;
    const module = ModuleIdentifier.AUTH;

    // ── Infrastructure ───────────────────────────────────────────────────

    // 1. Create User Pool and App Client
    this.cognito = new PrajnaCognito(this, 'Cognito', {
      config,
    });

    // 2. Create standard User Groups
    this.groups = new PrajnaCognitoGroups(this, 'Groups', {
      config,
      userPoolId: this.cognito.userPool.userPoolId,
      module,
    });

    // 3. Publish Outputs via SSM
    this.outputs = new PrajnaAuthOutputs(this, 'Outputs', {
      config,
      module,
      userPool: this.cognito.userPool,
      webClient: this.cognito.webClient,
    });

    // 4. Create API Gateway Authorizer
    this.authorizer = new PrajnaAuthorizer(this, 'Authorizer', {
      config,
      module,
      userPool: this.cognito.userPool,
      webClient: this.cognito.webClient,
    });

    // ── CloudFormation Outputs ───────────────────────────────────────────
    new CfnOutput(this, 'UserPoolId', {
      value: this.cognito.userPool.userPoolId,
      description: 'Prajna Platform Cognito User Pool ID',
    });

    new CfnOutput(this, 'UserPoolArn', {
      value: this.cognito.userPool.userPoolArn,
      description: 'Prajna Platform Cognito User Pool ARN',
    });

    new CfnOutput(this, 'UserPoolClientId', {
      value: this.cognito.webClient.userPoolClientId,
      description: 'Prajna Platform Cognito App Client ID',
    });

    new CfnOutput(this, 'AuthorizerLambdaArn', {
      value: this.authorizer.lambdaFunction.functionArn,
      description: 'Prajna Platform Authorizer Lambda ARN',
    });

    // ── Ops Alarm Topic ──────────────────────────────────────────────────
    // See the opsAlarmTopic doc comment for why this lives here instead of
    // FoundationStack. Module tagged MONITORING even though physically
    // created in the Auth stack, since "auth owns platform alerting" would
    // be a misleading tag for anyone reading CloudWatch/SNS resource tags.
    this.opsAlarmTopic = new sns.Topic(this, 'OpsAlarmTopic', {
      topicName: ResourceNames.snsTopic(config.stage, ModuleIdentifier.MONITORING, 'ops-alarms'),
      displayName: `[${config.stage.toUpperCase()}] PRAJNA Ops Alarms`,
    });

    new SharedParameter(this, 'OpsAlarmTopicArnParam', {
      config,
      module: ModuleIdentifier.MONITORING,
      identifier: 'ops-alarm-topic-arn',
      description: 'Platform-wide CloudWatch alarm notification topic ARN',
      value: this.opsAlarmTopic.topicArn,
    });

    // ── Alarms ───────────────────────────────────────────────────────────
    // The authorizer sits in front of EVERY authenticated request on the
    // platform -- an elevated error rate here is a platform-wide outage,
    // not a module-local one, so it gets alarmed even though this stack
    // owns no other alarmed resources.
    AlarmFactory.forLambda(
      this,
      config,
      module,
      'authorizer',
      this.authorizer.lambdaFunction.function,
      this.opsAlarmTopic,
    );

    // ── Tagging ──────────────────────────────────────────────────────────
    PrajnaTags.applyToStack(this, stage, module);

    // ── Annotations ──────────────────────────────────────────────────────
    const userPoolName = ResourceNames.cognitoUserPool(stage, module, 'platform');
    Annotations.of(this).addInfo(
      `Auth Stack initialized. Stage: ${stage}, User Pool Name: ${userPoolName}, Version: ${PLATFORM_VERSION}`
    );
  }
}
