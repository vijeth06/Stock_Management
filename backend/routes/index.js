const express = require("express");
const path = require("path");
const multer = require("multer");
const router = express.Router();

const upload = multer({ dest: path.join(__dirname, "../../uploads/bills") });
// Conditional multer middleware: only apply when request is multipart/form-data
function conditionalUpload(req, res, next) {
  const ct = req.headers['content-type'] || '';
  if (ct.indexOf('multipart/form-data') === 0) {
    return upload.single('billDocument')(req, res, next);
  }
  return next();
}
const { authenticate, authorize } = require("../middleware/auth");

const departmentController = require("../controllers/departmentController");
const assetController = require("../controllers/assetController.blockchain");
const maintenanceController = require("../controllers/maintenanceController");
const billController = require("../controllers/billController.blockchain");
const condemnationController = require("../controllers/condemnationController");
const verificationController = require("../controllers/verificationController");
const reportController = require("../controllers/reportController");

router.use(authenticate);

router.get("/departments", authorize(["Administrator", "AuditOfficer"]), departmentController.getDepartments);
router.get("/departments/:id", authorize(["Administrator", "AuditOfficer"]), departmentController.getDepartment);
router.get("/departments/:id/summary", authorize(["Administrator", "AuditOfficer"]), departmentController.getDepartmentSummary);
router.post("/departments", authorize(["Administrator"]), departmentController.createDepartment);
router.put("/departments/:id", authorize(["Administrator"]), departmentController.updateDepartment);
router.delete("/departments/:id", authorize(["Administrator"]), departmentController.deleteDepartment);

router.get("/assets", authorize(["Administrator", "DepartmentUser", "AuditOfficer"]), assetController.getAssets);
router.get("/assets/:assetId/history", authorize(["Administrator", "DepartmentUser", "AuditOfficer"]), assetController.getAssetHistory);
router.get("/assets/:assetId", authorize(["Administrator", "DepartmentUser", "AuditOfficer"]), assetController.getAsset);
router.post("/assets", authorize(["Administrator", "DepartmentUser"]), assetController.createAsset);
router.put("/assets/:assetId", authorize(["Administrator", "DepartmentUser"]), assetController.updateAsset);
router.delete("/assets/:assetId", authorize(["Administrator"]), assetController.deleteAsset);

router.get("/maintenance", authorize(["Administrator", "DepartmentUser", "AuditOfficer"]), maintenanceController.getMaintenanceRecords);
router.get("/maintenance/history/:assetId", authorize(["Administrator", "DepartmentUser"]), maintenanceController.getMaintenanceHistory);
router.post("/maintenance", authorize(["Administrator", "DepartmentUser"]), maintenanceController.createMaintenanceRecord);
router.get("/maintenance/:recordId", authorize(["Administrator", "DepartmentUser"]), maintenanceController.getMaintenanceRecord);
router.put("/maintenance/:recordId", authorize(["Administrator", "DepartmentUser"]), maintenanceController.updateMaintenanceRecord);

router.get("/bills", authorize(["Administrator", "DepartmentUser", "AuditOfficer"]), billController.getBills);
router.get("/bills/:billId", authorize(["Administrator", "DepartmentUser", "AuditOfficer"]), billController.getBill);
router.post("/bills", authorize(["Administrator", "DepartmentUser"]), conditionalUpload, billController.uploadBill);
router.post("/bills/:billId/verify", authorize(["Administrator", "AuditOfficer"]), billController.verifyBill);
router.put("/bills/:billId/payment", authorize(["Administrator", "DepartmentUser"]), billController.updatePaymentStatus);
router.post("/bills/:billId/download-token", authorize(["Administrator", "DepartmentUser", "AuditOfficer"]), billController.generateBillDownloadToken);
router.get("/bills/download", billController.downloadBillByToken);

router.get("/condemnation", authorize(["Administrator", "DepartmentUser", "AuditOfficer"]), condemnationController.getCondemnationRecords);
router.get("/condemnation/:recordId", authorize(["Administrator", "DepartmentUser", "AuditOfficer"]), condemnationController.getCondemnationRecord);
router.post("/condemnation", authorize(["Administrator", "DepartmentUser"]), condemnationController.requestCondemnation);
router.put("/condemnation/:recordId/approve", authorize(["Administrator"]), condemnationController.approveCondemnation);
router.put("/condemnation/:recordId/reject", authorize(["Administrator"]), condemnationController.rejectCondemnation);

