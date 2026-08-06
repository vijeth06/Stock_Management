const fs = require('fs');
const path = require('path');

const USE_S3 = Boolean(process.env.S3_BUCKET);
let s3 = null;
let S3_BUCKET = process.env.S3_BUCKET;
const S3_ENDPOINT = process.env.S3_ENDPOINT || process.env.MINIO_ENDPOINT || null;

if (USE_S3) {
  const AWS = require('aws-sdk');
  const awsConfig = { region: process.env.AWS_REGION || 'us-east-1' };
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    awsConfig.accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    awsConfig.secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  }
  if (S3_ENDPOINT) {
    awsConfig.endpoint = S3_ENDPOINT;
    awsConfig.s3ForcePathStyle = true;
  }
  AWS.config.update(awsConfig);
  s3 = new AWS.S3({ signatureVersion: 'v4', endpoint: S3_ENDPOINT, s3ForcePathStyle: Boolean(S3_ENDPOINT) });
}

const UPLOAD_DIR = path.join(__dirname, '../../uploads/bills');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

async function uploadFileLocal(filePath, destName) {
  const dest = destName ? path.join(UPLOAD_DIR, destName) : path.join(UPLOAD_DIR, path.basename(filePath));
  fs.copyFileSync(filePath, dest);
  return { key: dest, url: `/uploads/bills/${path.basename(dest)}`, storage: 'local' };
}

async function uploadBufferLocal(buffer, destName) {
  const dest = path.join(UPLOAD_DIR, destName);
  fs.writeFileSync(dest, buffer);
  return { key: dest, url: `/uploads/bills/${path.basename(dest)}`, storage: 'local' };
}

async function uploadToS3(bufferOrPath, key) {
  const body = Buffer.isBuffer(bufferOrPath) ? bufferOrPath : require('fs').createReadStream(bufferOrPath);
  const params = { Bucket: S3_BUCKET, Key: key, Body: body };
  await s3.putObject(params).promise();
  return { key, url: `s3://${S3_BUCKET}/${key}`, storage: 's3' };
}

async function ensureBucket() {
  if (!s3) return false;
  try {
    await s3.headBucket({ Bucket: S3_BUCKET }).promise();
    return true;
  } catch (e) {
    try {
      await s3.createBucket({ Bucket: S3_BUCKET }).promise();
      return true;
    } catch (err) {
      console.warn('Failed to ensure S3 bucket:', err.message || err);
      return false;
    }
  }
}

async function getPresignedUrl(key, expiresSec = 300) {
  if (!s3) return null;
  await ensureBucket();
  const params = { Bucket: S3_BUCKET, Key: key, Expires: Number(expiresSec || 300) };
  try {
    const url = s3.getSignedUrl('getObject', params);
    return url;
  } catch (e) {
    console.warn('Failed to generate presigned URL:', e.message || e);
    return null;
  }
}

async function uploadFile(filePath, destName) {
  if (USE_S3 && s3) {
    const key = destName || path.basename(filePath);
    return await uploadToS3(filePath, key);
  }
  return await uploadFileLocal(filePath, destName);
}

async function uploadBuffer(buffer, destName) {
  if (USE_S3 && s3) {
    const key = destName;
    return await uploadToS3(buffer, key);
  }
  return await uploadBufferLocal(buffer, destName);
}

module.exports = { uploadFile, uploadBuffer, USE_S3, getPresignedUrl };
