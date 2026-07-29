const AuditReport = require("../models/AuditReport");
const Asset = require("../models/Asset");
const Bill = require("../models/Bill");
const CondemnationRecord = require("../models/CondemnationRecord");
const MaintenanceRecord = require("../models/MaintenanceRecord");

async function generateYearlyReport(req, res, next) {
  try {
    const { year, auditOfficer, auditPeriod } = req.body;

    const assets = await Asset.find({});
    const bills = await Bill.find({});
    const condemations = await CondemnationRecord.find({ status: "Approved" });
    const maintenances = await MaintenanceRecord.find({});

    const totalAssets = assets.length;
    const totalPurchaseValue = assets.reduce((sum, a) => sum + (a.purchaseValue || 0), 0);

    const categorySummary = {};
    const departmentSummary = {};
    const activeAssets = assets.filter(a => a.status === "Active").length;
    const maintenanceAssets = assets.filter(a => a.status === "Maintenance").length;
    const condemnedAssets = assets.filter(a => a.status === "Condemned").length;
    const disposedAssets = assets.filter(a => a.status === "Disposed" || a.status === "Retired").length;

    assets.forEach(asset => {
      if (asset.category) {
        categorySummary[asset.category] = {
          count: (categorySummary[asset.category]?.count || 0) + 1,
          totalValue: (categorySummary[asset.category]?.totalValue || 0) + (asset.purchaseValue || 0)
        };
      }
      if (asset.department) {
        departmentSummary[asset.department] = {
          count: (departmentSummary[asset.department]?.count || 0) + 1,
          totalValue: (departmentSummary[asset.department]?.totalValue || 0) + (asset.purchaseValue || 0)
        };
      }
    });

    const report = await AuditReport.create({
      reportId: `RPT-${year}-${Date.now()}`,
      year,
      auditDate: new Date(),
      auditOfficer,
      auditPeriod,
      totalAssets,
      totalPurchaseValue,
      categorySummary,
      departmentSummary,
      activeAssets,
      maintenanceAssets,
      condemnedAssets,
      disposedAssets
    });

    res.status(201).json({
      ok: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
}

async function getReports(req, res, next) {
  try {
    const { year, status, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (year) filter.year = Number(year);
    if (status) filter.status = status;

    const skip = (page - 1) * limit;
    const reports = await AuditReport.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await AuditReport.countDocuments(filter);

    res.json({
      ok: true,
      data: reports,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getReport(req, res, next) {
  try {
    const report = await AuditReport.findOne({ reportId: req.params.reportId });
    if (!report) {
      return res.status(404).json({ ok: false, error: "Report not found" });
    }
    res.json({
      ok: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
}

async function getDashboard(req, res, next) {
  try {
    const assets = await Asset.find({});
    const bills = await Bill.find({});
    const maintenances = await MaintenanceRecord.find({});
    const condemnations = await CondemnationRecord.find({ status: { $in: ["Pending", "Approved", "Rejected"] } });

    const statusCounts = {
      Active: 0,
      Maintenance: 0,
      Condemned: 0,
      Disposed: 0,
      Retired: 0,
      Other: 0
    };
    const departmentSummary = {};

    assets.forEach(asset => {
      const status = asset.status || "Other";
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      if (asset.department) {
        departmentSummary[asset.department] = (departmentSummary[asset.department] || 0) + 1;
      }
    });

    const summary = {
      counts: {
        totalAssets: assets.length,
        activeAssets: statusCounts.Active,
        maintenanceAssets: statusCounts.Maintenance,
        condemnedAssets: statusCounts.Condemned,
        disposedAssets: statusCounts.Disposed + statusCounts.Retired,
        totalBills: bills.length,
        verifiedBills: bills.filter(b => b.verified).length,
        totalMaintenances: maintenances.length,
        totalCondemnationRequests: condemnations.length
      },
      analytics: {
        assetStatus: statusCounts,
        departmentSummary
      },
      recentAssets: assets
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, 5)
        .map(asset => ({ assetId: asset.assetId, name: asset.name, status: asset.status, department: asset.department }))
    };

    res.json({ ok: true, data: summary });
  } catch (error) {
    next(error);
  }
}

const { generatePdfBuffer, generateExcelBuffer } = require("../services/reportExportService");

async function exportReport(req, res, next) {
  try {
    const { format = "pdf" } = req.query;
    const report = await AuditReport.findOne({ reportId: req.params.reportId });

    if (!report) {
      return res.status(404).json({ ok: false, error: "Report not found" });
    }

    const assetsList = await Asset.find({});
    const reportData = {
      ...report.toObject(),
      assetsList
    };

    if (format === "excel") {
      const buffer = await generateExcelBuffer(reportData);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=${report.reportId}.xlsx`);
      return res.send(buffer);
    } else {
      const buffer = await generatePdfBuffer(reportData);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=${report.reportId}.pdf`);
      return res.send(buffer);
    }
  } catch (error) {
    next(error);
  }
}

async function getAnnualSummary(req, res, next) {
  try {
    const { year } = req.params;

    const assets = await Asset.find({});
    const bills = await Bill.find({});
    const maintenances = await MaintenanceRecord.find({});
    const condemations = await CondemnationRecord.find({ status: "Approved" });

    const summary = {
      year,
      totalAssets: assets.length,
      totalPurchaseValue: assets.reduce((sum, a) => sum + (a.purchaseValue || 0), 0),
      categorySummary: {},
      departmentSummary: {},
      activeAssets: assets.filter(a => a.status === "Active").length,
      maintenanceAssets: assets.filter(a => a.status === "Maintenance").length,
      maintenanceCount: maintenances.length,
      condemnedAssets: assets.filter(a => a.status === "Condemned").length,
      condemnedCount: condemations.length,
      disposedAssets: assets.filter(a => a.status === "Disposed" || a.status === "Retired").length,
      totalBills: bills.length,
      totalBillValue: bills.reduce((sum, b) => sum + (b.totalAmount || 0), 0)
    };

    assets.forEach(asset => {
      if (asset.category) {
        summary.categorySummary[asset.category] = (summary.categorySummary[asset.category] || 0) + 1;
      }
      if (asset.department) {
        summary.departmentSummary[asset.department] = (summary.departmentSummary[asset.department] || 0) + 1;
      }
    });

    res.json({
      ok: true,
      data: summary
    });
  } catch (error) {
    next(error);
  }
}

async function getFinancialReport(req, res, next) {
  try {
    const assets = await Asset.find({});
    const totalValuation = assets.reduce((sum, a) => sum + (a.purchaseValue || 0), 0);
    const netBookValue = totalValuation * 0.7;
    res.json({
      ok: true,
      data: {
        totalValuation,
        netBookValue,
        depreciationMethod: "Straight-Line",
        assetCount: assets.length
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  generateYearlyReport,
  getReports,
  getReport,
  getDashboard,
  exportReport,
  getAnnualSummary,
  getFinancialReport
};