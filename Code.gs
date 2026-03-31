// ═══════════════════════════════════════════════════════════════
//  FleetCRM — Google Apps Script Backend  v3
//  ─────────────────────────────────────────────────────────────
//  SETUP:
//  1. Paste into Extensions → Apps Script, save
//  2. Run setupAllSheets() once (▶ Run button) to create tabs
//  3. Deploy → New Deployment → Web App
//     Execute as: Me  |  Who has access: Anyone
//  4. Copy the /exec URL into crm-core.js → CRM_SCRIPT_URL
// ═══════════════════════════════════════════════════════════════

// ── Tab names — edit here if yours differ ──────────────────────
const TABS = {
  LEADS:       "Sales Leads",
  JOB_ORDERS:  "Job Orders",
  CUSTOMERS:   "Customers",
  TRACKERS:    "Trackers",
  SIMS:        "SIMs",
  ASSIGNMENTS: "Assignments",
  CUSTOMERS:   "Customers",
};

// ── Column headers for each tab ────────────────────────────────
const HEADERS = {
  [TABS.LEADS]: [
    "leadId","dateForwarded","customerName","contact","city","email",
    "package","vehicles","budget","purchaseTimeline","preferredPayment","followUpDate",
    "status","installStatus",
    "paymentStatus","paymentMode","amountReceived","totalAmount","paymentDate",
    "lostReason","lostDate",
    "source","salesPerson","notes","submittedAt"
  ],
  [TABS.JOB_ORDERS]: [
    "date","invoiceNumber","customer","contact","rac","reference","city","area",
    "serviceCall","toc","sales","package","amc","payment","receipt","commitDate",
    "imei","serial","gsm","module","oldimei","oldserial","oldgsm","oldmodule",
    "vehicle","engine","chassis","make","model","color",
    "oldVehicle","oldEngine","oldChassis","oldMake","oldModel","oldColor",
    "oldCustomer","oldContact","oldRac","oldCnic",
    "testingOfficer","installer","prepack","postpack","cutoff",
    "smsType","fenceCity","deviceLocation","installArea","installCity",
    "username","password","smsNumber","smsPerson","verification","license",
    "name","user1","user2","user3","pcode","ecode","cnic","father",
    "email","address","disclaimer","submittedAt"
  ],
  [TABS.CUSTOMERS]: [
    "customerId","createdAt","customerName","company","rac","designation","industry",
    "contact","email","city","area","cnic","father","address",
    "preferredPayment","customerType","notes","totalJobs","lastJobDate"
  ],
  [TABS.TRACKERS]: [
    "entryId","imei","model","supplier","dateIn","qty","price",
    "notes","status","assignedTo","installer","city","enteredBy","lastUpdated"
  ],
  [TABS.SIMS]: [
    "entryId","simNumber","iccid","network","plan","qty",
    "dateIn","notes","status","installedIn","enteredBy","lastUpdated"
  ],
  [TABS.ASSIGNMENTS]: [
    "assignId","assignDate","trackerIMEI","simNumber",
    "vehicle","installer","city","notes","assignedBy","createdAt"
  ],
  [TABS.CUSTOMERS]: [
    "customerId","name","contact","email","cnic","father",
    "company","rac","designation","industry",
    "city","area","address","preferredPayment","customerType",
    "notes","createdBy","createdAt"
  ],
};

// ═══════════════════════════════════════════════════════════════
//  CORS HEADERS — added to every response so the browser
//  can actually read the reply from a local file/server
// ═══════════════════════════════════════════════════════════════
function addCors(output) {
  return output
    .setMimeType(ContentService.MimeType.JSON);
  // Note: Apps Script automatically adds CORS headers for
  // deployments set to "Anyone" access. If you still get CORS
  // errors, wrap your fetch in a jsonp callback or use a proxy.
}

