const output = document.getElementById('output');
const statusBadge = document.getElementById('statusBadge');
const sessionBadge = document.getElementById('sessionBadge');
const headerUserName = document.getElementById('headerUserName');
const userAvatar = document.getElementById('userAvatar');
const sidebarChainDot = document.getElementById('sidebarChainDot');
const sidebarChainLabel = document.getElementById('sidebarChainLabel');
const breadcrumbCurrent = document.getElementById('breadcrumbCurrent');
const toastContainer = document.getElementById('toastContainer');

let authToken = localStorage.getItem('authToken') || '';
let currentUser = null;

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  assets: 'Assets',
  maintenance: 'Maintenance Hub',
  condemnation: 'Condemnation & Disposal',
  transfers: 'Asset Transfers',
  financial: 'Financial Valuation',
  departments: 'Departments',
  reports: 'Reports',
  bills: 'Bills & Invoices',
  verification: 'Verification',
  login: 'Sign In'
};

const KPI_CONFIG = [
  { key: 'totalAssets', label: 'Total Assets', icon: 'blue', svg: '<path fill-rule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4z" clip-rule="evenodd"/>' },
  { key: 'activeAssets', label: 'Active', icon: 'green', svg: '<circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 14l-1-1 2-2-2 2-1-1 3-3" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' },
  { key: 'maintenanceAssets', label: 'In Repair', icon: 'amber', svg: '<path d="M8 16a8 8 0 100-16 8 8 0 000 16zM8 11a3 3 0 100-6 3 3 0 000 6z"/><path d="M11 8H8v4h3V8z"/>' },
  { key: 'condemnedAssets', label: 'Condemned', icon: 'red', svg: '<path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9z" clip-rule="evenodd"/>' },
  { key: 'totalTransfers', label: 'Transfers', icon: 'gray', svg: '<path fill-rule="evenodd" d="M8 5a1 1 0 100 2h5.586l-1.293 1.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L13.586 5H8z" clip-rule="evenodd"/>' },
  { key: 'verifiedBills', label: 'Verified Bills', icon: 'green', svg: '<path d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7l-5-4H5z" />' }
];

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));
}

function showToast(message, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function setLoading(message) {
  // No-op for removed console panel
}

function clearLoading() {
  // No-op for removed console panel
}

function showResult(data, defaultSuccessMessage) {
  if (!data) return;
  if (data.ok === false) {
    showToast(data.error || 'Operation failed', 'error');
  } else {
    const msg = data.message || defaultSuccessMessage;
    if (msg) {
      showToast(msg, 'success');
    }
  }
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('hidden');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('hidden');
}

document.querySelectorAll('[data-modal-close]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const backdrop = e.target.closest('.modal-backdrop');
    if (backdrop) backdrop.classList.add('hidden');
  });
});

document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) backdrop.classList.add('hidden');
  });
});

function navigateTo(page) {
  document.querySelectorAll('.page').forEach((el) => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach((el) => el.classList.remove('active'));

  const pageEl = document.getElementById(`page-${page}`);
  const navEl = document.querySelector(`.nav-item[data-page="${page}"]`);

  if (pageEl) pageEl.classList.add('active');
  if (navEl) navEl.classList.add('active');
  if (breadcrumbCurrent) breadcrumbCurrent.textContent = PAGE_TITLES[page] || page;

  // Trigger page specific data loads
  if (page === 'dashboard') loadDashboard();
  else if (page === 'assets') loadAssets();
  else if (page === 'maintenance') loadMaintenance();
  else if (page === 'condemnation') loadCondemnation();
  else if (page === 'transfers') loadTransfers();
  else if (page === 'financial') loadFinancials();
  else if (page === 'departments') loadDepartments();
  else if (page === 'reports') loadReports();
  else if (page === 'bills') loadBills();
}

function showResult(data) {
  clearLoading();
  const outputText = JSON.stringify(data, null, 2);
  if (output) output.textContent = outputText;
  if (data.ok === false) {
    showToast(data.error || 'Operation failed', 'error');
  }
}

async function requestJson(url, options = {}) {
  try {
    const headers = { ...(options.headers || {}) };
    if (authToken && !headers.Authorization) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    const response = await fetch(url, { ...options, headers });
    
    if (!response.ok) {
      let errorData = { ok: false, error: `Request failed (${response.status})` };
      try {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          errorData = await response.json();
        } else {
          errorData.error = await response.text();
        }
      } catch (e) {
        errorData.error = errorData.error || 'Request failed';
      }
      return errorData;
    }
    
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return await response.json();
    } else {
      const text = await response.text();
      try { return JSON.parse(text); } catch { return { ok: true, data: text }; }
    }
  } catch (error) {
    return { ok: false, error: error.message || 'Network error — gateway connection failed' };
  }
}

async function checkHealth() {
  const health = await requestJson('/health');
  if (health.status === 'ok') {
    statusBadge.textContent = 'Online';
    statusBadge.className = 'status-pill ok';
    sidebarChainLabel.textContent = 'Hyperledger Fabric';
    sidebarChainDot.className = 'chip-dot online';
  } else {
    statusBadge.textContent = health.error || 'Disconnected';
    statusBadge.className = 'status-pill error';
    sidebarChainLabel.textContent = 'Offline';
    sidebarChainDot.className = 'chip-dot offline';
  }
}

function bootstrapSession() {
  const storedToken = localStorage.getItem('authToken');
  const storedUserRaw = localStorage.getItem('currentUser');
  if (storedToken) authToken = storedToken;
  if (storedUserRaw) {
    try { currentUser = JSON.parse(storedUserRaw); } catch { currentUser = null; }
  }
  updateUserChip();
}

function updateUserChip() {
  if (!headerUserName || !userAvatar || !sessionBadge) return;
  const signOutBtn = document.getElementById('signOutBtn');
  if (currentUser && authToken) {
    headerUserName.textContent = currentUser.name || currentUser.email || 'Admin';
    userAvatar.textContent = (currentUser.name || currentUser.email || 'A').charAt(0).toUpperCase();
    sessionBadge.textContent = currentUser.role ? `${currentUser.role}` : 'Administrator';
    if (signOutBtn) signOutBtn.classList.remove('hidden');
  } else {
    headerUserName.textContent = 'Guest';
    userAvatar.textContent = '?';
    sessionBadge.textContent = 'Not signed in';
    if (signOutBtn) signOutBtn.classList.add('hidden');
  }
}

document.getElementById('signOutBtn')?.addEventListener('click', () => {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('authToken');
  localStorage.removeItem('currentUser');
  updateUserChip();
  showToast('Signed out successfully', 'info');
  navigateTo('login');
});

// QR Code SVG Generator
function generateQrSvg(text) {
  const matrixSize = 21;
  let hash = 7;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) % 2147483647;
  }
  let rects = '';
  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      const isFinder = (r < 7 && c < 7) || (r < 7 && c > 13) || (r > 13 && c < 7);
      const isFinderPattern = isFinder && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
      const val = (r * 13 + c * 17 + hash) % 3 === 0;
      if (isFinderPattern || (!isFinder && val)) {
        rects += `<rect x="${c * 6}" y="${r * 6}" width="5.5" height="5.5" fill="#0f172a"/>`;
      }
    }
  }
  return `<svg viewBox="0 0 ${matrixSize * 6} ${matrixSize * 6}" width="110" height="110">${rects}</svg>`;
}

// DASHBOARD
async function loadDashboard() {
  setLoading('Loading dashboard overview...');
  const res = await requestJson('/api/dashboard');
  if (res.ok) {
    let dashboardData = res.data;
    if (currentUser && currentUser.role === 'DepartmentUser' && currentUser.department) {
      const dept = currentUser.department;
      const deptAssets = (dashboardData.recentAssets || []).filter(a => a.department === dept);
      dashboardData = {
        ...dashboardData,
        recentAssets: deptAssets
      };
    }
    renderDashboardSummary(dashboardData);
  }
  await loadPendingUsers();
  showResult(res);
}

async function loadPendingUsers() {
  const panel = document.getElementById('adminPendingUsersPanel');
  const container = document.getElementById('pendingUsersList');
  if (!panel || !container) return;

  if (currentUser && (currentUser.role === 'Administrator' || currentUser.role === 'Admin')) {
    panel.classList.remove('hidden');
    const res = await requestJson('/api/users/pending');
    if (res.ok && Array.isArray(res.data)) {
      renderPendingUsers(res.data);
    }
  } else {
    panel.classList.add('hidden');
  }
}

