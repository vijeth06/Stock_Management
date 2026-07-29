const Product = require("../backend/models/Product");
const Shipment = require("../backend/models/Shipment");
const SensorReading = require("../backend/models/SensorReading");
const Alert = require("../backend/models/Alert");
const Device = require("../backend/models/Device");
const Report = require("../backend/models/Report");
const { recordAuditLog, listAuditLogs } = require("../backend/services/auditService");
const { createReport, listReports, exportToCsv, exportToPdf } = require("../backend/services/reportService");
const { createAlert, listAlerts, acknowledgeAlert } = require("../backend/services/alertService");

async function runTests() {
  console.log("=== Backend Service Tests ===\n");

  try {
    console.log("1. Testing Report Service...");
    const report = await createReport({
      reportId: "TEST-REPORT-001",
      title: "Test Report",
      reportType: "summary",
      generatedBy: "test-user",
    });
    console.log("   Create Report:", report ? "PASS" : "FAIL");

    const reports = await listReports({ page: 1, limit: 10 });
    console.log("   List Reports:", reports ? "PASS" : "FAIL");

    const csv = await exportToCsv([{ productId: "TEST" }]);
    console.log("   CSV Export:", csv ? "PASS" : "FAIL");

    const pdf = await exportToPdf([{ productId: "TEST" }]);
    console.log("   PDF Export:", pdf ? "PASS" : "FAIL");

    console.log("\n2. Testing Alert Service...");
    const alert = await createAlert({
      alertType: "test-alert",
      severity: "high",
      message: "Test alert",
      productId: "TEST-PROD",
    });
    console.log("   Create Alert:", alert ? "PASS" : "FAIL");

    const alerts = await listAlerts({ page: 1, limit: 10 });
    console.log("   List Alerts:", alerts ? "PASS" : "FAIL");

    console.log("\n3. Testing Audit Service...");
    const audit = await recordAuditLog({
      actor: "test-user",
      role: "Administrator",
      action: "test-action",
      resourceType: "Product",
      resourceId: "TEST-PROD",
    });
    console.log("   Create Audit Log:", audit ? "PASS" : "FAIL");

    const logs = await listAuditLogs({ page: 1, limit: 10 });
    console.log("   List Audit Logs:", logs ? "PASS" : "FAIL");

    console.log("\n=== Backend Tests Completed ===\n");
  } catch (error) {
    console.error("Test error:", error.message);
  }
}

runTests();