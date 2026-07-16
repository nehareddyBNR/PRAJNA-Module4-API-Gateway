/**
 * @fileoverview Storage outputs construct for the PRAJNA platform.
 *
 * Publishes bucket metadata to AWS Systems Manager (SSM) Parameter Store
 * so that other modules can discover and reference storage resources
 * without hard-coding ARNs or names.
 *
 * Published Parameters:
 * - /prajna/{stage}/storage/documents-bucket-name
 * - /prajna/{stage}/storage/documents-bucket-arn
 * - /prajna/{stage}/storage/exports-bucket-name
 * - /prajna/{stage}/storage/exports-bucket-arn
 *
 * @module storage/outputs
 */

import { Construct } from 'constructs';
import { SharedParameter } from '../foundation/constructs/shared-parameter';
import { SharedBucket } from '../foundation/constructs/shared-bucket';
import { PrajnaEnvironmentConfig } from '../foundation/config/environment';
import { ModuleIdentifier } from '../foundation/constants/naming';
import { PrajnaTags } from '../foundation/tags/tags';
import { requireNonEmpty } from '../foundation/utils/validation';

export interface PrajnaStorageOutputsProps {
  /** The full environment configuration object. */
  readonly config: PrajnaEnvironmentConfig;

  /** The module identifier. */
  readonly module: ModuleIdentifier;

  /** The documents bucket. */
  readonly documentsBucket: SharedBucket;

  /** The exports bucket. */
  readonly exportsBucket: SharedBucket;
}

/**
 * Publishes Storage module outputs to SSM Parameter Store
 * for cross-module resource discovery.
 */
export class PrajnaStorageOutputs extends Construct {

  public readonly documentsBucketNameParameter: SharedParameter;
  public readonly documentsBucketArnParameter: SharedParameter;
  public readonly exportsBucketNameParameter: SharedParameter;
  public readonly exportsBucketArnParameter: SharedParameter;

  constructor(scope: Construct, id: string, props: PrajnaStorageOutputsProps) {
    super(scope, id);

    const { config, module, documentsBucket, exportsBucket } = props;

    // ── Validation ────────────────────────────────────────────────────────
    requireNonEmpty(documentsBucket.bucketName, 'documentsBucketName');
    requireNonEmpty(documentsBucket.bucketArn, 'documentsBucketArn');
    requireNonEmpty(exportsBucket.bucketName, 'exportsBucketName');
    requireNonEmpty(exportsBucket.bucketArn, 'exportsBucketArn');

    // ── Documents Bucket Parameters ──────────────────────────────────────
    this.documentsBucketNameParameter = new SharedParameter(this, 'DocumentsBucketNameParam', {
      config,
      module,
      identifier: 'documents-bucket-name',
      value: documentsBucket.bucketName,
      description: 'Platform Storage Documents Bucket Name',
    });

    this.documentsBucketArnParameter = new SharedParameter(this, 'DocumentsBucketArnParam', {
      config,
      module,
      identifier: 'documents-bucket-arn',
      value: documentsBucket.bucketArn,
      description: 'Platform Storage Documents Bucket ARN',
    });

    // ── Exports Bucket Parameters ────────────────────────────────────────
    this.exportsBucketNameParameter = new SharedParameter(this, 'ExportsBucketNameParam', {
      config,
      module,
      identifier: 'exports-bucket-name',
      value: exportsBucket.bucketName,
      description: 'Platform Storage Exports Bucket Name',
    });

    this.exportsBucketArnParameter = new SharedParameter(this, 'ExportsBucketArnParam', {
      config,
      module,
      identifier: 'exports-bucket-arn',
      value: exportsBucket.bucketArn,
      description: 'Platform Storage Exports Bucket ARN',
    });

    // ── Tagging ───────────────────────────────────────────────────────────
    PrajnaTags.applyToStack(this, config.stage, module);
  }
}