// ═══════════════════════════════════════════════════════════════
//  doGet — all READ operations
// ═══════════════════════════════════════════════════════════════
function doGet(e) {
  try {
    const p      = e.parameter || {};
    const action = p.action || "";
    const tab    = p.tab    || "";
    let result;

    switch (action) {
      case "getLeads":
        result = getSheetData(TABS.LEADS);
        break;
      case "getJobOrders":
        result = getSheetData(TABS.JOB_ORDERS);
        break;
      case "getInventory":
        result = getInventoryData(tab);
        break;
      case "getAssignments":
        result = getSheetData(TABS.ASSIGNMENTS);
        break;
      case "getCustomers":
        result = getSheetData(TABS.CUSTOMERS);
        break;
      case "getDashboard":
        result = getDashboardStats();
        break;
      default:
        result = { error: "Unknown action: " + action };
    }

    return addCors(ContentService.createTextOutput(JSON.stringify(result)));
  } catch (err) {
    return addCors(ContentService.createTextOutput(
      JSON.stringify({ error: err.message, stack: err.stack })
    ));
  }
}

// ═══════════════════════════════════════════════════════════════
//  doPost — all WRITE operations
//  We do NOT use no-cors here — the script reads the body and
//  returns a proper JSON response the client can verify.
// ═══════════════════════════════════════════════════════════════
function doPost(e) {
  try {
    const raw    = e.postData ? e.postData.contents : "{}";
    const data   = JSON.parse(raw);
    const action = data.action   || "append";
    const tab    = data.sheetTab || "";
    let result;

    // Stamp every write with a server timestamp
    data.submittedAt = new Date().toISOString();

    switch (action) {
      case "submitLead":
        result = submitLead(data);
        break;
      case "submitJobOrder":
        result = submitJobOrder(data);
        break;
      case "stockIn":
        result = handleStockIn(data);
        break;
      case "stockOut":
        result = handleStockOut(data);
        break;
      case "assign":
        result = handleAssign(data);
        break;
      case "updateField":
        result = updateRowFields(data.sheetTab, data.keyField, data.keyValue, data.updates || {});
        break;
      case "submitCustomer":
        result = handleSubmitCustomer(data);
        break;
      case "updateCustomerStats":
        result = handleUpdateCustomerStats(data);
        break;
      case "assignInstaller":
        result = handleInstallerAssign(data);
        break;
      case "submitCustomer":
        result = appendRow(TABS.CUSTOMERS, data);
        break;
      default:
        // Generic fallback — appends to whatever tab is specified
        result = appendRow(tab, data);
    }

    return addCors(ContentService.createTextOutput(
      JSON.stringify({ status: "success", result })
    ));
  } catch (err) {
    return addCors(ContentService.createTextOutput(
      JSON.stringify({ status: "error", message: err.message })
    ));
  }
}

// ═══════════════════════════════════════════════════════════════
//  WRITE HANDLERS
// ═══════════════════════════════════════════════════════════════

/** Sales Lead submission */
function submitLead(data) {
  data.sheetTab = TABS.LEADS;
  if (!data.status) data.status = "New";
  if (!data.dateForwarded) data.dateForwarded = Utilities.formatDate(new Date(), "Asia/Karachi", "yyyy-MM-dd");
  return appendRow(TABS.LEADS, data);
}

/** Job Order submission — also auto-links to tracker if IMEI provided */
function submitJobOrder(data) {
  data.sheetTab = TABS.JOB_ORDERS;
  if (!data.date) data.date = Utilities.formatDate(new Date(), "Asia/Karachi", "yyyy-MM-dd");

  const result = appendRow(TABS.JOB_ORDERS, data);

  // If an IMEI was submitted, mark that tracker as Assigned
  if (data.imei && data.imei.trim()) {
    try {
      updateRowFields(TABS.TRACKERS, "imei", data.imei.trim(), {
        status:      "Assigned",
        assignedTo:  (data.vehicle || "") + (data.customer ? " / " + data.customer : ""),
        lastUpdated: data.submittedAt,
      });
    } catch (e) { /* tracker may not be in inventory yet — silently skip */ }
  }

  // If a GSM (SIM number) was submitted, mark that SIM as Installed
  if (data.gsm && data.gsm.trim()) {
    try {
      updateRowFields(TABS.SIMS, "simNumber", data.gsm.trim(), {
        status:      "Installed",
        installedIn: (data.imei || "") + (data.vehicle ? " / " + data.vehicle : ""),
        lastUpdated: data.submittedAt,
      });
    } catch (e) { /* SIM may not be in inventory yet — silently skip */ }
  }

  return result;
}

