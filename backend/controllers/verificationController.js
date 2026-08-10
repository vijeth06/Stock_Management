const { recordAuditLog } = require("../services/auditService");
const { checkDepartmentAccess } = require("../middleware/auth");
const {
  createEquipmentVerificationOnFabric,
  getAllEquipmentVerificationsFromFabric,
  createEquipmentCondemnationOnFabric,
  getAllEquipmentCondemnationsFromFabric,
  createConsumableVerificationOnFabric,
  getAllConsumableVerificationsFromFabric,
  createConsumableCondemnationOnFabric,
  getAllConsumableCondemnationsFromFabric,
  readAssetFromFabric,
  updateAssetOnFabric,
  readConsumableFromFabric,
  updateConsumableStockOnFabric
} = require("../services/fabricService");

const verificationsStore = {
  equipmentVerifications: [],
  equipmentCondemnations: [],
  consumableVerifications: [],
  consumableCondemnations: []
};

function validateNonNegativeItems(items, fields) {
  if (!Array.isArray(items)) return null;
  for (const item of items) {
    for (const field of fields) {
      if (item[field] !== undefined && item[field] !== null && Number(item[field]) < 0) {
        return `Value for '${field}' cannot be negative`;
      }
    }
  }
  return null;
}

function validateNonNegativeFields(obj, fields) {
  for (const field of fields) {
    if (obj[field] !== undefined && obj[field] !== null && Number(obj[field]) < 0) {
      return `Value for '${field}' cannot be negative`;
    }
  }
  return null;
}

async function createEquipmentVerification(req, res, next) {
  try {
    const payload = req.body;
    const recordId = `EQV-${Date.now()}`;

    if (req.user && req.user.role === "DepartmentUser" && req.user.department) {
      if (payload.department && payload.department.toUpperCase() !== req.user.department.toUpperCase()) {
        return res.status(403).json({ ok: false, error: "Cannot create verification for another department" });
      }
      payload.department = req.user.department;
    }

    if (!payload.financialYear && !payload.auditYear) {
      payload.financialYear = new Date().getFullYear().toString() + "-" + (new Date().getFullYear() + 1).toString().slice(-2);
    }

    if (!payload.auditYear && payload.financialYear) {
      const parts = String(payload.financialYear).split("-");
      if (parts.length === 2) payload.auditYear = parseInt(parts[0]);
    }

    const topLevelInvalid = validateNonNegativeFields(payload, ["previousBookValue", "currentBookValue"]);
    if (topLevelInvalid) {
      return res.status(400).json({ ok: false, error: topLevelInvalid });
    }

    const invalidErrMsg = validateNonNegativeItems(payload.items, ["bookStockPreviousYear", "purchasedDuringYear", "actualPhysicalStock", "purchaseValue", "currentBookValue", "previousBookValue"]);
    if (invalidErrMsg) {
      return res.status(400).json({ ok: false, error: invalidErrMsg });
    }

    if (!payload.auditYear) {
      payload.auditYear = new Date().getFullYear();
    }

    // Validate asset linking if assetId is provided
    if (payload.assetId) {
      const assetRes = await readAssetFromFabric(payload.assetId);
      if (!assetRes.success || !assetRes.asset) {
        return res.status(404).json({ ok: false, error: `Asset ${payload.assetId} not found on ledger` });
      }
      if (req.user && req.user.role === "DepartmentUser" && req.user.department) {
        if (!checkDepartmentAccess(req.user, assetRes.asset.department)) {
          return res.status(403).json({ ok: false, error: "Cannot verify asset from another department" });
        }
      }
    }

    if (Array.isArray(payload.items)) {
      payload.items = payload.items.map(item => {
        const bookCurrent = (Number(item.bookStockPreviousYear) || 0) + (Number(item.purchasedDuringYear) || 0);
        const physicalStock = Number(item.actualPhysicalStock) || 0;
        const difference = bookCurrent - physicalStock;
        let outcome = item.outcome || "Verified";
        if (item.workingCondition === "Damaged" || item.workingCondition === "Not Working" || item.workingCondition === "Condemnation Required") {
          if (!item.outcome) outcome = "Condemnation Required";
        } else if (item.workingCondition === "Repair Required" || item.workingCondition === "Under Maintenance") {
          if (!item.outcome) outcome = "Under Maintenance";
        } else if (item.workingCondition === "Missing" || difference > 0) {
          if (!item.outcome) outcome = "Missing / Loss Review Required";
        }
        return {
          ...item,
          bookStockCurrentYear: bookCurrent,
          difference,
          outcome
        };
      });
    }

    const verification = {
      ...payload,
      _id: recordId,
      recordId,
      status: payload.status || "Completed",
      auditYear: payload.auditYear,
      createdAt: new Date().toISOString()
    };

    const fabricRes = await createEquipmentVerificationOnFabric(verification);
    if (!fabricRes.success) {
      return res.status(500).json({ ok: false, error: fabricRes.error || "Failed to store equipment verification on ledger" });
    }

    verificationsStore.equipmentVerifications.unshift(verification);

    try { await recordAuditLog({ actor: req.user && req.user.email, role: req.user && req.user.role, action: 'PROFORMA_I_CREATED', resourceType: 'EquipmentVerification', resourceId: recordId, details: { department: payload.department, auditYear: payload.auditYear } }); } catch (e) {}

    res.status(201).json({ ok: true, data: verification, blockchain: fabricRes });
  } catch (error) {
    next(error);
  }
}

