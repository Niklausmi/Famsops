crmNav('assets');
startClock(document.getElementById('clock'));

// ══════════════════════════════════════
//  STATE
// ══════════════════════════════════════
let allAssets = [], allJOs = [], allCustomers = [], allTrackers = [], allSIMs = [];
let filteredAssets = [], curPage = 1, perPage = 24;
let currentDrawerAsset = null;

// ══════════════════════════════════════
//  TABS
// ══════════════════════════════════════
function switchTab(name, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  btn.classList.add('active');
  if (name === 'all' && allAssets.length === 0) loadAll();
}

// ══════════════════════════════════════
//  DATA LOADING
// ══════════════════════════════════════
async function loadAll() {
  document.getElementById('assetGrid').innerHTML =
    '<div style="color:var(--muted);font-size:12px;padding:40px;text-align:center;grid-column:1/-1">Loading…</div>';

  try {
    const [asRes, joRes, cuRes, trRes, siRes] = await Promise.allSettled([
      crmGet({ action: 'getAssets' }),
      crmGet({ action: 'getJobOrders' }),
      crmGet({ action: 'getCustomers' }),
      crmGet({ action: 'getInventory', tab: 'Trackers' }),
      crmGet({ action: 'getInventory', tab: 'SIMs' }),
    ]);

    allAssets    = asRes.status   === 'fulfilled' ? (asRes.value.data   || []) : [];
    allJOs       = joRes.status   === 'fulfilled' ? (joRes.value.data   || []) : [];
    allCustomers = cuRes.status   === 'fulfilled' ? (cuRes.value.data   || []) : [];
    allTrackers  = trRes.status   === 'fulfilled' ? (trRes.value.data   || []) : [];
    allSIMs      = siRes.status   === 'fulfilled' ? (siRes.value.data   || []) : [];

    updateStats();
    applyFilters();
  } catch (err) {
    document.getElementById('assetGrid').innerHTML =
      '<div style="color:var(--danger);font-size:12px;padding:40px;text-align:center;grid-column:1/-1">⚠ ' + (err.message || 'Could not load') + '</div>';
  }
}

// ══════════════════════════════════════
//  STATS
// ══════════════════════════════════════
function updateStats() {
  const today = new Date();
  const in30  = new Date(today); in30.setDate(today.getDate() + 30);

  let active = 0, expiring = 0, expired = 0, inactive = 0;
  allAssets.forEach(a => {
    const st = (a.status || '').toLowerCase();
    if (st === 'inactive' || st === 'transferred') { inactive++; return; }
    if (a.amcExpiry) {
      const exp = new Date(a.amcExpiry);
      if (exp < today)      expired++;
      else if (exp <= in30) expiring++;
      else                  active++;
    } else {
      active++;
    }
  });

  document.getElementById('as-total').textContent    = allAssets.length;
  document.getElementById('as-active').textContent   = active;
  document.getElementById('as-expiring').textContent = expiring;
  document.getElementById('as-expired').textContent  = expired;
  document.getElementById('as-inactive').textContent = inactive;
}

// ══════════════════════════════════════
//  FILTER + SORT
// ══════════════════════════════════════
function applyFilters() {
  const q      = (document.getElementById('f-q').value    || '').toLowerCase().trim();
  const status = document.getElementById('f-status').value;
  const city   = (document.getElementById('f-city').value || '').toLowerCase().trim();
  const make   = (document.getElementById('f-make').value || '').toLowerCase().trim();
  const cust   = (document.getElementById('f-cust').value || '').toLowerCase().trim();
  const rac    = (document.getElementById('f-rac').value  || '').toLowerCase().trim();
  const sort   = document.getElementById('f-sort').value;

  const today = new Date();
  const in30  = new Date(today); in30.setDate(today.getDate() + 30);

  filteredAssets = allAssets.filter(a => {
    // Compute derived status
    const ds = deriveStatus(a, today, in30);
    const mq = !q || [a.registrationNo, a.customerName, a.trackerIMEI,
      a.simNumber, a.make, a.model, a.rac, a.company, a.contact, a.engineNo, a.chassisNo]
      .some(v => (v || '').toLowerCase().includes(q));
    const ms  = !status || ds === status;
    const mc  = !city   || (a.city || '').toLowerCase().includes(city);
    const mm  = !make   || (a.make || '').toLowerCase().includes(make);
    const mcu = !cust   || (a.customerName || '').toLowerCase().includes(cust);
    const mr  = !rac    || [(a.rac || ''), (a.company || '')].some(v => v.toLowerCase().includes(rac));
    return mq && ms && mc && mm && mcu && mr;
  });

  if (sort === 'recent')   filteredAssets.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  else if (sort === 'customer') filteredAssets.sort((a, b) => (a.customerName || '').localeCompare(b.customerName || ''));
  else if (sort === 'amc') filteredAssets.sort((a, b) => (a.amcExpiry || '9999').localeCompare(b.amcExpiry || '9999'));
  else                     filteredAssets.sort((a, b) => (a.registrationNo || '').localeCompare(b.registrationNo || ''));

  const ac = [q, status, city, make, cust, rac].filter(Boolean).length;
  const fc = document.getElementById('f-count');
  if (fc) fc.textContent = ac > 0 ? ac + ' filter' + (ac > 1 ? 's' : '') + ' active' : '';

  curPage = 1;
  renderGrid();
}