/** Stock In — add tracker or SIM to inventory */
function handleStockIn(data) {
  const tab = data.sheetTab;
  if (!data.status)      data.status      = "Available";
  if (!data.lastUpdated) data.lastUpdated  = data.submittedAt;
  if (!data.dateIn)      data.dateIn       = Utilities.formatDate(new Date(), "Asia/Karachi", "yyyy-MM-dd");
  return appendRow(tab, data);
}

/** Stock Out — mark row as Removed */
function handleStockOut(data) {
  const tab       = data.sheetTab;
  const id        = data.id;
  const sheet     = getSheet(tab);
  const values    = sheet.getDataRange().getValues();
  const headers   = values[0].map(String);
  const isTracker = tab === TABS.TRACKERS;
  const keyCol    = headers.indexOf(isTracker ? "imei" : "simNumber");
  const statusCol = headers.indexOf("status");
  const noteCol   = headers.indexOf("notes");
  const updCol    = headers.indexOf("lastUpdated");

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][keyCol]).trim() === String(id).trim()) {
      sheet.getRange(i + 1, statusCol + 1).setValue("Removed");
      if (updCol >= 0) sheet.getRange(i + 1, updCol + 1).setValue(data.submittedAt);
      const existing = sheet.getRange(i + 1, noteCol + 1).getValue();
      sheet.getRange(i + 1, noteCol + 1).setValue(
        (existing ? existing + " | " : "") +
        "Removed " + data.date + " by " + (data.removedBy || "system")
      );
      return { updated: id };
    }
  }
  return { warning: "Item not found in sheet: " + id };
}

/**
 * Assign SIM → Tracker
 * 1. Logs to Assignments tab
 * 2. Updates Tracker row → Assigned
 * 3. Updates SIM row → Installed
 */
function handleAssign(data) {
  if (!data.createdAt) data.createdAt = data.submittedAt;

  appendRow(TABS.ASSIGNMENTS, data);

  updateRowFields(TABS.TRACKERS, "imei", data.trackerIMEI, {
    status:      "Assigned",
    assignedTo:  data.simNumber + (data.vehicle ? " / " + data.vehicle : ""),
    installer:   data.installer || "",
    city:        data.city || "",
    lastUpdated: data.submittedAt,
  });

  updateRowFields(TABS.SIMS, "simNumber", data.simNumber, {
    status:      "Installed",
    installedIn: data.trackerIMEI + (data.vehicle ? " / " + data.vehicle : ""),
    lastUpdated: data.submittedAt,
  });

  return { assigned: data.trackerIMEI + " ↔ " + data.simNumber };
}

/**
 * Create or update a customer record
 */
function handleSubmitCustomer(data) {
  ensureHeaders(TABS.CUSTOMERS);
  const sheet   = getSheet(TABS.CUSTOMERS);
  const values  = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const idCol   = headers.indexOf("customerId");

  // Check if customer already exists by customerId
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(data.customerId)) {
      // Update existing row
      Object.entries(data).forEach(([k, v]) => {
        const col = headers.indexOf(k);
        if (col >= 0) sheet.getRange(i + 1, col + 1).setValue(v);
      });
      return { updated: data.customerId };
    }
  }
  // New customer — append
  return appendRow(TABS.CUSTOMERS, data);
}