async function getEquipmentVerifications(req, res, next) {
  try {
    const { department, year, page = 1, limit = 20 } = req.query;
    const fabricRes = await getAllEquipmentVerificationsFromFabric();
    let items = [...(fabricRes.records || []), ...verificationsStore.equipmentVerifications];

    if (req.user && req.user.role === "DepartmentUser" && req.user.department) {
      items = items.filter(i => (i.department || '').toUpperCase() === req.user.department.toUpperCase());
    } else if (department) {
      items = items.filter(i => (i.department || '').toUpperCase() === String(department).toUpperCase());
    }
    if (year) items = items.filter(i => i.auditYear === Number(year));

    const total = items.length;
    const skip = (Number(page) - 1) * Number(limit);
    const paginated = items.slice(skip, skip + Number(limit));

    res.json({ ok: true, data: paginated, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) || 1 } });
  } catch (error) {
    next(error);
  }
}

async function getEquipmentVerification(req, res, next) {
  try {
    const { getAllEquipmentVerificationsFromFabric } = require("../services/fabricService");
    const recordId = req.params.recordId;
    const fabricRes = await getAllEquipmentVerificationsFromFabric();
    let items = fabricRes.records || [];
    let item = items.find(i => i.recordId === recordId || i._id === recordId);
    if (!item) {
      item = verificationsStore.equipmentVerifications.find(i => i.recordId === recordId || i._id === recordId);
    }
    if (!item) return res.status(404).json({ ok: false, error: "Equipment verification record not found" });
    if (req.user && !checkDepartmentAccess(req.user, item.department)) {
      return res.status(403).json({ ok: false, error: "Access denied to another department's verification" });
    }
    res.json({ ok: true, data: item });
  } catch (error) {
    next(error);
  }
}

async function createEquipmentCondemnation(req, res, next) {
  try {
    const payload = req.body;
    const recordId = `EQC-${Date.now()}`;

    if (req.user && req.user.role === "DepartmentUser" && req.user.department) {
      payload.department = req.user.department;
    }

    const invalidErrMsg = validateNonNegativeItems(payload.items, ["quantity", "purchaseValue", "bookValue"]);
    if (invalidErrMsg) {
      return res.status(400).json({ ok: false, error: invalidErrMsg });
    }

    // Validate linkage to original Asset ID
    if (payload.assetId) {
      const assetRes = await readAssetFromFabric(payload.assetId);
      if (!assetRes.success || !assetRes.asset) {
        return res.status(404).json({ ok: false, error: `Asset ${payload.assetId} not found on ledger` });
      }
      payload.assetStatus = assetRes.asset.status;
    }

    if (!payload.auditYear) {
      payload.auditYear = new Date().getFullYear();
    }

    const record = {
      ...payload,
      _id: recordId,
      recordId,
      status: payload.status || "Pending",
      createdAt: new Date().toISOString()
    };

    const fabricRes = await createEquipmentCondemnationOnFabric(record);
    if (!fabricRes.success) {
      return res.status(500).json({ ok: false, error: fabricRes.error || "Failed to store equipment condemnation on ledger" });
    }

    // Update asset status to CONDEMNATION_REQUESTED on blockchain if assetId is linked
    if (payload.assetId) {
      const assetRes = await readAssetFromFabric(payload.assetId);
      if (assetRes.success && assetRes.asset) {
        if (!["Condemned", "Disposed", "Retirement Requested"].includes(assetRes.asset.status)) {
          try {
            await updateAssetOnFabric(payload.assetId, { field: "status", newValue: "CONDEMNATION_REQUESTED" });
          } catch (e) { }
        }
      }
    }

    verificationsStore.equipmentCondemnations.unshift(record);

    try { await recordAuditLog({ actor: req.user && req.user.email, role: req.user && req.user.role, action: 'PROFORMA_II_CREATED', resourceType: 'EquipmentCondemnation', resourceId: recordId, details: { assetId: payload.assetId, department: payload.department } }); } catch (e) {}

    res.status(201).json({ ok: true, data: record, blockchain: fabricRes });
  } catch (error) {
    next(error);
  }
}

