require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const path = require("path");
const helmet = require("helmet");
const cors = require("cors");
const { authenticate, authorize } = require("../backend/middleware/auth");
const { register: authRegister, login, gmailAuth } = require("../backend/controllers/authController");
const { seedDemoAdmin } = require("../backend/services/authService");
const apiRoutes = require("../backend/routes");
const { generatePdfBuffer, generateExcelBuffer } = require("../backend/services/reportExportService");
const { register, fabricInvokeCounter, fabricRetryCounter } = require('../backend/services/metricsService');

const app = express();
app.get('/metrics', async (req, res) => {
  try {
    res.setHeader('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
});
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "..", "client")));

const PORT = Number(process.env.PORT || 3000);

async function initFabricLedger() {
  try {
    await seedDemoAdmin();
    console.log("Hyperledger Fabric ledger storage initialized successfully.");
  } catch (error) {
    console.warn(`Fabric ledger startup warning: ${error.message}`);
  }
}

initFabricLedger();

app.get("/health", async (req, res) => {
  try {
    res.json({
      status: "ok",
      platform: "Hyperledger Fabric",
      storage: "Hyperledger Fabric Ledger",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({ status: "degraded", error: error.message });
  }
});

app.post("/auth/register", authRegister);
app.post("/auth/login", login);
app.post("/auth/gmail", gmailAuth);
app.get("/users/me", authenticate, (req, res) => {
  res.json({ ok: true, data: { id: req.user.sub, name: req.user.name, email: req.user.email, role: req.user.role, department: req.user.department } });
});

app.get(["/api/reports/:reportId/export", "/reports/:reportId/export"], authenticate, authorize(["Administrator", "AuditOfficer", "DepartmentUser"]), async (req, res, next) => {
  const reportId = req.params.reportId;
  if (reportId === "export") {
    return next();
  }
  try {
    if (reportId === "financial") {
      const { generateFinancialReportPdf, generateFinancialReportExcel } = require("../backend/services/reportExportService");
      const { getAllAssetsFromFabric } = require("../backend/services/fabricService");
      const assetsRes = await getAllAssetsFromFabric();
      let assets = assetsRes.assets || [];

      if (req.user && req.user.role === "DepartmentUser" && req.user.department && req.user.department !== "ALL") {
        const userDept = String(req.user.department).toUpperCase();
        assets = assets.filter(a => (a.department || "").toUpperCase() === userDept);
      }

      const totalPurchaseValue = assets.reduce((sum, a) => sum + (Number(a.purchaseValue) || 0), 0);
      const netBookValue = totalPurchaseValue * 0.7;

      const deptMap = {};
      assets.forEach(a => {
        const dept = a.department || "Unknown";
        if (!deptMap[dept]) deptMap[dept] = { count: 0, value: 0 };
        deptMap[dept].count += 1;
        deptMap[dept].value += Number(a.purchaseValue) || 0;
      });
      const departments = Object.keys(deptMap).map(d => ({
        department: d,
        assetCount: deptMap[d].count,
        totalPurchaseValue: deptMap[d].value,
        netBookValue: deptMap[d].value * 0.7
      }));

      const catMap = {};
      assets.forEach(a => {
        const cat = a.category || "Uncategorized";
        if (!catMap[cat]) catMap[cat] = { count: 0, value: 0 };
        catMap[cat].count += 1;
        catMap[cat].value += Number(a.purchaseValue) || 0;
      });
      const categories = Object.keys(catMap).map(c => ({
        category: c,
        assetCount: catMap[c].count,
        totalPurchaseValue: catMap[c].value,
        netBookValue: catMap[c].value * 0.7
      }));

      const reportData = {
        financialYear: assets.length > 0 ? (assets[0].financialYear || new Date().getFullYear()) : new Date().getFullYear(),
        department: req.user?.department || "All Departments",
        assetCount: assets.length,
        totalPurchaseValue,
        netBookValue,
        depreciationMethod: "Straight-Line (30%)",
        departments,
        categories,
        assets,
        generatedAt: new Date().toISOString()
      };

      const format = req.query.format || "pdf";
      if (format === "excel") {
        const buffer = await generateFinancialReportExcel(reportData);
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename=financial-report-${new Date().getFullYear()}.xlsx`);
        return res.send(buffer);
      }

      const buffer = await generateFinancialReportPdf(reportData);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=financial-report-${new Date().getFullYear()}.pdf`);
      return res.send(buffer);
    }

    if (reportId === "department-valuation") {
      const { generateValuationPdf, generateValuationExcel } = require("../backend/services/reportExportService");
      const { getDepartmentValuationOnFabric } = require("../backend/services/fabricService");

      const valuationRes = await getDepartmentValuationOnFabric();
      if (!valuationRes.success) {
        return res.status(500).json({ ok: false, error: valuationRes.error });
      }

      let valuation = valuationRes.valuation || {};

      if (req.user && req.user.role === "DepartmentUser" && req.user.department) {
        const userDept = String(req.user.department).toUpperCase();
        const filtered = {};
        for (const [key, val] of Object.entries(valuation)) {
          if (String(val.code || key).toUpperCase() === userDept) {
            filtered[key] = val;
          }
        }
        valuation = filtered;
      }

      const departments = Object.values(valuation);
      const totalAssets = departments.reduce((s, d) => s + (Number(d.totalAssets) || 0), 0);
      const totalPurchaseValue = departments.reduce((s, d) => s + (Number(d.totalPurchaseValue) || 0), 0);
      const totalNetBookValue = departments.reduce((s, d) => s + (Number(d.netBookValue) || 0), 0);

      const reportData = {
        financialYear: new Date().getFullYear(),
        departmentCount: departments.length,
        totalAssets,
        totalPurchaseValue,
        netBookValue: totalNetBookValue,
        departments,
        generatedAt: new Date().toISOString()
      };

      const format = req.query.format || "pdf";
      if (format === "excel") {
        const buffer = await generateValuationExcel(reportData);
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename=department-valuation-${new Date().getFullYear()}.xlsx`);
        return res.send(buffer);
      }

      const buffer = await generateValuationPdf(reportData);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=department-valuation-${new Date().getFullYear()}.pdf`);
      return res.send(buffer);
    }

    const format = req.query.format || "pdf";
    const { generateYearlyReportOnFabric, getAllAssetsFromFabric } = require("../backend/services/fabricService");

    const reportRes = await generateYearlyReportOnFabric(new Date().getFullYear());
    const assetsRes = await getAllAssetsFromFabric();
    const reportData = {
      reportId: reportId || `REP-${new Date().getFullYear()}`,
      ...(reportRes.result || {}),
      assetsList: assetsRes.assets || []
    };

    if (format === "excel") {
      const buffer = await generateExcelBuffer(reportData);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=${reportData.reportId}.xlsx`);
      return res.send(buffer);
    }

    const buffer = await generatePdfBuffer(reportData);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${reportData.reportId}.pdf`);
    return res.send(buffer);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.use("/api", authenticate, apiRoutes);

let server = null;
const createServer = (port) => {
  const srv = app.listen(port, () => {
    console.log(`Departmental Asset Management Gateway listening on http://localhost:${port}`);
    console.log(`Health check: http://localhost:${port}/health`);
    server = srv;
  });

  srv.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      const fallbackPort = port + 1;
      console.warn(`Port ${port} is already in use. Trying fallback port ${fallbackPort}...`);
      createServer(fallbackPort);
    } else {
      console.error("Server error:", error);
      process.exit(1);
    }
  });
};

createServer(PORT);

const shutdown = () => {
  console.log("Shutdown signal received, closing server...");
  if (!server) {
    process.exit(0);
    return;
  }
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

module.exports = { fabricInvokeCounter, fabricRetryCounter, register };
