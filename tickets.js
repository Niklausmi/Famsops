crmNav('tickets');
startClock(document.getElementById('clock'));

// ── State ─────────────────────────────────────────────
let allCustomers = [], allAssets = [], allTickets = [];
let filteredTkts = [], tktPage = 1, tktPP = 25;
let tktSortKey = 'createdAt', tktSortDir = 'desc';

// ── Tab switching ─────────────────────────────────────
function switchTTab(name, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tpanel-' + name).classList.add('active');
  btn.classList.add('active');
  if (name === 'list' && allTickets.length === 0) loadTickets();
  genBadge();
}

// ── Ticket ID badge ────────────────────────────────────
function genBadge() {
  document.getElementById('tkt-badge').textContent = 'TKT-' + Date.now().toString(36).toUpperCase().slice(-8);
}
genBadge();

// ── Init — load customers + assets, then check prefill ─
(async function init() {
  try {
    const [cr, ar] = await Promise.allSettled([
      crmGet({ action: 'getCustomers' }),
      crmGet({ action: 'getAssets' }),
    ]);
    allCustomers = cr.status === 'fulfilled' ? (cr.value.data || []) : [];
    allAssets    = ar.status === 'fulfilled' ? (ar.value.data || []) : [];
  } catch(e) {}

  // Prefill from customer hub
  const pf = sessionStorage.getItem('crm_prefill');
  if (!pf) return;
  try {
    const d = JSON.parse(pf);
    sessionStorage.removeItem('crm_prefill');
    if (!d.custId) return;
    const c = allCustomers.find(x => x.customerId === d.custId) || {
      customerId: d.custId, customerName: d.custName || '',
      contact: d.contact || '', city: d.city || '',
      rac: d.rac || '', company: d.company || '', email: d.email || '',
    };
    // Apply to all 3 forms
    custApply('l', c);
    custApply('q', c);
    custApply('c', c);
    // Populate assets for all 3 forms
    populateAssets('q', c.customerId);
    populateAssets('c', c.customerId);
  } catch(e) {}
})();

// ══════════════════════════════════════════════════════
//  SHARED — Customer search (prefix = 'l', 'q', or 'c')
// ══════════════════════════════════════════════════════
function custSearch(px, q) {
  const dd = document.getElementById(px + '-cust-dd');
  q = (q || '').toLowerCase().trim();
  if (q.length < 2) { dd.classList.remove('open'); return; }

  const hits = allCustomers.filter(c =>
    [c.customerName, c.contact, c.cnic, c.company, c.rac, c.city, c.customerId, c.email]
      .some(v => (v || '').toLowerCase().includes(q))
  ).slice(0, 10);

  if (!hits.length) {
    dd.innerHTML = '<div style="padding:12px 14px;font-size:12px;color:var(--muted);text-align:center">No match — <a href="customers.html" style="color:var(--accent)">add customer</a></div>';
    dd.classList.add('open'); return;
  }

  dd.innerHTML = hits.map((c, i) =>
    '<div class="copt" onclick="custPick(\'' + px + '\',' + allCustomers.indexOf(c) + ')">'
    + '<div class="copt-name">' + esc(c.customerName || '—')
    + (c.company ? ' <span style="color:var(--accent2)">· ' + esc(c.company) + '</span>' : '') + '</div>'
    + (c.rac ? '<div class="copt-sub">RAC: ' + esc(c.rac) + '</div>' : '')
    + '<div class="copt-meta">' + esc(c.contact || '—') + ' · ' + esc(c.city || '—') + '</div>'
    + '<div class="copt-id">' + esc(c.customerId || '') + '</div>'
    + '</div>'
  ).join('');
  dd.classList.add('open');
}

function custPick(px, idx) {
  const c = allCustomers[idx]; if (!c) return;
  custApply(px, c);
  document.getElementById(px + '-cust-dd').classList.remove('open');
  // Populate assets for query and complaint tabs
  if (px === 'q' || px === 'c') populateAssets(px, c.customerId);
}

