const { createAssetOnFabric, updateAssetOnFabric, readAssetFromFabric, getAllAssetsFromFabric, getAssetHistoryFromFabric } = require('../services/fabricService');
const { checkDepartmentAccess } = require('../middleware/auth');

function getUserDepartment(req) {
  if (!req.user) return null;
  if (req.user.role === "Administrator" || req.user.department === "ALL") return null;
  if (req.user.department) return String(req.user.department).trim().toUpperCase();
  return null;
}

async function createAsset(req, res, next) {
  try {
    const payload = req.body || {};
    if (!payload.assetId || !payload.name) {
      return res.status(400).json({ ok: false, error: 'assetId and name are required' });
    }

    const userDept = getUserDepartment(req);

    if (userDept) {
      if (payload.department && String(payload.department).trim().toUpperCase() !== userDept) {
        return res.status(403).json({ ok: false, error: 'Cannot create assets for another department' });
      }
      payload.department = userDept;
    } else if (req.user && req.user.role === "Administrator") {
      payload.department = payload.department ? String(payload.department).trim().toUpperCase() : "ALL";
    } else if (payload.department) {
      payload.department = String(payload.department).trim().toUpperCase();
    }

    const fabricResult = await createAssetOnFabric(payload);
    if (!fabricResult || !fabricResult.success) {
      return res.status(500).json({ ok: false, error: 'Failed to create asset on Fabric', detail: fabricResult });
    }

    return res.status(201).json({ ok: true, data: { assetId: payload.assetId, blockchain: fabricResult } });
  } catch (err) {
    next(err);
  }
}

async function getAssets(req, res, next) {
  try {
    const department = req.query.department;
    let result = await getAllAssetsFromFabric();
    if (!result.success) return res.status(500).json({ ok: false, error: result.error });
    
    let assets = result.assets || [];
    const reqUser = req.user;

    if (reqUser && reqUser.role === "DepartmentUser" && reqUser.department) {
      const userDept = String(reqUser.department).toUpperCase();
      assets = assets.filter(a => (a.department || "").toUpperCase() === userDept);
    } else if (department) {
      assets = assets.filter(a => (a.department || "").toUpperCase() === String(department).toUpperCase());
    }

    res.json({ ok: true, data: assets });
  } catch (err) {
    next(err);
  }
}

async function getAsset(req, res, next) {
  try {
    const assetId = req.params.assetId;
    const result = await readAssetFromFabric(assetId);
    if (!result.success) return res.status(404).json({ ok: false, error: result.error || 'Asset not found on ledger' });
    if (req.user && !checkDepartmentAccess(req.user, result.asset.department)) {
      return res.status(403).json({ ok: false, error: 'Access denied to another department\'s asset' });
    }
    res.json({ ok: true, data: result.asset });
  } catch (err) {
    next(err);
  }
}

async function updateAsset(req, res, next) {
  try {
    const assetId = req.params.assetId;
    const assetRes = await readAssetFromFabric(assetId);
    if (!assetRes.success) return res.status(404).json({ ok: false, error: assetRes.error || 'Asset not found on ledger' });

    const existing = assetRes.asset;
    if (req.user && !checkDepartmentAccess(req.user, existing.department)) {
      return res.status(403).json({ ok: false, error: 'Access denied to update another department\'s asset' });
    }

    const updates = req.body || {};

    if (req.user && req.user.role === "DepartmentUser" && req.user.department) {
      const userDept = String(req.user.department).toUpperCase();
      if (updates.department && String(updates.department).trim().toUpperCase() !== userDept) {
        return res.status(403).json({ ok: false, error: 'Cannot move asset to another department' });
      }
    }

    // Only allow safe fields to be updated on ledger
    const allowed = ["status", "department", "location", "owner", "billHash", "name", "description", "category"];
    const fields = Object.keys(updates).filter(k => allowed.includes(k));
    if (fields.length === 0) {
      return res.status(400).json({ ok: false, error: 'No allowed fields to update' });
    }

    // Perform ledger updates sequentially and collect results
    const results = [];
    for (const field of fields) {
      const newValue = updates[field];
      const r = await updateAssetOnFabric(assetId, { field, newValue }).catch(e => ({ success: false, error: e.message }));
      results.push({ field, result: r });
    }

    res.json({ ok: true, data: { assetId, updates: results } });
  } catch (err) {
    next(err);
  }
}

async function deleteAsset(req, res, next) {
  try {
    const assetId = req.params.assetId;
    const assetRes = await readAssetFromFabric(assetId);
    if (!assetRes.success || !assetRes.asset) {
      return res.status(404).json({ ok: false, error: 'Asset not found on ledger' });
    }
    if (req.user && !checkDepartmentAccess(req.user, assetRes.asset.department)) {
      return res.status(403).json({ ok: false, error: 'Access denied to delete another department\'s asset' });
    }
    if (req.user && req.user.role === "DepartmentUser" && !req.user.department) {
      return res.status(403).json({ ok: false, error: 'Access denied' });
    }
    const r = await updateAssetOnFabric(assetId, { field: 'status', newValue: 'Disposed' }).catch(e => ({ success: false, error: e.message }));
    if (!r || !r.success) return res.status(500).json({ ok: false, error: r.error || 'Failed to mark asset disposed on ledger' });
    res.json({ ok: true, data: { assetId, blockchain: r } });
  } catch (err) {
    next(err);
  }
}

