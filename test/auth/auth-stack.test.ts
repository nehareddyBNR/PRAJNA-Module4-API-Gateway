import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AuthStack } from '../../lib/auth/auth-stack';
import { devConfig } from '../../lib/foundation/config/dev';
import { ModuleIdentifier } from '../../lib/foundation/constants/naming';

describe('AuthStack', () => {
  let app: cdk.App;
  let stack: AuthStack;
  let template: Template;

  beforeAll(() => {
    app = new cdk.App();
    stack = new AuthStack(app, 'TestAuthStack', {
      config: devConfig,
      env: { account: '123456789012', region: 'ap-south-1' },
    });
    template = Template.fromStack(stack);
  });

  test('Creates exactly one Cognito User Pool', () => {
    template.resourceCountIs('AWS::Cognito::UserPool', 1);
  });

  test('User Pool has expected properties from Dev config', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      UserPoolName: `prajna-dev-auth-userpool-platform`,
      Policies: {
        PasswordPolicy: {
          MinimumLength: devConfig.cognito.passwordMinLength,
          RequireLowercase: devConfig.cognito.requireLowercase,
          RequireUppercase: devConfig.cognito.requireUppercase,
          RequireNumbers: devConfig.cognito.requireDigits,
          RequireSymbols: devConfig.cognito.requireSymbols,
        },
      },
      AdminCreateUserConfig: {
        AllowAdminCreateUserOnly: !devConfig.cognito.selfSignUpEnabled,
      },
    });
  });

  test('Creates exactly one Cognito User Pool Client', () => {
    template.resourceCountIs('AWS::Cognito::UserPoolClient', 1);
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      ClientName: `prajna-dev-auth-client-web`,
      GenerateSecret: false,
    });
  });

  test('Creates the required standard User Groups', () => {
    const requiredGroups = ['ADMIN', 'PVC', 'IQAC', 'DIRECTOR', 'HOD', 'FACULTY'];
    
    // We expect 6 standard groups based on the Phase 1 requirements
    template.resourceCountIs('AWS::Cognito::UserPoolGroup', 6);
    
    for (const group of requiredGroups) {
      template.hasResourceProperties('AWS::Cognito::UserPoolGroup', {
        GroupName: group,
      });
    }
  });

  test('Publishes expected SSM Parameters', () => {
    // Should publish user pool ID, user pool ARN, and user pool client ID
    // So expect at least 3 SSM parameters.
    const parameters = template.findResources('AWS::SSM::Parameter');
    const paramNames = Object.values(parameters).map(
      (p: any) => p.Properties.Name
    );

    expect(paramNames).toContain('/prajna/dev/auth/user-pool-id');
    expect(paramNames).toContain('/prajna/dev/auth/user-pool-arn');
    expect(paramNames).toContain('/prajna/dev/auth/user-pool-client-id');
  });

  test('Applies standard platform tags to all resources', () => {
    // We check the User Pool to ensure tags propagated
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      UserPoolTags: {
        Module: ModuleIdentifier.AUTH,
        Environment: devConfig.stage,
      },
    });
  });
});