function custApply(px, c) {
  const set = (id, v) => { const el = document.getElementById(px + '-' + id); if (el) el.value = v || ''; };
  set('custId',  c.customerId);
  set('custName',c.customerName);
  set('contact', c.contact);
  set('city',    c.city);
  set('rac',     c.rac);
  set('company', c.company);
  if (px === 'l') set('email', c.email);

  const nameEl = document.getElementById(px + '-sel-name');
  const metaEl = document.getElementById(px + '-sel-meta');
  const banEl  = document.getElementById(px + '-sel-ban');
  const qEl    = document.getElementById(px + '-cust-q');
  if (nameEl) nameEl.textContent = c.customerName + (c.company ? ' — ' + c.company : '');
  if (metaEl) metaEl.textContent = [c.contact, c.city, c.rac ? 'RAC: ' + c.rac : ''].filter(Boolean).join(' · ');
  if (banEl)  banEl.classList.add('on');
  if (qEl)    qEl.value = '';
}

function custClear(px) {
  ['custId','custName','contact','city','rac','company','email'].forEach(id => {
    const el = document.getElementById(px + '-' + id); if (el) el.value = '';
  });
  const ban = document.getElementById(px + '-sel-ban');
  if (ban) ban.classList.remove('on');
  const qEl = document.getElementById(px + '-cust-q');
  if (qEl) qEl.value = '';
  if (px === 'q' || px === 'c') populateAssets(px, null);
}

// Close all dropdowns on outside click
document.addEventListener('click', e => {
  if (!e.target.closest('.cust-wrap')) {
    document.querySelectorAll('.cust-dd').forEach(d => d.classList.remove('open'));
  }
});

// ══════════════════════════════════════════════════════
//  SHARED — Asset cascade (query + complaint only)
// ══════════════════════════════════════════════════════
function populateAssets(px, custId) {
  const sel  = document.getElementById(px + '-asset'); if (!sel) return;
  const hint = document.getElementById(px + '-asset-hint');
  sel.innerHTML = '<option value="">— Not vehicle-specific —</option>';
  const r = document.getElementById(px + '-reg');
  const i = document.getElementById(px + '-imei');
  const s = document.getElementById(px + '-sim');
  const ai = document.getElementById(px + '-assetId');
  if (r) r.value = ''; if (i) i.value = ''; if (s) s.value = '';
  if (ai) ai.value = '';
  if (hint) hint.textContent = '';
  if (!custId) return;

  const custAssets = allAssets.filter(a => a.customerId === custId);
  if (!custAssets.length) {
    sel.innerHTML += '<option disabled>No assets for this customer</option>';
    return;
  }
  custAssets.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.assetId;
    opt.textContent = (a.registrationNo || '?') + ' — ' + [a.make, a.model, a.color].filter(Boolean).join(' ');
    sel.appendChild(opt);
  });
}

function assetCascade(px) {
  const sel  = document.getElementById(px + '-asset');
  const assetId = sel ? sel.value : '';
  const a = allAssets.find(x => x.assetId === assetId);
  const hint = document.getElementById(px + '-asset-hint');
  const ai   = document.getElementById(px + '-assetId');
  if (ai) ai.value = assetId;

  const set = (id, v) => { const el = document.getElementById(px + '-' + id); if (el) el.value = v || ''; };
  if (!a) { set('reg',''); set('imei',''); set('sim',''); if (hint) hint.textContent = ''; return; }
  set('reg',  a.registrationNo || '');
  set('imei', a.trackerIMEI   || '');
  set('sim',  a.simNumber     || '');
  if (hint) hint.textContent = '✓ ' + [a.make, a.model, a.color].filter(Boolean).join(' ')
    + (a.amcExpiry ? ' · AMC: ' + a.amcExpiry : '')
    + (a.installDate ? ' · Installed: ' + a.installDate : '');
}

// ══════════════════════════════════════════════════════
//  SHARED — Priority pills (prefix = 'l', 'q', or 'c')
// ══════════════════════════════════════════════════════
function selPrio(px, val, el) {
  const bar = el.closest('.prio-row') || el.parentNode;
  bar.querySelectorAll('.pp').forEach(p => {
    p.classList.remove('sel');
  });
  el.classList.add('sel');
  const hid = document.getElementById(px + '-prio');
  if (hid) hid.value = val;
}

