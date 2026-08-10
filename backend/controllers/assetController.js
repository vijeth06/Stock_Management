const {
  createAssetOnFabric,
  updateAssetOnFabric,
  readAssetFromFabric,
  getAllAssetsFromFabric,
  deleteAssetFromFabric,
  getAssetHistoryFromFabric,
  getAllDepartmentsFromFabric,
  createDepartmentOnFabric,
  getAllCondemnationRecordsFromFabric
} = require("../services/fabricService");
const { checkDepartmentAccess } = require("../middleware/auth");

async function createAsset(req, res, next) {
  try {
    let {
      assetId, department, category, name, description, purchaseDate,
      purchaseValue, location, owner, warrantyExpiry, billHash, status
    } = req.body;

    if (!assetId || !name) {
      return res.status(400).json({ ok: false, error: "assetId and name are required" });
    }

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

    const existingRes = await readAssetFromFabric(assetId);
    if (existingRes.success && existingRes.asset) {
      return res.status(409).json({ ok: false, error: "Asset ID already exists" });
    }

    if (!department && req.user && req.user.role === "Administrator") {
      department = "ALL";
    }

    const assetData = {
      assetId,
      department: department || (req.user && req.user.role === "Administrator" ? "ALL" : req.user.department || "IT"),
      category: category || "General",
      name,
      description: description || "",
      purchaseDate: purchaseDate || new Date().toISOString().split('T')[0],
      purchaseValue: Number(purchaseValue || 0),
      location: location || "Default Location",
      owner: owner || "Unassigned",
      warrantyExpiry: warrantyExpiry || "",
      billHash: billHash || "",
      status: status || "Active"
    };

    const fabricRes = await createAssetOnFabric(assetData);
    if (!fabricRes.success) {
      return res.status(500).json({ ok: false, error: fabricRes.error || "Failed to create asset on ledger" });
    }

    const asset = {
      ...assetData,
      _id: `asset-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    res.status(200).json({
      ok: true,
      data: asset,
      blockchain: fabricRes
    });
  } catch (error) {
    next(error);
  }
}

async function getAssets(req, res, next) {
  try {
    const { department, category, status, page = 1, limit = 50 } = req.query;
    const fabricRes = await getAllAssetsFromFabric();
    let assets = fabricRes.assets || [];

    if (req.user && req.user.role === "DepartmentUser" && req.user.department) {
      const userDept = String(req.user.department).toUpperCase();
      assets = assets.filter(a => (a.department || '').toUpperCase() === userDept);
    } else if (department) {
      assets = assets.filter(a => (a.department || '').toUpperCase() === String(department).toUpperCase());
    }

    if (category) {
      assets = assets.filter(a => (a.category || '').toLowerCase() === String(category).toLowerCase());
    }

    if (status) {
      assets = assets.filter(a => (a.status || '').toLowerCase() === String(status).toLowerCase());
    }

    const total = assets.length;
    const skip = (Number(page) - 1) * Number(limit);
    const paginated = assets.slice(skip, skip + Number(limit));

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

async function getAsset(req, res, next) {
  try {
    const assetId = req.params.assetId;
    const fabricRes = await readAssetFromFabric(assetId);
    if (!fabricRes.success || !fabricRes.asset) {
      return res.status(404).json({ ok: false, error: "Asset not found" });
    }

    const asset = fabricRes.asset;
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
    const assetId = req.params.assetId;
    const fabricRes = await readAssetFromFabric(assetId);
    if (!fabricRes.success || !fabricRes.asset) {
      return res.status(404).json({ ok: false, error: "Asset not found" });
    }

    const existingAsset = fabricRes.asset;
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

    let lastBlockchainRes = null;
    const updatedAsset = { ...existingAsset };

    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined && req.body[key] !== existingAsset[key]) {
        let val = req.body[key];
        if (key === "department") val = String(val).trim().toUpperCase();
        updatedAsset[key] = val;

        const updateRes = await updateAssetOnFabric(assetId, { field: key, newValue: val });
        if (!updateRes.success) {
          return res.status(400).json({ ok: false, error: updateRes.error || `Failed to update ${key}` });
        }
        lastBlockchainRes = updateRes;
      }
    }

    res.json({
      ok: true,
      data: updatedAsset,
      blockchain: lastBlockchainRes
    });
  } catch (error) {
    next(error);
  }
}

async function deleteAsset(req, res, next) {
  try {
    const assetId = req.params.assetId;
    const fabricRes = await readAssetFromFabric(assetId);
    if (!fabricRes.success || !fabricRes.asset) {
      return res.status(404).json({ ok: false, error: "Asset not found" });
    }

    await deleteAssetFromFabric(assetId);
    res.json({
      ok: true,
      data: { message: "Asset deleted", asset: fabricRes.asset }
    });
  } catch (error) {
    next(error);
  }
}

async function getAssetHistory(req, res, next) {
  try {
    const assetId = req.params.assetId;
    const fabricRes = await readAssetFromFabric(assetId);
    if (!fabricRes.success || !fabricRes.asset) {
      return res.status(404).json({ ok: false, error: "Asset not found" });
    }

    const asset = fabricRes.asset;
    const historyRes = await getAssetHistoryFromFabric(assetId);

    const timeline = [];
    if (asset.createdAt) {
      timeline.push({
        event: "Asset Created",
        type: "creation",
        action: "create",
        date: asset.createdAt,
        details: `Asset ${asset.assetId} registered in ${asset.department}`
      });
    }

    if (historyRes.success && Array.isArray(historyRes.history)) {
      historyRes.history.forEach(item => {
        try {
          const val = JSON.parse(item.value);
          const eventData = {
            event: item.isDelete ? "Asset Ledger Deleted" : "Asset Ledger Update",
            type: val.status ? "status_update" : "ledger_update",
            action: "update",
            date: item.timestamp,
            details: `Ledger Status: ${val.status || 'Updated'}, Department: ${val.department || 'N/A'}`,
            previousStatus: val.previousStatus,
            newStatus: val.status,
            field: val.updatedField,
            newValue: val.newValue
          };
          
          if (val.status === "CONDEMNATION_REQUESTED" || val.status === "Condemned") {
            eventData.event = "Condemnation";
            eventData.type = "condemnation";
            eventData.action = "condemn";
          } else if (val.previousStatus && val.status && val.previousStatus !== val.status) {
            eventData.event = "Status Change";
            eventData.type = "status_change";
            eventData.action = "status";
          }
          
          timeline.push(eventData);
        } catch (e) {}
      });
    }

    (asset.maintenanceRecords || []).forEach(record => {
      timeline.push({
        event: "Maintenance",
        type: "maintenance",
        action: "maintenance",
        date: record.maintenanceDate || record.createdAt,
        details: `${record.description} by ${record.technician} (${record.status})`
      });
    });

    if (asset.condemnationRecord) {
      timeline.push({
        event: "Condemnation Request",
        type: "condemnation",
        action: "condemn",
        date: asset.condemnationRecord.requestedAt || asset.updatedAt,
        details: `Condemnation ${asset.condemnationRecord.status} by ${asset.condemnationRecord.requestedBy}`
      });
    }

    try {
      const condRes = await getAllCondemnationRecordsFromFabric();
      if (condRes.success && Array.isArray(condRes.records)) {
        const assetCondemations = condRes.records.filter(r => r.assetId === assetId);
        assetCondemations.forEach(rec => {
          timeline.push({
            event: "Condemnation Record",
            type: "condemnation",
            action: "condemn",
            date: rec.requestedAt || rec.createdAt,
            details: `Condemnation ${rec.status} requested by ${rec.requestedBy || rec.createdBy || 'Unknown'}`
          });
        });
      }
    } catch (e) {}

    if (asset.transfers && Array.isArray(asset.transfers)) {
      asset.transfers.forEach(t => {
        timeline.push({
          event: "Transfer",
          type: "transfer",
          action: "transfer",
          date: t.transferDate || t.createdAt,
          details: `Transferred from ${t.fromDepartment} to ${t.toDepartment}`
        });
      });
    }

    if (historyRes.success && Array.isArray(historyRes.history)) {
      historyRes.history.forEach((item, idx) => {
        try {
          const val = JSON.parse(item.value);
          if (val.updatedField === "department" && val.newValue && val.previousValue && val.newValue !== val.previousValue) {
            if (!timeline.some(t => t.type === "transfer" && t.date === item.timestamp)) {
              timeline.push({
                event: "Transfer",
                type: "transfer",
                action: "transfer",
                date: item.timestamp,
                details: `Transferred from ${val.previousValue} to ${val.newValue}`
              });
            }
          }
        } catch (e) {}
      });
      
      for (let i = 1; i < historyRes.history.length; i++) {
        try {
          const prev = JSON.parse(historyRes.history[i - 1].value);
          const curr = JSON.parse(historyRes.history[i].value);
          if (prev.department && curr.department && prev.department !== curr.department) {
            if (!timeline.some(t => t.type === "transfer" && t.date === historyRes.history[i].timestamp)) {
              timeline.push({
                event: "Transfer",
                type: "transfer",
                action: "transfer",
                date: historyRes.history[i].timestamp,
                details: `Transferred from ${prev.department} to ${curr.department}`
              });
            }
          }
        } catch (e) {}
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

    const normalizedToDepartment = String(toDepartment).trim().toUpperCase();
    const deptsRes = await getAllDepartmentsFromFabric();
    const depts = deptsRes.departments || [];
    const deptExists = depts.some(d => (d.code || '').toUpperCase() === normalizedToDepartment) || normalizedToDepartment === "IT";
    if (!deptExists) {
      await createDepartmentOnFabric({ code: normalizedToDepartment, name: `${normalizedToDepartment} Department` }).catch(() => {});
    }

    const assetRes = await readAssetFromFabric(assetId);
    if (!assetRes.success || !assetRes.asset) {
      return res.status(404).json({ ok: false, error: "Asset not found" });
    }

    const asset = assetRes.asset;
    if (req.user && req.user.role === "DepartmentUser" && req.user.department) {
      if (asset.department.toUpperCase() !== req.user.department.toUpperCase()) {
        return res.status(403).json({ ok: false, error: "Cannot transfer asset from another department" });
      }
    }

    const fromDepartment = asset.department;
    await updateAssetOnFabric(assetId, { field: "department", newValue: normalizedToDepartment });
    if (newLocation) {
      await updateAssetOnFabric(assetId, { field: "location", newValue: newLocation });
    }

    asset.department = normalizedToDepartment;
    if (newLocation) asset.location = newLocation;

    res.json({
      ok: true,
      data: {
        transferId: `XFR-${Date.now()}`,
        assetId,
        fromDepartment,
        toDepartment: normalizedToDepartment,
        status: "Completed"
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getTransfers(req, res, next) {
  try {
    const assetsRes = await getAllAssetsFromFabric();
    let assets = assetsRes.assets || [];

    const reqUser = req.user;
    if (reqUser && reqUser.role === "DepartmentUser" && reqUser.department) {
      const userDept = String(reqUser.department).toUpperCase();
      assets = assets.filter(a => (a.department || "").toUpperCase() === userDept);
    }

    const transfers = assets
      .filter(a => a.maintenanceRecords && a.maintenanceRecords.length > 0)
      .map(a => ({
        transferId: `XFR-${a.assetId}`,
        assetId: a.assetId,
        fromDepartment: "IT",
        toDepartment: a.department,
        status: "Completed",
        createdAt: a.updatedAt || a.createdAt
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