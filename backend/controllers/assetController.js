const Asset = require("../models/Asset");
const Bill = require("../models/Bill");
const { createAssetOnFabric, updateAssetOnFabric } = require("../services/fabricService");
const { recordAuditLog } = require("../services/auditService");
const { checkDepartmentAccess } = require("../middleware/auth");

async function createAsset(req, res, next) {
  try {
    let {
      assetId, department, category, name, description, purchaseDate,
      purchaseValue, location, owner, warrantyExpiry, billHash, billDocument, status
    } = req.body;

    if (department) {
      department = String(department).trim().toUpperCase();
    }

    if (req.user && req.user.role === "DepartmentUser" && req.user.department) {
      const userDept = String(req.user.department).trim().toUpperCase();
      if (department && department !== userDept) {
        return res.status(403).json({ ok: false, error: "Cannot create assets for another department" });
      }
      department = userDept;
    }

    if (purchaseValue !== undefined && Number(purchaseValue) < 0) {
      return res.status(400).json({ ok: false, error: "Purchase value cannot be negative" });
    }

    const existing = await Asset.findOne({ assetId });
    if (existing) {
      return res.status(409).json({ ok: false, error: "Asset ID already exists" });
    }

    const asset = await Asset.create({
      assetId,
      department: (req.user && req.user.role === "DepartmentUser" && req.user.department) ? req.user.department : department,
      category, name, description, purchaseDate,
      purchaseValue, location, owner, warrantyExpiry, billHash, billDocument,
      status: status || "Active"
    });

    await recordAuditLog({
      actor: (req.user && (req.user.email || req.user.name)) || "system",
      role: (req.user && req.user.role) || "DepartmentUser",
      action: "CREATE_ASSET",
      resourceType: "Asset",
      resourceId: assetId,
      details: { name, department: asset.department, purchaseValue }
    }).catch(() => {});

    const blockchain = await createAssetOnFabric(asset).catch((error) => ({ success: false, error: error.message }));

    res.status(200).json({
      ok: true,
      data: asset,
      blockchain
    });
  } catch (error) {
    next(error);
  }
}

