import { App, Stack, Duration } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as iam from 'aws-cdk-lib/aws-iam';
import { SharedRole } from '../../lib/foundation/constructs/shared-role';
import { devConfig } from '../../lib/foundation/config/dev';
import { ModuleIdentifier } from '../../lib/foundation/constants/naming';

describe('SharedRole', () => {
  let app: App;
  let stack: Stack;

  const defaultProps = {
    config: devConfig,
    module: ModuleIdentifier.AUTH,
    identifier: 'test-role',
    description: 'Test role description',
    assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
  };

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'TestStack');
  });

  describe('constructor', () => {
    it('creates IAM Role and construct synthesizes successfully', () => {
      new SharedRole(stack, 'Role', defaultProps);
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: {
          Statement: [
            {
              Action: 'sts:AssumeRole',
              Effect: 'Allow',
              Principal: { Service: 'lambda.amazonaws.com' },
            },
          ],
        },
      });
    });

    it('role name generated correctly', () => {
      new SharedRole(stack, 'Role', defaultProps);
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::IAM::Role', {
        RoleName: 'prajna-dev-auth-role-test-role',
      });
    });

    it('trust policy uses lambda.amazonaws.com', () => {
      new SharedRole(stack, 'Role', defaultProps);
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Principal: { Service: 'lambda.amazonaws.com' }
            })
          ])
        }
      });
    });

    it('description contains stage', () => {
      new SharedRole(stack, 'Role', defaultProps);
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::IAM::Role', {
        Description: '[DEV] Test role description',
      });
    });

    it('role ARN exposed', () => {
      const role = new SharedRole(stack, 'Role', defaultProps);
      expect(role.roleArn).toBeDefined();
      expect(typeof role.roleArn).toBe('string');
    });
  });

  describe('managed policies', () => {
    it('managed policy attached', () => {
      new SharedRole(stack, 'Role', {
        ...defaultProps,
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('ReadOnlyAccess'),
        ],
      });
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::IAM::Role', {
        ManagedPolicyArns: [
          {
            'Fn::Join': ['', ['arn:', { Ref: 'AWS::Partition' }, ':iam::aws:policy/ReadOnlyAccess']]
          }
        ],
      });
    });

    it('multiple managed policies attached', () => {
      new SharedRole(stack, 'Role', {
        ...defaultProps,
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('ReadOnlyAccess'),
          iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3ReadOnlyAccess'),
        ],
      });
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::IAM::Role', {
        ManagedPolicyArns: [
          {
            'Fn::Join': ['', ['arn:', { Ref: 'AWS::Partition' }, ':iam::aws:policy/ReadOnlyAccess']]
          },
          {
            'Fn::Join': ['', ['arn:', { Ref: 'AWS::Partition' }, ':iam::aws:policy/AmazonS3ReadOnlyAccess']]
          }
        ],
      });
    });

    it('addManagedPolicy() attaches managed policy', () => {
      const role = new SharedRole(stack, 'Role', defaultProps);
      role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('ReadOnlyAccess'));
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::IAM::Role', {
        ManagedPolicyArns: [
          {
            'Fn::Join': ['', ['arn:', { Ref: 'AWS::Partition' }, ':iam::aws:policy/ReadOnlyAccess']]
          }
        ],
      });
    });
  });

  describe('inline policies', () => {
    it('inline policy attached', () => {
      new SharedRole(stack, 'Role', {
        ...defaultProps,
        inlinePolicies: {
          TestInlinePolicy: new iam.PolicyDocument({
            statements: [
              new iam.PolicyStatement({
                actions: ['s3:GetObject'],
                resources: ['*'],
              }),
            ],
          }),
        },
      });
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::IAM::Role', {
        Policies: [
          {
            PolicyName: 'TestInlinePolicy',
            PolicyDocument: {
              Statement: [
                {
                  Action: 's3:GetObject',
                  Effect: 'Allow',
                  Resource: '*',
                },
              ],
            },
          },
        ],
      });
    });
  });

  describe('policy statements', () => {
    it('policy statement attached during construction', () => {
      new SharedRole(stack, 'Role', {
        ...defaultProps,
        policyStatements: [
          new iam.PolicyStatement({
            actions: ['dynamodb:Query'],
            resources: ['*'],
          }),
        ],
      });
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: [
            {
              Action: 'dynamodb:Query',
              Effect: 'Allow',
              Resource: '*',
            },
          ],
        },
      });
    });

    it('addToPolicy() adds policy statement', () => {
      const role = new SharedRole(stack, 'Role', defaultProps);
      role.addToPolicy(
        new iam.PolicyStatement({
          actions: ['sqs:SendMessage'],
          resources: ['*'],
        }),
      );
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: [
            {
              Action: 'sqs:SendMessage',
              Effect: 'Allow',
              Resource: '*',
            },
          ],
        },
      });
    });
  });

  describe('session duration', () => {
    it('default max session duration = 3600', () => {
      new SharedRole(stack, 'Role', defaultProps);
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::IAM::Role', {
        MaxSessionDuration: 3600,
      });
    });

    it('custom session duration', () => {
      new SharedRole(stack, 'Role', {
        ...defaultProps,
        maxSessionDuration: Duration.hours(2),
      });
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::IAM::Role', {
        MaxSessionDuration: 7200,
      });
    });
  });

  describe('tagging', () => {
    it('role is tagged correctly', () => {
      new SharedRole(stack, 'Role', defaultProps);
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::IAM::Role', {
        Tags: Match.arrayWith([
          { Key: 'Environment', Value: 'dev' },
          { Key: 'Module', Value: 'auth' },
        ]),
      });
    });
  });

  describe('lambda factory method', () => {
    it('forLambda() creates Lambda role', () => {
      SharedRole.forLambda(stack, 'Role', {
        config: devConfig,
        module: ModuleIdentifier.AUTH,
        identifier: 'lambda-role',
        description: 'Test lambda role',
      });
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: {
          Statement: [
            {
              Action: 'sts:AssumeRole',
              Effect: 'Allow',
              Principal: { Service: 'lambda.amazonaws.com' },
            },
          ],
        },
      });
    });

    it('AWSLambdaBasicExecutionRole attached', () => {
      SharedRole.forLambda(stack, 'Role', {
        config: devConfig,
        module: ModuleIdentifier.AUTH,
        identifier: 'lambda-role',
        description: 'Test lambda role',
      });
      const template = Template.fromStack(stack);
      
      template.hasResourceProperties('AWS::IAM::Role', {
        ManagedPolicyArns: Match.arrayWith([
          {
            'Fn::Join': ['', ['arn:', { Ref: 'AWS::Partition' }, ':iam::aws:policy/service-role/AWSLambdaBasicExecutionRole']]
          }
        ]),
      });
    });

    describe('xray option', () => {
      it('AWSXRayDaemonWriteAccess attached by default', () => {
        SharedRole.forLambda(stack, 'Role', {
          config: devConfig,
          module: ModuleIdentifier.AUTH,
          identifier: 'lambda-role',
          description: 'Test lambda role',
        });
        const template = Template.fromStack(stack);
        
        template.hasResourceProperties('AWS::IAM::Role', {
          ManagedPolicyArns: Match.arrayWith([
            {
              'Fn::Join': ['', ['arn:', { Ref: 'AWS::Partition' }, ':iam::aws:policy/AWSXRayDaemonWriteAccess']]
            }
          ]),
        });
      });

      it('xrayEnabled=false removes XRay policy', () => {
        SharedRole.forLambda(stack, 'Role', {
          config: devConfig,
          module: ModuleIdentifier.AUTH,
          identifier: 'lambda-role',
          description: 'Test lambda role',
          xrayEnabled: false,
        });
        const template = Template.fromStack(stack);
        
        template.hasResourceProperties('AWS::IAM::Role', {
          ManagedPolicyArns: Match.not(Match.arrayWith([
            {
              'Fn::Join': ['', ['arn:', { Ref: 'AWS::Partition' }, ':iam::aws:policy/AWSXRayDaemonWriteAccess']]
            }
          ])),
        });
      });
    });
  });

  describe('validation', () => {
    it('validation throws on empty identifier', () => {
      expect(() => {
        new SharedRole(stack, 'Role', {
          ...defaultProps,
          identifier: '',
        });
      }).toThrow(/identifier/);
    });

    it('validation throws on empty description', () => {
      expect(() => {
        new SharedRole(stack, 'Role', {
          ...defaultProps,
          description: '',
        });
      }).toThrow(/description/);
    });
  });
});
