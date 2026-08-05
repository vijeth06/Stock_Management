require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const path = require("path");
const helmet = require("helmet");
const cors = require("cors");
const { authenticate, authorize } = require("../backend/middleware/auth");
const { register, login } = require("../backend/controllers/authController");
const { seedDemoAdmin } = require("../backend/services/authService");
const apiRoutes = require("../backend/routes");
const { generatePdfBuffer, generateExcelBuffer } = require("../backend/services/reportExportService");

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "..", "client")));

const PORT = Number(process.env.PORT || 3000);

const initFabricLedger = async () => {
  try {
    await seedDemoAdmin();
    console.log("Hyperledger Fabric ledger storage initialized successfully.");
  } catch (error) {
    console.warn(`Fabric ledger startup warning: ${error.message}`);
  }
};

initFabricLedger();

function handleError(res, error) {
  const status = error.status || 500;
  res.status(status).json({ ok: false, error: error.message });
}

app.get("/health", async (req, res) => {
  try {
    res.json({
      status: "ok",
      platform: "Hyperledger Fabric",
      storage: "Hyperledger Fabric Ledger",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: "degraded",
      error: error.message
    });
  }
});

app.post("/auth/register", register);
app.post("/auth/login", login);

app.post("/auth/gmail", async (req, res, next) => {
  const { email, name, department, departmentName } = req.body;
  if (!email || !email.includes("@")) {
    return res.status(400).json({ ok: false, error: "Valid Gmail address is required" });
  }

  const emailLower = email.toLowerCase().trim();
  const userName = name || emailLower.split("@")[0];
  const jwt = require("jsonwebtoken");

  let user = (mockDb.approvedUsers || []).find(u => u.email === emailLower);
  if (!user) {
    const isAdmin = emailLower.includes("admin") || emailLower === "admin@assetmgmt.local";
    user = {
      _id: "usr-gmail-" + Date.now(),
      name: userName,
      email: emailLower,
      password: "gmail_authenticated",
      role: isAdmin ? "Administrator" : "DepartmentUser",
      department: (department || "IT").toUpperCase(),
      departmentName: departmentName || department || "Information Technology",
      isApproved: true,
      status: "Approved",
      authProvider: "Google",
      createdAt: new Date().toISOString()
    };
    mockDb.approvedUsers.push(user);
  }

  const token = jwt.sign(
    { sub: user._id, email: user.email, role: user.role, name: user.name, department: user.department },
    process.env.JWT_SECRET || "change-me-in-development",
    { expiresIn: "8h" }
  );

  return res.json({
    ok: true,
    message: `Successfully authenticated as ${user.name} (${user.role}) via Google!`,
    data: { user, token }
  });
});

app.get("/users/me", authenticate, async (req, res) => {
  try {
    if (!databaseReady || req.user.sub === "mock-user-id") {
      return res.json({
        ok: true,
        data: {
          _id: "mock-user-id",
          name: req.user.name || "Mock User",
          email: req.user.email,
          role: req.user.role || "DepartmentUser",
          isActive: true
        }
      });
    }
    const user = await User.findById(req.user.sub).select("name email role isActive lastLoginAt");
    res.json({ ok: true, data: user });
  } catch (error) {
    handleError(res, error);
  }
});

