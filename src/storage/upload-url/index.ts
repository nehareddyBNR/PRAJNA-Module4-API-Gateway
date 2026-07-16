/**
 * @fileoverview Upload URL Lambda handler for the PRAJNA platform.
 *
 * Generates a secure pre-signed S3 PUT URL so that authenticated users
 * can upload files directly to the documents bucket from the browser.
 *
 * Expected Input (via API Gateway event body):
 * {
 *   "fileName": "cv-2026.pdf",
 *   "contentType": "application/pdf",
 *   "folder": "faculty/12345/cv"    // optional prefix
 * }
 *
 * Response:
 * {
 *   "uploadUrl": "https://...",
 *   "objectKey": "faculty/12345/cv/1719...-cv-2026.pdf",
 *   "expiresIn": 300
 * }
 *
 * @module storage/upload-url
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const BUCKET_NAME = process.env.BUCKET_NAME;
const PRESIGN_EXPIRY_SECONDS = parseInt(process.env.PRESIGN_EXPIRY_SECONDS || '300', 10);

if (!BUCKET_NAME) {
  throw new Error('Missing required environment variable: BUCKET_NAME');
}

const s3Client = new S3Client({});

export interface UploadUrlRequest {
  fileName: string;
  contentType?: string;
  folder?: string;
}

export interface UploadUrlResponse {
  uploadUrl: string;
  objectKey: string;
  expiresIn: number;
}

/**
 * Generates a unique, collision-safe object key.
 */
function buildObjectKey(fileName: string, folder?: string): string {
  const timestamp = Date.now();
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `${timestamp}-${sanitized}`;
  return folder ? `${folder}/${key}` : key;
}

/**
 * Lambda handler for generating pre-signed PUT URLs.
 */
export const handler = async (event: any): Promise<any> => {
  try {
    console.log('Upload URL handler invoked');

    // Parse request body
    const body: UploadUrlRequest = typeof event.body === 'string'
      ? JSON.parse(event.body)
      : event.body || event;

    if (!body.fileName) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'fileName is required' }),
      };
    }

    const objectKey = buildObjectKey(body.fileName, body.folder);
    const contentType = body.contentType || 'application/octet-stream';

    // Generate pre-signed PUT URL
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: objectKey,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: PRESIGN_EXPIRY_SECONDS,
    });

    const response: UploadUrlResponse = {
      uploadUrl,
      objectKey,
      expiresIn: PRESIGN_EXPIRY_SECONDS,
    };

    console.log(`Pre-signed PUT URL generated for key: ${objectKey}`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Error generating upload URL', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to generate upload URL' }),
    };
  }
};
