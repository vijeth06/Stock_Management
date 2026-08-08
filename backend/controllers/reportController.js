const {
  generateYearlyReportOnFabric,
  getAllAssetsFromFabric,
  getAllBillsFromFabric,
  getAllMaintenanceRecordsFromFabric,
  getAllCondemnationRecordsFromFabric,
  getDepartmentValuationOnFabric
} = require("../services/fabricService");
const { generatePdfBuffer, generateExcelBuffer } = require("../services/reportExportService");

async function generateYearlyReport(req, res, next) {
  try {
    const { year, auditOfficer, auditPeriod } = req.body;
    const reportYear = Number(year || new Date().getFullYear());

    const fabricReportRes = await generateYearlyReportOnFabric(reportYear);
    const result = fabricReportRes.result || {};

    const report = {
      _id: `report-${Date.now()}`,
      reportId: `RPT-${reportYear}-${Date.now()}`,
      year: reportYear,
      auditDate: new Date().toISOString(),
      auditOfficer: auditOfficer || "Audit Officer",
      auditPeriod: auditPeriod || `FY ${reportYear}`,
      totalAssets: result.totalAssets || 0,
      totalPurchaseValue: result.totalPurchaseValue || 0,
      categorySummary: result.categorySummary || {},
      departmentSummary: result.departmentSummary || {},
      activeAssets: result.activeAssets || 0,
      maintenanceAssets: result.maintenanceAssets || 0,
      condemnedAssets: result.condemnedAssets || 0,
      disposedAssets: result.disposedAssets || 0,
      createdAt: new Date().toISOString()
    };

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
    const { year } = req.query;
    const reportYear = Number(year || new Date().getFullYear());
    const reportRes = await generateYearlyReportOnFabric(reportYear);
    const reportData = reportRes.result || {
      reportId: `RPT-${reportYear}-001`,
      year: reportYear,
      totalAssets: 0,
      totalPurchaseValue: 0
    };

    res.json({
      ok: true,
      data: [reportData],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 }
    });
  } catch (error) {
    next(error);
  }
}

async function getReport(req, res, next) {
  try {
    const reportYear = new Date().getFullYear();
    const reportRes = await generateYearlyReportOnFabric(reportYear);
    res.json({
      ok: true,
      data: reportRes.result || {}
    });
  } catch (error) {
    next(error);
  }
}

async function getDashboard(req, res, next) {
  try {
    const assetsRes = await getAllAssetsFromFabric();
    const billsRes = await getAllBillsFromFabric();
    const mntRes = await getAllMaintenanceRecordsFromFabric();
    const condRes = await getAllCondemnationRecordsFromFabric();

    let assets = assetsRes.assets || [];
    let bills = billsRes.bills || [];
    let maintenances = mntRes.records || [];
    let condemnations = condRes.records || [];

    const reqUser = req.user;
    if (reqUser && reqUser.role === "DepartmentUser" && reqUser.department) {
      const userDept = String(reqUser.department).toUpperCase();

      assets = assets.filter(a => (a.department || "").toUpperCase() === userDept);
      const billAssetIds = new Set(assets.map(a => a.assetId));
      bills = bills.filter(b => billAssetIds.has(b.assetId));

      const assetIds = new Set(assets.map(a => a.assetId));
      maintenances = maintenances.filter(m => assetIds.has(m.assetId));

      const condAssetIds = new Set(assets.map(a => a.assetId));
      condemnations = condemnations.filter(c => condAssetIds.has(c.assetId));
    }

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
      if (statusCounts[status] !== undefined) {
        statusCounts[status] += 1;
      } else {
        statusCounts.Other += 1;
      }
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
        totalCondemnationRequests: condemnations.length,
        totalTransfers: 0
      },
      analytics: {
        assetStatus: statusCounts,
        departmentSummary
      },
      recentAssets: assets.slice(0, 5).map(a => ({
        assetId: a.assetId,
        name: a.name,
        status: a.status,
        department: a.department
      }))
    };

    res.json({ ok: true, data: summary });
  } catch (error) {
    next(error);
  }
}

async function exportReport(req, res, next) {
  try {
    const { format = "pdf" } = req.query;
    const reportYear = new Date().getFullYear();
    const reportRes = await generateYearlyReportOnFabric(reportYear);
    const assetsRes = await getAllAssetsFromFabric();

    const reportData = {
      ...(reportRes.result || {}),
      assetsList: assetsRes.assets || []
    };

    if (format === "excel") {
      const buffer = await generateExcelBuffer(reportData);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=report-${reportYear}.xlsx`);
      return res.send(buffer);
    } else {
      const buffer = await generatePdfBuffer(reportData);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=report-${reportYear}.pdf`);
      return res.send(buffer);
    }
  } catch (error) {
    console.error("Export report error:", error);
    next(error);
  }
}

async function getAnnualSummary(req, res, next) {
  try {
    const { year } = req.params;
    const reportYear = Number(year || new Date().getFullYear());
    const reportRes = await generateYearlyReportOnFabric(reportYear);
    const billsRes = await getAllBillsFromFabric();

    const bills = billsRes.bills || [];
    const report = reportRes.result || {};

    res.json({
      ok: true,
      data: {
        ...report,
        totalBills: bills.length,
        totalBillValue: bills.reduce((sum, b) => sum + (Number(b.amount) || 0), 0)
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getFinancialReport(req, res, next) {
  try {
    const assetsRes = await getAllAssetsFromFabric();
    const assets = assetsRes.assets || [];
    const totalValuation = assets.reduce((sum, a) => sum + (Number(a.purchaseValue) || 0), 0);
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
  getFinancialReport,
  getDepartmentValuation
};

async function getDepartmentValuation(req, res, next) {
  try {
    const valuationRes = await getDepartmentValuationOnFabric();
    if (!valuationRes.success) {
      return res.status(500).json({ ok: false, error: valuationRes.error });
    }

    const reqUser = req.user;
    let valuation = valuationRes.valuation || {};

    if (reqUser && reqUser.role === "DepartmentUser" && reqUser.department) {
      const userDept = String(reqUser.department).toUpperCase();
      const filtered = {};
      for (const [key, val] of Object.entries(valuation)) {
        if (String(val.code || key).toUpperCase() === userDept) {
          filtered[key] = val;
        }
      }
      valuation = filtered;
    }

    res.json({ ok: true, data: valuation });
  } catch (err) {
    next(err);
  }
}