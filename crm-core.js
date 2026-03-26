// ─────────────────────────────────────────────
//  CRM CORE  —  auth (JSON file), nav, shared helpers
//  v2 — users loaded from users.json at runtime
// ─────────────────────────────────────────────

// ✏️  PASTE YOUR GOOGLE APPS SCRIPT URL HERE
const CRM_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzgTZzFQUEldBlCzeqwEfNAYgrFobOdzzd9egyi5ghDcGqEqDk4M4vgyTqCyJpM1sZGEA/exec";

// ── Role permissions ──
const CRM_PERMISSIONS = {
  admin:      ["dashboard","leads","joborder","inventory","users"],
  sales:      ["dashboard","leads"],
  operations: ["dashboard","joborder","inventory"],
  management: ["dashboard","leads","joborder","inventory"],
};

// ────────────────────────────────────────────
//  AUTH — reads from users.json
// ────────────────────────────────────────────
async function crmLogin(username, password) {
  try {
    const res   = await fetch('users.json?_=' + Date.now(), { cache: 'no-store' });
    const json  = await res.json();
    const users = json.users || [];
    const user  = users.find(
      u => u.username === username.trim() &&
           u.password === password &&
           u.active   !== false
    );
    if (!user) return null;
    const safe = { id: user.id, username: user.username, name: user.name,
                   role: user.role, avatar: user.avatar };
    sessionStorage.setItem('crm_user', JSON.stringify(safe));
    return safe;
  } catch (err) {
    console.error('Auth error — could not load users.json:', err);
    return null;
  }
}

