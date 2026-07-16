/**
 * @fileoverview Storage Stack for the PRAJNA platform (Module 6).
 *
 * This stack provisions all storage infrastructure for the platform:
 * - S3 buckets for document storage and report exports
 * - SSM parameters for cross-module resource discovery
 *
 * Phase 1 scope:
 * - Documents bucket (faculty files, CVs, certificates, publications)
 * - Exports bucket (generated reports, bulk exports)
 * - SSM parameter publishing
 *
 * Future phases will add:
 * - Pre-signed URL Lambda functions
 * - Virus scanning infrastructure
 * - Lifecycle policies for archival
 *
 * @module storage/storage-stack
 */

import { Annotations, CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { PrajnaEnvironmentConfig } from '../foundation/config/environment';
import { ModuleIdentifier } from '../foundation/constants/naming';
import { PLATFORM_VERSION } from '../foundation/constants/defaults';
import { PrajnaTags } from '../foundation/tags/tags';
import { requireNonEmpty } from '../foundation/utils/validation';
import { PrajnaStorageBuckets } from './buckets';
import { PrajnaStorageOutputs } from './outputs';
import { PrajnaStorageApi } from './api';

export interface StorageStackProps extends StackProps {
  /** The fully resolved environment configuration. */
  readonly config: PrajnaEnvironmentConfig;
}

/**
 * The Storage Stack provisions file storage infrastructure for the PRAJNA platform.
 *
 * It depends on the CDK Foundation layer (Module 1) for conventions and standards.
 */
export class StorageStack extends Stack {

  /** The core storage buckets construct. */
  public readonly buckets: PrajnaStorageBuckets;

  /** The SSM outputs construct. */
  public readonly outputs: PrajnaStorageOutputs;

  /** The pre-signed URL API construct. */
  public readonly api: PrajnaStorageApi;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    const { config } = props;

    // ── Validation ────────────────────────────────────────────────────────
    requireNonEmpty(config.stage, 'config.stage');

    const stage = config.stage;
    const module = ModuleIdentifier.STORAGE;

    // ── Infrastructure ────────────────────────────────────────────────────

    // 1. Create Storage Buckets
    this.buckets = new PrajnaStorageBuckets(this, 'Buckets', {
      config,
      module,
    });

    // 2. Publish Outputs via SSM
    this.outputs = new PrajnaStorageOutputs(this, 'Outputs', {
      config,
      module,
      documentsBucket: this.buckets.documentsBucket,
      exportsBucket: this.buckets.exportsBucket,
    });

    // 3. Create Pre-signed URL Lambdas
    this.api = new PrajnaStorageApi(this, 'Api', {
      config,
      module,
      documentsBucket: this.buckets.documentsBucket,
    });

    // ── CloudFormation Outputs ─────────────────────────────────────────────
    new CfnOutput(this, 'DocumentsBucketName', {
      value: this.buckets.documentsBucket.bucketName,
      description: 'Prajna Platform Documents Bucket Name',
    });

    new CfnOutput(this, 'DocumentsBucketArn', {
      value: this.buckets.documentsBucket.bucketArn,
      description: 'Prajna Platform Documents Bucket ARN',
    });

    new CfnOutput(this, 'ExportsBucketName', {
      value: this.buckets.exportsBucket.bucketName,
      description: 'Prajna Platform Exports Bucket Name',
    });

    new CfnOutput(this, 'ExportsBucketArn', {
      value: this.buckets.exportsBucket.bucketArn,
      description: 'Prajna Platform Exports Bucket ARN',
    });

    new CfnOutput(this, 'UploadLambdaArn', {
      value: this.api.uploadLambda.functionArn,
      description: 'Prajna Platform Upload URL Lambda ARN',
    });

    new CfnOutput(this, 'DownloadLambdaArn', {
      value: this.api.downloadLambda.functionArn,
      description: 'Prajna Platform Download URL Lambda ARN',
    });

    // ── Tagging ───────────────────────────────────────────────────────────
    PrajnaTags.applyToStack(this, stage, module);

    // ── Annotations ───────────────────────────────────────────────────────
    Annotations.of(this).addInfo(
      `Storage Stack initialized. Stage: ${stage}, Buckets: documents, exports, Version: ${PLATFORM_VERSION}`
    );
  }
}
