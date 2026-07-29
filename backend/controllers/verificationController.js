const EquipmentVerification = require("../models/EquipmentVerification");
const EquipmentCondemnation = require("../models/EquipmentCondemnation");
const ConsumableVerification = require("../models/ConsumableVerification");
const ConsumableCondemnation = require("../models/ConsumableCondemnation");
const { recordAuditLog } = require("../services/auditService");
const { checkDepartmentAccess } = require("../middleware/auth");

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

    const invalidErrMsg = validateNonNegativeItems(payload.items, ["bookStockPreviousYear", "purchasedDuringYear", "actualPhysicalStock", "purchaseValue"]);
    if (invalidErrMsg) {
      return res.status(400).json({ ok: false, error: invalidErrMsg });
    }

    if (Array.isArray(payload.items)) {
      payload.items = payload.items.map(item => {
        const bookCurrent = (Number(item.bookStockPreviousYear) || 0) + (Number(item.purchasedDuringYear) || 0);
        return {
          ...item,
          bookStockCurrentYear: bookCurrent,
          difference: bookCurrent - (Number(item.actualPhysicalStock) || 0)
        };
      });
    }

    const verification = await EquipmentVerification.create({
      ...payload,
      recordId,
      status: payload.status || "Completed"
    });

    await recordAuditLog({
      actor: (req.user && (req.user.email || req.user.name)) || payload.staffInCharge || "system",
      role: (req.user && req.user.role) || "AuditOfficer",
      action: "PROFORMA_1_EQUIPMENT_VERIFICATION",
      resourceType: "EquipmentVerification",
      resourceId: recordId,
      details: { department: payload.department, laboratory: payload.laboratory }
    }).catch(() => {});

    res.status(201).json({ ok: true, data: verification });
  } catch (error) {
    next(error);
  }
}