// ══════════════════════════════════════════════════════
//  SHARED — Build base ticket payload
// ══════════════════════════════════════════════════════
function basePayload(px, type) {
  const user = crmCurrentUser();
  // gStr: returns text value or empty string (safe for text columns)
  const gStr  = id => { const el = document.getElementById(px + '-' + id); return el ? el.value.trim() : ''; };
  // gDate: returns date string or null (PostgreSQL date columns reject empty strings)
  const gDate = id => { const v = gStr(id); return v || null; };

  const ticketId = document.getElementById('tkt-badge').textContent.trim()
    || ('TKT-' + Date.now().toString(36).toUpperCase().slice(-8));
  const assetId  = gStr('assetId') || null;
  let make = '', model = '', trackerIMEI = '', simNumber = '';
  if (assetId) {
    const a = allAssets.find(x => x.assetId === assetId);
    if (a) { make = a.make || ''; model = a.model || ''; trackerIMEI = a.trackerIMEI || ''; simNumber = a.simNumber || ''; }
  }
  return {
    action: 'submitTicket', sheetTab: 'Tickets',
    ticketId,
    type,
    customerId:     gStr('custId')   || null,
    customerName:   gStr('custName') || null,
    contact:        gStr('contact')  || null,
    city:           gStr('city')     || null,
    rac:            gStr('rac')      || null,
    company:        gStr('company')  || null,
    assetId,
    registrationNo: gStr('reg')      || null,
    make:           make             || null,
    model:          model            || null,
    trackerIMEI:    trackerIMEI      || null,
    simNumber:      simNumber        || null,
    status:    'Open',
    createdBy: user ? user.name : null,
    linkedJobOrder: null,
    resolution:     null,
    closedAt:       null,
    linkedLeadId:   null,
  };
}

// ══════════════════════════════════════════════════════
//  SUBMIT — Lead
// ══════════════════════════════════════════════════════
async function submitLead() {
  const errEl = document.getElementById('l-err');
  errEl.style.display = 'none';
  const custId = document.getElementById('l-custId').value;
  const title  = document.getElementById('l-title').value.trim();
  if (!custId) { errEl.textContent = '⚠ Select a customer first'; errEl.style.display = 'block'; return; }
  if (!title)  { errEl.textContent = '⚠ Lead title is required'; errEl.style.display = 'block'; return; }

  const p = basePayload('l', 'Lead');
  p.title = title;
  p.description      = document.getElementById('l-description').value.trim();
  p.priority         = document.getElementById('l-prio').value || 'Medium';
  p.interestedPackage= document.getElementById('l-package').value;
  p.noOfVehicles     = document.getElementById('l-vehicles').value.trim();
  p.budget           = document.getElementById('l-budget').value;
  p.purchaseTimeline = document.getElementById('l-timeline').value;
  p.preferredPayment = document.getElementById('l-payment').value;
  p.followUpDate     = document.getElementById('l-followup').value || null;
  p.leadSource       = document.getElementById('l-source').value;
  p.salesPerson      = document.getElementById('l-salesperson').value.trim();

  const btn = document.querySelector('#tpanel-lead .btn-solid');
  btn.textContent = 'Submitting…'; btn.disabled = true;
  try {
    const res = await crmPost(p);
    if (res.status === 'error') throw new Error(res.message);
    // Backend auto-creates Sales Lead entry (handleSubmitTicket does this when type=Lead)
    allTickets.push(p);
    genBadge();
    resetForm('l');
    showToast('✓ Lead ' + p.ticketId + ' created — Sales Lead auto-generated');
  } catch(err) {
    errEl.textContent = '⚠ ' + (err.message || 'Submit failed');
    errEl.style.display = 'block';
  } finally {
    btn.textContent = 'Submit Lead →'; btn.disabled = false;
  }
}

