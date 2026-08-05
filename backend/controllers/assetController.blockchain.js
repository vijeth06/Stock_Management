const { createAssetOnFabric, updateAssetOnFabric, readAssetFromFabric, getAllAssetsFromFabric, getAssetHistoryFromFabric } = require('../services/fabricService');

async function createAsset(req, res, next) {
  try {
    const payload = req.body || {};
    // Normalize department
    if (payload.department) payload.department = String(payload.department).trim().toUpperCase();

    // Create asset on Fabric ledger (primary source)
    const fabricResult = await createAssetOnFabric(payload);
    if (!fabricResult || !fabricResult.success) {
      return res.status(500).json({ ok: false, error: 'Failed to create asset on Fabric', detail: fabricResult });
    }

    // Return ledger-backed asset representation
    return res.status(201).json({ ok: true, data: { assetId: payload.assetId, blockchain: fabricResult } });
  } catch (err) {
    next(err);
  }
}

async function getAssets(req, res, next) {
  try {
    const result = await getAllAssetsFromFabric();
    if (!result.success) return res.status(500).json({ ok: false, error: result.error });
    res.json({ ok: true, data: result.assets });
  } catch (err) {
    next(err);
  }
}

async function getAsset(req, res, next) {
  try {
    const assetId = req.params.assetId;
    const result = await readAssetFromFabric(assetId);
    if (!result.success) return res.status(404).json({ ok: false, error: result.error || 'Asset not found on ledger' });
    res.json({ ok: true, data: result.asset });
  } catch (err) {
    next(err);
  }
}

async function updateAsset(req, res, next) {
  try {
    const assetId = req.params.assetId;
    const updates = req.body || {};

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
    // In a blockchain-first setup, prefer marking asset as Disposed on ledger
    const assetId = req.params.assetId;
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
    const result = await getAssetHistoryFromFabric(assetId);
    if (!result.success) return res.status(500).json({ ok: false, error: result.error });
    res.json({ ok: true, data: { assetId, timeline: result.history } });
  } catch (err) {
    next(err);
  }
}

async function transferAsset(req, res, next) {
  try {
    const { assetId, toDepartment, newLocation } = req.body || {};
    if (!assetId || !toDepartment) return res.status(400).json({ ok: false, error: 'assetId and toDepartment required' });
    const dept = String(toDepartment).trim().toUpperCase();

    const results = [];
    const dRes = await updateAssetOnFabric(assetId, { field: 'department', newValue: dept }).catch(e => ({ success: false, error: e.message }));
    results.push({ field: 'department', result: dRes });

    if (newLocation) {
      const lRes = await updateAssetOnFabric(assetId, { field: 'location', newValue: newLocation }).catch(e => ({ success: false, error: e.message }));
      results.push({ field: 'location', result: lRes });
    }

    res.json({ ok: true, data: { assetId, results } });
  } catch (err) {
    next(err);
  }
}

async function getTransfers(req, res, next) {
  try {
    // Return transfer-like events from asset histories for the given assetId query or all assets
    const assetId = req.query.assetId;
    if (assetId) {
      const hist = await getAssetHistoryFromFabric(assetId);
      if (!hist.success) return res.status(500).json({ ok: false, error: hist.error });
      const transfers = (hist.history || []).filter(h => {
        try {
          return JSON.stringify(h).toLowerCase().includes('department') || JSON.stringify(h).toLowerCase().includes('transfer');
        } catch (e) { return false; }
      });
      return res.json({ ok: true, data: transfers });
    }

    // For all assets, fetch all assets and map to minimal transfer info (costly; optional)
    const all = await getAllAssetsFromFabric();
    if (!all.success) return res.status(500).json({ ok: false, error: all.error });
    return res.json({ ok: true, data: all.assets });
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
  getAssetHistory
  ,transferAsset,getTransfers
};
