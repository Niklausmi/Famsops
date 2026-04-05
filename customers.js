crmNav('customers');
startClock(document.getElementById('clock'));

// ── State ─────────────────────────────────────────────
let allCustomers = [], allAssets = [], allTickets = [], allLeads = [], allJOs = [];
let filteredCusts = [], csPage = 1, csPerPage = 24;
let hubCust = null;           // full customer object currently open in hub
let hubEditMode = false;      // whether hub is in edit mode

// ── Tabs ──────────────────────────────────────────────
function switchCTab(name, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('cpanel-' + name).classList.add('active');
  btn.classList.add('active');
  if (name === 'add' && !document.getElementById('nc-id').value) genCustId();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Load all data ─────────────────────────────────────
async function loadCustomers() {
  document.getElementById('cust-grid').innerHTML =
    '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted)">Loading…</div>';

  const [cr, ar, tr, lr, jr] = await Promise.allSettled([
    crmGet({ action: 'getCustomers' }),
    crmGet({ action: 'getAssets' }),
    crmGet({ action: 'getTickets' }),
    crmGet({ action: 'getLeads' }),
    crmGet({ action: 'getJobOrders' }),
  ]);

  allCustomers = cr.status === 'fulfilled' ? (cr.value.data || []) : [];
  allAssets    = ar.status === 'fulfilled' ? (ar.value.data || []) : [];
  allTickets   = tr.status === 'fulfilled' ? (tr.value.data || []) : [];
  allLeads     = lr.status === 'fulfilled' ? (lr.value.data || []) : [];
  allJOs       = jr.status === 'fulfilled' ? (jr.value.data || []) : [];

  // Header stats
  document.getElementById('cs-total').textContent   = allCustomers.length;
  document.getElementById('cs-assets').textContent  = allAssets.length;
  document.getElementById('cs-tickets').textContent = allTickets.filter(t => t.status !== 'Closed').length;
  document.getElementById('cs-leads').textContent   = allLeads.filter(l => !['Won','Lost','Cancelled'].includes(l.status)).length;

  filterCustomers();
}

// ── Filter & sort ─────────────────────────────────────
function filterCustomers() {
  const sq   = (document.getElementById('main-search').value || '').toLowerCase().trim();
  const city = (document.getElementById('f-city').value || '').toLowerCase().trim();
  const rac  = (document.getElementById('f-rac').value  || '').toLowerCase().trim();
  const sort = document.getElementById('f-sort').value;

  filteredCusts = allCustomers.filter(c => {
    const mq = !sq || [c.customerName, c.contact, c.company, c.cnic, c.rac, c.customerId, c.email, c.city]
      .some(v => (v || '').toLowerCase().includes(sq));
    const mc = !city || (c.city || '').toLowerCase().includes(city);
    const mr = !rac  || [(c.rac || ''), (c.company || '')].some(v => v.toLowerCase().includes(rac));
    return mq && mc && mr;
  });

  if (sort === 'recent')   filteredCusts.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  else if (sort === 'jobs') {
    filteredCusts.sort((a, b) => {
      const ja = allJOs.filter(j => j.customerId === a.customerId || j.customer === a.customerName).length;
      const jb = allJOs.filter(j => j.customerId === b.customerId || j.customer === b.customerName).length;
      return jb - ja;
    });
  } else {
    filteredCusts.sort((a, b) => (a.customerName || '').localeCompare(b.customerName || ''));
  }

  csPage = 1;
  renderCards();
}

// ── Render cards ─────────────────────────────────────
function renderCards() {
  const grid  = document.getElementById('cust-grid');
  const total = filteredCusts.length;
  const pages = Math.max(1, Math.ceil(total / csPerPage));
  csPage = Math.min(csPage, pages);
  const start = (csPage - 1) * csPerPage;
  const slice = filteredCusts.slice(start, start + csPerPage);

  document.getElementById('cs-info').textContent = total === 0 ? 'No customers found' :
    'Showing ' + (start + 1) + '–' + Math.min(start + csPerPage, total) + ' of ' + total + ' customers';

  if (!slice.length) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="ei">👥</div><p>No customers match</p></div>';
    document.getElementById('cs-pg-info').textContent = '';
    document.getElementById('pg-prev').disabled = true;
    document.getElementById('pg-next').disabled = true;
    return;
  }

  grid.innerHTML = slice.map(c => {
    const init   = (c.customerName || '??').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const jobs   = allJOs.filter(j => j.customerId === c.customerId || j.customer === c.customerName).length;
    const assets = allAssets.filter(a => a.customerId === c.customerId).length;
    const tix    = allTickets.filter(t => t.customerId === c.customerId && t.status !== 'Closed').length;
    const custIdx = allCustomers.indexOf(c);
    return '<div class="c-card" onclick="openHub(' + custIdx + ')">'
      + '<div class="cc-id">' + esc(c.customerId || '—') + '</div>'
      + '<div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:10px">'
      + '<div class="cc-av">' + init + '</div>'
      + '<div style="flex:1;min-width:0">'
      + '<div class="cc-name">' + esc(c.customerName || '—') + '</div>'
      + (c.company ? '<div class="cc-company">' + esc(c.company) + (c.rac ? ' · ' + esc(c.rac) : '') + '</div>' : '')
      + '<div class="cc-contact">' + esc(c.contact || '—') + ' · ' + esc(c.city || '—') + '</div>'
      + '</div></div>'
      + '<div class="cc-meta">'
      + '<div class="cc-m"><div class="val">' + jobs + '</div><div class="lbl">Jobs</div></div>'
      + '<div class="cc-m"><div class="val">' + assets + '</div><div class="lbl">Assets</div></div>'
      + '<div class="cc-m"><div class="val" style="color:' + (tix > 0 ? 'var(--warn)' : 'var(--text)') + '">' + tix + '</div><div class="lbl">Tickets</div></div>'
      + '</div></div>';
  }).join('');

  document.getElementById('cs-pg-info').textContent = 'Page ' + csPage + ' of ' + pages;
  document.getElementById('pg-prev').disabled = csPage === 1;
  document.getElementById('pg-next').disabled = csPage === pages;
}

