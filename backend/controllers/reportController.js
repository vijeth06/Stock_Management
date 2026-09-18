const {
  generateYearlyReportOnFabric,
  getAllAssetsFromFabric,
  getAllBillsFromFabric,
  getAllMaintenanceRecordsFromFabric,
  getAllCondemnationRecordsFromFabric,
  getDepartmentValuationOnFabric,
  getAllEquipmentVerificationsFromFabric,
  getAllEquipmentCondemnationsFromFabric,
  getAllConsumableVerificationsFromFabric,
  getAllConsumableCondemnationsFromFabric,
  getAllConsumablesFromFabric,
  getAllTransfersFromFabric
} = require("../services/fabricService");
const { generatePdfBuffer, generateExcelBuffer, generateFinancialReportPdf, generateFinancialReportExcel, generateValuationPdf, generateValuationExcel, generateProformaIPdf, generateProformaIExcel, generateProformaIIPdf, generateProformaIIIPdf, generateProformaIVPdf, generateProformaIIExcel, generateProformaIIIExcel, generateProformaIVExcel } = require("../services/reportExportService");

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

    // Record AUDIT_COMPLETED event on blockchain
    try {
      await require('../services/fabricService').recordAuditEventOnFabric({
        event: 'AUDIT_COMPLETED',
        reportId: report.reportId,
        year: reportYear,
        auditOfficer: auditOfficer || 'Administrator',
        auditPeriod: auditPeriod || `FY ${reportYear}`,
        totalAssets: report.totalAssets,
        activeAssets: report.activeAssets,
        condemnedAssets: report.condemnedAssets,
        disposedAssets: report.disposedAssets,
        department: 'ALL',
        createdAt: new Date().toISOString()
      });
    } catch (auditErr) {
      console.warn('Failed to record AUDIT_COMPLETED on blockchain:', auditErr.message);
    }
  } catch (error) {
    next(error);
  }
}

