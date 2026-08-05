const fs = require("fs");
const path = require("path");

const BASE_URL = process.env.TEST_URL || "http://127.0.0.1:3000";

function getFetch() {
  if (typeof fetch !== "undefined") {
    return fetch.bind(globalThis);
  }
  if (typeof globalThis !== "undefined" && typeof globalThis.fetch !== "undefined") {
    return globalThis.fetch.bind(globalThis);
  }
  try {
    const nodeFetch = require("node-fetch");
    return nodeFetch;
  } catch (err) {
    throw new Error("Fetch API is not available. Run this test with Node 18+ or install node-fetch.");
  }
}

const fetchApi = getFetch();

async function request(path, options = {}) {
  const { headers, ...restOptions } = options;
  const response = await fetchApi(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    ...restOptions
  });

  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  return {
    ok: response.ok,
    status: response.status,
    body,
    raw: text
  };
}

async function expectSuccess(label, response, expectedStatus = 200) {
  const isSuccessStatus = response.status === 200 || response.status === 201;
  if (!isSuccessStatus) {
    throw new Error(`${label} failed with status ${response.status}: ${response.raw}`);
  }

  if (response.body && typeof response.body === "object" && response.body.ok === false) {
    throw new Error(`${label} returned an unsuccessful payload: ${response.raw}`);
  }
}

async function runRegressionTests() {
  console.log("=== Regression Test: Asset History & Bill Verification ===\n");

  try {
    console.log("1. Logging in as administrator...");
    const login = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "admin@assetmgmt.local",
        password: "Admin@12345!"
      })
    });
    await expectSuccess("login endpoint", login, 200);

    const token = login.body?.data?.token;
    if (!token) {
      throw new Error("Login response did not include a token");
    }
    const authHeaders = { Authorization: `Bearer ${token}` };
    console.log("   Logged in successfully");

    console.log("\n2. Creating a new regression asset...");
    const testAssetId = `REG-ASHIST-${Date.now().toString().slice(-6)}`;
    const createAsset = await request("/api/assets", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        assetId: testAssetId,
        name: "Regression Test Asset",
        category: "Hardware",
        department: "IT",
        status: "Active",
        location: "Regression Lab",
        purchaseDate: "2026-08-01",
        purchaseValue: 4200,
        serialNumber: `REG-SN-${Date.now().toString().slice(-6)}`
      })
    });
    await expectSuccess("create asset endpoint", createAsset, 200);
    console.log(`   Created asset ${testAssetId}`);

    console.log("\n3. Fetching asset history for the new asset...");
    const historyResp = await request(`/api/assets/${encodeURIComponent(testAssetId)}/history`, {
      headers: authHeaders
    });
    await expectSuccess("asset history endpoint", historyResp, 200);
    const historyData = historyResp.body;
    if (!historyData?.data?.asset || !Array.isArray(historyData.data.timeline)) {
      throw new Error(`Invalid asset history payload: ${historyResp.raw}`);
    }
    if (historyData.data.timeline.length < 1) {
      throw new Error(`Expected asset history timeline to contain at least one event, got ${historyData.data.timeline.length}`);
    }
    console.log(`   Asset history returned ${historyData.data.timeline.length} timeline event(s)`);

    console.log("\n4. Uploading a bill linked to the asset...");
    const billId = `REG-BILL-${Date.now().toString().slice(-6)}`;
    const documentHash = `0x${Buffer.from(`regression-bill-${Date.now()}`).toString("hex").slice(0, 64)}`;
    const uploadResp = await request("/api/bills", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        billId,
        assetId: testAssetId,
        vendor: "Regression Vendor",
        invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
        amount: 1250,
        documentHash
      })
    });
    await expectSuccess("upload bill endpoint", uploadResp, 201);
    console.log(`   Uploaded bill ${billId} for asset ${testAssetId}`);

    console.log("\n5. Verifying the bill document via ledger-backed endpoint...");
    const verifyResp = await request(`/api/bills/${encodeURIComponent(billId)}/verify`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ billId, documentHash })
    });
    await expectSuccess("verify bill endpoint", verifyResp, 200);
    const verifyData = verifyResp.body;
    if (!verifyData?.data?.bill || verifyData.data.bill.billId !== billId) {
      throw new Error(`Bill verification did not return the expected bill: ${verifyResp.raw}`);
    }
    if (verifyData.data.verified !== true) {
      throw new Error(`Bill verification failed unexpectedly: ${verifyResp.raw}`);
    }
    if (verifyData.data.verifiedOnBlockchain !== true) {
      throw new Error(`Bill blockchain verification failed unexpectedly: ${verifyResp.raw}`);
    }
    if (!verifyData.data.verificationStatus && verifyData.data.integrity === undefined) {
      throw new Error(`Bill verification response missing verification status: ${verifyResp.raw}`);
    }
    console.log(`   Bill verification endpoint returned verified=${verifyData.data.verified}, blockchain=${verifyData.data.verifiedOnBlockchain}`);

    console.log("\n=== Regression tests passed ===");
  } catch (error) {
    console.error("Regression test failed:", error.message);
    process.exitCode = 1;
  }
}

runRegressionTests();
