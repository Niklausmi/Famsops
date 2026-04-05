// ═══════════════════════════════════════════════════════════════
//  FleetCRM — Core  v5  (Supabase backend)
//  Set your Supabase project URL and anon key below
// ═══════════════════════════════════════════════════════════════

// ✏️  PASTE YOUR SUPABASE PROJECT URL AND ANON KEY HERE
const SUPABASE_URL  = 'https://jiquxmaidrwxogvfuezm.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppcXV4bWFpZHJ3eG9ndmZ1ZXptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NDEwMTMsImV4cCI6MjA5MDAxNzAxM30.p28S296i-cnPf85-uEZYiCJW217fmrgFvlQp-XGKmac';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppcXV4bWFpZHJ3eG9ndmZ1ZXptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQ0MTAxMywiZXhwIjoyMDkwMDE3MDEzfQ.RJVvajaSHsnLD9LCJx8hIpP441RpquzwmwxeQMq_2go';

// ── Role → page permissions (unchanged) ─────────────────────────
const CRM_PERMISSIONS = {
  admin:      ['dashboard','customers','tickets','jolist','assets','leads','inventory','users'],
  sales:      ['dashboard','customers','tickets','jolist','assets'],
  operations: ['dashboard','customers','tickets','jolist','assets','inventory'],
  management: ['dashboard','customers','tickets','leads','jolist','assets','inventory'],
};

// ═══════════════════════════════════════════════════════════════
//  SUPABASE CLIENT
//  Thin wrapper around the Supabase REST API — no SDK needed,
//  works from a plain HTML file served via http.server
// ═══════════════════════════════════════════════════════════════
const sb = (() => {
  // Build request headers — token injected after login
  function headers(extra) {
    const session = _getSession();
    return {
      'apikey':        SUPABASE_ANON,
      'Authorization': 'Bearer ' + (session ? session.access_token : SUPABASE_ANON),
      'Content-Type':  'application/json',
      'Prefer':        'return=representation',
      ...(extra || {}),
    };
  }

  // ── READ — select * from table with optional eq filters ────────
  async function from(table, opts = {}) {
    if (!_checkConfig()) throw new Error('Supabase not configured');
    let url = SUPABASE_URL + '/rest/v1/' + table + '?select=*';
    if (opts.eq)    Object.entries(opts.eq).forEach(([k,v])  => { url += '&' + encodeURIComponent(k) + '=eq.' + encodeURIComponent(v); });
    if (opts.neq)   Object.entries(opts.neq).forEach(([k,v]) => { url += '&' + encodeURIComponent(k) + '=neq.' + encodeURIComponent(v); });
    if (opts.in)    Object.entries(opts.in).forEach(([k,v])  => { url += '&' + encodeURIComponent(k) + '=in.(' + v.map(encodeURIComponent).join(',') + ')'; });
    if (opts.order) url += '&order=' + opts.order;
    if (opts.limit) url += '&limit=' + opts.limit;
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) { const e = await res.text(); throw new Error('sb.from ' + table + ': ' + res.status + ' ' + e); }
    return await res.json();
  }

  // ── UPSERT — insert or update by unique key ────────────────────
  async function upsert(table, data, onConflict) {
    if (!_checkConfig()) throw new Error('Supabase not configured');
    const url = SUPABASE_URL + '/rest/v1/' + table
      + (onConflict ? '?on_conflict=' + encodeURIComponent(onConflict) : '');
    const body = Array.isArray(data) ? data : [data];
    const res  = await fetch(url, {
      method:  'POST',
      headers: headers({ 'Prefer': 'return=representation,resolution=merge-duplicates' }),
      body:    JSON.stringify(body),
    });
    if (!res.ok) { const e = await res.text(); throw new Error('sb.upsert ' + table + ': ' + res.status + ' ' + e); }
    return await res.json();
  }

  // ── UPDATE — patch rows matching eq filter ─────────────────────
  async function update(table, match, data) {
    if (!_checkConfig()) throw new Error('Supabase not configured');
    let url = SUPABASE_URL + '/rest/v1/' + table + '?';
    Object.entries(match).forEach(([k,v]) => { url += encodeURIComponent(k) + '=eq.' + encodeURIComponent(v) + '&'; });
    url = url.slice(0, -1);
    const res = await fetch(url, {
      method:  'PATCH',
      headers: headers(),
      body:    JSON.stringify(data),
    });
    if (!res.ok) { const e = await res.text(); throw new Error('sb.update ' + table + ': ' + res.status + ' ' + e); }
    return await res.json();
  }

  // ── RPC — call a server-side Postgres function ─────────────────
  async function rpc(fnName, params) {
    if (!_checkConfig()) throw new Error('Supabase not configured');
    const url = SUPABASE_URL + '/rest/v1/rpc/' + fnName;
    const res = await fetch(url, {
      method:  'POST',
      headers: headers(),
      body:    JSON.stringify(params || {}),
    });
    if (!res.ok) { const e = await res.text(); throw new Error('sb.rpc ' + fnName + ': ' + res.status + ' ' + e); }
    return await res.json();
  }

  function _checkConfig() {
    if (!SUPABASE_URL || SUPABASE_URL.includes('YOUR_PROJECT_ID')) {
      console.warn('SUPABASE_URL not configured in crm-core.js');
      return false;
    }
    return true;
  }

  return { from, upsert, update, rpc };
})();

