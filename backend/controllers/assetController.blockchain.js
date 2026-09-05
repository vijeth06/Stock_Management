const { createAssetOnFabric, updateAssetOnFabric, readAssetFromFabric, getAllAssetsFromFabric, getAssetHistoryFromFabric, getAssetLifecycleOnFabric, getAssetAuditTrailOnFabric, bulkImportAssetsOnFabric, bulkTransferAssetsOnFabric, getAllCondemnationRecordsFromFabric, getAllTransfersFromFabric, approveTransferOnFabric, rejectTransferOnFabric } = require('../services/fabricService');
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

    if (payload.purchaseValue !== undefined && Number(payload.purchaseValue) < 0) {
      return res.status(400).json({ ok: false, error: 'Purchase value cannot be negative' });
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
    const searchName = req.query.name;
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
    
    if (searchName) {
      const searchTerm = String(searchName).toLowerCase();
      assets = assets.filter(a => 
        (a.name || '').toLowerCase().includes(searchTerm) ||
        (a.assetId || '').toLowerCase().includes(searchTerm)
      );
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

    const failed = results.find(r => !r.result || r.result.success === false);
    if (failed) {
      return res.status(400).json({ ok: false, error: failed.result.error || 'Update failed on ledger', details: results });
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

    if (req.user && !checkDepartmentAccess(req.user, fabricRes.asset.department)) {
      return res.status(403).json({ ok: false, error: 'Access denied to another department\'s asset' });
    }

    const asset = fabricRes.asset;
    const historyRes = await getAssetHistoryFromFabric(assetId);

    const timeline = [];
    if (asset.createdAt) {
      timeline.push({
        event: 'Asset Created',
        type: 'creation',
        action: 'create',
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
            dateStr = val.updatedAt || val.createdAt || new Date().toISOString();
          }
          const eventData = {
            event: item.isDelete ? 'Asset Ledger Deleted' : 'Asset Ledger Update',
            type: val.status ? 'status_update' : 'ledger_update',
            action: 'update',
            date: dateStr,
            details: `Ledger Status: ${val.status || 'Updated'}, Department: ${val.department || 'N/A'}`,
            previousStatus: val.previousStatus,
            newStatus: val.status,
            field: val.updatedField,
            newValue: val.newValue
          };

          if (val.status === 'CONDEMNATION_REQUESTED' || val.status === 'Condemned') {
            eventData.event = 'Condemnation';
            eventData.type = 'condemnation';
            eventData.action = 'condemn';
          } else if (val.previousStatus && val.status && val.previousStatus !== val.status) {
            eventData.event = 'Status Change';
            eventData.type = 'status_change';
            eventData.action = 'status';
          }

          // Detect department transfer from history
          if (val.department && idx > 0) {
            try {
              const prevVal = JSON.parse(historyRes.history[idx - 1].value);
              if (prevVal.department && prevVal.department !== val.department) {
                eventData.event = 'Transfer';
                eventData.type = 'transfer';
                eventData.action = 'transfer';
                eventData.details = `Transferred from ${prevVal.department} to ${val.department}`;
              }
            } catch (e) {}
          }

          timeline.push(eventData);
        } catch (e) {}
      });
    }

    (asset.maintenanceRecords || []).forEach(record => {
      timeline.push({
        event: 'Maintenance',
        type: 'maintenance',
        action: 'maintenance',
        date: record.maintenanceDate || record.createdAt,
        details: `${record.description} by ${record.technician} (${record.status})`
      });
    });

    if (asset.condemnationRecord) {
      timeline.push({
        event: 'Condemnation Request',
        type: 'condemnation',
        action: 'condemn',
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
            event: 'Condemnation Record',
            type: 'condemnation',
            action: 'condemn',
            date: rec.requestedAt || rec.createdAt,
            details: `Condemnation ${rec.status} requested by ${rec.requestedBy || rec.createdBy || 'Unknown'}`
          });
        });
      }
    } catch (e) {}

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
    const { assetId, toDepartment, newLocation, fromDepartment, reason } = req.body || {};
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

    // DepartmentUser can only transfer assets from their own department and to another department (requires approval)
    if (req.user && req.user.role === "DepartmentUser" && req.user.department) {
      const userDept = String(req.user.department).toUpperCase();
      const fromDept = String(fromDepartment || assetRes.asset.department || 'UNKNOWN').toUpperCase();
      if (fromDept !== userDept) {
        return res.status(403).json({ ok: false, error: 'Cannot transfer asset from another department' });
      }
    }

    const fromDept = String(fromDepartment || assetRes.asset.department || 'UNKNOWN').toUpperCase();

    // Create transfer request on blockchain - requires approval
    const transferRes = await bulkTransferAssetsOnFabric([assetId], dept, reason || 'Department transfer');
    if (!transferRes.success) {
      return res.status(500).json({ ok: false, error: transferRes.error });
    }

    res.json({ ok: true, data: transferRes.result });
  } catch (err) {
    next(err);
  }
}

