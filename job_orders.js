crmNav('jolist');
startClock(document.getElementById('clock'));

// ══════════════════════════════════════
//  TAB SWITCHING
// ══════════════════════════════════════
function switchTab(name, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  btn.classList.add('active');
  if (name === 'list' && allJOs.length === 0) loadJOs();
}

// ══════════════════════════════════════
//  CUSTOMER LOOKUP
// ══════════════════════════════════════
let allCustomers = [], selectedCust = null, selectedCustomer = null;
let allAssets = [], allTrackers = [], allSIMs = [];

(async function initData(){
  try {
    const [cr, ar, tr, si] = await Promise.allSettled([
      crmGet({ action: 'getCustomers' }),
      crmGet({ action: 'getAssets' }),
      crmGet({ action: 'getInventory', tab: 'Trackers' }),
      crmGet({ action: 'getInventory', tab: 'SIMs' }),
    ]);
    allCustomers = cr.status === 'fulfilled' ? (cr.value.data || []) : [];
    allAssets    = ar.status === 'fulfilled' ? (ar.value.data || []) : [];
    allTrackers  = tr.status === 'fulfilled' ? (tr.value.data || []) : [];
    allSIMs      = si.status === 'fulfilled' ? (si.value.data || []) : [];

    // Check for prefill from tickets / customers hub
    const pf = sessionStorage.getItem('crm_prefill');
    if (pf) {
      try {
        const d = JSON.parse(pf);
        sessionStorage.removeItem('crm_prefill');
        if (d.source === 'ticket' || d.source === 'customer') {
          const c = allCustomers.find(x => x.customerId === d.custId);
          if (c) selectCustomerObj(c);
          else if (d.custName) {
            selectCustomerObj({ customerId: d.custId||'', customerName: d.custName,
              contact: d.contact||'', city: d.city||'', rac: d.rac||'', company: d.company||'' });
          }
          if (d.ticketId) {
            const el = document.getElementById('jo-ticketId');
            if (el) el.value = d.ticketId;
          }
          if (d.assetId) {
            setTimeout(() => {
              const sel = document.getElementById('jo-asset-sel');
              if (sel) { sel.value = d.assetId; onJOAssetChange(); }
            }, 400);
          }
        }
      } catch(e) {}
    }
  } catch(e) {}
})();

function populateJOAssets(custId) {
  const sel = document.getElementById('jo-asset-sel');
  if (!sel) return;
  sel.innerHTML = '<option value="">— No asset (New Installation) —</option>';
  const hint = document.getElementById('jo-asset-hint');
  if (hint) hint.textContent = '';
  if (!custId) return;
  const custAssets = allAssets.filter(a => a.customerId === custId);
  custAssets.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.assetId;
    opt.textContent = (a.registrationNo || '?') + ' — ' + [a.make, a.model].filter(Boolean).join(' ');
    sel.appendChild(opt);
  });
}

function onJOAssetChange() {
  const sel = document.getElementById('jo-asset-sel');
  const assetId = sel ? sel.value : '';
  const a = allAssets.find(x => x.assetId === assetId);
  const hint = document.getElementById('jo-asset-hint');
  if (!a) { if (hint) hint.textContent = ''; return; }

  // Auto-fill vehicle fields in the form
  const setByName = (name, val) => {
    const el = document.querySelector('[name="' + name + '"]');
    if (el && val) el.value = val;
  };
  setByName('vehicle',  a.registrationNo || '');
  setByName('engine',   a.engineNo || '');
  setByName('chassis',  a.chassisNo || '');
  setByName('make',     a.make || '');
  setByName('model',    a.model || '');
  setByName('color',    a.color || '');
  setByName('imei',     a.trackerIMEI || '');
  setByName('gsm',      a.simNumber || '');

  // Sync searchable inventory inputs
  const imeiQ = document.getElementById('inv-imei-q');
  const simQ  = document.getElementById('inv-sim-q');
  if (imeiQ && a.trackerIMEI) {
    imeiQ.value = a.trackerIMEI;
    document.getElementById('imei-sel-imei').textContent = a.trackerIMEI;
    document.getElementById('imei-sel-detail').textContent = 'Auto-filled from asset record';
    document.getElementById('imei-sel-banner').style.display = 'block';
  }
  if (simQ && a.simNumber) {
    simQ.value = a.simNumber;
    document.getElementById('sim-sel-num').textContent = a.simNumber;
    document.getElementById('sim-sel-detail').textContent = 'Auto-filled from asset record';
    document.getElementById('sim-sel-banner').style.display = 'block';
  }

  // Also fill customer step auto-fill fields
  const setById = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
  setById('f-vehicle', a.registrationNo || '');

  // Set assetId hidden field
  const assetIdField = document.getElementById('jo-assetId');
  if (assetIdField) assetIdField.value = a.assetId || '';

  if (hint) hint.textContent = '✓ Auto-filled: '
    + [a.make, a.model, a.color].filter(Boolean).join(' ')
    + ' · AMC: ' + (a.amcExpiry || '—');
}

function selectCustomerObj(c) {
  selectedCustomer = c;
  selectedCust = c;
  document.getElementById('sb-name').textContent = c.customerName + (c.company ? ' — ' + c.company : '');
  document.getElementById('sb-meta').textContent = [c.contact, c.city, c.rac ? 'RAC: '+c.rac : ''].filter(Boolean).join(' · ');
  document.getElementById('sb-id').textContent   = c.customerId || 'No ID';
  document.getElementById('selBanner').classList.add('on');
  // Also fill Step 1 fields
  const setByName = (name, val) => { const el = document.querySelector('[name="' + name + '"]'); if (el && val) el.value = val; };
  setByName('customer',  c.customerName || '');
  setByName('contact',   c.contact || '');
  setByName('rac',       c.rac || '');
  setByName('reference', c.company || '');
  setByName('city',      c.city || '');
  // Step 8 credentials
  const setById = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
  setById('f-customer', c.customerName || '');
  setById('f-contact',  c.contact || '');
  setById('f-rac',      c.rac || '');
  setById('f-reference',c.company || '');
  setById('f-city',     c.city || '');
  // Populate asset dropdown
  populateJOAssets(c.customerId);
}

