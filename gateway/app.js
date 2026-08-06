require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const path = require("path");
const helmet = require("helmet");
const cors = require("cors");
const { authenticate } = require("../backend/middleware/auth");
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

app.get(["/api/reports/:reportId/export", "/reports/:reportId/export"], authenticate, async (req, res) => {
  try {
    const format = req.query.format || "pdf";
    const reportId = req.params.reportId;
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