async function approveTransfer(req, res, next) {
  try {
    const { transferId } = req.params || req.body || {};
    if (!transferId) return res.status(400).json({ ok: false, error: 'transferId required' });

    // Get transfer details to check destination department
    const transfersRes = await getAllTransfersFromFabric();
    if (!transfersRes.success) return res.status(500).json({ ok: false, error: transfersRes.error });
    const transfer = (transfersRes.transfers || []).find(t => t.transferId === transferId);
    if (!transfer) return res.status(404).json({ ok: false, error: 'Transfer request not found' });

    const reqUser = req.user;
    const userDept = getUserDepartment(req);
    const toDept = String(transfer.toDepartment || '').toUpperCase();

    // Admin/AuditOfficer can approve any transfer
    // DepartmentUser can approve transfers to their own department
    if (userDept && reqUser?.role === "DepartmentUser") {
      if (toDept !== userDept) {
        return res.status(403).json({ ok: false, error: 'Only admin, audit officer, or the destination department can approve this transfer' });
      }
    }

    const approvedBy = req.user?.email || req.user?.sub || 'Admin';
    const result = await approveTransferOnFabric(transferId, approvedBy);
    if (!result.success) {
      return res.status(500).json({ ok: false, error: result.error });
    }

    res.json({ ok: true, data: result.result });
  } catch (err) {
    next(err);
  }
}

async function rejectTransfer(req, res, next) {
  try {
    const { transferId } = req.params || req.body || {};
    if (!transferId) return res.status(400).json({ ok: false, error: 'transferId required' });

    // Get transfer details to check both source and destination departments
    const transfersRes = await getAllTransfersFromFabric();
    if (!transfersRes.success) return res.status(500).json({ ok: false, error: transfersRes.error });
    const transfer = (transfersRes.transfers || []).find(t => t.transferId === transferId);
    if (!transfer) return res.status(404).json({ ok: false, error: 'Transfer request not found' });

    const reqUser = req.user;
    const userDept = getUserDepartment(req);
    const fromDept = String(transfer.fromDepartment || '').toUpperCase();
    const toDept = String(transfer.toDepartment || '').toUpperCase();

    // Admin/AuditOfficer can reject any transfer
    // DepartmentUser can reject transfers from their department (source) or to their department (destination)
    if (userDept && reqUser?.role === "DepartmentUser") {
      if (toDept !== userDept && fromDept !== userDept) {
        return res.status(403).json({ ok: false, error: 'Only admin, audit officer, or the source/destination department can reject this transfer' });
      }
    }

    const rejectedBy = req.user?.email || req.user?.sub || 'Admin';
    const result = await rejectTransferOnFabric(transferId, rejectedBy);
    if (!result.success) {
      return res.status(500).json({ ok: false, error: result.error });
    }

    res.json({ ok: true, data: result.result });
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

    // When no assetId is provided, return transfer records filtered by department for DepartmentUser
    const transfersRes = await getAllTransfersFromFabric();
    if (transfersRes.success) {
        let transfers = transfersRes.transfers || [];
        const reqUser = req.user;
        if (reqUser && reqUser.role === "DepartmentUser" && reqUser.department) {
            const userDept = String(reqUser.department).toUpperCase();
            transfers = transfers.filter(t => {
                const fromDept = String(t.fromDepartment || '').toUpperCase();
                const toDept = String(t.toDepartment || '').toUpperCase();
                return fromDept === userDept || toDept === userDept;
            });
        }
        return res.json({ ok: true, data: transfers });
    }
    return res.json({ ok: true, data: [] });
   } catch (err) {
      next(err);
   }
}