function searchCustomers(q) {
  const dd = document.getElementById('custDD');
  q = (q||'').toLowerCase().trim();
  if (q.length < 2) { dd.classList.remove('open'); return; }
  const hits = allCustomers.filter(c =>
    [c.customerName,c.contact,c.cnic,c.company,c.rac,c.city,c.customerId,c.email]
      .some(v=>(v||'').toLowerCase().includes(q))
  ).slice(0,10);
  if (!hits.length) {
    dd.innerHTML='<div style="padding:14px;font-size:12px;color:var(--muted);text-align:center">No customers found — add them in the <a href="customers.html" style="color:var(--accent)">Customers</a> tab</div>';
    dd.classList.add('open'); return;
  }
  dd.innerHTML = hits.map((c,i) => `
    <div class="co" onclick="pickCustomer(${i})">
      <div class="co-name">${c.customerName||'—'}</div>
      ${c.company?`<div class="co-company">🏢 ${c.company}${c.rac?' · RAC: '+c.rac:''}</div>`:c.rac?`<div class="co-company">RAC: ${c.rac}</div>`:''}
      <div class="co-meta">${c.contact||'—'} · ${c.city||'—'}</div>
      <div class="co-id">${c.customerId||'No ID'}</div>
    </div>`).join('');
  dd._hits = hits;
  dd.classList.add('open');
}

function pickCustomer(i) {
  const dd = document.getElementById('custDD');
  const c = dd._hits ? dd._hits[i] : allCustomers[i];
  if (!c) return;
  selectedCust = c;
  // Fill banner
  document.getElementById('sb-name').textContent = c.customerName + (c.company?' — '+c.company:'');
  document.getElementById('sb-meta').textContent = [c.contact,c.city,c.rac?'RAC: '+c.rac:''].filter(Boolean).join(' · ');
  document.getElementById('sb-id').textContent   = c.customerId||'No ID';
  document.getElementById('selBanner').classList.add('on');
  dd.classList.remove('open');
  document.getElementById('custQ').value = '';
  // Auto-fill form fields
  const set = (id,v) => { const el=document.getElementById(id); if(el&&v) el.value=v; };
  set('f-customer',  c.customerName);
  set('f-contact',   c.contact);
  set('f-rac',       c.rac);
  set('f-reference', c.company);
  set('f-city',      c.city);
  set('f-area',      c.area||'');
  set('f-name',      c.customerName);
  set('f-cnic',      c.cnic);
  set('f-father',    c.father);
  set('f-email',     c.email);
  set('f-address',   c.address||'');
}

function clearSelectedCustomer() {
  selectedCust = null;
  document.getElementById('selBanner').classList.remove('on');
  ['sb-name','sb-meta','sb-id'].forEach(id => document.getElementById(id).textContent = '');
  document.getElementById('custQ').value = '';
}

// Close dropdown on outside click
document.addEventListener('click', e => {
  if (!e.target.closest('.cust-wrap')) document.getElementById('custDD').classList.remove('open');
});

// ══════════════════════════════════════
//  9-STEP JO FORM
// ══════════════════════════════════════
let curStep = 0;
const totalSteps = 9;
const steps = () => document.querySelectorAll('.step-content');
const dots  = () => document.querySelectorAll('.step-dot');

// Generate JO ID on load
document.getElementById('joIdBadge').textContent = 'JO-' + Date.now().toString(36).toUpperCase().slice(-8);
document.getElementById('f-date').valueAsDate = new Date();

function updateStepUI() {
  steps().forEach((s,i) => s.classList.toggle('active', i===curStep));
  dots().forEach((d,i) => {
    d.classList.remove('active','done');
    if (i===curStep) d.classList.add('active');
    else if (i<curStep) d.classList.add('done');
  });
  const pct = ((curStep+1)/totalSteps)*100;
  document.getElementById('progressFill').style.width = pct+'%';
  document.getElementById('stepNum').textContent = curStep+1;
  document.getElementById('btnBack').style.display    = curStep>0 ? 'inline-flex' : 'none';
  document.getElementById('btnNext').style.display    = curStep<totalSteps-1 ? 'inline-flex' : 'none';
  document.getElementById('btnSubmit').style.display  = curStep===totalSteps-1 ? 'inline-block' : 'none';
}

function goTo(i) { if(i<=curStep){curStep=i;updateStepUI();} }
function nextStep() { if(curStep<totalSteps-1){curStep++;updateStepUI();} }
function prevStep() { if(curStep>0){curStep--;updateStepUI();} }

