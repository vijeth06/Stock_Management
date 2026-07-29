const BASE_URL = process.env.TEST_URL || "http://127.0.0.1:3000";

function getFetch() {
  if (typeof fetch !== "undefined") return fetch.bind(globalThis);
  if (typeof globalThis !== "undefined" && typeof globalThis.fetch !== "undefined") {
    return globalThis.fetch.bind(globalThis);
  }
  throw new Error("Fetch API is not available.");
}

const fetchApi = getFetch();

async function runProformaComplianceTests() {
  console.log("=== ChainTrack Asset Management - Proforma-I to IV Compliance Test Suite ===\n");

  try {
    // 1. Health check
    console.log("1. Checking Gateway server health...");
    const healthResp = await fetchApi(`${BASE_URL}/health`);
    const health = await healthResp.json();
    console.log("   Server status:", health.status || "ok");

    // 2. Auth login
    console.log("\n2. Logging in as Admin...");
    const loginResp = await fetchApi(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@assetmgmt.local", password: "Admin@12345!" })
    });
    const loginData = await loginResp.json();
    if (!loginData.ok || !loginData.data?.token) {
      throw new Error("Login failed: " + JSON.stringify(loginData));
    }
    const token = loginData.data.token;
    const authHeaders = { Authorization: `Bearer ${token}` };
    console.log("   Authenticated successfully with JWT token");

    // 3. Proforma-I (Equipment Verification)
    console.log("\n3. Testing Proforma-I (Equipment Verification)...");
    const p1Resp = await fetchApi(`${BASE_URL}/api/verification/equipment`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({
        department: "IT",
        laboratory: "Robotics Lab",
        stockBookNumber: "SB-2026-R1",
        staffInCharge: "Dr. Aris Thorne",
        verificationDate: "2026-07-27",
        items: [
          {
            description: "High-Performance GPU Server",
            serialNumber: "SN-GPU-990",
            bookStockPreviousYear: 10,
            purchasedDuringYear: 2,
            actualPhysicalStock: 12,
            workingCondition: "Working",
            purchaseValue: 12000
          }
        ]
      })
    });
    const p1Data = await p1Resp.json();
    if (!p1Data.ok || !p1Data.data?.recordId) {
      throw new Error("Proforma-I creation failed: " + JSON.stringify(p1Data));
    }
    const item1 = p1Data.data.items[0];
    if (item1.bookStockCurrentYear !== 12 || item1.difference !== 0) {
      throw new Error(`Proforma-I calculation incorrect: bookCurrent=${item1.bookStockCurrentYear}, diff=${item1.difference}`);
    }
    console.log(`   Proforma-I record ${p1Data.data.recordId} created (Calculated current book stock: 12, Variance: 0)`);

    // 4. Proforma-II (Equipment Condemnation Request & Approval)
    console.log("\n4. Testing Proforma-II (Equipment Condemnation Request & Approval)...");
    const p2ReqResp = await fetchApi(`${BASE_URL}/api/verification/equipment/condemnation`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({
        department: "Operations",
        laboratory: "Machinery Shop",
        stockBookNumber: "SB-2024-M9",
        staffInCharge: "Marcus Vance",
        verificationDate: "2026-07-27",
        items: [
          {
            description: "Hydraulic Fuser Core",
            quantity: 1,
            purchaseDate: "2020-05-10",
            purchaseValue: 4500,
            bookValue: 300,
            reasonForCondemnation: "Severe shaft erosion"
          }
        ]
      })
    });
    const p2ReqData = await p2ReqResp.json();
    if (!p2ReqData.ok || !p2ReqData.data?.recordId) {
      throw new Error("Proforma-II creation failed: " + JSON.stringify(p2ReqData));
    }
    const p2Id = p2ReqData.data.recordId;
    console.log(`   Proforma-II request ${p2Id} created (Status: Pending)`);

    // Approve Proforma-II
    const p2ApproveResp = await fetchApi(`${BASE_URL}/api/verification/equipment/condemnation/${encodeURIComponent(p2Id)}/approve`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ approvedBy: "Administrator" })
    });
    const p2ApproveData = await p2ApproveResp.json();
    if (!p2ApproveData.ok || p2ApproveData.data?.status !== "Approved") {
      throw new Error("Proforma-II approval failed: " + JSON.stringify(p2ApproveData));
    }
    console.log(`   Proforma-II request ${p2Id} approved successfully`);

    // 5. Proforma-III (Consumable Stock Verification)
    console.log("\n5. Testing Proforma-III (Consumable Stock Verification)...");
    const p3Resp = await fetchApi(`${BASE_URL}/api/verification/consumables`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({
        department: "IT",
        laboratory: "Network Room",
        stockBookNumber: "SB-CONS-88",
        staffInCharge: "Lead Eng David",
        verificationDate: "2026-07-27",
        items: [
          {
            description: "Fiber Optic Patch Cords",
            previousStock: 50,
            purchasedQuantity: 30,
            consumedQuantity: 25,
            actualPhysicalStock: 55,
            purchaseValue: 1800
          }
        ]
      })
    });
    const p3Data = await p3Resp.json();
    if (!p3Data.ok || !p3Data.data?.recordId) {
      throw new Error("Proforma-III creation failed: " + JSON.stringify(p3Data));
    }
    const item3 = p3Data.data.items[0];
    if (item3.remainingBookStock !== 55 || item3.difference !== 0) {
      throw new Error(`Proforma-III calculation incorrect: remaining=${item3.remainingBookStock}, diff=${item3.difference}`);
    }
    console.log(`   Proforma-III record ${p3Data.data.recordId} created (Remaining stock: 55 = 50 + 30 - 25, Variance: 0)`);

    // 6. Proforma-IV (Consumable Condemnation Request & Approval)
    console.log("\n6. Testing Proforma-IV (Consumable Condemnation Request & Approval)...");
    const p4ReqResp = await fetchApi(`${BASE_URL}/api/verification/consumables/condemnation`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({
        department: "Electronics",
        laboratory: "Circuit Lab",
        stockBookNumber: "SB-CONS-04",
        staffInCharge: "Dr. Elena Vance",
        verificationDate: "2026-07-27",
        items: [
          {
            description: "Expired Thermal Compound Tubes",
            quantity: 15,
            bookStock: 15,
            actualStock: 15,
            purchaseDate: "2022-01-15",
            bookValue: 300,
            condemnationReason: "Expired shelf life"
          }
        ]
      })
    });
    const p4ReqData = await p4ReqResp.json();
    if (!p4ReqData.ok || !p4ReqData.data?.recordId) {
      throw new Error("Proforma-IV creation failed: " + JSON.stringify(p4ReqData));
    }
    const p4Id = p4ReqData.data.recordId;
    console.log(`   Proforma-IV request ${p4Id} created (Status: Pending)`);

    // Approve Proforma-IV
    const p4ApproveResp = await fetchApi(`${BASE_URL}/api/verification/consumables/condemnation/${encodeURIComponent(p4Id)}/approve`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ approvedBy: "Administrator" })
    });
    const p4ApproveData = await p4ApproveResp.json();
    if (!p4ApproveData.ok || p4ApproveData.data?.status !== "Approved") {
      throw new Error("Proforma-IV approval failed: " + JSON.stringify(p4ApproveData));
    }
    console.log(`   Proforma-IV request ${p4Id} approved successfully`);

    // 7. Audit Log Retrieval (GET /api/audit-logs)
    console.log("\n7. Testing System Audit Log Retrieval (GET /api/audit-logs)...");
    const auditResp = await fetchApi(`${BASE_URL}/api/audit-logs`, { headers: authHeaders });
    const auditData = await auditResp.json();
    if (!auditData.ok || !Array.isArray(auditData.data)) {
      throw new Error("Get audit logs failed: " + JSON.stringify(auditData));
    }
    console.log(`   System audit logs retrieved (${auditData.data.length} audit trail records found)`);

    console.log("\n=== All 7 Proforma-I to IV Compliance Tests Passed Successfully! ===\n");
  } catch (error) {
    console.error("\n❌ Proforma compliance test failed:", error.message);
    process.exitCode = 1;
  }
}

runProformaComplianceTests();
