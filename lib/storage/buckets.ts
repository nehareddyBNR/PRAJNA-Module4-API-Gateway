/**
 * @fileoverview Storage buckets construct for the PRAJNA platform.
 *
 * Provisions the platform's core S3 buckets using the Foundation SharedBucket
 * construct. All buckets inherit platform security standards (encryption,
 * public access blocking, versioning, removal policy) automatically.
 *
 * Phase 1 Buckets:
 * - documents: Faculty document vault (CVs, certificates, publications)
 * - exports:   Generated reports and bulk export artifacts
 *
 * @module storage/buckets
 */

import { Construct } from 'constructs';
import { PrajnaEnvironmentConfig } from '../foundation/config/environment';
import { ModuleIdentifier } from '../foundation/constants/naming';
import { SharedBucket } from '../foundation/constructs/shared-bucket';
import { PrajnaTags } from '../foundation/tags/tags';
import { requireNonEmpty } from '../foundation/utils/validation';

export interface PrajnaStorageBucketsProps {
  /** The full environment configuration object. */
  readonly config: PrajnaEnvironmentConfig;

  /** The module identifier (must be ModuleIdentifier.STORAGE). */
  readonly module: ModuleIdentifier;
}

/**
 * Provisions the core S3 storage buckets for the PRAJNA platform.
 *
 * Both buckets use the SharedBucket construct which enforces:
 * - Public access always blocked
 * - Server-side encryption always enabled
 * - Versioning follows environment configuration
 * - Removal policy follows environment configuration
 * - Consistent naming via ResourceNames
 * - Platform tagging via PrajnaTags
 */
export class PrajnaStorageBuckets extends Construct {

  /** The documents bucket for faculty files (CVs, certificates, publications). */
  public readonly documentsBucket: SharedBucket;

  /** The exports bucket for generated reports and bulk export artifacts. */
  public readonly exportsBucket: SharedBucket;

  constructor(scope: Construct, id: string, props: PrajnaStorageBucketsProps) {
    super(scope, id);

    const { config, module } = props;

    // ── Validation ────────────────────────────────────────────────────────
    requireNonEmpty(config.stage, 'config.stage');

    // ── Documents Bucket ──────────────────────────────────────────────────
    // Stores faculty-uploaded files: CVs, certificates, research papers, etc.
    // CORS enabled for browser-based pre-signed URL uploads.
    this.documentsBucket = new SharedBucket(this, 'DocumentsBucket', {
      config,
      module,
      identifier: 'documents',
      cors: true,
      eventBridgeEnabled: true, // Future: virus scan triggers
    });

    // ── Exports Bucket ────────────────────────────────────────────────────
    // Stores system-generated reports, bulk exports, and downloadable artifacts.
    // No CORS needed — downloads are served via pre-signed URLs from the backend.
    this.exportsBucket = new SharedBucket(this, 'ExportsBucket', {
      config,
      module,
      identifier: 'exports',
      cors: false,
    });

    // ── Tagging ───────────────────────────────────────────────────────────
    PrajnaTags.applyToStack(this, config.stage, module);
  }
}
