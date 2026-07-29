const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE = process.env.TEST_URL || 'http://localhost:3000';

async function run() {
  try {
    console.log('E2E bill test start');

    // Login with seeded demo admin
    const loginResp = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@assetmgmt.local', password: 'Admin@12345!' })
    });
    const loginBody = await loginResp.json();
    if (!loginBody.ok) {
      console.error('Login failed', loginBody);
      process.exit(1);
    }
    const token = loginBody.data.token;
    console.log('Logged in, token acquired');

    // Create test file
    const tmpDir = path.join(__dirname, '..', 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const filePath = path.join(tmpDir, 'test-bill.txt');
    fs.writeFileSync(filePath, 'Test bill content ' + Date.now());

    const fileBuffer = fs.readFileSync(filePath);
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    const testBillId = 'BILL-E2E-' + Date.now();

    // Upload bill as JSON with precomputed billHash (avoid multipart issues)
    const uploadResp = await fetch(`${BASE}/api/bills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        billId: testBillId,
        assetId: 'ASSET-001',
        vendor: 'ACME Corp',
        invoiceNumber: 'INV-E2E-1',
        billHash: fileHash,
        documentHash: fileHash
      })
    });
    const uploadBody = await uploadResp.json().catch(() => null);
    console.log('Upload status', uploadResp.status, uploadResp.headers.get('content-type'));
    console.log('Upload body', uploadBody);
    if (!uploadBody || !uploadBody.ok) {
      console.error('Upload failed');
      process.exit(1);
    }

    // Verify bill
    const verifyResp = await fetch(`${BASE}/api/bills/${testBillId}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ billId: testBillId, documentHash: fileHash })
    });
    const verifyBody = await verifyResp.json();
    console.log('Verify response:', JSON.stringify(verifyBody, null, 2));

    if (verifyBody.ok && verifyBody.data && verifyBody.data.integrity) {
      console.log('E2E verification succeeded: integrity true');
      process.exit(0);
    } else {
      console.error('E2E verification failed or inconclusive');
      process.exit(2);
    }
  } catch (e) {
    console.error('E2E test error', e);
    process.exit(3);
  }
}

run();
