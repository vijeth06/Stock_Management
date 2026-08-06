const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../../logs');
const LOG_FILE = path.join(LOG_DIR, 'audit.log');

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

async function recordAuditLog(entry) {
  try {
    ensureLogDir();
    const logObj = {
      _id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      actor: entry.actor || 'system',
      role: entry.role || 'User',
      action: entry.action || 'LOG',
      resourceType: entry.resourceType || 'General',
      resourceId: entry.resourceId || '',
      details: entry.details || {},
      createdAt: new Date().toISOString()
    };
    fs.appendFileSync(LOG_FILE, JSON.stringify(logObj) + '\n');
    return logObj;
  } catch (e) {
    console.warn('Failed to write audit log:', e && e.message);
    // Fallback to returning a best-effort object
    return { _id: `log-fail-${Date.now()}`, ...entry, createdAt: new Date().toISOString() };
  }
}

async function listAuditLogs(query = {}, page = 1, limit = 50) {
  ensureLogDir();
  if (!fs.existsSync(LOG_FILE)) return { items: [], page, limit, total: 0, totalPages: 0 };
  const raw = fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n').filter(Boolean);
  let items = raw.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).reverse();

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
  const start = (Number(page) - 1) * Number(limit);
  const paginated = items.slice(start, start + Number(limit));
  return {
    items: paginated,
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages: Math.ceil(total / Number(limit)) || 1
  };
}

module.exports = { recordAuditLog, listAuditLogs };