async function getEquipmentCondemnations(req, res, next) {
  try {
    const { department, status, year, page = 1, limit = 20 } = req.query;
    const fabricRes = await getAllEquipmentCondemnationsFromFabric();
    let items = [...(fabricRes.records || []), ...verificationsStore.equipmentCondemnations];

    if (req.user && req.user.role === "DepartmentUser" && req.user.department) {
      items = items.filter(i => (i.department || '').toUpperCase() === req.user.department.toUpperCase());
    } else if (department) {
      items = items.filter(i => (i.department || '').toUpperCase() === String(department).toUpperCase());
    }
    if (status) items = items.filter(i => i.status === status);
    if (year) items = items.filter(i => i.auditYear === Number(year));

    const total = items.length;
    const skip = (Number(page) - 1) * Number(limit);
    const paginated = items.slice(skip, skip + Number(limit));

    res.json({ ok: true, data: paginated, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) || 1 } });
  } catch (error) {
    next(error);
  }
}

async function getEquipmentCondemnation(req, res, next) {
  try {
    const { getAllEquipmentCondemnationsFromFabric } = require("../services/fabricService");
    const recordId = req.params.recordId;
    const fabricRes = await getAllEquipmentCondemnationsFromFabric();
    let items = fabricRes.records || [];
    let item = items.find(i => i.recordId === recordId || i._id === recordId);
    if (!item) {
      item = verificationsStore.equipmentCondemnations.find(i => i.recordId === recordId || i._id === recordId);
    }
    if (!item) return res.status(404).json({ ok: false, error: "Equipment condemnation record not found" });
    if (req.user && !checkDepartmentAccess(req.user, item.department)) {
      return res.status(403).json({ ok: false, error: "Access denied to another department's condemnation record" });
    }
    res.json({ ok: true, data: item });
  } catch (error) {
    next(error);
  }
}

async function approveEquipmentCondemnation(req, res, next) {
  try {
    const { recordId } = req.params;
    const { approvedBy } = req.body;
    
    const { getAllEquipmentCondemnationsFromFabric } = require("../services/fabricService");
    const fabricRes = await getAllEquipmentCondemnationsFromFabric();
    let record = (fabricRes.records || []).find(i => i.recordId === recordId || i._id === recordId);
    const memRecord = verificationsStore.equipmentCondemnations.find(i => i.recordId === recordId || i._id === recordId);
    const effectiveRecord = memRecord || record;
    if (!effectiveRecord) return res.status(404).json({ ok: false, error: "Record not found" });

    if (effectiveRecord.status && effectiveRecord.status !== "Pending") {
      return res.status(400).json({ ok: false, error: "Condemnation request is not pending" });
    }

    record = effectiveRecord;
    record.status = "Approved";
    record.approvedBy = approvedBy;
    record.approvedAt = new Date().toISOString();

    // Update on blockchain - mark asset as Condemned
    if (record.assetId) {
      try {
        const assetRes = await readAssetFromFabric(record.assetId);
        if (assetRes.success && assetRes.asset && assetRes.asset.status !== 'CONDEMNED' && assetRes.asset.status !== 'Condemned' && assetRes.asset.status !== 'Disposed' && assetRes.asset.status !== 'DISPOSED') {
          await updateAssetOnFabric(record.assetId, { field: "status", newValue: "CONDEMNED" });
        }
      } catch (e) { }
    }

    // Update in-memory store
    memRecord.status = record.status;
    memRecord.approvedBy = record.approvedBy;
    memRecord.approvedAt = record.approvedAt;

    try { await recordAuditLog({ actor: req.user && req.user.email, role: req.user && req.user.role, action: 'PROFORMA_II_APPROVED', resourceType: 'EquipmentCondemnation', resourceId: recordId, details: { assetId: record.assetId } }); } catch (e) {}

    res.json({ ok: true, data: record });
  } catch (error) {
    next(error);
  }
}