function pgPrev() { if (csPage > 1) { csPage--; renderCards(); } }
function pgNext() { const p = Math.ceil(filteredCusts.length / csPerPage); if (csPage < p) { csPage++; renderCards(); } }

// ── Customer Hub — built from local data, no extra API call ──
function openHub(custIdx) {
  const c = allCustomers[custIdx];
  if (!c) return;

  hubCust = c;
  hubEditMode = false;

  // Show drawer
  document.getElementById('hubOverlay').classList.add('open');

  // Header
  document.getElementById('hub-name').textContent    = c.customerName || '—';
  document.getElementById('hub-company').textContent = [c.company, c.rac].filter(Boolean).join(' · ') || '';
  document.getElementById('hub-contact').textContent = [c.contact, c.city, c.email].filter(Boolean).join(' · ') || '—';
  document.getElementById('hub-id').textContent      = 'ID: ' + (c.customerId || 'Not assigned');

  // Edit button state
  document.getElementById('hub-edit-btn').textContent = '✏ Edit';
  document.getElementById('hub-edit-form').style.display = 'none';
  document.getElementById('hub-body').style.display      = 'block';

  // Action buttons
  document.getElementById('hub-actions').innerHTML =
    btn('primary', 'onclick="goTicket()"',      '🎫 New Ticket')
 // + btn('warn',    'onclick="goLead()"',         '🎯 New Lead')
  + btn('',        'onclick="goJobOrder()"',     '📋 New Job Order')
  + btn('',        'onclick="goAddAsset()"',     '🚗 Add Asset');

  renderHubBody(c);
}

