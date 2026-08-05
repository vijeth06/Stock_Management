const {
  addMaintenanceOnFabric,
  readAssetFromFabric,
  updateAssetOnFabric,
  getAllMaintenanceRecordsFromFabric
} = require("../services/fabricService");

async function createMaintenanceRecord(req, res, next) {
  try {
    const { assetId, technician, maintenanceDate, description, cost, status } = req.body;

    const assetRes = await readAssetFromFabric(assetId);
    if (!assetRes.success || !assetRes.asset) {
      return res.status(404).json({ ok: false, error: "Asset not found" });
    }

    const asset = assetRes.asset;
    if (["Condemned", "Disposed", "Retired", "Condemnation Requested"].includes(asset.status)) {
      return res.status(400).json({ ok: false, error: `Cannot schedule maintenance for asset in '${asset.status}' state` });
    }

    const mntRes = await addMaintenanceOnFabric(assetId, {
      technician: technician || "Technician",
      maintenanceDate: maintenanceDate || new Date().toISOString().split('T')[0],
      description: description || "Routine maintenance",
      cost: Number(cost || 0),
      status: status || "Completed"
    });

    if (!mntRes.success) {
      return res.status(500).json({ ok: false, error: mntRes.error || "Failed to log maintenance on ledger" });
    }

    if (asset.status !== "Maintenance" && (status || "Completed") !== "Completed") {
      await updateAssetOnFabric(assetId, { field: "status", newValue: "Maintenance" });
    }

    const record = mntRes.result || {
      recordId: `MNT-${Date.now()}`,
      assetId,
      technician,
      maintenanceDate,
      description,
      cost,
      status: status || "Completed",
      createdAt: new Date().toISOString()
    };

    res.status(201).json({
      ok: true,
      data: record,
      blockchain: mntRes
    });
  } catch (error) {
    next(error);
  }
}

async function getMaintenanceRecords(req, res, next) {
  try {
    const { assetId, status, page = 1, limit = 50 } = req.query;
    const recordsRes = await getAllMaintenanceRecordsFromFabric();
    let records = recordsRes.records || [];

    if (assetId) {
      records = records.filter(r => r.assetId === assetId);
    }
    if (status) {
      records = records.filter(r => r.status === status);
    }

    const total = records.length;
    const skip = (Number(page) - 1) * Number(limit);
    const paginated = records.slice(skip, skip + Number(limit));

    res.json({
      ok: true,
      data: paginated,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getMaintenanceRecord(req, res, next) {
  try {
    const recordId = req.params.recordId;
    const recordsRes = await getAllMaintenanceRecordsFromFabric();
    const records = recordsRes.records || [];
    const record = records.find(r => r.recordId === recordId || r._id === recordId);

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
    const recordId = req.params.recordId;
    const recordsRes = await getAllMaintenanceRecordsFromFabric();
    const records = recordsRes.records || [];
    const record = records.find(r => r.recordId === recordId || r._id === recordId);

    if (!record) {
      return res.status(404).json({ ok: false, error: "Maintenance record not found" });
    }

    const updated = {
      ...record,
      ...req.body,
      updatedAt: new Date().toISOString()
    };

    if (updated.status === "Completed") {
      await updateAssetOnFabric(updated.assetId, { field: "status", newValue: "Active" });
    }

    res.json({
      ok: true,
      data: updated
    });
  } catch (error) {
    next(error);
  }
}

async function getMaintenanceHistory(req, res, next) {
  try {
    const assetId = req.params.assetId;
    const assetRes = await readAssetFromFabric(assetId);
    if (!assetRes.success || !assetRes.asset) {
      return res.status(404).json({ ok: false, error: "Asset not found" });
    }

    const recordsRes = await getAllMaintenanceRecordsFromFabric();
    const records = (recordsRes.records || []).filter(r => r.assetId === assetId);

    res.json({
      ok: true,
      data: {
        assetId,
        maintenanceRecords: records,
        totalRecords: records.length,
        totalCost: records.reduce((sum, r) => sum + (Number(r.cost) || 0), 0)
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