function renderPendingUsers(users) {
  const container = document.getElementById('pendingUsersList');
  if (!container) return;
  if (!users || users.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:16px;">No pending user registration requests. All requests processed.</div>';
    return;
  }

  container.innerHTML = users.map(u => `
    <div class="detail-row" style="padding:14px 12px; align-items:center; background:#fffbe6; border-bottom:1px solid #fef3c7;">
      <div style="flex:1;">
        <div style="display:flex; align-items:center; gap:8px;">
          <strong style="color:var(--gray-900); font-size:14px;">${escapeHtml(u.name)}</strong>
          <span class="status-pill neutral" style="font-size:11px;">Dept: ${escapeHtml(u.department || 'IT')}</span>
        </div>
        <div class="muted" style="margin-top:2px;">
          Email: <strong>${escapeHtml(u.email)}</strong> | Requested Role: ${escapeHtml(u.role)} | Date: ${u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'Recent'}
        </div>
      </div>
      <div style="display:flex; gap:8px;">
        <button type="button" class="btn btn-primary" style="padding:6px 12px; font-size:12px; background:#10b981; border-color:#059669;" onclick="approveUserDirect('${escapeHtml(u._id || u.email)}', '${escapeHtml(u.email)}')">Accept Approval ✓</button>
        <button type="button" class="btn btn-secondary" style="padding:6px 12px; font-size:12px; color:var(--red-600); border-color:var(--red-300);" onclick="rejectUserDirect('${escapeHtml(u._id || u.email)}', '${escapeHtml(u.email)}')">Reject ✗</button>
      </div>
    </div>
  `).join('');
}

window.approveUserDirect = async function(id, email) {
  setLoading(`Approving user ${email}...`);
  const res = await requestJson(`/api/users/${encodeURIComponent(id)}/approve`, { method: 'POST' });
  if (res.ok) {
    showToast(`User ${email} approved successfully!`, 'success');
    await loadPendingUsers();
    await loadDashboard();
  }
  showResult(res);
};

window.rejectUserDirect = async function(id, email) {
  if (!confirm(`Reject registration request for ${email}?`)) return;
  setLoading(`Rejecting user ${email}...`);
  const res = await requestJson(`/api/users/${encodeURIComponent(id)}/reject`, { method: 'POST' });
  if (res.ok) {
    showToast(`Registration for ${email} rejected`, 'info');
    await loadPendingUsers();
  }
  showResult(res);
};

function renderDashboardSummary(data) {
  const dashboardSummary = document.getElementById('dashboardSummary');
  if (!dashboardSummary) return;

  const summary = data?.counts || {};
  dashboardSummary.innerHTML = KPI_CONFIG.map(({ key, label, icon, svg }) => `
    <div class="kpi-card">
      <div class="kpi-icon ${icon}">
        <svg viewBox="0 0 20 20" fill="currentColor">${svg}</svg>
      </div>
      <span class="kpi-label">${escapeHtml(label)}</span>
      <span class="kpi-value" style="font-size: 20px; font-weight: 700; color: var(--gray-900);">${escapeHtml(summary[key] ?? 0)}</span>
    </div>
  `).join('');

  renderAssetStatusChart(data?.analytics?.assetStatus || {});
  renderDepartmentChart(data?.analytics?.departmentSummary || {});
  renderRecentAssets(data?.recentAssets || []);
  renderRecentAlerts(data?.counts || {});
}

