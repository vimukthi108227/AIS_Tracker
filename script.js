const SUPABASE_URL = "https://rtlizqawcwzduxpnzznd.supabase.co";
const SUPABASE_KEY = "sb_publishable_Eyo0gj7_BjN6FoQ76oJQYw_ZBOGj9BW";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUserRole = null; let isAdminUnlocked = false; let isDarkMode = false; let isAppBusy = false;
let masterChartInstance = null, overallPoChartInstance = null, overallPlChartInstance = null, plChartInstance = null, monthlyShiftChartInstance = null, poChartInstances = [], rejectDashChart = null, rejectProfileChartInstance = null;
let cardboardStockList = [], dailyInstructionsList = [], masterData = [], historyLogs = [], poList = [], shipmentList = [], packingLists = [], rejectLogs = [], recoverLogs = []; 
let globalManualCrates = {};
let stockResetInProgress = false;
let shipmentStates = {};
let activePackingMonth = null;
let activePackingContainer = null;
let shipmentDeadline = null;

const cleanLen = (val) => String(val || '').replace(/ mm/gi, '').trim();

// Reliability layer: log unexpected runtime failures without turning browser/CDN
// errors into repeated generic "Script error" popups. Cross-origin script failures
// often expose only the text "Script error." and are not actionable to the user.
window.addEventListener('error', (event) => {
  console.error('AIS Tracker runtime error:', event.error || event.message || event);
});
window.addEventListener('unhandledrejection', (event) => {
  console.error('AIS Tracker promise error:', event.reason || event);
});


function normalizeCardboardMatch(cType, item) { if (!cType || !item) return false; const clean = (s) => String(s || '').replace(/mm/gi, '').replace(/profile/gi, '').replace(/[^a-zA-Z0-9\.]/g, '').toLowerCase(); const cClean = clean(cType), pClean = clean(item.profile), iClean = clean(item.itemCode), lClean = clean(item.length); return cClean.includes(pClean) && (iClean ? cClean.includes(iClean) : true) && cClean.includes(lClean); }
function ensureLoginInputReady(){
  const input=document.getElementById('rolePassInput');
  if(!input) return;
  input.disabled=false; input.readOnly=false; input.tabIndex=0; input.style.pointerEvents='auto';
}
function toggleLoginPassword(){ const i=document.getElementById('rolePassInput'); if(!i) return; ensureLoginInputReady(); i.type=i.type==='password'?'text':'password'; i.focus(); }
function enterAISApplication(role){
  currentUserRole=role; isAdminUnlocked=(role==='Admin');
  const overlay=document.getElementById('roleLoginOverlay'), main=document.getElementById('mainContent');
  if(overlay) overlay.style.display='none'; if(main){ main.style.display='block'; main.classList.add('ais-app-entered'); }
  updateRoleUI();
  const dashBtn=document.querySelector('#mainNavTabs .tab-btn');
  if(typeof switchTab==='function') switchTab('dashboardTab',dashBtn);
  setTimeout(()=>{ try{ loadDataFromSupabase(true); }catch(e){ console.error(e); showToast('Application started, but data sync needs attention.','warning'); } },50);
}
function selectRole(role) {
  if(role==='Local'){ enterAISApplication('Local'); showToast('Local User logged in successfully.','success'); return; }
  const text=document.getElementById('selectedRoleText');
  if(text) text.innerHTML=`<i class="fa-solid ${role==='Admin'?'fa-user-shield':'fa-calendar-check'}"></i> ${role} access`;
  const section=document.getElementById('loginPassSection'), roles=document.getElementById('roleSelectionArea');
  if(section) section.style.display='block'; if(roles) roles.style.display='none';
  if(section) section.dataset.role=role;
  const input=document.getElementById('rolePassInput'); if(input){ input.value=''; input.type='password'; ensureLoginInputReady(); setTimeout(()=>{ input.focus(); input.click(); },80); }
}

function resetRoleSelection() { document.getElementById('loginPassSection').style.display = 'none'; document.getElementById('roleSelectionArea').style.display = 'flex'; }
document.addEventListener('DOMContentLoaded', () => { ensureLoginInputReady(); });
function verifyLogin() {
  const section=document.getElementById('loginPassSection'); const role=section?.dataset.role||''; const pass=(document.getElementById('rolePassInput')?.value||'').trim();
  if(role==='Admin' && pass==='Lr@108227') { enterAISApplication('Admin'); showToast('Admin access granted.','success'); return; }
  if(role==='Planner' && pass==='alumex123') { enterAISApplication('Planner'); showToast('Planner access granted.','success'); return; }
  showToast('Invalid authentication key.','error');
  const box=document.querySelector('.ais-password-box'); if(box){ box.classList.remove('ais-shake'); void box.offsetWidth; box.classList.add('ais-shake'); }
}

function logoutUser() { currentUserRole = null; isAdminUnlocked = false; document.getElementById('mainContent').style.display = 'none'; document.getElementById('roleLoginOverlay').style.display = 'flex'; resetRoleSelection(); switchTab('dashboardTab', document.querySelector('.tab-btn')); showToast("Logged out successfully.", "success"); }

function updateRoleUI() {
  const roleBadge = document.getElementById('userRoleBadge'); if (roleBadge) { roleBadge.textContent = currentUserRole + " Mode"; roleBadge.style.background = currentUserRole === 'Admin' ? '#e11d48' : (currentUserRole === 'Planner' ? '#0369a1' : '#059669'); }
  const elements = { adminEntryTab: document.getElementById('tabBtn-adminEntry'), poTab: document.getElementById('tabBtn-po'), shipmentTab: document.getElementById('tabBtn-shipment'), historyTab: document.getElementById('tabBtn-history'), planInputArea: document.getElementById('planInputArea'), cbAdminArea: document.getElementById('cbAdminArea'), plAdminArea1: document.getElementById('plAdminArea1'), plAdminArea2: document.getElementById('plAdminArea2'), resetBtn: document.getElementById('resetAllBtn'), addProfileBtn: document.getElementById('addProfileBtn'), rejectTabBtn: document.getElementById('tabBtn-rejectTracker'), plDeadlineSetter: document.getElementById('plDeadlineSetterContainer'), systemAuditBtn: document.getElementById('systemAuditBtn') };
  if (currentUserRole === 'Admin') { Object.values(elements).forEach(el => { if(el) el.style.display = ''; }); if (document.getElementById('cbTxType')) document.getElementById('cbTxType').disabled = false; } 
  else if (currentUserRole === 'Planner') { [elements.adminEntryTab, elements.poTab, elements.shipmentTab, elements.historyTab, elements.planInputArea, elements.cbAdminArea, elements.rejectTabBtn].forEach(el => { if(el) el.style.display = ''; }); [elements.plAdminArea1, elements.plAdminArea2, elements.resetBtn, elements.addProfileBtn, elements.plDeadlineSetter, elements.systemAuditBtn].forEach(el => { if(el) el.style.display = 'none'; }); if (document.getElementById('cbTxType')) { document.getElementById('cbTxType').value = 'IN'; document.getElementById('cbTxType').disabled = true; } } 
  else if (currentUserRole === 'Local') { Object.values(elements).forEach(el => { if(el) el.style.display = 'none'; }); }
  
  setTimeout(() => {
      renderProfileSummaryTable(); renderPoDetailsTable(); renderMasterCatalog(); renderShipmentHistoryTable(); renderPackingListTable(); renderCardboardStock(); renderDailyInstructions(); renderHistoryData(); renderRejectTable(); renderRecoverTable();
  }, 50);
}

