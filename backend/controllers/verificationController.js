const { recordAuditLog } = require("../services/auditService");
const { checkDepartmentAccess } = require("../middleware/auth");

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

    const verification = {
      ...payload,
      _id: recordId,
      recordId,
      status: payload.status || "Completed",
      createdAt: new Date().toISOString()
    };
    verificationsStore.equipmentVerifications.unshift(verification);

    res.status(201).json({ ok: true, data: verification });
  } catch (error) {
    next(error);
  }
}

async function getEquipmentVerifications(req, res, next) {
  try {
    const { department, year, page = 1, limit = 20 } = req.query;
    let items = [...verificationsStore.equipmentVerifications];

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
    const item = verificationsStore.equipmentVerifications.find(i => i.recordId === req.params.recordId || i._id === req.params.recordId);
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

    const record = {
      ...payload,
      _id: recordId,
      recordId,
      status: payload.status || "Pending",
      createdAt: new Date().toISOString()
    };
    verificationsStore.equipmentCondemnations.unshift(record);

    res.status(201).json({ ok: true, data: record });
  } catch (error) {
    next(error);
  }
}

async function getEquipmentCondemnations(req, res, next) {
  try {
    const { department, status, year, page = 1, limit = 20 } = req.query;
    let items = [...verificationsStore.equipmentCondemnations];

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
    const item = verificationsStore.equipmentCondemnations.find(i => i.recordId === req.params.recordId || i._id === req.params.recordId);
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
    const record = verificationsStore.equipmentCondemnations.find(i => i.recordId === recordId || i._id === recordId);
    if (!record) return res.status(404).json({ ok: false, error: "Record not found" });

    if (record.status !== "Pending") {
      return res.status(400).json({ ok: false, error: "Condemnation request is not pending" });
    }

    record.status = "Approved";
    record.approvedBy = approvedBy;
    record.approvedAt = new Date().toISOString();

    res.json({ ok: true, data: record });
  } catch (error) {
    next(error);
  }
}

async function rejectEquipmentCondemnation(req, res, next) {
  try {
    const { recordId } = req.params;
    const { rejectedBy } = req.body;
    const record = verificationsStore.equipmentCondemnations.find(i => i.recordId === recordId || i._id === recordId);
    if (!record) return res.status(404).json({ ok: false, error: "Record not found" });

    if (record.status !== "Pending") {
      return res.status(400).json({ ok: false, error: "Condemnation request is not pending" });
    }

    record.status = "Rejected";
    record.rejectedBy = rejectedBy;
    record.rejectedAt = new Date().toISOString();

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

    const verification = {
      ...payload,
      _id: recordId,
      recordId,
      status: payload.status || "Completed",
      createdAt: new Date().toISOString()
    };
    verificationsStore.consumableVerifications.unshift(verification);

    res.status(201).json({ ok: true, data: verification });
  } catch (error) {
    next(error);
  }
}

async function getConsumableVerifications(req, res, next) {
  try {
    const { department, year, page = 1, limit = 20 } = req.query;
    let items = [...verificationsStore.consumableVerifications];

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
    const item = verificationsStore.consumableVerifications.find(i => i.recordId === req.params.recordId || i._id === req.params.recordId);
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

    const record = {
      ...payload,
      _id: recordId,
      recordId,
      status: payload.status || "Pending",
      createdAt: new Date().toISOString()
    };
    verificationsStore.consumableCondemnations.unshift(record);

    res.status(201).json({ ok: true, data: record });
  } catch (error) {
    next(error);
  }
}

async function getConsumableCondemnations(req, res, next) {
  try {
    const { department, status, year, page = 1, limit = 20 } = req.query;
    let items = [...verificationsStore.consumableCondemnations];

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
    const item = verificationsStore.consumableCondemnations.find(i => i.recordId === req.params.recordId || i._id === req.params.recordId);
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
    const record = verificationsStore.consumableCondemnations.find(i => i.recordId === recordId || i._id === recordId);
    if (!record) return res.status(404).json({ ok: false, error: "Record not found" });

    if (record.status !== "Pending") {
      return res.status(400).json({ ok: false, error: "Condemnation request is not pending" });
    }

    record.status = "Approved";
    record.approvedBy = approvedBy;
    record.approvedAt = new Date().toISOString();

    res.json({ ok: true, data: record });
  } catch (error) {
    next(error);
  }
}

async function rejectConsumableCondemnation(req, res, next) {
  try {
    const { recordId } = req.params;
    const { rejectedBy } = req.body;
    const record = verificationsStore.consumableCondemnations.find(i => i.recordId === recordId || i._id === recordId);
    if (!record) return res.status(404).json({ ok: false, error: "Record not found" });

    if (record.status !== "Pending") {
      return res.status(400).json({ ok: false, error: "Condemnation request is not pending" });
    }

    record.status = "Rejected";
    record.rejectedBy = rejectedBy;
    record.rejectedAt = new Date().toISOString();

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
