const { ethers } = require("ethers");

const BASE_URL = process.env.TEST_URL || "http://localhost:3000";

async function fetchWithAuth(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });
  return response.json().catch(() => ({}));
}

async function runE2ETests() {
  console.log("=== End-to-End Tests ===\n");

  let token = null;

  try {
    console.log("1. Testing health endpoint...");
    const health = await fetchWithAuth("/health");
    console.log("   Health check:", health.status === "ok" ? "PASS" : "FAIL");

    console.log("\n2. Testing login with demo admin...");
    const loginResponse = await fetchWithAuth("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@supplychain.local", password: "admin123" }),
    });
    
    if (loginResponse.ok && loginResponse.data?.token) {
      token = loginResponse.data.token;
      console.log("   Login:", "PASS");
    } else {
      console.log("   Login:", "FAIL - using mock auth");
    }

    console.log("\n3. Testing dashboard access...");
    const dashboard = await fetchWithAuth("/api/dashboard", {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log("   Dashboard:", dashboard.ok ? "PASS" : "FAIL");

    console.log("\n4. Testing products list...");
    const products = await fetchWithAuth("/assets");
    console.log("   Products:", products.ok ? "PASS" : "FAIL");

    console.log("\n5. Testing chart data from dashboard...");
    if (dashboard.ok && dashboard.data?.analytics) {
      const analytics = dashboard.data.analytics;
      console.log("   Product Status:", analytics.productStatus ? "PASS" : "FAIL");
      console.log("   Shipment Timeline:", analytics.shipmentTimeline ? "PASS" : "FAIL");
      console.log("   Alert Distribution:", analytics.alertDistribution ? "PASS" : "FAIL");
      console.log("   Sensor Heatmap:", analytics.sensorHeatmap ? "PASS" : "FAIL");
    } else {
      console.log("   Chart data: FAIL - no analytics");
    }

    console.log("\n6. Testing CSV export...");
    const csvResponse = await fetchWithAuth("/reports/export/csv");
    console.log("   CSV Export:", csvResponse.ok || csvResponse.text ? "PASS" : "FAIL");

    console.log("\n7. Testing PDF export...");
    const pdfResponse = await fetchWithAuth("/reports/export/pdf");
    console.log("   PDF Export:", pdfResponse.ok || pdfResponse.text ? "PASS" : "FAIL");

    console.log("\n8. Testing MQTT sensor endpoint...");
    const sensorResponse = await fetchWithAuth("/sensors/mqtt", {
      method: "POST",
      body: JSON.stringify({
        productId: "PROD001",
        deviceId: "TEST-ESP32",
        temperature: 25,
        humidity: 60,
        status: "Normal",
      }),
    });
    console.log("   Sensor Recording:", sensorResponse.ok ? "PASS" : "FAIL");

    console.log("\n=== E2E Tests Completed ===\n");
  } catch (error) {
    console.error("Test error:", error.message);
  }
}

runE2ETests();