function selectTOC(val, el) {
  document.querySelectorAll('.toc-btn').forEach(b=>b.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('tocHidden').value = val;
}


// ══════════════════════════════════════
//  INVENTORY — IMEI & SIM LIVE SEARCH
// ══════════════════════════════════════

function closeInvDD(id) {
  const dd = document.getElementById(id);
  if (dd) dd.style.display = 'none';
}

function ddRow(icon, main, sub, warn) {
  const bg = 'rgba(56,217,245,0.05)';
  const col = warn ? 'var(--warn)' : 'var(--muted)';

  return `
    <div style="
      padding: 10px 14px;
      cursor: pointer;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 10px;
      transition: background 0.12s;
    "
    onmouseover="this.style.background='${bg}'"
    onmouseout="this.style.background=''"
    >
      <div style="font-size: 18px; flex-shrink: 0;">${icon}</div>
      <div>
        <div style="font-size: 12px; font-family: var(--mono); color: var(--text); font-weight: 600;">
          ${main}
        </div>
        <div style="font-size: 10px; color: ${col}; margin-top: 2px;">
          ${sub}
        </div>
      </div>
    </div>
  `;
}

function searchIMEI(q) {
  const dd = document.getElementById('imei-dd');
  q = (q || '').toLowerCase().trim();
  if (q.length < 2) { dd.style.display = 'none'; return; }

  // Filter available trackers
  const hits = allTrackers.filter(t =>
    (t.status || '').toLowerCase() === 'available' &&
    ((t.imei || '').toLowerCase().includes(q) || (t.model || '').toLowerCase().includes(q) ||
     (t.supplier || '').toLowerCase().includes(q))
  ).slice(0, 10);

  if (!hits.length) {
    dd.innerHTML = '<div style="padding:12px 14px;font-size:11px;color:var(--muted);text-align:center">'
      + (allTrackers.length === 0 ? '⚠ Inventory not loaded — check connection' : 'No available trackers matching "' + q + '"') + '</div>';
    dd.style.display = 'block'; return;
  }

  dd.innerHTML = hits.map((t, i) => {
    const sub = [t.model, t.supplier, 'Qty: ' + (t.qty || 1), t.price ? 'PKR ' + t.price : ''].filter(Boolean).join(' · ');
    const row = ddRow('📡', t.imei || '—', sub, false);
    return row.replace('<div style="padding', '<div onclick="pickIMEI(' + i + ')" style="padding');
  }).join('');
  dd._hits = hits;
  dd.style.display = 'block';
}

function pickIMEI(i) {
  const dd = document.getElementById('imei-dd');
  const t = (dd._hits || allTrackers)[i];
  if (!t) return;

  // Set the input value (used by FormData on submit)
  document.getElementById('inv-imei-q').value = t.imei || '';

  // Auto-fill serial and module if available
  const serial = document.getElementById('dev-serial');
  const module = document.getElementById('dev-module');
  if (serial && t.model) serial.value = t.model; // model as serial hint
  if (module && t.model) module.value = t.model;

  // Show selection banner
  document.getElementById('imei-sel-imei').textContent = t.imei || '—';
  document.getElementById('imei-sel-detail').textContent =
    [t.model, t.supplier, t.price ? 'PKR ' + t.price : '', 'Status: ' + (t.status || '—')].filter(Boolean).join(' · ');
  document.getElementById('imei-sel-banner').style.display = 'block';
  dd.style.display = 'none';
}

function clearIMEISel() {
  const inp = document.getElementById('inv-imei-q');
  inp.value = '';
  document.getElementById('imei-sel-banner').style.display = 'none';
  document.getElementById('imei-dd').style.display = 'none';
  // Clear stale hits so next search starts fresh
  const dd = document.getElementById('imei-dd');
  dd._hits = [];
  dd.innerHTML = '';
  // Clear auto-filled fields
  const serial = document.getElementById('dev-serial');
  const module = document.getElementById('dev-module');
  if (serial) serial.value = '';
  if (module) module.value = '';
  // Re-focus so user can type immediately
  inp.focus();
}

function searchSIM(q) {
  const dd = document.getElementById('sim-dd');
  q = (q || '').toLowerCase().trim();
  if (q.length < 2) { dd.style.display = 'none'; return; }

  // Filter available SIMs
  const hits = allSIMs.filter(s =>
    (s.status || '').toLowerCase() === 'available' &&
    ((s.simNumber || '').toLowerCase().includes(q) || (s.network || '').toLowerCase().includes(q) ||
     (s.iccid || '').toLowerCase().includes(q) || (s.plan || '').toLowerCase().includes(q))
  ).slice(0, 10);

  if (!hits.length) {
    dd.innerHTML = '<div style="padding:12px 14px;font-size:11px;color:var(--muted);text-align:center">'
      + (allSIMs.length === 0 ? '⚠ Inventory not loaded — check connection' : 'No available SIMs matching "' + q + '"') + '</div>';
    dd.style.display = 'block'; return;
  }

  dd.innerHTML = hits.map((s, i) => {
    const sub = [s.network, s.plan, s.iccid ? 'ICCID: ' + s.iccid : '', 'Qty: ' + (s.qty || 1)].filter(Boolean).join(' · ');
    const row = ddRow('📶', s.simNumber || '—', sub, false);
    return row.replace('<div style="padding', '<div onclick="pickSIM(' + i + ')" style="padding');
  }).join('');
  dd._hits = hits;
  dd.style.display = 'block';
}

function pickSIM(i) {
  const dd = document.getElementById('sim-dd');
  const s = (dd._hits || allSIMs)[i];
  if (!s) return;

  // Set the input value (used by FormData on submit as field "gsm")
  document.getElementById('inv-sim-q').value = s.simNumber || '';

  // Show selection banner
  document.getElementById('sim-sel-num').textContent = s.simNumber || '—';
  document.getElementById('sim-sel-detail').textContent =
    [s.network, s.plan, s.iccid ? 'ICCID: ' + s.iccid : '', 'Status: ' + (s.status || '—')].filter(Boolean).join(' · ');
  document.getElementById('sim-sel-banner').style.display = 'block';
  dd.style.display = 'none';
}

function clearSIMSel() {
  const inp = document.getElementById('inv-sim-q');
  inp.value = '';
  document.getElementById('sim-sel-banner').style.display = 'none';
  const dd = document.getElementById('sim-dd');
  dd.style.display = 'none';
  dd._hits = [];
  dd.innerHTML = '';
  inp.focus();
}

let lastSubmittedData = {};

async function submitJO() {
  const check = document.getElementById('confirmCheck');
  const banner = document.getElementById('joBanner');
  banner.style.display = 'none';
  if (!check.checked) {
    document.querySelector('.checkbox-row').style.borderColor = 'var(--danger)';
    setTimeout(()=>document.querySelector('.checkbox-row').style.borderColor='',1500);
    return;
  }
  const form = document.getElementById('jobForm');

  // Auto-fill invoiceNumber from the badge if user left it blank
  const invInput = form.querySelector('[name="invoiceNumber"]');
  if (invInput && !invInput.value.trim()) {
    invInput.value = document.getElementById('joIdBadge').textContent.trim();
  }

  const data = Object.fromEntries(new FormData(form).entries());
  data.action   = 'submitJobOrder';
  data.sheetTab = 'Job Orders';
  if (selectedCust) data.customerId = selectedCust.customerId||'';

  const btn = document.getElementById('btnSubmit');
  btn.textContent = 'Submitting…'; btn.disabled = true;
  try {
    const res = await crmPost(data);
    if (res.status === 'error') throw new Error(res.message);
    lastSubmittedData = data;
    // Show success
    document.getElementById('jobForm').style.display = 'none';
    document.querySelector('.nav-bar').style.display  = 'none';
    document.getElementById('successScreen').classList.add('active');
    banner.style.display = 'none';
  } catch(err) {
    btn.textContent = 'Submit Order'; btn.disabled = false;
    banner.textContent = '⚠ ' + (err.message||'Submission failed — check connection');
    banner.style.display = 'block';
  }
}

function resetJOForm() {
  document.getElementById('jobForm').reset();
  document.getElementById('jobForm').style.display = 'block';
  document.querySelector('.nav-bar').style.display  = 'flex';
  document.getElementById('successScreen').classList.remove('active');
  document.querySelectorAll('.toc-btn').forEach(b=>b.classList.remove('selected'));
  document.getElementById('tocHidden').value = '';
  document.getElementById('btnSubmit').textContent = 'Submit Order';
  document.getElementById('btnSubmit').disabled = false;
  document.getElementById('joBanner').style.display = 'none';
  clearSelectedCustomer();
  curStep = 0; updateStepUI();
  document.getElementById('joIdBadge').textContent = 'JO-'+Date.now().toString(36).toUpperCase().slice(-8);
  document.getElementById('f-date').valueAsDate = new Date();
}

function exportLastJO() { buildExport(lastSubmittedData); }

updateStepUI();

// ══════════════════════════════════════
//  ALL JOs LIST
// ══════════════════════════════════════
let allJOs=[],filteredJOs=[],curPage=1,perPage=25,sKey='date',sDir='desc';

async function loadJOs() {
  const tb=document.getElementById('jo-tbody');
  tb.innerHTML='<tr><td colspan="13" style="text-align:center;padding:40px;color:var(--muted)">Loading…</td></tr>';
  try {
    const res=await crmGet({action:'getJobOrders'});
    allJOs=res.data||[];
    updateStats(allJOs); applyFilters();
  } catch(err) {
    tb.innerHTML='<tr><td colspan="13" style="text-align:center;padding:30px;color:var(--danger)">⚠ '+(err.message||'Could not load')+'</td></tr>';
  }
}

function updateStats(d) {
  const now=new Date(),m=now.getMonth(),y=now.getFullYear();
  document.getElementById('jst-total').textContent=d.length;
  document.getElementById('jst-new').textContent=d.filter(r=>r.toc==='new_installation').length;
  document.getElementById('jst-rep').textContent=d.filter(r=>r.toc==='replacement').length;
  document.getElementById('jst-rem').textContent=d.filter(r=>r.toc==='removal').length;
  document.getElementById('jst-month').textContent=d.filter(r=>{
    if(!r.date)return false;const d2=new Date(r.date);return d2.getMonth()===m&&d2.getFullYear()===y;
  }).length;
}

function applyFilters() {
  const q  =(document.getElementById('f-q').value||'').toLowerCase().trim();
  const toc= document.getElementById('f-toc').value;
  const pay= document.getElementById('f-pay').value;
  const sal=(document.getElementById('f-sales').value||'').toLowerCase().trim();
  const cit=(document.getElementById('f-city').value||'').toLowerCase().trim();
  const ins=(document.getElementById('f-inst').value||'').toLowerCase().trim();
  const mk =(document.getElementById('f-make').value||'').toLowerCase().trim();
  const frm= document.getElementById('f-from').value;
  const to = document.getElementById('f-to').value;
  filteredJOs=allJOs.filter(r=>{
    const mq=!q||[r.customer,r.vehicle,r.imei,r.invoiceNumber,r.city,r.contact,r.name,r.engine,r.chassis,r.gsm,r.rac,r.reference].some(v=>(v||'').toLowerCase().includes(q));
    const mt=!toc||r.toc===toc, mp=!pay||r.payment===pay, ms=!sal||(r.sales||'').toLowerCase().includes(sal);
    const mc=!cit||(r.city||'').toLowerCase().includes(cit), mi=!ins||(r.installer||'').toLowerCase().includes(ins);
    const mm=!mk||[(r.make||''),(r.model||'')].join(' ').toLowerCase().includes(mk);
    let mf=true,mt2=true;
    if(frm||to){const d=r.date?new Date(r.date):null;if(d){if(frm)mf=d>=new Date(frm);if(to)mt2=d<=new Date(to+'T23:59:59');}else mf=mt2=false;}
    return mq&&mt&&mp&&ms&&mc&&mi&&mm&&mf&&mt2;
  });
  filteredJOs.sort((a,b)=>{
    let av=a[sKey]||'',bv=b[sKey]||'';
    if(sKey==='date'){av=av?new Date(av).getTime():0;bv=bv?new Date(bv).getTime():0;return sDir==='asc'?av-bv:bv-av;}
    av=av.toString().toLowerCase();bv=bv.toString().toLowerCase();return sDir==='asc'?av.localeCompare(bv):bv.localeCompare(av);
  });
  const ac=[toc,pay,sal,cit,ins,mk,frm,to,q].filter(Boolean).length;
  const fc=document.getElementById('fc-count');
  if(fc)fc.textContent=ac>0?ac+' filter'+(ac>1?'s':'')+' active':'';
  curPage=1;renderPage();
}

function clearFilters(){['f-q','f-toc','f-pay','f-sales','f-city','f-inst','f-make','f-from','f-to'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});applyFilters();}

