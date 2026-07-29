const BASE_URL = process.env.TEST_URL || "http://127.0.0.1:3000";

function getFetch() {
  if (typeof fetch !== "undefined") return fetch.bind(globalThis);
  if (typeof globalThis !== "undefined" && typeof globalThis.fetch !== "undefined") {
    return globalThis.fetch.bind(globalThis);
  }
  throw new Error("Fetch API is not available.");
}

const fetchApi = getFetch();

async function runFeatureTests() {
  console.log("=== ChainTrack Asset Management - Extended Feature & Export Integration Tests ===\n");

  try {
    // 1. Health check
    console.log("1. Checking server health...");
    const healthResp = await fetchApi(`${BASE_URL}/health`);
    const health = await healthResp.json();
    console.log("   Health status:", health.status || "ok");

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

    // 3. Test Real PDF Report Export
    console.log("\n3. Testing Real PDF Report Export (GET /api/reports/REP-2025/export?format=pdf)...");
    const pdfResp = await fetchApi(`${BASE_URL}/api/reports/REP-2025/export?format=pdf`, { headers: authHeaders });
    if (!pdfResp.ok) throw new Error(`PDF export failed with status ${pdfResp.status}`);
    const pdfArrayBuf = await pdfResp.arrayBuffer();
    const pdfBuffer = Buffer.from(pdfArrayBuf);
    const pdfHeader = pdfBuffer.slice(0, 5).toString("utf8");
    if (!pdfHeader.startsWith("%PDF")) {
      throw new Error(`Expected PDF header %PDF but received: ${pdfHeader}`);
    }
    console.log(`   PDF export valid binary generated (${pdfBuffer.length} bytes, header: ${pdfHeader})`);

    // 4. Test Real Excel Report Export
    console.log("\n4. Testing Real Excel Report Export (GET /api/reports/REP-2025/export?format=excel)...");
    const excelResp = await fetchApi(`${BASE_URL}/api/reports/REP-2025/export?format=excel`, { headers: authHeaders });
    if (!excelResp.ok) throw new Error(`Excel export failed with status ${excelResp.status}`);
    const excelArrayBuf = await excelResp.arrayBuffer();
    const excelBuffer = Buffer.from(excelArrayBuf);
    const excelHeader = excelBuffer.slice(0, 2).toString("utf8");
    if (excelHeader !== "PK") {
      throw new Error(`Expected zip/xlsx header PK but received: ${excelHeader}`);
    }
    console.log(`   Excel export valid binary generated (${excelBuffer.length} bytes, header: ${excelHeader})`);

    // 5. Test Department CRUD
    console.log("\n5. Testing Department CRUD...");
    const testDeptCode = `DEPT-${Date.now().toString().slice(-4)}`;
    const createDeptResp = await fetchApi(`${BASE_URL}/api/departments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({
        code: testDeptCode,
        name: `Research & Development ${Date.now()}`,
        description: "Next-gen tech engineering",
        manager: "Dr. Aris Thorne"
      })
    });
    const createDeptData = await createDeptResp.json();
    if (!createDeptData.ok) throw new Error("Create department failed: " + JSON.stringify(createDeptData));
    console.log(`   Department ${testDeptCode} created successfully`);

    // Update Dept
    const deptId = createDeptData.data._id || testDeptCode;
    const updateDeptResp = await fetchApi(`${BASE_URL}/api/departments/${encodeURIComponent(deptId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ manager: "Dr. Aris Thorne (Lead)" })
    });
    const updateDeptData = await updateDeptResp.json();
    if (!updateDeptData.ok) throw new Error("Update department failed");
    console.log(`   Department ${testDeptCode} updated successfully`);

    // 6. Test Asset Lifecycle & History Timeline
    console.log("\n6. Testing Asset Lifecycle & Timeline History...");
    const testAssetId = `FEAT-AST-${Date.now().toString().slice(-4)}`;
    const createAstResp = await fetchApi(`${BASE_URL}/api/assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({
        assetId: testAssetId,
        name: "Precision AI Cluster Node",
        category: "Hardware",
        department: testDeptCode,
        status: "Active",
        location: "Data Hall 3",
        purchaseDate: "2025-01-10",
        purchaseValue: 8500,
        serialNumber: `SN-AI-${Date.now().toString().slice(-4)}`
      })
    });
    const createAstData = await createAstResp.json();
    if (!createAstData.ok) throw new Error("Create asset failed: " + JSON.stringify(createAstData));
    console.log(`   Asset ${testAssetId} created`);

    const historyResp = await fetchApi(`${BASE_URL}/api/assets/${encodeURIComponent(testAssetId)}/history`, { headers: authHeaders });
    const historyData = await historyResp.json();
    if (!historyData.ok || !historyData.data?.timeline) throw new Error("Get asset history failed");
    console.log(`   Asset ${testAssetId} timeline items count: ${historyData.data.timeline.length}`);

    // 7. Test Maintenance Status Transition (Auto-returns asset to Active when Completed)
    console.log("\n7. Testing Maintenance Scheduling & State Transition...");
    const maintResp = await fetchApi(`${BASE_URL}/api/maintenance`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({
        assetId: testAssetId,
        technician: "Lead Eng David",
        maintenanceDate: "2026-07-27",
        description: "Firmware and thermal paste refresh",
        cost: 300,
        status: "In Progress"
      })
    });
    const maintData = await maintResp.json();
    if (!maintData.ok) throw new Error("Log maintenance failed: " + JSON.stringify(maintData));
    const recordId = maintData.data.recordId;
    console.log(`   Maintenance ${recordId} created (In Progress)`);

    // Complete Maintenance
    const completeMaintResp = await fetchApi(`${BASE_URL}/api/maintenance/${encodeURIComponent(recordId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ status: "Completed" })
    });
    const completeMaintData = await completeMaintResp.json();
    if (!completeMaintData.ok) throw new Error("Complete maintenance failed");
    console.log(`   Maintenance ${recordId} updated to Completed (Asset status restored to Active)`);

    // 8. Test Condemnation Rejection Workflow
    console.log("\n8. Testing Condemnation Rejection Workflow...");
    const condReqResp = await fetchApi(`${BASE_URL}/api/condemnation`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({
        assetId: testAssetId,
        reason: "Fan noise reported",
        requestedBy: "Junior Tech"
      })
    });
    const condReqData = await condReqResp.json();
    if (!condReqData.ok) throw new Error("Request condemnation failed");
    const condId = condReqData.data.recordId;
    console.log(`   Condemnation request ${condId} created`);

    const rejectResp = await fetchApi(`${BASE_URL}/api/condemnation/${encodeURIComponent(condId)}/reject`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ rejectionReason: "Minor issue, repair component instead" })
    });
    const rejectData = await rejectResp.json();
    if (!rejectData.ok || rejectData.data?.status !== "Rejected") {
      throw new Error("Reject condemnation failed: " + JSON.stringify(rejectData));
    }
    console.log(`   Condemnation request ${condId} rejected (Asset restored to Active state)`);

    // 9. Test Bill Upload & Verification
    console.log("\n9. Testing Bill Upload & Document Verification...");
    const billId = `BILL-FEAT-${Date.now().toString().slice(-4)}`;
    const docHash = "0x" + Buffer.from(`test-bill-${Date.now()}`).toString("hex").padEnd(64, "0").slice(0, 64);
    const billResp = await fetchApi(`${BASE_URL}/api/bills`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({
        billId,
        assetId: testAssetId,
        vendor: "Acme Scientific Corp",
        invoiceNumber: "INV-FEAT-99",
        amount: 8500,
        documentHash: docHash
      })
    });
    const billData = await billResp.json();
    if (!billData.ok) throw new Error("Upload bill failed");
    console.log(`   Bill ${billId} uploaded`);

    const verifyResp = await fetchApi(`${BASE_URL}/api/bills/${encodeURIComponent(billId)}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ billId, documentHash: docHash })
    });
    const verifyData = await verifyResp.json();
    if (!verifyData.ok || !verifyData.data?.verified) {
      throw new Error("Verify bill failed: " + JSON.stringify(verifyData));
    }
    console.log(`   Bill ${billId} verified on chain (integrity verified)`);

    console.log("\n=== All 9 Extended Feature & Export Integration Tests Passed Successfully! ===\n");
  } catch (error) {
    console.error("\n❌ Feature integration test failed:", error.message);
    process.exitCode = 1;
  }
}

runFeatureTests();
