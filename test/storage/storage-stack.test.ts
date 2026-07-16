import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { StorageStack } from '../../lib/storage/storage-stack';
import { devConfig } from '../../lib/foundation/config/dev';
import { ModuleIdentifier } from '../../lib/foundation/constants/naming';

describe('StorageStack', () => {
  let app: cdk.App;
  let stack: StorageStack;
  let template: Template;

  beforeAll(() => {
    app = new cdk.App();
    stack = new StorageStack(app, 'TestStorageStack', {
      config: devConfig,
      env: { account: '123456789012', region: 'ap-south-1' },
    });
    template = Template.fromStack(stack);
  });

  // ── Bucket Creation ───────────────────────────────────────────────────

  test('Creates exactly two S3 buckets', () => {
    template.resourceCountIs('AWS::S3::Bucket', 2);
  });

  test('Documents bucket has correct name', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: Match.stringLikeRegexp('^prajna-dev-storage-s3-documents-'),
    });
  });

  test('Exports bucket has correct name', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: Match.stringLikeRegexp('^prajna-dev-storage-s3-exports-'),
    });
  });

  // ── Encryption ────────────────────────────────────────────────────────

  test('Documents bucket has S3-managed encryption', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: Match.stringLikeRegexp('^prajna-dev-storage-s3-documents-'),
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [
          {
            ServerSideEncryptionByDefault: {
              SSEAlgorithm: 'AES256',
            },
          },
        ],
      },
    });
  });

  test('Exports bucket has S3-managed encryption', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: Match.stringLikeRegexp('^prajna-dev-storage-s3-exports-'),
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [
          {
            ServerSideEncryptionByDefault: {
              SSEAlgorithm: 'AES256',
            },
          },
        ],
      },
    });
  });

  // ── Public Access Blocking ────────────────────────────────────────────

  test('All buckets have public access blocked', () => {
    const buckets = template.findResources('AWS::S3::Bucket');
    for (const [, bucket] of Object.entries(buckets)) {
      const props = (bucket as any).Properties;
      expect(props.PublicAccessBlockConfiguration).toEqual({
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      });
    }
  });

  // ── Lambda Functions (Phase 2) ────────────────────────────────────────

  test('Creates upload-url Lambda function', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'prajna-dev-storage-fn-upload-url',
    });
  });

  test('Creates download-url Lambda function', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'prajna-dev-storage-fn-download-url',
    });
  });

  test('Upload Lambda has BUCKET_NAME environment variable', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'prajna-dev-storage-fn-upload-url',
      Environment: {
        Variables: Match.objectLike({
          BUCKET_NAME: Match.stringLikeRegexp('^prajna-dev-storage-s3-documents-'),
        }),
      },
    });
  });

  test('Download Lambda has BUCKET_NAME environment variable', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'prajna-dev-storage-fn-download-url',
      Environment: {
        Variables: Match.objectLike({
          BUCKET_NAME: Match.stringLikeRegexp('^prajna-dev-storage-s3-documents-'),
        }),
      },
    });
  });

  // ── IAM Permissions ───────────────────────────────────────────────────

  test('Upload Lambda has s3:PutObject permission', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 's3:PutObject',
            Effect: 'Allow',
          }),
        ]),
      },
    });
  });

  test('Download Lambda has s3:GetObject permission', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 's3:GetObject',
            Effect: 'Allow',
          }),
        ]),
      },
    });
  });

  // ── SSM Parameters ────────────────────────────────────────────────────

  test('Publishes all 6 required SSM parameters', () => {
    const parameters = template.findResources('AWS::SSM::Parameter');
    const paramNames = Object.values(parameters).map(
      (p: any) => p.Properties.Name
    );

    // Phase 1
    expect(paramNames).toContain('/prajna/dev/storage/documents-bucket-name');
    expect(paramNames).toContain('/prajna/dev/storage/documents-bucket-arn');
    expect(paramNames).toContain('/prajna/dev/storage/exports-bucket-name');
    expect(paramNames).toContain('/prajna/dev/storage/exports-bucket-arn');

    // Phase 2
    expect(paramNames).toContain('/prajna/dev/storage/upload-lambda-arn');
    expect(paramNames).toContain('/prajna/dev/storage/download-lambda-arn');

    expect(paramNames).toHaveLength(6);
  });

  // ── Tagging ───────────────────────────────────────────────────────────

  test('Applies standard platform tags to buckets', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      Tags: Match.arrayWith([
        Match.objectLike({ Key: 'Module', Value: ModuleIdentifier.STORAGE }),
      ]),
    });

    template.hasResourceProperties('AWS::S3::Bucket', {
      Tags: Match.arrayWith([
        Match.objectLike({ Key: 'Environment', Value: devConfig.stage }),
      ]),
    });

    template.hasResourceProperties('AWS::S3::Bucket', {
      Tags: Match.arrayWith([
        Match.objectLike({ Key: 'Project', Value: 'prajna' }),
      ]),
    });
  });

  test('Applies standard platform tags to Lambda functions', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Tags: Match.arrayWith([
        Match.objectLike({ Key: 'Module', Value: ModuleIdentifier.STORAGE }),
      ]),
    });
  });

  test('Applies standard platform tags to SSM parameters', () => {
    template.hasResourceProperties('AWS::SSM::Parameter', {
      Tags: Match.objectLike({
        Module: ModuleIdentifier.STORAGE,
        Environment: devConfig.stage,
      }),
    });
  });
});