function crmLogout() {
  sessionStorage.removeItem('crm_user');
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

// ────────────────────────────────────────────
//  SHARED CSS
// ────────────────────────────────────────────
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
  background:var(--surface2);border-right:1px solid var(--border-hi);
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
.field input,.field select,.field textarea{width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:var(--mono);font-size:12px;padding:9px 13px;outline:none;transition:all 0.2s;appearance:none}
.field input:focus,.field select:focus,.field textarea:focus{border-color:rgba(56,217,245,0.4);background:rgba(56,217,245,0.03);box-shadow:0 0 0 3px rgba(56,217,245,0.07)}
.field textarea{height:80px;resize:none}
.field select{cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath fill='%235a6070' d='M5 6L0 0h10z'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 13px center;padding-right:34px}
.field select option{background:#1a1e26;color:var(--text)}
.field input::placeholder,.field textarea::placeholder{color:var(--muted)}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:0 18px}
.grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0 18px}
.col-span-2{grid-column:span 2}
.col-span-3{grid-column:span 3}
.btn{padding:9px 20px;border:none;border-radius:8px;font-family:var(--mono);font-size:11px;letter-spacing:1px;font-weight:500;cursor:pointer;transition:all 0.15s;text-transform:uppercase;display:inline-flex;align-items:center;gap:6px}
.btn-primary{background:linear-gradient(135deg,rgba(56,217,245,0.15),rgba(123,111,255,0.15));border:1px solid rgba(56,217,245,0.3);color:var(--accent)}
.btn-primary:hover{box-shadow:0 0 16px rgba(56,217,245,0.2);transform:translateY(-1px)}
.btn-solid{background:linear-gradient(135deg,#38d9f5,#7b6fff);color:#0a0c0f;font-weight:700;border:none}
.btn-solid:hover{box-shadow:0 0 18px rgba(56,217,245,0.35);transform:translateY(-1px)}
.btn-ghost{background:transparent;border:1px solid var(--border);color:var(--muted)}
.btn-ghost:hover{border-color:var(--border-hi);color:var(--text)}
.btn-danger{background:rgba(255,95,109,0.1);border:1px solid rgba(255,95,109,0.3);color:var(--danger)}
.btn-danger:hover{background:rgba(255,95,109,0.18)}
.btn-sm{padding:6px 13px;font-size:10px}
.btn:disabled{opacity:0.45;cursor:not-allowed;transform:none !important;box-shadow:none !important}
.table-wrap{overflow-x:auto;border:1px solid var(--border);border-radius:10px}
table{width:100%;border-collapse:collapse;font-size:12px}
thead tr{background:var(--surface2);border-bottom:1px solid var(--border)}
thead th{padding:11px 14px;text-align:left;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);white-space:nowrap}
tbody tr{border-bottom:1px solid var(--border);transition:background 0.12s}
tbody tr:last-child{border-bottom:none}
tbody tr:hover{background:rgba(255,255,255,0.02)}
tbody td{padding:12px 14px;color:var(--text)}
.td-muted{color:var(--muted)}
.badge{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:100px;font-size:10px;letter-spacing:0.8px;text-transform:uppercase}
.badge::before{content:'';width:4px;height:4px;border-radius:50%;flex-shrink:0}
.badge-new{background:rgba(56,217,245,0.1);color:var(--accent)}.badge-new::before{background:var(--accent)}
.badge-warm{background:rgba(255,179,71,0.1);color:var(--warn)}.badge-warm::before{background:var(--warn)}
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
@media(max-width:768px){ .crm-nav{ display:none; } }
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

// ────────────────────────────────────────────
//  NAV
// ────────────────────────────────────────────
function crmNav(activePage) {
  const user = crmCurrentUser();
  if (!user) return;
  const allowed = CRM_PERMISSIONS[user.role] || [];
  const links = [
    { id:'dashboard', href:'dashboard.html',        icon:'⬡',  label:'Dashboard'   },
    { id:'leads',     href:'sales_leads.html',       icon:'🎯', label:'Sales Leads' },
    { id:'joborder',  href:'vehicle_job_order.html', icon:'📋', label:'Job Orders'  },
    { id:'inventory', href:'inventory.html',         icon:'📦', label:'Inventory'   },
    { id:'users',     href:'users.html',             icon:'👥', label:'Users'       },
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
  if (main) { main.style.marginLeft = 'var(--nav-w)'; main.style.minHeight = '100vh'; }
}

// ────────────────────────────────────────────
//  UTILITIES
// ────────────────────────────────────────────
function startClock(el) {
  if (!el) return;
  const tick = () => el.textContent = new Date().toLocaleTimeString('en-PK',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  tick(); setInterval(tick, 1000);
}

// ────────────────────────────────────────────
//  NETWORK — POST and GET to Apps Script
//
//  Apps Script (deployed as "Anyone" access) supports CORS on
//  GET requests natively. For POST we send Content-Type: text/plain
//  which is a "simple" request and avoids a preflight — this lets
//  the browser read the response back without needing extra headers.
// ────────────────────────────────────────────

/**
 * POST data to Apps Script and return the parsed JSON response.
 * Using text/plain avoids CORS preflight while still being readable.
 */
async function crmPost(data) {
  if (!CRM_SCRIPT_URL || CRM_SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
    console.warn('CRM_SCRIPT_URL not set in crm-core.js');
    return { status: 'error', message: 'Script URL not configured' };
  }
  try {
    const res = await fetch(CRM_SCRIPT_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain' },   // simple request — no preflight
      body:    JSON.stringify(data),
      redirect: 'follow',
    });
    // Apps Script redirects to a /exec URL — follow it
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (err) {
    console.error('crmPost error:', err);
    throw err;
  }
}

/**
 * GET data from Apps Script and return the parsed JSON response.
 */
async function crmGet(params) {
  if (!CRM_SCRIPT_URL || CRM_SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
    console.warn('CRM_SCRIPT_URL not set in crm-core.js');
    return { error: 'Script URL not configured' };
  }
  try {
    const url = CRM_SCRIPT_URL + '?' + new URLSearchParams({
      ...params,
      _: Date.now()      // cache-bust
    }).toString();
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (err) {
    console.error('crmGet error:', err);
    throw err;
  }
}

async function loadUsersJson() {
  const res = await fetch('users.json?_=' + Date.now(), { cache: 'no-store' });
  return res.json();
}
