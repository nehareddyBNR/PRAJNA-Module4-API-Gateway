import { App, Stack } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as iam from 'aws-cdk-lib/aws-iam';
import { SharedParameter } from '../../lib/foundation/constructs/shared-parameter';
import { devConfig } from '../../lib/foundation/config/dev';
import { qaConfig } from '../../lib/foundation/config/qa';
import { ModuleIdentifier } from '../../lib/foundation/constants/naming';

describe('SharedParameter', () => {
  let app: App;
  let stack: Stack;

  const defaultProps = {
    config: devConfig,
    module: ModuleIdentifier.AUTH,
    identifier: 'test-param',
    description: 'Test parameter description',
    value: 'test-value',
  };

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'TestStack', {
      env: { account: '123456789012', region: 'ap-south-1' },
    });
  });

  describe('constructor', () => {
    it('creates SSM parameter and construct synthesizes successfully', () => {
      new SharedParameter(stack, 'Param', defaultProps);
      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::SSM::Parameter', 1);
      template.hasResourceProperties('AWS::SSM::Parameter', {
        Type: 'String',
      });
    });

    it('description contains stage', () => {
      new SharedParameter(stack, 'Param', defaultProps);
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::SSM::Parameter', {
        Description: '[DEV] Test parameter description',
      });
    });

    it('parameter value stored correctly', () => {
      new SharedParameter(stack, 'Param', defaultProps);
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::SSM::Parameter', {
        Value: 'test-value',
      });
    });

    it('default parameter tier = STANDARD', () => {
      new SharedParameter(stack, 'Param', defaultProps);
      const template = Template.fromStack(stack);
      // SSM Parameter construct in CDK uses 'Standard' as default value which may not even be synthesized
      // Let's assert it exists or uses the default behavior.
      const params = template.findResources('AWS::SSM::Parameter');
      const paramProps = Object.values(params)[0].Properties;
      if (paramProps.Tier) {
        expect(paramProps.Tier).toBe('Standard');
      }
    });

    it('custom parameter tier', () => {
      new SharedParameter(stack, 'Param', {
        ...defaultProps,
        tier: ssm.ParameterTier.ADVANCED,
      });
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::SSM::Parameter', {
        Tier: 'Advanced',
      });
    });

    it('parameter ARN exposed', () => {
      const param = new SharedParameter(stack, 'Param', defaultProps);
      expect(param.parameterArn).toBeDefined();
      expect(typeof param.parameterArn).toBe('string');
    });

    it('parameterName exposed', () => {
      const param = new SharedParameter(stack, 'Param', defaultProps);
      expect(param.parameterName).toBeDefined();
      expect(typeof param.parameterName).toBe('string');
    });
  });

  describe('validation', () => {
    it('validation throws on empty identifier', () => {
      expect(() => {
        new SharedParameter(stack, 'Param', {
          ...defaultProps,
          identifier: '   ',
        });
      }).toThrow(/identifier/);
    });

    it('validation throws on empty description', () => {
      expect(() => {
        new SharedParameter(stack, 'Param', {
          ...defaultProps,
          description: '',
        });
      }).toThrow(/description/);
    });
  });

  describe('tagging', () => {
    it('project tags applied', () => {
      new SharedParameter(stack, 'Param', defaultProps);
      const template = Template.fromStack(stack);
      const params = template.findResources('AWS::SSM::Parameter');
      expect(JSON.stringify(params)).toContain('Project');
      expect(JSON.stringify(params)).toContain('prajna');
    });

    it('environment tags applied', () => {
      new SharedParameter(stack, 'Param', defaultProps);
      const template = Template.fromStack(stack);
      const params = template.findResources('AWS::SSM::Parameter');
      expect(JSON.stringify(params)).toContain('Environment');
      expect(JSON.stringify(params)).toContain('dev');
    });

    it('module tags applied', () => {
      new SharedParameter(stack, 'Param', defaultProps);
      const template = Template.fromStack(stack);
      const params = template.findResources('AWS::SSM::Parameter');
      expect(JSON.stringify(params)).toContain('Module');
      expect(JSON.stringify(params)).toContain('auth');
    });
  });

  describe('permissions', () => {
    it('grantRead() grants IAM permissions', () => {
      const param = new SharedParameter(stack, 'Param', defaultProps);
      const role = new iam.Role(stack, 'Role', { assumedBy: new iam.AccountRootPrincipal() });
      param.grantRead(role);
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith([
                'ssm:DescribeParameters',
                'ssm:GetParameters',
                'ssm:GetParameter',
                'ssm:GetParameterHistory'
              ]),
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });

    it('grantWrite() grants IAM permissions', () => {
      const param = new SharedParameter(stack, 'Param', defaultProps);
      const role = new iam.Role(stack, 'Role', { assumedBy: new iam.AccountRootPrincipal() });
      param.grantWrite(role);
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'ssm:PutParameter',
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });
  });

  describe('static helper methods', () => {
    it('valueForStringParameter() returns deploy-time token', () => {
      const val = SharedParameter.valueForStringParameter(stack, '/my/param');
      expect(typeof val).toBe('string');
      expect(val).toContain('Token'); // token resolving mechanism
    });

    it('valueFromLookup() lookup behavior is validated or appropriately mocked', () => {
      const val = SharedParameter.valueFromLookup(stack, 'LookupId', '/my/param');
      expect(val).toBeDefined();
      expect(typeof val).toBe('string');
      expect(val).toContain('dummy-value-for-'); // Typical CDK dummy lookup token or a Token itself
    });
  });

  describe('environment-specific paths', () => {
    it('different environments generate different parameter paths', () => {
      const paramDev = new SharedParameter(stack, 'ParamDev', {
        ...defaultProps,
        config: devConfig,
      });
      const paramQa = new SharedParameter(stack, 'ParamQa', {
        ...defaultProps,
        config: qaConfig,
      });
      expect(paramDev.parameterName).not.toEqual(paramQa.parameterName);
      expect(paramDev.parameterName).toContain('/dev/');
      expect(paramQa.parameterName).toContain('/qa/');
    });
  });

  describe('path generation', () => {
    it('parameter name generated correctly', () => {
      const param = new SharedParameter(stack, 'Param', defaultProps);
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::SSM::Parameter', {
        Name: '/prajna/dev/auth/test-param',
      });
    });

    it('parameter path follows PRAJNA naming convention', () => {
      const param = new SharedParameter(stack, 'Param', defaultProps);
      expect(param.parameterName).toMatch(/^\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+$/);
    });

    it('module identifier appears in parameter path', () => {
      const param = new SharedParameter(stack, 'Param', defaultProps);
      expect(param.parameterName).toContain(`/${defaultProps.module}/`);
    });

    it('identifier appears in parameter path', () => {
      const param = new SharedParameter(stack, 'Param', defaultProps);
      expect(param.parameterName).toMatch(new RegExp(`/${defaultProps.identifier}$`));
    });
  });
});