function renderAssetStatusChart(statusData) {
  const container = document.getElementById('assetStatusChart');
  if (!container) return;

  const total = Object.values(statusData).reduce((sum, v) => sum + v, 0) || 1;
  const colors = { Active: '#22c55e', Maintenance: '#f59e0b', Condemned: '#ef4444', Disposed: '#64748b' };
  
  const entries = Object.entries(statusData);
  if (entries.length === 0) {
    container.innerHTML = '<div class="empty-state">No status data available</div>';
    return;
  }

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:10px; width:100%;">
      ${entries.map(([status, count]) => {
        const pct = Math.round((count / total) * 100);
        return `
          <div style="display:flex; flex-direction:column; gap:4px;">
            <div style="display:flex; justify-content:space-between; font-size:12px;">
              <span><strong>${escapeHtml(status)}</strong></span>
              <span>${count} (${pct}%)</span>
            </div>
            <div style="height:8px; background:var(--gray-100); border-radius:4px; overflow:hidden;">
              <div style="height:100%; width:${pct}%; background:${colors[status] || '#3b82f6'}; border-radius:4px;"></div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderDepartmentChart(deptData) {
  const container = document.getElementById('departmentChart');
  if (!container) return;

  const entries = Object.entries(deptData || {});
  if (entries.length === 0) {
    container.innerHTML = '<div class="empty-state">No department breakdown</div>';
    return;
  }
  const maxVal = Math.max(...entries.map(([, val]) => val), 1);

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:10px; width:100%;">
      ${entries.map(([dept, count]) => {
        const pct = Math.round((count / maxVal) * 100);
        return `
          <div style="display:flex; flex-direction:column; gap:4px;">
            <div style="display:flex; justify-content:space-between; font-size:12px;">
              <span><strong>${escapeHtml(dept)} Department</strong></span>
              <span>${count} assets</span>
            </div>
            <div style="height:8px; background:var(--gray-100); border-radius:4px; overflow:hidden;">
              <div style="height:100%; width:${pct}%; background:var(--blue-600); border-radius:4px;"></div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderRecentAssets(assets) {
  const container = document.getElementById('recentAssetsPanel');
  if (!container) return;

  if (!assets || assets.length === 0) {
    container.innerHTML = '<div class="empty-state">No assets registered yet</div>';
    return;
  }

  container.innerHTML = assets.slice(0, 5).map(asset => `
    <div class="detail-row">
      <div>
        <strong>${escapeHtml(asset.assetId)}</strong>
        <div class="muted">${escapeHtml(asset.name)}</div>
      </div>
      <div>
        <span class="status-pill ${asset.status === 'Active' ? 'ok' : 'neutral'}">${escapeHtml(asset.status)}</span>
      </div>
    </div>
  `).join('');
}

function renderRecentAlerts(counts) {
  const container = document.getElementById('recentAlertsPanel');
  if (!container) return;

  const alerts = [];
  if (counts.maintenanceAssets > 0) {
    alerts.push({ title: 'Maintenance Pending', desc: `${counts.maintenanceAssets} asset(s) currently under repair`, type: 'amber' });
  }
  if (counts.totalCondemnationRequests > 0) {
    alerts.push({ title: 'Condemnation Approvals', desc: `${counts.totalCondemnationRequests} asset condemnation request(s) logged`, type: 'red' });
  }
  if (alerts.length === 0) {
    alerts.push({ title: 'System Normal', desc: 'All assets operational, no urgent service alerts', type: 'green' });
  }

  container.innerHTML = alerts.map(al => `
    <div class="detail-row">
      <div>
        <strong style="color: ${al.type === 'red' ? 'var(--red-600)' : al.type === 'amber' ? 'var(--amber-600)' : 'var(--green-700)'}">${escapeHtml(al.title)}</strong>
        <div class="muted">${escapeHtml(al.desc)}</div>
      </div>
    </div>
  `).join('');
}

// ASSETS
async function loadAssets() {
  setLoading('Loading asset registry...');
  const res = await requestJson('/api/assets');
  if (res.ok) {
    renderAssetList(res.data || []);
  }
  showResult(res);
}

function renderAssetList(assets) {
  const container = document.getElementById('assetDisplay');
  if (!container) return;

  if (!assets || assets.length === 0) {
    container.innerHTML = '<div class="empty-state">No registered assets found.</div>';
    return;
  }

  container.innerHTML = assets.map(asset => `
    <div class="detail-row" style="padding:16px 12px; align-items:flex-start; flex-wrap:wrap; gap:10px;">
      <div style="flex:1; min-width:200px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <strong style="font-size:15px; color:var(--gray-900);">${escapeHtml(asset.assetId)}</strong>
          <span class="status-pill ${asset.status === 'Active' ? 'ok' : asset.status === 'Maintenance' ? 'neutral' : 'error'}">${escapeHtml(asset.status)}</span>
        </div>
        <div style="font-weight:600; font-size:14px; margin-top:2px;">${escapeHtml(asset.name)}</div>
        <div class="muted" style="margin-top:4px;">
          Dept: <strong>${escapeHtml(asset.department)}</strong> | Cat: ${escapeHtml(asset.category)} | Location: ${escapeHtml(asset.location || 'Central')}
        </div>
        <div class="muted" style="font-family:var(--font-mono); font-size:11px; margin-top:2px;">
          Serial: ${escapeHtml(asset.serialNumber || 'N/A')} | Value: $${Number(asset.purchaseValue || 0).toLocaleString()}
        </div>
      </div>
      <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
        <button type="button" class="btn btn-secondary" style="padding:4px 8px; font-size:11.5px;" onclick="showAssetHistory('${escapeHtml(asset.assetId)}')">History</button>
        <button type="button" class="btn btn-secondary" style="padding:4px 8px; font-size:11.5px;" onclick="showQrBadge('${escapeHtml(asset.assetId)}')">QR Badge</button>
        <button type="button" class="btn btn-secondary" style="padding:4px 8px; font-size:11.5px;" onclick="openEditAsset('${escapeHtml(asset.assetId)}')">Edit</button>
        <button type="button" class="btn btn-secondary" style="padding:4px 8px; font-size:11.5px;" onclick="openQuickTransfer('${escapeHtml(asset.assetId)}')">Transfer</button>
        <button type="button" class="btn btn-secondary" style="padding:4px 8px; font-size:11.5px; color:var(--amber-600);" onclick="openQuickCondemn('${escapeHtml(asset.assetId)}')">Condemn</button>
        <button type="button" class="btn btn-secondary" style="padding:4px 8px; font-size:11.5px; color:var(--red-600);" onclick="deleteAsset('${escapeHtml(asset.assetId)}')">Delete</button>
      </div>
    </div>
  `).join('');
}

window.showAssetHistory = async function(assetId) {
  setLoading('Fetching asset lifecycle history...');
  const res = await requestJson(`/api/assets/${encodeURIComponent(assetId)}/history`);
  if (res.ok && res.data) {
    const { asset, timeline } = res.data;
    const header = document.getElementById('historyAssetHeader');
    const timelineContainer = document.getElementById('historyTimeline');

    if (header) {
      header.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <h3 style="margin:0;">${escapeHtml(asset.name)} (${escapeHtml(asset.assetId)})</h3>
            <p style="margin:4px 0 0; color:var(--gray-600); font-size:13px;">
              Dept: <strong>${escapeHtml(asset.department)}</strong> | Serial: ${escapeHtml(asset.serialNumber || 'N/A')} | Value: $${Number(asset.purchaseValue || 0).toLocaleString()}
            </p>
          </div>
          <span class="status-pill ${asset.status === 'Active' ? 'ok' : 'neutral'}">${escapeHtml(asset.status)}</span>
        </div>
      `;
    }

    if (timelineContainer) {
      if (!timeline || timeline.length === 0) {
        timelineContainer.innerHTML = '<div class="empty-state">No audit timeline entries recorded</div>';
      } else {
        timelineContainer.innerHTML = timeline.map(entry => `
          <div class="detail-row" style="padding:10px 0; border-bottom:1px dashed var(--gray-200);">
            <div>
              <strong>${escapeHtml(entry.event)}</strong>
              <div class="muted">${escapeHtml(entry.details)}</div>
            </div>
            <div style="font-size:12px; color:var(--gray-500);">
              ${new Date(entry.date).toLocaleString()}
            </div>
          </div>
        `).join('');
      }
    }
    openModal('assetHistoryModal');
  } else {
    showToast('Failed to fetch asset history', 'error');
  }
  showResult(res);
};

window.openEditAsset = async function(assetId) {
  const res = await requestJson(`/api/assets/${encodeURIComponent(assetId)}`);
  if (res.ok && res.data) {
    const a = res.data;
    document.getElementById('editAssetIdInput').value = a.assetId;
    document.getElementById('editAssetNameInput').value = a.name;
    document.getElementById('editAssetLocationInput').value = a.location || '';
    document.getElementById('editAssetStatusInput').value = a.status || 'Active';
    document.getElementById('editAssetCategoryInput').value = a.category || 'Hardware';

    // Populate department select options
    const deptsRes = await requestJson('/api/departments');
    const deptSelect = document.getElementById('editAssetDeptInput');
    if (deptSelect && deptsRes.ok && deptsRes.data) {
      deptSelect.innerHTML = deptsRes.data.map(d => `<option value="${escapeHtml(d.code || d.name)}" ${d.code === a.department || d.name === a.department ? 'selected' : ''}>${escapeHtml(d.name)} (${escapeHtml(d.code)})</option>`).join('');
    }

    openModal('editAssetModal');
  } else {
    showToast('Asset info unavailable', 'error');
  }
};

document.getElementById('editAssetForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData.entries());
  const assetId = data.assetId;
  delete data.assetId;

  setLoading(`Updating asset ${assetId}...`);
  const res = await requestJson(`/api/assets/${encodeURIComponent(assetId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (res.ok) {
    showToast(`Asset ${assetId} updated`, 'success');
    closeModal('editAssetModal');
    loadAssets();
  }
  showResult(res);
});

window.deleteAsset = async function(assetId) {
  if (!confirm(`Are you sure you want to delete asset ${assetId}?`)) return;
  setLoading(`Deleting asset ${assetId}...`);
  const res = await requestJson(`/api/assets/${encodeURIComponent(assetId)}`, {
    method: 'DELETE'
  });
  if (res.ok) {
    showToast(`Asset ${assetId} deleted`, 'success');
    loadAssets();
  }
  showResult(res);
};

window.showQrBadge = function(assetId) {
  requestJson(`/api/assets/${encodeURIComponent(assetId)}`).then(res => {
    if (res.ok && res.data) {
      const a = res.data;
      document.getElementById('badgeAssetId').textContent = a.assetId;
      document.getElementById('badgeAssetName').textContent = a.name;
      document.getElementById('badgeCategory').textContent = a.category;
      document.getElementById('badgeDept').textContent = a.department;
      document.getElementById('badgeLocation').textContent = a.location || 'Unassigned';
      document.getElementById('badgeSerial').textContent = a.serialNumber || 'N/A';
      document.getElementById('badgeHash').textContent = a.billHash || a.blockchainTxHash || '0x7f83b1657ff1fc53b9...';
      document.getElementById('qrCodeContainer').innerHTML = generateQrSvg(`${a.assetId}:${a.serialNumber}:${a.billHash}`);
      openModal('qrModal');
    } else {
      showToast('Asset details could not be retrieved', 'error');
    }
  });
};

window.openQuickTransfer = function(assetId) {
  const input = document.querySelector('#transferAssetForm input[name="assetId"]');
  if (input) input.value = assetId;
  openModal('transferAssetModal');
};

document.getElementById('addAssetBtn')?.addEventListener('click', async () => {
  const deptsRes = await requestJson('/api/departments');
  const deptSelect = document.querySelector('#addAssetForm select[name="department"]');
  if (deptSelect && deptsRes.ok && deptsRes.data && deptsRes.data.length > 0) {
    deptSelect.innerHTML = deptsRes.data.map(d => `<option value="${escapeHtml(d.code || d.name)}">${escapeHtml(d.name)} (${escapeHtml(d.code)})</option>`).join('');
  }
  openModal('addAssetModal');
});

document.getElementById('addAssetForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  setLoading('Registering new asset...');
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData.entries());

  const res = await requestJson('/api/assets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (res.ok) {
    showToast('Asset registered successfully on chain', 'success');
    closeModal('addAssetModal');
    e.target.reset();
    loadAssets();
  }
  showResult(res);
});

// MAINTENANCE HUB
async function loadMaintenance() {
  setLoading('Loading maintenance records...');
  const res = await requestJson('/api/maintenance');
  if (res.ok) {
    renderMaintenance(res.data || []);
  }
  showResult(res);
}

function renderMaintenance(records) {
  const container = document.getElementById('maintenanceList');
  const analytics = document.getElementById('maintenanceAnalyticsPanel');
  if (!container) return;

  if (!records || records.length === 0) {
    container.innerHTML = '<div class="empty-state">No maintenance records logged yet.</div>';
    if (analytics) analytics.innerHTML = '<div class="empty-state">No cost data</div>';
    return;
  }

  container.innerHTML = records.map(m => `
    <div class="detail-row" style="padding:14px 10px; align-items:flex-start;">
      <div style="flex:1;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong>${escapeHtml(m.recordId)} — ${escapeHtml(m.assetId)}</strong>
          <span class="status-pill ${m.status === 'Completed' ? 'ok' : 'neutral'}">${escapeHtml(m.status)}</span>
        </div>
        <div style="margin-top:2px; font-weight:500;">${escapeHtml(m.description)}</div>
        <div class="muted" style="margin-top:4px;">
          Technician: <strong>${escapeHtml(m.technician)}</strong> | Cost: <strong>$${Number(m.cost || 0).toLocaleString()}</strong> | Date: ${escapeHtml(m.maintenanceDate)}
        </div>
      </div>
      <div>
        <button type="button" class="btn btn-secondary" style="padding:4px 10px; font-size:11.5px;" onclick="openUpdateMaint('${escapeHtml(m.recordId)}', '${escapeHtml(m.status)}')">Update Status</button>
      </div>
    </div>
  `).join('');

  if (analytics) {
    const totalCost = records.reduce((acc, curr) => acc + Number(curr.cost || 0), 0);
    analytics.innerHTML = `
      <div class="detail-row">
        <span>Total Service Expenditure</span>
        <strong style="font-size:18px; color:var(--blue-700);">$${totalCost.toLocaleString()}</strong>
      </div>
      <div class="detail-row">
        <span>Total Service Jobs</span>
        <strong>${records.length} jobs logged</strong>
      </div>
    `;
  }
}

window.openUpdateMaint = function(recordId, status) {
  document.getElementById('updateMaintRecordIdInput').value = recordId;
  const select = document.getElementById('updateMaintStatusInput');
  if (select) select.value = status || 'Completed';
  openModal('updateMaintModal');
};

document.getElementById('updateMaintForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const recordId = formData.get('recordId');
  const status = formData.get('status');

  setLoading(`Updating maintenance ${recordId}...`);
  const res = await requestJson(`/api/maintenance/${encodeURIComponent(recordId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });

  if (res.ok) {
    showToast(`Maintenance status updated to ${status}`, 'success');
    closeModal('updateMaintModal');
    loadMaintenance();
  }
  showResult(res);
});

document.getElementById('openMaintModalBtn')?.addEventListener('click', () => openModal('scheduleMaintModal'));
document.getElementById('refreshMaintBtn')?.addEventListener('click', loadMaintenance);

document.getElementById('scheduleMaintForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  setLoading('Logging maintenance task...');
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData.entries());

  const res = await requestJson('/api/maintenance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (res.ok) {
    showToast('Maintenance task logged successfully', 'success');
    closeModal('scheduleMaintModal');
    e.target.reset();
    loadMaintenance();
  }
  showResult(res);
});

// CONDEMNATION & DISPOSAL
async function loadCondemnation() {
  setLoading('Loading condemnation requests...');
  const res = await requestJson('/api/condemnation');
  if (res.ok) {
    renderCondemnation(res.data || []);
  }
  showResult(res);
}

function renderCondemnation(records) {
  const container = document.getElementById('condemnationList');
  if (!container) return;

  if (!records || records.length === 0) {
    container.innerHTML = '<div class="empty-state">No condemnation requests logged.</div>';
    return;
  }

  container.innerHTML = records.map(c => `
    <div class="detail-row" style="padding:14px 10px; align-items:flex-start;">
      <div style="flex:1;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong>${escapeHtml(c.recordId)} — ${escapeHtml(c.assetId)}</strong>
          <span class="status-pill ${c.status === 'Approved' ? 'ok' : c.status === 'Rejected' ? 'error' : 'neutral'}">${escapeHtml(c.status)}</span>
        </div>
        <div style="margin-top:2px;"><strong>Reason:</strong> ${escapeHtml(c.reason)}</div>
        <div class="muted" style="margin-top:4px;">
          Requested By: ${escapeHtml(c.requestedBy)} | Disposal: <strong>${escapeHtml(c.disposalMethod || 'Recycling')}</strong>
          ${c.rejectionReason ? ` | <span style="color:var(--red-600);">Rejection: ${escapeHtml(c.rejectionReason)}</span>` : ''}
        </div>
      </div>
      ${(c.status !== 'Approved' && c.status !== 'Rejected') ? `
        <div style="display:flex; gap:6px;">
          <button type="button" class="btn btn-primary" style="padding:4px 10px; font-size:11.5px;" onclick="approveCondemnation('${escapeHtml(c.recordId)}')">Approve</button>
          <button type="button" class="btn btn-secondary" style="padding:4px 10px; font-size:11.5px; color:var(--red-600);" onclick="openRejectCondemnation('${escapeHtml(c.recordId)}')">Reject</button>
        </div>
      ` : ''}
    </div>
  `).join('');
}

window.approveCondemnation = async function(recordId) {
  setLoading('Approving condemnation request...');
  const res = await requestJson(`/api/condemnation/${encodeURIComponent(recordId)}/approve`, {
    method: 'PUT'
  });
  if (res.ok) {
    showToast('Condemnation request approved', 'success');
    loadCondemnation();
  }
  showResult(res);
};

window.openRejectCondemnation = function(recordId) {
  document.getElementById('rejectRecordIdInput').value = recordId;
  openModal('rejectCondemnationModal');
};

document.getElementById('rejectCondemnationForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const recordId = formData.get('recordId');
  const rejectionReason = formData.get('rejectionReason');

  setLoading(`Rejecting condemnation request ${recordId}...`);
  const res = await requestJson(`/api/condemnation/${encodeURIComponent(recordId)}/reject`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rejectionReason })
  });

  if (res.ok) {
    showToast('Condemnation request rejected', 'success');
    closeModal('rejectCondemnationModal');
    loadCondemnation();
  }
  showResult(res);
});

window.openQuickCondemn = function(assetId) {
  const input = document.querySelector('#requestCondemnationForm input[name="assetId"]');
  if (input) input.value = assetId;
  openModal('requestCondemnationModal');
};

document.getElementById('openCondemnationModalBtn')?.addEventListener('click', () => {
  openModal('requestCondemnationModal');
});

document.getElementById('refreshCondemnationBtn')?.addEventListener('click', loadCondemnation);

document.getElementById('requestCondemnationForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  setLoading('Submitting condemnation request...');
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData.entries());

  const res = await requestJson('/api/condemnation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (res.ok) {
    showToast('Condemnation request submitted', 'success');
    closeModal('requestCondemnationModal');
    e.target.reset();
    if (document.getElementById('page-condemnation')?.classList.contains('active')) {
      loadCondemnation();
    } else {
      loadAssets();
    }
  }
  showResult(res);
});

// TRANSFERS
async function loadTransfers() {
  setLoading('Loading asset transfers...');
  const res = await requestJson('/api/transfers');
  if (res.ok) {
    renderTransfers(res.data || []);
  }
  showResult(res);
}

function renderTransfers(transfers) {
  const container = document.getElementById('transfersList');
  if (!container) return;

  if (!transfers || transfers.length === 0) {
    container.innerHTML = '<div class="empty-state">No asset transfer records found.</div>';
    return;
  }

  container.innerHTML = transfers.map(t => `
    <div class="detail-row" style="padding:14px 10px; align-items:flex-start;">
      <div style="flex:1;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong>${escapeHtml(t.transferId || 'XFR')} — Asset ${escapeHtml(t.assetId)}</strong>
          <span class="status-pill ok">${escapeHtml(t.status || 'Completed')}</span>
        </div>
        <div style="margin-top:2px;">
          From <strong>${escapeHtml(t.fromDepartment || 'Origin')}</strong> &rarr; To <strong>${escapeHtml(t.toDepartment)}</strong>
          ${t.newLocation ? ` | Location: ${escapeHtml(t.newLocation)}` : ''}
        </div>
        <div class="muted" style="margin-top:4px;">
          Requested By: ${escapeHtml(t.requestedBy || 'User')} | Reason: ${escapeHtml(t.reason || 'N/A')}
          | Date: ${t.createdAt ? new Date(t.createdAt).toLocaleString() : new Date().toLocaleString()}
        </div>
      </div>
    </div>
  `).join('');
}

document.getElementById('openTransferModalBtn')?.addEventListener('click', () => {
  openModal('transferAssetModal');
});

document.getElementById('refreshTransfersBtn')?.addEventListener('click', loadTransfers);

document.getElementById('transferAssetForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  setLoading('Processing asset transfer...');
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData.entries());

  const res = await requestJson('/api/transfers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (res.ok) {
    showToast('Asset transfer processed', 'success');
    closeModal('transferAssetModal');
    e.target.reset();
    if (document.getElementById('page-transfers')?.classList.contains('active')) {
      loadTransfers();
    } else {
      loadAssets();
    }
  }
  showResult(res);
});

// FINANCIALS
async function loadFinancials() {
  setLoading('Loading financial valuation...');
  const [finRes, assetsRes] = await Promise.all([
    requestJson('/api/reports/financial'),
    requestJson('/api/assets')
  ]);

  if (finRes.ok && finRes.data) {
    const { totalValuation, netBookValue, depreciationMethod } = finRes.data;
    const kpiContainer = document.getElementById('financialKpis');
    if (kpiContainer) {
      kpiContainer.innerHTML = `
        <div class="kpi-card blue">
          <div class="kpi-label">Total Portfolio Valuation</div>
          <div class="kpi-value">$${Number(totalValuation || 0).toLocaleString()}</div>
        </div>
        <div class="kpi-card green">
          <div class="kpi-label">Net Book Value (Estimated)</div>
          <div class="kpi-value">$${Number(netBookValue || 0).toLocaleString()}</div>
        </div>
        <div class="kpi-card amber">
          <div class="kpi-label">Depreciation Method</div>
          <div class="kpi-value" style="font-size:18px;">${escapeHtml(depreciationMethod || 'Straight-Line')}</div>
        </div>
      `;
    }
  }

  const tableContainer = document.getElementById('financialTable');
  if (tableContainer) {
    const assets = assetsRes.ok && Array.isArray(assetsRes.data) ? assetsRes.data : [];
    if (assets.length === 0) {
      tableContainer.innerHTML = '<div class="empty-state">No assets registered in financial ledger.</div>';
    } else {
      tableContainer.innerHTML = assets.map(a => {
        const val = Number(a.purchaseValue || 0);
        const dep = val * 0.3;
        const nbv = val - dep;
        return `
          <div class="detail-row" style="padding:12px 10px; align-items:center;">
            <div style="flex:1;">
              <strong>${escapeHtml(a.name)} (${escapeHtml(a.assetId)})</strong>
              <div class="muted">Dept: ${escapeHtml(a.department)} | Cat: ${escapeHtml(a.category)} | Date: ${a.purchaseDate ? new Date(a.purchaseDate).toLocaleDateString() : 'N/A'}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-weight:600;">Original: $${val.toLocaleString()}</div>
              <div style="font-size:12px; color:var(--gray-600);">Net Book Value: $${nbv.toLocaleString()}</div>
            </div>
          </div>
        `;
      }).join('');
    }
  }
  showResult(finRes);
}

document.getElementById('refreshFinancialBtn')?.addEventListener('click', loadFinancials);

document.getElementById('exportFinancialCsvBtn')?.addEventListener('click', async () => {
  setLoading('Exporting financial valuation CSV...');
  try {
    const res = await requestJson('/api/reports/financial');
    let financialAssets = [];
    if (res.ok && res.data && Array.isArray(res.data.assets)) {
      financialAssets = res.data.assets;
    } else {
      const assetsRes = await requestJson('/api/assets');
      if (assetsRes.ok && Array.isArray(assetsRes.data)) {
        financialAssets = assetsRes.data.map(a => {
          const val = Number(a.purchaseValue || 0);
          const dep = val * 0.15;
          return {
            assetId: a.assetId,
            name: a.name,
            department: a.department,
            category: a.category || 'General',
            purchaseDate: a.purchaseDate || 'N/A',
            purchaseValue: val,
            annualDepreciation: dep,
            accumulatedDepreciation: dep,
            currentValue: val - dep
          };
        });
      }
    }

    if (!financialAssets || financialAssets.length === 0) {
      showToast('No financial records available to export', 'error');
      return;
    }

    const headers = ['Asset ID', 'Asset Name', 'Department', 'Category', 'Purchase Date', 'Purchase Value ($)', 'Annual Depreciation ($)', 'Accumulated Depreciation ($)', 'Current Value ($)'];
    const rows = financialAssets.map(a => [
      `"${(a.assetId || '').replace(/"/g, '""')}"`,
      `"${(a.name || '').replace(/"/g, '""')}"`,
      `"${(a.department || '').replace(/"/g, '""')}"`,
      `"${(a.category || '').replace(/"/g, '""')}"`,
      `"${(a.purchaseDate || '').replace(/"/g, '""')}"`,
      Number(a.purchaseValue || 0).toFixed(2),
      Number(a.annualDepreciation || 0).toFixed(2),
      Number(a.accumulatedDepreciation || 0).toFixed(2),
      Number(a.currentValue || a.currentBookValue || 0).toFixed(2)
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `financial-valuation-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Financial valuation CSV exported successfully', 'success');
  } catch (err) {
    showToast(`CSV export failed: ${err.message}`, 'error');
  }
});

// DEPARTMENTS & REPORTS & LOGIN & SEARCH
async function loadDepartments() {
  setLoading('Loading departments...');
  const response = await requestJson('/api/departments');
  if (response.ok) renderDepartments(response.data || []);
  showResult(response);
}

function renderDepartments(departments) {
  const container = document.getElementById('departmentsList');
  const summaryPanel = document.getElementById('departmentSummaryPanel');
  if (!container) return;

  if (!departments || departments.length === 0) {
    container.innerHTML = '<div class="empty-state">No departments found.</div>';
    return;
  }

  container.innerHTML = departments.map(dept => `
    <div class="detail-row" style="padding:14px 10px; align-items:center;">
      <div style="flex:1;">
        <strong>${escapeHtml(dept.name || dept.code)} (${escapeHtml(dept.code)})</strong>
        <div class="muted">${escapeHtml(dept.description || 'No description')} | Manager: ${escapeHtml(dept.manager || 'Unassigned')}</div>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <span class="status-pill neutral">${escapeHtml(dept.assetCount || 0)} assets</span>
        <button type="button" class="btn btn-secondary" style="padding:4px 8px; font-size:11.5px;" onclick="openEditDept('${escapeHtml(dept._id || dept.code)}', '${escapeHtml(dept.code)}', '${escapeHtml(dept.name)}', '${escapeHtml(dept.description || '')}', '${escapeHtml(dept.manager || '')}')">Edit</button>
        <button type="button" class="btn btn-secondary" style="padding:4px 8px; font-size:11.5px; color:var(--red-600);" onclick="deleteDept('${escapeHtml(dept._id || dept.code)}', '${escapeHtml(dept.code || '')}')">Delete</button>
      </div>
    </div>
  `).join('');

  if (summaryPanel) {
    summaryPanel.innerHTML = `
      <div style="padding:14px;">
        <h4 style="margin:0 0 8px;">Department Distribution Overview</h4>
        <p style="margin:0; color:var(--gray-600); font-size:13px;">${departments.length} active departments registered in the asset ledger.</p>
        <div style="margin-top:12px; display:flex; flex-direction:column; gap:6px;">
          ${departments.map(d => `
            <div style="display:flex; justify-content:space-between; font-size:12px;">
              <span><strong>${escapeHtml(d.name)}</strong> (${escapeHtml(d.code)})</span>
              <span>Manager: ${escapeHtml(d.manager || 'N/A')}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
}

document.getElementById('openAddDeptModalBtn')?.addEventListener('click', () => openModal('addDeptModal'));

document.getElementById('addDeptForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  setLoading('Creating department...');
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData.entries());

  const res = await requestJson('/api/departments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (res.ok) {
    showToast(`Department ${data.code} created`, 'success');
    closeModal('addDeptModal');
    e.target.reset();
    loadDepartments();
  }
  showResult(res);
});

window.openEditDept = function(id, code, name, description, manager) {
  document.getElementById('editDeptId').value = id;
  document.getElementById('editDeptCode').value = code;
  document.getElementById('editDeptName').value = name;
  document.getElementById('editDeptDescription').value = description;
  document.getElementById('editDeptManager').value = manager;
  openModal('editDeptModal');
};

document.getElementById('editDeptForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const deptId = formData.get('deptId');
  const data = Object.fromEntries(formData.entries());
  delete data.deptId;

  setLoading(`Updating department ${deptId}...`);
  const res = await requestJson(`/api/departments/${encodeURIComponent(deptId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (res.ok) {
    showToast('Department updated', 'success');
    closeModal('editDeptModal');
    loadDepartments();
  }
  showResult(res);
});

window.deleteDept = async function(id, code) {
  if (!confirm(`Are you sure you want to permanently delete department ${code || id}?`)) return;
  setLoading(`Deleting department ${code || id}...`);
  const res = await requestJson(`/api/departments/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
  if (res.ok) {
    showToast(`Department ${code || id} deleted successfully`, 'success');
    await loadDepartments();
  }
  showResult(res);
};

async function loadReports() {
  setLoading('Loading reports...');
  const response = await requestJson('/api/reports');
  if (response.ok) renderReports(response.data || []);
  showResult(response);
}

function renderReports(reports) {
  const container = document.getElementById('reportsList');
  if (!container) return;

  if (!reports || reports.length === 0) {
    container.innerHTML = '<div class="empty-state">No reports generated yet.</div>';
    return;
  }

  container.innerHTML = reports.map(report => `
    <div class="detail-row" style="padding:14px 10px; align-items:center;">
      <div style="flex:1;">
        <strong>${escapeHtml(report.reportId)} (${escapeHtml(report.year)})</strong>
        <div class="muted">Generated on ${new Date(report.createdAt).toLocaleDateString()} | Assets: <strong>${report.totalAssets || 0}</strong> | Value: <strong>$${Number(report.totalPurchaseValue || 0).toLocaleString()}</strong></div>
      </div>
      <div style="display:flex; gap:6px;">
        <button type="button" class="btn btn-primary" style="padding:4px 10px; font-size:11.5px;" onclick="exportReport('${escapeHtml(report.reportId)}', 'pdf')">PDF</button>
        <button type="button" class="btn btn-secondary" style="padding:4px 10px; font-size:11.5px;" onclick="exportReport('${escapeHtml(report.reportId)}', 'excel')">Excel</button>
      </div>
    </div>
  `).join('');
}

window.exportReport = async function(reportId, format) {
  setLoading(`Downloading ${format.toUpperCase()} report...`);
  try {
    const response = await fetch(`/api/reports/${encodeURIComponent(reportId)}/export?format=${format}`, {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
    });
    if (!response.ok) {
      showToast('Report export failed', 'error');
      return;
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportId}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    showToast(`${format.toUpperCase()} report downloaded successfully`, 'success');
  } catch (err) {
    showToast(`Export error: ${err.message}`, 'error');
  }
};

async function loadBills() {
  setLoading('Loading bills...');
  const resp = await requestJson('/api/bills');
  if (resp.ok) {
    renderBills(resp.data || []);
    renderVerificationHistory(resp.data || []);
  }
  showResult(resp);
}

function renderBills(bills) {
  const container = document.getElementById('billsList');
  if (!container) return;

  if (!bills || bills.length === 0) {
    container.innerHTML = '<div class="empty-state">No bills uploaded yet.</div>';
    return;
  }

  container.innerHTML = bills.map(b => `
    <div class="detail-row" style="padding:14px 10px; align-items:center;">
      <div style="flex:1;">
        <div style="display:flex; align-items:center; gap:8px;">
          <strong>${escapeHtml(b.billId)} — ${escapeHtml(b.vendor)}</strong>
          <span class="status-pill ${b.verified ? 'ok' : 'neutral'}">${b.verified ? 'Verified ✓' : 'Unverified'}</span>
        </div>
        <div class="muted">Invoice: ${escapeHtml(b.invoiceNumber)} | Asset: ${escapeHtml(b.assetId || 'N/A')}</div>
      </div>
      <div>
        <button type="button" class="btn btn-secondary" style="padding:4px 10px; font-size:11.5px;" onclick="verifyBillDirect('${escapeHtml(b.billId)}', '${escapeHtml(b.documentHash || '')}')">Verify</button>
      </div>
    </div>
  `).join('');
}

function renderVerificationHistory(bills) {
  const container = document.getElementById('verificationHistory');
  if (!container) return;

  const verifiedList = (bills || []).filter(b => b.verified || b.verifiedAt);
  if (verifiedList.length === 0) {
    container.innerHTML = '<div class="empty-state">No document verification records yet.</div>';
    return;
  }

  container.innerHTML = verifiedList.map(v => `
    <div class="detail-row" style="padding:12px 10px;">
      <div>
        <strong>${escapeHtml(v.billId)}</strong>
        <div class="muted" style="font-family:var(--font-mono); font-size:11px;">Hash: ${escapeHtml((v.documentHash || v.verificationHash || '0x...').slice(0, 32))}...</div>
      </div>
      <div>
        <span class="status-pill ok">Verified</span>
      </div>
    </div>
  `).join('');
}

window.verifyBillDirect = async function(billId, hash) {
  setLoading(`Verifying bill ${billId}...`);
  const res = await requestJson(`/api/bills/${encodeURIComponent(billId)}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ billId, documentHash: hash })
  });

  if (res.ok) {
    showToast(`Bill ${billId} integrity verified on chain`, 'success');
    loadBills();
  }
  showResult(res);
};

// PROFORMA-I TO IV & AUDIT LOGS
document.querySelectorAll('.verif-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.verif-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.verif-tab-content').forEach(c => c.classList.add('hidden'));
    btn.classList.add('active');
    const targetTab = btn.getAttribute('data-verif-tab');
    const content = document.getElementById(`verif-tab-${targetTab}`);
    if (content) content.classList.remove('hidden');

    if (targetTab === 'p1') loadEquipmentVerifications();
    else if (targetTab === 'p2') loadEquipmentCondemnations();
    else if (targetTab === 'p3') loadConsumableVerifications();
    else if (targetTab === 'p4') loadConsumableCondemnations();
    else if (targetTab === 'bills') loadBills();
  });
});