async function getEquipmentVerifications(req, res, next) {
  try {
    const { department, year, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (req.user && req.user.role === "DepartmentUser" && req.user.department) {
      filter.department = req.user.department;
    } else if (department) {
      filter.department = department;
    }
    if (year) filter.auditYear = Number(year);

    const skip = (page - 1) * limit;
    const items = await EquipmentVerification.find(filter)
      .sort({ verificationDate: -1 })
      .skip(Number(skip))
      .limit(Number(limit));
    const total = await EquipmentVerification.countDocuments(filter);

    res.json({ ok: true, data: items, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
}

async function getEquipmentVerification(req, res, next) {
  try {
    const item = await EquipmentVerification.findOne({ recordId: req.params.recordId });
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

    const record = await EquipmentCondemnation.create({
      ...payload,
      recordId,
      status: payload.status || "Pending"
    });

    res.status(201).json({ ok: true, data: record });
  } catch (error) {
    next(error);
  }
}

async function getEquipmentCondemnations(req, res, next) {
  try {
    const { department, status, year, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (req.user && req.user.role === "DepartmentUser" && req.user.department) {
      filter.department = req.user.department;
    } else if (department) {
      filter.department = department;
    }
    if (status) filter.status = status;
    if (year) filter.auditYear = Number(year);

    const skip = (page - 1) * limit;
    const items = await EquipmentCondemnation.find(filter)
      .sort({ verificationDate: -1 })
      .skip(Number(skip))
      .limit(Number(limit));
    const total = await EquipmentCondemnation.countDocuments(filter);

    res.json({ ok: true, data: items, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
}

async function getEquipmentCondemnation(req, res, next) {
  try {
    const item = await EquipmentCondemnation.findOne({ recordId: req.params.recordId });
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
    const record = await EquipmentCondemnation.findOne({ recordId });
    if (!record) return res.status(404).json({ ok: false, error: "Record not found" });

    if (record.status !== "Pending") {
      return res.status(400).json({ ok: false, error: "Condemnation request is not pending" });
    }

    record.status = "Approved";
    record.approvedBy = approvedBy;
    record.approvedAt = new Date();
    await record.save();

    res.json({ ok: true, data: record });
  } catch (error) {
    next(error);
  }
}

async function rejectEquipmentCondemnation(req, res, next) {
  try {
    const { recordId } = req.params;
    const { rejectedBy } = req.body;
    const record = await EquipmentCondemnation.findOne({ recordId });
    if (!record) return res.status(404).json({ ok: false, error: "Record not found" });

    if (record.status !== "Pending") {
      return res.status(400).json({ ok: false, error: "Condemnation request is not pending" });
    }

    record.status = "Rejected";
    record.rejectedBy = rejectedBy;
    record.rejectedAt = new Date();
    await record.save();

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

    if (Array.isArray(payload.items)) {
      payload.items = payload.items.map(item => {
        const rem = (Number(item.previousStock) || 0) + (Number(item.purchasedQuantity) || 0) - (Number(item.consumedQuantity) || 0);
        return {
          ...item,
          remainingBookStock: rem,
          difference: rem - (Number(item.actualPhysicalStock) || 0)
        };
      });
    }

    const verification = await ConsumableVerification.create({
      ...payload,
      recordId,
      status: payload.status || "Completed"
    });

    await recordAuditLog({
      actor: (req.user && (req.user.email || req.user.name)) || payload.staffInCharge || "system",
      role: (req.user && req.user.role) || "AuditOfficer",
      action: "PROFORMA_3_CONSUMABLE_VERIFICATION",
      resourceType: "ConsumableVerification",
      resourceId: recordId,
      details: { department: payload.department, laboratory: payload.laboratory }
    }).catch(() => {});

    res.status(201).json({ ok: true, data: verification });
  } catch (error) {
    next(error);
  }
}

async function getConsumableVerifications(req, res, next) {
  try {
    const { department, year, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (req.user && req.user.role === "DepartmentUser" && req.user.department) {
      filter.department = req.user.department;
    } else if (department) {
      filter.department = department;
    }
    if (year) filter.auditYear = Number(year);

    const skip = (page - 1) * limit;
    const items = await ConsumableVerification.find(filter)
      .sort({ verificationDate: -1 })
      .skip(Number(skip))
      .limit(Number(limit));
    const total = await ConsumableVerification.countDocuments(filter);

    res.json({ ok: true, data: items, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
}

async function getConsumableVerification(req, res, next) {
  try {
    const item = await ConsumableVerification.findOne({ recordId: req.params.recordId });
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

    if (Array.isArray(payload.items)) {
      payload.items = payload.items.map(item => ({
        ...item,
        difference: (Number(item.bookStock) || 0) - (Number(item.actualStock) || 0)
      }));
    }

    const record = await ConsumableCondemnation.create({
      ...payload,
      recordId,
      status: payload.status || "Pending"
    });

    await recordAuditLog({
      actor: (req.user && (req.user.email || req.user.name)) || payload.staffInCharge || "system",
      role: (req.user && req.user.role) || "AuditOfficer",
      action: "PROFORMA_4_CONSUMABLE_CONDEMNATION",
      resourceType: "ConsumableCondemnation",
      resourceId: recordId,
      details: { department: payload.department, laboratory: payload.laboratory }
    }).catch(() => {});

    res.status(201).json({ ok: true, data: record });
  } catch (error) {
    next(error);
  }
}

async function getConsumableCondemnations(req, res, next) {
  try {
    const { department, status, year, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (department) filter.department = department;
    if (status) filter.status = status;
    if (year) filter.auditYear = Number(year);

    const skip = (page - 1) * limit;
    const items = await ConsumableCondemnation.find(filter)
      .sort({ verificationDate: -1 })
      .skip(Number(skip))
      .limit(Number(limit));
    const total = await ConsumableCondemnation.countDocuments(filter);

    res.json({ ok: true, data: items, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
}

async function getConsumableCondemnation(req, res, next) {
  try {
    const item = await ConsumableCondemnation.findOne({ recordId: req.params.recordId });
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
    const record = await ConsumableCondemnation.findOne({ recordId });
    if (!record) return res.status(404).json({ ok: false, error: "Record not found" });

    if (record.status !== "Pending") {
      return res.status(400).json({ ok: false, error: "Condemnation request is not pending" });
    }

    record.status = "Approved";
    record.approvedBy = approvedBy;
    record.approvedAt = new Date();
    await record.save();

    res.json({ ok: true, data: record });
  } catch (error) {
    next(error);
  }
}

async function rejectConsumableCondemnation(req, res, next) {
  try {
    const { recordId } = req.params;
    const { rejectedBy } = req.body;
    const record = await ConsumableCondemnation.findOne({ recordId });
    if (!record) return res.status(404).json({ ok: false, error: "Record not found" });

    if (record.status !== "Pending") {
      return res.status(400).json({ ok: false, error: "Condemnation request is not pending" });
    }

    record.status = "Rejected";
    record.rejectedBy = rejectedBy;
    record.rejectedAt = new Date();
    await record.save();

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