function sortJO(key){
  if(sKey===key)sDir=sDir==='asc'?'desc':'asc';else{sKey=key;sDir='asc';}
  document.querySelectorAll('[id^="s-"]').forEach(e=>e.textContent='');
  const el=document.getElementById('s-'+key);if(el)el.textContent=sDir==='asc'?' ↑':' ↓';
  applyFilters();
}

function renderPage() {
  const tb=document.getElementById('jo-tbody');
  const total=filteredJOs.length,pages=Math.max(1,Math.ceil(total/perPage));
  curPage=Math.min(curPage,pages);
  const start=(curPage-1)*perPage,slice=filteredJOs.slice(start,start+perPage);
  const ri=document.getElementById('res-info');
  if(ri)ri.textContent=total===0?'No results':'Showing '+(start+1)+'–'+Math.min(start+perPage,total)+' of '+total+' orders';
  if(!slice.length){tb.innerHTML='<tr><td colspan="13"><div class="empty-state"><div class="ei">📋</div><p>No orders match</p></div></td></tr>';renderPg(0,1);return;}
  tb.innerHTML=slice.map(r=>{
    const gi=allJOs.indexOf(r);
    const tCls=r.toc==='new_installation'?'toc-new':r.toc==='replacement'?'toc-rep':'toc-rem';
    const tLbl=r.toc==='new_installation'?'New Install':r.toc==='replacement'?'Replacement':'Removal';
    const company=[r.rac,r.reference].filter(Boolean).join(' / ')||'—';
    return `<tr class="jo-row" id="jr-${gi}" onclick="toggleRow(${gi},this)">
      <td class="td-muted">${r.date||'—'}</td>
      <td style="font-family:var(--mono);color:var(--accent);font-size:11px">${r.invoiceNumber||'—'}</td>
      <td><strong>${r.customer||'—'}</strong></td>
      <td class="td-muted" style="font-size:11px;max-width:110px;overflow:hidden;text-overflow:ellipsis">${company}</td>
      <td class="td-muted">${r.contact||'—'}</td>
      <td style="font-family:var(--mono);font-size:11px">${r.vehicle||'—'}</td>
      <td class="td-muted">${[r.make,r.model].filter(Boolean).join(' ')||'—'}</td>
      <td style="font-family:var(--mono);font-size:10px;color:var(--muted)">${r.imei||'—'}</td>
      <td><span class="badge ${tCls}" style="font-size:9px">${tLbl}</span></td>
      <td class="td-muted">${r.city||'—'}</td>
      <td class="td-muted">${r.installer||'—'}</td>
      <td class="td-muted">${r.payment||'—'}</td>
      <td onclick="event.stopPropagation()" style="white-space:nowrap;display:flex;gap:4px;align-items:center;padding:8px 14px">
        <button class="btn btn-ghost btn-sm" onclick="openEditModal(${gi})" style="font-size:10px;padding:4px 10px">✏ Edit</button>
        <button class="btn btn-ghost btn-sm" onclick="exportJO(${gi})" style="font-size:10px;padding:4px 10px">⬇ PDF</button>
      </td>
    </tr>
    <tr class="jo-det" id="jd-${gi}"><td colspan="13"><div class="det-inner" id="jdi-${gi}"></div></td></tr>`;
  }).join('');
  renderPg(total,pages);
}