async function loadEquipmentVerifications() {
  setLoading('Loading Proforma-I equipment verifications...');
  const res = await requestJson('/api/verification/equipment');
  if (res.ok) renderEquipmentVerifications(res.data || []);
  showResult(res);
}

function renderEquipmentVerifications(items) {
  const container = document.getElementById('proforma1List');
  if (!container) return;
  if (!items || items.length === 0) {
    container.innerHTML = '<div class="empty-state">No Proforma-I equipment verification records found.</div>';
    return;
  }
  container.innerHTML = items.map(p => `
    <div class="detail-row" style="padding:14px 10px; align-items:flex-start;">
      <div style="flex:1;">
        <div style="display:flex; justify-content:space-between;">
          <strong>${escapeHtml(p.recordId)} — ${escapeHtml(p.department)} (${escapeHtml(p.laboratory)})</strong>
          <span class="status-pill ok">${escapeHtml(p.status || 'Completed')}</span>
        </div>
        <div class="muted" style="margin-top:2px;">
          Date: ${escapeHtml(p.verificationDate ? p.verificationDate.slice(0,10) : '')} | Stock Book No: <strong>${escapeHtml(p.stockBookNumber)}</strong> | Staff: ${escapeHtml(p.staffInCharge)}
        </div>
        <div style="margin-top:8px; display:flex; flex-direction:column; gap:4px; font-size:12.5px;">
          ${(p.items || []).map(i => `
            <div style="background:var(--gray-50); padding:8px; border-radius:4px; border:1px solid var(--gray-200);">
              <div><strong>${escapeHtml(i.description)}</strong> (SN: ${escapeHtml(i.serialNumber || 'N/A')})</div>
              <div class="muted" style="margin-top:2px;">
                Prev Book: ${i.bookStockPreviousYear} | Added: ${i.purchasedDuringYear} | Current Book: <strong>${i.bookStockCurrentYear}</strong> | Physical: <strong>${i.actualPhysicalStock}</strong> | Variance: <span style="color:${i.difference !== 0 ? 'var(--red-600)' : 'var(--green-700)'}; font-weight:600;">${i.difference}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `).join('');
}

async function loadEquipmentCondemnations() {
  setLoading('Loading Proforma-II equipment condemnation requests...');
  const res = await requestJson('/api/verification/equipment/condemnation');
  if (res.ok) renderEquipmentCondemnations(res.data || []);
  showResult(res);
}

function renderEquipmentCondemnations(items) {
  const container = document.getElementById('proforma2List');
  if (!container) return;
  if (!items || items.length === 0) {
    container.innerHTML = '<div class="empty-state">No Proforma-II equipment condemnation records found.</div>';
    return;
  }
  container.innerHTML = items.map(p => `
    <div class="detail-row" style="padding:14px 10px; align-items:flex-start;">
      <div style="flex:1;">
        <div style="display:flex; justify-content:space-between;">
          <strong>${escapeHtml(p.recordId)} — ${escapeHtml(p.department)} (${escapeHtml(p.laboratory)})</strong>
          <span class="status-pill ${p.status === 'Approved' ? 'ok' : p.status === 'Rejected' ? 'error' : 'neutral'}">${escapeHtml(p.status)}</span>
        </div>
        <div class="muted" style="margin-top:2px;">
          Stock Book No: ${escapeHtml(p.stockBookNumber)} | Staff: ${escapeHtml(p.staffInCharge)}
        </div>
        <div style="margin-top:8px; display:flex; flex-direction:column; gap:4px; font-size:12.5px;">
          ${(p.items || []).map(i => `
            <div style="background:var(--gray-50); padding:8px; border-radius:4px; border:1px solid var(--gray-200);">
              <div><strong>${escapeHtml(i.description)}</strong> (Qty: ${i.quantity})</div>
              <div style="margin-top:2px;"><strong>Reason:</strong> ${escapeHtml(i.reasonForCondemnation || p.remarks || 'N/A')}</div>
              <div class="muted" style="margin-top:2px;">
                Purchase Value: $${Number(i.purchaseValue || 0).toLocaleString()} | Book Value: $${Number(i.bookValue || 0).toLocaleString()}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      ${(p.status === 'Pending') ? `
        <div style="display:flex; gap:6px; margin-top:4px;">
          <button type="button" class="btn btn-primary" style="padding:4px 8px; font-size:11.5px;" onclick="approveProforma2('${escapeHtml(p.recordId)}')">Approve</button>
          <button type="button" class="btn btn-secondary" style="padding:4px 8px; font-size:11.5px; color:var(--red-600);" onclick="rejectProforma2('${escapeHtml(p.recordId)}')">Reject</button>
        </div>
      ` : ''}
    </div>
  `).join('');
}

window.approveProforma2 = async function(recordId) {
  setLoading(`Approving Proforma-II ${recordId}...`);
  const res = await requestJson(`/api/verification/equipment/condemnation/${encodeURIComponent(recordId)}/approve`, { method: 'PUT' });
  if (res.ok) {
    showToast('Proforma-II condemnation approved', 'success');
    loadEquipmentCondemnations();
  }
  showResult(res);
};

window.rejectProforma2 = async function(recordId) {
  setLoading(`Rejecting Proforma-II ${recordId}...`);
  const res = await requestJson(`/api/verification/equipment/condemnation/${encodeURIComponent(recordId)}/reject`, { method: 'PUT' });
  if (res.ok) {
    showToast('Proforma-II condemnation rejected', 'success');
    loadEquipmentCondemnations();
  }
  showResult(res);
};

async function loadConsumableVerifications() {
  setLoading('Loading Proforma-III consumable stock verifications...');
  const res = await requestJson('/api/verification/consumables');
  if (res.ok) renderConsumableVerifications(res.data || []);
  showResult(res);
}

function renderConsumableVerifications(items) {
  const container = document.getElementById('proforma3List');
  if (!container) return;
  if (!items || items.length === 0) {
    container.innerHTML = '<div class="empty-state">No Proforma-III consumable verification records found.</div>';
    return;
  }
  container.innerHTML = items.map(p => `
    <div class="detail-row" style="padding:14px 10px; align-items:flex-start;">
      <div style="flex:1;">
        <div style="display:flex; justify-content:space-between;">
          <strong>${escapeHtml(p.recordId)} — ${escapeHtml(p.department)} (${escapeHtml(p.laboratory)})</strong>
          <span class="status-pill ok">${escapeHtml(p.status || 'Completed')}</span>
        </div>
        <div class="muted" style="margin-top:2px;">
          Stock Book No: ${escapeHtml(p.stockBookNumber)} | Staff: ${escapeHtml(p.staffInCharge)}
        </div>
        <div style="margin-top:8px; display:flex; flex-direction:column; gap:4px; font-size:12.5px;">
          ${(p.items || []).map(i => `
            <div style="background:var(--gray-50); padding:8px; border-radius:4px; border:1px solid var(--gray-200);">
              <div><strong>${escapeHtml(i.description)}</strong></div>
              <div class="muted" style="margin-top:2px;">
                Prev Stock: ${i.previousStock} + Purchased: ${i.purchasedQuantity} - Consumed: ${i.consumedQuantity} = Remaining Book: <strong>${i.remainingBookStock}</strong> | Physical: <strong>${i.actualPhysicalStock}</strong> | Variance: <span style="color:${i.difference !== 0 ? 'var(--red-600)' : 'var(--green-700)'}; font-weight:600;">${i.difference}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `).join('');
}

async function loadConsumableCondemnations() {
  setLoading('Loading Proforma-IV consumable condemnations...');
  const res = await requestJson('/api/verification/consumables/condemnation');
  if (res.ok) renderConsumableCondemnations(res.data || []);
  showResult(res);
}

function renderConsumableCondemnations(items) {
  const container = document.getElementById('proforma4List');
  if (!container) return;
  if (!items || items.length === 0) {
    container.innerHTML = '<div class="empty-state">No Proforma-IV consumable condemnation records found.</div>';
    return;
  }
  container.innerHTML = items.map(p => `
    <div class="detail-row" style="padding:14px 10px; align-items:flex-start;">
      <div style="flex:1;">
        <div style="display:flex; justify-content:space-between;">
          <strong>${escapeHtml(p.recordId)} — ${escapeHtml(p.department)} (${escapeHtml(p.laboratory)})</strong>
          <span class="status-pill ${p.status === 'Approved' ? 'ok' : p.status === 'Rejected' ? 'error' : 'neutral'}">${escapeHtml(p.status)}</span>
        </div>
        <div class="muted" style="margin-top:2px;">
          Stock Book No: ${escapeHtml(p.stockBookNumber)} | Staff: ${escapeHtml(p.staffInCharge)}
        </div>
        <div style="margin-top:8px; display:flex; flex-direction:column; gap:4px; font-size:12.5px;">
          ${(p.items || []).map(i => `
            <div style="background:var(--gray-50); padding:8px; border-radius:4px; border:1px solid var(--gray-200);">
              <div><strong>${escapeHtml(i.description)}</strong> (Qty: ${i.quantity})</div>
              <div style="margin-top:2px;"><strong>Reason:</strong> ${escapeHtml(i.condemnationReason || p.remarks || 'N/A')}</div>
              <div class="muted" style="margin-top:2px;">
                Book Stock: ${i.bookStock} | Physical: ${i.actualStock} | Book Value: $${Number(i.bookValue || 0).toLocaleString()}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      ${(p.status === 'Pending') ? `
        <div style="display:flex; gap:6px; margin-top:4px;">
          <button type="button" class="btn btn-primary" style="padding:4px 8px; font-size:11.5px;" onclick="approveProforma4('${escapeHtml(p.recordId)}')">Approve</button>
          <button type="button" class="btn btn-secondary" style="padding:4px 8px; font-size:11.5px; color:var(--red-600);" onclick="rejectProforma4('${escapeHtml(p.recordId)}')">Reject</button>
        </div>
      ` : ''}
    </div>
  `).join('');
}

window.approveProforma4 = async function(recordId) {
  setLoading(`Approving Proforma-IV ${recordId}...`);
  const res = await requestJson(`/api/verification/consumables/condemnation/${encodeURIComponent(recordId)}/approve`, { method: 'PUT' });
  if (res.ok) {
    showToast('Proforma-IV condemnation approved', 'success');
    loadConsumableCondemnations();
  }
  showResult(res);
};

window.rejectProforma4 = async function(recordId) {
  setLoading(`Rejecting Proforma-IV ${recordId}...`);
  const res = await requestJson(`/api/verification/consumables/condemnation/${encodeURIComponent(recordId)}/reject`, { method: 'PUT' });
  if (res.ok) {
    showToast('Proforma-IV condemnation rejected', 'success');
    loadConsumableCondemnations();
  }
  showResult(res);
};

async function loadAuditLogs() {
  setLoading('Loading system audit logs...');
  const res = await requestJson('/api/audit-logs');
  if (res.ok) renderAuditLogs(res.data || []);
  showResult(res);
}

function renderAuditLogs(logs) {
  const container = document.getElementById('auditLogsList');
  if (!container) return;
  if (!logs || logs.length === 0) {
    container.innerHTML = '<div class="empty-state">No audit logs recorded yet.</div>';
    return;
  }
  container.innerHTML = logs.map(l => `
    <div class="detail-row" style="padding:10px; font-size:12px;">
      <div style="flex:1;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong>[${escapeHtml(l.action)}] ${escapeHtml(l.resourceType)} (${escapeHtml(l.resourceId)})</strong>
          <span class="muted">${new Date(l.timestamp || l.createdAt).toLocaleString()}</span>
        </div>
        <div class="muted" style="margin-top:2px;">
          Actor: <strong>${escapeHtml(l.actor)}</strong> (${escapeHtml(l.role)}) | Tx: <span style="font-family:var(--font-mono);">${escapeHtml((l.blockchainTxHash || '0x...').slice(0,20))}...</span>
        </div>
      </div>
    </div>
  `).join('');
}

// MODAL OPENERS
document.getElementById('openProforma1ModalBtn')?.addEventListener('click', () => openModal('addProforma1Modal'));
document.getElementById('openProforma2ModalBtn')?.addEventListener('click', () => openModal('addProforma2Modal'));
document.getElementById('openProforma3ModalBtn')?.addEventListener('click', () => openModal('addProforma3Modal'));
document.getElementById('openProforma4ModalBtn')?.addEventListener('click', () => openModal('addProforma4Modal'));

// FORMS SUBMIT LISTENERS
document.getElementById('addProforma1Form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  setLoading('Saving Proforma-I equipment verification...');
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData.entries());
  const payload = {
    department: data.department,
    laboratory: data.laboratory,
    stockBookNumber: data.stockBookNumber,
    staffInCharge: data.staffInCharge,
    verificationDate: data.verificationDate,
    remarks: data.remarks || '',
    items: [
      {
        description: data.description,
        serialNumber: data.serialNumber,
        bookStockPreviousYear: Number(data.bookStockPreviousYear),
        purchasedDuringYear: Number(data.purchasedDuringYear),
        actualPhysicalStock: Number(data.actualPhysicalStock),
        workingCondition: data.workingCondition,
        purchaseValue: Number(data.purchaseValue)
      }
    ]
  };

  const res = await requestJson('/api/verification/equipment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    showToast('Proforma-I equipment verification saved', 'success');
    closeModal('addProforma1Modal');
    e.target.reset();
    loadEquipmentVerifications();
  }
  showResult(res);
});

document.getElementById('addProforma2Form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  setLoading('Submitting Proforma-II condemnation request...');
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData.entries());
  const payload = {
    department: data.department,
    laboratory: data.laboratory,
    stockBookNumber: data.stockBookNumber,
    staffInCharge: data.staffInCharge,
    verificationDate: data.verificationDate,
    remarks: data.remarks || '',
    items: [
      {
        description: data.description,
        quantity: Number(data.quantity),
        purchaseDate: data.purchaseDate,
        purchaseValue: Number(data.purchaseValue),
        bookValue: Number(data.bookValue),
        reasonForCondemnation: data.reasonForCondemnation
      }
    ]
  };

  const res = await requestJson('/api/verification/equipment/condemnation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    showToast('Proforma-II condemnation request submitted', 'success');
    closeModal('addProforma2Modal');
    e.target.reset();
    loadEquipmentCondemnations();
  }
  showResult(res);
});