function btn(cls, attrs, label) {
  return '<button class="ha-btn ' + cls + '" ' + attrs + '>' + label + '</button>';
}

function renderHubBody(c) {
  const custId = c.customerId;

  // Data already in memory
  const myAssets  = allAssets.filter(a => a.customerId === custId);
  const myTickets = allTickets.filter(t => t.customerId === custId)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const myLeads   = allLeads.filter(l => l.customerId === custId || l.customerName === c.customerName)
    .sort((a, b) => (b.dateForwarded || '').localeCompare(a.dateForwarded || ''));
  const myJOs     = allJOs.filter(j => j.customerId === custId || j.customer === c.customerName)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const f   = (l, v) => v ? '<div class="ig-item"><div class="ig-l">' + l + '</div><div class="ig-v">' + esc(v) + '</div></div>' : '';
  const sec = t     => '<div class="hub-sec">' + t + '</div>';

  // ── Contact info ──
  const contactHTML = '<div class="ig2">'
    + f('Phone',    c.contact)
    + f('Email',    c.email)
    + f('City',     c.city + (c.area ? ' · ' + c.area : ''))
    + f('CNIC',     c.cnic)
    + f('Father',   c.father)
    + f('Company',  c.company)
    + f('RAC',      c.rac)
    + f('Payment',  c.preferredPayment)
    + f('Type',     c.customerType)
    + f('Industry', c.industry)
    + '</div>'
    + (c.address ? '<div style="background:var(--surface2);border-radius:8px;padding:9px 12px;margin-top:8px;font-size:12px;color:var(--muted)"><div class="ig-l">Address</div>' + esc(c.address) + '</div>' : '')
    + (c.notes   ? '<div style="background:var(--surface2);border-radius:8px;padding:9px 12px;margin-top:6px;font-size:12px;color:var(--muted)"><div class="ig-l">Notes</div>'   + esc(c.notes)   + '</div>' : '');

  // ── Assets ──
  const assetHTML = myAssets.length
    ? myAssets.map(a => {
        const jobsForAsset = myJOs.filter(j => j.vehicle === a.registrationNo || j.assetId === a.assetId).length;
        const today = new Date(), in30 = new Date(today); in30.setDate(today.getDate() + 30);
        let statusCol = 'var(--success)', statusLabel = a.status || 'Active';
        if (a.amcExpiry) {
          const exp = new Date(a.amcExpiry);
          if (exp < today)      { statusCol = 'var(--danger)'; statusLabel = 'Expired'; }
          else if (exp <= in30) { statusCol = 'var(--warn)';   statusLabel = 'Expiring'; }
        }
        return '<div class="asset-mini">'
          + '<div class="am-reg">' + esc(a.registrationNo || '—') + '</div>'
          + '<div class="am-detail">'
          + '<div class="am-vehicle">' + esc([a.make, a.model, a.color].filter(Boolean).join(' · ') || '—')
          + ' <span style="font-size:9px;font-weight:600;text-transform:uppercase;color:' + statusCol + '">' + statusLabel + '</span></div>'
          + '<div class="am-device">'
          + (a.trackerIMEI ? 'IMEI: <span style="color:var(--accent)">' + esc(a.trackerIMEI) + '</span>' : '<span style="color:var(--muted2)">No tracker</span>')
          + (a.simNumber   ? ' · SIM: <span style="color:var(--accent2)">' + esc(a.simNumber) + '</span>' : '')
          + '</div>'
          + (a.amcExpiry ? '<div style="font-size:10px;color:' + statusCol + ';margin-top:2px">AMC: ' + esc(a.amcExpiry) + '</div>' : '')
          + '</div>'
          + '<div style="text-align:right;font-size:10px;color:var(--muted);white-space:nowrap">' + jobsForAsset + ' job' + (jobsForAsset !== 1 ? 's' : '') + '</div>'
          + '</div>';
      }).join('')
    : '<div style="color:var(--muted);font-size:12px;padding:6px 0">No assets registered. '
      + '<button class="btn btn-ghost btn-sm" style="font-size:10px" onclick="goAddAsset()">＋ Add Asset</button></div>';

  // ── Timeline — merge tickets + leads + jobs ──
  const typeColor = { ticket: 'var(--accent)', lead: 'var(--success)', job: 'var(--accent2)' };
  const typeIcon  = { ticket: '🎫', lead: '🎯', job: '📋' };
  const timeline  = [
    ...myTickets.map(t => ({
      type: 'ticket', date: (t.createdAt || '').substring(0, 10),
      title: '[' + (t.type || 'Ticket') + '] ' + (t.title || ''),
      ref: t.ticketId, status: t.status || 'Open',
      extra: [t.priority ? 'Priority: ' + t.priority : '', t.assignedTo ? 'Assigned: ' + t.assignedTo : ''].filter(Boolean).join(' · '),
    })),
    ...myLeads.map(l => ({
      type: 'lead', date: l.dateForwarded || '',
      title: 'Lead — ' + (l.package || 'Package TBD'),
      ref: l.leadId, status: l.status || 'New Lead',
      extra: [l.salesPerson ? 'Sales: ' + l.salesPerson : '', l.city].filter(Boolean).join(' · '),
    })),
    ...myJOs.map(j => ({
      type: 'job', date: j.date || '',
      title: (j.toc === 'new_installation' ? 'New Install' : j.toc === 'replacement' ? 'Replacement' : j.toc || 'Job')
             + (j.vehicle ? ' — ' + j.vehicle : ''),
      ref: j.invoiceNumber, status: j.toc || '—',
      extra: [j.installer ? 'Installer: ' + j.installer : '', j.package].filter(Boolean).join(' · '),
    })),
  ].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 50);

  const tlHTML = timeline.length
    ? timeline.map(item =>
        '<div class="tl-item tl-' + item.type + '">'
        + '<div style="display:flex;align-items:center;justify-content:space-between">'
        + '<span class="tl-type" style="color:' + typeColor[item.type] + '">' + typeIcon[item.type] + ' ' + item.type.toUpperCase() + '</span>'
        + '<span class="tl-date">' + esc(item.date || '—') + '</span>'
        + '</div>'
        + '<div class="tl-detail">' + esc(item.title || '') + '</div>'
        + (item.extra ? '<div style="font-size:10px;color:var(--muted2);margin-top:2px">' + esc(item.extra) + '</div>' : '')
        + '<div class="tl-ref">' + esc(item.ref || '') + (item.status ? ' <span class="sb sb-' + item.status.toLowerCase().replace(/[\s\/]+/g, '') + '" style="margin-left:4px">' + esc(item.status) + '</span>' : '') + '</div>'
        + '</div>'
      ).join('')
    : '<div style="color:var(--muted);font-size:12px;padding:8px 0">No activity yet for this customer</div>';

  document.getElementById('hub-body').innerHTML =
    sec('📋 Contact Details')
    + contactHTML

    + sec('🚗 Assets (' + myAssets.length + ')')
    + assetHTML

    + (myTickets.length ? sec('🎫 Tickets (' + myTickets.length + ')') + myTickets.slice(0, 5).map(t =>
        '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 13px;margin-bottom:6px;display:flex;align-items:center;justify-content:space-between;gap:10px">'
        + '<div><div style="font-size:11px;color:var(--text);font-weight:600">' + esc(t.title || t.type || '—') + '</div>'
        + '<div style="font-size:10px;color:var(--muted);margin-top:2px">' + esc(t.ticketId || '') + ' · ' + esc((t.createdAt || '').substring(0, 10)) + '</div></div>'
        + '<span class="sb sb-' + (t.status || 'open').toLowerCase().replace(/\s+/g, '') + '">' + esc(t.status || 'Open') + '</span>'
        + '</div>'
      ).join('') + (myTickets.length > 5 ? '<div style="font-size:11px;color:var(--muted);padding:6px 0">+ ' + (myTickets.length - 5) + ' more tickets</div>' : '') : '')

    + sec('📊 Activity History (' + timeline.length + (timeline.length === 50 ? '+' : '') + ' records)')
    + tlHTML;
}

