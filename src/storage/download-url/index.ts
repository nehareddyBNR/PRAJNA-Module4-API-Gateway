/**
 * @fileoverview Download URL Lambda handler for the PRAJNA platform.
 *
 * Generates a secure pre-signed S3 GET URL so that authenticated users
 * can download files from the documents bucket.
 *
 * Expected Input (via API Gateway event):
 * {
 *   "objectKey": "faculty/12345/cv/1719...-cv-2026.pdf"
 * }
 *
 * Response:
 * {
 *   "downloadUrl": "https://...",
 *   "objectKey": "faculty/12345/cv/1719...-cv-2026.pdf",
 *   "expiresIn": 300
 * }
 *
 * @module storage/download-url
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const BUCKET_NAME = process.env.BUCKET_NAME;
const PRESIGN_EXPIRY_SECONDS = parseInt(process.env.PRESIGN_EXPIRY_SECONDS || '300', 10);

if (!BUCKET_NAME) {
  throw new Error('Missing required environment variable: BUCKET_NAME');
}

const s3Client = new S3Client({});

export interface DownloadUrlRequest {
  objectKey: string;
}

export interface DownloadUrlResponse {
  downloadUrl: string;
  objectKey: string;
  expiresIn: number;
}

/**
 * Lambda handler for generating pre-signed GET URLs.
 */
export const handler = async (event: any): Promise<any> => {
  try {
    console.log('Download URL handler invoked');

    // Parse request body
    const body: DownloadUrlRequest = typeof event.body === 'string'
      ? JSON.parse(event.body)
      : event.body || event;

    if (!body.objectKey) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'objectKey is required' }),
      };
    }

    // Generate pre-signed GET URL
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: body.objectKey,
    });

    const downloadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: PRESIGN_EXPIRY_SECONDS,
    });

    const response: DownloadUrlResponse = {
      downloadUrl,
      objectKey: body.objectKey,
      expiresIn: PRESIGN_EXPIRY_SECONDS,
    };

    console.log(`Pre-signed GET URL generated for key: ${body.objectKey}`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Error generating download URL', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to generate download URL' }),
    };
  }
};