async function rejectEquipmentCondemnation(req, res, next) {
  try {
    const { recordId } = req.params;
    const { rejectedBy } = req.body;
    
    const { getAllEquipmentCondemnationsFromFabric } = require("../services/fabricService");
    const fabricRes = await getAllEquipmentCondemnationsFromFabric();
    let record = (fabricRes.records || []).find(i => i.recordId === recordId || i._id === recordId);
    if (!record) {
      record = verificationsStore.equipmentCondemnations.find(i => i.recordId === recordId || i._id === recordId);
    }
    if (!record) return res.status(404).json({ ok: false, error: "Record not found" });

    if (record.status !== "Pending") {
      return res.status(400).json({ ok: false, error: "Condemnation request is not pending" });
    }

    record.status = "Rejected";
    record.rejectedBy = rejectedBy;
    record.rejectedAt = new Date().toISOString();

    // Restore asset status to Active on blockchain if linked
    if (record.assetId) {
      try {
        await updateAssetOnFabric(record.assetId, { field: "status", newValue: "Active" });
      } catch (e) { }
    }

    // Update in-memory store
    const memRecord = verificationsStore.equipmentCondemnations.find(i => i.recordId === recordId || i._id === recordId);
    if (memRecord) {
      memRecord.status = record.status;
      memRecord.rejectedBy = record.rejectedBy;
      memRecord.rejectedAt = record.rejectedAt;
    }

    try { await recordAuditLog({ actor: req.user && req.user.email, role: req.user && req.user.role, action: 'PROFORMA_II_REJECTED', resourceType: 'EquipmentCondemnation', resourceId: recordId, details: { assetId: record.assetId } }); } catch (e) {}

    res.json({ ok: true, data: record });
  } catch (error) {
    next(error);
  }
}

async function createConsumableVerification(req, res, next) {
  try {
    const payload = req.body;
    const recordId = `CNV-${Date.now()}`;

    if (req.user && req.user.role === "DepartmentUser" && req.user.department) {
      payload.department = req.user.department;
    }

    const invalidErrMsg = validateNonNegativeItems(payload.items, ["previousStock", "purchasedQuantity", "consumedQuantity", "actualPhysicalStock", "purchaseValue"]);
    if (invalidErrMsg) {
      return res.status(400).json({ ok: false, error: invalidErrMsg });
    }

    if (!payload.auditYear) {
      payload.auditYear = new Date().getFullYear();
    }

    // Validate consumable linking if consumableId is provided
    if (payload.consumableId) {
      const consRes = await readConsumableFromFabric(payload.consumableId);
      if (!consRes.success || !consRes.consumable) {
        return res.status(404).json({ ok: false, error: `Consumable ${payload.consumableId} not found on ledger` });
      }
    }

    if (Array.isArray(payload.items)) {
      payload.items = payload.items.map(item => {
        const rem = (Number(item.previousStock) || 0) + (Number(item.purchasedQuantity) || 0) - (Number(item.consumedQuantity) || 0);
        const physicalStock = Number(item.actualPhysicalStock) || 0;
        const difference = rem - physicalStock;
        let outcome = item.outcome || "Verified";
        if (difference !== 0 && !item.outcome) {
          outcome = difference < 0 ? "Excess" : "Shortage";
        }
        if (item.condition === "Damaged" || item.condition === "Expired") {
          outcome = "Condemnation Required";
        }
        return {
          ...item,
          remainingBookStock: rem,
          difference,
          outcome
        };
      });
    }

    const verification = {
      ...payload,
      _id: recordId,
      recordId,
      status: payload.status || "Completed",
      auditYear: payload.auditYear,
      createdAt: new Date().toISOString()
    };

    const fabricRes = await createConsumableVerificationOnFabric(verification);
    if (!fabricRes.success) {
      return res.status(500).json({ ok: false, error: fabricRes.error || "Failed to store consumable verification on ledger" });
    }

    verificationsStore.consumableVerifications.unshift(verification);

    try { await recordAuditLog({ actor: req.user && req.user.email, role: req.user && req.user.role, action: 'PROFORMA_III_CREATED', resourceType: 'ConsumableVerification', resourceId: recordId, details: { department: payload.department, auditYear: payload.auditYear } }); } catch (e) {}

    res.status(201).json({ ok: true, data: verification, blockchain: fabricRes });
  } catch (error) {
    next(error);
  }
}