// ── Hub close ─────────────────────────────────────────
function closeHub() {
  document.getElementById('hubOverlay').classList.remove('open');
  hubCust = null;
  hubEditMode = false;
}
document.getElementById('hubOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('hubOverlay')) closeHub();
});

// ── Hub edit mode — inline in drawer ─────────────────
function toggleHubEdit() {
  if (!hubCust) return;
  hubEditMode = !hubEditMode;

  const editForm = document.getElementById('hub-edit-form');
  const hubBody  = document.getElementById('hub-body');
  const editBtn  = document.getElementById('hub-edit-btn');

  if (hubEditMode) {
    editBtn.textContent = 'Cancel';
    hubBody.style.display  = 'none';
    editForm.style.display = 'block';
    buildEditForm(hubCust);
  } else {
    editBtn.textContent = '✏ Edit';
    editForm.style.display = 'none';
    hubBody.style.display  = 'block';
  }
}

function buildEditForm(c) {
  const fi = (id, lbl, val, type) =>
    '<div class="field"><label>' + lbl + '</label>'
    + '<input id="he-' + id + '" type="' + (type || 'text') + '" value="' + esc(val || '') + '"'
    + ' style="width:100%;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:var(--mono);font-size:11px;padding:8px 12px;outline:none;transition:border-color 0.2s"'
    + ' onfocus="this.style.borderColor=\'rgba(56,217,245,0.4)\'" onblur="this.style.borderColor=\'rgba(255,255,255,0.07)\'"></div>';

  const fsel = (id, lbl, val, opts) =>
    '<div class="field"><label>' + lbl + '</label>'
    + '<select id="he-' + id + '" style="width:100%;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:var(--mono);font-size:11px;padding:8px 12px;outline:none;appearance:none;cursor:pointer">'
    + opts.map(o => '<option' + (val === o ? ' selected' : '') + '>' + o + '</option>').join('')
    + '</select></div>';

  const fta = (id, lbl, val) =>
    '<div class="field"><label>' + lbl + '</label>'
    + '<textarea id="he-' + id + '" style="width:100%;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:var(--mono);font-size:11px;padding:8px 12px;outline:none;height:64px;resize:none">' + esc(val || '') + '</textarea></div>';

  const g2 = inner => '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 14px">' + inner + '</div>';

  document.getElementById('hub-edit-form').innerHTML =
    '<div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--accent2);margin-bottom:14px;font-weight:500">Edit Customer — ' + esc(c.customerName || '') + '</div>'
    + g2(fi('name',    'Customer Name *', c.customerName) + fi('contact', 'Contact *', c.contact))
    + g2(fi('company', 'Company',         c.company)      + fi('rac',     'RAC / Group', c.rac))
    + g2(fi('email',   'Email',           c.email, 'email') + fi('city',  'City *',     c.city))
    + g2(fi('area',    'Area',            c.area)          + fi('cnic',   'CNIC',        c.cnic))
    + g2(fi('father',  "Father's Name",   c.father)        + fi('designation', 'Designation', c.designation))
    + g2(fsel('industry', 'Industry', c.industry || '',
        ['', 'Logistics / Transport', 'Construction', 'Healthcare', 'Retail / FMCG',
         'Manufacturing', 'Government', 'Real Estate', 'Individual / Personal', 'Other'])
      + fsel('type', 'Customer Type', c.customerType || 'individual',
        ['individual', 'corporate', 'fleet']))
    + g2(fsel('payment', 'Preferred Payment', c.preferredPayment || '',
        ['', 'Cash', 'Bank Transfer', 'Cheque', 'Online / Mobile'])
      + '<div></div>')
    + fta('address', 'Postal Address', c.address)
    + fta('notes',   'Notes',          c.notes)
    + '<div class="error-banner" id="he-err"></div>'
    + '<div style="display:flex;gap:10px;margin-top:14px">'
    + '<button class="btn btn-solid" onclick="saveHubEdit()">Save Changes</button>'
    + '<button class="btn btn-ghost" onclick="toggleHubEdit()">Cancel</button>'
    + '</div>';
}

