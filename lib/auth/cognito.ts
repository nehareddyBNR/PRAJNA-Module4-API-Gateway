import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import { PrajnaEnvironmentConfig } from '../foundation/config/environment';
import { ResourceNames } from '../foundation/constants/resource-names';
import { ModuleIdentifier } from '../foundation/constants/naming';
import { PrajnaTags } from '../foundation/tags/tags';

export interface PrajnaCognitoProps {
  /** The full environment configuration object. */
  readonly config: PrajnaEnvironmentConfig;
}

/**
 * Creates the core Amazon Cognito infrastructure for the PRAJNA platform.
 * Includes the User Pool, Web Application Client, and custom user attributes.
 */
export class PrajnaCognito extends Construct {
  
  /** The primary User Pool. */
  public readonly userPool: cognito.UserPool;
  
  /** The Web Application Client. */
  public readonly webClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: PrajnaCognitoProps) {
    super(scope, id);

    const { config } = props;
    const stage = config.stage;
    const module = ModuleIdentifier.AUTH;

    // ── User Pool ────────────────────────────────────────────────────────
    
    const passwordPolicy: cognito.PasswordPolicy = {
      minLength: config.cognito.passwordMinLength,
      requireUppercase: config.cognito.requireUppercase,
      requireLowercase: config.cognito.requireLowercase,
      requireDigits: config.cognito.requireDigits,
      requireSymbols: config.cognito.requireSymbols,
    };

    const userPoolName = ResourceNames.cognitoUserPool(stage, module, 'platform');

    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName,
      selfSignUpEnabled: config.cognito.selfSignUpEnabled,
      signInAliases: { email: true },
      autoVerify: { email: config.cognito.autoVerifyEmail },
      passwordPolicy,
      removalPolicy: config.isProduction ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      customAttributes: {
        role: new cognito.StringAttribute({ mutable: true }),
        campus: new cognito.StringAttribute({ mutable: true }),
        department: new cognito.StringAttribute({ mutable: true }),
        facultyId: new cognito.StringAttribute({ mutable: true }),
      },
    });

    // ── App Client ───────────────────────────────────────────────────────
    
    const clientName = ResourceNames.cognitoClient(stage, module, 'web');

    const clientReadAttributes = new cognito.ClientAttributes()
      .withStandardAttributes({
        email: true,
        emailVerified: true,
        givenName: true,
        familyName: true,
        phoneNumber: true,
      })
      .withCustomAttributes('role', 'campus', 'department', 'facultyId');

    const clientWriteAttributes = new cognito.ClientAttributes()
      .withStandardAttributes({
        email: true,
        givenName: true,
        familyName: true,
        phoneNumber: true,
      })
      .withCustomAttributes('role', 'campus', 'department', 'facultyId');

    this.webClient = new cognito.UserPoolClient(this, 'WebClient', {
      userPool: this.userPool,
      userPoolClientName: clientName,
      generateSecret: false, // SPA web clients should not have a secret
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
      },
      readAttributes: clientReadAttributes,
      writeAttributes: clientWriteAttributes,
      accessTokenValidity: Duration.hours(config.cognito.accessTokenValidityHours),
      idTokenValidity: Duration.hours(config.cognito.accessTokenValidityHours),
      refreshTokenValidity: Duration.days(config.cognito.refreshTokenValidityDays),
    });

    // ── Tagging ──────────────────────────────────────────────────────────
    // Apply standard Prajna module-level tags to the resources inside this construct.
    PrajnaTags.applyToStack(this, stage, module);
  }
}