/**
 * After a job order is submitted, increment customer job count + update lastJobDate
 */
function handleUpdateCustomerStats(data) {
  const sheet   = getSheet(TABS.CUSTOMERS);
  const values  = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const idCol   = headers.indexOf("customerId");
  const jobsCol = headers.indexOf("totalJobs");
  const dateCol = headers.indexOf("lastJobDate");

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(data.customerId)) {
      const cur = Number(values[i][jobsCol]) || 0;
      sheet.getRange(i + 1, jobsCol + 1).setValue(cur + 1);
      sheet.getRange(i + 1, dateCol + 1).setValue(data.jobDate || data.submittedAt);
      return { updated: data.customerId, totalJobs: cur + 1 };
    }
  }
  return { notFound: data.customerId };
}

/**
 * Assign an installer to a Job Order row
 */
function handleInstallerAssign(data) {
  return updateRowFields(TABS.JOB_ORDERS, "invoiceNumber", data.invoiceNumber, {
    installer:   data.installer || "",
    lastUpdated: data.submittedAt,
  });
}

// ═══════════════════════════════════════════════════════════════
//  READ HELPERS
// ═══════════════════════════════════════════════════════════════

function getSheetData(tabName) {
  const sheet  = getSheet(tabName);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return { data: [] };

  const headers = values[0].map(String);
  const data = values.slice(1)
    .filter(row => row.some(cell => String(cell).trim() !== ""))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        const cell = row[i];
        // Format dates nicely
        if (cell instanceof Date) {
          obj[h] = Utilities.formatDate(cell, "Asia/Karachi", "yyyy-MM-dd");
        } else {
          obj[h] = cell !== undefined && cell !== null ? String(cell) : "";
        }
      });
      return obj;
    });

  return { data };
}

function getInventoryData(tabName) {
  if (tabName !== TABS.TRACKERS && tabName !== TABS.SIMS) {
    return { error: "Invalid tab for inventory: " + tabName };
  }
  const res       = getSheetData(tabName);
  const items     = res.data || [];
  const isTracker = tabName === TABS.TRACKERS;

  const summary = {
    total:     items.length,
    available: items.filter(r => r.status === "Available").length,
    assigned:  items.filter(r => r.status === (isTracker ? "Assigned" : "Installed")).length,
    removed:   items.filter(r => r.status === "Removed").length,
    low:       items.filter(r => Number(r.qty) > 0 && Number(r.qty) < 3).length,
  };

  return { data: items, summary };
}

function getDashboardStats() {
  const leads    = getSheetData(TABS.LEADS).data    || [];
  const jobs     = getSheetData(TABS.JOB_ORDERS).data || [];
  const trackers = getInventoryData(TABS.TRACKERS);
  const sims     = getInventoryData(TABS.SIMS);

  // Lead status breakdown
  const leadsByStatus = {};
  leads.forEach(r => {
    const s = r.status || "New";
    leadsByStatus[s] = (leadsByStatus[s] || 0) + 1;
  });

  // Recent 5 job orders (newest first)
  const recentJobs = jobs.slice(-5).reverse().map(r => ({
    date:          r.date          || "",
    customer:      r.customer      || "",
    vehicle:       r.vehicle       || "",
    invoiceNumber: r.invoiceNumber || "",
    toc:           r.toc           || "",
  }));

  // Recent 5 leads
  const recentLeads = leads.slice(-5).reverse().map(r => ({
    customerName: r.customerName || "",
    status:       r.status       || "",
    salesPerson:  r.salesPerson  || "",
    dateForwarded:r.dateForwarded|| "",
  }));

  return {
    leads:       { total: leads.length, byStatus: leadsByStatus, recent: recentLeads },
    jobs:        { total: jobs.length,  recent: recentJobs },
    trackers:    trackers.summary || {},
    sims:        sims.summary     || {},
  };
}