document.getElementById('addProforma3Form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  setLoading('Saving Proforma-III consumable stock verification...');
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData.entries());
  const payload = {
    department: data.department,
    laboratory: data.laboratory,
    stockBookNumber: data.stockBookNumber,
    staffInCharge: data.staffInCharge,
    verificationDate: data.verificationDate,
    remarks: data.remarks || '',
    items: [
      {
        description: data.description,
        previousStock: Number(data.previousStock),
        purchasedQuantity: Number(data.purchasedQuantity),
        consumedQuantity: Number(data.consumedQuantity),
        actualPhysicalStock: Number(data.actualPhysicalStock),
        purchaseValue: Number(data.purchaseValue)
      }
    ]
  };

  const res = await requestJson('/api/verification/consumables', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    showToast('Proforma-III consumable verification saved', 'success');
    closeModal('addProforma3Modal');
    e.target.reset();
    loadConsumableVerifications();
  }
  showResult(res);
});

document.getElementById('addProforma4Form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  setLoading('Submitting Proforma-IV consumable condemnation request...');
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData.entries());
  const payload = {
    department: data.department,
    laboratory: data.laboratory,
    stockBookNumber: data.stockBookNumber,
    staffInCharge: data.staffInCharge,
    verificationDate: data.verificationDate,
    remarks: data.remarks || '',
    items: [
      {
        description: data.description,
        quantity: Number(data.quantity),
        bookStock: Number(data.bookStock),
        actualStock: Number(data.actualStock),
        purchaseDate: data.purchaseDate,
        bookValue: Number(data.bookValue),
        condemnationReason: data.condemnationReason
      }
    ]
  };

  const res = await requestJson('/api/verification/consumables/condemnation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    showToast('Proforma-IV consumable condemnation submitted', 'success');
    closeModal('addProforma4Modal');
    e.target.reset();
    loadConsumableCondemnations();
  }
  showResult(res);
});

