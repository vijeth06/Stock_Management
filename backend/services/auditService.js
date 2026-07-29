const AuditLog = require("../models/AuditLog");

async function recordAuditLog(entry) {
  return AuditLog.create(entry);
}

async function listAuditLogs(query = {}, page = 1, limit = 50) {
  const filters = {};
  
  if (query.action) filters.action = new RegExp(String(query.action), "i");
  if (query.resourceType) filters.resourceType = new RegExp(String(query.resourceType), "i");
  if (query.actor) filters.actor = new RegExp(String(query.actor), "i");
  if (query.resourceId) filters.resourceId = new RegExp(String(query.resourceId), "i");

  const [items, total] = await Promise.all([
    AuditLog.find(filters).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    AuditLog.countDocuments(filters),
  ]);

  return {
    items,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

module.exports = { recordAuditLog, listAuditLogs };