async function getReports(req, res, next) {
  try {
    const { year } = req.query;
    const reportYear = Number(year || new Date().getFullYear());
    const reportRes = await generateYearlyReportOnFabric(reportYear);
    let reportData = reportRes.result || {
      reportId: `RPT-${reportYear}-001`,
      year: reportYear,
      totalAssets: 0,
      totalPurchaseValue: 0
    };

    // Filter for DepartmentUser
    if (req.user && req.user.role === "DepartmentUser" && req.user.department && req.user.department !== "ALL") {
      const assetsRes = await getAllAssetsFromFabric();
      const userDept = String(req.user.department).toUpperCase();
      const filteredAssets = assetsRes.assets || [];
      const deptAssets = filteredAssets.filter(a => (a.department || '').toUpperCase() === userDept);
      reportData = {
        ...reportData,
        totalAssets: deptAssets.length,
        totalPurchaseValue: deptAssets.reduce((sum, a) => sum + (Number(a.purchaseValue) || 0), 0),
        activeAssets: deptAssets.filter(a => ['ACTIVE', 'PURCHASED'].includes(String(a.status || '').toUpperCase())).length,
        maintenanceAssets: deptAssets.filter(a => ['UNDER_MAINTENANCE', 'MAINTENANCE', 'IN_MAINTENANCE'].includes(String(a.status || '').toUpperCase())).length,
        condemnedAssets: deptAssets.filter(a => ['CONDEMNED', 'CONDEMNATION_REQUESTED'].includes(String(a.status || '').toUpperCase())).length,
        disposedAssets: deptAssets.filter(a => ['DISPOSED', 'RETIRED'].includes(String(a.status || '').toUpperCase())).length,
        categorySummary: {},
        departmentSummary: {}
      };
      deptAssets.forEach(a => {
        const cat = a.category || 'Unknown';
        if (!reportData.categorySummary[cat]) reportData.categorySummary[cat] = 0;
        reportData.categorySummary[cat] += 1;
        const dept = a.department || 'Unknown';
        if (!reportData.departmentSummary[dept]) reportData.departmentSummary[dept] = 0;
        reportData.departmentSummary[dept] += 1;
      });
    }

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
    let reportData = reportRes.result || {};

    // Filter for DepartmentUser
    if (req.user && req.user.role === "DepartmentUser" && req.user.department && req.user.department !== "ALL") {
      const assetsRes = await getAllAssetsFromFabric();
      const userDept = String(req.user.department).toUpperCase();
      const deptAssets = (assetsRes.assets || []).filter(a => (a.department || '').toUpperCase() === userDept);
      reportData = {
        ...reportData,
        totalAssets: deptAssets.length,
        totalPurchaseValue: deptAssets.reduce((sum, a) => sum + (Number(a.purchaseValue) || 0), 0),
        activeAssets: deptAssets.filter(a => ['ACTIVE', 'PURCHASED'].includes(String(a.status || '').toUpperCase())).length,
        maintenanceAssets: deptAssets.filter(a => ['UNDER_MAINTENANCE', 'MAINTENANCE', 'IN_MAINTENANCE'].includes(String(a.status || '').toUpperCase())).length,
        condemnedAssets: deptAssets.filter(a => ['CONDEMNED', 'CONDEMNATION_REQUESTED'].includes(String(a.status || '').toUpperCase())).length,
        disposedAssets: deptAssets.filter(a => ['DISPOSED', 'RETIRED'].includes(String(a.status || '').toUpperCase())).length
      };
    }

    res.json({
      ok: true,
      data: reportData
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
    const consumablesRes = await getAllConsumablesFromFabric();
    const verificationsRes = await getAllEquipmentVerificationsFromFabric();
    const evCondRes = await getAllEquipmentCondemnationsFromFabric();
    const cvRes = await getAllConsumableVerificationsFromFabric();
    let trRes = { transfers: [] };
    try {
        const trResult = await getAllTransfersFromFabric();
        trRes = trResult;
    } catch(e) {}

    let assets = assetsRes.assets || [];
    let bills = billsRes.bills || [];
    let maintenances = mntRes.records || [];
    let condemnations = condRes.records || [];
    let consumables = consumablesRes.success ? (consumablesRes.consumables || []) : [];
    let verifications = verificationsRes.records || [];

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
      consumables = consumables.filter(c => (c.department || "").toUpperCase() === userDept);

      // Filter verification-based records by department
      const evConds = evCondRes.records || [];
      const evCondDeptFiltered = evConds.filter(r => {
        if (r.department && String(r.department).toUpperCase() === userDept) return true;
        const asset = assets.find(a => a.assetId === r.assetId);
        return asset !== undefined;
      });
      const cvConds = cvRes.records || [];
      const cvCondDeptFiltered = cvConds.filter(r => (r.department || "").toUpperCase() === userDept);

      // Filter transfers by department
      const trTransfers = trRes.transfers || [];
      const trDeptFiltered = trTransfers.filter(t => {
        const fromDept = String(t.fromDepartment || '').toUpperCase();
        const toDept = String(t.toDepartment || '').toUpperCase();
        return fromDept === userDept || toDept === userDept;
      });

      evCondRes.records = evCondDeptFiltered;
      cvRes.records = cvCondDeptFiltered;
      trRes.transfers = trDeptFiltered;
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

    const normalizeStatus = (status) => {
      const s = String(status || "").toUpperCase().trim();
      if (s === 'ACTIVE' || s === 'IN USE' || s === 'IN_USE') return 'Active';
      if (s === 'UNDER_MAINTENANCE' || s === 'MAINTENANCE' || s === 'IN MAINTENANCE' || s === 'IN_MAINTENANCE') return 'Maintenance';
      if (s === 'CONDEMNED' || s === 'CONDEMNATION_REQUESTED' || s === 'CONDEMNATION APPROVED') return 'Condemned';
      if (s === 'DISPOSED' || s === 'DISPOSAL') return 'Disposed';
      if (s === 'RETIRED' || s === 'RETIREMENT_REQUESTED' || s === 'RETIREMENT REQUESTED') return 'Retired';
      if (s === 'PUCHASED' || s === 'PURCHASED') return 'Active';
      return 'Other';
    };

    assets.forEach(asset => {
      const normStatus = normalizeStatus(asset.status || 'Other');
      if (statusCounts[normStatus] !== undefined) {
        statusCounts[normStatus] += 1;
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
        totalCondemnationRequests: (evCondRes.records || []).length,
        totalTransfers: trRes.transfers ? trRes.transfers.length : 0,
        totalConsumables: consumables.length,
        lowStockConsumables: consumables.filter(c => (c.currentStock || 0) <= 0).length,
        totalConsumableVerifications: cvRes.records ? cvRes.records.length : (verificationsRes.records || []).length,
        pendingCondemnationRequests: (evCondRes.records || []).filter(c => c.status === 'Pending' || c.status === 'Pending Approval').length
      },
      analytics: {
        assetStatus: statusCounts,
        departmentSummary,
        consumableStock: {
          total: consumables.length,
          lowStock: consumables.filter(c => (c.currentStock || 0) <= 0).length,
          healthyStock: consumables.filter(c => (c.currentStock || 0) > 0).length
        }
      },
      recentAssets: assets.slice(0, 5).map(a => ({
        assetId: a.assetId,
        name: a.name,
        status: a.status,
        department: a.department
      }))
     };

     summary.financialSummary = {
       totalValuation: assets.reduce((sum, a) => sum + (Number(a.purchaseValue) || 0), 0),
       netBookValue: assets.reduce((sum, a) => sum + (Number(a.purchaseValue) || 0), 0) * 0.7,
       assetCount: assets.length,
       depreciationMethod: "Straight-Line"
     };

     res.json({
       ok: true,
       data: summary
     });
  } catch (error) {
    next(error);
  }
}

async function exportReport(req, res, next) {
  const { reportId } = req.params;
  if (reportId === "financial" || reportId === "department-valuation") {
    return res.status(404).json({ ok: false, error: "Not found" });
  }
  try {
    const { format = "pdf" } = req.query;
    const reportYear = new Date().getFullYear();

    const reportRes = await generateYearlyReportOnFabric(reportYear);
    const assetsRes = await getAllAssetsFromFabric();
    const billsRes = await getAllBillsFromFabric();
    const mntRes = await getAllMaintenanceRecordsFromFabric();
    const valuationRes = await getDepartmentValuationOnFabric();
    const transfersRes = await getAllTransfersFromFabric();
    const consumablesRes = await getAllConsumablesFromFabric();
    const condemnationRes = await getAllCondemnationRecordsFromFabric();

    const assets = assetsRes.assets || [];

    // Filter by department for DepartmentUser
    let filteredAssets = assets;
    let filteredBills = billsRes.bills || [];
    let filteredMaintenance = mntRes.records || [];
    let filteredTransfers = transfersRes.transfers || [];

    if (req.user && req.user.role === "DepartmentUser" && req.user.department && req.user.department !== "ALL") {
      const userDept = String(req.user.department).toUpperCase();
      filteredAssets = assets.filter(a => (a.department || '').toUpperCase() === userDept);
      const assetIds = new Set(filteredAssets.map(a => a.assetId));
      filteredBills = billsRes.bills.filter(b => assetIds.has(b.assetId));
      filteredMaintenance = mntRes.records.filter(m => assetIds.has(m.assetId));
      filteredTransfers = transfersRes.transfers.filter(t => {
        const fromDept = String(t.fromDepartment || '').toUpperCase();
        const toDept = String(t.toDepartment || '').toUpperCase();
        return fromDept === userDept || toDept === userDept;
      });
    }

    const deptSummary = {};
    filteredAssets.forEach(asset => {
      const dept = asset.department || 'Unknown';
      if (!deptSummary[dept]) {
        deptSummary[dept] = { totalAssets: 0, totalPurchaseValue: 0, activeAssets: 0, maintenanceAssets: 0, condemnedAssets: 0, disposedAssets: 0 };
      }
      deptSummary[dept].totalAssets += 1;
      deptSummary[dept].totalPurchaseValue += Number(asset.purchaseValue) || 0;
      const normStatus = String(asset.status || '').toUpperCase();
      if (normStatus === 'ACTIVE' || normStatus === 'PURCHASED') deptSummary[dept].activeAssets += 1;
      if (normStatus === 'UNDER_MAINTENANCE' || normStatus === 'MAINTENANCE' || normStatus === 'IN_MAINTENANCE') deptSummary[dept].maintenanceAssets += 1;
      if (normStatus === 'CONDEMNED' || normStatus === 'CONDEMNATION_REQUESTED') deptSummary[dept].condemnedAssets += 1;
      if (normStatus === 'DISPOSED' || normStatus === 'RETIRED') deptSummary[dept].disposedAssets += 1;
    });

    const reportData = {
      ...(reportRes.result || {}),
      reportId: (reportRes.result && reportRes.result.reportId) || `RPT-${reportYear}-${Date.now()}`,
      year: reportYear,
      auditOfficer: req.user?.name || req.user?.email || 'Administrator',
      auditPeriod: `FY ${reportYear}`,
      totalAssets: filteredAssets.length,
      totalPurchaseValue: filteredAssets.reduce((sum, a) => sum + (Number(a.purchaseValue) || 0), 0),
      activeAssets: filteredAssets.filter(a => ['ACTIVE', 'PURCHASED'].includes(String(a.status || '').toUpperCase())).length,
      maintenanceAssets: filteredAssets.filter(a => ['UNDER_MAINTENANCE', 'MAINTENANCE', 'IN_MAINTENANCE'].includes(String(a.status || '').toUpperCase())).length,
      condemnedAssets: filteredAssets.filter(a => ['CONDEMNED', 'CONDEMNATION_REQUESTED'].includes(String(a.status || '').toUpperCase())).length,
      disposedAssets: filteredAssets.filter(a => ['DISPOSED', 'RETIRED'].includes(String(a.status || '').toUpperCase())).length,
      totalBills: filteredBills.length,
      totalBillValue: filteredBills.reduce((sum, b) => sum + (Number(b.amount) || 0), 0),
      totalMaintenance: filteredMaintenance.length,
      totalMaintenanceCost: filteredMaintenance.reduce((sum, m) => sum + (Number(m.cost) || 0), 0),
      totalTransfers: filteredTransfers.length,
      departmentSummary: deptSummary,
      valuationData: valuationRes.valuation || {},
      assetsList: filteredAssets,
      billsList: filteredBills,
      maintenanceList: filteredMaintenance,
      transfersList: filteredTransfers,
      consumablesList: consumablesRes.consumables || [],
      condemnationList: condemnationRes.records || [],
      generatedAt: new Date().toISOString()
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

    let bills = billsRes.bills || [];
    let assets = [];
    const assetsRes = await getAllAssetsFromFabric();
    assets = assetsRes.assets || [];

    const reqUser = req.user;
    if (reqUser && reqUser.role === "DepartmentUser" && reqUser.department && reqUser.department !== "ALL") {
      const userDept = String(reqUser.department).toUpperCase();
      assets = assets.filter(a => (a.department || '').toUpperCase() === userDept);
      const assetIds = new Set(assets.map(a => a.assetId));
      bills = bills.filter(b => assetIds.has(b.assetId));
    }

    const report = reportRes.result || {};

    if (reqUser && reqUser.role === "DepartmentUser" && reqUser.department && reqUser.department !== "ALL") {
      const userDept = String(reqUser.department).toUpperCase();
      const deptAssets = assets;
      const deptSummary = {};
      deptAssets.forEach(asset => {
        const normStatus = String(asset.status || '').toUpperCase();
        if (!deptSummary[asset.department]) {
          deptSummary[asset.department] = { totalAssets: 0, totalPurchaseValue: 0, activeAssets: 0, maintenanceAssets: 0, condemnedAssets: 0, disposedAssets: 0 };
        }
        const s = deptSummary[asset.department];
        s.totalAssets += 1;
        s.totalPurchaseValue += Number(asset.purchaseValue) || 0;
        if (['ACTIVE', 'PURCHASED'].includes(normStatus)) s.activeAssets += 1;
        if (['UNDER_MAINTENANCE', 'MAINTENANCE', 'IN_MAINTENANCE'].includes(normStatus)) s.maintenanceAssets += 1;
        if (['CONDEMNED', 'CONDEMNATION_REQUESTED'].includes(normStatus)) s.condemnedAssets += 1;
        if (['DISPOSED', 'RETIRED'].includes(normStatus)) s.disposedAssets += 1;
      });

      res.json({
        ok: true,
        data: {
          ...report,
          totalAssets: deptAssets.length,
          totalPurchaseValue: deptAssets.reduce((sum, a) => sum + (Number(a.purchaseValue) || 0), 0),
          activeAssets: deptAssets.filter(a => ['ACTIVE', 'PURCHASED'].includes(String(a.status || '').toUpperCase())).length,
          maintenanceAssets: deptAssets.filter(a => ['UNDER_MAINTENANCE', 'MAINTENANCE', 'IN_MAINTENANCE'].includes(String(a.status || '').toUpperCase())).length,
          condemnedAssets: deptAssets.filter(a => ['CONDEMNED', 'CONDEMNATION_REQUESTED'].includes(String(a.status || '').toUpperCase())).length,
          disposedAssets: deptAssets.filter(a => ['DISPOSED', 'RETIRED'].includes(String(a.status || '').toUpperCase())).length,
          categorySummary: (() => {
            const cats = {};
            deptAssets.forEach(a => {
              const cat = a.category || 'Unknown';
              cats[cat] = (cats[cat] || 0) + 1;
            });
            return cats;
          })(),
          totalBills: bills.length,
          totalBillValue: bills.reduce((sum, b) => sum + (Number(b.amount) || 0), 0),
          departmentSummary: deptSummary,
          reportId: report.reportId || `RPT-${reportYear}`,
          year: reportYear
        }
      });
    } else {
      res.json({
        ok: true,
        data: {
          ...report,
          totalBills: bills.length,
          totalBillValue: bills.reduce((sum, b) => sum + (Number(b.amount) || 0), 0)
        }
      });
    }
  } catch (error) {
    next(error);
  }
}

async function getFinancialReport(req, res, next) {
  try {
    const assetsRes = await getAllAssetsFromFabric();
    let assets = assetsRes.assets || [];

    if (req.user && req.user.role === "DepartmentUser" && req.user.department && req.user.department !== "ALL") {
      const userDept = String(req.user.department).toUpperCase();
      assets = assets.filter(a => (a.department || '').toUpperCase() === userDept);
    }

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

async function exportFinancialReportPdf(req, res, next) {
  try {
    const { format = "pdf" } = req.query;
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
  } catch (err) {
    next(err);
  }
}

async function exportFullYearlyReport(req, res, next) {
  try {
    const { year, format = "pdf" } = req.query;
    const reportYear = Number(year || new Date().getFullYear());
   

    const reportRes = await generateYearlyReportOnFabric(reportYear);
    const assetsRes = await getAllAssetsFromFabric();
    const billsRes = await getAllBillsFromFabric();
    const mntRes = await getAllMaintenanceRecordsFromFabric();
    const valuationRes = await getDepartmentValuationOnFabric();
    const transfersRes = await getAllTransfersFromFabric();
    const consumablesRes = await getAllConsumablesFromFabric();
    const condemnationRes = await getAllCondemnationRecordsFromFabric();

    const assets = assetsRes.assets || [];

    // Filter by department for DepartmentUser
    let filteredAssets = assets;
    let filteredBills = billsRes.bills || [];
    let filteredMaintenance = mntRes.records || [];
    let filteredTransfers = transfersRes.transfers || [];

    if (req.user && req.user.role === "DepartmentUser" && req.user.department && req.user.department !== "ALL") {
      const userDept = String(req.user.department).toUpperCase();
      filteredAssets = assets.filter(a => (a.department || '').toUpperCase() === userDept);
      const assetIds = new Set(filteredAssets.map(a => a.assetId));
      filteredBills = billsRes.bills.filter(b => assetIds.has(b.assetId));
      filteredMaintenance = mntRes.records.filter(m => assetIds.has(m.assetId));
      filteredTransfers = transfersRes.transfers.filter(t => {
        const fromDept = String(t.fromDepartment || '').toUpperCase();
        const toDept = String(t.toDepartment || '').toUpperCase();
        return fromDept === userDept || toDept === userDept;
      });
    }

    const deptSummary = {};
    filteredAssets.forEach(asset => {
      const dept = asset.department || 'Unknown';
      if (!deptSummary[dept]) {
        deptSummary[dept] = { totalAssets: 0, totalPurchaseValue: 0, activeAssets: 0, maintenanceAssets: 0, condemnedAssets: 0, disposedAssets: 0 };
      }
      deptSummary[dept].totalAssets += 1;
      deptSummary[dept].totalPurchaseValue += Number(asset.purchaseValue) || 0;
      const normStatus = String(asset.status || '').toUpperCase();
      if (normStatus === 'ACTIVE' || normStatus === 'PURCHASED') deptSummary[dept].activeAssets += 1;
      if (normStatus === 'UNDER_MAINTENANCE' || normStatus === 'MAINTENANCE' || normStatus === 'IN_MAINTENANCE') deptSummary[dept].maintenanceAssets += 1;
      if (normStatus === 'CONDEMNED' || normStatus === 'CONDEMNATION_REQUESTED') deptSummary[dept].condemnedAssets += 1;
      if (normStatus === 'DISPOSED' || normStatus === 'RETIRED') deptSummary[dept].disposedAssets += 1;
    });

    const reportData = {
      ...(reportRes.result || {}),
      reportId: (reportRes.result && reportRes.result.reportId) || `RPT-${reportYear}-${Date.now()}`,
      year: reportYear,
      auditOfficer: req.user?.name || req.user?.email || 'Administrator',
      auditPeriod: `FY ${reportYear}`,
      totalAssets: filteredAssets.length,
      totalPurchaseValue: filteredAssets.reduce((sum, a) => sum + (Number(a.purchaseValue) || 0), 0),
      activeAssets: filteredAssets.filter(a => ['ACTIVE', 'PURCHASED'].includes(String(a.status || '').toUpperCase())).length,
      maintenanceAssets: filteredAssets.filter(a => ['UNDER_MAINTENANCE', 'MAINTENANCE', 'IN_MAINTENANCE'].includes(String(a.status || '').toUpperCase())).length,
      condemnedAssets: filteredAssets.filter(a => ['CONDEMNED', 'CONDEMNATION_REQUESTED'].includes(String(a.status || '').toUpperCase())).length,
      disposedAssets: filteredAssets.filter(a => ['DISPOSED', 'RETIRED'].includes(String(a.status || '').toUpperCase())).length,
      totalBills: filteredBills.length,
      totalBillValue: filteredBills.reduce((sum, b) => sum + (Number(b.amount) || 0), 0),
      totalMaintenance: filteredMaintenance.length,
      totalMaintenanceCost: filteredMaintenance.reduce((sum, m) => sum + (Number(m.cost) || 0), 0),
      totalTransfers: filteredTransfers.length,
      departmentSummary: deptSummary,
      valuationData: valuationRes.valuation || {},
      assetsList: filteredAssets,
      billsList: filteredBills,
      maintenanceList: filteredMaintenance,
      transfersList: filteredTransfers,
      consumablesList: consumablesRes.consumables || [],
      condemnationList: condemnationRes.records || [],
      generatedAt: new Date().toISOString()
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
    console.error("Export yearly report error:", error);
    next(error);
  }
}

module.exports = {
  generateYearlyReport,
  exportReport,
  exportFullYearlyReport,
  exportFinancialReportPdf,
  exportValuationPdf,
  getReports,
  getReport,
  getDashboard,
  getAnnualSummary,
  getFinancialReport,
  getDepartmentValuation,
  exportEquipmentVerificationReport,
  exportEquipmentCondemnationReport,
  exportConsumableVerificationReport,
  exportConsumableCondemnationReport
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

async function exportValuationPdf(req, res, next) {
  try {
    const { format = "pdf" } = req.query;
    const valuationRes = await getDepartmentValuationOnFabric();
    if (!valuationRes.success) {
      return res.status(500).json({ ok: false, error: valuationRes.error });
    }

    let valuation = valuationRes.valuation || {};

    // Department access control
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
  } catch (err) {
    next(err);
  }
}

async function exportEquipmentVerificationReport(req, res, next) {
  try {
    const { recordId } = req.params;
    const { format = "pdf" } = req.query;
    const fabRes = await getAllEquipmentVerificationsFromFabric();
    let items = fabRes.records || [];
    let record = items.find(i => i.recordId === recordId || i._id === recordId);

    if (!record) {
      return res.status(404).json({ ok: false, error: "Proforma-I record not found" });
    }

    // Department access check
    if (req.user && req.user.role === "DepartmentUser" && req.user.department) {
      const userDept = String(req.user.department).toUpperCase();
      if (record.department && String(record.department).toUpperCase() !== userDept) {
        return res.status(403).json({ ok: false, error: "Access denied" });
      }
    }

    const buffer = await generateProformaIPdf(record);
    if (format === "excel") {
      const xlsxBuffer = await generateProformaIExcel(record);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=proforma-I-${recordId}.xlsx`);
      return res.send(xlsxBuffer);
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=proforma-I-${recordId}.pdf`);
    return res.send(buffer);
  } catch (err) {
    next(err);
  }
}

async function exportEquipmentCondemnationReport(req, res, next) {
  try {
    const { recordId } = req.params;
    const { format = "pdf" } = req.query;
    const fabRes = await getAllEquipmentCondemnationsFromFabric();
    let items = fabRes.records || [];
    let record = items.find(i => i.recordId === recordId || i._id === recordId);

    if (!record) {
      return res.status(404).json({ ok: false, error: "Proforma-II record not found" });
    }

    if (req.user && req.user.role === "DepartmentUser" && req.user.department) {
      const userDept = String(req.user.department).toUpperCase();
      if (record.department && String(record.department).toUpperCase() !== userDept) {
        return res.status(403).json({ ok: false, error: "Access denied" });
      }
    }

    if (format === "excel") {
      const xlsxBuffer = await generateProformaIIExcel(record);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=proforma-II-${recordId}.xlsx`);
      return res.send(xlsxBuffer);
    }

    const buffer = await generateProformaIIPdf(record);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=proforma-II-${recordId}.pdf`);
    return res.send(buffer);
  } catch (err) {
    next(err);
  }
}

async function exportConsumableVerificationReport(req, res, next) {
  try {
    const { recordId } = req.params;
    const { format = "pdf" } = req.query;
    const fabRes = await getAllConsumableVerificationsFromFabric();
    let items = fabRes.records || [];
    let record = items.find(i => i.recordId === recordId || i._id === recordId);

    if (!record) {
      return res.status(404).json({ ok: false, error: "Proforma-III record not found" });
    }

    if (req.user && req.user.role === "DepartmentUser" && req.user.department) {
      const userDept = String(req.user.department).toUpperCase();
      if (record.department && String(record.department).toUpperCase() !== userDept) {
        return res.status(403).json({ ok: false, error: "Access denied" });
      }
    }

    if (format === "excel") {
      const xlsxBuffer = await generateProformaIIIExcel(record);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=proforma-III-${recordId}.xlsx`);
      return res.send(xlsxBuffer);
    }

    const buffer = await generateProformaIIIPdf(record);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=proforma-III-${recordId}.pdf`);
    return res.send(buffer);
  } catch (err) {
    next(err);
  }
}

async function exportConsumableCondemnationReport(req, res, next) {
  try {
    const { recordId } = req.params;
    const { format = "pdf" } = req.query;
    const fabRes = await getAllConsumableCondemnationsFromFabric();
    let items = fabRes.records || [];
    let record = items.find(i => i.recordId === recordId || i._id === recordId);

    if (!record) {
      return res.status(404).json({ ok: false, error: "Proforma-IV record not found" });
    }

    if (req.user && req.user.role === "DepartmentUser" && req.user.department) {
      const userDept = String(req.user.department).toUpperCase();
      if (record.department && String(record.department).toUpperCase() !== userDept) {
        return res.status(403).json({ ok: false, error: "Access denied" });
      }
    }

    if (format === "excel") {
      const xlsxBuffer = await generateProformaIVExcel(record);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=proforma-IV-${recordId}.xlsx`);
      return res.send(xlsxBuffer);
    }

    const buffer = await generateProformaIVPdf(record);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=proforma-IV-${recordId}.pdf`);
    return res.send(buffer);
  } catch (err) {
    next(err);
  }
}