const mockDb = {
  pendingUsers: [
    { _id: "usr-p101", name: "Prof. Alan Turing", email: "alan.turing@assetmgmt.local", role: "DepartmentUser", department: "IT", status: "PendingApproval", createdAt: new Date().toISOString() },
    { _id: "usr-p102", name: "Dr. Sarah Connor", email: "sarah.connor@assetmgmt.local", role: "DepartmentUser", department: "Operations", status: "PendingApproval", createdAt: new Date().toISOString() }
  ],
  approvedUsers: [
    { _id: "usr-a101", name: "Demo Admin", email: "admin@assetmgmt.local", role: "Administrator", department: "ALL", isApproved: true, status: "Approved" }
  ],
  departments: [
    { _id: "dept-1", code: "IT", name: "Information Technology", description: "Hardware & Server Infrastructure", assetCount: 3, isActive: true },
    { _id: "dept-2", code: "FIN", name: "Finance & Accounts", description: "Financial Workstations & Audit Tools", assetCount: 1, isActive: true },
    { _id: "dept-3", code: "OPS", name: "Operations & Logistics", description: "Warehouse Equipment & Printers", assetCount: 2, isActive: true },
    { _id: "dept-4", code: "HR", name: "Human Resources", description: "HR Workstations & Records", assetCount: 1, isActive: true }
  ],
  assets: [
    {
      _id: "ast-101",
      assetId: "ASSET-101",
      name: "Dell PowerEdge Server Rack",
      category: "Hardware",
      department: "IT",
      status: "Active",
      location: "Server Room A - Rack 04",
      purchaseDate: "2024-01-15",
      purchaseValue: 4500,
      lifespanYears: 5,
      serialNumber: "SN-DELL-9921X",
      billHash: "0x7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
      blockchainTxHash: "0x892a71f0c23941b9a10985223a4112e8466ab0129",
      createdAt: "2024-01-15T10:00:00.000Z"
    },
    {
      _id: "ast-102",
      assetId: "ASSET-102",
      name: "Lenovo ThinkPad P1 Workstation",
      category: "Computing",
      department: "IT",
      status: "Maintenance",
      location: "IT Helpdesk Bay 3",
      purchaseDate: "2023-06-20",
      purchaseValue: 2100,
      lifespanYears: 3,
      serialNumber: "SN-LNV-8812Y",
      billHash: "0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      blockchainTxHash: "0x3c71a998b18201295b3419992019ab9102847291a",
      createdAt: "2023-06-20T11:30:00.000Z"
    },
    {
      _id: "ast-103",
      assetId: "ASSET-103",
      name: "Cisco Catalyst 9300 Core Switch",
      category: "Networking",
      department: "IT",
      status: "Active",
      location: "Data Center Room B",
      purchaseDate: "2024-03-10",
      purchaseValue: 3200,
      lifespanYears: 6,
      serialNumber: "SN-CSCO-4491Z",
      billHash: "0xa1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0",
      blockchainTxHash: "0x1234567890abcdef1234567890abcdef12345678",
      createdAt: "2024-03-10T09:15:00.000Z"
    },
    {
      _id: "ast-104",
      assetId: "ASSET-104",
      name: "HP HeavyDuty LaserJet Enterprise Printer",
      category: "Office Equipment",
      department: "OPS",
      status: "Condemned",
      location: "Warehouse Dispatch Desk",
      purchaseDate: "2021-11-05",
      purchaseValue: 1800,
      lifespanYears: 4,
      serialNumber: "SN-HP-1102A",
      billHash: "0x9876543210fedcba0987654321fedcba0987654321fedcba0987654321fedcba",
      blockchainTxHash: "0xabcdef1234567890abcdef1234567890abcdef12",
      createdAt: "2021-11-05T14:20:00.000Z"
    }
  ],
  bills: [
    {
      _id: "bill-501",
      billId: "BILL-501",
      assetId: "ASSET-101",
      vendor: "Dell Enterprise Solutions",
      invoiceNumber: "INV-2024-8841",
      amount: 4500,
      documentHash: "0x7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
      verified: true,
      paymentStatus: "Paid",
      createdAt: "2024-01-15T10:00:00.000Z"
    },
    {
      _id: "bill-502",
      billId: "BILL-502",
      assetId: "ASSET-102",
      vendor: "Lenovo Global Direct",
      invoiceNumber: "INV-2023-4109",
      amount: 2100,
      documentHash: "0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      verified: true,
      paymentStatus: "Paid",
      createdAt: "2023-06-20T11:30:00.000Z"
    }
  ],
  maintenance: [
    {
      _id: "maint-701",
      recordId: "MAINT-701",
      assetId: "ASSET-102",
      assetName: "Lenovo ThinkPad P1 Workstation",
      technician: "Alex Smith (Hardware Specialist)",
      maintenanceDate: "2026-07-20",
      description: "Overheating issue - replaced CPU thermal paste and cooling fan assembly",
      cost: 150,
      status: "In Progress",
      createdAt: "2026-07-20T08:00:00.000Z"
    }
  ],
  condemnation: [
    {
      _id: "cond-801",
      recordId: "COND-801",
      assetId: "ASSET-104",
      assetName: "HP HeavyDuty LaserJet Enterprise Printer",
      reason: "Printhead failure, gear teeth stripped, repair parts discontinued by vendor",
      requestedBy: "Marcus Vance (Ops Manager)",
      inspectionDetails: "Comprehensive inspection verified irreparable fuser and mainboard damage",
      status: "Approved",
      approvedBy: "Admin User",
      disposalMethod: "E-Waste Recycling",
      createdAt: "2026-07-15T10:30:00.000Z"
    }
  ],
  transfers: [
    {
      _id: "trans-901",
      transferId: "TRANS-901",
      assetId: "ASSET-103",
      assetName: "Cisco Catalyst 9300 Core Switch",
      fromDepartment: "Operations",
      toDepartment: "IT",
      requestedBy: "IT Admin",
      reason: "Network core upgrade centralization",
      status: "Completed",
      createdAt: "2026-06-10T14:00:00.000Z"
    }
  ],
  reports: [
    {
      _id: "rep-2025",
      reportId: "REP-2025",
      year: 2025,
      totalAssets: 4,
      totalPurchaseValue: 11600,
      activeAssets: 2,
      maintenanceAssets: 1,
      condemnedAssets: 1,
      createdAt: "2025-12-31T23:59:59.000Z"
    }
  ],
  equipmentVerifications: [
    {
      _id: "eqv-101",
      recordId: "EQV-101",
      department: "IT",
      laboratory: "Systems Lab 1",
      stockBookNumber: "SB-2025-01",
      verificationDate: "2026-07-20",
      staffInCharge: "Dr. Aris Thorne",
      auditYear: 2026,
      status: "Completed",
      items: [
        {
          pageNumber: "12",
          serialNumber: "SN-101",
          description: "Precision Workstation Tower",
          bookStockPreviousYear: 5,
          purchasedDuringYear: 2,
          bookStockCurrentYear: 7,
          actualPhysicalStock: 7,
          difference: 0,
          previousBookValue: 15000,
          purchaseValue: 20000,
          currentBookValue: 18000,
          workingCondition: "Working",
          remarks: "All 7 physical units verified in lab"
        }
      ],
      createdAt: "2026-07-20T10:00:00.000Z"
    }
  ],
  equipmentCondemnations: [
    {
      _id: "eqc-101",
      recordId: "EQC-101",
      department: "Operations",
      laboratory: "Machinery Shop",
      stockBookNumber: "SB-2024-09",
      verificationDate: "2026-07-18",
      staffInCharge: "Marcus Vance",
      status: "Pending",
      items: [
        {
          pageNumber: "45",
          serialNumber: "SN-909",
          description: "Industrial Fuser Assembly",
          quantity: 1,
          purchaseDate: "2021-03-15",
          purchaseValue: 3500,
          bookValue: 200,
          reasonForCondemnation: "Severe thermal erosion and gear stripping",
          remarks: "Parts obsolete"
        }
      ],
      createdAt: "2026-07-18T11:00:00.000Z"
    }
  ],
  consumableVerifications: [
    {
      _id: "cnv-101",
      recordId: "CNV-101",
      department: "IT",
      laboratory: "Networking Lab",
      stockBookNumber: "SB-CONS-01",
      verificationDate: "2026-07-22",
      staffInCharge: "Lead Eng David",
      status: "Completed",
      items: [
        {
          pageNumber: "03",
          serialNumber: "CAT6-CABLE",
          description: "Cat6 Ethernet Spool 300m",
          previousStock: 20,
          purchasedQuantity: 10,
          consumedQuantity: 15,
          remainingBookStock: 15,
          actualPhysicalStock: 15,
          difference: 0,
          purchaseValue: 1500,
          currentValue: 750,
          remarks: "Stock count aligns with log"
        }
      ],
      createdAt: "2026-07-22T09:00:00.000Z"
    }
  ],
  consumableCondemnations: [
    {
      _id: "cnc-101",
      recordId: "CNC-101",
      department: "Electronics",
      laboratory: "Circuit Prototyping Lab",
      stockBookNumber: "SB-CONS-04",
      verificationDate: "2026-07-25",
      staffInCharge: "Dr. Elena Vance",
      status: "Pending",
      items: [
        {
          pageNumber: "18",
          serialNumber: "CHEM-ETCH",
          description: "Chemical Etching Solution (Expired)",
          quantity: 10,
          bookStock: 10,
          actualStock: 10,
          difference: 0,
          purchaseDate: "2023-01-10",
          bookValue: 400,
          condemnationReason: "Expired shelf life, unsafe for etching",
          remarks: "Requires hazmat disposal"
        }
      ],
      createdAt: "2026-07-25T14:30:00.000Z"
    }
  ],
  auditLogs: [
    {
      _id: "log-1",
      logId: "LOG-1001",
      timestamp: new Date().toISOString(),
      actor: "admin@assetmgmt.local",
      role: "Administrator",
      action: "SYSTEM_INITIALIZATION",
      resourceType: "System",
      resourceId: "SYS-001",
      details: { info: "Gateway demo environment started" },
      blockchainTxHash: "0x892a0194857bf" + Date.now()
    }
  ]
};