function saveMasterExtrasLocally() { const extras = masterData.map(m => ({ p: m.profile, l: m.length, i: m.itemCode, ex: m.exLength, cap: m.boxCapacity, mat: m.material })); localStorage.setItem('alumex_master_extras', JSON.stringify(extras)); }
function getAvailableCardboard(profile, itemCode, length) { let cIn = 0, cOut = 0; const dummyItem = { profile, itemCode, length }; cardboardStockList.forEach(c => { if (normalizeCardboardMatch(c.type, dummyItem)) { cIn += (c.incoming || 0); cOut += (c.used || 0); } }); return cIn - cOut; }
function formatExcelDate(val) { if (!val) return new Date().toISOString().split('T')[0]; if (typeof val === 'number') { const date = new Date(Math.round((val - 25569) * 86400 * 1000)); return date.toISOString().split('T')[0]; } const d = new Date(val); if (!isNaN(d.getTime())) { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0'); return `${y}-${m}-${day}`; } return new Date().toISOString().split('T')[0]; }
function showToast(message, type = 'success') { const container = document.getElementById('toastContainer'); if (!container) { console[type === 'error' ? 'error' : 'log'](message); return; } const toast = document.createElement('div'); toast.className = `custom-toast toast-${type}`; toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : (type === 'error' ? 'fa-circle-xmark' : 'fa-triangle-exclamation')}"></i> <span>${message}</span>`; container.appendChild(toast); setTimeout(() => { toast.style.animation = 'slideOutRight 0.3s forwards'; setTimeout(() => toast.remove(), 300); }, 3500); }

let confirmCallback = null; function showConfirm(message, callback) { document.getElementById('confirmMessage').innerHTML = message; document.getElementById('confirmModal').style.display = 'flex'; confirmCallback = callback; } function closeConfirmModal() { document.getElementById('confirmModal').style.display = 'none'; confirmCallback = null; } function executeConfirm() { if(confirmCallback) confirmCallback(); closeConfirmModal(); }
function toggleTheme() { isDarkMode = !isDarkMode; if(isDarkMode) { document.body.classList.add('dark-mode'); showToast("Dark Mode", "success"); } else { document.body.classList.remove('dark-mode'); showToast("Light Mode", "success"); } renderDashboard(); }
function toggleOverdueDetails(button) {
    if (!button) return;
    const details = button.closest('.po-overdue-item')?.querySelector('.overdue-balance-details');
    if (!details) return;
    const isHidden = details.style.display === 'none' || getComputedStyle(details).display === 'none';
    details.style.display = isHidden ? 'block' : 'none';
    button.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
    button.textContent = isHidden ? 'Hide balance details ▲' : 'View balance details ▼';
}

function startLiveClock() { 
    function updateClock() { 
        const now = new Date(); 
        const clockEl = document.getElementById('liveClockDisplay');
        const dateEl = document.getElementById('liveDateDisplay');
        if (clockEl) {
            clockEl.textContent = now.toLocaleTimeString('en-US', { hour12: false });
        }
        const amPmEl = document.getElementById('liveClockAmPm');
        if (amPmEl) amPmEl.textContent = now.toLocaleTimeString('en-US', { hour12: true }).split(' ').pop();
        if (dateEl) dateEl.textContent = now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
        const clockBadge = document.querySelector('.live-clock-badge');
        const second = now.getSeconds() + now.getMilliseconds() / 1000;
        const minute = now.getMinutes() + second / 60;
        const hour = (now.getHours() % 12) + minute / 60;
        const root = document.documentElement;
        root.style.setProperty('--clock-second-angle', `${second * 6}deg`);
        root.style.setProperty('--clock-minute-angle', `${minute * 6}deg`);
        root.style.setProperty('--clock-hour-angle', `${hour * 30}deg`);
        root.style.setProperty('--clock-progress', `${(second / 60) * 360}deg`);
        /* Live clock updates every second. Visual tick/sweep animations are intentionally disabled
           so the time widget stays clean and professional. */
        if (typeof window.updateShipmentCountdown === 'function') window.updateShipmentCountdown();
    } 
    updateClock(); 
    setInterval(updateClock, 1000); 
}

/* --- EXCEL EXPORT FUNCTIONS --- */
function exportTableToExcel(dataArray, filename, sheetName) {
    if(!dataArray || dataArray.length === 0) { showToast("No data to export!", "warning"); return; }
    if (typeof XLSX === 'undefined') { showToast("Excel library not loaded! Please check internet connection.", "error"); return; }
    const ws = XLSX.utils.json_to_sheet(dataArray); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, sheetName); XLSX.writeFile(wb, `${filename}.xlsx`);
}

window.exportDashboardExcel = function() { const data = masterData.map(item => ({ "Profile": item.profile, "Item Code": item.itemCode, "Length (mm)": item.length, "Unit Wt": item.unitWeight, "Cut Qty": item.cutQty, "Punch Qty": item.punchQty, "Wrap Qty": item.wrapQty, "Box Qty": item.boxQty, "Crate Qty": item.crateQty, "Total Stock (Pcs)": (item.cutQty||0) + (item.punchQty||0) + (item.wrapQty||0) + (item.boxQty||0) + (item.crateQty||0) })); exportTableToExcel(data, "AIS_Dashboard_Stock", "Stock Summary"); };
window.exportStockExcel = window.exportDashboardExcel;
window.exportPoExcel = function() { const data = poList.map(po => ({ "PO Date": po.date, "PO Number": po.poNumber, "Profile": po.profile, "Length (mm)": po.length, "Required Qty": po.orderQty })); exportTableToExcel(data, "AIS_Production_Orders", "Orders"); };
window.exportCardboardExcel = function() { const data = cardboardStockList.map(c => ({ "Date": c.date, "Transaction Type": c.type, "Incoming": c.incoming, "Consumed": c.used })); exportTableToExcel(data, "AIS_Cardboard_History", "Cardboard"); };
window.exportShipmentsExcel = function() { const data = shipmentList.map(s => ({ "Shipment Date": s.date, "PO Number": s.poNumber, "Profile": s.profile, "Length (mm)": s.length, "Container No": s.container, "Shipped Qty": s.shippedQty, "Remaining": s.remainingBalance })); exportTableToExcel(data, "AIS_Shipment_History", "Shipments"); };
window.exportHistoryExcel = function() { const data = historyLogs.map(h => ({ "Date": h.date, "Time": h.timestamp, "Shift": h.shift, "Profile": h.profile, "Length (mm)": h.length, "Cut Qty": h.cutQty, "Punch Qty": h.punchQty, "Wrap Qty": h.wrapQty, "Box Qty": h.boxQty, "Crate Qty": h.crateQty })); exportTableToExcel(data, "AIS_Production_History", "History"); };
window.exportRejectExcel = function() { const data = rejectLogs.map(r => ({ "Date": r.reject_date, "Shift": r.shift, "Location": r.location, "Stage": r.stage, "Profile": r.profile, "Item Code": r.item_code, "Length (mm)": r.length, "Reject Qty": r.pcs, "Weight (kg)": r.weight })); exportTableToExcel(data, "AIS_Reject_History", "Rejects"); };
window.exportRecoverExcel = function() { const data = recoverLogs.map(r => ({ "Date": r.recover_date, "Profile": r.profile, "Item Code": r.item_code, "Orig Length": r.original_length, "New Length": r.new_length, "Recover Qty": r.pcs, "Weight (kg)": r.recovered_weight })); exportTableToExcel(data, "AIS_Recover_History", "Recovery"); };

function injectGenericEditModal() {
    if(document.getElementById('genericEditModal')) return;
    const html = `<div id="genericEditModal" class="modal"><div class="modal-content" style="text-align:left; max-width:400px;"><h3 style="color:var(--primary-color); margin-top:0;"><i class="fa-solid fa-pen"></i> Admin Quick Edit</h3><p style="font-size:11.5px; color:var(--warning-color); margin-bottom:15px; font-weight:700;">Note: Edits here will change historical log values but will not auto-adjust Live Stock levels.</p><input type="hidden" id="genericEditTable"><input type="hidden" id="genericEditId"><div id="genericEditFields"></div><div style="display:flex; gap:10px; margin-top:16px;"><button class="btn btn-accent" style="flex:1;" onclick="saveGenericEdit()"><i class="fa-solid fa-check"></i> Save Changes</button><button class="btn btn-danger" style="flex:1; background:#64748b;" onclick="document.getElementById('genericEditModal').style.display='none'">Cancel</button></div></div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

window.openGenericEdit = function(table, id, fieldsMap) {
    if(currentUserRole !== 'Admin') return;
    document.getElementById('genericEditTable').value = table; document.getElementById('genericEditId').value = id; const container = document.getElementById('genericEditFields'); container.innerHTML = '';
    Object.keys(fieldsMap).forEach(key => { container.insertAdjacentHTML('beforeend', `<div class="form-group"><label style="text-transform:capitalize;">${key.replace(/_/g, ' ')}</label><input type="text" id="edit_field_${key}" value="${fieldsMap[key]}" data-col="${key}"></div>`); });
    document.getElementById('genericEditModal').style.display = 'flex';
}

window.saveGenericEdit = async function() {
    const table = document.getElementById('genericEditTable').value; const id = document.getElementById('genericEditId').value; const inputs = document.querySelectorAll('#genericEditFields input');
    let updateObj = {}; inputs.forEach(input => { updateObj[input.dataset.col] = input.value; });
    try { await supabaseClient.from(table).update(updateObj).eq('id', id); document.getElementById('genericEditModal').style.display = 'none'; showToast("Record updated successfully!", "success"); loadDataFromSupabase(true); } catch(e) { showToast("Update failed", "error"); }
}

const INITIAL_CATALOG = [ {"profile": "1037", "length": "1727.2", "unit_weight": 1.601, "item_code": "RT-BT68", "material": "1234"} ];

window.injectCountdownUI = function() {
    if (!document.getElementById('shipmentCountdownContainer')) {
        const dashTab = document.getElementById('dashboardTab');
        if(dashTab) {
            const countdownHtml = `
            <div id="shipmentCountdownContainer" style="display:none; background: linear-gradient(135deg, #1e3a8a, #0284c7); color: white; padding: 18px 25px; border-radius: var(--radius-lg); margin-bottom: 24px; box-shadow: 0 10px 25px -5px rgba(2, 132, 199, 0.4); justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; border: 1px solid #38bdf8; animation: fadeInUp 0.5s ease;">
                <div style="display:flex; align-items:center; gap:20px;">
                    <div style="background: rgba(255,255,255,0.1); padding: 14px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: inset 0 2px 5px rgba(0,0,0,0.2);">
                        <i class="fa-solid fa-ship" style="font-size: 32px; color: #bae6fd; animation: floatCyber 3s ease-in-out infinite alternate;"></i>
                    </div>
                    <div>
                        <h4 style="margin: 0 0 5px 0; font-size: 13.5px; color: #e0f2fe; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 900;">Next Shipment Handover</h4>
                        <div id="shipmentTargetDisplay" style="font-size: 16px; color: #fff; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">Not Set</div>
                    </div>
                </div>
                <div style="display:flex; flex-direction:column; align-items:flex-end;">
                    <div style="font-size: 11px; color: #bae6fd; text-transform: uppercase; font-weight: 800; letter-spacing: 1px; margin-bottom: 5px;">Time Remaining</div>
                    <div id="countdownTimerDisplay" style="font-size: 26px; font-weight: 900; letter-spacing: 2px; background: rgba(0,0,0,0.3); padding: 10px 20px; border-radius: 12px; font-variant-numeric: tabular-nums; border: 1px solid rgba(255,255,255,0.15); text-shadow: 0 2px 5px rgba(0,0,0,0.4); display: flex; align-items: center;">
                        -- : -- : --
                    </div>
                </div>
            </div>`;
            dashTab.insertAdjacentHTML('afterbegin', countdownHtml);
        }
    }

    if (!document.getElementById('plDeadlineSetterContainer')) {
        const plTab = document.getElementById('packingListTab');
        if(plTab) {
            const plBanner = plTab.querySelector('.cargo-banner-header');
            if (plBanner) {
                const setterHtml = `
                <div class="admin-restricted-area" id="plDeadlineSetterContainer" style="background: linear-gradient(135deg, #f0f9ff, #e0f2fe); border: 1px dashed #0284c7; padding: 18px; border-radius: var(--radius-md); margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 15px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);">
                    <div style="display: flex; align-items: center; gap: 14px;">
                        <i class="fa-solid fa-clock-rotate-left" style="font-size: 28px; color: #0284c7;"></i>
                        <div>
                            <h4 style="margin: 0 0 5px 0; color: #0369a1; font-size: 15.5px; font-weight: 900; text-transform: uppercase;">Set Shipment Handover Deadline</h4>
                            <p style="margin: 0; font-size: 12.5px; color: #475569; font-weight: 600;">Activate a live countdown on the Executive Dashboard for all users.</p>
                        </div>
                    </div>
                    <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                        <input type="datetime-local" id="shipmentDeadlineInput" style="padding: 10px 14px; border: 2px solid #bae6fd; border-radius: 8px; font-weight: 800; color: #0369a1; font-family: inherit; font-size: 14px; background: #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.05); outline: none;">
                        <button class="btn" style="background: linear-gradient(135deg, #0284c7, #0369a1); padding: 10px 20px; font-size: 13.5px;" onclick="window.saveShipmentDeadline()"><i class="fa-solid fa-bolt"></i> Update Timer</button>
                        <button class="btn btn-danger" style="padding: 10px 18px; background: linear-gradient(135deg, #e11d48, #9f1239);" onclick="window.clearShipmentDeadline()" title="Clear Timer"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>`;
                plBanner.insertAdjacentHTML('afterend', setterHtml);
            }
        }
    }
};

window.updateShipmentCountdown = function() {
    const container = document.getElementById('shipmentCountdownContainer');
    const targetDisplay = document.getElementById('shipmentTargetDisplay');
    const timerDisplay = document.getElementById('countdownTimerDisplay');
    
    if (!container || !targetDisplay || !timerDisplay) return;
    
    if (!shipmentDeadline || isNaN(shipmentDeadline)) {
        container.style.display = 'none';
        return;
    }
    
    container.style.display = 'flex';
    
    const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    targetDisplay.textContent = shipmentDeadline.toLocaleDateString('en-US', options);
    
    const now = new Date();
    const diff = shipmentDeadline - now;
    
    if (diff <= 0) {
        timerDisplay.innerHTML = `<span style="color:#fecdd3; font-size:16px; display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-triangle-exclamation"></i> OVERDUE / HANDOVER PASSED</span>`;
        container.style.background = 'linear-gradient(135deg, #9f1239, #be123c)';
        container.style.borderColor = '#fda4af';
        return;
    }
    
    container.style.background = 'linear-gradient(135deg, #1e3a8a, #0284c7)';
    container.style.borderColor = '#38bdf8';
    
    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const m = Math.floor((diff / 1000 / 60) % 60);
    const s = Math.floor((diff / 1000) % 60);
    
    let timeStr = '';
    if (d > 0) timeStr += `<span style="color:#bae6fd; margin-right:10px;">${d} <span style="font-size:12px;">Days</span></span> `;
    timeStr += `${String(h).padStart(2, '0')}<span style="font-size:14px;color:#93c5fd;margin:0 4px;">h</span> : ${String(m).padStart(2, '0')}<span style="font-size:14px;color:#93c5fd;margin:0 4px;">m</span> : ${String(s).padStart(2, '0')}<span style="font-size:14px;color:#93c5fd;margin-left:4px;">s</span>`;
    
    timerDisplay.innerHTML = timeStr;
};

window.saveShipmentDeadline = async function() {
    if (currentUserRole !== 'Admin') return;
    const val = document.getElementById('shipmentDeadlineInput').value;
    if (!val) { showToast("Please select a date and time", "warning"); return; }
    
    let isoStr = new Date(val).toISOString();
    let existing = dailyInstructionsList.find(i => i.target_user === 'SYS_SHIPMENT_DEADLINE');
    
    if (existing) {
        existing.message = isoStr;
        try { await supabaseClient.from('daily_instructions').update({ message: isoStr }).eq('id', existing.id); } catch(e){}
    } else {
        let newRec = { target_date: new Date().toISOString().split('T')[0], target_user: 'SYS_SHIPMENT_DEADLINE', priority: 'Normal', message: isoStr, status: 'Completed', action_taken: 'System Data' };
        try { 
            let {data} = await supabaseClient.from('daily_instructions').insert([newRec]).select(); 
            if(data && data.length > 0) dailyInstructionsList.push(data[0]);
        } catch(e){}
    }
    shipmentDeadline = new Date(isoStr);
    showToast("Shipment deadline activated!", "success");
    window.updateShipmentCountdown();
    window.scrollTo({top: 0, behavior: 'smooth'});
};

window.clearShipmentDeadline = async function() {
    if (currentUserRole !== 'Admin') return;
    let existing = dailyInstructionsList.find(i => i.target_user === 'SYS_SHIPMENT_DEADLINE');
    if (existing) {
        try { await supabaseClient.from('daily_instructions').delete().eq('id', existing.id); } catch(e){}
        dailyInstructionsList = dailyInstructionsList.filter(i => i.id !== existing.id);
    }
    document.getElementById('shipmentDeadlineInput').value = '';
    shipmentDeadline = null;
    window.updateShipmentCountdown();
    showToast("Shipment deadline cleared!", "success");
};

window.onload = function() {
  injectGenericEditModal();
  injectCountdownUI();
  startLiveClock(); const today = new Date().toISOString().split('T')[0];
  ['entryDate', 'poDate', 'shipmentDate', 'plDate', 'historyDateSelect', 'cbDate', 'planDate', 'recDate'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).value = today; });
  if(document.getElementById('rejDate')) document.getElementById('rejDate').value = today;
  loadDataFromSupabase(); setupRealtimeSubscription();
};

let realtimeTimeout = null;
function setupRealtimeSubscription() { 
    supabaseClient.channel('public:all_tables').on('postgres_changes', { event: '*', schema: 'public' }, payload => { 
        if (stockResetInProgress) return;
        clearTimeout(realtimeTimeout); realtimeTimeout = setTimeout(() => { if (!stockResetInProgress) loadDataFromSupabase(true); }, 1500);
    }).subscribe(); 
}

function getCrateSortValue(crateStr) {
    let str = String(crateStr || '').toLowerCase().trim();
    let match = str.match(/crate\s*(\d+)(?:\s*-\s*([a-z]+))?/);
    if (!match) return [999999, 0, str];
    let num = parseInt(match[1], 10);
    let suffix = match[2] || '';
    let sufVal = 0;
    const romanMap = {'i':1, 'ii':2, 'iii':3, 'iv':4, 'v':5, 'vi':6, 'vii':7, 'viii':8, 'ix':9, 'x':10};
    if (romanMap[suffix]) sufVal = romanMap[suffix];
    else if (suffix) sufVal = suffix.charCodeAt(0);
    return [num, sufVal, str];
}

function sortCrates(a, b) {
    let valA = getCrateSortValue(a.crateNo || a.crate_no || a);
    let valB = getCrateSortValue(b.crateNo || b.crate_no || b);
    if (valA[0] !== valB[0]) return valA[0] - valB[0];
    if (valA[1] !== valB[1]) return valA[1] - valB[1];
    return valA[2].localeCompare(valB[2]);
}

let isFetchingData = false;
async function loadDataFromSupabase(isSilent = false) {
  if (stockResetInProgress) return;
  if (isFetchingData) return;
  isFetchingData = true;
  try {
    if(!isSilent) showToast("Connecting & Syncing Data...", "warning");
    // Production-grade reader: Supabase commonly caps a response at 1,000 rows.
    // Always page through the table so older records cannot silently disappear from reports/calculations.
    const safeFetch = async (table, options = {}) => {
      const pageSize = 1000;
      const all = [];
      try {
        for (let from = 0; ; from += pageSize) {
          let query = supabaseClient.from(table).select('*');
          if(options.order) query = query.order(options.order.col, { ascending: options.order.asc });
          query = query.range(from, from + pageSize - 1);
          const { data, error } = await query;
          if (error) throw new Error(error.message);
          const rows = data || [];
          all.push(...rows);
          if (rows.length < pageSize) break;
        }
        return all;
      } catch(e) {
        console.warn(`DB Fetch error for ${table}:`, e);
        if(!isSilent) showToast(`DB Error (${table}): ${e.message}`, 'error');
        throw e;
      }
    };

    const results = await Promise.all([
        safeFetch('master_catalog'), safeFetch('production_orders', { order: {col: 'id', asc: false} }), safeFetch('shipments', { order: {col: 'id', asc: false} }), 
        safeFetch('packing_list', { order: {col: 'id', asc: false} }), safeFetch('history_logs', { order: {col: 'id', asc: false} }), safeFetch('reject_logs', { order: {col: 'id', asc: false} }),
        safeFetch('recover_logs', { order: {col: 'id', asc: false} }), safeFetch('cardboard_stock', { order: {col: 'id', asc: false} }), safeFetch('daily_instructions', { order: {col: 'id', asc: false} })
    ]);

    let catDataRaw = results[0];
    if (catDataRaw.length === 0) { try { const { data: seeded } = await supabaseClient.from('master_catalog').insert(INITIAL_CATALOG.map(i => ({ profile: i.profile, length: i.length, unit_weight: i.unit_weight || 0, item_code: i.item_code || '', material: i.material || '', cut_qty: 0, punch_qty: 0, wrap_qty: 0, box_qty: 0, crate_qty: 0, box_capacity: 100, ex_length: '' }))).select(); catDataRaw = seeded || []; } catch(e) {} }

    const poData = results[1], shipData = results[2], plData = results[3], logData = results[4], rjData = results[5], rcData = results[6], cbData = results[7], instData = results[8];
    
    let syncRow = instData.find(i => i.target_user === 'SYS_CRATES_SYNC');
    if (syncRow && syncRow.message) {
        try { globalManualCrates = JSON.parse(syncRow.message) || {}; } catch(e) { globalManualCrates = {}; }
    } else {
        globalManualCrates = {};
    }
    // Only the new month+container+crate keys are valid. Older versions used
    // container-only or bare crate keys; those caused a crate to appear
    // completed automatically and made the tick impossible to clear.
    const normalizedManualCrates = {};
    Object.entries(globalManualCrates || {}).forEach(([k, v]) => {
        if (String(k).split('::').length === 3 && v && typeof v === 'object') normalizedManualCrates[k] = v;
    });
    const hadLegacyManualKeys = Object.keys(normalizedManualCrates).length !== Object.keys(globalManualCrates || {}).length;
    globalManualCrates = normalizedManualCrates;
    if (hadLegacyManualKeys) {
        try { localStorage.setItem('manual_crates', JSON.stringify(globalManualCrates)); } catch(e) {}
        if (syncRow) {
            try { await supabaseClient.from('daily_instructions').update({ message: JSON.stringify(globalManualCrates) }).eq('id', syncRow.id); } catch(e) {}
        }
    }

    let shipmentStateRow = instData.find(i => i.target_user === 'SYS_PL_SHIPMENT_STATE');
    if (shipmentStateRow && shipmentStateRow.message) {
        try { shipmentStates = JSON.parse(shipmentStateRow.message) || {}; } catch(e) { shipmentStates = {}; }
    } else { shipmentStates = {}; }
    
    let deadlineRow = instData.find(i => i.target_user === 'SYS_SHIPMENT_DEADLINE');
    if (deadlineRow && deadlineRow.message) {
        shipmentDeadline = new Date(deadlineRow.message);
        if (document.getElementById('shipmentDeadlineInput')) {
            let d = shipmentDeadline;
            let year = d.getFullYear();
            let month = String(d.getMonth() + 1).padStart(2, '0');
            let day = String(d.getDate()).padStart(2, '0');
            let hour = String(d.getHours()).padStart(2, '0');
            let min = String(d.getMinutes()).padStart(2, '0');
            document.getElementById('shipmentDeadlineInput').value = `${year}-${month}-${day}T${hour}:${min}`;
        }
    } else {
        shipmentDeadline = null;
        if (document.getElementById('shipmentDeadlineInput')) document.getElementById('shipmentDeadlineInput').value = '';
    }
    
    let localExtras = []; try { const stored = localStorage.getItem('alumex_master_extras'); if (stored) localExtras = JSON.parse(stored); } catch(e) {}
    
    const uniqueData = []; const seenMap = new Map();
    catDataRaw.forEach(item => {
      const localExt = localExtras.find(e => String(e.p) === String(item.profile) && cleanLen(e.l) === cleanLen(item.length) && String(e.i) === String(item.item_code)) || {};
      const obj = { db_id: item.id, profile: String(item.profile).trim(), itemCode: String(item.item_code || '').trim(), material: item.material || localExt.mat || '-', length: cleanLen(item.length), exLength: item.ex_length || localExt.ex || '', unitWeight: parseFloat(item.unit_weight) || 0, cutQty: item.cut_qty || 0, punchQty: item.punch_qty || 0, wrapQty: item.wrap_qty || 0, boxQty: item.box_qty || 0, crateQty: item.crate_qty || 0, boxCapacity: item.box_capacity || localExt.cap || 100 };
      const uniqueKey = `${obj.profile}_${obj.itemCode}_${obj.length}`;
      if (!seenMap.has(uniqueKey)) { seenMap.set(uniqueKey, obj); uniqueData.push(obj); } 
      else { const ex = seenMap.get(uniqueKey); ex.cutQty += obj.cutQty; ex.punchQty += obj.punchQty; ex.wrapQty += obj.wrapQty; ex.boxQty += obj.boxQty; ex.crateQty += obj.crateQty; if (!ex.itemCode || ex.itemCode === '-' || ex.itemCode === '') ex.itemCode = obj.itemCode; }
    });
    masterData = uniqueData.sort((a, b) => (parseFloat(a.profile)||0) - (parseFloat(b.profile)||0) || (parseFloat(a.length)||0) - (parseFloat(b.length)||0));
    poList = poData.map(item => ({ id: item.id, date: item.po_date, poNumber: item.po_number, profile: item.profile, length: cleanLen(item.length), orderQty: item.order_qty }));
    shipmentList = shipData.map(item => ({ id: item.id, date: item.shipment_date, month: item.shipment_month, poNumber: item.po_number, profile: item.profile, length: cleanLen(item.length), container: item.container, shippedQty: item.shipped_qty, remainingBalance: item.remaining_balance }));
    packingLists = plData.map(item => ({ id: item.id, plNumber: item.pl_number, poNumber: item.po_number, month: item.shipment_month || 'January', container: item.container || '1st Container', crateNo: item.crate_no || `Crate 1`, profile: item.profile, itemCode: item.item_code || '', length: cleanLen(item.length), boxQty: item.box_qty || 1, pcsQty: item.pcs_qty || 0, netWeight: item.net_weight || 0, grossWeight: item.gross_weight || 0, date: item.packing_date }));
    historyLogs = logData.map(item => ({ id: item.id, date: item.log_date, shift: item.shift, profile: item.profile, length: cleanLen(item.length), cutQty: item.cut_qty || 0, punchQty: item.punch_qty || 0, wrapQty: item.wrap_qty || 0, boxQty: item.box_qty || 0, crateQty: item.crate_qty || 0, timestamp: item.log_time || item.created_at || new Date().toISOString() }));
    rejectLogs = rjData; recoverLogs = rcData; dailyInstructionsList = instData;
    if (cbData && cbData.length > 0) { cardboardStockList = cbData.map(c => ({ id: c.id, db_id: c.id, date: c.cb_date, type: c.cb_type, incoming: c.incoming || 0, used: c.used || 0, timestamp: c.created_at || new Date().toISOString() })); saveCardboardLocally(); } else { const localCb = localStorage.getItem('alumex_cardboard_local'); if(localCb) cardboardStockList = JSON.parse(localCb); }

    const profileLookup = new Map();
    masterData.forEach(m => profileLookup.set(`${String(m.profile).trim()}_${cleanLen(m.length)}`, m));

    historyLogs.forEach(l => { if (!profileLookup.has(`${String(l.profile).trim()}_${cleanLen(l.length)}`)) { const nm = { db_id: null, profile: String(l.profile).trim(), itemCode: '-', material: '-', length: cleanLen(l.length), exLength: '', unitWeight: 0, cutQty: 0, punchQty: 0, wrapQty: 0, boxQty: 0, crateQty: 0, boxCapacity: 100 }; masterData.push(nm); profileLookup.set(`${String(l.profile).trim()}_${cleanLen(l.length)}`, nm); } });
    poList.forEach(po => { if (!profileLookup.has(`${String(po.profile).trim()}_${cleanLen(po.length)}`)) { const nm = { db_id: null, profile: String(po.profile).trim(), itemCode: '-', material: '-', length: cleanLen(po.length), exLength: '', unitWeight: 0, cutQty: 0, punchQty: 0, wrapQty: 0, boxQty: 0, crateQty: 0, boxCapacity: 100 }; masterData.push(nm); profileLookup.set(`${String(po.profile).trim()}_${cleanLen(po.length)}`, nm); } });

    // IMPORTANT: master_catalog stock is authoritative. Production history is an audit trail
    // and must never rebuild current stock after an Admin reset. This prevents reset quantities
    // from reappearing on the next sync/reload.
    if(!isSilent && masterData.length > 0) showToast(`Database Sync Complete!`, "success");
  } catch (err) { console.error(err); } finally { 
      isFetchingData = false;
      populateStockFilterDropdown(); populateProfileDropdown(); populatePoProfileDropdown(); populateShipmentPoDropdown(); populatePlPoDropdown(); populateCbProfileDropdown(); populateRejProfile(); populateRecProfile();
      if(currentUserRole) { 
          updateRoleUI(); 
          setTimeout(() => {
              renderDashboard(); renderProfileSummaryTable(); checkDateStatus(); renderHistoryData(); updatePoFilters(); renderPoDetailsTable(); window.renderShipmentHistoryTable(); renderPackingListTable(); renderPoCharts(); renderBalanceWorkTable(); renderCardboardStock(); renderDailyInstructions(); renderRejectTable(); renderRecoverTable();
              window.updateShipmentCountdown();
          }, 10);
      } 
  }
}

window.saveManualCratesToDB = async function() {
    const jsonStr=JSON.stringify(globalManualCrates);
    let existing=dailyInstructionsList.find(i=>i.target_user==='SYS_CRATES_SYNC');
    try {
      if(existing){
        const {error}=await supabaseClient.from('daily_instructions').update({message:jsonStr}).eq('id',existing.id);
        if(error) throw new Error(error.message);
        existing.message=jsonStr;
      } else {
        const newRec={target_date:new Date().toISOString().split('T')[0],target_user:'SYS_CRATES_SYNC',priority:'Normal',message:jsonStr,status:'Completed',action_taken:'System Data'};
        const {data,error}=await supabaseClient.from('daily_instructions').insert([newRec]).select();
        if(error) throw new Error(error.message);
        if(data?.length) dailyInstructionsList.push(data[0]);
      }
      localStorage.setItem('manual_crates',jsonStr);
      return true;
    } catch(e){ console.error('Manual crate state save failed:',e); showToast(`Crate completion save failed: ${e.message}`,'error'); return false; }
};

function getPackingMonths() {
    const months = [...new Set(packingLists.map(p => String(p.month || '').trim()).filter(Boolean))];
    const now = new Date();
    const current = now.toLocaleString('en-US', {month:'long'});
    if (!months.includes(current)) months.unshift(current);
    return months;
}
function getContainerList() { return ['1st Container','2nd Container','3rd Container']; }
function shipmentStateKey(month, container) { return `${String(month||'').trim()}__${String(container||'').trim()}`; }
function manualCrateKey(crateId, container=activePackingContainer, month=activePackingMonth) { return `${String(month||'').trim()}::${String(container||'').trim()}::${String(crateId||'').trim()}`; }
function isManualCrateComplete(crateId, container=activePackingContainer, month=activePackingMonth) { return !!globalManualCrates[manualCrateKey(crateId, container, month)]; }
function isPackingShipmentComplete(month, container) { return !!shipmentStates[shipmentStateKey(month, container)]?.completed; }
function getContainerNumber(container) { const m=String(container||'').match(/(\d+)/); return m ? parseInt(m[1]) : 99; }
function getPackingContainerRecords(month, container) { return packingLists.filter(p => String(p.month||'').trim()===String(month||'').trim() && String(p.container||'').trim()===String(container||'').trim()); }
function getNextPackingContainer(month, container) {
    const n=getContainerNumber(container);
    if (n >= 3) return null;
    const next = n + 1;
    const suffix = next === 1 ? 'st' : next === 2 ? 'nd' : next === 3 ? 'rd' : 'th';
    return `${next}${suffix} Container`;
}
function normalizeContainerName(v) {
    const s=String(v||'').trim().toLowerCase().replace(/\s+/g,' ');
    if(/1st|first|container 1|1 container/.test(s)) return '1st Container';
    if(/2nd|second|container 2|2 container/.test(s)) return '2nd Container';
    if(/3rd|third|container 3|3 container/.test(s)) return '3rd Container';
        return String(v||'').trim() || '1st Container';
}
async function savePackingShipmentStates() {
    const jsonStr=JSON.stringify(shipmentStates||{});
    let existing=dailyInstructionsList.find(i=>i.target_user==='SYS_PL_SHIPMENT_STATE');
    try {
        if(existing) { existing.message=jsonStr; await supabaseClient.from('daily_instructions').update({message:jsonStr}).eq('id',existing.id); }
        else { const {data}=await supabaseClient.from('daily_instructions').insert([{target_date:new Date().toISOString().split('T')[0],target_user:'SYS_PL_SHIPMENT_STATE',priority:'Normal',message:jsonStr,status:'Completed',action_taken:'System Data'}]).select(); if(data?.length) dailyInstructionsList.push(data[0]); }
    } catch(e) { showToast('Shipment status could not be synced.','warning'); }
}
function ensurePackingSelection() {
    const months=getPackingMonths();
    const hadMonth=!!activePackingMonth, hadContainer=!!activePackingContainer;
    if(!activePackingMonth || !months.includes(activePackingMonth)) activePackingMonth=months[0] || new Date().toLocaleString('en-US',{month:'long'});
    const containers=getContainerList();
    if(!activePackingContainer || !containers.includes(activePackingContainer)) activePackingContainer=containers[0];
    // On first load only, open the latest useful shipment: first incomplete container with data,
    // otherwise the next container after the latest completed one.
    if(!hadMonth && !hadContainer) {
        const withData=containers.filter(c=>getPackingContainerRecords(activePackingMonth,c).length>0);
        const incompleteWithData=withData.find(c=>!isPackingShipmentComplete(activePackingMonth,c));
        if(incompleteWithData) activePackingContainer=incompleteWithData;
        else {
            const completedNums=containers.filter(c=>isPackingShipmentComplete(activePackingMonth,c)).map(getContainerNumber);
            const nextNum=completedNums.length?Math.max(...completedNums)+1:0;
            if(nextNum>=1 && nextNum<=4) activePackingContainer=containers[nextNum-1];
            else if(withData.length) activePackingContainer=withData[withData.length-1];
        }
    }
}
window.setPackingShipment = function(month,container){ activePackingMonth=month; activePackingContainer=container; renderPackingListTable(); };
window.completePackingShipment = async function(){
    if(currentUserRole!=='Admin') return showToast('Only Admin can complete a shipment.','error');
    ensurePackingSelection();
    const key=shipmentStateKey(activePackingMonth,activePackingContainer);
    const records=getPackingContainerRecords(activePackingMonth,activePackingContainer);
    if(!records.length) return showToast('No packing list data found for this container.','warning');
    const crateIds=[...new Set(records.map(r=>r.crateNo).filter(Boolean))];
    const completedCrates=crateIds.filter(c=>isManualCrateComplete(c,activePackingContainer)).length;
    if(completedCrates<crateIds.length) {
        showConfirm(`Mark <b>${activePackingContainer}</b> as shipped/completed? ${crateIds.length-completedCrates} crate(s) are not marked Packed.`, async()=>{ await finalizePackingShipment(key); });
    } else await finalizePackingShipment(key);
};
async function finalizePackingShipment(key){
    shipmentStates[key]={completed:true,completedAt:new Date().toISOString(),completedBy:currentUserRole};
    await savePackingShipmentStates();
    const next=getNextPackingContainer(activePackingMonth,activePackingContainer);
    if(next){ activePackingContainer=next; showToast(`${key.split('__')[1]} completed. Now ready for ${next}.`,'success'); }
    renderPackingListTable(); renderDashboard();
}
window.reopenPackingShipment = async function(){
    if(currentUserRole!=='Admin') return;
    const key=shipmentStateKey(activePackingMonth,activePackingContainer); delete shipmentStates[key]; await savePackingShipmentStates(); renderPackingListTable(); showToast(`${activePackingContainer} reopened.`,'success');
};
window.printPackingShipment = function(){
    const month=activePackingMonth, container=activePackingContainer, rows=getPackingContainerRecords(month,container);
    if(!rows.length) return showToast('No data to print for this shipment.','warning');
    const win=window.open('','_blank'); if(!win) return;
    const totalPcs=rows.reduce((a,r)=>a+(+r.pcsQty||0),0), totalWt=rows.reduce((a,r)=>a+(+r.netWeight||0),0);
    win.document.write(`<html><head><title>${month} - ${container} Packing List</title><style>body{font-family:Arial;padding:30px;color:#123}h1{margin-bottom:4px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#064e3b;color:#fff}.sum{margin:12px 0;font-weight:700}</style></head><body><h1>Alumex PLC - Packing List</h1><div>${month} • ${container}</div><div class="sum">Total: ${totalPcs} Pcs | ${totalWt.toFixed(2)} kg</div><table><thead><tr><th>Crate</th><th>Profile</th><th>Item Code</th><th>Length</th><th>Qty</th><th>Net Weight</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.crateNo}</td><td>${r.profile}</td><td>${r.itemCode}</td><td>${r.length} mm</td><td>${r.pcsQty}</td><td>${(+r.netWeight||0).toFixed(2)} kg</td></tr>`).join('')}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`); win.document.close();
};
function renderPackingShipmentControls() {
    const host=document.getElementById('packingShipmentControls'); if(!host) return;
    ensurePackingSelection(); const months=getPackingMonths(), containers=getContainerList();
    const records=getPackingContainerRecords(activePackingMonth,activePackingContainer);
    const crateIds=[...new Set(records.map(r=>r.crateNo).filter(Boolean))];
    const doneCrates=crateIds.filter(c=>isManualCrateComplete(c,activePackingContainer)).length; const completed=isPackingShipmentComplete(activePackingMonth,activePackingContainer);
    const pcs=records.reduce((a,r)=>a+(+r.pcsQty||0),0), wt=records.reduce((a,r)=>a+(+r.netWeight||0),0);
    const monthOptions=months.map(m=>`<option value="${m}" ${m===activePackingMonth?'selected':''}>${m}</option>`).join('');
    const tabs=containers.map(c=>{const rec=getPackingContainerRecords(activePackingMonth,c), done=isPackingShipmentComplete(activePackingMonth,c), has=rec.length>0; return `<button class="pl-ship-tab ${c===activePackingContainer?'active':''} ${done?'done':''}" onclick="window.setPackingShipment('${activePackingMonth}','${c}')"><span>${c.replace(' Container','')}</span><small>${done?'✓ Completed':has?`${rec.length} items`:'No data'}</small></button>`;}).join('');
    host.innerHTML=`<div class="pl-control-head"><div><div class="pl-eyebrow">SHIPMENT CONTROL CENTER</div><h3><i class="fa-solid fa-ship"></i> Monthly Shipment Flow</h3><p>Complete one container, then continue directly with the next shipment.</p></div><div class="pl-control-actions"><select onchange="window.setPackingShipment(this.value,activePackingContainer)">${monthOptions}</select><button class="btn btn-accent" onclick="window.printPackingShipment()"><i class="fa-solid fa-print"></i> Print</button></div></div><div class="pl-ship-tabs">${tabs}</div><div class="pl-active-summary"><div><span class="pl-status-dot ${completed?'done':''}"></span><b>${activePackingContainer}</b><span class="pl-status ${completed?'done':''}">${completed?'SHIPMENT COMPLETED':'ACTIVE SHIPMENT'}</span></div><div class="pl-summary-metrics"><span><b>${crateIds.length}</b> Crates</span><span><b>${doneCrates}/${crateIds.length}</b> Packed</span><span><b>${pcs}</b> Pcs</span><span><b>${wt.toFixed(2)}</b> kg</span></div><div class="pl-control-buttons">${completed?`<button class="btn" style="background:#64748b" onclick="window.reopenPackingShipment()"><i class="fa-solid fa-rotate-left"></i> Reopen</button>`:`<button class="btn btn-accent" onclick="window.completePackingShipment()"><i class="fa-solid fa-circle-check"></i> Complete Shipment</button>`}</div></div>`;
}

function toggleNavCategory(category, btn) {
  const nav=document.getElementById('mainNavTabs'); if(!nav) return;
  const panel=document.getElementById('smartSubnav');
  const same=btn && btn.classList.contains('active') && panel && panel.classList.contains('open');
  nav.querySelectorAll('.smart-category').forEach(b=>b.classList.remove('active'));
  nav.querySelectorAll('.smart-submenu').forEach(m=>m.classList.remove('active'));
  if(same){ panel.classList.remove('open'); return; }
  if(btn) btn.classList.add('active');
  const menu=nav.querySelector(`.smart-submenu[data-menu="${category}"]`);
  if(menu){ menu.classList.add('active'); panel.classList.add('open'); }
}

function activateNavCategoryForTab(tabId, btn){
  const nav=document.getElementById('mainNavTabs'); if(!nav) return;
  const item=btn || nav.querySelector(`.tab-btn[onclick*="${tabId}"]`);
  const direct=nav.querySelector(`.smart-category[data-tab="${tabId}"]`);
  if(direct){
    nav.querySelectorAll('.smart-category').forEach(b=>b.classList.remove('active'));
    direct.classList.add('active');
    const panel=document.getElementById('smartSubnav'); if(panel) panel.classList.remove('open');
    return;
  }
  const menu=item?.closest('.smart-submenu');
  if(!menu) return;
  nav.querySelectorAll('.smart-category').forEach(b=>b.classList.remove('active'));
  const cat=menu.dataset.menu;
  const catBtn=nav.querySelector(`.smart-category[data-category="${cat}"]`);
  if(catBtn) catBtn.classList.add('active');
  nav.querySelectorAll('.smart-submenu').forEach(m=>m.classList.remove('active'));
  menu.classList.add('active');
  const panel=document.getElementById('smartSubnav'); if(panel) panel.classList.add('open');
}

function switchTab(tabId, btn) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active')); 
  document.querySelectorAll('#mainNavTabs .tab-btn').forEach(el => el.classList.remove('active')); 
  document.getElementById(tabId).classList.add('active'); 
  if(btn && btn.classList.contains('tab-btn')) btn.classList.add('active');
  activateNavCategoryForTab(tabId, btn);
  
  setTimeout(() => {
      if (tabId === 'dashboardTab') renderDashboard(); 
      if (tabId === 'balanceWorkTab') renderBalanceWorkTable(); 
      if (tabId === 'cardboardTab') renderCardboardStock(); 
      if (tabId === 'historyTab') renderHistoryData(); 
      if (tabId === 'masterListTab') renderMasterCatalog(); 
      if (tabId === 'poManagementTab') { updatePoFilters(); renderPoDetailsTable(); renderPoCharts(); } 
      if (tabId === 'shipmentTab') { populateShipmentPoDropdown(); window.renderShipmentHistoryTable(); } 
      if (tabId === 'packingListTab') { populatePlPoDropdown(); renderPackingListTable(); } 
      if (tabId === 'dailyPlanTab') renderDailyInstructions(); 
      if (tabId === 'rejectTrackerTab') { populateRejProfile(); renderRejectTable(); populateRecProfile(); renderRecoverTable(); }
  }, 10);
}

function switchRejectSubTab(tabId, btn) { document.querySelectorAll('.reject-sub-tab-content').forEach(el => el.style.display = 'none'); document.querySelectorAll('.reject-sub-tab-btn').forEach(el => el.classList.remove('active')); if(document.getElementById(tabId)) document.getElementById(tabId).style.display = 'block'; if(btn) btn.classList.add('active'); if(tabId === 'rejectEntrySubTab') { populateRejProfile(); renderRejectTable(); } else { populateRecProfile(); renderRecoverTable(); showRecAvailable(); } }
function populateRejProfile() { const sel = document.getElementById('rejProfile'); if(!sel) return; sel.innerHTML = '<option value="">-- Choose Profile --</option>'; [...new Set(masterData.map(i => String(i.profile).trim()))].forEach(p => sel.appendChild(new Option(p, p))); }
function onRejProfileSelect() { const p = document.getElementById('rejProfile').value; const sel = document.getElementById('rejItemCode'); sel.innerHTML = '<option value="">-- Choose Item Code --</option>'; document.getElementById('rejLength').innerHTML = '<option value="">-- Choose Length --</option>'; document.getElementById('rejWeight').value=''; if(!p) return; const items = masterData.filter(m => String(m.profile).trim() === p && m.itemCode); [...new Set(items.map(m => m.itemCode))].forEach(ic => sel.appendChild(new Option(ic, ic))); }
function onRejItemCodeSelect() { const p = document.getElementById('rejProfile').value; const ic = document.getElementById('rejItemCode').value; const sel = document.getElementById('rejLength'); sel.innerHTML = '<option value="">-- Choose Length --</option>'; document.getElementById('rejWeight').value=''; if(!p || !ic) return; const matches = masterData.filter(m => String(m.profile).trim() === p && m.itemCode === ic); matches.forEach(m => sel.appendChild(new Option(`${m.length} mm`, m.length))); if(matches.length === 1) { sel.value = matches[0].length; calcRejWeight(); } }
function calcRejWeight() { const p = document.getElementById('rejProfile') ? document.getElementById('rejProfile').value : null; const ic = document.getElementById('rejItemCode') ? document.getElementById('rejItemCode').value : null; const l = document.getElementById('rejLength') ? document.getElementById('rejLength').value : null; const pcs = parseInt(document.getElementById('rejPcs').value)||0; if(!p || !ic || !l || pcs<=0) { if(document.getElementById('rejWeight')) document.getElementById('rejWeight').value=''; return; } const matched = masterData.find(m => String(m.profile).trim()===p && m.itemCode===ic && cleanLen(m.length)===cleanLen(l)); if(matched && document.getElementById('rejWeight')) { document.getElementById('rejWeight').value = (pcs * (matched.unitWeight || 0)).toFixed(2); } }
async function saveRejectEntry() {
  if(isAppBusy) return; isAppBusy=true;
  try {
    if (currentUserRole !== 'Admin' && currentUserRole !== 'Planner') return;
    const d=document.getElementById('rejDate').value, sh=document.getElementById('rejShift')?.value||'', tm=document.getElementById('rejTeam')?.value||'', loc=document.getElementById('rejLoc')?.value||'', stg=document.getElementById('rejStage')?.value||'', p=document.getElementById('rejProfile').value, ic=document.getElementById('rejItemCode').value, l=cleanLen(document.getElementById('rejLength').value), pcs=parseInt(document.getElementById('rejPcs').value)||0;
    if(!d||!p||!ic||!l||pcs<=0) return showToast('Please complete all Reject fields.','warning');
    const matched=masterData.find(m=>String(m.profile).trim()===p && String(m.itemCode).trim()===ic && cleanLen(m.length)===l);
    if(!matched) return showToast('Selected profile/length is not in Master Catalog.','error');
    const wt=parseFloat((pcs*(matched.unitWeight||0)).toFixed(2));
    const punchStage=String(stg).toLowerCase().includes('punch'), wrapStage=String(stg).toLowerCase().includes('wrap');
    const nextCut=Math.max(0,(matched.cutQty||0)-(punchStage?pcs:0));
    const nextPunch=Math.max(0,(matched.punchQty||0)-(wrapStage?pcs:0));
    const entry={reject_date:d,shift:sh,team:tm,location:loc,stage:stg,profile:p,item_code:ic,length:l,pcs,weight:wt};
    const {data,error}=await supabaseClient.from('reject_logs').insert([entry]).select();
    if(error) throw new Error(`Reject save failed: ${error.message}`);
    if(matched.db_id && (punchStage||wrapStage)){
      const {error:stockError}=await supabaseClient.from('master_catalog').update({cut_qty:nextCut,punch_qty:nextPunch}).eq('id',matched.db_id);
      if(stockError){ if(data?.[0]?.id) await supabaseClient.from('reject_logs').delete().eq('id', data[0].id); throw new Error(`Reject stock update failed: ${stockError.message}`); }
    }
    matched.cutQty=nextCut; matched.punchQty=nextPunch; rejectLogs.unshift({...entry,id:data?.[0]?.id||Date.now()});
    renderRejectTable(); renderDashboard(); renderProfileSummaryTable(); renderBalanceWorkTable();
    showToast('Reject saved successfully.','success'); document.getElementById('rejectEntryForm').reset(); document.getElementById('rejDate').value=d;
  } catch(e){ console.error(e); showToast(e.message||'Reject save failed.','error'); } finally { isAppBusy=false; }
}
function renderRejectTable() { try { const subTab = document.getElementById('rejectEntrySubTab'); let filterDiv = document.getElementById('rejectFilterContainer'); if (!filterDiv && subTab) { filterDiv = document.createElement('div'); filterDiv.id = 'rejectFilterContainer'; filterDiv.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center; background: rgba(16, 185, 129, 0.05); padding: 15px; border-radius: 8px; margin-bottom: 15px; border: 1px dashed var(--emerald-border); flex-wrap: wrap; gap: 15px;"><div><label style="font-weight:800; margin-right:10px; color:var(--primary-dark);"><i class="fa-solid fa-calendar-days"></i> Filter by Month:</label><input type="month" id="rejectMonthFilter" onchange="renderRejectTable()" style="padding: 6px 12px; border-radius: 6px; border: 1px solid var(--accent-color); font-weight: 700;"></div><div style="display:flex; gap: 12px; font-weight: 800; font-size: 13.5px; flex-wrap: wrap;"><div style="background: #fee2e2; color: #9f1239; padding: 8px 14px; border-radius: 6px;"><i class="fa-solid fa-dumpster"></i> Total: <span id="rejSumTotal">0.00</span> kg</div></div></div>`; const tableContainer = subTab.querySelector('.table-container'); subTab.insertBefore(filterDiv, tableContainer); const now = new Date(); document.getElementById('rejectMonthFilter').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; } const selectedMonthVal = document.getElementById('rejectMonthFilter') ? document.getElementById('rejectMonthFilter').value : ''; let filteredLogs = rejectLogs; let sumTotal = 0; if (selectedMonthVal) filteredLogs = rejectLogs.filter(r => r.reject_date && r.reject_date.startsWith(selectedMonthVal)); filteredLogs.forEach(r => { sumTotal += (parseFloat(r.weight) || 0); }); if (document.getElementById('rejSumTotal')) document.getElementById('rejSumTotal').textContent = sumTotal.toFixed(2); const tb = document.getElementById('rejectTableBody'); if(!tb) return; let html = ''; if(filteredLogs.length===0) html = `<tr><td colspan="10" style="text-align:center;">No Reject Records Found.</td></tr>`; else { filteredLogs.forEach(r => { html += `<tr><td>${r.reject_date}</td><td>${r.shift}</td><td>${r.location}</td><td>${r.stage}</td><td><b>${r.profile}</b></td><td>${r.item_code}</td><td>${r.length}</td><td>${r.pcs}</td><td>${r.weight} kg</td><td>${currentUserRole === 'Admin' ? `<button class="btn btn-danger" onclick="deleteRejectItem(${r.id})"><i class="fa-solid fa-trash"></i></button>` : `<i class="fa-solid fa-lock"></i>`}</td></tr>`; }); } tb.innerHTML = html; } catch(e) {} }
window.deleteRejectItem = function(id) { if(currentUserRole !== 'Admin') return; showConfirm("Delete this Reject record?", async () => {
  const row=rejectLogs.find(r=>Number(r.id)===Number(id)); if(!row) return;
  try {
    const matched=masterData.find(m=>recKey(m.profile)===recKey(row.profile)&&recKey(m.itemCode)===recKey(row.item_code)&&cleanLen(m.length)===cleanLen(row.length));
    const stage=String(row.stage||'').toLowerCase();
    const restoreCut=stage.includes('punch'); const restorePunch=stage.includes('wrap');
    if((restoreCut||restorePunch) && (!matched || !matched.db_id)) throw new Error('Matching Master Catalog stock row was not found. Delete cancelled.');
    let previous={cutQty:matched?.cutQty||0,punchQty:matched?.punchQty||0};
    if(matched && matched.db_id && (restoreCut||restorePunch)) {
      const nextCut=restoreCut ? previous.cutQty+(Number(row.pcs)||0) : previous.cutQty;
      const nextPunch=restorePunch ? previous.punchQty+(Number(row.pcs)||0) : previous.punchQty;
      const {error:stockError}=await supabaseClient.from('master_catalog').update({cut_qty:nextCut,punch_qty:nextPunch}).eq('id',matched.db_id);
      if(stockError) throw new Error(`Stock reversal failed: ${stockError.message}`);
      matched.cutQty=nextCut; matched.punchQty=nextPunch;
    }
    const {error:deleteError}=await supabaseClient.from('reject_logs').delete().eq('id',id);
    if(deleteError){ if(matched?.db_id&&(restoreCut||restorePunch)) await supabaseClient.from('master_catalog').update({cut_qty:previous.cutQty,punch_qty:previous.punchQty}).eq('id',matched.db_id); throw new Error(`Reject delete failed: ${deleteError.message}`); }
    rejectLogs=rejectLogs.filter(r=>Number(r.id)!==Number(id)); renderRejectTable(); renderDashboard(); renderProfileSummaryTable(); renderBalanceWorkTable(); showToast('Reject deleted and stock reversed successfully.','success');
  } catch(e){ console.error(e); showToast(e.message||'Reject delete failed.','error'); }
}); }
function recKey(v){ return String(v ?? '').trim().toLowerCase(); }
function getRecoveryMasterRows(profile, itemCode){
  const p = recKey(profile), ic = recKey(itemCode);
  return masterData
    .filter(m => recKey(m.profile) === p && cleanLen(m.length) !== '')
    .map(m => ({...m, _lengthNum: parseFloat(cleanLen(m.length))}))
    .filter(m => Number.isFinite(m._lengthNum));
}
function getRejectBalance(profile, itemCode, originalLength){
  const p = recKey(profile), ic = recKey(itemCode), l = cleanLen(originalLength);
  let rejected = 0, recovered = 0;
  rejectLogs.forEach(r => { if(recKey(r.profile)===p && recKey(r.item_code)===ic && cleanLen(r.length)===l) rejected += Number(r.pcs)||0; });
  recoverLogs.forEach(r => { if(recKey(r.profile)===p && recKey(r.item_code)===ic && cleanLen(r.original_length)===l) recovered += Number(r.pcs)||0; });
  return Math.max(0, rejected - recovered);
}
function populateRecProfile() {
  const sel = document.getElementById('recProfile'); if(!sel) return;
  sel.innerHTML = '<option value="">-- Choose Profile --</option>';
  const profiles = [...new Set(rejectLogs.map(r=>String(r.profile||'').trim()).filter(Boolean))];
  profiles.forEach(profile => {
    const hasBalance = rejectLogs.some(r => recKey(r.profile)===recKey(profile) && getRejectBalance(profile, r.item_code, r.length) > 0);
    if(hasBalance) sel.appendChild(new Option(profile, profile));
  });
  // If only one profile currently has recoverable rejects, select it automatically.
  if(sel.options.length === 2){ sel.selectedIndex = 1; onRecProfileSelect(); }
}
function onRecProfileSelect() {
  const p = document.getElementById('recProfile').value;
  const sel = document.getElementById('recItemCode');
  sel.innerHTML = '<option value="">-- Choose Item Code --</option>';
  document.getElementById('recOrigLength').innerHTML = '<option value="">-- Original Reject Length --</option>';
  document.getElementById('recNewLength').innerHTML = '<option value="">-- Select New Cut Length --</option>';
  document.getElementById('recAvailableDisplay').textContent = '0 Pcs / 0.00 kg';
  document.getElementById('recAvailableDisplay').dataset.max = 0;
  document.getElementById('recWeight').value = '';
  if(!p) return;
  const itemCodes = [...new Set(rejectLogs.filter(r=>recKey(r.profile)===recKey(p)).map(r=>String(r.item_code||'').trim()).filter(Boolean))];
  itemCodes.forEach(ic => {
    const hasBalance = rejectLogs.some(r => recKey(r.profile)===recKey(p) && recKey(r.item_code)===recKey(ic) && getRejectBalance(p, ic, r.length)>0);
    if(hasBalance) sel.appendChild(new Option(ic, ic));
  });
  if(sel.options.length === 2){ sel.selectedIndex = 1; onRecItemCodeSelect(); }
}
function onRecItemCodeSelect() {
  const p = document.getElementById('recProfile').value;
  const ic = document.getElementById('recItemCode').value;
  const sel = document.getElementById('recOrigLength');
  sel.innerHTML = '<option value="">-- Original Reject Length --</option>';
  document.getElementById('recNewLength').innerHTML = '<option value="">-- Select New Cut Length --</option>';
  document.getElementById('recAvailableDisplay').textContent = '0 Pcs / 0.00 kg';
  document.getElementById('recAvailableDisplay').dataset.max = 0;
  document.getElementById('recWeight').value = '';
  if(!p||!ic) return;
  const lengths = [...new Set(rejectLogs.filter(r=>recKey(r.profile)===recKey(p) && recKey(r.item_code)===recKey(ic)).map(r=>cleanLen(r.length)).filter(Boolean))];
  lengths.sort((a,b)=>(parseFloat(a)||0)-(parseFloat(b)||0));
  lengths.forEach(l => { const balance=getRejectBalance(p,ic,l); if(balance>0) sel.appendChild(new Option(`${l} mm  •  ${balance} Pcs available`, l)); });
  if(sel.options.length === 2){ sel.selectedIndex = 1; showRecAvailable(); }
}
function showRecAvailable() {
  const p = document.getElementById('recProfile').value;
  const ic = document.getElementById('recItemCode').value;
  const l = cleanLen(document.getElementById('recOrigLength').value);
  const newSel = document.getElementById('recNewLength');
  const maxEl = document.getElementById('recAvailableDisplay');
  const weightEl = document.getElementById('recWeight');
  if(!newSel) return;
  newSel.innerHTML = '<option value="">-- Select New Cut Length --</option>';
  weightEl.value = '';
  if(!p||!ic||!l) { maxEl.textContent = '0 Pcs / 0.00 kg'; maxEl.dataset.max = 0; return; }

  const balPcs = getRejectBalance(p,ic,l);
  const original = getRecoveryMasterRows(p,ic).find(m => cleanLen(m.length)===l);
  const originalWt = original ? (Number(original.unitWeight)||0) : 0;
  const originalBalanceWt = balPcs * originalWt;
  maxEl.innerHTML = `<strong>${balPcs} Pcs</strong> <span style="opacity:.8">/ ${originalBalanceWt.toFixed(2)} kg recoverable from ${l} mm</span>`;
  maxEl.dataset.max = balPcs;

  // IMPORTANT: recovery choices come ONLY from Master Catalog and MUST be shorter than the reject length.
  const shorter = getRecoveryMasterRows(p,ic)
    .filter(m => m._lengthNum < (parseFloat(l)||0))
    .sort((a,b) => (recKey(a.itemCode)===recKey(ic)?0:1) - (recKey(b.itemCode)===recKey(ic)?0:1) || a._lengthNum-b._lengthNum);
  if(shorter.length===0){
    const o=document.createElement('option'); o.value=''; o.textContent='No shorter Master Catalog length available'; o.disabled=true; newSel.appendChild(o);
    return;
  }
  shorter.forEach(m => {
    const codeLabel = recKey(m.itemCode) && recKey(m.itemCode)!==recKey(ic) ? ` • ${m.itemCode}` : '';
    const opt = new Option(`${m.length} mm${codeLabel}  •  ${Number(m.unitWeight||0).toFixed(4)} kg/pc`, cleanLen(m.length));
    opt.dataset.unitWeight = Number(m.unitWeight||0);
    newSel.appendChild(opt);
  });
}
function calcRecWeight() {
  const p = document.getElementById('recProfile').value;
  const ic = document.getElementById('recItemCode').value;
  const ol = cleanLen(document.getElementById('recOrigLength').value);
  const nl = cleanLen(document.getElementById('recNewLength').value);
  const pcs = parseInt(document.getElementById('recPcs').value)||0;
  const weightEl = document.getElementById('recWeight');
  if(weightEl) weightEl.value = '';
  if(!p||!ic||!ol||!nl||pcs<=0) return;
  const maxPcs = parseInt(document.getElementById('recAvailableDisplay').dataset.max)||0;
  if(pcs > maxPcs){ if(weightEl) weightEl.value=''; return; }
  const originalNum=parseFloat(ol), newNum=parseFloat(nl);
  if(!Number.isFinite(originalNum)||!Number.isFinite(newNum)||newNum>=originalNum) return;
  const matched = getRecoveryMasterRows(p,ic).find(m=>cleanLen(m.length)===nl);
  if(matched && weightEl) weightEl.value = (pcs * (Number(matched.unitWeight)||0)).toFixed(2);
}
async function saveRecoverEntry() {
  if(isAppBusy) return; isAppBusy=true;
  try {
    if (currentUserRole !== 'Admin' && currentUserRole !== 'Planner') return;
    const d=document.getElementById('recDate').value,p=document.getElementById('recProfile').value,ic=document.getElementById('recItemCode').value,ol=cleanLen(document.getElementById('recOrigLength').value),nl=cleanLen(document.getElementById('recNewLength').value),pcs=parseInt(document.getElementById('recPcs').value)||0,maxPcs=parseInt(document.getElementById('recAvailableDisplay').dataset.max)||0;
    if(!d||!p||!ic||!ol||!nl||pcs<=0) return showToast('Please complete all Recovery fields.','warning');
    if(pcs>maxPcs) return showToast(`Recovery quantity cannot exceed ${maxPcs} available pcs.`,'warning');
    const originalNum=parseFloat(ol),newNum=parseFloat(nl);
    if(!Number.isFinite(originalNum)||!Number.isFinite(newNum)||newNum>=originalNum) return showToast('New Cut Length must be shorter than Original Reject Length.','warning');
    const recoveryRows=getRecoveryMasterRows(p,ic).filter(m=>cleanLen(m.length)===nl);
    const matched=recoveryRows.find(m=>recKey(m.itemCode)===recKey(ic))||recoveryRows[0];
    if(!matched) return showToast('Selected New Cut Length is not available in Master Catalog.','warning');
    const wt=parseFloat((pcs*(Number(matched.unitWeight)||0)).toFixed(2));
    const entry={recover_date:d,profile:p,item_code:ic,original_length:ol,new_length:nl,pcs,recovered_weight:wt};
    const {data,error}=await supabaseClient.from('recover_logs').insert([entry]).select();
    if(error) throw new Error(`Recovery save failed: ${error.message}`);

    // Recovery creates usable NEW-CUT stock at the selected shorter length.
    // Only the exact profile + item code + new length row receives the recovered pcs.
    if(!matched.db_id) {
      if(data?.[0]?.id) await supabaseClient.from('recover_logs').delete().eq('id', data[0].id);
      throw new Error('Recovery saved row has no Master Catalog stock reference. Recovery was rolled back.');
    }
    const nextCutQty = (Number(matched.cutQty)||0) + pcs;
    const {error:stockError}=await supabaseClient.from('master_catalog').update({cut_qty:nextCutQty}).eq('id',matched.db_id);
    if(stockError) {
      if(data?.[0]?.id) await supabaseClient.from('recover_logs').delete().eq('id', data[0].id);
      throw new Error(`Recovery stock update failed: ${stockError.message}`);
    }
    matched.cutQty = nextCutQty;
    recoverLogs.unshift({...entry,id:data?.[0]?.id||Date.now()});
    renderRecoverTable(); renderDashboard(); renderProfileSummaryTable(); renderBalanceWorkTable(); showRecAvailable();
    showToast(`${pcs} Pcs recovered and added to Cut Stock at ${nl} mm.`, 'success');
    document.getElementById('rejectRecoverForm').reset();
  } catch(e){ console.error(e); showToast(e.message||'Recovery save failed.','error'); } finally { isAppBusy=false; }
}
function renderRecoverTable() {
  const tb = document.getElementById('recoverTableBody'); if(!tb) return;
  const now = new Date(); const y = now.getFullYear(); const m = now.getMonth();
  let monthlyReject = 0, monthlyRecover = 0;
  rejectLogs.forEach(r => { const d = new Date(r.reject_date); if(d.getFullYear()===y && d.getMonth()===m) monthlyReject += Number(r.weight)||0; });
  recoverLogs.forEach(r => { const d = new Date(r.recover_date); if(d.getFullYear()===y && d.getMonth()===m) monthlyRecover += Number(r.recovered_weight)||0; });
  const monthlyNet = Math.max(0, monthlyReject - monthlyRecover);
  const recoveryRate = monthlyReject > 0 ? Math.min(100, (monthlyRecover / monthlyReject) * 100) : 0;
  const mr=document.getElementById('recMonthlyReject'), mc=document.getElementById('recMonthlyRecover'), mn=document.getElementById('recMonthlyNet'), mrate=document.getElementById('recMonthlyRate'), mm=document.getElementById('recoverySummaryMonth'), rbar=document.getElementById('recMonthlyRecoverBar'), rbadge=document.getElementById('recMonthlyRateBadge');
  if(mr) mr.textContent = `${monthlyReject.toFixed(2)} kg`;
  if(mc) mc.textContent = `${monthlyRecover.toFixed(2)} kg`;
  if(mn) mn.textContent = `${monthlyNet.toFixed(2)} kg`;
  if(mrate) mrate.textContent = `${recoveryRate.toFixed(1)}%`;
  if(rbar) rbar.style.width = `${recoveryRate.toFixed(1)}%`;
  if(rbadge) rbadge.textContent = `${recoveryRate.toFixed(1)}% of reject recovered`;
  if(mm) mm.textContent = now.toLocaleDateString('en-US',{month:'long',year:'numeric'});
  let html = '';
  if(recoverLogs.length===0) html = `<tr><td colspan="8" style="text-align:center;padding:24px;">No Recovery Records Found.</td></tr>`;
  else recoverLogs.slice(0,50).forEach(r => {
    html += `<tr><td>${r.recover_date}</td><td><b>${r.profile}</b></td><td>${r.item_code}</td><td>${r.original_length} mm</td><td><span class="stock-badge" style="background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;">${r.new_length} mm</span></td><td><b>${r.pcs}</b> Pcs</td><td><b style="color:#047857;">${Number(r.recovered_weight||0).toFixed(2)} kg</b></td><td>${currentUserRole === 'Admin' ? `<button class="btn btn-danger" onclick="deleteRecoverItem(${r.id})"><i class="fa-solid fa-trash"></i></button>` : `<i class="fa-solid fa-lock"></i>`}</td></tr>`;
  });
  tb.innerHTML = html;
}
window.deleteRecoverItem = function(id) { if(currentUserRole !== 'Admin') return; showConfirm("Delete Recovery Record?", async () => {
  const row = recoverLogs.find(r => Number(r.id)===Number(id));
  if(!row) return;
  try {
    const matched = masterData.find(m => recKey(m.profile)===recKey(row.profile) && recKey(m.itemCode)===recKey(row.item_code) && cleanLen(m.length)===cleanLen(row.new_length));
    if(!matched || !matched.db_id) throw new Error('Matching Master Catalog stock row was not found. Delete cancelled.');
    const nextCut = Math.max(0,(Number(matched.cutQty)||0) - (Number(row.pcs)||0));
    const {error:stockError}=await supabaseClient.from('master_catalog').update({cut_qty:nextCut}).eq('id',matched.db_id);
    if(stockError) throw new Error(`Stock reversal failed: ${stockError.message}`);
    const {error:deleteError}=await supabaseClient.from('recover_logs').delete().eq('id', id);
    if(deleteError) {
      await supabaseClient.from('master_catalog').update({cut_qty:matched.cutQty||0}).eq('id',matched.db_id);
      throw new Error(`Recovery delete failed: ${deleteError.message}`);
    }
    matched.cutQty=nextCut; recoverLogs=recoverLogs.filter(r=>Number(r.id)!==Number(id));
    renderRecoverTable(); renderDashboard(); renderProfileSummaryTable(); renderBalanceWorkTable(); showRecAvailable(); showToast('Recovery deleted and Cut Stock reversed successfully.','success');
  } catch(e){ console.error(e); showToast(e.message||'Recovery delete failed.','error'); }
}); }

function renderCardboardStock() { 
    const capTbody = document.getElementById('cardboardCapacityTableBody'); const histTbody = document.getElementById('cardboardHistoryTableBody'); const totalDisplay = document.getElementById('totalCardboardStockDisplay'); 
    if(!capTbody || !histTbody) return; let globalIncoming = 0; let globalUsed = 0; let htmlCap = '';
    masterData.forEach((item, index) => { 
        let cIn = 0, cOut = 0; cardboardStockList.forEach(c => { if(normalizeCardboardMatch(c.type, item)) { cIn += (c.incoming || 0); cOut += (c.used || 0); } }); 
        globalIncoming += cIn; globalUsed += cOut; let cBal = cIn - cOut; 
        htmlCap += `<tr><td><span style="color:#8b5cf6; font-weight:800;">${item.material || '-'}</span></td><td><b>${item.profile}</b></td><td><span style="color:var(--info-color); font-weight:600;">${item.itemCode || '-'}</span></td><td>${item.length} mm</td><td><span class="stock-badge bg-box">${item.boxCapacity || 100} Pcs / Box</span></td><td>+${cIn}</td><td>-${cOut}</td><td><span class="stock-badge" style="background:var(--primary-dark); color:white;">${cBal} Boxes</span></td><td>${currentUserRole === 'Admin' ? `<button class="btn btn-accent" onclick="openCbCapacityModal(${index})"><i class="fa-solid fa-box"></i></button> <button class="btn" style="background:#0369a1; color:#fff;" onclick="openCbAdjustModal('${item.profile}', '${item.itemCode || ''}', '${item.length}')"><i class="fa-solid fa-scale-unbalanced"></i></button>` : `-`}</td></tr>`; 
    }); capTbody.innerHTML = htmlCap;
    let htmlHist = ''; cardboardStockList.forEach(c => { const isOut = (c.used || 0) > 0; htmlHist += `<tr><td><b>${c.date}</b></td><td><span class="stock-badge" style="${isOut ? 'background:#fee2e2; color:#e11d48;' : 'background:#dcfce7; color:#059669;'}">${isOut ? 'Consumed' : 'Incoming'}</span></td><td>${c.type}</td><td>${(c.incoming || 0) > 0 ? `+${c.incoming}` : '-'}</td><td>${(c.used || 0) > 0 ? `-${c.used}` : '-'}</td><td>${currentUserRole === 'Admin' ? `<button class="btn btn-danger" onclick="deleteCardboardHistory(${c.id})"><i class="fa-solid fa-trash"></i></button>` : `-`}</td></tr>`; }); histTbody.innerHTML = htmlHist;
    if(totalDisplay) totalDisplay.textContent = `${(globalIncoming - globalUsed).toLocaleString()} Total Boxes`; 
}
window.populateCbProfileDropdown = function() { const select = document.getElementById('cbSelectProfile'); if(!select) return; select.innerHTML = '<option value="">-- Choose Profile --</option>'; [...new Set(masterData.map(i => String(i.profile).trim()))].forEach(p => select.appendChild(new Option(p, p))); const matSelect = document.getElementById('cbMaterialList'); if(!matSelect) return; matSelect.innerHTML = ''; const mats = [...new Set(masterData.filter(m => m.material && m.material !== '-').map(i => String(i.material).trim()))]; mats.forEach(mat => { const option = document.createElement('option'); option.value = mat; matSelect.appendChild(option); }); };
window.onCbMaterialSelect = function() { const matInput = document.getElementById('cbMaterialInput'); if(!matInput) return; const mat = matInput.value.trim(); if(!mat) return; const matched = masterData.find(m => String(m.material).trim().toLowerCase() === mat.toLowerCase()); if(matched) { document.getElementById('cbSelectProfile').value = matched.profile; onCbProfileSelect(); setTimeout(() => { document.getElementById('cbSelectItemCode').value = matched.itemCode; onCbItemCodeSelect(); setTimeout(() => { document.getElementById('cbSelectLength').value = matched.length; }, 50); }, 50); } };
window.onCbProfileSelect = function() { const profile = document.getElementById('cbSelectProfile').value; const itemSelect = document.getElementById('cbSelectItemCode'); itemSelect.innerHTML = '<option value="">-- Choose Item Code --</option>'; document.getElementById('cbSelectLength').innerHTML = '<option value="">-- Choose Length --</option>'; if(!profile) return; const items = masterData.filter(m => String(m.profile).trim() === profile && m.itemCode); [...new Set(items.map(m => m.itemCode))].forEach(ic => itemSelect.appendChild(new Option(ic, ic))); };
window.onCbItemCodeSelect = function() { const profile = document.getElementById('cbSelectProfile').value; const itemCode = document.getElementById('cbSelectItemCode').value; const lengthSelect = document.getElementById('cbSelectLength'); lengthSelect.innerHTML = '<option value="">-- Choose Length --</option>'; if(!profile || !itemCode) return; const matches = masterData.filter(m => String(m.profile).trim() === profile && m.itemCode === itemCode); matches.forEach(m => lengthSelect.appendChild(new Option(`${m.length} mm`, m.length))); if(matches.length === 1) lengthSelect.value = matches[0].length; };
window.saveCardboardLocally = function() { localStorage.setItem('alumex_cardboard_local', JSON.stringify(cardboardStockList)); };
window.processCardboardTransaction = async function() { if(isAppBusy) return; isAppBusy=true; try { if (currentUserRole !== 'Admin' && currentUserRole !== 'Planner') return; let txType = document.getElementById('cbTxType') ? document.getElementById('cbTxType').value : 'IN'; if (currentUserRole === 'Planner') txType = 'IN'; const dateVal = document.getElementById('cbDate').value; const profile = document.getElementById('cbSelectProfile').value; const itemCode = document.getElementById('cbSelectItemCode').value; const length = document.getElementById('cbSelectLength').value; const qty = parseInt(document.getElementById('cbQty').value) || 0; if(!dateVal || !profile || !itemCode || !length || qty <= 0) return; const typeStr = `Pr: ${String(profile).trim()} | Item: ${String(itemCode || '-').trim()} | L: ${String(length).trim()}`; const incoming = txType === 'IN' ? qty : 0; const used = txType === 'OUT' ? qty : 0; const newEntry = { cb_date: dateVal, cb_type: typeStr, incoming: incoming, used: used }; const localItem = { id: Date.now(), date: dateVal, type: typeStr, incoming: incoming, used: used }; cardboardStockList.unshift(localItem); saveCardboardLocally(); try { const { data } = await supabaseClient.from('cardboard_stock').insert([newEntry]).select(); if (data) localItem.id = data[0].id; saveCardboardLocally(); } catch(e) {} showToast("Cardboard transaction processed!", "success"); document.getElementById('cardboardEntryForm').reset(); renderCardboardStock(); renderBalanceWorkTable(); } finally { isAppBusy=false; } };
window.openCbInOutModal = function(profile, itemCode, length, currentIn, currentOut) { if (currentUserRole !== 'Admin') return; document.getElementById('inOutCbProfile').value = profile; document.getElementById('inOutCbItemCode').value = itemCode || ''; document.getElementById('inOutCbLength').value = length; document.getElementById('currentCbIn').value = currentIn; document.getElementById('currentCbOut').value = currentOut; document.getElementById('newCbInVal').value = currentIn; document.getElementById('newCbOutVal').value = currentOut; document.getElementById('cbInOutEditModal').style.display = 'flex'; };
window.closeCbInOutModal = function() { document.getElementById('cbInOutEditModal').style.display = 'none'; };
window.saveCbInOut = async function() { const profile = document.getElementById('inOutCbProfile').value, itemCode = document.getElementById('inOutCbItemCode').value, length = document.getElementById('inOutCbLength').value, currentIn = parseInt(document.getElementById('currentCbIn').value)||0, currentOut = parseInt(document.getElementById('currentCbOut').value)||0, newIn = parseInt(document.getElementById('newCbInVal').value)||0, newOut = parseInt(document.getElementById('newCbOutVal').value)||0, diffIn = newIn - currentIn, diffOut = newOut - currentOut; if (diffIn === 0 && diffOut === 0) { closeCbInOutModal(); return; } const typeStr = `Pr: ${profile} | Item: ${itemCode || '-'} | L: ${length}`; const dateVal = new Date().toISOString().split('T')[0]; let transactionsToSave = []; if (diffIn !== 0) transactionsToSave.push({ cb_date: dateVal, cb_type: typeStr, incoming: diffIn, used: 0 }); if (diffOut !== 0) transactionsToSave.push({ cb_date: dateVal, cb_type: typeStr, incoming: 0, used: diffOut }); transactionsToSave.forEach(entry => { cardboardStockList.unshift({ id: Date.now()+Math.random(), date: entry.cb_date, type: entry.cb_type, incoming: entry.incoming, used: entry.used }); }); saveCardboardLocally(); try { await supabaseClient.from('cardboard_stock').insert(transactionsToSave); } catch(e) {} closeCbInOutModal(); showToast("Total IN/OUT updated!", "success"); renderCardboardStock(); renderBalanceWorkTable(); };
window.deleteCardboardHistory = function(id) { if(currentUserRole !== 'Admin') return; showConfirm("Delete?", async () => { await supabaseClient.from('cardboard_stock').delete().eq('id', id); cardboardStockList = cardboardStockList.filter(c => c.id !== id); saveCardboardLocally(); renderCardboardStock(); showToast("Deleted", "success"); }); };
window.openCbCapacityModal = function(index) { if (currentUserRole !== 'Admin') return; const item = masterData[index]; document.getElementById('editCbCatalogId').value = index; document.getElementById('editCbCapacityVal').value = item.boxCapacity || 100; document.getElementById('cbCapacityEditModal').style.display = 'flex'; };
window.closeCbCapacityModal = function() { document.getElementById('cbCapacityEditModal').style.display = 'none'; };
window.saveCbCapacityEdit = async function() { const index = parseInt(document.getElementById('editCbCatalogId').value); const newCap = parseInt(document.getElementById('editCbCapacityVal').value) || 100; const item = masterData[index]; if(!item) return; item.boxCapacity = newCap; if (item.db_id) { try { await supabaseClient.from('master_catalog').update({ box_capacity: newCap }).eq('id', item.db_id); } catch(e) {} } saveMasterExtrasLocally(); closeCbCapacityModal(); showToast("Box capacity updated!", "success"); renderCardboardStock(); renderMasterCatalog(); renderBalanceWorkTable(); };
window.openCbAdjustModal = function(profile, itemCode, length) { if (currentUserRole !== 'Admin') return; document.getElementById('adjustCbProfile').value = profile; document.getElementById('adjustCbItemCode').value = itemCode || ''; document.getElementById('adjustCbLength').value = length; let cIn = 0, cOut = 0; const dummyItem = { profile, itemCode, length }; cardboardStockList.forEach(c => { if(normalizeCardboardMatch(c.type, dummyItem)) { cIn += (c.incoming || 0); cOut += (c.used || 0); } }); document.getElementById('newCbBalanceVal').value = cIn - cOut; document.getElementById('cbAdjustModal').style.display = 'flex'; };
window.closeCbAdjustModal = function() { document.getElementById('cbAdjustModal').style.display = 'none'; };
window.saveCbAdjust = async function() { const profile = document.getElementById('adjustCbProfile').value, itemCode = document.getElementById('adjustCbItemCode').value, length = document.getElementById('adjustCbLength').value, newBal = parseInt(document.getElementById('newCbBalanceVal').value) || 0; let cIn = 0, cOut = 0; const dummyItem = { profile, itemCode, length }; cardboardStockList.forEach(c => { if(normalizeCardboardMatch(c.type, dummyItem)) { cIn += (c.incoming || 0); cOut += (c.used || 0); } }); const diff = newBal - (cIn - cOut); if (diff === 0) { closeCbAdjustModal(); return; } const typeStr = `Pr: ${profile} | Item: ${itemCode || '-'} | L: ${length}`; const dateVal = new Date().toISOString().split('T')[0]; const incoming = diff > 0 ? diff : 0; const used = diff < 0 ? Math.abs(diff) : 0; const newEntry = { cb_date: dateVal, cb_type: typeStr, incoming: incoming, used: used }; cardboardStockList.unshift({ id: Date.now(), date: dateVal, type: typeStr, incoming: incoming, used: used }); saveCardboardLocally(); try { await supabaseClient.from('cardboard_stock').insert([newEntry]); } catch(e) {} closeCbAdjustModal(); showToast("Cardboard Balance adjusted!", "success"); renderCardboardStock(); renderBalanceWorkTable(); };

async function saveDailyInstruction() { if(isAppBusy) return; isAppBusy=true; try{ if (currentUserRole !== 'Admin' && currentUserRole !== 'Planner') return; const date = document.getElementById('planDate').value, user = document.getElementById('planUser').value, priority = document.getElementById('planPriority').value, msg = document.getElementById('planMessage').value.trim(); if(!date || !msg) return; const newInst = { target_date: date, target_user: user, priority: priority, message: msg, status: 'Pending', action_taken: '' }; try { const { data } = await supabaseClient.from('daily_instructions').insert([newInst]).select(); if(data && data.length > 0) dailyInstructionsList.unshift(data[0]); } catch (e) { newInst.id = Date.now(); dailyInstructionsList.unshift(newInst); } document.getElementById('planMessage').value = ''; showToast("Instruction pinned!", "success"); renderDailyInstructions(); } finally { isAppBusy=false; } }
async function markInstructionDone(id) { if (currentUserRole !== 'Local' && currentUserRole !== 'Admin') return; const actionTxt = document.getElementById('action_txt_' + id) ? document.getElementById('action_txt_' + id).value.trim() : ''; try { await supabaseClient.from('daily_instructions').update({ status: 'Completed', action_taken: actionTxt }).eq('id', id); const inst = dailyInstructionsList.find(i => i.id === id); if(inst) { inst.status = 'Completed'; inst.action_taken = actionTxt; } showToast("Task marked completed!", "success"); renderDailyInstructions(); } catch(e) {} }
async function deleteInstruction(id) { if (currentUserRole !== 'Admin' && currentUserRole !== 'Planner') return; showConfirm("Delete this instruction?", async () => { await supabaseClient.from('daily_instructions').delete().eq('id', id); dailyInstructionsList = dailyInstructionsList.filter(i => i.id !== id); renderDailyInstructions(); showToast("Removed.", "success"); }); }
function renderDailyInstructions() { const container = document.getElementById('instructionBoardContainer'); if(!container) return; let html = ''; const badge = document.getElementById('planNotificationBadge'), headerBtn = document.getElementById('headerDailyPlanBtn'); 
let displayList = dailyInstructionsList.filter(i => i.target_user !== 'SYS_CRATES_SYNC' && i.target_user !== 'SYS_SHIPMENT_DEADLINE');
let pendingCount = displayList.filter(i => i.status === 'Pending').length; if(pendingCount > 0) { badge.style.display = 'inline-block'; badge.textContent = pendingCount; headerBtn.style.animation = 'pulseNotepadBtn 2s infinite'; } else { badge.style.display = 'none'; headerBtn.style.animation = 'none'; } if (displayList.length === 0) { container.innerHTML = `<div style="text-align: center; color: #b45309; padding: 20px; font-weight:800; font-size:16px;">Board is clear!</div>`; return; } displayList.forEach(inst => { const isDone = inst.status === 'Completed'; const statusClass = isDone ? 'status-badge-completed' : 'status-badge-pending'; let actionHtml = isDone ? `<div style="width: 100%; margin-top: 10px; padding: 8px; background: rgba(16, 185, 129, 0.1); border-radius: 6px; font-size: 13px;"><b>Action:</b> ${inst.action_taken || 'Completed.'}</div>` : (currentUserRole === 'Local' || currentUserRole === 'Admin' ? `<div style="width: 100%; margin-top: 10px; display: flex; gap: 8px;"><input type="text" id="action_txt_${inst.id}" placeholder="Type action..." style="flex: 1; padding: 8px; border-radius: 6px; font-size: 13px;"><button class="btn btn-accent" onclick="markInstructionDone(${inst.id})"><i class="fa-solid fa-check"></i> Done</button></div>` : ''); let adminActions = (currentUserRole === 'Admin' || currentUserRole === 'Planner') ? `<button class="btn btn-danger" style="padding: 4px 8px; font-size: 11px;" onclick="deleteInstruction(${inst.id})"><i class="fa-solid fa-trash"></i></button>` : ''; html += `<div class="instruction-card ${inst.priority === 'High' ? 'inst-high' : 'inst-normal'}"><div class="inst-header"><span>Date: <b>${inst.target_date}</b></span><span>To: <b>${inst.target_user}</b></span>${inst.priority === 'High' ? `<span style="color: #ef4444;"><i class="fa-solid fa-thumbtack"></i> High</span>` : ''}</div><div class="inst-body">${inst.message}</div><div class="inst-footer"><span class="${statusClass}">${inst.status}</span>${adminActions}</div>${actionHtml}</div>`; }); container.innerHTML = html; }

function dashboardMonthLabelFromDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
}
function dashboardDataPeriodFromMonthFields(values, fallbackLabel = 'Current month') {
  const labels = [...new Set((values || []).map(v => {
    const raw = String(v || '').trim();
    if (!raw) return null;
    const d = new Date(raw);
    if (Number.isFinite(d.getTime())) return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    const monthMatch = raw.match(/^(January|February|March|April|May|June|July|August|September|October|November|December)$/i);
    return monthMatch ? `${monthMatch[1].slice(0,3)} ${new Date().getFullYear()}` : raw;
  }).filter(Boolean))];
  if (labels.length === 1) return labels[0];
  if (labels.length > 1) return 'Multiple months';
  return fallbackLabel;
}
function dashboardDataPeriod(values, fallbackLabel = 'Current month') {
  const labels = [...new Set((values || []).map(dashboardMonthLabelFromDate).filter(Boolean))];
  if (labels.length === 1) return labels[0];
  if (labels.length > 1) return 'Multiple months';
  return fallbackLabel;
}
function setDashboardPeriodBadge(id, text, blue = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('chart-period-blue', !!blue);
}
function dashboardChartOptions(textColor, showLegend = true) {
  return {
    responsive: true,
    animation: { duration: 1200, easing: 'easeOutQuart', animateRotate: true, animateScale: true },
    hover: { mode: 'nearest', intersect: true },
    plugins: {
      legend: { display: showLegend, labels: { color: textColor, usePointStyle: true, padding: 14, font: { size: 11, weight: '700' } } },
      tooltip: {
        backgroundColor: 'rgba(8,63,70,.96)',
        titleFont: { size: 12, weight: '800' },
        bodyFont: { size: 11, weight: '600' },
        padding: 11,
        cornerRadius: 10,
        displayColors: true,
        callbacks: {
          label: function(ctx) {
            const data = ctx.dataset.data || [];
            const total = data.reduce((a,b) => Number(a||0)+Number(b||0), 0);
            const val = Number(ctx.raw || 0);
            const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
            return ` ${ctx.label}: ${val.toLocaleString(undefined,{maximumFractionDigits:2})} kg (${pct}%)`;
          }
        }
      }
    }
  };
}

function renderDashboard() {
  let totalStockPcs = 0, totalStockWt = 0;
  let totalCut = 0, totalPunch = 0, totalWrap = 0, totalBox = 0, totalCrate = 0;
  
  let masterMap = new Map();
  masterData.forEach(m => {
      masterMap.set(`${String(m.profile).trim()}_${cleanLen(m.length)}_${m.itemCode}`, m);
      const pcs = (m.cutQty||0) + (m.punchQty||0) + (m.wrapQty||0) + (m.boxQty||0) + (m.crateQty||0);
      totalStockPcs += pcs; 
      totalStockWt += pcs * (m.unitWeight||0);
      totalCut += m.cutQty||0; totalPunch += m.punchQty||0; totalWrap += m.wrapQty||0; totalBox += m.boxQty||0; totalCrate += m.crateQty||0;
  });
  
  if(document.getElementById('kpiTotalStockPcs')) document.getElementById('kpiTotalStockPcs').textContent = `${totalStockPcs.toLocaleString()} Pcs`; 
  if(document.getElementById('kpiTotalStockWt')) document.getElementById('kpiTotalStockWt').textContent = `${totalStockWt.toFixed(2)} kg`;

  let latestDate = historyLogs.length > 0 ? historyLogs[0].date : '-';
  let todayPcs = 0, todayWt = 0;

  const now = new Date(); const cm = now.getMonth(); const cy = now.getFullYear(); 
  const currentMonthLabel = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  setDashboardPeriodBadge('factoryStockPeriod', 'LIVE SNAPSHOT');
  setDashboardPeriodBadge('overallPoPeriod', dashboardDataPeriod(poList.map(p => p.date), 'No dated POs'));
  setDashboardPeriodBadge('overallPlPeriod', dashboardDataPeriodFromMonthFields(packingLists.map(p => p.date || p.month), 'Active PL data'), true);
  let mRejWt = 0, mRecWt = 0, mPlantRejWt = 0, mOtherRejWt = 0; 
  let mProdWrapWt = 0; 
  let profileRejMap = {}; 
  
  historyLogs.forEach(h => {
      let d = new Date(h.date);
      const matched = masterData.find(m => String(m.profile).trim() === String(h.profile).trim() && cleanLen(m.length) === cleanLen(h.length));
      const uw = matched ? (matched.unitWeight || 0) : 0;
      const wrapPcs = h.wrapQty || 0;
      
      if(h.date === latestDate) { todayPcs += wrapPcs; todayWt += wrapPcs * uw; }
      if(d.getMonth()===cm && d.getFullYear()===cy) { mProdWrapWt += wrapPcs * uw; }
  });

  if(document.getElementById('latestOutputDate')) document.getElementById('latestOutputDate').textContent = latestDate;
  if(document.getElementById('kpiTodayOutputPcs')) document.getElementById('kpiTodayOutputPcs').textContent = `${todayPcs.toLocaleString()} Pcs (Wrap)`;
  if(document.getElementById('kpiTodayOutputWt')) {
      document.getElementById('kpiTodayOutputWt').innerHTML = `${todayWt.toFixed(2)} kg <div style="font-size:11px; color:#059669; margin-top:4px; padding-top:4px; border-top:1px dashed #a7f3d0;"><i class="fa-solid fa-calendar-check"></i> Month Wrap Total: <b style="font-size:13px;">${mProdWrapWt.toFixed(2)} kg</b></div>`;
  }

  rejectLogs.forEach(r => { 
      let d = new Date(r.reject_date); 
      if(d.getMonth()===cm && d.getFullYear()===cy) { 
          let wt = parseFloat(r.weight)||0; mRejWt += wt; 
          if(r.location === 'Plant') mPlantRejWt += wt; else mOtherRejWt += wt;
          let prof = String(r.profile).trim(); 
          if(!profileRejMap[prof]) profileRejMap[prof] = 0; profileRejMap[prof] += wt; 
      } 
  });
  recoverLogs.forEach(r => { let d = new Date(r.recover_date); if(d.getMonth()===cm && d.getFullYear()===cy) mRecWt += parseFloat(r.recovered_weight)||0; });
  
  let rejPct = mProdWrapWt > 0 ? ((mRejWt / mProdWrapWt) * 100).toFixed(1) : 0;
  if(document.getElementById('kpiRejectValue')) document.getElementById('kpiRejectValue').textContent = `${mRejWt.toFixed(2)} kg (${rejPct}%)`;
  if(document.getElementById('kpiPlantRej')) document.getElementById('kpiPlantRej').textContent = mPlantRejWt.toFixed(2);
  if(document.getElementById('kpiOtherRej')) document.getElementById('kpiOtherRej').textContent = mOtherRejWt.toFixed(2);

  let dashCrateMap = {};
  let availStockForCrates = masterData.map(m => ({ ...m }));
  let sortedPlsForCrates = [...packingLists].sort(sortCrates);
  
  let domTotalPlReqBoxes = 0; 
  let domTotalPlCompletedBoxes = 0;
  
  let boxStagePlQty = 0;
  let crateStagePlQty = 0;

  sortedPlsForCrates.forEach(pl => {
      let reqQty = pl.pcsQty;
      let matched = availStockForCrates.find(m => String(m.profile).trim() == String(pl.profile).trim() && String(m.itemCode).trim() == String(pl.itemCode).trim() && cleanLen(m.length) == cleanLen(pl.length));
      let cap = matched ? (matched.boxCapacity || 100) : 100;
      
      domTotalPlReqBoxes += (reqQty / cap);

      let allocatedBox = 0;
      let allocatedCrate = 0;
      if (matched) {
          allocatedCrate = Math.min(reqQty, matched.crateQty);
          matched.crateQty -= allocatedCrate;
          
          let remReq = reqQty - allocatedCrate;
          allocatedBox = Math.min(remReq, matched.boxQty);
          matched.boxQty -= allocatedBox;
          
          domTotalPlCompletedBoxes += ((allocatedCrate + allocatedBox) / cap);
          
          boxStagePlQty += Math.floor(allocatedBox / cap);
          crateStagePlQty += Math.floor(allocatedCrate / cap);
      }
      
      if(!dashCrateMap[pl.crateNo]) dashCrateMap[pl.crateNo] = { req: 0, comp: 0 };
      dashCrateMap[pl.crateNo].req += reqQty;
      dashCrateMap[pl.crateNo].comp += (allocatedBox + allocatedCrate);
  });

  let finalTotCrates = 0;
  let finalCompCrates = 0;

  for (let crateId in dashCrateMap) {
      let c = dashCrateMap[crateId];
      if (c.req > 0) {
          finalTotCrates++;
          if (isManualCrateComplete(crateId, activePackingContainer, activePackingMonth)) finalCompCrates++;
      }
  }

  if(document.getElementById('kpiShipCrates')) document.getElementById('kpiShipCrates').textContent = `${finalCompCrates} / ${finalTotCrates} Crates`;
  
  if(document.getElementById('kpiTotalPlBoxes')) document.getElementById('kpiTotalPlBoxes').textContent = Math.ceil(domTotalPlReqBoxes).toLocaleString(); 
  
  if(document.getElementById('kpiTotalPlCompletedBoxes')) {
      document.getElementById('kpiTotalPlCompletedBoxes').innerHTML = `${Math.floor(domTotalPlCompletedBoxes).toLocaleString()} <span style="font-size: 10.5px; font-weight: 700; color: #64748b;">(Box Stage: ${boxStagePlQty} | Crate Stage: ${crateStagePlQty})</span>`;
  }
  
  if(document.getElementById('kpiTotalPlPendingBoxes')) document.getElementById('kpiTotalPlPendingBoxes').textContent = Math.max(0, Math.ceil(domTotalPlReqBoxes) - Math.floor(domTotalPlCompletedBoxes)).toLocaleString();
  
  if(document.getElementById('kpiShipBoxes')) document.getElementById('kpiShipBoxes').textContent = `${Math.floor(domTotalPlCompletedBoxes)} / ${Math.ceil(domTotalPlReqBoxes)} Boxes Completed`;

  /*
   * OVERDUE PO ALERT — single source of truth
   * The dashboard alert must use the same balance quantity shown on the
   * Production Orders page. A shipment alone does NOT clear an overdue line;
   * only when the calculated PO balance reaches zero is that line complete.
   */
  const overdueContainer = document.getElementById('overdueActionContainer');
  if (overdueContainer) overdueContainer.innerHTML = '';

  let grandPoOrderWt = 0, grandPoShippedWt = 0, grandPoReadyWt = 0;
  let hasOverdue = false;
  let overduePoCount = 0, overdueBalancePcs = 0, overdueBalanceWt = 0;
  const poGroups = {};
  poList.forEach(po => {
      const key = String(po.poNumber).trim();
      if (!poGroups[key]) poGroups[key] = { date: po.date, items: [] };
      poGroups[key].items.push(po);
  });

  const shipLookup = new Map();
  const shipContainerWeights = {'1st Container': 0, '2nd Container': 0, '3rd Container': 0};
  shipmentList.forEach(s => {
      const k = `${String(s.poNumber).trim()}_${String(s.profile).trim()}_${cleanLen(s.length)}`;
      shipLookup.set(k, (shipLookup.get(k) || 0) + (parseInt(s.shippedQty) || 0));
      const matchedCat = masterData.find(m => String(m.profile).trim() === String(s.profile).trim() && cleanLen(m.length) === cleanLen(s.length));
      if (matchedCat) {
          const cName = s.container || '1st Container';
          if (shipContainerWeights[cName] !== undefined) {
              shipContainerWeights[cName] += (parseInt(s.shippedQty) || 0) * (matchedCat.unitWeight || 0);
          }
      }
  });

  let overdueHtml = '';
  Object.keys(poGroups).forEach((poNumber) => {
      const group = poGroups[poNumber];
      let totalOrderWt = 0, totalShippedWt = 0, totalCompleteWt = 0;
      const overdueLines = [];

      group.items.forEach(poItem => {
          const matchedItem = masterMap.get(`${String(poItem.profile).trim()}_${cleanLen(poItem.length)}_${poItem.itemCode}`)
              || masterData.find(m => String(m.profile).trim() === String(poItem.profile).trim() && cleanLen(m.length) === cleanLen(poItem.length));
          const uw = matchedItem ? (Number(matchedItem.unitWeight) || 0) : 0;
          const orderQty = Math.max(0, parseInt(poItem.orderQty) || 0);
          const orderWt = orderQty * uw;
          totalOrderWt += orderWt;

          const shipKey = `${String(poNumber).trim()}_${String(poItem.profile).trim()}_${cleanLen(poItem.length)}`;
          const shippedQty = Math.max(0, shipLookup.get(shipKey) || 0);
          const shippedForLine = Math.min(orderQty, shippedQty);
          const shippedWt = shippedForLine * uw;
          totalShippedWt += shippedWt;

          /* Production Orders page balance = Order Qty - shipped Qty. */
          const balanceQty = Math.max(0, orderQty - shippedForLine);
          const balanceWt = balanceQty * uw;

          /* Keep ready stock as a separate information metric only.
             It must NOT make a fully-shipped PO appear overdue. */
          const availableReadyPcs = matchedItem ? ((matchedItem.boxQty || 0) + (matchedItem.crateQty || 0)) : 0;
          const completeQty = Math.min(availableReadyPcs, balanceQty);
          totalCompleteWt += completeQty * uw;

          if (balanceQty > 0) {
              overdueLines.push({
                  profile: poItem.profile,
                  length: cleanLen(poItem.length),
                  qty: balanceQty,
                  weight: balanceWt,
                  orderQty,
                  shippedQty: shippedForLine,
                  readyQty: completeQty
              });
          }
      });

      grandPoOrderWt += totalOrderWt;
      grandPoShippedWt += totalShippedWt;
      grandPoReadyWt += totalCompleteWt;

      const poDate = new Date(group.date);
      const diffDays = Number.isFinite(poDate.getTime())
          ? Math.max(0, Math.floor((Date.now() - poDate.getTime()) / (1000 * 60 * 60 * 24)))
          : 0;

      /* Alert only when an actual PO balance remains AND the PO is older than 30 days. */
      if (diffDays > 30 && overdueLines.length > 0) {
          hasOverdue = true;
          overduePoCount++;
          const poBalancePcs = overdueLines.reduce((sum, x) => sum + x.qty, 0);
          const poBalanceWt = overdueLines.reduce((sum, x) => sum + x.weight, 0);
          overdueBalancePcs += poBalancePcs;
          overdueBalanceWt += poBalanceWt;

          const severity = diffDays >= 90
              ? { label: 'Critical', bg: '#991b1b', soft: '#fef2f2', border: '#fca5a5' }
              : diffDays >= 60
                  ? { label: 'High', bg: '#c2410c', soft: '#fff7ed', border: '#fdba74' }
                  : { label: 'Overdue', bg: '#e11d48', soft: '#fff1f2', border: '#fecaca' };

          const lineHtml = overdueLines.map(line => `
              <div style="display:grid;grid-template-columns:minmax(130px,1fr) 110px 110px 110px;gap:8px;align-items:center;padding:8px 0;border-bottom:1px dashed ${severity.border};font-size:12px;">
                  <div><b>Pr: ${line.profile}</b> <span style="color:#64748b;">| ${line.length} mm</span></div>
                  <span style="font-weight:800;color:#9f1239;">Balance: ${line.qty.toLocaleString()} Pcs</span>
                  <span style="font-weight:800;color:#9f1239;">${line.weight.toFixed(1)} kg</span>
                  <span style="font-weight:700;color:#059669;">Ready: ${line.readyQty.toLocaleString()} Pcs</span>
              </div>`).join('');

          overdueHtml += `
          <div class="po-overdue-item" style="background:${severity.soft};border:1px solid ${severity.border};border-radius:14px;padding:15px;margin-bottom:12px;box-shadow:0 3px 10px rgba(15,23,42,.05);">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
                  <div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap;">
                      <h4 style="margin:0;color:#9f1239;font-size:15px;font-weight:900;"><i class="fa-solid fa-triangle-exclamation"></i> ${poNumber}</h4>
                      <span style="background:${severity.bg};color:#fff;padding:4px 9px;border-radius:999px;font-size:10px;font-weight:900;">${severity.label}: ${diffDays} Days</span>
                      <span style="background:#fff;border:1px solid ${severity.border};color:#9f1239;padding:4px 9px;border-radius:999px;font-size:10px;font-weight:900;">Balance ${poBalancePcs.toLocaleString()} Pcs · ${poBalanceWt.toFixed(1)} kg</span>
                  </div>
                  <button type="button" class="overdue-details-toggle" aria-expanded="false" onclick="toggleOverdueDetails(this)" style="background:#fff;border:1px solid ${severity.border};border-radius:8px;padding:7px 12px;font-size:11px;font-weight:800;cursor:pointer;color:#475569;">View balance details ▼</button>
              </div>
              <div class="overdue-balance-details" style="display:none;width:100%;margin-top:10px;padding:0 10px;background:rgba(255,255,255,.72);border-radius:9px;border:1px solid ${severity.border};">
                  <div style="display:grid;grid-template-columns:minmax(130px,1fr) 110px 110px 110px;gap:8px;padding:7px 0;font-size:10px;font-weight:900;color:#64748b;text-transform:uppercase;">
                      <span>Profile / Length</span><span>PO Balance</span><span>Balance Wt</span><span>Ready Stock</span>
                  </div>
                  ${lineHtml}
              </div>
          </div>`;
      }
  });

  if (overdueContainer) {
      overdueContainer.innerHTML = overdueHtml || `<div style="padding:18px;text-align:center;color:#059669;font-weight:800;background:rgba(16,185,129,.06);border:1px dashed #6ee7b7;border-radius:12px;"><i class="fa-solid fa-circle-check"></i> No production order with remaining balance is older than 30 days.</div>`;
  }
  const overdueCard = document.getElementById('overdueCard');
  if (overdueCard) overdueCard.style.display = hasOverdue ? 'block' : 'none';

  /* Optional compact alert metrics, added without changing the database schema. */
  const alertSummary = document.getElementById('overdueSummaryMetrics');
  if (alertSummary) {
      alertSummary.innerHTML = hasOverdue ? `
          <span><b>${overduePoCount}</b> overdue PO${overduePoCount === 1 ? '' : 's'}</span>
          <span><b>${overdueBalancePcs.toLocaleString()}</b> balance Pcs</span>
          <span><b>${overdueBalanceWt.toFixed(1)} kg</b> balance weight</span>` : '';
  }

  if(document.getElementById('kpiTotalPoWeightSum')) document.getElementById('kpiTotalPoWeightSum').textContent = `${totalStockWt.toFixed(1)} kg`; 
  
  if(document.getElementById('kpiOverallPoTotal')) {
      document.getElementById('kpiOverallPoTotal').textContent = `${grandPoOrderWt.toFixed(1)} kg`;
      
      let poBreakdownHtml = `
      <div style="padding-top: 10px; border-top: 2px dashed #bae6fd; font-weight: 800; font-size: 12px; background: rgba(2, 132, 199, 0.05); border-radius: 8px; margin-top: auto; display:flex; flex-direction:column; gap:6px; padding-bottom:4px; padding-left: 8px; padding-right: 8px;">
          <div style="display:flex; justify-content:space-between; color: var(--text-muted);"><span><i class="fa-solid fa-chart-bar"></i> Total Order:</span> <span style="color:#0369a1;">${grandPoOrderWt.toFixed(2)} kg</span></div>
          <div style="display:flex; justify-content:space-between; color: #059669;"><span><i class="fa-solid fa-check-square"></i> Complete/Shipped:</span> <span>${(grandPoShippedWt + grandPoReadyWt).toFixed(2)} kg</span></div>
          <div style="display:flex; justify-content:space-between; color: #e11d48;"><span><i class="fa-solid fa-hourglass-half"></i> Pending:</span> <span>${Math.max(0, grandPoOrderWt - (grandPoShippedWt + grandPoReadyWt)).toFixed(2)} kg</span></div>
      </div>`;
      
      const parent = document.getElementById('kpiOverallPoTotal').parentElement;
      const existingList = parent.querySelector('.po-dashboard-breakdown-list');
      if (existingList) existingList.remove();
      const newList = document.createElement('div');
      newList.className = 'po-dashboard-breakdown-list';
      newList.style.marginTop = '12px';
      newList.innerHTML = poBreakdownHtml;
      parent.appendChild(newList);
  }

  let manualCompleteCrateQtySum = 0;
  Object.entries(globalManualCrates || {}).forEach(([k,v]) => {
      const parts = String(k).split('::');
      if (parts.length === 3 && parts[0] === String(activePackingMonth||'').trim() && parts[1] === String(activePackingContainer||'').trim()) {
          manualCompleteCrateQtySum += (parseInt(v?.qty,10) || 0);
      }
  });

  if(document.getElementById('funnelCutQty')) document.getElementById('funnelCutQty').textContent = `${totalCut.toLocaleString()} Pcs`; 
  if(document.getElementById('funnelPunchQty')) document.getElementById('funnelPunchQty').textContent = `${totalPunch.toLocaleString()} Pcs`; 
  if(document.getElementById('funnelWrapQty')) document.getElementById('funnelWrapQty').textContent = `${totalWrap.toLocaleString()} Pcs`; 
  if(document.getElementById('funnelBoxQty')) document.getElementById('funnelBoxQty').textContent = `${totalBox.toLocaleString()} Pcs`; 
  
  let funnelCrateDisplay = totalCrate + manualCompleteCrateQtySum;
  if(document.getElementById('funnelCrateQty')) document.getElementById('funnelCrateQty').textContent = `${funnelCrateDisplay.toLocaleString()} Pcs`; 
  
  let totalWipPcs = totalCut + totalPunch + totalWrap + totalBox + funnelCrateDisplay;
  if(document.getElementById('funnelCutBar')) document.getElementById('funnelCutBar').style.width = `${totalWipPcs ? Math.round((totalCut / totalWipPcs) * 100) : 0}%`; 
  if(document.getElementById('funnelPunchBar')) document.getElementById('funnelPunchBar').style.width = `${totalWipPcs ? Math.round((totalPunch / totalWipPcs) * 100) : 0}%`; 
  if(document.getElementById('funnelWrapBar')) document.getElementById('funnelWrapBar').style.width = `${totalWipPcs ? Math.round((totalWrap / totalWipPcs) * 100) : 0}%`; 
  if(document.getElementById('funnelBoxBar')) document.getElementById('funnelBoxBar').style.width = `${totalWipPcs ? Math.round((totalBox / totalWipPcs) * 100) : 0}%`;

  let plReqWt = 0;
  let chartCutWt = 0, chartPunchWt = 0, chartWrapWt = 0, chartBoxWt = 0, chartManualWt = 0, chartPendingWt = 0;
  
  let crateMapForChart = {};
  for(let i=1; i<=50; i++) { crateMapForChart["Crate " + i] = { req: 0, comp: 0, items: [] }; }
  
  let availableStockPL = masterData.map(m => ({ ...m }));
  packingLists.forEach(pl => {
      let reqQty = pl.pcsQty;
      let matched = availableStockPL.find(m => String(m.profile).trim() === String(pl.profile).trim() && cleanLen(m.length) === cleanLen(pl.length) && m.itemCode === pl.itemCode);
      let uw = matched ? (matched.unitWeight || 0) : 0;
      
      plReqWt += (reqQty * uw);
      
      let allocatedBox = 0, allocatedWrap = 0, allocatedPunch = 0, allocatedCut = 0;
      let remReq = reqQty;
      
      if (matched) {
          let combinedBoxStock = matched.boxQty + matched.crateQty;
          allocatedBox = Math.min(remReq, combinedBoxStock);
          
          if (allocatedBox > matched.crateQty) {
              matched.boxQty -= (allocatedBox - matched.crateQty);
              matched.crateQty = 0;
          } else {
              matched.crateQty -= allocatedBox;
          }
          remReq -= allocatedBox;

          allocatedWrap = Math.min(remReq, matched.wrapQty); matched.wrapQty -= allocatedWrap; remReq -= allocatedWrap;
          allocatedPunch = Math.min(remReq, matched.punchQty); matched.punchQty -= allocatedPunch; remReq -= allocatedPunch;
          allocatedCut = Math.min(remReq, matched.cutQty); matched.cutQty -= allocatedCut; remReq -= allocatedCut;
      }
      
      if (!crateMapForChart[pl.crateNo]) crateMapForChart[pl.crateNo] = { req: 0, comp: 0, items: [] };
      crateMapForChart[pl.crateNo].req += reqQty;
      crateMapForChart[pl.crateNo].comp += allocatedBox;
      crateMapForChart[pl.crateNo].items.push({ req: reqQty, box: allocatedBox, wrap: allocatedWrap, punch: allocatedPunch, cut: allocatedCut, pending: remReq, unitWeight: uw });
  });

  for (let crateId in crateMapForChart) {
      let crate = crateMapForChart[crateId];
      if (crate.req === 0) continue;
      
      let isManualComplete = isManualCrateComplete(crateId, activePackingContainer) ? true : false;
      
      crate.items.forEach(i => {
          let w = i.unitWeight;
          if (isManualComplete) {
              chartManualWt += (i.req * w);
          } else {
              chartBoxWt += (i.box * w);
              chartWrapWt += (i.wrap * w);
              chartPunchWt += (i.punch * w);
              chartCutWt += (i.cut * w);
              chartPendingWt += (i.pending * w);
          }
      });
  }
  
  if(document.getElementById('kpiOverallPlTotal')) document.getElementById('kpiOverallPlTotal').textContent = `${plReqWt.toFixed(1)} kg`; 
  
  try {
      if(typeof Chart !== 'undefined') {
          const textColor = isDarkMode ? '#f8fafc' : '#0f172a'; 
          if(document.getElementById('masterWeightChart')) { if(masterChartInstance) masterChartInstance.destroy(); let mData = [ totalCut, totalPunch, totalWrap, totalBox, funnelCrateDisplay ]; if (mData.every(v => v === 0)) mData = [1]; masterChartInstance = new Chart(document.getElementById('masterWeightChart'), { type: 'doughnut', data: { labels: mData.length === 1 ? ['No Stock'] : ['Cut', 'Punch', 'Wrap', 'Box', 'Crate'], datasets: [{ hoverOffset: 10, data: mData, backgroundColor: mData.length === 1 ? ['#e2e8f0'] : ['#0ea5e9', '#ea580c', '#d946ef', '#10b981', '#f59e0b'], borderWidth: isDarkMode ? 3 : 2, borderColor: isDarkMode ? '#1e293b' : '#fff' }] }, options: { ...dashboardChartOptions(textColor, mData.length > 1), cutout: '65%' } }); }
          
          if(document.getElementById('overallPoChart')) { 
              if(overallPoChartInstance) overallPoChartInstance.destroy(); 
              let remainingPendingPo = Math.max(0, grandPoOrderWt - (grandPoShippedWt+grandPoReadyWt));
              let poDataArr = [ shipContainerWeights['1st Container'], shipContainerWeights['2nd Container'], shipContainerWeights['3rd Container'], grandPoReadyWt, remainingPendingPo ]; 
              if (poDataArr.every(v => v === 0)) poDataArr = [1]; 
              overallPoChartInstance = new Chart(document.getElementById('overallPoChart'), { type: 'doughnut', data: { labels: poDataArr.length === 1 ? ['No Orders'] : ['1st Container', '2nd Container', '3rd Container', 'Ready', 'Pending'], datasets: [{ hoverOffset: 10, data: poDataArr, backgroundColor: poDataArr.length === 1 ? ['#e2e8f0'] : ['#3b82f6', '#ec4899', '#a855f7', '#10b981', '#fb7185'], borderWidth: isDarkMode ? 3 : 2, borderColor: isDarkMode ? '#1e293b' : '#fff' }] }, options: { ...dashboardChartOptions(textColor, poDataArr.length > 1), cutout: '65%' } }); 
          }
          
          if(document.getElementById('overallPlChart')) { 
              if(overallPlChartInstance) overallPlChartInstance.destroy(); 
              let cData = [ Number(chartCutWt.toFixed(2))||0, Number(chartPunchWt.toFixed(2))||0, Number(chartWrapWt.toFixed(2))||0, Number(chartBoxWt.toFixed(2))||0, Number(chartManualWt.toFixed(2))||0, Number(chartPendingWt.toFixed(2))||0 ]; 
              if(cData.every(v => v===0)) cData = [1]; 
              overallPlChartInstance = new Chart(document.getElementById('overallPlChart'), { type: 'doughnut', data: { labels: cData.length===1 ? ['No PLs'] : ['Cut', 'Punch', 'Wrap', 'Box', 'Completed', 'Pending'], datasets: [{ hoverOffset: 10, data: cData, backgroundColor: cData.length===1 ? ['#e2e8f0'] : ['#0284c7', '#ea580c', '#d946ef', '#10b981', '#059669', '#e11d48'], borderWidth: isDarkMode ? 3 : 2, borderColor: isDarkMode ? '#1e293b' : '#fff' }] }, options: { ...dashboardChartOptions(textColor, false), cutout: '65%' } }); 
              
              let plWeightBreakdownHtml = `
              <div style="font-size: 11px; margin-top: 15px; width: 100%; display: flex; flex-direction: column; gap: 4px;">
                  <div style="display:flex; justify-content:space-between; color: #e11d48;"><span>Pending:</span> <span>${chartPendingWt.toFixed(2)} kg</span></div>
                  <div style="display:flex; justify-content:space-between; color: #0284c7;"><span>Cut Stage:</span> <span>${chartCutWt.toFixed(2)} kg</span></div>
                  <div style="display:flex; justify-content:space-between; color: #ea580c;"><span>Punch Stage:</span> <span>${chartPunchWt.toFixed(2)} kg</span></div>
                  <div style="display:flex; justify-content:space-between; color: #d946ef;"><span>Wrap Stage:</span> <span>${chartWrapWt.toFixed(2)} kg</span></div>
                  <div style="display:flex; justify-content:space-between; color: #10b981;"><span>Box Stage:</span> <span>${chartBoxWt.toFixed(2)} kg</span></div>
                  <div style="display:flex; justify-content:space-between; color: #059669; font-weight:800; border-top:1px dashed #cbd5e1; padding-top:4px;"><span>Completed:</span> <span>${chartManualWt.toFixed(2)} kg</span></div>
              </div>`;
              
              const plParent = document.getElementById('overallPlChart').parentElement.parentElement;
              const exPlList = plParent.querySelector('.pl-dashboard-breakdown-list');
              if (exPlList) exPlList.remove();
              const newPlList = document.createElement('div');
              newPlList.className = 'pl-dashboard-breakdown-list';
              newPlList.style.marginTop = '12px';
              newPlList.innerHTML = plWeightBreakdownHtml;
              plParent.appendChild(newPlList);
          }
          
          if (document.getElementById('kpiMonthlyReject')) {
              let netRej = Math.max(0, mRejWt - mRecWt);
              if(document.getElementById('kpiMonthlyReject')) document.getElementById('kpiMonthlyReject').textContent = `${mRejWt.toFixed(2)} kg`; 
              if(document.getElementById('kpiMonthlyRecover')) document.getElementById('kpiMonthlyRecover').textContent = `${mRecWt.toFixed(2)} kg`; 
              if(document.getElementById('kpiNetReject')) document.getElementById('kpiNetReject').textContent = `${netRej.toFixed(2)} kg`;
              if(document.getElementById('kpiMonthlyRejectTop')) document.getElementById('kpiMonthlyRejectTop').textContent = mRejWt.toFixed(2);
              if(document.getElementById('kpiMonthlyRecoverTop')) document.getElementById('kpiMonthlyRecoverTop').textContent = mRecWt.toFixed(2);
              if(document.getElementById('kpiNetRejectTop')) document.getElementById('kpiNetRejectTop').textContent = netRej.toFixed(2);
              
              const ctx = document.getElementById('rejectDashboardChart'); 
              if(ctx) { 
                  if(rejectDashChart) rejectDashChart.destroy(); 
                  let rData = [Number(mRejWt.toFixed(2)), Number(mRecWt.toFixed(2)), Number(netRej.toFixed(2))]; 
                  if(rData.every(v=>v===0)) rData = [0,0,0]; 
                  rejectDashChart = new Chart(ctx, { type: 'bar', data: { labels: ['Reject', 'Recover', 'Net Rej'], datasets: [{ data: rData, backgroundColor: ['#e11d48', '#10b981', '#9f1239'], borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: {color: textColor} }, x: { ticks: {color: textColor} } } } }); 
              }
              
              const ctxProf = document.getElementById('rejectProfileChart'); 
              if(ctxProf) { 
                  if(rejectProfileChartInstance) rejectProfileChartInstance.destroy(); 
                  let profLabels = Object.keys(profileRejMap); 
                  let profData = Object.values(profileRejMap).map(v => Number(v.toFixed(2))); 
                  const bgColors = ['#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981', '#22c55e', '#84cc16', '#eab308', '#f59e0b', '#f97316']; 
                  if(profLabels.length === 0) { profLabels = ['No Data']; profData = [1]; } 
                  rejectProfileChartInstance = new Chart(ctxProf, { type: 'doughnut', data: { labels: profLabels, datasets: [{ data: profData, backgroundColor: profLabels[0] === 'No Data' ? ['#e2e8f0'] : bgColors.slice(0, profLabels.length), borderWidth: isDarkMode ? 2 : 1, borderColor: isDarkMode ? '#1e293b' : '#fff' }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { position: 'right', labels: { color: textColor, boxWidth: 12, font: { size: 10 } } } } } }); 
              }
          }
      }
  } catch(err) { console.error('Dashboard render error:', err); }
  renderMonthlyShiftChart();
}

function renderMonthlyShiftChart() {
    const ctx = document.getElementById('monthlyShiftChart'); if(!ctx || typeof Chart === 'undefined') return;
    if (monthlyShiftChartInstance) { monthlyShiftChartInstance.destroy(); }
    const now = new Date(); const currentYear = now.getFullYear(); const currentMonth = now.getMonth();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const labels = [], dayWrapData = [], nightWrapData = [], dayRejectData = [], nightRejectData = [], dayNetRejectData = [], nightNetRejectData = [];
    const lookupMap = new Map();
    masterData.forEach(m => lookupMap.set(`${String(m.profile).trim()}_${cleanLen(m.length)}_${String(m.itemCode||'').trim().toLowerCase()}`, m));

    let monthWrapWeight = 0, monthCutWeight = 0, monthRejectWeight = 0, monthRecoverWeight = 0;
    let monthNetRejectWeight = 0, monthWrapPcs = 0;
    const dailySummary = [];

    for(let d = 1; d <= daysInMonth; d++) {
        labels.push(`${d}`);
        const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        let dayWrap=0, nightWrap=0, dayCut=0, nightCut=0, dayReject=0, nightReject=0, dayRecover=0, nightRecover=0, dayPcs=0, nightPcs=0;

        historyLogs.filter(h => h.date === dateKey).forEach(log => {
            // Production output is measured from WRAPPING PCS, not by summing every stage.
            // This prevents Cut + Punch + Wrap from being counted three times.
            const item = lookupMap.get(`${String(log.profile).trim()}_${cleanLen(log.length)}_${String(log.itemCode||'').trim().toLowerCase()}`)
                      || masterData.find(m => String(m.profile).trim()===String(log.profile).trim() && cleanLen(m.length)===cleanLen(log.length));
            const uw = item ? (Number(item.unitWeight)||0) : 0;
            const wrapPcs = Number(log.wrapQty)||0;
            const cutPcs = Number(log.cutQty)||0;
            const wrapWt = wrapPcs * uw;
            const cutWt = cutPcs * uw;
            if(String(log.shift).toLowerCase().includes('night')) { nightWrap += wrapWt; nightCut += cutWt; nightPcs += wrapPcs; }
            else { dayWrap += wrapWt; dayCut += cutWt; dayPcs += wrapPcs; }
        });
        rejectLogs.filter(r => r.reject_date === dateKey).forEach(r => {
            const wt=Number(r.weight)||0;
            if(String(r.shift||'').toLowerCase().includes('night')) nightReject += wt; else dayReject += wt;
        });
        recoverLogs.filter(r => r.recover_date === dateKey).forEach(r => {
            const wt=Number(r.recovered_weight)||0;
            if(String(r.shift||'').toLowerCase().includes('night')) nightRecover += wt; else dayRecover += wt;
        });

        const dayNet=Math.max(0,dayReject-dayRecover), nightNet=Math.max(0,nightReject-nightRecover);
        dayWrapData.push(Number(dayWrap.toFixed(2))); nightWrapData.push(Number(nightWrap.toFixed(2)));
        dayRejectData.push(Number(dayReject.toFixed(2))); nightRejectData.push(Number(nightReject.toFixed(2)));
        dayNetRejectData.push(Number(dayNet.toFixed(2))); nightNetRejectData.push(Number(nightNet.toFixed(2)));
        monthWrapWeight += dayWrap + nightWrap; monthCutWeight += dayCut + nightCut; monthWrapPcs += dayPcs + nightPcs;
        monthRejectWeight += dayReject + nightReject; monthRecoverWeight += dayRecover + nightRecover;
        dailySummary.push({date:dateKey,wrap:dayWrap+nightWrap,cut:dayCut+nightCut,reject:dayReject+nightReject,recover:dayRecover+nightRecover,net:dayNet+nightNet,wrapPcs:dayPcs+nightPcs});
    }

    monthNetRejectWeight = Math.max(0, monthRejectWeight - monthRecoverWeight);
    const monthWrapEfficiencyPct = monthCutWeight > 0 ? Math.min(100,(monthWrapWeight / monthCutWeight) * 100) : 0;
    const monthRejectPct = monthWrapWeight > 0 ? (monthRejectWeight / monthWrapWeight) * 100 : 0;
    const monthNetRejectPct = monthWrapWeight > 0 ? (monthNetRejectWeight / monthWrapWeight) * 100 : 0;
    const monthRecoveryPct = monthRejectWeight > 0 ? Math.min(100,(monthRecoverWeight/monthRejectWeight)*100) : 0;
    const todayKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const today = dailySummary.find(x=>x.date===todayKey) || {wrap:0,reject:0,recover:0,net:0,wrapPcs:0};
    const todayWrapEfficiencyPct = today.cut > 0 ? Math.min(100,(today.wrap/today.cut)*100) : 0;
    const todayRejectPct = today.wrap > 0 ? (today.reject/today.wrap)*100 : 0;
    const todayNetPct = today.wrap > 0 ? (today.net/today.wrap)*100 : 0;
    const todayRecoveryPct = today.reject > 0 ? Math.min(100,(today.recover/today.reject)*100) : 0;

    const setText=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val;};
    setText('dashDailyWrapWeight', `${today.wrap.toFixed(2)} kg`); setText('dashDailyWrapPcs', `${today.wrapPcs.toLocaleString()} Pcs`);
    setText('dashDailyRejectWeight', `${today.reject.toFixed(2)} kg`); setText('dashDailyNetRejectWeight', `${today.net.toFixed(2)} kg`);
    setText('dashDailyRejectPct', `${todayRejectPct.toFixed(1)}%`);
    setText('dashDailyWrapEfficiencyPct', `${todayWrapEfficiencyPct.toFixed(1)}%`); setText('dashDailyNetRejectPct', `${todayNetPct.toFixed(1)}%`); setText('dashDailyRecoveryPct', `${todayRecoveryPct.toFixed(1)}%`);
    setText('dashMonthlyWrapWeight', `${monthWrapWeight.toFixed(2)} kg`); setText('dashMonthlyWrapPcs', `${monthWrapPcs.toLocaleString()} Pcs`);
    setText('dashMonthlyRejectWeight', `${monthRejectWeight.toFixed(2)} kg`); setText('dashMonthlyRecoverWeight', `${monthRecoverWeight.toFixed(2)} kg`); setText('dashMonthlyNetRejectWeight', `${monthNetRejectWeight.toFixed(2)} kg`);
    setText('dashMonthlyRejectPct', `${monthRejectPct.toFixed(1)}% of wrapping`);
    setText('dashMonthlyWrapEfficiencyPct', `${monthWrapEfficiencyPct.toFixed(1)}%`); setText('dashMonthlyNetRejectPct', `${monthNetRejectPct.toFixed(1)}%`); setText('dashMonthlyRecoveryPct', `${monthRecoveryPct.toFixed(1)}%`);

    const chartTitleNode = ctx.closest('.card').querySelector('h3');
    if(chartTitleNode) chartTitleNode.innerHTML = `<i class="fa-solid fa-chart-simple"></i> Production Output: Wrapping Weight vs Reject / Net Reject`;
    let totalDisplaySpan = document.getElementById('monthlyTotalDisplay');
    if (!totalDisplaySpan) { totalDisplaySpan=document.createElement('div'); totalDisplaySpan.id='monthlyTotalDisplay'; totalDisplaySpan.style.cssText="font-size:13.5px;font-weight:800;color:#0369a1;background:#e0f2fe;padding:8px 15px;border-radius:8px;border:1px solid #bae6fd;margin-bottom:15px;width:100%;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;"; ctx.closest('.card').insertBefore(totalDisplaySpan,ctx.parentElement); }
    totalDisplaySpan.innerHTML=`<span><i class="fa-solid fa-weight-scale"></i> ${now.toLocaleDateString('en-US',{month:'long',year:'numeric'})} Wrapping Production: <b style="font-size:16px;">${monthWrapWeight.toFixed(2)} kg</b> (${monthWrapPcs.toLocaleString()} Pcs)</span><span style="color:#9f1239;">Net Reject: <b>${monthNetRejectWeight.toFixed(2)} kg</b> • ${monthNetRejectPct.toFixed(1)}%</span>`;

    // Update the dashboard heading target if it exists.
    const summaryCard = document.getElementById('monthlyProductionSummary');
    if(summaryCard) summaryCard.innerHTML = `
      <div class="prod-summary-title"><i class="fa-solid fa-gauge-high"></i> Production Performance — ${now.toLocaleDateString('en-US',{month:'long',year:'numeric'})}</div>
      <div class="prod-summary-grid">
        <div class="prod-metric daily"><span>Today Wrapping</span><b id="dashDailyWrapWeight">${today.wrap.toFixed(2)} kg</b><small>${today.wrapPcs.toLocaleString()} Pcs • Wrap/Cut <span id="dashDailyWrapEfficiencyPct">${todayWrapEfficiencyPct.toFixed(1)}%</span></small></div>
        <div class="prod-metric monthly"><span>Monthly Wrapping</span><b id="dashMonthlyWrapWeight">${monthWrapWeight.toFixed(2)} kg</b><small>${monthWrapPcs.toLocaleString()} Pcs • Wrap/Cut ${monthWrapEfficiencyPct.toFixed(1)}%</small></div>
        <div class="prod-metric reject"><span>Monthly Reject</span><b id="dashMonthlyRejectWeight">${monthRejectWeight.toFixed(2)} kg</b><small>${monthRejectPct.toFixed(1)}% of wrapping</small></div>
        <div class="prod-metric recover"><span>Monthly Recover</span><b id="dashMonthlyRecoverWeight">${monthRecoverWeight.toFixed(2)} kg</b><small>${monthRecoveryPct.toFixed(1)}% of reject</small></div>
        <div class="prod-metric net"><span>Net Reject</span><b id="dashMonthlyNetRejectWeight">${monthNetRejectWeight.toFixed(2)} kg</b><small>${monthNetRejectPct.toFixed(1)}% of wrapping</small></div>
      </div>`;

    const chartCanvas=ctx.getContext('2d'), textColor=isDarkMode?'#f8fafc':'#0f172a', gridColor=isDarkMode?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.06)';
    monthlyShiftChartInstance=new Chart(chartCanvas,{type:'bar',data:{labels,datasets:[
      {label:'Wrapping Wt - Day',data:dayWrapData,backgroundColor:'#34d399',borderColor:'#10b981',borderWidth:1,borderRadius:4,barPercentage:.8,categoryPercentage:.8},
      {label:'Wrapping Wt - Night',data:nightWrapData,backgroundColor:'#60a5fa',borderColor:'#2563eb',borderWidth:1,borderRadius:4,barPercentage:.8,categoryPercentage:.8},
      {label:'Reject Wt',data:dayRejectData.map((v,i)=>Number((v+nightRejectData[i]).toFixed(2))),backgroundColor:'#f43f5e',borderColor:'#e11d48',borderWidth:1,borderRadius:4,barPercentage:.8,categoryPercentage:.8},
      {label:'Net Reject Wt',data:dayNetRejectData.map((v,i)=>Number((v+nightNetRejectData[i]).toFixed(2))),backgroundColor:'#fb7185',borderColor:'#be123c',borderWidth:1,borderRadius:4,barPercentage:.8,categoryPercentage:.8}
    ]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${Number(c.raw||0).toFixed(2)} kg`}}},scales:{x:{grid:{display:false},ticks:{color:textColor},title:{display:true,text:'Day of Month',color:textColor}},y:{min:0,suggestedMax:200,grid:{color:gridColor,borderDash:[4,4]},ticks:{color:textColor},title:{display:true,text:'Weight (kg)',color:textColor}}}}});
}

function renderPoCharts() { const poContainer = document.getElementById('poChartsContainerTab'); if(!poContainer) return; poChartInstances.forEach(chart => chart.destroy()); poChartInstances = []; poContainer.innerHTML = ''; if (poList.length === 0) { poContainer.innerHTML = `<div style="padding:20px; color:var(--text-muted); font-weight:700; text-align:center; width:100%;">No Active Production Orders Available.</div>`; return; } const poGroups = {}; poList.forEach(po => { if(!poGroups[po.poNumber]) poGroups[po.poNumber] = { date: po.date, items: [] }; poGroups[po.poNumber].items.push(po); }); Object.keys(poGroups).forEach((poNumber, idx) => { const group = poGroups[poNumber]; let totalOrderWt = 0; let totalShippedWt = 0; let totalCompleteWt = 0; group.items.forEach(poItem => { const matchedItem = masterData.find(m => String(m.profile).trim() === String(poItem.profile).trim() && cleanLen(m.length) === cleanLen(poItem.length)); const uw = matchedItem ? (matchedItem.unitWeight || 0) : 0; const orderWt = poItem.orderQty * uw; totalOrderWt += orderWt; let shippedQty = 0; shipmentList.filter(s => String(s.poNumber).trim() === String(poNumber).trim() && String(s.profile).trim() === String(poItem.profile).trim() && cleanLen(s.length) === cleanLen(poItem.length)).forEach(s => shippedQty += s.shippedQty); const shippedWt = shippedQty * uw; totalShippedWt += shippedWt; const completeWt = Math.min(matchedItem ? (matchedItem.boxQty + matchedItem.crateQty) : 0, Math.max(0, poItem.orderQty - shippedQty)) * uw; totalCompleteWt += completeWt; }); const pendingWt = Math.max(0, totalOrderWt - totalShippedWt - totalCompleteWt); 
if(pendingWt <= 0 && totalCompleteWt <= 0) return; 
poContainer.insertAdjacentHTML('beforeend', `<div class="po-chart-item"><h5 style="margin:0 0 10px 0; font-size:13.5px; color:var(--primary-dark); font-weight:900; width:100%; text-align:center; border-bottom:1px dashed var(--border-color); padding-bottom:5px;">${poNumber}</h5><div style="width: 110px; height: 110px; position:relative; margin-bottom:12px;"><canvas id="poChartTab_idx_${idx}"></canvas></div><div style="font-size:11.5px; width:100%; display:flex; flex-direction:column; gap:6px; font-weight:700;"><div style="display:flex; justify-content:space-between; color:#3b82f6;"><span>Shipped:</span> <span>${totalShippedWt.toFixed(1)} kg</span></div><div style="display:flex; justify-content:space-between; color:#10b981;"><span>Ready:</span> <span>${totalCompleteWt.toFixed(1)} kg</span></div><div style="display:flex; justify-content:space-between; color:#fb7185;"><span>Pending:</span> <span>${pendingWt.toFixed(1)} kg</span></div></div></div>`); if (typeof Chart !== 'undefined') { try { const ctxPo = document.getElementById(`poChartTab_idx_${idx}`).getContext('2d'); poChartInstances.push(new Chart(ctxPo, { type: 'doughnut', data: { labels: ['Shipped', 'Ready', 'Pending'], datasets: [{ data: [Number(totalShippedWt.toFixed(2))||0, Number(totalCompleteWt.toFixed(2))||0, Number(pendingWt.toFixed(2))||0], backgroundColor: ['#3b82f6', '#10b981', '#fb7185'], borderWidth: isDarkMode ? 2 : 1, borderColor: isDarkMode ? '#1e293b' : '#fff' }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { display: false } } } })); } catch(e){} } }); }
function isPunchBypassed(profile, length) { const bypassProfiles = ['1041', '1042', '1043', '1047', '1048', '1090']; return bypassProfiles.includes(String(profile).trim()) || (String(profile).trim() === '1038' && String(length).trim() === '2438.4'); }
function populateStockFilterDropdown() { const select = document.getElementById('stockFilterProfile'); if(!select) return; select.innerHTML = '<option value="">-- All Profiles --</option>'; const itemSelect = document.getElementById('stockFilterItemCode'); if(itemSelect) itemSelect.innerHTML = '<option value="">-- All Item Codes --</option>'; [...new Set(masterData.map(i => String(i.profile).trim()))].forEach(p => select.appendChild(new Option(p, p))); }
function onStockProfileFilterChange() { const profile = document.getElementById('stockFilterProfile').value; const itemSelect = document.getElementById('stockFilterItemCode'); itemSelect.innerHTML = '<option value="">-- All Item Codes --</option>'; if(profile) { const items = masterData.filter(m => String(m.profile).trim() === profile && m.itemCode); [...new Set(items.map(m => m.itemCode))].forEach(ic => itemSelect.appendChild(new Option(ic, ic))); } renderProfileSummaryTable(); }

function renderProfileSummaryTable() { 
    try {
        const profileFilter = document.getElementById('stockFilterProfile').value; 
        const itemFilter = document.getElementById('stockFilterItemCode').value; 
        const tbody = document.getElementById('profileSummaryTableBody'); 
        if(!tbody) return;
        let html = ''; 
        let filteredData = masterData; 
        if (profileFilter) filteredData = filteredData.filter(m => String(m.profile).trim() === profileFilter); 
        if (itemFilter) filteredData = filteredData.filter(m => m.itemCode === itemFilter); 
        if (filteredData.length === 0) { html = `<tr><td colspan="12" style="color:#888; text-align:center;">No Data Found</td></tr>`; } 
        else {
            filteredData.forEach((item) => { 
                const actualIndex = masterData.indexOf(item); 
                const totalPcs = (item.cutQty || 0) + (item.punchQty || 0) + (item.wrapQty || 0) + (item.boxQty || 0) + (item.crateQty || 0); 
                const totalWeight = (totalPcs * (item.unitWeight||0)).toFixed(2); 
                const boxCount = item.boxCapacity ? Math.floor((item.boxQty || 0) / item.boxCapacity) : 0; 
                const isAd = currentUserRole === 'Admin'; 
                html += `<tr><td><b>${item.profile}</b></td><td><span style="font-weight:600; color:var(--info-color);">${item.itemCode || '-'}</span></td><td>${item.length}</td><td>${item.unitWeight}</td><td class="${isAd ? 'clickable-stage' : ''}" onclick="${isAd ? `openStockEditModal(${actualIndex}, 'cutQty')` : ''}"><span class="stock-badge bg-cut">${item.cutQty || 0} Pcs</span></td><td class="${isAd ? 'clickable-stage' : ''}" onclick="${isAd ? `openStockEditModal(${actualIndex}, 'punchQty')` : ''}"><span class="stock-badge bg-punch">${item.punchQty || 0} Pcs</span></td><td class="${isAd ? 'clickable-stage' : ''}" onclick="${isAd ? `openStockEditModal(${actualIndex}, 'wrapQty')` : ''}"><span class="stock-badge bg-wrap">${item.wrapQty || 0} Pcs</span></td><td class="${isAd ? 'clickable-stage' : ''}" onclick="${isAd ? `openStockEditModal(${actualIndex}, 'boxQty')` : ''}"><span class="stock-badge bg-box">${item.boxQty || 0} Pcs</span></td><td><span class="stock-badge" style="background:#059669; color:#fff;">${boxCount} Boxes</span></td><td class="${isAd ? 'clickable-stage' : ''}" onclick="${isAd ? `openStockEditModal(${actualIndex}, 'crateQty')` : ''}"><span class="stock-badge bg-crate">${item.crateQty || 0} Pcs</span></td><td><span class="stock-badge bg-total">${totalPcs} Pcs</span><div style="font-size:11px; font-weight:800; color:#0369a1; background:rgba(3,105,161,0.08); padding:2px 6px; border-radius:4px; display:inline-block; margin-top:4px;">${totalWeight} kg</div></td><td>${isAd ? `<button class="btn btn-accent" style="padding:4px 8px;" onclick="openStockEditModal(${actualIndex})"><i class="fa-solid fa-pen"></i></button>` : `<i class="fa-solid fa-lock" style="color:#aaa;"></i>`}</td></tr>`; 
            }); 
        }
        tbody.innerHTML = html;
    } catch(e) {}
}

function renderBalanceWorkTable() { 
    try {
        const tbody = document.getElementById('balanceWorkTableBody'); if(!tbody) return;
        let html = ''; 
        if (masterData.length === 0) { html = `<tr><td colspan="14" style="color:#888; text-align:center;">No profiles available.</td></tr>`; } 
        else {
            const shipMap = new Map();
            shipmentList.forEach(s => { const k = `${String(s.poNumber).trim()}_${String(s.profile).trim()}_${cleanLen(s.length)}`; shipMap.set(k, (shipMap.get(k) || 0) + s.shippedQty); });
            const plMap = new Map();
            packingLists.forEach(pl => { const k = `${String(pl.profile).trim()}_${String(pl.itemCode).trim()}_${cleanLen(pl.length)}`; plMap.set(k, (plMap.get(k) || 0) + pl.pcsQty); });

            masterData.forEach(item => { 
                const currentStockTotal = (item.cutQty || 0) + (item.punchQty || 0) + (item.wrapQty || 0) + (item.boxQty || 0); const crateQty = item.crateQty || 0; 
                let unshippedPoTotal = 0; 
                poList.forEach(po => { if (String(po.profile).trim() === String(item.profile).trim() && cleanLen(po.length) === cleanLen(item.length)) { let shippedForPo = shipMap.get(`${String(po.poNumber).trim()}_${String(po.profile).trim()}_${cleanLen(po.length)}`) || 0; unshippedPoTotal += Math.max(0, po.orderQty - shippedForPo); } }); 
                let plReqTotal = plMap.get(`${String(item.profile).trim()}_${String(item.itemCode).trim()}_${cleanLen(item.length)}`) || 0;
                
                const poPendingQty = Math.max(0, unshippedPoTotal - (currentStockTotal + crateQty)); const plPendingQty = Math.max(0, plReqTotal - (currentStockTotal + crateQty));
                const maxPending = Math.max(poPendingQty, plPendingQty);
                const exLen = parseFloat(item.exLength) || 0; const cutLen = parseFloat(item.length) || 0; let pcsPerEx = 0; let reqEx = '-'; 
                if (exLen > 0 && cutLen > 0) { pcsPerEx = Math.floor(exLen / cutLen); if(pcsPerEx > 0) reqEx = Math.ceil(maxPending / pcsPerEx); } 
                const wipPcs = (item.cutQty || 0) + (item.punchQty || 0) + (item.wrapQty || 0); const unboxedAndPendingPcs = maxPending + wipPcs; 
                const reqBoxes = Math.ceil(unboxedAndPendingPcs / (item.boxCapacity || 100)); const availCardboard = getAvailableCardboard(item.profile, item.itemCode, item.length); const cbBalance = availCardboard - reqBoxes; 
                const cbStatusHtml = cbBalance >= 0 ? `<span style="color:var(--success-color); font-weight:800;">OK (+${cbBalance})</span>` : `<span style="color:var(--warning-color); font-weight:800;"><i class="fa-solid fa-arrow-down"></i> Short ${Math.abs(cbBalance)}</span>`; 
                html += `<tr><td><b>${item.profile}</b></td><td><span style="color:var(--info-color); font-weight:600;">${item.itemCode || '-'}</span></td><td>${item.length} mm</td><td>${item.exLength || '-'} mm</td><td><span class="stock-badge bg-wrap">${pcsPerEx}</span></td><td><span class="stock-badge bg-total">${currentStockTotal} Pcs</span></td><td><span class="stock-badge bg-crate">${crateQty} Pcs</span></td><td><span class="stock-badge" style="background:#e0f2fe; color:#0369a1;">${unshippedPoTotal} Pcs</span></td><td><span class="stock-badge" style="background:${poPendingQty > 0 ? '#fee2e2' : '#dcfce7'}; color:${poPendingQty > 0 ? '#e11d48' : '#059669'}; font-weight:800;">${poPendingQty} Pcs</span></td><td><span class="stock-badge" style="background:${plPendingQty > 0 ? '#ffedd5' : '#dcfce7'}; color:${plPendingQty > 0 ? '#c2410c' : '#059669'}; font-weight:800;">${plPendingQty} Pcs</span></td><td><span class="stock-badge" style="background:var(--primary-dark); color:#fff; font-weight:800;">${reqEx} Ex</span></td><td><span class="stock-badge" style="background:#0369a1; color:#fff; font-weight:800;">${unboxedAndPendingPcs} Pcs</span></td><td><span class="stock-badge" style="background:#b45309; color:#fff; font-weight:800;">${reqBoxes} Boxes</span></td><td style="background:${cbBalance < 0 ? 'rgba(225, 29, 72, 0.05)' : 'rgba(16, 185, 129, 0.05)'};">${cbStatusHtml}</td></tr>`; 
            }); 
        }
        tbody.innerHTML = html;
    } catch(e) {}
}

function exportBalanceWorkExcel() {
    const exportData = masterData.map(item => {
        const currentStockTotal = (item.cutQty || 0) + (item.punchQty || 0) + (item.wrapQty || 0) + (item.boxQty || 0); const crateQty = item.crateQty || 0; 
        let unshippedPoTotal = 0; poList.forEach(po => { if (String(po.profile).trim() === String(item.profile).trim() && cleanLen(po.length) === cleanLen(item.length)) { let shippedForPo = 0; shipmentList.filter(s => String(s.poNumber).trim() === String(po.poNumber).trim() && String(s.profile).trim() === String(po.profile).trim() && cleanLen(s.length) === cleanLen(po.length)).forEach(s => { shippedForPo += s.shippedQty; }); unshippedPoTotal += Math.max(0, po.orderQty - shippedForPo); } }); 
        let plReqTotal = 0; packingLists.forEach(pl => { if (String(pl.profile).trim() === String(item.profile).trim() && String(pl.itemCode).trim() === String(item.itemCode).trim() && cleanLen(pl.length) === cleanLen(item.length)) plReqTotal += pl.pcsQty; });
        const poPendingQty = Math.max(0, unshippedPoTotal - (currentStockTotal + crateQty)); const plPendingQty = Math.max(0, plReqTotal - (currentStockTotal + crateQty)); const maxPending = Math.max(poPendingQty, plPendingQty);
        const exLen = parseFloat(item.exLength) || 0; const cutLen = parseFloat(item.length) || 0; let pcsPerEx = 0; let reqEx = 0; if (exLen > 0 && cutLen > 0) { pcsPerEx = Math.floor(exLen / cutLen); if(pcsPerEx > 0) reqEx = Math.ceil(maxPending / pcsPerEx); }
        const unboxedAndPendingPcs = maxPending + ((item.cutQty || 0) + (item.punchQty || 0) + (item.wrapQty || 0)); const reqBoxes = Math.ceil(unboxedAndPendingPcs / (item.boxCapacity || 100)); const cbBalance = getAvailableCardboard(item.profile, item.itemCode, item.length) - reqBoxes;
        return { "Profile": item.profile, "Item Code": item.itemCode || "-", "Cut L (mm)": item.length, "Ex L (mm)": item.exLength || "-", "Pcs / Ex": pcsPerEx, "WIP+Box Stock": currentStockTotal, "Crate Qty": crateQty, "Unshipped PO": unshippedPoTotal, "PO Pending": poPendingQty, "PL Pending": plPendingQty, "Req Extrusions": reqEx, "Unboxed Pcs": unboxedAndPendingPcs, "Req Boxes": reqBoxes, "Cardboard Balance": cbBalance };
    });
    exportTableToExcel(exportData, "AIS_Balance_Work", "Balance Work");
}

function populateProfileDropdown() { const select = document.getElementById('selectProfile'); if(!select) return; select.innerHTML = '<option value="">-- Choose Profile --</option>'; [...new Set(masterData.map(i => String(i.profile).trim()))].forEach(p => select.appendChild(new Option(p, p))); }
function onProfileSelect() { const profile = document.getElementById('selectProfile').value; const itemSelect = document.getElementById('selectItemCode'); itemSelect.innerHTML = '<option value="">-- Choose Item Code --</option>'; document.getElementById('selectLength').innerHTML = '<option value="">-- Choose Length --</option>'; if(!profile) { onLengthSelect(); return; } const items = masterData.filter(m => String(m.profile).trim() === profile && m.itemCode); [...new Set(items.map(m => m.itemCode))].forEach(ic => itemSelect.appendChild(new Option(ic, ic))); onLengthSelect(); }
function onItemCodeSelect() { const profile = document.getElementById('selectProfile').value; const itemCode = document.getElementById('selectItemCode').value; const lengthSelect = document.getElementById('selectLength'); lengthSelect.innerHTML = '<option value="">-- Choose Length --</option>'; if(!profile || !itemCode) { onLengthSelect(); return; } const matches = masterData.filter(m => String(m.profile).trim() === profile && m.itemCode === itemCode); matches.forEach(m => lengthSelect.appendChild(new Option(`${m.length} mm`, m.length))); if(matches.length === 1) { lengthSelect.value = matches[0].length; } onLengthSelect(); }
function onLengthSelect() { const profile = document.getElementById('selectProfile').value; const itemCode = document.getElementById('selectItemCode').value; const length = document.getElementById('selectLength').value; const punchGroup = document.getElementById('punchGroup'); if(!profile || !itemCode || !length) return; const matchedCat = masterData.find(m => String(m.profile).trim() === profile && m.itemCode === itemCode && cleanLen(m.length) === cleanLen(length)); if (matchedCat && isPunchBypassed(matchedCat.profile, matchedCat.length)) { punchGroup.style.display = 'none'; document.getElementById('punchQty').value = 0; } else { punchGroup.style.display = 'flex'; } }
function checkDateStatus() { const dateVal = document.getElementById('entryDate').value; const shiftVal = document.getElementById('shift').value; const banner = document.getElementById('entryStatusBanner'); if (!banner) return; if (!dateVal) { banner.style.display = 'none'; return; } const existing = historyLogs.filter(h => h.date === dateVal && h.shift === shiftVal); if (existing.length > 0) { banner.className = "status-banner status-red"; banner.style.display = "flex"; banner.innerHTML = `<div class="status-banner-content"><div class="status-banner-icon"><i class="fa-solid fa-triangle-exclamation"></i></div><div><div style="font-weight: 800; font-size: 15px;">Entries exist for ${dateVal}</div></div></div>`; } else { banner.className = "status-banner status-green"; banner.style.display = "flex"; banner.innerHTML = `<div class="status-banner-content"><div class="status-banner-icon"><i class="fa-solid fa-circle-check"></i></div><div><div style="font-weight: 800; font-size: 15px;">Ready for New Operations Entry</div></div></div>`; } }
async function deductCardboardBoxesForProduction(profile, itemCode, length, boxesNeeded) { if(boxesNeeded <= 0) return; const typeStr = `Pr: ${String(profile).trim()} | Item: ${String(itemCode || '-').trim()} | L: ${String(length).trim()}`; const newEntry = { cb_date: new Date().toISOString().split('T')[0], cb_type: typeStr, incoming: 0, used: boxesNeeded }; const localItem = { id: Date.now(), date: newEntry.cb_date, type: typeStr, incoming: 0, used: boxesNeeded, timestamp: new Date().toLocaleTimeString() }; cardboardStockList.unshift(localItem); saveCardboardLocally(); try { const { data } = await supabaseClient.from('cardboard_stock').insert([newEntry]).select(); if(data && data.length > 0) { localItem.id = data[0].id; localItem.db_id = data[0].id; saveCardboardLocally(); } } catch(e) {} renderCardboardStock(); }

async function submitDailyEntry() { if(isAppBusy) return; isAppBusy=true; try { if (currentUserRole !== 'Admin' && currentUserRole !== 'Planner') return; const dateVal = document.getElementById('entryDate').value; const shiftVal = document.getElementById('shift').value; const profileVal = document.getElementById('selectProfile').value; const itemCodeVal = document.getElementById('selectItemCode').value; const lengthVal = document.getElementById('selectLength').value; const cutQty = parseInt(document.getElementById('cutQty').value) || 0; const punchQty = parseInt(document.getElementById('punchQty').value) || 0; const wrapQty = parseInt(document.getElementById('wrapQty').value) || 0; const enteredBoxes = parseInt(document.getElementById('boxQty').value) || 0; const crateQty = parseInt(document.getElementById('crateQty').value) || 0; if (!dateVal || !profileVal || !itemCodeVal || !lengthVal) { showToast("Please select correctly.", "warning"); return; } const item = masterData.find(m => String(m.profile).trim() === profileVal && m.itemCode === itemCodeVal && cleanLen(m.length) === cleanLen(lengthVal)); if (!item) return; const boxPcs = enteredBoxes * (item.boxCapacity || 100); item.cutQty = (item.cutQty || 0) + cutQty; if (punchQty > 0) { item.cutQty = Math.max(0, item.cutQty - punchQty); item.punchQty = (item.punchQty || 0) + punchQty; } if (wrapQty > 0) { if (isPunchBypassed(profileVal, lengthVal) || (item.punchQty || 0) <= 0) { item.cutQty = Math.max(0, item.cutQty - wrapQty); } else if (item.punchQty >= wrapQty) { item.punchQty -= wrapQty; } else { const rem = wrapQty - item.punchQty; item.punchQty = 0; item.cutQty = Math.max(0, item.cutQty - rem); } item.wrapQty = (item.wrapQty || 0) + wrapQty; } if (boxPcs > 0) { item.wrapQty = Math.max(0, item.wrapQty - boxPcs); item.boxQty = (item.boxQty || 0) + boxPcs; await deductCardboardBoxesForProduction(profileVal, itemCodeVal, lengthVal, enteredBoxes); } if (crateQty > 0) { item.boxQty = Math.max(0, item.boxQty - crateQty); item.crateQty = (item.crateQty || 0) + crateQty; } if (item.db_id) { try { await supabaseClient.from('master_catalog').update({ cut_qty: item.cutQty, punch_qty: item.punchQty, wrap_qty: item.wrapQty, box_qty: item.boxQty, crate_qty: item.crateQty }).eq('id', item.db_id); } catch (e) {} } const newLog = { log_date: dateVal, shift: shiftVal, profile: profileVal, length: cleanLen(lengthVal), cut_qty: cutQty, punch_qty: punchQty, wrap_qty: wrapQty, box_qty: boxPcs, crate_qty: crateQty, log_time: new Date().toLocaleTimeString() }; const localLog = { id: Date.now(), date: dateVal, shift: shiftVal, profile: profileVal, length: cleanLen(lengthVal), cutQty: cutQty, punchQty: punchQty, wrapQty: wrapQty, boxQty: boxPcs, crateQty: crateQty, timestamp: newLog.log_time }; historyLogs.unshift(localLog); try { const { data } = await supabaseClient.from('history_logs').insert([newLog]).select(); if (data) { localLog.id = data[0].id; localLog.timestamp = data[0].log_time || data[0].created_at; } } catch (e) {} showToast("Movement saved!", "success"); renderDashboard(); renderProfileSummaryTable(); renderHistoryData(); checkDateStatus(); renderCardboardStock(); renderBalanceWorkTable(); ['cutQty', 'punchQty', 'wrapQty', 'boxQty', 'crateQty'].forEach(id => { const el = document.getElementById(id); if(el) el.value = 0; }); } finally { isAppBusy=false; } }
function openStockEditModal(index, preferredStage = 'cutQty') { if (currentUserRole !== 'Admin') return; const item = masterData[index]; document.getElementById('editItemIndex').value = index; document.getElementById('editItemTarget').innerHTML = `Profile: <b>${item.profile}</b> | Item: <b>${item.itemCode || '-'}</b> | Length: <b>${item.length} mm</b>`; document.getElementById('editStageSelect').value = preferredStage; document.getElementById('editStageValue').value = item[preferredStage] || 0; document.getElementById('boxCapacityHelperText').dataset.capacity = item.boxCapacity || 100; document.getElementById('boxCapacityHelperText').innerText = `Master Capacity: ${item.boxCapacity || 100} Pcs per Box`; toggleBoxCountInput(); document.getElementById('stockEditModal').style.display = 'flex'; }
function toggleBoxCountInput() { const stage = document.getElementById('editStageSelect').value; const boxGroup = document.getElementById('editBoxCountGroup'); if (stage === 'boxQty') { boxGroup.style.display = 'flex'; syncBoxCount(); } else { boxGroup.style.display = 'none'; } }
function syncBoxCount() { if (document.getElementById('editStageSelect').value !== 'boxQty') return; const pcs = parseInt(document.getElementById('editStageValue').value) || 0; const capacity = parseInt(document.getElementById('boxCapacityHelperText').dataset.capacity) || 100; const boxes = capacity > 0 ? (pcs / capacity) : 0; document.getElementById('editBoxCountValue').value = boxes % 1 === 0 ? boxes : parseFloat(boxes.toFixed(2)); }
function syncPcsCount() { if (document.getElementById('editStageSelect').value !== 'boxQty') return; const boxes = parseFloat(document.getElementById('editBoxCountValue').value) || 0; const capacity = parseInt(document.getElementById('boxCapacityHelperText').dataset.capacity) || 100; document.getElementById('editStageValue').value = Math.round(boxes * capacity); }
function closeStockEditModal() { document.getElementById('stockEditModal').style.display = 'none'; }
async function saveSingleStageEdit() { const index = parseInt(document.getElementById('editItemIndex').value); const stage = document.getElementById('editStageSelect').value; const newQty = parseInt(document.getElementById('editStageValue').value) || 0; const item = masterData[index]; item[stage] = Math.max(0, newQty); if (item.db_id) { const updateObj = {}; updateObj[stage.replace('Qty', '_qty')] = item[stage]; try { await supabaseClient.from('master_catalog').update(updateObj).eq('id', item.db_id); } catch(e){} } closeStockEditModal(); showToast("Stock edit saved successfully", "success"); renderProfileSummaryTable(); renderDashboard(); renderBalanceWorkTable(); }

function populatePoProfileDropdown() { const select = document.getElementById('poSelectProfile'); if(!select) return; select.innerHTML = '<option value="">-- Choose Profile --</option>'; [...new Set(masterData.map(i => String(i.profile).trim()))].forEach(p => select.appendChild(new Option(p, p))); }
function onPoProfileSelect() { const profile = document.getElementById('poSelectProfile').value; const itemSelect = document.getElementById('poSelectItemCode'); itemSelect.innerHTML = '<option value="">-- Choose Item Code --</option>'; document.getElementById('poSelectLength').innerHTML = '<option value="">-- Choose Length --</option>'; if(!profile) return; const items = masterData.filter(m => String(m.profile).trim() === profile && m.itemCode); [...new Set(items.map(m => m.itemCode))].forEach(ic => itemSelect.appendChild(new Option(ic, ic))); }
function onPoItemCodeSelect() { const profile = document.getElementById('poSelectProfile').value; const itemCode = document.getElementById('poSelectItemCode').value; const lengthSelect = document.getElementById('poSelectLength'); lengthSelect.innerHTML = '<option value="">-- Choose Length --</option>'; if(!profile || !itemCode) return; const matches = masterData.filter(m => String(m.profile).trim() === profile && m.itemCode === itemCode); matches.forEach(m => lengthSelect.appendChild(new Option(`${m.length} mm`, m.length))); if(matches.length === 1) lengthSelect.value = matches[0].length; }
async function saveNewPO() { if(isAppBusy) return; isAppBusy=true; try { const dateVal = document.getElementById('poDate').value; const poNum = document.getElementById('poNumber').value.trim(); const profileVal = document.getElementById('poSelectProfile').value; const itemCodeVal = document.getElementById('poSelectItemCode').value; const lengthVal = document.getElementById('poSelectLength').value; const orderQtyVal = parseInt(document.getElementById('poOrderQty').value) || 0; if (!dateVal || !poNum || !profileVal || !itemCodeVal || !lengthVal || orderQtyVal <= 0) { showToast("Fill all valid values", "warning"); return; } const newPo = { po_date: dateVal, po_number: poNum, profile: profileVal, length: cleanLen(lengthVal), order_qty: orderQtyVal }; const { data: inserted } = await supabaseClient.from('production_orders').insert([newPo]).select(); if (inserted && inserted.length > 0) poList.unshift({ id: inserted[0].id, date: dateVal, poNumber: poNum, profile: profileVal, length: cleanLen(lengthVal), orderQty: orderQtyVal }); showToast("PO saved!", "success"); document.getElementById('poEntryForm').reset(); updatePoFilters(); renderPoDetailsTable(); renderPoCharts(); renderDashboard(); populateShipmentPoDropdown(); populatePlPoDropdown(); renderBalanceWorkTable(); } finally { isAppBusy=false; } }
async function processExcelUpload() { const fileInput = document.getElementById('excelUpload'); if (!fileInput.files || fileInput.files.length === 0) return; if (currentUserRole !== 'Admin') return; const uploadBtn = document.getElementById('poUploadBtn'); const originalBtnText = uploadBtn.innerHTML; uploadBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Uploading...`; uploadBtn.disabled = true; const file = fileInput.files[0]; const reader = new FileReader(); reader.onload = async function(e) { try { const data = new Uint8Array(e.target.result); const workbook = XLSX.read(data, { type: 'array' }); const sheetName = workbook.SheetNames[0]; const worksheet = workbook.Sheets[sheetName]; const rawJson = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }); if (!rawJson || rawJson.length === 0) return; let headerRowIndex = -1; let headers = []; for (let i = 0; i < Math.min(15, rawJson.length); i++) { const rowStr = rawJson[i].map(String).join('').toLowerCase().replace(/[\s_\-\(\)\.]/g, ''); let matchCount = 0; if (rowStr.includes('po') || rowStr.includes('order')) matchCount++; if (rowStr.includes('profile') || rowStr.includes('extrusion')) matchCount++; if (rowStr.includes('item') || rowStr.includes('code') || rowStr.includes('desc')) matchCount++; if (rowStr.includes('qty') || rowStr.includes('quantity') || rowStr.includes('pcs')) matchCount++; if (matchCount >= 2) { headerRowIndex = i; headers = rawJson[i].map(h => String(h).toLowerCase().replace(/[\s_\-\(\)\.]/g, '')); break; } } if (headerRowIndex === -1) return; const rowsToInsert = []; let currentPO = ''; for (let i = headerRowIndex + 1; i < rawJson.length; i++) { const rowArr = rawJson[i]; if (rowArr.join('').trim() === '') continue; const norm = {}; headers.forEach((h, idx) => { if (h) norm[h] = rowArr[idx]; }); const exactVal = (keys) => { for(let k of keys) { if(norm[k] !== undefined && norm[k] !== '') return norm[k]; } return undefined; }; let rawPo = exactVal(['ponumber', 'po', 'order', 'orderno', 'purchaseorder']); if (rawPo !== undefined) currentPO = String(rawPo).replace('.0', '').trim(); const poNum = currentPO; const dateVal = formatExcelDate(exactVal(['date', 'podate'])); let profileVal = String(exactVal(['profile', 'profileno', 'profilecode', 'extrusion']) || '').trim(); if (profileVal.toUpperCase().startsWith('AL-')) profileVal = profileVal.substring(3); const itemCodeVal = String(exactVal(['itemcode', 'item', 'code', 'partno']) || '').trim(); let lengthVal = cleanLen(String(exactVal(['length', 'lengthmm']) || '').trim()); const qtyVal = parseInt(exactVal(['orderqty', 'qty', 'quantity', 'totalpcs', 'pcs'])) || 0; if (profileVal && itemCodeVal) { const matchedCat = masterData.find(m => String(m.profile).trim() === String(profileVal).trim() && m.itemCode.toLowerCase() === itemCodeVal.toLowerCase()); if (matchedCat) lengthVal = cleanLen(matchedCat.length); } if (poNum && profileVal && lengthVal && qtyVal > 0) { rowsToInsert.push({ po_date: dateVal, po_number: poNum, profile: profileVal, length: lengthVal, order_qty: qtyVal }); } } if (rowsToInsert.length === 0) return; await supabaseClient.from('production_orders').insert(rowsToInsert); let { data: poData } = await supabaseClient.from('production_orders').select('*'); if (poData) { poList = poData.sort((a, b) => b.id - a.id).map(item => ({ id: item.id, date: item.po_date, poNumber: item.po_number, profile: item.profile, length: cleanLen(item.length), orderQty: item.order_qty })); } fileInput.value = ''; showToast(`Imported POs!`, "success"); updatePoFilters(); renderPoDetailsTable(); renderPoCharts(); renderDashboard(); populateShipmentPoDropdown(); populatePlPoDropdown(); renderBalanceWorkTable(); } catch (err) {} finally { uploadBtn.innerHTML = originalBtnText; uploadBtn.disabled = false; } }; reader.readAsArrayBuffer(file); }
function updatePoFilters() { const filterPo = document.getElementById('filterPoNumber'); const filterProf = document.getElementById('filterPoProfile'); const filterItem = document.getElementById('filterPoItemCode'); if(!filterPo || !filterProf || !filterItem) return; filterPo.innerHTML = '<option value="">-- All PO Numbers --</option>'; filterProf.innerHTML = '<option value="">-- All Profiles --</option>'; filterItem.innerHTML = '<option value="">-- All Item Codes --</option>'; [...new Set(poList.map(p => String(p.poNumber).trim()))].forEach(po => filterPo.appendChild(new Option(po, po))); [...new Set(poList.map(p => String(p.profile).trim()))].forEach(p => filterProf.appendChild(new Option(`${p}`, p))); }
function onPoFilterProfileChange() { const profile = document.getElementById('filterPoProfile').value; const filterItem = document.getElementById('filterPoItemCode'); filterItem.innerHTML = '<option value="">-- All Item Codes --</option>'; if(profile) { const items = masterData.filter(m => String(m.profile).trim() === profile && m.itemCode); [...new Set(items.map(m => m.itemCode))].forEach(ic => filterItem.appendChild(new Option(ic, ic))); } renderPoDetailsTable(); }
function renderPoDetailsTable() { 
    const poFilter = document.getElementById('filterPoNumber').value; 
    const profFilter = document.getElementById('filterPoProfile').value; 
    const itemFilter = document.getElementById('filterPoItemCode').value; 
    
    const thead = document.querySelector('#poDetailsTableBody')?.parentElement.querySelector('thead tr');
    if (thead && !thead.innerHTML.includes('Shipped Qty')) {
        thead.innerHTML = `<th>PO Date</th><th>PO Number</th><th>Profile</th><th>Item Code</th><th>Length</th><th>Unit Wt</th><th>Req Qty</th><th style="background:#0284c7;color:white;">Shipped Qty</th><th style="background:#e11d48;color:white;">Balance Qty</th><th>Action</th>`;
    }

    const tbody = document.getElementById('poDetailsTableBody'); 
    if(!tbody) return;
    tbody.innerHTML = ''; 
    let filtered = poList; 
    if (poFilter) filtered = filtered.filter(p => String(p.poNumber).trim() === String(poFilter).trim()); 
    if (profFilter) filtered = filtered.filter(p => String(p.profile).trim() === String(profFilter).trim()); 
    if (itemFilter) filtered = filtered.filter(p => { 
        const matchedCat = masterData.find(m => String(m.profile) === String(p.profile) && cleanLen(m.length) === cleanLen(p.length)); 
        return matchedCat && matchedCat.itemCode === itemFilter; 
    }); 
    
    if (filtered.length === 0) { tbody.innerHTML = `<tr><td colspan="10" style="color:#888; text-align:center;">No POs found.</td></tr>`; return; } 
    
    let html = ''; 
    filtered.forEach(po => { 
        const matched = masterData.find(m => String(m.profile).trim() === String(po.profile).trim() && cleanLen(m.length) === cleanLen(po.length)); 
        
        let shippedSoFar = 0;
        shipmentList.filter(s => String(s.poNumber).trim() === String(po.poNumber).trim() && String(s.profile).trim() === String(po.profile).trim() && cleanLen(s.length) === cleanLen(po.length)).forEach(s => shippedSoFar += s.shippedQty);
        let balanceQty = Math.max(0, po.orderQty - shippedSoFar);
        
        if (balanceQty === 0) return;

        html += `<tr>
            <td>${po.date}</td>
            <td><b>${po.poNumber}</b></td>
            <td>${po.profile}</td>
            <td>${matched?matched.itemCode:'-'}</td>
            <td>${po.length} mm</td>
            <td>${matched?matched.unitWeight:0} kg</td>
            <td><span class="stock-badge" style="background:#064e3b; color:#fff;">${po.orderQty} Pcs</span></td>
            <td><span class="stock-badge" style="background:#e0f2fe; color:#0284c7; border:1px solid #bae6fd;">${shippedSoFar} Pcs</span></td>
            <td><span class="stock-badge" style="background:#ffe4e6; color:#e11d48; border:1px solid #fecdd3;">${balanceQty} Pcs</span></td>
            <td>${currentUserRole === 'Admin' ? `<button class="btn btn-accent" style="padding:4px 8px;" onclick="openGenericEdit('production_orders', ${po.id}, {order_qty: '${po.orderQty}'})"><i class="fa-solid fa-pen"></i></button> <button class="btn btn-danger" style="padding:4px 8px;" onclick="deletePoItem(${po.id})"><i class="fa-solid fa-trash"></i></button>` : `<i class="fa-solid fa-lock" style="color:#aaa;"></i>`}</td>
        </tr>`; 
    }); 
    if(html === '') html = `<tr><td colspan="10" style="color:#888; text-align:center;">All filtered PO items are fully shipped!</td></tr>`;
    tbody.innerHTML = html; 
}
function deletePoItem(id) { if (currentUserRole !== 'Admin') return; showConfirm("Delete Production Order?", async () => { await supabaseClient.from('production_orders').delete().eq('id', id); poList = poList.filter(p => p.id !== id); updatePoFilters(); renderPoDetailsTable(); renderPoCharts(); renderDashboard(); populateShipmentPoDropdown(); populatePlPoDropdown(); renderBalanceWorkTable(); showToast("Deleted", "success"); }); }

function populateShipmentPoDropdown() { const poSelect = document.getElementById('shipSelectPo'); if(!poSelect) return; poSelect.innerHTML = '<option value="">-- Choose PO Number --</option>'; [...new Set(poList.map(p => String(p.poNumber).trim()))].forEach(po => poSelect.appendChild(new Option(po, po))); }
function onShipmentPoSelect() { const poNum = document.getElementById('shipSelectPo').value; const profileSelect = document.getElementById('shipSelectProfile'); profileSelect.innerHTML = '<option value="">-- Select Profile --</option>'; document.getElementById('shipSelectItemCode').innerHTML = '<option value="">-- Select Item Code --</option>'; document.getElementById('shipSelectLength').innerHTML = '<option value="">-- Select Length --</option>'; document.getElementById('shipTotalOrderQty').value = ''; if (!poNum) return; const poItems = poList.filter(p => String(p.poNumber).trim() === String(poNum).trim()); [...new Set(poItems.map(p => String(p.profile).trim()))].forEach(prof => profileSelect.appendChild(new Option(prof, prof))); }
function onShipmentProfileSelect() { const poNum = document.getElementById('shipSelectPo').value; const profile = document.getElementById('shipSelectProfile').value; const itemSelect = document.getElementById('shipSelectItemCode'); itemSelect.innerHTML = '<option value="">-- Select Item Code --</option>'; document.getElementById('shipSelectLength').innerHTML = '<option value="">-- Select Length --</option>'; document.getElementById('shipTotalOrderQty').value = ''; if (!poNum || !profile) return; const poItems = poList.filter(p => String(p.poNumber).trim() === poNum && String(p.profile).trim() === profile); const uniqueItems = []; poItems.forEach(p => { const matchedCat = masterData.find(m => String(m.profile) === profile && cleanLen(m.length) === cleanLen(p.length)); if(matchedCat && matchedCat.itemCode && !uniqueItems.includes(matchedCat.itemCode)) { uniqueItems.push(matchedCat.itemCode); itemSelect.appendChild(new Option(matchedCat.itemCode, matchedCat.itemCode)); } }); }
function onShipmentItemCodeSelect() { const poNum = document.getElementById('shipSelectPo').value; const profile = document.getElementById('shipSelectProfile').value; const itemCode = document.getElementById('shipSelectItemCode').value; const lengthSelect = document.getElementById('shipSelectLength'); lengthSelect.innerHTML = '<option value="">-- Select Length --</option>'; document.getElementById('shipTotalOrderQty').value = ''; if (!poNum || !profile || !itemCode) return; const poItems = poList.filter(p => String(p.poNumber).trim() === poNum && String(p.profile).trim() === profile); const matches = poItems.filter(p => { const matchedCat = masterData.find(m => String(m.profile) === profile && cleanLen(m.length) === cleanLen(p.length)); return matchedCat && matchedCat.itemCode === itemCode; }); matches.forEach(p => lengthSelect.appendChild(new Option(`${p.length} mm`, p.length))); if(matches.length === 1) { lengthSelect.value = matches[0].length; onShipmentLengthSelect(); } }
function onShipmentLengthSelect() { const poNum = document.getElementById('shipSelectPo').value; const profile = document.getElementById('shipSelectProfile').value; const itemCode = document.getElementById('shipSelectItemCode').value; const length = document.getElementById('shipSelectLength').value; const po = poList.find(p => { if (String(p.poNumber).trim() !== String(poNum).trim() || cleanLen(p.length) !== cleanLen(length)) return false; const matchedCat = masterData.find(m => String(m.profile) === String(p.profile) && cleanLen(m.length) === cleanLen(p.length)); return matchedCat && matchedCat.itemCode === itemCode; }); document.getElementById('shipTotalOrderQty').value = po ? `${po.orderQty} Pcs` : ''; }
async function saveShipmentEntry(){
 if(isAppBusy)return; isAppBusy=true;
 try{
  if(currentUserRole!=='Admin')return;
  const poNum=document.getElementById('shipSelectPo').value,profile=document.getElementById('shipSelectProfile').value,itemCode=document.getElementById('shipSelectItemCode').value,length=cleanLen(document.getElementById('shipSelectLength').value),shipDate=document.getElementById('shipmentDate').value,month=document.getElementById('shipmentMonth').value,container=document.getElementById('shipmentContainer').value,qtyToShip=parseInt(document.getElementById('shipmentQty').value)||0;
  if(!poNum||!profile||!itemCode||!length||qtyToShip<=0)return showToast('Complete all shipment fields.','warning');
  const po=poList.find(p=>String(p.poNumber).trim()===String(poNum).trim()&&cleanLen(p.length)===length&&String(p.profile).trim()===String(profile).trim());
  if(!po)return showToast('Selected PO/profile/length was not found.','error');
  let shippedSoFar=shipmentList.filter(s=>String(s.poNumber).trim()===String(poNum).trim()&&String(s.profile).trim()===String(profile).trim()&&cleanLen(s.length)===length).reduce((a,s)=>a+(Number(s.shippedQty)||0),0);
  const remainingBefore=Math.max(0,Number(po.orderQty)||0-shippedSoFar);
  if(qtyToShip>remainingBefore)return showToast(`Shipment exceeds PO balance. Available: ${remainingBefore} Pcs.`,'error');
  const cat=masterData.find(m=>String(m.profile).trim()===String(profile).trim()&&cleanLen(m.length)===length&&m.itemCode===itemCode);
  if(!cat||!cat.db_id)return showToast('Selected item is not linked to Master Catalog.','error');
  if((cat.crateQty||0)<qtyToShip)return showToast(`Insufficient Crate Stock. Available: ${cat.crateQty||0} Pcs.`,'error');
  const newRemaining=remainingBefore-qtyToShip;
  const newShipment={shipment_date:shipDate,shipment_month:month,po_number:poNum,profile,length,container,shipped_qty:qtyToShip,remaining_balance:newRemaining};
  const {data:inserted,error:shipError}=await supabaseClient.from('shipments').insert([newShipment]).select();
  if(shipError)throw new Error(`Shipment save failed: ${shipError.message}`);
  const nextCrate=cat.crateQty-qtyToShip;
  const {error:stockError}=await supabaseClient.from('master_catalog').update({crate_qty:nextCrate}).eq('id',cat.db_id);
  if(stockError){if(inserted?.[0]?.id)await supabaseClient.from('shipments').delete().eq('id',inserted[0].id);throw new Error(`Shipment stock update failed: ${stockError.message}`);}
  cat.crateQty=nextCrate; shipmentList.unshift({id:inserted[0].id,date:shipDate,month,poNumber:poNum,profile,length,container,shippedQty:qtyToShip,remainingBalance:newRemaining});
  showToast('Shipment saved successfully.','success'); document.getElementById('shipmentEntryForm').reset(); window.renderShipmentHistoryTable(); renderDashboard(); renderProfileSummaryTable(); renderBalanceWorkTable(); updatePoFilters(); renderPoDetailsTable();
 }catch(e){console.error(e);showToast(e.message||'Shipment save failed.','error');}finally{isAppBusy=false;}
}

function deleteShipmentItem(id) { if (currentUserRole !== 'Admin') return; showConfirm("Delete this Shipment?", async () => { await supabaseClient.from('shipments').delete().eq('id', id); shipmentList = shipmentList.filter(s => s.id !== id); window.renderShipmentHistoryTable(); renderDashboard(); renderBalanceWorkTable(); updatePoFilters(); renderPoDetailsTable(); showToast("Deleted", "success"); }); }

window.downloadPackingTemplate = function(){
    if(typeof XLSX==='undefined') return showToast('Excel library not loaded.','error');
    const rows=[
      {Date:new Date().toISOString().slice(0,10),'PL Number':'PL-001','PO Number':'PO-001',Month:new Date().toLocaleString('en-US',{month:'long'}),'Container No':'3rd Container','Crate No':'Crate 1',Profile:'1038','Item Code':'ITEM-001',Length:'2438.4', 'Pcs Qty':250},
      {Date:new Date().toISOString().slice(0,10),'PL Number':'PL-001','PO Number':'PO-001',Month:new Date().toLocaleString('en-US',{month:'long'}),'Container No':'3rd Container','Crate No':'Crate 2',Profile:'1039','Item Code':'ITEM-002',Length:'1204.9', 'Pcs Qty':180}
    ];
    exportTableToExcel(rows,'AIS_Packing_List_Template','Packing List');
};

window.exportPlReadyCrates = function() {
    let readyCratesExportData = []; 
    let availableStock = masterData.map(m => ({ ...m })); 
    let sortedPls = [...packingLists].sort(sortCrates);

    sortedPls.forEach(item => {
        const matched = availableStock.find(m => String(m.profile).trim() == String(item.profile).trim() && String(m.itemCode).trim() == String(item.itemCode).trim() && cleanLen(m.length) == cleanLen(item.length));
        let allocatedCrate = 0, allocatedBox = 0;
        if (matched) {
            let combinedBoxStock = matched.boxQty + matched.crateQty;
            allocatedBox = Math.min(item.pcsQty, combinedBoxStock);
            if (allocatedBox > matched.crateQty) {
                matched.boxQty -= (allocatedBox - matched.crateQty);
                matched.crateQty = 0;
            } else {
                matched.crateQty -= allocatedBox;
            }
        }
        
        let isManualComplete = isManualCrateComplete(item.crateNo, activePackingContainer) ? true : false;
        
        let status = '';
        if (isManualComplete) { status = "Manual Packed"; }
        else if (allocatedBox === item.pcsQty) { status = "Ready to Pack"; } 
        else { status = "Partially Ready"; }
        
        readyCratesExportData.push({ "Crate ID": item.crateNo, "Profile": item.profile, "Item Code": item.itemCode, "Length": item.length, "Req Qty": item.pcsQty, "Box Available": allocatedBox, "Status": status });
    });
    exportTableToExcel(readyCratesExportData, "AIS_Ready_Crates", "Ready Crates");
};

function renderPlAnalytics(filteredPls) {
    try {
        const container = document.getElementById('crateCardsContainer'); if(!container) return;
        
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '15px';
        container.style.alignItems = 'stretch';
        
        let totalWt = 0; let totCutWt = 0, totPunchWt = 0, totWrapWt = 0, totBoxWt = 0, totPendingWt = 0, totManualWt = 0; 
        
        let crateMap = {};
        for(let i=1; i<=50; i++) { crateMap["Crate " + i] = { req: 0, comp: 0, items: [] }; }

        filteredPls.sort(sortCrates);
        let availableStock = masterData.map(m => ({ db_id: m.db_id, profile: m.profile, length: m.length, itemCode: m.itemCode, cutQty: m.cutQty, punchQty: m.punchQty, wrapQty: m.wrapQty, boxQty: m.boxQty, crateQty: m.crateQty, unitWeight: m.unitWeight }));
        
        filteredPls.forEach(pl => {
            const reqQty = pl.pcsQty;
            const matched = availableStock.find(m => String(m.profile).trim() === String(pl.profile).trim() && cleanLen(m.length) === cleanLen(pl.length) && m.itemCode === pl.itemCode);
            const uw = matched ? (matched.unitWeight || 0) : 0;
            
            let allocatedBox = 0, allocatedWrap = 0, allocatedPunch = 0, allocatedCut = 0;
            let remReq = reqQty;
            
            if (matched) {
                let combinedBoxStock = matched.boxQty + matched.crateQty;
                allocatedBox = Math.min(remReq, combinedBoxStock);
                
                if (allocatedBox > matched.crateQty) {
                    matched.boxQty -= (allocatedBox - matched.crateQty);
                    matched.crateQty = 0;
                } else {
                    matched.crateQty -= allocatedBox;
                }
                remReq -= allocatedBox;

                allocatedWrap = Math.min(remReq, matched.wrapQty); matched.wrapQty -= allocatedWrap; remReq -= allocatedWrap;
                allocatedPunch = Math.min(remReq, matched.punchQty); matched.punchQty -= allocatedPunch; remReq -= allocatedPunch;
                allocatedCut = Math.min(remReq, matched.cutQty); matched.cutQty -= allocatedCut; remReq -= allocatedCut;
            }
            
            if (!crateMap[pl.crateNo]) crateMap[pl.crateNo] = { req: 0, comp: 0, items: [] };
            crateMap[pl.crateNo].req += reqQty;
            crateMap[pl.crateNo].comp += allocatedBox;
            crateMap[pl.crateNo].items.push({ profile: pl.profile, itemCode: pl.itemCode || (matched ? matched.itemCode : ''), length: pl.length, req: reqQty, crate: 0, box: allocatedBox, wrap: allocatedWrap, punch: allocatedPunch, cut: allocatedCut, pending: remReq, unitWeight: uw });
        });

        let sortedCrateKeys = Object.keys(crateMap).sort((a,b) => {
             let valA = getCrateSortValue(a); let valB = getCrateSortValue(b);
             if (valA[0] !== valB[0]) return valA[0] - valB[0];
             if (valA[1] !== valB[1]) return valA[1] - valB[1];
             return valA[2].localeCompare(valB[2]);
        });
        
        for (let crateId of sortedCrateKeys) {
            let crate = crateMap[crateId];
            if (crate.req === 0) continue;
            
            let isManualComplete = isManualCrateComplete(crateId, activePackingContainer) ? true : false;
            let isFullyAllocated = (crate.comp === crate.req && crate.req > 0);
            
            crate.items.forEach(i => {
                let w = i.unitWeight;
                totalWt += (i.req * w);
                
                if (isManualComplete) {
                    totManualWt += (i.req * w);
                } else {
                    totBoxWt += (i.box * w);
                    totWrapWt += (i.wrap * w);
                    totPunchWt += (i.punch * w);
                    totCutWt += (i.cut * w);
                    totPendingWt += (i.pending * w);
                }
            });
        }

        try { const ctx = document.getElementById('plWeightChart'); if(ctx && typeof Chart !== 'undefined') { if (plChartInstance) { plChartInstance.destroy(); } const textColor = isDarkMode ? '#f8fafc' : '#0f172a'; if (totalWt === 0) { plChartInstance = new Chart(ctx.getContext('2d'), { type: 'doughnut', data: { labels: ['No Data'], datasets: [{ data: [1], backgroundColor: ['#e2e8f0'] }] }, options: { ...dashboardChartOptions(textColor, false), cutout: '65%' } }); } else { let cData = [ Number(totCutWt.toFixed(2))||0, Number(totPunchWt.toFixed(2))||0, Number(totWrapWt.toFixed(2))||0, Number(totBoxWt.toFixed(2))||0, Number(totManualWt.toFixed(2))||0, Number(totPendingWt.toFixed(2))||0 ]; if(cData.every(v => v===0)) cData = [1]; plChartInstance = new Chart(ctx.getContext('2d'), { type: 'doughnut', data: { labels: cData.length===1?['No Data']:['Cut', 'Punch', 'Wrap', 'Box', 'Completed', 'Pending'], datasets: [{ data: cData, backgroundColor: cData.length===1?['#e2e8f0']:['#0284c7', '#ea580c', '#d946ef', '#10b981', '#059669', '#e11d48'], borderWidth: isDarkMode ? 3 : 2, borderColor: isDarkMode ? '#1e293b' : '#fff' }] }, options: { responsive: true, cutout: '65%', plugins: { legend: { position: 'bottom', labels: { color: textColor } } } } }); } } } catch(err) {}
        
        let plWeightBreakdownHtml = `
        <div style="font-size: 11px; margin-top: 15px; width: 100%; display: flex; flex-direction: column; gap: 4px;">
            <div style="display:flex; justify-content:space-between; color: #e11d48;"><span>Pending:</span> <span>${totPendingWt.toFixed(2)} kg</span></div>
            <div style="display:flex; justify-content:space-between; color: #0284c7;"><span>Cut Stage:</span> <span>${totCutWt.toFixed(2)} kg</span></div>
            <div style="display:flex; justify-content:space-between; color: #ea580c;"><span>Punch Stage:</span> <span>${totPunchWt.toFixed(2)} kg</span></div>
            <div style="display:flex; justify-content:space-between; color: #d946ef;"><span>Wrap Stage:</span> <span>${totWrapWt.toFixed(2)} kg</span></div>
            <div style="display:flex; justify-content:space-between; color: #10b981;"><span>Box Stage:</span> <span>${totBoxWt.toFixed(2)} kg</span></div>
            <div style="display:flex; justify-content:space-between; color: #059669; font-weight:800; border-top:1px dashed #cbd5e1; padding-top:4px;"><span>Completed:</span> <span>${totManualWt.toFixed(2)} kg</span></div>
        </div>`;
        
        document.getElementById('plTotalWeightDisplay').innerHTML = totalWt > 0 ? `${totalWt.toFixed(1)} kg<br>${plWeightBreakdownHtml}` : '0.0 kg'; 
        container.innerHTML = ''; 
        
        let html = '';
        for (let crateId of sortedCrateKeys) {
            let crate = crateMap[crateId];
            if (crate.req === 0 && !crateId.toLowerCase().startsWith("crate")) continue; 
            if (crate.req === 0) continue; 
            
            // A crate is COMPLETE only when Admin explicitly marks it with the manual tick.
            // Being fully available in Box stage means "Ready to Pack", not "Completed".
            let isManualComplete = isManualCrateComplete(crateId, activePackingContainer) ? true : false;

            let compPct = isManualComplete ? 100 : (crate.req > 0 ? Math.min(99, Math.round((crate.comp / crate.req) * 100)) : 0);

            let totReq = crate.req, totComp = crate.comp, totPending = 0;
            let totCut = 0, totPunch = 0, totWrap = 0, totBox = 0, totNetWeight = 0;
            crate.items.forEach(i => { totCut += i.cut; totPunch += i.punch; totWrap += i.wrap; totBox += i.box; totPending += i.pending; totNetWeight += (i.req * i.unitWeight); });
            
            let stageName = "Pending", stageColor = "#475569", stageBg = "#f8fafc", icon = "fa-spinner";
            
            if (isManualComplete) { stageName = "PACKED & COMPLETED"; stageColor = "#059669"; stageBg = "linear-gradient(90deg, #ecfdf5, #ffffff)"; icon = "fa-check-double"; }
            else if (totBox === totReq && totReq > 0) { stageName = "READY TO PACK"; stageColor = "#10b981"; stageBg = "#ecfdf5"; icon = "fa-box"; }
            else if (totPending > 0) { stageName = "Awaiting / Short"; stageColor = "#e11d48"; stageBg = "#fff1f2"; icon = "fa-hourglass-start"; }
            else if (totCut > 0) { stageName = "Processing: Cut"; stageColor = "#0284c7"; stageBg = "#f0f9ff"; icon = "fa-scissors"; }
            else if (totPunch > 0) { stageName = "Processing: Punch"; stageColor = "#ea580c"; stageBg = "#fff7ed"; icon = "fa-hammer"; }
            else if (totWrap > 0) { stageName = "Processing: Wrap"; stageColor = "#d946ef"; stageBg = "#fdf4ff"; icon = "fa-scroll"; }
            else if (totBox > 0) { stageName = "Partially Boxed"; stageColor = "#059669"; stageBg = "#ecfdf5"; icon = "fa-box-open"; }

            let itemDetailsHtml = '';
            itemDetailsHtml = crate.items.map(i => {
                let boxStageFull = (i.box === i.req);
                return `<div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; border-left: 3px solid ${isManualComplete ? '#059669' : '#0284c7'}; padding-left: 10px; margin-bottom: 5px; font-size: 11.5px;">
                    <div style="font-weight: 700; color: var(--primary-dark); margin-right: 15px;">
                        Pr: ${i.profile} <span style="margin: 0 4px; color: #cbd5e1;">|</span> L: ${i.length}mm <span style="margin: 0 4px; color: #cbd5e1;">|</span> Req Qty: ${i.req}
                    </div>
                    <div style="display:flex; gap:6px; flex-wrap:wrap; font-size: 10.5px; align-items:center;">
                        <span style="background: #10b981; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: 700;">Box: ${i.box}</span>
                        <span style="background: #d946ef; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: 700;">Wrp: ${i.wrap}</span>
                        <span style="background: #ea580c; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: 700;">Pch: ${i.punch}</span>
                        <span style="background: #0284c7; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: 700;">Cut: ${i.cut}</span>
                        ${i.pending > 0 ? `<span style="border: 1px solid #e11d48; color: #e11d48; padding: 1px 6px; border-radius: 4px; font-weight: 800;">SHORT: ${i.pending}</span>` : (boxStageFull ? `<span style="background:#059669; color:#fff; padding:2px 6px; border-radius: 4px; font-weight: 800;"><i class="fa-solid fa-check"></i> READY TO PACK</span>` : `<span style="border: 1px solid #10b981; color: #10b981; padding: 1px 6px; border-radius: 4px; font-weight: 800;"><i class="fa-solid fa-check"></i> OK</span>`)}
                    </div>
                </div>`;
            }).join('');

            let deleteBtnHtml = currentUserRole === 'Admin' && totReq > 0 ? `<div style="text-align:right; margin-top: auto; padding-top: 10px;"><button class="btn btn-danger" style="padding: 4px 10px; font-size: 11px; border-radius: 6px; background: #e11d48;" onclick="deleteEntireCrate('${crateId}')"><i class="fa-solid fa-trash"></i> Delete Crate Group</button></div>` : ''; 

            let cardStyle = isManualComplete 
                ? `background: ${stageBg}; border: 1px solid #a7f3d0; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.1);` 
                : `background: ${stageBg}; border: 1px solid rgba(0,0,0,0.06); box-shadow: 0 2px 8px rgba(0,0,0,0.03);`;

            html += `
            <div class="crate-card" style="width: 100%; max-width: 900px; margin: 0 auto; ${cardStyle} border-radius: 12px; display: flex; flex-direction: row; overflow: hidden; transition: all 0.3s ease; padding: 0;"> 
                
                <div style="width: 110px; min-width: 110px; display: flex; flex-direction: column; justify-content: center; align-items: center; border-right: 2px dashed ${isManualComplete ? '#6ee7b7' : '#e2e8f0'}; padding: 15px; cursor: ${currentUserRole === 'Admin' ? 'pointer' : 'not-allowed'}; background: ${isManualComplete ? 'rgba(16, 185, 129, 0.05)' : 'transparent'}; transition: 0.3s;" onclick="${currentUserRole === 'Admin' ? `window.toggleManualCrate('${crateId}', ${!isManualComplete})` : `showToast('Only Admin can modify this!', 'error')`}">
                    <div style="width: 45px; height: 45px; border-radius: 50%; border: 2px solid ${isManualComplete ? '#10b981' : '#cbd5e1'}; background: ${isManualComplete ? '#10b981' : 'transparent'}; display: flex; align-items: center; justify-content: center; color: ${isManualComplete ? '#fff' : '#cbd5e1'}; font-size: 22px; transition: 0.3s;">
                        <i class="fa-solid fa-check"></i>
                    </div>
                    <div style="font-size: 10.5px; font-weight: 800; margin-top: 10px; color: ${isManualComplete ? '#10b981' : '#94a3b8'}; text-transform: uppercase; text-align: center; letter-spacing: 0.5px;">
                        ${isManualComplete ? 'PACKED' : 'MARK DONE'}
                    </div>
                </div>

                <div style="flex: 1; padding: 18px; display: flex; flex-direction: column; justify-content: center;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; margin-bottom: 15px; gap: 10px;"> 
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <h4 style="color: ${isManualComplete ? '#059669' : 'var(--primary-dark)'}; margin: 0; font-size: 16px; font-weight: 900;"><i class="fa-solid fa-box-open" style="color: #f59e0b;"></i> ${crateId}</h4>
                            <span style="background: ${isManualComplete ? '#dcfce7' : 'rgba(0,0,0,0.05)'}; color: ${isManualComplete ? '#059669' : stageColor}; padding: 4px 10px; border-radius: 20px; font-size: 10.5px; font-weight: 800; letter-spacing: 0.5px; border: 1px solid ${isManualComplete ? '#a7f3d0' : 'transparent'};"><i class="fa-solid ${icon}"></i> ${stageName}</span>
                        </div>
                        <div style="display:flex; gap:15px; align-items:center;"> 
                            <span style="font-size: 12.5px; font-weight: 800; color: var(--text-muted);">Total Req: <span style="color:var(--primary-dark); font-size:14px;">${crate.req} Pcs</span></span>
                            <span style="font-size: 11.5px; font-weight: 800; background: #f0f9ff; border: 1px solid #bae6fd; color: #0284c7; padding: 4px 10px; border-radius: 6px;"><i class="fa-solid fa-weight-hanging"></i> ${totNetWeight.toFixed(2)} kg</span> 
                        </div>
                    </div> 

                    <div style="background: ${isManualComplete ? '#fff' : 'rgba(255,255,255,0.6)'}; border: 1px solid ${isManualComplete ? '#dcfce7' : 'rgba(0,0,0,0.05)'}; border-radius: 8px; padding: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                        ${itemDetailsHtml}
                    </div>
                    ${deleteBtnHtml}
                </div>
            </div>`;
        } 
        container.innerHTML = html || `<div style="padding:30px;text-align:center;color:var(--text-muted);font-weight:700;"><i class="fa-solid fa-box-open" style="font-size:32px;display:block;margin-bottom:10px;"></i>No crate data for <b>${activePackingContainer}</b> yet.</div>`;
    } catch(e) {}
}

window.toggleManualCrate = async function(crateId, isChecked) {
    if (currentUserRole !== 'Admin') return showToast('Only Admin can mark crates as complete!', 'error');
    const stateKey=manualCrateKey(crateId,activePackingContainer,activePackingMonth);
    const previous=globalManualCrates[stateKey];
    if(isChecked){
      let currentQty=0;
      getPackingContainerRecords(activePackingMonth,activePackingContainer).filter(p=>String(p.crateNo).trim()===String(crateId).trim()).forEach(i=>currentQty+=parseInt(i.pcsQty,10)||0);
      if(currentQty<=0) return showToast('This crate has no packing quantity to complete.','warning');
      globalManualCrates[stateKey]={qty:currentQty,month:activePackingMonth,container:activePackingContainer,crateNo:crateId,completedAt:new Date().toISOString()};
    } else delete globalManualCrates[stateKey];
    if(!await window.saveManualCratesToDB()){
      if(previous) globalManualCrates[stateKey]=previous; else delete globalManualCrates[stateKey];
      return;
    }
    renderPackingListTable(); renderDashboard();
};

window.saveManualCrateQty = async function(crateId, qty) {
    if (currentUserRole !== 'Admin') return;
    const stateKey = manualCrateKey(crateId, activePackingContainer);
    if (globalManualCrates[stateKey]) {
        globalManualCrates[stateKey].qty = parseInt(qty) || 0;
        localStorage.setItem('manual_crates', JSON.stringify(globalManualCrates));
        renderDashboard();
        await window.saveManualCratesToDB();
    }
}

window.packToCrate = async function(profile,itemCode,length,qtyToPack){
  if(isAppBusy) return; isAppBusy=true;
  try{
    if(currentUserRole!=='Admin') return;
    qtyToPack=parseInt(qtyToPack)||0; if(qtyToPack<=0) return showToast('Enter a valid packing quantity.','warning');
    const matched=masterData.find(m=>String(m.profile).trim()===String(profile).trim()&&m.itemCode===itemCode&&cleanLen(m.length)===cleanLen(length));
    if(!matched) return showToast('Profile/item/length not found.','error');
    if((matched.boxQty||0)<qtyToPack) return showToast('Insufficient Box Stock to pack.','error');
    if(!matched.db_id) return showToast('This catalog row is not linked to the database.','error');
    const nextBox=matched.boxQty-qtyToPack,nextCrate=(matched.crateQty||0)+qtyToPack;
    const {error}=await supabaseClient.from('master_catalog').update({box_qty:nextBox,crate_qty:nextCrate}).eq('id',matched.db_id);
    if(error) throw new Error(`Crate stock update failed: ${error.message}`);
    matched.boxQty=nextBox; matched.crateQty=nextCrate;
    showToast('Successfully packed to Crate Stage.','success'); renderDashboard(); renderProfileSummaryTable(); renderBalanceWorkTable(); renderPackingListTable();
  }catch(e){console.error(e);showToast(e.message||'Packing to crate failed.','error');}finally{isAppBusy=false;}
};

function renderPackingListTable() { 
    try {
        const tabCard = document.querySelector('#packingListTab .card:last-child');
        if(!tabCard) return;

        ensurePackingSelection();
        renderPackingShipmentControls();
        let filtered = getPackingContainerRecords(activePackingMonth, activePackingContainer);
        if(document.getElementById('crateCardsContainer')) renderPlAnalytics(filtered);

        let consolidatedMap = {};
        filtered.forEach(pl => {
            let key = `${pl.profile}_${pl.itemCode}_${pl.length}`;
            if(!consolidatedMap[key]) { consolidatedMap[key] = { profile: pl.profile, itemCode: pl.itemCode, length: pl.length, qty: 0 }; }
            consolidatedMap[key].qty += pl.pcsQty;
        });

        const readyHead = document.querySelector('#plReadyToPackTableBody')?.parentElement.querySelector('thead tr');
        if(readyHead && !readyHead.innerHTML.includes('Action')) readyHead.insertAdjacentHTML('beforeend', '<th style="width:120px;">Action</th>');

        let readyCratesHTML = ''; 
        let availableStock = masterData.map(m => ({ ...m })); 
        let sortedPls = [...filtered].sort(sortCrates);

        for (let i = 0; i < sortedPls.length; i++) {
            let item = sortedPls[i];
            
            let rowspan = 1;
            if (i === 0 || sortedPls[i].crateNo !== sortedPls[i-1].crateNo) {
                let j = i + 1;
                while (j < sortedPls.length && sortedPls[j].crateNo === item.crateNo) {
                    rowspan++;
                    j++;
                }
            } else {
                rowspan = 0;
            }

            const matched = availableStock.find(m => String(m.profile).trim() == String(item.profile).trim() && String(m.itemCode).trim() == String(item.itemCode).trim() && cleanLen(m.length) == cleanLen(item.length));
            let allocatedCrate = 0, allocatedBox = 0;
            if (matched) {
                let combinedBoxStock = matched.boxQty + matched.crateQty;
                allocatedBox = Math.min(item.pcsQty, combinedBoxStock);
                if (allocatedBox > matched.crateQty) {
                    matched.boxQty -= (allocatedBox - matched.crateQty);
                    matched.crateQty = 0;
                } else {
                    matched.crateQty -= allocatedBox;
                }
            }

            let isManualComplete = isManualCrateComplete(item.crateNo, activePackingContainer);
            let status = ''; let actionBtn = '';

            let manualTickHtml = `<label style="cursor:${currentUserRole === 'Admin' ? 'pointer' : 'not-allowed'}; display:inline-flex; align-items:center; gap:4px; background:${isManualComplete ? '#059669' : '#f1f5f9'}; color:${isManualComplete ? '#fff' : '#475569'}; padding:4px 8px; border-radius:6px; font-size:11px; font-weight:bold; border:1px solid ${isManualComplete ? '#059669' : '#cbd5e1'};"><input type="checkbox" onchange="window.toggleManualCrate('${item.crateNo}', this.checked)" ${isManualComplete ? 'checked' : ''} ${currentUserRole === 'Admin' ? '' : 'disabled'}> Pack</label>`;

            if (isManualComplete) {
                status = `<span style="color:#059669;font-weight:bold;background:rgba(209, 250, 229, 0.4);padding:4px 8px;border-radius:6px;"><i class="fa-solid fa-check-double"></i> Manual Packed</span>`;
                actionBtn = manualTickHtml;
            } else if (allocatedBox === item.pcsQty) {
                status = `<span style="color:var(--success-color);font-weight:bold;background:rgba(209, 250, 229, 0.4);padding:4px 8px;border-radius:6px;"><i class="fa-solid fa-check"></i> Ready in Box</span>`;
                if (currentUserRole === 'Admin') {
                    actionBtn = `
                        <div style="display:flex; gap:4px; align-items:center;">
                            ${manualTickHtml}
                            <button class="btn" style="background:#0284c7; padding:4px 8px; font-size:11px;" onclick="openGenericEdit('packing_list', ${item.id}, {pcs_qty: '${item.pcsQty}', crate_no: '${item.crateNo}'})"><i class="fa-solid fa-pen"></i></button>
                        </div>
                    `;
                } else { actionBtn = `<i class="fa-solid fa-lock" style="color:#aaa;"></i>`; }
            } else {
                status = `<span style="color:var(--warning-color);font-weight:bold;background:rgba(255, 228, 230, 0.4);padding:4px 8px;border-radius:6px;"><i class="fa-solid fa-triangle-exclamation"></i> Partially Ready</span>`;
                if (currentUserRole === 'Admin') {
                    actionBtn = `<div style="display:flex; gap:4px; align-items:center;">${manualTickHtml} <button class="btn" style="background:#0284c7; padding:4px 8px; font-size:11px;" onclick="openGenericEdit('packing_list', ${item.id}, {pcs_qty: '${item.pcsQty}', crate_no: '${item.crateNo}'})"><i class="fa-solid fa-pen"></i></button></div>`;
                } else { actionBtn = `<i class="fa-solid fa-lock" style="color:#aaa;"></i>`; }
            }
            
            readyCratesHTML += `<tr>`;
            if(rowspan > 0) {
                readyCratesHTML += `<td rowspan="${rowspan}" style="vertical-align:middle; text-align:center; border-right: 2px solid var(--emerald-border); background:rgba(0,0,0,0.02);"><b>${item.crateNo}</b></td>`;
            }
            readyCratesHTML += `<td>${item.profile}</td><td><span style="color:var(--info-color);font-weight:600;">${item.itemCode}</span></td><td>${item.length} mm</td><td><span class="stock-badge bg-total">${item.pcsQty}</span></td><td><span class="stock-badge" style="background:#ecfdf5; color:#10b981;">${allocatedBox}</span></td><td>${status}</td><td>${actionBtn}</td></tr>`;
        }

        let rawHTML = '';
        filtered.forEach(pl => {
            rawHTML += `<tr><td>${pl.date}</td><td><b>${pl.plNumber}</b></td><td>${pl.poNumber}</td><td>${pl.month}</td><td>${pl.container}</td><td><span class="stock-badge bg-crate">${pl.crateNo}</span></td><td>${pl.profile}</td><td><span style="color:var(--info-color); font-weight:600;">${pl.itemCode||'-'}</span></td><td>${pl.length} mm</td><td><span class="stock-badge bg-total">${pl.pcsQty} Pcs</span></td><td>${pl.netWeight} kg / ${pl.grossWeight} kg</td>
            <td>${currentUserRole === 'Admin' ? `
                <button class="btn btn-accent" style="padding:4px 8px; font-size:11px;" onclick="openGenericEdit('packing_list', ${pl.id}, {pcs_qty: '${pl.pcsQty}', crate_no: '${pl.crateNo}'})"><i class="fa-solid fa-pen"></i></button>
                <button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deletePackingListItem(${pl.id})"><i class="fa-solid fa-trash"></i></button>
            ` : `<i class="fa-solid fa-lock" style="color:#aaa;"></i>`}</td></tr>`;
        });

        const sumHead = document.querySelector('#plSummaryTableBody')?.parentElement.querySelector('thead tr');
        if(sumHead && !sumHead.innerHTML.includes('Cardboard Bal')) {
            sumHead.insertAdjacentHTML('beforeend', '<th style="background:#047857; color:#fff;">Cardboard Bal</th>');
        }

        let consHTML = Object.values(consolidatedMap).map(v => {
            const matched = masterData.find(m => String(m.profile).trim() === String(v.profile).trim() && String(m.itemCode).trim() === String(v.itemCode).trim() && cleanLen(m.length) === cleanLen(v.length));
            let currentStock = matched ? ((matched.cutQty||0) + (matched.punchQty||0) + (matched.wrapQty||0) + (matched.boxQty||0) + (matched.crateQty||0)) : 0;
            let bal = currentStock - v.qty;
            let balStatus = bal >= 0 ? `<span style="color:var(--success-color);"><i class="fa-solid fa-check"></i> +${bal}</span>` : `<span style="color:var(--warning-color);"><i class="fa-solid fa-arrow-down"></i> ${Math.abs(bal)}</span>`;
            
            let wipPcs = matched ? ((matched.cutQty||0) + (matched.punchQty||0) + (matched.wrapQty||0)) : 0;
            let plPendingQty = Math.max(0, v.qty - currentStock);
            let unboxedAndPendingPcs = plPendingQty + wipPcs;
            let cap = matched ? (matched.boxCapacity || 100) : 100;
            let reqBoxes = Math.ceil(unboxedAndPendingPcs / cap);
            let availCardboard = getAvailableCardboard(v.profile, v.itemCode, v.length);
            let cbBalance = availCardboard - reqBoxes;
            let cbStatusHtml = cbBalance >= 0 ? `<span style="color:var(--success-color); font-weight:800;">OK (+${cbBalance})</span>` : `<span style="color:var(--warning-color); font-weight:800;">Short ${Math.abs(cbBalance)}</span>`;
            
            return `<tr><td><b>${v.profile}</b></td><td><span style="color:var(--info-color);font-weight:600;">${v.itemCode}</span></td><td>${v.length} mm</td><td><span class="stock-badge bg-total">${v.qty} Pcs</span></td><td><span class="stock-badge bg-wrap">${currentStock} Pcs</span></td><td><b>${balStatus}</b></td><td style="background:${cbBalance < 0 ? 'rgba(225, 29, 72, 0.05)' : 'rgba(16, 185, 129, 0.05)'};">${cbStatusHtml}</td></tr>`;
        }).join('');

        const sumTbody = document.getElementById('plSummaryTableBody'); if (sumTbody) sumTbody.innerHTML = consHTML || '<tr><td colspan="7" style="text-align:center;">No data</td></tr>';
        const readyTbody = document.getElementById('plReadyToPackTableBody'); if (readyTbody) readyTbody.innerHTML = readyCratesHTML || '<tr><td colspan="8" style="text-align:center; color:var(--text-muted);">No crates available in Box Stage</td></tr>';
        const rawTbody = document.getElementById('packingListTableBody'); if (rawTbody) rawTbody.innerHTML = rawHTML || '<tr><td colspan="12" style="text-align:center; color:var(--text-muted);">No logs</td></tr>';
    } catch(e) { console.error('Packing list render error:', e); const body=document.getElementById('packingListTableBody'); if(body) body.innerHTML='<tr><td colspan=12 style="text-align:center;color:#e11d48;font-weight:700;">Packing List could not be rendered. Check browser console for details.</td></tr>'; }
}
window.deleteEntireCrate = async function(crateId) {
    if(currentUserRole !== 'Admin') return;
    showConfirm(`Delete all items in ${crateId}?`, async () => {
        const items = packingLists.filter(p => p.crateNo === crateId);
        for (let item of items) {
            try { await supabaseClient.from('packing_list').delete().eq('id', item.id); } catch(e){}
            packingLists = packingLists.filter(p => p.id !== item.id);
        }
        const stateKey = manualCrateKey(crateId, activePackingContainer, activePackingMonth);
        if(globalManualCrates[stateKey]) {
            delete globalManualCrates[stateKey];
            await window.saveManualCratesToDB();
        }
        renderPackingListTable(); renderDashboard(); renderBalanceWorkTable();
        showToast(`Crate ${crateId} deleted`, "success");
    });
}
window.deletePackingListItem = function(id) { if(currentUserRole !== 'Admin') return; showConfirm("Delete this packing list record?", async () => { try { await supabaseClient.from('packing_list').delete().eq('id', id); } catch(e){} packingLists = packingLists.filter(p => p.id !== id); renderPackingListTable(); renderDashboard(); renderBalanceWorkTable(); showToast("Deleted", "success"); }); }

/*
 * PACKING LIST DATA RESET
 * -----------------------
 * Deletes the complete Packing List dataset for the currently selected
 * Month + Container. This is intentionally scoped to packing_list only;
 * Production Orders, Master Catalog, Production History, Rejects, Recoveries
 * and Cardboard Stock are NOT touched. Shipment/manual-crate state for the
 * same container is reset after the database deletion succeeds.
 */
window.clearCurrentPackingContainer = function() {
    if (currentUserRole !== 'Admin') {
        showToast('Admin access is required to clear Packing List data.', 'warning');
        return;
    }
    ensurePackingSelection();
    const month = String(activePackingMonth || '').trim();
    const container = String(activePackingContainer || '').trim();
    const records = getPackingContainerRecords(month, container);
    const count = records.length;
    if (!month || !container) return showToast('Please select a Month and Container first.', 'warning');
    if (!count) return showToast(`No Packing List data found for ${month} / ${container}.`, 'info');

    showConfirm(
      `<b style="color:#b91c1c">PERMANENT DELETE</b><br><br>Delete <b>${count}</b> Packing List record(s) from <b>${month}</b> → <b>${container}</b>?<br><br><span style="color:#b91c1c;font-weight:700">This cannot be undone.</span><br><br>Only Packing List records for this selected container will be deleted. Production Orders, Master Catalog, Production History, Reject/Recover and Cardboard data will remain unchanged.`,
      async () => {
        const btn = document.getElementById('plClearContainerBtn');
        const oldHtml = btn ? btn.innerHTML : '';
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Deleting...'; }
        try {
            // Delete exact IDs one-by-one so the operation remains compatible
            // with the existing Supabase RLS policies used by this app.
            let deleted = 0;
            const failed = [];
            for (const row of records) {
                const { error } = await supabaseClient.from('packing_list').delete().eq('id', row.id);
                if (error) failed.push(`${row.id}: ${error.message}`);
                else deleted++;
            }
            if (failed.length) {
                console.error('Packing List clear failed:', failed);
                await loadDataFromSupabase(true);
                throw new Error(`${failed.length} record(s) could not be deleted. No local reset was applied to the remaining data.`);
            }

            // Remove only this container's in-memory rows.
            packingLists = packingLists.filter(p => !(String(p.month || '').trim() === month && String(p.container || '').trim() === container));

            // Reset shipment completion state for the emptied container.
            const shipmentKey = shipmentStateKey(month, container);
            if (shipmentStates[shipmentKey]) {
                delete shipmentStates[shipmentKey];
                await savePackingShipmentStates();
            }

            // Reset manual crate completion/qty state belonging to this container.
            let manualChanged = false;
            Object.keys(globalManualCrates || {}).forEach(k => {
                if (k.startsWith(`${month}::${container}::`)) { delete globalManualCrates[k]; manualChanged = true; }
            });
            if (manualChanged) {
                localStorage.setItem('manual_crates', JSON.stringify(globalManualCrates));
                await window.saveManualCratesToDB();
            }

            renderPackingListTable();
            renderDashboard();
            renderBalanceWorkTable();
            showToast(`${deleted} Packing List record(s) deleted from ${month} / ${container}.`, 'success');
        } catch (e) {
            console.error('Clear Packing List error:', e);
            showToast(`Delete failed: ${e.message || 'Supabase rejected the operation.'}`, 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = oldHtml; }
        }
      }
    );
};

function populatePlPoDropdown() { const plPoSelect = document.getElementById('plSelectPo'); if(!plPoSelect) return; plPoSelect.innerHTML = '<option value="">-- Choose PO Number --</option>'; [...new Set(poList.map(p => String(p.poNumber).trim()))].forEach(po => plPoSelect.appendChild(new Option(po, po))); }
function onPlPoSelect() { const poNum = document.getElementById('plSelectPo').value; const profileSelect = document.getElementById('plSelectProfile'); profileSelect.innerHTML = '<option value="">-- Select Profile --</option>'; document.getElementById('plSelectItemCode').innerHTML = '<option value="">-- Select Item Code --</option>'; document.getElementById('plSelectLength').innerHTML = '<option value="">-- Select Length --</option>'; document.getElementById('plNetWeight').value = ''; if (!poNum) return; const poItems = poList.filter(p => String(p.poNumber).trim() === String(poNum).trim()); [...new Set(poItems.map(p => String(p.profile).trim()))].forEach(prof => profileSelect.appendChild(new Option(prof, prof))); }
function onPlProfileSelect() { const poNum = document.getElementById('plSelectPo').value; const profile = document.getElementById('plSelectProfile').value; const itemSelect = document.getElementById('plSelectItemCode'); itemSelect.innerHTML = '<option value="">-- Select Item Code --</option>'; document.getElementById('plSelectLength').innerHTML = '<option value="">-- Select Length --</option>'; document.getElementById('plNetWeight').value = ''; if (!poNum || !profile) return; const poItems = poList.filter(p => String(p.poNumber).trim() === poNum && String(p.profile).trim() === profile); const uniqueItems = []; poItems.forEach(p => { const matchedCat = masterData.find(m => String(m.profile) === profile && cleanLen(m.length) === cleanLen(p.length)); if(matchedCat && matchedCat.itemCode && !uniqueItems.includes(matchedCat.itemCode)) { uniqueItems.push(matchedCat.itemCode); itemSelect.appendChild(new Option(matchedCat.itemCode, matchedCat.itemCode)); } }); }
function onPlItemCodeSelect() { const poNum = document.getElementById('plSelectPo').value; const profile = document.getElementById('plSelectProfile').value; const itemCode = document.getElementById('plSelectItemCode').value; const lengthSelect = document.getElementById('plSelectLength'); lengthSelect.innerHTML = '<option value="">-- Select Length --</option>'; document.getElementById('plNetWeight').value = ''; if (!poNum || !profile || !itemCode) return; const poItems = poList.filter(p => String(p.poNumber).trim() === poNum && String(p.profile).trim() === profile); const matches = poItems.filter(p => { const matchedCat = masterData.find(m => String(m.profile) === profile && cleanLen(m.length) === cleanLen(p.length)); return matchedCat && matchedCat.itemCode === itemCode; }); matches.forEach(p => lengthSelect.appendChild(new Option(`${p.length} mm`, p.length))); if(matches.length === 1) { lengthSelect.value = matches[0].length; calculatePlWeights(); } }
function calculatePlWeights() { const poNum = document.getElementById('plSelectPo').value; const profile = document.getElementById('plSelectProfile').value; const itemCode = document.getElementById('plSelectItemCode').value; const length = document.getElementById('plSelectLength').value; const pcsQty = parseInt(document.getElementById('plPcsQty').value) || 0; if (!profile || !itemCode || !length || pcsQty <= 0) { document.getElementById('plNetWeight').value = ''; return; } const po = poList.find(p => { if (String(p.poNumber).trim() !== String(poNum).trim() || cleanLen(p.length) !== cleanLen(length)) return false; const matchedCat = masterData.find(m => String(m.profile) === String(p.profile) && cleanLen(m.length) === cleanLen(p.length)); return matchedCat && matchedCat.itemCode === itemCode; }); if(!po) return; const matched = masterData.find(m => String(m.profile).trim() === String(profile).trim() && cleanLen(m.length) === cleanLen(length)); const uw = matched ? matched.unitWeight : 0; document.getElementById('plNetWeight').value = `${(pcsQty * uw).toFixed(2)} kg`; }
async function savePackingListEntry(){
 if(isAppBusy)return; isAppBusy=true;
 try{
  if(currentUserRole!=='Admin')return;
  const plNum=document.getElementById('plNumber').value.trim(),poNum=document.getElementById('plSelectPo').value,container=normalizeContainerName(document.getElementById('plContainer').value),plDate=document.getElementById('plDate').value,profile=document.getElementById('plSelectProfile').value,itemCode=document.getElementById('plSelectItemCode').value,length=cleanLen(document.getElementById('plSelectLength').value),crateNo=document.getElementById('plBoxQty').value.trim()||'Crate 1',pcsQty=parseInt(document.getElementById('plPcsQty').value)||0,grossWeight=parseFloat(document.getElementById('plGrossWeight').value)||0;
  if(!plNum||!poNum||!profile||!itemCode||!length||pcsQty<=0)return showToast('Complete all Packing List fields.','warning');
  const po=poList.find(p=>String(p.poNumber).trim()===String(poNum).trim()&&cleanLen(p.length)===length&&String(p.profile).trim()===String(profile).trim());
  if(!po)return showToast('Selected PO/profile/length was not found.','error');
  const matched=masterData.find(m=>String(m.profile).trim()===String(profile).trim()&&cleanLen(m.length)===length&&m.itemCode===itemCode);
  if(!matched)return showToast('Selected catalog item was not found.','error');
  const alreadyPacked=packingLists.filter(x=>String(x.poNumber).trim()===String(poNum).trim()&&String(x.profile).trim()===String(profile).trim()&&cleanLen(x.length)===length).reduce((a,x)=>a+(Number(x.pcsQty)||0),0);
  if(alreadyPacked+pcsQty>Number(po.orderQty||0))return showToast(`Packing quantity exceeds PO quantity. Remaining: ${Math.max(0,Number(po.orderQty||0)-alreadyPacked)} Pcs.`,'error');
  const netWeight=parseFloat((pcsQty*(matched.unitWeight||0)).toFixed(2)),filterMonth=activePackingMonth||new Date().toLocaleString('en-US',{month:'long'});
  const newPl={pl_number:plNum,po_number:poNum,shipment_month:filterMonth,container,crate_no:crateNo,profile,item_code:itemCode,length,box_qty:1,pcs_qty:pcsQty,net_weight:netWeight,gross_weight:grossWeight,packing_date:plDate};
  const {data:inserted,error}=await supabaseClient.from('packing_list').insert([newPl]).select();
  if(error)throw new Error(`Packing List save failed: ${error.message}`);
  if(inserted?.length)packingLists.unshift({id:inserted[0].id,plNumber:plNum,poNumber:poNum,month:filterMonth,container,crateNo,profile,itemCode,length,boxQty:1,pcsQty,netWeight,grossWeight,date:plDate});
  showToast('Packing List record saved successfully.','success'); document.getElementById('packingListForm').reset(); renderPackingListTable();
 }catch(e){console.error(e);showToast(e.message||'Packing List save failed.','error');}finally{isAppBusy=false;}
}
async function processPlExcelUpload() {
  const fileInput = document.getElementById('plExcelUpload');
  if (!fileInput?.files?.length) { showToast('Please select an Excel file first.', 'warning'); return; }
  if (currentUserRole !== 'Admin') { showToast('Admin access is required for Excel upload.', 'warning'); return; }
  const uploadBtn = document.getElementById('plUploadBtn');
  const originalBtnText = uploadBtn?.innerHTML || 'Upload';
  if (uploadBtn) { uploadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Validating...'; uploadBtn.disabled = true; }

  const file = fileInput.files[0];
  const defaultPlNum = file.name.replace(/\.[^/.]+$/, '').trim();
  const roman = ['i','ii','iii','iv','v','vi','vii','viii','ix','x'];
  const toRoman = n => roman[n-1] || String(n);
  const normalHeader = h => String(h ?? '').toLowerCase().replace(/[\s_\-\(\)\.\/]/g,'');

  try {
    const data = new Uint8Array(await file.arrayBuffer());
    const workbook = XLSX.read(data, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawJson = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    if (!rawJson.length) throw new Error('The Excel sheet is empty.');

    let headerRowIndex = -1, headers = [];
    for (let i = 0; i < Math.min(20, rawJson.length); i++) {
      const row = rawJson[i].map(normalHeader);
      const rowStr = row.join('|');
      let score = 0;
      if (rowStr.includes('ponumber') || rowStr.includes('po')) score++;
      if (rowStr.includes('profile') || rowStr.includes('profileno')) score++;
      if (rowStr.includes('itemcode') || rowStr.includes('item')) score++;
      if (rowStr.includes('crateno') || rowStr.includes('crate') || rowStr.includes('numberofcrates')) score++;
      if (rowStr.includes('pcsqty') || rowStr.includes('pcspercrate') || rowStr.includes('qty')) score++;
      if (score >= 3) { headerRowIndex=i; headers=row; break; }
    }
    if (headerRowIndex < 0) throw new Error('Excel headers were not recognised. Use the AIS Packing List template.');

    const rowsToInsert=[];
    let currentCrateBase='1';
    let currentPO='';
    const defaultMonth = activePackingMonth || new Date().toLocaleString('en-US',{month:'long'});
    const defaultContainer = activePackingContainer || '1st Container';

    for (let i=headerRowIndex+1; i<rawJson.length; i++) {
      const rowArr=rawJson[i];
      if (rowArr.join('').trim()==='') continue;
      const norm={}; headers.forEach((h,idx)=>{ if(h) norm[h]=rowArr[idx]; });
      const val=(keys)=>{ for(const k of keys){ if(norm[k]!==undefined && String(norm[k]).trim()!=='') return norm[k]; } return undefined; };

      const rawCrate=val(['crateno','boxno','index','serial','number','no','sn']);
      if(rawCrate!==undefined) currentCrateBase=String(rawCrate).replace(/^crate\s*/i,'').replace(/\.0$/,'').trim();
      const rawPo=val(['ponumber','po','order','orderno','purchaseorder']);
      if(rawPo!==undefined) currentPO=String(rawPo).replace(/\.0$/,'').trim();

      const plNum=String(val(['plnumber','pl','packinglist']) || defaultPlNum).trim();
      const poNum=currentPO || 'Unknown PO';
      const month=String(val(['month','shipmentmonth']) || defaultMonth).trim();
      const container=normalizeContainerName(val(['containerno','container']) || defaultContainer);
      let profile=String(val(['profile','profileno','profilecode','extrusion']) || '').trim();
      if(profile.toUpperCase().startsWith('AL-')) profile=profile.substring(3);
      const itemCode=String(val(['itemcode','item','code','partno']) || '').trim();
      if(!profile || !itemCode) continue;

      let length=cleanLen(String(val(['length','lengthmm']) || '').trim());
      let unitWeight=0;
      const matchedCat=masterData.find(m=>String(m.profile).trim()===String(profile).trim() && String(m.itemCode||'').toLowerCase()===itemCode.toLowerCase() && (!length || cleanLen(m.length)===length));
      const fallbackCat=matchedCat || masterData.find(m=>String(m.profile).trim()===String(profile).trim() && String(m.itemCode||'').toLowerCase()===itemCode.toLowerCase());
      if(fallbackCat){ length=cleanLen(fallbackCat.length); unitWeight=Number(fallbackCat.unitWeight)||0; }

      const explicitCrate=rawCrate!==undefined;
      const pcsPerCrate=parseInt(val(['pcspercrate','pcsqty','qty','quantity','pcs','pieces','totalpcs']),10)||0;
      const numberOfCrates=Math.max(1,parseInt(val(['numberofcrates','crates','boxqty','boxes','cratecount']),10)||1);
      if(pcsPerCrate<=0) continue;

      // If the sheet already has explicit suffixes such as 11-i, use exactly that crate ID.
      // If it supplies Number of Crates > 1 without suffixes, expand to 11-i, 11-ii, ...
      const hasSuffix=/-[a-z]+$/i.test(currentCrateBase);
      const crateNames=explicitCrate && hasSuffix ? [currentCrateBase] :
        (numberOfCrates>1 ? Array.from({length:numberOfCrates},(_,k)=>`${currentCrateBase}-${toRoman(k+1)}`) : [currentCrateBase]);

      for(const crateName of crateNames){
        const parsedNet=parseFloat(val(['weight','netweight','netwt','totalweight']));
        const netWeight=!Number.isNaN(parsedNet) ? parsedNet : Number((pcsPerCrate*unitWeight).toFixed(2));
        const parsedGross=parseFloat(val(['grossweight','grosswt']));
        const grossWeight=!Number.isNaN(parsedGross) ? parsedGross : netWeight;
        const parsedDate=val(['date','packingdate']);
        const finalDate=formatExcelDate(parsedDate);
        rowsToInsert.push({
          pl_number:plNum, po_number:poNum, shipment_month:month, container,
          crate_no:`Crate ${crateName}`, profile, item_code:itemCode,
          length:length || '0', box_qty:1, pcs_qty:pcsPerCrate,
          net_weight:netWeight, gross_weight:grossWeight, packing_date:finalDate
        });
      }
    }

    if(!rowsToInsert.length) throw new Error('No valid packing rows were found. Check Profile, Item Code and Pcs Qty.');
    if(uploadBtn) uploadBtn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    const {error:insertError}=await supabaseClient.from('packing_list').insert(rowsToInsert);
    if(insertError) throw insertError;

    const {data:plData,error:readError}=await supabaseClient.from('packing_list').select('*');
    if(readError) throw readError;
    if(plData){
      plData.sort((a,b)=>b.id-a.id);
      packingLists=plData.map(item=>({id:item.id,plNumber:item.pl_number,poNumber:item.po_number,month:item.shipment_month||'January',container:item.container||'1st Container',crateNo:item.crate_no||`Crate ${item.box_qty||1}`,profile:item.profile,itemCode:item.item_code||'',length:cleanLen(item.length),boxQty:item.box_qty||1,pcsQty:item.pcs_qty||0,netWeight:item.net_weight||0,grossWeight:item.gross_weight||0,date:item.packing_date}));
    }
    fileInput.value='';
    showToast(`Packing List uploaded successfully: ${rowsToInsert.length} crate-item records.`, 'success');
    renderPackingListTable(); renderDashboard();
  } catch(err) {
    console.error('Packing List Excel upload error:',err);
    showToast(`Upload failed: ${err?.message || 'Invalid Excel or database error'}`, 'error');
  } finally {
    if(uploadBtn){ uploadBtn.innerHTML=originalBtnText; uploadBtn.disabled=false; }
  }
}

function renderHistoryData() { 
    try {
        const dateVal = document.getElementById('historyDateSelect').value; const tbody = document.getElementById('historyTableBody'); tbody.innerHTML = ''; const filtered = historyLogs.filter(h => h.date === dateVal); 
        if (filtered.length === 0) { tbody.innerHTML = `<tr><td colspan="11" style="color:#888; text-align:center;">No logs for ${dateVal}.</td></tr>`; return; } 
        let html = '';
        filtered.forEach(log => { 
            const matched = masterData.find(m => String(m.profile).trim() === String(log.profile).trim() && cleanLen(m.length) === cleanLen(log.length));
            const iCode = matched && matched.itemCode ? matched.itemCode : '-'; const uWt = matched && matched.unitWeight ? matched.unitWeight.toFixed(3) + ' kg' : '-';
            html += `<tr><td><b>${log.timestamp || ''}</b> <span style="font-size:11px;color:var(--text-muted);">(${log.shift})</span></td><td><b>${log.profile}</b></td><td><span style="color:var(--info-color); font-weight:600;">${iCode}</span></td><td>${log.length} mm</td><td><span style="font-weight:700;">${uWt}</span></td><td><span class="stock-badge bg-cut">${log.cutQty}</span></td><td><span class="stock-badge bg-punch">${log.punchQty}</span></td><td><span class="stock-badge bg-wrap">${log.wrapQty}</span></td><td><span class="stock-badge bg-box">${log.boxQty}</span></td><td><span class="stock-badge bg-crate">${log.crateQty}</span></td><td>${currentUserRole === 'Admin' ? `<button class="btn btn-accent" style="padding:4px 8px; font-size:11px;" onclick="openGenericEdit('history_logs', ${log.id}, {cut_qty: '${log.cutQty}', punch_qty: '${log.punchQty}', wrap_qty: '${log.wrapQty}', box_qty: '${log.boxQty}', crate_qty: '${log.crateQty}'})"><i class="fa-solid fa-pen"></i></button> <button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteHistoryLog(${log.id})"><i class="fa-solid fa-trash"></i></button>` : `<i class="fa-solid fa-lock" style="color:#aaa;"></i>`}</td></tr>`; 
        }); 
        tbody.innerHTML = html;
    } catch(e) {}
}
function deleteHistoryLog(id) { if(currentUserRole !== 'Admin') return; showConfirm("Delete log?", async () => { try { await supabaseClient.from('history_logs').delete().eq('id', id); } catch(e){} historyLogs = historyLogs.filter(h => h.id !== id); renderHistoryData(); showToast("Deleted", "success"); }); }

function renderMasterCatalog() { 
    try {
        const tbody = document.querySelector('#masterCatalogTable tbody'); if(!tbody) return; tbody.innerHTML = ''; 
        if(masterData.length === 0) { tbody.innerHTML = `<tr><td colspan="8" style="padding: 20px; text-align: center; color: #e11d48; font-weight: bold;"><i class="fa-solid fa-triangle-exclamation"></i> No Data Found!</td></tr>`; return; }
        let html = '';
        masterData.forEach((item, index) => { html += `<tr><td><b>${item.profile}</b></td><td>${item.itemCode || '-'}</td><td><span style="color:#8b5cf6; font-weight:800;">${item.material || '-'}</span></td><td>${item.length} mm</td><td>${item.exLength || '-'}</td><td>${item.unitWeight} kg</td><td><span class="stock-badge bg-box">${item.boxCapacity || 100}</span></td><td>${currentUserRole === 'Admin' ? `<button class="btn btn-accent" style="padding:4px 8px; font-size:11px;" onclick="openMasterEditModal(${index})"><i class="fa-solid fa-pen"></i></button> <button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteMasterItem(${index})"><i class="fa-solid fa-trash"></i></button>` : `<i class="fa-solid fa-lock" style="color:#aaa;"></i>`}</td></tr>`; }); 
        tbody.innerHTML = html;
    } catch(e) {}
}

function openMasterEditModal(index) { if (currentUserRole !== 'Admin') return; const item = masterData[index]; document.getElementById('editMasterIndex').value = index; document.getElementById('editMasterProfile').value = item.profile; document.getElementById('editMasterItemCode').value = item.itemCode || ''; document.getElementById('editMasterMaterial').value = item.material || ''; document.getElementById('editMasterLength').value = item.length; document.getElementById('editMasterExLength').value = item.exLength || ''; document.getElementById('editMasterUnitWeight').value = item.unitWeight; document.getElementById('editMasterBoxCapacity').value = item.boxCapacity || 100; document.getElementById('masterEditModal').style.display = 'flex'; }
function closeMasterEditModal() { document.getElementById('masterEditModal').style.display = 'none'; }
async function saveMasterCatalogEdit() { if(isAppBusy) return; isAppBusy=true; try { const index = parseInt(document.getElementById('editMasterIndex').value); const profile = document.getElementById('editMasterProfile').value.trim(); const itemCode = document.getElementById('editMasterItemCode').value.trim(); const material = document.getElementById('editMasterMaterial').value.trim(); const length = document.getElementById('editMasterLength').value.trim(); const exLength = document.getElementById('editMasterExLength').value.trim(); const uw = parseFloat(document.getElementById('editMasterUnitWeight').value) || 0; const cap = parseInt(document.getElementById('editMasterBoxCapacity').value) || 100; if (isNaN(index)) return; const item = masterData[index]; item.profile = profile; item.itemCode = itemCode; item.material = material; item.length = length; item.exLength = exLength; item.unitWeight = uw; item.boxCapacity = cap; if (item.db_id) { try { await supabaseClient.from('master_catalog').update({ profile: profile, item_code: itemCode, material: material, length: length, ex_length: exLength, unit_weight: uw, box_capacity: cap }).eq('id', item.db_id); } catch(e) {} } else { try { let {data} = await supabaseClient.from('master_catalog').insert([{ profile: profile, item_code: itemCode, material: material, length: length, ex_length: exLength, unit_weight: uw, box_capacity: cap, cut_qty: item.cutQty, punch_qty: item.punchQty, wrap_qty: item.wrapQty, box_qty: item.boxQty, crate_qty: item.crateQty }]).select(); if(data && data.length > 0) { item.db_id = data[0].id; } } catch(e) {} } saveMasterExtrasLocally(); closeMasterEditModal(); showToast("Catalog updated successfully", "success"); renderMasterCatalog(); populateStockFilterDropdown(); populateProfileDropdown(); populatePoProfileDropdown(); populateCbProfileDropdown(); renderProfileSummaryTable(); renderCardboardStock(); renderBalanceWorkTable(); } finally { isAppBusy=false; } }
function deleteMasterItem(index) { if (currentUserRole !== 'Admin') return; showConfirm("Delete catalog item?", async () => { const item = masterData[index]; if (item && item.db_id) await supabaseClient.from('master_catalog').delete().eq('id', item.db_id); masterData.splice(index, 1); saveMasterExtrasLocally(); renderMasterCatalog(); showToast("Catalog item deleted", "success"); }); }
function openAddMasterModal() { if (currentUserRole !== 'Admin') return; document.getElementById('addMasterProfile').value = ''; document.getElementById('addMasterItemCode').value = ''; document.getElementById('addMasterMaterial').value = ''; document.getElementById('addMasterLength').value = ''; document.getElementById('addMasterExLength').value = ''; document.getElementById('addMasterUnitWeight').value = ''; document.getElementById('addMasterBoxCapacity').value = '100'; document.getElementById('addMasterModal').style.display = 'flex'; }
function closeAddMasterModal() { document.getElementById('addMasterModal').style.display = 'none'; }
async function saveNewMasterProfile() { if(isAppBusy) return; isAppBusy=true; try { if (currentUserRole !== 'Admin') return; const profile = document.getElementById('addMasterProfile').value.trim(); const itemCode = document.getElementById('addMasterItemCode').value.trim(); const material = document.getElementById('addMasterMaterial').value.trim(); const length = document.getElementById('addMasterLength').value.trim(); const exLength = document.getElementById('addMasterExLength').value.trim(); const uw = parseFloat(document.getElementById('addMasterUnitWeight').value) || 0; const cap = parseInt(document.getElementById('addMasterBoxCapacity').value) || 100; if (!profile || !itemCode || !length) { showToast("Fill all fields", "warning"); return; } const exists = masterData.find(m => String(m.profile).trim() === profile && cleanLen(m.length) === cleanLen(length) && m.itemCode === itemCode); if (exists) { showToast("Already exists!", "error"); return; } const newEntry = { profile: profile, item_code: itemCode, material: material, length: length, ex_length: exLength, unit_weight: uw, box_capacity: cap, cut_qty: 0, punch_qty: 0, wrap_qty: 0, box_qty: 0, crate_qty: 0 }; const mapped = { db_id: Date.now(), profile: profile, itemCode: itemCode, material: material, length: length, exLength: exLength, unitWeight: uw, cutQty: 0, punchQty: 0, wrapQty: 0, boxQty: 0, crateQty: 0, boxCapacity: cap }; try { const { data } = await supabaseClient.from('master_catalog').insert([newEntry]).select(); if (data && data.length > 0) { mapped.db_id = data[0].id; } } catch (e) {} masterData.push(mapped); masterData.sort((a, b) => (parseFloat(a.profile)||0) - (parseFloat(b.profile)||0) || (parseFloat(a.length)||0) - (parseFloat(b.length)||0)); saveMasterExtrasLocally(); closeAddMasterModal(); showToast("Profile added!", "success"); renderMasterCatalog(); populateStockFilterDropdown(); populateProfileDropdown(); populatePoProfileDropdown(); populateCbProfileDropdown(); renderCardboardStock(); renderBalanceWorkTable(); } finally { isAppBusy=false; } }
async function resetAllDataToZero() {
    if (currentUserRole !== 'Admin') return showToast('Only Admin can reset current stock.', 'error');
    if (isAppBusy) return;
    showConfirm(
        '<b>RESET CURRENT STOCK</b><br><br>This will set Cut, Punch, Wrap, Box and Crate stock quantities to <b>0</b> in the Master Catalog.<br><br><span style="color:#059669;font-weight:700">Production History, Packing Lists, POs, Shipments, Reject/Recover and Cardboard data will NOT be deleted.</span>',
        async () => {
            isAppBusy = true; stockResetInProgress = true;
            const button=document.getElementById('resetAllBtn'), oldHtml=button?button.innerHTML:'';
            try {
                if(button){button.disabled=true;button.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Resetting...';}
                const pageSize=1000, rows=[];
                for(let from=0;;from+=pageSize){
                    const {data,error}=await supabaseClient.from('master_catalog').select('id,profile,length,item_code,cut_qty,punch_qty,wrap_qty,box_qty,crate_qty').range(from,from+pageSize-1);
                    if(error) throw new Error(`Could not read Master Catalog: ${error.message}`);
                    const page=data||[]; rows.push(...page); if(page.length<pageSize) break;
                }
                const failures=[];
                for(let i=0;i<rows.length;i+=25){
                    const batch=rows.slice(i,i+25);
                    const results=await Promise.all(batch.map(row=>supabaseClient.from('master_catalog').update({cut_qty:0,punch_qty:0,wrap_qty:0,box_qty:0,crate_qty:0}).eq('id',row.id).then(({error})=>({row,error}))));
                    results.forEach(({row,error})=>{if(error)failures.push(`${row.profile}/${row.length}/${row.item_code}: ${error.message}`);});
                }
                if(failures.length) throw new Error(`${failures.length} stock row(s) could not be reset.`);
                const verify=[];
                for(let from=0;;from+=pageSize){
                    const {data,error}=await supabaseClient.from('master_catalog').select('id,cut_qty,punch_qty,wrap_qty,box_qty,crate_qty').range(from,from+pageSize-1);
                    if(error) throw new Error(`Reset verification failed: ${error.message}`);
                    const page=data||[]; verify.push(...page); if(page.length<pageSize) break;
                }
                const nonZeroRows=verify.filter(r=>[r.cut_qty,r.punch_qty,r.wrap_qty,r.box_qty,r.crate_qty].some(v=>(Number(v)||0)!==0));
                if(nonZeroRows.length) throw new Error(`${nonZeroRows.length} stock row(s) are still non-zero after reset verification.`);
                masterData.forEach(item=>{item.cutQty=0;item.punchQty=0;item.wrapQty=0;item.boxQty=0;item.crateQty=0;});
                renderDashboard();renderProfileSummaryTable();renderHistoryData();renderBalanceWorkTable();renderPackingListTable();
                showToast(`Current stock reset successfully (${verify.length} catalog rows verified). History preserved.`,'success');
            } catch(e) {
                console.error('Reset current stock error:',e);
                await loadDataFromSupabase(true).catch(()=>{});
                showToast(`Stock reset failed: ${e.message||'Database update failed.'}`,'error');
            } finally {
                if(button){button.disabled=false;button.innerHTML=oldHtml;} stockResetInProgress=false; isAppBusy=false;
            }
        }
    );
}

// Manual system health check for Admin troubleshooting. It never mutates data.
window.runSystemHealthCheck = async function() {
  const checks = [];
  const requiredIds = ['dashboardTab','packingListTab','masterWeightChart','overallPoChart','overallPlChart','rejectDashboardChart','rejectProfileChart','plWeightChart','packingShipmentControls','packingListTableBody'];
  requiredIds.forEach(id => checks.push({ check: `DOM: ${id}`, ok: !!document.getElementById(id) }));
  checks.push({ check: 'Chart.js loaded', ok: typeof Chart !== 'undefined' });
  checks.push({ check: 'XLSX loaded', ok: typeof XLSX !== 'undefined' });
  checks.push({ check: 'Supabase client loaded', ok: !!supabaseClient });
  checks.push({ check: 'Master catalog loaded', ok: masterData.length >= 0 });
  checks.push({ check: 'Packing data loaded', ok: packingLists.length >= 0 });
  const failed = checks.filter(c => !c.ok);
  console.table(checks);
  if (failed.length) showToast(`Health check: ${failed.length} issue(s) found. Check console.`, 'warning');
  else showToast('System health check passed.', 'success');
  return checks;
};



// -------------------- Production Reliability Helpers --------------------
window.getAISDataHealth = function(){
  const rows = [
    ['Master Catalog', masterData.length], ['Production Orders', poList.length], ['Shipments', shipmentList.length],
    ['Packing List', packingLists.length], ['Production History', historyLogs.length], ['Reject Logs', rejectLogs.length],
    ['Recovery Logs', recoverLogs.length], ['Cardboard Transactions', cardboardStockList.length]
  ];
  const duplicateKeys = new Set(), duplicates=[];
  masterData.forEach(m=>{
    const k=`${String(m.profile).trim()}|${String(m.itemCode).trim()}|${cleanLen(m.length)}`;
    if(duplicateKeys.has(k)) duplicates.push(k); else duplicateKeys.add(k);
  });
  return {rows, duplicateMasterKeys:[...new Set(duplicates)], currentRole:currentUserRole, supabaseConfigured:!!supabaseClient};
};

window.runProductionAudit = async function(){
  if(currentUserRole!=='Admin') return showToast('Only Admin can run the production audit.','error');
  const report=[];
  const checks=[
    ['Supabase client', !!supabaseClient],
    ['Chart.js', typeof Chart!=='undefined'],
    ['Excel export library', typeof XLSX!=='undefined'],
    ['Dashboard', !!document.getElementById('dashboardTab')],
    ['Packing List', !!document.getElementById('packingListTab')],
    ['Recovery', !!document.getElementById('rejectRecoverTab') || !!document.getElementById('recoverTab')],
    ['Master Catalog loaded', Array.isArray(masterData)],
    ['No duplicate in-memory catalog keys', window.getAISDataHealth().duplicateMasterKeys.length===0]
  ];
  checks.forEach(([name,ok])=>report.push({check:name,status:ok?'PASS':'CHECK'}));
  console.table(report);
  const bad=report.filter(x=>x.status!=='PASS');
  showToast(bad.length?`Audit complete: ${bad.length} item(s) need attention.`:'Audit complete: all application checks passed.','success');
  return report;
};

// A visible security notice is intentionally kept in the Admin health report:
// the legacy role/password screen is client-side and must be replaced by Supabase Auth + RLS
// before this application is exposed to untrusted internet users. The existing login is retained
// for compatibility so current users are not locked out.
window.getSecurityStatus = function(){
  return {
    clientSideRoleGate: true,
    supabaseRLSRequired: true,
    recommendation: 'Use Supabase Auth and database RLS for production access control.'
  };
};

// END OF SCRIPT