async function getAssets(req, res, next) {
  try {
    const { department, category, status, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (req.user && req.user.role === "DepartmentUser" && req.user.department) {
      filter.department = req.user.department;
    } else if (department) {
      filter.department = department;
    }

    if (category) filter.category = category;
    if (status) filter.status = status;

    const skip = (page - 1) * limit;
    const [assets, total] = await Promise.all([
      Asset.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Asset.countDocuments(filter)
    ]);

    res.json({
      ok: true,
      data: assets,
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

async function getAsset(req, res, next) {
  try {
    const asset = await Asset.findOne({ assetId: req.params.assetId });
    if (!asset) {
      return res.status(404).json({ ok: false, error: "Asset not found" });
    }
    if (req.user && !checkDepartmentAccess(req.user, asset.department)) {
      return res.status(403).json({ ok: false, error: "Access denied to another department's asset" });
    }
    res.json({
      ok: true,
      data: asset
    });
  } catch (error) {
    next(error);
  }
}

async function updateAsset(req, res, next) {
  try {
    const existingAsset = await Asset.findOne({ assetId: req.params.assetId });
    if (!existingAsset) {
      return res.status(404).json({ ok: false, error: "Asset not found" });
    }

    if (req.user && !checkDepartmentAccess(req.user, existingAsset.department)) {
      return res.status(403).json({ ok: false, error: "Access denied to update another department's asset" });
    }

    if (existingAsset.status === "Disposed") {
      return res.status(400).json({ ok: false, error: "Disposed assets cannot be modified or re-activated" });
    }

    if (req.user && req.user.role === "DepartmentUser" && req.user.department) {
      const userDept = String(req.user.department).trim().toUpperCase();
      if (req.body.department && String(req.body.department).trim().toUpperCase() !== userDept) {
        return res.status(403).json({ ok: false, error: "Cannot move asset to another department" });
      }
    }

    if (req.body.status && req.body.status !== existingAsset.status) {
      if (existingAsset.status === "Condemned" && req.body.status === "Active") {
        return res.status(400).json({ ok: false, error: "Condemned asset cannot return to Active state" });
      }
    }

    const allowedUpdates = [
      "status", "location", "owner", "department", "warrantyExpiry",
      "category", "name", "description", "purchaseDate", "purchaseValue", "billHash"
    ];
    const updatePayload = {};
    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        updatePayload[key] = req.body[key];
      }
    }

    if (updatePayload.department) {
      updatePayload.department = String(updatePayload.department).trim().toUpperCase();
    }

    updatePayload.updatedAt = new Date();

    const asset = await Asset.findOneAndUpdate(
      { assetId: req.params.assetId },
      { $set: updatePayload },
      { new: true, runValidators: true }
    );

    let blockchain = null;
    const ledgerSyncFields = ["status", "department", "location", "owner", "billHash"];
    const changeField = ledgerSyncFields.find((field) => req.body[field] !== undefined && req.body[field] !== existingAsset[field]);
    if (changeField) {
      blockchain = await updateAssetOnFabric(req.params.assetId, { field: changeField, newValue: asset[changeField] }).catch((error) => ({ success: false, error: error.message }));
    }

    res.json({
      ok: true,
      data: asset,
      blockchain
    });
  } catch (error) {
    next(error);
  }
}

async function deleteAsset(req, res, next) {
  try {
    const asset = await Asset.findOneAndDelete({ assetId: req.params.assetId });
    if (!asset) {
      return res.status(404).json({ ok: false, error: "Asset not found" });
    }
    res.json({
      ok: true,
      data: { message: "Asset deleted", asset }
    });
  } catch (error) {
    next(error);
  }
}

async function getAssetHistory(req, res, next) {
  try {
    const asset = await Asset.findOne({ assetId: req.params.assetId });
    if (!asset) {
      return res.status(404).json({ ok: false, error: "Asset not found" });
    }

    const timeline = [];

    if (asset.createdAt) {
      timeline.push({
        event: "Asset Created",
        date: asset.createdAt,
        details: `Asset ${asset.assetId} registered in ${asset.department}`
      });
    }
    if (asset.updatedAt && asset.updatedAt > asset.createdAt) {
      timeline.push({
        event: "Asset Updated",
        date: asset.updatedAt,
        details: `Asset record updated with status ${asset.status}`
      });
    }

    (asset.maintenanceRecords || []).forEach(record => {
      timeline.push({
        event: "Maintenance",
        date: record.maintenanceDate || record.createdAt,
        details: `${record.description} by ${record.technician} (${record.status})`
      });
    });

    if (asset.condemnationRecord) {
      timeline.push({
        event: "Condemnation",
        date: asset.condemnationRecord.requestedAt || asset.updatedAt,
        details: `Condemnation ${asset.condemnationRecord.status} by ${asset.condemnationRecord.requestedBy}`
      });
      if (asset.condemnationRecord.approvedAt) {
        timeline.push({
          event: "Condemnation Approved",
          date: asset.condemnationRecord.approvedAt,
          details: `Approved by ${asset.condemnationRecord.approvedBy}`
        });
      }
      if (asset.condemnationRecord.rejectedAt) {
        timeline.push({
          event: "Condemnation Rejected",
          date: asset.condemnationRecord.rejectedAt,
          details: `Rejected by ${asset.condemnationRecord.rejectedBy}`
        });
      }
    }

    timeline.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({
      ok: true,
      data: {
        asset,
        timeline
      }
    });
  } catch (error) {
    next(error);
  }
}

async function transferAsset(req, res, next) {
  try {
    const { assetId, toDepartment, newLocation, requestedBy, reason } = req.body;
    if (!assetId || !toDepartment) {
      return res.status(400).json({ ok: false, error: "assetId and toDepartment are required" });
    }

    const Department = require("../models/Department");
    const normalizedToDepartment = String(toDepartment).trim().toUpperCase();
    const departmentExists = await Department.findOne({ code: normalizedToDepartment });
    if (!departmentExists) {
      return res.status(400).json({ ok: false, error: "Destination department does not exist" });
    }

    const asset = await Asset.findOne({ assetId });
    if (!asset) {
      return res.status(404).json({ ok: false, error: "Asset not found" });
    }

    if (req.user && req.user.role === "DepartmentUser" && req.user.department) {
      if (asset.department.toUpperCase() !== req.user.department.toUpperCase()) {
        return res.status(403).json({ ok: false, error: "Cannot transfer asset from another department" });
      }
    }

    const fromDepartment = asset.department;
    asset.department = String(toDepartment).trim().toUpperCase();
    if (newLocation) asset.location = newLocation;
    asset.updatedAt = new Date();
    await asset.save();

    await recordAuditLog({
      actor: requestedBy || (req.user && (req.user.email || req.user.name)) || "system",
      role: (req.user && req.user.role) || "DepartmentUser",
      action: "TRANSFER_ASSET",
      resourceType: "Asset",
      resourceId: assetId,
      details: { fromDepartment, toDepartment: asset.department, newLocation, reason }
    }).catch(() => {});

    const blockchain = await updateAssetOnFabric(assetId, { field: "department", newValue: asset.department }).catch((error) => ({ success: false, error: error.message }));

    res.json({
      ok: true,
      data: {
        transferId: `XFR-${Date.now()}`,
        assetId,
        fromDepartment,
        toDepartment: asset.department,
        status: "Completed",
        blockchain
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getTransfers(req, res, next) {
  try {
    const { listAuditLogs } = require("../services/auditService");
    const auditLogs = await listAuditLogs({ action: "TRANSFER_ASSET" }, 1, 100);
    const transfers = (auditLogs.items || []).map(log => ({
      transferId: `XFR-${new Date(log.createdAt).getTime().toString().slice(-6)}`,
      assetId: log.resourceId,
      fromDepartment: log.details?.fromDepartment || "Origin",
      toDepartment: log.details?.toDepartment || "Destination",
      newLocation: log.details?.newLocation || "",
      requestedBy: log.actor || "User",
      reason: log.details?.reason || "Inter-department transfer",
      status: "Completed",
      createdAt: log.createdAt
    }));
    res.json({ ok: true, data: transfers });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createAsset,
  getAssets,
  getAsset,
  updateAsset,
  deleteAsset,
  getAssetHistory,
  transferAsset,
  getTransfers
};