function toggleRow(gi,row) {
  const det=document.getElementById('jd-'+gi),inner=document.getElementById('jdi-'+gi);
  if(det.classList.contains('open')){det.classList.remove('open');row.classList.remove('expanded');return;}
  document.querySelectorAll('.jo-det.open').forEach(d=>d.classList.remove('open'));
  document.querySelectorAll('.jo-row.expanded').forEach(r2=>r2.classList.remove('expanded'));
  row.classList.add('expanded');det.classList.add('open');
  const r=allJOs[gi];
  const f=(l,v)=>`<div class="dg-cell"><div class="dg-l">${l}</div><div class="dg-v">${v||'—'}</div></div>`;
  inner.innerHTML=`
    <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--accent);margin-bottom:12px">Full Details — ${r.invoiceNumber||'JO'}</div>
    <div class="det-grid">
      ${f('Invoice',r.invoiceNumber)}${f('Date',r.date)}${f('TOC',r.toc)}${f('Sales',r.sales)}
      ${f('Customer',r.customer)}${f('RAC',r.rac)}${f('Company',r.reference)}${f('Contact',r.contact)}
      ${f('Package',r.package)}${f('AMC',r.amc)}${f('Payment',r.payment)}${f('Receipt',r.receipt)}
      ${f('Vehicle',r.vehicle)}${f('Make',r.make)}${f('Model',r.model)}${f('Color',r.color)}
      ${f('Engine',r.engine)}${f('Chassis',r.chassis)}${f('IMEI',r.imei)}${f('Serial',r.serial)}
      ${f('GSM',r.gsm)}${f('Module',r.module)}${f('Installer',r.installer)}${f('Test Officer',r.testingOfficer)}
      ${f('Pre Pack',r.prepack)}${f('Post Pack',r.postpack)}${f('Cut Off',r.cutoff)}${f('Install City',r.installCity)}
      ${f('Username',r.username)}${f('SMS Number',r.smsNumber)}${f('License',r.license)}${f('Committed',r.commitDate)}
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-primary btn-sm" onclick="exportJO(${gi})">⬇ Export PDF</button>
      <button class="btn btn-ghost btn-sm" onclick="switchTab('new',document.getElementById('tab-new'))">＋ New Order</button>
    </div>`;
}

function renderPg(total,pages){
  const bar=document.getElementById('pg-btns');if(!bar)return;
  if(total===0){bar.innerHTML='';return;}
  const b=(lbl,pg,dis,act)=>`<button class="pgb${act?' act':''}" onclick="goPg(${pg})" ${dis?'disabled':''}>${lbl}</button>`;
  let h=b('‹',curPage-1,curPage===1,false);
  const s=Math.max(1,curPage-2),e=Math.min(pages,curPage+2);
  if(s>1){h+=b('1',1,false,false);if(s>2)h+='<span style="color:var(--muted);padding:0 3px;font-size:11px">…</span>';}
  for(let p=s;p<=e;p++)h+=b(p,p,false,p===curPage);
  if(e<pages){if(e<pages-1)h+='<span style="color:var(--muted);padding:0 3px;font-size:11px">…</span>';h+=b(pages,pages,false,false);}
  h+=b('›',curPage+1,curPage===pages,false);
  bar.innerHTML=h;const ji=document.getElementById('pg-inp');if(ji){ji.value=curPage;ji.max=pages;}
}
function goPg(p){curPage=p;renderPage();window.scrollTo({top:0,behavior:'smooth'});}
function jumpPg(){const p=parseInt(document.getElementById('pg-inp').value),pg=Math.ceil(filteredJOs.length/perPage);if(p>=1&&p<=pg)goPg(p);}
function changePP(){perPage=parseInt(document.getElementById('pp-sel').value);curPage=1;renderPage();}

// ══════════════════════════════════════
//  PDF EXPORT
// ══════════════════════════════════════
function exportJO(gi){ buildExport(allJOs[gi]); }