document.querySelectorAll('.nav-item').forEach((button) => {
  button.addEventListener('click', () => {
    const page = button.getAttribute('data-page');
    if (page) navigateTo(page);
  });
});

document.getElementById('dashboardRefreshBtn')?.addEventListener('click', async () => {
  await loadDashboard();
  showToast('Dashboard refreshed', 'info');
});

document.getElementById('alertsRefreshBtn')?.addEventListener('click', async () => {
  await loadDashboard();
  showToast('Alerts refreshed', 'info');
});

document.getElementById('refreshAssetsBtn')?.addEventListener('click', async () => {
  await loadAssets();
  showToast('Asset registry refreshed', 'info');
});

document.getElementById('refreshMaintBtn')?.addEventListener('click', async () => {
  await loadMaintenance();
  showToast('Maintenance hub refreshed', 'info');
});

document.getElementById('refreshCondemnationBtn')?.addEventListener('click', async () => {
  await loadCondemnation();
  showToast('Condemnation records refreshed', 'info');
});

document.getElementById('refreshTransfersBtn')?.addEventListener('click', async () => {
  await loadTransfers();
  showToast('Asset transfers refreshed', 'info');
});

document.getElementById('refreshFinancialBtn')?.addEventListener('click', async () => {
  await loadFinancials();
  showToast('Financial valuation refreshed', 'info');
});

