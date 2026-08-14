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
      // OPTIONAL, not REQUIRED: flipping this to required would lock every
      // existing user out on the next login, since Cognito enforces MFA
      // setup at sign-in time once required and none of today's users have
      // enrolled. TOTP only (no SMS) -- SMS MFA needs an SNS origination
      // identity and, for Indian numbers, DLT sender registration; neither
      // exists yet, and a "supported" MFA method that silently fails to
      // deliver is worse than not offering it.
      //
      // Recovery when a user loses their authenticator device: Cognito has
      // no user-facing backup-code mechanism for software-token MFA (unlike
      // GitHub/Google). The operator-side recovery path is:
      //   aws cognito-idp admin-set-user-mfa-preference \
      //     --user-pool-id <pool-id> --username <email> \
      //     --software-token-mfa-settings Enabled=false,PreferredMfa=false
      // which clears MFA for that one user so they can sign in and re-enroll.
      // Requires an admin with IAM access to this user pool -- there is no
      // self-service recovery, by design (a self-service MFA bypass would
      // defeat the point of MFA).
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        otp: true,
        sms: false,
      },
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

    // Deliberately NOT withCustomAttributes(...) here -- unlike
    // clientReadAttributes above, the SPA client must not be able to WRITE
    // role/campus/department/facultyId on itself. All four are authorization-
    // relevant: src/auth/authorizer/index.ts falls back to trusting
    // `custom:role` verbatim whenever a user isn't in a Cognito Group (which
    // includes every self-signed-up dev user, since selfSignUpEnabled is true
    // there). With write access granted, any authenticated user could call
    // Cognito's standard UpdateUserAttributes with their own access token and
    // set custom:role=ADMIN -- no admin API needed. Found in a security audit
    // 2026-08-14. These four attributes are now admin-write-only
    // (AdminUpdateUserAttributes / admin-create-user, which is how every test
    // user this session was actually provisioned -- this fix does not change
    // that flow at all). A self-signed-up user who never gets a role assigned
    // reads back custom:role as unset, which the authorizer already treats as
    // 'UNKNOWN' (rank -1, lowest possible) -- the safe failure direction.
    const clientWriteAttributes = new cognito.ClientAttributes()
      .withStandardAttributes({
        email: true,
        givenName: true,
        familyName: true,
        phoneNumber: true,
      });

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