// ═══════════════════════════════════════════════════════════════
//  AUTH — Supabase email/password + profile fetch
// ═══════════════════════════════════════════════════════════════
const AUTH_URL = () => SUPABASE_URL + '/auth/v1';

async function crmLogin(email, password) {
  try {
    // 1. Sign in with Supabase Auth
    const res = await fetch(AUTH_URL() + '/token?grant_type=password', {
      method:  'POST',
      headers: { 'apikey': SUPABASE_ANON, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    });
    if (!res.ok) return null;
    const session = await res.json();
    if (!session.access_token) return null;

    // 2. Store session tokens
    _setSession(session);

    // 3. Fetch profile (name, role, avatar, active)
    const profiles = await sb.from('profiles', { eq: { id: session.user.id } });
    if (!profiles.length) { crmLogout(); return null; }
    const p = profiles[0];
    if (!p.active) { crmLogout(); return null; }

    // 4. Build user object and store in sessionStorage
    const user = {
      id:       session.user.id,
      email:    session.user.email,
      username: p.username,
      name:     p.name,
      role:     p.role,
      avatar:   p.avatar || p.name.slice(0, 2).toUpperCase(),
    };
    sessionStorage.setItem('crm_user', JSON.stringify(user));
    return user;
  } catch (err) {
    console.error('crmLogin error:', err);
    return null;
  }
}

async function crmLogout() {
  try {
    const session = _getSession();
    if (session) {
      await fetch(AUTH_URL() + '/logout', {
        method:  'POST',
        headers: { 'apikey': SUPABASE_ANON, 'Authorization': 'Bearer ' + session.access_token },
      });
    }
  } catch(e) {}
  sessionStorage.removeItem('crm_user');
  sessionStorage.removeItem('crm_session');
  window.location.href = 'index.html';
}

function crmCurrentUser() {
  try { return JSON.parse(sessionStorage.getItem('crm_user')); }
  catch { return null; }
}

function crmGuard(requiredPage) {
  const user = crmCurrentUser();
  if (!user) { window.location.href = 'index.html'; return null; }
  const allowed = CRM_PERMISSIONS[user.role] || [];
  if (!allowed.includes(requiredPage)) { window.location.href = 'dashboard.html'; return null; }
  return user;
}

function _setSession(session) {
  sessionStorage.setItem('crm_session', JSON.stringify({
    access_token:  session.access_token,
    refresh_token: session.refresh_token,
    expires_at:    Date.now() + (session.expires_in * 1000),
  }));
}

function _getSession() {
  try { return JSON.parse(sessionStorage.getItem('crm_session')); }
  catch { return null; }
}

// ═══════════════════════════════════════════════════════════════
//  API LAYER — crmGet / crmPost
//  All API calls go to Supabase — action strings are preserved for compatibility.
//  Every action string from the existing frontend is handled here.
// ═══════════════════════════════════════════════════════════════

/**
 * crmGet — reads data from Supabase
 * Replaces: GET ?action=getCustomers, getAssets, getTickets, etc.
 */
async function crmGet(params) {
  const action = params.action || '';
  try {
    switch (action) {

      case 'getCustomers':
        return { data: await sb.from('customers', { order: '"customerName".asc' }) };

      case 'getAssets':
        return { data: await sb.from('assets', { order: '"createdAt".desc' }) };

      case 'getTickets':
        return { data: await sb.from('tickets', { order: '"createdAt".desc' }) };

      case 'getJobOrders':
        return { data: await sb.from('job_orders', { order: 'date.desc' }) };

      case 'getLeads':
        return { data: await sb.from('sales_leads', { order: '"dateForwarded".desc' }) };

      case 'getInventory': {
        const table = (params.tab === 'SIMs') ? 'sims' : 'trackers';
        const items = await sb.from(table);
        const isSIM = (params.tab === 'SIMs');
        return {
          data: items,
          summary: {
            total:     items.length,
            available: items.filter(r => r.status === 'Available').length,
            assigned:  items.filter(r => r.status === (isSIM ? 'Installed' : 'Assigned')).length,
            removed:   items.filter(r => r.status === 'Removed').length,
          },
        };
      }

      case 'getDashboard': {
        const [leads, jobs, tickets, assets, tr, si] = await Promise.all([
          sb.from('sales_leads'),
          sb.from('job_orders'),
          sb.from('tickets'),
          sb.from('assets'),
          sb.from('trackers'),
          sb.from('sims'),
        ]);
        const byStatus = {};
        leads.forEach(r => { const s = r.status || 'New Lead'; byStatus[s] = (byStatus[s]||0)+1; });
        const ticketsByStatus = {};
        tickets.forEach(t => { const s = t.status||'Open'; ticketsByStatus[s]=(ticketsByStatus[s]||0)+1; });
        return {
          leads:    { total: leads.length,   byStatus },
          jobs:     { total: jobs.length },
          tickets:  { total: tickets.length, byStatus: ticketsByStatus },
          assets:   { total: assets.length,  active: assets.filter(a=>a.status==='Active').length },
          trackers: { total: tr.length, available: tr.filter(t=>t.status==='Available').length, assigned: tr.filter(t=>t.status==='Assigned').length },
          sims:     { total: si.length, available: si.filter(s=>s.status==='Available').length, assigned: si.filter(s=>s.status==='Installed').length },
        };
      }

      case 'getCustomerHub': {
        const [customers, assets, tickets, jobs, leads, trackers, sims] = await Promise.all([
          sb.from('customers',   { eq: { '"customerId"': params.customerId } }),
          sb.from('assets',      { eq: { '"customerId"': params.customerId } }),
          sb.from('tickets',     { eq: { '"customerId"': params.customerId }, order: '"createdAt".desc' }),
          sb.from('job_orders',  { eq: { '"customerId"': params.customerId }, order: 'date.desc' }),
          sb.from('sales_leads', { eq: { '"customerId"': params.customerId }, order: '"dateForwarded".desc' }),
          sb.from('trackers'),
          sb.from('sims'),
        ]);
        if (!customers.length) return { error: 'Customer not found' };
        const enrichedAssets = assets.map(a => {
          const tr = trackers.find(t => t.imei === a.trackerIMEI);
          const si = sims.find(s => s.simNumber === a.simNumber);
          const aJOs = jobs.filter(j => j.vehicle === a.registrationNo || j.assetId === a.assetId);
          return { ...a, trackerStatus: tr?.status||'', trackerModel: tr?.model||'',
            simStatus: si?.status||'', simNetwork: si?.network||'',
            activityCount: aJOs.length,
            lastActivity: aJOs.length ? aJOs[0].date : '' };
        });
        return { customer: customers[0], assets: enrichedAssets, tickets, jobs, leads };
      }

      default:
        throw new Error('Unknown crmGet action: ' + action);
    }
  } catch (err) {
    console.error('crmGet [' + action + '] error:', err);
    throw err;
  }
}

/**
 * crmPost — writes data to Supabase
 * Replaces: POST {action: 'submitCustomer'|'submitTicket'|... }
 */
async function crmPost(data) {
  const action = data.action || '';
  const now    = new Date().toISOString();

  // Converts empty strings to null so Postgres date/nullable columns don't reject them
  function nullify(obj) {
    const out = { ...obj };
    Object.entries(out).forEach(([k, v]) => {
      if (typeof v === 'string') v = v.trim();
      if (v === '' || v === undefined) out[k] = null;
      else out[k] = v;
    });
    return out;
  }

  const cleanData = nullify(data);

  try {
    switch (action) {

      // ── CUSTOMERS ───────────────────────────────────────────────
      case 'submitCustomer': {
        const payload = nullify({ ...data, lastUpdated: now });
        delete payload.action; delete payload.sheetTab; delete payload.submittedAt;
        if (!payload.createdAt) payload.createdAt = now.split('T')[0];
        await sb.upsert('customers', payload, '"customerId"');
        return { status: 'success' };
      }

      // ── TICKETS (auto-creates lead via DB trigger) ───────────────
      case 'submitTicket': {
        // Only send columns that exist in the tickets table schema.
        // Sending unknown keys causes PostgREST errors; sending "" to date columns
        // causes "invalid input syntax for type date" — both fixed by explicit mapping.
        const d = cleanData;
        const dateOrNull = v => (v && String(v).trim() !== '') ? v : null;
        const textOrNull = v => (v && String(v).trim() !== '') ? String(v).trim() : null;

        const payload = nullify({
          // identity
          ticketId:          textOrNull(d.ticketId),
          type:              textOrNull(d.type),
          // customer
          customerId:        textOrNull(d.customerId),
          customerName:      textOrNull(d.customerName),
          contact:           textOrNull(d.contact),
          city:              textOrNull(d.city),
          rac:               textOrNull(d.rac),
          company:           textOrNull(d.company),
          // asset
          assetId:           textOrNull(d.assetId),
          registrationNo:    textOrNull(d.registrationNo),
          make:              textOrNull(d.make),
          model:             textOrNull(d.model),
          trackerIMEI:       textOrNull(d.trackerIMEI),
          simNumber:         textOrNull(d.simNumber),
          // common text
          title:             textOrNull(d.title),
          description:       textOrNull(d.description),
          priority:          textOrNull(d.priority) || 'Medium',
          status:            textOrNull(d.status)   || 'Open',
          assignedTo:        textOrNull(d.assignedTo),
          resolution:        textOrNull(d.resolution),
          linkedJobOrder:    textOrNull(d.linkedJobOrder),
          linkedLeadId:      textOrNull(d.linkedLeadId),
          createdBy:         textOrNull(d.createdBy),
          // date columns — empty string → null or Postgres throws
          followUpDate:      dateOrNull(d.followUpDate),
          incidentDate:      dateOrNull(d.incidentDate),
          closedAt:          dateOrNull(d.closedAt),
          // Lead-specific text
          interestedPackage: textOrNull(d.interestedPackage),
          noOfVehicles:      textOrNull(d.noOfVehicles),
          budget:            textOrNull(d.budget),
          purchaseTimeline:  textOrNull(d.purchaseTimeline),
          preferredPayment:  textOrNull(d.preferredPayment),
          leadSource:        textOrNull(d.leadSource),
          salesPerson:       textOrNull(d.salesPerson),
          // Query-specific
          queryCategory:     textOrNull(d.queryCategory),
          queryDetails:      textOrNull(d.queryDetails),
          // Complaint-specific
          complaintCategory: textOrNull(d.complaintCategory),
          complaintSeverity: textOrNull(d.complaintSeverity),
          affectedDevice:    textOrNull(d.affectedDevice),
          // timestamps — always set server-side or use value
          lastUpdated:       now,
          createdAt:         now,
        });

        await sb.upsert('tickets', payload, '"ticketId"');
        return { status: 'success', ticketId: payload.ticketId };
      }

      // ── LEADS (direct, if needed) ────────────────────────────────
      case 'submitLead': {
        const payload = nullify({ ...data, submittedAt: now });
        if (!payload.dateForwarded) payload.dateForwarded = now.split('T')[0];
        delete payload.action; delete payload.sheetTab;
        await sb.upsert('sales_leads', payload, '"leadId"');
        return { status: 'success' };
      }

      // ── JOB ORDERS — runs full cascade via Postgres function ─────
      case 'submitJobOrder': {
        const payload = { ...data };
        delete payload.action; delete payload.sheetTab; delete payload.submittedAt;
        const result = await sb.rpc('submit_job_order', { jo: payload });
        if (result && result.status === 'error') throw new Error(result.message);
        return { status: 'success', result };
      }

      // ── ASSETS ───────────────────────────────────────────────────
      case 'submitAsset': {
        const payload = nullify({ ...data, lastUpdated: now });
        if (!payload.createdAt) payload.createdAt = now;
        delete payload.action; delete payload.sheetTab; delete payload.submittedAt;
        await sb.upsert('assets', payload, '"assetId"');
        return { status: 'success' };
      }

      // ── INVENTORY — stock in ──────────────────────────────────────
      case 'stockIn': {
        const isTracker = data.sheetTab === 'Trackers' || data.imei;
        const table = isTracker ? 'trackers' : 'sims';
        const conflictCol = isTracker ? 'imei' : '"simNumber"';
        const payload = { ...data, lastUpdated: now };
        delete payload.action; delete payload.sheetTab; delete payload.submittedAt;
        await sb.upsert(table, payload, conflictCol);
        return { status: 'success' };
      }

      // ── INVENTORY — stock out (mark Removed) ─────────────────────
      case 'stockOut': {
        const isTracker = data.sheetTab === 'Trackers' || (data.sheetTab !== 'SIMs' && data.imei);
        const table = isTracker ? 'trackers' : 'sims';
        const matchKey = isTracker ? 'imei' : 'simNumber';
        const matchVal = data.keyValue || data.imei || data.simNumber;
        await sb.update(table, { [matchKey]: matchVal }, { status: 'Removed', lastUpdated: now });
        return { status: 'success' };
      }

      // ── INVENTORY — assign device ─────────────────────────────────
      case 'assign': {
        const assignId = data.assignId || ('ASGN-' + Date.now().toString(36).toUpperCase().slice(-8));
        await sb.upsert('assignments', { ...data, assignId, createdAt: now }, '"assignId"');
        if (data.trackerIMEI) {
          await sb.update('trackers', { imei: data.trackerIMEI }, {
            status: 'Assigned', assignedTo: data.vehicle||'',
            assetId: data.assetId||'', installer: data.installer||'',
            city: data.city||'', lastUpdated: now,
          });
        }
        if (data.simNumber) {
          await sb.update('sims', { simNumber: data.simNumber }, {
            status: 'Installed', installedIn: data.vehicle||'',
            assetId: data.assetId||'', lastUpdated: now,
          });
        }
        return { status: 'success', assignId };
      }

      // ── GENERIC FIELD UPDATE ──────────────────────────────────────
      case 'updateField': {
        const tableMap = {
          'Customers':   'customers',
          'Assets':      'assets',
          'Tickets':     'tickets',
          'Job Orders':  'job_orders',
          'Sales Leads': 'sales_leads',
          'Trackers':    'trackers',
          'SIMs':        'sims',
          'Assignments': 'assignments',
        };
        const table = tableMap[data.sheetTab];
        if (!table) throw new Error('Unknown sheetTab: ' + data.sheetTab);
        const match = { [data.keyField]: data.keyValue };
        const updates = { ...data.updates, lastUpdated: now };
        await sb.update(table, match, updates);
        return { status: 'success' };
      }

      // ── CUSTOMER STATS ────────────────────────────────────────────
      case 'updateCustomerStats': {
        const customers = await sb.from('customers', { eq: { '"customerId"': data.customerId } });
        if (customers.length) {
          const cur = customers[0].totalJobs || 0;
          await sb.update('customers', { '"customerId"': data.customerId }, {
            totalJobs: cur + 1,
            lastJobDate: data.jobDate || now.split('T')[0],
            lastUpdated: now,
          });
        }
        return { status: 'success' };
      }

      default:
        throw new Error('Unknown crmPost action: ' + action);
    }
  } catch (err) {
    console.error('crmPost [' + action + '] error:', err);
    return { status: 'error', message: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════
//  SHARED CSS  (unchanged from v4)
// ═══════════════════════════════════════════════════════════════
const CRM_STYLE = `
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0a0c0f;--surface:#111318;--surface2:#181c23;--surface3:#1e2230;
  --border:rgba(255,255,255,0.07);--border-hi:rgba(255,255,255,0.13);
  --accent:#38d9f5;--accent2:#7b6fff;--accent3:#ff7eb3;
  --text:#e8eaf0;--muted:#5a6070;--muted2:#3a3f4e;
  --danger:#ff5f6d;--success:#3dffa0;--warn:#ffb347;
  --mono:'DM Mono',monospace;--display:'Syne',sans-serif;
  --nav-w:220px;
}
body{font-family:var(--mono);background:var(--bg);color:var(--text);min-height:100vh}
body::before{content:'';position:fixed;inset:0;
  background-image:linear-gradient(rgba(56,217,245,0.025) 1px,transparent 1px),
  linear-gradient(90deg,rgba(56,217,245,0.025) 1px,transparent 1px);
  background-size:44px 44px;pointer-events:none;z-index:0}
.crm-nav{position:fixed;top:0;left:0;width:var(--nav-w);height:100vh;
  background:var(--surface);border-right:1px solid var(--border);
  display:flex;flex-direction:column;z-index:100;overflow:hidden}
.nav-logo{padding:22px 20px 18px;border-bottom:1px solid var(--border)}
.nav-logo .brand{font-family:var(--display);font-size:15px;font-weight:800;
  letter-spacing:-0.3px;color:var(--text);white-space:nowrap}
.nav-logo .brand span{color:var(--accent)}
.nav-logo .sub{font-size:9px;letter-spacing:2px;text-transform:uppercase;
  color:var(--muted);margin-top:3px}
.nav-links{flex:1;padding:12px 8px;overflow-y:auto}
.nav-section{font-size:8px;letter-spacing:2px;text-transform:uppercase;
  color:var(--muted2);padding:14px 10px 6px}
.nav-item{display:flex;align-items:center;gap:10px;padding:10px 12px;
  border-radius:8px;color:var(--muted);font-size:12px;cursor:pointer;
  transition:all 0.15s;text-decoration:none;margin-bottom:2px;white-space:nowrap}
.nav-item:hover{background:rgba(255,255,255,0.04);color:var(--text)}
.nav-item.active{background:rgba(56,217,245,0.08);color:var(--accent);
  border:1px solid rgba(56,217,245,0.15)}
.nav-item .icon{font-size:16px;width:22px;text-align:center;flex-shrink:0}
.nav-item .nav-label{flex:1}
.nav-item.locked{opacity:0.25;cursor:not-allowed;pointer-events:none}
.nav-footer{padding:12px 8px;border-top:1px solid var(--border)}
.nav-user{display:flex;align-items:center;gap:10px;padding:10px 12px;
  border-radius:8px;background:var(--surface2)}
.nav-avatar{width:32px;height:32px;border-radius:8px;flex-shrink:0;
  background:linear-gradient(135deg,var(--accent2),var(--accent));
  display:flex;align-items:center;justify-content:center;
  font-family:var(--display);font-size:11px;font-weight:700;color:#0a0c0f}
.nav-user-info{flex:1;min-width:0}
.nav-user-info .uname{font-size:12px;color:var(--text);font-weight:500;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nav-user-info .urole{font-size:10px;color:var(--muted);text-transform:capitalize}
.nav-logout{background:none;border:none;color:var(--muted);cursor:pointer;
  font-size:15px;padding:4px 6px;border-radius:6px;transition:all 0.15s;flex-shrink:0}
.nav-logout:hover{color:var(--danger);background:rgba(255,95,109,0.1)}
.crm-main{margin-left:var(--nav-w);min-height:100vh;position:relative;z-index:1}
.crm-topbar{height:58px;border-bottom:1px solid var(--border);
  display:flex;align-items:center;justify-content:space-between;
  padding:0 28px;background:rgba(10,12,15,0.85);backdrop-filter:blur(12px);
  position:sticky;top:0;z-index:50}
.crm-topbar .page-title{font-family:var(--display);font-size:16px;font-weight:700;letter-spacing:-0.3px}
.crm-topbar .page-subtitle{font-size:10px;color:var(--muted);letter-spacing:0.8px;margin-top:2px}
.topbar-right{display:flex;align-items:center;gap:14px}
.topbar-time{font-size:11px;color:var(--muted);letter-spacing:0.5px;font-variant-numeric:tabular-nums}
.crm-content{padding:28px 32px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:26px}
.card-sm{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px}
.stat-tile{background:var(--surface);border:1px solid var(--border);border-radius:12px;
  padding:20px 22px;position:relative;overflow:hidden;transition:border-color 0.2s,transform 0.15s}
.stat-tile:hover{border-color:var(--border-hi);transform:translateY(-1px)}
.stat-tile::before{content:'';position:absolute;top:0;left:0;right:0;height:2px}
.stat-tile.t-cyan::before{background:linear-gradient(90deg,var(--accent),transparent)}
.stat-tile.t-purple::before{background:linear-gradient(90deg,var(--accent2),transparent)}
.stat-tile.t-pink::before{background:linear-gradient(90deg,var(--accent3),transparent)}
.stat-tile.t-green::before{background:linear-gradient(90deg,var(--success),transparent)}
.stat-tile.t-warn::before{background:linear-gradient(90deg,var(--warn),transparent)}
.stat-tile .tile-label{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:10px}
.stat-tile .tile-val{font-family:var(--display);font-size:30px;font-weight:800;line-height:1;margin-bottom:4px}
.stat-tile .tile-sub{font-size:10px;color:var(--muted)}
.stat-tile .tile-icon{position:absolute;right:16px;top:50%;transform:translateY(-50%);font-size:26px;opacity:0.12}
.section-head{display:flex;align-items:center;gap:12px;margin-bottom:20px;padding-bottom:14px;border-bottom:1px solid var(--border)}
.section-icon{width:34px;height:34px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0}
.si-cyan{background:rgba(56,217,245,0.1);border:1px solid rgba(56,217,245,0.2)}
.si-purple{background:rgba(123,111,255,0.1);border:1px solid rgba(123,111,255,0.2)}
.si-green{background:rgba(61,255,160,0.1);border:1px solid rgba(61,255,160,0.2)}
.si-warn{background:rgba(255,179,71,0.1);border:1px solid rgba(255,179,71,0.2)}
.si-danger{background:rgba(255,95,109,0.1);border:1px solid rgba(255,95,109,0.2)}
.section-head h2{font-family:var(--display);font-size:16px;font-weight:700;letter-spacing:-0.2px}
.section-head p{font-size:11px;color:var(--muted);margin-top:1px}
.field{margin-bottom:15px}
.field label{display:block;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin-bottom:5px}
.field input,.field select,.field textarea{width:100%;background:var(--surface2);border:1px solid var(--border);
  border-radius:8px;color:var(--text);font-family:var(--mono);font-size:12px;
  padding:9px 13px;outline:none;transition:all 0.2s}
.field input:focus,.field select:focus,.field textarea:focus{
  border-color:rgba(56,217,245,0.4);box-shadow:0 0 0 3px rgba(56,217,245,0.06)}
.field input::placeholder,.field textarea::placeholder{color:var(--muted)}
.field select{appearance:none;cursor:pointer;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath fill='%235a6070' d='M5 6L0 0h10z'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 12px center;padding-right:30px}
.field select option{background:#1a1e26}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:0 18px}
.btn{display:inline-flex;align-items:center;gap:7px;padding:9px 16px;border-radius:8px;
  font-family:var(--mono);font-size:11px;cursor:pointer;border:1px solid transparent;
  transition:all 0.17s;text-decoration:none;letter-spacing:0.3px;white-space:nowrap}
.btn:disabled{opacity:0.45;cursor:not-allowed}
.btn-solid{background:linear-gradient(135deg,var(--accent2),var(--accent));color:#0a0c0f;
  font-weight:700;border-color:transparent}
.btn-solid:hover:not(:disabled){box-shadow:0 0 18px rgba(56,217,245,0.35);transform:translateY(-1px)}
.btn-ghost{background:var(--surface2);border-color:var(--border);color:var(--muted)}
.btn-ghost:hover:not(:disabled){border-color:var(--border-hi);color:var(--text)}
.btn-primary{background:rgba(56,217,245,0.1);border-color:rgba(56,217,245,0.25);color:var(--accent)}
.btn-danger{background:rgba(255,95,109,0.1);border-color:rgba(255,95,109,0.2);color:var(--danger)}
.btn-sm{padding:6px 12px;font-size:10px}
.table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;border-radius:10px;border:1px solid var(--border)}
table{width:100%;border-collapse:collapse;font-size:12px}
thead{background:var(--surface2)}
th{padding:11px 14px;text-align:left;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;
  color:var(--muted);font-weight:500;white-space:nowrap;border-bottom:1px solid var(--border)}
td{padding:11px 14px;border-bottom:1px solid var(--border);vertical-align:middle}
tr:last-child td{border-bottom:none}
tbody tr:hover{background:rgba(255,255,255,0.018)}
.td-muted{color:var(--muted)}
.badge{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:5px;
  font-size:10px;font-weight:500;letter-spacing:0.3px}
.badge::before{content:'';width:5px;height:5px;border-radius:50%;flex-shrink:0}
.badge-open{background:rgba(56,217,245,0.1);color:var(--accent)}.badge-open::before{background:var(--accent)}
.badge-hot{background:rgba(255,95,109,0.1);color:var(--danger)}.badge-hot::before{background:var(--danger)}
.badge-closed{background:rgba(61,255,160,0.1);color:var(--success)}.badge-closed::before{background:var(--success)}
.badge-lost{background:rgba(90,96,112,0.15);color:var(--muted)}.badge-lost::before{background:var(--muted)}
.badge-in{background:rgba(61,255,160,0.1);color:var(--success)}.badge-in::before{background:var(--success)}
.badge-out{background:rgba(255,95,109,0.1);color:var(--danger)}.badge-out::before{background:var(--danger)}
.badge-assigned{background:rgba(123,111,255,0.1);color:var(--accent2)}.badge-assigned::before{background:var(--accent2)}
.badge-available{background:rgba(56,217,245,0.1);color:var(--accent)}.badge-available::before{background:var(--accent)}
.badge-admin{background:rgba(255,126,179,0.1);color:var(--accent3)}.badge-admin::before{background:var(--accent3)}
.badge-sales{background:rgba(56,217,245,0.1);color:var(--accent)}.badge-sales::before{background:var(--accent)}
.badge-operations{background:rgba(123,111,255,0.1);color:var(--accent2)}.badge-operations::before{background:var(--accent2)}
.badge-management{background:rgba(61,255,160,0.1);color:var(--success)}.badge-management::before{background:var(--success)}
.divider{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);display:flex;align-items:center;gap:10px;margin:14px 0 6px}
.divider::after{content:'';flex:1;height:1px;background:var(--border)}
.empty-state{text-align:center;padding:48px 20px}
.empty-state .ei{font-size:30px;opacity:0.3;margin-bottom:10px}
.empty-state p{color:var(--muted);font-size:12px}
.error-banner{display:none;margin-top:12px;padding:11px 14px;background:rgba(255,95,109,0.08);border:1px solid rgba(255,95,109,0.3);border-radius:8px;color:var(--danger);font-size:11px}
.success-flash{display:none;margin-top:12px;padding:11px 14px;background:rgba(61,255,160,0.08);border:1px solid rgba(61,255,160,0.3);border-radius:8px;color:var(--success);font-size:11px}
.pill-group{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:16px}
.pill{padding:7px 14px;border-radius:100px;border:1px solid var(--border);background:var(--surface2);color:var(--muted);font-family:var(--mono);font-size:11px;cursor:pointer;transition:all 0.18s;letter-spacing:0.5px}
.pill:hover{color:var(--text);border-color:var(--border-hi)}
.pill.selected{background:rgba(56,217,245,0.1);border-color:rgba(56,217,245,0.4);color:var(--accent)}
.pill.p2.selected{background:rgba(123,111,255,0.1);border-color:rgba(123,111,255,0.4);color:var(--accent2)}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.fade-up{animation:fadeUp 0.3s ease}
@media(max-width:768px){
  :root{--nav-w:58px}
  .nav-logo .brand,.nav-logo .sub,.nav-label,.nav-user-info,.nav-logout,.nav-section{display:none}
  .nav-item{justify-content:center;padding:13px}
  .nav-user{justify-content:center;padding:10px}
  .crm-content{padding:18px 16px}
}
</style>`;

// ═══════════════════════════════════════════════════════════════
//  NAV
// ═══════════════════════════════════════════════════════════════
function crmNav(activePage) {
  const user = crmCurrentUser();
  if (!user) return;
  const allowed = CRM_PERMISSIONS[user.role] || [];
  const links = [
    { id:'dashboard', href:'dashboard.html',  icon:'⬡',  label:'Dashboard'  },
    { id:'customers', href:'customers.html',  icon:'👤', label:'Customers'  },
    { id:'tickets',   href:'tickets.html',    icon:'🎫', label:'Tickets'    },
    { id:'jolist',    href:'job_orders.html', icon:'📋', label:'Job Orders' },
    { id:'assets',    href:'assets.html',     icon:'🚗', label:'Assets'     },
    { id:'leads',     href:'leads.html',      icon:'🎯', label:'Sales Leads'},
    { id:'inventory', href:'inventory.html',  icon:'📦', label:'Inventory'  },
    { id:'users',     href:'users.html',      icon:'👥', label:'Users'      },
  ];
  const navHTML = `
  <nav class="crm-nav">
    <div class="nav-logo">
      <div class="brand">Fleet<span>CRM</span></div>
      <div class="sub">Operations Suite</div>
    </div>
    <div class="nav-links">
      <div class="nav-section">Navigation</div>
      ${links.map(l=>`
        <a href="${l.href}" class="nav-item${activePage===l.id?' active':''}${!allowed.includes(l.id)?' locked':''}">
          <span class="icon">${l.icon}</span>
          <span class="nav-label">${l.label}</span>
        </a>`).join('')}
    </div>
    <div class="nav-footer">
      <div class="nav-user">
        <div class="nav-avatar">${(user.avatar||user.name.slice(0,2)).toUpperCase()}</div>
        <div class="nav-user-info">
          <div class="uname">${user.name}</div>
          <div class="urole">${user.role}</div>
        </div>
        <button class="nav-logout" onclick="crmLogout()" title="Logout">⏻</button>
      </div>
    </div>
  </nav>`;
  document.body.insertAdjacentHTML('afterbegin', navHTML);
  const main = document.querySelector('.crm-main');
  if (main) { main.style.marginLeft='var(--nav-w)'; main.style.minHeight='100vh'; }
}

// ═══════════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════════
function startClock(el) {
  if (!el) return;
  const tick = () => el.textContent = new Date().toLocaleTimeString('en-PK',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  tick(); setInterval(tick, 1000);
}