document.getElementById('refreshBillsBtn')?.addEventListener('click', async () => {
  await loadBills();
  showToast('Bills & invoices refreshed', 'info');
});

document.getElementById('refreshVerifBtn')?.addEventListener('click', async () => {
  await loadEquipmentVerifications();
  await loadEquipmentCondemnations();
  await loadConsumableVerifications();
  await loadConsumableCondemnations();
  showToast('Verification hub refreshed', 'info');
});

document.getElementById('refreshDepartmentsBtn')?.addEventListener('click', async () => {
  await loadDepartments();
  showToast('Departments refreshed', 'info');
});

document.getElementById('refreshReportsBtn')?.addEventListener('click', async () => {
  await loadReports();
  await loadAuditLogs();
  showToast('Reports & audit trail refreshed', 'info');
});

document.getElementById('generateReportBtn')?.addEventListener('click', async () => {
  setLoading('Generating report...');
  const response = await requestJson('/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ year: new Date().getFullYear() })
  });
  if (response.ok) {
    showToast('Yearly audit report generated', 'success');
    await loadReports();
  }
  showResult(response);
});

document.getElementById('loginForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  setLoading('Signing in...');
  const formData = new FormData(event.target);
  const response = await requestJson('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.fromEntries(formData.entries()))
  });
  
  if (response.ok) {
    authToken = response.data?.token;
    localStorage.setItem('authToken', authToken);
    currentUser = response.data?.user;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    updateUserChip();
    showToast('Sign in successful', 'success');
    navigateTo('dashboard');
  }
  showResult(response);
});