function buildExport(d) {
  if(!d)return;
  const now=new Date().toLocaleDateString('en-PK',{year:'numeric',month:'long',day:'numeric'});
  const s=v=>v||'—';
  const sec=(t,pairs)=>{
    const rows=[];
    for(let i=0;i<pairs.length;i+=2){
      const[l1,v1]=pairs[i],[l2,v2]=pairs[i+1]||['',''];
      rows.push(`<tr><td style="font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#888;padding:7px 10px 7px 0;border-bottom:1px solid #f0f0f0;width:17%">${l1}</td><td style="font-size:12px;color:#111;padding:7px 16px 7px 0;border-bottom:1px solid #f0f0f0;width:33%;font-weight:500">${v1}</td><td style="font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#888;padding:7px 10px 7px 0;border-bottom:1px solid #f0f0f0;width:17%">${l2}</td><td style="font-size:12px;color:#111;padding:7px 0;border-bottom:1px solid #f0f0f0;width:33%;font-weight:500">${v2}</td></tr>`);
    }
    return `<div style="margin-bottom:16px"><div style="background:#0d1b2a;color:#38d9f5;font-size:9px;letter-spacing:2px;text-transform:uppercase;padding:7px 12px;border-radius:5px 5px 0 0;font-weight:600">${t}</div><table width="100%" style="border:1px solid #e2e8f0;border-top:none;padding:4px 12px;background:#fff;border-radius:0 0 5px 5px">${rows.join('')}</table></div>`;
  };
  document.getElementById('expContent').innerHTML=`<div style="font-family:'Segoe UI',Arial,sans-serif;color:#111;padding:32px 36px;font-size:12px;line-height:1.6">
    <table width="100%" style="margin-bottom:22px;border-bottom:3px solid #0d1b2a;padding-bottom:16px"><tr>
      <td><div style="font-size:22px;font-weight:800;color:#0d1b2a">Fleet<span style="color:#0ea5e9">CRM</span></div><div style="font-size:10px;color:#666;letter-spacing:2px;text-transform:uppercase;margin-top:2px">Vehicle Tracking Job Order</div></td>
      <td style="text-align:right"><div style="font-size:11px;color:#666">Invoice No.</div><div style="font-size:20px;font-weight:700;color:#0d1b2a">${s(d.invoiceNumber)}</div><div style="font-size:10px;color:#888;margin-top:3px">Printed: ${now}</div></td>
    </tr></table>
    ${sec('Customer Details',[['Date',s(d.date)],['Invoice',s(d.invoiceNumber)],['Customer',s(d.customer)],['Contact',s(d.contact)],['RAC / Group',s(d.rac)],['Company',s(d.reference)],['City',s(d.city)],['Area',s(d.area)],['Service Call',s(d.serviceCall)],[' ',' ']])}
    ${sec('Sales / Accounts',[['TOC',s(d.toc)],['Sales Person',s(d.sales)],['Package',s(d.package)],['AMC',s(d.amc)],['Payment',s(d.payment)],['Receipt',s(d.receipt)],['Committed Date',s(d.commitDate)],[' ',' ']])}
    ${sec('Device — New',[['IMEI',s(d.imei)],['Serial',s(d.serial)],['GSM / SIM',s(d.gsm)],['Module',s(d.module)]])}
    ${(d.oldimei||d.oldserial)?sec('Device — Old',[['IMEI (Old)',s(d.oldimei)],['Serial (Old)',s(d.oldserial)],['GSM (Old)',s(d.oldgsm)],['Module (Old)',s(d.oldmodule)]]):''}
    ${sec('Current Vehicle',[['Reg. No.',s(d.vehicle)],['Engine',s(d.engine)],['Chassis',s(d.chassis)],[' ',' '],['Make',s(d.make)],['Model',s(d.model)],['Color',s(d.color)],[' ',' ']])}
    ${(d.oldVehicle||d.oldMake)?sec('Old / Previous Vehicle',[['Old Reg. No.',s(d.oldVehicle)],['Old Engine',s(d.oldEngine)],['Old Chassis',s(d.oldChassis)],[' ',' '],['Old Make',s(d.oldMake)],['Old Model',s(d.oldModel)],['Old Color',s(d.oldColor)],[' ',' ']]):''}
    ${(d.oldCustomer||d.oldContact)?sec('Old / Previous Customer',[['Old Customer',s(d.oldCustomer)],['Old Contact',s(d.oldContact)],['Old RAC',s(d.oldRac)],['Old CNIC',s(d.oldCnic)]]):''}
    ${sec('Installation',[['Testing Officer',s(d.testingOfficer)],['Installer',s(d.installer)],['Pre Pack',s(d.prepack)],['Post Pack',s(d.postpack)],['Cut Off',s(d.cutoff)],['Install City',s(d.installCity)]])}
    ${sec('Credentials',[['Username',s(d.username)],['Password',s(d.password)],['SMS Number',s(d.smsNumber)],['License Key',s(d.license)],['SMS Type',s(d.smsType)],['Fence City',s(d.fenceCity)]])}
    ${sec('Customer Credentials',[['Full Name',s(d.name)],['CNIC',s(d.cnic)],['Father Name',s(d.father)],['Email',s(d.email)],['1st User',s(d.user1)],['2nd User',s(d.user2)],['3rd User',s(d.user3)],['P/E Code',s(d.pcode)+' / '+s(d.ecode)]])}
    <table width="100%" style="margin-bottom:14px"><tr><td style="background:#f8fafc;border-radius:6px;padding:12px 14px;font-size:11px;color:#444;border:1px solid #e2e8f0"><strong style="display:block;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:#888;margin-bottom:3px">Address</strong>${s(d.address)}</td></tr></table>
    ${d.disclaimer?`<table width="100%" style="margin-bottom:18px"><tr><td style="background:#f8fafc;border-radius:6px;padding:12px 14px;font-size:11px;color:#444;border:1px solid #e2e8f0"><strong style="display:block;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:#888;margin-bottom:3px">Disclaimer</strong>${s(d.disclaimer)}</td></tr></table>`:''}
    <table width="100%" style="margin-top:28px;border-top:1px solid #e2e8f0;padding-top:20px"><tr>
      <td width="33%" style="text-align:center;padding:0 10px"><div style="border-top:1px solid #ccc;margin-top:38px;padding-top:7px;font-size:10px;color:#888">Customer Signature</div></td>
      <td width="33%" style="text-align:center;padding:0 10px"><div style="border-top:1px solid #ccc;margin-top:38px;padding-top:7px;font-size:10px;color:#888">Installer Signature</div></td>
      <td width="33%" style="text-align:center;padding:0 10px"><div style="border-top:1px solid #ccc;margin-top:38px;padding-top:7px;font-size:10px;color:#888">Authorized Officer</div></td>
    </tr></table>
    <div style="text-align:center;margin-top:18px;font-size:9px;color:#bbb;letter-spacing:1px;text-transform:uppercase;border-top:1px solid #f0f0f0;padding-top:12px">FleetCRM · ${s(d.invoiceNumber)} · ${now}</div>
  </div>`;
  document.getElementById('expModal').style.display='flex';
}