async function saveHubEdit() {
  const c     = hubCust; if (!c) return;
  const errEl = document.getElementById('he-err');
  errEl.style.display = 'none';

  const get = id => { const el = document.getElementById('he-' + id); return el ? el.value.trim() : ''; };
  const name    = get('name');
  const contact = get('contact');
  const city    = get('city');

  if (!name)    { errEl.textContent = '⚠ Name required';    errEl.style.display = 'block'; return; }
  if (!contact) { errEl.textContent = '⚠ Contact required'; errEl.style.display = 'block'; return; }
  if (!city)    { errEl.textContent = '⚠ City required';    errEl.style.display = 'block'; return; }

  const updates = {
    customerName:     name,
    contact,
    company:          get('company'),
    rac:              get('rac'),
    email:            get('email'),
    city,
    area:             get('area'),
    cnic:             get('cnic'),
    father:           get('father'),
    designation:      get('designation'),
    industry:         get('industry'),
    customerType:     get('type'),
    preferredPayment: get('payment'),
    address:          get('address'),
    notes:            get('notes'),
  };

  try {
    const res = await crmPost({
      action: 'updateField', sheetTab: 'Customers',
      keyField: 'customerId', keyValue: c.customerId,
      updates,
    });
    if (res.status === 'error') throw new Error(res.message);

    // Update local state
    Object.assign(hubCust, updates);
    const idx = allCustomers.findIndex(x => x.customerId === c.customerId);
    if (idx >= 0) Object.assign(allCustomers[idx], updates);

    // Refresh hub header + body
    document.getElementById('hub-name').textContent    = updates.customerName;
    document.getElementById('hub-company').textContent = [updates.company, updates.rac].filter(Boolean).join(' · ') || '';
    document.getElementById('hub-contact').textContent = [updates.contact, updates.city, updates.email].filter(Boolean).join(' · ');

    hubEditMode = false;
    document.getElementById('hub-edit-btn').textContent    = '✏ Edit';
    document.getElementById('hub-edit-form').style.display = 'none';
    document.getElementById('hub-body').style.display      = 'block';
    renderHubBody(hubCust);
    filterCustomers();   // refresh cards
    showToast('✓ Customer updated successfully');
  } catch (err) {
    errEl.textContent = '⚠ ' + (err.message || 'Save failed');
    errEl.style.display = 'block';
  }
}