document.getElementById('searchForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  setLoading('Searching assets...');
  const formData = new FormData(event.target);
  const params = new URLSearchParams();
  Object.entries(Object.fromEntries(formData.entries())).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const response = await requestJson(`/api/assets?${params.toString()}`);
  if (response.ok) {
    renderAssetList(response.data || []);
  }
  showResult(response);
});

document.getElementById('menuToggle')?.addEventListener('click', () => {
  document.getElementById('sidebar')?.classList.toggle('open');
});

document.getElementById('showSignInTab')?.addEventListener('click', () => {
  document.getElementById('showSignInTab')?.classList.add('active');
  document.getElementById('showSignUpTab')?.classList.remove('active');
  document.getElementById('signInCard')?.classList.remove('hidden');
  document.getElementById('signUpCard')?.classList.add('hidden');
  const title = document.getElementById('authHeaderTitle');
  if (title) title.textContent = 'User Sign In';
});

document.getElementById('showSignUpTab')?.addEventListener('click', () => {
  document.getElementById('showSignUpTab')?.classList.add('active');
  document.getElementById('showSignInTab')?.classList.remove('active');
  document.getElementById('signUpCard')?.classList.remove('hidden');
  document.getElementById('signInCard')?.classList.add('hidden');
  const title = document.getElementById('authHeaderTitle');
  if (title) title.textContent = 'Department User Sign Up';
});

document.getElementById('signupForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  setLoading('Submitting registration request...');
  const formData = new FormData(event.target);
  const data = Object.fromEntries(formData.entries());

  const response = await requestJson('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (response.ok) {
    showToast(response.message || 'Registration submitted! Please wait for Admin approval.', 'success');
    event.target.reset();
    document.getElementById('showSignInTab')?.click();
  }
  showResult(response);
});

bootstrapSession();

(async function initializeApp() {
  await checkHealth();
  if (!authToken) {
    const loginRes = await requestJson('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@assetmgmt.local', password: 'Admin@12345!' })
    });
    if (loginRes.ok && loginRes.data?.token) {
      authToken = loginRes.data.token;
      localStorage.setItem('authToken', authToken);
      currentUser = loginRes.data.user || { name: 'Admin User', email: 'admin@assetmgmt.local', role: 'Administrator' };
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
      updateUserChip();
    } else {
      navigateTo('login');
      return;
    }
  }
  await loadDashboard();
})();