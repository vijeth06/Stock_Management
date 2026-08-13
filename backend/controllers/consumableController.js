const {
  createConsumableOnFabric,
  readConsumableFromFabric,
  getAllConsumablesFromFabric,
  recordConsumableConsumptionOnFabric,
  recordConsumablePurchaseOnFabric,
  updateConsumableStockOnFabric,
  deleteConsumableFromFabric
} = require('../services/fabricService');
const { checkDepartmentAccess } = require('../middleware/auth');
const { recordAuditLog } = require('../services/auditService');

async function createConsumable(req, res, next) {
  try {
    const payload = req.body || {};
    if (!payload.consumableId || !payload.name) {
      return res.status(400).json({ ok: false, error: 'consumableId and name are required' });
    }

    const userDept = req.user && req.user.role === 'DepartmentUser' ? String(req.user.department || '').toUpperCase() : null;
    if (userDept) {
      if (payload.department && String(payload.department).trim().toUpperCase() !== userDept) {
        return res.status(403).json({ ok: false, error: 'Cannot create consumables for another department' });
      }
      payload.department = userDept;
    } else if (payload.department) {
      payload.department = String(payload.department).trim().toUpperCase();
    }

    const fabricResult = await createConsumableOnFabric(payload);
    if (!fabricResult || !fabricResult.success) {
      return res.status(500).json({ ok: false, error: 'Failed to create consumable on Fabric', detail: fabricResult });
    }

    try { await recordAuditLog({ actor: req.user && req.user.email, role: req.user && req.user.role, action: 'CONSUMABLE_CREATED', resourceType: 'Consumable', resourceId: payload.consumableId, details: { department: payload.department } }); } catch (e) {}

    res.status(201).json({ ok: true, data: { consumableId: payload.consumableId, blockchain: fabricResult } });
  } catch (err) {
    next(err);
  }
}

async function getConsumables(req, res, next) {
  try {
    const { department } = req.query;
    const result = await getAllConsumablesFromFabric();
    if (!result.success) return res.status(500).json({ ok: false, error: result.error });

    let consumables = result.consumables || [];

    if (req.user && req.user.role === 'DepartmentUser' && req.user.department) {
      const userDept = String(req.user.department).toUpperCase();
      consumables = consumables.filter(c => (c.department || '').toUpperCase() === userDept);
    } else if (department) {
      consumables = consumables.filter(c => (c.department || '').toUpperCase() === String(department).toUpperCase());
    }

    res.json({ ok: true, data: consumables });
  } catch (err) {
    next(err);
  }
}

async function getConsumable(req, res, next) {
  try {
    const consumableId = req.params.consumableId;
    const result = await readConsumableFromFabric(consumableId);
    if (!result.success) return res.status(404).json({ ok: false, error: result.error || 'Consumable not found on ledger' });
    if (req.user && !checkDepartmentAccess(req.user, result.consumable.department)) {
      return res.status(403).json({ ok: false, error: 'Access denied to another department\'s consumable' });
    }
    res.json({ ok: true, data: result.consumable });
  } catch (err) {
    next(err);
  }
}

async function recordConsumption(req, res, next) {
  try {
    const { quantity, consumedDate, consumedBy, remarks } = req.body || {};
    const consumableId = req.params.consumableId || req.body.consumableId;
    if (!consumableId || !quantity || Number(quantity) <= 0) {
      return res.status(400).json({ ok: false, error: 'consumableId and positive quantity are required' });
    }

    const consRes = await readConsumableFromFabric(consumableId);
    if (!consRes.success || !consRes.consumable) {
      return res.status(404).json({ ok: false, error: 'Consumable not found' });
    }
    if (req.user && !checkDepartmentAccess(req.user, consRes.consumable.department)) {
      return res.status(403).json({ ok: false, error: 'Access denied' });
    }

    const fabricResult = await recordConsumableConsumptionOnFabric(
      consumableId,
      Number(quantity),
      consumedDate,
      consumedBy || (req.user && (req.user.email || req.user.name)) || 'User',
      remarks || ''
    );

    if (!fabricResult || !fabricResult.success) {
      return res.status(500).json({ ok: false, error: fabricResult.error || 'Failed to record consumption on ledger' });
    }

    try { await recordAuditLog({ actor: req.user && req.user.email, role: req.user && req.user.role, action: 'CONSUMABLE_CONSUMED', resourceType: 'Consumable', resourceId: consumableId, details: { quantity } }); } catch (e) {}

    res.status(201).json({ ok: true, data: { consumableId, blockchain: fabricResult } });
  } catch (err) {
    next(err);
  }
}

async function recordPurchase(req, res, next) {
  try {
    const { quantity, purchaseDate, purchaseValue, vendor, billHash } = req.body || {};
    const consumableId = req.params.consumableId || req.body.consumableId;
    if (!consumableId || !quantity || Number(quantity) <= 0) {
      return res.status(400).json({ ok: false, error: 'consumableId and positive quantity are required' });
    }

    const consRes = await readConsumableFromFabric(consumableId);
    if (!consRes.success || !consRes.consumable) {
      return res.status(404).json({ ok: false, error: 'Consumable not found' });
    }
    if (req.user && !checkDepartmentAccess(req.user, consRes.consumable.department)) {
      return res.status(403).json({ ok: false, error: 'Access denied' });
    }

    const fabricResult = await recordConsumablePurchaseOnFabric(
      consumableId,
      Number(quantity),
      purchaseDate,
      Number(purchaseValue || 0),
      vendor || '',
      billHash || ''
    );

    if (!fabricResult || !fabricResult.success) {
      return res.status(500).json({ ok: false, error: fabricResult.error || 'Failed to record purchase on ledger' });
    }

    try { await recordAuditLog({ actor: req.user && req.user.email, role: req.user && req.user.role, action: 'CONSUMABLE_PURCHASE', resourceType: 'Consumable', resourceId: consumableId, details: { quantity, purchaseValue } }); } catch (e) {}

    res.status(201).json({ ok: true, data: { consumableId, blockchain: fabricResult } });
  } catch (err) {
    next(err);
  }
}

async function getConsumableHistory(req, res, next) {
  try {
    const consumableId = req.params.consumableId;
    const consRes = await readConsumableFromFabric(consumableId);
    if (!consRes.success || !consRes.consumable) {
      return res.status(404).json({ ok: false, error: 'Consumable not found' });
    }
    if (req.user && !checkDepartmentAccess(req.user, consRes.consumable.department)) {
      return res.status(403).json({ ok: false, error: 'Access denied' });
    }

    const history = consRes.consumable.usageHistory || [];
    res.json({ ok: true, data: { consumable: consRes.consumable, history } });
  } catch (err) {
    next(err);
  }
}

async function deleteConsumable(req, res, next) {
  try {
    const consumableId = req.params.consumableId;
    const consRes = await readConsumableFromFabric(consumableId);
    if (!consRes.success || !consRes.consumable) {
      return res.status(404).json({ ok: false, error: 'Consumable not found on ledger' });
    }
    if (req.user && !checkDepartmentAccess(req.user, consRes.consumable.department)) {
      return res.status(403).json({ ok: false, error: 'Access denied to another department\'s consumable' });
    }

    const fabricResult = await deleteConsumableFromFabric(consumableId);
    if (!fabricResult || !fabricResult.success) {
      return res.status(500).json({ ok: false, error: fabricResult.error || 'Failed to delete consumable on ledger' });
    }

    res.json({ ok: true, data: { consumableId } });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createConsumable,
  getConsumables,
  getConsumable,
  recordConsumption,
  recordPurchase,
  getConsumableHistory,
  deleteConsumable
};
