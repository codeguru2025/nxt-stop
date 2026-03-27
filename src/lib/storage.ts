import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const s3 = new S3Client({
  endpoint: process.env.DO_SPACES_ENDPOINT!,
  region: process.env.DO_SPACES_REGION ?? 'us-east-1',
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY!,
    secretAccessKey: process.env.DO_SPACES_SECRET!,
  },
  forcePathStyle: false,
})

const BUCKET = process.env.DO_SPACES_BUCKET!
const CDN_URL = process.env.DO_SPACES_CDN_URL ?? process.env.DO_SPACES_ENDPOINT!

export type UploadFolder = 'events' | 'founders' | 'products' | 'rewards' | 'avatars' | 'social'

/**
 * Upload a file buffer to DO Spaces. Returns the public CDN URL.
 */
export async function uploadFile(
  buffer: Buffer,
  filename: string,
  folder: UploadFolder,
  contentType: string
): Promise<string> {
  const key = `${folder}/${filename}`
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ACL: 'public-read',
    })
  )
  return `${CDN_URL}/${BUCKET}/${key}`
}

/**
 * Generate a presigned URL for direct client → Spaces uploads.
 * Expires in 5 minutes. Client must PUT with Content-Type matching.
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 300
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
    ACL: 'public-read',
  })
  return getSignedUrl(s3, command, { expiresIn })
}

/**
 * Delete a file from DO Spaces by its key (path without bucket prefix).
 */
export async function deleteFile(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}

/**
 * Build the public CDN URL for a given key.
 */
export function getPublicUrl(key: string): string {
  return `${CDN_URL}/${BUCKET}/${key}`
}