// ══════════════════════════════════════════════════════
//  SUBMIT — Query
// ══════════════════════════════════════════════════════
async function submitQuery() {
  const errEl = document.getElementById('q-err');
  errEl.style.display = 'none';
  const custId   = document.getElementById('q-custId').value;
  const category = document.getElementById('q-category').value;
  const title    = document.getElementById('q-title').value.trim();
  const details  = document.getElementById('q-details').value.trim();
  if (!custId)   { errEl.textContent = '⚠ Select a customer first';    errEl.style.display = 'block'; return; }
  if (!category) { errEl.textContent = '⚠ Query category is required'; errEl.style.display = 'block'; return; }
  if (!title)    { errEl.textContent = '⚠ Subject is required';        errEl.style.display = 'block'; return; }
  if (!details)  { errEl.textContent = '⚠ Full query details required'; errEl.style.display = 'block'; return; }

  const p = basePayload('q', 'Query');
  p.title          = title;
  p.description    = details;
  p.priority       = document.getElementById('q-prio').value || 'Medium';
  p.queryCategory  = category;
  p.queryDetails   = details;
  p.assignedTo     = document.getElementById('q-assigned').value.trim();

  const btn = document.querySelector('#tpanel-query .btn-solid');
  btn.textContent = 'Submitting…'; btn.disabled = true;
  try {
    const res = await crmPost(p);
    if (res.status === 'error') throw new Error(res.message);
    allTickets.push(p);
    genBadge();
    resetForm('q');
    showToast('✓ Query ' + p.ticketId + ' submitted');
  } catch(err) {
    errEl.textContent = '⚠ ' + (err.message || 'Submit failed');
    errEl.style.display = 'block';
  } finally {
    btn.textContent = 'Submit Query →'; btn.disabled = false;
  }
}

// ══════════════════════════════════════════════════════
//  SUBMIT — Complaint
// ══════════════════════════════════════════════════════
async function submitComplaint() {
  const errEl = document.getElementById('c-err');
  errEl.style.display = 'none';
  const custId   = document.getElementById('c-custId').value;
  const category = document.getElementById('c-category').value;
  const severity = document.getElementById('c-severity').value;
  const title    = document.getElementById('c-title').value.trim();
  const desc     = document.getElementById('c-description').value.trim();
  if (!custId)   { errEl.textContent = '⚠ Select a customer first';      errEl.style.display = 'block'; return; }
  if (!category) { errEl.textContent = '⚠ Complaint category required';  errEl.style.display = 'block'; return; }
  if (!severity) { errEl.textContent = '⚠ Severity is required';         errEl.style.display = 'block'; return; }
  if (!title)    { errEl.textContent = '⚠ Subject is required';          errEl.style.display = 'block'; return; }
  if (!desc)     { errEl.textContent = '⚠ Full description is required'; errEl.style.display = 'block'; return; }

  const p = basePayload('c', 'Complaint');
  p.title               = title;
  p.description         = desc;
  p.priority            = document.getElementById('c-prio').value || 'High';
  p.complaintCategory   = category;
  p.complaintSeverity   = severity;
  p.incidentDate        = document.getElementById('c-incident').value || null;
  p.affectedDevice      = document.getElementById('c-device').value.trim();
  p.assignedTo          = document.getElementById('c-assigned').value.trim();

  const btn = document.querySelector('#tpanel-complaint .btn-solid');
  btn.textContent = 'Submitting…'; btn.disabled = true;
  try {
    const res = await crmPost(p);
    if (res.status === 'error') throw new Error(res.message);
    allTickets.push(p);
    genBadge();
    resetForm('c');
    showToast('✓ Complaint ' + p.ticketId + ' submitted — escalated to Operations');
  } catch(err) {
    errEl.textContent = '⚠ ' + (err.message || 'Submit failed');
    errEl.style.display = 'block';
  } finally {
    btn.textContent = 'Submit Complaint →'; btn.disabled = false;
  }
}

// ══════════════════════════════════════════════════════
//  RESET FORM
// ══════════════════════════════════════════════════════
function resetForm(px) {
  custClear(px);
  const ids = {
    l: ['title','description','package','vehicles','budget','timeline','payment','followup','source','salesperson','notes'],
    q: ['category','title','details','assigned','due'],
    c: ['category','severity','title','description','incident','device','assigned'],
  };
  (ids[px] || []).forEach(id => {
    const el = document.getElementById(px + '-' + id);
    if (el) { el.tagName === 'SELECT' ? el.selectedIndex = 0 : el.value = ''; }
  });
  // Reset priority pills
  const bar = document.getElementById(px + '-prio');
  if (bar) bar.value = px === 'c' ? 'High' : 'Medium';
  const prioRow = document.querySelector('#tpanel-' + (px==='l'?'lead':px==='q'?'query':'complaint') + ' .prio-row');
  if (prioRow) {
    prioRow.querySelectorAll('.pp').forEach(p => p.classList.remove('sel'));
    const def = prioRow.querySelector('.p-' + (px === 'c' ? 'high' : 'medium'));
    if (def) def.classList.add('sel');
  }
  const errEl = document.getElementById(px + '-err');
  if (errEl) errEl.style.display = 'none';
  genBadge();
}

