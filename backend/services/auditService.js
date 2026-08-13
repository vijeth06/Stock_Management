const { recordAuditEventOnFabric, getAllAuditEventsFromFabric } = require('./fabricService');

async function recordAuditLog(entry) {
  try {
    const eventData = {
      event: entry.action || 'LOG',
      actor: entry.actor || 'system',
      role: entry.role || 'User',
      resourceType: entry.resourceType || 'General',
      resourceId: entry.resourceId || '',
      details: entry.details || {},
      createdAt: new Date().toISOString()
    };

    const res = await recordAuditEventOnFabric(eventData);
    if (res && res.success) {
      return { _id: `AUDIT-${Date.now()}`, ...eventData, blockchain: res.result };
    }

    return { _id: `AUDIT-${Date.now()}`, ...eventData };
  } catch (e) {
    console.warn('Failed to record audit event on Fabric:', e && e.message);
    return { _id: `AUDIT_FAIL-${Date.now()}`, ...entry, createdAt: new Date().toISOString() };
  }
}

async function listAuditLogs(query = {}, page = 1, limit = 50) {
  try {
    const res = await getAllAuditEventsFromFabric();
    const itemsRaw = res.success ? (res.events || []) : [];
    let items = Array.isArray(itemsRaw) ? itemsRaw.slice().reverse() : [];

    if (query.action) {
      const act = String(query.action).toLowerCase();
      items = items.filter(i => (i.event || '').toLowerCase().includes(act) || (i.action || '').toLowerCase().includes(act));
    }
    if (query.resourceType) {
      const rt = String(query.resourceType).toLowerCase();
      items = items.filter(i => (i.resourceType || '').toLowerCase().includes(rt));
    }
    if (query.actor) {
      const act = String(query.actor).toLowerCase();
      items = items.filter(i => (i.actor || '').toLowerCase().includes(act));
    }
    if (query.resourceId) {
      const rid = String(query.resourceId).toLowerCase();
      items = items.filter(i => (i.resourceId || '').toLowerCase().includes(rid));
    }

    const total = items.length;
    const start = (Number(page) - 1) * Number(limit);
    const paginated = items.slice(start, start + Number(limit));

    return {
      items: paginated,
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)) || 1
    };
  } catch (e) {
    console.warn('Failed to list audit logs from Fabric:', e && e.message);
    return { items: [], page: Number(page), limit: Number(limit), total: 0, totalPages: 0 };
  }
}

module.exports = { recordAuditLog, listAuditLogs };
