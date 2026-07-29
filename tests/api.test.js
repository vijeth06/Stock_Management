const BASE_URL = process.env.TEST_URL || "http://127.0.0.1:3000";

function getFetch() {
  if (typeof fetch !== "undefined") {
    return fetch.bind(globalThis);
  }
  if (typeof globalThis !== "undefined" && typeof globalThis.fetch !== "undefined") {
    return globalThis.fetch.bind(globalThis);
  }
  throw new Error("Fetch API is not available. Run this test with Node 18+ or install node-fetch.");
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
  if (response.status !== expectedStatus && !(expectedStatus === 200 && response.status === 201)) {
    throw new Error(`${label} failed with status ${response.status}: ${response.raw}`);
  }

  if (response.body && typeof response.body === "object" && response.body.ok === false) {
    throw new Error(`${label} returned an unsuccessful payload: ${response.raw}`);
  }
}

async function testApi() {
  console.log("=== ChainTrack Asset Management - Extended API Integration Tests ===\n");

  try {
    console.log("1. Testing health endpoint...");
    const health = await request("/health");
    expectSuccess("health endpoint", health, 200);
    console.log("   Health status:", health.body?.status || "unknown");

    console.log("\n2. Testing authentication login...");
    const login = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "admin@assetmgmt.local",
        password: "Admin@12345!"
      })
    });
    expectSuccess("login endpoint", login, 200);
    const token = login.body?.data?.token;
    if (!token) {
      throw new Error("Login response did not include a token");
    }
    console.log("   Login accepted with JWT token");

    const authHeaders = { Authorization: `Bearer ${token}` };

    console.log("\n3. Testing dashboard overview & KPI counts...");
    const dashboard = await request("/api/dashboard", { headers: authHeaders });
    expectSuccess("dashboard endpoint", dashboard, 200);
    console.log("   Summary counts:", dashboard.body?.data?.counts || {});

    console.log("\n4. Testing asset registration (POST /api/assets)...");
    const testAssetId = `TEST-ASSET-${Date.now().toString().slice(-4)}`;
    const createAsset = await request("/api/assets", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        assetId: testAssetId,
        name: "Test PowerStation Workstation",
        category: "Computing",
        department: "IT",
        status: "Active",
        location: "Lab Room 101",
        purchaseDate: "2024-05-10",
        purchaseValue: 2800,
        lifespanYears: 4,
        serialNumber: "SN-TEST-9988"
      })
    });
    await expectSuccess("create asset endpoint", createAsset, 200);
    console.log(`   Asset ${testAssetId} registered successfully`);

    console.log("\n5. Testing asset registry listing (GET /api/assets)...");
    const assets = await request("/api/assets", { headers: authHeaders });
    expectSuccess("assets endpoint", assets, 200);
    console.log("   Total assets returned:", Array.isArray(assets.body?.data) ? assets.body.data.length : "unknown");

    console.log("\n6. Testing maintenance logging (POST /api/maintenance)...");
    const maint = await request("/api/maintenance", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        assetId: testAssetId,
        technician: "Senior Tech Sarah",
        maintenanceDate: "2026-07-27",
        description: "Scheduled RAM upgrade and thermal check",
        cost: 220,
        status: "In Progress"
      })
    });
    expectSuccess("create maintenance endpoint", maint, 200);
    console.log("   Maintenance record logged");

    console.log("\n7. Testing maintenance retrieval (GET /api/maintenance)...");
    const maintList = await request("/api/maintenance", { headers: authHeaders });
    expectSuccess("get maintenance endpoint", maintList, 200);
    console.log("   Maintenance records count:", Array.isArray(maintList.body?.data) ? maintList.body.data.length : "unknown");

    console.log("\n8. Testing condemnation request & approval workflow...");
    const condReq = await request("/api/condemnation", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        assetId: testAssetId,
        reason: "Component failure beyond economical repair",
        requestedBy: "IT Lead",
        disposalMethod: "E-Waste Recycling"
      })
    });
    expectSuccess("request condemnation endpoint", condReq, 200);
    const condRecordId = condReq.body?.data?.recordId;
    console.log(`   Condemnation request created: ${condRecordId}`);

    if (condRecordId) {
      const condApprove = await request(`/api/condemnation/${encodeURIComponent(condRecordId)}/approve`, {
        method: "PUT",
        headers: authHeaders
      });
      expectSuccess("approve condemnation endpoint", condApprove, 200);
      console.log("   Condemnation request approved");
    }

    console.log("\n9. Testing inter-department asset transfer...");
    const transfer = await request("/api/transfers", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        assetId: testAssetId,
        toDepartment: "OPS",
        newLocation: "Warehouse Dispatch",
        requestedBy: "Logistics Manager",
        reason: "Operational reallocation"
      })
    });
    expectSuccess("transfer asset endpoint", transfer, 200);
    console.log("   Asset transfer processed successfully");

    console.log("\n10. Testing financial valuation & depreciation analytics...");
    const financial = await request("/api/reports/financial", { headers: authHeaders });
    expectSuccess("financial report endpoint", financial, 200);
    console.log("    Total Valuation: $" + (financial.body?.data?.totalValuation || 0));
    console.log("    Net Book Value: $" + (financial.body?.data?.totalCurrentValue || 0));

    console.log("\n11. Testing department listing (GET /api/departments)...");
    const departments = await request("/api/departments", { headers: authHeaders });
    expectSuccess("departments endpoint", departments, 200);
    console.log("    Departments returned:", Array.isArray(departments.body?.data) ? departments.body.data.length : "unknown");

    console.log("\n=== All 11 Extended API integration tests passed successfully ===\n");
  } catch (error) {
    console.error("Test execution failed:", error.message);
    process.exitCode = 1;
  }
}

testApi();