// ══════════════════════════════════════════════════════
//  ALL TICKETS — load + filter + render
// ══════════════════════════════════════════════════════
async function loadTickets() {
  const tb = document.getElementById('tkt-tbody');
  tb.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:40px;color:var(--muted)">Loading…</td></tr>';
  try {
    const res = await crmGet({ action: 'getTickets' });
    allTickets = res.data || [];
    const tot = allTickets.length;
    document.getElementById('ts-total').textContent = tot;
    document.getElementById('ts-leads').textContent = allTickets.filter(t => t.type === 'Lead').length;
    document.getElementById('ts-query').textContent = allTickets.filter(t => t.type === 'Query').length;
    document.getElementById('ts-comp').textContent  = allTickets.filter(t => t.type === 'Complaint').length;
    document.getElementById('ts-open').textContent  = allTickets.filter(t => t.status === 'Open').length;
    applyTktFilters();
  } catch(err) {
    tb.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:30px;color:var(--danger)">⚠ ' + esc(err.message || 'Load failed') + '</td></tr>';
  }
}

function applyTktFilters() {
  const q    = (document.getElementById('tf-q').value || '').toLowerCase().trim();
  const type = document.getElementById('tf-type').value;
  const stat = document.getElementById('tf-status').value;
  const prio = document.getElementById('tf-prio').value;
  const cust = (document.getElementById('tf-cust').value || '').toLowerCase().trim();
  const from = document.getElementById('tf-from').value;
  const to   = document.getElementById('tf-to').value;

  filteredTkts = allTickets.filter(t => {
    const mq = !q || [t.ticketId, t.title, t.customerName, t.registrationNo, t.trackerIMEI,
      t.description, t.queryCategory, t.complaintCategory].some(v => (v || '').toLowerCase().includes(q));
    const mt = !type || t.type === type;
    const ms = !stat || t.status === stat;
    const mp = !prio || t.priority === prio;
    const mc = !cust || (t.customerName || '').toLowerCase().includes(cust);
    const d  = (t.createdAt || '').substring(0, 10);
    return mq && mt && ms && mp && mc && (!from || d >= from) && (!to || d <= to);
  });

  filteredTkts.sort((a, b) => {
    const av = a[tktSortKey] || '', bv = b[tktSortKey] || '';
    return tktSortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  const ac = [q,type,stat,prio,cust,from,to].filter(Boolean).length;
  const fc = document.getElementById('tkt-fc');
  if (fc) fc.textContent = ac ? ac + ' filter' + (ac > 1 ? 's' : '') + ' active' : '';
  tktPage = 1;
  renderTktPage();
}

function clearTktFilters() {
  ['tf-q','tf-type','tf-status','tf-prio','tf-cust','tf-from','tf-to'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  applyTktFilters();
}

function sortTkt(key) {
  if (tktSortKey === key) tktSortDir = tktSortDir === 'asc' ? 'desc' : 'asc';
  else { tktSortKey = key; tktSortDir = 'desc'; }
  ['ts-createdAt','ts-customerName'].forEach(id => { const e = document.getElementById(id); if (e) e.textContent = ''; });
  const el = document.getElementById('ts-' + key);
  if (el) el.textContent = tktSortDir === 'asc' ? ' ↑' : ' ↓';
  applyTktFilters();
}

function renderTktPage() {
  const tb    = document.getElementById('tkt-tbody');
  const total = filteredTkts.length;
  const pages = Math.max(1, Math.ceil(total / tktPP));
  tktPage = Math.min(tktPage, pages);
  const start = (tktPage - 1) * tktPP;
  const slice = filteredTkts.slice(start, start + tktPP);

  const ri = document.getElementById('tkt-res');
  if (ri) ri.textContent = total === 0 ? 'No tickets found' :
    'Showing ' + (start + 1) + '–' + Math.min(start + tktPP, total) + ' of ' + total;

  if (!slice.length) {
    tb.innerHTML = '<tr><td colspan="10"><div class="empty-state"><div class="ei">🎫</div><p>No tickets match your filters</p></div></td></tr>';
    renderTktPgs(0, 1); return;
  }

  const typeCol = { Lead: 'var(--success)', Query: 'var(--accent2)', Complaint: 'var(--danger)' };
  const prioCol = { Low: 'var(--muted)', Medium: 'var(--warn)', High: 'var(--danger)', Critical: 'var(--accent3)' };
  const stCls = s => {
    const k = (s || 'Open').toLowerCase().replace(/\s+/g, '');
    return 'sb sb-' + (k === 'inprogress' ? 'inprogress' : k);
  };

  tb.innerHTML = slice.map(t => {
    const gi  = allTickets.indexOf(t);
    const tc  = typeCol[t.type]  || 'var(--muted)';
    const pc  = prioCol[t.priority] || 'var(--muted)';
    // Secondary info column — show category or vehicle
    const sec = t.type === 'Lead' ? (t.interestedPackage || '—') :
                t.type === 'Query' ? (t.queryCategory || '—') :
                t.registrationNo || (t.complaintCategory || '—');
    return '<tr class="tkt-row" id="trow-' + gi + '" onclick="toggleTktRow(' + gi + ',this)">'
      + '<td class="td-muted" style="white-space:nowrap">' + esc((t.createdAt || '—').substring(0,10)) + '</td>'
      + '<td style="font-family:var(--mono);font-size:10px;color:var(--accent)">' + esc(t.ticketId || '—') + '</td>'
      + '<td><span class="sb sb-' + (t.type||'').toLowerCase() + '" style="color:' + tc + ';background:' + tc.replace(')',',0.1)').replace('var(','rgba(') + '">' + esc(t.type || '—') + '</span></td>'
      + '<td><strong>' + esc(t.customerName || '—') + '</strong>'
      + (t.rac ? '<div style="font-size:10px;color:var(--muted)">' + esc(t.rac) + '</div>' : '') + '</td>'
      + '<td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(t.title || '—') + '</td>'
      + '<td style="font-size:11px;color:var(--muted);font-family:var(--mono)">' + esc(sec) + '</td>'
      + '<td><span style="font-size:10px;font-weight:600;color:' + pc + '">' + esc(t.priority || '—') + '</span></td>'
      + '<td><span class="' + stCls(t.status) + '">' + esc(t.status || 'Open') + '</span></td>'
      + '<td class="td-muted">' + esc(t.assignedTo || '—') + '</td>'
      + '<td onclick="event.stopPropagation()" style="white-space:nowrap">'
      + '<button class="btn btn-ghost btn-sm" onclick="openTktEdit(' + gi + ')" style="font-size:10px;padding:4px 10px">Edit</button>'
      + '</td></tr>'
      + '<tr class="tkt-det" id="tdet-' + gi + '"><td colspan="10"><div style="padding:16px 20px" id="tdinner-' + gi + '"></div></td></tr>';
  }).join('');

  renderTktPgs(total, pages);
}

function toggleTktRow(gi, row) {
  const det   = document.getElementById('tdet-' + gi);
  const inner = document.getElementById('tdinner-' + gi);
  if (det.classList.contains('open')) { det.classList.remove('open'); row.classList.remove('expanded'); return; }
  document.querySelectorAll('.tkt-det.open').forEach(d => d.classList.remove('open'));
  document.querySelectorAll('.tkt-row.expanded').forEach(r => r.classList.remove('expanded'));
  row.classList.add('expanded'); det.classList.add('open');

  const t = allTickets[gi];
  const f = (l, v) => v ? '<div class="dg"><div class="dg-l">' + l + '</div><div class="dg-v">' + esc(v) + '</div></div>' : '';

  // Base fields
  let detHTML = '<div class="det-g">'
    + f('Ticket ID', t.ticketId) + f('Type', t.type) + f('Priority', t.priority) + f('Status', t.status)
    + f('Customer', t.customerName) + f('Contact', t.contact) + f('City', t.city) + f('RAC', t.rac)
    + f('Asset / Reg', t.registrationNo) + f('IMEI', t.trackerIMEI) + f('SIM', t.simNumber) + f('Make/Model', [t.make,t.model].filter(Boolean).join(' '))
    + f('Assigned', t.assignedTo) + f('Linked JO', t.linkedJobOrder) + f('Created By', t.createdBy) + f('Closed At', t.closedAt);

  // Type-specific fields
  if (t.type === 'Lead') {
    detHTML += f('Package', t.interestedPackage) + f('Vehicles', t.noOfVehicles)
      + f('Budget', t.budget) + f('Timeline', t.purchaseTimeline)
      + f('Payment Pref.', t.preferredPayment) + f('Follow-up', t.followUpDate)
      + f('Source', t.leadSource) + f('Sales Person', t.salesPerson);
  } else if (t.type === 'Query') {
    detHTML += f('Query Category', t.queryCategory);
  } else if (t.type === 'Complaint') {
    detHTML += f('Category', t.complaintCategory) + f('Severity', t.complaintSeverity)
      + f('Incident Date', t.incidentDate) + f('Affected Device', t.affectedDevice);
  }
  detHTML += '</div>';

  if (t.description || t.queryDetails) {
    const txt = t.description || t.queryDetails;
    detHTML += '<div style="background:var(--surface2);border-radius:8px;padding:10px 12px;margin-bottom:8px">'
      + '<div class="dg-l" style="margin-bottom:4px">' + (t.type === 'Query' ? 'Query Details' : 'Description') + '</div>'
      + '<div style="font-size:12px;color:var(--muted)">' + esc(txt) + '</div></div>';
  }
  if (t.resolution) {
    detHTML += '<div style="background:rgba(61,255,160,0.05);border:1px solid rgba(61,255,160,0.2);border-radius:8px;padding:10px 12px;margin-bottom:8px">'
      + '<div class="dg-l" style="margin-bottom:4px;color:var(--success)">Resolution</div>'
      + '<div style="font-size:12px;color:var(--success)">' + esc(t.resolution) + '</div></div>';
  }

  detHTML += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">'
    + '<button class="btn btn-primary btn-sm" onclick="createJOFromTicket(' + gi + ')">📋 Create Job Order</button>'
    + (t.type === 'Lead' ? '<a class="btn btn-ghost btn-sm" href="leads.html">🎯 View in Leads</a>' : '')
    + '</div>';

  inner.innerHTML = detHTML;
}

// ── Inline Edit Modal ──────────────────────────────────
let editingIdx = -1;
function openTktEdit(gi) {
  editingIdx = gi;
  const t = allTickets[gi]; if (!t) return;
  const old = document.getElementById('tktEditModal');
  if (old) old.remove();
  const modal = document.createElement('div');
  modal.id = 'tktEditModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.82);z-index:500;display:flex;align-items:center;justify-content:center;padding:20px';

  const fld = (id, lbl, val) =>
    '<div class="field"><label>' + lbl + '</label>'
    + '<input id="te-' + id + '" value="' + esc(val||'') + '" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:var(--mono);font-size:12px;padding:9px 13px;outline:none"></div>';

  modal.innerHTML = '<div style="width:100%;max-width:540px;background:var(--surface);border:1px solid var(--border-hi);border-radius:14px;overflow:hidden">'
    + '<div style="padding:18px 22px;border-bottom:1px solid var(--border);background:var(--surface2);display:flex;align-items:center;justify-content:space-between">'
    + '<div style="font-family:var(--display);font-size:14px;font-weight:700">Edit Ticket — ' + esc(t.ticketId) + ' <span style="font-size:11px;color:var(--muted);font-weight:400">(' + esc(t.type) + ')</span></div>'
    + '<button onclick="document.getElementById(\'tktEditModal\').remove()" style="background:none;border:none;color:var(--muted);font-size:18px;cursor:pointer">✕</button>'
    + '</div>'
    + '<div style="padding:20px 22px;max-height:75vh;overflow-y:auto">'
    + '<div class="field"><label>Status</label>'
    + '<select id="te-status" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:var(--mono);font-size:12px;padding:9px 13px;outline:none;appearance:none">'
    + ['Open','In Progress','Resolved','Closed'].map(s => '<option' + (t.status===s?' selected':'') + '>' + s + '</option>').join('')
    + '</select></div>'
    + fld('assigned', 'Assigned To', t.assignedTo)
    + fld('jo', 'Linked Job Order (Invoice No.)', t.linkedJobOrder)
    + '<div class="field"><label>Resolution Notes</label>'
    + '<textarea id="te-res" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:var(--mono);font-size:12px;padding:9px 13px;outline:none;height:70px;resize:none">' + esc(t.resolution||'') + '</textarea></div>'
    + '<div class="error-banner" id="te-err"></div>'
    + '<div style="display:flex;gap:10px;margin-top:14px">'
    + '<button class="btn btn-solid" onclick="saveTktEdit()">Save Changes</button>'
    + '<button class="btn btn-ghost" onclick="document.getElementById(\'tktEditModal\').remove()">Cancel</button>'
    + '</div></div></div>';
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

async function saveTktEdit() {
  const t = allTickets[editingIdx]; if (!t) return;
  const errEl = document.getElementById('te-err');
  errEl.style.display = 'none';
  const status     = document.getElementById('te-status').value;
  const assignedTo = document.getElementById('te-assigned').value.trim();
  const linkedJO   = document.getElementById('te-jo').value.trim();
  const resolution = document.getElementById('te-res').value.trim();
  const closedAt   = ['Closed','Resolved'].includes(status) ? new Date().toISOString().split('T')[0] : null;
  try {
    const res = await crmPost({
      action: 'updateField', sheetTab: 'Tickets',
      keyField: 'ticketId', keyValue: t.ticketId,
      updates: { status, assignedTo, linkedJobOrder: linkedJO, resolution, closedAt },
    });
    if (res.status === 'error') throw new Error(res.message);
    Object.assign(allTickets[editingIdx], { status, assignedTo, linkedJobOrder: linkedJO, resolution, closedAt });
    document.getElementById('tktEditModal').remove();
    applyTktFilters();
    showToast('✓ Ticket updated');
  } catch(err) {
    errEl.textContent = '⚠ ' + (err.message || 'Save failed');
    errEl.style.display = 'block';
  }
}

// ── Create JO from ticket ──────────────────────────────
function createJOFromTicket(gi) {
  const t = allTickets[gi]; if (!t) return;
  sessionStorage.setItem('crm_prefill', JSON.stringify({
    source: 'ticket', ticketId: t.ticketId,
    custId: t.customerId, custName: t.customerName,
    contact: t.contact, city: t.city, rac: t.rac, company: t.company,
    assetId: t.assetId, registrationNo: t.registrationNo,
  }));
  window.location.href = 'job_orders.html';
}

// ── Pagination ─────────────────────────────────────────
function renderTktPgs(total, pages) {
  const bar = document.getElementById('tkt-pgs'); if (!bar) return;
  if (!total) { bar.innerHTML = ''; return; }
  const b = (l, p, d, a) => '<button class="pgb' + (a?' act':'') + '" onclick="tktGo(' + p + ')" ' + (d?'disabled':'') + '>' + l + '</button>';
  let h = b('‹', tktPage-1, tktPage===1, false);
  const s = Math.max(1, tktPage-2), e = Math.min(pages, tktPage+2);
  if (s>1) { h+=b('1',1,false,false); if(s>2) h+='<span style="color:var(--muted);padding:0 3px">…</span>'; }
  for (let p=s; p<=e; p++) h+=b(p,p,false,p===tktPage);
  if (e<pages) { if(e<pages-1) h+='<span style="color:var(--muted);padding:0 3px">…</span>'; h+=b(pages,pages,false,false); }
  h+=b('›', tktPage+1, tktPage===pages, false);
  bar.innerHTML = h;
  const ji = document.getElementById('tkt-pg-inp'); if(ji){ji.value=tktPage;ji.max=pages;}
}
function tktGo(p) { tktPage=p; renderTktPage(); window.scrollTo({top:0,behavior:'smooth'}); }
function tktJumpPg() { const p=parseInt(document.getElementById('tkt-pg-inp').value), pg=Math.ceil(filteredTkts.length/tktPP); if(p>=1&&p<=pg) tktGo(p); }
function tktChangePP() { tktPP=parseInt(document.getElementById('tkt-pp').value); tktPage=1; renderTktPage(); }

// ── Utils ──────────────────────────────────────────────
function showToast(msg) {
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:rgba(61,255,160,0.12);border:1px solid rgba(61,255,160,0.35);border-radius:10px;padding:14px 20px;color:var(--success);font-size:12px;font-family:var(--mono);z-index:9999;max-width:380px';
  t.textContent = msg; document.body.appendChild(t); setTimeout(()=>t.remove(), 3500);
}
function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}