// ── Hub navigation actions ────────────────────────────
function goTicket() {
  if (!hubCust) return;
  sessionStorage.setItem('crm_prefill', JSON.stringify({
    source: 'customer', custId: hubCust.customerId,
    custName: hubCust.customerName, contact: hubCust.contact,
    city: hubCust.city, rac: hubCust.rac, company: hubCust.company,
  }));
  window.location.href = 'tickets.html';
}


function goJobOrder() {
  if (!hubCust) return;
  sessionStorage.setItem('crm_prefill', JSON.stringify({
   source: 'customer', custId: hubCust.customerId,
    custName: hubCust.customerName, contact: hubCust.contact,
    city: hubCust.city, rac: hubCust.rac, company: hubCust.company,
  }));
  window.location.href = 'job_orders.html';
}

function goAddAsset() {
  if (!hubCust) return;
  sessionStorage.setItem('crm_prefill', JSON.stringify({
    source: 'customer', custId: hubCust.customerId,
    custName: hubCust.customerName, contact: hubCust.contact,
    city: hubCust.city, rac: hubCust.rac, company: hubCust.company,
  }));
  window.location.href = 'assets.html';
}

// ── New Customer form ─────────────────────────────────
function genCustId() {
  if (!document.getElementById('nc-id').value) {
    document.getElementById('nc-id').value = 'CUST-' + Date.now().toString(36).toUpperCase().slice(-8);
  }
}

