/**
 * @fileoverview Storage API construct for the PRAJNA platform.
 *
 * Provisions the Lambda functions that generate pre-signed URLs
 * for secure file upload and download operations.
 *
 * Resources:
 * - Upload URL Lambda (s3:PutObject on documents bucket)
 * - Download URL Lambda (s3:GetObject on documents bucket)
 * - SSM parameters for Lambda ARN discovery
 *
 * @module storage/api
 */

import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';

import { PrajnaEnvironmentConfig } from '../foundation/config/environment';
import { ModuleIdentifier } from '../foundation/constants/naming';
import { PrajnaTags } from '../foundation/tags/tags';
import { requireNonEmpty } from '../foundation/utils/validation';
import { SharedLambda } from '../foundation/constructs/shared-lambda';
import { SharedBucket } from '../foundation/constructs/shared-bucket';
import { SharedParameter } from '../foundation/constructs/shared-parameter';

export interface PrajnaStorageApiProps {
  /** The full environment configuration object. */
  readonly config: PrajnaEnvironmentConfig;

  /** The module identifier (must be ModuleIdentifier.STORAGE). */
  readonly module: ModuleIdentifier;

  /** The documents bucket to generate pre-signed URLs for. */
  readonly documentsBucket: SharedBucket;
}

/**
 * Provisions Lambda functions for pre-signed URL generation.
 *
 * Upload Lambda: Generates PUT pre-signed URLs (s3:PutObject)
 * Download Lambda: Generates GET pre-signed URLs (s3:GetObject)
 */
export class PrajnaStorageApi extends Construct {

  /** The Upload URL Lambda function. */
  public readonly uploadLambda: SharedLambda;

  /** The Download URL Lambda function. */
  public readonly downloadLambda: SharedLambda;

  /** SSM parameter for the upload Lambda ARN. */
  public readonly uploadLambdaArnParameter: SharedParameter;

  /** SSM parameter for the download Lambda ARN. */
  public readonly downloadLambdaArnParameter: SharedParameter;

  constructor(scope: Construct, id: string, props: PrajnaStorageApiProps) {
    super(scope, id);

    const { config, module, documentsBucket } = props;

    // ── Validation ────────────────────────────────────────────────────────
    requireNonEmpty(documentsBucket.bucketName, 'documentsBucketName');

    const bucketEnvironment = {
      BUCKET_NAME: documentsBucket.bucketName,
      PRESIGN_EXPIRY_SECONDS: '300',
    };

    // ── Upload URL Lambda ─────────────────────────────────────────────────
    // Pre-compiled JS (SharedLambda cannot run .ts directly on nodejs20.x --
    // see the guard in shared-lambda.ts). Produced by `npm run build:handlers`
    // / scripts/build-handlers.mjs, which esbuild-bundles
    // src/storage/upload-url/index.ts -> dist/storage/upload-url/index.js.
    // This IS the real, tested handler (S3 pre-signed PUT URL generation) --
    // it was previously shadowed by an inline `501 Not deployed` stub here,
    // so every upload request failed regardless of stage; that stub is now
    // removed (same class of bug as the auth deny-all stub -- see auth-stack.ts).
    this.uploadLambda = new SharedLambda(this, 'UploadUrlLambda', {
      config,
      module,
      identifier: 'upload-url',
      description: 'Generates pre-signed S3 PUT URLs for file uploads',
      entry: path.join(__dirname, '../../src/storage/upload-url/index.ts'),
      code: lambda.Code.fromAsset(path.join(__dirname, '../../dist/storage/upload-url')),
      environment: bucketEnvironment,
      policyStatements: [
        new iam.PolicyStatement({
          actions: ['s3:PutObject'],
          resources: [`${documentsBucket.bucketArn}/*`],
        }),
      ],
    });

    // ── Download URL Lambda ───────────────────────────────────────────────
    // Same fix as UploadUrlLambda above -- was shadowed by an inline
    // `501 Not deployed` stub. See scripts/build-handlers.mjs.
    this.downloadLambda = new SharedLambda(this, 'DownloadUrlLambda', {
      config,
      module,
      identifier: 'download-url',
      description: 'Generates pre-signed S3 GET URLs for file downloads',
      entry: path.join(__dirname, '../../src/storage/download-url/index.ts'),
      code: lambda.Code.fromAsset(path.join(__dirname, '../../dist/storage/download-url')),
      environment: bucketEnvironment,
      policyStatements: [
        new iam.PolicyStatement({
          actions: ['s3:GetObject'],
          resources: [`${documentsBucket.bucketArn}/*`],
        }),
      ],
    });

    // ── SSM Parameters ────────────────────────────────────────────────────
    this.uploadLambdaArnParameter = new SharedParameter(this, 'UploadLambdaArnParam', {
      config,
      module,
      identifier: 'upload-lambda-arn',
      description: 'Platform Storage Upload URL Lambda ARN',
      value: this.uploadLambda.functionArn,
    });

    this.downloadLambdaArnParameter = new SharedParameter(this, 'DownloadLambdaArnParam', {
      config,
      module,
      identifier: 'download-lambda-arn',
      description: 'Platform Storage Download URL Lambda ARN',
      value: this.downloadLambda.functionArn,
    });

    // Route-discovery params in the M4 resolver convention
    // /prajna/{stage}/{moduleId}/{routeId}-fn-arn — consumed by
    // scripts/resolve-routes.ts when it binds /storage/upload-url and
    // /storage/download-url on the shared gateway (see route-manifest.ts).
    new SharedParameter(this, 'UploadUrlRouteArnParam', {
      config,
      module,
      identifier: 'upload-url-fn-arn',
      description: 'Platform Storage Upload URL Lambda ARN (M4 route discovery)',
      value: this.uploadLambda.functionArn,
    });

    new SharedParameter(this, 'DownloadUrlRouteArnParam', {
      config,
      module,
      identifier: 'download-url-fn-arn',
      description: 'Platform Storage Download URL Lambda ARN (M4 route discovery)',
      value: this.downloadLambda.functionArn,
    });

    // ── Tagging ───────────────────────────────────────────────────────────
    PrajnaTags.applyToStack(this, config.stage, module);
  }
}