async function getConsumableVerifications(req, res, next) {
  try {
    const { department, year, page = 1, limit = 20 } = req.query;
    const fabricRes = await getAllConsumableVerificationsFromFabric();
    let items = [...(fabricRes.records || []), ...verificationsStore.consumableVerifications];

    if (req.user && req.user.role === "DepartmentUser" && req.user.department) {
      items = items.filter(i => (i.department || '').toUpperCase() === req.user.department.toUpperCase());
    } else if (department) {
      items = items.filter(i => (i.department || '').toUpperCase() === String(department).toUpperCase());
    }
    if (year) items = items.filter(i => i.auditYear === Number(year));

    const total = items.length;
    const skip = (Number(page) - 1) * Number(limit);
    const paginated = items.slice(skip, skip + Number(limit));

    res.json({ ok: true, data: paginated, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) || 1 } });
  } catch (error) {
    next(error);
  }
}

async function getConsumableVerification(req, res, next) {
  try {
    const { getAllConsumableVerificationsFromFabric } = require("../services/fabricService");
    const recordId = req.params.recordId;
    const fabricRes = await getAllConsumableVerificationsFromFabric();
    let items = fabricRes.records || [];
    let item = items.find(i => i.recordId === recordId || i._id === recordId);
    if (!item) {
      item = verificationsStore.consumableVerifications.find(i => i.recordId === recordId || i._id === recordId);
    }
    if (!item) return res.status(404).json({ ok: false, error: "Consumable verification record not found" });
    res.json({ ok: true, data: item });
  } catch (error) {
    next(error);
  }
}

async function createConsumableCondemnation(req, res, next) {
  try {
    const payload = req.body;
    const recordId = `CNC-${Date.now()}`;

    if (req.user && req.user.role === "DepartmentUser" && req.user.department) {
      payload.department = req.user.department;
    }

    const invalidErrMsg = validateNonNegativeItems(payload.items, ["quantity", "bookValue"]);
    if (invalidErrMsg) {
      return res.status(400).json({ ok: false, error: invalidErrMsg });
    }

    if (!payload.auditYear) {
      payload.auditYear = new Date().getFullYear();
    }

    // Validate consumable linking
    if (payload.consumableId) {
      const consRes = await readConsumableFromFabric(payload.consumableId);
      if (!consRes.success || !consRes.consumable) {
        return res.status(404).json({ ok: false, error: `Consumable ${payload.consumableId} not found on ledger` });
      }
    }

    if (Array.isArray(payload.items)) {
      payload.items = payload.items.map(item => ({
        ...item,
        difference: (Number(item.bookStock) || 0) - (Number(item.actualStock) || 0)
      }));
    }

    const record = {
      ...payload,
      _id: recordId,
      recordId,
      status: payload.status || "Pending",
      auditYear: payload.auditYear,
      createdAt: new Date().toISOString()
    };

    const fabricRes = await createConsumableCondemnationOnFabric(record);
    if (!fabricRes.success) {
      return res.status(500).json({ ok: false, error: fabricRes.error || "Failed to store consumable condemnation on ledger" });
    }

    verificationsStore.consumableCondemnations.unshift(record);

    try { await recordAuditLog({ actor: req.user && req.user.email, role: req.user && req.user.role, action: 'PROFORMA_IV_CREATED', resourceType: 'ConsumableCondemnation', resourceId: recordId, details: { consumableId: payload.consumableId, department: payload.department } }); } catch (e) {}

    res.status(201).json({ ok: true, data: record, blockchain: fabricRes });
  } catch (error) {
    next(error);
  }
}

async function getConsumableCondemnations(req, res, next) {
  try {
    const { department, status, year, page = 1, limit = 20 } = req.query;
    const fabricRes = await getAllConsumableCondemnationsFromFabric();
    let items = [...(fabricRes.records || []), ...verificationsStore.consumableCondemnations];

    if (department) items = items.filter(i => (i.department || '').toUpperCase() === String(department).toUpperCase());
    if (status) items = items.filter(i => i.status === status);
    if (year) items = items.filter(i => i.auditYear === Number(year));

    const total = items.length;
    const skip = (Number(page) - 1) * Number(limit);
    const paginated = items.slice(skip, skip + Number(limit));

    res.json({ ok: true, data: paginated, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) || 1 } });
  } catch (error) {
    next(error);
  }
}