async function saveCustomer() {
  const name    = document.getElementById('nc-name').value.trim();
  const contact = document.getElementById('nc-contact').value.trim();
  const city    = document.getElementById('nc-city').value.trim();
  const errEl   = document.getElementById('nc-err');
  const okEl    = document.getElementById('nc-ok');
  errEl.style.display = 'none'; okEl.style.display = 'none';

  if (!name)    { errEl.textContent = '⚠ Customer name is required'; errEl.style.display = 'block'; return; }
  if (!contact) { errEl.textContent = '⚠ Contact number is required'; errEl.style.display = 'block'; return; }
  if (!city)    { errEl.textContent = '⚠ City is required';          errEl.style.display = 'block'; return; }

  genCustId();
  const custId = document.getElementById('nc-id').value;
  const isEdit = !!allCustomers.find(c => c.customerId === custId);

  const payload = {
    action: 'submitCustomer', sheetTab: 'Customers',
    customerId:       custId,
    createdAt:        isEdit ? undefined : new Date().toISOString().split('T')[0],
    customerName:     name,
    company:          document.getElementById('nc-company').value.trim(),
    rac:              document.getElementById('nc-rac').value.trim(),
    designation:      document.getElementById('nc-designation').value.trim(),
    industry:         document.getElementById('nc-industry').value,
    contact, city,
    area:             document.getElementById('nc-area').value.trim(),
    email:            document.getElementById('nc-email').value.trim(),
    cnic:             document.getElementById('nc-cnic').value.trim(),
    father:           document.getElementById('nc-father').value.trim(),
    address:          document.getElementById('nc-address').value.trim(),
    preferredPayment: document.getElementById('nc-payment').value,
    customerType:     document.getElementById('nc-type').value,
    notes:            document.getElementById('nc-notes').value.trim(),
  };

  try {
    const res = await crmPost(payload);
    if (res.status === 'error') throw new Error(res.message);

    okEl.textContent = '✓ Customer ' + (isEdit ? 'updated' : 'saved') + ' — ID: ' + custId;
    okEl.style.display = 'block';

    if (isEdit) {
      const idx = allCustomers.findIndex(c => c.customerId === custId);
      if (idx >= 0) Object.assign(allCustomers[idx], payload);
    } else {
      allCustomers.push({ ...payload });
      clearCustomerForm();
    }
    filterCustomers();
  } catch (err) {
    errEl.textContent = '⚠ ' + (err.message || 'Save failed');
    errEl.style.display = 'block';
  }
}

function clearCustomerForm() {
  document.getElementById('add-title').textContent = 'New Customer';
  document.getElementById('nc-id').value = '';
  ['nc-name','nc-contact','nc-email','nc-cnic','nc-father','nc-company','nc-rac',
   'nc-designation','nc-city','nc-area','nc-address','nc-notes'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  ['nc-industry','nc-type','nc-payment'].forEach(id => {
    const el = document.getElementById(id); if (el) el.selectedIndex = 0;
  });
  document.getElementById('nc-err').style.display = 'none';
  document.getElementById('nc-ok').style.display  = 'none';
  genCustId();
}

// ── Utils ─────────────────────────────────────────────
function showToast(msg) {
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:rgba(61,255,160,0.12);border:1px solid rgba(61,255,160,0.35);border-radius:10px;padding:14px 20px;color:var(--success);font-size:12px;font-family:var(--mono);z-index:9999;max-width:360px';
  t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3000);
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Start ─────────────────────────────────────────────
loadCustomers();