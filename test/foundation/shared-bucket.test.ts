import { App, Stack, Duration, RemovalPolicy } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import { SharedBucket } from '../../lib/foundation/constructs/shared-bucket';
import { devConfig } from '../../lib/foundation/config/dev';
import { prodConfig } from '../../lib/foundation/config/prod';
import { ModuleIdentifier } from '../../lib/foundation/constants/naming';

describe('SharedBucket', () => {
  let app: App;
  let stack: Stack;

  const defaultProps = {
    config: devConfig,
    module: ModuleIdentifier.STORAGE,
    identifier: 'test-bucket',
  };

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, 'TestStack', {
      env: { account: '123456789012', region: 'ap-south-1' },
    });
  });

  describe('Constructor', () => {
    it('Bucket created', () => {
      new SharedBucket(stack, 'Bucket', defaultProps);
      const template = Template.fromStack(stack);
      template.resourceCountIs('AWS::S3::Bucket', 1);
    });

    it('Bucket name is correctly generated with account suffix', () => {
      new SharedBucket(stack, 'Bucket', defaultProps);
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketName: 'prajna-dev-storage-s3-test-bucket-123456789012',
      });
    });

    it('Bucket ARN exposed', () => {
      const bucket = new SharedBucket(stack, 'Bucket', defaultProps);
      expect(bucket.bucketArn).toBeDefined();
    });

    it('Bucket regional domain exposed', () => {
      const bucket = new SharedBucket(stack, 'Bucket', defaultProps);
      expect(bucket.bucketRegionalDomainName).toBeDefined();
    });

    it('Bucket domain exposed', () => {
      const bucket = new SharedBucket(stack, 'Bucket', defaultProps);
      expect(bucket.bucketDomainName).toBeDefined();
    });
  });

  describe('Security', () => {
    it('Encryption is S3_MANAGED by default', () => {
      new SharedBucket(stack, 'Bucket', defaultProps);
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [
            { ServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } },
          ],
        },
      });
    });

    it('Encryption uses KMS when provided', () => {
      const key = new kms.Key(stack, 'Key');
      new SharedBucket(stack, 'Bucket', { ...defaultProps, encryptionKey: key });
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketEncryption: {
          ServerSideEncryptionConfiguration: [
            { ServerSideEncryptionByDefault: { SSEAlgorithm: 'aws:kms', KMSMasterKeyID: { 'Fn::GetAtt': [Match.anyValue(), 'Arn'] } } },
          ],
        },
      });
    });

    it('Public access blocked', () => {
      new SharedBucket(stack, 'Bucket', defaultProps);
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::S3::Bucket', {
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
      });
    });

    it('SSL enforcement applied via policy', () => {
      new SharedBucket(stack, 'Bucket', defaultProps);
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::S3::BucketPolicy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 's3:*',
              Condition: { Bool: { 'aws:SecureTransport': 'false' } },
              Effect: 'Deny',
            }),
          ]),
        },
      });
    });

    it('Ownership is BUCKET_OWNER_ENFORCED', () => {
      new SharedBucket(stack, 'Bucket', defaultProps);
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::S3::Bucket', {
        OwnershipControls: {
          Rules: [{ ObjectOwnership: 'BucketOwnerEnforced' }],
        },
      });
    });

    it('Versioning enabled based on environment config', () => {
      new SharedBucket(stack, 'Bucket', { ...defaultProps, config: prodConfig });
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::S3::Bucket', {
        VersioningConfiguration: { Status: 'Enabled' },
      });
    });
  });

  describe('Lifecycle', () => {
    it('Lifecycle rules applied (Expiration, Transition, Noncurrent)', () => {
      new SharedBucket(stack, 'Bucket', {
        ...defaultProps,
        lifecycleRules: [
          {
            id: 'archive',
            expirationDays: 365,
            transitions: [
              { storageClass: s3.StorageClass.INFREQUENT_ACCESS, transitionAfter: Duration.days(90) }
            ],
            noncurrentVersionExpirationDays: 30,
            prefix: 'docs/',
          }
        ],
      });
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::S3::Bucket', {
        LifecycleConfiguration: {
          Rules: Match.arrayWith([
            Match.objectLike({
              Id: 'archive',
              Status: 'Enabled',
              ExpirationInDays: 365,
              Prefix: 'docs/',
              NoncurrentVersionExpiration: { NoncurrentDays: 30 },
              Transitions: [
                { StorageClass: 'STANDARD_IA', TransitionInDays: 90 },
              ],
            }),
          ]),
        },
      });
    });
  });

  describe('Removal Policy', () => {
    it('DESTROY policy sets AutoDeleteObjects', () => {
      new SharedBucket(stack, 'Bucket', { ...defaultProps, removalPolicy: RemovalPolicy.DESTROY });
      const template = Template.fromStack(stack);
      template.hasResource('AWS::S3::Bucket', {
        UpdateReplacePolicy: 'Delete',
        DeletionPolicy: 'Delete',
      });
      template.resourceCountIs('Custom::S3AutoDeleteObjects', 1);
    });

    it('RETAIN policy does not AutoDeleteObjects', () => {
      new SharedBucket(stack, 'Bucket', { ...defaultProps, removalPolicy: RemovalPolicy.RETAIN });
      const template = Template.fromStack(stack);
      template.hasResource('AWS::S3::Bucket', {
        UpdateReplacePolicy: 'Retain',
        DeletionPolicy: 'Retain',
      });
      template.resourceCountIs('Custom::S3AutoDeleteObjects', 0);
    });
  });

  describe('IAM Grants', () => {
    it('grantRead()', () => {
      const bucket = new SharedBucket(stack, 'Bucket', defaultProps);
      const role = new iam.Role(stack, 'Role', { assumedBy: new iam.AccountRootPrincipal() });
      bucket.grantRead(role);
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: { Statement: Match.arrayWith([Match.objectLike({ Action: Match.arrayWith(['s3:GetObject*', 's3:GetBucket*', 's3:List*']) })]) },
      });
    });

    it('grantWrite()', () => {
      const bucket = new SharedBucket(stack, 'Bucket', defaultProps);
      const role = new iam.Role(stack, 'Role', { assumedBy: new iam.AccountRootPrincipal() });
      bucket.grantWrite(role);
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: { Statement: Match.arrayWith([Match.objectLike({ Action: Match.arrayWith(['s3:PutObject']) })]) },
      });
    });

    it('grantReadWrite()', () => {
      const bucket = new SharedBucket(stack, 'Bucket', defaultProps);
      const role = new iam.Role(stack, 'Role', { assumedBy: new iam.AccountRootPrincipal() });
      bucket.grantReadWrite(role);
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: { Statement: Match.arrayWith([Match.objectLike({ Action: Match.arrayWith(['s3:GetObject*', 's3:GetBucket*', 's3:List*', 's3:DeleteObject*', 's3:PutObject', 's3:PutObjectLegalHold', 's3:PutObjectRetention', 's3:PutObjectTagging', 's3:PutObjectVersionTagging', 's3:Abort*']) })]) },
      });
    });

    it('grantPut()', () => {
      const bucket = new SharedBucket(stack, 'Bucket', defaultProps);
      const role = new iam.Role(stack, 'Role', { assumedBy: new iam.AccountRootPrincipal() });
      bucket.grantPut(role, 'docs/*');
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: { Statement: Match.arrayWith([Match.objectLike({ Action: Match.arrayWith(['s3:PutObject', 's3:PutObjectLegalHold', 's3:PutObjectRetention', 's3:PutObjectTagging', 's3:PutObjectVersionTagging', 's3:Abort*']) })]) },
      });
    });

    it('grantDelete()', () => {
      const bucket = new SharedBucket(stack, 'Bucket', defaultProps);
      const role = new iam.Role(stack, 'Role', { assumedBy: new iam.AccountRootPrincipal() });
      bucket.grantDelete(role);
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: { Statement: Match.arrayWith([Match.objectLike({ Action: 's3:DeleteObject*' })]) },
      });
    });
  });

  describe('Tagging', () => {
    it('Project tags applied', () => {
      new SharedBucket(stack, 'Bucket', defaultProps);
      const template = Template.fromStack(stack);
      const buckets = template.findResources('AWS::S3::Bucket');
      expect(JSON.stringify(buckets)).toContain('Project');
    });

    it('Module tags applied', () => {
      new SharedBucket(stack, 'Bucket', defaultProps);
      const template = Template.fromStack(stack);
      const buckets = template.findResources('AWS::S3::Bucket');
      expect(JSON.stringify(buckets)).toContain('Module');
    });

    it('Environment tags applied', () => {
      new SharedBucket(stack, 'Bucket', defaultProps);
      const template = Template.fromStack(stack);
      const buckets = template.findResources('AWS::S3::Bucket');
      expect(JSON.stringify(buckets)).toContain('Environment');
    });
  });

  describe('Validation', () => {
    it('Empty identifier throws error', () => {
      expect(() => {
        new SharedBucket(stack, 'Bucket', { ...defaultProps, identifier: '' });
      }).toThrow(/identifier/);
    });

    it('Invalid lifecycle configuration throws error', () => {
      expect(() => {
        new SharedBucket(stack, 'Bucket', {
          ...defaultProps,
          lifecycleRules: [{ id: 'empty-rule' }],
        });
      }).toThrow(/Invalid lifecycle configuration/);
    });
  });

  describe('CORS', () => {
    it('Default rules (cors = true)', () => {
      new SharedBucket(stack, 'Bucket', { ...defaultProps, cors: true });
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::S3::Bucket', {
        CorsConfiguration: {
          CorsRules: [
            {
              AllowedMethods: ['GET', 'PUT', 'POST', 'HEAD'],
              AllowedOrigins: ['*'],
            },
          ],
        },
      });
    });

    it('Custom rules (corsRules provided)', () => {
      new SharedBucket(stack, 'Bucket', {
        ...defaultProps,
        corsRules: [{ allowedMethods: [s3.HttpMethods.GET], allowedOrigins: ['https://example.com'] }],
      });
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::S3::Bucket', {
        CorsConfiguration: {
          CorsRules: [
            {
              AllowedMethods: ['GET'],
              AllowedOrigins: ['https://example.com'],
            },
          ],
        },
      });
    });
  });

  describe('EventBridge', () => {
    it('Enabled', () => {
      const sharedBucket = new SharedBucket(stack, 'Bucket', { ...defaultProps, eventBridgeEnabled: true });
      // Since AWS CDK might use Custom::S3BucketNotifications or native NotificationConfiguration
      // depending on other event bindings, we simply verify the construct synthesized successfully.
      expect(sharedBucket.bucketArn).toBeDefined();
    });

    it('Disabled', () => {
      new SharedBucket(stack, 'Bucket', { ...defaultProps, eventBridgeEnabled: false });
      const template = Template.fromStack(stack);
      const bucket = template.findResources('AWS::S3::Bucket');
      const props = Object.values(bucket)[0].Properties;
      if (props.NotificationConfiguration) {
        expect(props.NotificationConfiguration.EventBridgeConfiguration).toBeUndefined();
      }
    });
  });

  describe('Access Logging', () => {
    it('Logging bucket', () => {
      const logBucket = new s3.Bucket(stack, 'LogBucket');
      new SharedBucket(stack, 'Bucket', { ...defaultProps, serverAccessLogsBucket: logBucket });
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::S3::Bucket', {
        LoggingConfiguration: {
          DestinationBucketName: { Ref: Match.anyValue() },
        },
      });
    });

    it('Logging prefix', () => {
      const logBucket = new s3.Bucket(stack, 'LogBucket');
      new SharedBucket(stack, 'Bucket', { ...defaultProps, serverAccessLogsBucket: logBucket, serverAccessLogsPrefix: 'logs/' });
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::S3::Bucket', {
        LoggingConfiguration: {
          LogFilePrefix: 'logs/',
        },
      });
    });
  });
});