async function getAssetHistory(req, res, next) {
  try {
    const assetId = req.params.assetId;
    const fabricRes = await readAssetFromFabric(assetId);
    if (!fabricRes.success || !fabricRes.asset) {
      return res.status(404).json({ ok: false, error: 'Asset not found on ledger' });
    }

    const asset = fabricRes.asset;
    const historyRes = await getAssetHistoryFromFabric(assetId);

    const timeline = [];
    if (asset.createdAt) {
      timeline.push({
        event: 'Asset Created',
        date: asset.createdAt,
        details: `Asset ${asset.assetId} registered in ${asset.department}`
      });
    }

    if (historyRes.success && Array.isArray(historyRes.history)) {
      historyRes.history.forEach((item, idx) => {
        try {
          const val = JSON.parse(item.value);
          let dateStr = item.timestamp;
          if (typeof dateStr !== 'string' || dateStr === '[object Object]') {
            // Fabric timestamp is a protobuf Timestamp object - use index ordering
            dateStr = val.updatedAt || val.createdAt || new Date().toISOString();
          }
          timeline.push({
            event: item.isDelete ? 'Asset Ledger Deleted' : 'Asset Ledger Update',
            date: dateStr,
            details: `Ledger Status: ${val.status || 'Updated'}, Department: ${val.department || 'N/A'}`
          });
        } catch (e) {}
      });
    }

    (asset.maintenanceRecords || []).forEach(record => {
      timeline.push({
        event: 'Maintenance',
        date: record.maintenanceDate || record.createdAt,
        details: `${record.description} by ${record.technician} (${record.status})`
      });
    });

    if (asset.condemnationRecord) {
      timeline.push({
        event: 'Condemnation Request',
        date: asset.condemnationRecord.requestedAt || asset.updatedAt,
        details: `Condemnation ${asset.condemnationRecord.status} by ${asset.condemnationRecord.requestedBy}`
      });
    }

    timeline.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({
      ok: true,
      data: {
        asset,
        timeline
      }
    });
  } catch (err) {
    next(err);
  }
}

async function transferAsset(req, res, next) {
  try {
    const { assetId, toDepartment, newLocation, fromDepartment } = req.body || {};
    if (!assetId || !toDepartment) return res.status(400).json({ ok: false, error: 'assetId and toDepartment required' });
    const dept = String(toDepartment).trim().toUpperCase();

    // Check access to the asset
    const assetRes = await readAssetFromFabric(assetId);
    if (!assetRes.success || !assetRes.asset) {
      return res.status(404).json({ ok: false, error: 'Asset not found on ledger' });
    }
    if (req.user && !checkDepartmentAccess(req.user, assetRes.asset.department)) {
      return res.status(403).json({ ok: false, error: 'Access denied to transfer this asset' });
    }

    const results = [];
    const transferRecords = [];
    const fromDept = String(fromDepartment || assetRes.asset.department || 'UNKNOWN').toUpperCase();

    // Record transfer only if department changes
    if (dept !== fromDept) {
      transferRecords.push({
        transferId: `XFR-${Date.now()}`,
        assetId,
        fromDepartment: fromDept,
        toDepartment: dept,
        reason: req.body.reason || 'Department transfer',
        createdAt: new Date().toISOString()
      });
    }

    const dRes = await updateAssetOnFabric(assetId, { field: 'department', newValue: dept }).catch(e => ({ success: false, error: e.message }));
    results.push({ field: 'department', result: dRes });

    if (newLocation) {
      const lRes = await updateAssetOnFabric(assetId, { field: 'location', newValue: newLocation }).catch(e => ({ success: false, error: e.message }));
      results.push({ field: 'location', result: lRes });
    }

    res.json({ ok: true, data: { assetId, results, transfers: transferRecords } });
  } catch (err) {
    next(err);
  }
}

async function getTransfers(req, res, next) {
  try {
    const assetId = req.query.assetId;
    const reqUser = req.user;

    if (assetId) {
      // Check asset access first
      const assetRes = await readAssetFromFabric(assetId);
      if (!assetRes.success || !assetRes.asset) {
        return res.status(404).json({ ok: false, error: 'Asset not found' });
      }
      if (req.user && !checkDepartmentAccess(req.user, assetRes.asset.department)) {
        return res.status(403).json({ ok: false, error: 'Access denied' });
      }

      const hist = await getAssetHistoryFromFabric(assetId);
      if (!hist.success) return res.status(500).json({ ok: false, error: hist.error });
      
      // Parse history to find actual department changes (transfers)
      const transfers = [];
      const history = hist.history || [];
      let lastDept = null;
      
      for (let i = 0; i < history.length; i++) {
        try {
          const val = JSON.parse(history[i].value);
          const currentDept = val.department;
          if (currentDept && currentDept !== lastDept) {
            if (lastDept !== null) {
              transfers.push({
                transferId: `XFR-${i}-${history[i].txId || ''}`,
                assetId,
                fromDepartment: lastDept,
                toDepartment: currentDept,
                timestamp: typeof history[i].timestamp === 'string' && history[i].timestamp !== '[object Object]' 
                  ? history[i].timestamp 
                  : (val.updatedAt || val.createdAt || new Date().toISOString()),
                reason: 'Department transfer'
              });
            }
            lastDept = currentDept;
          }
        } catch (e) {}
      }
      
      return res.json({ ok: true, data: transfers });
    }

    const all = await getAllAssetsFromFabric();
    if (!all.success) return res.status(500).json({ ok: false, error: all.error });

    let assets = all.assets || [];
    if (reqUser && reqUser.role === "DepartmentUser" && reqUser.department) {
      const userDept = String(reqUser.department).toUpperCase();
      assets = assets.filter(a => (a.department || "").toUpperCase() === userDept);
    }

    return res.json({ ok: true, data: assets });
  } catch (err) {
    next(err);
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