// ═══════════════════════════════════════════════════════════════
//  SHEET UTILITIES
// ═══════════════════════════════════════════════════════════════

/** Append a row — maps data object keys onto header row columns */
function appendRow(tabName, data) {
  ensureHeaders(tabName);
  const sheet   = getSheet(tabName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const row     = headers.map(h => (data[h] !== undefined ? data[h] : ""));
  sheet.appendRow(row);
  // Auto-resize columns for readability
  try { sheet.autoResizeColumns(1, headers.length); } catch(e) {}
  return { tab: tabName, rowNumber: sheet.getLastRow() };
}

/** Find a row by key column value and update specific fields */
function updateRowFields(tabName, keyField, keyValue, updates) {
  const sheet   = getSheet(tabName);
  const values  = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const keyCol  = headers.indexOf(keyField);
  if (keyCol < 0) throw new Error("Key field not found: " + keyField + " in " + tabName);

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][keyCol]).trim() === String(keyValue).trim()) {
      Object.entries(updates).forEach(([field, val]) => {
        const col = headers.indexOf(field);
        if (col >= 0) sheet.getRange(i + 1, col + 1).setValue(val);
      });
      return { updated: keyValue, row: i + 1 };
    }
  }
  return { notFound: keyValue };
}

/** Get or create a sheet by name */
function getSheet(tabName) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(tabName);
  if (!sheet) throw new Error(
    'Sheet tab "' + tabName + '" not found. Run setupAllSheets() first.'
  );
  return sheet;
}

/** Write headers to Row 1 if the sheet is empty */
function ensureHeaders(tabName) {
  const defined = HEADERS[tabName];
  if (!defined) return;
  const sheet = getSheet(tabName);
  if (sheet.getRange(1, 1).getValue() === "") {
    const r = sheet.getRange(1, 1, 1, defined.length);
    r.setValues([defined]);
    r.setFontWeight("bold");
    r.setBackground("#1a1e26");
    r.setFontColor("#38d9f5");
    r.setFontSize(10);
    sheet.setFrozenRows(1);
  }
}

// ═══════════════════════════════════════════════════════════════
//  ONE-TIME SETUP — run manually once from the editor
// ═══════════════════════════════════════════════════════════════
function setupAllSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // CUSTOMERS tab needs special treatment — add it explicitly
  Object.values(TABS).forEach(tabName => {
    let sheet = ss.getSheetByName(tabName);
    if (!sheet) {
      sheet = ss.insertSheet(tabName);
      Logger.log("Created: " + tabName);
    }
    const headers = HEADERS[tabName];
    if (headers) {
      const r = sheet.getRange(1, 1, 1, headers.length);
      r.setValues([headers]);
      r.setFontWeight("bold");
      r.setBackground("#1a1e26");
      r.setFontColor("#38d9f5");
      r.setFontSize(10);
      sheet.setFrozenRows(1);
      sheet.autoResizeColumns(1, headers.length);
    }
  });

  SpreadsheetApp.getUi().alert(
    "✅ FleetCRM Setup Complete!\n\n" +
    "Tabs created/updated:\n  • " +
    Object.values(TABS).join("\n  • ") +
    "\n\nNext: Deploy → New Deployment → Web App\n" +
    "Execute as: Me  |  Access: Anyone"
  );
}

// ── TEST function — run from editor to verify everything works ──
function testScript() {
  Logger.log("=== FleetCRM Self-Test ===");
  try {
    const dash = getDashboardStats();
    Logger.log("Dashboard OK — Leads: " + dash.leads.total + ", Jobs: " + dash.jobs.total);
    Logger.log("Trackers available: " + dash.trackers.available);
    Logger.log("SIMs available: " + dash.sims.available);
    Logger.log("✅ All tabs accessible");
  } catch(e) {
    Logger.log("❌ Error: " + e.message);
    Logger.log("Run setupAllSheets() first if tabs are missing");
  }
}