async function getAssetLifecycle(req, res, next) {
  try {
    const assetId = req.params.assetId;
    const assetRes = await readAssetFromFabric(assetId);
    if (!assetRes.success || !assetRes.asset) {
      return res.status(404).json({ ok: false, error: 'Asset not found on ledger' });
    }
    if (req.user && !checkDepartmentAccess(req.user, assetRes.asset.department)) {
      return res.status(403).json({ ok: false, error: 'Access denied' });
    }

    const lifecycleRes = await getAssetLifecycleOnFabric(assetId);
    if (!lifecycleRes.success) {
      return res.status(500).json({ ok: false, error: lifecycleRes.error });
    }

    res.json({ ok: true, data: lifecycleRes.lifecycle });
  } catch (err) {
    next(err);
  }
}

async function getAssetAuditTrail(req, res, next) {
  try {
    const assetId = req.params.assetId;
    const assetRes = await readAssetFromFabric(assetId);
    if (!assetRes.success || !assetRes.asset) {
      return res.status(404).json({ ok: false, error: 'Asset not found on ledger' });
    }
    if (req.user && !checkDepartmentAccess(req.user, assetRes.asset.department)) {
      return res.status(403).json({ ok: false, error: 'Access denied' });
    }

    const auditRes = await getAssetAuditTrailOnFabric(assetId);
    if (!auditRes.success) {
      return res.status(500).json({ ok: false, error: auditRes.error });
    }

    res.json({ ok: true, data: auditRes.auditTrail });
  } catch (err) {
    next(err);
  }
}

async function bulkImportAssets(req, res, next) {
  try {
    const { assets } = req.body || {};
    if (!Array.isArray(assets) || assets.length === 0) {
      return res.status(400).json({ ok: false, error: 'assets array is required' });
    }

    const result = await bulkImportAssetsOnFabric(assets);
    if (!result.success) {
      return res.status(500).json({ ok: false, error: result.error });
    }

    res.status(201).json({
      ok: true,
      data: result.result
    });
  } catch (err) {
    next(err);
  }
}

async function bulkTransferAssets(req, res, next) {
  try {
    const { assetIds, toDepartment } = req.body || {};
    if (!Array.isArray(assetIds) || assetIds.length === 0) {
      return res.status(400).json({ ok: false, error: 'assetIds array is required' });
    }
    if (!toDepartment) {
      return res.status(400).json({ ok: false, error: 'toDepartment is required' });
    }

    const normalizedDept = String(toDepartment).trim().toUpperCase();

    // For DepartmentUser, verify all assets belong to their department
    if (req.user && req.user.role === "DepartmentUser" && req.user.department) {
      const userDept = String(req.user.department).toUpperCase();
      const allRes = await getAllAssetsFromFabric();
      const assets = allRes.assets || [];
      const userAssetIds = new Set(assets
        .filter(a => (a.department || "").toUpperCase() === userDept)
        .map(a => a.assetId)
      );

      for (const id of assetIds) {
        if (!userAssetIds.has(id)) {
          return res.status(403).json({ ok: false, error: `Cannot transfer asset ${id}: not in your department` });
        }
      }
    }

    const result = await bulkTransferAssetsOnFabric(assetIds, normalizedDept);
    if (!result.success) {
      return res.status(500).json({ ok: false, error: result.error });
    }

    res.json({ ok: true, data: result.result });
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
  approveTransfer,
  rejectTransfer,
  getTransfers,
  getAssetLifecycle,
  getAssetAuditTrail,
  bulkImportAssets,
  bulkTransferAssets
};