function clearFilters() {
  ['f-q', 'f-status', 'f-city', 'f-make', 'f-cust', 'f-rac'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  applyFilters();
}

function deriveStatus(a, today, in30) {
  today = today || new Date();
  in30  = in30  || (() => { const d = new Date(today); d.setDate(d.getDate() + 30); return d; })();
  const st = (a.status || '').toLowerCase();
  if (st === 'inactive' || st === 'transferred') return 'Inactive';
  if (a.amcExpiry) {
    const exp = new Date(a.amcExpiry);
    if (exp < today)     return 'Expired';
    if (exp <= in30)     return 'Expiring';
  }
  return 'Active';
}

// ══════════════════════════════════════
//  RENDER CARDS
// ══════════════════════════════════════
function renderGrid() {
  const grid  = document.getElementById('assetGrid');
  const total = filteredAssets.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  curPage = Math.min(curPage, pages);
  const start = (curPage - 1) * perPage;
  const slice = filteredAssets.slice(start, start + perPage);

  const ri = document.getElementById('res-info');
  if (ri) ri.textContent = total === 0 ? 'No assets found' :
    'Showing ' + (start + 1) + '–' + Math.min(start + perPage, total) + ' of ' + total + ' assets';

  const today = new Date();
  const in30  = new Date(today); in30.setDate(today.getDate() + 30);

  if (!slice.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="ei">🚗</div><p>No assets match your filters</p></div>';
    renderPg(0, 1); return;
  }

  grid.innerHTML = slice.map(a => {
    const idx  = allAssets.indexOf(a);
    const ds   = deriveStatus(a, today, in30);
    const stCls = ds === 'Active' ? 'st-active' : ds === 'Expiring' ? 'st-expiring' : ds === 'Expired' ? 'st-expired' : 'st-inactive';

    // Count JO activities for this vehicle
    const activities = allJOs.filter(j => j.vehicle && a.registrationNo &&
      j.vehicle.trim().toUpperCase() === a.registrationNo.trim().toUpperCase());

    return '<div class="asset-card" onclick="openDrawer(' + idx + ')">'
      + '<div class="ac-header">'
      + '<div class="ac-icon">🚗</div>'
      + '<div style="flex:1;min-width:0">'
      + '<div class="ac-reg">' + esc(a.registrationNo || '—') + '</div>'
      + '<div class="ac-vehicle">' + esc([a.make, a.model, a.color].filter(Boolean).join(' · ') || '—') + '</div>'
      + '<div class="ac-customer">' + esc(a.customerName || '—') + (a.rac ? ' <span style="color:var(--accent2)">· ' + esc(a.rac) + '</span>' : '') + '</div>'
      + '</div></div>'
      + '<div class="ac-body">'
      + '<div class="ac-row"><span class="ac-lbl">Tracker</span><span class="ac-val" style="color:' + (a.trackerIMEI ? 'var(--accent)' : 'var(--muted2)') + '">' + esc(a.trackerIMEI || 'Not assigned') + '</span></div>'
      + '<div class="ac-row"><span class="ac-lbl">SIM</span><span class="ac-val" style="color:' + (a.simNumber ? 'var(--accent2)' : 'var(--muted2)') + '">' + esc(a.simNumber || 'Not assigned') + '</span></div>'
      + '<div class="ac-row"><span class="ac-lbl">Install Date</span><span class="ac-val">' + esc(a.installDate || '—') + '</span></div>'
      + '<div class="ac-row"><span class="ac-lbl">AMC Expiry</span><span class="ac-val" style="color:' + (ds === 'Expiring' ? 'var(--warn)' : ds === 'Expired' ? 'var(--danger)' : 'var(--text)') + '">' + esc(a.amcExpiry || '—') + '</span></div>'
      + '</div>'
      + '<div class="ac-footer">'
      + '<span class="ac-status ' + stCls + '">' + ds + '</span>'
      + '<span style="font-size:10px;color:var(--muted)">' + activities.length + ' activit' + (activities.length === 1 ? 'y' : 'ies') + '</span>'
      + '</div>'
      + '</div>';
  }).join('');

  renderPg(total, pages);
}

function renderPg(total, pages) {
  const bar = document.getElementById('pg-btns'); if (!bar) return;
  if (total === 0) { bar.innerHTML = ''; return; }
  const b = (lbl, pg, dis, act) =>
    '<button class="pgb' + (act ? ' act' : '') + '" onclick="goPg(' + pg + ')" ' + (dis ? 'disabled' : '') + '>' + lbl + '</button>';
  let h = b('‹', curPage - 1, curPage === 1, false);
  const s = Math.max(1, curPage - 2), e = Math.min(pages, curPage + 2);
  if (s > 1) { h += b('1', 1, false, false); if (s > 2) h += '<span style="color:var(--muted);padding:0 3px;font-size:11px">…</span>'; }
  for (let p = s; p <= e; p++) h += b(p, p, false, p === curPage);
  if (e < pages) { if (e < pages - 1) h += '<span style="color:var(--muted);padding:0 3px;font-size:11px">…</span>'; h += b(pages, pages, false, false); }
  h += b('›', curPage + 1, curPage === pages, false);
  bar.innerHTML = h;
  const ji = document.getElementById('pg-inp'); if (ji) { ji.value = curPage; ji.max = pages; }
}

function goPg(p) { curPage = p; renderGrid(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
function jumpPg() { const p = parseInt(document.getElementById('pg-inp').value), pg = Math.ceil(filteredAssets.length / perPage); if (p >= 1 && p <= pg) goPg(p); }
function changePP() { perPage = parseInt(document.getElementById('pp-sel').value); curPage = 1; renderGrid(); }

// ══════════════════════════════════════
//  DETAIL DRAWER
// ══════════════════════════════════════
function openDrawer(idx) {
  const a = allAssets[idx]; if (!a) return;
  currentDrawerAsset = { ...a, _idx: idx };

  document.getElementById('dr-reg').textContent     = a.registrationNo || '—';
  document.getElementById('dr-vehicle').textContent = [a.make, a.model, a.year, a.color].filter(Boolean).join(' · ') || '—';
  document.getElementById('dr-cust').textContent    = (a.customerName || '—') + (a.rac ? ' · ' + a.rac : '') + (a.company ? ' · ' + a.company : '');

  const today = new Date(), in30 = new Date(today); in30.setDate(today.getDate() + 30);
  const ds = deriveStatus(a, today, in30);
  const stCls = ds === 'Active' ? 'st-active' : ds === 'Expiring' ? 'st-expiring' : ds === 'Expired' ? 'st-expired' : 'st-inactive';

  const f  = (l, v) => v ? '<div class="ig-item"><div class="ig-l">' + l + '</div><div class="ig-v">' + esc(v) + '</div></div>' : '';
  const sec = (t) => '<div class="drw-sec">' + t + '</div>';

  // Get all JO activity for this reg
  const activities = allJOs
    .filter(j => j.vehicle && a.registrationNo && j.vehicle.trim().toUpperCase() === a.registrationNo.trim().toUpperCase())
    .sort((x, y) => (y.date || '').localeCompare(x.date || ''));

  // Activity colour map
  const tocColor = { new_installation: 'var(--accent)', replacement: 'var(--warn)', removal: 'var(--danger)' };
  const tocLabel = { new_installation: 'New Installation', replacement: 'Replacement / Transfer', removal: 'Removal' };

  const actHTML = activities.length
    ? activities.map(j => {
        const toc = j.toc || 'new_installation';
        const col = tocColor[toc] || 'var(--muted)';
        return '<div class="activity-item act-' + toc + '">'
          + '<span class="act-type" style="color:' + col + '">' + (tocLabel[toc] || toc) + '</span>'
          + '<span class="act-date">' + esc(j.date || '—') + '</span>'
          + '<div class="act-detail">'
          + esc(j.customer || '—') + ' · ' + esc(j.installer || '—')
          + (j.imei ? ' · IMEI: ' + esc(j.imei) : '')
          + (j.gsm  ? ' · SIM: '  + esc(j.gsm)  : '')
          + '</div>'
          + '<div class="act-invoice">' + esc(j.invoiceNumber || '') + (j.package ? ' · ' + esc(j.package) : '') + '</div>'
          + '</div>';
      }).join('')
    : '<div style="color:var(--muted);font-size:12px;padding:10px 0">No job order activity recorded for this vehicle</div>';

  document.getElementById('dr-body').innerHTML =
    // Status banner
    '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">'
    + '<div><div style="font-size:9px;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:2px">Asset ID</div>'
    + '<div style="font-family:var(--mono);font-size:12px;color:var(--accent)">' + esc(a.assetId || '—') + '</div></div>'
    + '<span class="ac-status ' + stCls + '">' + ds + '</span>'
    + '</div>'

    // Devices
    + sec('📡 Linked Devices')
    + '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:4px">'
    + '<div class="device-pill"><div><div class="dp-label">Tracker IMEI</div><div class="dp-val">' + esc(a.trackerIMEI || 'Not assigned') + '</div></div></div>'
    + '<div class="device-pill"><div><div class="dp-label">SIM Number</div><div class="dp-val">' + esc(a.simNumber || 'Not assigned') + '</div></div></div>'
    + '</div>'

    // Vehicle info
    + sec('🚗 Vehicle Details')
    + '<div class="info-grid">'
    + f('Registration', a.registrationNo) + f('Make', a.make) + f('Model', a.model) + f('Color', a.color)
    + f('Year', a.year) + f('Engine No.', a.engineNo) + f('Chassis No.', a.chassisNo)
    + '</div>'

    // Customer
    + sec('👤 Customer')
    + '<div class="info-grid">'
    + f('Name', a.customerName) + f('Contact', a.contact) + f('RAC / Group', a.rac) + f('Company', a.company)
    + f('City', a.city)
    + '</div>'

    // Installation
    + sec('🔧 Installation')
    + '<div class="info-grid">'
    + f('Install Date', a.installDate) + f('Installer', a.installer)
    + f('Package', a.package) + f('AMC Duration', a.amc)
    + f('AMC Expiry', a.amcExpiry)
    + '</div>'

    // Notes
    + (a.notes ? '<div style="background:var(--surface2);border-radius:8px;padding:10px 12px;margin-top:8px;font-size:12px;color:var(--muted)">' + esc(a.notes) + '</div>' : '')

    // Activity
    + sec('📋 Activity History (' + activities.length + ' records)')
    + actHTML;

  document.getElementById('assetDrawer').classList.add('open');
}

function closeDrawer() { document.getElementById('assetDrawer').classList.remove('open'); }
document.getElementById('assetDrawer').addEventListener('click', e => {
  if (e.target === document.getElementById('assetDrawer')) closeDrawer();
});

function editAssetFromDrawer() {
  if (!currentDrawerAsset) return;
  closeDrawer();
  loadAssetIntoForm(currentDrawerAsset);
  switchTab('add', document.getElementById('tab-add'));
}

// ══════════════════════════════════════
//  CUSTOMER SEARCH (for form)
// ══════════════════════════════════════
let _selectedCust = null;

function searchCustForAsset(q) {
  const dd = document.getElementById('cust-dd-asset');
  q = (q || '').toLowerCase().trim();
  if (q.length < 2) { dd.classList.remove('open'); return; }

  const hits = allCustomers.filter(c =>
    [c.customerName, c.contact, c.cnic, c.company, c.rac, c.city, c.customerId]
      .some(v => (v || '').toLowerCase().includes(q))
  ).slice(0, 8);

  if (!hits.length) {
    dd.innerHTML = '<div style="padding:12px;font-size:12px;color:var(--muted);text-align:center">No customers found</div>';
    dd.classList.add('open'); return;
  }

  dd.innerHTML = hits.map((c, i) =>
    '<div class="copt" onclick="pickCustForAsset(' + i + ')">'
    + '<div class="copt-name">' + esc(c.customerName || '—') + (c.company ? ' <span style="color:var(--accent2);font-weight:400">· ' + esc(c.company) + '</span>' : '') + '</div>'
    + '<div class="copt-meta">' + esc(c.contact || '—') + ' · ' + esc(c.city || '—') + (c.rac ? ' · RAC: ' + esc(c.rac) : '') + '</div>'
    + '</div>'
  ).join('');
  dd._hits = hits;
  dd.classList.add('open');
}

function pickCustForAsset(i) {
  const dd = document.getElementById('cust-dd-asset');
  const c  = dd._hits ? dd._hits[i] : allCustomers[i];
  if (!c) return;
  _selectedCust = c;

  document.getElementById('sel-cust-name').textContent = c.customerName + (c.company ? ' — ' + c.company : '');
  document.getElementById('sel-cust-meta').textContent = [c.contact, c.city, c.rac ? 'RAC: ' + c.rac : ''].filter(Boolean).join(' · ');
  document.getElementById('sel-cust-banner').style.display = 'flex';
  document.getElementById('cust-dd-asset').classList.remove('open');
  document.getElementById('cust-search').value = '';

  // Auto-fill hidden fields
  document.getElementById('a-custId').value      = c.customerId || '';
  document.getElementById('a-custName').value    = c.customerName || '';
  document.getElementById('a-custContact').value = c.contact || '';
  document.getElementById('a-custRac').value     = c.rac || '';
  document.getElementById('a-custCompany').value = c.company || '';
  document.getElementById('a-custCity').value    = c.city || '';
  if (!document.getElementById('a-city').value) document.getElementById('a-city').value = c.city || '';
}

function clearCustForAsset() {
  _selectedCust = null;
  document.getElementById('sel-cust-banner').style.display = 'none';
  ['a-custId','a-custName','a-custContact','a-custRac','a-custCompany','a-custCity'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
}

document.addEventListener('click', e => {
  if (!e.target.closest('.cust-wrap')) document.getElementById('cust-dd-asset').classList.remove('open');
  if (!e.target.closest('[id="a-imei"]') && !e.target.closest('#tracker-dd')) document.getElementById('tracker-dd').classList.remove('open');
  if (!e.target.closest('[id="a-sim"]')  && !e.target.closest('#sim-dd'))     document.getElementById('sim-dd').classList.remove('open');
});

function toggleManualCust() {
  const area = document.getElementById('manual-cust-area');
  const btn  = document.getElementById('btn-manual');
  const open = area.style.display !== 'none';
  area.style.display = open ? 'none' : 'block';
  btn.textContent    = open ? '＋ Enter customer manually instead' : '✕ Hide manual entry';
}

// ══════════════════════════════════════
//  TRACKER & SIM SEARCH
// ══════════════════════════════════════
function searchTracker(q) {
  const dd = document.getElementById('tracker-dd');
  q = (q || '').toLowerCase().trim();
  if (q.length < 2) { dd.classList.remove('open'); return; }

  const hits = allTrackers.filter(t =>
    (t.imei || '').toLowerCase().includes(q) ||
    (t.model || '').toLowerCase().includes(q)
  ).slice(0, 6);

  if (!hits.length) { dd.classList.remove('open'); return; }

  dd.innerHTML = hits.map((t, i) => {
    const avail = (t.status || '').toLowerCase() !== 'assigned';
    return '<div class="copt" onclick="pickTracker(' + i + ')" style="opacity:' + (avail ? '1' : '0.55') + '">'
      + '<div class="copt-name" style="font-family:var(--mono)">' + esc(t.imei || '—') + '</div>'
      + '<div class="copt-meta">' + esc(t.model || '—') + ' · <span style="color:' + (avail ? 'var(--success)' : 'var(--warn)') + '">' + esc(t.status || 'Available') + '</span></div>'
      + '</div>';
  }).join('');
  dd._hits = hits;
  dd.classList.add('open');
}

function pickTracker(i) {
  const dd = document.getElementById('tracker-dd');
  const t  = dd._hits ? dd._hits[i] : allTrackers[i];
  if (!t) return;
  document.getElementById('a-imei').value = t.imei || '';
  document.getElementById('tracker-status-hint').textContent = 'Model: ' + (t.model || '—') + ' · Status: ' + (t.status || 'Available');
  dd.classList.remove('open');
}

function searchSIM(q) {
  const dd = document.getElementById('sim-dd');
  q = (q || '').toLowerCase().trim();
  if (q.length < 2) { dd.classList.remove('open'); return; }

  const hits = allSIMs.filter(s =>
    (s.simNumber || '').toLowerCase().includes(q) ||
    (s.iccid     || '').toLowerCase().includes(q) ||
    (s.network   || '').toLowerCase().includes(q)
  ).slice(0, 6);

  if (!hits.length) { dd.classList.remove('open'); return; }

  dd.innerHTML = hits.map((s, i) => {
    const avail = (s.status || '').toLowerCase() !== 'installed';
    return '<div class="copt" onclick="pickSIM(' + i + ')" style="opacity:' + (avail ? '1' : '0.55') + '">'
      + '<div class="copt-name" style="font-family:var(--mono)">' + esc(s.simNumber || '—') + '</div>'
      + '<div class="copt-meta">' + esc(s.network || '—') + (s.plan ? ' · ' + esc(s.plan) : '') + ' · <span style="color:' + (avail ? 'var(--success)' : 'var(--warn)') + '">' + esc(s.status || 'Available') + '</span></div>'
      + '</div>';
  }).join('');
  dd._hits = hits;
  dd.classList.add('open');
}

function pickSIM(i) {
  const dd = document.getElementById('sim-dd');
  const s  = dd._hits ? dd._hits[i] : allSIMs[i];
  if (!s) return;
  document.getElementById('a-sim').value = s.simNumber || '';
  document.getElementById('sim-status-hint').textContent = 'Network: ' + (s.network || '—') + ' · Status: ' + (s.status || 'Available');
  dd.classList.remove('open');
}

// ══════════════════════════════════════
//  SAVE ASSET
// ══════════════════════════════════════
async function saveAsset() {
  const reg   = document.getElementById('a-reg').value.trim();
  const make  = document.getElementById('a-make').value.trim();
  const model = document.getElementById('a-model').value.trim();
  const errEl = document.getElementById('asset-err');
  const okEl  = document.getElementById('asset-ok');
  errEl.style.display = 'none'; okEl.style.display = 'none';

  if (!reg)   { errEl.textContent = '⚠ Registration number is required'; errEl.style.display = 'block'; return; }
  if (!make)  { errEl.textContent = '⚠ Make is required';                 errEl.style.display = 'block'; return; }
  if (!model) { errEl.textContent = '⚠ Model is required';                errEl.style.display = 'block'; return; }

  // Resolve customer
  const useManual = document.getElementById('manual-cust-area').style.display !== 'none';
  const custId      = document.getElementById('a-custId').value      || '';
  const customerName= useManual ? document.getElementById('a-manualCust').value.trim()    : document.getElementById('a-custName').value;
  const contact      = useManual ? document.getElementById('a-manualContact').value.trim() : document.getElementById('a-custContact').value;
  const rac          = useManual ? document.getElementById('a-manualRac').value.trim()     : document.getElementById('a-custRac').value;
  const company      = useManual ? '' : document.getElementById('a-custCompany').value;

  const existingId = document.getElementById('asset-id').value.trim();
  const assetId    = existingId || ('AST-' + Date.now().toString(36).toUpperCase().slice(-8));

  const payload = {
    action:       'submitAsset',
    sheetTab:     'Assets',
    assetId,
    registrationNo: reg.toUpperCase(),
    make,
    model,
    color:        document.getElementById('a-color').value.trim(),
    year:         document.getElementById('a-year').value.trim(),
    engineNo:     document.getElementById('a-engine').value.trim(),
    chassisNo:    document.getElementById('a-chassis').value.trim(),
    customerId:   custId,
    customerName,
    contact,
    rac,
    company,
    city:         document.getElementById('a-city').value.trim() || document.getElementById('a-custCity').value,
    trackerIMEI:  document.getElementById('a-imei').value.trim(),
    simNumber:    document.getElementById('a-sim').value.trim(),
    installDate:  document.getElementById('a-installDate').value,
    installer:    document.getElementById('a-installer').value.trim(),
    package:      document.getElementById('a-package').value.trim(),
    amc:          document.getElementById('a-amc').value.trim(),
    amcExpiry:    document.getElementById('a-amcExpiry').value,
    status:       document.getElementById('a-status').value,
    notes:        document.getElementById('a-notes').value.trim(),
  };

  try {
    const res = await crmPost(payload);
    if (res.status === 'error') throw new Error(res.message);

    // Update local array
    if (existingId) {
      const idx = allAssets.findIndex(a => a.assetId === existingId);
      if (idx >= 0) Object.assign(allAssets[idx], payload);
    } else {
      allAssets.push(payload);
    }

    okEl.textContent = '✓ Asset ' + (existingId ? 'updated' : 'created') + ' — ID: ' + assetId;
    okEl.style.display = 'block';
    if (!existingId) resetAssetForm();
    updateStats();
    applyFilters();
  } catch (err) {
    errEl.textContent = '⚠ ' + (err.message || 'Save failed');
    errEl.style.display = 'block';
  }
}

function loadAssetIntoForm(a) {
  document.getElementById('asset-id').value     = a.assetId || '';
  document.getElementById('form-title').textContent = 'Edit Asset — ' + (a.registrationNo || '');
  document.getElementById('form-sub').textContent   = 'Editing existing asset record';
  document.getElementById('btn-reset-form').textContent = 'Cancel Edit';

  document.getElementById('a-reg').value         = a.registrationNo || '';
  document.getElementById('a-make').value        = a.make || '';
  document.getElementById('a-model').value       = a.model || '';
  document.getElementById('a-color').value       = a.color || '';
  document.getElementById('a-year').value        = a.year || '';
  document.getElementById('a-engine').value      = a.engineNo || '';
  document.getElementById('a-chassis').value     = a.chassisNo || '';
  document.getElementById('a-imei').value        = a.trackerIMEI || '';
  document.getElementById('a-sim').value         = a.simNumber || '';
  document.getElementById('a-installDate').value = a.installDate || '';
  document.getElementById('a-installer').value   = a.installer || '';
  document.getElementById('a-package').value     = a.package || '';
  document.getElementById('a-amc').value         = a.amc || '';
  document.getElementById('a-amcExpiry').value   = a.amcExpiry || '';
  document.getElementById('a-city').value        = a.city || '';
  document.getElementById('a-notes').value       = a.notes || '';
  document.getElementById('a-status').value      = a.status || 'Active';

  // Customer
  if (a.customerId) {
    document.getElementById('a-custId').value      = a.customerId;
    document.getElementById('a-custName').value    = a.customerName || '';
    document.getElementById('a-custContact').value = a.contact || '';
    document.getElementById('a-custRac').value     = a.rac || '';
    document.getElementById('a-custCompany').value = a.company || '';
    document.getElementById('sel-cust-name').textContent = a.customerName + (a.company ? ' — ' + a.company : '');
    document.getElementById('sel-cust-meta').textContent = [a.contact, a.city, a.rac ? 'RAC: ' + a.rac : ''].filter(Boolean).join(' · ');
    document.getElementById('sel-cust-banner').style.display = 'flex';
  } else if (a.customerName) {
    // Manual customer
    document.getElementById('manual-cust-area').style.display = 'block';
    document.getElementById('btn-manual').textContent = '✕ Hide manual entry';
    document.getElementById('a-manualCust').value    = a.customerName;
    document.getElementById('a-manualContact').value = a.contact || '';
    document.getElementById('a-manualRac').value     = a.rac || '';
    document.getElementById('a-manualCity').value    = a.city || '';
  }

  document.getElementById('asset-err').style.display = 'none';
  document.getElementById('asset-ok').style.display  = 'none';
}

function resetAssetForm() {
  document.getElementById('asset-id').value = '';
  document.getElementById('form-title').textContent = 'Add New Asset';
  document.getElementById('form-sub').textContent   = 'Register a vehicle in the fleet. Linked tracker & SIM auto-populate from Inventory.';
  document.getElementById('btn-reset-form').textContent = 'Clear';
  ['a-reg','a-make','a-model','a-color','a-year','a-engine','a-chassis',
   'a-imei','a-sim','a-installDate','a-installer','a-package','a-amc','a-amcExpiry',
   'a-city','a-notes','cust-search'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('a-status').value = 'Active';
  clearCustForAsset();
  document.getElementById('manual-cust-area').style.display = 'none';
  document.getElementById('btn-manual').textContent = '＋ Enter customer manually instead';
  document.getElementById('asset-err').style.display = 'none';
  document.getElementById('asset-ok').style.display  = 'none';
  document.getElementById('tracker-status-hint').textContent = '';
  document.getElementById('sim-status-hint').textContent = '';
}

// ══════════════════════════════════════
//  UTIL
// ══════════════════════════════════════
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Load data on initial tab view
loadAll();