router.post("/verification/equipment", authorize(["Administrator", "DepartmentUser", "AuditOfficer"]), verificationController.createEquipmentVerification);
router.get("/verification/equipment", authorize(["Administrator", "DepartmentUser", "AuditOfficer"]), verificationController.getEquipmentVerifications);
router.get("/verification/equipment/:recordId", authorize(["Administrator", "DepartmentUser", "AuditOfficer"]), verificationController.getEquipmentVerification);
router.post("/verification/equipment/condemnation", authorize(["Administrator", "DepartmentUser", "AuditOfficer"]), verificationController.createEquipmentCondemnation);
router.get("/verification/equipment/condemnation", authorize(["Administrator", "DepartmentUser", "AuditOfficer"]), verificationController.getEquipmentCondemnations);
router.get("/verification/equipment/condemnation/:recordId", authorize(["Administrator", "DepartmentUser", "AuditOfficer"]), verificationController.getEquipmentCondemnation);
router.put("/verification/equipment/condemnation/:recordId/approve", authorize(["Administrator", "AuditOfficer"]), verificationController.approveEquipmentCondemnation);
router.put("/verification/equipment/condemnation/:recordId/reject", authorize(["Administrator", "AuditOfficer"]), verificationController.rejectEquipmentCondemnation);

router.post("/verification/consumables", authorize(["Administrator", "DepartmentUser", "AuditOfficer"]), verificationController.createConsumableVerification);
router.get("/verification/consumables", authorize(["Administrator", "DepartmentUser", "AuditOfficer"]), verificationController.getConsumableVerifications);
router.get("/verification/consumables/:recordId", authorize(["Administrator", "DepartmentUser", "AuditOfficer"]), verificationController.getConsumableVerification);
router.post("/verification/consumables/condemnation", authorize(["Administrator", "DepartmentUser", "AuditOfficer"]), verificationController.createConsumableCondemnation);
router.get("/verification/consumables/condemnation", authorize(["Administrator", "DepartmentUser", "AuditOfficer"]), verificationController.getConsumableCondemnations);
router.get("/verification/consumables/condemnation/:recordId", authorize(["Administrator", "DepartmentUser", "AuditOfficer"]), verificationController.getConsumableCondemnation);
router.put("/verification/consumables/condemnation/:recordId/approve", authorize(["Administrator", "AuditOfficer"]), verificationController.approveConsumableCondemnation);
router.put("/verification/consumables/condemnation/:recordId/reject", authorize(["Administrator", "AuditOfficer"]), verificationController.rejectConsumableCondemnation);

router.post("/transfers", authorize(["Administrator", "DepartmentUser"]), assetController.transferAsset);
router.get("/transfers", authorize(["Administrator", "DepartmentUser", "AuditOfficer"]), assetController.getTransfers);
router.get("/reports/financial", authorize(["Administrator", "AuditOfficer"]), reportController.getFinancialReport);
router.get("/dashboard", authorize(["Administrator", "DepartmentUser", "AuditOfficer"]), reportController.getDashboard);
router.get("/reports", authorize(["Administrator", "AuditOfficer"]), reportController.getReports);
router.get("/reports/:reportId/export", authorize(["Administrator", "AuditOfficer"]), reportController.exportReport);
router.get("/reports/:reportId", authorize(["Administrator", "AuditOfficer"]), reportController.getReport);
router.post("/reports", authorize(["Administrator", "AuditOfficer"]), reportController.generateYearlyReport);
router.get("/summary/:year", authorize(["Administrator", "AuditOfficer"]), reportController.getAnnualSummary);

const { listAuditLogs } = require("../services/auditService");
router.get("/audit-logs", authorize(["Administrator", "AuditOfficer"]), async (req, res, next) => {
  try {
    const result = await listAuditLogs(req.query, Number(req.query.page || 1), Number(req.query.limit || 50));
    res.json({ ok: true, data: result.items, pagination: { page: result.page, limit: result.limit, total: result.total, pages: result.totalPages } });
  } catch (err) {
    next(err);
  }
});

const authController = require("../controllers/authController");
router.get("/users/pending", authorize(["Administrator"]), authController.getPendingUsers);
router.post("/users/:id/approve", authorize(["Administrator"]), authController.approveUser);
router.post("/users/:id/reject", authorize(["Administrator"]), authController.rejectUser);

// Extended user management
router.put("/users/:id/role", authorize(["Administrator"]), authController.updateUserRole);
router.put("/users/:id/department", authorize(["Administrator"]), authController.updateUserDepartment);

// Department valuation report
router.get("/reports/department-valuation", authorize(["Administrator", "AuditOfficer"]), reportController.getDepartmentValuation);

// Asset lifecycle tracking
router.get("/assets/:assetId/lifecycle", authorize(["Administrator", "DepartmentUser", "AuditOfficer"]), assetController.getAssetLifecycle);
router.get("/assets/:assetId/audit-trail", authorize(["Administrator", "AuditOfficer"]), assetController.getAssetAuditTrail);

// Bulk operations
router.post("/assets/bulk-import", authorize(["Administrator"]), assetController.bulkImportAssets);
router.post("/assets/bulk-transfer", authorize(["Administrator", "DepartmentUser"]), assetController.bulkTransferAssets);

// Test endpoint removed: ledger writes should happen via standard `/api/bills` flow.

module.exports = router;