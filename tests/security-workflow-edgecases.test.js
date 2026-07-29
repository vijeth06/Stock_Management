const BASE_URL = process.env.TEST_URL || "http://127.0.0.1:3000";

function getFetch() {
  if (typeof fetch !== "undefined") return fetch.bind(globalThis);
  if (typeof globalThis !== "undefined" && typeof globalThis.fetch !== "undefined") {
    return globalThis.fetch.bind(globalThis);
  }
  throw new Error("Fetch API is not available.");
}

const fetchApi = getFetch();

async function runSecurityAndWorkflowEdgecaseTests() {
  console.log("=== ChainTrack Asset Management - Security & Workflow Edge-Case Test Suite ===\n");

  try {
    // 1. Login as Admin
    console.log("1. Authenticating Admin user...");
    const loginResp = await fetchApi(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@assetmgmt.local", password: "Admin@12345!" })
    });
    const loginData = await loginResp.json();
    const token = loginData.data?.token;
    const authHeaders = { Authorization: `Bearer ${token}` };
    console.log("   Admin authenticated successfully");

    // 2. Test Negative Input Validation (Proforma-I)
    console.log("\n2. Testing Input Bounds Validation (Negative Quantity Rejection)...");
    const negResp = await fetchApi(`${BASE_URL}/api/verification/equipment`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({
        department: "IT",
        laboratory: "Test Lab",
        items: [
          {
            description: "Invalid GPU",
            bookStockPreviousYear: -5,
            purchasedDuringYear: 2,
            actualPhysicalStock: 10
          }
        ]
      })
    });
    const negData = await negResp.json();
    if (negResp.status === 400 || negData.ok === false) {
      console.log("   Negative input properly rejected (400 Bad Request):", negData.error || "Rejected as expected");
    } else {
      throw new Error("Negative stock was unexpectedly accepted: " + JSON.stringify(negData));
    }

    // 3. Test Invalid Asset Status Transition (Condemned -> Active)
    console.log("\n3. Testing Workflow Lock (Preventing Condemned -> Active Direct Jump)...");
    const assetId = `EDGE-AST-${Date.now().toString().slice(-4)}`;
    await fetchApi(`${BASE_URL}/api/assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({
        assetId,
        name: "Test Condemn Lock Asset",
        department: "IT",
        status: "Condemned"
      })
    });

    const statusJumpResp = await fetchApi(`${BASE_URL}/api/assets/${assetId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ status: "Active" })
    });
    const statusJumpData = await statusJumpResp.json();
    if (statusJumpResp.status === 400 || statusJumpData.ok === false) {
      console.log("   Invalid state transition properly blocked:", statusJumpData.error || "Blocked as expected");
    } else {
      throw new Error("Invalid status jump (Condemned -> Active) was unexpectedly allowed!");
    }

    // 4. Test Maintenance Block on Condemned Asset
    console.log("\n4. Testing Maintenance Lock on Condemned Asset...");
    const maintLockResp = await fetchApi(`${BASE_URL}/api/maintenance`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({
        assetId,
        description: "Attempting maintenance on condemned asset"
      })
    });
    const maintLockData = await maintLockResp.json();
    if (maintLockResp.status === 400 || maintLockData.ok === false) {
      console.log("   Maintenance on condemned asset properly blocked:", maintLockData.error || "Blocked as expected");
    } else {
      throw new Error("Maintenance on condemned asset was unexpectedly accepted!");
    }

    // 5. Test Bill Verification Status Label
    console.log("\n5. Testing Bill Verification Status Output (VERIFIED / INVALID)...");
    const billId = `EDGE-BILL-${Date.now().toString().slice(-4)}`;
    const originalHash = "a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0";
    await fetchApi(`${BASE_URL}/api/bills`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({
        billId,
        assetId,
        documentHash: originalHash
      })
    });

    const verifyResp = await fetchApi(`${BASE_URL}/api/bills/${billId}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ billId, documentHash: originalHash })
    });
    const verifyData = await verifyResp.json();
    if (verifyData.ok && verifyData.data?.verified) {
      console.log("   Bill verification succeeded with status label:", verifyData.data.verificationStatus || "VERIFIED");
    } else {
      throw new Error("Bill verification failed unexpectedly: " + JSON.stringify(verifyData));
    }

    console.log("\n=== All Security & Workflow Edge-Case Tests Passed Successfully! ===\n");
  } catch (error) {
    console.error("\n❌ Security/Workflow edge-case test failed:", error.message);
    process.exitCode = 1;
  }
}

runSecurityAndWorkflowEdgecaseTests();
