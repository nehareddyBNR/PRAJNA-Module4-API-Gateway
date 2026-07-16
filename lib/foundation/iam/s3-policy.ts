/**
 * @fileoverview Reusable IAM policy statements for Amazon S3.
 *
 * Provides least-privilege S3 policy statements scoped to specific
 * buckets and key prefixes. Module developers import these instead of
 * writing raw S3 IAM policies.
 *
 * @module foundation/iam/s3-policy
 */

import * as iam from 'aws-cdk-lib/aws-iam';

/**
 * Reusable IAM policy statements for S3 operations.
 */
export class S3Policy {

  private constructor() {}

  /**
   * Allows reading objects from a bucket (optionally scoped to a prefix).
   *
   * @param bucketArn - The S3 bucket ARN.
   * @param keyPrefix - Optional key prefix to scope access (e.g., "uploads/").
   * @returns A policy statement granting `s3:GetObject` and `s3:HeadObject`.
   */
  static readStatement(bucketArn: string, keyPrefix = '*'): iam.PolicyStatement {
    return new iam.PolicyStatement({
      sid: 'S3ReadObjects',
      effect: iam.Effect.ALLOW,
      actions: ['s3:GetObject', 's3:HeadObject'],
      resources: [`${bucketArn}/${keyPrefix}`],
    });
  }

  /**
   * Allows writing (uploading) objects to a bucket.
   *
   * @param bucketArn - The S3 bucket ARN.
   * @param keyPrefix - Optional key prefix to scope access.
   * @returns A policy statement granting `s3:PutObject`.
   */
  static writeStatement(bucketArn: string, keyPrefix = '*'): iam.PolicyStatement {
    return new iam.PolicyStatement({
      sid: 'S3WriteObjects',
      effect: iam.Effect.ALLOW,
      actions: ['s3:PutObject'],
      resources: [`${bucketArn}/${keyPrefix}`],
    });
  }

  /**
   * Allows deleting objects from a bucket.
   *
   * @param bucketArn - The S3 bucket ARN.
   * @param keyPrefix - Optional key prefix to scope access.
   * @returns A policy statement granting `s3:DeleteObject`.
   */
  static deleteStatement(bucketArn: string, keyPrefix = '*'): iam.PolicyStatement {
    return new iam.PolicyStatement({
      sid: 'S3DeleteObjects',
      effect: iam.Effect.ALLOW,
      actions: ['s3:DeleteObject', 's3:DeleteObjectVersion'],
      resources: [`${bucketArn}/${keyPrefix}`],
    });
  }

  /**
   * Allows full read/write access to a bucket (scoped to prefix).
   *
   * @param bucketArn - The S3 bucket ARN.
   * @param keyPrefix - Optional key prefix to scope access.
   * @returns An array of policy statements granting read, write, and list access.
   */
  static readWriteStatements(bucketArn: string, keyPrefix = '*'): iam.PolicyStatement[] {
    return [
      S3Policy.readStatement(bucketArn, keyPrefix),
      S3Policy.writeStatement(bucketArn, keyPrefix),
      new iam.PolicyStatement({
        sid: 'S3ListBucket',
        effect: iam.Effect.ALLOW,
        actions: ['s3:ListBucket', 's3:GetBucketLocation'],
        resources: [bucketArn],
      }),
    ];
  }

  /**
   * Allows generating pre-signed URLs for object uploads.
   *
   * Pre-signed URL generation requires PutObject permission on the bucket.
   *
   * @param bucketArn - The S3 bucket ARN.
   * @param keyPrefix - Optional key prefix to scope access.
   * @returns A policy statement for pre-signed upload URL generation.
   */
  static presignedUploadStatement(bucketArn: string, keyPrefix = '*'): iam.PolicyStatement {
    return new iam.PolicyStatement({
      sid: 'S3PresignedUpload',
      effect: iam.Effect.ALLOW,
      actions: ['s3:PutObject', 's3:AbortMultipartUpload'],
      resources: [`${bucketArn}/${keyPrefix}`],
    });
  }

  /**
   * Allows generating pre-signed URLs for object downloads.
   *
   * @param bucketArn - The S3 bucket ARN.
   * @param keyPrefix - Optional key prefix to scope access.
   * @returns A policy statement for pre-signed download URL generation.
   */
  static presignedDownloadStatement(bucketArn: string, keyPrefix = '*'): iam.PolicyStatement {
    return new iam.PolicyStatement({
      sid: 'S3PresignedDownload',
      effect: iam.Effect.ALLOW,
      actions: ['s3:GetObject', 's3:HeadObject'],
      resources: [`${bucketArn}/${keyPrefix}`],
    });
  }

  /**
   * Allows listing bucket contents.
   *
   * @param bucketArn - The S3 bucket ARN.
   * @param prefix - Optional prefix for listing scope.
   * @returns A policy statement granting list access.
   */
  static listStatement(bucketArn: string, prefix?: string): iam.PolicyStatement {
    return new iam.PolicyStatement({
      sid: 'S3ListBucket',
      effect: iam.Effect.ALLOW,
      actions: ['s3:ListBucket', 's3:GetBucketLocation', 's3:ListBucketVersions'],
      resources: [bucketArn],
      conditions: prefix
        ? { StringLike: { 's3:prefix': [`${prefix}*`] } }
        : undefined,
    });
  }
}