async function getConsumableCondemnation(req, res, next) {
  try {
    const { getAllConsumableCondemnationsFromFabric } = require("../services/fabricService");
    const recordId = req.params.recordId;
    const fabricRes = await getAllConsumableCondemnationsFromFabric();
    let items = fabricRes.records || [];
    let item = items.find(i => i.recordId === recordId || i._id === recordId);
    if (!item) {
      item = verificationsStore.consumableCondemnations.find(i => i.recordId === recordId || i._id === recordId);
    }
    if (!item) return res.status(404).json({ ok: false, error: "Consumable condemnation record not found" });
    res.json({ ok: true, data: item });
  } catch (error) {
    next(error);
  }
}

async function approveConsumableCondemnation(req, res, next) {
  try {
    const { recordId } = req.params;
    const { approvedBy } = req.body;
    
    const { getAllConsumableCondemnationsFromFabric } = require("../services/fabricService");
    const fabricRes = await getAllConsumableCondemnationsFromFabric();
    let record = (fabricRes.records || []).find(i => i.recordId === recordId || i._id === recordId);
    const memRecord = verificationsStore.consumableCondemnations.find(i => i.recordId === recordId || i._id === recordId);
    const effectiveRecord = memRecord || record;
    if (!effectiveRecord) return res.status(404).json({ ok: false, error: "Record not found" });

    if (effectiveRecord.status && effectiveRecord.status !== "Pending") {
      return res.status(400).json({ ok: false, error: "Condemnation request is not pending" });
    }

    record = effectiveRecord;
    record.status = "Approved";
    record.approvedBy = approvedBy;
    record.approvedAt = new Date().toISOString();

    // Reduce consumable stock on blockchain if linked
    if (record.consumableId && Array.isArray(record.items) && record.items.length > 0) {
      const totalCondemnedQty = record.items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
      if (totalCondemnedQty > 0) {
        try {
          await updateConsumableStockOnFabric(record.consumableId, "consume", totalCondemnedQty, `Condemnation approved: ${approvedBy}`);
        } catch (e) { }
      }
    }

    try { await recordAuditLog({ actor: req.user && req.user.email, role: req.user && req.user.role, action: 'PROFORMA_IV_APPROVED', resourceType: 'ConsumableCondemnation', resourceId: recordId, details: { consumableId: record.consumableId } }); } catch (e) {}

    res.json({ ok: true, data: record });
  } catch (error) {
    next(error);
  }
}

async function rejectConsumableCondemnation(req, res, next) {
  try {
    const { recordId } = req.params;
    const { rejectedBy } = req.body;
    
    const { getAllConsumableCondemnationsFromFabric } = require("../services/fabricService");
    const fabricRes = await getAllConsumableCondemnationsFromFabric();
    let record = (fabricRes.records || []).find(i => i.recordId === recordId || i._id === recordId);
    if (!record) {
      record = verificationsStore.consumableCondemnations.find(i => i.recordId === recordId || i._id === recordId);
    }
    if (!record) return res.status(404).json({ ok: false, error: "Record not found" });

    if (record.status !== "Pending") {
      return res.status(400).json({ ok: false, error: "Condemnation request is not pending" });
    }

    record.status = "Rejected";
    record.rejectedBy = rejectedBy;
    record.rejectedAt = new Date().toISOString();

    const memRecord = verificationsStore.consumableCondemnations.find(i => i.recordId === recordId || i._id === recordId);
    if (memRecord) {
      memRecord.status = record.status;
      memRecord.rejectedBy = record.rejectedBy;
      memRecord.rejectedAt = record.rejectedAt;
    }

    try { await recordAuditLog({ actor: req.user && req.user.email, role: req.user && req.user.role, action: 'PROFORMA_IV_REJECTED', resourceType: 'ConsumableCondemnation', resourceId: recordId, details: { consumableId: record.consumableId } }); } catch (e) {}

    res.json({ ok: true, data: record });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createEquipmentVerification,
  getEquipmentVerifications,
  getEquipmentVerification,
  createEquipmentCondemnation,
  getEquipmentCondemnations,
  getEquipmentCondemnation,
  approveEquipmentCondemnation,
  rejectEquipmentCondemnation,
  createConsumableVerification,
  getConsumableVerifications,
  getConsumableVerification,
  createConsumableCondemnation,
  getConsumableCondemnations,
  getConsumableCondemnation,
  approveConsumableCondemnation,
  rejectConsumableCondemnation
};