function doPrint(){
  const w=window.open('','_blank','width=900,height=700');
  w.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Job Order</title><style>body{margin:0}@media print{@page{margin:15mm}}</style></head><body>'+document.getElementById('expContent').innerHTML+'</body></html>');
  w.document.close();w.focus();setTimeout(()=>w.print(),400);
}
document.getElementById('expModal').addEventListener('click',e=>{if(e.target===document.getElementById('expModal'))document.getElementById('expModal').style.display='none';});

// ══════════════════════════════════════
//  JO EDIT MODAL
// ══════════════════════════════════════
let editingJOIdx = -1;

function openEditModal(gi) {
  editingJOIdx = gi;
  const r = allJOs[gi]; if(!r) return;
  document.getElementById('jem-title').textContent = 'Edit — ' + (r.invoiceNumber||'Job Order');
  document.getElementById('jem-sub').textContent   = (r.customer||'') + (r.date?' · '+r.date:'');
  document.getElementById('jem-err').style.display = 'none';

  const fi=(id,lbl,val,type='text')=>
    `<div class="field"><label>${lbl}</label><input type="${type}" id="je-${id}" value="${esc(val||'')}" style="width:100%;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:var(--mono);font-size:11px;padding:8px 11px;outline:none;transition:border-color 0.2s" onfocus="this.style.borderColor='rgba(56,217,245,0.4)'" onblur="this.style.borderColor='rgba(255,255,255,0.07)'"></div>`;
  const fs=(id,lbl,val,opts)=>
    `<div class="field"><label>${lbl}</label><select id="je-${id}" style="width:100%;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:var(--mono);font-size:11px;padding:8px 11px;outline:none;cursor:pointer;appearance:none">${opts.map(o=>`<option${val===o?' selected':''}>${o}</option>`).join('')}</select></div>`;
  const sec=(lbl,clr='var(--accent)')=>
    `<div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:${clr};margin:18px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--border);font-weight:600">${lbl}</div>`;
  const g2=inner=>`<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 18px">${inner}</div>`;
  const g3=inner=>`<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0 18px">${inner}</div>`;
  const span2=inner=>`<div style="grid-column:span 2">${inner}</div>`;

  document.getElementById('jem-body').innerHTML = `

    ${sec('📅 Order Info')}
    ${g2(fi('date','Date',r.date,'date')+fi('invoiceNumber','Invoice Number',r.invoiceNumber))}

    ${sec('👤 Current Customer','var(--accent)')}
    ${g2(fi('customer','Customer Name',r.customer)+fi('contact','Contact',r.contact)+fi('rac','RAC / Group',r.rac)+fi('reference','Company / Reference',r.reference)+fi('city','City',r.city)+fi('area','Area',r.area))}
    ${g2(fi('serviceCall','Final Service Call',r.serviceCall,'text')+'<div></div>')}

    ${sec('👤 Old / Previous Customer','var(--muted)')}
    ${g2(fi('oldCustomer','Old Customer Name',r.oldCustomer)+fi('oldContact','Old Contact',r.oldContact)+fi('oldRac','Old RAC',r.oldRac)+fi('oldCnic','Old CNIC',r.oldCnic))}

    ${sec('💼 Sales / Accounts','var(--accent2)')}
    ${g3(fi('sales','Sales Person',r.sales)+
      `<div class="field"><label>Type of Contract</label><select id="je-toc" style="width:100%;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:var(--mono);font-size:11px;padding:8px 11px;outline:none;cursor:pointer;appearance:none">
        <option${r.toc==='new_installation'?' selected':''} value="new_installation">New Installation</option>
        <option${r.toc==='replacement'?' selected':''} value="replacement">Replacement</option>
        <option${r.toc==='removal'?' selected':''} value="removal">Removal</option>
      </select></div>`+
      fi('package','Package',r.package))}
    ${g3(fi('amc','AMC',r.amc)+
      `<div class="field"><label>Payment Mode</label><select id="je-payment" style="width:100%;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:var(--mono);font-size:11px;padding:8px 11px;outline:none;cursor:pointer;appearance:none">
        <option${!r.payment?' selected':''} value="">Select…</option>
        ${['Cash','Credit','Transfer'].map(o=>`<option${r.payment===o?' selected':''}>${o}</option>`).join('')}
      </select></div>`+
      fi('receipt','Receipt Number',r.receipt))}
    ${g2(fi('commitDate','Committed Date',r.commitDate,'date')+'<div></div>')}

    ${sec('📡 New Device','var(--accent)')}
    ${g2(fi('imei','IMEI',r.imei)+fi('serial','Serial Number',r.serial)+fi('gsm','GSM / SIM',r.gsm)+fi('module','Module',r.module))}

    ${sec('📡 Old Device (Replacement)','var(--muted)')}
    ${g2(fi('oldimei','IMEI (Old)',r.oldimei)+fi('oldserial','Serial (Old)',r.oldserial)+fi('oldgsm','GSM (Old)',r.oldgsm)+fi('oldmodule','Module (Old)',r.oldmodule))}

    ${sec('🚗 Current Vehicle','var(--warn)')}
    ${g2(fi('vehicle','Registration Number',r.vehicle)+fi('engine','Engine Number',r.engine))}
    ${g2(`<div style="grid-column:span 2">${fi('chassis','Chassis Number',r.chassis)}</div>`)}
    ${g3(fi('make','Make',r.make)+fi('model','Model',r.model)+fi('color','Color',r.color))}

    ${sec('🚗 Old / Previous Vehicle','var(--muted)')}
    ${g2(fi('oldVehicle','Old Registration',r.oldVehicle)+fi('oldEngine','Old Engine Number',r.oldEngine))}
    ${g2(`<div style="grid-column:span 2">${fi('oldChassis','Old Chassis Number',r.oldChassis)}</div>`)}
    ${g3(fi('oldMake','Old Make',r.oldMake)+fi('oldModel','Old Model',r.oldModel)+fi('oldColor','Old Color',r.oldColor))}

    ${sec('🔧 Installation & Testing','var(--accent2)')}
    ${g2(fi('testingOfficer','Testing Officer',r.testingOfficer)+fi('installer','Installer',r.installer)+fi('prepack','Pre Pack',r.prepack)+fi('postpack','Post Pack',r.postpack))}
    ${g2(`<div style="grid-column:span 2">${fi('cutoff','Cut Off Type',r.cutoff)}</div>`)}

    ${sec('🔔 Alert Settings','var(--accent2)')}
    ${g3(fi('smsType','SMS Type',r.smsType)+fi('fenceCity','Fence City',r.fenceCity)+fi('deviceLocation','Device Location',r.deviceLocation))}
    ${g2(fi('installArea','Install Area',r.installArea)+fi('installCity','Install City',r.installCity))}

    ${sec('🔑 User Credentials','var(--success)')}
    ${g3(fi('username','Username',r.username)+fi('password','Password',r.password,'password')+fi('smsNumber','SMS Number',r.smsNumber))}
    ${g3(fi('smsPerson','SMS Person',r.smsPerson)+fi('verification','App Verification',r.verification)+fi('license','License Key',r.license))}

    ${sec('📋 Customer Credentials','var(--accent2)')}
    ${g2(fi('name','Full Name',r.name)+fi('cnic','CNIC',r.cnic)+fi('father',"Father's Name",r.father)+fi('email','Email',r.email,'email'))}
    ${g3(fi('user1','1st User',r.user1)+fi('user2','2nd User',r.user2)+fi('user3','3rd User',r.user3))}
    ${g2(fi('pcode','P Code',r.pcode)+fi('ecode','E Code',r.ecode))}
    <div class="field" style="margin-top:4px"><label>Postal Address</label><textarea id="je-address" style="width:100%;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:var(--mono);font-size:11px;padding:8px 11px;outline:none;height:68px;resize:none">${esc(r.address||'')}</textarea></div>
    <div class="field"><label>Disclaimer / Notes</label><textarea id="je-disclaimer" style="width:100%;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:var(--mono);font-size:11px;padding:8px 11px;outline:none;height:56px;resize:none">${esc(r.disclaimer||'')}</textarea></div>`;

  document.getElementById('joEditModal').style.display = 'flex';
}

