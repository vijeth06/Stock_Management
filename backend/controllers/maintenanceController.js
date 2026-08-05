const MaintenanceRecord = require("../models/MaintenanceRecord");
const Asset = require("../models/Asset");
const { addMaintenanceOnFabric } = require("../services/fabricService");
const { recordAuditLog } = require("../services/auditService");

async function createMaintenanceRecord(req, res, next) {
  try {
    const { assetId, technician, maintenanceDate, description, cost, status, priority } = req.body;

    const asset = await Asset.findOne({ assetId });
    if (!asset) {
      return res.status(404).json({ ok: false, error: "Asset not found" });
    }

    if (["Condemned", "Disposed", "Retired", "Condemnation Requested"].includes(asset.status)) {
      return res.status(400).json({ ok: false, error: `Cannot schedule maintenance for asset in '${asset.status}' state` });
    }

    const recordId = `MNT-${Date.now()}`;
    const record = await MaintenanceRecord.create({
      recordId, assetId, technician, maintenanceDate, description, cost, status: status || "In Progress", priority
    });

    asset.maintenanceRecords.push({
      recordId, technician, maintenanceDate, description, cost, status: record.status, createdAt: new Date()
    });
    asset.maintenanceCount = (asset.maintenanceCount || 0) + 1;
    if (asset.status !== "Maintenance") {
      asset.status = "Maintenance";
    }
    await asset.save();

    await recordAuditLog({
      actor: (req.user && (req.user.email || req.user.name)) || "system",
      role: (req.user && req.user.role) || "DepartmentUser",
      action: "LOG_MAINTENANCE",
      resourceType: "MaintenanceRecord",
      resourceId: recordId,
      details: { assetId, technician, cost }
    }).catch(() => {});

    const blockchain = await addMaintenanceOnFabric(assetId, {
      technician,
      maintenanceDate,
      description,
      cost,
      status: record.status
    }).catch((error) => ({ success: false, error: error.message }));

    res.status(201).json({
      ok: true,
      data: record,
      blockchain
    });
  } catch (error) {
    next(error);
  }
}

async function getMaintenanceRecords(req, res, next) {
  try {
    const { assetId, status, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (assetId) filter.assetId = assetId;
    if (status) filter.status = status;

    const skip = (page - 1) * limit;
    const records = await MaintenanceRecord.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await MaintenanceRecord.countDocuments(filter);

    res.json({
      ok: true,
      data: records,
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

async function getMaintenanceRecord(req, res, next) {
  try {
    const record = await MaintenanceRecord.findOne({ recordId: req.params.recordId });
    if (!record) {
      return res.status(404).json({ ok: false, error: "Maintenance record not found" });
    }
    res.json({
      ok: true,
      data: record
    });
  } catch (error) {
    next(error);
  }
}

async function updateMaintenanceRecord(req, res, next) {
  try {
    const record = await MaintenanceRecord.findOneAndUpdate(
      { recordId: req.params.recordId },
      { $set: { ...req.body, updatedAt: new Date() } },
      { new: true, runValidators: true }
    );
    if (!record) {
      return res.status(404).json({ ok: false, error: "Maintenance record not found" });
    }

    if (record.status === "Completed") {
      const asset = await Asset.findOne({ assetId: record.assetId });
      if (asset && asset.status === "Maintenance") {
        const openMaintenance = await MaintenanceRecord.countDocuments({
          assetId: record.assetId,
          status: { $in: ["Pending", "In Progress"] },
          recordId: { $ne: record.recordId }
        });
        if (!openMaintenance) {
          asset.status = "Active";
          await asset.save();
        }
      }
    }

    await recordAuditLog({
      actor: (req.user && (req.user.email || req.user.name)) || "system",
      role: (req.user && req.user.role) || "DepartmentUser",
      action: "UPDATE_MAINTENANCE",
      resourceType: "MaintenanceRecord",
      resourceId: record.recordId,
      details: { status: record.status }
    }).catch(() => {});

    res.json({
      ok: true,
      data: record
    });
  } catch (error) {
    next(error);
  }
}

async function getMaintenanceHistory(req, res, next) {
  try {
    const asset = await Asset.findOne({ assetId: req.params.assetId });
    if (!asset) {
      return res.status(404).json({ ok: false, error: "Asset not found" });
    }

    const records = await MaintenanceRecord.find({ assetId: req.params.assetId })
      .sort({ createdAt: -1 });

    res.json({
      ok: true,
      data: {
        assetId: req.params.assetId,
        maintenanceRecords: records,
        totalRecords: records.length,
        totalCost: records.reduce((sum, r) => sum + (r.cost || 0), 0)
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createMaintenanceRecord,
  getMaintenanceRecords,
  getMaintenanceRecord,
  updateMaintenanceRecord,
  getMaintenanceHistory
};