const crypto = require('crypto');
const path = require('path');
const { uploadFile } = require('./storageService');

const SECRET = process.env.FILE_TOKEN_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FILE_TOKEN_SECRET must be set in production');
  }
  return 'file-token-default-change-me';
})();
const DEFAULT_TTL = 60 * 5; // 5 minutes

function generateDownloadToken(filePath, ttlSeconds) {
  const expires = Math.floor(Date.now() / 1000) + (Number(ttlSeconds) || DEFAULT_TTL);
  const payload = JSON.stringify({ p: filePath, e: expires });
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  const token = Buffer.from(payload).toString('base64url') + '.' + sig;
  return token;
}

function validateDownloadToken(token) {
  try {
    const parts = String(token).split('.');
    if (parts.length !== 2) return null;
    const payloadB = parts[0];
    const sig = parts[1];
    const payload = Buffer.from(payloadB, 'base64url').toString('utf8');
    const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
    const obj = JSON.parse(payload);
    if (!obj.p || !obj.e) return null;
    if (Math.floor(Date.now() / 1000) > obj.e) return null;
    // normalize path to avoid directory traversal
    const safePath = path.normalize(obj.p).replace(/^(\.\/.?)+/, '');
    return safePath;
  } catch (e) {
    return null;
  }
}

module.exports = { generateDownloadToken, validateDownloadToken };