function closeEditModal() {
  document.getElementById('joEditModal').style.display = 'none';
}

document.getElementById('joEditModal').addEventListener('click', e => {
  if (e.target === document.getElementById('joEditModal')) closeEditModal();
});

async function saveEditJO() {
  const r = allJOs[editingJOIdx]; if(!r) return;
  const errEl = document.getElementById('jem-err');
  errEl.style.display = 'none';

  const get = id => { const el=document.getElementById('je-'+id); return el?el.value.trim():''; };

  const updates = {
    date:          get('date'),
    invoiceNumber: get('invoiceNumber'),
    customer:      get('customer'),
    contact:       get('contact'),
    rac:           get('rac'),
    reference:     get('reference'),
    city:          get('city'),
    area:          get('area'),
    serviceCall:   get('serviceCall'),
    oldCustomer:   get('oldCustomer'),
    oldContact:    get('oldContact'),
    oldRac:        get('oldRac'),
    oldCnic:       get('oldCnic'),
    toc:           get('toc'),
    sales:         get('sales'),
    package:       get('package'),
    amc:           get('amc'),
    payment:       get('payment'),
    receipt:       get('receipt'),
    commitDate:    get('commitDate'),
    imei:          get('imei'),
    serial:        get('serial'),
    gsm:           get('gsm'),
    module:        get('module'),
    oldimei:       get('oldimei'),
    oldserial:     get('oldserial'),
    oldgsm:        get('oldgsm'),
    oldmodule:     get('oldmodule'),
    vehicle:       get('vehicle'),
    engine:        get('engine'),
    chassis:       get('chassis'),
    make:          get('make'),
    model:         get('model'),
    color:         get('color'),
    oldVehicle:    get('oldVehicle'),
    oldEngine:     get('oldEngine'),
    oldChassis:    get('oldChassis'),
    oldMake:       get('oldMake'),
    oldModel:      get('oldModel'),
    oldColor:      get('oldColor'),
    testingOfficer:get('testingOfficer'),
    installer:     get('installer'),
    prepack:       get('prepack'),
    postpack:      get('postpack'),
    cutoff:        get('cutoff'),
    smsType:       get('smsType'),
    fenceCity:     get('fenceCity'),
    deviceLocation:get('deviceLocation'),
    installArea:   get('installArea'),
    installCity:   get('installCity'),
    username:      get('username'),
    password:      get('password'),
    smsNumber:     get('smsNumber'),
    smsPerson:     get('smsPerson'),
    verification:  get('verification'),
    license:       get('license'),
    name:          get('name'),
    cnic:          get('cnic'),
    father:        get('father'),
    email:         get('email'),
    user1:         get('user1'),
    user2:         get('user2'),
    user3:         get('user3'),
    pcode:         get('pcode'),
    ecode:         get('ecode'),
    address:       document.getElementById('je-address')?.value.trim()||'',
    disclaimer:    document.getElementById('je-disclaimer')?.value.trim()||'',
  };

  try {
    const res = await crmPost({
      action:    'updateField',
      sheetTab:  'Job Orders',
      keyField:  'invoiceNumber',
      keyValue:  r.invoiceNumber,
      updates,
    });
    if (res.status === 'error') throw new Error(res.message);
    // Update local record
    Object.assign(allJOs[editingJOIdx], updates);
    closeEditModal();
    applyFilters(); // re-render table with updated data
    showJOToast('✓ Job Order updated — ' + (r.invoiceNumber||''));
  } catch(err) {
    errEl.textContent = '⚠ Save failed: ' + (err.message||'check connection');
    errEl.style.display = 'block';
  }
}

function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

function showJOToast(msg){
  const t=document.createElement('div');
  t.style.cssText='position:fixed;bottom:24px;right:24px;background:rgba(61,255,160,0.12);border:1px solid rgba(61,255,160,0.35);border-radius:10px;padding:14px 20px;color:var(--success);font-size:12px;font-family:var(--mono);z-index:999;max-width:360px';
  t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),3000);
}