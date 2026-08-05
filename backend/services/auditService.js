const auditLogsStore = [];

async function recordAuditLog(entry) {
  const logObj = {
    _id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    actor: entry.actor || "system",
    role: entry.role || "User",
    action: entry.action || "LOG",
    resourceType: entry.resourceType || "General",
    resourceId: entry.resourceId || "",
    details: entry.details || {},
    createdAt: new Date().toISOString()
  };
  auditLogsStore.unshift(logObj);
  return logObj;
}

async function listAuditLogs(query = {}, page = 1, limit = 50) {
  let items = [...auditLogsStore];

  if (query.action) {
    const act = String(query.action).toLowerCase();
    items = items.filter(i => (i.action || '').toLowerCase().includes(act));
  }
  if (query.resourceType) {
    const res = String(query.resourceType).toLowerCase();
    items = items.filter(i => (i.resourceType || '').toLowerCase().includes(res));
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
  const skip = (Number(page) - 1) * Number(limit);
  const paginated = items.slice(skip, skip + Number(limit));

  return {
    items: paginated,
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages: Math.ceil(total / Number(limit)) || 1
  };
}

module.exports = { recordAuditLog, listAuditLogs };