function buildDemoApiResponse(req) {
  const path = req.path || "";
  const method = req.method;
  const body = req.body || {};

  if (method === "GET") {
    if (path === "/audit-logs") {
      return { ok: true, data: mockDb.auditLogs, pagination: { page: 1, limit: 50, total: mockDb.auditLogs.length, pages: 1 } };
    }

    if (path === "/verification/equipment") {
      return { ok: true, data: mockDb.equipmentVerifications, pagination: { page: 1, limit: 50, total: mockDb.equipmentVerifications.length, pages: 1 } };
    }

    if (path === "/verification/equipment/condemnation") {
      return { ok: true, data: mockDb.equipmentCondemnations, pagination: { page: 1, limit: 50, total: mockDb.equipmentCondemnations.length, pages: 1 } };
    }

    if (path === "/verification/consumables") {
      return { ok: true, data: mockDb.consumableVerifications, pagination: { page: 1, limit: 50, total: mockDb.consumableVerifications.length, pages: 1 } };
    }

    if (path === "/verification/consumables/condemnation") {
      return { ok: true, data: mockDb.consumableCondemnations, pagination: { page: 1, limit: 50, total: mockDb.consumableCondemnations.length, pages: 1 } };
    }
    const isDeptUser = req.user && req.user.role === "DepartmentUser";
    const userDept = (req.user && req.user.department ? req.user.department : "").toUpperCase();

    if (path === "/dashboard") {
      const assets = isDeptUser && userDept ? mockDb.assets.filter(a => (a.department || "").toUpperCase() === userDept) : mockDb.assets;
      const bills = isDeptUser && userDept ? mockDb.bills.filter(b => { const a = mockDb.assets.find(ast => ast.assetId === b.assetId); return a && (a.department || "").toUpperCase() === userDept; }) : mockDb.bills;
      const maintenance = isDeptUser && userDept ? mockDb.maintenance.filter(m => { const a = mockDb.assets.find(ast => ast.assetId === m.assetId); return a && (a.department || "").toUpperCase() === userDept; }) : mockDb.maintenance;
      const condemnation = isDeptUser && userDept ? mockDb.condemnation.filter(c => { const a = mockDb.assets.find(ast => ast.assetId === c.assetId); return a && (a.department || "").toUpperCase() === userDept; }) : mockDb.condemnation;
      const transfers = isDeptUser && userDept ? mockDb.transfers.filter(t => (t.fromDepartment || "").toUpperCase() === userDept || (t.toDepartment || "").toUpperCase() === userDept) : mockDb.transfers;

      const totalAssets = assets.length;
      const activeAssets = assets.filter(a => a.status === "Active").length;
      const maintenanceAssets = assets.filter(a => a.status === "Maintenance").length;
      const condemnedAssets = assets.filter(a => a.status === "Condemned" || a.status === "CondemnationRequested").length;
      const disposedAssets = assets.filter(a => a.status === "Disposed").length;

      const deptSummary = {};
      assets.forEach(a => {
        deptSummary[a.department] = (deptSummary[a.department] || 0) + 1;
      });

      const statusSummary = {};
      assets.forEach(a => {
        statusSummary[a.status] = (statusSummary[a.status] || 0) + 1;
      });

      return {
        ok: true,
        data: {
          counts: {
            totalAssets,
            activeAssets,
            maintenanceAssets,
            condemnedAssets,
            disposedAssets,
            totalBills: bills.length,
            verifiedBills: bills.filter(b => b.verified).length,
            totalMaintenances: maintenance.length,
            totalCondemnationRequests: condemnation.length,
            totalTransfers: transfers.length
          },
          analytics: {
            assetStatus: statusSummary,
            departmentSummary: deptSummary
          },
          recentAssets: assets.slice(0, 5)
        }
      };
    }

    if (path === "/assets") {
      const assets = isDeptUser && userDept ? mockDb.assets.filter(a => (a.department || "").toUpperCase() === userDept) : mockDb.assets;
      return { ok: true, data: assets, pagination: { page: 1, limit: 50, total: assets.length, pages: 1 } };
    }

    if (path === "/departments") {
      const depts = isDeptUser && userDept ? mockDb.departments.filter(d => (d.code || "").toUpperCase() === userDept || (d.name || "").toUpperCase().includes(userDept)) : mockDb.departments;
      return { ok: true, data: depts };
    }

    if (path === "/users/pending" || path === "/api/users/pending") {
      return { ok: true, data: mockDb.pendingUsers || [] };
    }

    if (path === "/bills") {
      const bills = isDeptUser && userDept ? mockDb.bills.filter(b => { const a = mockDb.assets.find(ast => ast.assetId === b.assetId); return a && (a.department || "").toUpperCase() === userDept; }) : mockDb.bills;
      return { ok: true, data: bills };
    }

    if (path === "/maintenance") {
      const maintenance = isDeptUser && userDept ? mockDb.maintenance.filter(m => { const a = mockDb.assets.find(ast => ast.assetId === m.assetId); return a && (a.department || "").toUpperCase() === userDept; }) : mockDb.maintenance;
      return { ok: true, data: maintenance };
    }

    if (path === "/condemnation") {
      const condemnation = isDeptUser && userDept ? mockDb.condemnation.filter(c => { const a = mockDb.assets.find(ast => ast.assetId === c.assetId); return a && (a.department || "").toUpperCase() === userDept; }) : mockDb.condemnation;
      return { ok: true, data: condemnation };
    }

    if (path === "/transfers") {
      const transfers = isDeptUser && userDept ? mockDb.transfers.filter(t => (t.fromDepartment || "").toUpperCase() === userDept || (t.toDepartment || "").toUpperCase() === userDept) : mockDb.transfers;
      return { ok: true, data: transfers };
    }

    if (path === "/reports") {
      return { ok: true, data: mockDb.reports, pagination: { page: 1, limit: 20, total: mockDb.reports.length, pages: 1 } };
    }

    if (path === "/reports/financial") {
      const currentYear = new Date().getFullYear();
      const assets = isDeptUser && userDept ? mockDb.assets.filter(a => (a.department || "").toUpperCase() === userDept) : mockDb.assets;
      const financialData = assets.map(asset => {
        const purchaseYear = new Date(asset.purchaseDate || "2024-01-01").getFullYear();
        const ageYears = Math.max(0, currentYear - purchaseYear);
        const lifespan = asset.lifespanYears || 5;
        const annualDepreciation = asset.purchaseValue / lifespan;
        const accumulatedDepreciation = Math.min(asset.purchaseValue, annualDepreciation * ageYears);
        const currentValue = Math.max(0, asset.purchaseValue - accumulatedDepreciation);
        return {
          assetId: asset.assetId,
          name: asset.name,
          department: asset.department,
          purchaseValue: asset.purchaseValue,
          purchaseDate: asset.purchaseDate,
          lifespanYears: lifespan,
          annualDepreciation,
          accumulatedDepreciation,
          currentValue
        };
      });

      const totalValuation = financialData.reduce((acc, curr) => acc + curr.purchaseValue, 0);
      const totalCurrentValue = financialData.reduce((acc, curr) => acc + curr.currentValue, 0);

      return {
        ok: true,
        data: {
          totalValuation,
          totalCurrentValue,
          totalDepreciation: totalValuation - totalCurrentValue,
          assets: financialData
        }
      };
    }

    if (path.startsWith("/assets/") && path.endsWith("/history")) {
      const assetId = path.split("/")[2];
      const asset = mockDb.assets.find(a => a.assetId === assetId || a._id === assetId) || mockDb.assets[0];
      const timeline = [
        { event: "Asset Created", date: asset.createdAt || new Date().toISOString(), details: `Asset ${asset.assetId} registered in ${asset.department}` },
        { event: "Blockchain Anchor Logged", date: new Date().toISOString(), details: `Immutable ledger transaction hash ${asset.blockchainTxHash || "0x892a..."}` }
      ];
      return { ok: true, data: { asset, timeline } };
    }

    if (path.startsWith("/assets/")) {
      const assetId = path.split("/")[2];
      const asset = mockDb.assets.find(a => a.assetId === assetId || a._id === assetId);
      return { ok: true, data: asset || null };
    }
  }

const { generatePdfBuffer, generateExcelBuffer } = require("../backend/services/reportExportService");

    if (method === "DELETE") {
      if (path.startsWith("/departments/")) {
        const rawId = path.split("/")[2];
        const id = decodeURIComponent(rawId || "").toLowerCase().trim();
        const idx = mockDb.departments.findIndex(d =>
          String(d._id).toLowerCase() === id ||
          (d.code && d.code.toLowerCase() === id) ||
          (d.name && d.name.toLowerCase() === id)
        );
        let deleted = null;
        if (idx !== -1) {
          deleted = mockDb.departments.splice(idx, 1)[0];
        }
        return { ok: true, message: "Department deleted successfully", data: { department: deleted } };
      }
      if (path.startsWith("/assets/")) {
        const rawId = path.split("/")[2];
        const assetId = decodeURIComponent(rawId || "").toLowerCase().trim();
        const idx = mockDb.assets.findIndex(a =>
          String(a._id).toLowerCase() === assetId ||
          (a.assetId && a.assetId.toLowerCase() === assetId)
        );
        let deleted = null;
        if (idx !== -1) {
          deleted = mockDb.assets.splice(idx, 1)[0];
        }
        return { ok: true, message: `Asset ${deleted ? deleted.assetId : assetId} deleted`, data: { asset: deleted } };
      }
    }

  if (method === "POST") {
    if (path.includes("/users/") && path.endsWith("/approve")) {
      const parts = path.split("/").filter(Boolean);
      const rawUserId = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
      const userId = decodeURIComponent(rawUserId).toLowerCase().trim();
      const idx = (mockDb.pendingUsers || []).findIndex(u =>
        String(u._id).toLowerCase() === userId ||
        (u.email && u.email.toLowerCase() === userId) ||
        (u.name && u.name.toLowerCase() === userId)
      );
      if (idx !== -1) {
        const approved = mockDb.pendingUsers.splice(idx, 1)[0];
        approved.isApproved = true;
        approved.status = "Approved";
        if (!mockDb.approvedUsers) mockDb.approvedUsers = [];
        mockDb.approvedUsers.push(approved);
        return { ok: true, message: `User ${approved.email} approved successfully!`, data: approved };
      }
      return { ok: false, error: "Pending user not found" };
    }

    if (path.includes("/users/") && path.endsWith("/reject")) {
      const parts = path.split("/").filter(Boolean);
      const rawUserId = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
      const userId = decodeURIComponent(rawUserId).toLowerCase().trim();
      const idx = (mockDb.pendingUsers || []).findIndex(u =>
        String(u._id).toLowerCase() === userId ||
        (u.email && u.email.toLowerCase() === userId) ||
        (u.name && u.name.toLowerCase() === userId)
      );
      if (idx !== -1) {
        const rejected = mockDb.pendingUsers.splice(idx, 1)[0];
        rejected.isApproved = false;
        rejected.status = "Rejected";
        return { ok: true, message: `User ${rejected.email} registration rejected`, data: rejected };
      }
      return { ok: false, error: "Pending user not found" };
    }

    if (path === "/departments") {
      const existing = mockDb.departments.find(d => d.code === body.code);
      if (existing) return { ok: false, error: "Department code already exists" };
      const newDept = {
        _id: "dept-" + Date.now(),
        code: body.code,
        name: body.name,
        description: body.description || "",
        manager: body.manager || "",
        assetCount: 0,
        isActive: true
      };
      mockDb.departments.push(newDept);
      return { ok: true, data: newDept };
    }

    if (path === "/assets") {
      const existing = mockDb.assets.find(a => a.assetId === body.assetId);
      if (existing) return { ok: false, error: "Asset ID already exists" };
      const newAsset = {
        _id: "ast-" + Date.now(),
        assetId: body.assetId || `ASSET-${Math.floor(100 + Math.random() * 900)}`,
        name: body.name || "New Asset",
        category: body.category || "General",
        department: body.department || "IT",
        status: body.status || "Active",
        location: body.location || "Central Storage",
        purchaseDate: body.purchaseDate || new Date().toISOString().split("T")[0],
        purchaseValue: Number(body.purchaseValue || 1000),
        lifespanYears: Number(body.lifespanYears || 5),
        serialNumber: body.serialNumber || `SN-GEN-${Date.now().toString().slice(-4)}`,
        billHash: "0x" + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join(""),
        blockchainTxHash: "0x" + Array.from({length: 40}, () => Math.floor(Math.random()*16).toString(16)).join(""),
        createdAt: new Date().toISOString()
      };
      mockDb.assets.unshift(newAsset);
      return { ok: true, data: newAsset, message: "Asset registered successfully" };
    }

    if (path === "/maintenance") {
      const targetAsset = mockDb.assets.find(a => a.assetId === body.assetId);
      if (targetAsset && (targetAsset.status === "Condemned" || targetAsset.status === "Disposed")) {
        return { ok: false, error: "Cannot schedule maintenance for condemned or disposed asset" };
      }
      const newMaint = {
        _id: "maint-" + Date.now(),
        recordId: body.recordId || `MAINT-${Math.floor(700 + Math.random() * 200)}`,
        assetId: body.assetId,
        assetName: targetAsset ? targetAsset.name : body.assetId,
        technician: body.technician || "Authorized Technician",
        maintenanceDate: body.maintenanceDate || new Date().toISOString().split("T")[0],
        description: body.description || "Routine Scheduled Maintenance",
        cost: Number(body.cost || 0),
        status: body.status || "Scheduled",
        createdAt: new Date().toISOString()
      };
      mockDb.maintenance.unshift(newMaint);
      if (targetAsset) targetAsset.status = "Maintenance";
      return { ok: true, data: newMaint, message: "Maintenance record logged" };
    }

    if (path === "/condemnation") {
      const targetAsset = mockDb.assets.find(a => a.assetId === body.assetId);
      const newCond = {
        _id: "cond-" + Date.now(),
        recordId: body.recordId || `COND-${Math.floor(800 + Math.random() * 200)}`,
        assetId: body.assetId,
        assetName: targetAsset ? targetAsset.name : body.assetId,
        reason: body.reason || "Beyond economical repair",
        requestedBy: body.requestedBy || "Department Lead",
        inspectionDetails: body.inspectionDetails || "Technical evaluation completed",
        status: "Pending Approval",
        disposalMethod: body.disposalMethod || "Recycling",
        createdAt: new Date().toISOString()
      };
      mockDb.condemnation.unshift(newCond);
      if (targetAsset) targetAsset.status = "CondemnationRequested";
      return { ok: true, data: newCond, message: "Condemnation request submitted" };
    }

    if (path === "/transfers" || path.includes("/transfer")) {
      const assetId = body.assetId || (path.includes("/assets/") ? path.split("/")[2] : null);
      const targetAsset = mockDb.assets.find(a => a.assetId === assetId);
      const newTransfer = {
        _id: "trans-" + Date.now(),
        transferId: `TRANS-${Math.floor(900 + Math.random() * 100)}`,
        assetId: assetId,
        assetName: targetAsset ? targetAsset.name : assetId,
        fromDepartment: targetAsset ? targetAsset.department : body.fromDepartment || "IT",
        toDepartment: body.toDepartment || "OPS",
        requestedBy: body.requestedBy || "Asset Officer",
        reason: body.reason || "Reallocated per department request",
        status: "Completed",
        createdAt: new Date().toISOString()
      };
      mockDb.transfers.unshift(newTransfer);
      if (targetAsset) {
        targetAsset.department = body.toDepartment || targetAsset.department;
        if (body.newLocation) targetAsset.location = body.newLocation;
      }
      return { ok: true, data: newTransfer, message: "Asset transfer recorded" };
    }

    if (path === "/bills") {
      const existing = mockDb.bills.find(b => b.billId === body.billId);
      if (existing) return { ok: false, error: "Bill ID already exists" };
      const newBill = {
        _id: "bill-" + Date.now(),
        billId: body.billId || `BILL-${Math.floor(500 + Math.random() * 400)}`,
        assetId: body.assetId || "ASSET-101",
        vendor: body.vendor || "Approved Vendor",
        invoiceNumber: body.invoiceNumber || `INV-${Date.now().toString().slice(-5)}`,
        amount: Number(body.amount || 1500),
        documentHash: body.documentHash || body.billHash || ("0x" + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join("")),
        verified: true,
        paymentStatus: "Paid",
        createdAt: new Date().toISOString()
      };
      mockDb.bills.unshift(newBill);
      return { ok: true, data: newBill, message: "Bill uploaded & verified on chain" };
    }

    if (path.includes("/bills/") && path.endsWith("/verify")) {
      const billId = path.split("/")[2];
      const bill = mockDb.bills.find(b => b.billId === billId || b._id === billId);
      if (bill) {
        bill.verified = true;
        bill.verifiedAt = new Date().toISOString();
      }
      return {
        ok: true,
        data: {
          bill,
          verified: true,
          verifiedOnBlockchain: true,
          integrity: true
        }
      };
    }

    if (path === "/reports") {
      const newReport = {
        _id: "rep-" + Date.now(),
        reportId: `REP-${new Date().getFullYear()}`,
        year: Number(body.year || new Date().getFullYear()),
        totalAssets: mockDb.assets.length,
        totalPurchaseValue: mockDb.assets.reduce((acc, curr) => acc + curr.purchaseValue, 0),
        activeAssets: mockDb.assets.filter(a => a.status === "Active").length,
        maintenanceAssets: mockDb.assets.filter(a => a.status === "Maintenance").length,
        condemnedAssets: mockDb.assets.filter(a => a.status === "Condemned" || a.status === "CondemnationRequested").length,
        createdAt: new Date().toISOString()
      };
      mockDb.reports.unshift(newReport);
      return { ok: true, data: newReport, message: "Yearly audit report generated" };
    }

    if (path === "/verification/equipment") {
      const itemsArr = body.items || [];
      for (const i of itemsArr) {
        if ((i.bookStockPreviousYear !== undefined && Number(i.bookStockPreviousYear) < 0) ||
            (i.purchasedDuringYear !== undefined && Number(i.purchasedDuringYear) < 0) ||
            (i.actualPhysicalStock !== undefined && Number(i.actualPhysicalStock) < 0)) {
          return { ok: false, error: "Stock and quantity values cannot be negative" };
        }
      }
      const recordId = `EQV-${Date.now()}`;
      const items = itemsArr.map(i => {
        const bookCurrent = (Number(i.bookStockPreviousYear) || 0) + (Number(i.purchasedDuringYear) || 0);
        return {
          ...i,
          bookStockCurrentYear: bookCurrent,
          difference: bookCurrent - (Number(i.actualPhysicalStock) || 0)
        };
      });
      const newRec = {
        _id: "eqv-" + Date.now(),
        recordId,
        department: body.department || "IT",
        laboratory: body.laboratory || "Main Lab",
        stockBookNumber: body.stockBookNumber || "SB-2026",
        verificationDate: body.verificationDate || new Date().toISOString().split("T")[0],
        staffInCharge: body.staffInCharge || "Staff In-Charge",
        auditYear: Number(body.auditYear || new Date().getFullYear()),
        status: "Completed",
        items,
        remarks: body.remarks || "",
        createdAt: new Date().toISOString()
      };
      mockDb.equipmentVerifications.unshift(newRec);
      return { ok: true, data: newRec };
    }

    if (path === "/verification/equipment/condemnation") {
      const itemsArr = body.items || [];
      for (const i of itemsArr) {
        if ((i.quantity !== undefined && Number(i.quantity) < 0) ||
            (i.purchaseValue !== undefined && Number(i.purchaseValue) < 0) ||
            (i.bookValue !== undefined && Number(i.bookValue) < 0)) {
          return { ok: false, error: "Values cannot be negative" };
        }
      }
      const recordId = `EQC-${Date.now()}`;
      const newRec = {
        _id: "eqc-" + Date.now(),
        recordId,
        department: body.department || "IT",
        laboratory: body.laboratory || "Main Lab",
        stockBookNumber: body.stockBookNumber || "SB-2026",
        verificationDate: body.verificationDate || new Date().toISOString().split("T")[0],
        staffInCharge: body.staffInCharge || "Staff In-Charge",
        status: "Pending",
        items: itemsArr,
        remarks: body.remarks || "",
        createdAt: new Date().toISOString()
      };
      mockDb.equipmentCondemnations.unshift(newRec);
      return { ok: true, data: newRec };
    }

    if (path === "/verification/consumables") {
      const itemsArr = body.items || [];
      for (const i of itemsArr) {
        if ((i.previousStock !== undefined && Number(i.previousStock) < 0) ||
            (i.purchasedQuantity !== undefined && Number(i.purchasedQuantity) < 0) ||
            (i.consumedQuantity !== undefined && Number(i.consumedQuantity) < 0) ||
            (i.actualPhysicalStock !== undefined && Number(i.actualPhysicalStock) < 0)) {
          return { ok: false, error: "Stock and quantity values cannot be negative" };
        }
      }
      const recordId = `CNV-${Date.now()}`;
      const items = itemsArr.map(i => {
        const rem = (Number(i.previousStock) || 0) + (Number(i.purchasedQuantity) || 0) - (Number(i.consumedQuantity) || 0);
        return {
          ...i,
          remainingBookStock: rem,
          difference: rem - (Number(i.actualPhysicalStock) || 0)
        };
      });
      const newRec = {
        _id: "cnv-" + Date.now(),
        recordId,
        department: body.department || "IT",
        laboratory: body.laboratory || "Main Lab",
        stockBookNumber: body.stockBookNumber || "SB-CONS-2026",
        verificationDate: body.verificationDate || new Date().toISOString().split("T")[0],
        staffInCharge: body.staffInCharge || "Staff In-Charge",
        status: "Completed",
        items,
        remarks: body.remarks || "",
        createdAt: new Date().toISOString()
      };
      mockDb.consumableVerifications.unshift(newRec);
      return { ok: true, data: newRec };
    }

    if (path === "/verification/consumables/condemnation") {
      const recordId = `CNC-${Date.now()}`;
      const items = (body.items || []).map(i => ({
        ...i,
        difference: (Number(i.bookStock) || 0) - (Number(i.actualStock) || 0)
      }));
      const newRec = {
        _id: "cnc-" + Date.now(),
        recordId,
        department: body.department || "IT",
        laboratory: body.laboratory || "Main Lab",
        stockBookNumber: body.stockBookNumber || "SB-CONS-2026",
        verificationDate: body.verificationDate || new Date().toISOString().split("T")[0],
        staffInCharge: body.staffInCharge || "Staff In-Charge",
        status: "Pending",
        items,
        remarks: body.remarks || "",
        createdAt: new Date().toISOString()
      };
      mockDb.consumableCondemnations.unshift(newRec);
      return { ok: true, data: newRec };
    }
  }

  if (method === "PUT" || method === "PATCH") {
    if (path.startsWith("/departments/")) {
      const id = path.split("/")[2];
      const dept = mockDb.departments.find(d => d._id === id || d.code === id);
      if (dept) {
        if (body.name) dept.name = body.name;
        if (body.description) dept.description = body.description;
        if (body.manager) dept.manager = body.manager;
        if (body.code) dept.code = body.code;
      }
      return { ok: true, data: dept };
    }

    if (path.startsWith("/assets/")) {
      const assetId = path.split("/")[2];
      const asset = mockDb.assets.find(a => a.assetId === assetId || a._id === assetId);
      if (asset) {
        if (asset.status === "Disposed") {
          return { ok: false, error: "Disposed assets cannot be modified or re-activated" };
        }
        if (body.status && body.status !== asset.status && asset.status === "Condemned" && body.status === "Active") {
          return { ok: false, error: "Condemned asset cannot return to Active state" };
        }
        Object.assign(asset, body);
        asset.updatedAt = new Date().toISOString();
      }
      return { ok: true, data: asset };
    }

    if (path.includes("/verification/equipment/condemnation/") && path.endsWith("/approve")) {
      const recordId = path.split("/")[4];
      const record = mockDb.equipmentCondemnations.find(r => r.recordId === recordId || r._id === recordId);
      if (record) {
        record.status = "Approved";
        record.approvedBy = body.approvedBy || "Administrator";
        record.approvedAt = new Date().toISOString();
      }
      return { ok: true, data: record };
    }

    if (path.includes("/verification/equipment/condemnation/") && path.endsWith("/reject")) {
      const recordId = path.split("/")[4];
      const record = mockDb.equipmentCondemnations.find(r => r.recordId === recordId || r._id === recordId);
      if (record) {
        record.status = "Rejected";
        record.rejectedBy = body.rejectedBy || "Administrator";
        record.rejectedAt = new Date().toISOString();
      }
      return { ok: true, data: record };
    }

    if (path.includes("/verification/consumables/condemnation/") && path.endsWith("/approve")) {
      const recordId = path.split("/")[4];
      const record = mockDb.consumableCondemnations.find(r => r.recordId === recordId || r._id === recordId);
      if (record) {
        record.status = "Approved";
        record.approvedBy = body.approvedBy || "Administrator";
        record.approvedAt = new Date().toISOString();
      }
      return { ok: true, data: record };
    }

    if (path.includes("/verification/consumables/condemnation/") && path.endsWith("/reject")) {
      const recordId = path.split("/")[4];
      const record = mockDb.consumableCondemnations.find(r => r.recordId === recordId || r._id === recordId);
      if (record) {
        record.status = "Rejected";
        record.rejectedBy = body.rejectedBy || "Administrator";
        record.rejectedAt = new Date().toISOString();
      }
      return { ok: true, data: record };
    }

    if (path.includes("/condemnation/") && path.endsWith("/approve")) {
      const recordId = path.split("/")[2];
      const record = mockDb.condemnation.find(c => c.recordId === recordId || c._id === recordId);
      if (record) {
        record.status = "Approved";
        record.approvedBy = body.approvedBy || "Administrator";
        record.disposalMethod = body.disposalMethod || record.disposalMethod || "Recycling";
        record.approvedAt = new Date().toISOString();
        const asset = mockDb.assets.find(a => a.assetId === record.assetId);
        if (asset) asset.status = "Condemned";
      }
      return { ok: true, data: record, message: "Condemnation approved" };
    }

    if (path.includes("/condemnation/") && path.endsWith("/reject")) {
      const recordId = path.split("/")[2];
      const record = mockDb.condemnation.find(c => c.recordId === recordId || c._id === recordId);
      if (record) {
        record.status = "Rejected";
        record.rejectedBy = body.rejectedBy || "Administrator";
        record.rejectionReason = body.rejectionReason || "Request rejected";
        record.rejectedAt = new Date().toISOString();
        const asset = mockDb.assets.find(a => a.assetId === record.assetId);
        if (asset) asset.status = "Active";
      }
      return { ok: true, data: record, message: "Condemnation request rejected" };
    }

    if (path.includes("/maintenance/")) {
      const recordId = path.split("/")[2];
      const record = mockDb.maintenance.find(m => m.recordId === recordId || m._id === recordId);
      if (record) {
        record.status = body.status || "Completed";
        if (body.status === "Completed") {
          const asset = mockDb.assets.find(a => a.assetId === record.assetId);
          if (asset) asset.status = "Active";
        }
      }
      return { ok: true, data: record, message: "Maintenance record updated" };
    }
  }

  return { ok: true, data: null, message: "Success" };
}

app.get(["/api/reports/:reportId/export", "/reports/:reportId/export"], authenticate, async (req, res) => {
  try {
    const format = req.query.format || "pdf";
    const reportId = req.params.reportId;
    let reportData = null;

    const { generateYearlyReportOnFabric, getAllAssetsFromFabric } = require("../backend/services/fabricService");
    const reportRes = await generateYearlyReportOnFabric(new Date().getFullYear());
    const assetsRes = await getAllAssetsFromFabric();
    reportData = {
      reportId: reportId || `REP-${new Date().getFullYear()}`,
      ...(reportRes.result || {}),
      assetsList: assetsRes.assets || []
    };

    if (format === "excel") {
      const buffer = await generateExcelBuffer(reportData);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=${reportData.reportId}.xlsx`);
      return res.send(buffer);
    } else {
      const buffer = await generatePdfBuffer(reportData);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=${reportData.reportId}.pdf`);
      return res.send(buffer);
    }
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
    if (mongoConnection) {
      mongoConnection.close();
    }
    process.exit(0);
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);