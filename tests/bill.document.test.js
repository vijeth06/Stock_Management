const BASE_URL = process.env.TEST_URL || "http://127.0.0.1:3000";

function getFetch() {
  if (typeof fetch !== "undefined") return fetch.bind(globalThis);
  if (typeof globalThis !== "undefined" && typeof globalThis.fetch !== "undefined") return globalThis.fetch.bind(globalThis);
  throw new Error("Fetch API is not available. Run this test with Node 18+ or install node-fetch.");
}
const fetchApi = getFetch();

async function request(path, options = {}) {
  const { headers, ...restOptions } = options;
  const response = await fetchApi(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...headers },
    ...restOptions
  });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { ok: response.ok, status: response.status, body, raw: text };
}

async function expectSuccess(label, response, expectedStatus = 200) {
  if (response.status !== expectedStatus && !(expectedStatus === 200 && response.status === 201)) {
    throw new Error(`${label} failed with status ${response.status}: ${response.raw}`);
  }
  if (response.body && typeof response.body === 'object' && response.body.ok === false) {
    throw new Error(`${label} returned an unsuccessful payload: ${response.raw}`);
  }
}

async function run() {
  console.log('=== Bill documentKey integration test ===');

  try {
    // login
    const login = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@assetmgmt.local', password: 'Admin@12345!' }) });
    await expectSuccess('login', login, 200);
    const token = login.body?.data?.token;
    if (!token) throw new Error('no token');
    const headers = { Authorization: `Bearer ${token}` };

    // create an asset to attach bill to
    const assetId = `TEST-ASSET-BILL-${Date.now().toString().slice(-6)}`;
    const createAsset = await request('/api/assets', { method: 'POST', headers, body: JSON.stringify({ assetId, name: 'Bill Test Asset' }) });
    await expectSuccess('create asset', createAsset, 200);

    // create a bill with explicit documentKey (no file upload)
    const billId = `BILL-TEST-${Date.now().toString().slice(-6)}`;
    const documentKey = `bills/${billId}-sample.pdf`;
    const createBill = await request('/api/bills', {
      method: 'POST',
      headers,
      body: JSON.stringify({ billId, assetId, documentHash: 'deadbeefcafebabe', documentKey })
    });
    await expectSuccess('create bill', createBill, 201);

    // read bill from ledger
    const read = await request(`/api/bills/${encodeURIComponent(billId)}`, { headers });
    await expectSuccess('get bill', read, 200);
    const b = read.body?.data;
    if (!b) throw new Error('no bill returned');
    if (!b.documentKey || b.documentKey !== documentKey) {
      throw new Error(`documentKey mismatch: expected ${documentKey} got ${b.documentKey}`);
    }

    console.log('Test passed: documentKey present on ledger');
    process.exitCode = 0;
  } catch (err) {
    console.error('Test failed:', err.message);
    process.exitCode = 1;
  }
}

run();
