const SUPABASE_URL = "https://rtlizqawcwzduxpnzznd.supabase.co";
const SUPABASE_KEY = "sb_publishable_Eyo0gj7_BjN6FoQ76oJQYw_ZBOGj9BW";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);



let currentUserRole = null; let isAdminUnlocked = false; let isDarkMode = false; let isAppBusy = false;
let masterChartInstance = null, overallPoChartInstance = null, overallPlChartInstance = null, plChartInstance = null, monthlyShiftChartInstance = null, monthlyTeamContributionChartInstance = null, poChartInstances = [], rejectDashChart = null, rejectProfileChartInstance = null;
let cardboardStockList = [], cardboardManualData = [], dailyInstructionsList = [], masterData = [], historyLogs = [], poList = [], shipmentList = [], packingLists = [], rejectLogs = [], recoverLogs = [], recoveryCutLogs = [], recoveryWrapLogs = []; 
let globalManualCrates = {};
let stockResetInProgress = false;
let shipmentStates = {};
let activePackingMonth = null;
let activePackingContainer = null;
let shipmentDeadline = null;

const cleanLen = (val) => String(val || '').replace(/ mm/gi, '').trim();


// Keep the user's last-used non-quantity selections for the current browser session.
// This prevents the form from jumping back to the first option after each save/reload.
const AIS_FORM_STATE_KEY = 'ais_tracker_form_state_v2';
function getAISFormState(){ try { return JSON.parse(sessionStorage.getItem(AIS_FORM_STATE_KEY) || '{}') || {}; } catch(e){ return {}; } }
function setAISFormState(key, value){ try { const st=getAISFormState(); st[key]=value; sessionStorage.setItem(AIS_FORM_STATE_KEY, JSON.stringify(st)); } catch(e){} }
function clearAISFormState(){ try { sessionStorage.removeItem(AIS_FORM_STATE_KEY); } catch(e){} }
function rememberFormField(id){ const el=document.getElementById(id); if(!el || el.dataset.aisRememberBound==='1') return; el.dataset.aisRememberBound='1'; const save=()=>setAISFormState(id, el.value); el.addEventListener('change',save); el.addEventListener('input',save); }
function rememberAISFormFields(){
  ['entryDate','shift','selectProfile','selectItemCode','selectLength','shipmentDate','shipmentMonth','shipmentContainer','shipSelectPo','shipSelectProfile','shipSelectItemCode','shipSelectLength','cbDate','cbManualDate','rejDate','rejShift','rejTeam','rejLoc'].forEach(rememberFormField);
}
function restoreAISShipmentSelections(){
  const st=getAISFormState();
  const setVal=(id,val)=>{ const el=document.getElementById(id); if(el && val!=null && [...el.options].some(o=>String(o.value)===String(val))) el.value=val; };
  setVal('shipmentDate',st.shipmentDate); setVal('shipmentMonth',st.shipmentMonth); setVal('shipmentContainer',st.shipmentContainer);
  const po=st.shipSelectPo;
  if(po && document.getElementById('shipSelectPo') && [...document.getElementById('shipSelectPo').options].some(o=>String(o.value)===String(po))){
    document.getElementById('shipSelectPo').value=po; onShipmentPoSelect();
    setTimeout(()=>{ const prof=st.shipSelectProfile; if(prof && [...document.getElementById('shipSelectProfile').options].some(o=>String(o.value)===String(prof))){ document.getElementById('shipSelectProfile').value=prof; onShipmentProfileSelect(); }
      setTimeout(()=>{ const ic=st.shipSelectItemCode; if(ic && [...document.getElementById('shipSelectItemCode').options].some(o=>String(o.value)===String(ic))){ document.getElementById('shipSelectItemCode').value=ic; onShipmentItemCodeSelect(); }
        setTimeout(()=>{ const len=st.shipSelectLength; if(len && [...document.getElementById('shipSelectLength').options].some(o=>String(o.value)===String(len))){ document.getElementById('shipSelectLength').value=len; onShipmentLengthSelect(); } },0);
      },0);
    },0);
  }
}
function restoreAISProductionSelections(){
  const st=getAISFormState();
  const setVal=(id,val)=>{ const el=document.getElementById(id); if(el && val!=null && [...el.options].some(o=>String(o.value)===String(val))) el.value=val; };
  setVal('entryDate',st.entryDate); setVal('shift',st.shift);
  const prof=st.selectProfile;
  if(prof && document.getElementById('selectProfile') && [...document.getElementById('selectProfile').options].some(o=>String(o.value)===String(prof))){ document.getElementById('selectProfile').value=prof; onProfileSelect();
    setTimeout(()=>{ const ic=st.selectItemCode; if(ic && [...document.getElementById('selectItemCode').options].some(o=>String(o.value)===String(ic))){ document.getElementById('selectItemCode').value=ic; onItemCodeSelect(); }
      setTimeout(()=>{ const len=st.selectLength; if(len && [...document.getElementById('selectLength').options].some(o=>String(o.value)===String(len))){ document.getElementById('selectLength').value=len; onLengthSelect(); } },0);
    },0);
  }
}
function restoreAISFormSelections(){ rememberAISFormFields(); restoreAISProductionSelections(); restoreAISShipmentSelections(); }

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
  setTimeout(()=>{ try{ loadDataFromSupabase(true); }catch(e){ console.error(e); setDbStatus(false,e?.message||'Startup sync failed.'); showToast('Application started, but data sync needs attention.','warning'); } },100);
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
document.addEventListener('DOMContentLoaded', () => { ensureLoginInputReady(); rememberAISFormFields(); });
function verifyLogin() {
  const section=document.getElementById('loginPassSection'); const role=section?.dataset.role||''; const pass=(document.getElementById('rolePassInput')?.value||'').trim();
  if(role==='Admin' && pass==='Lr@108227') { enterAISApplication('Admin'); showToast('Admin access granted.','success'); return; }
  if(role==='Planner' && pass==='alumex123') { enterAISApplication('Planner'); showToast('Planner access granted.','success'); return; }
  showToast('Invalid authentication key.','error');
  const box=document.querySelector('.ais-password-box'); if(box){ box.classList.remove('ais-shake'); void box.offsetWidth; box.classList.add('ais-shake'); }
}

function logoutUser() { clearAISFormState(); currentUserRole = null; isAdminUnlocked = false; document.getElementById('mainContent').style.display = 'none'; document.getElementById('roleLoginOverlay').style.display = 'flex'; resetRoleSelection(); switchTab('dashboardTab', document.querySelector('.tab-btn')); showToast("Logged out successfully.", "success"); }

function updateRoleUI() {
  const roleBadge = document.getElementById('userRoleBadge'); if (roleBadge) { roleBadge.textContent = currentUserRole + " Mode"; roleBadge.style.background = currentUserRole === 'Admin' ? '#e11d48' : (currentUserRole === 'Planner' ? '#0369a1' : '#059669'); }
  const elements = { adminEntryTab: document.getElementById('tabBtn-adminEntry'), poTab: document.getElementById('tabBtn-po'), shipmentTab: document.getElementById('tabBtn-shipment'), historyTab: document.getElementById('tabBtn-history'), planInputArea: document.getElementById('planInputArea'), cbAdminArea: document.getElementById('cbAdminArea'), cbManualDataArea: document.getElementById('cbManualDataArea'), plAdminArea1: document.getElementById('plAdminArea1'), plAdminArea2: document.getElementById('plAdminArea2'), resetBtn: document.getElementById('resetAllBtn'), resetNextPlBtn: document.getElementById('resetNextPlBtn'), addProfileBtn: document.getElementById('addProfileBtn'), rejectTabBtn: document.getElementById('tabBtn-rejectTracker'), plDeadlineSetter: document.getElementById('plDeadlineSetterContainer'), systemAuditBtn: document.getElementById('systemAuditBtn') };
  if (currentUserRole === 'Admin') { Object.values(elements).forEach(el => { if(el) el.style.display = ''; }); if (document.getElementById('cbTxType')) document.getElementById('cbTxType').disabled = false; } 
  else if (currentUserRole === 'Planner') { [elements.adminEntryTab, elements.poTab, elements.shipmentTab, elements.historyTab, elements.planInputArea, elements.cbAdminArea, elements.cbManualDataArea, elements.rejectTabBtn].forEach(el => { if(el) el.style.display = ''; }); [elements.plAdminArea1, elements.plAdminArea2, elements.resetBtn, elements.resetNextPlBtn, elements.addProfileBtn, elements.plDeadlineSetter, elements.systemAuditBtn].forEach(el => { if(el) el.style.display = 'none'; }); if (document.getElementById('cbTxType')) { document.getElementById('cbTxType').value = 'IN'; document.getElementById('cbTxType').disabled = true; } } 
  else if (currentUserRole === 'Local') { Object.values(elements).forEach(el => { if(el) el.style.display = 'none'; }); }
  
  setTimeout(() => {
      renderProfileSummaryTable(); renderPoDetailsTable(); renderMasterCatalog(); renderShipmentHistoryTable(); renderPackingListTable(); renderCardboardStock(); renderDailyInstructions(); renderHistoryData(); renderRejectTable(); renderRecoverTable();
  }, 50);
}

function saveMasterExtrasLocally() { const extras = masterData.map(m => ({ p: m.profile, l: m.length, i: m.itemCode, ex: m.exLength, cap: m.boxCapacity, mat: m.material })); localStorage.setItem('alumex_master_extras', JSON.stringify(extras)); }
function saveCardboardLocally() { try { localStorage.setItem('alumex_cardboard_local', JSON.stringify(cardboardStockList || [])); } catch(e) { console.warn('Cardboard local save skipped:', e); } }
function saveCardboardManualLocally() { try { localStorage.setItem('alumex_cardboard_manual_local', JSON.stringify(cardboardManualData || [])); } catch(e) { console.warn('Cardboard manual local save skipped:', e); } }
function getAvailableCardboard(profile, itemCode, length) { let cIn = 0, cOut = 0; const dummyItem = { profile, itemCode, length }; cardboardStockList.forEach(c => { if (normalizeCardboardMatch(c.type, dummyItem)) { cIn += (c.incoming || 0); cOut += (c.used || 0); } }); return cIn - cOut; }
function formatExcelDate(val) { if (!val) return new Date().toISOString().split('T')[0]; if (typeof val === 'number') { const date = new Date(Math.round((val - 25569) * 86400 * 1000)); return date.toISOString().split('T')[0]; } const d = new Date(val); if (!isNaN(d.getTime())) { const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0'); return `${y}-${m}-${day}`; } return new Date().toISOString().split('T')[0]; }
function formatBalanceInt(val) {
    const n = Number(val);
    return Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : '0';
}
function formatBalanceLength(val) {
    const n = Number.parseFloat(val);
    if (!Number.isFinite(n)) return String(val ?? '-');
    return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

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
    if(!dataArray || dataArray.length === 0) {
        showToast("No data to export!", "warning");
        return;
    }

    // Preferred: real XLSX when SheetJS is available.
    if (typeof XLSX !== 'undefined' && XLSX.utils && XLSX.writeFile) {
        try {
            const ws = XLSX.utils.json_to_sheet(dataArray);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Sheet1');
            XLSX.writeFile(wb, `${filename}.xlsx`);
            showToast("Excel downloaded successfully.", "success");
            return;
        } catch (e) {
            console.warn("XLSX export failed; using Excel-compatible fallback.", e);
        }
    }

    // Offline fallback: Excel-compatible HTML .xls.
    const columns = Object.keys(dataArray[0] || {});
    const esc = (v) => String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const headerHtml = columns.map(c => `<th>${esc(c)}</th>`).join('');
    const bodyHtml = dataArray.map(row =>
        `<tr>${columns.map(c => `<td>${esc(row[c])}</td>`).join('')}</tr>`
    ).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>body{font-family:Arial,sans-serif;font-size:10pt}
    table{border-collapse:collapse}th,td{border:1px solid #999;padding:5px 8px;white-space:nowrap}
    th{font-weight:bold;background:#d9eaf7}</style></head><body>
    <table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>
    </body></html>`;

    const blob = new Blob([html], {type:'application/vnd.ms-excel;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.xls`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Excel downloaded successfully.", "success");
}
/* --- PDF EXPORT FUNCTIONS (AIS Tracker v2.0) --- */
function exportDataToPdf(dataArray, filename, title, subtitle='') {
    if(!dataArray || dataArray.length === 0) { showToast('No data to export!', 'warning'); return; }
    if(!window.jspdf || !window.jspdf.jsPDF) { showToast('PDF library not loaded. Please check internet connection.', 'error'); return; }
    if(typeof window.jspdf.jsPDF !== 'function') { showToast('PDF engine unavailable.', 'error'); return; }
    const doc = new window.jspdf.jsPDF({orientation:'landscape', unit:'mm', format:'a4'});
    doc.setFont('helvetica','bold'); doc.setFontSize(15); doc.text(String(title||'AIS Tracker Report'), 14, 14);
    doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
    const generated = new Date().toLocaleString('en-GB');
    doc.text(`${subtitle ? subtitle+' • ' : ''}Generated: ${generated}`, 14, 20);
    const columns = Object.keys(dataArray[0]);
    const body = dataArray.map(row => columns.map(k => row[k] === null || row[k] === undefined ? '' : String(row[k])));
    if(typeof doc.autoTable !== 'function') { showToast('PDF table plugin not loaded. Please check internet connection.', 'error'); return; }
    doc.autoTable({
        head:[columns], body, startY:25, theme:'grid',
        styles:{font:'helvetica',fontSize:7,cellPadding:2,overflow:'linebreak'},
        headStyles:{fillColor:[6,78,59],textColor:255,fontStyle:'bold'},
        alternateRowStyles:{fillColor:[240,253,244]},
        margin:{left:10,right:10},
        didDrawPage:function(data){
            const page=doc.internal.getNumberOfPages();
            doc.setFontSize(7); doc.setTextColor(100);
            doc.text(`AIS Tracker • Page ${page}`, doc.internal.pageSize.getWidth()-45, doc.internal.pageSize.getHeight()-7);
        }
    });
    doc.save(`${filename}.pdf`);
}

window.exportDashboardPdf=function(){
    const data=masterData.map(item=>({'Profile':item.profile,'Item Code':item.itemCode,'Length (mm)':item.length,'Unit Wt':item.unitWeight,'Cut Qty':item.cutQty,'Punch Qty':item.punchQty,'Wrap Qty':item.wrapQty,'Box Qty':item.boxQty,'Crate Qty':item.crateQty,'Total Stock (Pcs)':(item.cutQty||0)+(item.punchQty||0)+(item.wrapQty||0)+(item.boxQty||0)+(item.crateQty||0)}));
    exportDataToPdf(data,'AIS_Dashboard_Stock','AIS Tracker - Dashboard Stock','Alumex PLC • AIS');
};
window.exportStockPdf=window.exportDashboardPdf;
window.exportPoPdf=function(){
    const data=poList.map(po=>{
        const requiredQty = Math.max(0, Number(po.orderQty)||0);
        const shippedQty = shipmentList
          .filter(s => String(s.poNumber||'').trim()===String(po.poNumber||'').trim()
            && String(s.profile||'').trim()===String(po.profile||'').trim()
            && cleanLen(s.length)===cleanLen(po.length))
          .reduce((sum,s)=>sum+(Number(s.shippedQty)||0),0);
        const remainingQty = Math.max(0, requiredQty-shippedQty);
        return {
          'PO Date':po.date,
          'PO Number':po.poNumber,
          'Profile':po.profile,
          'Item Code':(typeof resolveMasterItemCode==='function'?resolveMasterItemCode(po.profile,po.length,po.itemCode):po.itemCode)||'-',
          'Length (mm)':po.length,
          'Unit Wt':(()=>{const m=masterData.find(x=>String(x.profile||'').trim()===String(po.profile||'').trim() && cleanLen(x.length)===cleanLen(po.length)); return m?Number(m.unitWeight||0).toFixed(4):'-';})(),
          'Required Qty':requiredQty,
          'Shipped Qty':shippedQty,
          'Remaining Qty':remainingQty,
          'Status':remainingQty>0?'Pending':'Complete'
        };
    });
    exportDataToPdf(data,'AIS_Production_Orders','AIS Tracker - Production Orders','Complete Production Order Balance');
};
window.exportCardboardPdf=function(){
    const data=cardboardStockList.map(c=>({'Date':c.date,'Transaction Type':c.type,'Incoming':c.incoming,'Consumed':c.used}));
    exportDataToPdf(data,'AIS_Cardboard_History','AIS Tracker - Cardboard History','Cardboard Stock');
};
window.exportShipmentsPdf=function(){
    const data=shipmentList.map(s=>({'Shipment Date':s.date,'PO Number':s.poNumber,'Profile':s.profile,'Item Code':getShipmentMasterItemCode(s)||'-','Length (mm)':s.length,'Container No':s.container,'Shipped Qty':s.shippedQty,'Remaining':s.remainingBalance}));
    exportDataToPdf(data,'AIS_Shipment_History','AIS Tracker - Shipment History','Shipment History');
};
window.exportHistoryPdf=function(){
    const data=historyLogs.map(h=>({'Date':h.date,'Time':h.timestamp,'Shift':h.shift,'Team':h.team||'Unassigned','Profile':h.profile,'Length (mm)':h.length,'Cut Qty':h.cutQty,'Punch Qty':h.punchQty,'Wrap Qty':h.wrapQty,'Box Qty':h.boxQty,'Crate Qty':h.crateQty}));
    exportDataToPdf(data,'AIS_Production_History','AIS Tracker - Production History','History Logs');
};
window.exportRejectPdf=function(){
    const data=rejectLogs.map(r=>({'Date':r.reject_date,'Shift':r.shift,'Location':r.location,'Stage':r.stage,'Profile':r.profile,'Item Code':r.item_code,'Length (mm)':r.length,'Reject Qty':r.pcs,'Weight (kg)':r.weight}));
    exportDataToPdf(data,'AIS_Reject_History','AIS Tracker - Reject History','Reject Logs');
};
window.exportRecoverPdf=function(){
    const cutData=recoveryCutLogs.map(r=>({'Date':r.cut_date,'Source Profile':r.source_profile,'Source Item Code':r.source_item_code,'Original Length':r.original_length,'New Profile':r.new_profile,'New Item Code':r.new_item_code,'New Length':r.new_length,'Cut Qty':r.cut_pcs,'Cut Weight (kg)':r.cut_weight}));
    const wrapData=recoveryWrapLogs.map(r=>({'Date':r.wrap_date,'Profile':r.profile,'Item Code':r.item_code,'Length':r.length,'Available Recover Cut Pcs':r.available_cut_pcs,'Wrapping Pcs':r.wrap_pcs,'Recovery Weight (kg)':r.wrap_weight}));
    if(cutData.length) exportDataToPdf(cutData,'AIS_Recovery_Cut_History','AIS Tracker - Recovery Cut History','Reject → Cut / Conversion');
    if(wrapData.length) exportDataToPdf(wrapData,'AIS_Recovery_Wrapping_History','AIS Tracker - Recovery Wrapping History','Recovered Cut → Wrapping');
    if(!cutData.length && !wrapData.length) showToast('No recovery records to export!','warning');
};

window.exportDashboardExcel = function() { const data = masterData.map(item => ({ "Profile": item.profile, "Item Code": item.itemCode, "Length (mm)": item.length, "Unit Wt": item.unitWeight, "Cut Qty": item.cutQty, "Punch Qty": item.punchQty, "Wrap Qty": item.wrapQty, "Box Qty": item.boxQty, "Crate Qty": item.crateQty, "Total Stock (Pcs)": (item.cutQty||0) + (item.punchQty||0) + (item.wrapQty||0) + (item.boxQty||0) + (item.crateQty||0) })); exportTableToExcel(data, "AIS_Dashboard_Stock", "Stock Summary"); };
window.exportStockExcel = window.exportDashboardExcel;
window.exportPoExcel = function() {
    const data = poList.map(po => {
        const requiredQty = Math.max(0, Number(po.orderQty)||0);
        const shippedQty = shipmentList
          .filter(s => String(s.poNumber||'').trim()===String(po.poNumber||'').trim()
            && String(s.profile||'').trim()===String(po.profile||'').trim()
            && cleanLen(s.length)===cleanLen(po.length))
          .reduce((sum,s)=>sum+(Number(s.shippedQty)||0),0);
        const remainingQty = Math.max(0, requiredQty-shippedQty);
        const m = masterData.find(x =>
          String(x.profile||'').trim()===String(po.profile||'').trim() &&
          cleanLen(x.length)===cleanLen(po.length)
        );
        return {
          "PO Date":po.date,
          "PO Number":po.poNumber,
          "Profile":po.profile,
          "Item Code":(typeof resolveMasterItemCode==='function'?resolveMasterItemCode(po.profile,po.length,po.itemCode):po.itemCode)||'-',
          "Length (mm)":po.length,
          "Unit Wt":m?Number(m.unitWeight||0).toFixed(4):'-',
          "Required Qty":requiredQty,
          "Shipped Qty":shippedQty,
          "Remaining Qty":remainingQty,
          "Status":remainingQty>0?"Pending":"Complete"
        };
    });
    exportTableToExcel(data, "AIS_Production_Orders", "Production Orders");
};
window.exportCardboardExcel = function() { const data = cardboardStockList.map(c => ({ "Date": c.date, "Transaction Type": c.type, "Incoming": c.incoming, "Consumed": c.used })); exportTableToExcel(data, "AIS_Cardboard_History", "Cardboard"); };
window.exportShipmentsExcel = function() { const data = shipmentList.map(s => ({ "Shipment Date": s.date, "PO Number": s.poNumber, "Profile": s.profile, "Item Code": getShipmentMasterItemCode(s)||"-", "Length (mm)": s.length, "Container No": s.container, "Shipped Qty": s.shippedQty, "Remaining": s.remainingBalance })); exportTableToExcel(data, "AIS_Shipment_History", "Shipments"); };
window.exportHistoryExcel = function() { const data = historyLogs.map(h => ({ "Date": h.date, "Time": h.timestamp, "Shift": h.shift, "Team": h.team || 'Unassigned', "Profile": h.profile, "Length (mm)": h.length, "Cut Qty": h.cutQty, "Punch Qty": h.punchQty, "Wrap Qty": h.wrapQty, "Box Qty": h.boxQty, "Crate Qty": h.crateQty })); exportTableToExcel(data, "AIS_Production_History", "History"); };
window.exportRejectExcel = function() { const data = rejectLogs.map(r => ({ "Date": r.reject_date, "Shift": r.shift, "Location": r.location, "Stage": r.stage, "Profile": r.profile, "Item Code": r.item_code, "Length (mm)": r.length, "Reject Qty": r.pcs, "Weight (kg)": r.weight })); exportTableToExcel(data, "AIS_Reject_History", "Rejects"); };
window.exportRecoverExcel = function() {
  const cutData=recoveryCutLogs.map(r=>({"Date":r.cut_date,"Source Profile":r.source_profile,"Source Item Code":r.source_item_code,"Original Length":r.original_length,"New Profile":r.new_profile,"New Item Code":r.new_item_code,"New Length":r.new_length,"Cut Qty":r.cut_pcs,"Cut Weight (kg)":r.cut_weight}));
  const wrapData=recoveryWrapLogs.map(r=>({"Date":r.wrap_date,"Profile":r.profile,"Item Code":r.item_code,"Length":r.length,"Available Recover Cut Pcs":r.available_cut_pcs,"Wrapping Pcs":r.wrap_pcs,"Recovery Weight (kg)":r.wrap_weight}));
  if(cutData.length) exportTableToExcel(cutData,"AIS_Recovery_Cut_History","Recovery Cut");
  if(wrapData.length) exportTableToExcel(wrapData,"AIS_Recovery_Wrapping_History","Recovery Wrap");
  if(!cutData.length && !wrapData.length) showToast('No recovery records to export!','warning');
};

function injectGenericEditModal() {
    if(document.getElementById('genericEditModal')) return;
    const html = `<div id="genericEditModal" class="modal"><div class="modal-content" style="text-align:left; max-width:400px;"><h3 style="color:var(--primary-color); margin-top:0;"><i class="fa-solid fa-pen"></i> Admin Quick Edit</h3><p style="font-size:11.5px; color:var(--warning-color); margin-bottom:15px; font-weight:700;">Admin edits are saved to the selected record. Packing List Pcs Qty edits will also refresh the related weight and dashboard calculations.</p><input type="hidden" id="genericEditTable"><input type="hidden" id="genericEditId"><div id="genericEditFields"></div><div style="display:flex; gap:10px; margin-top:16px;"><button class="btn btn-accent" style="flex:1;" onclick="saveGenericEdit()"><i class="fa-solid fa-check"></i> Save Changes</button><button class="btn btn-danger" style="flex:1; background:#64748b;" onclick="document.getElementById('genericEditModal').style.display='none'">Cancel</button></div></div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

window.openGenericEdit = function(table, id, fieldsMap) {
    if(currentUserRole !== 'Admin') return;
    document.getElementById('genericEditTable').value = table; document.getElementById('genericEditId').value = id; const container = document.getElementById('genericEditFields'); container.innerHTML = '';
    Object.keys(fieldsMap).forEach(key => { const isQty = /(^|_)(pcs_qty|qty|quantity)($|_)/i.test(key); container.insertAdjacentHTML('beforeend', `<div class="form-group"><label style="text-transform:capitalize;">${key.replace(/_/g, ' ')}</label><input type="${isQty?'number':'text'}" ${isQty?'min="0" step="1"':''} id="edit_field_${key}" value="${fieldsMap[key]}" data-col="${key}"></div>`); });
    document.getElementById('genericEditModal').style.display = 'flex';
}

window.saveGenericEdit = async function() {
    const table = document.getElementById('genericEditTable').value; const id = document.getElementById('genericEditId').value; const inputs = document.querySelectorAll('#genericEditFields input');
    let updateObj = {}; inputs.forEach(input => { updateObj[input.dataset.col] = /(^|_)(pcs_qty|qty|quantity)($|_)/i.test(input.dataset.col) ? Math.max(0, parseInt(input.value,10)||0) : input.value; });
    try {
        if(table === 'packing_list' && Object.prototype.hasOwnProperty.call(updateObj,'pcs_qty')) {
            const rec = packingLists.find(x => String(x.id) === String(id));
            if(rec) {
                const cat = masterData.find(m => String(m.profile).trim()===String(rec.profile).trim() && String(m.itemCode).trim()===String(rec.itemCode).trim() && cleanLen(m.length)===cleanLen(rec.length))
                    || masterData.find(m => String(m.profile).trim()===String(rec.profile).trim() && cleanLen(m.length)===cleanLen(rec.length));
                if(cat) updateObj.net_weight = Number(updateObj.pcs_qty||0) * (Number(cat.unitWeight)||0);
            }
        }
        const localRow = table==='packing_list' ? packingLists.find(x=>String(x.id)===String(id)) : (table==='history_logs' ? historyLogs.find(x=>String(x.id)===String(id)) : null);
        const oldObj={};
        if(localRow){ Object.keys(updateObj).forEach(k=>{ const map={pcs_qty:'pcsQty',crate_no:'crateNo',cut_qty:'cutQty',punch_qty:'punchQty',wrap_qty:'wrapQty',box_qty:'boxQty',crate_qty:'crateQty'}; oldObj[k]=localRow[map[k]||k]; }); }
        const result = await supabaseClient.from(table).update(updateObj).eq('id', id);
        if(result.error) throw result.error;
        if(localRow && Object.keys(oldObj).length) aisRegisterUndo(`Edit ${table.replace('_',' ')} • ID ${id}`,async()=>{await aisUpdateById(table,id,oldObj);},table==='packing_list'?'packingListTab':'historyTab');
        document.getElementById('genericEditModal').style.display = 'none';
        showToast("Record updated successfully!", "success");
        await loadDataFromSupabase(true);
    } catch(e) { showToast(dbErrorMessage(e,'Update failed'), "error"); }
}

const INITIAL_CATALOG = [ {"profile": "1037", "length": "1727.2", "unit_weight": 1.601, "item_code": "RT-BT68", "material": "1234"} ];

window.injectCountdownUI = function() {
    if (!document.getElementById('shipmentCountdownContainer')) {
        const dashTab = document.getElementById('dashboardTab');
        const hero = dashTab ? dashTab.querySelector('.dashboard-hero') : null;
        if(hero) {
            const countdownHtml = `
            <div id="shipmentCountdownContainer" class="dashboard-shipment-handover" style="display:none;">
                <div class="dashboard-shipment-handover-info">
                    <div class="dashboard-shipment-icon"><i class="fa-solid fa-ship"></i></div>
                    <div>
                        <h4>Next Shipment Handover</h4>
                        <div id="shipmentTargetDisplay">Not Set</div>
                    </div>
                </div>
                <div class="dashboard-shipment-timer-wrap">
                    <div class="dashboard-shipment-timer-label">Time Remaining</div>
                    <div id="countdownTimerDisplay" class="dashboard-shipment-timer">-- : -- : --</div>
                </div>
            </div>`;
            const gridGlow = hero.querySelector('.dashboard-hero-grid-glow');
            if(gridGlow) gridGlow.insertAdjacentHTML('afterend', countdownHtml);
            else hero.insertAdjacentHTML('afterbegin', countdownHtml);
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
    
    const hero = container.closest('.dashboard-hero');
    if (!shipmentDeadline || isNaN(shipmentDeadline)) {
        container.style.display = 'none';
        if(hero) hero.classList.remove('has-shipment-handover');
        return;
    }
    
    container.style.display = 'flex';
    if(hero) hero.classList.add('has-shipment-handover');
    
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
            const {error}=await supabaseClient.from('daily_instructions').insert([newRec]);
            if(error) throw error; dailyInstructionsList.push({...newRec,id:-Date.now()});
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
  aisInjectUndoButtons();
  startLiveClock(); const today = new Date().toISOString().split('T')[0];
  ['entryDate', 'poDate', 'shipmentDate', 'plDate', 'historyDateSelect', 'cbDate', 'cbManualDate', 'planDate', 'recDate', 'rwDate'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).value = today; });
  if(document.getElementById('rejDate')) document.getElementById('rejDate').value = today;
  // Keep manually selected dates and Reject context between consecutive entries and page refreshes.
  const savedFormState = getAISFormState();
  ['cbDate','cbManualDate','rejDate'].forEach(id => { const el=document.getElementById(id); if(el && savedFormState[id] && /^\d{4}-\d{2}-\d{2}$/.test(savedFormState[id])) el.value=savedFormState[id]; });
  ['rejShift','rejTeam','rejLoc'].forEach(id => { const el=document.getElementById(id); if(el && savedFormState[id] != null && [...el.options].some(o=>String(o.value)===String(savedFormState[id]))) el.value=savedFormState[id]; });
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
    const safeFetch = async (table, options = {}, quiet = false) => {
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
        if(!isSilent && !quiet) showToast(`DB Error (${table}): ${e.message}`, 'error');
        throw e;
      }
    };

    const safeFetchOptional = async (table, options={}) => {
       try { return await safeFetch(table, options, true); }
       catch(e) {
         // A read failure is not the same as an empty table. Abort this sync so
         // the existing in-memory records remain visible instead of being replaced
         // by empty arrays during a temporary network/RLS/schema problem.
         console.error(`Data sync paused because ${table} could not be read safely.`, e);
         throw new Error(`Could not safely read ${table}: ${e.message || e}`);
       }
     };
    const results = await Promise.all([
        safeFetch('master_catalog'),
        safeFetchOptional('production_orders', { order: {col: 'id', asc: false} }),
        safeFetchOptional('shipments', { order: {col: 'id', asc: false} }),
        safeFetchOptional('packing_list', { order: {col: 'id', asc: false} }),
        safeFetchOptional('history_logs', { order: {col: 'id', asc: false} }),
        safeFetchOptional('reject_logs', { order: {col: 'id', asc: false} }),
        safeFetchOptional('recover_logs', { order: {col: 'id', asc: false} }),
        safeFetchOptional('cardboard_stock', { order: {col: 'id', asc: false} }),
        safeFetchOptional('daily_instructions', { order: {col: 'id', asc: false} }),
        safeFetchOptional('recovery_cut_logs', { order: {col: 'id', asc: false} }),
        safeFetchOptional('recovery_wrap_logs', { order: {col: 'id', asc: false} })
    ]);

    let catDataRaw = results[0];
    if (catDataRaw.length === 0) {
      const seedRows=INITIAL_CATALOG.map(i => ({ profile: i.profile, length: i.length, unit_weight: i.unit_weight || 0, item_code: i.item_code || '', material: i.material || '', cut_qty: 0, punch_qty: 0, wrap_qty: 0, box_qty: 0, crate_qty: 0, box_capacity: 100, ex_length: '' }));
      try { const r=await supabaseClient.from('master_catalog').insert(seedRows); if(r.error) throw r.error; catDataRaw=seedRows.map((r,i)=>({...r,id:-100000-i})); } catch(e) { console.warn('Initial master catalog seed skipped:',e); catDataRaw=seedRows.map((r,i)=>({...r,id:-100000-i})); }
    }

    setDbStatus(true,'Supabase data sync completed.');
    const poData = results[1], shipData = results[2], plData = results[3], logData = results[4], rjData = results[5], rcData = results[6], cbData = results[7], instData = results[8], rCutData = results[9], rWrapData = results[10];
    
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
      const obj = { db_id: item.id, db_ids: [item.id], dbRows: [{id:item.id,cutQty:Number(item.cut_qty)||0,punchQty:Number(item.punch_qty)||0,wrapQty:Number(item.wrap_qty)||0,boxQty:Number(item.box_qty)||0,crateQty:Number(item.crate_qty)||0}], profile: String(item.profile).trim(), itemCode: String(item.item_code || '').trim(), material: item.material || localExt.mat || '-', length: cleanLen(item.length), exLength: item.ex_length || localExt.ex || '', unitWeight: parseFloat(item.unit_weight) || 0, cutQty: Number(item.cut_qty)||0, punchQty: Number(item.punch_qty)||0, wrapQty: Number(item.wrap_qty)||0, boxQty: Number(item.box_qty)||0, crateQty: Number(item.crate_qty)||0, boxCapacity: item.box_capacity || localExt.cap || 100 };
      const uniqueKey = `${obj.profile}_${obj.itemCode}_${obj.length}`;
      if (!seenMap.has(uniqueKey)) { seenMap.set(uniqueKey, obj); uniqueData.push(obj); } 
      else { const ex = seenMap.get(uniqueKey); ex.db_ids.push(item.id); ex.dbRows.push({id:item.id,cutQty:obj.cutQty,punchQty:obj.punchQty,wrapQty:obj.wrapQty,boxQty:obj.boxQty,crateQty:obj.crateQty}); ex.cutQty += obj.cutQty; ex.punchQty += obj.punchQty; ex.wrapQty += obj.wrapQty; ex.boxQty += obj.boxQty; ex.crateQty += obj.crateQty; if (!ex.itemCode || ex.itemCode === '-' || ex.itemCode === '') ex.itemCode = obj.itemCode; }
    });
    masterData = uniqueData.sort((a, b) => (parseFloat(a.profile)||0) - (parseFloat(b.profile)||0) || (parseFloat(a.length)||0) - (parseFloat(b.length)||0));
    // Item Code for Production Orders is resolved from Master Catalog by Profile + Cut Length.
    // This keeps old PO records compatible even when the production_orders table has no item_code column.
    const resolveMasterItemCode = (profile, length, preferred='') => {
      const pref = String(preferred || '').trim();
      if (pref && pref !== '-') return pref;
      const p = String(profile || '').trim();
      const l = cleanLen(length);
      const matches = masterData.filter(m => String(m.profile || '').trim() === p && cleanLen(m.length) === l && String(m.itemCode || '').trim());
      return matches.length ? String(matches[0].itemCode).trim() : '';
    };
    window.resolveMasterItemCode = resolveMasterItemCode;
    poList = poData.map(item => ({
      id: item.id, date: item.po_date, poNumber: item.po_number, profile: item.profile,
      itemCode: resolveMasterItemCode(item.profile, item.length, item.item_code),
      length: cleanLen(item.length), orderQty: item.order_qty
    }));
    shipmentList = shipData.map(item => ({ id: item.id, date: item.shipment_date, month: item.shipment_month, poNumber: item.po_number, profile: item.profile, itemCode: item.item_code || '', length: cleanLen(item.length), container: item.container, shippedQty: item.shipped_qty, remainingBalance: item.remaining_balance }));
    packingLists = plData.map(item => ({ id: item.id, plNumber: item.pl_number, poNumber: item.po_number, month: item.shipment_month || 'January', container: item.container || '1st Container', crateNo: item.crate_no || `Crate 1`, profile: item.profile, itemCode: item.item_code || '', length: cleanLen(item.length), boxQty: item.box_qty || 1, pcsQty: item.pcs_qty || 0, netWeight: item.net_weight || 0, grossWeight: item.gross_weight || 0, date: item.packing_date, createdAt: item.created_at || item.createdAt || null, updatedAt: item.updated_at || item.updatedAt || null, timestamp: item.timestamp || null }));
    historyLogs = logData.map(item => ({ id: item.id, date: item.log_date, shift: item.shift, team: item.team || item.production_team || '', profile: item.profile, length: cleanLen(item.length), cutQty: item.cut_qty || 0, punchQty: item.punch_qty || 0, wrapQty: item.wrap_qty || 0, boxQty: item.box_qty || 0, crateQty: item.crate_qty || 0, timestamp: item.log_time || item.created_at || new Date().toISOString() }));
    rejectLogs = rjData; recoverLogs = rcData; dailyInstructionsList = (instData || []).map(normalizeDailyInstructionRow);
    nextPlStateLoaded = false; nextPlRestorePersistedState();
    recoveryCutLogs = (rCutData || []).map(r => ({id:r.id,cut_date:r.cut_date,source_profile:r.source_profile,source_item_code:r.source_item_code,original_length:cleanLen(r.original_length),new_profile:r.new_profile,new_item_code:r.new_item_code,new_length:cleanLen(r.new_length),cut_pcs:Number(r.cut_pcs)||0,cut_weight:Number(r.cut_weight)||0}));
    recoveryWrapLogs = (rWrapData || []).map(r => ({id:r.id,wrap_date:r.wrap_date,profile:r.profile,item_code:r.item_code,length:cleanLen(r.length),available_cut_pcs:Number(r.available_cut_pcs)||0,wrap_pcs:Number(r.wrap_pcs)||0,wrap_weight:Number(r.wrap_weight)||0}));
    // Version 1 recovery rows represented CUT conversion, not actual wrapping recovery.
    // Keep them visible as legacy cut records, but never count their old recovered_weight as monthly recovery.
    if (recoveryCutLogs.length === 0 && recoverLogs.length) {
      recoveryCutLogs = recoverLogs.map(r => ({id:`legacy-${r.id}`,cut_date:r.recover_date,source_profile:r.profile,source_item_code:r.item_code,original_length:cleanLen(r.original_length),new_profile:r.profile,new_item_code:r.item_code,new_length:cleanLen(r.new_length),cut_pcs:Number(r.pcs)||0,cut_weight:Number(r.recovered_weight)||0,legacy:true}));
    }
    if (cbData && cbData.length > 0) { cardboardStockList = cbData.map(c => ({ id: c.id, db_id: c.id, date: c.cb_date, type: c.cb_type, incoming: c.incoming || 0, used: c.used || 0, timestamp: c.created_at || new Date().toISOString() })); saveCardboardLocally(); } else { const localCb = localStorage.getItem('alumex_cardboard_local'); if(localCb) cardboardStockList = JSON.parse(localCb); }
    const manualRow = (instData || []).find(r => r.target_user === 'SYS_CARDBOARD_MANUAL');
    if (manualRow && manualRow.message) { try { cardboardManualData = JSON.parse(manualRow.message) || []; } catch(e) { cardboardManualData=[]; } saveCardboardManualLocally(); } else { const localManual = localStorage.getItem('alumex_cardboard_manual_local'); if(localManual) { try { cardboardManualData = JSON.parse(localManual) || []; } catch(e) { cardboardManualData=[]; } } }

    const profileLookup = new Map();
    masterData.forEach(m => profileLookup.set(`${String(m.profile).trim()}_${cleanLen(m.length)}`, m));

    historyLogs.forEach(l => { if (!profileLookup.has(`${String(l.profile).trim()}_${cleanLen(l.length)}`)) { const nm = { db_id: null, profile: String(l.profile).trim(), itemCode: '-', material: '-', length: cleanLen(l.length), exLength: '', unitWeight: 0, cutQty: 0, punchQty: 0, wrapQty: 0, boxQty: 0, crateQty: 0, boxCapacity: 100 }; masterData.push(nm); profileLookup.set(`${String(l.profile).trim()}_${cleanLen(l.length)}`, nm); } });
    poList.forEach(po => { if (!profileLookup.has(`${String(po.profile).trim()}_${cleanLen(po.length)}`)) { const nm = { db_id: null, profile: String(po.profile).trim(), itemCode: '-', material: '-', length: cleanLen(po.length), exLength: '', unitWeight: 0, cutQty: 0, punchQty: 0, wrapQty: 0, boxQty: 0, crateQty: 0, boxCapacity: 100 }; masterData.push(nm); profileLookup.set(`${String(po.profile).trim()}_${cleanLen(po.length)}`, nm); } });

    // IMPORTANT: master_catalog stock is authoritative. Production history is an audit trail
    // and must never rebuild current stock after an Admin reset. This prevents reset quantities
    // from reappearing on the next sync/reload.
    if(!isSilent && masterData.length > 0) showToast(`Database Sync Complete!`, "success");
  } catch (err) { console.error('Supabase data sync error:', err); setDbStatus(false, err?.message || 'Supabase data sync failed.'); if(!isSilent) showToast(`Database sync failed: ${err?.message || 'Unknown error'}`, 'error'); } finally { 
      isFetchingData = false;
      populateStockFilterDropdown(); populateProfileDropdown(); populatePoProfileDropdown(); populateShipmentPoDropdown(); populatePlPoDropdown(); populateCbProfileDropdown(); populateRejProfile(); populateRecProfile();
      restoreAISFormSelections();
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
        const {error}=await supabaseClient.from('daily_instructions').insert([newRec]);
        if(error) throw new Error(error.message);
        dailyInstructionsList.push({...newRec,id:-Date.now()});
      }
      localStorage.setItem('manual_crates',jsonStr);
      return true;
    } catch(e){ console.error('Manual crate state save failed:',e); showToast(`Crate completion save failed: ${e.message}`,'error'); return false; }
};

function packingRecordTimestamp(p) {
    // Prefer actual record creation/update timestamps over the shipment date.
    // A shipment date may be shared by several containers and is not enough to
    // determine which Packing List was saved most recently.
    const values = [p?.created_at, p?.createdAt, p?.updated_at, p?.updatedAt,
                    p?.timestamp, p?.date, p?.packingDate, p?.packing_date];
    for (const value of values) {
        if (!value) continue;
        const t = new Date(value).getTime();
        if (Number.isFinite(t)) return t;
    }
    return 0;
}
function packingContainerRank(container) {
    const s = String(container || '').toLowerCase();
    if (s.includes('3rd') || s.includes('third')) return 3;
    if (s.includes('2nd') || s.includes('second')) return 2;
    return 1;
}
function getLatestPackingSelection() {
    const rows = Array.isArray(packingLists) ? packingLists : [];
    const groups = new Map();
    rows.forEach(p => {
        const month = String(p.month || p.shipment_month || '').trim();
        const container = normalizeContainerName(p.container || p.container_no || '1st Container');
        if (!month) return;
        const key = `${month}::${container}`;
        if (!groups.has(key)) groups.set(key, {month, container, records: [], latestTs: 0, latestId: 0});
        const group = groups.get(key);
        group.records.push(p);
        group.latestTs = Math.max(group.latestTs, packingRecordTimestamp(p));
        // Numeric IDs are a useful tie-breaker when timestamps are not available.
        const idNum = Number(p.id);
        if (Number.isFinite(idNum)) group.latestId = Math.max(group.latestId, idNum);
    });
    const candidates = [...groups.values()].filter(g => g.records.length);
    candidates.forEach(g => { g.completed = isPackingShipmentComplete(g.month, g.container); });
    // Prefer the latest active/incomplete shipment. This keeps the Packing List
    // view on the current working container (e.g. 2nd after 1st is completed),
    // while still falling back to the newest saved group when all are complete.
    const active = candidates.filter(g => !g.completed);
    const pool = active.length ? active : candidates;
    pool.sort((a, b) =>
        (b.latestTs - a.latestTs) ||
        (b.latestId - a.latestId) ||
        (packingContainerRank(b.container) - packingContainerRank(a.container))
    );
    if (pool.length) {
        const latest = pool[0];
        const records = getPackingContainerRecords(latest.month, latest.container);
        return {month: latest.month, container: latest.container, records: records.length ? records : latest.records};
    }
    return {month: new Date().toLocaleString('en-US', {month:'long'}), container: '1st Container', records: []};
}
function selectLatestPackingList() {
    const latest = getLatestPackingSelection();
    activePackingMonth = latest.month;
    activePackingContainer = latest.container;
    return latest;
}
function getPackingMonths() {
    const newestByMonth = new Map();
    (Array.isArray(packingLists) ? packingLists : []).forEach(p => {
        const month = String(p.month || p.shipment_month || '').trim();
        if (!month) return;
        newestByMonth.set(month, Math.max(newestByMonth.get(month) || 0, packingRecordTimestamp(p)));
    });
    const months = [...newestByMonth.keys()].sort((a, b) => newestByMonth.get(b) - newestByMonth.get(a));
    const current = new Date().toLocaleString('en-US', {month:'long'});
    if (!months.includes(current)) months.push(current);
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
        else { const newRec={target_date:new Date().toISOString().split('T')[0],target_user:'SYS_PL_SHIPMENT_STATE',priority:'Normal',message:jsonStr,status:'Completed',action_taken:'System Data'}; const {error}=await supabaseClient.from('daily_instructions').insert([newRec]); if(error) throw error; dailyInstructionsList.push({...newRec,id:-Date.now()}); }
    } catch(e) { showToast('Shipment status could not be synced.','warning'); }
}
function ensurePackingSelection() {
    const months=getPackingMonths();
    const hadMonth=!!activePackingMonth, hadContainer=!!activePackingContainer;
    const containers=getContainerList();
    // On a fresh page load, open the newest Packing List with saved records.
    // Older months/containers remain available through the existing selectors.
    if(!hadMonth && !hadContainer) {
        const latest=getLatestPackingSelection();
        activePackingMonth=latest.month || new Date().toLocaleString('en-US',{month:'long'});
        activePackingContainer=containers.includes(latest.container) ? latest.container : containers[0];
        return;
    }
    if(!activePackingMonth || !months.includes(activePackingMonth)) activePackingMonth=months[0] || new Date().toLocaleString('en-US',{month:'long'});
    if(!activePackingContainer || !containers.includes(activePackingContainer)) activePackingContainer=containers[0];
}
window.setPackingShipment = function(month,container){ activePackingMonth=month; activePackingContainer=container; renderPackingListTable(); renderBalanceWorkTable(); renderDashboard(); };
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
  // Dashboard is the landing/overview screen: keep the main category nav clean and
  // do not open the secondary "Executive Dashboard" strip beneath it.
  if(tabId === 'dashboardTab') {
    nav.querySelectorAll('.smart-category').forEach(b=>b.classList.remove('active'));
    const overviewBtn=nav.querySelector('.smart-category[data-category="overview"]');
    if(overviewBtn) overviewBtn.classList.add('active');
    const panel=document.getElementById('smartSubnav');
    if(panel) panel.classList.remove('open');
    nav.classList.add('dashboard-nav-mode');
    return;
  }
  nav.classList.remove('dashboard-nav-mode');
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

function setDashboardNavPlacement(tabId){
  const nav=document.getElementById('mainNavTabs');
  const main=document.getElementById('mainContent');
  const dash=document.getElementById('dashboardTab');
  if(!nav || !main || !dash) return;
  if(!window.__aisNavHome){
    window.__aisNavHome={parent:nav.parentElement,next:nav.nextElementSibling};
  }
  if(tabId==='dashboardTab'){
    const hero=dash.querySelector('.dashboard-hero');
    if(hero && nav.parentElement!==dash){
      hero.insertAdjacentElement('afterend',nav);
    }
    nav.classList.add('dashboard-nav-below-hero');
  }else{
    const home=window.__aisNavHome;
    if(home && home.parent && nav.parentElement!==home.parent){
      if(home.next && home.next.parentElement===home.parent) home.parent.insertBefore(nav,home.next);
      else home.parent.appendChild(nav);
    }
    nav.classList.remove('dashboard-nav-below-hero');
  }
}


function renderSmartDailyPlan() {
  const esc = v => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const n = v => Number(v) || 0;
  const keyOf = (profile, length) => `${String(profile||'').trim()}|${cleanLen(length)}`;
  const getMaster = (profile, length) => masterData.find(m =>
    String(m.profile||'').trim() === String(profile||'').trim() &&
    cleanLen(m.length) === cleanLen(length)
  );
  const unitWeight = m => n(m?.unitWeight);
  const weight = (qty, m) => n(qty) * unitWeight(m);

  // Read-only: snapshot current master stock.
  const stockRows = masterData.map(m => ({
    ...m,
    cut: n(m.cutQty), punch: n(m.punchQty), wrap: n(m.wrapQty),
    box: n(m.boxQty), crate: n(m.crateQty),
    cap: Math.max(1, n(m.boxCapacity) || 100)
  }));

  // PO demand by Profile + Length, using the same shipped-quantity concept
  // already used by the Production Order page.
  const poDemand = new Map();
  poList.forEach(po => {
    const k = keyOf(po.profile, po.length);
    const required = Math.max(0, n(po.orderQty));
    const shipped = shipmentList
      .filter(s => String(s.poNumber||'').trim() === String(po.poNumber||'').trim()
        && String(s.profile||'').trim() === String(po.profile||'').trim()
        && cleanLen(s.length) === cleanLen(po.length))
      .reduce((sum,s) => sum + n(s.shippedQty), 0);
    const rem = Math.max(0, required - shipped);
    poDemand.set(k, (poDemand.get(k) || 0) + rem);
  });

  const punchPlan = [];
  const wrapPlan = [];
  const boxPlan = [];
  const alerts = [];
  const whyNot = [];

  stockRows.forEach(m => {
    const profile = String(m.profile||'').trim();
    const length = cleanLen(m.length);
    if (!profile || !length) return;
    const item = m.itemCode || '-';
    const demand = poDemand.get(keyOf(profile,length)) || 0;

    // CUT -> PUNCH: for profiles that use punching, cut stock is the input.
    // Punch-bypass profiles are intentionally excluded from this stage plan.
    const bypass = typeof isPunchBypassed === 'function' ? isPunchBypassed(profile, length) : false;
    if (!bypass) {
      if (m.cut >= 100) {
        const qty = Math.floor(m.cut);
        punchPlan.push({m, profile, length, item, qty, wt:weight(qty,m), demand});
      } else if (m.cut > 0) {
        whyNot.push({stage:'Punch', profile, length, item, qty:m.cut, minimum:100, reason:`Only ${m.cut.toLocaleString()} Pcs in Cut stage`});
      }
    }

    // PUNCH/CUT -> WRAP: punch stock for normal profiles; cut stock for bypass profiles.
    const sourceStage = bypass ? 'Cut' : 'Punch';
    const sourceQty = bypass ? m.cut : m.punch;
    if (sourceQty >= 200) {
      const qty = Math.floor(sourceQty);
      wrapPlan.push({m, profile, length, item, qty, wt:weight(qty,m), sourceStage, demand});
    } else if (sourceQty > 0) {
      whyNot.push({stage:'Wrapping', profile, length, item, qty:sourceQty, minimum:200, reason:`Only ${sourceQty.toLocaleString()} Pcs in ${sourceStage} stage`});
    }

    // WRAP -> BOX: available boxes are limited by wrapping Pcs and cardboard.
    if (m.wrap > 0) {
      const possibleByWrap = Math.floor(m.wrap / m.cap);
      const cardboard = Math.max(0, n(getAvailableCardboard(profile, item, length)));
      const possibleBoxes = Math.min(possibleByWrap, Math.floor(cardboard));
      if (possibleBoxes > 0) {
        const pcs = possibleBoxes * m.cap;
        boxPlan.push({m, profile, length, item, wrap:m.wrap, cap:m.cap, cardboard, boxes:possibleBoxes, pcs, wt:weight(pcs,m), demand});
      }
      if (possibleByWrap > cardboard) {
        alerts.push({
          type:'cardboard', level:'High', profile, length, item,
          message:`Wrapping stock ${m.wrap.toLocaleString()} Pcs can support ${possibleByWrap} boxes, but cardboard available is only ${cardboard}. Short ${Math.max(0,possibleByWrap-cardboard)} box(es).`
        });
      }
    }
  });

  // Ready-to-pack crates: use current selected Packing List month/container and
  // require every line in a crate to have enough Box-stage stock. Manual-completed
  // crates are excluded because they are no longer work for today.
  let cratePlan = [];
  try {
    if (typeof ensurePackingSelection === 'function') ensurePackingSelection();
    const month = activePackingMonth;
    const container = activePackingContainer;
    const records = (typeof getPackingContainerRecords === 'function')
      ? getPackingContainerRecords(month, container)
      : packingLists.filter(p => String(p.month||'')===String(month||'') && String(p.container||'')===String(container||''));
    const groups = new Map();
    records.forEach(r => {
      const crate = String(r.crateNo||'').trim();
      if (!crate) return;
      if (!groups.has(crate)) groups.set(crate, []);
      groups.get(crate).push(r);
    });
    groups.forEach((items, crateNo) => {
      if (typeof isManualCrateComplete === 'function' && isManualCrateComplete(crateNo, container, month)) return;
      let ready = true;
      let totalPcs = 0, totalWt = 0;
      const reasons = [];
      items.forEach(r => {
        const m = getMaster(r.profile, r.length);
        const req = Math.max(0,n(r.pcsQty));
        const availableBox = n(m?.boxQty);
        totalPcs += req;
        totalWt += weight(req,m);
        if (availableBox < req) {
          ready = false;
          reasons.push(`${r.profile}/${cleanLen(r.length)}: need ${req}, Box stock ${availableBox}`);
        }
      });
      if (ready) cratePlan.push({crateNo, totalPcs, totalWt, container, month, items});
      else if (reasons.length) alerts.push({type:'crate', level:'Medium', profile:crateNo, length:'', item:'', message:`Crate ${crateNo} is not ready: ${reasons.join(' • ')}`});
    });
  } catch(e) {
    console.warn('Smart Daily Plan crate calculation skipped:', e);
  }

  // Prioritize work that has outstanding PO demand.
  const priority = row => row.demand > 0 ? 'High' : 'Normal';
  punchPlan.sort((a,b)=> (b.demand-a.demand) || (b.qty-a.qty));
  wrapPlan.sort((a,b)=> (b.demand-a.demand) || (b.qty-a.qty));
  boxPlan.sort((a,b)=> (b.demand-a.demand) || (b.boxes-a.boxes));
  cratePlan.sort((a,b)=> String(a.crateNo).localeCompare(String(b.crateNo), undefined, {numeric:true}));

  // Keep the calculated rows available for read-only Excel/PDF export.
  // This object is memory-only and is never written back to Supabase.
  window.smartDailyPlanData = { punchPlan, wrapPlan, boxPlan, cratePlan, alerts, whyNot, generatedAt: new Date().toISOString(), activePackingMonth: activePackingMonth || '', activePackingContainer: activePackingContainer || '' };

  // Summary KPIs.
  const punchPcs = punchPlan.reduce((s,r)=>s+r.qty,0);
  const wrapPcs = wrapPlan.reduce((s,r)=>s+r.qty,0);
  const boxQty = boxPlan.reduce((s,r)=>s+r.boxes,0);
  const crateQty = cratePlan.length;
  const alertCount = alerts.length;
  const summary = document.getElementById('smartDailyPlanSummary');
  if(summary) summary.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;">
      ${[
        ['fa-arrow-right-to-bracket','#0369a1','Punch Today',`${punchPcs.toLocaleString()} Pcs`,`from ${punchPlan.length} profile(s)`],
        ['fa-bolt','#7c3aed','Wrap Today',`${wrapPcs.toLocaleString()} Pcs`,`from ${wrapPlan.length} profile(s)`],
        ['fa-box-open','#047857','Box Today',`${boxQty.toLocaleString()} Boxes`,`from current Wrap + cardboard`],
        ['fa-boxes-stacked','#b45309','Crates Ready',`${crateQty} Crates`,`from active Packing List`],
        ['fa-triangle-exclamation','#be123c','Alerts',`${alertCount}`,`material / packing issues`]
      ].map(x=>`<div style="background:#fff;border:1px solid #dbeafe;border-radius:14px;padding:13px;">
        <div style="font-size:10px;font-weight:900;color:#64748b;text-transform:uppercase;">${x[2]}</div>
        <div style="font-size:22px;font-weight:950;color:${x[1]};margin-top:3px;">${x[3]}</div>
        <div style="font-size:10px;font-weight:700;color:#64748b;">${x[4]}</div>
      </div>`).join('')}
    </div>`;

  const punchHost = document.getElementById('smartPunchPlan');
  if(punchHost) punchHost.innerHTML = punchPlan.length ? `
    <div style="overflow:auto;"><table class="data-table" style="width:100%;min-width:760px;">
      <thead><tr><th>Priority</th><th>Profile</th><th>Item Code</th><th>Length</th><th>Cut Stock</th><th>Recommended Punch</th><th>Weight</th></tr></thead>
      <tbody>${punchPlan.map(r=>`<tr>
        <td><b style="color:${priority(r)==='High'?'#dc2626':'#2563eb'}">${priority(r)}</b></td>
        <td><b>${esc(r.profile)}</b></td><td>${esc(r.item)}</td><td>${esc(r.length)} mm</td>
        <td>${r.m.cut.toLocaleString()} Pcs</td><td><b style="color:#0369a1">${r.qty.toLocaleString()} Pcs</b></td><td>${r.wt.toFixed(2)} kg</td>
      </tr>`).join('')}</tbody>
    </table></div>` : `<div style="padding:18px;text-align:center;color:#64748b;font-weight:800;">No Cut-stage profile has the minimum 100 Pcs for Punching right now.</div>`;

  const wrapHost = document.getElementById('smartWrapPlan');
  if(wrapHost) wrapHost.innerHTML = wrapPlan.length ? `
    <div style="overflow:auto;"><table class="data-table" style="width:100%;min-width:820px;">
      <thead><tr><th>Priority</th><th>Profile</th><th>Item Code</th><th>Length</th><th>Source</th><th>Available</th><th>Recommended Wrap</th><th>Weight</th></tr></thead>
      <tbody>${wrapPlan.map(r=>`<tr>
        <td><b style="color:${priority(r)==='High'?'#dc2626':'#7c3aed'}">${priority(r)}</b></td>
        <td><b>${esc(r.profile)}</b></td><td>${esc(r.item)}</td><td>${esc(r.length)} mm</td>
        <td>${r.sourceStage}</td><td>${r.qty.toLocaleString()} Pcs</td>
        <td><b style="color:#7c3aed">${r.qty.toLocaleString()} Pcs</b></td><td>${r.wt.toFixed(2)} kg</td>
      </tr>`).join('')}</tbody>
    </table></div>` : `<div style="padding:18px;text-align:center;color:#64748b;font-weight:800;">No profile has the minimum 200 Pcs for Wrapping right now.</div>`;

  const boxHost = document.getElementById('smartBoxPlan');
  if(boxHost) boxHost.innerHTML = boxPlan.length ? `
    <div style="overflow:auto;"><table class="data-table" style="width:100%;min-width:900px;">
      <thead><tr><th>Priority</th><th>Profile</th><th>Length</th><th>Wrap Stock</th><th>Pcs / Box</th><th>Cardboard</th><th>Can Pack</th><th>Pcs</th><th>Weight</th></tr></thead>
      <tbody>${boxPlan.map(r=>`<tr>
        <td><b style="color:${priority(r)==='High'?'#dc2626':'#047857'}">${priority(r)}</b></td>
        <td><b>${esc(r.profile)}</b><br><small>${esc(r.item)}</small></td><td>${esc(r.length)} mm</td>
        <td>${r.wrap.toLocaleString()} Pcs</td><td>${r.cap.toLocaleString()}</td><td>${r.cardboard.toLocaleString()} Boxes</td>
        <td><b style="color:#047857">${r.boxes.toLocaleString()} Boxes</b></td><td>${r.pcs.toLocaleString()} Pcs</td><td>${r.wt.toFixed(2)} kg</td>
      </tr>`).join('')}</tbody>
    </table></div>` : `<div style="padding:18px;text-align:center;color:#64748b;font-weight:800;">No Box Packing quantity is currently available from Wrap stock + cardboard stock.</div>`;

  const crateHost = document.getElementById('smartCratePlan');
  if(crateHost) crateHost.innerHTML = cratePlan.length ? `
    <div style="overflow:auto;"><table class="data-table" style="width:100%;min-width:700px;">
      <thead><tr><th>Container</th><th>Crate No.</th><th>Profiles</th><th>Ready Qty</th><th>Weight</th><th>Action</th></tr></thead>
      <tbody>${cratePlan.map(r=>`<tr>
        <td>${esc(r.container)}</td><td><b style="color:#b45309">${esc(r.crateNo)}</b></td>
        <td>${r.items.length}</td><td>${r.totalPcs.toLocaleString()} Pcs</td><td>${r.totalWt.toFixed(2)} kg</td>
        <td><button class="btn" style="padding:5px 9px;background:#b45309;border:1px solid #b45309;" onclick="switchTab('packingListTab', document.querySelector('[onclick*=\\'packingListTab\\']'))"><i class="fa-solid fa-boxes-packing"></i> Open Packing</button></td>
      </tr>`).join('')}</tbody>
    </table></div>` : `<div style="padding:18px;text-align:center;color:#64748b;font-weight:800;">No Ready-to-Pack crates in the active Packing List.</div>`;

  const alertHost = document.getElementById('smartAlerts');
  if(alertHost) alertHost.innerHTML = alerts.length ? alerts.map(a=>`
    <div style="display:flex;gap:10px;align-items:flex-start;padding:11px 12px;margin-bottom:8px;border-radius:12px;background:${a.level==='High'?'#fff1f2':'#fff7ed'};border:1px solid ${a.level==='High'?'#fecdd3':'#fed7aa'};">
      <i class="fa-solid fa-triangle-exclamation" style="color:${a.level==='High'?'#e11d48':'#ea580c'};margin-top:2px;"></i>
      <div><b style="color:${a.level==='High'?'#be123c':'#9a3412'}">${esc(a.level)} Alert — ${esc(a.profile)}</b><div style="font-size:12px;color:#475569;margin-top:2px;">${esc(a.message)}</div></div>
    </div>`).join('') : `<div style="padding:16px;text-align:center;color:#047857;font-weight:900;background:#f0fdf4;border-radius:12px;">✓ No current material / crate readiness alerts.</div>`;

  const whyHost = document.getElementById('smartWhyNot');
  if(whyHost) whyHost.innerHTML = whyNot.length ? `
    <div style="overflow:auto;"><table class="data-table" style="width:100%;min-width:720px;">
      <thead><tr><th>Stage</th><th>Profile</th><th>Item Code</th><th>Length</th><th>Available</th><th>Minimum</th><th>Reason</th></tr></thead>
      <tbody>${whyNot.slice(0,30).map(r=>`<tr>
        <td><b>${esc(r.stage)}</b></td><td>${esc(r.profile)}</td><td>${esc(r.item)}</td><td>${esc(r.length)} mm</td>
        <td>${r.qty.toLocaleString()} Pcs</td><td>${r.minimum} Pcs</td><td style="color:#b45309;font-weight:800">${esc(r.reason)}</td>
      </tr>`).join('')}</tbody>
    </table></div>` : `<div style="padding:16px;text-align:center;color:#047857;font-weight:900;background:#f0fdf4;border-radius:12px;">✓ No profiles are currently waiting for the minimum Punch/Wrap quantity.</div>`;
}


function smartDailyExportRows(step) {
  const d = window.smartDailyPlanData || {};
  if(step === 'punch') return (d.punchPlan||[]).map(r => ({
    'Priority': r.demand > 0 ? 'High' : 'Normal', 'Profile': r.profile, 'Item Code': r.item,
    'Length (mm)': r.length, 'Cut Stock (Pcs)': r.m.cut, 'Recommended Punch (Pcs)': r.qty,
    'Unit Weight (kg/Pc)': Number(r.m.unitWeight||0).toFixed(4), 'Weight (kg)': Number(r.wt||0).toFixed(2),
    'Pending PO Qty (Pcs)': Number(r.demand||0)
  }));
  if(step === 'wrap') return (d.wrapPlan||[]).map(r => ({
    'Priority': r.demand > 0 ? 'High' : 'Normal', 'Profile': r.profile, 'Item Code': r.item,
    'Length (mm)': r.length, 'Source Stage': r.sourceStage, 'Available Source (Pcs)': r.qty,
    'Recommended Wrap (Pcs)': r.qty, 'Unit Weight (kg/Pc)': Number(r.m.unitWeight||0).toFixed(4),
    'Weight (kg)': Number(r.wt||0).toFixed(2), 'Pending PO Qty (Pcs)': Number(r.demand||0)
  }));
  if(step === 'box') return (d.boxPlan||[]).map(r => ({
    'Priority': r.demand > 0 ? 'High' : 'Normal', 'Profile': r.profile, 'Item Code': r.item,
    'Length (mm)': r.length, 'Wrap Stock (Pcs)': r.wrap, 'Pcs / Box': r.cap,
    'Cardboard Available (Boxes)': r.cardboard, 'Can Pack (Boxes)': r.boxes,
    'Can Pack (Pcs)': r.pcs, 'Unit Weight (kg/Pc)': Number(r.m.unitWeight||0).toFixed(4),
    'Weight (kg)': Number(r.wt||0).toFixed(2), 'Pending PO Qty (Pcs)': Number(r.demand||0),
    'Cardboard Shortage (Boxes)': Math.max(0, Math.floor(r.wrap/r.cap)-r.cardboard)
  }));
  if(step === 'crate') return (d.cratePlan||[]).map(r => ({
    'Shipment Month': r.month, 'Container': r.container, 'Crate No': r.crateNo,
    'Profiles / Lines': r.items.length, 'Ready Qty (Pcs)': r.totalPcs,
    'Ready Weight (kg)': Number(r.totalWt||0).toFixed(2),
    'Packing List Status': 'Ready to Pack',
    'Packing List Items': r.items.map(i=>`${i.profile}/${cleanLen(i.length)}: ${Number(i.pcsQty||0)} Pcs`).join(' | ')
  }));
  if(step === 'alerts') return (d.alerts||[]).map(a => ({'Level':a.level,'Type':a.type,'Profile / Crate':a.profile,'Length (mm)':a.length||'','Item Code':a.item||'','Alert':a.message}));
  if(step === 'why') return (d.whyNot||[]).map(r => ({'Stage':r.stage,'Profile':r.profile,'Item Code':r.item,'Length (mm)':r.length,'Available (Pcs)':r.qty,'Minimum (Pcs)':r.minimum,'Reason':r.reason}));
  return [];
}

window.exportSmartDailyStep = function(step, type) {
  const names={punch:'01_Cut_to_Punch',wrap:'02_To_Wrapping',box:'03_Box_Packing',crate:'04_Crate_Packing',alerts:'05_Action_Alerts',why:'06_Why_Not'};
  const titles={punch:'Kaizen Smart Plan - Cut to Punch',wrap:'Kaizen Smart Plan - Wrapping',box:'Kaizen Smart Plan - Box Packing',crate:'Kaizen Smart Plan - Crate Packing',alerts:'Kaizen Smart Plan - Action Alerts',why:'Kaizen Smart Plan - Why Not'};
  const rows=smartDailyExportRows(step);
  if(!rows.length) return showToast('No data available for this Kaizen step.', 'warning');
  if(type==='pdf') exportDataToPdf(rows,`AIS_Kaizen_${names[step]}`,titles[step],`AIS Tracker • ${window.smartDailyPlanData?.activePackingMonth||''} ${window.smartDailyPlanData?.activePackingContainer||''}`);
  else exportTableToExcel(rows,`AIS_Kaizen_${names[step]}`,titles[step]);
};

window.exportSmartDailyAll = function(type) {
  const steps=['punch','wrap','box','crate','alerts','why'];
  if(type==='pdf') {
    // Full PDF: keep each Kaizen step as its own table so every step's different
    // columns remain visible instead of being flattened into one mixed table.
    if(!window.jspdf || !window.jspdf.jsPDF || !window.jspdf.jsPDF.prototype) return showToast('PDF library not loaded. Please check internet connection.','error');
    const doc=new window.jspdf.jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
    const stepTitles={punch:'1. CUT → PUNCH',wrap:'2. PUNCH/CUT → WRAPPING',box:'3. BOX PACKING',crate:'4. CRATE PACKING',alerts:'5. ACTION ALERTS / BOTTLENECKS',why:'6. WHY NOT / WAITING'};
    let has=false;
    steps.forEach((step,idx)=>{
      const rows=smartDailyExportRows(step);
      if(!rows.length) return;
      if(has) doc.addPage();
      has=true;
      doc.setFont('helvetica','bold'); doc.setFontSize(15); doc.setTextColor(6,78,59);
      doc.text(`AIS Tracker • Kaizen Smart Daily Plan`,14,13);
      doc.setFontSize(11); doc.setTextColor(30,64,175); doc.text(stepTitles[step],14,20);
      doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(90);
      doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`,14,25);
      const columns=Object.keys(rows[0]);
      const body=rows.map(r=>columns.map(k=>r[k]===null||r[k]===undefined?'':String(r[k])));
      if(typeof doc.autoTable!=='function') return showToast('PDF table plugin not loaded. Please check internet connection.','error');
      doc.autoTable({head:[columns],body,startY:29,theme:'grid',styles:{font:'helvetica',fontSize:7,cellPadding:2,overflow:'linebreak'},headStyles:{fillColor:[6,78,59],textColor:255,fontStyle:'bold'},alternateRowStyles:{fillColor:[240,253,244]},margin:{left:10,right:10},didDrawPage:function(data){const page=doc.internal.getNumberOfPages();doc.setFontSize(7);doc.setTextColor(100);doc.text(`AIS Tracker • Page ${page}`,doc.internal.pageSize.getWidth()-45,doc.internal.pageSize.getHeight()-7);}});
    });
    if(!has) return showToast('No Smart Daily Plan data to export.','warning');
    doc.save('AIS_Kaizen_Smart_Daily_Plan_Full.pdf'); showToast('Full Kaizen PDF downloaded successfully.','success');
    return;
  }
  // Excel: one workbook with a separate sheet per step.
  if(typeof XLSX !== 'undefined' && XLSX.utils && XLSX.writeFile) {
    const wb=XLSX.utils.book_new();
    steps.forEach(step=>{
      const rows=smartDailyExportRows(step);
      if(rows.length) XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),(step==='punch'?'01 Punch':step==='wrap'?'02 Wrap':step==='box'?'03 Box':step==='crate'?'04 Crate':step==='alerts'?'05 Alerts':'06 Why Not').slice(0,31));
    });
    if(!wb.SheetNames.length) return showToast('No Smart Daily Plan data to export.','warning');
    XLSX.writeFile(wb,'AIS_Kaizen_Smart_Daily_Plan_Full.xlsx'); showToast('Full Kaizen Excel downloaded successfully.','success');
  } else {
    // Fallback still exports all rows in one Excel-compatible file.
    const allRows=[]; steps.forEach(step=>smartDailyExportRows(step).forEach(r=>allRows.push(Object.assign({'Step':step.toUpperCase()},r))));
    exportTableToExcel(allRows,'AIS_Kaizen_Smart_Daily_Plan_Full','Kaizen Plan');
  }
};


/* -------------------------------------------------------------------------
 * NEXT PL 15–19T PLANNING — READ / PLAN ONLY
 * Uses existing PO, shipment and Master Catalog/current-stock data.
 * This module never writes to Supabase and never mutates production/stock data.
 * ------------------------------------------------------------------------- */
let nextPlSelection = {};
let nextPlExcluded = {};
let nextPlManualOverride = {};
let nextPlViewMode = 'suggested';
let nextPlStateHydrating = false;
let nextPlStateSaveTimer = null;
let nextPlStateLoaded = false;
const NEXT_PL_STATE_KEY = 'SYS_NEXT_PL_PLAN_STATE';
let nextPlPoWeightChartInstance = null;

function nextPlNum(v){
  const n=Number(String(v??0).replace(/,/g,'').trim());
  return Number.isFinite(n)?Math.max(0,n):0;
}
function nextPlProfileKey(v){
  const s=String(v??'').trim().toLowerCase().replace(/\s+/g,'');
  return s.replace(/^al[-_]?/,'');
}
function nextPlSameProfile(a,b){ return nextPlProfileKey(a)===nextPlProfileKey(b); }
function nextPlEsc(v){
  return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
function nextPlKey(poNumber,profile,itemCode,length){
  return `${String(poNumber??'').trim()}|${nextPlProfileKey(profile)}|${String(itemCode??'').trim().toLowerCase()}|${cleanLen(length)}`;
}
function nextPlCatalogForPo(po){
  const p=String(po?.profile??'').trim();
  const ic=String(po?.itemCode??'').trim();
  const l=cleanLen(po?.length);
  if(!p || !l) return null;
  let m=masterData.find(x=>nextPlSameProfile(x.profile,p) && String(x.itemCode??'').trim().toLowerCase()===ic.toLowerCase() && cleanLen(x.length)===l);
  if(m) return m;
  return masterData.find(x=>nextPlSameProfile(x.profile,p) && cleanLen(x.length)===l) || null;
}
function nextPlCurrentPackingInfo(){
  try{ ensurePackingSelection(); }catch(e){}
  const month=activePackingMonth||'';
  const container=activePackingContainer||'';
  const records=(typeof getPackingContainerRecords==='function') ? getPackingContainerRecords(month,container) : [];
  const byLine=new Map();
  const byLineWeight=new Map();
  const byStock=new Map();
  let weight=0,pcs=0;
  records.forEach(r=>{
    const p=String(r?.profile??'').trim(), ic=String(r?.itemCode??'').trim(), l=cleanLen(r?.length), po=String(r?.poNumber??'').trim();
    const q=nextPlNum(r?.pcsQty);
    let uw=0;
    const m=masterData.find(x=>nextPlSameProfile(x.profile,p) && String(x.itemCode??'').trim().toLowerCase()===ic.toLowerCase() && cleanLen(x.length)===l)
      || masterData.find(x=>nextPlSameProfile(x.profile,p) && cleanLen(x.length)===l);
    uw=nextPlNum(m?.unitWeight);
    const wt=nextPlNum(r?.netWeight)>0 ? nextPlNum(r.netWeight) : q*uw;
    weight+=wt; pcs+=q;
    const lk=nextPlKey(po,p,ic,l); byLine.set(lk,(byLine.get(lk)||0)+q); byLineWeight.set(lk,(byLineWeight.get(lk)||0)+wt);
    const sk=`${nextPlProfileKey(p)}|${ic.toLowerCase()}|${l}`; byStock.set(sk,(byStock.get(sk)||0)+q);
  });
  return {month,container,records,weight,pcs,byLine,byLineWeight,byStock};
}
function nextPlGetRows(){
  if(!Array.isArray(poList)||!Array.isArray(masterData)) return [];
  const currentPL=nextPlCurrentPackingInfo();
  const shipmentPool=new Map();
  (shipmentList||[]).forEach(sh=>{
    const key=nextPlKey(sh?.poNumber,sh?.profile,'',sh?.length);
    shipmentPool.set(key,(shipmentPool.get(key)||0)+nextPlNum(sh?.shippedQty));
  });
  const raw=(poList||[]).map((po,i)=>({po,i})).filter(x=>nextPlNum(x.po?.orderQty)>0 && String(x.po?.poNumber??'').trim() && String(x.po?.profile??'').trim() && cleanLen(x.po?.length));
  raw.sort((a,b)=>{
    const da=new Date(a.po?.date||0).getTime(), db=new Date(b.po?.date||0).getTime();
    return da-db || String(a.po?.poNumber??'').localeCompare(String(b.po?.poNumber??''),undefined,{numeric:true,sensitivity:'base'}) || a.i-b.i;
  });

  const lines=[];
  raw.forEach(({po,i})=>{
    const m=nextPlCatalogForPo(po); if(!m) return;
    const profile=String(m.profile??po.profile??'').trim();
    const itemCode=String(m.itemCode??po.itemCode??'').trim();
    const length=cleanLen(m.length??po.length);
    const unitWeight=nextPlNum(m.unitWeight);
    const lineKey=nextPlKey(po?.poNumber,profile,itemCode,length);
    const shipKey=nextPlKey(po?.poNumber,profile,'',length);
    const shipPool=shipmentPool.get(shipKey)||0;
    const order=nextPlNum(po?.orderQty);
    const shipped=Math.min(order,shipPool);
    shipmentPool.set(shipKey,Math.max(0,shipPool-shipped));
    const currentPlQty=nextPlNum(currentPL.byLine.get(lineKey));
    const pendingAfterPl=Math.max(0,order-shipped-currentPlQty);
    // A PO line can already be represented in the active PL. Show it even when
    // its remaining PO balance is zero so the planner can see the completed part.
    const stockKey=`${nextPlProfileKey(profile)}|${itemCode.toLowerCase()}|${length}`;
    lines.push({
      key:stockKey,rowKey:String(po?.id??`local-${i}`),poIndex:i,date:po?.date||'',poNumber:String(po?.poNumber??'').trim(),
      profile,itemCode,length,unitWeight,pendingQty:pendingAfterPl,originalPendingQty:Math.max(0,order-shipped),
      orderQty:order,shippedQty:shipped,currentPlQty,currentPlWeight:nextPlNum(currentPL.byLineWeight.get(lineKey)),
      remainingPoWeight:pendingAfterPl*unitWeight,
      stockCut:0,stockPunch:0,stockWrap:0,stockBox:0,stockCrate:0,stockTotal:0,stockReady:0,stockWip:0,stockAvailableAfterPl:0,
      availableForPo:0,needCutQty:0,needCutWeight:0,
      selectedQty:nextPlNum(nextPlSelection[String(po?.id??`local-${i}`)]),master:m,
      excluded:!!nextPlExcluded[String(po?.id??`local-${i}`)]
    });
  });

  // Snapshot current Master Catalog stock and reserve quantities already placed
  // in the active/current Packing List, because that material is already planned.
  const stockMap=new Map();
  (masterData||[]).forEach(m=>{
    const p=String(m?.profile??'').trim(), ic=String(m?.itemCode??'').trim(), l=cleanLen(m?.length);
    if(!p||!ic||!l)return;
    const key=`${nextPlProfileKey(p)}|${ic.toLowerCase()}|${l}`;
    const g=stockMap.get(key)||{cut:0,punch:0,wrap:0,box:0,crate:0,unitWeight:nextPlNum(m.unitWeight),master:m};
    g.cut+=nextPlNum(m.cutQty); g.punch+=nextPlNum(m.punchQty); g.wrap+=nextPlNum(m.wrapQty); g.box+=nextPlNum(m.boxQty); g.crate+=nextPlNum(m.crateQty);
    if(!g.unitWeight)g.unitWeight=nextPlNum(m.unitWeight);
    stockMap.set(key,g);
  });
  currentPL.byStock.forEach((qty,key)=>{
    const g=stockMap.get(key); if(!g)return;
    let left=qty;
    // Reserve from higher stages first because those pieces are the ones most
    // likely represented in the active PL.
    ['crate','box','wrap','punch','cut'].forEach(st=>{const take=Math.min(g[st],left);g[st]-=take;left-=take;});
    g.reservedByPL=qty;
  });

  const priority=document.getElementById('nextPlPriority')?.value||'oldest';
  const allocationOrder=[...lines].sort((a,b)=>{
    const da=new Date(a.date||0).getTime(), db=new Date(b.date||0).getTime();
    const d=priority==='newest'?db-da:da-db;
    return d || (priority==='newest' ? String(b.poNumber).localeCompare(String(a.poNumber),undefined,{numeric:true,sensitivity:'base'}) : String(a.poNumber).localeCompare(String(b.poNumber),undefined,{numeric:true,sensitivity:'base'}));
  });
  const remainingStock=new Map(); stockMap.forEach((g,key)=>remainingStock.set(key,{...g}));
  allocationOrder.forEach(line=>{
    const g=remainingStock.get(line.key); if(!g)return;
    line.stockCut=g.cut; line.stockPunch=g.punch; line.stockWrap=g.wrap; line.stockBox=g.box; line.stockCrate=g.crate;
    line.stockTotal=g.cut+g.punch+g.wrap+g.box+g.crate;
    line.stockReady=g.crate+g.box+g.wrap; line.stockWip=g.cut+g.punch;
    line.stockAvailableAfterPl=line.stockTotal;
    line.availableForPo=Math.min(line.pendingQty,Math.max(0,line.stockTotal));
    line.needCutQty=Math.max(0,line.pendingQty-line.availableForPo);
    line.needCutWeight=line.needCutQty*line.unitWeight;
    // Allocate stock once so an older PO gets first claim on shared stock.
    let left=line.availableForPo;
    ['crate','box','wrap','punch','cut'].forEach(st=>{const take=Math.min(g[st],left);g[st]-=take;left-=take;});
  });
  return lines;
}
function nextPlGetStateSnapshot(){
  const val=id=>document.getElementById(id)?.value;
  return {
    version: 3,
    targetWeight: nextPlNum(val('nextPlTargetWeight')||15000),
    minKg: nextPlNum(val('nextPlMinKg')||15000),
    maxKg: nextPlNum(val('nextPlMaxKg')||19000),
    priority: val('nextPlPriority')||'oldest',
    poFilter: val('nextPlPoFilter')||'',
    profileFilter: val('nextPlProfileFilter')||'',
    lengthFilter: val('nextPlLengthFilter')||'',
    viewMode: val('nextPlViewMode')||nextPlViewMode||'suggested',
    selection: {...(nextPlSelection||{})},
    excluded: {...(nextPlExcluded||{})},
    manualOverride: {...(nextPlManualOverride||{})},
    quickProfile: val('nextPlQuickProfile')||'',
    quickLength: val('nextPlQuickLength')||'',
    savedAt: new Date().toISOString()
  };
}
function nextPlApplyState(state){
  if(!state)return;
  nextPlStateHydrating=true;
  try{
    const set=(id,v)=>{const el=document.getElementById(id);if(el&&v!==undefined&&v!==null)el.value=String(v);};
    set('nextPlTargetWeight',state.targetWeight||15000);
    set('nextPlMinKg',state.minKg||15000);
    set('nextPlMaxKg',state.maxKg||19000);
    set('nextPlPriority',state.priority||'oldest');
    nextPlViewMode=state.viewMode||'suggested';
    // V3 planning uses shipment-balance-first allocation. Old V2 selections were
    // stock-limited suggestions, so migrate only the temporary planning selection
    // state; PO/Shipment/Stock/Packing List operational data is untouched.
    if(Number(state.version||0) < 3){
      nextPlSelection={};
      nextPlExcluded={};
      nextPlManualOverride={};
    }else{
      nextPlSelection={...(state.selection||{})};
      nextPlExcluded={...(state.excluded||{})};
      nextPlManualOverride={...(state.manualOverride||{})};
    }
    set('nextPlQuickProfile',state.quickProfile||'');
    set('nextPlQuickLength',state.quickLength||'');
  }finally{nextPlStateHydrating=false;}
}
function nextPlRestorePersistedState(){
  if(nextPlStateLoaded)return;
  nextPlStateLoaded=true;
  let state=null;
  const dbRow=(dailyInstructionsList||[]).find(i=>String(i.target_user||'')===NEXT_PL_STATE_KEY);
  if(dbRow?.message){try{state=JSON.parse(dbRow.message);}catch(e){console.warn('Next PL state parse failed',e);}}
  if(!state){try{const raw=localStorage.getItem('ais_next_pl_state');if(raw)state=JSON.parse(raw);}catch(e){}}
  if(state)nextPlApplyState(state);
}
async function nextPlPersistStateNow(){
  if(nextPlStateHydrating || !currentUserRole)return false;
  const state=nextPlGetStateSnapshot();
  try{localStorage.setItem('ais_next_pl_state',JSON.stringify(state));}catch(e){}
  try{
    const jsonStr=JSON.stringify(state);
    const existing=(dailyInstructionsList||[]).find(i=>String(i.target_user||'')===NEXT_PL_STATE_KEY);
    if(existing){
      const {error}=await supabaseClient.from('daily_instructions').update({message:jsonStr}).eq('id',existing.id);
      if(error)throw error;
      existing.message=jsonStr;
    }else{
      const rec={target_date:new Date().toISOString().split('T')[0],target_user:NEXT_PL_STATE_KEY,priority:'Normal',message:jsonStr,status:'Completed',action_taken:'Next PL Planning State'};
      const {data,error}=await supabaseClient.from('daily_instructions').insert([rec]).select().single();
      if(error)throw error;
      dailyInstructionsList.push({...rec,id:data?.id||-Date.now()});
    }
    return true;
  }catch(e){console.error('Next PL plan state save failed:',e);return false;}
}
function nextPlSchedulePersist(){
  if(nextPlStateHydrating || !currentUserRole)return;
  clearTimeout(nextPlStateSaveTimer);
  nextPlStateSaveTimer=setTimeout(()=>nextPlPersistStateNow(),350);
}
async function resetNextPlPlanningState(){
  if(currentUserRole!=='Admin')return showToast('Only Admin can reset Next PL planning.','error');
  showConfirm('<b>RESET NEXT PL PLANNING</b><br><br>This will clear the saved Next PL target and all temporary planning selections for every logged-in user.<br><br><span style="color:#059669;font-weight:700">POs, Shipments, Current Stock and Packing Lists will NOT be deleted.</span>',async()=>{
    try{
      clearTimeout(nextPlStateSaveTimer);
      const row=(dailyInstructionsList||[]).find(i=>String(i.target_user||'')===NEXT_PL_STATE_KEY);
      if(row){const {error}=await supabaseClient.from('daily_instructions').delete().eq('id',row.id);if(error)throw error;}
      dailyInstructionsList=(dailyInstructionsList||[]).filter(i=>String(i.target_user||'')!==NEXT_PL_STATE_KEY);
      nextPlSelection={};nextPlExcluded={};nextPlManualOverride={};nextPlViewMode='suggested';nextPlStateLoaded=true;
      try{localStorage.removeItem('ais_next_pl_state');}catch(e){}
      const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=String(v);};
      set('nextPlTargetWeight',15000);set('nextPlMinKg',15000);set('nextPlMaxKg',19000);set('nextPlPriority','oldest');set('nextPlPoFilter','');set('nextPlProfileFilter','');set('nextPlLengthFilter','');set('nextPlViewMode','suggested');set('nextPlQuickProfile','');set('nextPlQuickLength','');
      renderNextPlPlanning();showToast('Saved Next PL planning was reset. All operational data is preserved.','success');
    }catch(e){showToast(`Next PL reset failed: ${e.message||'Database error'}`,'error');}
  });
}

function nextPlRefreshFilters(rows){
  const poSel=document.getElementById('nextPlPoFilter'), pfSel=document.getElementById('nextPlProfileFilter'), lfSel=document.getElementById('nextPlLengthFilter'); if(!poSel||!pfSel)return;
  const poCur=poSel.value, pfCur=pfSel.value, lfCur=lfSel?.value||'';
  const sortVals=arr=>[...new Set(arr.map(v=>String(v??'').trim()).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'}));
  const fill=(sel,label,vals,old)=>{sel.innerHTML=`<option value="">${label}</option>`+vals.map(x=>`<option value="${nextPlEsc(x)}">${nextPlEsc(x)}</option>`).join('');if(vals.includes(old))sel.value=old;};
  const pos=sortVals(rows.map(r=>r.poNumber));
  fill(poSel,'All POs',pos,poCur);
  const poRows=poSel.value?rows.filter(r=>String(r.poNumber||'')===poSel.value):rows;
  const pfs=[];poRows.forEach(r=>{if(r.profile&&!pfs.some(x=>nextPlSameProfile(x,r.profile)))pfs.push(r.profile);});
  pfs.sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:'base'}));
  fill(pfSel,'All Profiles',pfs,pfCur);
  const profileRows=pfSel.value?poRows.filter(r=>nextPlSameProfile(r.profile,pfSel.value)):poRows;
  if(lfSel){const ls=sortVals(profileRows.map(r=>cleanLen(r.length))).sort((a,b)=>Number(a)-Number(b));fill(lfSel,'All Lengths',ls,cleanLen(lfCur));}
}
function nextPlSetQty(rowKey,value){
  const row=nextPlGetRows().find(r=>r.rowKey===String(rowKey)); if(!row)return;
  // A manual edit is allowed up to the FULL shipment balance / pending PO qty,
  // even when current stock is lower. The stock shortage is shown separately as
  // Pending Cut; do not silently cap the selection to current stock.
  let qty=Math.max(0,Math.floor(nextPlNum(value)));
  const cap=Math.max(0,Math.floor(nextPlNum(row.pendingQty)));
  if(qty>cap){qty=cap;showToast(`Selected Qty cannot exceed the shipment balance of ${cap.toLocaleString()} Pcs for this PO line.`,'warning');}
  nextPlSelection[String(rowKey)]=qty;
  nextPlExcluded[String(rowKey)]=false;
  nextPlManualOverride[String(rowKey)]=true;
  nextPlSchedulePersist();
  renderNextPlPlanning();
}
function nextPlToggleExclude(rowKey,checked){
  const k=String(rowKey); nextPlExcluded[k]=!!checked; if(checked){nextPlSelection[k]=0;nextPlManualOverride[k]=false;} nextPlSchedulePersist(); renderNextPlPlanning();
}
function nextPlFilteredRows(){
  const rows=nextPlGetRows();
  const po=document.getElementById('nextPlPoFilter')?.value||'', pf=document.getElementById('nextPlProfileFilter')?.value||'', lf=document.getElementById('nextPlLengthFilter')?.value||'';
  const mode=document.getElementById('nextPlViewMode')?.value||nextPlViewMode||'suggested';
  let filtered=rows.filter(r=>(!po||r.poNumber===po)&&(!pf||nextPlSameProfile(r.profile,pf))&&(!lf||cleanLen(r.length)===cleanLen(lf)));
  if(mode==='selected') filtered=filtered.filter(r=>nextPlNum(nextPlSelection[r.rowKey])>0);
  else if(mode==='stock') filtered=filtered.filter(r=>r.availableForPo>0 && r.pendingQty>0);
  else if(mode==='cut') filtered=filtered.filter(r=>r.needCutQty>0 && r.pendingQty>0);
  else if(mode==='pending') filtered=filtered.filter(r=>r.pendingQty>0);
  else {
    // Suggested: show lines that can actually contribute to the next PL. If an
    // auto/manual selection exists, keep those lines visible even if their
    // stock is now fully allocated. Otherwise show stock-backed candidates.
    const hasSelection=Object.values(nextPlSelection||{}).some(v=>nextPlNum(v)>0);
    filtered=filtered.filter(r=>hasSelection ? (nextPlNum(nextPlSelection[r.rowKey])>0 || (!r.excluded && r.availableForPo>0 && r.pendingQty>0)) : (r.pendingQty>0 && (r.availableForPo>0 || r.needCutQty>0)));
  }
  return filtered;
}
function nextPlSetViewMode(v){ nextPlViewMode=String(v||'suggested'); renderNextPlPlanning(); }
function nextPlGetCurrentSummary(){
  const info=nextPlCurrentPackingInfo();
  const targetMin=Math.max(0,nextPlNum(document.getElementById('nextPlMinKg')?.value||15000));
  const targetMax=Math.max(targetMin,nextPlNum(document.getElementById('nextPlMaxKg')?.value||19000));
  const targetTotal=Math.max(0,nextPlNum(document.getElementById('nextPlTargetWeight')?.value||targetMin));
  return {...info,targetMin,targetMax,targetTotal,remainingMin:Math.max(0,targetMin-info.weight),remainingMax:Math.max(0,targetMax-info.weight),remainingTarget:Math.max(0,targetTotal-info.weight)};
}
function nextPlRenderManualControls(rows){
  const poSel=document.getElementById('nextPlManualPo'), pfSel=document.getElementById('nextPlManualProfile'), icSel=document.getElementById('nextPlManualItem'), lSel=document.getElementById('nextPlManualLength');
  if(!poSel||!pfSel||!icSel||!lSel)return;
  const oldPo=poSel.value, oldPf=pfSel.value, oldIc=icSel.value, oldL=lSel.value;
  const pos=[...new Set(rows.map(r=>r.poNumber))].sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true}));
  poSel.innerHTML='<option value="">Select PO</option>'+pos.map(v=>`<option value="${nextPlEsc(v)}">${nextPlEsc(v)}</option>`).join(''); if(pos.includes(oldPo))poSel.value=oldPo;
  const updateProfiles=()=>{
    const pRows=rows.filter(r=>!poSel.value||r.poNumber===poSel.value); const ps=[];pRows.forEach(r=>{if(!ps.some(x=>nextPlSameProfile(x,r.profile)))ps.push(r.profile);});
    pfSel.innerHTML='<option value="">Select Profile</option>'+ps.map(v=>`<option value="${nextPlEsc(v)}">${nextPlEsc(v)}</option>`).join(''); if(ps.some(x=>nextPlSameProfile(x,oldPf)))pfSel.value=ps.find(x=>nextPlSameProfile(x,oldPf))||'';
  };
  updateProfiles();
  const updateItems=()=>{
    const rs=rows.filter(r=>(!poSel.value||r.poNumber===poSel.value)&&(!pfSel.value||nextPlSameProfile(r.profile,pfSel.value)));
    const vals=[...new Set(rs.map(r=>r.itemCode).filter(Boolean))]; icSel.innerHTML='<option value="">Select Item Code</option>'+vals.map(v=>`<option value="${nextPlEsc(v)}">${nextPlEsc(v)}</option>`).join(''); if(vals.includes(oldIc))icSel.value=oldIc;
  };
  updateItems();
  const updateLengths=()=>{
    const rs=rows.filter(r=>(!poSel.value||r.poNumber===poSel.value)&&(!pfSel.value||nextPlSameProfile(r.profile,pfSel.value))&&(!icSel.value||r.itemCode===icSel.value));
    const vals=[...new Set(rs.map(r=>r.length).filter(Boolean))]; lSel.innerHTML='<option value="">Select Length</option>'+vals.map(v=>`<option value="${nextPlEsc(v)}">${nextPlEsc(v)} mm</option>`).join(''); if(vals.includes(oldL))lSel.value=oldL;
  };
  updateLengths();
}
function nextPlRenderQuickManual(rows){
  const pf=document.getElementById('nextPlQuickProfile'), ls=document.getElementById('nextPlQuickLength'), body=document.getElementById('nextPlQuickPoBody');
  const note=document.getElementById('nextPlQuickNote');
  if(!pf||!ls||!body)return;
  const oldPf=pf.value, oldL=ls.value;
  const profiles=[];
  rows.forEach(r=>{if(r.profile&&!profiles.some(x=>nextPlSameProfile(x,r.profile)))profiles.push(r.profile);});
  profiles.sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:'base'}));
  pf.innerHTML='<option value="">Select Profile</option>'+profiles.map(v=>`<option value="${nextPlEsc(v)}">${nextPlEsc(v)}</option>`).join('');
  if(profiles.some(x=>nextPlSameProfile(x,oldPf)))pf.value=profiles.find(x=>nextPlSameProfile(x,oldPf))||'';
  const profileRows=rows.filter(r=>!pf.value||nextPlSameProfile(r.profile,pf.value));
  const lengths=[...new Set(profileRows.map(r=>cleanLen(r.length)).filter(Boolean))].sort((a,b)=>Number(a)-Number(b));
  ls.innerHTML='<option value="">Select Length</option>'+lengths.map(v=>`<option value="${nextPlEsc(v)}">${nextPlEsc(v)} mm</option>`).join('');
  if(lengths.includes(cleanLen(oldL)))ls.value=cleanLen(oldL);

  // Show only PO/profile/length lines with a real shipment balance remaining.
  const selectedRows=rows.filter(r=>pf.value&&ls.value&&nextPlSameProfile(r.profile,pf.value)&&cleanLen(r.length)===cleanLen(ls.value)&&nextPlNum(r.pendingQty)>0);
  if(!selectedRows.length){
    body.innerHTML='<tr><td colspan="10" class="next-pl-summary-empty">Select a Profile + Length. Only PO lines with shipment balance &gt; 0 will appear here.</td></tr>';
    const emptyFoot=document.getElementById('nextPlQuickPoFoot'); if(emptyFoot) emptyFoot.innerHTML='<tr class="next-pl-total-row"><td colspan="3">TOTAL — SELECTED PROFILE / LENGTH</td><td>0 Pcs</td><td>0.00 kg</td><td>0 Pcs</td><td>0 Pcs</td><td>0.00 kg</td><td>0 Pcs</td><td>0.00 kg</td></tr>';
    if(note)note.innerHTML='<i class="fa-solid fa-circle-info"></i> Select Profile + Length first. Zero shipment-balance POs are hidden automatically.';
    return;
  }
  const groups=new Map();
  selectedRows.forEach(r=>{
    const key=String(r.poNumber);
    const g=groups.get(key)||{po:r.poNumber,rows:[],balancePcs:0,balanceWeight:0,ready:0,itemCodes:new Set(),selectedPcs:0,selectedWeight:0};
    g.rows.push(r);
    g.balancePcs+=Math.max(0,r.pendingQty);
    g.balanceWeight+=Math.max(0,r.pendingQty)*Math.max(0,r.unitWeight);
    g.ready+=Math.min(Math.max(0,r.availableForPo),Math.max(0,r.pendingQty));
    const q=Math.max(0,nextPlNum(nextPlSelection[r.rowKey]));
    g.selectedPcs+=q;
    g.selectedWeight+=q*Math.max(0,r.unitWeight);
    if(r.itemCode)g.itemCodes.add(r.itemCode);
    groups.set(key,g);
  });
  const gs=[...groups.values()].sort((a,b)=>String(a.po).localeCompare(String(b.po),undefined,{numeric:true,sensitivity:'base'}));
  body.innerHTML=gs.map((g,i)=>{
    const uid=nextPlEsc(g.po).replace(/[^a-zA-Z0-9_-]/g,'_');
    const remainingPcs=Math.max(0,g.balancePcs-g.selectedPcs);
    const remainingWeight=Math.max(0,g.balanceWeight-g.selectedWeight);
    const hasSelected=g.selectedPcs>0;
    return `<tr class="${hasSelected?'next-pl-quick-selected-row':''}">
      <td><span class="next-pl-po-rank">${i+1}</span></td>
      <td><b>${nextPlEsc(g.po)}</b></td>
      <td>${[...g.itemCodes].map(nextPlEsc).join(', ')||'-'}</td>
      <td><b class="next-pl-balance-pcs">${g.balancePcs.toLocaleString()}</b><small class="next-pl-subline">shipment balance</small></td>
      <td><b class="next-pl-balance-weight">${g.balanceWeight.toFixed(2)} kg</b><small class="next-pl-subline">PO balance weight</small></td>
      <td><b class="next-pl-selected-pcs">${g.selectedPcs.toLocaleString()} Pcs</b><small class="next-pl-subline">already planned</small></td>
      <td><b class="next-pl-remaining-pcs">${remainingPcs.toLocaleString()} Pcs</b><small class="next-pl-subline">after Next PL</small></td>
      <td><b class="next-pl-remaining-weight">${remainingWeight.toFixed(2)} kg</b><small class="next-pl-subline">after Next PL</small></td>
      <td><input class="next-pl-quick-qty" id="nextPlQuickQty_${uid}" type="number" min="0" max="${g.balancePcs}" step="1" placeholder="Pcs" value="${hasSelected?g.selectedPcs:g.balancePcs}" oninput="nextPlQuickPreview(this, ${JSON.stringify(g.po)}, ${JSON.stringify(g.rows.map(r=>({rowKey:r.rowKey,pendingQty:r.pendingQty,unitWeight:r.unitWeight})))})"></td>
      <td><span class="next-pl-quick-weight" data-po="${nextPlEsc(g.po)}">${g.selectedWeight.toFixed(2)} kg</span><button type="button" class="btn btn-accent next-pl-quick-add" onclick="nextPlQuickAdd(${JSON.stringify(g.po)}, ${JSON.stringify(g.rows.map(r=>({rowKey:r.rowKey,pendingQty:r.pendingQty,unitWeight:r.unitWeight})))}, this)"><i class="fa-solid fa-${hasSelected?'rotate':'plus'}"></i> ${hasSelected?'Update':'Add'}</button></td>
    </tr>`;
  }).join('');
  const quickBalancePcs=gs.reduce((sum,g)=>sum+g.balancePcs,0), quickBalanceWt=gs.reduce((sum,g)=>sum+g.balanceWeight,0), quickSelectedPcs=gs.reduce((sum,g)=>sum+g.selectedPcs,0), quickSelectedWt=gs.reduce((sum,g)=>sum+g.selectedWeight,0), quickRemainingPcs=Math.max(0,quickBalancePcs-quickSelectedPcs), quickRemainingWt=Math.max(0,quickBalanceWt-quickSelectedWt);
  const quickFoot=document.getElementById('nextPlQuickPoFoot');
  if(quickFoot)quickFoot.innerHTML=`<tr class="next-pl-total-row"><td colspan="3">TOTAL — SELECTED PROFILE / LENGTH</td><td>${quickBalancePcs.toLocaleString()} Pcs</td><td>${quickBalanceWt.toFixed(2)} kg</td><td>${quickSelectedPcs.toLocaleString()} Pcs</td><td>${quickRemainingPcs.toLocaleString()} Pcs</td><td>${quickRemainingWt.toFixed(2)} kg</td><td>${quickSelectedPcs.toLocaleString()} Pcs</td><td>${quickSelectedWt.toFixed(2)} kg</td></tr>`;
  if(note)note.innerHTML='<i class="fa-solid fa-circle-check"></i> <b>'+nextPlEsc(pf.value)+' / '+nextPlEsc(ls.value)+' mm</b> selected. Only POs with shipment balance &gt; 0 are shown. <b>Already planned Pcs, remaining balance and weight update automatically.</b> Send Pcs defaults to the full shipment balance. Reduce it only if the target weight requires it, then click Add/Update — the same PO will never be added twice.';
}
function nextPlQuickPreview(input,po,parts){
  let qty=Math.max(0,Math.floor(nextPlNum(input.value))), remaining=qty, weight=0;
  [...parts].sort((a,b)=>String(a.rowKey).localeCompare(String(b.rowKey))).forEach(p=>{
    if(remaining<=0)return;
    const add=Math.min(remaining,Math.max(0,nextPlNum(p.pendingQty)));
    if(add>0){weight+=add*Math.max(0,nextPlNum(p.unitWeight));remaining-=add;}
  });
  const cell=input.closest('tr')?.querySelector('.next-pl-quick-weight'); if(cell)cell.textContent=`${weight.toFixed(2)} kg`;
}
function nextPlQuickAdd(po,parts,button){
  const input=button?.closest('tr')?.querySelector('.next-pl-quick-qty');
  if(!input)return;
  let qty=Math.floor(nextPlNum(input.value));
  if(qty<0)qty=0;
  const maxTotal=parts.reduce((s,p)=>s+Math.max(0,nextPlNum(p.pendingQty)),0);
  if(qty>maxTotal){qty=maxTotal;input.value=qty;showToast(`Only ${maxTotal.toLocaleString()} Pcs remain on this PO for the selected Profile + Length.`,'warning');}
  // IMPORTANT: set the PO's final planned quantity instead of incrementing it.
  // This prevents the same PO/Profile/Length quantity from being added twice.
  let remaining=qty,addedWeight=0;
  const ordered=[...parts].sort((a,b)=>String(a.rowKey).localeCompare(String(b.rowKey)));
  ordered.forEach(p=>{
    const rowCap=Math.max(0,nextPlNum(p.pendingQty));
    const add=Math.min(remaining,rowCap);
    nextPlExcluded[p.rowKey]=false;
    if(add>0){nextPlManualOverride[p.rowKey]=true;nextPlSelection[p.rowKey]=add;addedWeight+=add*Math.max(0,nextPlNum(p.unitWeight));remaining-=add;}
    else {nextPlManualOverride[p.rowKey]=false;nextPlSelection[p.rowKey]=0;}
  });
  nextPlSchedulePersist();
  renderNextPlPlanning();
  showToast(`${addedWeight.toFixed(2)} kg is now planned from PO ${po}. Existing selection was updated, not duplicated.`,'success');
}
function nextPlManualProfileChanged(){
  const rows=nextPlGetRows(); nextPlRenderManualControls(rows);
}
function nextPlAddManual(){
  const po=document.getElementById('nextPlManualPo')?.value||'', pf=document.getElementById('nextPlManualProfile')?.value||'', ic=document.getElementById('nextPlManualItem')?.value||'', l=cleanLen(document.getElementById('nextPlManualLength')?.value), qty=Math.floor(nextPlNum(document.getElementById('nextPlManualQty')?.value));
  if(!po||!pf||!ic||!l||qty<=0)return showToast('Select PO, Profile, Item Code, Length and a valid Pcs Qty.','warning');
  const row=nextPlGetRows().find(r=>r.poNumber===po&&nextPlSameProfile(r.profile,pf)&&r.itemCode.toLowerCase()===ic.toLowerCase()&&cleanLen(r.length)===l);
  if(!row)return showToast('Selected PO/Profile/Item/Length line is not available in the pending PO list.','error');
  nextPlExcluded[row.rowKey]=false;
  nextPlManualOverride[row.rowKey]=true;
  const cap=Math.max(0,row.pendingQty);
  const finalQty=Math.min(qty,cap);
  nextPlSelection[row.rowKey]=finalQty;
  if(qty>cap)showToast(`Only ${cap.toLocaleString()} Pcs remain on this PO after the current PL.`,'warning');
  nextPlSchedulePersist();
  renderNextPlPlanning();
  showToast(`Manual plan saved: PO ${po} • ${finalQty.toLocaleString()} Pcs • ${(finalQty*row.unitWeight).toFixed(2)} kg.`,'success');
}
function nextPlShipmentBalanceFor(poNumber,profile,length){
  const len=cleanLen(length);
  const rows=nextPlGetRows().filter(r=>r.poNumber===String(poNumber||'') && nextPlSameProfile(r.profile,profile) && (!len||cleanLen(r.length)===len));
  const order=rows.reduce((s,r)=>s+r.orderQty,0);
  const shipped=rows.reduce((s,r)=>s+r.shippedQty,0);
  const currentPL=rows.reduce((s,r)=>s+r.currentPlQty,0);
  const shipmentBalance=Math.max(0,order-shipped);
  const balanceAfterCurrentPL=Math.max(0,shipmentBalance-currentPL);
  const selected=rows.reduce((s,r)=>s+Math.max(0,nextPlNum(nextPlSelection[r.rowKey])),0);
  const selectedWeight=rows.reduce((s,r)=>s+Math.max(0,nextPlNum(nextPlSelection[r.rowKey]))*Math.max(0,r.unitWeight),0);
  const balanceAfterNextPL=Math.max(0,balanceAfterCurrentPL-selected);
  const balanceAfterNextWeight=rows.reduce((s,r)=>s+Math.max(0,r.pendingQty-nextPlNum(nextPlSelection[r.rowKey]))*Math.max(0,r.unitWeight),0);
  const currentStock=rows.reduce((s,r)=>s+Math.max(0,r.availableForPo),0);
  const pendingCut=Math.max(0,selected-currentStock);
  const pendingCutWeight=rows.reduce((s,r)=>s+Math.max(0,nextPlNum(nextPlSelection[r.rowKey])-Math.max(0,r.availableForPo))*Math.max(0,r.unitWeight),0);
  const wtAfterPL=rows.reduce((s,r)=>s+Math.max(0,r.pendingQty)*Math.max(0,r.unitWeight),0);
  return {order,shipped,remaining:shipmentBalance,currentPL,afterPL:balanceAfterCurrentPL,wtAfterPL,lengths:[...new Set(rows.map(r=>String(r.length)).filter(Boolean))],selected,selectedWeight,balanceAfterNextPL,balanceAfterNextWeight,currentStock,pendingCut,pendingCutWeight};
}
function nextPlRenderShipmentBalance(rows){
  const poSel=document.getElementById('nextPlShipmentPo'), pfSel=document.getElementById('nextPlShipmentProfile'), lenSel=document.getElementById('nextPlShipmentLength');
  const info=document.getElementById('nextPlShipmentBalanceInfo'); if(!poSel||!pfSel||!info)return;
  const oldPo=poSel.value, oldPf=pfSel.value, oldLen=lenSel?.value||'';
  const pos=[...new Set(rows.map(r=>r.poNumber).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:'base'}));
  poSel.innerHTML='<option value="">Select PO</option>'+pos.map(x=>`<option value="${nextPlEsc(x)}">${nextPlEsc(x)}</option>`).join('');
  if(pos.includes(oldPo))poSel.value=oldPo;
  const pRows=rows.filter(r=>!poSel.value||r.poNumber===poSel.value);
  const profiles=[]; pRows.forEach(r=>{if(!profiles.some(x=>nextPlSameProfile(x,r.profile)))profiles.push(r.profile);});
  profiles.sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:'base'}));
  pfSel.innerHTML='<option value="">Select Profile</option>'+profiles.map(x=>`<option value="${nextPlEsc(x)}">${nextPlEsc(x)}</option>`).join('');
  if(profiles.some(x=>nextPlSameProfile(x,oldPf)))pfSel.value=profiles.find(x=>nextPlSameProfile(x,oldPf))||'';
  const lRows=pRows.filter(r=>!pfSel.value||nextPlSameProfile(r.profile,pfSel.value));
  if(lenSel){const lengths=[...new Set(lRows.map(r=>cleanLen(r.length)).filter(Boolean))].sort((a,b)=>Number(a)-Number(b));lenSel.innerHTML='<option value="">Select Length</option>'+lengths.map(x=>`<option value="${nextPlEsc(x)}">${nextPlEsc(x)} mm</option>`).join(''); if(lengths.includes(cleanLen(oldLen)))lenSel.value=cleanLen(oldLen);}
  if(!poSel.value||!pfSel.value||!lenSel?.value){info.innerHTML='<div class="next-pl-shipment-empty"><i class="fa-solid fa-hand-pointer"></i> Select <b>PO Number + Profile + Length</b> to see the exact shipment balance and Next PL allocation.</div>';return;}
  const b=nextPlShipmentBalanceFor(poSel.value,pfSel.value,lenSel.value);
  info.innerHTML=`<div class="next-pl-shipment-grid">
    <div><span>Shipment Balance</span><b>${b.remaining.toLocaleString()} Pcs</b><small>${b.wtAfterPL.toFixed(2)} kg</small></div>
    <div><span>Current Stock</span><b>${b.currentStock.toLocaleString()} Pcs</b><small>available to this PO line</small></div>
    <div class="good"><span>Next PL Taken</span><b>${b.selected.toLocaleString()} Pcs</b><small>${b.selectedWeight.toFixed(2)} kg</small></div>
    <div class="good"><span>Balance After Next PL</span><b>${b.balanceAfterNextPL.toLocaleString()} Pcs</b><small>${b.balanceAfterNextWeight.toFixed(2)} kg</small></div>
    <div class="warn"><span>Pending Cut</span><b>${b.pendingCut.toLocaleString()} Pcs</b><small>${b.pendingCutWeight.toFixed(2)} kg</small></div>
    <div><span>Already in Current PL</span><b>${b.currentPL.toLocaleString()} Pcs</b><small>before Next PL</small></div>
  </div><div class="next-pl-shipment-note"><b>${nextPlEsc(poSel.value)} • ${nextPlEsc(pfSel.value)} • ${nextPlEsc(lenSel.value)} mm</b> — Full shipment balance is the default planning quantity. Edit <b>Next PL Select Pcs</b> only when the target weight requires a reduction.</div>`;
}

function nextPlRenderProfileSummary(rows){
  const box=document.getElementById('nextPlProfileSummaryBody'), poBox=document.getElementById('nextPlPoSummaryBody'); if(!box||!poBox)return;
  const selectedRows=(rows||[]).filter(r=>nextPlNum(nextPlSelection[r.rowKey])>0);
  const pg=new Map(), pog=new Map();
  selectedRows.forEach(r=>{
    const q=Math.min(nextPlNum(nextPlSelection[r.rowKey]),Math.max(0,nextPlNum(r.pendingQty)));
    if(!q)return;
    const wt=Math.max(0,r.unitWeight), pk=nextPlProfileKey(r.profile)+'|'+cleanLen(r.length);
    const p=pg.get(pk)||{profile:r.profile,length:r.length,pcs:0,weight:0,po:new Set(),stock:0,cut:0,punch:0,wrap:0,box:0,crate:0,pendingCutWeight:0,processingWeight:0,completeWeight:0,boxQty:0};
    // Allocate the selected Next PL quantity against existing stage stock only for this summary.
    // This is a read-only calculation; it does not modify masterData or stock records.
    let left=Math.min(q,Math.max(0,nextPlNum(r.availableForPo)));
    const stage={box:Math.max(0,nextPlNum(r.stockBox)),wrap:Math.max(0,nextPlNum(r.stockWrap)),punch:Math.max(0,nextPlNum(r.stockPunch)),cut:Math.max(0,nextPlNum(r.stockCut)),crate:Math.max(0,nextPlNum(r.stockCrate))};
    const taken={box:0,wrap:0,punch:0,cut:0,crate:0};
    ['box','wrap','punch','cut','crate'].forEach(st=>{taken[st]=Math.min(stage[st],left);left-=taken[st];});
    const fromStock=Math.min(q,Math.max(0,nextPlNum(r.availableForPo)));
    const pendingCut=Math.max(0,q-fromStock);
    p.pcs+=q; p.weight+=q*wt; p.po.add(r.poNumber); p.stock+=fromStock;
    p.cut+=taken.cut; p.punch+=taken.punch; p.wrap+=taken.wrap; p.box+=taken.box; p.crate+=taken.crate;
    p.pendingCutWeight+=pendingCut*wt;
    p.completeWeight+=(taken.wrap+taken.box)*wt;
    p.boxQty+=taken.box;
    p.processingWeight+=(taken.cut+taken.punch)*wt;
    pg.set(pk,p);
    const ok=String(r.poNumber)+'|'+pk, g=pog.get(ok)||{po:r.poNumber,profile:r.profile,pcs:0,weight:0,poBalanceWeight:0,pending:0,pendingWeight:0};
    const linePending=Math.max(0,nextPlNum(r.pendingQty)), linePendingAfter=Math.max(0,linePending-q);
    g.pcs+=q; g.weight+=q*wt; g.poBalanceWeight+=linePending*wt; g.pending+=linePendingAfter; g.pendingWeight+=linePendingAfter*wt; pog.set(ok,g);
  });
  const ps=[...pg.values()].sort((a,b)=>b.weight-a.weight);
  const pos=[...pog.values()].sort((a,b)=>String(a.po).localeCompare(String(b.po),undefined,{numeric:true})||String(a.profile).localeCompare(String(b.profile),undefined,{numeric:true}));
  box.innerHTML=ps.length?ps.map((g,i)=>`<tr><td>${i+1}</td><td><b>${nextPlEsc(g.profile)}</b><small class="next-pl-subline">POs: ${[...g.po].map(nextPlEsc).join(', ')}</small></td><td>${nextPlEsc(g.length)} mm</td><td>${g.pcs.toLocaleString()}</td><td class="next-pl-weight">${g.weight.toFixed(2)} kg</td><td>${g.stock.toLocaleString()} Pcs</td><td>${g.cut.toLocaleString()}</td><td>${g.punch.toLocaleString()}</td><td>${g.wrap.toLocaleString()}</td><td>${g.box.toLocaleString()}</td><td class="next-pl-weight">${g.completeWeight.toFixed(2)} kg</td><td>${g.boxQty.toLocaleString()} Pcs</td><td class="next-pl-pending-weight">${g.pendingCutWeight.toFixed(2)} kg</td><td>${g.processingWeight.toFixed(2)} kg</td></tr>`).join(''):`<tr><td colspan="14" class="next-pl-summary-empty">Auto Build or manually select Pcs to see the expected Next PL profile + length totals.</td></tr>`;
  const pfTable=box.closest('table');
  if(pfTable){let tf=pfTable.querySelector('tfoot');if(!tf){tf=document.createElement('tfoot');pfTable.appendChild(tf);}const sum=k=>ps.reduce((s,g)=>s+g[k],0);tf.innerHTML=`<tr class="next-pl-total-row"><td colspan="3">TOTAL PROFILE PLAN</td><td>${sum('pcs').toLocaleString()} Pcs</td><td>${sum('weight').toFixed(2)} kg</td><td>${sum('stock').toLocaleString()} Pcs</td><td>${sum('cut').toLocaleString()}</td><td>${sum('punch').toLocaleString()}</td><td>${sum('wrap').toLocaleString()}</td><td>${sum('box').toLocaleString()}</td><td>${sum('completeWeight').toFixed(2)} kg</td><td>${sum('boxQty').toLocaleString()} Pcs</td><td>${sum('pendingCutWeight').toFixed(2)} kg</td><td>${sum('processingWeight').toFixed(2)} kg</td></tr>`;}
  // Next PL-only visual summary: weight by profile/length plus estimated box completion KPIs.
  try {
    const canvas=document.getElementById('nextPlProfileMetricsChart');
    const kpi=document.getElementById('nextPlSummaryBoxKpis');
    if(kpi){
      const totals=selectedRows.reduce((a,r)=>{
        const q=Math.min(nextPlNum(nextPlSelection[r.rowKey]),Math.max(0,nextPlNum(r.pendingQty)));
        const cap=Math.max(1,nextPlNum(r.master?.boxCapacity)||100);
        const key=nextPlProfileKey(r.profile)+'|'+cleanLen(r.length);
        const planned=ps.find(x=>nextPlProfileKey(x.profile)+'|'+cleanLen(x.length)===key);
        const boxStage=planned?planned.box:0, crateStage=planned?planned.crate:0;
        a.totalBoxes+=Math.ceil(q/cap); a.completedBoxes+=Math.floor((boxStage+crateStage)/cap);
        return a;
      },{totalBoxes:0,completedBoxes:0});
      const totalComplete=ps.reduce((a,g)=>a+g.completeWeight,0);
      const totalPending=ps.reduce((a,g)=>a+g.pendingCutWeight,0);
      const totalProcessing=ps.reduce((a,g)=>a+g.processingWeight,0);
      kpi.innerHTML=[
        ['Complete Weight',totalComplete.toFixed(2)+' kg'],
        ['Pending Cutting Weight',totalPending.toFixed(2)+' kg'],
        ['Processing Weight (Cut + Punch)',totalProcessing.toFixed(2)+' kg'],
        ['Total Boxes (estimated)',totals.totalBoxes.toLocaleString()],
        ['Completed Boxes (Box + Crate stage)',totals.completedBoxes.toLocaleString()]
      ].map(([label,value])=>`<div style="padding:12px;border:1px solid #dbeafe;border-radius:10px;background:#f8fafc;"><div style="font-size:11px;color:#64748b;font-weight:800;margin-bottom:5px;">${label}</div><div style="font-size:19px;font-weight:900;color:#0f3b52;">${value}</div></div>`).join('');
    }
    if(canvas && typeof Chart!=='undefined'){
      if(window.nextPlProfileMetricsChartInstance)window.nextPlProfileMetricsChartInstance.destroy();
      const labels=ps.map(g=>`${g.profile} • ${cleanLen(g.length)} mm`);
      window.nextPlProfileMetricsChartInstance=new Chart(canvas.getContext('2d'),{
        type:'bar',data:{labels,datasets:[
          {label:'Complete Weight (Wrapping + Box)',data:ps.map(g=>Number(g.completeWeight.toFixed(2))),backgroundColor:'#059669',borderRadius:5},
          {label:'Pending Cutting Weight',data:ps.map(g=>Number(g.pendingCutWeight.toFixed(2))),backgroundColor:'#e11d48',borderRadius:5},
          {label:'Processing Weight (Cut + Punch)',data:ps.map(g=>Number(g.processingWeight.toFixed(2))),backgroundColor:'#2563eb',borderRadius:5}
        ]},options:{responsive:true,maintainAspectRatio:false,animation:{duration:800},interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{usePointStyle:true,padding:14}},tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${Number(c.raw||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} kg`}}},scales:{x:{ticks:{autoSkip:false,maxRotation:55,minRotation:0,font:{size:10,weight:'600'}}},y:{beginAtZero:true,title:{display:true,text:'Weight (kg)'},ticks:{callback:v=>Number(v).toLocaleString()}}}}
      });
    }
  } catch(e){ console.warn('Next PL profile metrics chart could not render:',e); }
  poBox.innerHTML=pos.length?pos.map((g,i)=>`<tr><td>${i+1}</td><td><b>${nextPlEsc(g.po)}</b></td><td>${nextPlEsc(g.profile)}</td><td class="next-pl-po-balance-weight">${g.poBalanceWeight.toFixed(2)} kg</td><td>${g.pcs.toLocaleString()}</td><td class="next-pl-weight next-pl-plan-weight">${g.weight.toFixed(2)} kg</td><td class="next-pl-pending-weight">${g.pendingWeight.toFixed(2)} kg</td></tr>`).join(''):`<tr><td colspan="7" class="next-pl-summary-empty">No PO-wise Next PL selections yet.</td></tr>`;
  const poFoot=document.getElementById('nextPlPoSummaryFoot'); if(poFoot){const tB=pos.reduce((s,g)=>s+g.poBalanceWeight,0),tP=pos.reduce((s,g)=>s+g.pcs,0),tW=pos.reduce((s,g)=>s+g.weight,0),tPend=pos.reduce((s,g)=>s+g.pendingWeight,0);poFoot.innerHTML=`<tr class="next-pl-total-row"><td colspan="3">TOTAL PO PLAN</td><td>${tB.toFixed(2)} kg</td><td>${tP.toLocaleString()} Pcs</td><td>${tW.toFixed(2)} kg</td><td>${tPend.toFixed(2)} kg</td></tr>`;}
}
function nextPlRenderPoWeightChart(rows){
  const canvas=document.getElementById('nextPlPoWeightChart');
  if(!canvas || typeof Chart==='undefined')return;
  const wrap=canvas.parentElement;
  if(wrap){const empty=wrap.querySelector('.next-pl-chart-empty');if(empty)empty.remove();canvas.style.display='block';}
  try{if(nextPlPoWeightChartInstance)nextPlPoWeightChartInstance.destroy();}catch(e){}
  const groups=new Map();
  (rows||[]).forEach(r=>{
    const poBalance=Math.max(0,nextPlNum(r.pendingQty))*Math.max(0,nextPlNum(r.unitWeight));
    const selected=Math.min(Math.max(0,nextPlNum(nextPlSelection[r.rowKey])),Math.max(0,nextPlNum(r.pendingQty)))*Math.max(0,nextPlNum(r.unitWeight));
    const pending=Math.max(0,poBalance-selected);
    const key=String(r.poNumber);
    const g=groups.get(key)||{po:r.poNumber,next:0,pending:0,total:0};
    g.next+=selected; g.pending+=pending; g.total+=poBalance; groups.set(key,g);
  });
  const data=[...groups.values()].filter(g=>g.total>0).sort((a,b)=>String(a.po).localeCompare(String(b.po),undefined,{numeric:true,sensitivity:'base'}));
  if(!data.length){
    canvas.style.display='none';
    const parent=canvas.parentElement;
    if(parent)parent.insertAdjacentHTML('beforeend','<div class="next-pl-chart-empty"><i class="fa-solid fa-chart-column"></i><b>No PO planning data yet</b><span>Use Auto Build or manually Add Pcs from the Profile + Length section.</span></div>');
    return;
  }
  nextPlPoWeightChartInstance=new Chart(canvas.getContext('2d'),{
    type:'bar',
    data:{labels:data.map(g=>String(g.po)),datasets:[
      {label:'Next PL Planning Weight',data:data.map(g=>Number(g.next.toFixed(2))),backgroundColor:'#0f766e',borderRadius:7,borderSkipped:false},
      {label:'Pending Weight After Next PL',data:data.map(g=>Number(g.pending.toFixed(2))),backgroundColor:'#e11d48',borderRadius:7,borderSkipped:false}
    ]},
    options:{responsive:true,maintainAspectRatio:false,animation:{duration:1100,easing:'easeOutQuart'},animations:{y:{duration:1100,easing:'easeOutQuart'}},interaction:{mode:'index',intersect:false},plugins:{legend:{position:'top',labels:{font:{weight:'700'},usePointStyle:true,padding:18}},tooltip:{callbacks:{label:(ctx)=>`${ctx.dataset.label}: ${Number(ctx.raw||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} kg`,afterBody:(items)=>{const i=items?.[0]?.dataIndex;return i==null?'':`Total PO Balance: ${data[i].total.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} kg`;}}}},scales:{x:{stacked:true,ticks:{autoSkip:false,maxRotation:45,minRotation:0,font:{weight:'700'}}},y:{stacked:true,beginAtZero:true,title:{display:true,text:'Weight (kg)'},ticks:{callback:(v)=>Number(v).toLocaleString()}}}}
  });
}

function renderNextPlPlanning(){
  nextPlRestorePersistedState();
  const body=document.getElementById('nextPlPlanningBody'); if(!body)return;
  const all=nextPlGetRows(); nextPlRefreshFilters(all); nextPlRenderManualControls(all); nextPlRenderQuickManual(all); nextPlRenderShipmentBalance(all);
  const rows=nextPlFilteredRows();
  const summary=nextPlGetCurrentSummary();
  const priority=document.getElementById('nextPlPriority')?.value||'oldest';
  rows.sort((a,b)=>{const da=new Date(a.date||0).getTime(),db=new Date(b.date||0).getTime();const d=priority==='newest'?db-da:da-db;return d||(priority==='newest'?String(b.poNumber).localeCompare(String(a.poNumber),undefined,{numeric:true}):String(a.poNumber).localeCompare(String(b.poNumber),undefined,{numeric:true}));});
  let selectedWeight=0,selectedPcs=0,selectedLines=0,availableWeight=0,cutWeight=0,currentPlWeight=summary.weight,pendingAfterNextWeight=0;
  const uniqueStockKeys=new Set();
  rows.forEach(r=>{
    const rowCap=Math.max(0,r.pendingQty);
    r.selectedQty=r.excluded?0:Math.min(nextPlNum(nextPlSelection[r.rowKey]),rowCap); nextPlSelection[r.rowKey]=r.selectedQty;
    r.planNeedCutQty=Math.max(0,r.selectedQty-Math.max(0,r.availableForPo));
    r.planNeedCutWeight=r.planNeedCutQty*Math.max(0,r.unitWeight);
    selectedPcs+=r.selectedQty; selectedWeight+=r.selectedQty*r.unitWeight; pendingAfterNextWeight+=Math.max(0,r.pendingQty-r.selectedQty)*Math.max(0,r.unitWeight); cutWeight+=r.planNeedCutWeight; if(r.selectedQty>0)selectedLines++;
    if(!uniqueStockKeys.has(r.key)){availableWeight+=r.stockTotal*r.unitWeight;uniqueStockKeys.add(r.key);}
  });
  const remainingMin=Math.max(0,summary.targetMin-currentPlWeight), remainingMax=Math.max(0,summary.targetMax-currentPlWeight);
  if(!rows.length)body.innerHTML='<tr><td colspan="18" style="padding:28px;text-align:center;color:#64748b;font-weight:800;">No pending PO lines with matching Master Catalog data.</td></tr>';
  else body.innerHTML=rows.map((r,i)=>`<tr class="${r.excluded?'next-pl-excluded':''}">
    <td><span style="display:inline-block;min-width:25px;padding:3px 6px;border-radius:999px;background:${i<3?'#dcfce7':'#f1f5f9'};color:${i<3?'#047857':'#475569'};font-weight:900;">${i+1}</span></td>
    <td>${nextPlEsc(r.date||'-')}</td><td><b>${nextPlEsc(r.poNumber)}</b></td><td><b>${nextPlEsc(r.profile)}</b></td><td>${nextPlEsc(r.itemCode||'-')}</td><td>${nextPlEsc(r.length)} mm</td>
    <td>${r.unitWeight.toFixed(4)} kg</td><td class="next-pl-pending"><b>${r.pendingQty.toLocaleString()}</b> <small style="display:block;color:#be123c;font-weight:800;">${r.remainingPoWeight.toFixed(2)} kg</small></td><td>${r.currentPlQty.toLocaleString()} <small style="display:block;color:#047857;font-weight:800;">${r.currentPlWeight.toFixed(2)} kg</small></td><td>${r.stockTotal.toLocaleString()} <small style="display:block;color:#0f766e;font-weight:800;">${(r.stockTotal*r.unitWeight).toFixed(2)} kg</small></td><td>${r.stockReady.toLocaleString()} <small style="display:block;color:#0f766e;font-weight:800;">${(r.stockReady*r.unitWeight).toFixed(2)} kg</small></td><td>${r.stockWip.toLocaleString()} <small style="display:block;color:#b45309;font-weight:800;">${(r.stockWip*r.unitWeight).toFixed(2)} kg</small></td><td class="next-pl-available"><b>${r.availableForPo.toLocaleString()}</b> <small style="display:block;color:#047857;font-weight:800;">${(r.availableForPo*r.unitWeight).toFixed(2)} kg</small></td><td><input class="next-pl-select-input ${nextPlManualOverride[r.rowKey]?'manual':''}" type="number" min="0" max="${Math.floor(r.pendingQty)}" step="1" value="${Math.floor(r.selectedQty)}" ${r.excluded?'disabled':''} title="Click and edit Next PL Select Pcs. Maximum: shipment balance ${Math.floor(r.pendingQty).toLocaleString()} Pcs." onclick="this.select()" onfocus="this.select()" onchange="nextPlSetQty('${nextPlEsc(r.rowKey)}',this.value)"></td><td class="next-pl-weight"><b>${(r.selectedQty*r.unitWeight).toFixed(2)} kg</b></td><td class="next-pl-pending-cut"><b>${r.planNeedCutQty.toLocaleString()}</b><small style="display:block;color:#be123c;font-weight:800;">pending cut</small></td><td>${r.planNeedCutWeight.toFixed(2)} kg</td><td><label class="next-pl-skip"><input type="checkbox" ${r.excluded?'checked':''} onchange="nextPlToggleExclude('${nextPlEsc(r.rowKey)}',this.checked)"> Skip</label>${nextPlManualOverride[r.rowKey]?'<div class="next-pl-manual-badge">Manual / Cut</div>':''}</td>
  </tr>`).join('');
  const totalBalanceWeight=rows.reduce((s,r)=>s+Math.max(0,r.remainingPoWeight),0);
  const totalCurrentPlWeight=rows.reduce((s,r)=>s+Math.max(0,r.currentPlWeight),0);
  const totalStockWeight=rows.reduce((s,r)=>s+Math.max(0,r.stockTotal)*Math.max(0,r.unitWeight),0);
  const totalReadyWeight=rows.reduce((s,r)=>s+Math.max(0,r.stockReady)*Math.max(0,r.unitWeight),0);
  const totalWipWeight=rows.reduce((s,r)=>s+Math.max(0,r.stockWip)*Math.max(0,r.unitWeight),0);
  const totalAvailableWeight=rows.reduce((s,r)=>s+Math.max(0,r.availableForPo)*Math.max(0,r.unitWeight),0);
  const totalNeedCutWeight=rows.reduce((s,r)=>s+Math.max(0,r.planNeedCutWeight||0),0);
  const totalSelectedPcs=rows.reduce((s,r)=>s+Math.max(0,r.selectedQty),0);
  const totalSelectedWeight=rows.reduce((s,r)=>s+Math.max(0,r.selectedQty)*Math.max(0,r.unitWeight),0);
  const mainFoot=document.getElementById('nextPlPlanningFoot');
  const totalBalancePcs=rows.reduce((s,r)=>s+Math.max(0,r.pendingQty),0), totalCurrentPlPcs=rows.reduce((s,r)=>s+Math.max(0,r.currentPlQty),0), totalStockPcs=rows.reduce((s,r)=>s+Math.max(0,r.stockTotal),0), totalReadyPcs=rows.reduce((s,r)=>s+Math.max(0,r.stockReady),0), totalWipPcs=rows.reduce((s,r)=>s+Math.max(0,r.stockWip),0), totalAvailablePcs=rows.reduce((s,r)=>s+Math.max(0,r.availableForPo),0), totalNeedCutPcs=rows.reduce((s,r)=>s+Math.max(0,r.planNeedCutQty||0),0);
  if(mainFoot)mainFoot.innerHTML=`<tr class="next-pl-total-row"><td colspan="7">TOTAL — VISIBLE PO LINES</td><td><b>${totalBalancePcs.toLocaleString()} Pcs</b><small>${totalBalanceWeight.toFixed(2)} kg</small></td><td><b>${totalCurrentPlPcs.toLocaleString()} Pcs</b><small>${totalCurrentPlWeight.toFixed(2)} kg</small></td><td><b>${totalStockPcs.toLocaleString()} Pcs</b><small>${totalStockWeight.toFixed(2)} kg</small></td><td><b>${totalReadyPcs.toLocaleString()} Pcs</b><small>${totalReadyWeight.toFixed(2)} kg</small></td><td><b>${totalWipPcs.toLocaleString()} Pcs</b><small>${totalWipWeight.toFixed(2)} kg</small></td><td><b>${totalAvailablePcs.toLocaleString()} Pcs</b><small>${totalAvailableWeight.toFixed(2)} kg</small></td><td><b>${totalSelectedPcs.toLocaleString()} Pcs</b></td><td><b>${totalSelectedWeight.toFixed(2)} kg</b></td><td><b>${totalNeedCutPcs.toLocaleString()} Pcs</b></td><td><b>${totalNeedCutWeight.toFixed(2)} kg</b></td><td>-</td></tr>`;
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('nextPlCurrentPLWeight',`${currentPlWeight.toFixed(2)} kg`); set('nextPlCurrentPLPcs',`${summary.pcs.toLocaleString()} Pcs`); set('nextPlRemainingMin',`${remainingMin.toFixed(2)} kg`); set('nextPlRemainingMax',`${remainingMax.toFixed(2)} kg`);
  set('nextPlSelectedWeight',`${selectedWeight.toFixed(2)} kg`); set('nextPlTotalNextWeight',`${(currentPlWeight+selectedWeight).toFixed(2)} kg`); set('nextPlPendingAfterNextWeight',`${pendingAfterNextWeight.toFixed(2)} kg`); set('nextPlSelectedPcs',selectedPcs.toLocaleString()); set('nextPlSelectedLines',`${selectedLines} selected lines`); set('nextPlAvailableWeight',`${availableWeight.toFixed(2)} kg`); set('nextPlToMin',`${Math.max(0,remainingMin-selectedWeight).toFixed(2)} kg`); set('nextPlToMax',`${Math.max(0,remainingMax-selectedWeight).toFixed(2)} kg`); set('nextPlNeedCutWeight',`${cutWeight.toFixed(2)} kg`);
  nextPlRenderProfileSummary(all);
  nextPlRenderPoWeightChart(all);
  const totalPlPlusSelection=currentPlWeight+selectedWeight;
  const targetTotal=summary.targetTotal;
  const targetProfiles=[...new Set(rows.filter(r=>r.selectedQty>0).map(r=>String(r.profile||'').trim()).filter(Boolean))];
  const targetProfileText=targetProfiles.length?targetProfiles.join(', '):'—';
  const status=document.getElementById('nextPlTargetStatus'), alert=document.getElementById('nextPlAlert');
  if(status){
    const delta=targetTotal-totalPlPlusSelection;
    status.textContent=Math.abs(delta)<0.01?'TARGET READY':delta<0?'OVER TARGET':`Need ${delta.toFixed(2)} kg more`;
    status.style.color=Math.abs(delta)<0.01?'#047857':delta<0?'#be123c':'#b45309';
  }
  if(alert){
    const active=`${summary.container||'Current PL'} • ${currentPlWeight.toFixed(2)} kg already planned`;
    if(totalPlPlusSelection>19000 || targetTotal>19000)alert.innerHTML=`<div style="background:#fff1f2;border:1px solid #fda4af;color:#be123c;"><i class="fa-solid fa-triangle-exclamation"></i> <b>WARNING — Next PL is over 19 tons:</b> ${totalPlPlusSelection.toFixed(2)} kg total (${(totalPlPlusSelection/1000).toFixed(2)} T). Please reduce the planned Pcs or target weight before finalizing the Packing List.</div>`;
    else if(Math.abs(totalPlPlusSelection-targetTotal)<0.01)alert.innerHTML=`<div style="background:#ecfdf5;border:1px solid #a7f3d0;color:#047857;"><i class="fa-solid fa-circle-check"></i> <b>Next PL target ready:</b> ${totalPlPlusSelection.toFixed(2)} kg total (${currentPlWeight.toFixed(2)} kg existing + ${selectedWeight.toFixed(2)} kg new). <b>Profiles: ${nextPlEsc(targetProfileText)}</b>.</div>`;
    else if(totalPlPlusSelection>summary.targetMax)alert.innerHTML=`<div style="background:#fff1f2;border:1px solid #fecdd3;color:#be123c;"><i class="fa-solid fa-triangle-exclamation"></i> <b>Over maximum:</b> reduce ${(totalPlPlusSelection-summary.targetMax).toFixed(2)} kg. ${active}.</div>`;
    else alert.innerHTML=`<div style="background:#fffbeb;border:1px solid #fde68a;color:#92400e;"><i class="fa-solid fa-circle-info"></i> <b>${active}.</b> Select another ${Math.max(0,targetTotal-totalPlPlusSelection).toFixed(2)} kg to reach the manual target of ${targetTotal.toLocaleString()} kg. <b>Current target profiles: ${nextPlEsc(targetProfileText)}</b>.</div>`;
  }
  nextPlSchedulePersist();
}
function nextPlAutoBuild(){
  const summary=nextPlGetCurrentSummary();
  // Next PL V3: shipment-balance-first. The selected quantity for a PO/Profile/Length
  // is the full remaining shipment balance whenever it fits the target. Current
  // stock does NOT reduce the planned shipment quantity; it only determines how
  // many pieces still need to be cut. If the final line cannot fully fit the target,
  // only that final line is partially selected and can be manually edited.
  let rows=nextPlGetRows().filter(r=>!r.excluded && r.pendingQty>0);
  const poFilter=document.getElementById('nextPlPoFilter')?.value||'';
  const profileFilter=document.getElementById('nextPlProfileFilter')?.value||'';
  const lengthFilter=document.getElementById('nextPlLengthFilter')?.value||'';
  rows=rows.filter(r=>(!poFilter||r.poNumber===poFilter)&&(!profileFilter||nextPlSameProfile(r.profile,profileFilter))&&(!lengthFilter||cleanLen(r.length)===cleanLen(lengthFilter)));
  const priority=document.getElementById('nextPlPriority')?.value||'oldest';
  rows.sort((a,b)=>{const da=new Date(a.date||0).getTime(),db=new Date(b.date||0).getTime();const d=priority==='newest'?db-da:da-db;return d||(priority==='newest'?String(b.poNumber).localeCompare(String(a.poNumber),undefined,{numeric:true}):String(a.poNumber).localeCompare(String(b.poNumber),undefined,{numeric:true}));});
  nextPlSelection={}; nextPlManualOverride={};
  const targetTotal=Math.max(0,nextPlNum(summary.targetTotal));
  const targetNew=Math.max(0,targetTotal-summary.weight);
  let total=0, partial=false;
  if(targetTotal>19000)showToast(`Target is ${(targetTotal/1000).toFixed(2)}T, which is above the 19T warning limit. Warning will remain visible.`,'warning');
  for(const r of rows){
    if(total>=targetNew || r.unitWeight<=0)break;
    const balance=Math.max(0,Math.floor(r.pendingQty));
    const fullWeight=balance*r.unitWeight;
    const room=Math.max(0,targetNew-total);
    let qty=balance;
    if(fullWeight>room){
      qty=Math.min(balance,Math.floor(room/r.unitWeight));
      partial=true;
    }
    if(qty<=0)continue;
    nextPlSelection[r.rowKey]=qty;
    // Manual override means the planner is allowed to edit the final quantity;
    // stock availability never caps the selection.
    nextPlManualOverride[r.rowKey]=qty<balance;
    total+=qty*r.unitWeight;
    if(partial)break;
  }
  nextPlSchedulePersist();
  renderNextPlPlanning();
  const grand=summary.weight+total;
  const diff=targetTotal-grand;
  showToast(Math.abs(diff)<0.01?`Shipment-balance-first plan matched ${grand.toFixed(2)} kg target.`:`Plan built ${grand.toFixed(2)} kg; ${Math.abs(diff).toFixed(2)} kg ${diff>0?'still needed':'over target'}.`,Math.abs(diff)<0.01?'success':'warning');
}

function nextPlClearSelection(){nextPlSelection={};nextPlExcluded={};nextPlManualOverride={};nextPlSchedulePersist();renderNextPlPlanning();showToast('Temporary planning selection cleared.','success');}
function nextPlExportExcel(){
  const summary=nextPlGetCurrentSummary(); const rows=nextPlFilteredRows().filter(r=>nextPlNum(nextPlSelection[r.rowKey])>0);
  if(!rows.length)return showToast('No selected planning lines to export.','warning');
  if(typeof XLSX==='undefined'||!XLSX.utils||!XLSX.writeFile)return showToast('Excel export library is not loaded.','error');
  const out=rows.map((r,i)=>({Priority:i+1,'PO Date':r.date,'PO Number':r.poNumber,Profile:r.profile,'Item Code':r.itemCode,Length:r.length,'Unit Weight (kg)':r.unitWeight,'Original PO Pending (Pcs)':r.originalPendingQty,'Already in Current PL (Pcs)':r.currentPlQty,'Remaining PO Qty (Pcs)':r.pendingQty,'Current Stock (Pcs)':r.stockTotal,'Need Cut (Pcs)':r.needCutQty,'Need Cut Weight (kg)':r.needCutWeight,'Selected Pcs':nextPlNum(nextPlSelection[r.rowKey]),'Selected Weight (kg)':nextPlNum(nextPlSelection[r.rowKey])*r.unitWeight}));
  out.push({'PO Date':'','PO Number':'TOTAL CURRENT PL','Profile':'','Item Code':'','Length':'','Unit Weight (kg)':'','Original PO Pending (Pcs)':'','Already in Current PL (Pcs)':summary.pcs,'Remaining PO Qty (Pcs)':'','Current Stock (Pcs)':'','Need Cut (Pcs)':'','Need Cut Weight (kg)':'','Selected Pcs':rows.reduce((s,r)=>s+nextPlNum(nextPlSelection[r.rowKey]),0),'Selected Weight (kg)':rows.reduce((s,r)=>s+nextPlNum(nextPlSelection[r.rowKey])*r.unitWeight,0)+summary.weight});
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(out),'Next PL Plan');XLSX.writeFile(wb,`AIS_Next_PL_15-19T_Plan_${new Date().toISOString().slice(0,10)}.xlsx`);showToast('Next PL planning Excel downloaded.','success');
}
function nextPlExportPdf(){
  const summary=nextPlGetCurrentSummary();
  const rows=nextPlFilteredRows().filter(r=>nextPlNum(nextPlSelection[r.rowKey])>0);
  if(!rows.length){ showToast('No selected planning lines to export.','warning'); return; }
  const data=rows.map((r,i)=>({
    'Priority':i+1,
    'PO Date':r.date,
    'PO Number':r.poNumber,
    'Profile':r.profile,
    'Item Code':r.itemCode,
    'Length':`${r.length} mm`,
    'Unit Wt (kg)':r.unitWeight.toFixed(4),
    'Shipment Balance (Pcs)':r.pendingQty,
    'Current Stock (Pcs)':r.stockTotal,
    'Next PL Select (Pcs)':nextPlNum(nextPlSelection[r.rowKey]),
    'Next PL Weight (kg)':(nextPlNum(nextPlSelection[r.rowKey])*r.unitWeight).toFixed(2),
    'Pending Cut (Pcs)':r.needCutQty,
    'Pending Cut Weight (kg)':r.needCutWeight.toFixed(2)
  }));
  data.push({
    'Priority':'', 'PO Date':'', 'PO Number':'TOTAL', 'Profile':'', 'Item Code':'', 'Length':'',
    'Unit Wt (kg)':'', 'Shipment Balance (Pcs)':rows.reduce((s,r)=>s+Math.max(0,r.pendingQty),0),
    'Current Stock (Pcs)':rows.reduce((s,r)=>s+Math.max(0,r.stockTotal),0),
    'Next PL Select (Pcs)':rows.reduce((s,r)=>s+nextPlNum(nextPlSelection[r.rowKey]),0),
    'Next PL Weight (kg)':rows.reduce((s,r)=>s+nextPlNum(nextPlSelection[r.rowKey])*r.unitWeight,0).toFixed(2),
    'Pending Cut (Pcs)':rows.reduce((s,r)=>s+Math.max(0,r.needCutQty),0),
    'Pending Cut Weight (kg)':rows.reduce((s,r)=>s+Math.max(0,r.needCutWeight),0).toFixed(2)
  });
  exportDataToPdf(data,'AIS_Next_PL_15-19T_Plan','AIS Tracker - Next PL 15–19T Planning',`Current PL: ${summary.weight.toFixed(2)} kg • Target: ${summary.targetMin.toLocaleString()}–${summary.targetMax.toLocaleString()} kg • Filtered planning lines`);
}

function nextPlPrint(){
  const summary=nextPlGetCurrentSummary(); const rows=nextPlFilteredRows().filter(r=>nextPlNum(nextPlSelection[r.rowKey])>0); if(!rows.length)return showToast('No selected planning lines to print.','warning');
  const totalNew=rows.reduce((s,r)=>s+nextPlNum(nextPlSelection[r.rowKey])*r.unitWeight,0),grand=summary.weight+totalNew;
  const w=window.open('','_blank','width=1300,height=850');if(!w)return;
  w.document.write(`<html><head><title>AIS Next PL Plan</title><style>body{font-family:Arial,sans-serif;padding:20px;color:#0f172a}h2{margin:0 0 4px;color:#075985}p{color:#475569;font-size:12px}.kpi{display:inline-block;margin:3px 12px 3px 0;padding:7px 10px;border:1px solid #cbd5e1;border-radius:6px}table{width:100%;border-collapse:collapse;margin-top:15px;font-size:10px}th,td{border:1px solid #cbd5e1;padding:5px;text-align:center}th{background:#075985;color:#fff}tfoot td{font-weight:900;background:#f1f5f9}</style></head><body><h2>AIS Tracker • Next PL 15–19T Planning</h2><p><span class="kpi">Current PL: <b>${summary.weight.toFixed(2)} kg</b></span><span class="kpi">New Selection: <b>${totalNew.toFixed(2)} kg</b></span><span class="kpi">Total Planned: <b>${grand.toFixed(2)} kg</b></span><span class="kpi">Target: <b>${summary.targetMin.toLocaleString()}–${summary.targetMax.toLocaleString()} kg</b></span></p><table><thead><tr><th>Priority</th><th>PO</th><th>Profile</th><th>Item Code</th><th>Length</th><th>Remaining PO</th><th>Stock</th><th>Need Cut</th><th>Select Pcs</th><th>Unit Wt</th><th>Weight</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${i+1}</td><td>${nextPlEsc(r.poNumber)}</td><td>${nextPlEsc(r.profile)}</td><td>${nextPlEsc(r.itemCode)}</td><td>${nextPlEsc(r.length)} mm</td><td>${r.pendingQty.toLocaleString()}</td><td>${r.stockTotal.toLocaleString()}</td><td>${r.needCutQty.toLocaleString()}</td><td>${nextPlNum(nextPlSelection[r.rowKey]).toLocaleString()}</td><td>${r.unitWeight.toFixed(4)}</td><td>${(nextPlNum(nextPlSelection[r.rowKey])*r.unitWeight).toFixed(2)}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="10">CURRENT + NEW TOTAL WEIGHT</td><td>${grand.toFixed(2)} kg</td></tr></tfoot></table><script>window.onload=()=>window.print();</script></body></html>`);w.document.close();
}

function switchTab(tabId, btn) {
  setDashboardNavPlacement(tabId);
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active')); 
  document.querySelectorAll('#mainNavTabs .tab-btn').forEach(el => el.classList.remove('active')); 
  document.getElementById(tabId).classList.add('active'); 
  if(btn && btn.classList.contains('tab-btn')) btn.classList.add('active');
  activateNavCategoryForTab(tabId, btn);
  
  setTimeout(() => {
      if (tabId === 'dashboardTab') renderDashboard(); 
      if (tabId === 'balanceWorkTab') renderBalanceWorkTable(); 
      if (tabId === 'nextPlPlanningTab') renderNextPlPlanning(); 
      if (tabId === 'cardboardTab') renderCardboardStock(); 
      if (tabId === 'historyTab') renderHistoryData(); 
      if (tabId === 'masterListTab') renderMasterCatalog(); 
      if (tabId === 'poManagementTab') { updatePoFilters(); renderPoDetailsTable(); renderPoCharts(); } 
      if (tabId === 'shipmentTab') { populateShipmentPoDropdown(); window.renderShipmentHistoryTable(); } 
      if (tabId === 'packingListTab') { selectLatestPackingList(); populatePlPoDropdown(); renderPackingListTable(); } 
      if (tabId === 'dailyPlanTab') renderDailyInstructions();      if (tabId === 'smartDailyPlanTab') renderSmartDailyPlan(); 
      if (tabId === 'rejectTrackerTab') { populateRejProfile(); renderRejectTable(); populateRecProfile(); renderRecoverTable(); }
  }, 10);
}

function switchRejectSubTab(tabId, btn) { document.querySelectorAll('.reject-sub-tab-content').forEach(el => el.style.display = 'none'); document.querySelectorAll('.reject-sub-tab-btn').forEach(el => el.classList.remove('active')); if(document.getElementById(tabId)) document.getElementById(tabId).style.display = 'block'; if(btn) btn.classList.add('active'); if(tabId === 'rejectEntrySubTab') { populateRejProfile(); renderRejectTable(); } else { populateRecProfile(); renderRecoverTable(); showRecAvailable(); } }
function populateRejProfile() { const sel = document.getElementById('rejProfile'); if(!sel) return; sel.innerHTML = '<option value="">-- Choose Profile --</option>'; [...new Set(masterData.map(i => String(i.profile).trim()))].forEach(p => sel.appendChild(new Option(p, p))); }
function onRejProfileSelect() { const p = document.getElementById('rejProfile').value; const sel = document.getElementById('rejItemCode'); sel.innerHTML = '<option value="">-- Choose Item Code --</option>'; document.getElementById('rejLength').innerHTML = '<option value="">-- Choose Length --</option>'; document.getElementById('rejWeight').value=''; if(!p) return; const items = masterData.filter(m => String(m.profile).trim() === p && m.itemCode); [...new Set(items.map(m => m.itemCode))].forEach(ic => sel.appendChild(new Option(ic, ic))); }
function onRejItemCodeSelect() { const p = document.getElementById('rejProfile').value; const ic = document.getElementById('rejItemCode').value; const sel = document.getElementById('rejLength'); sel.innerHTML = '<option value="">-- Choose Length --</option>'; document.getElementById('rejWeight').value=''; if(!p || !ic) return; const matches = masterData.filter(m => String(m.profile).trim() === p && m.itemCode === ic); matches.forEach(m => sel.appendChild(new Option(`${m.length} mm`, m.length))); if(matches.length === 1) { sel.value = matches[0].length; calcRejWeight(); } }
function calcRejWeight() { const p = document.getElementById('rejProfile') ? document.getElementById('rejProfile').value : null; const ic = document.getElementById('rejItemCode') ? document.getElementById('rejItemCode').value : null; const l = document.getElementById('rejLength') ? document.getElementById('rejLength').value : null; const pcs = parseInt(document.getElementById('rejPcs').value)||0; if(!p || !ic || !l || pcs<=0) { if(document.getElementById('rejWeight')) document.getElementById('rejWeight').value=''; return; } const matched = masterData.find(m => String(m.profile).trim()===p && m.itemCode===ic && cleanLen(m.length)===cleanLen(l)); if(matched && document.getElementById('rejWeight')) { document.getElementById('rejWeight').value = (pcs * (matched.unitWeight || 0)).toFixed(2); } }
function getRejectUpstreamStage(stage, profile, length) {
  const stg=String(stage||'').toLowerCase();
  if(stg.includes('punch')) return 'Cut';
  if(stg.includes('wrap')) {
    // Profiles that bypass Punching go directly Cut -> Wrapping,
    // so a Wrapping reject must reduce Cut stock for those profiles.
    return (typeof isPunchBypassed === 'function' && isPunchBypassed(profile,length)) ? 'Cut' : 'Punch';
  }
  return null;
}

async function saveRejectEntry() {
  if(isAppBusy) return; isAppBusy=true;
  try {
    if (currentUserRole !== 'Admin' && currentUserRole !== 'Planner') return;
    const d=document.getElementById('rejDate').value, sh=document.getElementById('rejShift')?.value||'', tm=document.getElementById('rejTeam')?.value||'', loc=document.getElementById('rejLoc')?.value||'', stg=document.getElementById('rejStage')?.value||'', p=document.getElementById('rejProfile').value, ic=document.getElementById('rejItemCode').value, l=cleanLen(document.getElementById('rejLength').value), pcs=parseInt(document.getElementById('rejPcs').value)||0;
    if(!d||!p||!ic||!l||pcs<=0) return showToast('Please complete all Reject fields.','warning');
    const matched=masterData.find(m=>String(m.profile).trim()===p && String(m.itemCode).trim()===ic && cleanLen(m.length)===l);
    if(!matched) return showToast('Selected profile/length is not in Master Catalog.','error');

    const wt=parseFloat((pcs*(matched.unitWeight||0)).toFixed(2));
    const upstreamStage=getRejectUpstreamStage(stg,p,l);
    if(!upstreamStage) return showToast('Please select Punching or Wrapping reject stage.','warning');

    const currentUpstream=upstreamStage==='Cut' ? Number(matched.cutQty)||0 : Number(matched.punchQty)||0;
    if(pcs>currentUpstream){
      return showToast(`${stg} Reject cannot be saved. ${upstreamStage} Stage has only ${currentUpstream.toLocaleString()} Pcs available; you entered ${pcs.toLocaleString()} Pcs.`,'error');
    }

    const nextCut=upstreamStage==='Cut' ? currentUpstream-pcs : Number(matched.cutQty)||0;
    const nextPunch=upstreamStage==='Punch' ? currentUpstream-pcs : Number(matched.punchQty)||0;
    const entry={reject_date:d,shift:sh,team:tm,location:loc,stage:stg,profile:p,item_code:ic,length:l,pcs,weight:wt};
    let stockChanged=false;
    try {
      if(!matched.db_id) throw new Error('Selected Master Catalog row is not linked to Supabase. Reject cannot be saved safely.');
      const {error:stockError}=await supabaseClient.from('master_catalog').update({cut_qty:nextCut,punch_qty:nextPunch}).eq('id',matched.db_id);
      if(stockError) throw new Error(`Reject stock update failed: ${stockError.message}`);
      stockChanged=true;
      const {error:insertError}=await supabaseClient.from('reject_logs').insert([entry]);
      if(insertError) throw new Error(`Reject save failed: ${insertError.message}`);
    } catch(err){
      if(stockChanged && matched.db_id){
        try{ await supabaseClient.from('master_catalog').update({cut_qty:matched.cutQty,punch_qty:matched.punchQty}).eq('id',matched.db_id); }
        catch(rb){ console.error('Reject stock rollback failed:',rb); }
      }
      throw err;
    }

    const previousCut=Number(matched.cutQty)||0;
    const previousPunch=Number(matched.punchQty)||0;
    matched.cutQty=nextCut; matched.punchQty=nextPunch;
    aisRegisterUndo(`Reject Entry • ${p} / ${l} • ${pcs} Pcs`,async()=>{
      await aisDeleteLatest('reject_logs',{reject_date:entry.reject_date,shift:entry.shift,team:entry.team,location:entry.location,stage:entry.stage,profile:entry.profile,item_code:entry.item_code,length:entry.length,pcs:entry.pcs,weight:entry.weight});
      if(matched.db_id) await aisUpdateById('master_catalog',matched.db_id,{cut_qty:previousCut,punch_qty:previousPunch});
    },'rejectTrackerTab');

    rejectLogs.unshift({...entry,id:-Date.now()});
    renderRejectTable(); renderDashboard(); renderProfileSummaryTable(); renderBalanceWorkTable();
    showToast(`${stg} Reject saved. ${upstreamStage} Stage reduced by ${pcs.toLocaleString()} Pcs.`,'success');
    document.getElementById('rejectEntryForm').reset(); document.getElementById('rejDate').value=d; document.getElementById('rejShift').value=sh; document.getElementById('rejTeam').value=tm; document.getElementById('rejLoc').value=loc; ['rejDate','rejShift','rejTeam','rejLoc'].forEach(id=>{const el=document.getElementById(id);if(el)setAISFormState(id,el.value);});
  } catch(e){ console.error(e); showToast(e.message||'Reject save failed.','error'); } finally { isAppBusy=false; }
}
function renderRejectTable() {
  try {
    const subTab = document.getElementById('rejectEntrySubTab');
    let filterDiv = document.getElementById('rejectFilterContainer');
    if (!filterDiv && subTab) {
      filterDiv = document.createElement('div');
      filterDiv.id = 'rejectFilterContainer';
      filterDiv.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:12px;background:rgba(16,185,129,.05);padding:15px;border-radius:8px;margin-bottom:15px;border:1px dashed var(--emerald-border);">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;align-items:end;">
            <div><label for="rejectMonthFilter" style="display:block;font-weight:800;margin-bottom:6px;color:var(--primary-dark);"><i class="fa-solid fa-calendar-days"></i> 1. Filter by Month</label><input type="month" id="rejectMonthFilter" onchange="renderRejectTable()" style="padding:8px 12px;border-radius:6px;border:1px solid var(--accent-color);font-weight:700;"></div>
            <div><label for="rejectProfileFilter" style="display:block;font-weight:800;margin-bottom:6px;color:var(--primary-dark);">2. Filter by Profile</label><select id="rejectProfileFilter" onchange="renderRejectTable()" style="padding:8px 12px;border-radius:6px;border:1px solid var(--accent-color);font-weight:700;width:100%;"><option value="">All Profiles</option></select></div>
            <div><label for="rejectItemCodeFilter" style="display:block;font-weight:800;margin-bottom:6px;color:var(--primary-dark);">3. Filter by Item Code</label><select id="rejectItemCodeFilter" onchange="renderRejectTable()" style="padding:8px 12px;border-radius:6px;border:1px solid var(--accent-color);font-weight:700;width:100%;"><option value="">All Item Codes</option></select></div>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;font-weight:800;font-size:13px;">
            <div style="background:#dbeafe;color:#075985;padding:9px 14px;border-radius:7px;">Total Rejected Pcs: <span id="rejSumPcs">0</span> Pcs</div>
            <div style="background:#fef3c7;color:#92400e;padding:9px 14px;border-radius:7px;"><i class="fa-solid fa-industry"></i> Plant Reject Pcs: <span id="rejSumPlantPcs">0</span> Pcs</div>
            <div style="background:#ede9fe;color:#5b21b6;padding:9px 14px;border-radius:7px;"><i class="fa-solid fa-location-dot"></i> Other Reject Pcs: <span id="rejSumOtherPcs">0</span> Pcs</div>
            <div style="background:#fee2e2;color:#9f1239;padding:9px 14px;border-radius:7px;"><i class="fa-solid fa-dumpster"></i> Rejected Weight: <span id="rejSumTotal">0.00</span> kg</div>
            <div style="background:#ecfdf5;color:#065f46;padding:9px 14px;border-radius:7px;">Records: <span id="rejSumRecords">0</span></div>
            <button type="button" class="btn btn-secondary" onclick="clearRejectFilters()" style="padding:8px 13px;"><i class="fa-solid fa-filter-circle-xmark"></i> Clear Filters</button>
          </div>
        </div>`;
      const tableContainer = subTab.querySelector('.table-container');
      if (tableContainer) subTab.insertBefore(filterDiv, tableContainer);
      else subTab.appendChild(filterDiv);
      const now = new Date();
      const monthInput = document.getElementById('rejectMonthFilter');
      if (monthInput) monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    const monthVal = document.getElementById('rejectMonthFilter')?.value || '';
    const profileSelect = document.getElementById('rejectProfileFilter');
    const itemSelect = document.getElementById('rejectItemCodeFilter');
    const oldProfile = profileSelect?.value || '';
    const oldItem = itemSelect?.value || '';

    const monthLogs = monthVal
      ? rejectLogs.filter(r => String(r.reject_date || '').startsWith(monthVal))
      : rejectLogs.slice();

    const profiles = [...new Set(monthLogs.map(r => String(r.profile || '').trim()).filter(Boolean))]
      .sort((a,b) => a.localeCompare(b, undefined, {numeric:true, sensitivity:'base'}));
    if (profileSelect) {
      profileSelect.innerHTML = '<option value="">All Profiles</option>' +
        profiles.map(p => `<option value="${String(p).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}">${String(p).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</option>`).join('');
      if (profiles.includes(oldProfile)) profileSelect.value = oldProfile;
    }
    const chosenProfile = profileSelect?.value || '';
    const profileLogs = chosenProfile ? monthLogs.filter(r => String(r.profile || '').trim() === chosenProfile) : monthLogs;
    const itemCodes = [...new Set(profileLogs.map(r => String(r.item_code || '').trim()).filter(Boolean))]
      .sort((a,b) => a.localeCompare(b, undefined, {numeric:true, sensitivity:'base'}));
    if (itemSelect) {
      itemSelect.innerHTML = '<option value="">All Item Codes</option>' +
        itemCodes.map(ic => `<option value="${String(ic).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}">${String(ic).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</option>`).join('');
      if (itemCodes.includes(oldItem)) itemSelect.value = oldItem;
    }
    const chosenItem = itemSelect?.value || '';

    let filteredLogs = profileLogs;
    if (chosenItem) filteredLogs = filteredLogs.filter(r => String(r.item_code || '').trim() === chosenItem);

    const totalPcs = filteredLogs.reduce((sum, r) => sum + (Number(r.pcs) || 0), 0);
    const plantRejectPcs = filteredLogs
      .filter(r => String(r.location || '').trim().toLowerCase() === 'plant')
      .reduce((sum, r) => sum + (Number(r.pcs) || 0), 0);
    const otherRejectPcs = filteredLogs
      .filter(r => String(r.location || '').trim().toLowerCase() === 'other')
      .reduce((sum, r) => sum + (Number(r.pcs) || 0), 0);
    const totalWeight = filteredLogs.reduce((sum, r) => sum + (Number(r.weight) || 0), 0);
    const pcsEl = document.getElementById('rejSumPcs');
    const plantPcsEl = document.getElementById('rejSumPlantPcs');
    const otherPcsEl = document.getElementById('rejSumOtherPcs');
    const weightEl = document.getElementById('rejSumTotal');
    const recordsEl = document.getElementById('rejSumRecords');
    if (pcsEl) pcsEl.textContent = totalPcs.toLocaleString();
    if (plantPcsEl) plantPcsEl.textContent = plantRejectPcs.toLocaleString();
    if (otherPcsEl) otherPcsEl.textContent = otherRejectPcs.toLocaleString();
    if (weightEl) weightEl.textContent = totalWeight.toFixed(2);
    if (recordsEl) recordsEl.textContent = filteredLogs.length.toLocaleString();

    const tb = document.getElementById('rejectTableBody');
    if (!tb) return;
    let tableHtml = '';
    if (!filteredLogs.length) {
      tableHtml = '<tr><td colspan="10" style="text-align:center;padding:22px;">No Reject Records Found for the selected filters.</td></tr>';
    } else {
      filteredLogs.forEach(r => {
        const esc = v => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        tableHtml += `<tr><td>${esc(r.reject_date)}</td><td>${esc(r.shift)}</td><td>${esc(r.location)}</td><td>${esc(r.stage)}</td><td><b>${esc(r.profile)}</b></td><td>${esc(r.item_code)}</td><td>${esc(r.length)}</td><td>${(Number(r.pcs)||0).toLocaleString()}</td><td>${(Number(r.weight)||0).toFixed(2)} kg</td><td>${currentUserRole === 'Admin' ? `<button class="btn btn-danger" onclick="deleteRejectItem(${Number(r.id)})" aria-label="Delete reject record"><i class="fa-solid fa-trash"></i></button>` : '<i class="fa-solid fa-lock"></i>'}</td></tr>`;
      });
    }
    tb.innerHTML = tableHtml;
  } catch(e) {
    console.error('Reject Tracker filter rendering failed:', e);
  }
}
window.clearRejectFilters = function() {
  const month = document.getElementById('rejectMonthFilter');
  const profile = document.getElementById('rejectProfileFilter');
  const item = document.getElementById('rejectItemCodeFilter');
  if (month) month.value = '';
  if (profile) profile.value = '';
  if (item) item.value = '';
  renderRejectTable();
};
window.deleteRejectItem = function(id) { if(currentUserRole !== 'Admin') return; showConfirm("Delete this Reject record?", async () => {
  const row=rejectLogs.find(r=>Number(r.id)===Number(id)); if(!row) return;
  try {
    const matched=masterData.find(m=>recKey(m.profile)===recKey(row.profile)&&recKey(m.itemCode)===recKey(row.item_code)&&cleanLen(m.length)===cleanLen(row.length));
    const upstreamStage=getRejectUpstreamStage(row.stage,row.profile,row.length);
    if(!upstreamStage || !matched || !matched.db_id) throw new Error('Matching Master Catalog stock row was not found. Delete cancelled.');

    const previous={cutQty:Number(matched.cutQty)||0,punchQty:Number(matched.punchQty)||0};
    const qty=Number(row.pcs)||0;
    const nextCut=upstreamStage==='Cut' ? previous.cutQty+qty : previous.cutQty;
    const nextPunch=upstreamStage==='Punch' ? previous.punchQty+qty : previous.punchQty;

    const {error:stockError}=await supabaseClient.from('master_catalog').update({cut_qty:nextCut,punch_qty:nextPunch}).eq('id',matched.db_id);
    if(stockError) throw new Error(`Stock reversal failed: ${stockError.message}`);
    matched.cutQty=nextCut; matched.punchQty=nextPunch;

    const {error:deleteError}=await supabaseClient.from('reject_logs').delete().eq('id',id);
    if(deleteError){
      await supabaseClient.from('master_catalog').update({cut_qty:previous.cutQty,punch_qty:previous.punchQty}).eq('id',matched.db_id);
      matched.cutQty=previous.cutQty; matched.punchQty=previous.punchQty;
      throw new Error(`Reject delete failed: ${deleteError.message}`);
    }
    rejectLogs=rejectLogs.filter(r=>Number(r.id)!==Number(id));
    renderRejectTable(); renderDashboard(); renderProfileSummaryTable(); renderBalanceWorkTable();
    showToast(`Reject deleted. ${upstreamStage} Stage restored by ${qty.toLocaleString()} Pcs.`,'success');
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
function getAllRecoveryTargets(originalLength){
  const l=parseFloat(cleanLen(originalLength)||0);
  return masterData.map(m=>({...m,_lengthNum:parseFloat(cleanLen(m.length))})).filter(m=>Number.isFinite(m._lengthNum)&&m._lengthNum<l);
}
function getLegacyCutBalance(profile,itemCode,length){
  let total=0;
  recoverLogs.forEach(r=>{ if(recKey(r.profile)===recKey(profile)&&recKey(r.item_code)===recKey(itemCode)&&cleanLen(r.original_length)===cleanLen(length)) total+=Number(r.pcs)||0; });
  return total;
}
function getRejectBalance(profile, itemCode, originalLength){
  const p=recKey(profile), ic=recKey(itemCode), l=cleanLen(originalLength);
  let rejected=0, converted=0;
  rejectLogs.forEach(r=>{if(recKey(r.profile)===p&&recKey(r.item_code)===ic&&cleanLen(r.length)===l) rejected+=Number(r.pcs)||0;});
  recoveryCutLogs.forEach(r=>{if(recKey(r.source_profile)===p&&recKey(r.source_item_code)===ic&&cleanLen(r.original_length)===l) converted+=Number(r.cut_pcs)||0;});
  // Legacy v1 rows are only used when they are not already represented by the new table.
  if(recoveryCutLogs.length===0) converted += getLegacyCutBalance(profile,itemCode,originalLength);
  return Math.max(0,rejected-converted);
}
function getRecoveryCutStock(profile,itemCode,length){
  const p=recKey(profile),ic=recKey(itemCode),l=cleanLen(length);
  let cut=0,wrapped=0;
  recoveryCutLogs.forEach(r=>{if(recKey(r.new_profile)===p&&recKey(r.new_item_code)===ic&&cleanLen(r.new_length)===l) cut+=Number(r.cut_pcs)||0;});
  // Legacy recovery rows created virtual cut stock in v1.
  if(recoveryCutLogs.length===0) cut += recoverLogs.reduce((a,r)=>a+(recKey(r.profile)===p&&recKey(r.item_code)===ic&&cleanLen(r.new_length)===l?(Number(r.pcs)||0):0),0);
  recoveryWrapLogs.forEach(r=>{if(recKey(r.profile)===p&&recKey(r.item_code)===ic&&cleanLen(r.length)===l) wrapped+=Number(r.wrap_pcs)||0;});
  return Math.max(0,cut-wrapped);
}
function getRecoveryUnitWeight(profile,itemCode,length){
  const p=recKey(profile), ic=recKey(itemCode), l=cleanLen(length);
  const direct=masterData.find(m=>recKey(m.profile)===p&&recKey(m.itemCode)===ic&&cleanLen(m.length)===l);
  if(direct && Number(direct.unitWeight)>0) return Number(direct.unitWeight);

  // Recovery-cut stock can exist even when the corresponding Master Catalog row
  // was later removed/changed. In that case use the unit weight captured when
  // the recovery cut was created.
  let cutPcs=0, cutWeight=0;
  recoveryCutLogs.forEach(r=>{
    if(recKey(r.new_profile)===p&&recKey(r.new_item_code)===ic&&cleanLen(r.new_length)===l){
      const pcs=Number(r.cut_pcs)||0; const wt=Number(r.cut_weight)||0;
      if(pcs>0 && wt>0){ cutPcs+=pcs; cutWeight+=wt; }
    }
  });
  if(cutPcs>0 && cutWeight>0) return cutWeight/cutPcs;

  // Last fallback: estimate weight/pc from the original reject profile by
  // length ratio. This keeps legacy recovery records usable when the target
  // Master Catalog row is missing.
  let estimate=0;
  recoveryCutLogs.forEach(r=>{
    if(recKey(r.new_profile)===p&&recKey(r.new_item_code)===ic&&cleanLen(r.new_length)===l){
      const src=masterData.find(m=>recKey(m.profile)===recKey(r.source_profile)&&recKey(m.itemCode)===recKey(r.source_item_code)&&cleanLen(m.length)===cleanLen(r.original_length));
      const srcUw=Number(src?.unitWeight)||0;
      const ol=parseFloat(cleanLen(r.original_length)), nl=parseFloat(l);
      if(srcUw>0 && ol>0 && nl>0) estimate=srcUw*(nl/ol);
    }
  });
  return estimate;
}
function getRecoveryCutWeight(profile,itemCode,length){
  return getRecoveryCutStock(profile,itemCode,length)*getRecoveryUnitWeight(profile,itemCode,length);
}
function populateRecProfile(){
  const sel=document.getElementById('recProfile'); if(!sel)return;
  sel.innerHTML='<option value="">-- Choose Profile --</option>';
  const profiles=[...new Set(rejectLogs.map(r=>String(r.profile||'').trim()).filter(Boolean))];
  profiles.forEach(profile=>{
    const ok=rejectLogs.some(r=>recKey(r.profile)===recKey(profile)&&getRejectBalance(profile,r.item_code,r.length)>0);
    if(ok)sel.appendChild(new Option(profile,profile));
  });
  if(sel.options.length===2){sel.selectedIndex=1;onRecProfileSelect();}
}
function onRecProfileSelect(){
  const p=document.getElementById('recProfile')?.value||'', sel=document.getElementById('recItemCode');
  if(!sel)return;
  sel.innerHTML='<option value="">-- Choose Item Code --</option>';
  document.getElementById('recOrigLength').innerHTML='<option value="">-- Original Reject Length --</option>';
  resetRecoveryCutTarget();
  if(!p)return;
  [...new Set(rejectLogs.filter(r=>recKey(r.profile)===recKey(p)).map(r=>String(r.item_code||'').trim()).filter(Boolean))].forEach(ic=>{
    if(rejectLogs.some(r=>recKey(r.profile)===recKey(p)&&recKey(r.item_code)===recKey(ic)&&getRejectBalance(p,ic,r.length)>0)) sel.appendChild(new Option(ic,ic));
  });
  if(sel.options.length===2){sel.selectedIndex=1;onRecItemCodeSelect();}
}
function onRecItemCodeSelect(){
  const p=document.getElementById('recProfile')?.value||'',ic=document.getElementById('recItemCode')?.value||'',sel=document.getElementById('recOrigLength');
  sel.innerHTML='<option value="">-- Original Reject Length --</option>'; resetRecoveryCutTarget(); if(!p||!ic)return;
  const lengths=[...new Set(rejectLogs.filter(r=>recKey(r.profile)===recKey(p)&&recKey(r.item_code)===recKey(ic)).map(r=>cleanLen(r.length)).filter(Boolean))].sort((a,b)=>(parseFloat(a)||0)-(parseFloat(b)||0));
  lengths.forEach(l=>{const bal=getRejectBalance(p,ic,l);if(bal>0)sel.appendChild(new Option(`${l} mm • ${bal} Pcs available`,l));});
  if(sel.options.length===2){sel.selectedIndex=1;showRecAvailable();}
}
function resetRecoveryCutTarget(){
  ['recNewProfile','recNewItemCode','recNewLength'].forEach(id=>{const e=document.getElementById(id);if(e)e.innerHTML='<option value="">-- Select --</option>';});
  ['recAvailableDisplay','recCutWeight'].forEach(id=>{const e=document.getElementById(id);if(e){e.textContent=id==='recAvailableDisplay'?'0 Pcs / 0.00 kg':'';if('value' in e)e.value='';e.dataset.max='0';}});
  const pcs=document.getElementById('recPcs');if(pcs)pcs.value='';
}
function showRecAvailable(){
  const p=document.getElementById('recProfile')?.value||'',ic=document.getElementById('recItemCode')?.value||'',l=cleanLen(document.getElementById('recOrigLength')?.value||''),maxEl=document.getElementById('recAvailableDisplay');
  resetRecoveryCutTarget(); if(!p||!ic||!l)return;
  const bal=getRejectBalance(p,ic,l), src=masterData.find(m=>recKey(m.profile)===recKey(p)&&recKey(m.itemCode)===recKey(ic)&&cleanLen(m.length)===l),wt=bal*(Number(src?.unitWeight)||0);
  maxEl.innerHTML=`<strong>${bal} Pcs</strong> <span style="opacity:.8">/ ${wt.toFixed(2)} kg rejected material available</span>`;maxEl.dataset.max=bal;
  populateRecTargetProfiles(l);
}
function populateRecTargetProfiles(originalLength){
  const sel=document.getElementById('recNewProfile'); if(!sel)return;
  sel.innerHTML='<option value="">-- Select New Cut Profile --</option>';
  [...new Set(getAllRecoveryTargets(originalLength).map(m=>String(m.profile||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).forEach(p=>sel.appendChild(new Option(p,p)));
  const source=document.getElementById('recProfile')?.value||'';
  if([...sel.options].some(o=>o.value===source)){sel.value=source;onRecNewProfileSelect();}
}
function onRecNewProfileSelect(){
  const p=document.getElementById('recNewProfile')?.value||'',icSel=document.getElementById('recNewItemCode'),ol=cleanLen(document.getElementById('recOrigLength')?.value||'');
  icSel.innerHTML='<option value="">-- Select New Item Code --</option>';document.getElementById('recNewLength').innerHTML='<option value="">-- Select New Cut Length --</option>';document.getElementById('recCutWeight').value='';
  if(!p||!ol)return;
  [...new Set(getAllRecoveryTargets(ol).filter(m=>recKey(m.profile)===recKey(p)).map(m=>String(m.itemCode||'').trim()).filter(Boolean))].forEach(ic=>icSel.appendChild(new Option(ic,ic)));
  if(icSel.options.length===2){icSel.selectedIndex=1;onRecNewItemSelect();}
}
function onRecNewItemSelect(){
  const p=document.getElementById('recNewProfile')?.value||'',ic=document.getElementById('recNewItemCode')?.value||'',ol=cleanLen(document.getElementById('recOrigLength')?.value||''),sel=document.getElementById('recNewLength');
  sel.innerHTML='<option value="">-- Select New Cut Length --</option>';document.getElementById('recCutWeight').value='';if(!p||!ic||!ol)return;
  getAllRecoveryTargets(ol).filter(m=>recKey(m.profile)===recKey(p)&&recKey(m.itemCode)===recKey(ic)).sort((a,b)=>a._lengthNum-b._lengthNum).forEach(m=>{const o=new Option(`${m.length} mm • ${Number(m.unitWeight||0).toFixed(4)} kg/pc`,cleanLen(m.length));o.dataset.unitWeight=Number(m.unitWeight||0);sel.appendChild(o);});
  if(sel.options.length===2){sel.selectedIndex=1;calcRecCutWeight();}
}
function calcRecCutWeight(){
  const p=document.getElementById('recNewProfile')?.value||'',ic=document.getElementById('recNewItemCode')?.value||'',l=cleanLen(document.getElementById('recNewLength')?.value||''),pcs=parseInt(document.getElementById('recPcs')?.value)||0,el=document.getElementById('recCutWeight');if(!el)return;
  const max=parseInt(document.getElementById('recAvailableDisplay')?.dataset.max)||0;if(pcs<=0||pcs>max||!p||!ic||!l){el.value='';return;}const uw=getRecoveryUnitWeight(p,ic,l);el.value=(pcs*uw).toFixed(2);
}
async function saveRecoverEntry(){
  if(isAppBusy)return;isAppBusy=true;
  try{
    if(currentUserRole!=='Admin'&&currentUserRole!=='Planner')return;
    const d=document.getElementById('recDate').value,sp=document.getElementById('recProfile').value,sic=document.getElementById('recItemCode').value,ol=cleanLen(document.getElementById('recOrigLength').value),np=document.getElementById('recNewProfile').value,nic=document.getElementById('recNewItemCode').value,nl=cleanLen(document.getElementById('recNewLength').value),pcs=parseInt(document.getElementById('recPcs').value)||0,max=parseInt(document.getElementById('recAvailableDisplay').dataset.max)||0;
    if(!d||!sp||!sic||!ol||!np||!nic||!nl||pcs<=0)return showToast('Please complete all Recovery Cut fields.','warning');
    if(pcs>max)return showToast(`Recovery Cut quantity cannot exceed ${max} available reject pcs.`,'warning');
    if(parseFloat(nl)>=parseFloat(ol))return showToast('New Cut Length must be shorter than Original Reject Length.','warning');
    const target=masterData.find(m=>recKey(m.profile)===recKey(np)&&recKey(m.itemCode)===recKey(nic)&&cleanLen(m.length)===nl);
    const targetUnitWeight=Number(target?.unitWeight)||getRecoveryUnitWeight(np,nic,nl);
    if(targetUnitWeight<=0)return showToast('Cannot calculate Recovery Cut weight because the selected profile/length has no unit weight in Master Catalog.','warning');
    const cutWeight=parseFloat((pcs*targetUnitWeight).toFixed(2));
    const entry={cut_date:d,source_profile:sp,source_item_code:sic,original_length:ol,new_profile:np,new_item_code:nic,new_length:nl,cut_pcs:pcs,cut_weight:cutWeight};
    const {error}=await supabaseClient.from('recovery_cut_logs').insert([entry]);if(error)throw new Error(`Recovery Cut save failed: ${error.message}`);
    aisRegisterUndo(`Recovery Cut • ${np} / ${nl} • ${pcs} Pcs`,async()=>{await aisDeleteLatest('recovery_cut_logs',{cut_date:entry.cut_date,source_profile:entry.source_profile,source_item_code:entry.source_item_code,original_length:entry.original_length,new_profile:entry.new_profile,new_item_code:entry.new_item_code,new_length:entry.new_length,cut_pcs:entry.cut_pcs,cut_weight:entry.cut_weight});},'rejectTrackerTab');
    recoveryCutLogs.unshift({...entry,id:-Date.now()});renderRecoverTable();renderDashboard();showRecAvailable();renderRecoveryCutStockTable();showToast(`${pcs} pcs converted to ${np} / ${nl} mm. Cut stock was NOT added to normal production stock.`,'success');
    document.getElementById('rejectRecoverForm').reset();document.getElementById('recDate').value=d;populateRecProfile();
  }catch(e){console.error(e);showToast(e.message||'Recovery Cut save failed.','error');}finally{isAppBusy=false;}
}
function renderRecoveryCutStockTable(){
  const tb=document.getElementById('recoveryCutStockBody');if(!tb)return;const groups=new Map();
  recoveryCutLogs.forEach(r=>{const k=`${recKey(r.new_profile)}|${recKey(r.new_item_code)}|${cleanLen(r.new_length)}`;if(!groups.has(k))groups.set(k,{profile:r.new_profile,item_code:r.new_item_code,length:r.new_length,cut:0});groups.get(k).cut+=Number(r.cut_pcs)||0;});
  recoveryWrapLogs.forEach(r=>{const k=`${recKey(r.profile)}|${recKey(r.item_code)}|${cleanLen(r.length)}`;if(!groups.has(k))groups.set(k,{profile:r.profile,item_code:r.item_code,length:r.length,cut:0});groups.get(k).wrapped=(groups.get(k).wrapped||0)+(Number(r.wrap_pcs)||0);});
  if(!groups.size){tb.innerHTML='<tr><td colspan="7" style="text-align:center;padding:24px;">No Recover Cut Stock Available.</td></tr>';return;}
  let html='';[...groups.values()].forEach(g=>{const available=Math.max(0,g.cut-(g.wrapped||0)),m=masterData.find(x=>recKey(x.profile)===recKey(g.profile)&&recKey(x.itemCode)===recKey(g.item_code)&&cleanLen(x.length)===cleanLen(g.length)),uw=getRecoveryUnitWeight(g.profile,g.item_code,g.length);html+=`<tr><td><b>${g.profile}</b></td><td>${g.item_code}</td><td>${g.length} mm</td><td>${g.cut||0}</td><td>${g.wrapped||0}</td><td><b style="color:#047857">${available} Pcs</b></td><td>${(available*uw).toFixed(2)} kg</td></tr>`;});tb.innerHTML=html;
}
function populateRecoverWrapProfile(){
  const sel=document.getElementById('rwProfile');if(!sel)return;sel.innerHTML='<option value="">-- Choose Recover Cut Profile --</option>';
  const keys=new Map();recoveryCutLogs.forEach(r=>{const k=`${recKey(r.new_profile)}|${recKey(r.new_item_code)}|${cleanLen(r.new_length)}`;if(getRecoveryCutStock(r.new_profile,r.new_item_code,r.new_length)>0)keys.set(k,{p:r.new_profile,i:r.new_item_code,l:r.new_length});});
  keys.forEach(v=>sel.appendChild(new Option(`${v.p} • ${v.i} • ${v.l} mm`,JSON.stringify(v))));if(sel.options.length===2){sel.selectedIndex=1;onRecoverWrapProfileSelect();}
}
function onRecoverWrapProfileSelect(){
  const val=document.getElementById('rwProfile')?.value||'',availEl=document.getElementById('rwAvailable'),wEl=document.getElementById('rwWeight'),pcsEl=document.getElementById('rwPcs');if(wEl)wEl.value='';if(pcsEl)pcsEl.value='';
  if(!val){if(availEl)availEl.textContent='0 Pcs / 0.00 kg';return;}const v=JSON.parse(val),available=getRecoveryCutStock(v.p,v.i,v.l),wt=getRecoveryCutWeight(v.p,v.i,v.l);if(availEl){availEl.textContent=`${available} Pcs / ${wt.toFixed(2)} kg available`;availEl.dataset.max=available;availEl.dataset.profile=v.p;availEl.dataset.item=v.i;availEl.dataset.length=v.l;}
}
function calcRecoverWrapWeight(){const max=parseInt(document.getElementById('rwAvailable')?.dataset.max)||0,pcs=parseInt(document.getElementById('rwPcs')?.value)||0,el=document.getElementById('rwWeight');const p=document.getElementById('rwAvailable')?.dataset.profile||'',i=document.getElementById('rwAvailable')?.dataset.item||'',l=document.getElementById('rwAvailable')?.dataset.length||'';if(!el)return;if(pcs<=0||pcs>max){el.value='';return;}const m=masterData.find(x=>recKey(x.profile)===recKey(p)&&recKey(x.itemCode)===recKey(i)&&cleanLen(x.length)===cleanLen(l));el.value=(pcs*(Number(m?.unitWeight)||0)).toFixed(2);}
async function saveRecoverWrapEntry(){
  if(isAppBusy)return;
  isAppBusy=true;
  try{
    if(currentUserRole!=='Admin'&&currentUserRole!=='Planner')return;
    const d=document.getElementById('rwDate').value,
      avail=document.getElementById('rwAvailable'),
      pcs=parseInt(document.getElementById('rwPcs').value)||0,
      max=parseInt(avail.dataset.max)||0,
      p=avail.dataset.profile||'',
      i=avail.dataset.item||'',
      l=cleanLen(avail.dataset.length||'');

    if(!d||!p||!i||!l||pcs<=0)return showToast('Please select recover cut stock and enter wrapping pcs.','warning');
    if(pcs>max)return showToast(`Wrapping quantity cannot exceed ${max} available recover cut pcs.`,'warning');

    const m=masterData.find(x=>recKey(x.profile)===recKey(p)&&recKey(x.itemCode)===recKey(i)&&cleanLen(x.length)===l);
    const unitWeight=getRecoveryUnitWeight(p,i,l);
    if(unitWeight<=0)return showToast('Recovery Cut weight is unavailable. Add the matching profile/length unit weight to Master Catalog, then try again.','warning');

    const wt=parseFloat((pcs*unitWeight).toFixed(2));
    const previousWrapQty=Number(m?.wrapQty)||0;
    const nextWrapQty=previousWrapQty+pcs;
    const entry={wrap_date:d,profile:p,item_code:i,length:l,available_cut_pcs:max,wrap_pcs:pcs,wrap_weight:wt};

    // Save the recovery transaction first. If the matching Master Catalog row
    // exists, also add the quantity to Wrapping Stage stock. If the row is
    // missing, recovery is still recorded because recover-cut stock is a
    // separate virtual stock stream and must not be blocked by catalog drift.
    let stockChanged=false;
    try{
      if(m?.db_id){
        const {error:stockError}=await supabaseClient.from('master_catalog').update({wrap_qty:nextWrapQty}).eq('id',m.db_id);
        if(stockError)throw new Error(`Wrapping Stage Stock update failed: ${stockError.message}`);
        stockChanged=true;
      }
      const {error:insertError}=await supabaseClient.from('recovery_wrap_logs').insert([entry]);
      if(insertError)throw new Error(`Recovery Wrapping save failed: ${insertError.message}`);
      if(m) m.wrapQty=nextWrapQty;
    }catch(saveErr){
      if(stockChanged && m?.db_id){ try{ await supabaseClient.from('master_catalog').update({wrap_qty:previousWrapQty}).eq('id',m.db_id); }catch(rb){ console.error('Recovery wrapping stock rollback failed:',rb); } }
      throw saveErr;
    }

    aisRegisterUndo(`Recovery Wrapping • ${p} / ${l} • ${pcs} Pcs`,async()=>{
      await aisDeleteLatest('recovery_wrap_logs',{wrap_date:entry.wrap_date,profile:entry.profile,item_code:entry.item_code,length:entry.length,available_cut_pcs:entry.available_cut_pcs,wrap_pcs:entry.wrap_pcs,wrap_weight:entry.wrap_weight});
      if(m?.db_id) await aisUpdateById('master_catalog',m.db_id,{wrap_qty:previousWrapQty});
    },'rejectTrackerTab');
    recoveryWrapLogs.unshift({...entry,id:-Date.now()});
    renderRecoverTable();
    renderRecoveryCutStockTable();
    populateRecoverWrapProfile();
    renderProfileSummaryTable();
    renderDashboard();
    renderBalanceWorkTable();
    showToast(`${pcs} pcs wrapped from recover cut stock. ${wt.toFixed(2)} kg counted as Recovery Weight and ${pcs} pcs added to ${p} / ${l} mm Wrapping Stage Stock.`,'success');
    document.getElementById('recoverWrapForm').reset();
    document.getElementById('rwDate').value=d;
  }catch(e){
    console.error(e);
    showToast(e.message||'Recovery Wrapping save failed.','error');
  }finally{
    isAppBusy=false;
  }
}
async function deleteRecoveryCutItem(id){if(currentUserRole!=='Admin')return;const row=recoveryCutLogs.find(r=>String(r.id)===String(id));if(!row)return;showConfirm('Delete this Recovery Cut record?',async()=>{try{const {error}=await supabaseClient.from('recovery_cut_logs').delete().eq('id',id);if(error)throw new Error(error.message);recoveryCutLogs=recoveryCutLogs.filter(r=>String(r.id)!==String(id));renderRecoverTable();renderRecoveryCutStockTable();populateRecProfile();populateRecoverWrapProfile();renderDashboard();showToast('Recovery Cut record deleted.','success');}catch(e){showToast(e.message||'Delete failed.','error');}});}
async function deleteRecoveryWrapItem(id){
  if(currentUserRole!=='Admin')return;
  const row=recoveryWrapLogs.find(r=>String(r.id)===String(id));
  if(!row)return;
  showConfirm('Delete this Recovery Wrapping record?',async()=>{
    try{
      const m=masterData.find(x=>recKey(x.profile)===recKey(row.profile)&&recKey(x.itemCode)===recKey(row.item_code)&&cleanLen(x.length)===cleanLen(row.length));
      const currentWrapQty=Number(m?.wrapQty)||0;
      const removeQty=Number(row.wrap_pcs)||0;
      const nextWrapQty=Math.max(0,currentWrapQty-removeQty);

      if(m?.db_id){
        const {error:stockError}=await supabaseClient.from('master_catalog').update({wrap_qty:nextWrapQty}).eq('id',m.db_id);
        if(stockError)throw new Error(`Wrapping Stage Stock reversal failed: ${stockError.message}`);
        m.wrapQty=nextWrapQty;
      }

      const {error}=await supabaseClient.from('recovery_wrap_logs').delete().eq('id',id);
      if(error){
        if(m?.db_id)await supabaseClient.from('master_catalog').update({wrap_qty:currentWrapQty}).eq('id',m.db_id);
        throw new Error(error.message);
      }

      recoveryWrapLogs=recoveryWrapLogs.filter(r=>String(r.id)!==String(id));
      renderRecoverTable();
      renderRecoveryCutStockTable();
      populateRecoverWrapProfile();
      renderProfileSummaryTable();
      renderDashboard();
      renderBalanceWorkTable();
      showToast('Recovery Wrapping record deleted. Wrapping Stage Stock reversed and recover cut stock balance restored.','success');
    }catch(e){showToast(e.message||'Delete failed.','error');}
  });
}
function renderRecoverTable(){
  const now=new Date(),y=now.getFullYear(),m=now.getMonth();let monthlyReject=0,monthlyRecover=0;rejectLogs.forEach(r=>{const d=new Date(r.reject_date);if(d.getFullYear()===y&&d.getMonth()===m)monthlyReject+=Number(r.weight)||0;});recoveryWrapLogs.forEach(r=>{const d=new Date(r.wrap_date);if(d.getFullYear()===y&&d.getMonth()===m)monthlyRecover+=Number(r.wrap_weight)||0;});const net=Math.max(0,monthlyReject-monthlyRecover),rate=monthlyReject>0?Math.min(100,monthlyRecover/monthlyReject*100):0;const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};set('recMonthlyReject',`${monthlyReject.toFixed(2)} kg`);set('recMonthlyRecover',`${monthlyRecover.toFixed(2)} kg`);set('recMonthlyNet',`${net.toFixed(2)} kg`);set('recMonthlyRate',`${rate.toFixed(1)}%`);set('recMonthlyRateBadge',`${rate.toFixed(1)}% of reject recovered`);const bar=document.getElementById('recMonthlyRecoverBar');if(bar)bar.style.width=`${rate.toFixed(1)}%`;set('recoverySummaryMonth',dashboardMonthLabel(dashboardSelectedMonth));
  const cutTb=document.getElementById('recoveryCutTableBody');if(cutTb){if(!recoveryCutLogs.length)cutTb.innerHTML='<tr><td colspan="10" style="text-align:center;padding:24px;">No Recovery Cut Records Found.</td></tr>';else cutTb.innerHTML=recoveryCutLogs.slice(0,100).map(r=>`<tr><td>${r.cut_date}</td><td><b>${r.source_profile}</b></td><td>${r.source_item_code}</td><td>${r.original_length} mm</td><td><b>${r.new_profile}</b></td><td>${r.new_item_code}</td><td>${r.new_length} mm</td><td>${r.cut_pcs} Pcs</td><td>${Number(r.cut_weight||0).toFixed(2)} kg</td><td>${currentUserRole==='Admin'&&!r.legacy?`<button class="btn btn-danger" onclick="deleteRecoveryCutItem(${r.id})"><i class="fa-solid fa-trash"></i></button>`:'<i class="fa-solid fa-lock"></i>'}</td></tr>`).join('');}
  const wrapTb=document.getElementById('recoveryWrapTableBody');if(wrapTb){if(!recoveryWrapLogs.length)wrapTb.innerHTML='<tr><td colspan="8" style="text-align:center;padding:24px;">No Recovery Wrapping Records Found.</td></tr>';else wrapTb.innerHTML=recoveryWrapLogs.slice(0,100).map(r=>`<tr><td>${r.wrap_date}</td><td><b>${r.profile}</b></td><td>${r.item_code}</td><td>${r.length} mm</td><td>${r.available_cut_pcs} Pcs</td><td><b>${r.wrap_pcs} Pcs</b></td><td><b style="color:#047857">${Number(r.wrap_weight||0).toFixed(2)} kg</b></td><td>${currentUserRole==='Admin'?`<button class="btn btn-danger" onclick="deleteRecoveryWrapItem(${r.id})"><i class="fa-solid fa-trash"></i></button>`:'<i class="fa-solid fa-lock"></i>'}</td></tr>`).join('');}
  renderRecoveryCutStockTable();populateRecoverWrapProfile();
}
window.renderRecoverTable=renderRecoverTable;
function recoveryMonthReminder(){
  const now=new Date(),lastDay=new Date(now.getFullYear(),now.getMonth()+1,0).getDate(),daysLeft=lastDay-now.getDate(),box=document.getElementById('recoveryMonthReminder');if(!box)return; if(daysLeft===2){box.style.display='flex';box.innerHTML=`<div><i class="fa-solid fa-bell"></i><strong> Monthly Reject Recovery Reminder</strong><span>Only 2 days remain until month-end. Please complete pending Reject → Recover Cut → Recovery Wrapping entries.</span></div><button class="btn" onclick="switchTab('rejectTrackerTab',document.getElementById('tabBtn-rejectTracker'))"><i class="fa-solid fa-recycle"></i> Open Recovery</button>`;if(!sessionStorage.getItem('ais_recovery_reminder_shown')){showToast('Reminder: 2 days left to complete monthly Reject Recovery.','warning');sessionStorage.setItem('ais_recovery_reminder_shown','1');}}else{box.style.display='none';}}
function dashboardChartOptions(textColor, showLegend = true) {
  return {
    responsive: true,
    maintainAspectRatio: true,
    animation: { duration: 450 },
    plugins: {
      legend: {
        display: showLegend,
        position: 'bottom',
        labels: { color: textColor, usePointStyle: true, padding: 12, font: { size: 11, weight: '700' } }
      },
      tooltip: {
        enabled: true,
        callbacks: {
          label: function(context) {
            const value = Number(context.raw || 0);
            return ` ${context.label || ''}: ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg`;
          }
        }
      }
    }
  };
}

function safeChartDestroy(instance, canvasOrId = null) {
  try { if (instance && typeof instance.destroy === 'function') instance.destroy(); } catch (e) { console.warn('Chart destroy skipped:', e); }
  try {
    const canvas = typeof canvasOrId === 'string' ? document.getElementById(canvasOrId) : canvasOrId;
    if (canvas && typeof Chart !== 'undefined' && typeof Chart.getChart === 'function') {
      const existing = Chart.getChart(canvas);
      if (existing) existing.destroy();
    }
  } catch (e) { console.warn('Existing Chart cleanup skipped:', e); }
}

function dbErrorMessage(error, action) {
  const msg = error?.message || error?.details || error?.hint || 'Unknown database error';
  return `${action}: ${msg}`;
}

// ===== AIS GLOBAL UNDO / REVERT SYSTEM =====
// Keeps a short in-session stack of successful data-entry/edit operations.
// It never touches existing data until the user explicitly presses Undo.
let aisUndoStack = [];
let aisUndoBusy = false;

function aisRegisterUndo(label, undoFn, tabId='') {
  if (typeof undoFn !== 'function') return;
  aisUndoStack.push({ label: String(label || 'Last Change'), undoFn, tabId, at: Date.now() });
  if (aisUndoStack.length > 20) aisUndoStack.shift();
  aisUpdateUndoButtons();
}

async function aisFindLatestId(table, matchObj) {
  let q = supabaseClient.from(table).select('id');
  Object.entries(matchObj || {}).forEach(([k,v]) => { if(v !== undefined && v !== null) q = q.eq(k, v); });
  const { data, error } = await q.order('id', { ascending: false }).limit(1);
  if (error) throw error;
  return data?.[0]?.id ?? null;
}

async function aisDeleteLatest(table, matchObj) {
  const id = await aisFindLatestId(table, matchObj);
  if (id === null || id === undefined) throw new Error(`Undo could not find the saved ${table} record.`);
  const { error } = await supabaseClient.from(table).delete().eq('id', id);
  if (error) throw error;
  return id;
}

async function aisUpdateById(table, id, values) {
  if(id === null || id === undefined) throw new Error(`Undo could not identify the ${table} record.`);
  const { error } = await supabaseClient.from(table).update(values).eq('id', id);
  if (error) throw error;
}

function aisUndoCandidates(tabId=''){
  return aisUndoStack.map((action,index)=>({action,index}))
    .filter(entry=>!tabId || entry.action.tabId===tabId);
}
function aisUpdateUndoButtons(){
  document.querySelectorAll('.ais-undo-btn').forEach(btn=>{
    const tabId=btn.dataset.undoTab||'';
    const candidates=aisUndoCandidates(tabId);
    const latest=candidates.length?candidates[candidates.length-1].action:null;
    const defaultLabel=tabId==='packingListTab'?'Undo Packing List':'Undo Last Change';
    btn.disabled = !latest || aisUndoBusy;
    btn.innerHTML = `<i class="fa-solid fa-rotate-left"></i> ${latest ? `Undo: ${latest.label}` : defaultLabel}`;
    btn.title = latest ? `Undo ${latest.label}` : `No recent change${tabId?' on this page':''} to undo`;
  });
}

window.aisUndoLastAction = async function(tabId=''){
  const candidates=aisUndoCandidates(tabId);
  if(aisUndoBusy || !candidates.length) return showToast(tabId==='packingListTab'?'No recent Packing List change is available to undo.':'There is no recent change to undo.','info');
  if(currentUserRole!=='Admin' && currentUserRole!=='Planner') return showToast('Undo is available to Admin / Planner only.','warning');
  const selected=candidates[candidates.length-1];
  const action=selected.action;
  if(!confirm(`Undo this change?\n\n${action.label}\n\nThe saved data will be restored/reverted.`)) return;
  aisUndoBusy=true; aisUpdateUndoButtons();
  try{
    await action.undoFn();
    aisUndoStack.splice(selected.index,1);
    await loadDataFromSupabase(true).catch(()=>{});
    showToast(`Undo successful: ${action.label}`,'success');
  }catch(e){
    console.error('AIS Undo failed:',e);
    showToast(dbErrorMessage(e,'Undo failed. No data was intentionally removed/changed by the undo system.'),'error');
  }finally{ aisUndoBusy=false; aisUpdateUndoButtons(); }
};

function aisInjectUndoButtons(){
  const targets=['adminEntryTab','rejectTrackerTab','poManagementTab','shipmentTab','packingListTab','cardboardTab','historyTab','masterListTab'];
  targets.forEach(tabId=>{
    const tab=document.getElementById(tabId); if(!tab || tab.querySelector('.ais-undo-btn')) return;
    const card=tab.querySelector('.card'); if(!card) return;
    const head=card.querySelector('h2,h3'); if(!head) return;
    const wrap=document.createElement('div');
    wrap.style.cssText='display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px;';
    head.parentNode.insertBefore(wrap,head);
    wrap.appendChild(head);
    const btn=document.createElement('button');
    btn.type='button'; btn.className='btn ais-undo-btn'; btn.dataset.undoTab=tabId;
    btn.style.cssText='background:#176173;color:#fff;border:1px solid #104653;padding:7px 11px;font-size:11px;font-weight:900;border-radius:9px;';
    btn.onclick=()=>window.aisUndoLastAction(tabId);
    wrap.appendChild(btn);
  });
  aisUpdateUndoButtons();
}

async function dbInsert(table, row, action) {
  // Do NOT request the inserted row back here. With Supabase RLS, INSERT may be
  // allowed while SELECT/RETURNING is not. Using .select() made a successful
  // write look like a failed write and could trigger a rollback in production.
  let result = await supabaseClient.from(table).insert([row]);
  if (result.error && table === 'history_logs' && row && row.team != null) {
    const msg = String(result.error.message || result.error.details || '');
    // Older deployments may use production_team rather than team. Only retry
    // when Supabase explicitly rejects the team column; never retry arbitrary
    // failures, so normal network/RLS errors cannot create duplicate records.
    if (/could not find the ['\"]?team['\"]? column of ['\"]?history_logs['\"]? in the schema cache/i.test(msg)) {
      const legacyRow = { ...row, production_team: row.team };
      delete legacyRow.team;
      result = await supabaseClient.from(table).insert([legacyRow]);
      if (!result.error) return { ...legacyRow, team: row.team, id: null };
      const legacyMsg = String(result.error.message || result.error.details || '');
      if (/could not find the ['\"]?production_team['\"]? column|column .*production_team.* does not exist/i.test(legacyMsg)) {
        throw new Error(`${action || 'Save failed'}: Supabase is missing the Team column. No production history was saved, and stock changes were rolled back. In Supabase SQL Editor, run the file supabase_add_team_to_history_logs.sql from the website ZIP, then retry.`);
      }
    }
  }
  if (result.error) throw new Error(dbErrorMessage(result.error, action));
  return { ...row, id: null };
}

async function dbUpdate(table, values, id, action) {
  // Same RLS-safe rule: verify the UPDATE request itself, not a SELECT of the
  // updated row. The next sync will refresh the real database values/IDs.
  const result = await supabaseClient.from(table).update(values).eq('id', id);
  if (result.error) throw new Error(dbErrorMessage(result.error, action));
  return { ...values, id };
}

function setDbStatus(ok, message='') {
  const el=document.getElementById('dbStatusBadge');
  if(!el) return;
  el.textContent=ok?'● DB CONNECTED':'● DB ERROR';
  el.style.background=ok?'#dcfce7':'#fee2e2';
  el.style.color=ok?'#047857':'#b91c1c';
  el.title=message || (ok?'Supabase connection is working.':'Supabase/database needs attention.');
}

window.testSupabaseConnection = async function(show=true){
  try {
    const {error}=await supabaseClient.from('master_catalog').select('id',{count:'exact',head:true});
    if(error) throw error;
    setDbStatus(true,'Supabase connection and SELECT policy are working.');
    if(show) showToast('Database connection OK.','success');
    return {ok:true};
  } catch(e) {
    const msg=dbErrorMessage(e,'Database connection test failed');
    setDbStatus(false,msg);
    if(show) showToast(msg,'error');
    console.error(msg,e);
    return {ok:false,error:msg};
  }
};

function setDashboardPeriodBadge(id, text, isBlue = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text || '';
  el.style.display = text ? '' : 'none';
  if (isBlue) {
    el.style.color = '#0284c7';
    el.style.borderColor = '#bae6fd';
    el.style.background = '#f0f9ff';
  }
}

function dashboardDataPeriod(values, fallback = 'Active data') {
  const dates = (Array.isArray(values) ? values : []).filter(Boolean).map(v => {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }).filter(Boolean);
  if (!dates.length) return fallback;
  const min = new Date(Math.min(...dates.map(d => d.getTime())));
  const max = new Date(Math.max(...dates.map(d => d.getTime())));
  const sameMonth = min.getFullYear() === max.getFullYear() && min.getMonth() === max.getMonth();
  if (sameMonth) return min.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  return `${min.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} - ${max.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
}

function dashboardDataPeriodFromMonthFields(values, fallback = 'Active data') {
  const dates = (Array.isArray(values) ? values : []).filter(Boolean).map(v => {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }).filter(Boolean);
  if (!dates.length) return fallback;
  const months = [...new Set(dates.map(d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`))];
  if (months.length === 1) return dates[0].toLocaleDateString('en-US', { month:'long', year:'numeric' });
  return `${months.length} active months`;
}

let dashboardSelectedMonth = '';
function getDashboardMonthOptions() {
  const keys = new Set();
  const addDate = v => { if(!v) return; const d=new Date(v); if(!Number.isNaN(d.getTime())) keys.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`); };
  poList.forEach(x=>addDate(x.date)); historyLogs.forEach(x=>addDate(x.date)); rejectLogs.forEach(x=>addDate(x.reject_date)); recoveryWrapLogs.forEach(x=>addDate(x.wrap_date)); shipmentList.forEach(x=>addDate(x.date)); packingLists.forEach(x=>addDate(x.date));
  const now=new Date(); keys.add(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`);
  return [...keys].sort().reverse();
}
function dashboardMonthLabel(key){ if(!key) return 'Current Month'; const [y,m]=String(key).split('-').map(Number); return new Date(y,(m||1)-1,1).toLocaleDateString('en-US',{month:'long',year:'numeric'}); }
function ensureDashboardMonthControl(){
  const host=document.getElementById('dashboardMonthControl'); if(!host) return;
  const options=getDashboardMonthOptions();
  if(!dashboardSelectedMonth || !options.includes(dashboardSelectedMonth)) dashboardSelectedMonth=options[0] || '';
  host.innerHTML=`<label style="font-size:11px;font-weight:900;color:#475569;display:flex;align-items:center;gap:6px;"><i class="fa-solid fa-calendar-days" style="color:#0369a1;"></i> Dashboard Month <select id="dashboardMonthSelect" onchange="window.setDashboardMonth(this.value)" style="padding:8px 12px;border:1px solid #bae6fd;border-radius:9px;background:#fff;font-weight:800;color:#0f172a;min-width:155px;">${options.map(k=>`<option value="${k}" ${k===dashboardSelectedMonth?'selected':''}>${dashboardMonthLabel(k)}</option>`).join('')}</select></label>`;
}
window.setDashboardMonth=function(key){ dashboardSelectedMonth=key||''; renderDashboard(); };
function getDashboardPackingSelection(monthKey){
  // The dashboard Packing List chart always follows the newest saved PL,
  // independently of the dashboard's production-month selector.
  // Historical PLs can still be opened manually from the Packing List page.
  const latest=getLatestPackingSelection();
  return {month:latest.month, container:latest.container, records:latest.records};
}


/* -------------------------------------------------------------------------
 * Dashboard: All Pending Production Orders
 * -------------------------------------------------------------------------
 * This block is intentionally independent of the Dashboard Month selector.
 * It calculates ALL currently outstanding PO demand, then allocates the
 * CURRENT master stock against that demand once per Profile + Item Code +
 * Length key. It does not mutate masterData, PO data, shipments, or Supabase.
 */
function dashboardQty(value) {
  const n = Number(String(value ?? 0).replace(/,/g, '').trim());
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function getDashboardCatalogItemForPo(po) {
  const profile = String(po?.profile ?? '').trim();
  const itemCode = String(po?.itemCode ?? '').trim();
  const length = cleanLen(po?.length);
  if (!profile || !length) return null;

  if (itemCode) {
    const exact = masterData.find(m =>
      String(m.profile ?? '').trim() === profile &&
      String(m.itemCode ?? '').trim() === itemCode &&
      cleanLen(m.length) === length
    );
    if (exact) return exact;
  }

  return masterData.find(m =>
    String(m.profile ?? '').trim() === profile &&
    cleanLen(m.length) === length
  ) || null;
}

function calculateAllPendingProductionOrderDashboard() {
  const result = {
    totalPendingWt: 0,
    completeWt: 0,
    processingWt: 0,
    stillPendingWt: 0,
    pendingQty: 0,
    lineCount: 0
  };

  if (!Array.isArray(poList) || !Array.isArray(masterData)) return result;

  // Shipments are matched using the same PO/Profile/Length identity already
  // used elsewhere in AIS Tracker. This keeps this dashboard card consistent
  // with the Production Orders / Shipment balance logic.
  const shippedByLine = new Map();
  (shipmentList || []).forEach(s => {
    const key = `${String(s?.poNumber ?? '').trim()}_${String(s?.profile ?? '').trim()}_${cleanLen(s?.length)}`;
    const qty = dashboardQty(s?.shippedQty);
    if (qty > 0) shippedByLine.set(key, (shippedByLine.get(key) || 0) + qty);
  });

  // Aggregate outstanding demand by the canonical Master Catalog key.
  // This prevents current stock from being counted repeatedly when multiple
  // pending PO lines require the same profile/length.
  const demandByKey = new Map();

  (poList || []).forEach(po => {
    const orderQty = dashboardQty(po?.orderQty);
    if (orderQty <= 0) return;

    const profile = String(po?.profile ?? '').trim();
    const length = cleanLen(po?.length);
    const poNumber = String(po?.poNumber ?? '').trim();
    if (!profile || !length) return;

    const shipKey = `${poNumber}_${profile}_${length}`;
    const shippedQty = Math.min(orderQty, shippedByLine.get(shipKey) || 0);
    const remainingQty = Math.max(0, orderQty - shippedQty);
    if (remainingQty <= 0) return;

    const catalog = getDashboardCatalogItemForPo(po);
    if (!catalog) return;

    const itemCode = String(catalog.itemCode ?? po?.itemCode ?? '').trim();
    const key = `${profile}_${itemCode}_${length}`;
    const existing = demandByKey.get(key) || {
      profile,
      itemCode,
      length,
      remainingQty: 0,
      unitWeight: dashboardQty(catalog.unitWeight),
      master: catalog
    };

    existing.remainingQty += remainingQty;
    demandByKey.set(key, existing);
  });

  demandByKey.forEach(line => {
    const demandQty = line.remainingQty;
    const m = line.master;
    const unitWeight = dashboardQty(line.unitWeight);

    // Current stock is read-only here. Nothing is deducted or changed.
    const completeStockQty =
      dashboardQty(m.wrapQty) +
      dashboardQty(m.boxQty) +
      dashboardQty(m.crateQty);

    const processingStockQty =
      dashboardQty(m.cutQty) +
      dashboardQty(m.punchQty);

    // Allocate higher-stage stock first because those pieces can satisfy the
    // pending PO immediately. Then allocate Cut + Punch as waiting/processing.
    const completeQty = Math.min(demandQty, completeStockQty);
    const afterComplete = Math.max(0, demandQty - completeQty);
    const processingQty = Math.min(afterComplete, processingStockQty);
    const stillPendingQty = Math.max(0, afterComplete - processingQty);

    result.pendingQty += demandQty;
    result.lineCount += 1;
    result.totalPendingWt += demandQty * unitWeight;
    result.completeWt += completeQty * unitWeight;
    result.processingWt += processingQty * unitWeight;
    result.stillPendingWt += stillPendingQty * unitWeight;
  });

  return result;
}

function renderPendingProductionOrderDashboardCard() {
  const summary = calculateAllPendingProductionOrderDashboard();

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = `${Number(value || 0).toFixed(2)} kg`;
  };

  setText('dashPendingPoTotalWt', summary.totalPendingWt);
  setText('dashPendingPoCompleteWt', summary.completeWt);
  setText('dashPendingPoProcessingWt', summary.processingWt);
  setText('dashPendingPoStillWt', summary.stillPendingWt);

  const card = document.getElementById('pendingProductionOrdersCard');
  if (card) {
    card.dataset.pendingLines = String(summary.lineCount);
    card.dataset.pendingQty = String(summary.pendingQty);
  }

  return summary;
}

function renderDashboard() {
  // All-pending-PO card is independent of the selected dashboard month.
  renderPendingProductionOrderDashboardCard();
  let totalStockPcs = 0, totalStockWt = 0;
  let totalCut = 0, totalPunch = 0, totalWrap = 0, totalBox = 0, totalCrate = 0;
  let totalCutWt = 0, totalPunchWt = 0, totalWrapWt = 0, totalBoxWt = 0, totalCrateWt = 0;
  
  let masterMap = new Map();
  masterData.forEach(m => {
      masterMap.set(`${String(m.profile).trim()}_${cleanLen(m.length)}_${m.itemCode}`, m);
      const pcs = (m.cutQty||0) + (m.punchQty||0) + (m.wrapQty||0) + (m.boxQty||0) + (m.crateQty||0);
      totalStockPcs += pcs; 
      totalStockWt += pcs * (m.unitWeight||0);
      totalCut += m.cutQty||0; totalPunch += m.punchQty||0; totalWrap += m.wrapQty||0; totalBox += m.boxQty||0; totalCrate += m.crateQty||0;
      const uw = Number(m.unitWeight)||0;
      totalCutWt += (Number(m.cutQty)||0) * uw;
      totalPunchWt += (Number(m.punchQty)||0) * uw;
      totalWrapWt += (Number(m.wrapQty)||0) * uw;
      totalBoxWt += (Number(m.boxQty)||0) * uw;
      totalCrateWt += (Number(m.crateQty)||0) * uw;
  });
  
  if(document.getElementById('kpiTotalStockPcs')) document.getElementById('kpiTotalStockPcs').textContent = `${totalStockPcs.toLocaleString()} Pcs`; 
  if(document.getElementById('kpiTotalStockWt')) document.getElementById('kpiTotalStockWt').textContent = `${totalStockWt.toFixed(2)} kg`;

  // Last Day Output = the most recent date on which Wrap Qty was actually entered.
  // Do not use historyLogs[0], because the latest log can be a Cut/Punch/Box/Crate
  // entry with zero Wrap Qty.
  let latestDate = '-';
  let lastWrapOutputKey = '';
  historyLogs.forEach(h => {
      const wrapPcs = Number(h.wrapQty) || 0;
      const dStr = String(h.date || '').trim();
      if (wrapPcs > 0 && /^\d{4}-\d{2}-\d{2}$/.test(dStr) && dStr > lastWrapOutputKey) {
          lastWrapOutputKey = dStr;
      }
  });
  latestDate = lastWrapOutputKey || (historyLogs.length > 0 ? String(historyLogs[0].date || '-') : '-');

  let todayPcs = 0, todayWt = 0;

  const now = new Date(); ensureDashboardMonthControl(); const selectedMonthKey = dashboardSelectedMonth || `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`; const [selY, selM] = selectedMonthKey.split('-').map(Number); const cm = (selM||1)-1; const cy = selY || now.getFullYear();
  const currentMonthLabel = dashboardMonthLabel(selectedMonthKey);
  setDashboardPeriodBadge('factoryStockPeriod', 'LIVE SNAPSHOT');
  const selectedPoDates = poList.filter(p=>{ const d=new Date(p.date); return !Number.isNaN(d.getTime()) && d.getFullYear()===cy && d.getMonth()===cm; }).map(p=>p.date);
  setDashboardPeriodBadge('overallPoPeriod', currentMonthLabel || dashboardDataPeriod(selectedPoDates, 'No dated POs'));
  const dashboardPlSel = getDashboardPackingSelection(selectedMonthKey);
  const dashboardPlMonth = dashboardPlSel.month || activePackingMonth;
  const dashboardPlContainer = dashboardPlSel.container || activePackingContainer;
  const activePlRecords = dashboardPlSel.records || [];
  setDashboardPeriodBadge('overallPlPeriod', `${dashboardPlMonth || currentMonthLabel} • ${dashboardPlContainer || 'No PL'}`, true);
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

  if(document.getElementById('latestOutputDate')) document.getElementById('latestOutputDate').textContent = latestDate; if(document.getElementById('dashboardOutputLabel')) document.getElementById('dashboardOutputLabel').textContent = selectedMonthKey === `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}` ? 'Latest Output' : 'Month-End Output';
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
  recoveryWrapLogs.forEach(r => { let d = new Date(r.wrap_date); if(d.getMonth()===cm && d.getFullYear()===cy) mRecWt += parseFloat(r.wrap_weight)||0; });
  
  let rejPct = mProdWrapWt > 0 ? ((mRejWt / mProdWrapWt) * 100).toFixed(1) : 0;
  if(document.getElementById('kpiRejectValue')) document.getElementById('kpiRejectValue').textContent = `${mRejWt.toFixed(2)} kg (${rejPct}%)`;
  if(document.getElementById('kpiPlantRej')) document.getElementById('kpiPlantRej').textContent = mPlantRejWt.toFixed(2);
  if(document.getElementById('kpiOtherRej')) document.getElementById('kpiOtherRej').textContent = mOtherRejWt.toFixed(2);

  let dashCrateMap = {};
  let availStockForCrates = masterData.map(m => ({ ...m }));
  let sortedPlsForCrates = [...activePlRecords].sort(sortCrates);
  
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
          if (isManualCrateComplete(crateId, dashboardPlContainer, dashboardPlMonth)) finalCompCrates++;
      }
  }

  if(document.getElementById('kpiShipCrates')) document.getElementById('kpiShipCrates').textContent = `${finalCompCrates} / ${finalTotCrates} Crates`;
  
  // Dashboard PL box KPIs are scoped to the currently active/latest Packing List container only.
  const activeFullBoxQty = Math.ceil(domTotalPlReqBoxes);
  const activeCompleteBoxQty = Math.floor(domTotalPlCompletedBoxes);
  if(document.getElementById('dashPlFullBoxQty')) document.getElementById('dashPlFullBoxQty').textContent = activeFullBoxQty.toLocaleString();
  if(document.getElementById('dashPlCompleteBoxQty')) document.getElementById('dashPlCompleteBoxQty').textContent = activeCompleteBoxQty.toLocaleString();

  if(document.getElementById('kpiTotalPlBoxes')) document.getElementById('kpiTotalPlBoxes').textContent = activeFullBoxQty.toLocaleString(); 
  
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

  // IMPORTANT: the 30-day Production Order reminder is a live operational alert.
  // It must NOT disappear just because the user selected a different Dashboard Month.
  // The month selector controls the monthly charts, while this alert always checks
  // every PO against shipments recorded up to today.
  const selectedPoList = poList.filter(po=>{ const d=new Date(po.date); return !Number.isNaN(d.getTime()) && d.getFullYear()===cy && d.getMonth()===cm; });
  const poGroups = {};
  selectedPoList.forEach(po => {
      const key = String(po.poNumber).trim();
      if (!poGroups[key]) poGroups[key] = { date: po.date, items: [] };
      poGroups[key].items.push(po);
  });
  const overduePoGroups = {};
  poList.forEach(po => {
      const key = String(po.poNumber).trim();
      if (!key) return;
      if (!overduePoGroups[key]) overduePoGroups[key] = { date: po.date, items: [] };
      overduePoGroups[key].items.push(po);
  });

  const shipLookup = new Map();
  const overdueShipLookup = new Map();
  // Shipment weights are kept in two views:
  // 1) cumulative-to-month-end for PO balance/overdue calculations, and
  // 2) selected-month-only for the dashboard production-order chart.
  const shipContainerWeights = {'1st Container': 0, '2nd Container': 0, '3rd Container': 0};
  const shipContainerMonthWeights = {'1st Container': 0, '2nd Container': 0, '3rd Container': 0};
  const selectedMonthStart = new Date(cy, cm, 1, 0, 0, 0, 0);
  const selectedMonthEnd = new Date(cy, cm + 1, 0, 23, 59, 59, 999);
  let selectedMonthShipmentWt = 0;
  shipmentList.filter(s=>{ const d=new Date(s.date); return !Number.isNaN(d.getTime()) && d.getTime() <= selectedMonthEnd.getTime(); }).forEach(s => {
      const k = `${String(s.poNumber).trim()}_${String(s.profile).trim()}_${cleanLen(s.length)}`;
      const qty = Math.max(0, parseInt(s.shippedQty) || 0);
      shipLookup.set(k, (shipLookup.get(k) || 0) + qty);
      const matchedCat = masterData.find(m => String(m.profile).trim() === String(s.profile).trim() && cleanLen(m.length) === cleanLen(s.length));
      if (matchedCat) {
          const wt = qty * (Number(matchedCat.unitWeight) || 0);
          const cName = s.container || '1st Container';
          if (shipContainerWeights[cName] !== undefined) shipContainerWeights[cName] += wt;
          const d = new Date(s.date);
          if (d >= selectedMonthStart && d <= selectedMonthEnd) {
              if (shipContainerMonthWeights[cName] !== undefined) shipContainerMonthWeights[cName] += wt;
              selectedMonthShipmentWt += wt;
          }
      }
  });

  // Cumulative shipment quantities used only by the 30-day overdue alert.
  const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);
  shipmentList.filter(s=>{ const d=new Date(s.date); return !Number.isNaN(d.getTime()) && d.getTime() <= todayEnd.getTime(); }).forEach(s=>{
      const k=`${String(s.poNumber).trim()}_${String(s.profile).trim()}_${cleanLen(s.length)}`;
      const qty=Math.max(0,parseInt(s.shippedQty)||0);
      overdueShipLookup.set(k,(overdueShipLookup.get(k)||0)+qty);
  });

  // Month-to-month Production Order pool:
  // selected month total = previous month ending PO balance + new POs created in selected month.
  // This gives the true workload available at the start of the selected month's operations.
  const priorMonthEnd = new Date(cy, cm, 0, 23, 59, 59, 999);
  let priorPoBalanceWt = 0;
  poList.forEach(poItem => {
      const poDate = new Date(poItem.date);
      if (Number.isNaN(poDate.getTime()) || poDate > priorMonthEnd) return;
      const matchedItem = masterMap.get(`${String(poItem.profile).trim()}_${cleanLen(poItem.length)}_${poItem.itemCode}`)
          || masterData.find(m => String(m.profile).trim() === String(poItem.profile).trim() && cleanLen(m.length) === cleanLen(poItem.length));
      const uw = matchedItem ? (Number(matchedItem.unitWeight) || 0) : 0;
      const orderQty = Math.max(0, parseInt(poItem.orderQty) || 0);
      const shippedBeforeMonth = shipmentList.filter(sh => {
          const sd = new Date(sh.date);
          return !Number.isNaN(sd.getTime()) && sd <= priorMonthEnd
              && String(sh.poNumber).trim() === String(poItem.poNumber).trim()
              && String(sh.profile).trim() === String(poItem.profile).trim()
              && cleanLen(sh.length) === cleanLen(poItem.length);
      }).reduce((sum, sh) => sum + (Math.max(0, parseInt(sh.shippedQty) || 0)), 0);
      priorPoBalanceWt += Math.max(0, orderQty - Math.min(orderQty, shippedBeforeMonth)) * uw;
  });
  let selectedMonthNewPoWt = 0;
  selectedPoList.forEach(poItem => {
      const matchedItem = masterMap.get(`${String(poItem.profile).trim()}_${cleanLen(poItem.length)}_${poItem.itemCode}`)
          || masterData.find(m => String(m.profile).trim() === String(poItem.profile).trim() && cleanLen(m.length) === cleanLen(poItem.length));
      const uw = matchedItem ? (Number(matchedItem.unitWeight) || 0) : 0;
      selectedMonthNewPoWt += Math.max(0, parseInt(poItem.orderQty) || 0) * uw;
  });
  const monthProductionPoolWt = priorPoBalanceWt + selectedMonthNewPoWt;
  const monthShipmentCompleteWt = selectedMonthShipmentWt;
  const monthProductionBalanceWt = Math.max(0, monthProductionPoolWt - monthShipmentCompleteWt);

  let overdueHtml = '';
  Object.keys(overduePoGroups).forEach((poNumber) => {
      const group = overduePoGroups[poNumber];
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
          const shippedQty = Math.max(0, overdueShipLookup.get(shipKey) || 0);
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
      if (diffDays >= 30 && overdueLines.length > 0) {
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
      document.getElementById('kpiOverallPoTotal').textContent = `${monthProductionPoolWt.toFixed(1)} kg`;
      
      let poBreakdownHtml = `
      <div style="padding-top: 10px; border-top: 2px dashed #bae6fd; font-weight: 800; font-size: 12px; background: rgba(2, 132, 199, 0.05); border-radius: 8px; margin-top: auto; display:flex; flex-direction:column; gap:6px; padding-bottom:4px; padding-left: 8px; padding-right: 8px;">
          <div style="display:flex; justify-content:space-between; color: var(--text-muted);"><span><i class="fa-solid fa-layer-group"></i> Previous Balance + New PO:</span> <span style="color:#0369a1;">${monthProductionPoolWt.toFixed(2)} kg</span></div>
          <div style="display:flex; justify-content:space-between; color: #059669;"><span><i class="fa-solid fa-truck-fast"></i> Shipment Complete:</span> <span>${monthShipmentCompleteWt.toFixed(2)} kg</span></div>
          <div style="display:flex; justify-content:space-between; color: #e11d48;"><span><i class="fa-solid fa-hourglass-half"></i> Production Balance:</span> <span>${monthProductionBalanceWt.toFixed(2)} kg</span></div>
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
      if (parts.length === 3 && parts[0] === String(dashboardPlMonth||'').trim() && parts[1] === String(dashboardPlContainer||'').trim()) {
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
  let chartCutWt = 0, chartPunchWt = 0, chartWrapWt = 0, chartBoxWt = 0, chartCrateWt = 0, chartManualWt = 0, chartPendingWt = 0;
  
  let crateMapForChart = {};
  for(let i=1; i<=50; i++) { crateMapForChart["Crate " + i] = { req: 0, comp: 0, items: [] }; }
  
  let availableStockPL = masterData.map(m => ({ ...m }));
  // IMPORTANT: use only the active/current Packing List (month + container).
  // Historical/completed PL containers are excluded from this dashboard chart.
  activePlRecords.forEach(pl => {
      let reqQty = pl.pcsQty;
      let matched = availableStockPL.find(m => String(m.profile).trim() === String(pl.profile).trim() && cleanLen(m.length) === cleanLen(pl.length) && m.itemCode === pl.itemCode);
      let uw = matched ? (matched.unitWeight || 0) : 0;
      
      plReqWt += (reqQty * uw);
      
      let allocatedBox = 0, allocatedWrap = 0, allocatedPunch = 0, allocatedCut = 0;
      let remReq = reqQty;
      
      let allocatedCrate = 0;
      if (matched) {
          // Keep Box and Crate separate so the dashboard can report the true
          // Packing List completion weight (Wrap + Box + Crate).
          allocatedCrate = Math.min(remReq, matched.crateQty || 0);
          matched.crateQty = Math.max(0, (matched.crateQty || 0) - allocatedCrate);
          remReq -= allocatedCrate;

          allocatedBox = Math.min(remReq, matched.boxQty || 0);
          matched.boxQty = Math.max(0, (matched.boxQty || 0) - allocatedBox);
          remReq -= allocatedBox;

          allocatedWrap = Math.min(remReq, matched.wrapQty || 0); matched.wrapQty = Math.max(0, (matched.wrapQty || 0) - allocatedWrap); remReq -= allocatedWrap;
          allocatedPunch = Math.min(remReq, matched.punchQty || 0); matched.punchQty = Math.max(0, (matched.punchQty || 0) - allocatedPunch); remReq -= allocatedPunch;
          allocatedCut = Math.min(remReq, matched.cutQty || 0); matched.cutQty = Math.max(0, (matched.cutQty || 0) - allocatedCut); remReq -= allocatedCut;
      }
      
      if (!crateMapForChart[pl.crateNo]) crateMapForChart[pl.crateNo] = { req: 0, comp: 0, items: [] };
      crateMapForChart[pl.crateNo].req += reqQty;
      crateMapForChart[pl.crateNo].comp += allocatedBox;
      crateMapForChart[pl.crateNo].items.push({ req: reqQty, box: allocatedBox, crate: allocatedCrate, wrap: allocatedWrap, punch: allocatedPunch, cut: allocatedCut, pending: remReq, unitWeight: uw });
  });

  for (let crateId in crateMapForChart) {
      let crate = crateMapForChart[crateId];
      if (crate.req === 0) continue;
      
      let isManualComplete = isManualCrateComplete(crateId, dashboardPlContainer, dashboardPlMonth) ? true : false;
      
      crate.items.forEach(i => {
          let w = i.unitWeight;
          if (isManualComplete) {
              // A manually completed crate belongs to the Crate stage for the
              // dashboard PL progress chart. Do not show a separate
              // "Completed" slice; the chart is intentionally limited to
              // Cut, Punch, Wrapping, Box, Crate and Pending.
              chartCrateWt += (i.req * w);
          } else {
              chartBoxWt += (i.box * w);
              chartCrateWt += (i.crate * w);
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
          if(document.getElementById('masterWeightChart')) { safeChartDestroy(masterChartInstance, 'masterWeightChart'); let mData = [ Number(totalCutWt.toFixed(2)), Number(totalPunchWt.toFixed(2)), Number(totalWrapWt.toFixed(2)), Number(totalBoxWt.toFixed(2)), Number(totalCrateWt.toFixed(2)) ]; if (mData.every(v => v === 0)) mData = [1]; masterChartInstance = new Chart(document.getElementById('masterWeightChart'), { type: 'doughnut', data: { labels: mData.length === 1 ? ['No Stock'] : ['Cut', 'Punch', 'Wrap', 'Box', 'Crate'], datasets: [{ hoverOffset: 10, data: mData, backgroundColor: mData.length === 1 ? ['#e2e8f0'] : ['#0ea5e9', '#ea580c', '#d946ef', '#10b981', '#f59e0b'], borderWidth: isDarkMode ? 3 : 2, borderColor: isDarkMode ? '#1e293b' : '#fff' }] }, options: { ...dashboardChartOptions(textColor, mData.length > 1), cutout: '65%' } }); }
          
          if(document.getElementById('overallPoChart')) { 
              safeChartDestroy(overallPoChartInstance, 'overallPoChart'); 
              // Monthly PO workload chart: previous month's ending balance + new POs,
              // then show the selected month's shipment completion by container and the remaining balance.
              let poDataArr = [
                  shipContainerMonthWeights['1st Container'],
                  shipContainerMonthWeights['2nd Container'],
                  shipContainerMonthWeights['3rd Container'],
                  monthProductionBalanceWt
              ];
              if (poDataArr.every(v => v === 0)) poDataArr = [1];
              overallPoChartInstance = new Chart(document.getElementById('overallPoChart'), { type: 'doughnut', data: { labels: poDataArr.length === 1 ? ['No Orders'] : ['1st Shipment', '2nd Shipment', '3rd Shipment', 'Production Balance'], datasets: [{ hoverOffset: 10, data: poDataArr, backgroundColor: poDataArr.length === 1 ? ['#e2e8f0'] : ['#3b82f6', '#ec4899', '#a855f7', '#fb7185'], borderWidth: isDarkMode ? 3 : 2, borderColor: isDarkMode ? '#1e293b' : '#fff' }] }, options: { ...dashboardChartOptions(textColor, poDataArr.length > 1), cutout: '65%' } }); 
          }
          
          if(document.getElementById('overallPlChart')) { 
              safeChartDestroy(overallPlChartInstance, 'overallPlChart'); 
              const plCompleteWt = Math.min(plReqWt, chartWrapWt + chartBoxWt + chartCrateWt + chartManualWt);
              const plWaitingWt = Math.min(Math.max(0, plReqWt - plCompleteWt), chartCutWt + chartPunchWt);
              const plPendingWt = Math.max(0, plReqWt - plCompleteWt - plWaitingWt);
              const plCompletePct = plReqWt > 0 ? (plCompleteWt / plReqWt) * 100 : 0;
              const plWaitingPct = plReqWt > 0 ? (plWaitingWt / plReqWt) * 100 : 0;
              const plPendingPct = plReqWt > 0 ? (plPendingWt / plReqWt) * 100 : 0;

              // Active Packing List doughnut: only the six live PL stages.
              // Previous/completed Packing Lists are already excluded by activePlRecords.
              // Manual-completed crates are counted inside the Crate slice above.
              let cData = [
                  Number(chartCutWt.toFixed(2)) || 0,
                  Number(chartPunchWt.toFixed(2)) || 0,
                  Number(chartWrapWt.toFixed(2)) || 0,
                  Number(chartBoxWt.toFixed(2)) || 0,
                  Number(chartCrateWt.toFixed(2)) || 0,
                  Number(chartPendingWt.toFixed(2)) || 0
              ];
              if(cData.every(v => v===0)) cData = [1];
              overallPlChartInstance = new Chart(document.getElementById('overallPlChart'), {
                  type: 'doughnut',
                  data: {
                      labels: cData.length===1 ? ['No PLs'] : ['Cut', 'Punch', 'Wrapping', 'Box', 'Crate', 'Pending'],
                      datasets: [{
                          hoverOffset: 8,
                          data: cData,
                          backgroundColor: cData.length===1 ? ['#e2e8f0'] : ['#0284c7', '#ea580c', '#d946ef', '#10b981', '#f59e0b', '#e11d48'],
                          borderWidth: isDarkMode ? 3 : 2,
                          borderColor: isDarkMode ? '#1e293b' : '#fff'
                      }]
                  },
                  options: { ...dashboardChartOptions(textColor, false), cutout: '65%' }
              });

              let plWeightBreakdownHtml = `
              <div class="pl-dashboard-breakdown-list">
                <div class="pl-progress-summary">
                  <div class="pl-progress-row pl-complete">
                    <div class="pl-progress-label"><span><i class="fa-solid fa-circle-check"></i> PL Complete Weight</span><b>${plCompleteWt.toFixed(2)} kg</b></div>
                    <div class="pl-progress-track"><span style="width:${Math.min(100, plCompletePct).toFixed(2)}%"></span></div>
                    <div class="pl-progress-meta"><span>Wrapping + Box + Crate</span><b>${plCompletePct.toFixed(1)}%</b></div>
                  </div>
                  <div class="pl-progress-row pl-waiting">
                    <div class="pl-progress-label"><span><i class="fa-solid fa-hourglass-half"></i> Waiting / Processing Weight</span><b>${plWaitingWt.toFixed(2)} kg</b></div>
                    <div class="pl-progress-track"><span style="width:${Math.min(100, plWaitingPct).toFixed(2)}%"></span></div>
                    <div class="pl-progress-meta"><span>Cut + Punch</span><b>${plWaitingPct.toFixed(1)}%</b></div>
                  </div>
                  <div class="pl-progress-row pl-pending">
                    <div class="pl-progress-label"><span><i class="fa-solid fa-clock"></i> Pending Weight</span><b>${plPendingWt.toFixed(2)} kg</b></div>
                    <div class="pl-progress-track"><span style="width:${Math.min(100, plPendingPct).toFixed(2)}%"></span></div>
                    <div class="pl-progress-meta"><span>Remaining PL requirement</span><b>${plPendingPct.toFixed(1)}%</b></div>
                  </div>
                </div>
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
                  safeChartDestroy(rejectDashChart, 'rejectDashboardChart'); 
                  let rData = [Number(mRejWt.toFixed(2)), Number(mRecWt.toFixed(2)), Number(netRej.toFixed(2))]; 
                  if(rData.every(v=>v===0)) rData = [0,0,0]; 
                  rejectDashChart = new Chart(ctx, { type: 'bar', data: { labels: ['Reject', 'Recover', 'Net Rej'], datasets: [{ data: rData, backgroundColor: ['#e11d48', '#10b981', '#9f1239'], borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: {color: textColor} }, x: { ticks: {color: textColor} } } } }); 
              }
              
              const ctxProf = document.getElementById('rejectProfileChart'); 
              if(ctxProf) { 
                  safeChartDestroy(rejectProfileChartInstance, 'rejectProfileChart'); 
                  let profLabels = Object.keys(profileRejMap); 
                  let profData = Object.values(profileRejMap).map(v => Number(v.toFixed(2))); 
                  const bgColors = ['#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981', '#22c55e', '#84cc16', '#eab308', '#f59e0b', '#f97316']; 
                  if(profLabels.length === 0) { profLabels = ['No Data']; profData = [1]; } 
                  rejectProfileChartInstance = new Chart(ctxProf, { type: 'doughnut', data: { labels: profLabels, datasets: [{ data: profData, backgroundColor: profLabels[0] === 'No Data' ? ['#e2e8f0'] : bgColors.slice(0, profLabels.length), borderWidth: isDarkMode ? 2 : 1, borderColor: isDarkMode ? '#1e293b' : '#fff' }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { position: 'right', labels: { color: textColor, boxWidth: 12, font: { size: 10 } } } } } }); 
              }
          }
      }
  } catch(err) { console.error('Dashboard render error:', err); showToast('Dashboard script error: ' + (err?.message || err), 'error'); }
  try { renderMonthlyShiftChart(); renderMonthlyTeamProductionChart(); } catch (err) { console.error('Monthly dashboard chart error:', err); showToast('Dashboard chart error: ' + (err?.message || 'Unable to render monthly chart.'), 'error'); }
  recoveryMonthReminder();
}

function renderMonthlyShiftChart() {
    const ctx = document.getElementById('monthlyShiftChart'); if(!ctx || typeof Chart === 'undefined') return;
    safeChartDestroy(monthlyShiftChartInstance, 'monthlyShiftChart');
    const now = new Date(); const key = dashboardSelectedMonth || `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`; const [selectedYear, selectedMonthNum] = key.split('-').map(Number); const currentYear = selectedYear || now.getFullYear(); const currentMonth = (selectedMonthNum||now.getMonth()+1)-1;
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const labels = [], dayWrapData = [], nightWrapData = [], dayRejectData = [], nightRejectData = [], dayNetRejectData = [], nightNetRejectData = [];
    const dailyCutStageData = [], dailyPunchStageData = [], dailyWrapStageData = [], dailyBoxStageData = [], dailyCrateStageData = [];
    let monthPunchWeight = 0, monthBoxWeight = 0, monthCrateWeight = 0;
    const lookupMap = new Map();
    masterData.forEach(m => lookupMap.set(`${String(m.profile).trim()}_${cleanLen(m.length)}_${String(m.itemCode||'').trim().toLowerCase()}`, m));

    let monthWrapWeight = 0, monthCutWeight = 0, monthRejectWeight = 0, monthRecoverWeight = 0;
    let monthNetRejectWeight = 0, monthWrapPcs = 0;
    const dailySummary = [];

    for(let d = 1; d <= daysInMonth; d++) {
        labels.push(`${d}`);
        const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        let dayWrap=0, nightWrap=0, dayCut=0, nightCut=0, dayReject=0, nightReject=0, dayRecover=0, nightRecover=0, dayPcs=0, nightPcs=0;
        let stageCutWt=0, stagePunchWt=0, stageWrapWt=0, stageBoxWt=0, stageCrateWt=0;

        historyLogs.filter(h => h.date === dateKey).forEach(log => {
            // Production output is measured from WRAPPING PCS, not by summing every stage.
            // This prevents Cut + Punch + Wrap from being counted three times.
            const item = lookupMap.get(`${String(log.profile).trim()}_${cleanLen(log.length)}_${String(log.itemCode||'').trim().toLowerCase()}`)
                      || masterData.find(m => String(m.profile).trim()===String(log.profile).trim() && cleanLen(m.length)===cleanLen(log.length));
            const uw = item ? (Number(item.unitWeight)||0) : 0;
            const wrapPcs = Number(log.wrapQty)||0;
            const cutPcs = Number(log.cutQty)||0;
            const punchPcs = Number(log.punchQty)||0;
            const boxPcs = Number(log.boxQty)||0;
            const cratePcs = Number(log.crateQty)||0;
            const wrapWt = wrapPcs * uw;
            const cutWt = cutPcs * uw;
            stageCutWt += cutWt; stagePunchWt += punchPcs * uw; stageWrapWt += wrapWt;
            stageBoxWt += boxPcs * uw; stageCrateWt += cratePcs * uw;
            if(String(log.shift).toLowerCase().includes('night')) { nightWrap += wrapWt; nightCut += cutWt; nightPcs += wrapPcs; }
            else { dayWrap += wrapWt; dayCut += cutWt; dayPcs += wrapPcs; }
        });
        rejectLogs.filter(r => r.reject_date === dateKey).forEach(r => {
            const wt=Number(r.weight)||0;
            if(String(r.shift||'').toLowerCase().includes('night')) nightReject += wt; else dayReject += wt;
        });
        recoveryWrapLogs.filter(r => r.wrap_date === dateKey).forEach(r => {
            const wt=Number(r.wrap_weight)||0;
            dayRecover += wt;
        });

        const dayNet=Math.max(0,dayReject-dayRecover), nightNet=Math.max(0,nightReject-nightRecover);
        dayWrapData.push(Number(dayWrap.toFixed(2))); nightWrapData.push(Number(nightWrap.toFixed(2)));
        dailyCutStageData.push(Number(stageCutWt.toFixed(2))); dailyPunchStageData.push(Number(stagePunchWt.toFixed(2)));
        dailyWrapStageData.push(Number(stageWrapWt.toFixed(2))); dailyBoxStageData.push(Number(stageBoxWt.toFixed(2))); dailyCrateStageData.push(Number(stageCrateWt.toFixed(2)));
        monthPunchWeight += stagePunchWt; monthBoxWeight += stageBoxWt; monthCrateWeight += stageCrateWt;
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
    if(chartTitleNode) chartTitleNode.innerHTML = `<i class="fa-solid fa-chart-simple"></i> Monthly Daily Production by Stage (kg)`;
    let totalDisplaySpan = document.getElementById('monthlyTotalDisplay');
    if (!totalDisplaySpan) { totalDisplaySpan=document.createElement('div'); totalDisplaySpan.id='monthlyTotalDisplay'; totalDisplaySpan.style.cssText="font-size:13.5px;font-weight:800;color:#0369a1;background:#e0f2fe;padding:8px 15px;border-radius:8px;border:1px solid #bae6fd;margin-bottom:15px;width:100%;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;"; ctx.closest('.card').insertBefore(totalDisplaySpan,ctx.parentElement); }
    totalDisplaySpan.innerHTML=`<span><i class="fa-solid fa-weight-scale"></i> ${new Date(currentYear,currentMonth,1).toLocaleDateString('en-US',{month:'long',year:'numeric'})} • Cut <b>${monthCutWeight.toFixed(2)} kg</b> · Punch <b>${monthPunchWeight.toFixed(2)} kg</b> · Wrap <b>${monthWrapWeight.toFixed(2)} kg</b> · Box <b>${monthBoxWeight.toFixed(2)} kg</b> · Crate <b>${monthCrateWeight.toFixed(2)} kg</b></span><span style="color:#9f1239;">Net Reject: <b>${monthNetRejectWeight.toFixed(2)} kg</b></span>`;

    // Update the dashboard heading target if it exists.
    const summaryCard = document.getElementById('monthlyProductionSummary');
    if(summaryCard) summaryCard.innerHTML = `
      <div class="prod-summary-title"><i class="fa-solid fa-gauge-high"></i> Production Performance — ${new Date(currentYear,currentMonth,1).toLocaleDateString('en-US',{month:'long',year:'numeric'})}</div>
      <div class="prod-summary-grid">
        <div class="prod-metric daily"><span>Today Wrapping</span><b id="dashDailyWrapWeight">${today.wrap.toFixed(2)} kg</b><small>${today.wrapPcs.toLocaleString()} Pcs • Wrap/Cut <span id="dashDailyWrapEfficiencyPct">${todayWrapEfficiencyPct.toFixed(1)}%</span></small></div>
        <div class="prod-metric monthly"><span id="dashMonthlyWrapLabel">Monthly Wrapping</span><b id="dashMonthlyWrapWeight">${monthWrapWeight.toFixed(2)} kg</b><small>${monthWrapPcs.toLocaleString()} Pcs • Wrap/Cut ${monthWrapEfficiencyPct.toFixed(1)}%</small></div>
        <div class="prod-metric reject"><span id="dashMonthlyRejectLabel">Monthly Reject</span><b id="dashMonthlyRejectWeight">${monthRejectWeight.toFixed(2)} kg</b><small>${monthRejectPct.toFixed(1)}% of wrapping</small></div>
        <div class="prod-metric recover"><span>Monthly Recover</span><b id="dashMonthlyRecoverWeight">${monthRecoverWeight.toFixed(2)} kg</b><small>${monthRecoveryPct.toFixed(1)}% of reject</small></div>
        <div class="prod-metric net"><span>Net Reject</span><b id="dashMonthlyNetRejectWeight">${monthNetRejectWeight.toFixed(2)} kg</b><small>${monthNetRejectPct.toFixed(1)}% of wrapping</small></div>
      </div>`;

    const chartCanvas=ctx.getContext('2d'), textColor=isDarkMode?'#f8fafc':'#0f172a', gridColor=isDarkMode?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.06)';
    monthlyShiftChartInstance=new Chart(chartCanvas,{type:'bar',data:{labels,datasets:[
      {label:'Cut',data:dailyCutStageData,backgroundColor:'#0ea5e9',borderColor:'#0284c7',borderWidth:1,borderRadius:3},
      {label:'Punch',data:dailyPunchStageData,backgroundColor:'#f59e0b',borderColor:'#d97706',borderWidth:1,borderRadius:3},
      {label:'Day Wrapping',data:dayWrapData,backgroundColor:'#10b981',borderColor:'#059669',borderWidth:1,borderRadius:3},
      {label:'Night Wrapping',data:nightWrapData,backgroundColor:'#14b8a6',borderColor:'#0f766e',borderWidth:1,borderRadius:3},
      {label:'Box',data:dailyBoxStageData,backgroundColor:'#8b5cf6',borderColor:'#7c3aed',borderWidth:1,borderRadius:3},
      {label:'Crate',data:dailyCrateStageData,backgroundColor:'#64748b',borderColor:'#475569',borderWidth:1,borderRadius:3}
    ]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:true,position:'bottom',labels:{color:textColor,usePointStyle:true,boxWidth:8,padding:10,font:{size:10}}},tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${Number(c.raw||0).toFixed(2)} kg`}}},scales:{x:{grid:{display:false},ticks:{color:textColor,maxTicksLimit:16,font:{size:9}},title:{display:true,text:'Day of Month',color:textColor,font:{size:10}}},y:{beginAtZero:true,grid:{color:gridColor,borderDash:[4,4]},ticks:{color:textColor,font:{size:9}},title:{display:true,text:'Stage Weight (kg)',color:textColor,font:{size:10}}}}}});

}

function renderMonthlyTeamProductionChart() {
    const canvas = document.getElementById('monthlyTeamContributionChart');
    if (!canvas || typeof Chart === 'undefined') return;
    safeChartDestroy(monthlyTeamContributionChartInstance, 'monthlyTeamContributionChart');
    const now = new Date();
    const key = dashboardSelectedMonth || `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const [selectedYear, selectedMonthNum] = key.split('-').map(Number);
    const year = selectedYear || now.getFullYear();
    const month = (selectedMonthNum || now.getMonth()+1) - 1;
    const monthPrefix = `${year}-${String(month+1).padStart(2,'0')}`;
    const teamNames = ['Team A','Team B','Team C'];
    const teamColors = ['#0f766e','#2563eb','#d97706'];
    const teamTotals = Object.fromEntries(teamNames.map(team => [team,{cut:0,punch:0,wrap:0,box:0,total:0,records:0}]));
    let unassignedLegacyCount = 0;
    let unresolvedWeightCount = 0;
    historyLogs.forEach(log => {
        if (!String(log.date || '').startsWith(monthPrefix)) return;
        const team = String(log.team || '').trim();
        if (!teamNames.includes(team)) { unassignedLegacyCount++; return; }
        // history_logs currently stores profile + length but not item_code. Avoid silently
        // choosing the wrong unit weight if the Master Catalog has ambiguous matches.
        const matches = masterData.filter(m => String(m.profile).trim() === String(log.profile).trim() && cleanLen(m.length) === cleanLen(log.length));
        const distinctWeights = [...new Set(matches.map(m => Number(m.unitWeight) || 0))];
        if (!matches.length || distinctWeights.length !== 1 || !(distinctWeights[0] > 0)) {
            unresolvedWeightCount++;
            return;
        }
        const unitWeight = distinctWeights[0];
        const totals = teamTotals[team];
        totals.cut += (Number(log.cutQty) || 0) * unitWeight;
        totals.punch += (Number(log.punchQty) || 0) * unitWeight;
        totals.wrap += (Number(log.wrapQty) || 0) * unitWeight;
        // Existing history stores box_qty as pieces; convert it using Master Catalog unit weight.
        totals.box += (Number(log.boxQty) || 0) * unitWeight;
        totals.records++;
    });
    teamNames.forEach(team => {
        const t = teamTotals[team];
        // This is stage-activity contribution (Cut + Punch + Wrapping + Box), not unique finished-product weight.
        totalsSafe(t);
        t.total = t.cut + t.punch + t.wrap + t.box;
    });
    function totalsSafe(t) {
        ['cut','punch','wrap','box'].forEach(k => { if (!Number.isFinite(t[k])) t[k] = 0; });
    }
    const monthlyTotal = teamNames.reduce((sum,team) => sum + (Number(teamTotals[team].total) || 0), 0);
    const hasTeamData = monthlyTotal > 0;
    const summary = document.getElementById('monthlyTeamContributionSummary');
    if (summary) {
        summary.innerHTML = teamNames.map((team,i) => {
            const t = teamTotals[team];
            const share = monthlyTotal > 0 ? (t.total / monthlyTotal * 100) : 0;
            return `<div style="flex:1;min-width:115px;padding:7px 10px;border-radius:8px;border:1px solid ${teamColors[i]}33;background:${teamColors[i]}0d;font-size:10.5px;"><b style="color:${teamColors[i]}">${team}</b><div style="font-size:14px;font-weight:900;color:var(--text-color);margin-top:2px;">${t.total.toFixed(2)} kg <span style="font-size:10px;font-weight:700;">(${share.toFixed(1)}%)</span></div><small style="color:var(--text-muted);">Cut ${t.cut.toFixed(1)} · Punch ${t.punch.toFixed(1)} · Wrap ${t.wrap.toFixed(1)} · Box ${t.box.toFixed(1)} kg</small></div>`;
        }).join('') + (!hasTeamData ? `<div style="width:100%;padding:8px 10px;border:1px dashed var(--border-color);border-radius:8px;background:var(--surface-color, rgba(148,163,184,.06));font-size:10.5px;color:var(--text-muted);"><b>No Team A/B/C production weight is available for this month yet.</b> Select Team A, Team B or Team C in Daily Production Entry and save a production record. The chart will update automatically; existing unassigned history is preserved.</div>` : '') + (unassignedLegacyCount ? `<div style="width:100%;font-size:10px;color:var(--text-muted);">${unassignedLegacyCount} record(s) for this month have no Team A/B/C assignment. They remain unchanged and are excluded from team totals.</div>` : '') + (unresolvedWeightCount ? `<div style="width:100%;font-size:10px;color:var(--text-muted);">${unresolvedWeightCount} Team-assigned record(s) could not be weighted safely because the matching Master Catalog unit weight is missing or ambiguous. These records are excluded rather than assigned an estimated weight.</div>` : '');
    }
    const textColor = isDarkMode ? '#f8fafc' : '#0f172a';
    const centerTextPlugin = {
        id: 'monthlyTeamCenterText',
        afterDraw(chart) {
            const {ctx, chartArea} = chart;
            if (!chartArea) return;
            const x = (chartArea.left + chartArea.right) / 2;
            const y = (chartArea.top + chartArea.bottom) / 2;
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = textColor;
            ctx.font = hasTeamData ? '700 10px sans-serif' : '700 9px sans-serif';
            ctx.fillText(hasTeamData ? 'MONTH TOTAL' : 'NO TEAM DATA', x, y - 9);
            ctx.font = '900 13px sans-serif';
            ctx.fillText(`${monthlyTotal.toFixed(2)} kg`, x, y + 8);
            ctx.restore();
        }
    };
    const chartCtx = canvas.getContext('2d');
    monthlyTeamContributionChartInstance = new Chart(chartCtx, {
        type: 'doughnut',
        data: {
            labels: teamNames,
            datasets: [{
                label: 'Team contribution',
                // Chart.js does not draw doughnut arcs when every value is zero.
                // Use a neutral placeholder ring only for the no-data state; never imply team contributions.
                data: hasTeamData ? teamNames.map(team => Number(teamTotals[team].total.toFixed(2))) : [1,1,1],
                backgroundColor: hasTeamData ? teamColors : ['#e2e8f0','#cbd5e1','#94a3b8'],
                borderColor: isDarkMode ? '#1e293b' : '#ffffff',
                borderWidth: 2,
                hoverOffset: 5
            }]
        },
        plugins: [centerTextPlugin],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '66%',
            plugins: {
                legend: {display:hasTeamData, position:'bottom', labels:{color:textColor,usePointStyle:true,boxWidth:8,padding:10,font:{size:10}}},
                tooltip: {enabled:hasTeamData, callbacks: {
                    label: c => {
                        const value = Number(c.raw || 0);
                        const pct = monthlyTotal > 0 ? (value / monthlyTotal * 100) : 0;
                        return ` ${c.label}: ${value.toFixed(2)} kg (${pct.toFixed(1)}%)`;
                    }
                }}
            }
        }
    });
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

function getActivePackingListSelection() {
    const months = getPackingMonths();
    const month = activePackingMonth && months.includes(activePackingMonth)
        ? activePackingMonth
        : (months[0] || new Date().toLocaleString('en-US',{month:'long'}));
    const containers = getContainerList();
    const withData = containers.filter(c => getPackingContainerRecords(month,c).length > 0);
    // The active PL is always the latest PL with data that has not been completed.
    // Older PLs (1st/2nd containers) are historical/shipped and must never affect
    // the Balance Work PL calculation. If all available PLs are completed, use
    // the latest one only as a safe fallback.
    const incomplete = withData.filter(c => !isPackingShipmentComplete(month,c));
    const pool = incomplete.length ? incomplete : withData;
    const selected = pool.slice().sort((a,b)=>getContainerNumber(b)-getContainerNumber(a))[0] || containers[0] || '1st Container';
    return { month, container: selected };
}

function getActivePlBalanceMap() {
    const active = getActivePackingListSelection();
    const records = getPackingContainerRecords(active.month, active.container);
    const map = new Map();
    records.forEach(pl => {
        const key = `${String(pl.profile).trim()}_${String(pl.itemCode).trim()}_${cleanLen(pl.length)}`;
        const existing = map.get(key) || { profile: pl.profile, itemCode: pl.itemCode, length: pl.length, qty: 0 };
        existing.qty += Math.max(0, Number(pl.pcsQty) || 0);
        map.set(key, existing);
    });
    map.forEach(v => {
        const m = masterData.find(x => String(x.profile).trim() === String(v.profile).trim() && String(x.itemCode).trim() === String(v.itemCode).trim() && cleanLen(x.length) === cleanLen(v.length));
        // Current production stock is the stock available now. Historical PLs
        // are deliberately NOT added to this requirement. Their shipped quantities
        // are already removed from Crate Stock by the shipment workflow.
        const currentStock = m ? ((m.cutQty||0)+(m.punchQty||0)+(m.wrapQty||0)+(m.boxQty||0)+(m.crateQty||0)) : 0;
        v.currentStock = currentStock;
        v.balance = currentStock - v.qty;
        v.activeMonth = active.month;
        v.activeContainer = active.container;
    });
    return map;
}
function getPlBalanceFilterValue(id) { return document.getElementById(id)?.value || 'all'; }
function matchesBalanceFilter(balance, mode) {
    if (mode === 'pending' || mode === 'pending_po') return Number(balance) < 0;
    if (mode === 'available' || mode === 'available_po') return Number(balance) >= 0;
    return true;
}
function isProductionOrderBalanceMode(mode) { return mode === 'all_po' || mode === 'pending_po' || mode === 'available_po'; }
function updateBalanceFilterInfo() {
    const active = getActivePackingListSelection();
    const activeLabel = `${active.month || ''} • ${active.container || ''}`.replace(/^ • | • $/g,'');
    const mode = getPlBalanceFilterValue('balancePlFilter');
    let text = 'Showing all active PL lines.';
    if (mode === 'pending') text = 'Showing only active PL lines with pending balance.';
    else if (mode === 'available') text = 'Showing only active PL lines with available balance.';
    else if (mode === 'all_po') text = 'Showing all Production Order balance lines.';
    else if (mode === 'pending_po') text = 'Showing only Production Orders with pending balance.';
    else if (mode === 'available_po') text = 'Showing only Production Orders with available balance.';
    const el = document.getElementById('balancePlFilterInfo'); if(el) el.textContent = `${activeLabel} — ${text}`;
    const el2 = document.getElementById('plSummaryBalanceFilterInfo'); if(el2) el2.textContent = `${activeLabel} — ${text}`;
}

function renderBalanceWorkTable() {
    try {
        const tbody = document.getElementById('balanceWorkTableBody'); if(!tbody) return;
        ensurePackingSelection();
        const activePlMap = getActivePlBalanceMap();
        const filterMode = getPlBalanceFilterValue('balancePlFilter');
        const poMode = isProductionOrderBalanceMode(filterMode);
        updateBalanceFilterInfo();
        let html = '';
        let visibleRows = 0;
        if (masterData.length === 0) {
            html = `<tr><td colspan="14" style="color:#888;text-align:center;">No profiles available.</td></tr>`;
        } else {
            const shipMap = new Map();
            shipmentList.forEach(s => { const k = `${String(s.poNumber).trim()}_${String(s.profile).trim()}_${cleanLen(s.length)}`; shipMap.set(k, (shipMap.get(k) || 0) + (Number(s.shippedQty)||0)); });
            masterData.forEach(item => {
                const key = `${String(item.profile).trim()}_${String(item.itemCode).trim()}_${cleanLen(item.length)}`;
                const plInfo = activePlMap.get(key);

                let currentStockTotal = (item.cutQty || 0) + (item.punchQty || 0) + (item.wrapQty || 0) + (item.boxQty || 0);
                const crateQty = item.crateQty || 0;
                let unshippedPoTotal = 0;
                poList.forEach(po => {
                    if (String(po.profile).trim() === String(item.profile).trim() && cleanLen(po.length) === cleanLen(item.length)) {
                        const shippedForPo = shipMap.get(`${String(po.poNumber).trim()}_${String(po.profile).trim()}_${cleanLen(po.length)}`) || 0;
                        unshippedPoTotal += Math.max(0, (Number(po.orderQty)||0) - shippedForPo);
                    }
                });

                // Production-order balance = remaining PO quantity after available production stock.
                const poPendingQty = Math.max(0, unshippedPoTotal - (currentStockTotal + crateQty));
                const poBalance = (currentStockTotal + crateQty) - unshippedPoTotal;

                // In Active PL mode, keep the existing PL balance calculation exactly as before.
                // In Production Order mode, use the PO balance instead.
                if (!poMode && !plInfo) return;
                if (poMode && unshippedPoTotal <= 0 && filterMode === 'all_po') return;
                const displayBalance = poMode ? poBalance : plInfo.balance;
                if (!matchesBalanceFilter(displayBalance, filterMode)) return;
                visibleRows++;

                const maxPending = poMode
                    ? poPendingQty
                    : Math.max(poPendingQty, Math.max(0, -(plInfo?.balance || 0)));
                const exLen = parseFloat(item.exLength) || 0, cutLen = parseFloat(item.length) || 0;
                let pcsPerEx = 0, reqEx = '-';
                if (exLen > 0 && cutLen > 0) { pcsPerEx = Math.floor(exLen / cutLen); if(pcsPerEx > 0) reqEx = Math.ceil(maxPending / pcsPerEx); }
                const wipPcs = (item.cutQty || 0) + (item.punchQty || 0) + (item.wrapQty || 0);
                const unboxedAndPendingPcs = maxPending + wipPcs;
                const reqBoxes = Math.ceil(unboxedAndPendingPcs / (item.boxCapacity || 100));
                const cbBalance = getAvailableCardboard(item.profile, item.itemCode, item.length) - reqBoxes;
                const cbStatusHtml = cbBalance >= 0 ? `<span style="color:var(--success-color);font-weight:800;">OK (+${cbBalance})</span>` : `<span style="color:var(--warning-color);font-weight:800;"><i class="fa-solid fa-arrow-down"></i> Short ${Math.abs(cbBalance)}</span>`;
                const bal = displayBalance;
                const balHtml = bal >= 0
                    ? `<span class="bw-badge bw-ok"><i class="fa-solid fa-check"></i> +${formatBalanceInt(bal)} <small>Pcs</small></span>`
                    : `<span class="bw-badge bw-pending-pl"><i class="fa-solid fa-arrow-down"></i> ${formatBalanceInt(Math.abs(bal))} <small>Pcs</small></span>`;
                html += `<tr class="balance-work-row"><td class="bw-profile"><b>${item.profile}</b></td><td class="bw-item"><span>${item.itemCode || '-'}</span></td><td class="bw-length">${formatBalanceLength(item.length)} mm</td><td class="bw-length">${item.exLength ? formatBalanceLength(item.exLength) : '-'} mm</td><td><span class="bw-badge bw-ex">${formatBalanceInt(pcsPerEx)}</span></td><td><span class="bw-badge bw-stock">${formatBalanceInt(currentStockTotal)} <small>Pcs</small></span></td><td><span class="bw-badge bw-crate">${formatBalanceInt(crateQty)} <small>Pcs</small></span></td><td><span class="bw-badge bw-po">${formatBalanceInt(unshippedPoTotal)} <small>Pcs</small></span></td><td><span class="bw-badge ${poPendingQty > 0 ? 'bw-pending-po' : 'bw-ok'}">${formatBalanceInt(poPendingQty)} <small>Pcs</small></span></td><td>${balHtml}</td><td><span class="bw-badge bw-exreq">${reqEx === '-' ? '-' : formatBalanceInt(reqEx)} <small>Ex</small></span></td><td><span class="bw-badge bw-unboxed">${formatBalanceInt(unboxedAndPendingPcs)} <small>Pcs</small></span></td><td><span class="bw-badge bw-boxes">${formatBalanceInt(reqBoxes)} <small>Boxes</small></span></td><td class="bw-cardboard ${cbBalance < 0 ? 'short' : 'ok'}">${cbStatusHtml}</td></tr>`;
            });
        }
        if (!visibleRows && masterData.length) {
            html = `<tr><td colspan="14" style="color:#64748b;text-align:center;padding:24px;font-weight:700;"><i class="fa-solid fa-circle-check" style="color:#10b981;margin-right:6px;"></i>No records match this balance filter.</td></tr>`;
        }
        tbody.innerHTML = html;
    } catch(e) { console.error('Balance Work render error:',e); }
}

function buildActiveBalanceWorkExportData() {
    ensurePackingSelection();
    const activePlMap = getActivePlBalanceMap();
    const mode = getPlBalanceFilterValue('balancePlFilter');
    const poMode = isProductionOrderBalanceMode(mode);
    const shipMap = new Map();
    shipmentList.forEach(s => { const k = `${String(s.poNumber).trim()}_${String(s.profile).trim()}_${cleanLen(s.length)}`; shipMap.set(k, (shipMap.get(k) || 0) + (Number(s.shippedQty)||0)); });
    const out=[];
    masterData.forEach(item=>{
        const key=`${String(item.profile).trim()}_${String(item.itemCode).trim()}_${cleanLen(item.length)}`;
        const v=activePlMap.get(key);
        let unshipped=0;
        poList.forEach(po=>{
            if(String(po.profile).trim()===String(item.profile).trim()&&cleanLen(po.length)===cleanLen(item.length)){
                const shipped=shipMap.get(`${String(po.poNumber).trim()}_${String(po.profile).trim()}_${cleanLen(po.length)}`)||0;
                unshipped += Math.max(0,(Number(po.orderQty)||0)-shipped);
            }
        });
        const stock=(item.cutQty||0)+(item.punchQty||0)+(item.wrapQty||0)+(item.boxQty||0);
        const crate=item.crateQty||0;
        const poBalance=(stock+crate)-unshipped;
        if(!poMode && !v) return;
        if(poMode && unshipped<=0 && mode==='all_po') return;
        const balance=poMode?poBalance:v.balance;
        if(!matchesBalanceFilter(balance,mode)) return;
        const exLen=parseFloat(item.exLength)||0, cutLen=parseFloat(item.length)||0;
        const pcsPerEx=exLen>0&&cutLen>0?Math.floor(exLen/cutLen):0;
        const pending=Math.max(0,-balance);
        const reqEx=pcsPerEx>0?Math.ceil(pending/pcsPerEx):0;
        const wip=(item.cutQty||0)+(item.punchQty||0)+(item.wrapQty||0);
        const unboxed=wip+pending;
        const reqBoxes=Math.ceil(unboxed/(item.boxCapacity||100));
        const cb=getAvailableCardboard(item.profile,item.itemCode,item.length)-reqBoxes;
        out.push({'Profile':item.profile,'Item Code':item.itemCode||'-','Cut L (mm)':item.length,'Ex L (mm)':item.exLength||'-','Pcs / Ex':pcsPerEx,'WIP+Box Stock':stock,'Crate Qty':crate,'Unshipped PO':unshipped,'PO Pending':Math.max(0,unshipped-(stock+crate)),'PL Balance':balance,'Req. Extrusions':reqEx,'Unboxed Pcs':unboxed,'Req. Boxes':reqBoxes,'Cardboard Bal':cb>=0?`OK (+${cb})`:`Short ${Math.abs(cb)}`});
    });
    return out;
}

function exportBalanceWorkExcel() {
    const data=buildActiveBalanceWorkExportData();
    if(!data.length) return showToast('No Balance Work data to export!','warning');
    const modeText=document.getElementById('balancePlFilter')?.selectedOptions?.[0]?.text||'All';
    exportTableToExcel(data,'AIS_Balance_Work','Balance Work - '+modeText);
}
window.exportBalanceWorkPdf=function(){
    const data=buildActiveBalanceWorkExportData();
    if(!data.length) return showToast('No Balance Work data to print!','warning');
    const modeText=document.getElementById('balancePlFilter')?.selectedOptions?.[0]?.text||'All';
    const title=isProductionOrderBalanceMode(getPlBalanceFilterValue('balancePlFilter'))?'AIS Tracker - Balance Work (Production Orders)':'AIS Tracker - Balance Work (Active PL)';
    exportDataToPdf(data,'AIS_Balance_Work',title,`Month: ${activePackingMonth} • ${activePackingContainer} • Filter: ${modeText}`);
};

function populateProfileDropdown() { const select = document.getElementById('selectProfile'); if(!select) return; select.innerHTML = '<option value="">-- Choose Profile --</option>'; [...new Set(masterData.map(i => String(i.profile).trim()))].forEach(p => select.appendChild(new Option(p, p))); }
function onProfileSelect() { const profile = document.getElementById('selectProfile').value; const itemSelect = document.getElementById('selectItemCode'); itemSelect.innerHTML = '<option value="">-- Choose Item Code --</option>'; document.getElementById('selectLength').innerHTML = '<option value="">-- Choose Length --</option>'; if(!profile) { onLengthSelect(); return; } const items = masterData.filter(m => String(m.profile).trim() === profile && m.itemCode); [...new Set(items.map(m => m.itemCode))].forEach(ic => itemSelect.appendChild(new Option(ic, ic))); onLengthSelect(); }
function onItemCodeSelect() { const profile = document.getElementById('selectProfile').value; const itemCode = document.getElementById('selectItemCode').value; const lengthSelect = document.getElementById('selectLength'); lengthSelect.innerHTML = '<option value="">-- Choose Length --</option>'; if(!profile || !itemCode) { onLengthSelect(); return; } const matches = masterData.filter(m => String(m.profile).trim() === profile && m.itemCode === itemCode); matches.forEach(m => lengthSelect.appendChild(new Option(`${m.length} mm`, m.length))); if(matches.length === 1) { lengthSelect.value = matches[0].length; } onLengthSelect(); }
function onLengthSelect() { const profile = document.getElementById('selectProfile').value; const itemCode = document.getElementById('selectItemCode').value; const length = document.getElementById('selectLength').value; const punchGroup = document.getElementById('punchGroup'); if(!profile || !itemCode || !length) { if(typeof updateProductionCardboardAvailability==='function') updateProductionCardboardAvailability(); return; } const matchedCat = masterData.find(m => String(m.profile).trim() === profile && m.itemCode === itemCode && cleanLen(m.length) === cleanLen(length)); if (matchedCat && isPunchBypassed(matchedCat.profile, matchedCat.length)) { punchGroup.style.display = 'none'; document.getElementById('punchQty').value = 0; } else { punchGroup.style.display = 'flex'; } if(typeof updateProductionCardboardAvailability==='function') updateProductionCardboardAvailability(); }
function checkDateStatus() { const dateVal = document.getElementById('entryDate').value; const shiftVal = document.getElementById('shift').value; const banner = document.getElementById('entryStatusBanner'); if (!banner) return; if (!dateVal) { banner.style.display = 'none'; return; } const existing = historyLogs.filter(h => h.date === dateVal && h.shift === shiftVal); if (existing.length > 0) { banner.className = "status-banner status-red"; banner.style.display = "flex"; banner.innerHTML = `<div class="status-banner-content"><div class="status-banner-icon"><i class="fa-solid fa-triangle-exclamation"></i></div><div><div style="font-weight: 800; font-size: 15px;">Entries exist for ${dateVal}</div></div></div>`; } else { banner.className = "status-banner status-green"; banner.style.display = "flex"; banner.innerHTML = `<div class="status-banner-content"><div class="status-banner-icon"><i class="fa-solid fa-circle-check"></i></div><div><div style="font-weight: 800; font-size: 15px;">Ready for New Operations Entry</div></div></div>`; } }
async function deductCardboardBoxesForProduction(profile, itemCode, length, boxesRequested) {
  // Cardboard shortage must not block an otherwise valid Box production movement.
  // Re-read the current balance here (not just in the form preview), then consume
  // only what exists. If none exists, return without creating a negative balance.
  const requested=Math.max(0,Math.floor(Number(boxesRequested)||0));
  if(requested<=0) return null;
  const available=Math.max(0,Math.floor(Number(getAvailableCardboard(profile,itemCode,length))||0));
  const used=Math.min(requested,available);
  if(used<=0) return null;
  const txToken=`TX-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const newEntry={cb_date:new Date().toISOString().split('T')[0],cb_type:cardboardType(profile,itemCode,length)+` | ${txToken}`,incoming:0,used};
  const result=await supabaseClient.from('cardboard_stock').insert([newEntry]);
  if(result.error) throw new Error(dbErrorMessage(result.error,'Cardboard stock deduction failed'));
  const localItem={id:-Date.now(),db_id:null,date:newEntry.cb_date,type:newEntry.cb_type,incoming:0,used,timestamp:new Date().toLocaleTimeString()};
  cardboardStockList.unshift(localItem); saveCardboardLocally(); renderCardboardStock();
  return localItem;
}

function parseCardboardType(type){
  const str=String(type||'');
  const p=(str.match(/Pr:\s*([^|]+)/i)||[])[1]||'';
  const item=(str.match(/Item:\s*([^|]+)/i)||[])[1]||'';
  const len=(str.match(/L:\s*([^|]+)/i)||[])[1]||'';
  return {profile:p.trim(),itemCode:item.trim(),length:len.trim()};
}
function cardboardType(profile,itemCode,length){ return `Pr: ${String(profile||'').trim()} | Item: ${String(itemCode||'-').trim()} | L: ${String(length||'').trim()}`; }
function cardboardRowsFor(profile,itemCode,length){ return cardboardStockList.filter(c=>normalizeCardboardMatch(c.type,{profile,itemCode,length})); }
function getCardboardTransactionsBalance(profile,itemCode,length){ const rows=cardboardRowsFor(profile,itemCode,length); return {incoming:rows.reduce((a,c)=>a+(Number(c.incoming)||0),0),used:rows.reduce((a,c)=>a+(Number(c.used)||0),0)}; }
function renderCardboardStock(){
  const totalEl=document.getElementById('totalCardboardStockDisplay');
  const groups={};
  masterData.forEach(m=>{const key=`${String(m.profile).trim()}|${String(m.itemCode||'').trim()}|${cleanLen(m.length)}`; if(!groups[key]) groups[key]={profile:String(m.profile).trim(),itemCode:m.itemCode||'-',length:m.length,material:m.material||'-',capacity:Number(m.boxCapacity)||100};});
  cardboardStockList.forEach(c=>{const x=parseCardboardType(c.type); const key=`${x.profile}|${x.itemCode}|${cleanLen(x.length)}`; if(!groups[key]) groups[key]={profile:x.profile,itemCode:x.itemCode||'-',length:x.length,material:'-',capacity:100};});
  let total=0; Object.values(groups).forEach(g=>{const b=getCardboardTransactionsBalance(g.profile,g.itemCode,g.length); total += Math.max(0,b.incoming-b.used);});
  if(totalEl) totalEl.textContent=`${total.toLocaleString()} Boxes`;
  const body=document.getElementById('cardboardCapacityTableBody');
  if(body){ const rows=Object.values(groups).sort((a,b)=>String(a.profile).localeCompare(String(b.profile),undefined,{numeric:true})||String(a.itemCode).localeCompare(String(b.itemCode))); body.innerHTML=rows.length?rows.map(g=>{const b=getCardboardTransactionsBalance(g.profile,g.itemCode,g.length);const bal=b.incoming-b.used;const safe=encodeURIComponent(JSON.stringify(g));return `<tr><td>${g.material||'-'}</td><td><b>${g.profile}</b></td><td>${g.itemCode}</td><td>${g.length} mm</td><td>${g.capacity}</td><td>${b.incoming}</td><td>${b.used}</td><td><span class="cb-balance-pill ${bal<0?'danger':''}">${bal} Boxes</span></td><td><button class="btn" style="padding:6px 9px;background:#0f766e;color:#fff;" onclick="openCbAdjustModal('${safe}')"><i class="fa-solid fa-sliders"></i></button> <button class="btn" style="padding:6px 9px;background:#0369a1;color:#fff;" onclick="openCbInOutModal('${safe}',${b.incoming},${b.used})"><i class="fa-solid fa-pen"></i></button> <button class="btn" style="padding:6px 9px;background:#64748b;color:#fff;" onclick="openCbCapacityModal('${safe}')"><i class="fa-solid fa-box"></i></button></td></tr>`;}).join(''):`<tr><td colspan="9" style="text-align:center;padding:18px;color:var(--text-muted);font-weight:700;">No cardboard stock records.</td></tr>`; }
  const hist=document.getElementById('cardboardHistoryTableBody');
  if(hist){hist.innerHTML=cardboardStockList.length?cardboardStockList.map(c=>{const x=parseCardboardType(c.type); const id=Number(c.db_id||c.id); return `<tr><td>${c.date||'-'}<br><small>${c.timestamp||''}</small></td><td><span class="cb-tx ${Number(c.incoming)>0?'in':'out'}">${Number(c.incoming)>0?'INCOMING':'CONSUMED'}</span></td><td><b>${x.profile||'-'}</b> • ${x.itemCode||'-'} • ${x.length||'-'} mm</td><td>${c.incoming||0}</td><td>${c.used||0}</td><td>${id>0?`<button class="btn" style="padding:5px 8px;background:#64748b;color:#fff;" onclick="editCardboardTransaction(${id})"><i class="fa-solid fa-pen"></i></button>`:'Auto'}</td></tr>`;}).join(''):`<tr><td colspan="6" style="text-align:center;padding:18px;color:var(--text-muted);font-weight:700;">No transactions yet.</td></tr>`;}  const manualBody=document.getElementById('cardboardManualDataTableBody');
  if(manualBody){manualBody.innerHTML=cardboardManualData.length?cardboardManualData.map(r=>`<tr><td>${r.date||'-'}</td><td>${r.material||'-'}</td><td>${r.profile||'-'}</td><td>${r.itemCode||'-'}</td><td>${r.length||'-'}</td><td><b>${Number(r.quantity)||0}</b></td><td>${r.note||'-'}</td><td><button class="btn" style="padding:5px 8px;background:#0369a1;color:#fff;" onclick="editCardboardManualData(${Number(r.db_id||r.id)})"><i class="fa-solid fa-pen"></i></button> <button class="btn" style="padding:5px 8px;background:#dc2626;color:#fff;" onclick="deleteCardboardManualData(${Number(r.db_id||r.id)})"><i class="fa-solid fa-trash"></i></button></td></tr>`).join(''):`<tr><td colspan="8" style="text-align:center;padding:18px;color:var(--text-muted);font-weight:700;">No manual cardboard data.</td></tr>`;}
}
function onCbMaterialSelect(){
  const raw=(document.getElementById('cbMaterialInput')?.value||'').trim();
  const norm=v=>String(v??'').trim().toLocaleLowerCase();
  const matches=raw ? masterData.filter(m=>norm(m.material)===norm(raw)) : [];
  const p=document.getElementById('cbSelectProfile');
  if(!p)return;
  p.innerHTML='<option value="">-- Choose Profile --</option>';
  [...new Set(matches.map(m=>String(m.profile||'').trim()).filter(Boolean))].forEach(x=>p.appendChild(new Option(x,x)));
  // Auto-select when this Material Code maps to exactly one profile in Master Catalog.
  if(p.options.length===2)p.selectedIndex=1;
  onCbProfileSelect();
  if(raw && matches.length===0) showToast('Material Code was not found in Master Catalog. Check the code or select it from the suggestions.','warning');
}
function onCbProfileSelect(){
  const p=document.getElementById('cbSelectProfile'),i=document.getElementById('cbSelectItemCode'); if(!p||!i)return;
  const profile=p.value, norm=v=>String(v??'').trim().toLocaleLowerCase(), mat=(document.getElementById('cbMaterialInput')?.value||'').trim();
  const matches=masterData.filter(m=>String(m.profile||'').trim()===profile && (!mat||norm(m.material)===norm(mat)));
  i.innerHTML='<option value="">-- Choose Item Code --</option>';
  [...new Set(matches.map(m=>String(m.itemCode||'').trim()).filter(Boolean))].forEach(x=>i.appendChild(new Option(x,x)));
  if(i.options.length===2)i.selectedIndex=1;
  onCbItemCodeSelect();
}
function onCbItemCodeSelect(){
  const p=document.getElementById('cbSelectProfile'),i=document.getElementById('cbSelectItemCode'),l=document.getElementById('cbSelectLength'); if(!p||!i||!l)return;
  const norm=v=>String(v??'').trim().toLocaleLowerCase(), mat=(document.getElementById('cbMaterialInput')?.value||'').trim();
  const matches=masterData.filter(m=>String(m.profile||'').trim()===p.value && String(m.itemCode||'').trim()===i.value && (!mat||norm(m.material)===norm(mat)));
  l.innerHTML='<option value="">-- Choose Length --</option>';
  [...new Set(matches.map(m=>cleanLen(m.length)).filter(Boolean))].forEach(x=>l.appendChild(new Option(`${x} mm`,x)));
  if(l.options.length===2)l.selectedIndex=1;
}
async function processCardboardTransaction(){ if(currentUserRole!=='Admin'&&currentUserRole!=='Planner')return; const date=document.getElementById('cbDate').value||new Date().toISOString().split('T')[0], type=document.getElementById('cbTxType').value, profile=document.getElementById('cbSelectProfile').value,item=document.getElementById('cbSelectItemCode').value,length=document.getElementById('cbSelectLength').value,qty=parseInt(document.getElementById('cbQty').value)||0; if(!profile||!item||!length||qty<=0)return showToast('Select profile, item, length and quantity.','warning'); const bal=getAvailableCardboard(profile,item,length); if(type==='OUT'&&qty>bal)return showToast(`Insufficient cardboard stock. Available: ${bal} boxes.`,'error'); const rec={cb_date:date,cb_type:cardboardType(profile,item,length),incoming:type==='IN'?qty:0,used:type==='OUT'?qty:0}; try{const r=await supabaseClient.from('cardboard_stock').insert([rec]);if(r.error)throw r.error;cardboardStockList.unshift({id:-Date.now(),db_id:null,date, type:rec.cb_type,incoming:rec.incoming,used:rec.used,timestamp:new Date().toLocaleTimeString()});saveCardboardLocally();aisRegisterUndo(`Cardboard ${type==='IN'?'IN':'OUT'} • ${profile} / ${length} • ${qty} Boxes`,async()=>{await aisDeleteLatest('cardboard_stock',rec);},'cardboardTab');renderCardboardStock();document.getElementById('cardboardEntryForm')?.reset();const dateEl=document.getElementById('cbDate');if(dateEl){dateEl.value=date;setAISFormState('cbDate',date);}showToast('Cardboard transaction saved.','success');}catch(e){showToast(dbErrorMessage(e,'Cardboard save failed'),'error');}}
function openCbAdjustModal(g){ if(typeof g==='string') g=JSON.parse(decodeURIComponent(g));document.getElementById('adjustCbProfile').value=g.profile;document.getElementById('adjustCbItemCode').value=g.itemCode;document.getElementById('adjustCbLength').value=g.length;document.getElementById('cbAdjustTarget').innerHTML=`${g.profile} • ${g.itemCode} • ${g.length} mm`;document.getElementById('newCbBalanceVal').value=Math.max(0,getAvailableCardboard(g.profile,g.itemCode,g.length));document.getElementById('cbAdjustModal').style.display='flex';}
function closeCbAdjustModal(){document.getElementById('cbAdjustModal').style.display='none';}
async function saveCbAdjust(){const p=document.getElementById('adjustCbProfile').value,i=document.getElementById('adjustCbItemCode').value,l=document.getElementById('adjustCbLength').value,n=Math.max(0,parseInt(document.getElementById('newCbBalanceVal').value)||0),cur=getAvailableCardboard(p,i,l),diff=n-cur;if(!diff){closeCbAdjustModal();return showToast('No balance change required.','info');} const rec={cb_date:new Date().toISOString().split('T')[0],cb_type:`Pr: ${p} | Item: ${i} | L: ${l} | MANUAL ADJUSTMENT`,incoming:diff>0?diff:0,used:diff<0?Math.abs(diff):0}; try{const r=await supabaseClient.from('cardboard_stock').insert([rec]);if(r.error)throw r.error;cardboardStockList.unshift({id:-Date.now(),db_id:null,date:rec.cb_date,type:rec.cb_type,incoming:rec.incoming,used:rec.used,timestamp:new Date().toLocaleTimeString()});saveCardboardLocally();aisRegisterUndo(`Cardboard Balance Adjustment • ${p} / ${l}`,async()=>{await aisDeleteLatest('cardboard_stock',rec);},'cardboardTab');closeCbAdjustModal();renderCardboardStock();showToast('Cardboard balance adjusted.','success');}catch(e){showToast(dbErrorMessage(e,'Balance adjustment failed'),'error');}}
function openCbInOutModal(g,inc,out){ if(typeof g==='string') g=JSON.parse(decodeURIComponent(g));document.getElementById('inOutCbProfile').value=g.profile;document.getElementById('inOutCbItemCode').value=g.itemCode;document.getElementById('inOutCbLength').value=g.length;document.getElementById('currentCbIn').value=inc;document.getElementById('currentCbOut').value=out;document.getElementById('cbInOutTarget').innerHTML=`${g.profile} • ${g.itemCode} • ${g.length} mm`;document.getElementById('newCbInVal').value=inc;document.getElementById('newCbOutVal').value=out;document.getElementById('cbInOutEditModal').style.display='flex';}
function closeCbInOutModal(){document.getElementById('cbInOutEditModal').style.display='none';}
async function saveCbInOut(){const p=document.getElementById('inOutCbProfile').value,i=document.getElementById('inOutCbItemCode').value,l=document.getElementById('inOutCbLength').value,oldIn=Number(document.getElementById('currentCbIn').value)||0,oldOut=Number(document.getElementById('currentCbOut').value)||0,newIn=Math.max(0,parseInt(document.getElementById('newCbInVal').value)||0),newOut=Math.max(0,parseInt(document.getElementById('newCbOutVal').value)||0); const dIn=newIn-oldIn,dOut=newOut-oldOut; if(newOut>newIn)return showToast('Total OUT cannot exceed Total IN.','error'); const base=`Pr: ${p} | Item: ${i} | L: ${l}`; try{if(dIn||dOut){const rec={cb_date:new Date().toISOString().split('T')[0],cb_type:base+' | MANUAL EDIT',incoming:dIn>0?dIn:0,used:dOut>0?dOut:0}; if(dIn<0) rec.used+=Math.abs(dIn); if(dOut<0) rec.incoming+=Math.abs(dOut); const r=await supabaseClient.from('cardboard_stock').insert([rec]);if(r.error)throw r.error;cardboardStockList.unshift({id:-Date.now(),db_id:null,date:rec.cb_date,type:rec.cb_type,incoming:rec.incoming,used:rec.used,timestamp:new Date().toLocaleTimeString()});saveCardboardLocally();aisRegisterUndo(`Edit Cardboard Totals • ${p} / ${l}`,async()=>{await aisDeleteLatest('cardboard_stock',rec);},'cardboardTab');} closeCbInOutModal();renderCardboardStock();showToast('Cardboard totals updated.','success');}catch(e){showToast(dbErrorMessage(e,'Cardboard edit failed'),'error');}}
function openCbCapacityModal(g){ if(typeof g==='string') g=JSON.parse(decodeURIComponent(g));document.getElementById('editCbCatalogId').value=masterData.find(m=>String(m.profile).trim()===String(g.profile).trim()&&m.itemCode===g.itemCode&&cleanLen(m.length)===cleanLen(g.length))?.db_id||'';document.getElementById('cbEditTarget').innerHTML=`${g.profile} • ${g.itemCode} • ${g.length} mm`;document.getElementById('editCbCapacityVal').value=g.capacity||100;document.getElementById('cbCapacityEditModal').style.display='flex';}
function closeCbCapacityModal(){document.getElementById('cbCapacityEditModal').style.display='none';}
async function saveCbCapacityEdit(){const id=document.getElementById('editCbCatalogId').value,cap=Math.max(1,parseInt(document.getElementById('editCbCapacityVal').value)||100);if(!id)return showToast('Matching Master Catalog item not found.','error');try{const m=masterData.find(x=>String(x.db_id)===String(id));const oldCap=Number(m?.boxCapacity)||100;const r=await supabaseClient.from('master_catalog').update({box_capacity:cap}).eq('id',id);if(r.error)throw r.error;if(m)m.boxCapacity=cap;aisRegisterUndo(`Edit Pcs per Box • ${m?.profile||''} / ${m?.length||''}`,async()=>{await aisUpdateById('master_catalog',id,{box_capacity:oldCap});},'cardboardTab');closeCbCapacityModal();renderCardboardStock();renderBalanceWorkTable();showToast('Pcs per Box updated.','success');}catch(e){showToast(dbErrorMessage(e,'Capacity update failed'),'error');}}
function editCardboardTransaction(id){const row=cardboardStockList.find(c=>Number(c.db_id||c.id)===Number(id));if(!row||!row.db_id)return showToast('This automatic/local record cannot be edited here. Use Manual Cardboard Data for independent reference information.','info');showToast('Stock transaction quantities are protected. Use Manual Cardboard Data to edit reference information without changing Current Cardboard Stock.','info');}

async function persistCardboardManualData(){
  const message=JSON.stringify(cardboardManualData||[]);
  let row=(dailyInstructionsList||[]).find(r=>r.target_user==='SYS_CARDBOARD_MANUAL');
  const base={target_date:new Date().toISOString().split('T')[0],target_user:'SYS_CARDBOARD_MANUAL',priority:'Normal',message,status:'Completed',action_taken:'Cardboard Manual Data'};
  if(row){ const {error}=await supabaseClient.from('daily_instructions').update({message}).eq('id',row.id); if(error)throw error; row.message=message; }
  else { const {error}=await supabaseClient.from('daily_instructions').insert([base]); if(error)throw error; dailyInstructionsList.push({...base,id:-Date.now()}); }
}
async function saveCardboardManualData(event){
  event?.preventDefault();
  if(currentUserRole!=='Admin'&&currentUserRole!=='Planner') return;
  const id=document.getElementById('cbManualId').value.trim();
  const row={manual_id:id||`CBM-${Date.now()}`,date:document.getElementById('cbManualDate').value||new Date().toISOString().split('T')[0],material:document.getElementById('cbManualMaterial').value.trim(),profile:document.getElementById('cbManualProfile').value.trim(),itemCode:document.getElementById('cbManualItemCode').value.trim(),length:document.getElementById('cbManualLength').value.trim(),quantity:Math.max(0,parseInt(document.getElementById('cbManualQty').value)||0),note:document.getElementById('cbManualNote').value.trim()};
  if(!row.profile&&!row.itemCode&&!row.material) return showToast('Enter at least Material, Profile or Item Code.','warning');
  try{
    const beforeManual=JSON.parse(JSON.stringify(cardboardManualData));
    if(id){ const idx=cardboardManualData.findIndex(x=>String(x.manual_id||x.id)===String(id)); if(idx<0)return showToast('Manual record not found.','error'); cardboardManualData[idx]=row; showToast('Manual cardboard data updated. Current stock unchanged.','success'); }
    else { cardboardManualData.unshift(row); showToast('Manual cardboard data saved. Current stock unchanged.','success'); }
    await persistCardboardManualData(); saveCardboardManualLocally();
    aisRegisterUndo(`Manual Cardboard Data • ${id?'Edit':'New'} • ${row.profile||row.itemCode||row.material}`,async()=>{cardboardManualData=beforeManual;await persistCardboardManualData();saveCardboardManualLocally();},'cardboardTab');
    const savedManualDate=row.date; cancelCardboardManualEdit(); const manualDateEl=document.getElementById('cbManualDate'); if(manualDateEl){manualDateEl.value=savedManualDate;setAISFormState('cbManualDate',savedManualDate);} renderCardboardStock();
  }catch(e){showToast(dbErrorMessage(e,'Manual cardboard data save failed'),'error');}
}
function editCardboardManualData(id){
  const r=cardboardManualData.find(x=>String(x.manual_id||x.id)===String(id));
  if(!r)return showToast('Manual record not found.','error');
  document.getElementById('cbManualId').value=r.manual_id||r.id; document.getElementById('cbManualDate').value=r.date||''; document.getElementById('cbManualMaterial').value=r.material||''; document.getElementById('cbManualProfile').value=r.profile||''; document.getElementById('cbManualItemCode').value=r.itemCode||''; document.getElementById('cbManualLength').value=r.length||''; document.getElementById('cbManualQty').value=Number(r.quantity)||0; document.getElementById('cbManualNote').value=r.note||'';
  document.getElementById('cbManualSaveBtn').innerHTML='<i class="fa-solid fa-check"></i> Update Manual Data'; document.getElementById('cbManualCancelBtn').style.display='inline-flex'; document.getElementById('cbManualDataArea')?.scrollIntoView({behavior:'smooth',block:'center'});
}
function cancelCardboardManualEdit(){
  const f=document.getElementById('cardboardManualForm'); if(f)f.reset(); const id=document.getElementById('cbManualId'); if(id)id.value=''; const d=document.getElementById('cbManualDate'); if(d)d.value=getAISFormState().cbManualDate||new Date().toISOString().split('T')[0]; const b=document.getElementById('cbManualSaveBtn'); if(b)b.innerHTML='<i class="fa-solid fa-save"></i> Save Manual Data'; const c=document.getElementById('cbManualCancelBtn'); if(c)c.style.display='none';
}
async function deleteCardboardManualData(id){
  if(currentUserRole!=='Admin'&&currentUserRole!=='Planner') return;
  const idx=cardboardManualData.findIndex(x=>String(x.manual_id||x.id)===String(id)); if(idx<0)return;
  showConfirm('<b>DELETE MANUAL DATA</b><br><br>Delete this manual cardboard record?<br><br><span style="color:#047857;font-weight:700">Current Cardboard Stock will NOT change.</span>',async()=>{
    try{cardboardManualData.splice(idx,1);await persistCardboardManualData();saveCardboardManualLocally();renderCardboardStock();showToast('Manual cardboard data deleted. Current stock unchanged.','success');}catch(e){showToast(dbErrorMessage(e,'Manual cardboard data delete failed'),'error');}
  });
}
async function resetCardboardStock(){
  if(currentUserRole!=='Admin') return showToast('Only Admin can reset cardboard stock.','error');
  const count=cardboardStockList.length;
  showConfirm(`<b style="color:#b91c1c">RESET ALL CARDBOARD STOCK</b><br><br>This will permanently delete <b>${count}</b> cardboard stock transaction(s) from the database.<br><br><span style="color:#047857;font-weight:700">Manual Cardboard Data will NOT be deleted. Current aluminium production stock will NOT be changed.</span><br><br><span style="color:#b91c1c;font-weight:700">This cannot be undone.</span>`,async()=>{
    if(stockResetInProgress)return; stockResetInProgress=true; isAppBusy=true; const btn=document.getElementById('resetCardboardBtn'); const old=btn?.innerHTML;
    try{
      if(btn){btn.disabled=true;btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Resetting...';}
      const {error}=await supabaseClient.from('cardboard_stock').delete().gte('id',0); if(error)throw error;
      cardboardStockList=[]; saveCardboardLocally(); renderCardboardStock();
      showToast(`Cardboard stock reset successfully. ${count} transaction(s) deleted. Manual data and Current Stock are unchanged.`,'success');
    }catch(e){showToast(dbErrorMessage(e,'Cardboard stock reset failed'),'error');}
    finally{if(btn){btn.disabled=false;btn.innerHTML=old||'<i class="fa-solid fa-trash-can"></i> Reset Cardboard Stock';}stockResetInProgress=false;isAppBusy=false;}
  });
}

async function submitDailyEntry() {
  if(isAppBusy) {
    showToast('A save is already in progress. Please wait for it to finish.','info');
    return;
  }
  isAppBusy = true;
  const saveBtn = document.getElementById('saveDailyProductionBtn') || document.querySelector('#dailyEntryForm button[onclick="submitDailyEntry()"]');
  const originalButtonHtml = saveBtn?.innerHTML || '<i class="fa-solid fa-floppy-disk"></i> Process Movement';
  if(saveBtn){ saveBtn.disabled=true; saveBtn.setAttribute('aria-busy','true'); saveBtn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Saving...'; saveBtn.style.opacity='.78'; saveBtn.style.cursor='wait'; }

  let updatedRows = [];
  let insertedLog = null;
  let databaseCommitComplete = false;
  let cardboardDeducted = null;
  let cardboardToDeduct = 0;
  let item = null;
  let newLog = null;
  try {
    if (currentUserRole !== 'Admin' && currentUserRole !== 'Planner') return;
    const raw = id => String(document.getElementById(id)?.value ?? '0').trim();
    const dateVal=raw('entryDate'), shiftVal=raw('shift'), teamVal=raw('productionTeam'),
      profileVal=raw('selectProfile'), itemCodeVal=raw('selectItemCode'),
      lengthVal=raw('selectLength');
    const cutQty=Number(raw('cutQty')||0), punchQty=Number(raw('punchQty')||0),
      wrapQty=Number(raw('wrapQty')||0), enteredBoxes=Number(raw('boxQty')||0),
      crateQty=Number(raw('crateQty')||0);

    if(!dateVal||!shiftVal||!teamVal||!profileVal||!itemCodeVal||!lengthVal)
      return showToast('Please select date, shift, team, profile, item code and length.','warning');
    const quantities=[['Cut',cutQty],['Punch',punchQty],['Wrapping',wrapQty],['Box',enteredBoxes],['Crate',crateQty]];
    const invalid=quantities.find(([label,value])=>!Number.isFinite(value)||value<0||!Number.isInteger(value));
    if(invalid) return showToast(`${invalid[0]} quantity must be a whole number greater than or equal to 0.`,'warning');
    if(quantities.every(([,value])=>value===0))
      return showToast('Enter at least one production quantity before saving. This prevents empty/duplicate entries.','warning');

    item=masterData.find(m=>String(m.profile).trim()===profileVal&&String(m.itemCode).trim()===itemCodeVal&&cleanLen(m.length)===cleanLen(lengthVal));
    if(!item) return showToast('Selected catalog item was not found. Refresh data and try again.','error');

    const previous={cutQty:Number(item.cutQty)||0,punchQty:Number(item.punchQty)||0,wrapQty:Number(item.wrapQty)||0,boxQty:Number(item.boxQty)||0,crateQty:Number(item.crateQty)||0};
    let next={...previous};
    const boxCapacity=Math.max(1,Number(item.boxCapacity)||100);
    const boxPcs=enteredBoxes*boxCapacity;

    // Apply and validate movements in the real process order:
    // Cut -> Punch (except bypass profiles) -> Wrapping -> Box -> Crate.
    next.cutQty += cutQty;
    if(punchQty>0){
      if(punchQty>next.cutQty)
        return showToast(`Punching needs ${punchQty} Pcs, but Cut stock after today's Cut entry is only ${next.cutQty} Pcs.`,'error');
      next.cutQty -= punchQty;
      next.punchQty += punchQty;
    }
    if(wrapQty>0){
      const bypassPunch=isPunchBypassed(profileVal,lengthVal);
      const sourceStage=bypassPunch?'Cut':'Punch';
      const sourceQty=bypassPunch?next.cutQty:next.punchQty;
      if(wrapQty>sourceQty)
        return showToast(`Wrapping needs ${wrapQty} Pcs, but available ${sourceStage} stock is only ${sourceQty} Pcs.`,'error');
      if(bypassPunch) next.cutQty-=wrapQty;
      else next.punchQty-=wrapQty;
      next.wrapQty+=wrapQty;
    }
    if(boxPcs>0){
      if(boxPcs>next.wrapQty)
        return showToast(`Box packing needs ${boxPcs} Pcs (${enteredBoxes} boxes × ${boxCapacity} Pcs/box), but Wrapping stock is only ${next.wrapQty} Pcs.`,'error');
      next.wrapQty-=boxPcs;
      next.boxQty+=boxPcs;
    }
    if(crateQty>0){
      if(crateQty>next.boxQty)
        return showToast(`Crating needs ${crateQty} Pcs, but Box stock after today's Box entry is only ${next.boxQty} Pcs.`,'error');
      next.boxQty-=crateQty;
      next.crateQty+=crateQty;
    }

    const availableCardboard=Math.max(0,Number(getAvailableCardboard(profileVal,itemCodeVal,lengthVal))||0);
    // Box quantity is production data, not a cardboard stock limit. When cardboard
    // is short, save the full valid Box movement and consume only available boxes.
    cardboardToDeduct=Math.min(enteredBoxes,availableCardboard);
    let shortageBoxes=Math.max(0,enteredBoxes-cardboardToDeduct);

    newLog={log_date:dateVal,shift:shiftVal,team:teamVal,profile:profileVal,length:cleanLen(lengthVal),cut_qty:cutQty,punch_qty:punchQty,wrap_qty:wrapQty,box_qty:boxPcs,crate_qty:crateQty,log_time:new Date().toLocaleTimeString()};

    // If the catalog display combines duplicate DB rows, consolidate the displayed
    // total into the canonical row while zeroing only the matching duplicate stock
    // quantities. This preserves the total and prevents the next sync doubling it.
    let catalogRows = Array.isArray(item.dbRows) && item.dbRows.length ? item.dbRows.map(r=>({...r})) : [{id:item.db_id,...previous}];
    if(!item.db_id || String(item.db_id).startsWith('-'))
      throw new Error('This Master Catalog item is not linked to a saved Supabase row. Sync data and retry.');
    const duplicateIds = new Set((item.db_ids||[item.db_id]).map(String));
    if(catalogRows.length>1){
      const sums={cutQty:0,punchQty:0,wrapQty:0,boxQty:0,crateQty:0};
      catalogRows.forEach(r=>Object.keys(sums).forEach(k=>sums[k]+=Number(r[k])||0));
      const matchesTotals=Object.keys(previous).every(k=>sums[k]===previous[k]);
      if(!matchesTotals) throw new Error('Master Catalog stock changed or needs refresh. Please refresh data before saving this movement.');
    }

    // Record only the actual cardboard used. The helper rechecks the current balance
    // and caps the deduction; lack of cardboard alone never blocks the Box movement.
    cardboardDeducted=await deductCardboardBoxesForProduction(profileVal,itemCodeVal,lengthVal,enteredBoxes);
    cardboardToDeduct=cardboardDeducted ? (Number(cardboardDeducted.used)||0) : 0;
    shortageBoxes=Math.max(0,enteredBoxes-cardboardToDeduct);

    for(const row of catalogRows){
      const isCanonical=String(row.id)===String(item.db_id);
      const values=isCanonical ? next : {cutQty:0,punchQty:0,wrapQty:0,boxQty:0,crateQty:0};
      await dbUpdate('master_catalog',previousToDb(values),row.id,'Production stock save failed');
      updatedRows.push({id:row.id,before:{cutQty:row.cutQty,punchQty:row.punchQty,wrapQty:row.wrapQty,boxQty:row.boxQty,crateQty:row.crateQty}});
    }
    insertedLog=await dbInsert('history_logs',newLog,'Production history save failed');
    databaseCommitComplete = true;
    // Clear quantities immediately after the database commit so a later UI/render
    // exception cannot leave the just-saved quantities ready for an accidental retry.
    ['cutQty','punchQty','wrapQty','boxQty','crateQty'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=0;});
    updateProductionCardboardAvailability();

    Object.assign(item,next);
    item.dbRows=catalogRows.map(row=>({id:row.id,...(String(row.id)===String(item.db_id)?next:{cutQty:0,punchQty:0,wrapQty:0,boxQty:0,crateQty:0})}));
    item.db_ids=catalogRows.map(row=>row.id);

    aisRegisterUndo(`Daily Production • ${profileVal} / ${lengthVal} • ${dateVal}`, async()=>{
      for(const row of updatedRows) await dbUpdate('master_catalog',previousToDb(row.before),row.id,'Production undo failed');
      await aisDeleteLatest('history_logs',{log_date:newLog.log_date,shift:newLog.shift,team:newLog.team,profile:newLog.profile,length:newLog.length,cut_qty:newLog.cut_qty,punch_qty:newLog.punch_qty,wrap_qty:newLog.wrap_qty,box_qty:newLog.box_qty,crate_qty:newLog.crate_qty,log_time:newLog.log_time});
      if(cardboardDeducted) await aisDeleteLatest('cardboard_stock',{cb_date:cardboardDeducted.date,cb_type:cardboardDeducted.type,incoming:0,used:cardboardDeducted.used});
    },'adminEntryTab');

    historyLogs.unshift({id:insertedLog.id || -Date.now(),date:dateVal,shift:shiftVal,team:teamVal,profile:profileVal,length:cleanLen(lengthVal),cutQty,punchQty,wrapQty,boxQty:boxPcs,crateQty,timestamp:insertedLog.log_time||insertedLog.created_at});
    renderDashboard(); renderProfileSummaryTable(); renderHistoryData(); checkDateStatus(); renderCardboardStock(); renderBalanceWorkTable();
    ['cutQty','punchQty','wrapQty','boxQty','crateQty'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=0;});
    updateProductionCardboardAvailability();
    showToast(shortageBoxes>0
      ? `Production saved successfully. Cardboard stock for this profile is now ${Math.max(0,Number(getAvailableCardboard(profileVal,itemCodeVal,lengthVal))||0)} box(es); ${shortageBoxes} box(es) had to be packed using separately prepared cardboard. Box Qty was saved.`
      : 'Production saved successfully. Stock and history are updated.','success');
  } catch(e) {
    console.error('Production save error:',e);
    if(databaseCommitComplete){
      // The DB commit succeeded; never roll back committed stock just because a
      // later render/undo/UI action failed. Refresh in the background instead.
      ['cutQty','punchQty','wrapQty','boxQty','crateQty'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=0;});
      loadDataFromSupabase(true).catch(syncErr=>console.warn('Post-commit UI recovery sync failed:',syncErr));
      showToast('Production data was saved, but the screen refresh had an issue. Data is syncing; do not re-enter this movement.','warning');
    } else {
      // Roll back only the rows that this attempt successfully changed before the history commit.
      for(const row of [...updatedRows].reverse()){
        try{ await dbUpdate('master_catalog',previousToDb(row.before),row.id,'Production rollback failed'); }
        catch(rb){ console.error('Production stock rollback failed:',rb); }
      }
      if(cardboardDeducted){
        try{
          const q=await supabaseClient.from('cardboard_stock').delete().eq('cb_date',cardboardDeducted.date).eq('cb_type',cardboardDeducted.type).eq('used',cardboardToDeduct);
          if(q.error) throw q.error;
          const idx=cardboardStockList.indexOf(cardboardDeducted); if(idx>=0)cardboardStockList.splice(idx,1);
          saveCardboardLocally();
        }catch(rb){console.error('Cardboard rollback failed:',rb);}
      }
      // Re-sync asynchronously so error feedback isn't delayed by a full refresh.
      loadDataFromSupabase(true).catch(syncErr=>console.warn('Post-save recovery sync failed:',syncErr));
      showToast(e.message||'Production save failed. Please check the database connection before retrying.','error');
    }
  } finally {
    if(saveBtn){saveBtn.disabled=false;saveBtn.removeAttribute('aria-busy');saveBtn.innerHTML=originalButtonHtml;saveBtn.style.opacity='';saveBtn.style.cursor='';}
    isAppBusy=false;
  }
}

function previousToDb(p){return {cut_qty:p.cutQty,punch_qty:p.punchQty,wrap_qty:p.wrapQty,box_qty:p.boxQty,crate_qty:p.crateQty};}

function openStockEditModal(index, preferredStage = 'cutQty') { if (currentUserRole !== 'Admin') return; const item = masterData[index]; document.getElementById('editItemIndex').value = index; document.getElementById('editItemTarget').innerHTML = `Profile: <b>${item.profile}</b> | Item: <b>${item.itemCode || '-'}</b> | Length: <b>${item.length} mm</b>`; document.getElementById('editStageSelect').value = preferredStage; document.getElementById('editStageValue').value = item[preferredStage] || 0; document.getElementById('boxCapacityHelperText').dataset.capacity = item.boxCapacity || 100; document.getElementById('boxCapacityHelperText').innerText = `Master Capacity: ${item.boxCapacity || 100} Pcs per Box`; toggleBoxCountInput(); document.getElementById('stockEditModal').style.display = 'flex'; }
function toggleBoxCountInput() { const stage = document.getElementById('editStageSelect').value; const boxGroup = document.getElementById('editBoxCountGroup'); if (stage === 'boxQty') { boxGroup.style.display = 'flex'; syncBoxCount(); } else { boxGroup.style.display = 'none'; } }
function syncBoxCount() { if (document.getElementById('editStageSelect').value !== 'boxQty') return; const pcs = parseInt(document.getElementById('editStageValue').value) || 0; const capacity = parseInt(document.getElementById('boxCapacityHelperText').dataset.capacity) || 100; const boxes = capacity > 0 ? (pcs / capacity) : 0; document.getElementById('editBoxCountValue').value = boxes % 1 === 0 ? boxes : parseFloat(boxes.toFixed(2)); }
function syncPcsCount() { if (document.getElementById('editStageSelect').value !== 'boxQty') return; const boxes = parseFloat(document.getElementById('editBoxCountValue').value) || 0; const capacity = parseInt(document.getElementById('boxCapacityHelperText').dataset.capacity) || 100; document.getElementById('editStageValue').value = Math.round(boxes * capacity); }
function closeStockEditModal() { document.getElementById('stockEditModal').style.display = 'none'; }
async function saveSingleStageEdit() {
  if(isAppBusy) return;
  isAppBusy=true;
  try {
    const index=parseInt(document.getElementById('editItemIndex').value);
    const stage=document.getElementById('editStageSelect').value;
    const newQty=Math.max(0,parseInt(document.getElementById('editStageValue').value)||0);
    const item=masterData[index];
    if(!item?.db_id) throw new Error('Stock edit failed: catalog record is not linked to Supabase.');

    const field=stage.replace('Qty','_qty');
    const oldQty=Number(item[stage])||0;

    // IMPORTANT DATA-SAFETY FIX:
    // Older versions could contain duplicate Master Catalog rows for the same
    // Profile + Item Code + Length. loadDataFromSupabase() intentionally merges
    // those rows for display, so editing only one DB row allowed the old quantity
    // in another duplicate row to come back after the next sync/reload.
    // A manual Current Stock edit means "set the displayed stock to this exact
    // value". Therefore, when duplicates exist, the selected canonical row gets
    // the new value and the duplicate rows for THIS STAGE are explicitly zeroed.
    // Other stages are left untouched, so unrelated stock is never changed.
    const profileKey=String(item.profile||'').trim();
    const itemCodeKey=String(item.itemCode||'').trim();
    const lengthKey=cleanLen(item.length);
    let duplicateRows=[];
    try{
      let q=supabaseClient.from('master_catalog').select(`id,profile,item_code,length,${field}`).eq('profile',profileKey).eq('length',lengthKey);
      if(itemCodeKey) q=q.eq('item_code',itemCodeKey);
      const res=await q;
      if(res.error) throw res.error;
      duplicateRows=(res.data||[]).filter(r=>String(r.profile||'').trim()===profileKey&&cleanLen(r.length)===lengthKey&&String(r.item_code||'').trim()===itemCodeKey);
    }catch(lookupErr){
      // If duplicate discovery is blocked by an RLS SELECT policy, do not guess.
      // The canonical-row update below is still safe, but the user is warned that
      // a full duplicate cleanup could not be verified.
      console.warn('Master duplicate lookup skipped:',lookupErr);
      duplicateRows=[];
    }

    const beforeRows=duplicateRows.map(r=>({id:r.id,value:Number(r[field])||0}));
    const rowsToUpdate=duplicateRows.length
      ? duplicateRows.map(r=>({id:r.id,value:r.id===item.db_id?newQty:0}))
      : [{id:item.db_id,value:newQty}];

    // Save every affected row and fail the whole edit if any write fails.
    const changedRows=[];
    try{
      for(const r of rowsToUpdate){
        const payload={}; payload[field]=r.value;
        const result=await supabaseClient.from('master_catalog').update(payload).eq('id',r.id);
        if(result.error) throw result.error;
        changedRows.push(r);
      }
    }catch(saveErr){
      // Best-effort rollback of rows already changed by this edit.
      for(const r of changedRows){
        const old=beforeRows.find(x=>String(x.id)===String(r.id));
        if(old){ const payload={}; payload[field]=old.value; try{await supabaseClient.from('master_catalog').update(payload).eq('id',old.id);}catch(rb){console.error('Stock edit rollback failed:',rb);} }
      }
      throw saveErr;
    }

    item[stage]=newQty;
    aisRegisterUndo(`Stock Edit • ${item.profile} / ${item.length} • ${stage}`,async()=>{
      if(beforeRows.length){
        for(const r of beforeRows){ const payload={}; payload[field]=r.value; await aisUpdateById('master_catalog',r.id,payload); }
      }else{
        const back={}; back[field]=oldQty; await aisUpdateById('master_catalog',item.db_id,back);
      }
    },'publicStockTab');

    closeStockEditModal();
    showToast(duplicateRows.length>1
      ? `Stock edit saved. ${duplicateRows.length} duplicate catalog row(s) were safely synchronized; old stock will not return.`
      : 'Stock edit saved successfully.','success');
    renderProfileSummaryTable(); renderDashboard(); renderBalanceWorkTable();
  } catch(e){
    console.error('Stock edit error:',e);
    await loadDataFromSupabase(true).catch(()=>{});
    showToast(e.message||'Stock edit failed.','error');
  } finally { isAppBusy=false; }
}

function populatePoProfileDropdown() { const select = document.getElementById('poSelectProfile'); if(!select) return; select.innerHTML = '<option value="">-- Choose Profile --</option>'; [...new Set(masterData.map(i => String(i.profile).trim()))].forEach(p => select.appendChild(new Option(p, p))); }
function onPoProfileSelect() { const profile = document.getElementById('poSelectProfile').value; const itemSelect = document.getElementById('poSelectItemCode'); itemSelect.innerHTML = '<option value="">-- Choose Item Code --</option>'; document.getElementById('poSelectLength').innerHTML = '<option value="">-- Choose Length --</option>'; if(!profile) return; const items = masterData.filter(m => String(m.profile).trim() === profile && m.itemCode); [...new Set(items.map(m => m.itemCode))].forEach(ic => itemSelect.appendChild(new Option(ic, ic))); }
function onPoItemCodeSelect() { const profile = document.getElementById('poSelectProfile').value; const itemCode = document.getElementById('poSelectItemCode').value; const lengthSelect = document.getElementById('poSelectLength'); lengthSelect.innerHTML = '<option value="">-- Choose Length --</option>'; if(!profile || !itemCode) return; const matches = masterData.filter(m => String(m.profile).trim() === profile && m.itemCode === itemCode); matches.forEach(m => lengthSelect.appendChild(new Option(`${m.length} mm`, m.length))); if(matches.length === 1) lengthSelect.value = matches[0].length; }
// ===== Production Order Excel Bulk Upload =====
// Accepts .xls / .xlsx / .csv and flexible header names without changing
// the existing Production Order data model. Length is always resolved from
// Master Catalog using Profile + Item Code, so the Excel file does not need
// to contain a length column.
function normalizePoExcelHeader(value) {
  return String(value ?? '')
    .trim().toLowerCase()
    .replace(/[\s_\-#()./\\:]+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function normalizePoExcelText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function poExcelNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const s = String(value ?? '').replace(/,/g, '').trim();
  if (!s) return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function poExcelHeaderIndex(headers, aliases) {
  const wanted = aliases.map(normalizePoExcelHeader);
  return headers.findIndex(h => wanted.includes(normalizePoExcelHeader(h)));
}

function poExcelProfileMatches(a, b) {
  const x = normalizePoExcelText(a).toLowerCase();
  const y = normalizePoExcelText(b).toLowerCase();
  if (x === y) return true;
  // Some source PO files use AL-1038 while the Master Catalog may use 1038.
  return x.replace(/^al[-\s]?/, '') === y.replace(/^al[-\s]?/, '');
}

function findPoMasterByProfileItem(profile, itemCode) {
  const p = normalizePoExcelText(profile).toLowerCase();
  const i = normalizePoExcelText(itemCode).toLowerCase();
  return masterData.filter(m =>
    poExcelProfileMatches(m.profile, p) &&
    normalizePoExcelText(m.itemCode).toLowerCase() === i
  );
}

function poExcelDateFromInput() {
  const el = document.getElementById('poUploadDate');
  return el?.value || new Date().toISOString().slice(0, 10);
}

window.downloadProductionOrderTemplate = function () {
  if (typeof XLSX === 'undefined') return showToast('Excel library is not loaded. Please refresh the page.', 'error');
  const rows = [
    ['PO Number', 'Profile', 'Item Code', 'Quantity (Pcs.)'],
    ['364523', 'AL-1038', 'OX-TFBE96', 1100],
    ['364523', 'AL-1042', 'RA-UNLF', 324]
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  ws['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 24 }, { wch: 18 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Production Orders');
  XLSX.writeFile(wb, 'AIS_Production_Order_Upload_Template.xlsx');
};

window.downloadProductionOrderSample = function () {
  const file = 'AIS_Production_Order_Exact_Sample_364523.xlsx';
  const a = document.createElement('a');
  a.href = file;
  a.download = file;
  document.body.appendChild(a);
  a.click();
  a.remove();
};

window.previewProductionOrderExcel = function(input){
  const el=document.getElementById('poExcelFileStatus');
  const file=input?.files?.[0];
  if(!el) return;
  if(!file){ el.textContent='No file selected.'; el.style.color='#475569'; return; }
  const ok=/\.(xlsx|xls|csv)$/i.test(file.name);
  el.textContent = ok ? `Selected: ${file.name} • ${(file.size/1024).toFixed(1)} KB` : 'Invalid file type. Please select .xlsx, .xls or .csv.';
  el.style.color = ok ? '#047857' : '#b91c1c';
};

function poExcelNormalizeProfile(value){
  const s=normalizePoExcelText(value).toLowerCase();
  if(!s) return '';
  return s.replace(/\bprofile\b/g,'').replace(/^al[\s\-_]*/,'').replace(/\.0+$/,'').replace(/[^a-z0-9]/g,'');
}
function poExcelNormalizeItem(value){
  return normalizePoExcelText(value).toLowerCase().replace(/\s+/g,'').replace(/[^a-z0-9._\-\/]/g,'');
}
function poExcelProfileMatches(a,b){ return poExcelNormalizeProfile(a)===poExcelNormalizeProfile(b); }
function findPoMasterByProfileItem(profile,itemCode){
  const p=poExcelNormalizeProfile(profile), i=poExcelNormalizeItem(itemCode);
  return masterData.filter(m=>poExcelNormalizeProfile(m.profile)===p && poExcelNormalizeItem(m.itemCode)===i);
}

// Many Alumex item codes carry the cut length at the end of the code.
// Examples: ...24 -> 2400 mm, ...96 -> 9600 mm, ...130 -> 1300 mm, ...72E -> 7200 mm.
// This is used ONLY when the exact Profile + Item Code is missing from Master Catalog,
// so an otherwise valid PO Excel is not rejected just because the catalog is incomplete.
function inferPoLengthFromItemCode(itemCode){
  const s=normalizePoExcelText(itemCode).toUpperCase();
  const m=s.match(/(\d{2,3})(?:[A-Z]+)?$/);
  if(!m) return '';
  const digits=m[1];
  const n=parseInt(digits,10);
  if(!Number.isFinite(n)||n<=0) return '';
  return String(n*(digits.length===2?100:10));
}

function poExcelGetRowValue(vals, idx){ return idx>=0 && idx<vals.length ? vals[idx] : ''; }
function poExcelFindHeaderRow(matrix, aliases){
  for(let r=0;r<Math.min(matrix.length,40);r++){
    const row=Array.isArray(matrix[r])?matrix[r]:[];
    const headers=row.map(v=>String(v??''));
    const pi=poExcelHeaderIndex(headers,aliases.po), pri=poExcelHeaderIndex(headers,aliases.profile), ii=poExcelHeaderIndex(headers,aliases.item), qi=poExcelHeaderIndex(headers,aliases.qty);
    if(pi>=0&&pri>=0&&ii>=0&&qi>=0) return {row:r,pi,pri,ii,qi,headers};
  }
  return null;
}

window.processExcelUpload = async function(){
  if(currentUserRole!=='Admin'&&currentUserRole!=='Planner') return showToast('Only Admin / Planner can upload Production Orders.','warning');
  if(isAppBusy) return showToast('Another save/upload is already running. Please wait.','warning');
  const input=document.getElementById('excelUpload'), file=input?.files?.[0];
  if(!file) return showToast('Please select the Production Order Excel file first.','warning');
  if(!/\.(xlsx|xls|csv)$/i.test(file.name)) return showToast('Invalid file. Select .xlsx, .xls or .csv only.','error');
  if(typeof XLSX==='undefined') return showToast('Excel reader is not loaded. Refresh the page and try again.','error');

  isAppBusy=true;
  const btn=document.getElementById('poUploadBtn'), oldBtn=btn?.innerHTML||'';
  try{
    if(btn){btn.disabled=true;btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Reading Excel...';}
    // Make sure the Master Catalog is loaded before matching Profile + Item Code.
    if(!Array.isArray(masterData)||masterData.length===0){
      if(typeof loadDataFromSupabase==='function') await loadDataFromSupabase(true);
    }
    if(!Array.isArray(masterData)||masterData.length===0) throw new Error('Master Catalog is not loaded. Please wait for data sync to finish, then try again.');

    const buffer=await file.arrayBuffer();
    const workbook=XLSX.read(buffer,{type:'array',cellDates:true,raw:true});
    if(!workbook.SheetNames?.length) throw new Error('No worksheet found in the selected Excel file.');

    const aliases={
      po:['PO Number','PO number','PO #','PO No','PO No.','PO','Purchase Order','Order No','Order Number','PO Number '],
      profile:['Profile','Profile #','Profile No','Profile No.','Profile Number','Profile Code'],
      item:['Item Code','Item code','Item','Item No','Item No.','Code','Part No','Part Number'],
      qty:['Quantity (Pcs.)','Quantity (Pcs)','Quantity Pcs','Quantity','Qty','qty','Order Qty','Order Quantity','Required Qty','Required Quantity','Pcs','Pcs Qty','Pcs.','Total Qty']
    };

    let found=null;
    for(const sheetName of workbook.SheetNames){
      const ws=workbook.Sheets[sheetName];
      const matrix=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:true,blankrows:false});
      const h=poExcelFindHeaderRow(matrix,aliases);
      if(h){found={sheetName,matrix,h};break;}
    }
    if(!found) throw new Error('Excel headers not found. Required columns: PO Number, Profile, Item Code, Quantity (Pcs.). The system accepts the sample format shown on this page.');

    const poDate=poExcelDateFromInput();
    const rows=found.matrix.slice(found.h.row+1);
    const newRows=[],errors=[],uploadKeys=new Set();
    const existingKeys=new Set(poList.map(p=>`${normalizePoExcelText(p.poNumber).toLowerCase()}|${poExcelNormalizeProfile(p.profile)}|${cleanLen(p.length)}`));

    rows.forEach((vals,index)=>{
      const excelRow=found.h.row+index+2;
      const poNumber=normalizePoExcelText(poExcelGetRowValue(vals,found.h.pi));
      const profileRaw=normalizePoExcelText(poExcelGetRowValue(vals,found.h.pri));
      const itemCode=normalizePoExcelText(poExcelGetRowValue(vals,found.h.ii));
      const rawQty=poExcelGetRowValue(vals,found.h.qi);
      const qty=poExcelNumber(rawQty);
      const allBlank=!poNumber&&!profileRaw&&!itemCode&&!String(rawQty??'').trim();
      if(allBlank) return;
      if(!poNumber) return errors.push(`Row ${excelRow}: PO Number is missing.`);
      if(!profileRaw) return errors.push(`Row ${excelRow}: Profile is missing.`);
      if(!itemCode) return errors.push(`Row ${excelRow}: Item Code is missing.`);
      if(!Number.isFinite(qty)||qty<=0) return errors.push(`Row ${excelRow}: Quantity must be greater than 0.`);
      if(Math.floor(qty)!==qty) return errors.push(`Row ${excelRow}: Quantity must be a whole number.`);

      const matches=findPoMasterByProfileItem(profileRaw,itemCode);
      let storedProfile=normalizePoExcelText(profileRaw), length='';

      if(matches.length>0){
        const uniqueLengths=[...new Set(matches.map(m=>cleanLen(m.length)).filter(Boolean))];
        if(uniqueLengths.length!==1) return errors.push(`Row ${excelRow}: ${profileRaw} + ${itemCode} matches multiple lengths (${uniqueLengths.join(', ')} mm). Master Catalog needs one unique length for this Item Code.`);
        const master=matches[0];
        storedProfile=normalizePoExcelText(master.profile);
        length=cleanLen(master.length);
      }else{
        // Fallback for a missing Master Catalog line: resolve the cut length from
        // the user's existing item-code convention instead of rejecting the whole PO.
        // Do not create or modify Master Catalog data here.
        length=inferPoLengthFromItemCode(itemCode);
        if(!length) return errors.push(`Row ${excelRow}: Profile ${profileRaw} + Item Code ${itemCode} was not found in Master Catalog and its length could not be safely inferred from the Item Code.`);
      }

      const key=`${poNumber.toLowerCase()}|${poExcelNormalizeProfile(storedProfile)}|${length}`;
      if(existingKeys.has(key)) return errors.push(`Row ${excelRow}: PO ${poNumber} / ${storedProfile} / ${length} mm already exists. Existing data was not changed.`);
      if(uploadKeys.has(key)) return errors.push(`Row ${excelRow}: duplicate PO/Profile/Length line in this Excel file.`);
      uploadKeys.add(key);
      newRows.push({po_date:poDate,po_number:poNumber,profile:storedProfile,length,order_qty:Math.round(qty)});
    });

    if(errors.length){
      const preview=errors.slice(0,15).join('\n');
      throw new Error(`Upload stopped. NO rows were saved.\n\n${preview}${errors.length>15?`\n...and ${errors.length-15} more error(s).`:''}`);
    }
    if(!newRows.length) throw new Error('No valid Production Order rows were found in the selected Excel file.');

    if(btn) btn.innerHTML=`<i class="fa-solid fa-spinner fa-spin"></i> Saving ${newRows.length} rows...`;
    // INSERT only: never overwrite existing Production Orders.
    const result=await supabaseClient.from('production_orders').insert(newRows);
    if(result.error) throw new Error(dbErrorMessage(result.error,`Production Order Excel upload failed (${result.error.code||'DB'})`));

    // Reload from Supabase so the UI uses real database IDs/data instead of temporary IDs.
    if(typeof loadDataFromSupabase==='function') await loadDataFromSupabase(true);
    updatePoFilters();renderPoDetailsTable();renderPoCharts();renderDashboard();populateShipmentPoDropdown();populatePlPoDropdown();renderBalanceWorkTable();
    aisRegisterUndo(`Production Order Excel • ${newRows.length} row(s)`,async()=>{
      for(const row of newRows.slice().reverse()) await aisDeleteLatest('production_orders',{po_date:row.po_date,po_number:row.po_number,profile:row.profile,length:row.length,order_qty:row.order_qty});
      await loadDataFromSupabase(true);
    },'poManagementTab');
    showToast(`${newRows.length} Production Order row(s) uploaded successfully from ${found.sheetName}.`,'success');
    input.value='';
    const status=document.getElementById('poExcelFileStatus');if(status){status.textContent='Upload complete. Select another Excel file when needed.';status.style.color='#047857';}
  }catch(e){
    console.error('Production Order Excel upload error:',e);
    showToast(String(e?.message||e).replace(/\n/g,' • '),'error');
  }finally{
    isAppBusy=false;
    if(btn){btn.disabled=false;btn.innerHTML=oldBtn||'<i class="fa-solid fa-cloud-arrow-up"></i> Upload Excel';}
  }
};

async function saveNewPO() {
  if(isAppBusy)return; isAppBusy=true;
  try{
    const dateVal=document.getElementById('poDate').value, poNum=document.getElementById('poNumber').value.trim(), profileVal=document.getElementById('poSelectProfile').value, itemCodeVal=document.getElementById('poSelectItemCode').value, lengthVal=document.getElementById('poSelectLength').value, orderQtyVal=parseInt(document.getElementById('poOrderQty').value)||0;
    if(!dateVal||!poNum||!profileVal||!itemCodeVal||!lengthVal||orderQtyVal<=0)return showToast('Fill all valid values','warning');
    const selectedMaster=masterData.find(m=>String(m.profile).trim()===profileVal&&cleanLen(m.length)===cleanLen(lengthVal)&&String(m.itemCode||'').trim()===itemCodeVal)
      || masterData.find(m=>String(m.profile).trim()===profileVal&&cleanLen(m.length)===cleanLen(lengthVal));
    const resolvedItemCode=selectedMaster?.itemCode||itemCodeVal;
    const newPo={po_date:dateVal,po_number:poNum,profile:profileVal,length:cleanLen(lengthVal),order_qty:orderQtyVal};
    const inserted=await dbInsert('production_orders',newPo,'PO save failed');
    poList.unshift({id:inserted.id || -Date.now(),date:dateVal,poNumber:poNum,profile:profileVal,itemCode:resolvedItemCode,length:cleanLen(lengthVal),orderQty:orderQtyVal});
    aisRegisterUndo(`Production Order • ${poNum} • ${profileVal}`,async()=>{await aisDeleteLatest('production_orders',{po_date:newPo.po_date,po_number:newPo.po_number,profile:newPo.profile,length:newPo.length,order_qty:newPo.order_qty});},'poManagementTab');
    showToast('PO saved to Supabase successfully!','success'); document.getElementById('poEntryForm').reset(); updatePoFilters(); renderPoDetailsTable(); renderPoCharts(); renderDashboard(); populateShipmentPoDropdown(); populatePlPoDropdown(); renderBalanceWorkTable();
  }catch(e){console.error('PO save error:',e);showToast(e.message||'PO save failed.','error');}finally{isAppBusy=false;}
}

function deletePoItem(id) { if (currentUserRole !== 'Admin') return; showConfirm("Delete Production Order?", async () => { await supabaseClient.from('production_orders').delete().eq('id', id); poList = poList.filter(p => p.id !== id); updatePoFilters(); renderPoDetailsTable(); renderPoCharts(); renderDashboard(); populateShipmentPoDropdown(); populatePlPoDropdown(); renderBalanceWorkTable(); showToast("Deleted", "success"); }); }

function getShipmentMasterItemCode(shipment){
  const profile=String(shipment?.profile||'').trim();
  const length=cleanLen(shipment?.length||'');
  if(!profile || !length) return '';
  const matches=masterData.filter(m=>String(m.profile||'').trim()===profile && cleanLen(m.length)===length && String(m.itemCode||'').trim());
  return matches.length ? String(matches[0].itemCode).trim() : '';
}
function getShipmentLineItemCode(po){
  const profile=String(po?.profile||'').trim();
  const length=cleanLen(po?.length||'');
  const match=masterData.find(m=>String(m.profile||'').trim()===profile && cleanLen(m.length)===length && String(m.itemCode||'').trim());
  return match ? String(match.itemCode).trim() : '';
}
function shipmentSelectionKey(poNum,profile,itemCode,length){
  return [String(poNum||'').trim(),String(profile||'').trim(),String(itemCode||'').trim(),cleanLen(length||'')].join('||');
}
function getShipmentRequiredQty(poNum,profile,itemCode,length){
  return poList.reduce((sum,p)=>{
    if(String(p.poNumber||'').trim()!==String(poNum||'').trim() || String(p.profile||'').trim()!==String(profile||'').trim() || cleanLen(p.length)!==cleanLen(length)) return sum;
    if(getShipmentLineItemCode(p)!==String(itemCode||'').trim()) return sum;
    return sum + Math.max(0,Number(p.orderQty)||0);
  },0);
}
function getShipmentAlreadyShippedQty(poNum,profile,itemCode,length){
  return shipmentList.reduce((sum,sh)=>{
    if(String(sh.poNumber||'').trim()!==String(poNum||'').trim() || String(sh.profile||'').trim()!==String(profile||'').trim() || cleanLen(sh.length)!==cleanLen(length)) return sum;
    const shippedItem=getShipmentMasterItemCode(sh);
    if(shippedItem && shippedItem!==String(itemCode||'').trim()) return sum;
    return sum + Math.max(0,Number(sh.shippedQty)||0);
  },0);
}
function getShipmentBalanceQty(poNum,profile,itemCode,length){
  return Math.max(0,getShipmentRequiredQty(poNum,profile,itemCode,length)-getShipmentAlreadyShippedQty(poNum,profile,itemCode,length));
}
function getShipmentAvailablePoLines(){
  const seen=new Set();
  return poList.filter(p=>{
    const poNum=String(p.poNumber||'').trim(),profile=String(p.profile||'').trim(),length=cleanLen(p.length),itemCode=getShipmentLineItemCode(p);
    if(!poNum||!profile||!length||!itemCode) return false;
    const key=shipmentSelectionKey(poNum,profile,itemCode,length);
    if(seen.has(key)) return false;
    seen.add(key);
    return getShipmentBalanceQty(poNum,profile,itemCode,length)>0;
  });
}
function resetShipmentQtyDisplays(){
  const total=document.getElementById('shipTotalOrderQty'); if(total) total.value='';
  const balance=document.getElementById('shipBalanceQty'); if(balance) balance.value='';
}
function populateShipmentPoDropdown(){
  const poSelect=document.getElementById('shipSelectPo'); if(!poSelect)return;
  const current=String(poSelect.value||'').trim();
  const available=getShipmentAvailablePoLines();
  const pos=[...new Set(available.map(p=>String(p.poNumber).trim()))];
  poSelect.innerHTML='<option value="">-- Choose PO Number --</option>';
  pos.forEach(po=>poSelect.appendChild(new Option(po,po)));
  if(pos.includes(current)) poSelect.value=current;
  else poSelect.value='';
}
function onShipmentPoSelect(){
  const poNum=document.getElementById('shipSelectPo').value;
  const profileSelect=document.getElementById('shipSelectProfile');
  profileSelect.innerHTML='<option value="">-- Select Profile --</option>';
  document.getElementById('shipSelectItemCode').innerHTML='<option value="">-- Select Item Code --</option>';
  document.getElementById('shipSelectLength').innerHTML='<option value="">-- Select Length --</option>';
  resetShipmentQtyDisplays(); if(!poNum)return;
  const profiles=[...new Set(getShipmentAvailablePoLines().filter(p=>String(p.poNumber).trim()===String(poNum).trim()).map(p=>String(p.profile).trim()))];
  profiles.forEach(profile=>profileSelect.appendChild(new Option(profile,profile)));
}
function onShipmentProfileSelect(){
  const poNum=document.getElementById('shipSelectPo').value, profile=document.getElementById('shipSelectProfile').value;
  const itemSelect=document.getElementById('shipSelectItemCode');
  itemSelect.innerHTML='<option value="">-- Select Item Code --</option>';
  document.getElementById('shipSelectLength').innerHTML='<option value="">-- Select Length --</option>';
  resetShipmentQtyDisplays(); if(!poNum||!profile)return;
  const items=[...new Set(getShipmentAvailablePoLines().filter(p=>String(p.poNumber).trim()===poNum && String(p.profile).trim()===profile).map(getShipmentLineItemCode).filter(Boolean))];
  items.forEach(code=>itemSelect.appendChild(new Option(code,code)));
}
function onShipmentItemCodeSelect(){
  const poNum=document.getElementById('shipSelectPo').value, profile=document.getElementById('shipSelectProfile').value, itemCode=document.getElementById('shipSelectItemCode').value;
  const lengthSelect=document.getElementById('shipSelectLength');
  lengthSelect.innerHTML='<option value="">-- Select Length --</option>';
  resetShipmentQtyDisplays(); if(!poNum||!profile||!itemCode)return;
  const lengths=[...new Set(getShipmentAvailablePoLines().filter(p=>String(p.poNumber).trim()===poNum && String(p.profile).trim()===profile && getShipmentLineItemCode(p)===itemCode).map(p=>String(p.length)))];
  lengths.forEach(length=>lengthSelect.appendChild(new Option(`${length} mm`,length)));
  if(lengths.length===1){lengthSelect.value=lengths[0];onShipmentLengthSelect();}
}
function onShipmentLengthSelect(){
  const poNum=document.getElementById('shipSelectPo').value, profile=document.getElementById('shipSelectProfile').value, itemCode=document.getElementById('shipSelectItemCode').value, length=cleanLen(document.getElementById('shipSelectLength').value);
  const total=document.getElementById('shipTotalOrderQty'), balance=document.getElementById('shipBalanceQty');
  const required=getShipmentRequiredQty(poNum,profile,itemCode,length), remaining=getShipmentBalanceQty(poNum,profile,itemCode,length);
  total.value=required>0?`${required.toLocaleString()} Pcs`:'';
  if(balance){balance.value=required>0?`${remaining.toLocaleString()} Pcs`:'';balance.style.color=remaining>0?'#047857':'#b91c1c';balance.style.fontWeight='800';}
}
async function saveShipmentEntry(){
 if(isAppBusy)return; isAppBusy=true;
 try{
  if(currentUserRole!=='Admin')return;
  const poNum=document.getElementById('shipSelectPo').value,profile=document.getElementById('shipSelectProfile').value,itemCode=document.getElementById('shipSelectItemCode').value,length=cleanLen(document.getElementById('shipSelectLength').value),shipDate=document.getElementById('shipmentDate').value,month=document.getElementById('shipmentMonth').value,container=document.getElementById('shipmentContainer').value,qtyToShip=parseInt(document.getElementById('shipmentQty').value)||0;
  if(!poNum||!profile||!itemCode||!length||qtyToShip<=0)return showToast('Complete all shipment fields.','warning');
  const po=poList.find(p=>String(p.poNumber).trim()===String(poNum).trim()&&cleanLen(p.length)===length&&String(p.profile).trim()===String(profile).trim()&&getShipmentLineItemCode(p)===String(itemCode).trim());
  if(!po)return showToast('Selected PO/profile/item/length was not found or has no balance.','error');
  const requiredQty=getShipmentRequiredQty(poNum,profile,itemCode,length);
  const shippedSoFar=getShipmentAlreadyShippedQty(poNum,profile,itemCode,length);
  const remainingBefore=Math.max(0,requiredQty-shippedSoFar);
  if(remainingBefore<=0)return showToast('This PO/profile/item/length is already fully shipped.','warning');
  if(qtyToShip>remainingBefore)return showToast(`Shipment exceeds PO balance. Available: ${remainingBefore} Pcs.`,'error');

  const cat=masterData.find(m=>String(m.profile).trim()===String(profile).trim()&&cleanLen(m.length)===length&&String(m.itemCode||'').trim()===String(itemCode).trim());
  if(!cat||!cat.db_id)return showToast('Selected item is not linked to Master Catalog.','error');

  // Shipment consumes the highest available stock stage first. If that stage does not
  // have enough, continue backwards through Box -> Wrapping -> Punch -> Cut.
  const stages=['crateQty','boxQty','wrapQty','punchQty','cutQty'];
  const before={}; stages.forEach(k=>before[k]=Math.max(0,Number(cat[k])||0));
  const totalAvailable=stages.reduce((sum,k)=>sum+before[k],0);
  if(qtyToShip>totalAvailable){
    return showToast(`Insufficient stock for shipment. Available across Crate/Box/Wrap/Punch/Cut: ${totalAvailable} Pcs.`,'error');
  }
  let remainingToDeduct=qtyToShip; const deduction={};
  stages.forEach(k=>{ const take=Math.min(before[k],remainingToDeduct); deduction[k]=take; remainingToDeduct-=take; });
  if(remainingToDeduct>0) throw new Error('Stock allocation failed. Please refresh and try again.');
  const after={}; stages.forEach(k=>after[k]=before[k]-(deduction[k]||0));

  const newRemaining=remainingBefore-qtyToShip;
  const newShipment={shipment_date:shipDate,shipment_month:month,po_number:poNum,profile,length,container,shipped_qty:qtyToShip,remaining_balance:newRemaining};
  // RLS-safe shipment insert: do not request the inserted row back with .select().single().
  // A policy can allow INSERT while denying SELECT/RETURNING, which previously made a
  // successful shipment look like a save/sync error.
  const {error:shipError}=await supabaseClient.from('shipments').insert([newShipment]);
  if(shipError)throw new Error(`Shipment save failed: ${shipError.message}`);

  try {
    const stockPayload={cut_qty:after.cutQty,punch_qty:after.punchQty,wrap_qty:after.wrapQty,box_qty:after.boxQty,crate_qty:after.crateQty};
    const {error:stockError}=await supabaseClient.from('master_catalog').update(stockPayload).eq('id',cat.db_id);
    if(stockError)throw new Error(`Shipment stock update failed: ${stockError.message}`);
    Object.assign(cat,after);
  } catch(stockErr) {
    // Best-effort rollback without requiring SELECT/RETURNING permissions.
    try {
      await supabaseClient.from('shipments')
        .delete()
        .eq('shipment_date', newShipment.shipment_date)
        .eq('po_number', newShipment.po_number)
        .eq('profile', newShipment.profile)
        .eq('length', newShipment.length)
        .eq('container', newShipment.container)
        .eq('shipped_qty', newShipment.shipped_qty)
        .eq('remaining_balance', newShipment.remaining_balance);
    } catch(rb){ console.error('Shipment rollback failed:',rb); }
    throw stockErr;
  }

  const shipmentLocalId=-Date.now();
  shipmentList.unshift({id:shipmentLocalId,date:shipDate,month,poNumber:poNum,profile,itemCode:getShipmentMasterItemCode({profile,length}) || itemCode,length,container,shippedQty:qtyToShip,remainingBalance:newRemaining});
  aisRegisterUndo(`Shipment • ${poNum} • ${qtyToShip} Pcs`,async()=>{
    await aisDeleteLatest('shipments',{shipment_date:newShipment.shipment_date,shipment_month:newShipment.shipment_month,po_number:newShipment.po_number,profile:newShipment.profile,length:newShipment.length,container:newShipment.container,shipped_qty:newShipment.shipped_qty,remaining_balance:newShipment.remaining_balance});
    await aisUpdateById('master_catalog',cat.db_id,{cut_qty:before.cutQty,punch_qty:before.punchQty,wrap_qty:before.wrapQty,box_qty:before.boxQty,crate_qty:before.crateQty});
  },'shipmentTab');
  const deductionSummary=stages.filter(k=>(deduction[k]||0)>0).map(k=>`${k.replace('Qty','')}: ${deduction[k]} Pcs`).join(' • ');
  showToast(`Shipment saved. Stock deducted: ${deductionSummary}.`,'success');

  // Keep the user's last selections. Only the shipment quantity is cleared.
  document.getElementById('shipmentQty').value='';
  rememberAISFormFields();
  populateShipmentPoDropdown(); onShipmentPoSelect();
  renderShipmentHistoryTable(); renderDashboard(); renderProfileSummaryTable(); renderBalanceWorkTable(); updatePoFilters(); renderPoDetailsTable();
 }catch(e){console.error('Shipment save error:',e);showToast(e.message||'Shipment save failed.','error');}finally{isAppBusy=false;}
}

function deleteShipmentItem(id) { if (currentUserRole !== 'Admin') return; showConfirm("Delete this Shipment?", async () => { await supabaseClient.from('shipments').delete().eq('id', id); shipmentList = shipmentList.filter(s => s.id !== id); window.renderShipmentHistoryTable(); renderDashboard(); renderBalanceWorkTable(); updatePoFilters(); renderPoDetailsTable(); showToast("Deleted", "success"); }); }

window.downloadPackingTemplate = function(){
    if(typeof XLSX==='undefined') return showToast('Excel library not loaded.','error');
    const rows=[
      {'Crate No':'11-i','Profile':'AL-1037','Item Code':'RT-BT68','Length (mm)':2500,'Qty':100},
      {'Crate No':'11-ii','Profile':'AL-1037','Item Code':'RT-BT68','Qty':150}
    ];
    exportTableToExcel(rows,'AIS_Packing_List_Simple_Template','Packing List');
};

function allocatePackingLineStock(records) {
    // Allocate available stock once across the selected shipment's crate lines.
    // Manually completed crates reserve Crate-stage stock first; remaining lines
    // consume Box -> Wrapping -> Punch -> Cut. No Master Catalog values are mutated.
    const stocks = masterData.map(m => ({
        catalog:m,
        profile:String(m.profile||'').trim(), itemCode:String(m.itemCode||'').trim(), length:cleanLen(m.length),
        cut:Math.max(0,Number(m.cutQty)||0), punch:Math.max(0,Number(m.punchQty)||0),
        wrap:Math.max(0,Number(m.wrapQty)||0), box:Math.max(0,Number(m.boxQty)||0), crate:Math.max(0,Number(m.crateQty)||0)
    }));
    const findStock = item => stocks.find(s =>
        s.profile===String(item.profile||'').trim() && s.length===cleanLen(item.length) &&
        (!String(item.itemCode||'').trim() || s.itemCode===String(item.itemCode||'').trim())
    );
    const allocations = new Map();
    const ordered = [...records].sort((a,b)=>{
        const am=isManualCrateComplete(a.crateNo,activePackingContainer,activePackingMonth);
        const bm=isManualCrateComplete(b.crateNo,activePackingContainer,activePackingMonth);
        if(am!==bm) return am?-1:1;
        return sortCrates(a,b);
    });
    ordered.forEach(item=>{
        const req=Math.max(0,Number(item.pcsQty)||0);
        const manual=isManualCrateComplete(item.crateNo,activePackingContainer,activePackingMonth);
        const stock=findStock(item);
        const a={req,manual,crate:0,box:0,wrap:0,punch:0,cut:0,pending:0,catalog:stock?.catalog||null};
        if(stock && manual){
            a.crate=Math.min(req,stock.crate);
            stock.crate-=a.crate;
            // A completed flag is the packing record; don't reclassify any shortfall
            // as Cut/WIP, since those pieces may already have been shipped.
        } else if(stock && req>0){
            let left=req;
            a.box=Math.min(left,stock.box); stock.box-=a.box; left-=a.box;
            a.wrap=Math.min(left,stock.wrap); stock.wrap-=a.wrap; left-=a.wrap;
            a.punch=Math.min(left,stock.punch); stock.punch-=a.punch; left-=a.punch;
            a.cut=Math.min(left,stock.cut); stock.cut-=a.cut; left-=a.cut;
            a.pending=Math.max(0,left);
        } else if(req>0) a.pending=req;
        if(manual) a.status='Manual Packed';
        else if(a.box+a.wrap>=req && req>0) a.status='Ready to Pack';
        else if(a.box+a.wrap+a.punch>=req && req>0) a.status='Pending Wrapping';
        else if(a.box+a.wrap+a.punch+a.cut>=req && req>0) a.status='Pending Punch';
        else a.status='Pending Cut';
        allocations.set(item,a);
    });
    return allocations;
}

function getReadyCrateRows(records) {
    const rows=[];
    const allocations=allocatePackingLineStock(records);
    const crateGroups=new Map();
    [...records].sort(sortCrates).forEach(item=>{
        const crateNo=String(item.crateNo||'-').trim();
        if(!crateGroups.has(crateNo)) crateGroups.set(crateNo,[]);
        crateGroups.get(crateNo).push(item);
    });
    const priority={'Pending Cut':1,'Pending Punch':2,'Pending Wrapping':3,'Ready to Pack':99,'Manual Packed':100};
    crateGroups.forEach(items=>{
        const crateNo=String(items[0]?.crateNo||'-').trim();
        const manual=isManualCrateComplete(crateNo,activePackingContainer,activePackingMonth);
        const details=[];
        let crateStatus=manual?'Manual Packed':'Ready to Pack', statusPriority=manual?100:99;
        items.forEach(item=>{
            const a=allocations.get(item)||{req:Number(item.pcsQty)||0,crate:0,box:0,wrap:0,punch:0,cut:0,pending:Number(item.pcsQty)||0,status:'Pending Cut'};
            const req=Math.max(0,Number(item.pcsQty)||0);
            const finalStatus=manual?'Manual Packed':a.status;
            if(!manual && priority[finalStatus]<statusPriority){statusPriority=priority[finalStatus];crateStatus=finalStatus;}
            const exPlan=getExtrusionPlan(item.profile,item.itemCode,item.length,req);
            details.push({
                id:item.id,crateNo,profile:item.profile||'-',itemCode:item.itemCode||'-',length:item.length||'-',
                exLength:exPlan.exLength,pcsPerEx:exPlan.pcsPerEx,requiredExtrusions:exPlan.requiredExtrusions,
                pcsQty:req,availableBox:Math.min(req,a.box+a.wrap),status:finalStatus,
                cut:a.cut,punch:a.punch,wrap:a.wrap,box:a.box,crate:a.crate,pending:a.pending,
                plNumber:item.plNumber||'',poNumber:item.poNumber||'',date:item.date||''
            });
        });
        if(manual) crateStatus='Manual Packed';
        rows.push({
            id:details[0]?.id,crateNo,profile:details[0]?.profile||'-',itemCode:details[0]?.itemCode||'-',length:details[0]?.length||'-',
            pcsQty:details.reduce((s,x)=>s+x.pcsQty,0),availableBox:details.reduce((s,x)=>s+x.availableBox,0),
            requiredExtrusions:details.reduce((s,x)=>s+(Number(x.requiredExtrusions)||0),0),status:crateStatus,
            profiles:details,profileCount:details.length,plNumber:details.map(x=>x.plNumber).filter(Boolean).join(', '),
            poNumber:details.map(x=>x.poNumber).filter(Boolean).join(', ')
        });
    });
    return rows;
}
function getFilteredReadyCrateRows(records){
    const status=(document.getElementById('plReadyStatusFilter')?.value||'').trim();
    const search=(document.getElementById('plReadySearch')?.value||'').trim().toLowerCase();
    return getReadyCrateRows(records).filter(r=>{
        const statusOk=!status||r.status===status;
        const text=[r.crateNo,r.profile,r.itemCode,r.length,r.plNumber,r.poNumber].join(' ').toLowerCase();
        return statusOk && (!search||text.includes(search));
    });
}
window.exportPlReadyCrates=function(){
    ensurePackingSelection();
    const rows=getFilteredReadyCrateRows(getPackingContainerRecords(activePackingMonth,activePackingContainer));
    const data=rows.map(r=>({'Crate ID':r.crateNo,'Profile':r.profile,'Item Code':r.itemCode,'Length':r.length,'Req Qty':r.pcsQty,'Box + Wrap Available':r.availableBox,'Status':r.status}));
    exportTableToExcel(data,'AIS_Ready_Crates','Ready Crates');
};
window.exportPlReadyCratesPdf=async function(){
    ensurePackingSelection();
    const source=document.querySelector('#plReadyToPackTableBody')?.closest('.card');
    if(!source){ showToast('Packing List crate section not found.','error'); return; }
    if(typeof window.html2canvas!=='function' || !window.jspdf?.jsPDF){
        showToast('PDF display engine is not loaded. Please check your internet connection and refresh.','error');
        return;
    }

    const filterLabel=document.getElementById('plReadyStatusFilter')?.value||'All Statuses';
    const searchValue=(document.getElementById('plReadySearch')?.value||'').trim();
    const stamp=new Date().toLocaleString('en-GB',{hour12:false});
    let cloneWrap=null;
    try{
        showToast('Preparing A4 Packing List PDF...','info');
        const cardNodes=[...source.querySelectorAll('tr.crate-card-row > td > div')];
        if(!cardNodes.length) return showToast('No crate cards are available to export.','warning');

        cloneWrap=document.createElement('div');
        cloneWrap.style.cssText='position:fixed;left:-30000px;top:0;width:1400px;background:#fff;padding:0;z-index:-1;box-sizing:border-box;';
        document.body.appendChild(cloneWrap);

        const {jsPDF}=window.jspdf;
        const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
        const pageW=doc.internal.pageSize.getWidth();
        const pageH=doc.internal.pageSize.getHeight();
        const margin=7;
        const usableW=pageW-margin*2;
        const headerH=15;
        const contentBottom=pageH-margin;
        const maxCardH=contentBottom-(margin+headerH);
        let pageStarted=false;
        let y=margin+headerH;

        const drawPageHeader=()=>{
            doc.setTextColor(7,91,99);
            doc.setFont('helvetica','bold');
            doc.setFontSize(12);
            doc.text('Alumex PLC - Packing List / Crate Readiness',margin,margin+4);
            doc.setFont('helvetica','normal');
            doc.setFontSize(7.5);
            doc.setTextColor(71,85,105);
            const sub=`${activePackingMonth} • ${activePackingContainer} • Filter: ${filterLabel}${searchValue?` • Search: ${searchValue}`:''} • ${stamp}`;
            doc.text(sub,margin,margin+9);
            doc.setDrawColor(190,215,220);
            doc.line(margin,margin+11, pageW-margin,margin+11);
        };

        drawPageHeader();
        pageStarted=true;

        for(let idx=0; idx<cardNodes.length; idx++){
            const card=cardNodes[idx].cloneNode(true);
            card.style.width='100%';
            card.style.maxWidth='none';
            card.style.margin='0';
            card.style.boxSizing='border-box';
            card.style.transform='none';
            card.style.boxShadow='none';
            card.style.transition='none';
            card.style.breakInside='avoid';
            card.querySelectorAll('button,.btn').forEach(el=>el.style.display='none');
            card.querySelectorAll('label').forEach(el=>{if(el.querySelector('input[type="checkbox"]')) el.style.display='none';});
            card.querySelectorAll('input[type="checkbox"]').forEach(el=>el.style.display='none');
            cloneWrap.innerHTML='';
            cloneWrap.appendChild(card);

            await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
            const canvas=await window.html2canvas(card,{
                scale:1.6,useCORS:true,backgroundColor:'#ffffff',logging:false,
                width:cloneWrap.scrollWidth,windowWidth:cloneWrap.scrollWidth,
                height:Math.max(card.scrollHeight,1),windowHeight:Math.max(card.scrollHeight,1)
            });

            let cardH=(canvas.height/canvas.width)*usableW;
            let cardW=usableW;
            // A single unusually tall crate is scaled to fit one printable page;
            // normal crate cards retain their full readable width.
            if(cardH>maxCardH){
                const ratio=maxCardH/cardH;
                cardH=maxCardH;
                cardW=usableW*ratio;
            }
            if(y+cardH>contentBottom && y>margin+headerH+1){
                doc.addPage();
                drawPageHeader();
                y=margin+headerH;
            }
            const x=margin+(usableW-cardW)/2;
            doc.addImage(canvas.toDataURL('image/jpeg',0.94),'JPEG',x,y,cardW,cardH,undefined,'FAST');
            y+=cardH+3;
        }

        doc.save(`AIS_Packing_List_${String(activePackingMonth).replace(/\s+/g,'_')}_${String(activePackingContainer).replace(/\s+/g,'_')}.pdf`);
        showToast('A4 PDF downloaded. Each crate card stays together and will not be cut across pages.','success');
    }catch(e){
        console.error('Packing List PDF export error:',e);
        showToast(`Packing List PDF export failed: ${e?.message||e}`,'error');
    }finally{
        if(cloneWrap && cloneWrap.parentNode) cloneWrap.parentNode.removeChild(cloneWrap);
    }
};
window.exportPlConsolidated=function(){
    ensurePackingSelection();
    const rows=[]; document.querySelectorAll('#plSummaryTableBody tr').forEach(tr=>{const cells=[...tr.querySelectorAll('td')].map(td=>td.innerText.trim()); if(cells.length===12) rows.push(cells);});
    if(!rows.length) return showToast('No Packing List balance data to export!','warning');
    const headers=['Profile','Item Code','Cut Length','Ex Length','Pcs / Ex','Total Req Pcs','Req Extrusions (from PL Balance)','Current Stock (Pcs)','WIP: Cut + Punch (Pcs)','Complete: Wrap + Box + Crate (Pcs)','PL Balance','Cardboard Bal'];
    const data=rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]||''])));
    exportTableToExcel(data,'AIS_Packing_Summary_Active_PL','Packing Summary - Active PL');
};
window.exportPlConsolidatedPdf=function(){
    ensurePackingSelection();
    const rows=[]; document.querySelectorAll('#plSummaryTableBody tr').forEach(tr=>{const cells=[...tr.querySelectorAll('td')].map(td=>td.innerText.trim()); if(cells.length===12) rows.push(cells);});
    if(!rows.length) return showToast('No Packing List balance data to print!','warning');
    const headers=['Profile','Item Code','Cut Length','Ex Length','Pcs / Ex','Total Req Pcs','Req Extrusions (from PL Balance)','Current Stock (Pcs)','WIP: Cut + Punch (Pcs)','Complete: Wrap + Box + Crate (Pcs)','PL Balance','Cardboard Bal'];
    const data=rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]||''])));
    exportDataToPdf(data,'AIS_Packing_Summary_Active_PL','AIS Tracker - Packing List Summary (Active PL)',`Month: ${activePackingMonth} • ${activePackingContainer} • Filter: ${document.getElementById('plSummaryBalanceFilter')?.selectedOptions?.[0]?.text||'All'}`);
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
        const stageAllocations=allocatePackingLineStock(filteredPls);
        filteredPls.forEach(pl => {
            const reqQty = Math.max(0,Number(pl.pcsQty)||0);
            const allocation=stageAllocations.get(pl)||{crate:0,box:0,wrap:0,punch:0,cut:0,pending:reqQty};
            const matched = masterData.find(m => String(m.profile).trim() === String(pl.profile).trim() && cleanLen(m.length) === cleanLen(pl.length) && (!pl.itemCode || String(m.itemCode||'').trim()===String(pl.itemCode).trim()));
            const uw = matched ? (Number(matched.unitWeight)||0) : 0;
            if (!crateMap[pl.crateNo]) crateMap[pl.crateNo] = { req: 0, comp: 0, items: [] };
            crateMap[pl.crateNo].req += reqQty;
            crateMap[pl.crateNo].comp += Math.min(reqQty,allocation.box+allocation.wrap);
            crateMap[pl.crateNo].items.push({ profile: pl.profile, itemCode: pl.itemCode || (matched ? matched.itemCode : ''), length: pl.length, req: reqQty, crate: allocation.crate||0, box: allocation.box||0, wrap: allocation.wrap||0, punch: allocation.punch||0, cut: allocation.cut||0, pending: allocation.pending||0, unitWeight: uw });
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
            else if (crate.items.every(i => (i.box + i.wrap) >= i.req) && totReq > 0) { stageName = "READY TO PACK"; stageColor = "#10b981"; stageBg = "#ecfdf5"; icon = "fa-box"; }
            else if (totPending > 0) { stageName = "Awaiting / Short"; stageColor = "#e11d48"; stageBg = "#fff1f2"; icon = "fa-hourglass-start"; }
            else if (totCut > 0) { stageName = "Processing: Cut"; stageColor = "#0284c7"; stageBg = "#f0f9ff"; icon = "fa-scissors"; }
            else if (totPunch > 0) { stageName = "Processing: Punch"; stageColor = "#ea580c"; stageBg = "#fff7ed"; icon = "fa-hammer"; }
            else if (totWrap > 0) { stageName = "Processing: Wrap"; stageColor = "#d946ef"; stageBg = "#fdf4ff"; icon = "fa-scroll"; }
            else if (totBox > 0) { stageName = "Partially Boxed"; stageColor = "#059669"; stageBg = "#ecfdf5"; icon = "fa-box-open"; }

            let itemDetailsHtml = '';
            itemDetailsHtml = crate.items.map(i => {
                let boxStageFull = ((i.box + i.wrap) >= i.req);
                return `<div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; border-left: 3px solid ${isManualComplete ? '#059669' : '#0284c7'}; padding-left: 10px; margin-bottom: 5px; font-size: 11.5px;">
                    <div style="font-weight: 700; color: var(--primary-dark); margin-right: 15px;">
                        Pr: ${i.profile} <span style="margin: 0 4px; color: #cbd5e1;">|</span> L: ${i.length}mm <span style="margin: 0 4px; color: #cbd5e1;">|</span> Req Qty: ${i.req}
                    </div>
                    <div style="display:flex; gap:6px; flex-wrap:wrap; font-size: 10.5px; align-items:center;">
                        <span style="background: #059669; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: 700;">Crate: ${i.crate||0}</span>
                        <span style="background: #10b981; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: 700;">Box: ${i.box}</span>
                        <span style="background: #d946ef; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: 700;">Wrp: ${i.wrap}</span>
                        <span style="background: #ea580c; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: 700;">Pch: ${i.punch}</span>
                        <span style="background: #0284c7; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: 700;">Cut: ${i.cut}</span>
                        ${i.pending > 0 ? `<span style="border: 1px solid #e11d48; color: #e11d48; padding: 1px 6px; border-radius: 4px; font-weight: 800;">PENDING CUT: ${i.pending} Pcs</span>` : (boxStageFull ? `<span style="background:#059669; color:#fff; padding:2px 6px; border-radius: 4px; font-weight: 800;"><i class="fa-solid fa-check"></i> READY TO PACK</span>` : `<span style="border: 1px solid #10b981; color: #10b981; padding: 1px 6px; border-radius: 4px; font-weight: 800;"><i class="fa-solid fa-check"></i> OK</span>`)}
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
    if (isAppBusy) return showToast('Another stock operation is in progress. Please try again.', 'warning');
    isAppBusy = true;
    const stateKey = manualCrateKey(crateId, activePackingContainer, activePackingMonth);
    const previous = globalManualCrates[stateKey] ? JSON.parse(JSON.stringify(globalManualCrates[stateKey])) : null;
    const changedCatalog = [];
    const stockColumns = {boxQty:'box_qty',wrapQty:'wrap_qty',crateQty:'crate_qty'};

    const findCatalogItem = (line) => masterData.find(m =>
        String(m.profile||'').trim() === String(line.profile||'').trim() &&
        String(m.itemCode||'').trim() === String(line.itemCode||'').trim() &&
        cleanLen(m.length) === cleanLen(line.length)
    );

    const updateCatalogStock = async (movement, direction) => {
        const cat = masterData.find(m => String(m.db_id) === String(movement.dbId));
        if (!cat || !cat.db_id) throw new Error(`Master Catalog item missing for ${movement.profile} / ${movement.itemCode} / ${movement.length}.`);
        const deltaBox = Number(movement.boxDeducted)||0;
        const deltaWrap = Number(movement.wrapDeducted)||0;
        const deltaCrate = Number(movement.crateAdded)||0;

        // Re-read the latest database quantities before writing so stale browser data
        // cannot overwrite a newer production/shipment stock update.
        const {data:live,error:readError} = await supabaseClient
            .from('master_catalog')
            .select('id,box_qty,wrap_qty,crate_qty')
            .eq('id', cat.db_id)
            .maybeSingle();
        if (readError) throw new Error(`Could not verify live stock for ${movement.itemCode}: ${readError.message}`);
        if (!live) throw new Error(`Master Catalog record not found for ${movement.itemCode}.`);

        const liveBox = Math.max(0, Number(live.box_qty)||0);
        const liveWrap = Math.max(0, Number(live.wrap_qty)||0);
        const liveCrate = Math.max(0, Number(live.crate_qty)||0);
        let next;
        if (direction === 'add-to-crate') {
            if (liveBox + liveWrap < Number(movement.qty)) {
                throw new Error(`${movement.profile} / ${movement.itemCode}: Box + Wrapping stock changed. Available now: ${liveBox + liveWrap} Pcs; required: ${movement.qty} Pcs. Refresh and try again.`);
            }
            const boxTake = Math.min(liveBox, Number(movement.qty));
            const wrapTake = Number(movement.qty) - boxTake;
            next = {box_qty:liveBox-boxTake,wrap_qty:liveWrap-wrapTake,crate_qty:liveCrate+Number(movement.qty)};
            movement.boxDeducted = boxTake;
            movement.wrapDeducted = wrapTake;
            movement.crateAdded = Number(movement.qty);
        } else {
            // A crate may have already been shipped. Do not reverse a completion
            // if its quantity is no longer available in Crate Stage.
            if (liveCrate < deltaCrate) {
                throw new Error(`${movement.profile} / ${movement.itemCode}: cannot unmark this crate safely. Crate Stage has ${liveCrate} Pcs but ${deltaCrate} Pcs must be returned.`);
            }
            next = {box_qty:liveBox+deltaBox,wrap_qty:liveWrap+deltaWrap,crate_qty:liveCrate-deltaCrate};
        }

        const {error:writeError} = await supabaseClient.from('master_catalog').update(next).eq('id',cat.db_id);
        if (writeError) throw new Error(`Stock update failed for ${movement.itemCode}: ${writeError.message}`);
        changedCatalog.push({cat, before:{boxQty:liveBox,wrapQty:liveWrap,crateQty:liveCrate}, after:{boxQty:next.box_qty,wrapQty:next.wrap_qty,crateQty:next.crate_qty}});
        Object.assign(cat,{boxQty:next.box_qty,wrapQty:next.wrap_qty,crateQty:next.crate_qty});
    };

    try {
        if (isChecked) {
            if (previous) return showToast('This crate is already marked complete.', 'warning');
            const crateLines = getPackingContainerRecords(activePackingMonth, activePackingContainer)
                .filter(p => String(p.crateNo||'').trim() === String(crateId||'').trim());
            if (!crateLines.length) return showToast('No Packing List records were found for this crate.', 'warning');

            const grouped = new Map();
            for (const line of crateLines) {
                const qty = Math.max(0, Number(line.pcsQty)||0);
                if (qty <= 0) continue;
                const cat = findCatalogItem(line);
                if (!cat || !cat.db_id) throw new Error(`Master Catalog match not found for ${line.profile} / ${line.itemCode} / ${line.length}.`);
                const key = `${cat.profile}|${cat.itemCode}|${cleanLen(cat.length)}|${cat.db_id}`;
                if (!grouped.has(key)) grouped.set(key,{cat,qty:0});
                grouped.get(key).qty += qty;
            }
            if (!grouped.size) return showToast('This crate has no positive PCS quantity to complete.', 'warning');

            const movements = [];
            for (const {cat,qty} of grouped.values()) {
                const movement = {dbId:cat.db_id,profile:cat.profile,itemCode:cat.itemCode,length:cleanLen(cat.length),qty,boxDeducted:0,wrapDeducted:0,crateAdded:qty};
                await updateCatalogStock(movement,'add-to-crate');
                movements.push(movement);
            }
            globalManualCrates[stateKey] = {
                qty: movements.reduce((sum,m)=>sum+Number(m.qty||0),0),
                month:activePackingMonth,container:activePackingContainer,crateNo:crateId,
                completedAt:new Date().toISOString(),
                stockMovements:movements
            };
            if (!await window.saveManualCratesToDB()) throw new Error('Could not save crate completion state. Stock changes will be rolled back.');
        } else {
            if (!previous) return showToast('This crate is not marked complete.', 'warning');
            const movements = Array.isArray(previous.stockMovements) ? previous.stockMovements : [];
            // Legacy completion flags did not move stock, so only remove the flag.
            // New flags carry exact movement details and can be safely reversed.
            for (const movement of movements) await updateCatalogStock(movement,'return-from-crate');
            delete globalManualCrates[stateKey];
            if (!await window.saveManualCratesToDB()) throw new Error('Could not save crate uncompletion state. Stock changes will be rolled back.');
        }

        showToast(isChecked
            ? `Crate ${crateId} completed. Box stock was used first; any shortage was taken from Wrapping and PCS added to Crate Stage.`
            : `Crate ${crateId} unmarked. Its original Box/Wrapping quantities were restored and Crate Stage was reduced.`, 'success');
        renderPackingListTable(); renderDashboard(); renderProfileSummaryTable(); renderBalanceWorkTable();
    } catch (e) {
        console.error('Crate completion stock movement failed:',e);
        // Restore the crate-completion state if persistence failed.
        if (previous) globalManualCrates[stateKey]=previous; else delete globalManualCrates[stateKey];
        // Best-effort reverse already-applied DB stock updates in reverse order.
        for (const changed of changedCatalog.reverse()) {
            try {
                const {error} = await supabaseClient.from('master_catalog').update({
                    box_qty:changed.before.boxQty,wrap_qty:changed.before.wrapQty,crate_qty:changed.before.crateQty
                }).eq('id',changed.cat.db_id);
                if (error) console.error('Stock rollback failed:',error);
                else Object.assign(changed.cat,changed.before);
            } catch (rollbackError) { console.error('Stock rollback failed:',rollbackError); }
        }
        showToast(e.message||'Could not update crate stock safely. Existing stock has been left unchanged where rollback succeeded.','error');
    } finally {
        isAppBusy = false;
    }
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

window.plReadyExpandedCrates = window.plReadyExpandedCrates || new Set();
window.toggleReadyCrateDetails = function(encodedCrateNo){
    const crateNo=decodeURIComponent(String(encodedCrateNo||''));
    if(window.plReadyExpandedCrates.has(crateNo)) window.plReadyExpandedCrates.delete(crateNo);
    else window.plReadyExpandedCrates.add(crateNo);
    renderPackingListTable();
};
window.toggleAllReadyCrates = function(){
    ensurePackingSelection();
    const rows=getFilteredReadyCrateRows(getPackingContainerRecords(activePackingMonth,activePackingContainer));
    const allExpanded=rows.length>0 && rows.every(r=>window.plReadyExpandedCrates.has(String(r.crateNo)));
    rows.forEach(r=>{const key=String(r.crateNo);if(allExpanded)window.plReadyExpandedCrates.delete(key);else window.plReadyExpandedCrates.add(key);});
    renderPackingListTable();
};

function renderPackingListTableCore() { 
    try {
        const tabCard = document.querySelector('#packingListTab .card:last-child');
        if(!tabCard) return;

        ensurePackingSelection();
        populatePlExcelUploadSelectors();
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

        const readyRows=getReadyCrateRows(filtered);
        const statusFilter=document.getElementById('plReadyStatusFilter')?.value||'';
        const searchFilter=(document.getElementById('plReadySearch')?.value||'').trim().toLowerCase();
        const readyFiltered=readyRows.filter(r=>{
            const statusOk=!statusFilter||r.status===statusFilter;
            const detailText=(r.profiles||[]).map(x=>[x.profile,x.itemCode,x.length,x.plNumber,x.poNumber,x.status].join(' ')).join(' ');
            const text=[r.crateNo,r.profile,r.itemCode,r.length,r.plNumber,r.poNumber,detailText].join(' ').toLowerCase();
            return statusOk && (!searchFilter||text.includes(searchFilter));
        });

        function crateStatusHtml(status){
            const map={
                'Ready to Pack':{c:'#059669',bg:'#ecfdf5',icon:'fa-check',label:'Ready to Pack'},
                'Manual Packed':{c:'#059669',bg:'#d1fae5',icon:'fa-check-double',label:'Manual Packed'},
                                'Pending Wrapping':{c:'#c2410c',bg:'#ffedd5',icon:'fa-arrows-rotate',label:'Pending Wrapping'},
                'Pending Punch':{c:'#7c3aed',bg:'#f3e8ff',icon:'fa-hammer',label:'Pending Punch'},
                'Pending Cut':{c:'#dc2626',bg:'#fee2e2',icon:'fa-scissors',label:'Pending Cut'}
            };
            const m=map[status]||map['Pending Cut'];
            return `<span style="color:${m.c};font-weight:800;background:${m.bg};padding:5px 9px;border-radius:7px;display:inline-flex;align-items:center;gap:5px;"><i class="fa-solid ${m.icon}"></i> ${m.label}</span>`;
        }
        function lineStatusHtml(status){
            return crateStatusHtml(status).replace('padding:5px 9px','padding:3px 7px').replace('font-size:','font-size:');
        }

        let readyCratesHTML='';
        readyFiltered.forEach(row=>{
            const isManualComplete=row.status==='Manual Packed';
            const crateBg=isManualComplete?'#ecfdf5':(row.status==='Ready to Pack'?'#f0fdf4':'#fffbeb');
            const crateBorder=isManualComplete?'#86efac':(row.status==='Ready to Pack'?'#bbf7d0':'#fde68a');
            const manualTickHtml=`<label style="cursor:${currentUserRole==='Admin'?'pointer':'not-allowed'};display:inline-flex;align-items:center;gap:5px;background:${isManualComplete?'#059669':'#fff'};color:${isManualComplete?'#fff':'#475569'};padding:7px 10px;border-radius:8px;font-size:11px;font-weight:800;border:1px solid ${isManualComplete?'#059669':'#cbd5e1'};"><input type="checkbox" onchange="window.toggleManualCrate('${row.crateNo}', this.checked)" ${isManualComplete?'checked':''} ${currentUserRole==='Admin'?'':'disabled'}> Pack</label>`;
            const firstItem=(row.profiles||[])[0];
            const editBtn=(currentUserRole==='Admin' && firstItem)
                ? `<button class="btn" style="background:#0284c7;padding:7px 10px;font-size:11px;border-radius:8px;" onclick="openGenericEdit('packing_list', ${firstItem.id}, {pcs_qty: '${firstItem.pcsQty}', crate_no: '${firstItem.crateNo}'})"><i class="fa-solid fa-pen"></i></button>`
                : '';
            const addProfileBtn=currentUserRole==='Admin'
                ? `<button type="button" class="btn" title="Add another profile/item to this crate" style="background:#16a34a;color:#fff;padding:7px 10px;font-size:12px;border-radius:8px;" onclick="openManualAddProfileToCrate('${encodeURIComponent(row.crateNo)}')"><i class="fa-solid fa-plus"></i></button>`
                : '';
            const isExpanded=window.plReadyExpandedCrates.has(String(row.crateNo));
            const toggleDetailsBtn=`<button type="button" class="pl-crate-toggle" aria-expanded="${isExpanded?'true':'false'}" title="${isExpanded?'Hide':'View'} profile details" onclick="toggleReadyCrateDetails('${encodeURIComponent(String(row.crateNo))}')"><i class="fa-solid ${isExpanded?'fa-chevron-up':'fa-chevron-down'}"></i> ${isExpanded?'Hide items':'View items'}</button>`;
            const actionBtn=`<div style="display:flex;gap:6px;align-items:center;justify-content:flex-end;flex-wrap:wrap;">${toggleDetailsBtn}${addProfileBtn}${manualTickHtml}${editBtn}</div>`;

            const profileCards=(row.profiles||[]).map(i=>{
                const lineBg=i.status==='Ready to Pack'||i.status==='Manual Packed'?'#ffffff':'#fffaf0';
                const pcsQtyControl=currentUserRole==='Admin'
                    ? `<button type="button" class="pl-profile-qty-edit" title="Admin: click to edit this profile's PCS quantity" aria-label="Edit ${i.profile} ${i.itemCode} PCS quantity" onclick="openGenericEdit('packing_list', ${i.id}, {pcs_qty: '${i.pcsQty}'})">${Number(i.pcsQty||0).toLocaleString()} Pcs <i class="fa-solid fa-pen"></i></button>`
                    : `<span class="pl-profile-qty-readonly">${Number(i.pcsQty||0).toLocaleString()} Pcs</span>`;
                return `<div class="pl-profile-line" style="background:${lineBg};">
                    <div class="pl-profile-field"><div class="pl-profile-label">Profile</div><b class="pl-profile-value">${i.profile}</b></div>
                    <div class="pl-profile-field"><div class="pl-profile-label">Item Code</div><span class="pl-profile-item">${i.itemCode||'-'}</span></div>
                    <div class="pl-profile-field"><div class="pl-profile-label">Cut Length</div><b class="pl-profile-value">${i.length} mm</b></div>
                    <div class="pl-profile-field pl-profile-qty-field"><div class="pl-profile-label">PCS Qty ${currentUserRole==='Admin'?'· Click to edit':''}</div>${pcsQtyControl}</div>
                    <div class="pl-profile-field pl-profile-stage-field"><div class="pl-profile-label">Current Stage / Pending</div><div class="pl-profile-stage-list">
                        <span class="stock-badge" style="background:#d1fae5;color:#047857;">Crate ${i.crate||0}</span>
                        <span class="stock-badge" style="background:#ecfdf5;color:#059669;">Box ${i.box||0}</span>
                        <span class="stock-badge" style="background:#fae8ff;color:#a21caf;">Wrap ${i.wrap||0}</span>
                        <span class="stock-badge" style="background:#ffedd5;color:#c2410c;">Punch ${i.punch||0}</span>
                        <span class="stock-badge" style="background:#e0f2fe;color:#0369a1;">Cut ${i.cut||0}</span>
                        ${i.pending>0?`<span class="stock-badge" style="background:#fee2e2;color:#b91c1c;">Pending Cut ${i.pending}</span>`:''}
                        ${lineStatusHtml(i.status)}
                    </div></div>
                </div>`;
            }).join('');

            readyCratesHTML+=`<tr class="crate-card-row">
                <td colspan="7" style="padding:0 0 16px 0;border:0;background:transparent;">
                    <div style="border:2px solid ${crateBorder};border-radius:16px;overflow:hidden;background:${crateBg};box-shadow:0 4px 14px rgba(15,23,42,.10);margin:0 2px 0 2px;position:relative;">
                        <div style="height:5px;background:${crateBorder};width:100%;"></div>
                        <div class="pl-crate-summary-grid" style="display:grid;grid-template-columns:110px 68px minmax(150px,1.4fr) 100px 110px 95px minmax(130px,1fr) minmax(190px,auto);gap:8px;align-items:center;padding:10px 12px;border-bottom:${isExpanded?'1px solid '+crateBorder:'0'};background:linear-gradient(90deg,rgba(255,255,255,.82),rgba(255,255,255,.38));">
                            <div><div style="font-size:10px;color:#64748b;font-weight:800;text-transform:uppercase;">Crate</div><b style="font-size:17px;color:#164e63;display:inline-flex;align-items:center;gap:6px;"><i class="fa-solid fa-box-open"></i>${row.crateNo}</b></div>
                            <div><div style="font-size:10px;color:#64748b;font-weight:800;text-transform:uppercase;">Profiles</div><b>${row.profileCount}</b></div>
                            <div><div style="font-size:10px;color:#64748b;font-weight:800;text-transform:uppercase;">Profiles / Items</div><span style="font-size:12px;color:#475569;">${row.profiles.map(x=>x.itemCode).join(' • ')}</span></div>
                            <div><div style="font-size:10px;color:#64748b;font-weight:800;text-transform:uppercase;">PL Req Total</div><span class="stock-badge bg-total">${row.pcsQty}</span></div>
                            <div><div style="font-size:10px;color:#64748b;font-weight:800;text-transform:uppercase;">Box + Wrap Available</div><span class="stock-badge" style="background:#ecfdf5;color:#10b981;">${row.availableBox}</span></div>
                            <div><div style="font-size:10px;color:#64748b;font-weight:800;text-transform:uppercase;">Req Extrusions</div><span class="stock-badge" style="background:#fff7ed;color:#c2410c;">${row.requiredExtrusions || '-'}</span></div>
                            <div><div style="font-size:10px;color:#64748b;font-weight:800;text-transform:uppercase;">Crate Status</div>${crateStatusHtml(row.status)}</div>
                            <div>${actionBtn}</div>
                        </div>
                        ${isExpanded?`<div class="pl-crate-details" style="padding:0;background:#fff;">
                            <div class="pl-profile-line pl-profile-line-header">
                                <div>Profile</div><div>Item Code</div><div>Cut Length</div><div>PCS Qty</div><div>Current Stage / Pending</div>
                            </div>
                            ${profileCards}
                        </div>`:''}
                    </div>
                </td>
            </tr>`;
        });
        const readySummary=document.getElementById('plReadyFilterSummary');
        if(readySummary) readySummary.textContent=`${readyFiltered.length} crates shown • ${readyRows.length} total in ${activePackingContainer} • ${statusFilter||'All statuses'}`;
        const expandAllBtn=document.getElementById('plReadyExpandAllBtn');
        if(expandAllBtn){const allExpanded=readyFiltered.length>0&&readyFiltered.every(r=>window.plReadyExpandedCrates.has(String(r.crateNo)));expandAllBtn.innerHTML=`<i class="fa-solid ${allExpanded?'fa-compress':'fa-expand'}"></i> ${allExpanded?'Collapse All':'Expand All'}`;}
        // Populate exact-value dropdowns from the currently selected Packing List container.
        // Preserve selections across redraws, but clear stale values that no longer exist.
        const fillRawFilter=(id, values, label)=>{
            const select=document.getElementById(id); if(!select) return;
            const previous=select.value;
            const unique=[...new Set(values.map(v=>String(v??'').trim()).filter(Boolean))]
                .sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'}));
            select.innerHTML='';
            const all=document.createElement('option'); all.value=''; all.textContent=label; select.appendChild(all);
            unique.forEach(value=>{const option=document.createElement('option');option.value=value;option.textContent=value;select.appendChild(option);});
            if(unique.includes(previous)) select.value=previous;
        };
        // Cascading filters: PO -> Profile -> Item Code -> Length.
        // Each child dropdown only offers values present under the selected parent(s).
        fillRawFilter('plRawFilterPo',filtered.map(pl=>pl.poNumber),'All PO Numbers');
        const rawPoSelected=(document.getElementById('plRawFilterPo')?.value||'').trim().toLowerCase();
        const rawPoRows=filtered.filter(pl=>!rawPoSelected||String(pl.poNumber||'').trim().toLowerCase()===rawPoSelected);
        fillRawFilter('plRawFilterProfile',rawPoRows.map(pl=>pl.profile),'All Profiles');
        const rawProfileSelected=(document.getElementById('plRawFilterProfile')?.value||'').trim().toLowerCase();
        const rawProfileRows=rawPoRows.filter(pl=>!rawProfileSelected||String(pl.profile||'').trim().toLowerCase()===rawProfileSelected);
        fillRawFilter('plRawFilterItem',rawProfileRows.map(pl=>pl.itemCode),'All Item Codes');
        const rawItemSelected=(document.getElementById('plRawFilterItem')?.value||'').trim().toLowerCase();
        const rawItemRows=rawProfileRows.filter(pl=>!rawItemSelected||String(pl.itemCode||'').trim().toLowerCase()===rawItemSelected);
        fillRawFilter('plRawFilterLength',rawItemRows.map(pl=>cleanLen(pl.length)),'All Lengths');
        const rawPoFilter=rawPoSelected;
        const rawProfileFilter=rawProfileSelected;
        const rawItemFilter=rawItemSelected;
        const rawLengthFilter=cleanLen(document.getElementById('plRawFilterLength')?.value||'');
        const rawFiltered=filtered.filter(pl=>{
            const po=String(pl.poNumber||'').trim().toLowerCase();
            const profile=String(pl.profile||'').trim().toLowerCase();
            const item=String(pl.itemCode||'').trim().toLowerCase();
            const length=cleanLen(pl.length);
            return (!rawPoFilter||po===rawPoFilter)&&(!rawProfileFilter||profile===rawProfileFilter)&&(!rawItemFilter||item===rawItemFilter)&&(!rawLengthFilter||length===rawLengthFilter);
        });
        const rawCount=document.getElementById('plRawLogsCount');
        if(rawCount)rawCount.textContent=`${rawFiltered.length.toLocaleString()} of ${filtered.length.toLocaleString()} records`;
        let rawHTML = '';
        rawFiltered.forEach(pl => {
            rawHTML += `<tr><td>${pl.date}</td><td><b>${pl.plNumber}</b></td><td>${pl.poNumber}</td><td>${pl.month}</td><td>${pl.container}</td><td><span class="stock-badge bg-crate">${pl.crateNo}</span></td><td>${pl.profile}</td><td><span style="color:var(--info-color); font-weight:600;">${pl.itemCode||'-'}</span></td><td>${pl.length} mm</td><td><span class="stock-badge bg-total">${pl.pcsQty} Pcs</span></td><td>${pl.netWeight} kg / ${pl.grossWeight} kg</td>
            <td>${currentUserRole === 'Admin' ? `
                <button class="btn btn-accent" style="padding:4px 8px; font-size:11px;" onclick="openGenericEdit('packing_list', ${pl.id}, {pcs_qty: '${pl.pcsQty}', crate_no: '${pl.crateNo}'})"><i class="fa-solid fa-pen"></i></button>
                <button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deletePackingListItem(${pl.id})"><i class="fa-solid fa-trash"></i></button>
            ` : `<i class="fa-solid fa-lock" style="color:#aaa;"></i>`}</td></tr>`;
        });

        const plSummaryMode = getPlBalanceFilterValue('plSummaryBalanceFilter');
        updateBalanceFilterInfo();
        let consHTML = Object.values(consolidatedMap).map(v => {
            const matched = masterData.find(m => String(m.profile).trim() === String(v.profile).trim() && String(m.itemCode).trim() === String(v.itemCode).trim() && cleanLen(m.length) === cleanLen(v.length));
            const cutPcs = matched ? (Number(matched.cutQty)||0) : 0;
            const punchPcs = matched ? (Number(matched.punchQty)||0) : 0;
            const wrapPcs = matched ? (Number(matched.wrapQty)||0) : 0;
            const boxPcs = matched ? (Number(matched.boxQty)||0) : 0;
            const cratePcs = matched ? (Number(matched.crateQty)||0) : 0;
            // Read-only summary: do not mutate stock/master data.
            const currentStock = cutPcs + punchPcs + wrapPcs + boxPcs + cratePcs;
            const wipPcs = cutPcs + punchPcs;
            const completePcs = wrapPcs + boxPcs + cratePcs;
            // Signed balance retained: negative means shortage, positive means excess stock.
            const bal = currentStock - (Number(v.qty)||0);
            // Required extrusions are calculated only for the shortage shown by PL Balance.
            const pcsPerEx = Number(getExtrusionPlan(v.profile,v.itemCode,v.length,v.qty).pcsPerEx) || 0;
            const requiredExForBalance = pcsPerEx > 0 ? Math.ceil(Math.max(0, -bal) / pcsPerEx) : 0;
            if(!matchesBalanceFilter(bal, plSummaryMode)) return '';
            const balStatus = bal >= 0 ? `<span class="pl-balance-badge pl-balance-positive"><i class="fa-solid fa-check"></i> +${bal}</span>` : `<span class="pl-balance-badge pl-balance-negative"><i class="fa-solid fa-arrow-down"></i> ${Math.abs(bal)}</span>`;
            // Keep the existing cardboard calculation unchanged for backward compatibility.
            const legacyWipPcs = cutPcs + punchPcs + wrapPcs;
            const plPendingQty = Math.max(0, (Number(v.qty)||0) - currentStock);
            const unboxedAndPendingPcs = plPendingQty + legacyWipPcs;
            let cap = matched ? (matched.boxCapacity || 100) : 100;
            let reqBoxes = Math.ceil(unboxedAndPendingPcs / cap);
            let availCardboard = getAvailableCardboard(v.profile, v.itemCode, v.length);
            let cbBalance = availCardboard - reqBoxes;
            let cbStatusHtml = cbBalance >= 0 ? `<span style="color:var(--success-color);font-weight:800;">OK (+${cbBalance})</span>` : `<span style="color:var(--warning-color);font-weight:800;">Short ${Math.abs(cbBalance)}</span>`;
            const plan=getExtrusionPlan(v.profile,v.itemCode,v.length,v.qty);
            return `<tr><td><b>${v.profile}</b></td><td><span style="color:var(--info-color);font-weight:600;">${v.itemCode}</span></td><td>${v.length} mm</td><td>${plan.exLength ? plan.exLength+' mm' : '-'}</td><td><span class="stock-badge" style="background:#eff6ff;color:#0369a1;">${plan.pcsPerEx || '-'} Pcs</span></td><td><span class="stock-badge bg-total">${v.qty} Pcs</span></td><td><span class="stock-badge" style="background:#fff7ed;color:#c2410c;">${pcsPerEx > 0 ? requiredExForBalance : '-'} Ex</span></td><td><span class="stock-badge bg-wrap">${currentStock} Pcs</span></td><td><span class="stock-badge" style="background:#ede9fe;color:#6d28d9;">${wipPcs} Pcs</span></td><td><span class="stock-badge" style="background:#dcfce7;color:#166534;">${completePcs} Pcs</span></td><td><b>${balStatus}</b></td><td style="background:${cbBalance < 0 ? 'rgba(225, 29, 72, 0.05)' : 'rgba(16, 185, 129, 0.05)'};">${cbStatusHtml}</td></tr>`;
        }).filter(Boolean).join('');

        const sumTbody = document.getElementById('plSummaryTableBody'); if (sumTbody) sumTbody.innerHTML = consHTML || '<tr><td colspan="12" style="text-align:center;padding:24px;color:#64748b;font-weight:700;">No active PL lines match this balance filter.</td></tr>';
        const readyTbody = document.getElementById('plReadyToPackTableBody'); if (readyTbody) readyTbody.innerHTML = readyCratesHTML || '<tr><td colspan="7" style="text-align:center; color:var(--text-muted);padding:30px;">No crates match this status</td></tr>';
        const rawTbody = document.getElementById('packingListTableBody'); if (rawTbody) rawTbody.innerHTML = rawHTML || '<tr><td colspan="12" class="pl-raw-empty">No Packing List records match these filters.</td></tr>';
    } catch(e) { console.error('Packing list render error:', e); const body=document.getElementById('packingListTableBody'); if(body) body.innerHTML='<tr><td colspan=12 style="text-align:center;color:#e11d48;font-weight:700;">Packing List could not be rendered. Check browser console for details.</td></tr>'; }
}

function switchPackingListView(view, button){
  const main=document.getElementById('plMainContent');
  const balance=document.getElementById('plBalanceView');
  const mainBtn=document.getElementById('plViewMainBtn');
  const balanceBtn=document.getElementById('plViewBalanceBtn');
  if(!main||!balance)return;
  const showBalance=view==='balance';
  main.style.display=showBalance?'none':'block';
  balance.style.display=showBalance?'block':'none';
  if(mainBtn)mainBtn.classList.toggle('active',!showBalance);
  if(balanceBtn)balanceBtn.classList.toggle('active',showBalance);
  if(showBalance)renderCurrentPlShipmentBalanceTable();
}
window.switchPackingListView=switchPackingListView;

function normalizeCurrentPlPoNumber(value){
  // Production Orders may store "PO 363760" while Packing List stores "363760".
  // Normalize only for matching; preserve the original displayed PO number.
  return String(value||'').trim().replace(/^PO[\s\-:#]*/i,'').replace(/\s+/g,'').toUpperCase();
}
function currentPlBalanceKey(po,profile,itemCode,length){
  return [normalizeCurrentPlPoNumber(po),String(profile||'').trim().toUpperCase(),String(itemCode||'').trim().toUpperCase(),cleanLen(length)].join('||');
}
function currentPlBalanceEscape(value){
  return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function getCurrentPlBalanceUnitWeight(profile,itemCode,length){
  const p=String(profile||'').trim().toUpperCase();
  const ic=String(itemCode||'').trim().toUpperCase();
  const l=cleanLen(length);
  let m=masterData.find(x=>String(x.profile||'').trim().toUpperCase()===p && String(x.itemCode||'').trim().toUpperCase()===ic && cleanLen(x.length)===l);
  if(!m)m=masterData.find(x=>String(x.profile||'').trim().toUpperCase()===p && cleanLen(x.length)===l && (!ic || !String(x.itemCode||'').trim() || String(x.itemCode||'').trim().toUpperCase()===ic));
  return Math.max(0,Number(m?.unitWeight)||0);
}
function getCurrentPlBalanceData(){
  ensurePackingSelection();
  const active=getActivePackingListSelection();
  const currentRows=getPackingContainerRecords(active.month,active.container);
  const plMap=new Map();
  // Count only the active/current Packing List; historical or completed PLs are not included.
  currentRows.forEach(pl=>{
    const po=String(pl.poNumber||'').trim();
    const profile=String(pl.profile||'').trim();
    const length=cleanLen(pl.length);
    const itemCode=String(pl.itemCode||'').trim() || (typeof resolveMasterItemCode==='function'?resolveMasterItemCode(profile,length,''):'');
    const key=currentPlBalanceKey(po,profile,itemCode,length);
    const row=plMap.get(key)||{poNumber:po,profile,itemCode,length,plQty:0,plRows:0};
    row.plQty+=Math.max(0,Number(pl.pcsQty)||0);
    row.plRows++;
    plMap.set(key,row);
  });

  // Build the complete Production Order set first, rather than limiting the report to PL lines.
  const poMap=new Map();
  poList.forEach(po=>{
    const poNumber=String(po.poNumber||'').trim();
    const profile=String(po.profile||'').trim();
    const length=cleanLen(po.length);
    const itemCode=String(po.itemCode||'').trim() || (typeof resolveMasterItemCode==='function'?resolveMasterItemCode(profile,length,''):'');
    if(!poNumber||!profile||!length||!itemCode)return;
    const key=currentPlBalanceKey(poNumber,profile,itemCode,length);
    const row=poMap.get(key)||{poNumber,profile,itemCode,length,requiredQty:0,shippedQty:0,shipmentBalance:0,poRows:0,plQty:0,plRows:0};
    row.requiredQty+=Math.max(0,Number(po.orderQty)||0);
    row.poRows++;
    poMap.set(key,row);
  });

  // Aggregate all recorded shipments by PO + profile + Master Catalog item + length.
  shipmentList.forEach(sh=>{
    const poNumber=String(sh.poNumber||'').trim();
    const profile=String(sh.profile||'').trim();
    const length=cleanLen(sh.length);
    const explicitItem=String(sh.itemCode||'').trim();
    const itemCode=explicitItem || (typeof resolveMasterItemCode==='function'?resolveMasterItemCode(profile,length,''):'');
    if(!poNumber||!profile||!length||!itemCode)return;
    const key=currentPlBalanceKey(poNumber,profile,itemCode,length);
    const row=poMap.get(key);
    if(row)row.shippedQty+=Math.max(0,Number(sh.shippedQty)||0);
  });

  // Attach current PL quantity to every PO line. PO-number normalization handles "PO 123" vs "123".
  poMap.forEach((row,key)=>{
    const pl=plMap.get(key);
    row.plQty=pl?pl.plQty:0;
    row.plRows=pl?pl.plRows:0;
    row.shipmentBalance=Math.max(0,row.requiredQty-row.shippedQty);
    row.unitWeight=getCurrentPlBalanceUnitWeight(row.profile,row.itemCode,row.length);
    row.unmatchedPo=false;
    row.isCurrentPl=!!pl;
  });

  // Keep unmatched current PL lines visible too, so they are not silently omitted from the report.
  plMap.forEach((pl,key)=>{
    if(!poMap.has(key)){
      poMap.set(key,{...pl,requiredQty:0,shippedQty:0,shipmentBalance:0,poRows:0,unitWeight:getCurrentPlBalanceUnitWeight(pl.profile,pl.itemCode,pl.length),unmatchedPo:true,isCurrentPl:true});
    }
  });

  const rows=[...poMap.values()]
    // Show every open/pending PO line and every line used by the current PL.
    .filter(r=>Number(r.shipmentBalance)>0 || Number(r.plQty)>0 || r.unmatchedPo)
    .map(r=>({...r,requiredWeight:r.requiredQty*r.unitWeight,shippedWeight:r.shippedQty*r.unitWeight,shipmentBalanceWeight:r.shipmentBalance*r.unitWeight,plWeight:r.plQty*r.unitWeight,balanceAfterPl:r.shipmentBalance-r.plQty,balanceAfterPlWeight:(r.shipmentBalance-r.plQty)*r.unitWeight}))
    .sort((a,b)=>
      a.poNumber.localeCompare(b.poNumber,undefined,{numeric:true,sensitivity:'base'}) ||
      a.profile.localeCompare(b.profile,undefined,{numeric:true,sensitivity:'base'}) ||
      a.itemCode.localeCompare(b.itemCode,undefined,{numeric:true,sensitivity:'base'}) ||
      (parseFloat(a.length)||0)-(parseFloat(b.length)||0)
    );
  return {active,rows};
}
function populateCurrentPlBalanceFilters(rows){
  const poSelect=document.getElementById('plBalancePoFilter');
  const profileSelect=document.getElementById('plBalanceProfileFilter');
  const itemSelect=document.getElementById('plBalanceItemFilter');
  const previousPo=poSelect?.value||'';
  const previousProfile=profileSelect?.value||'';
  const previousItem=itemSelect?.value||'';
  const sortValues=values=>[...new Set(values.map(v=>String(v||'').trim()).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'}));
  const fill=(select,placeholder,values,selected)=>{
    if(!select)return '';
    select.innerHTML=`<option value="">${placeholder}</option>`+values.map(v=>`<option value="${currentPlBalanceEscape(v)}">${currentPlBalanceEscape(v)}</option>`).join('');
    if(values.includes(selected))select.value=selected;
    return select.value||'';
  };

  // Cascading filters: PO -> Profile -> Item Code.
  // When a profile is selected, the item-code dropdown contains only item codes
  // available for that profile (and selected PO, if one is selected).
  const allPOs=sortValues(rows.map(r=>r.poNumber));
  const selectedPO=fill(poSelect,'All POs',allPOs,previousPo);
  const poRows=selectedPO?rows.filter(r=>String(r.poNumber||'').trim()===selectedPO):rows;

  const profiles=sortValues(poRows.map(r=>r.profile));
  const selectedProfile=fill(profileSelect,'All Profiles',profiles,previousProfile);
  const profileRows=selectedProfile?poRows.filter(r=>String(r.profile||'').trim()===selectedProfile):poRows;

  const itemCodes=sortValues(profileRows.map(r=>r.itemCode));
  fill(itemSelect,'All Item Codes',itemCodes,previousItem);
}
function renderCurrentPlShipmentBalanceTable(){
  const body=document.getElementById('plCurrentBalanceTableBody'); if(!body)return;
  try{
    const {active,rows}=getCurrentPlBalanceData();
    populateCurrentPlBalanceFilters(rows);
    const poFilter=document.getElementById('plBalancePoFilter')?.value||'';
    const profileFilter=document.getElementById('plBalanceProfileFilter')?.value||'';
    const itemFilter=document.getElementById('plBalanceItemFilter')?.value||'';
    const search=(document.getElementById('plBalanceSearch')?.value||'').trim().toLowerCase();
    const filtered=rows.filter(r=>(!poFilter||r.poNumber===poFilter)&&(!profileFilter||r.profile===profileFilter)&&(!itemFilter||r.itemCode===itemFilter)&&(!search||[r.poNumber,r.profile,r.itemCode,r.length].join(' ').toLowerCase().includes(search)));
    currentPlBalanceVisibleRows=filtered;
    const subtitle=document.getElementById('plCurrentBalanceSubtitle');
    if(subtitle)subtitle.textContent=`All open Production Order lines and lines in active Packing List: ${active.month} • ${active.container}. Shipment balance = Production Order required qty minus recorded shipments; unit weights come from Master Catalog.`;
    const status=document.getElementById('plCurrentBalanceStatus');
    const unmatched=filtered.filter(r=>r.unmatchedPo).length;
    const pending=filtered.filter(r=>Number(r.shipmentBalance)>0).length;
    if(status)status.textContent=`${filtered.length} open PO / Profile / Item / Length lines shown • ${pending} with pending shipment balance • ${active.month} ${active.container} • ${unmatched} current PL line(s) have no matching Production Order.`;
    const totals=filtered.reduce((a,r)=>{
      a.required+=Number(r.requiredQty)||0;a.requiredWt+=Number(r.requiredWeight)||0;
      a.shipped+=Number(r.shippedQty)||0;a.shippedWt+=Number(r.shippedWeight)||0;
      a.pl+=Number(r.plQty)||0;a.plWt+=Number(r.plWeight)||0;
      a.ship+=Number(r.shipmentBalance)||0;a.shipWt+=Number(r.shipmentBalanceWeight)||0;
      a.after+=Number(r.balanceAfterPl)||0;a.afterWt+=Number(r.balanceAfterPlWeight)||0;
      return a;
    },{required:0,requiredWt:0,shipped:0,shippedWt:0,pl:0,plWt:0,ship:0,shipWt:0,after:0,afterWt:0});
    const setText=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val;};
    setText('plBalKpiCurrent',`${totals.pl.toLocaleString()} Pcs`);
    setText('plBalKpiShipment',`${totals.ship.toLocaleString()} Pcs · ${totals.shipWt.toFixed(2)} kg`);
    setText('plBalKpiAfter',`${totals.after.toLocaleString()} Pcs`);
    setText('plBalKpiLines',`${filtered.length.toLocaleString()} lines`);
    body.innerHTML=filtered.length?filtered.map((r,i)=>{
      const after=Number(r.balanceAfterPl)||0;
      const afterWt=Number(r.balanceAfterPlWeight)||0;
      const over=after<0;
      const statusLabel=r.unmatchedPo?'No matching PO':over?`Over by ${Math.abs(after).toLocaleString()} Pcs`:r.shipmentBalance===0&&r.plQty===0?'No pending balance':r.plQty===0?'Pending — not in current PL':'Within balance';
      const pillClass=r.unmatchedPo?'pending':over?'over':r.shipmentBalance===0&&r.plQty===0?'pending':r.plQty===0?'pending':'ok';
      const num=n=>Number(n||0).toLocaleString();
      const kg=n=>`${Number(n||0).toFixed(2)} kg`;
      return `<tr class="${over?'pl-bal-over':r.plQty>0?'pl-bal-ok':''}">
        <td class="pl-bal-po"><b>${currentPlBalanceEscape(r.poNumber||'-')}</b></td>
        <td>${currentPlBalanceEscape(r.profile||'-')}</td>
        <td class="pl-bal-item"><b>${currentPlBalanceEscape(r.itemCode||'-')}</b></td>
        <td>${currentPlBalanceEscape(r.length||'-')}</td>
        <td class="pl-bal-number">${num(r.requiredQty)}</td>
        <td class="pl-bal-number">${num(r.shippedQty)}</td>
        <td class="pl-bal-number"><button type="button" class="pl-shipment-balance-link" onclick="showCurrentPlShipmentDetails(${i})" title="Click to see shipment quantities by month and container" aria-label="Show shipment details for PO ${currentPlBalanceEscape(r.poNumber)}">${num(r.shipmentBalance)}</button></td>
        <td class="pl-bal-weight"><b>${kg(r.shipmentBalanceWeight)}</b></td>
        <td class="pl-bal-number"><b>${num(r.plQty)}</b></td>
        <td class="pl-bal-number"><b style="color:${over?'#be123c':'#047857'}">${num(after)}</b></td>
        <td><span class="pl-balance-pill ${pillClass}">${statusLabel}</span></td>
      </tr>`;
    }).join(''):'<tr><td colspan="16" class="pl-balance-empty">No open Production Order or current Packing List lines match these filters.</td></tr>';
    const foot=document.getElementById('plCurrentBalanceTableFoot');
    if(foot)foot.innerHTML=filtered.length?`<tr><td colspan="4">TOTAL — FILTERED OPEN PO LINES</td><td>${totals.required.toLocaleString()}</td><td>${totals.shipped.toLocaleString()}</td><td>${totals.ship.toLocaleString()}</td><td>${totals.shipWt.toFixed(2)} kg</td><td>${totals.pl.toLocaleString()}</td><td>${totals.after.toLocaleString()}</td><td>${filtered.length} lines</td></tr>`:'';
  }catch(e){
    console.error('Current PL shipment balance render failed:',e);
    body.innerHTML='<tr><td colspan="11" class="pl-balance-empty">Could not calculate balances safely. Check Production Orders, Shipments, Master Catalog and browser console.</td></tr>';
  }
}

let currentPlBalanceVisibleRows=[];
let currentPlShipmentDetailContext=null;
function showCurrentPlShipmentDetails(index){
  const panel=document.getElementById('plShipmentDetailPanel');
  const body=document.getElementById('plShipmentDetailTableBody');
  if(!panel||!body)return;
  const row=currentPlBalanceVisibleRows[Number(index)];
  if(!row)return;
  currentPlShipmentDetailContext=row;
  const matches=shipmentList.filter(sh=>{
    const po=String(sh.poNumber||'').trim();
    const profile=String(sh.profile||'').trim();
    const length=cleanLen(sh.length);
    const explicitItem=String(sh.itemCode||'').trim();
    const itemCode=explicitItem||(typeof resolveMasterItemCode==='function'?resolveMasterItemCode(profile,length,''):'');
    return normalizeCurrentPlPoNumber(po)===normalizeCurrentPlPoNumber(row.poNumber) &&
      profile===String(row.profile||'').trim() &&
      length===cleanLen(row.length) &&
      itemCode===String(row.itemCode||'').trim();
  });
  const grouped=new Map();
  matches.forEach(sh=>{
    const month=String(sh.month||'').trim() || (sh.date?new Date(sh.date+'T00:00:00').toLocaleString('en-US',{month:'long',year:'numeric'}):'Unknown month');
    const container=String(sh.container||'').trim()||'Container not recorded';
    const key=month+'||'+container;
    const g=grouped.get(key)||{month,container,qty:0,dates:new Set(),records:0};
    g.qty+=Math.max(0,Number(sh.shippedQty)||0);
    if(sh.date)g.dates.add(String(sh.date));
    g.records++;
    grouped.set(key,g);
  });
  const groups=[...grouped.values()].sort((a,b)=>{
    const monthCmp=(new Date(a.month+' 1').getTime()||0)-(new Date(b.month+' 1').getTime()||0);
    if(monthCmp!==0)return monthCmp;
    const ca=(String(a.container).match(/\d+/)||['99'])[0];
    const cb=(String(b.container).match(/\d+/)||['99'])[0];
    return Number(ca)-Number(cb);
  });
  const title=document.getElementById('plShipmentDetailTitle');
  const subtitle=document.getElementById('plShipmentDetailSubtitle');
  if(title)title.textContent=`Shipment Breakdown — PO ${row.poNumber}`;
  if(subtitle)subtitle.textContent=`Profile ${row.profile} • Item ${row.itemCode} • Length ${row.length} mm • Total already shipped: ${Number(row.shippedQty||0).toLocaleString()} Pcs`;
  body.innerHTML=groups.length?groups.map(g=>`<tr>
    <td>${currentPlBalanceEscape(g.month)}</td>
    <td><b>${currentPlBalanceEscape(g.container)}</b></td>
    <td>${currentPlBalanceEscape([...g.dates].sort().join(', ')||'—')}</td>
    <td><b>${g.qty.toLocaleString()}</b></td>
    <td>${g.records}</td>
  </tr>`).join(''):'<tr><td colspan="5" class="pl-balance-empty">No saved shipment records match this PO / profile / item code / length.</td></tr>';
  const total=groups.reduce((sum,g)=>sum+g.qty,0);
  const foot=document.getElementById('plShipmentDetailTableFoot');
  if(foot)foot.innerHTML=`<tr><td colspan="3">TOTAL ALREADY SHIPPED</td><td>${total.toLocaleString()} Pcs</td><td>${matches.length} records</td></tr>`;
  panel.style.display='block';
  panel.scrollIntoView({behavior:'smooth',block:'nearest'});
}
window.showCurrentPlShipmentDetails=showCurrentPlShipmentDetails;
window.closeCurrentPlShipmentDetails=function(){const p=document.getElementById('plShipmentDetailPanel');if(p)p.style.display='none';};
window.printCurrentPlShipmentDetail=function(){
  const panel=document.getElementById('plShipmentDetailPanel');
  if(!panel||panel.style.display==='none')return;
  const row=currentPlShipmentDetailContext;
  const title=row?`PO ${row.poNumber} — ${row.profile} — ${row.itemCode} — ${row.length} mm`:'Shipment Details';
  const win=window.open('','_blank');
  if(!win){if(typeof showToast==='function')showToast('Allow pop-ups to print shipment details.','warning');return;}
  win.document.write(`<html><head><title>Shipment Breakdown</title><style>body{font-family:Arial,sans-serif;padding:20px;color:#123}h2{margin-bottom:5px}p{font-size:12px;color:#475569}table{width:100%;border-collapse:collapse;font-size:11px;margin-top:14px}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left}th{background:#164e63;color:#fff}tfoot td{font-weight:bold;background:#e0f2fe}@media print{body{padding:0}}</style></head><body><h2>AIS Tracker — Shipment Breakdown</h2><p>${currentPlBalanceEscape(title)}</p><p>${currentPlBalanceEscape(document.getElementById('plShipmentDetailSubtitle')?.textContent||'')}</p>${document.getElementById('plShipmentDetailTable').outerHTML}<script>window.onload=()=>window.print()<\/script></body></html>`);
  win.document.close();
};

window.renderCurrentPlShipmentBalanceTable=renderCurrentPlShipmentBalanceTable;
window.exportCurrentPlShipmentBalanceExcel=function(){
  const table=document.getElementById('plCurrentBalanceTable');
  if(!table)return;
  if(typeof XLSX==='undefined')return showToast('Excel export library is not available.','error');
  try{
    const wb=XLSX.utils.table_to_book(table,{sheet:'Current PL Balance'});
    XLSX.writeFile(wb,`AIS_Current_PL_Shipment_Balance_${new Date().toISOString().slice(0,10)}.xlsx`);
  }catch(e){console.error(e);showToast('Could not export current PL balance to Excel.','error');}
};
window.printCurrentPlShipmentBalance=function(){
  const table=document.getElementById('plCurrentBalanceTable');
  if(!table)return;
  const active=getActivePackingListSelection();
  const win=window.open('','_blank');
  if(!win)return showToast('Allow pop-ups to print this table.','warning');
  win.document.write(`<html><head><title>Current PL vs Shipment Balance</title><style>body{font-family:Arial,sans-serif;padding:20px;color:#123}h2{margin-bottom:5px}p{font-size:12px;color:#475569}table{width:100%;border-collapse:collapse;font-size:10px;margin-top:14px}th,td{border:1px solid #cbd5e1;padding:6px;text-align:left}th{background:#0f4c64;color:#fff}tfoot td{font-weight:bold;background:#e0f2fe}@media print{body{padding:0}}</style></head><body><h2>AIS Tracker — Current PL vs Shipment Balance</h2><p>${active.month} • ${active.container}</p>${table.outerHTML}<script>window.onload=()=>window.print()<\/script></body></html>`);
  win.document.close();
};


function renderPackingListTable(){
  renderPackingListTableCore();
  renderCurrentPlShipmentBalanceTable();
}

window.clearRawPackingListFilters = function(){
  ['plRawFilterPo','plRawFilterProfile','plRawFilterItem','plRawFilterLength'].forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.value='';
  });
  renderPackingListTable();
};

// Convert an in-memory Packing List row back to the existing Supabase schema.
// Deliberately omit the old primary key when restoring; Supabase assigns a fresh ID.
function packingListSnapshotToDbRow(item) {
    return {
        pl_number: item.plNumber || null,
        po_number: item.poNumber || null,
        shipment_month: item.month || 'January',
        container: item.container || '1st Container',
        crate_no: item.crateNo || 'Crate 1',
        profile: item.profile,
        item_code: item.itemCode || '',
        length: cleanLen(item.length),
        box_qty: Number(item.boxQty) || 1,
        pcs_qty: Number(item.pcsQty) || 0,
        net_weight: Number(item.netWeight) || 0,
        gross_weight: Number(item.grossWeight) || 0,
        packing_date: item.date || null
    };
}

async function restorePackingListSnapshots(items) {
    // Resume-safe restoration: if one insert fails, the next Undo attempt starts
    // at the first item not yet restored. Existing IDs are not reused.
    const restored = [];
    for (const item of items) {
        const row = packingListSnapshotToDbRow(item);
        const { data, error } = await supabaseClient.from('packing_list').insert([row]).select('id').single();
        if (error) throw new Error(`Could not restore crate data (${item.crateNo}, ${item.profile}): ${error.message}`);
        restored.push(data?.id ?? null);
    }
    return restored;
}

window.deleteEntireCrate = async function(crateId) {
    if(currentUserRole !== 'Admin') return;
    const month = String(activePackingMonth || '').trim();
    const container = String(activePackingContainer || '').trim();
    // Restrict delete to the currently selected shipment; the same crate label
    // can exist in other months/containers and must not be touched.
    const items = packingLists.filter(p =>
        String(p.crateNo) === String(crateId) &&
        String(p.month || '').trim() === month &&
        String(p.container || '').trim() === container
    ).map(p => ({...p}));
    if (!items.length) return showToast(`No items found for ${crateId} in ${month} / ${container}.`, 'info');

    showConfirm(`Delete all ${items.length} item(s) in ${crateId}? You can use Undo to restore them.`, async () => {
        const stateKey = manualCrateKey(crateId, container, month);
        const hadManualState = Object.prototype.hasOwnProperty.call(globalManualCrates, stateKey);
        const manualStateSnapshot = hadManualState ? JSON.parse(JSON.stringify(globalManualCrates[stateKey])) : null;
        const deletedItems = [];
        try {
            for (const item of items) {
                const { error } = await supabaseClient.from('packing_list').delete().eq('id', item.id);
                if (error) throw new Error(`Could not delete ${item.profile} (${item.id}): ${error.message}`);
                deletedItems.push(item);
            }

            if (hadManualState) {
                delete globalManualCrates[stateKey];
                if (!await window.saveManualCratesToDB()) throw new Error('Could not save the crate completion state change.');
            }

            packingLists = packingLists.filter(p => !(
                String(p.crateNo) === String(crateId) &&
                String(p.month || '').trim() === month &&
                String(p.container || '').trim() === container
            ));
            renderPackingListTable(); renderDashboard(); renderBalanceWorkTable();

            let restoreIndex = 0;
            aisRegisterUndo(`Delete Crate ${crateId} • ${month} / ${container}`, async () => {
                // Restore rows sequentially. Keep progress if a retry is needed.
                while (restoreIndex < deletedItems.length) {
                    const item = deletedItems[restoreIndex];
                    const { error } = await supabaseClient.from('packing_list').insert([packingListSnapshotToDbRow(item)]);
                    if (error) throw new Error(`Could not restore ${item.profile} in ${crateId}: ${error.message}`);
                    restoreIndex++;
                }
                if (hadManualState) {
                    globalManualCrates[stateKey] = manualStateSnapshot;
                    if (!await window.saveManualCratesToDB()) throw new Error('Packing List items were restored, but crate completion state could not be restored. Retry Undo.');
                }
            }, 'packingListTab');
            showToast(`Crate ${crateId} deleted. Use the Packing List Undo button to restore all ${items.length} item(s).`, 'success');
        } catch (e) {
            console.error('Delete crate group failed:', e);
            // If a multi-row delete fails part-way through, restore rows already
            // removed before reporting the failure; never silently ignore DB errors.
            if (deletedItems.length) {
                try {
                    await restorePackingListSnapshots(deletedItems);
                    if (hadManualState) {
                        globalManualCrates[stateKey] = manualStateSnapshot;
                        await window.saveManualCratesToDB();
                    }
                } catch (restoreError) {
                    console.error('Partial crate delete recovery failed:', restoreError);
                    showToast(`Delete was incomplete. Recovery also needs attention: ${restoreError.message}`, 'error');
                    await loadDataFromSupabase(true).catch(()=>{});
                    return;
                }
            }
            if (hadManualState) globalManualCrates[stateKey] = manualStateSnapshot;
            await loadDataFromSupabase(true).catch(()=>{});
            showToast(`Crate delete failed; data refresh attempted. ${e.message || ''}`, 'error');
        }
    });
};

window.deletePackingListItem = function(id) {
    if(currentUserRole !== 'Admin') return;
    const item = packingLists.find(p => String(p.id) === String(id));
    if (!item) return showToast('Packing List record not found. Refresh and try again.', 'warning');
    const snapshot = {...item};
    showConfirm(`Delete this Packing List record for ${snapshot.profile} / ${snapshot.crateNo}? You can use Undo to restore it.`, async () => {
        try {
            const { error } = await supabaseClient.from('packing_list').delete().eq('id', id);
            if (error) throw error;
            packingLists = packingLists.filter(p => String(p.id) !== String(id));
            renderPackingListTable(); renderDashboard(); renderBalanceWorkTable();

            let restored = false;
            aisRegisterUndo(`Delete Packing List Item • ${snapshot.crateNo} • ${snapshot.profile}`, async () => {
                if (restored) return;
                const { error: restoreError } = await supabaseClient.from('packing_list').insert([packingListSnapshotToDbRow(snapshot)]);
                if (restoreError) throw restoreError;
                restored = true;
            }, 'packingListTab');
            showToast('Packing List record deleted. Use Undo to restore it.', 'success');
        } catch (e) {
            console.error('Delete Packing List record failed:', e);
            showToast(`Delete failed: ${e.message || 'Database rejected the operation.'}`, 'error');
        }
    });
};

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

function getExtrusionPlan(profile,itemCode,length,qty){
    const matched=masterData.find(m=>String(m.profile).trim()===String(profile).trim() && String(m.itemCode||'').trim()===String(itemCode||'').trim() && cleanLen(m.length)===cleanLen(length));
    const exLength=parseFloat(matched?.exLength)||0;
    const cutLength=parseFloat(length)||0;
    const pcsPerEx=(exLength>0 && cutLength>0) ? Math.floor(exLength/cutLength) : 0;
    const requiredExtrusions=pcsPerEx>0 ? Math.ceil(Math.max(0,Number(qty)||0)/pcsPerEx) : 0;
    const remainderPcs=pcsPerEx>0 ? Math.max(0,(Number(qty)||0)%pcsPerEx) : 0;
    return {matched,exLength,cutLength,pcsPerEx,requiredExtrusions,remainderPcs};
}
function updatePlExtrusionInfo(){
    const profile=document.getElementById('plSelectProfile')?.value||'';
    const itemCode=document.getElementById('plSelectItemCode')?.value||'';
    const length=document.getElementById('plSelectLength')?.value||'';
    const qty=parseInt(document.getElementById('plPcsQty')?.value)||0;
    const exEl=document.getElementById('plExLength'), pcsEl=document.getElementById('plPcsPerEx'), reqEl=document.getElementById('plRequiredExtrusions');
    if(!exEl||!pcsEl||!reqEl) return;
    const plan=getExtrusionPlan(profile,itemCode,length,qty);
    exEl.value=plan.exLength?`${plan.exLength} mm`:'-';
    pcsEl.value=plan.pcsPerEx?`${plan.pcsPerEx} Pcs`:'-';
    reqEl.value=plan.requiredExtrusions?`${plan.requiredExtrusions} Ex`:'-';
    [exEl,pcsEl,reqEl].forEach(el=>el.title='Calculated from Master Catalog Ex Length ÷ Cut Length');
}

function populatePlPoDropdown() { const plPoSelect = document.getElementById('plSelectPo'); if(!plPoSelect) return; plPoSelect.innerHTML = '<option value="">-- Choose PO Number --</option>'; [...new Set(poList.map(p => String(p.poNumber).trim()))].forEach(po => plPoSelect.appendChild(new Option(po, po))); }
function onPlPoSelect() { const poNum = document.getElementById('plSelectPo').value; const profileSelect = document.getElementById('plSelectProfile'); profileSelect.innerHTML = '<option value="">-- Select Profile --</option>'; document.getElementById('plSelectItemCode').innerHTML = '<option value="">-- Select Item Code --</option>'; document.getElementById('plSelectLength').innerHTML = '<option value="">-- Select Length --</option>'; document.getElementById('plNetWeight').value = ''; updatePlExtrusionInfo(); if (!poNum) return; const poItems = poList.filter(p => String(p.poNumber).trim() === String(poNum).trim()); [...new Set(poItems.map(p => String(p.profile).trim()))].forEach(prof => profileSelect.appendChild(new Option(prof, prof))); }
function onPlProfileSelect() { const poNum = document.getElementById('plSelectPo').value; const profile = document.getElementById('plSelectProfile').value; const itemSelect = document.getElementById('plSelectItemCode'); itemSelect.innerHTML = '<option value="">-- Select Item Code --</option>'; document.getElementById('plSelectLength').innerHTML = '<option value="">-- Select Length --</option>'; document.getElementById('plNetWeight').value = ''; updatePlExtrusionInfo(); if (!poNum || !profile) return; const poItems = poList.filter(p => String(p.poNumber).trim() === poNum && String(p.profile).trim() === profile); const uniqueItems = []; poItems.forEach(p => { const matchedCat = masterData.find(m => String(m.profile) === profile && cleanLen(m.length) === cleanLen(p.length)); if(matchedCat && matchedCat.itemCode && !uniqueItems.includes(matchedCat.itemCode)) { uniqueItems.push(matchedCat.itemCode); itemSelect.appendChild(new Option(matchedCat.itemCode, matchedCat.itemCode)); } }); }
function onPlItemCodeSelect() { const poNum = document.getElementById('plSelectPo').value; const profile = document.getElementById('plSelectProfile').value; const itemCode = document.getElementById('plSelectItemCode').value; const lengthSelect = document.getElementById('plSelectLength'); lengthSelect.innerHTML = '<option value="">-- Select Length --</option>'; document.getElementById('plNetWeight').value = ''; updatePlExtrusionInfo(); if (!poNum || !profile || !itemCode) return; const poItems = poList.filter(p => String(p.poNumber).trim() === poNum && String(p.profile).trim() === profile); const matches = poItems.filter(p => { const matchedCat = masterData.find(m => String(m.profile) === profile && cleanLen(m.length) === cleanLen(p.length)); return matchedCat && matchedCat.itemCode === itemCode; }); matches.forEach(p => { const cat=masterData.find(m=>String(m.profile).trim()===profile && cleanLen(m.length)===cleanLen(p.length) && String(m.itemCode||'').trim()===itemCode); const ex=cat?.exLength||'-'; const pcsPerEx=(parseFloat(ex)>0 && parseFloat(p.length)>0)?Math.floor(parseFloat(ex)/parseFloat(p.length)):0; lengthSelect.appendChild(new Option(`${p.length} mm`, p.length)); if(cat) lengthSelect.options[lengthSelect.options.length-1].title=`Ex Length: ${ex} mm | ${pcsPerEx||'-'} Pcs / Extrusion`; }); if(matches.length === 1) { lengthSelect.value = matches[0].length; calculatePlWeights(); } updatePlExtrusionInfo(); }
function calculatePlWeights() {
    const poNum=document.getElementById('plSelectPo').value;
    const profile=document.getElementById('plSelectProfile').value;
    const itemCode=document.getElementById('plSelectItemCode').value;
    const length=document.getElementById('plSelectLength').value;
    const pcsQty=parseInt(document.getElementById('plPcsQty').value)||0;
    updatePlExtrusionInfo();
    if(!profile||!itemCode||!length||pcsQty<=0){document.getElementById('plNetWeight').value='';return;}
    const po=poList.find(p=>{
        if(String(p.poNumber).trim()!==String(poNum).trim()||cleanLen(p.length)!==cleanLen(length)) return false;
        const matchedCat=masterData.find(m=>String(m.profile).trim()===String(p.profile).trim()&&cleanLen(m.length)===cleanLen(p.length));
        return matchedCat&&matchedCat.itemCode===itemCode;
    });
    const matched=masterData.find(m=>String(m.profile).trim()===String(profile).trim()&&String(m.itemCode||'').trim()===String(itemCode).trim()&&cleanLen(m.length)===cleanLen(length));
    if(!po||!matched){document.getElementById('plNetWeight').value='';return;}
    document.getElementById('plNetWeight').value=`${(pcsQty*(matched.unitWeight||0)).toFixed(2)} kg`;
    updatePlExtrusionInfo();
}

async function savePackingListEntry(startNewCrate=false){
 if(isAppBusy)return;
 isAppBusy=true;
 const saveButtons=[...document.querySelectorAll('button[onclick*="savePackingListEntry"]')];
 const oldButtonLabels=saveButtons.map(b=>b.innerHTML);
 saveButtons.forEach(b=>{b.disabled=true;b.setAttribute('aria-busy','true');b.style.opacity='.65';b.style.cursor='wait';});
 try{
  if(currentUserRole!=='Admin')return;
  const plNum=document.getElementById('plNumber').value.trim(),poNum=document.getElementById('plSelectPo').value,container=normalizeContainerName(document.getElementById('plContainer').value),plDate=document.getElementById('plDate').value,profile=document.getElementById('plSelectProfile').value,itemCode=document.getElementById('plSelectItemCode').value,length=cleanLen(document.getElementById('plSelectLength').value),crateNo=document.getElementById('plBoxQty').value.trim()||'Crate 1',pcsQty=parseInt(document.getElementById('plPcsQty').value)||0,grossWeight=parseFloat(document.getElementById('plGrossWeight').value)||0;
  if(!plNum||!poNum||!profile||!itemCode||!length||pcsQty<=0)return showToast('Complete all Packing List fields.','warning');
  if(!crateNo)return showToast('Enter a Crate Number / ID.','warning');
  const po=poList.find(p=>String(p.poNumber).trim()===String(poNum).trim()&&cleanLen(p.length)===length&&String(p.profile).trim()===String(profile).trim());
  if(!po)return showToast('Selected PO/profile/length was not found.','error');
  const matched=masterData.find(m=>String(m.profile).trim()===String(profile).trim()&&cleanLen(m.length)===length&&String(m.itemCode||'').trim()===String(itemCode).trim());
  if(!matched)return showToast('Selected catalog item was not found.','error');
  const alreadyPacked=packingLists.filter(x=>String(x.poNumber).trim()===String(poNum).trim()&&String(x.profile).trim()===String(profile).trim()&&cleanLen(x.length)===length).reduce((a,x)=>a+(Number(x.pcsQty)||0),0);
  if(alreadyPacked+pcsQty>Number(po.orderQty||0))return showToast(`Packing quantity exceeds PO quantity. Remaining: ${Math.max(0,Number(po.orderQty||0)-alreadyPacked)} Pcs.`,'error');
  const netWeight=parseFloat((pcsQty*(matched.unitWeight||0)).toFixed(2)),filterMonth=activePackingMonth||new Date().toLocaleString('en-US',{month:'long'});
  const newPl={pl_number:plNum,po_number:poNum,shipment_month:filterMonth,container,crate_no:crateNo,profile,item_code:itemCode,length,box_qty:1,pcs_qty:pcsQty,net_weight:netWeight,gross_weight:grossWeight,packing_date:plDate};
  const {data:inserted,error}=await supabaseClient.from('packing_list').insert([newPl]).select().single();
  if(error)throw new Error(`Packing List save failed: ${error.message}`);
  packingLists.unshift({id:inserted?.id||-Date.now(),plNumber:plNum,poNumber:poNum,month:filterMonth,container,crateNo,profile,itemCode,length,boxQty:1,pcsQty,netWeight,grossWeight,date:plDate,createdAt:inserted?.created_at||inserted?.createdAt||null,updatedAt:inserted?.updated_at||inserted?.updatedAt||null,timestamp:inserted?.timestamp||null});
  aisRegisterUndo(`Packing List • ${plNum} • ${crateNo}`,async()=>{await aisDeleteLatest('packing_list',{pl_number:newPl.pl_number,po_number:newPl.po_number,shipment_month:newPl.shipment_month,container:newPl.container,crate_no:newPl.crate_no,profile:newPl.profile,item_code:newPl.item_code,length:newPl.length,box_qty:newPl.box_qty,pcs_qty:newPl.pcs_qty,net_weight:newPl.net_weight,gross_weight:newPl.gross_weight,packing_date:newPl.packing_date});},'packingListTab');
  showToast(`${profile} added to ${crateNo}. You can add another profile to the same crate.`,'success');

  // Keep the crate/header information so multiple profiles can be entered into one crate.
  const keep={plNumber:plNum,container,plDate,crateNo};
  ['plSelectPo','plSelectProfile','plSelectItemCode','plSelectLength','plPcsQty','plGrossWeight'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  ['plExLength','plPcsPerEx','plRequiredExtrusions','plNetWeight'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('plNumber').value=keep.plNumber;
  document.getElementById('plContainer').value=keep.container;
  document.getElementById('plDate').value=keep.plDate;
  document.getElementById('plBoxQty').value=startNewCrate?'':keep.crateNo;
  populatePlPoDropdown();
  if(startNewCrate) showToast('Saved. Crate closed — ready for a new crate.','info');
  selectLatestPackingList();
  renderPackingListTable();
  if(typeof renderDashboard==='function') renderDashboard();
 }catch(e){console.error('Packing List save failed:',e);showToast(e.message||'Packing List save failed. Please check the connection and try again.','error');}finally{
  saveButtons.forEach((b,i)=>{b.disabled=false;b.removeAttribute('aria-busy');b.style.opacity='';b.style.cursor='';if(oldButtonLabels[i]!==undefined)b.innerHTML=oldButtonLabels[i];});
  isAppBusy=false;
 }
}
function populatePlExcelUploadSelectors(){
  const monthEl=document.getElementById('plUploadMonth');
  const dateEl=document.getElementById('plUploadDate');
  const containerEl=document.getElementById('plUploadContainer');
  if(monthEl && !monthEl.options.length){
    const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
    const current=new Date().toLocaleString('en-US',{month:'long'});
    monthEl.innerHTML=months.map(m=>`<option value="${m}">${m}</option>`).join('');
    monthEl.value=current;
  }
  if(dateEl && !dateEl.value) dateEl.value=new Date().toISOString().slice(0,10);
  if(containerEl && !containerEl.value) containerEl.value=activePackingContainer||'1st Container';
  window.onPlExcelUploadSelectionChange();
}
window.onPlExcelUploadSelectionChange=function(){
  const date=document.getElementById('plUploadDate')?.value||'';
  const month=document.getElementById('plUploadMonth')?.value||'';
  const container=normalizeContainerName(document.getElementById('plUploadContainer')?.value||'');
  const target=document.getElementById('plExcelUploadTarget');
  if(target) target.textContent=(date&&month&&container)?`${date}  •  ${month}  •  ${container}`:'Select Date / Month / Container';
  if(month) activePackingMonth=month;
  if(container) activePackingContainer=container;
};

async function processPlExcelUpload() {
  const fileInput=document.getElementById('plExcelUpload');
  if(!fileInput?.files?.length) return showToast('Please select an Excel file first.','warning');
  if(currentUserRole!=='Admin') return showToast('Admin access is required for Excel upload.','warning');
  populatePlExcelUploadSelectors();
  const uploadDate=(document.getElementById('plUploadDate')?.value||'').trim();
  const uploadMonth=(document.getElementById('plUploadMonth')?.value||'').trim();
  const uploadContainer=normalizeContainerName(document.getElementById('plUploadContainer')?.value||'');
  if(!uploadDate) return showToast('Please select the Upload Date before uploading the Excel.','warning');
  if(!uploadMonth) return showToast('Please select the Upload Month before uploading the Excel.','warning');
  if(!['1st Container','2nd Container','3rd Container'].includes(uploadContainer)) return showToast('Please select 1st, 2nd or 3rd Container.','warning');

  const uploadBtn=document.getElementById('plUploadBtn');
  const originalBtnText=uploadBtn?.innerHTML||'Upload';
  if(uploadBtn){uploadBtn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Validating...';uploadBtn.disabled=true;}
  const file=fileInput.files[0];
  const defaultPlNum=file.name.replace(/\.[^/.]+$/,'').trim()||`PL-${uploadDate}`;
  const normalizeHeader=h=>{
    const raw=String(h??'').replace(/\uFEFF/g,'').trim().toLowerCase();
    const c=raw.replace(/[^a-z0-9]/g,'');
    if(['#','cratenumber','crateno','crateid','crate'].includes(raw)||['cratenumber','crateno','crateid'].includes(c)) return 'crateno';
    if(['profileno','profile','profilecode'].includes(c)) return 'profile';
    if(['itemcode','item','itemnumber','itemno','itemnumbercode'].includes(c)) return 'itemcode';
    if(['length','profilelength','lengthmm','lengthinmm'].includes(c)) return 'length';
    if(['numberofcrates','noofcrate','noofcrates','crateqty','cratesqty','cratecount','numbercrate','numbercrates'].includes(c)) return 'numberofcrates';
    if(['pcspercrate','piecespercrate','percratepcs','cratepcs','qtypercrate','pcscrate'].includes(c)) return 'pcspercrate';
    if(['totalqty','totalquantity','totalpcs','totalpcsqty','overallqty','overallquantity'].includes(c)) return 'totalqty';
    if(['qty','quantity','pcs','pcsqty','pieceqty','pieces'].includes(c)) return 'qty';
    if(['ponumber','po','pono','purchaseorderno','purchaseordernumber'].includes(c)) return 'ponumber';
    return c;
  };
  const requiredHeaders=['crateno','profile','itemcode'];
  try {
    activePackingMonth=uploadMonth;
    activePackingContainer=uploadContainer;
    const data=new Uint8Array(await file.arrayBuffer());
    const workbook=XLSX.read(data,{type:'array',cellDates:true});
    if(!workbook.SheetNames?.length) throw new Error('The Excel workbook has no worksheets.');
    let rawJson=null, headerRowIndex=-1, headers=[], packingSheetName='';
    for(const sheetName of workbook.SheetNames){
      const candidateJson=XLSX.utils.sheet_to_json(workbook.Sheets[sheetName],{header:1,defval:''});
      for(let i=0;i<Math.min(50,candidateJson.length);i++){
        const row=(candidateJson[i]||[]).map(normalizeHeader);
        if(requiredHeaders.every(h=>row.includes(h))){
          rawJson=candidateJson; headerRowIndex=i; headers=row; packingSheetName=sheetName; break;
        }
      }
      if(rawJson) break;
    }
    if(!rawJson) throw new Error('Required columns not found. Excel must contain: Crate No, Profile and Item Code, plus Number of Crates with Pcs per Crate and/or Total Qty. Legacy Qty sheets are also supported. Length is optional when Item Code identifies one Master Catalog item.');
    const col={}; [...requiredHeaders,'length','ponumber','numberofcrates','pcspercrate','totalqty','qty'].forEach(h=>col[h]=headers.indexOf(h));
    const get=(row,h)=>col[h]>=0?row[col[h]]:'';
    const normProfile=v=>String(v??'').trim().toUpperCase().replace(/^AL-\s*/,'');
    const normCode=v=>String(v??'').trim().toUpperCase();
    const normLength=v=>String(v??'').replace(/mm/gi,'').trim().replace(/\.0$/,'');
    const toPositiveInt=(value,label,excelRow,errors,required=false)=>{
      const raw=String(value??'').replace(/,/g,'').trim();
      if(!raw){if(required)errors.push(`Row ${excelRow}: ${label} is required.`);return null;}
      const n=Number(raw);
      if(!Number.isFinite(n)||!Number.isInteger(n)||n<=0){errors.push(`Row ${excelRow}: ${label} must be a positive whole number.`);return null;}
      return n;
    };
    const romanSuffix=n=>{
      const pairs=[[1000,'m'],[900,'cm'],[500,'d'],[400,'cd'],[100,'c'],[90,'xc'],[50,'l'],[40,'xl'],[10,'x'],[9,'ix'],[5,'v'],[4,'iv'],[1,'i']];
      let value=n,result='';
      for(const [amount,symbol] of pairs){while(value>=amount){result+=symbol;value-=amount;}}
      return result;
    };
    const rowsToInsert=[], errors=[], seen=new Set();
    let lastMergedCrateRaw='';
    let lastMergedCrateCount=1;
    for(let i=headerRowIndex+1;i<rawJson.length;i++){
      const row=rawJson[i]||[];
      if(row.every(v=>String(v??'').trim()==='')) { lastMergedCrateRaw=''; lastMergedCrateCount=1; continue; }
      const excelRow=i+1;
      const crateCellRaw=String(get(row,'crateno')??'').trim().replace(/^crate\s*/i,'').replace(/\.0$/,'');
      const profileRaw=String(get(row,'profile')??'').trim();
      const itemCode=String(get(row,'itemcode')??'').trim();
      const qtyRaw=String(get(row,'totalqty') || get(row,'qty') || '').trim();
      const pcsPerCrateRaw=String(get(row,'pcspercrate')??'').trim();
      const crateCountCellRaw=String(get(row,'numberofcrates')??'').trim();
      // Both Crate No and Number of Crates can be vertically merged in the source
      // Excel. Continuation rows inherit both values so every profile expands to
      // the same physical crates.
      const hasItemData=!!(profileRaw&&itemCode&&(qtyRaw||pcsPerCrateRaw));
      const crateRaw=crateCellRaw || (hasItemData ? lastMergedCrateRaw : '');
      const crateCountRaw=crateCountCellRaw || (!crateCellRaw && hasItemData ? String(lastMergedCrateCount) : '');
      if(crateCellRaw){
        lastMergedCrateRaw=crateCellRaw;
        lastMergedCrateCount=crateCountCellRaw ? Number(crateCountCellRaw) : 1;
      } else if(hasItemData && crateCountCellRaw) {
        lastMergedCrateCount=Number(crateCountCellRaw);
      } else if(!hasItemData) {
        lastMergedCrateRaw=''; lastMergedCrateCount=1;
      }
      const lengthRaw=normLength(get(row,'length'));
      const poNum=String(get(row,'ponumber')??'').trim().replace(/\.0$/,'');
      // Ignore title, note and subtotal rows; only actual rows with crate/profile/item/qty are processed.
      if(!crateRaw&&!profileRaw&&!itemCode&&!qtyRaw&&!pcsPerCrateRaw) continue;
      if(!crateRaw||!profileRaw||!itemCode||(!qtyRaw&&!pcsPerCrateRaw)) continue;

      const crateCount=crateCountRaw ? toPositiveInt(crateCountRaw,'Number of Crates',excelRow,errors,true) : 1;
      const totalQty=qtyRaw ? toPositiveInt(qtyRaw,'Total Qty',excelRow,errors,true) : null;
      const pcsPerCrate=pcsPerCrateRaw ? toPositiveInt(pcsPerCrateRaw,'Pcs per Crate',excelRow,errors,true) : null;
      if(crateCount===null || (qtyRaw && totalQty===null) || (pcsPerCrateRaw && pcsPerCrate===null)) continue;
      if(crateCount>100){errors.push(`Row ${excelRow}: Number of Crates cannot exceed 100 in one row.`);continue;}
      let crateQtys=[];
      if(pcsPerCrate!==null){
        crateQtys=Array(crateCount).fill(pcsPerCrate);
        const calculatedTotal=pcsPerCrate*crateCount;
        if(totalQty!==null && totalQty!==calculatedTotal){
          errors.push(`Row ${excelRow}: Total Qty (${totalQty}) does not equal Pcs per Crate (${pcsPerCrate}) × Number of Crates (${crateCount}) = ${calculatedTotal}.`);
          continue;
        }
      }else if(totalQty!==null){
        // If only Total Qty is provided, distribute the exact total across the
        // requested crate count, with remainder pieces assigned to earlier crates.
        const base=Math.floor(totalQty/crateCount), remainder=totalQty%crateCount;
        if(base<1){errors.push(`Row ${excelRow}: Total Qty (${totalQty}) is too small for ${crateCount} crates.`);continue;}
        crateQtys=Array.from({length:crateCount},(_,idx)=>base+(idx<remainder?1:0));
      }
      const matches=masterData.filter(m=>
        normCode(m.itemCode)===normCode(itemCode) &&
        (!profileRaw || normProfile(m.profile)===normProfile(profileRaw)) &&
        (!lengthRaw || normLength(cleanLen(m.length))===lengthRaw)
      );
      if(!matches.length){
        errors.push(`Row ${excelRow}: ${profileRaw} / ${itemCode}${lengthRaw?` / ${lengthRaw} mm`:''} not found in Master Catalog.`);continue;
      }
      if(matches.length>1){
        errors.push(`Row ${excelRow}: ${itemCode} matches multiple Master Catalog entries. Add Length to Excel to identify the correct item.`);continue;
      }
      const cat=matches[0], profile=String(cat.profile||profileRaw).trim(), length=cleanLen(cat.length);
      if(!length){errors.push(`Row ${excelRow}: Master Catalog length is missing for ${itemCode}.`);continue;}
      const unitWeight=Number(cat.unitWeight)||0;
      let rowHasError=false;
      for(let crateIndex=0;crateIndex<crateCount;crateIndex++){
        const label=crateCount===1 ? crateRaw : `${crateRaw}-${romanSuffix(crateIndex+1)}`;
        const crateNo=`Crate ${label}`;
        const qty=crateQtys[crateIndex];
        const uniqueKey=`${uploadMonth}|${uploadContainer}|${crateNo}|${profile}|${itemCode}|${length}`.toLowerCase();
        if(seen.has(uniqueKey)){
          errors.push(`Row ${excelRow}: duplicate crate/profile/item entry in this Excel file (${label}).`);
          rowHasError=true;continue;
        }
        seen.add(uniqueKey);
        const weight=Number((qty*unitWeight).toFixed(3));
        rowsToInsert.push({
          pl_number:defaultPlNum,
          po_number:poNum||null,
          shipment_month:uploadMonth,
          container:uploadContainer,
          crate_no:crateNo,
          profile,
          item_code:itemCode,
          length,
          box_qty:1,
          pcs_qty:qty,
          net_weight:weight,
          gross_weight:weight,
          packing_date:uploadDate
        });
      }
    }
    if(errors.length) throw new Error(errors.slice(0,8).join(' | ')+(errors.length>8?` | +${errors.length-8} more errors`:''));
    if(!rowsToInsert.length) throw new Error('No valid packing rows were found.');
    // Read-only duplicate check: never overwrite, delete, or update existing records.
    const {data:existing,error:existingError}=await supabaseClient.from('packing_list').select('crate_no,profile,item_code,length,shipment_month,container').eq('shipment_month',uploadMonth).eq('container',uploadContainer);
    if(existingError) throw existingError;
    const existingKeys=new Set((existing||[]).map(x=>`${String(x.shipment_month||'').trim()}|${String(x.container||'').trim()}|${String(x.crate_no||'').replace(/^crate\s*/i,'').trim()}|${String(x.profile||'').trim()}|${String(x.item_code||'').trim()}|${cleanLen(x.length)}`.toLowerCase()));
    const duplicateRows=rowsToInsert.filter(x=>existingKeys.has(`${uploadMonth}|${uploadContainer}|${x.crate_no.replace(/^crate\s*/i,'')}|${x.profile}|${x.item_code}|${cleanLen(x.length)}`.toLowerCase()));
    if(duplicateRows.length) throw new Error(`Upload stopped safely: ${duplicateRows.length} record(s) already exist in ${uploadMonth} / ${uploadContainer}. Existing data was not changed.`);
    if(uploadBtn) uploadBtn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    const {error:insertError}=await supabaseClient.from('packing_list').insert(rowsToInsert);
    if(insertError) throw insertError;
    // Reload through the app's paginated sync path so a default 1,000-row
    // PostgREST response limit cannot hide older Packing List records in the UI.
    await loadDataFromSupabase(true);
    fileInput.value='';
    window.onPlExcelUploadSelectionChange();
    showToast(`${uploadMonth} / ${uploadContainer}: uploaded ${rowsToInsert.length} crate-item records from '${packingSheetName}'. Existing records were preserved.`, 'success');
    renderPackingListTable(); renderDashboard(); renderBalanceWorkTable();
  } catch(err) {
    console.error('Packing List Excel upload error:',err);
    showToast(`Upload failed: ${err?.message||'Invalid Excel or database error'}`,'error');
  } finally {
    if(uploadBtn){uploadBtn.innerHTML=originalBtnText;uploadBtn.disabled=false;}
  }
}


/* Packing List: add a profile directly to an existing crate without replacing old rows. */
function ensureManualCrateAddModal(){
  if(document.getElementById('manualCrateAddModal')) return;
  const wrap=document.createElement('div');
  wrap.id='manualCrateAddModal';
  wrap.style.cssText='display:none;position:fixed;inset:0;z-index:10050;background:rgba(8,25,34,.62);backdrop-filter:blur(5px);padding:18px;align-items:center;justify-content:center;';
  wrap.innerHTML=`
    <div role="dialog" aria-modal="true" aria-labelledby="manualCrateAddTitle" style="width:min(620px,100%);max-height:90vh;overflow:auto;background:var(--card-bg,#fff);color:var(--text-color,#17313a);border:1px solid var(--emerald-border,#d0e5df);border-radius:18px;box-shadow:0 24px 80px rgba(0,0,0,.28);padding:22px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;border-bottom:1px solid var(--border-color,#d7e2e8);padding-bottom:14px;margin-bottom:18px;">
        <div><div style="font-size:11px;letter-spacing:1.2px;font-weight:900;color:#16a34a;text-transform:uppercase;">AIS Packing List</div><h3 id="manualCrateAddTitle" style="margin:4px 0 0;font-size:20px;">Add Profile to Crate</h3><div id="manualCrateAddMeta" style="margin-top:6px;font-size:12px;color:var(--text-muted,#5d707b);"></div></div>
        <button type="button" class="btn" onclick="closeManualAddProfileModal()" aria-label="Close" style="padding:7px 11px;">✕</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:13px;">
        <div class="form-group" style="grid-column:1/-1;"><label>Profile</label><select id="manualCrateProfile" onchange="manualCrateProfileChanged()" required style="width:100%;"></select></div>
        <div class="form-group"><label>Item Code</label><select id="manualCrateItemCode" onchange="manualCrateItemChanged()" required style="width:100%;"></select></div>
        <div class="form-group"><label>Cut Length (mm)</label><select id="manualCrateLength" required style="width:100%;"></select></div>
        <div class="form-group" style="grid-column:1/-1;"><label>PCS Quantity</label><input id="manualCratePcsQty" type="number" min="1" step="1" placeholder="Enter PCS quantity" required style="width:100%;"></div>
      </div>
      <div id="manualCrateAddPreview" style="margin-top:12px;padding:11px 13px;background:var(--emerald-light,#f1f8f6);border:1px solid var(--emerald-border,#d0e5df);border-radius:10px;font-size:12px;"></div>
      <div style="display:flex;gap:9px;justify-content:flex-end;flex-wrap:wrap;margin-top:18px;">
        <button type="button" class="btn" onclick="closeManualAddProfileModal()">Cancel</button>
        <button type="button" class="btn btn-accent" id="manualCrateAddSaveBtn" onclick="saveManualProfileToCrate()"><i class="fa-solid fa-plus"></i> Add to This Crate</button>
      </div>
    </div>`;
  wrap.addEventListener('click',e=>{if(e.target===wrap)closeManualAddProfileModal();});
  document.body.appendChild(wrap);
}
let manualCrateAddTarget='';
function manualCrateAddEsc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function manualCrateAddSetOptions(id,items,placeholder){
  const el=document.getElementById(id); if(!el)return;
  el.innerHTML='';
  const first=document.createElement('option');first.value='';first.textContent=placeholder||'Select';el.appendChild(first);
  items.forEach(item=>{const op=document.createElement('option');op.value=String(item.value);op.textContent=String(item.label);el.appendChild(op);});
}
window.openManualAddProfileToCrate=function(encodedCrateNo){
  if(currentUserRole!=='Admin') return showToast('Admin access is required to add a profile to a crate.','warning');
  ensureManualCrateAddModal();
  manualCrateAddTarget=decodeURIComponent(String(encodedCrateNo||''));
  const rows=getPackingContainerRecords(activePackingMonth,activePackingContainer).filter(x=>String(x.crateNo||'').trim()===manualCrateAddTarget);
  if(!rows.length) return showToast('Crate not found in the selected month/container. Refresh the Packing List and try again.','error');
  const meta=document.getElementById('manualCrateAddMeta');
  if(meta)meta.textContent=`${manualCrateAddTarget} • ${activePackingMonth} • ${activePackingContainer}`;
  const profiles=[...new Set(masterData.map(x=>String(x.profile||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  manualCrateAddSetOptions('manualCrateProfile',profiles.map(v=>({value:v,label:v})),'Select Profile');
  manualCrateAddSetOptions('manualCrateItemCode',[],'Select Item Code');
  manualCrateAddSetOptions('manualCrateLength',[],'Select Length');
  document.getElementById('manualCratePcsQty').value='';
  const modal=document.getElementById('manualCrateAddModal');modal.style.display='flex';
  manualCrateProfileChanged();
};
window.closeManualAddProfileModal=function(){const modal=document.getElementById('manualCrateAddModal');if(modal)modal.style.display='none';};
window.manualCrateProfileChanged=function(){
  const profile=document.getElementById('manualCrateProfile')?.value||'';
  const items=[...new Set(masterData.filter(x=>String(x.profile||'').trim()===profile).map(x=>String(x.itemCode||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  manualCrateAddSetOptions('manualCrateItemCode',items.map(v=>({value:v,label:v})),'Select Item Code');
  manualCrateItemChanged();
};
window.manualCrateItemChanged=function(){
  const profile=document.getElementById('manualCrateProfile')?.value||'';
  const code=document.getElementById('manualCrateItemCode')?.value||'';
  const lengths=[...new Set(masterData.filter(x=>String(x.profile||'').trim()===profile&&String(x.itemCode||'').trim()===code).map(x=>cleanLen(x.length)).filter(Boolean))].sort((a,b)=>(Number(a)||0)-(Number(b)||0));
  manualCrateAddSetOptions('manualCrateLength',lengths.map(v=>({value:v,label:`${v} mm`})),'Select Length');
  const m=masterData.find(x=>String(x.profile||'').trim()===profile&&String(x.itemCode||'').trim()===code&&cleanLen(x.length)===cleanLen(document.getElementById('manualCrateLength')?.value));
  const preview=document.getElementById('manualCrateAddPreview');
  if(preview)preview.textContent=m?`Unit weight: ${(Number(m.unitWeight)||0).toFixed(3)} kg/Pcs • Crate: ${manualCrateAddTarget}`:`Select a profile, item code and length to continue.`;
};
window.saveManualProfileToCrate=async function(){
  if(isAppBusy)return showToast('A save is already in progress. Please wait.','info');
  if(currentUserRole!=='Admin')return showToast('Admin access is required.','warning');
  const profile=document.getElementById('manualCrateProfile')?.value||'';
  const itemCode=document.getElementById('manualCrateItemCode')?.value||'';
  const length=cleanLen(document.getElementById('manualCrateLength')?.value||'');
  const qty=Number(document.getElementById('manualCratePcsQty')?.value);
  if(!manualCrateAddTarget||!profile||!itemCode||!length||!Number.isInteger(qty)||qty<=0)
    return showToast('Select Profile, Item Code, Length and enter a whole PCS quantity above 0.','warning');
  const catalog=masterData.find(x=>String(x.profile||'').trim()===profile&&String(x.itemCode||'').trim()===itemCode&&cleanLen(x.length)===length);
  if(!catalog)return showToast('Selected item was not found in Master Catalog.','error');
  const targetRows=getPackingContainerRecords(activePackingMonth,activePackingContainer).filter(x=>String(x.crateNo||'').trim()===manualCrateAddTarget);
  if(!targetRows.length)return showToast('This crate is no longer in the selected container. Refresh and try again.','error');
  const dup=targetRows.find(x=>String(x.profile||'').trim()===profile&&String(x.itemCode||'').trim()===itemCode&&cleanLen(x.length)===length);
  if(dup)return showToast('This profile / item code / length already exists in this crate. Edit its existing PCS quantity to avoid duplicate records.','warning');
  isAppBusy=true;
  const btn=document.getElementById('manualCrateAddSaveBtn');const old=btn?.innerHTML;
  if(btn){btn.disabled=true;btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Saving...';}
  try{
    const date=new Date().toISOString().slice(0,10);
    const existingPl=targetRows.find(x=>x.plNumber)?.plNumber;
    const unitWeight=Number(catalog.unitWeight)||0;
    const weight=Number((qty*unitWeight).toFixed(3));
    const row={
      pl_number:existingPl||`Manual-${date}`,
      po_number:null,
      shipment_month:activePackingMonth||new Date().toLocaleString('en-US',{month:'long'}),
      container:activePackingContainer||'1st Container',
      crate_no:manualCrateAddTarget,
      profile,item_code:itemCode,length,
      box_qty:1,pcs_qty:qty,net_weight:weight,gross_weight:weight,packing_date:date
    };
    const {data,error}=await supabaseClient.from('packing_list').insert([row]).select().single();
    if(error)throw error;
    packingLists.unshift({id:data?.id||-Date.now(),plNumber:row.pl_number,poNumber:null,month:row.shipment_month,container:row.container,crateNo:row.crate_no,profile,itemCode,length,boxQty:1,pcsQty:qty,netWeight:weight,grossWeight:weight,date});
    aisRegisterUndo(`Packing List • ${manualCrateAddTarget} • ${profile}`,async()=>{
      if(!data?.id) throw new Error('Saved row ID is unavailable; refresh data before undoing this entry.');
      const {error:undoError}=await supabaseClient.from('packing_list').delete().eq('id',data.id);
      if(undoError) throw undoError;
      packingLists=packingLists.filter(x=>String(x.id)!==String(data.id));
      renderPackingListTable();renderDashboard();renderBalanceWorkTable();
    },'packingListTab');
    closeManualAddProfileModal();
    renderPackingListTable();renderDashboard();renderBalanceWorkTable();
    showToast(`${profile} / ${itemCode} (${qty} Pcs) added to ${manualCrateAddTarget}.`,'success');
  }catch(e){console.error('Manual crate profile add failed:',e);showToast(`Could not add profile: ${e?.message||e}`,'error');}
  finally{isAppBusy=false;if(btn){btn.disabled=false;btn.innerHTML=old||'<i class="fa-solid fa-plus"></i> Add to This Crate';}}
};

function renderHistoryData() { 
    try {
        const dateVal = document.getElementById('historyDateSelect').value; const tbody = document.getElementById('historyTableBody'); tbody.innerHTML = ''; const filtered = historyLogs.filter(h => h.date === dateVal); 
        if (filtered.length === 0) { tbody.innerHTML = `<tr><td colspan="12" style="color:#888; text-align:center;">No logs for ${dateVal}.</td></tr>`; return; } 
        let html = '';
        filtered.forEach(log => { 
            const matched = masterData.find(m => String(m.profile).trim() === String(log.profile).trim() && cleanLen(m.length) === cleanLen(log.length));
            const iCode = matched && matched.itemCode ? matched.itemCode : '-'; const uWt = matched && matched.unitWeight ? matched.unitWeight.toFixed(3) + ' kg' : '-';
            html += `<tr><td><b>${log.timestamp || ''}</b> <span style="font-size:11px;color:var(--text-muted);">(${log.shift})</span></td><td><b>${log.team || 'Unassigned'}</b></td><td><b>${log.profile}</b></td><td><span style="color:var(--info-color); font-weight:600;">${iCode}</span></td><td>${log.length} mm</td><td><span style="font-weight:700;">${uWt}</span></td><td><span class="stock-badge bg-cut">${log.cutQty}</span></td><td><span class="stock-badge bg-punch">${log.punchQty}</span></td><td><span class="stock-badge bg-wrap">${log.wrapQty}</span></td><td><span class="stock-badge bg-box">${log.boxQty}</span></td><td><span class="stock-badge bg-crate">${log.crateQty}</span></td><td>${currentUserRole === 'Admin' ? `<button class="btn btn-accent" style="padding:4px 8px; font-size:11px;" onclick="openGenericEdit('history_logs', ${log.id}, {cut_qty: '${log.cutQty}', punch_qty: '${log.punchQty}', wrap_qty: '${log.wrapQty}', box_qty: '${log.boxQty}', crate_qty: '${log.crateQty}'})"><i class="fa-solid fa-pen"></i></button> <button class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="deleteHistoryLog(${log.id})"><i class="fa-solid fa-trash"></i></button>` : `<i class="fa-solid fa-lock" style="color:#aaa;"></i>`}</td></tr>`; 
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
async function saveMasterCatalogEdit() {
 if(isAppBusy)return; isAppBusy=true;
 try {
  const index=parseInt(document.getElementById('editMasterIndex').value);
  const profile=document.getElementById('editMasterProfile').value.trim();
  const itemCode=document.getElementById('editMasterItemCode').value.trim();
  const material=document.getElementById('editMasterMaterial').value.trim();
  const length=document.getElementById('editMasterLength').value.trim();
  const exLength=document.getElementById('editMasterExLength').value.trim();
  const uw=parseFloat(document.getElementById('editMasterUnitWeight').value)||0;
  const cap=parseInt(document.getElementById('editMasterBoxCapacity').value)||100;
  if(isNaN(index))return;
  const item=masterData[index]; if(!item)throw new Error('Master catalog item not found.');
  const old={profile:item.profile,item_code:item.itemCode||'',material:item.material||'',length:item.length,ex_length:item.exLength||'',unit_weight:Number(item.unitWeight)||0,box_capacity:Number(item.boxCapacity)||100};
  const vals={profile,item_code:itemCode,material,length,ex_length:exLength,unit_weight:uw,box_capacity:cap};
  if(item.db_id){ const r=await supabaseClient.from('master_catalog').update(vals).eq('id',item.db_id); if(r.error)throw r.error; }
  else { const r=await supabaseClient.from('master_catalog').insert([{...vals,cut_qty:item.cutQty,punch_qty:item.punchQty,wrap_qty:item.wrapQty,box_qty:item.boxQty,crate_qty:item.crateQty}]); if(r.error)throw r.error; }
  Object.assign(item,{profile,itemCode,material,length,exLength,unitWeight:uw,boxCapacity:cap});
  if(item.db_id) aisRegisterUndo(`Edit Master Catalog • ${profile} / ${length}`,async()=>{await aisUpdateById('master_catalog',item.db_id,old);},'masterListTab');
  saveMasterExtrasLocally(); closeMasterEditModal(); showToast('Catalog updated successfully','success'); renderMasterCatalog(); populateStockFilterDropdown(); populateProfileDropdown(); populatePoProfileDropdown(); populateCbProfileDropdown(); renderProfileSummaryTable(); renderCardboardStock(); renderBalanceWorkTable();
 } catch(e){ showToast(dbErrorMessage(e,'Master catalog save failed'),'error'); }
 finally{isAppBusy=false;}
}
function deleteMasterItem(index) { if (currentUserRole !== 'Admin') return; showConfirm("Delete catalog item?", async () => { const item = masterData[index]; if (item && item.db_id) await supabaseClient.from('master_catalog').delete().eq('id', item.db_id); masterData.splice(index, 1); saveMasterExtrasLocally(); renderMasterCatalog(); showToast("Catalog item deleted", "success"); }); }
function openAddMasterModal() { if (currentUserRole !== 'Admin') return; document.getElementById('addMasterProfile').value = ''; document.getElementById('addMasterItemCode').value = ''; document.getElementById('addMasterMaterial').value = ''; document.getElementById('addMasterLength').value = ''; document.getElementById('addMasterExLength').value = ''; document.getElementById('addMasterUnitWeight').value = ''; document.getElementById('addMasterBoxCapacity').value = '100'; document.getElementById('addMasterModal').style.display = 'flex'; }
function closeAddMasterModal() { document.getElementById('addMasterModal').style.display = 'none'; }
async function saveNewMasterProfile() { if(isAppBusy) return; isAppBusy=true; try { if (currentUserRole !== 'Admin') return; const profile = document.getElementById('addMasterProfile').value.trim(); const itemCode = document.getElementById('addMasterItemCode').value.trim(); const material = document.getElementById('addMasterMaterial').value.trim(); const length = document.getElementById('addMasterLength').value.trim(); const exLength = document.getElementById('addMasterExLength').value.trim(); const uw = parseFloat(document.getElementById('addMasterUnitWeight').value) || 0; const cap = parseInt(document.getElementById('addMasterBoxCapacity').value) || 100; if (!profile || !itemCode || !length) { showToast("Fill all fields", "warning"); return; } const exists = masterData.find(m => String(m.profile).trim() === profile && cleanLen(m.length) === cleanLen(length) && m.itemCode === itemCode); if (exists) { showToast("Already exists!", "error"); return; } const newEntry = { profile: profile, item_code: itemCode, material: material, length: length, ex_length: exLength, unit_weight: uw, box_capacity: cap, cut_qty: 0, punch_qty: 0, wrap_qty: 0, box_qty: 0, crate_qty: 0 }; const mapped = { db_id: Date.now(), profile: profile, itemCode: itemCode, material: material, length: length, exLength: exLength, unitWeight: uw, cutQty: 0, punchQty: 0, wrapQty: 0, boxQty: 0, crateQty: 0, boxCapacity: cap }; try { const r=await supabaseClient.from('master_catalog').insert([newEntry]); if(r.error) throw r.error; } catch (e) { showToast(dbErrorMessage(e,'Master catalog add failed'),'error'); return; } masterData.push(mapped);
  aisRegisterUndo(`New Master Profile • ${profile} / ${length}`,async()=>{await aisDeleteLatest('master_catalog',{profile:newEntry.profile,item_code:newEntry.item_code,material:newEntry.material,length:newEntry.length,ex_length:newEntry.ex_length,unit_weight:newEntry.unit_weight,box_capacity:newEntry.box_capacity,cut_qty:0,punch_qty:0,wrap_qty:0,box_qty:0,crate_qty:0});},'masterListTab');
  masterData.sort((a, b) => (parseFloat(a.profile)||0) - (parseFloat(b.profile)||0) || (parseFloat(a.length)||0) - (parseFloat(b.length)||0)); saveMasterExtrasLocally(); closeAddMasterModal(); showToast("Profile added!", "success"); renderMasterCatalog(); populateStockFilterDropdown(); populateProfileDropdown(); populatePoProfileDropdown(); populateCbProfileDropdown(); renderCardboardStock(); renderBalanceWorkTable(); } finally { isAppBusy=false; } }
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
    ['Legacy Recovery Logs', recoverLogs.length], ['Recovery Cut Logs', recoveryCutLogs.length], ['Recovery Wrapping Logs', recoveryWrapLogs.length], ['Cardboard Transactions', cardboardStockList.length], ['Cardboard Manual Data', cardboardManualData.length], ['Cardboard Manual Data', cardboardManualData.length]
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

window.addEventListener('error', function(event){
  const msg = String(event?.message || '');
  console.error('AIS Tracker runtime error:', event?.error || msg || event);
  // Browsers intentionally expose only "Script error." for some cross-origin CDN failures.
  // Do not flood the user with misleading generic errors; application code reports actionable errors itself.
  if (msg && msg !== 'Script error.' && !msg.includes('ResizeObserver')) {
    const target = event?.target;
    const isExternal = target && target.tagName === 'SCRIPT' && target.src && !target.src.startsWith(location.origin);
    if (!isExternal && document.getElementById('mainContent')?.style.display !== 'none') {
      showToast(`Runtime error: ${msg}`,'error');
    }
  }
});
window.addEventListener('unhandledrejection', function(event){
  const reason=event.reason; console.error('AIS Tracker unhandled promise rejection:',reason);
  const msg = String(reason?.message || reason || 'Unexpected background error.');
  // Background realtime/chart/CDN promises must not be presented as a failed save.
  // Actual save functions already catch and display their own database errors.
  const lower=msg.toLowerCase();
  const noisy = lower.includes('resizeobserver') || lower.includes('aborterror') || lower === 'script error.' || lower.includes('load failed');
  const looksDatabase = lower.includes('supabase') || lower.includes('database') || lower.includes('row-level security') || lower.includes('permission denied') || lower.includes('violates') || lower.includes('relation') || lower.includes('column');
  if(!noisy && looksDatabase && document.getElementById('mainContent')?.style.display !== 'none') showToast(`Database background sync issue: ${msg}`,'warning');
  event.preventDefault();
});

// END OF SCRIPT

window.dashboardDataPeriod = dashboardDataPeriod;
window.setDashboardPeriodBadge = setDashboardPeriodBadge;

// ===== V16 stability helpers for existing UI hooks =====
function populateCbProfileDropdown(){
  const p=document.getElementById('cbSelectProfile'); if(!p) return;
  p.innerHTML='<option value="">-- Choose Profile --</option>';
  [...new Set(masterData.map(m=>String(m.profile||'').trim()).filter(Boolean))].forEach(v=>p.appendChild(new Option(v,v)));
  const dl=document.getElementById('cbMaterialList');
  if(dl){dl.innerHTML=''; [...new Set(masterData.map(m=>String(m.material||'').trim()).filter(v=>v&&v!=='-'))].forEach(v=>dl.appendChild(new Option(v,v)));}
}
function updateProductionCardboardAvailability(){
  const box=document.getElementById('productionCardboardAvailability');
  const input=document.getElementById('boxQty');
  if(!box) return;
  const p=document.getElementById('selectProfile')?.value||'', i=document.getElementById('selectItemCode')?.value||'', l=document.getElementById('selectLength')?.value||'';
  if(!p||!i||!l){
    if(input){ input.value=0; input.removeAttribute('max'); input.disabled=true; input.title='Select profile, item code and length first.'; }
    box.textContent='Select profile, item code and length to check cardboard stock.';
    box.className='production-cardboard-info neutral';
    return;
  }
  const avail=Math.max(0,Number(getAvailableCardboard(p,i,l))||0);
  let entered=Math.max(0,parseInt(input?.value)||0);

  // Box Qty is a production quantity and must NOT be blocked by cardboard stock.
  // Users may enter any quantity (even when cardboard stock is 0). Cardboard consumption
  // is capped at the available stock during save, so cardboard stock can never become negative.
  if(input){
    input.removeAttribute('max');
    input.disabled=false;
    input.value=entered;
    input.title=avail<=0 ? 'No cardboard stock available. Production Box Qty can still be entered.' : `Available cardboard: ${avail} boxes`;
  }
  const shortBy=Math.max(0,entered-avail);
  const ok=shortBy===0;
  const afterSave=Math.max(0,avail-entered);
  box.innerHTML=`<i class="fa-solid ${avail>0?'fa-box-open':'fa-box'}"></i> <span>Available Cardboard Stock: <b>${avail.toLocaleString()} Boxes</b>${entered?` • Entered Box Qty: <b>${entered}</b> • ${ok?'Stock after save: '+afterSave:'Cardboard used: '+avail+' • Short by: '+shortBy}`:''}</span>`;
  box.className='production-cardboard-info '+(entered && !ok?'danger':(avail>0?'ok':'neutral'));
}
function enforceProductionCardboardQty(){
  const input=document.getElementById('boxQty');
  if(!input) return;
  updateProductionCardboardAvailability();
}
function onPoFilterProfileChange(){
  updatePoFilters();
  renderPoDetailsTable();
}
function updatePoFilters(){
  const pn=document.getElementById('filterPoNumber'), pf=document.getElementById('filterPoProfile'), pi=document.getElementById('filterPoItemCode');
  if(!pn||!pf||!pi)return;
  const oldN=pn.value,oldP=pf.value,oldI=pi.value;
  const sortVals=arr=>[...new Set(arr.map(v=>String(v??'').trim()).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'}));
  const fill=(sel,label,vals,old)=>{sel.innerHTML='';sel.appendChild(new Option(label,''));vals.forEach(v=>sel.appendChild(new Option(v,v)));if(vals.includes(old))sel.value=old;};
  fill(pn,'All PO Numbers',sortVals(poList.map(p=>p.poNumber)),oldN);
  const poRows=pn.value?poList.filter(p=>String(p.poNumber||'').trim()===pn.value):poList;
  fill(pf,'All Profiles',sortVals(poRows.map(p=>p.profile)),oldP);
  const profileRows=pf.value?poRows.filter(p=>String(p.profile||'').trim()===pf.value):poRows;
  const itemCodes=sortVals(profileRows.map(p=>{
    const ic=(typeof resolveMasterItemCode==='function'?resolveMasterItemCode(p.profile,p.length,p.itemCode):p.itemCode)||'';
    p.itemCode=ic;return ic;
  }));
  fill(pi,'All Item Codes',itemCodes,oldI);
}
function renderPoDetailsTable(){
  const body=document.getElementById('poDetailsTableBody'); if(!body)return;
  const pn=document.getElementById('filterPoNumber')?.value||'', pf=document.getElementById('filterPoProfile')?.value||'', pi=document.getElementById('filterPoItemCode')?.value||'';
  const rows=poList.filter(p=>(!pn||p.poNumber===pn)&&(!pf||String(p.profile).trim()===pf)&&(!pi||String(p.itemCode||'').trim()===pi));
  body.innerHTML=rows.length?rows.map((po)=>{
    const idx=poList.indexOf(po);
    const itemCode=(typeof resolveMasterItemCode==='function'?resolveMasterItemCode(po.profile,po.length,po.itemCode):po.itemCode)||'';
    po.itemCode=itemCode;
    const m=masterData.find(x=>String(x.profile).trim()===String(po.profile).trim()&&cleanLen(x.length)===cleanLen(po.length)&&String(x.itemCode||'').trim()===itemCode)
      || masterData.find(x=>String(x.profile).trim()===String(po.profile).trim()&&cleanLen(x.length)===cleanLen(po.length));
    const requiredQty = Math.max(0, Number(po.orderQty)||0);
    const shippedQty = shipmentList
      .filter(s => String(s.poNumber||'').trim() === String(po.poNumber||'').trim()
        && String(s.profile||'').trim() === String(po.profile||'').trim()
        && cleanLen(s.length) === cleanLen(po.length))
      .reduce((sum,s) => sum + (Number(s.shippedQty)||0), 0);
    const remainingQty = Math.max(0, requiredQty - shippedQty);
    const statusHtml = remainingQty > 0
      ? `<span style="background:#fff1f2;color:#be123c;padding:3px 8px;border-radius:999px;font-weight:800;font-size:11px;">Pending</span>`
      : `<span style="background:#dcfce7;color:#047857;padding:3px 8px;border-radius:999px;font-weight:800;font-size:11px;">Complete</span>`;
    return `<tr><td>${po.date||'-'}</td><td>${po.poNumber||'-'}</td><td>${po.profile||'-'}</td><td><b style="color:var(--primary-dark);">${itemCode||'-'}</b></td><td>${po.length||'-'} mm</td><td>${m?Number(m.unitWeight||0).toFixed(4):'-'}</td><td>${requiredQty.toLocaleString()}</td><td><b style="color:#2563eb;">${shippedQty.toLocaleString()} Pcs</b></td><td><b style="color:${remainingQty>0?'#dc2626':'#059669'};">${remainingQty.toLocaleString()} Pcs</b></td><td>${statusHtml}</td><td><button class="btn" style="padding:5px 8px;background:#0f766e;color:#fff" onclick="openPoEditModal(${idx})"><i class="fa-solid fa-pen"></i></button> <button class="btn btn-danger" style="padding:5px 8px" onclick="deletePoItem(${po.id})"><i class="fa-solid fa-trash"></i></button></td></tr>`;
  }).join(''):'<tr><td colspan="11" style="text-align:center;padding:18px;color:var(--text-muted);font-weight:700;">No production orders match the filters.</td></tr>';
}

function updateShipmentHistoryProfileFilter(){
  const select=document.getElementById('shipmentHistoryProfileFilter');
  if(!select)return;
  const current=select.value;
  const profiles=[...new Set(shipmentList.map(s=>String(s.profile||'').trim()).filter(Boolean))]
    .sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'}));
  select.innerHTML='<option value="">All Profiles</option>'+profiles.map(p=>`<option value="${String(p).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}">${String(p).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</option>`).join('');
  if(profiles.includes(current))select.value=current;
}
function renderShipmentHistoryTable(){
  const body=document.getElementById('shipmentHistoryTableBody'); if(!body)return;
  updateShipmentHistoryProfileFilter();
  const selectedProfile=String(document.getElementById('shipmentHistoryProfileFilter')?.value||'').trim();
  const rows=selectedProfile
    ? shipmentList.map((s,i)=>({s,i})).filter(x=>String(x.s.profile||'').trim()===selectedProfile)
    : shipmentList.map((s,i)=>({s,i}));
  if(!rows.length){
    body.innerHTML='<tr><td colspan="10" style="text-align:center;padding:18px;color:var(--text-muted);font-weight:700;">No shipment records'+(selectedProfile?' for Profile '+selectedProfile:'')+'.</td></tr>';
    return;
  }
  body.innerHTML=rows.map(({s,i})=>{
    const masterItemCode=getShipmentMasterItemCode(s)||'-';
    return `<tr><td>${s.date||'-'}</td><td>${s.poNumber||'-'}</td><td>${s.profile||'-'}</td><td><b style="color:var(--primary-dark);">${masterItemCode}</b></td><td>${s.length||'-'} mm</td><td>${s.month||'-'}</td><td>${s.container||'-'}</td><td>${Number(s.shippedQty||0).toLocaleString()}</td><td>${Number(s.remainingBalance||0).toLocaleString()}</td><td><button class="btn" style="padding:5px 8px;background:#0f766e;color:#fff" onclick="openShipmentEditModal(${i})"><i class="fa-solid fa-pen"></i></button> <button class="btn btn-danger" style="padding:5px 8px" onclick="deleteShipmentItem(${s.id})"><i class="fa-solid fa-trash"></i></button></td></tr>`;
  }).join('');
}
window.renderShipmentHistoryTable=renderShipmentHistoryTable;
function dailyNoteEscape(v){
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function encodeDailyNoteMeta(category, action){
  try{
    return '__AIS_NOTE_META__' + JSON.stringify({
      category: category || 'General',
      action: action || ''
    });
  }catch(e){
    return action || '';
  }
}
function decodeDailyNoteMeta(row){
  const raw=String(row?.action_taken||'');
  if(raw.startsWith('__AIS_NOTE_META__')){
    try{
      const meta=JSON.parse(raw.slice('__AIS_NOTE_META__'.length));
      return {
        category: meta.category || 'General',
        action: meta.action || ''
      };
    }catch(e){}
  }
  return {
    category: row?.category || 'General',
    action: raw
  };
}
function normalizeDailyInstructionRow(row){
  const meta=decodeDailyNoteMeta(row);
  return {...row, category: meta.category, action_taken: meta.action};
}

function dailyNoteCanManage(){
  return currentUserRole === 'Admin' || currentUserRole === 'Planner';
}
function dailyNoteCanDelete(){
  return currentUserRole === 'Admin';
}

function renderDailyInstructions(){
  const box=document.getElementById('instructionBoardContainer'); if(!box)return;

  const roleBadge=document.getElementById('dailyPlanRoleBadge');
  if(roleBadge) roleBadge.textContent = currentUserRole === 'Admin' ? 'ADMIN • Full note control' : (currentUserRole === 'Planner' ? 'PLANNER • Add / complete notes' : 'VIEW ONLY');

  const statusFilter=document.getElementById('dailyNoteFilter')?.value || 'All';
  const categoryFilter=document.getElementById('dailyNoteCategoryFilter')?.value || 'All';

  let visible=dailyInstructionsList
    .filter(x=>!String(x.target_user||'').startsWith('SYS_'))
    .filter(x=>statusFilter==='All' || String(x.status||'Pending')===statusFilter)
    .filter(x=>categoryFilter==='All' || String(x.category||'General')===categoryFilter)
    .sort((a,b)=>{
      const sa=String(a.status||'Pending'), sb=String(b.status||'Pending');
      if(sa!==sb) return sa==='Pending'?-1:1;
      return String(a.target_date||'').localeCompare(String(b.target_date||''));
    });

  box.innerHTML=visible.length ? visible.map(x=>{
    const isDone=String(x.status||'Pending')==='Completed';
    const high=String(x.priority||'Normal')==='High';
    const category=x.category||'General';
    const border=high?'#e11d48':(isDone?'#10b981':'#d97706');
    const bg=isDone?'#f0fdf4':'#fffdf5';
    const canManage=dailyNoteCanManage();
    const deleteBtn=dailyNoteCanDelete()
      ? `<button class="btn" style="padding:5px 8px;background:#dc2626;border:1px solid #dc2626;" onclick="deleteDailyInstruction(${JSON.stringify(x.id)})"><i class="fa-solid fa-trash"></i> Delete</button>`
      : '';
    const completeBtn=canManage
      ? `<button class="btn" style="padding:5px 8px;background:${isDone?'#64748b':'#059669'};border:1px solid ${isDone?'#64748b':'#059669'};" onclick="toggleDailyInstructionStatus(${JSON.stringify(x.id)})"><i class="fa-solid ${isDone?'fa-rotate-left':'fa-check'}"></i> ${isDone?'Re-open':'Complete'}</button>`
      : '';
    return `<div class="card" style="margin:0;border-left:5px solid ${border};background:${bg};box-shadow:0 5px 14px rgba(15,23,42,.06);">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;font-size:11px;font-weight:900;color:#92400e;">
        <span><i class="fa-regular fa-calendar"></i> ${dailyNoteEscape(x.target_date||'-')}</span>
        <span style="background:${high?'#ffe4e6':'#fef3c7'};color:${high?'#be123c':'#92400e'};padding:3px 7px;border-radius:999px;">${dailyNoteEscape(x.priority||'Normal')}</span>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:9px;">
        <span style="font-size:10px;font-weight:900;background:#e0f2fe;color:#075985;padding:4px 7px;border-radius:999px;">${dailyNoteEscape(category)}</span>
        <span style="font-size:10px;font-weight:900;background:${isDone?'#dcfce7':'#f1f5f9'};color:${isDone?'#047857':'#475569'};padding:4px 7px;border-radius:999px;">${isDone?'Completed':'Pending'}</span>
      </div>
      <h4 style="margin:10px 0 6px;color:#334155;">${dailyNoteEscape(x.target_user||'All Sections')}</h4>
      <p style="margin:0;color:#475569;font-weight:650;font-size:13px;line-height:1.6;white-space:pre-line;">${dailyNoteEscape(x.message||'')}</p>
      <div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
        <span style="font-size:10px;color:#94a3b8;">${isDone?'Action completed':'Action pending'}</span>
        <div style="display:flex;gap:6px;">${completeBtn}${deleteBtn}</div>
      </div>
    </div>`;
  }).join(''):'<div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--text-muted);font-weight:800;background:#fafafa;border-radius:12px;">No notes match the selected filter.</div>';
}

async function saveDailyInstruction(){
  if(!dailyNoteCanManage()) return;
  const rec={
    target_date:document.getElementById('planDate').value,
    target_user:document.getElementById('planUser').value,
    priority:document.getElementById('planPriority').value,
    message:document.getElementById('planMessage').value.trim(),
    status:'Pending',
    // IMPORTANT: daily_instructions table in the existing site does not require
    // a separate "category" column. Keep category metadata inside the existing
    // action_taken field so old Supabase schemas continue to work.
    action_taken:encodeDailyNoteMeta(document.getElementById('planCategory')?.value || 'Daily Plan','')
  };
  if(!rec.target_date||!rec.message)return showToast('Enter date and instruction message.','warning');
  try{
    const r=await supabaseClient.from('daily_instructions').insert([rec]);
    if(r.error)throw r.error;

    const localRec={
      ...rec,
      id:-Date.now(),
      ...decodeDailyNoteMeta(rec)
    };
    dailyInstructionsList.unshift(localRec);
    aisRegisterUndo(`Daily Plan Note • ${rec.target_date} • ${rec.target_user}`,async()=>{await aisDeleteLatest('daily_instructions',rec);},'dailyPlanTab');
    renderDailyInstructions();
    clearDailyNoteForm();
    showToast('Daily plan note saved successfully.','success');
  }catch(e){
    console.error('Daily instruction save failed:',e);
    showToast(dbErrorMessage(e,'Instruction save failed'),'error');
  }
}

window.toggleDailyInstructionStatus = async function(id){
  if(!dailyNoteCanManage()) return;
  const item=dailyInstructionsList.find(x=>String(x.id)===String(id));
  if(!item)return;
  const nextStatus=String(item.status||'Pending')==='Completed'?'Pending':'Completed';
  try{
    if(Number(id)>0){
      const action=nextStatus==='Completed'?'Completed by '+currentUserRole:'';
      const r=await supabaseClient.from('daily_instructions').update({
        status:nextStatus,
        action_taken:encodeDailyNoteMeta(item.category||'General',action)
      }).eq('id',id);
      if(r.error)throw r.error;
    }
    item.status=nextStatus;
    item.action_taken=nextStatus==='Completed'?'Completed by '+currentUserRole:'';
    renderDailyInstructions();
    showToast(nextStatus==='Completed'?'Note marked completed.':'Note reopened.','success');
  }catch(e){ showToast(dbErrorMessage(e,'Note status update failed'),'error'); }
};

window.deleteDailyInstruction = async function(id){
  if(!dailyNoteCanDelete()){
    showToast('Only Admin can delete daily plan notes.','warning');
    return;
  }
  const item=dailyInstructionsList.find(x=>String(x.id)===String(id));
  if(!item)return;
  if(!confirm('Delete this daily plan note? This cannot be undone.'))return;
  try{
    if(Number(id)>0){
      const r=await supabaseClient.from('daily_instructions').delete().eq('id',id);
      if(r.error)throw r.error;
    }
    dailyInstructionsList=dailyInstructionsList.filter(x=>String(x.id)!==String(id));
    renderDailyInstructions();
    showToast('Daily plan note deleted.','success');
  }catch(e){ showToast(dbErrorMessage(e,'Note delete failed'),'error'); }
};

window.clearDailyNoteForm=function(){
  const msg=document.getElementById('planMessage'); if(msg)msg.value='';
  const cat=document.getElementById('planCategory'); if(cat)cat.value='Daily Plan';
  const pri=document.getElementById('planPriority'); if(pri)pri.value='Normal';
};

window.setDailyNoteTemplate=function(type){
  const cat=document.getElementById('planCategory');
  const msg=document.getElementById('planMessage');
  const pri=document.getElementById('planPriority');
  if(!msg)return;
  const templates={
    production:['Production','Today production priority: complete the recommended stage quantities shown in Smart Daily Plan. Verify stock before starting.'],
    packing:['Packing','Today packing priority: complete Ready-to-Pack crates and box packing according to current cardboard and wrapping availability.'],
    material:['Material Alert','Material alert: check cardboard availability against current wrapping stock before starting box packing.'],
    kaizen:['Kaizen','Kaizen action: follow the Smart Daily Plan recommendations and record any abnormality, delay, material shortage or improvement opportunity.']
  };
  const t=templates[type]||templates.kaizen;
  if(cat)cat.value=t[0];
  if(pri && (type==='material'))pri.value='High';
  msg.value=t[1];
};

window.useSmartDailyPlanNote=function(){
  const msg=document.getElementById('planMessage');
  const cat=document.getElementById('planCategory');
  if(!msg)return;
  // Recalculate from current live data, then convert the visible Smart Plan summary into a note.
  try{ if(typeof renderSmartDailyPlan==='function') renderSmartDailyPlan(); }catch(e){}
  const summary=document.getElementById('smartDailyPlanSummary');
  const parts=[];
  if(summary){
    summary.querySelectorAll('div[style*="font-size:22px"]').forEach(el=>{
      const card=el.parentElement;
      const title=card?.querySelector('div[style*="text-transform:uppercase"]')?.textContent?.trim();
      const sub=card?.querySelector('div[style*="font-size:10px"]')?.textContent?.trim();
      if(title)parts.push(`${title}: ${el.textContent.trim()}${sub?` (${sub})`:''}`);
    });
  }
  const lines=['Smart Daily Plan – Today:'];
  if(parts.length) lines.push(...parts.map(x=>`• ${x}`));
  else lines.push('• Review Smart Daily Plan recommendations for Punch, Wrap, Box and Crate work.');
  msg.value=lines.join('\n');
  if(cat)cat.value='Daily Plan';
};

function openPoEditModal(idx){const p=poList[idx];if(!p)return;document.getElementById('editPoId').value=p.id;document.getElementById('editPoDate').value=p.date||'';document.getElementById('editPoNumber').value=p.poNumber||'';document.getElementById('editPoProfile').value=p.profile||'';document.getElementById('editPoLength').value=p.length||'';document.getElementById('editPoQty').value=p.orderQty||0;document.getElementById('poEditModal').style.display='flex';}
function closePoEditModal(){document.getElementById('poEditModal').style.display='none';}
async function savePoEdit(){const id=document.getElementById('editPoId').value;const p=poList.find(x=>String(x.id)===String(id));if(!p)return;const old={po_date:p.date,po_number:p.poNumber,profile:p.profile,length:cleanLen(p.length),order_qty:p.orderQty};const vals={po_date:document.getElementById('editPoDate').value,po_number:document.getElementById('editPoNumber').value.trim(),profile:document.getElementById('editPoProfile').value.trim(),length:cleanLen(document.getElementById('editPoLength').value),order_qty:Math.max(1,parseInt(document.getElementById('editPoQty').value)||0)};try{const r=await supabaseClient.from('production_orders').update(vals).eq('id',id);if(r.error)throw r.error;Object.assign(p,{date:vals.po_date,poNumber:vals.po_number,profile:vals.profile,length:vals.length,orderQty:vals.order_qty});aisRegisterUndo(`Edit Production Order • ${vals.po_number}`,async()=>{await aisUpdateById('production_orders',id,old);},'poManagementTab');closePoEditModal();updatePoFilters();renderPoDetailsTable();renderPoCharts();renderBalanceWorkTable();showToast('PO updated.','success');}catch(e){showToast(dbErrorMessage(e,'PO update failed'),'error');}}
function openShipmentEditModal(idx){const s=shipmentList[idx];if(!s)return;document.getElementById('editShipmentId').value=s.id;document.getElementById('editShipmentDate').value=s.date||'';document.getElementById('editShipmentContainer').value=s.container||'';document.getElementById('editShipmentQty').value=s.shippedQty||0;document.getElementById('shipmentEditModal').style.display='flex';}
function closeShipmentEditModal(){document.getElementById('shipmentEditModal').style.display='none';}
async function saveShipmentEdit(){const id=document.getElementById('editShipmentId').value;const s=shipmentList.find(x=>String(x.id)===String(id));if(!s)return;const old={shipment_date:s.date,container:s.container,shipped_qty:s.shippedQty};const date=document.getElementById('editShipmentDate').value,container=document.getElementById('editShipmentContainer').value,qty=Math.max(1,parseInt(document.getElementById('editShipmentQty').value)||0);try{const r=await supabaseClient.from('shipments').update({shipment_date:date,container:container,shipped_qty:qty}).eq('id',id);if(r.error)throw r.error;Object.assign(s,{date,container,shippedQty:qty});aisRegisterUndo(`Edit Shipment • ${s.poNumber} • ${qty} Pcs`,async()=>{await aisUpdateById('shipments',id,old);},'shipmentTab');closeShipmentEditModal();renderShipmentHistoryTable();renderDashboard();renderBalanceWorkTable();showToast('Shipment updated.','success');}catch(e){showToast(dbErrorMessage(e,'Shipment update failed'),'error');}}
window.openPoEditModal=openPoEditModal; window.openShipmentEditModal=openShipmentEditModal;

window.updateProductionCardboardAvailability=updateProductionCardboardAvailability;

window.resetCardboardStock=resetCardboardStock; window.saveCardboardManualData=saveCardboardManualData; window.editCardboardManualData=editCardboardManualData; window.deleteCardboardManualData=deleteCardboardManualData; window.cancelCardboardManualEdit=cancelCardboardManualEdit;


/* AIS CRATE DESIGN V1 — additive module; does not modify stock/PO/shipment records */
const AIS_CRATE_EXCEL_ROWS = [{"profile": "AL-1037", "itemCode": "RT-BT68", "length": 1727.2, "boxSize": "1739 x 265 x 125", "crateWidth": 658.0}, {"profile": "AL-1038", "itemCode": "OX-TFBE96", "length": 2438.4, "boxSize": "2450 x 132 x 80", "crateWidth": 698.0}, {"profile": "AL-1038", "itemCode": "VL-RGEF24", "length": 608.74, "boxSize": "615 x 132 x 130", "crateWidth": 698.0}, {"profile": "AL-1038", "itemCode": "VL-RGEF30", "length": 758.14, "boxSize": "765 x 132 x 130", "crateWidth": 698.0}, {"profile": "AL-1038", "itemCode": "VL-RGEF36", "length": 910.54, "boxSize": "920 x 132 x 130", "crateWidth": 698.0}, {"profile": "AL-1038", "itemCode": "VL-RGEF48", "length": 1215.34, "boxSize": "1225 x 132 x 130", "crateWidth": 698.0}, {"profile": "AL-1038", "itemCode": "VL-RGEF60", "length": 1520.14, "boxSize": "1530 x 132 x 80", "crateWidth": 698.0}, {"profile": "AL-1038", "itemCode": "VL-RGEF72", "length": 1824.94, "boxSize": "1835 x 132 x 80", "crateWidth": 698.0}, {"profile": "AL-1039", "itemCode": "RP-M3MTR24", "length": 595.3, "boxSize": "605 x 139 x 180", "crateWidth": 733.0}, {"profile": "AL-1039", "itemCode": "RP-M3MTR30", "length": 747.7, "boxSize": "760 x 139 x 180", "crateWidth": 733.0}, {"profile": "AL-1039", "itemCode": "RP-M3MTR36", "length": 900.1, "boxSize": "910 x 139 x 180", "crateWidth": 733.0}, {"profile": "AL-1039", "itemCode": "RP-M3MTR42", "length": 1052.5, "boxSize": "1065 x 139 x 180", "crateWidth": 733.0}, {"profile": "AL-1039", "itemCode": "RP-M3MTR48", "length": 1204.9, "boxSize": "1215 x 139 x 180", "crateWidth": 733.0}, {"profile": "AL-1040", "itemCode": "RP-M3BTR24", "length": 598.5, "boxSize": "605 x 134 x 101", "crateWidth": 708.0}, {"profile": "AL-1040", "itemCode": "RP-M3BTR30", "length": 750.9, "boxSize": "760 x 134 x 101", "crateWidth": 708.0}, {"profile": "AL-1040", "itemCode": "RP-M3BTR36", "length": 903.3, "boxSize": "910 x 134 x 101", "crateWidth": 708.0}, {"profile": "AL-1040", "itemCode": "RP-M3BTR42", "length": 1055.7, "boxSize": "1065 x 134 x 101", "crateWidth": 708.0}, {"profile": "AL-1040", "itemCode": "RP-M3BTR48", "length": 1208.1, "boxSize": "1215 x 134 x 101", "crateWidth": 708.0}, {"profile": "AL-1041", "itemCode": "RP-MLEC34", "length": 810.26, "boxSize": "820 x 164 x 174", "crateWidth": 688.0}, {"profile": "AL-1041", "itemCode": "RP-MLEC42", "length": 1013.46, "boxSize": "1020 x 164 x 174", "crateWidth": 688.0}, {"profile": "AL-1041", "itemCode": "RP-MLEC50", "length": 1216.66, "boxSize": "1225 x 164 x 174", "crateWidth": 688.0}, {"profile": "AL-1041", "itemCode": "RP-MLEC58", "length": 1419.86, "boxSize": "1430 x 164 x 174", "crateWidth": 688.0}, {"profile": "AL-1041", "itemCode": "RP-MLEC66", "length": 1623.06, "boxSize": "1630 x 164 x 174", "crateWidth": 688.0}, {"profile": "AL-1041", "itemCode": "RP-MLEC82", "length": 2029.46, "boxSize": "2040 x 164 x 174", "crateWidth": 688.0}, {"profile": "AL-1041", "itemCode": "RP-MLEC130", "length": 3245.0, "boxSize": "3255 x 164 x 89", "crateWidth": 688.0}, {"profile": "AL-1042", "itemCode": "RA-UNLF", "length": 2438.4, "boxSize": "2451 x 128 x 112", "crateWidth": 680.0}, {"profile": "AL-1043", "itemCode": "RP-VSPPIL58", "length": 1474.8, "boxSize": "1485 x 105 x 307", "crateWidth": 670.0}, {"profile": "AL-1043", "itemCode": "RP-VSPPIL74", "length": 1881.2, "boxSize": "1890 x 105 x 307", "crateWidth": 670.0}, {"profile": "AL-1043", "itemCode": "RP-VSPPIL95", "length": 2395.55, "boxSize": "2405 x 105 x 307", "crateWidth": 670.0}, {"profile": "AL-1044", "itemCode": "RP-VSGHTV16", "length": 368.3, "boxSize": "380 x 233 x 214", "crateWidth": 670.0}, {"profile": "AL-1045", "itemCode": "RP-VSHFCL16", "length": 406.4, "boxSize": "424 x 131 x 166", "crateWidth": 703.0}, {"profile": "AL-1045", "itemCode": "RP-VSHFCL42", "length": 863.6, "boxSize": "877 x 131 x 166", "crateWidth": 703.0}, {"profile": "AL-1045", "itemCode": "RP-VSHFCL50", "length": 1066.8, "boxSize": "1080 x 131 x 166", "crateWidth": 703.0}, {"profile": "AL-1045", "itemCode": "RP-VSHFCL58", "length": 1270.0, "boxSize": "1283 x 131 x 166", "crateWidth": 703.0}, {"profile": "AL-1045", "itemCode": "RP-VSHFCL66", "length": 1473.2, "boxSize": "1487 x 131 x 166", "crateWidth": 703.0}, {"profile": "AL-1045", "itemCode": "RP-VSHFCL82", "length": 1879.6, "boxSize": "1893 x 131 x 166", "crateWidth": 703.0}, {"profile": "AL-1046", "itemCode": "OX-SV12", "length": 233.12, "boxSize": "242 x 212 x 204", "crateWidth": 660.0}, {"profile": "AL-1046", "itemCode": "OX-SV16", "length": 334.7, "boxSize": "345 x 212 x 204", "crateWidth": 660.0}, {"profile": "AL-1046", "itemCode": "OX-SV20", "length": 436.32, "boxSize": "448 x 212 x 204", "crateWidth": 660.0}, {"profile": "AL-1046", "itemCode": "OX-SH30", "length": 647.7, "boxSize": "796 x 212 x 204", "crateWidth": 660.0}, {"profile": "AL-1046", "itemCode": "OX-SH54", "length": 1292.23, "boxSize": "1300 x 212 x 84", "crateWidth": 660.0}, {"profile": "AL-1046", "itemCode": "OX-SH60", "length": 1444.63, "boxSize": "1455 x 212 x 84", "crateWidth": 660.0}, {"profile": "AL-1046", "itemCode": "OX-SH72", "length": 1749.43, "boxSize": "1760 x 212 x 84", "crateWidth": 660.0}, {"profile": "AL-1046", "itemCode": "OX-SLSEXT", "length": 2438.4, "boxSize": "2450 x 212 x 84", "crateWidth": 660.0}, {"profile": "AL-1047", "itemCode": "RP-M4TC24", "length": 608.8, "boxSize": "620 x 307 x 178", "crateWidth": 680.0}, {"profile": "AL-1047", "itemCode": "RP-M4TC30", "length": 761.2, "boxSize": "772 x 234 x 178", "crateWidth": 680.0}, {"profile": "AL-1047", "itemCode": "RP-M4TC36", "length": 913.6, "boxSize": "924 x 161 x 178", "crateWidth": 680.0}, {"profile": "AL-1047", "itemCode": "RP-M4TC42", "length": 1066.0, "boxSize": "1077 x 161 x 178", "crateWidth": 680.0}, {"profile": "AL-1047", "itemCode": "RP-M4TC48", "length": 1218.4, "boxSize": "1229 x 161 x 178", "crateWidth": 680.0}, {"profile": "AL-1047", "itemCode": "RP-M4TEE130", "length": 3302.0, "boxSize": "3320 x  95 x 174", "crateWidth": 680.0}, {"profile": "AL-1048", "itemCode": "RP-M3CT130", "length": 3302.0, "boxSize": "3317 x 229 x 145", "crateWidth": null}, {"profile": "AL-1049", "itemCode": "RP-MRGAE24", "length": 608.8, "boxSize": "604 x 220 x195", "crateWidth": 720.0}, {"profile": "AL-1049", "itemCode": "RP-MRGAE36", "length": 913.6, "boxSize": "925 x 307 x 172", "crateWidth": 720.0}, {"profile": "AL-1049", "itemCode": "RP-MRGAE60", "length": 1523.2, "boxSize": "1535 x 307 x 172", "crateWidth": 720.0}, {"profile": "AL-1049", "itemCode": "RP-MRGAE66", "length": 1675.6, "boxSize": "1685 x 307 x 172", "crateWidth": 720.0}, {"profile": "AL-1049", "itemCode": "RP-MRGAE72", "length": 1828.0, "boxSize": "1839 x 307 x 172", "crateWidth": 720.0}, {"profile": "AL-1049", "itemCode": "RP-MRGAE96", "length": 2437.6, "boxSize": "2449 x 307 x 172", "crateWidth": 720.0}, {"profile": "AL-1090", "itemCode": "RP-VL3TC24", "length": 575.0, "boxSize": "586 x 225 x 129", "crateWidth": 680.0}, {"profile": "AL-1090", "itemCode": "RP-VL3TC30", "length": 727.4, "boxSize": "739 x 225 x 129", "crateWidth": 680.0}, {"profile": "AL-1090", "itemCode": "RP-VL3TC36", "length": 879.8, "boxSize": "891 x 225 x 129", "crateWidth": 680.0}, {"profile": "AL-1090", "itemCode": "RP-VL3TC42", "length": 1032.2, "boxSize": "1044 x 225 x 129", "crateWidth": 680.0}, {"profile": "AL-1090", "itemCode": "RP-VL3TC48", "length": 1184.6, "boxSize": "1196 x 225 x 129", "crateWidth": 680.0}, {"profile": "AL-1090", "itemCode": "RP-VL3TC60", "length": 1489.4, "boxSize": "1501 x 118 x 129", "crateWidth": 680.0}, {"profile": "AL-1090", "itemCode": "RP-VL3TC72", "length": 1794.2, "boxSize": "1806 x 118 x 129", "crateWidth": 680.0}, {"profile": "AL-1090", "itemCode": "RP-VL3TC72E", "length": 1799.0, "boxSize": "1810 x 118 x 129", "crateWidth": 680.0}, {"profile": "AL-1090", "itemCode": "RP-VL3TC96", "length": 2438.4, "boxSize": "2450  x 118 x 129", "crateWidth": 680.0}, {"profile": "AL-1207", "itemCode": "RT-DBPA29", "length": 681.7, "boxSize": "690 x  331 x 136", "crateWidth": 680.0}, {"profile": "AL-1207", "itemCode": "RT-DBPA42", "length": 1021.0, "boxSize": "1030 x  331 x 136", "crateWidth": 680.0}, {"profile": "AL-1223", "itemCode": "RP-PSE130", "length": 3302.0, "boxSize": "3310 x 163 x 234", "crateWidth": null}];
const AIS_CRATE_STATE_KEY = 'AIS_CRATE_MASTER_V1';
let ppCrateMasterRows = [];
let ppUploadedExcelRows = [];
let ppCratePlans = [];
const PP_CRATE_PLAN_STATE_KEY = 'AIS_CRATE_PLAN_V1';
let ppCrateCurrent = null;
let ppCrateNextRows = [];
const PP_WOOD_THICKNESS = 20, PP_WOOD_WIDTH = 96, PP_LEG_HEIGHT = 100, PP_MAX_PACKING_HEIGHT = 1100, PP_MAX_OVERALL_HEIGHT = PP_MAX_PACKING_HEIGHT + PP_LEG_HEIGHT, PP_MAX_PROFILE_WEIGHT_KG = 18000;
function ppEsc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function ppNum(v){const n=Number(String(v??'').replace(/,/g,''));return Number.isFinite(n)?n:0;}
function ppDims(s){const a=String(s||'').match(/\d+(?:\.\d+)?/g)||[];return a.length>=3?{l:+a[0],w:+a[1],h:+a[2]}:null;}
function ppNormalizeProfile(p){
 // Master Catalog may store 1037 while the AIS Excel sheet stores AL-1037.
 return String(p??'').trim().toUpperCase().replace(/^AL\s*[- ]?\s*/,'').replace(/\s+/g,'');
}
function ppNormalizeLength(l){
 const raw=String(cleanLen(l)||'').trim(),n=Number(raw);
 return raw!==''&&Number.isFinite(n)?String(Number(n.toFixed(3))):raw;
}
function ppMasterKey(p,i,l){return [ppNormalizeProfile(p),String(i||'').trim().toUpperCase().replace(/\s+/g,''),ppNormalizeLength(l)].join('|');}
function ppExcelLookup(){
 const m=new Map();
 [...(AIS_CRATE_EXCEL_ROWS||[]),...(ppUploadedExcelRows||[])].forEach(r=>{const k=ppMasterKey(r.profile,r.itemCode,r.length);const prev=m.get(k);if(!prev||(prev.crateWidth==null&&r.crateWidth!=null))m.set(k,{...r});});
 return m;
}
function ppProfileWidthMap(){
 // One standard crate width per profile: use the most frequent explicit Excel width.
 // Normalize profile names so 1037 and AL-1037 resolve to the same profile.
 const by={};[...(AIS_CRATE_EXCEL_ROWS||[]),...(ppUploadedExcelRows||[])].forEach(r=>{
  const profileKey=ppNormalizeProfile(r.profile),w=ppNum(r.crateWidth);
  if(profileKey&&w>0){(by[profileKey]??=[]).push(w);}
 });
 const out={};Object.keys(by).forEach(p=>{const counts={};by[p].forEach(v=>counts[v]=(counts[v]||0)+1);out[p]=+Object.entries(counts).sort((a,b)=>b[1]-a[1]||Number(a[0])-Number(b[0]))[0][0];});return out;
}
function ppCrateCalc(row){
 const d=ppDims(row.boxSize); if(!d||!d.l||!d.w||!d.h)return {valid:false,reason:'Box size missing'};
 const width=ppNum(row.crateWidth)||Math.ceil((d.w+2*PP_WOOD_THICKNESS)/10)*10;
 const innerW=Math.max(0,width-2*PP_WOOD_THICKNESS);
 const maxPackingH=PP_MAX_PACKING_HEIGHT;
 const orientation=row.orientation||'auto';
 const candidates=[];
 for(const key of ['height','width']){
   if(orientation!=='auto'&&orientation!==key)continue;
   const cross=key==='height'?d.w:d.h;
   const vertical=key==='height'?d.h:d.w;
   const per=Math.floor(innerW/cross);
   if(per<1)continue;
   const maxLayers=Math.floor(maxPackingH/vertical);
   if(maxLayers<1)continue;
   const defaultCapacity=per*maxLayers;
   const boxes=ppNum(row.manualBoxesPerCrate)||defaultCapacity;
   const layers=ppNum(row.manualLayers)||Math.ceil(boxes/per);
   const packH=ppNum(row.manualPackingH)||layers*vertical;
   const outerL=ppNum(row.manualOuterL)||Math.ceil((ppNum(row.length)||d.l)+32);
   const overallH=packH+PP_LEG_HEIGHT;
   candidates.push({valid:packingH<=PP_MAX_PACKING_HEIGHT,box:d,orientation:key,outerL,outerW:width,packingH:packH,overallH,perLayer:per,layers,boxesPerCrate:boxes,maxCapacity:per*maxLayers,estimatedWidth:!row.crateWidth,manual:!!(row.manualOuterL||row.manualPackingH||row.manualPerLayer||row.manualLayers||row.manualBoxesPerCrate)});
 }
 if(!candidates.length)return {valid:false,reason:'Neither box orientation fits the crate width and height limit'};
 candidates.sort((a,b)=>b.maxCapacity-a.maxCapacity||a.overallH-b.overallH);
 const chosen=candidates[0];
 if(ppNum(row.manualPerLayer)>0)chosen.perLayer=Math.max(1,Math.floor(ppNum(row.manualPerLayer)));
 if(ppNum(row.manualBoxesPerCrate)>0&&!ppNum(row.manualPackingH)){chosen.layers=Math.ceil(chosen.boxesPerCrate/chosen.perLayer);chosen.packingH=chosen.layers*(chosen.orientation==='height'?d.h:d.w);chosen.overallH=chosen.packingH+PP_LEG_HEIGHT;chosen.valid=chosen.overallH<=PP_MAX_OVERALL_HEIGHT;}
 return chosen;
}

function ppBuildCrateMaster(force=false){
 const lookup=ppExcelLookup(), widthMap=ppProfileWidthMap(), prior=new Map((ppCrateMasterRows||[]).map(r=>[ppMasterKey(r.profile,r.itemCode,r.length),r]));
 const source=(Array.isArray(masterData)?masterData:[]);
 const combos=new Map();
 source.forEach(m=>{
  const profile=String(m.profile||'').trim(), itemCode=String(m.itemCode||'').trim(), length=cleanLen(m.length);
  if(!profile||!length)return;
  const k=ppMasterKey(profile,itemCode,length);
  if(!combos.has(k))combos.set(k,{profile,itemCode,length,pcsPerBox:Math.max(1,ppNum(m.boxCapacity)||ppNum(m.pcsPerBox)||ppNum(m.pcsForBox)||1),unitWeight:ppNum(m.unitWeight),master:true});
 });
 // Include all Excel rows even if the current catalog is missing the combination.
 [...(AIS_CRATE_EXCEL_ROWS||[]),...(ppUploadedExcelRows||[])].forEach(r=>{const k=ppMasterKey(r.profile,r.itemCode,r.length);if(!combos.has(k))combos.set(k,{profile:r.profile,itemCode:r.itemCode,length:r.length,pcsPerBox:1,unitWeight:0,master:false});});
 const next=[];
 combos.forEach((c,k)=>{
  const ex=lookup.get(k), old=prior.get(k)||{};
  const boxSize=old.boxSize||ex?.boxSize||'';
  const width=(old.manual&&old.crateWidth)?old.crateWidth:(widthMap[ppNormalizeProfile(c.profile)]??ex?.crateWidth??old.crateWidth??'');
  // Master Catalog is authoritative for Pcs/Box; ignore stale cached crate-master values.
  const row={...c,...old,profile:c.profile,itemCode:c.itemCode,length:c.length,pcsPerBox:Math.max(1,ppNum(c.pcsPerBox)||1),unitWeight:old.unitWeight??c.unitWeight,boxSize,crateWidth:width,orientation:old.orientation||'auto',excelMatched:!!ex,source:ex?'AIS Excel':(old.source||'Manual'),manual:!!old.manual};
  row.calc=ppCrateCalc(row);
  next.push(row);
 });
 ppCrateMasterRows=next.sort((a,b)=>a.profile.localeCompare(b.profile,undefined,{numeric:true})||a.itemCode.localeCompare(b.itemCode,undefined,{numeric:true})||ppNum(a.length)-ppNum(b.length));
 ppRenderCrateMaster(); ppPopulateCrateStandards(); ppRefreshNextPlLines();
}
function ppRenderCrateMaster(){
 const body=document.getElementById('ppCrateMasterBody');if(!body)return;
 const q=(document.getElementById('ppCrateMasterSearch')?.value||'').toLowerCase();
 const rows=ppCrateMasterRows.filter(r=>[r.profile,r.itemCode,r.length,r.boxSize,r.crateWidth].join(' ').toLowerCase().includes(q));
 const matched=ppCrateMasterRows.filter(r=>r.excelMatched).length,missing=ppCrateMasterRows.filter(r=>!r.boxSize||!r.crateWidth||!r.calc.valid).length;
 const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
 set('ppCrateMasterCount',ppCrateMasterRows.length);set('ppCrateMasterMatched',matched);set('ppCrateMasterMissing',missing);
 body.innerHTML=rows.length?rows.map(r=>{const k=ppMasterKey(r.profile,r.itemCode,r.length),idx=ppCrateMasterRows.indexOf(r),c=ppCrateCalc(r),status=(!r.boxSize||!r.crateWidth||!c.valid)?'<span style="color:#b45309;font-weight:800">Manual data needed</span>':(r.excelMatched?'<span style="color:#047857;font-weight:800">Excel matched</span>':'<span style="color:#1d4ed8;font-weight:800">Manual / Catalog</span>');
 const field=(name,val,min=1)=>`<input class="pp-inline-dim" aria-label="${name}" type="number" min="${min}" step="1" value="${ppEsc(val??'')}" onchange="ppUpdateCrateMasterField(${idx},'${name}',this.value)" style="width:92px;min-width:76px;padding:7px;border:1px solid #93c5fd;border-radius:8px;background:#f0f9ff;color:#12364d;font-weight:700">`;
 return `<tr><td><b>${ppEsc(r.profile)}</b></td><td>${ppEsc(r.itemCode||'-')}</td><td>${ppEsc(r.length)}</td><td>${r.pcsPerBox||1}</td><td>${ppEsc(r.boxSize||'—')}</td><td>${field('crateWidth',r.crateWidth||c.outerW||'')}</td><td>${field('manualOuterL',r.manualOuterL||c.outerL||'')}</td><td>${field('manualPackingH',r.manualPackingH||c.packingH||'')}</td><td><select onchange="ppUpdateCrateMasterField(${idx},'orientation',this.value)" style="padding:7px;border:1px solid #93c5fd;border-radius:8px;background:#f0f9ff;color:#12364d;font-weight:700"><option value="auto" ${(r.orientation||'auto')==='auto'?'selected':''}>Auto best fit</option><option value="height" ${r.orientation==='height'?'selected':''}>Height vertical</option><option value="width" ${r.orientation==='width'?'selected':''}>Width vertical</option></select></td><td>${status}</td><td><button class="btn btn-sm" onclick="ppEditCrateMaster('${encodeURIComponent(k)}')"><i class="fa-solid fa-pen"></i> Box / PCS</button></td></tr>`;
 }).join(''):'<tr><td colspan="11">No matching Master Catalog records.</td></tr>';
}
function ppUpdateCrateMasterField(index,field,value){
 const r=ppCrateMasterRows[index];if(!r)return;
 if(field==='orientation'){r.orientation=['auto','height','width'].includes(value)?value:'auto';}
 else {const n=ppNum(value);if(!n||n<1){alert('Enter a dimension greater than zero.');ppRenderCrateMaster();return;}if(field==='manualPackingH'&&n>PP_MAX_PACKING_HEIGHT){alert('Packing height must be 1100 mm or less.');ppRenderCrateMaster();return;}r[field]=n;if(field==='crateWidth')r.manual=true;}
 r.manual=true;r.source='Manual / edited';r.calc=ppCrateCalc(r);if(!r.calc.valid){alert(r.calc.reason||'These dimensions do not fit the 1200 mm height limit.');}
 ppRenderCrateMaster();ppPopulateCrateStandards();ppRefreshNextPlLines();ppSaveCrateMaster();
}

function ppAddManualCrateMaster(){
 const profile=(prompt('Profile code')||'').trim();if(!profile)return;
 const itemCode=(prompt('Item Code')||'').trim();if(!itemCode)return;
 const length=ppNum(prompt('Cutting length (mm)',''));if(!length){alert('Enter a valid cutting length.');return;}
 const k=ppMasterKey(profile,itemCode,length);if(ppCrateMasterRows.some(r=>ppMasterKey(r.profile,r.itemCode,r.length)===k)){alert('This Profile + Item Code + Length already exists. Use Edit.');return;}
 const boxSize=(prompt('Box Size L x W x H (mm)','')||'').trim();
 const width=ppNum(prompt('Crate outer width (mm)',''))||'';
 const pcs=Math.max(1,ppNum(prompt('PCS per Box','1'))||1);
 const row={profile,itemCode,length,boxSize,crateWidth:width,pcsPerBox:pcs,unitWeight:0,excelMatched:false,source:'Manual',manual:true,master:false};
 row.calc=ppCrateCalc(row);ppCrateMasterRows.push(row);ppCrateMasterRows.sort((a,b)=>a.profile.localeCompare(b.profile,undefined,{numeric:true})||a.itemCode.localeCompare(b.itemCode,undefined,{numeric:true})||ppNum(a.length)-ppNum(b.length));ppRenderCrateMaster();ppPopulateCrateStandards();
}
function ppEditCrateMaster(enc){
 const k=decodeURIComponent(enc),r=ppCrateMasterRows.find(x=>ppMasterKey(x.profile,x.itemCode,x.length)===k);if(!r)return;
 const calc=ppCrateCalc(r);
 const box=prompt(`Box Size L x W x H (mm) for ${r.profile} / ${r.itemCode} / ${r.length}`,r.boxSize||'');if(box===null)return;
 const width=prompt('Crate OUTER width (mm) — Excel standard width',r.crateWidth||calc.outerW||'');if(width===null)return;
 const pcs=prompt('PCS per Box (Master Catalog)',r.pcsPerBox||1);if(pcs===null)return;
 const outL=prompt('Crate OUTER length (mm) — blank = auto calculate',r.manualOuterL||calc.outerL||'');if(outL===null)return;
 const packH=prompt('Packing height excluding 100 mm legs (mm) — blank = auto calculate from layers',r.manualPackingH||calc.packingH||'');if(packH===null)return;
 const perLayer=prompt('Boxes per layer — blank = auto calculate from box and crate width',r.manualPerLayer||calc.perLayer||'');if(perLayer===null)return;
 const boxes=prompt('Boxes per crate — enter capacity; blank = auto calculate',r.manualBoxesPerCrate||calc.boxesPerCrate||'');if(boxes===null)return;
 const previousCalc=calc;
 const nextBoxCap=ppNum(boxes)||null,nextPerLayer=ppNum(perLayer)||null,nextPackH=ppNum(packH)||null;
 r.boxSize=box.trim();r.crateWidth=ppNum(width)||'';r.pcsPerBox=Math.max(1,ppNum(pcs)||1);
 r.manualOuterL=ppNum(outL)||null;r.manualPerLayer=nextPerLayer;
 r.manualBoxesPerCrate=nextBoxCap;
 r.manualPackingH=(nextBoxCap&&nextBoxCap!==previousCalc.boxesPerCrate&&nextPackH===previousCalc.packingH)?null:nextPackH;
 const orient=prompt('Box orientation: auto, height, or width',r.orientation||'auto');if(orient===null)return;r.orientation=['auto','height','width'].includes(orient.trim().toLowerCase())?orient.trim().toLowerCase():'auto';
 r.manual=true;r.source='Manual / edited';r.calc=ppCrateCalc(r);
 ppRenderCrateMaster();ppPopulateCrateStandards();ppRefreshNextPlLines();ppSaveCrateMaster();
}

async function ppSaveCrateMaster(){
 try{localStorage.setItem(AIS_CRATE_STATE_KEY,JSON.stringify(ppCrateMasterRows.map(({calc,...r})=>r)));}catch(e){}
 if(typeof supabaseClient!=='undefined'&&Array.isArray(dailyInstructionsList)&&currentUserRole){
  try{
   const target='AIS_CRATE_MASTER_V1',payload=JSON.stringify(ppCrateMasterRows.map(({calc,...r})=>r));
   const existing=dailyInstructionsList.find(x=>String(x.target_user||'')===target);
   if(existing){const {error}=await supabaseClient.from('daily_instructions').update({message:payload}).eq('id',existing.id);if(error)throw error;existing.message=payload;}
   else{const rec={target_date:new Date().toISOString().slice(0,10),target_user:target,priority:'Normal',message:payload,status:'Completed',action_taken:'AIS Crate Master Data'};const {data,error}=await supabaseClient.from('daily_instructions').insert([rec]).select().single();if(error)throw error;dailyInstructionsList.push({...rec,id:data?.id||-Date.now()});}
   if(typeof showToast==='function')showToast('Crate Master saved to cloud.','success');return;
  }catch(e){console.error('Crate master cloud save failed',e);if(typeof showToast==='function')showToast('Cloud save failed; browser backup saved. Check permissions/database.','error');return;}
 }
 if(typeof showToast==='function')showToast('Crate Master saved in this browser. Cloud save requires signed-in access.','warning');
}
function ppLoadCrateMasterSaved(){
 let saved=null;const db=(dailyInstructionsList||[]).find(x=>String(x.target_user||'')==='AIS_CRATE_MASTER_V1');
 if(db?.message){try{saved=JSON.parse(db.message)}catch(e){}}
 if(!saved){try{saved=JSON.parse(localStorage.getItem(AIS_CRATE_STATE_KEY)||'null')}catch(e){}}
 if(Array.isArray(saved)){ppCrateMasterRows=saved.map(r=>({...r,calc:ppCrateCalc(r)}));}
 ppBuildCrateMaster(false);
}
function ppExportCrateMaster(){
 const head=['Profile','Item Code','Length mm','Box Size','Crate Width mm','Pcs per Box','Crate Length mm','Packing Height mm','Boxes per Layer','Layers','Boxes per Crate','Status'];
 const lines=[head,...ppCrateMasterRows.map(r=>{const c=ppCrateCalc(r);return [r.profile,r.itemCode,r.length,r.boxSize,r.crateWidth,r.pcsPerBox,c.outerL||'',c.packingH||'',c.perLayer||'',c.layers||'',c.boxesPerCrate||'',(!r.boxSize||!r.crateWidth)?'Manual data needed':r.source]})];
 const csv=lines.map(a=>a.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\r\n');
 const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='AIS_Crate_Master.csv';a.click();URL.revokeObjectURL(url);
}
function ppPopulateCrateStandards(){
 const sel=document.getElementById('ppCrateStandard');if(!sel)return;const old=sel.value;
 sel.innerHTML='<option value="">Auto from selected profile/length</option>'+ppCrateMasterRows.filter(r=>r.boxSize).map(r=>`<option value="${ppEsc(ppMasterKey(r.profile,r.itemCode,r.length))}">${ppEsc(r.profile)} · ${ppEsc(r.itemCode)} · ${ppEsc(r.length)} mm</option>`).join('');
 if([...sel.options].some(o=>o.value===old))sel.value=old;
}
function ppGetPlanningRows(){
 try{
  const rows=typeof nextPlGetRows==='function'?nextPlGetRows():[];
  return rows.map(r=>({...r,planningQty:Math.max(0,ppNum(r.selectedQty)||ppNum((typeof nextPlSelection!=='undefined'?nextPlSelection[r.rowKey]:0))||ppNum(r.pendingQty))})).filter(r=>r.poNumber&&r.profile&&r.length);
 }catch(e){console.warn('Next PL rows unavailable',e);return [];}
}
function ppRefreshNextPlLines(){
 const sel=document.getElementById('ppNextPlLine');if(!sel)return;
 ppCrateNextRows=ppGetPlanningRows();
 const old=sel.value;
 sel.innerHTML='<option value="">Select Next Planning PL line</option>'+ppCrateNextRows.map((r,i)=>`<option value="${i}">${ppEsc(r.poNumber)} · ${ppEsc(r.profile)} · ${ppEsc(r.itemCode)} · ${ppEsc(r.length)} mm · ${Math.round(r.planningQty).toLocaleString()} PCS</option>`).join('');
 if(old!==''&&Number(old)<ppCrateNextRows.length)sel.value=old;
 if(sel.value!=='')ppOnNextPlLineChange();
}
function ppOnNextPlLineChange(){
 const i=Number(document.getElementById('ppNextPlLine')?.value),r=ppCrateNextRows[i];if(!r)return;
 const set=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v??'';};
 set('ppPlanPo',r.poNumber);set('ppPlanProfile',r.profile);set('ppPlanItemCode',r.itemCode);set('ppPlanLength',r.length);set('ppPlanQty',r.planningQty);
 const m=ppCrateMasterRows.find(x=>ppMasterKey(x.profile,x.itemCode,x.length)===ppMasterKey(r.profile,r.itemCode,r.length));
 const cap=Math.max(1,ppNum(m?.pcsPerBox)||ppNum(r.master?.boxCapacity)||1);
 set('ppPlanPcsPerBox',cap);set('ppPlanBoxQty',Math.ceil(r.planningQty/cap));
 const bs=document.getElementById('ppBoxSelect');if(bs){bs.innerHTML='<option value="">Select matched box data</option>'+ppCrateMasterRows.filter(x=>x.boxSize).map(x=>`<option value="${ppEsc(ppMasterKey(x.profile,x.itemCode,x.length))}">${ppEsc(x.profile)} · ${ppEsc(x.itemCode)} · ${ppEsc(x.length)} mm</option>`).join('');const k=ppMasterKey(r.profile,r.itemCode,r.length);bs.value=[...bs.options].some(o=>o.value===k)?k:'';}
 const std=document.getElementById('ppCrateStandard');if(std){const k=ppMasterKey(r.profile,r.itemCode,r.length);std.value=[...std.options].some(o=>o.value===k)?k:'';}
 ppApplyCrateStandard();ppAutoCrateDesign();
}
function ppApplyCrateStandard(){
 const k=document.getElementById('ppCrateStandard')?.value;
 const r=ppCrateMasterRows.find(x=>ppMasterKey(x.profile,x.itemCode,x.length)===k);
 if(r){const c=ppCrateCalc(r);if(c.valid){const set=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v;};set('ppOuterCrateL',c.outerL);set('ppOuterCrateW',c.outerW);set('ppOuterCrateH',c.overallH);set('ppCrateTare',0);set('ppPlanBoxesPerCrate',c.boxesPerCrate);set('ppPlanBoxesPerCrate',c.boxesPerCrate);}}
 ppAutoCrateDesign();
}
function ppAutoCrateDesign(){
 const i=Number(document.getElementById('ppNextPlLine')?.value),r=ppCrateNextRows[i];if(!r)return;
 const master=ppCrateMasterRows.find(x=>ppMasterKey(x.profile,x.itemCode,x.length)===ppMasterKey(r.profile,r.itemCode,r.length));
 if(!master)return;
 const c=ppCrateCalc(master);if(!c.valid)return;
 const set=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v;};
 set('ppOuterCrateL',c.outerL);set('ppOuterCrateW',c.outerW);set('ppOuterCrateH',c.overallH);
 set('ppCrateL',Math.max(1,c.outerL-2*PP_WOOD_THICKNESS));set('ppCrateW',Math.max(1,c.outerW-2*PP_WOOD_THICKNESS));set('ppCrateH',c.packingH);
 set('ppTargetBoxes',Math.ceil(r.planningQty/Math.max(1,ppNum(master.pcsPerBox))));
 set('ppPlanBoxesPerCrate',c.boxesPerCrate);
 ppCalculateCrate();ppDrawCratePreview(master,c);
}
function ppDrawCratePreview(row,c,boxCount){
 const host=document.getElementById('ppCrate3DPreview');if(!host)return;
 const d=c.box||ppDims(row.boxSize);if(!d){host.innerHTML='<div class="pp-empty">Add box dimensions in Crate Master.</div>';return;}
 const cols=Math.max(1,c.perLayer||1),layers=Math.max(1,c.layers||1),count=Math.min(boxCount||c.boxesPerCrate,cols*layers,32);
 let boxes='';for(let n=0;n<count;n++){const x=32+(n%cols)*Math.min(70,600/cols),y=80+Math.floor(n/cols)*Math.min(24,180/layers);boxes+=`<rect x="${x}" y="${y}" width="${Math.min(65,560/cols)}" height="${Math.min(20,160/layers)}" rx="2" fill="${n%2?'#d6a66a':'#e7c28d'}" stroke="#9a6a36" stroke-width="1"/>`;}
 host.innerHTML=`<svg viewBox="0 0 700 300" role="img" aria-label="Schematic crate layout"><defs><linearGradient id="ppwood" x1="0" x2="1"><stop stop-color="#c18a4a"/><stop offset="1" stop-color="#8b5a2b"/></linearGradient></defs><polygon points="60,90 500,60 640,115 200,150" fill="#ead0a3" stroke="#895b30" stroke-width="5"/><polygon points="60,90 200,150 200,240 60,175" fill="#c18a4a" stroke="#895b30" stroke-width="5"/><polygon points="200,150 640,115 640,205 200,240" fill="#b77b3f" stroke="#895b30" stroke-width="5"/><polygon points="72,97 495,69 620,118 200,143" fill="#f6e5c5" stroke="#956532" stroke-width="3"/>${boxes}<g fill="url(#ppwood)" stroke="#70451f" stroke-width="3"><rect x="72" y="178" width="24" height="74"/><rect x="176" y="225" width="24" height="40"/><rect x="600" y="195" width="24" height="40"/><rect x="590" y="210" width="24" height="35"/></g><g font-size="14" font-weight="700" fill="#153b59"><text x="280" y="285">L ${c.outerL} × W ${c.outerW} × Packing H ${c.packingH} mm</text><text x="280" y="25">Boxes/layer: ${c.perLayer} · Layers: ${c.layers} · Capacity: ${c.boxesPerCrate}</text></g></svg>`;
 const info=document.getElementById('ppCrate3DInfo');if(info)info.innerHTML=`<b>${ppEsc(row.profile)} / ${ppEsc(row.itemCode)}</b><br>Box size: ${ppEsc(row.boxSize)} mm<br>Outer crate: ${c.outerL} × ${c.outerW} × ${c.overallH} mm (includes 100 mm legs)<br>Packing height: ${c.packingH} mm · Boxes/layer: ${c.perLayer} · Layers: ${c.layers} · Boxes/crate: ${c.boxesPerCrate}`;
 const visual=document.getElementById('ppCrateVisual');if(visual)visual.innerHTML=host.innerHTML;
 const breakdown=document.getElementById('ppCrateBreakdown');if(breakdown)breakdown.innerHTML=`${c.perLayer} boxes/layer × ${c.layers} layers = ${c.boxesPerCrate} boxes/crate. Box length is aligned with crate length.`;
 const per=document.getElementById('ppBoxesPerCrate');if(per)per.textContent=c.boxesPerCrate;
 const fit=document.getElementById('ppCrateFitNote');if(fit)fit.textContent=`Outer height ${c.overallH} mm; 100 mm legs excluded from packing height.`;
}
function ppAddCratePlan(){
 const i=Number(document.getElementById('ppNextPlLine')?.value),selected=ppCrateNextRows[i];if(!selected){alert('Select a Next Planning PL line first.');return;}
 const group=ppCrateNextRows.filter(r=>r.poNumber===selected.poNumber&&r.profile===selected.profile&&r.itemCode===selected.itemCode&&r.planningQty>0).map(r=>{
  const m=ppCrateMasterRows.find(x=>ppMasterKey(x.profile,x.itemCode,x.length)===ppMasterKey(r.profile,r.itemCode,r.length));
  return {r,m,c:m&&ppCrateCalc(m),pcsPerBox:Math.max(1,ppNum(m?.pcsPerBox)||ppNum(r.master?.boxCapacity)||1),boxes:Math.ceil(r.planningQty/Math.max(1,ppNum(m?.pcsPerBox)||ppNum(r.master?.boxCapacity)||1))};
 }).filter(x=>x.c?.valid);
 if(!group.length){alert('Box size or crate dimensions are missing. Open Crate Master Data and edit this profile/length first.');return;}
 const sig=selected.poNumber+'|'+selected.profile+'|'+selected.itemCode;
 if(ppCratePlans.some(x=>x.groupKey===sig)){alert('This PO/Profile/Item Code is already in the crate list. Use Copy or remove existing rows before regenerating.');return;}
 const formL=ppNum(document.getElementById('ppOuterCrateL')?.value),formW=ppNum(document.getElementById('ppOuterCrateW')?.value);
 const formH=ppNum(document.getElementById('ppCrateH')?.value)||ppNum(document.getElementById('ppOuterCrateH')?.value)-PP_LEG_HEIGHT-2*PP_WOOD_WIDTH;
 const formCap=ppNum(document.getElementById('ppPlanBoxesPerCrate')?.value);
 const maxL=Math.max(...group.map(x=>x.c.box.l)),maxW=Math.max(...group.map(x=>x.c.box.w)),maxH=Math.max(...group.map(x=>x.c.box.h));
 const width=formW||ppNum(group.find(x=>x.m.crateWidth)?.m.crateWidth)||Math.max(...group.map(x=>x.c.outerW));
 const perLayer=Math.max(1,Math.floor((width-2*PP_WOOD_THICKNESS)/maxW));
 const defaultLayers=Math.floor((PP_MAX_PACKING_HEIGHT)/maxH);
 const defaultCap=perLayer*Math.max(1,defaultLayers);
 const cap=Math.max(1,Math.min(Math.floor(formCap||defaultCap),defaultCap));
 const outerL=formL||Math.max(...group.map(x=>x.c.outerL));
 const packingH=formH>0?formH:Math.max(...group.map(x=>x.c.packingH));
 const overallH=packingH+PP_LEG_HEIGHT;
 if(packH>PP_MAX_PACKING_HEIGHT){alert(`Packing height ${packH} mm exceeds the ${PP_MAX_PACKING_HEIGHT} mm limit.`);return;}
 let queue=[];group.forEach(x=>{for(let b=0;b<x.boxes;b++)queue.push({r:x.r,m:x.m,pcsPerBox:x.pcsPerBox,unitWeight:ppNum(x.r.unitWeight||x.m.unitWeight),boxIndex:b,boxPCS:Math.min(x.pcsPerBox,Math.max(0,x.r.planningQty-b*x.pcsPerBox))});});
 while(queue.length){
  const part=queue.splice(0,cap),byLength={};part.forEach(x=>{const k=String(x.r.length);byLength[k]??={length:x.r.length,itemCode:x.r.itemCode,boxes:0,pcs:0};byLength[k].boxes++;byLength[k].pcs+=x.boxPCS;});
  const pcs=part.reduce((s,x)=>s+x.boxPCS,0),weight=part.reduce((s,x)=>s+x.boxPCS*x.unitWeight,0);
  const crateIndex=ppCratePlans.length+1;
  ppCratePlans.push({id:'C-'+String(crateIndex).padStart(2,'0'),groupKey:sig,po:selected.poNumber,profile:selected.profile,itemCode:selected.itemCode,lengths:Object.values(byLength),length:Object.values(byLength).map(x=>x.length).join(' / '),pcs,pcsPerBox:part[0].pcsPerBox,boxes:part.length,outerL,outerW:width,packingH,overallH,perLayer,layers:Math.ceil(part.length/perLayer),unitWeight:0,boxSize:part[0].m.boxSize,crateWidth:width,weight,boxRows:part.map(x=>({length:x.r.length,boxSize:x.m.boxSize,pcs:x.boxPCS})),manual:false});
 }
 if(ppCratePlans.length>55&&typeof showToast==='function')showToast('Plan exceeds 55 crates. Review the 18,000 kg shipment target and split into another PL if needed.','warning');
 ppRenderCratePlan();const m=group[0].m;ppDrawCratePreview(m,{valid:true,box:group[0].c.box,outerL,outerW:width,packingH,overallH,perLayer,layers:Math.ceil(cap/perLayer),boxesPerCrate:cap},cap);
}
function ppGenerateAllNextPLCrates(){
 ppRefreshNextPlLines();
 if(!ppCrateNextRows.length){alert('No selected Next Planning PL quantities were found.');return;}
 if(ppCratePlans.length&&!confirm('Clear the current crate list and regenerate it from all current Next PL lines?'))return;
 ppCratePlans=[];
 const groups=new Map();
 ppCrateNextRows.forEach((r,i)=>{if(!(r.planningQty>0))return;const key=[r.poNumber,r.profile,r.itemCode].join('|');if(!groups.has(key))groups.set(key,i);});
 let added=0,missing=[];
 for(const i of groups.values()){
  const r=ppCrateNextRows[i],m=ppCrateMasterRows.find(x=>ppMasterKey(x.profile,x.itemCode,x.length)===ppMasterKey(r.profile,r.itemCode,r.length));
  if(!m||!ppCrateCalc(m).valid){missing.push(`${r.profile}/${r.itemCode}/${r.length}`);continue;}
  const sel=document.getElementById('ppNextPlLine');if(sel)sel.value=String(i);
  ppOnNextPlLineChange();
  const before=ppCratePlans.length;ppAddCratePlan();if(ppCratePlans.length>before)added+=ppCratePlans.length-before;
 }
 ppRenderCratePlan();ppPersistCratePlans();
 if(missing.length)alert(`Generated ${added} crates. These lines need box/crate data in Crate Master first:\\n${missing.slice(0,12).join('\\n')}${missing.length>12?'\\n…':''}`);
 else if(typeof showToast==='function')showToast(`Generated ${added} crates from the current Next PL. Review crate quantities before packing.`,'success');
}
function ppPersistCratePlans(){try{localStorage.setItem(PP_CRATE_PLAN_STATE_KEY,JSON.stringify(ppCratePlans));}catch(e){console.warn('Could not save crate plan locally',e);}}
function ppEditCratePlan(i){
 const r=ppCratePlans[i];if(!r)return;
 const L=prompt('Crate outer length (mm)',r.outerL);if(L===null)return;
 const W=prompt('Crate outer width (mm)',r.outerW);if(W===null)return;
 const H=prompt('Packing height excluding 100 mm legs (mm)',r.packingH);if(H===null)return;
 const B=prompt('Boxes in this crate',r.boxes);if(B===null)return;
 const P=prompt('PCS allocated to this crate',r.pcs);if(P===null)return;
 const oldBoxes=ppNum(r.boxes),oldPcs=ppNum(r.pcs),oldWeight=ppNum(r.weight);
 r.outerL=Math.max(1,ppNum(L)||r.outerL);r.outerW=Math.max(1,ppNum(W)||r.outerW);
 r.boxes=Math.max(0,Math.floor(ppNum(B)));r.pcs=Math.max(0,Math.floor(ppNum(P)));
 r.layers=Math.max(1,Math.ceil(r.boxes/Math.max(1,r.perLayer||1)));
 const boxHeights=(r.boxRows||[]).map(x=>ppDims(x.boxSize)?.h||0).filter(Boolean);
 r.packingH=(r.boxes!==oldBoxes&&boxHeights.length)?r.layers*Math.max(...boxHeights):Math.max(1,ppNum(H)||r.packingH);
 r.overallH=r.packingH+PP_LEG_HEIGHT+2*PP_WOOD_WIDTH;
 const weightPerPc=oldPcs>0?oldWeight/oldPcs:0;r.weight=r.pcs*weightPerPc;r.manual=true;
 ppRenderCratePlan();ppPersistCratePlans();ppShowCrate3D(i);
}
function ppCopyCratePlan(i){
 const src=ppCratePlans[i];if(!src)return;
 const copy=JSON.parse(JSON.stringify(src));copy.id='C-'+String(ppCratePlans.length+1).padStart(2,'0');copy.manual=true;copy.pcs=0;copy.boxes=0;copy.weight=0;copy.length=src.length;copy.groupKey=(src.groupKey||'')+'|COPY|'+Date.now();
 ppCratePlans.splice(i+1,0,copy);ppCratePlans.forEach((r,n)=>{r.id='C-'+String(n+1).padStart(2,'0')});ppRenderCratePlan();ppPersistCratePlans();
 if(typeof showToast==='function')showToast('Copied crate design as an empty crate row. Use Edit to enter boxes and PCS for this crate.','success');
}

function ppRenderCratePlan(){
 const body=document.getElementById('ppCratePlanBody');if(!body)return;
 body.innerHTML=ppCratePlans.length?ppCratePlans.map((r,i)=>`<tr><td>${ppEsc(r.po)}</td><td>${ppEsc(r.profile)}</td><td>${ppEsc(r.itemCode)}</td><td>${ppEsc(r.length)}</td><td>${ppNum(r.pcs).toLocaleString()}</td><td>${r.pcsPerBox}</td><td>${r.boxes}</td><td><button class="btn btn-sm pp-dimension-edit" title="Edit dimensions and capacity" onclick="ppEditCratePlan(${i})">${r.outerL} × ${r.outerW} × ${r.packingH} <i class="fa-solid fa-pen"></i></button></td><td>${r.overallH}</td><td>${ppNum(r.weight).toFixed(1)}</td><td>1</td><td><button class="btn btn-accent" onclick="ppShowCrate3D(${i})"><i class="fa-solid fa-cube"></i> 3D</button></td><td><div class="pp-row-actions"><button class="btn btn-sm" title="Edit crate" onclick="ppEditCratePlan(${i})"><i class="fa-solid fa-pen"></i></button><button class="btn btn-sm" title="Copy crate design" onclick="ppCopyCratePlan(${i})"><i class="fa-solid fa-copy"></i> Copy</button><button class="btn btn-sm" title="Remove crate" onclick="ppRemoveCratePlan(${i})"><i class="fa-solid fa-trash"></i></button></div></td></tr>`).join(''):'<tr><td colspan="13">Select a Next PL line or generate the list from all current Next PL quantities.</td></tr>';
 const totalW=ppCratePlans.reduce((s,r)=>s+ppNum(r.weight),0),totalPcs=ppCratePlans.reduce((s,r)=>s+ppNum(r.pcs),0),note=document.getElementById('ppCrateFitNote');if(note)note.textContent=`${ppCratePlans.length} crate rows · ${totalPcs.toLocaleString()} PCS · estimated profile weight ${totalW.toLocaleString(undefined,{maximumFractionDigits:1})} kg / 18,000 kg target. Edited values stay saved in this browser until edited again.`;
 ppPersistCratePlans();
}

function ppShowCrate3D(i){const r=ppCratePlans[i];if(!r)return;const firstLen=r.lengths?.[0]?.length??r.length;const m=ppCrateMasterRows.find(x=>ppMasterKey(x.profile,x.itemCode,x.length)===ppMasterKey(r.profile,r.itemCode,firstLen));if(m){const c=ppCrateCalc(m);c.outerL=r.outerL;c.outerW=r.outerW;c.packingH=r.packingH;c.overallH=r.overallH;c.perLayer=r.perLayer;c.layers=r.layers;c.boxesPerCrate=r.boxes;ppDrawCratePreview(m,c,r.boxes);}}
function ppRemoveCratePlan(i){ppCratePlans.splice(i,1);ppCratePlans.forEach((r,n)=>r.id='C-'+String(n+1).padStart(2,'0'));ppRenderCratePlan();ppPersistCratePlans();}
function ppExportCratePlan(){
 const head=['Crate No','PO','Profile','Item Code','Length mm','PCS','Pcs/Box','Box Qty','Crate Length mm','Crate Width mm','Packing Height mm','Profile Weight kg'];
 const lines=[head,...ppCratePlans.map(r=>[r.id,r.po,r.profile,r.itemCode,r.length,r.pcs,r.pcsPerBox,r.boxes,r.outerL,r.outerW,r.packingH,r.overallH,r.weight])];
 const csv=lines.map(a=>a.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\r\n'),blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='AIS_Crate_Plan.csv';a.click();URL.revokeObjectURL(url);
}
function ppImportCrateStandards(event){
 const f=event.target.files?.[0];if(!f)return;
 const applyRows=(grid)=>{
  if(!grid?.length)throw new Error('Empty workbook');
  let hi=grid.findIndex(row => row.some(v => /profile/i.test(String(v||'')) && row.some(x => /item\s*code|description/i.test(String(x||'')))));
  if(hi<0)hi=0;
  const headers=(grid[hi]||[]).map(v=>String(v||'').trim().toLowerCase());
  const ix=(...names)=>headers.findIndex(h=>names.some(n=>h.includes(n)));
  const ip=ix('profile'),ii=ix('item code','itemcode','description'),il=ix('cutting length','length'),ib=ix('box size'),iw=ix('crate width');
  if(ip<0||ii<0||ib<0)throw new Error('Expected Profile, Item Code/Description and Box Size columns');
  let lastProfile='';
  const incoming=[];
  grid.slice(hi+1).forEach(cells=>{
   let profile=String(cells[ip]||'').trim();if(profile)lastProfile=profile;else profile=lastProfile;
   const itemCode=String(cells[ii]||'').trim(),boxSize=String(cells[ib]||'').trim();
   if(!profile||!itemCode||!boxSize)return;
   const nums=boxSize.match(/\d+(?:\.\d+)?/g)||[];
   let length=il>=0?ppNum(cells[il]):0;if(!length&&nums.length)length=ppNum(nums[0])-10;
   const crateWidth=iw>=0&&ppNum(cells[iw])?ppNum(cells[iw]):null;
   incoming.push({profile,itemCode,length,boxSize,crateWidth});
  });
  const widths={};incoming.forEach(r=>{if(r.crateWidth)(widths[r.profile]??=[]).push(r.crateWidth);});
  incoming.forEach(r=>{if(!r.crateWidth&&widths[r.profile]?.length){const vals=widths[r.profile],cnt={};vals.forEach(v=>cnt[v]=(cnt[v]||0)+1);r.crateWidth=+Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0][0];}});
  ppUploadedExcelRows=incoming;
  incoming.forEach(x=>{const r=ppCrateMasterRows.find(r=>ppMasterKey(r.profile,r.itemCode,r.length)===ppMasterKey(x.profile,x.itemCode,x.length));if(r){r.boxSize=x.boxSize;if(x.crateWidth)r.crateWidth=x.crateWidth;r.excelMatched=true;r.source='Uploaded AIS Excel';}});
  ppBuildCrateMaster(false);
  if(typeof showToast==='function')showToast(`Imported ${incoming.length} AIS box-size rows. Review missing values, then Save Crate Master.`,'success');
 };
 const reader=new FileReader();
 if(/\.(xlsx|xls)$/i.test(f.name)){
  reader.onload=()=>{try{if(typeof XLSX==='undefined')throw new Error('Excel reader library is unavailable');const wb=XLSX.read(reader.result,{type:'array'});const ws=wb.Sheets[wb.SheetNames[0]];applyRows(XLSX.utils.sheet_to_json(ws,{header:1,defval:''}));}catch(e){alert('Could not read Excel file: '+e.message);}};
  reader.readAsArrayBuffer(f);
 }else{
  reader.onload=()=>{try{const grid=String(reader.result||'').split(/\r?\n/).filter(Boolean).map(line=>line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)|\t/).map(x=>x.replace(/^"|"$/g,'').trim()));applyRows(grid);}catch(e){alert('Could not read file: '+e.message);}};
  reader.readAsText(f);
 }
 event.target.value='';
}
function ppSwitchSubtab(id,button){
 document.querySelectorAll('#packingPlannerTab .pp-subtab-content').forEach(x=>x.classList.remove('active'));
 document.querySelectorAll('#packingPlannerTab .pp-subtab').forEach(x=>x.classList.remove('active'));
 document.getElementById(id)?.classList.add('active');button?.classList.add('active');
 if(id==='ppCrateMasterSubTab')ppRenderCrateMaster();
 if(id==='ppCrateSubTab')ppRefreshNextPlLines();
}
function ppOnBoxSelect(){const k=document.getElementById('ppBoxSelect')?.value;const r=ppCrateMasterRows.find(x=>ppMasterKey(x.profile,x.itemCode,x.length)===k);if(r)ppDrawCratePreview(r,ppCrateCalc(r));}
function ppSyncCrateDimensions(){ppCalculateCrate();}
function ppCalculateCrate(){
 const i=Number(document.getElementById('ppNextPlLine')?.value),r=ppCrateNextRows[i];if(r){const m=ppCrateMasterRows.find(x=>ppMasterKey(x.profile,x.itemCode,x.length)===ppMasterKey(r.profile,r.itemCode,r.length));if(m){ppDrawCratePreview(m,ppCrateCalc(m));return;}}
}
function ppSetContainerDefaults(){ppCalculateContainer();}
function ppCalculateContainer(){
 const cap=document.getElementById('ppContainerCapacity');if(cap)cap.textContent='—';
 const vis=document.getElementById('ppContainerVisual');if(vis)vis.innerHTML='<div class="pp-empty">Container loading is the next development stage, after crate dimensions are confirmed.</div>';
}
function ppExportPackingPlan(){ppExportCratePlan();}
function ppImportBoxExcel(event){ppImportCrateStandards(event);}
function ppRenderCatalog(){
 const body=document.getElementById('ppCatalogBody');if(!body)return;
 const rows=ppCrateMasterRows.filter(r=>[r.profile,r.itemCode,r.length,r.boxSize].join(' ').toLowerCase().includes((document.getElementById('ppCatalogSearch')?.value||'').toLowerCase()));
 body.innerHTML=rows.map(r=>`<tr><td>${ppEsc(r.profile)}</td><td>${ppEsc(r.itemCode)}</td><td>${r.length}</td><td>${ppEsc(r.boxSize||'—')}</td><td>${r.excelMatched?'Excel matched':'Manual data needed'}</td><td><button class="btn" onclick="ppEditCrateMaster('${encodeURIComponent(ppMasterKey(r.profile,r.itemCode,r.length))}')">Edit</button></td></tr>`).join('');
 const a=document.getElementById('ppCatalogCount');if(a)a.textContent=rows.length;
}
function ppSaveCatalog(){ppSaveCrateMaster();}
function ppExportBoxCatalog(){ppExportCrateMaster();}
(function ppWrapDataSync(){
 const original=window.loadDataFromSupabase;
 if(typeof original==='function'&&!original.__ppWrapped){
  const wrapped=function(...args){const result=original.apply(this,args);Promise.resolve(result).finally(()=>{setTimeout(()=>{ppLoadCrateMasterSaved();ppRefreshNextPlLines();},400);});return result;};
  wrapped.__ppWrapped=true;window.loadDataFromSupabase=wrapped;
 }
})();
document.addEventListener('DOMContentLoaded',()=>{
 try{ppLoadCrateMasterSaved();ppRefreshNextPlLines();const savedPlan=JSON.parse(localStorage.getItem(PP_CRATE_PLAN_STATE_KEY)||'[]');if(Array.isArray(savedPlan)){ppCratePlans=savedPlan;ppRenderCratePlan();}}
 catch(e){console.warn('AIS crate planner initialization:',e);}
});



/* AIS Packing Planner rebuild: three-tab workflow driven by current Next Planning PL */
let ppSmartCrates = [];
const PP_SMART_STATE_KEY = 'AIS_SMART_CRATE_PLAN_V1';
function ppSmartLineKey(r){return [r.poNumber,ppNormalizeProfile(r.profile),String(r.itemCode||'').toUpperCase().replace(/\s+/g,''),ppNormalizeLength(r.length)].join('|');}
function ppSmartGetAllocations(){const map={};ppSmartCrates.forEach(c=>(c.items||[]).forEach(it=>{const k=it.lineKey;map[k]=(map[k]||0)+ppNum(it.pcs);}));return map;}
function ppSmartSelectedLine(){const i=Number(document.getElementById('ppNextPlLine')?.value);return ppCrateNextRows[i]||null;}
function ppSmartMasterFor(r){return ppCrateMasterRows.find(x=>ppMasterKey(x.profile,x.itemCode,x.length)===ppMasterKey(r.profile,r.itemCode,r.length));}
function ppSmartPcsBox(r){const m=ppSmartMasterFor(r);return Math.max(1,ppNum(m?.pcsPerBox)||ppNum(r.master?.boxCapacity)||1);}
function ppSmartFillCrateNumbers(){const s=document.getElementById('ppSmartCrateNo');if(!s)return;const old=s.value;s.innerHTML=Array.from({length:60},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('');if(old)s.value=old;}
function ppSmartRefresh(){ppRefreshNextPlLines();ppSmartRenderCrateList();ppSmartUpdateAllocationPreview();}
function ppOnNextPlLineChange(){
 const i=Number(document.getElementById('ppNextPlLine')?.value),r=ppCrateNextRows[i];if(!r)return;
 const set=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v??'';};
 set('ppPlanPo',r.poNumber);set('ppPlanProfile',r.profile);set('ppPlanItemCode',r.itemCode);set('ppPlanLength',r.length);set('ppPlanQty',r.planningQty);
 const m=ppSmartMasterFor(r),cap=ppSmartPcsBox(r);set('ppPlanPcsPerBox',cap);set('ppPlanBoxQty',Math.ceil(ppNum(r.planningQty)/cap));
 const c=m?ppCrateCalc(m):null;
 set('ppOuterCrateL',m?.manualOuterL||c?.outerL||'');set('ppOuterCrateW',m?.crateWidth||c?.outerW||'');set('ppCrateH',m?.manualPackingH||'');
 ppSmartUpdateAllocationPreview();
}
function ppSmartUpdateAllocationPreview(){const r=ppSmartSelectedLine();const pcs=ppNum(document.getElementById('ppSmartAllocatePcs')?.value);const pbox=r?ppSmartPcsBox(r):1;const b=document.getElementById('ppSmartAllocateBoxes');if(b)b.value=pcs>0?Math.ceil(pcs/pbox):'';const balance=document.getElementById('ppSmartRemainingPcs');if(balance){const alloc=ppSmartGetAllocations();balance.textContent=ppCrateNextRows.reduce((s,x)=>s+Math.max(0,ppNum(x.planningQty)-(alloc[ppSmartLineKey(x)]||0)),0).toLocaleString();}}
function ppSmartDimensionChanged(){const r=ppSmartSelectedLine();if(!r)return;const pcs=ppNum(document.getElementById('ppSmartAllocatePcs')?.value),m=ppSmartMasterFor(r),box=ppDims(m?.boxSize);if(!box)return;const width=ppNum(document.getElementById('ppOuterCrateW')?.value)||ppNum(m?.crateWidth);const innerW=Math.max(0,width-40);const per=Math.max(1,Math.floor(innerW/box.w));const boxes=Math.ceil(pcs/ppSmartPcsBox(r));const layers=Math.max(1,Math.ceil(boxes/per));const h=layers*box.h;const hEl=document.getElementById('ppCrateH');if(hEl&&!hEl.matches(':focus'))hEl.value=h;ppSmartUpdateAllocationPreview();}
function ppSmartCalcDims(items,manual={}){
 const masters=items.map(it=>ppSmartMasterFor({profile:it.profile,itemCode:it.itemCode,length:it.length})).filter(Boolean),dims=masters.map(m=>ppDims(m.boxSize)).filter(Boolean);if(!dims.length)return {valid:false};
 const width=ppNum(manual.outerW)||Math.max(...masters.map(m=>ppNum(m.crateWidth)).filter(Boolean));if(!width)return {valid:false};
 const innerW=Math.max(1,width-40),maxBoxW=Math.max(...dims.map(d=>d.w));if(maxBoxW>innerW)return {valid:false,reason:'Box width exceeds the crate internal width'};const perLayer=Math.max(1,Math.floor(innerW/maxBoxW));
 const boxes=items.reduce((s,it)=>s+Math.ceil(ppNum(it.pcs)/Math.max(1,ppNum(it.pcsPerBox))),0);
 const layers=Math.max(1,Math.ceil(boxes/perLayer)),packingH=ppNum(manual.packingH)||layers*Math.max(...dims.map(d=>d.h));
 const outerL=ppNum(manual.outerL)||Math.ceil(Math.max(...items.map(it=>ppNum(it.length)||0))+32),overallH=packingH+100+2*96;
 return {valid:true,outerL,outerW:width,packingH,overallH,perLayer,layers,boxes};
}
function ppSmartAddCrateFromSelected(){
 const r=ppSmartSelectedLine();if(!r){alert('Select a Next Planning PL line first.');return;}
 const master=ppSmartMasterFor(r),box=ppDims(master?.boxSize);if(!master||!box||!ppNum(master.crateWidth)){alert('This profile/length needs Box Size and Crate Width in tab 3 before allocating PCS.');return;}
 let pcs=Math.floor(ppNum(document.getElementById('ppSmartAllocatePcs')?.value));if(pcs<1){alert('Enter PCS to allocate to this crate.');return;}
 const allocations=ppSmartGetAllocations(),balance=Math.max(0,ppNum(r.planningQty)-(allocations[ppSmartLineKey(r)]||0));if(pcs>balance){alert(`Only ${balance.toLocaleString()} PCS remain for this PO/profile/item/length.`);return;}
 const n=Math.max(1,Math.min(60,Math.floor(ppNum(document.getElementById('ppSmartCrateNo')?.value)||1))),roman=document.getElementById('ppSmartRoman')?.value||'I',id=`C-${String(n).padStart(2,'0')}-${roman}`;
 let crate=ppSmartCrates.find(c=>c.id===id);if(crate){if(!confirm(`Crate ${id} already exists. Add this profile/length to the same crate?`))return;}else{crate={id,items:[],manual:{outerL:ppNum(document.getElementById('ppOuterCrateL')?.value),outerW:ppNum(document.getElementById('ppOuterCrateW')?.value)||ppNum(master.crateWidth),packingH:0,orientation:document.getElementById('ppBoxOrientation')?.value||master.orientation||'auto'},createdAt:Date.now()};}
 const pcsPerBox=ppSmartPcsBox(r),requestedPcs=pcs;
 const makeItem=q=>({lineKey:ppSmartLineKey(r),po:r.poNumber,profile:r.profile,itemCode:r.itemCode,length:r.length,pcs:q,pcsPerBox,boxes:Math.ceil(q/pcsPerBox),unitWeight:ppNum(r.unitWeight||master.unitWeight)});
 let newItem=makeItem(pcs),testCalc=ppSmartCalcDims([...(crate.items||[]),newItem],{...(crate.manual||{}),packingH:0,orientation:document.getElementById('ppBoxOrientation')?.value||crate.manual?.orientation||master.orientation||'auto'});
 if(!testCalc.valid){
   const maxBoxes=Math.max(0,Math.floor(ppNum(testCalc.maxCapacity))-((crate.items||[]).reduce((sum,it)=>sum+ppNum(it.boxes),0)));
   const maxPcs=maxBoxes*pcsPerBox;
   if(maxPcs<1){alert((testCalc.reason||'This crate is full.')+' Create another crate for the remaining PCS.');return;}
   if(!confirm(`This crate can fit only ${maxBoxes} additional boxes (${maxPcs} PCS) within the 1100 mm packing-height limit. Reduce this crate allocation from ${requestedPcs} to ${Math.min(requestedPcs,maxPcs)} PCS and keep the rest for another crate?`))return;
   pcs=Math.min(requestedPcs,maxPcs);newItem=makeItem(pcs);testCalc=ppSmartCalcDims([...(crate.items||[]),newItem],{...(crate.manual||{}),packingH:0,orientation:document.getElementById('ppBoxOrientation')?.value||crate.manual?.orientation||master.orientation||'auto'});
   if(!testCalc.valid){alert(testCalc.reason||'Could not calculate a safe crate layout.');return;}
 }
 if(testCalc.packingH>PP_MAX_PACKING_HEIGHT){alert(`This allocation needs ${testCalc.packingH} mm packing height, above the ${PP_MAX_PACKING_HEIGHT} mm limit. Reduce PCS or use another crate.`);return;}
 if(!ppSmartCrates.includes(crate))ppSmartCrates.push(crate);
 crate.items.push(newItem);Object.assign(crate,{outerL:testCalc.outerL,outerW:testCalc.outerW,packingH:testCalc.packingH,overallH:testCalc.overallH,perLayer:testCalc.per,layers:testCalc.layers,boxes:testCalc.boxes,orientation:testCalc.orientation,manual:{...(crate.manual||{}),outerL:testCalc.outerL,outerW:testCalc.outerW,packingH:0,orientation:testCalc.orientation}});
 ppSmartPersist();ppSmartRenderCrateList();ppSmartUpdateAllocationPreview();ppSmartRefreshPreviewOptions();
 const next=document.getElementById('ppSmartCrateNo');if(next)next.value=String(Math.min(60,n+1));const pcsInput=document.getElementById('ppSmartAllocatePcs');if(pcsInput)pcsInput.value='';ppSmartUpdateAllocationPreview();
 if(pcs<requestedPcs&&typeof showToast==='function')showToast(`${pcs} PCS added to ${id}; ${requestedPcs-pcs} PCS remain for another crate.`,'warning');
 ppSmartShowPreview(ppSmartCrates.indexOf(crate));
}
function ppSmartAddProfileToCrate(i){
 const c=ppSmartCrates[i];if(!c)return;
 const options=ppCrateNextRows.map((r,n)=>`${n}: ${r.poNumber} / ${r.profile} / ${r.itemCode} / ${r.length} mm`).join('\n');
 const raw=prompt('Enter Next PL line number to add as another profile/length:\n'+options,'0');if(raw===null)return;
 const r=ppCrateNextRows[Math.floor(ppNum(raw))];if(!r){alert('Invalid Next PL line number.');return;}
 const alloc=ppSmartGetAllocations(),balance=Math.max(0,ppNum(r.planningQty)-(alloc[ppSmartLineKey(r)]||0));if(!balance){alert('No PCS remaining for this line.');return;}
 let pcs=Math.floor(ppNum(prompt(`PCS to add (remaining ${balance})`,String(balance))));if(pcs<1||pcs>balance){alert(`Enter PCS from 1 to ${balance}.`);return;}
 const m=ppSmartMasterFor(r);if(!ppDims(m?.boxSize)||!ppNum(m?.crateWidth)){alert('Add box size and crate width in Crate Master first.');return;}
 const pbox=ppSmartPcsBox(r),mk=q=>({lineKey:ppSmartLineKey(r),po:r.poNumber,profile:r.profile,itemCode:r.itemCode,length:r.length,pcs:q,pcsPerBox:pbox,boxes:Math.ceil(q/pbox),unitWeight:ppNum(r.unitWeight||m.unitWeight)});
 let item=mk(pcs),calc=ppSmartCalcDims([...(c.items||[]),item],{...(c.manual||{}),packingH:0,orientation:c.orientation||c.manual?.orientation||m.orientation||'auto'});
 if(!calc.valid){const maxBoxes=Math.max(0,Math.floor(ppNum(calc.maxCapacity))-(c.items||[]).reduce((a,x)=>a+ppNum(x.boxes),0)),maxPcs=maxBoxes*pbox;if(maxPcs<1){alert('This crate has no safe capacity left. Use another crate.');return;}if(!confirm(`Only ${maxBoxes} boxes (${maxPcs} PCS) can be added within the 1200 mm height limit. Reduce this addition to ${Math.min(pcs,maxPcs)} PCS?`))return;pcs=Math.min(pcs,maxPcs);item=mk(pcs);calc=ppSmartCalcDims([...(c.items||[]),item],{...(c.manual||{}),packingH:0,orientation:c.orientation||c.manual?.orientation||m.orientation||'auto'});if(!calc.valid){alert(calc.reason||'This profile does not fit safely.');return;}}
 c.items.push(item);Object.assign(c,{outerL:calc.outerL,outerW:calc.outerW,packingH:calc.packingH,overallH:calc.overallH,perLayer:calc.per,layers:calc.layers,boxes:calc.boxes,orientation:calc.orientation,manual:{...(c.manual||{}),outerL:calc.outerL,outerW:calc.outerW,packingH:0,orientation:calc.orientation}});ppSmartPersist();ppSmartRenderCrateList();ppSmartUpdateAllocationPreview();ppSmartRefreshPreviewOptions();ppSmartShowPreview(i);
}
function ppSmartEditPcs(i){const c=ppSmartCrates[i];if(!c)return;const allocations=ppSmartGetAllocations();for(const it of (c.items||[])){const r=ppCrateNextRows.find(x=>ppSmartLineKey(x)===it.lineKey);const balance=r?Math.max(0,ppNum(r.planningQty)-(allocations[it.lineKey]||0)+ppNum(it.pcs)):ppNum(it.pcs);const next=prompt(`${it.po} / ${it.profile} / ${it.itemCode} / ${it.length} mm — PCS (max ${balance})`,String(it.pcs));if(next===null)return;const qty=Math.floor(ppNum(next));if(qty<0||qty>balance){alert(`Enter PCS from 0 to ${balance}.`);return;}it.pcs=qty;it.boxes=Math.ceil(qty/Math.max(1,ppNum(it.pcsPerBox)));}c.items=(c.items||[]).filter(it=>ppNum(it.pcs)>0);const calc=ppSmartCalcDims(c.items,c.manual&&typeof c.manual==='object'?c.manual:{});if(calc.valid)Object.assign(c,calc);ppSmartPersist();ppSmartRenderCrateList();ppSmartUpdateAllocationPreview();ppSmartRefreshPreviewOptions();}
function ppSmartEditCrate(i){const c=ppSmartCrates[i];if(!c)return;const l=prompt('Crate outer length (mm)',c.outerL||'');if(l===null)return;const w=prompt('Crate outer width (mm)',c.outerW||'');if(w===null)return;const h=prompt('Packing height from box layers (mm)',c.packingH||'');if(h===null)return;c.manual={outerL:Math.max(1,ppNum(l)),outerW:Math.max(1,ppNum(w)),packingH:Math.max(1,ppNum(h))};const calc=ppSmartCalcDims(c.items,c.manual);Object.assign(c,calc);c.manual=true;ppSmartPersist();ppSmartRenderCrateList();ppSmartRefreshPreviewOptions();ppSmartShowPreview(i);}
function ppSmartCopyCrate(i){const src=ppSmartCrates[i];if(!src)return;const copy=JSON.parse(JSON.stringify(src));const used=new Set(ppSmartCrates.map(c=>c.id));let n=1;while(n<=60&&used.has(`C-${String(n).padStart(2,'0')}-I`))n++;if(n>60){alert('All crate numbers 1–60 are used.');return;}copy.id=`C-${String(n).padStart(2,'0')}-I`;copy.items=[];copy.createdAt=Date.now();ppSmartCrates.push(copy);ppSmartPersist();ppSmartRenderCrateList();ppSmartRefreshPreviewOptions();}
function ppSmartRemoveCrate(i){if(!confirm('Remove this crate and return its PCS to the Next PL remaining balance?'))return;ppSmartCrates.splice(i,1);ppSmartPersist();ppSmartRenderCrateList();ppSmartUpdateAllocationPreview();ppSmartRefreshPreviewOptions();}
function ppSmartRenderCrateList(){const body=document.getElementById('ppCratePlanBody');if(!body)return;body.innerHTML=ppSmartCrates.length?ppSmartCrates.map((c,i)=>{const items=c.items||[],pcs=items.reduce((s,x)=>s+ppNum(x.pcs),0),boxes=items.reduce((s,x)=>s+ppNum(x.boxes),0),weight=items.reduce((s,x)=>s+ppNum(x.pcs)*ppNum(x.unitWeight),0);return `<tr><td><b>${ppEsc(c.id)}</b></td><td>${ppEsc([...new Set(items.map(x=>x.po))].join(', '))}</td><td>${ppEsc([...new Set(items.map(x=>x.profile))].join(' / '))}</td><td>${ppEsc([...new Set(items.map(x=>x.itemCode))].join(' / '))}</td><td>${ppEsc([...new Set(items.map(x=>x.length))].join(' / '))}</td><td>${pcs.toLocaleString()}</td><td>${items.map(x=>x.pcsPerBox).join(' / ')}</td><td>${boxes.toLocaleString()}</td><td><button class="btn btn-sm pp-dimension-edit" onclick="ppSmartEditCrate(${i})">${c.outerL||'—'} × ${c.outerW||'—'} × ${c.packingH||'—'} <i class="fa-solid fa-pen"></i></button></td><td>${c.overallH||'—'}</td><td>${weight.toFixed(1)}</td><td><button class="btn btn-accent" onclick="ppSmartShowPreview(${i})">2D/3D</button></td><td><div class="pp-row-actions"><button class="btn btn-sm" onclick="ppSmartAddProfileToCrate(${i})">+ Profile</button><button class="btn btn-sm" onclick="ppSmartEditPcs(${i})">Edit PCS</button><button class="btn btn-sm" onclick="ppSmartCopyCrate(${i})">Copy</button><button class="btn btn-sm" onclick="ppSmartEditCrate(${i})">Edit</button><button class="btn btn-sm" onclick="ppSmartRemoveCrate(${i})">Remove</button></div></td></tr>`;}).join(''):'<tr><td colspan="13">No crates yet. Select a Next PL line and allocate PCS.</td></tr>';
 const pcs=ppSmartCrates.reduce((s,c)=>s+(c.items||[]).reduce((a,x)=>a+ppNum(x.pcs),0),0),weight=ppSmartCrates.reduce((s,c)=>s+(c.items||[]).reduce((a,x)=>a+ppNum(x.pcs)*ppNum(x.unitWeight),0),0);const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};set('ppSmartCrateCount',ppSmartCrates.length);set('ppSmartAllocatedPcs',pcs.toLocaleString());set('ppSmartTotalWeight',weight.toLocaleString(undefined,{maximumFractionDigits:1})+' kg');ppSmartRefreshPreviewOptions();}
let ppSmartSaveTimer=null,ppSmartCloudSaving=false,ppSmartPendingCloudPayload=null;
function ppSmartPersist(){
 const payload=JSON.stringify(ppSmartCrates);
 try{localStorage.setItem(PP_SMART_STATE_KEY,payload);}catch(e){console.warn('Could not save crate plan locally',e);}
 ppSmartPendingCloudPayload=payload;
 if(ppSmartSaveTimer)clearTimeout(ppSmartSaveTimer);
 ppSmartSaveTimer=setTimeout(()=>ppSmartSaveCloud(),500);
}
async function ppSmartSaveCloud(explicitPayload){
 if(explicitPayload){ppSmartPendingCloudPayload=explicitPayload;if(ppSmartSaveTimer){clearTimeout(ppSmartSaveTimer);ppSmartSaveTimer=null;}}
 if(ppSmartCloudSaving)return;
 const payload=ppSmartPendingCloudPayload;if(payload==null)return;
 ppSmartPendingCloudPayload=null;ppSmartCloudSaving=true;
 try{
  if(typeof supabaseClient==='undefined'||!supabaseClient||!Array.isArray(dailyInstructionsList)||!currentUserRole){ppSmartPendingCloudPayload=payload;return;}
  const target='AIS_CRATE_PLAN_V1';
  const existing=dailyInstructionsList.find(x=>String(x.target_user||'')===target);
  if(existing){const {error}=await supabaseClient.from('daily_instructions').update({message:payload}).eq('id',existing.id);if(error)throw error;existing.message=payload;}
  else{const rec={target_date:new Date().toISOString().slice(0,10),target_user:target,priority:'Normal',message:payload,status:'Completed',action_taken:'AIS Crate Packing Plan'};const {data,error}=await supabaseClient.from('daily_instructions').insert([rec]).select().single();if(error)throw error;dailyInstructionsList.push({...rec,id:data?.id||-Date.now()});}
  if(typeof showToast==='function')showToast('Crate list saved to cloud.','success');
 }catch(e){console.error('Crate plan cloud save failed',e);ppSmartPendingCloudPayload=payload;if(typeof showToast==='function')showToast('Browser backup saved, but cloud save failed. Check database permissions.','error');}
 finally{ppSmartCloudSaving=false;if(ppSmartPendingCloudPayload&&ppSmartPendingCloudPayload!==payload){if(ppSmartSaveTimer)clearTimeout(ppSmartSaveTimer);ppSmartSaveTimer=setTimeout(()=>ppSmartSaveCloud(),400);}}
}
function ppSmartSaveNow(){ppSmartPersist();return ppSmartSaveCloud(JSON.stringify(ppSmartCrates));}

function ppSmartLoadSaved(){
 try{const db=(dailyInstructionsList||[]).find(x=>String(x.target_user||'')==='AIS_CRATE_PLAN_V1');const cloud=db?.message?JSON.parse(db.message):null;if(Array.isArray(cloud)){ppSmartCrates=cloud;localStorage.setItem(PP_SMART_STATE_KEY,JSON.stringify(cloud));return;}}catch(e){console.warn('Could not load cloud crate plan',e);}
 try{const local=JSON.parse(localStorage.getItem(PP_SMART_STATE_KEY)||'[]');if(Array.isArray(local))ppSmartCrates=local;}catch(e){}
}
function ppSmartRefreshPreviewOptions(){const s=document.getElementById('ppSmartPreviewCrate');if(!s)return;const old=s.value;s.innerHTML='<option value="">Select a crate</option>'+ppSmartCrates.map((c,i)=>`<option value="${i}">${ppEsc(c.id)} — ${ppEsc([...new Set((c.items||[]).map(x=>x.profile+' / '+x.length+'mm'))].join(', '))}</option>`).join('');if(old!==''&&Number(old)<ppSmartCrates.length)s.value=old;}
function ppSmartShowSelectedPreview(){const i=Number(document.getElementById('ppSmartPreviewCrate')?.value);if(Number.isInteger(i)&&ppSmartCrates[i])ppSmartShowPreview(i);}
function ppSmartShowPreview(i){const c=ppSmartCrates[i];if(!c)return;const mode=document.getElementById('ppSmartViewMode')?.value||'3d',host=document.getElementById('ppCrate3DPreview');if(!host)return;const items=c.items||[],maxW=Math.max(1,ppNum(c.outerW)-40),maxL=Math.max(1,ppNum(c.outerL)-40),boxList=items.map(it=>({it,m:ppSmartMasterFor(it),d:ppDims(ppSmartMasterFor(it)?.boxSize)})).filter(x=>x.d);if(!boxList.length){host.innerHTML='<div class="pp-empty">Box size missing for this crate. Update tab 3 first.</div>';return;}const totalBoxes=items.reduce((s,x)=>s+ppNum(x.boxes),0),maxBoxW=Math.max(...boxList.map(x=>x.d.w)),per=Math.max(1,Math.floor(maxW/maxBoxW)),layers=Math.max(1,Math.ceil(totalBoxes/per)),boxH=Math.max(...boxList.map(x=>x.d.h)),packH=ppNum(c.packingH)||layers*boxH;let svg='';
 if(mode==='top'){let rects='',n=0;items.forEach((it,idx)=>{const m=ppSmartMasterFor(it),d=ppDims(m?.boxSize);if(!d)return;for(let b=0;b<ppNum(it.boxes)&&n<90;b++,n++){const col=n%per,row=Math.floor(n/per),bw=Math.max(20,Math.min(105,720/per-3)),bh=Math.max(18,Math.min(45,500/Math.max(1,layers)-3));rects+=`<rect x="${45+col*(720/per)}" y="${55+row*(500/Math.max(1,layers))}" width="${bw}" height="${bh}" rx="3" fill="${idx%2?'#c9a16b':'#e7c99a'}" stroke="#8b6334"/><text x="${45+col*(720/per)+4}" y="${55+row*(500/Math.max(1,layers))+bh/2+4}" font-size="10" fill="#4b3420">${ppEsc(it.profile)}</text>`;}});svg=`<svg viewBox="0 0 820 620"><rect x="25" y="25" width="770" height="560" rx="8" fill="#f4e3c2" stroke="#84572c" stroke-width="8"/>${rects}<text x="30" y="610" font-size="18" font-weight="700" fill="#164e63">Top view · ${c.outerL} × ${c.outerW} mm · Box length runs along crate length</text></svg>`;
 }else if(mode==='side'){let rects='',n=0;items.forEach((it,idx)=>{const d=ppDims(ppSmartMasterFor(it)?.boxSize);if(!d)return;for(let b=0;b<ppNum(it.boxes)&&n<90;b++,n++){const col=n%per,row=Math.floor(n/per),bw=730/per,bh=470/Math.max(1,layers);rects+=`<rect x="${40+col*bw}" y="${45+row*bh}" width="${bw-3}" height="${bh-3}" fill="${idx%2?'#c9a16b':'#e7c99a'}" stroke="#8b6334"/>`;}});svg=`<svg viewBox="0 0 820 620"><rect x="25" y="25" width="770" height="560" rx="6" fill="#e8cda0" stroke="#84572c" stroke-width="8"/>${rects}<rect x="35" y="550" width="60" height="55" fill="#a97842"/><rect x="725" y="550" width="60" height="55" fill="#a97842"/><text x="30" y="615" font-size="18" font-weight="700" fill="#164e63">Side view · Packing height ${packH} mm + 100 mm legs</text></svg>`;
 }else{const L=500,W=190,H=Math.max(60,Math.min(250,packH/4)),dx=120,dy=65,x=90,y=150;let boxesSvg='';let n=0;for(let row=0;row<layers&&n<36;row++){for(let col=0;col<per&&n<totalBoxes&&n<36;col++,n++){const bx=x+col*(L/per),by=y-row*(H/layers);boxesSvg+=`<polygon points="${bx},${by} ${bx+L/per-5},${by-20} ${bx+L/per-5+dx/per},${by-20-dy/per} ${bx+dx/per},${by-dy/per}" fill="${n%2?'#d9b17c':'#e8cda0'}" stroke="#8b6334"/><polygon points="${bx},${by} ${bx+dx/per},${by-dy/per} ${bx+dx/per},${by-dy/per+H/layers} ${bx},${by+H/layers}" fill="#b8874d" stroke="#8b6334"/><polygon points="${bx},${by+H/layers} ${bx+L/per-5},${by+H/layers-20} ${bx+L/per-5},${by-20+H/layers} ${bx},${by+H/layers}" fill="#c99a60" stroke="#8b6334"/>`;}}svg=`<svg viewBox="0 0 820 620"><polygon points="${x},${y} ${x+L},${y-20} ${x+L+dx},${y-20-dy} ${x+dx},${y-dy}" fill="#f1dfbc" stroke="#754b26" stroke-width="6"/><polygon points="${x},${y} ${x+dx},${y-dy} ${x+dx},${y-dy+H} ${x},${y+H}" fill="#bc8749" stroke="#754b26" stroke-width="6"/><polygon points="${x},${y+H} ${x+L},${y+H-20} ${x+L},${y-20+H} ${x},${y+H}" fill="#c18b4e" stroke="#754b26" stroke-width="6"/>${boxesSvg}<g fill="#9c6b37" stroke="#70451f" stroke-width="3"><rect x="${x+20}" y="${y+H+3}" width="24" height="65"/><rect x="${x+L-35}" y="${y+H-10}" width="24" height="65"/><rect x="${x+dx+5}" y="${y-dy+H-10}" width="24" height="65"/></g><text x="30" y="575" font-size="18" font-weight="700" fill="#164e63">${ppEsc(c.id)} · L ${c.outerL} × W ${c.outerW} × Packing H ${packH} mm</text><text x="30" y="602" font-size="15" fill="#164e63">${totalBoxes} boxes · ${items.reduce((s,x)=>s+ppNum(x.pcs),0).toLocaleString()} PCS · ${layers} layers</text></svg>`;}
 host.innerHTML=svg;const info=document.getElementById('ppCrate3DInfo');if(info)info.innerHTML=`<b>${ppEsc(c.id)}</b> · ${items.map(x=>`${ppEsc(x.po)} / ${ppEsc(x.profile)} / ${ppEsc(x.itemCode)} / ${ppEsc(x.length)} mm: ${ppNum(x.pcs).toLocaleString()} PCS (${x.boxes} boxes)`).join('<br>')}<br><b>Dimensions:</b> ${c.outerL||'—'} × ${c.outerW||'—'} × ${packH} mm packing area; overall height ${c.overallH||packH+PP_LEG_HEIGHT} mm including 100 mm legs.<br><b>Arrangement:</b> about ${per} boxes per layer × ${layers} layers.`;
 const sel=document.getElementById('ppSmartPreviewCrate');if(sel)sel.value=String(i);
}
function ppSmartRenderContainer(){const host=document.getElementById('ppContainerVisual');if(!host)return;if(!ppSmartCrates.length){host.innerHTML='<div class="pp-empty">Generate crate records first to preview the container layout.</div>';return;}const cols=Math.max(1,Math.min(6,Math.floor(ppNum(document.getElementById('ppSmartContainerCols')?.value)||2))),rows=Math.max(1,Math.min(20,Math.floor(ppNum(document.getElementById('ppSmartContainerRows')?.value)||8))),items=ppSmartCrates.slice(0,cols*rows);let cells='';items.forEach((c,i)=>{const col=i%cols,row=Math.floor(i/cols),x=30+col*(720/cols),y=35+row*(500/rows),w=690/cols,h=470/rows;cells+=`<rect x="${x}" y="${y}" width="${w-8}" height="${h-8}" rx="5" fill="${i%2?'#c6d9e8':'#b8d8d2'}" stroke="#356477" stroke-width="2"/><text x="${x+8}" y="${y+20}" font-size="${Math.min(16,Math.max(9,160/cols))}" font-weight="700" fill="#12364d">${ppEsc(c.id)}</text><text x="${x+8}" y="${y+38}" font-size="${Math.min(12,130/cols)}" fill="#12364d">${(c.items||[]).reduce((s,it)=>s+ppNum(it.pcs),0).toLocaleString()} PCS</text>`;});host.innerHTML=`<svg viewBox="0 0 780 590"><rect x="12" y="12" width="756" height="560" rx="12" fill="#e8f1f7" stroke="#52758b" stroke-width="8"/>${cells}<text x="25" y="585" font-size="15" font-weight="700" fill="#164e63">Schematic top-down loading plan · ${items.length} of ${ppSmartCrates.length} crates shown · not a certified loading diagram</text></svg>`;const total=items.reduce((s,c)=>s+(c.items||[]).reduce((a,it)=>a+ppNum(it.pcs)*ppNum(it.unitWeight),0),0);const cap=document.getElementById('ppContainerCapacity');if(cap)cap.innerHTML=`Showing <b>${items.length}</b> crates in ${rows} rows × ${cols} across. Estimated profile weight <b>${total.toLocaleString(undefined,{maximumFractionDigits:1})} kg</b> (crate tare weight not included). Confirm internal dimensions, door clearance and payload before loading.`;}
function ppSmartExport(){const rows=[['Crate No','PO','Profile','Item Code','Length mm','PCS','Pcs per Box','Box Qty','Crate Length mm','Crate Width mm','Packing Height mm','Overall Height mm']];ppSmartCrates.forEach(c=>(c.items||[]).forEach(it=>rows.push([c.id,it.po,it.profile,it.itemCode,it.length,it.pcs,it.pcsPerBox,it.boxes,c.outerL,c.outerW,c.packingH])));const csv=rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n'),blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='AIS_Next_PL_Crate_List.csv';a.click();URL.revokeObjectURL(url);}
function ppRenderCrateMaster(){
 const body=document.getElementById('ppCrateMasterBody');if(!body)return;const q=(document.getElementById('ppCrateMasterSearch')?.value||'').toLowerCase();const rows=ppCrateMasterRows.filter(r=>[r.profile,r.itemCode,r.length,r.boxSize,r.crateWidth].join(' ').toLowerCase().includes(q));const matched=ppCrateMasterRows.filter(r=>r.excelMatched).length,missing=ppCrateMasterRows.filter(r=>!r.boxSize||!r.crateWidth||!ppCrateCalc(r).valid).length;const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};set('ppCrateMasterCount',ppCrateMasterRows.length);set('ppCrateMasterMatched',matched);set('ppCrateMasterMissing',missing);
 body.innerHTML=rows.length?rows.map(r=>{const k=ppMasterKey(r.profile,r.itemCode,r.length),c=ppCrateCalc(r),status=(!r.boxSize||!r.crateWidth||!c.valid)?'<b style="color:#b45309">Manual data needed</b>':(r.excelMatched?'<b style="color:#047857">Excel matched</b>':'<b style="color:#1d4ed8">Catalog / manual</b>');return `<tr><td><b>${ppEsc(r.profile)}</b></td><td>${ppEsc(r.itemCode||'—')}</td><td>${ppEsc(r.length)}</td><td>${ppNum(r.pcsPerBox)||1}</td><td>${ppEsc(r.boxSize||'—')}</td><td>${r.crateWidth||'—'}</td><td><button class="btn btn-sm pp-dimension-edit" onclick="ppEditCrateMaster('${encodeURIComponent(k)}')">${c.valid?`${c.outerL} × ${c.outerW} × ${c.packingH}`:'Edit dimensions'} <i class="fa-solid fa-pen"></i></button></td><td>${c.valid?c.perLayer:'—'}</td><td>${c.valid?c.layers:'—'}</td><td>${c.valid?c.boxesPerCrate:'—'}</td><td>${status}</td><td><button class="btn btn-sm" onclick="ppEditCrateMaster('${encodeURIComponent(k)}')">Edit</button></td></tr>`;}).join(''):'<tr><td colspan="12">No matching catalog rows.</td></tr>';
}
function ppEditCrateMaster(enc){const k=decodeURIComponent(enc),r=ppCrateMasterRows.find(x=>ppMasterKey(x.profile,x.itemCode,x.length)===k);if(!r)return;const c=ppCrateCalc(r);const box=prompt(`Box Size L × W × H (mm) — ${r.profile} / ${r.itemCode} / ${r.length}`,r.boxSize||'');if(box===null)return;const width=prompt('Crate usable/internal width (mm) — from AIS Excel / Master Data',r.crateWidth||c.outerW||'');if(width===null)return;const pcs=prompt('PCS per Box (Master Catalog)',String(r.pcsPerBox||1));if(pcs===null)return;const L=prompt('Crate OUTER length (mm) — default box length + 32 mm; enter double length if two rows fit',String(r.manualOuterL||c.outerL||''));if(L===null)return;const H=prompt('Packing height from box layers (mm) — blank to auto calculate from box count',String(r.manualPackingH||c.packingH||''));if(H===null)return;const per=prompt('Boxes per layer — blank to auto calculate from width',String(r.manualPerLayer||c.perLayer||''));if(per===null)return;const boxes=prompt('Boxes per crate — blank to auto calculate from height',String(r.manualBoxesPerCrate||c.boxesPerCrate||''));if(boxes===null)return;r.boxSize=box.trim();r.crateWidth=ppNum(width)||'';r.pcsPerBox=Math.max(1,Math.floor(ppNum(pcs)||1));r.manualOuterL=ppNum(L)||null;r.manualPackingH=ppNum(H)||null;r.manualPerLayer=ppNum(per)||null;r.manualBoxesPerCrate=ppNum(boxes)||null;r.manual=true;r.source='Manual / edited';r.calc=ppCrateCalc(r);ppRenderCrateMaster();ppSaveCrateMaster();ppRefreshNextPlLines();}
function ppSwitchSubtab(id,button){document.querySelectorAll('#packingPlannerTab .pp-subtab-content').forEach(x=>x.classList.remove('active'));document.querySelectorAll('#packingPlannerTab .pp-subtab').forEach(x=>x.classList.remove('active'));document.getElementById(id)?.classList.add('active');button?.classList.add('active');if(id==='ppCrateMasterSubTab')ppRenderCrateMaster();if(id==='ppCrateSubTab')ppRefreshNextPlLines();if(id==='ppContainerSubTab'){ppSmartRefreshPreviewOptions();ppSmartRenderContainer();}}
(function ppSmartInit(){document.addEventListener('DOMContentLoaded',()=>{try{ppSmartFillCrateNumbers();const saved=JSON.parse(localStorage.getItem(PP_SMART_STATE_KEY)||'[]');if(Array.isArray(saved))ppSmartCrates=saved;ppSmartLoadSaved();ppBuildCrateMaster(false);ppSmartRenderCrateList();ppSmartRefreshPreviewOptions();ppSmartRefresh();}catch(e){console.warn('Packing planner initialization failed',e);}});})();
(function ppSmartRefreshAfterMainData(){
 const original=window.loadDataFromSupabase;
 if(typeof original==='function'&&!original.__ppSmartWrapped){
  const wrapped=function(...args){const result=original.apply(this,args);Promise.resolve(result).finally(()=>setTimeout(()=>{try{ppLoadCrateMasterSaved();ppSmartLoadSaved();ppBuildCrateMaster(true);ppSmartRenderCrateList();ppSmartRefresh();}catch(e){console.warn('Crate planner refresh after data load:',e);}},350));return result;};
  wrapped.__ppSmartWrapped=true;window.loadDataFromSupabase=wrapped;
 }
})();


/* AIS crate height/orientation refinement: dynamic 1100 mm packing-height limit, per-crate layout */
function ppSmartOrientationMetrics(items, manual={}) {
 const masters=items.map(it=>ppSmartMasterFor(it)).filter(Boolean);
 const parsed=items.map(it=>({it,m:ppSmartMasterFor(it),d:ppDims(ppSmartMasterFor(it)?.boxSize)})).filter(x=>x.d);
 if(!parsed.length) return {valid:false,reason:'Box size data is missing. Update Crate Master Data.'};
 const width=ppNum(manual.outerW)||Math.max(...masters.map(m=>ppNum(m.crateWidth)).filter(Boolean));
 if(!width) return {valid:false,reason:'Crate width is missing from the AIS Excel data or manual master data.'};
 const innerW=width-2*PP_WOOD_THICKNESS;
 if(innerW<=0) return {valid:false,reason:'Crate internal width is too small.'};
 const maxPack=PP_MAX_PACKING_HEIGHT;
 const orientation=manual.orientation || document.getElementById('ppBoxOrientation')?.value || 'auto';
 const candidates=[];
 for(const key of ['height','width']) {
   if(orientation!=='auto' && orientation!==key) continue;
   const across=parsed.map(x=>key==='height'?x.d.w:x.d.h);
   const vertical=parsed.map(x=>key==='height'?x.d.h:x.d.w);
   const maxAcross=Math.max(...across),maxVertical=Math.max(...vertical);
   const per=Math.floor(innerW/maxAcross);
   if(per<1) continue;
   const maxLayers=Math.floor(maxPack/maxVertical);
   if(maxLayers<1) continue;
   const boxes=items.reduce((sum,it)=>sum+Math.ceil(ppNum(it.pcs)/Math.max(1,ppNum(it.pcsPerBox))),0);
   const layers=Math.max(1,Math.ceil(boxes/per));
   const packingH=layers*maxVertical;
   const overallH=packingH+PP_LEG_HEIGHT;
   candidates.push({orientation:key,width,innerW,per,layers,boxes,packingH,overallH,maxCapacity:per*maxLayers,maxLayers,maxAcross,maxVertical,valid:packingH<=PP_MAX_PACKING_HEIGHT});
 }
 if(!candidates.length) return {valid:false,reason:`Neither box orientation fits within the crate width and maximum ${maxPack} mm packing height.`};
 if(orientation==='auto') candidates.sort((a,b)=>b.maxCapacity-a.maxCapacity || a.overallH-b.overallH);
 const chosen=candidates[0];
 if(!chosen.valid) return {...chosen,valid:false,reason:`This box quantity needs ${chosen.packingH} mm packing height. Maximum packing height is ${PP_MAX_PACKING_HEIGHT} mm. Reduce PCS or use another crate.`};
 return {...chosen,valid:true};
}
function ppSmartCalcDims(items,manual={}) {
 const parsed=items.map(it=>({it,m:ppSmartMasterFor(it),d:ppDims(ppSmartMasterFor(it)?.boxSize)})).filter(x=>x.d);
 if(!parsed.length) return {valid:false,reason:'Box size data is missing.'};
 const metric=ppSmartOrientationMetrics(items,manual);
 if(!metric.valid) return metric;
 const outerL=ppNum(manual.outerL)||Math.ceil(Math.max(...items.map(it=>ppNum(it.length)||0))+32);
 return {...metric,outerL,outerW:metric.width,packingH:metric.packingH,overallH:metric.overallH,perLayer:metric.per,layers:metric.layers,boxes:metric.boxes,orientation:metric.orientation};
}
function ppSmartDimensionChanged() {
 const r=ppSmartSelectedLine();
 if(!r) return;
 const master=ppSmartMasterFor(r); if(!master) return;
 const pcs=Math.max(0,Math.floor(ppNum(document.getElementById('ppSmartAllocatePcs')?.value)));
 const item={lineKey:ppSmartLineKey(r),po:r.poNumber,profile:r.profile,itemCode:r.itemCode,length:r.length,pcs,pcsPerBox:ppSmartPcsBox(r),boxes:Math.ceil(pcs/ppSmartPcsBox(r)),unitWeight:ppNum(r.unitWeight||master.unitWeight)};
 const manual={outerL:ppNum(document.getElementById('ppOuterCrateL')?.value),outerW:ppNum(document.getElementById('ppOuterCrateW')?.value)||ppNum(master.crateWidth),packingH:0,orientation:document.getElementById('ppBoxOrientation')?.value||'auto'};
 const calc=ppSmartCalcDims([item],manual);
 const hEl=document.getElementById('ppCrateH');
 const note=document.getElementById('ppOrientationFitNote');
 if(calc.valid) {
   if(hEl && document.activeElement!==hEl) { hEl.value=calc.packingH; hEl.dataset.autoValue=String(calc.packingH); }
   if(note) note.innerHTML=`<b>Recommended:</b> ${calc.orientation==='height'?'Box Height vertical (standard)':'Box Width vertical (rotated 90°)'} · ${calc.per} boxes/layer × ${calc.layers} layers = ${calc.boxes} boxes · packing height ${calc.packingH} mm + ${PP_LEG_HEIGHT} mm legs = ${calc.overallH} mm overall.`;
 } else {
   if(note) note.innerHTML=`<b style="color:#b91c1c">Cannot fit:</b> ${ppEsc(calc.reason||'Review box orientation, width and PCS quantity.')}`;
 }
 ppSmartUpdateAllocationPreview();
}
function ppSmartAddCrateFromSelected() {
 const r=ppSmartSelectedLine(); if(!r){alert('Select a Next Planning PL line first.');return;}
 const master=ppSmartMasterFor(r),box=ppDims(master?.boxSize); if(!master||!box||!ppNum(master.crateWidth)){alert('This profile/length needs Box Size and Crate Width in tab 3 before allocating PCS.');return;}
 const pcs=Math.floor(ppNum(document.getElementById('ppSmartAllocatePcs')?.value)); if(pcs<1){alert('Enter PCS to allocate to this crate.');return;}
 const allocations=ppSmartGetAllocations(),balance=Math.max(0,ppNum(r.planningQty)-(allocations[ppSmartLineKey(r)]||0)); if(pcs>balance){alert(`Only ${balance.toLocaleString()} PCS remain for this PO/profile/item/length.`);return;}
 const n=Math.max(1,Math.min(60,Math.floor(ppNum(document.getElementById('ppSmartCrateNo')?.value)||1))),roman=document.getElementById('ppSmartRoman')?.value||'I',id=`C-${String(n).padStart(2,'0')}-${roman}`;
 let crate=ppSmartCrates.find(c=>c.id===id);
 if(crate){if(!confirm(`Crate ${id} already exists. Add this profile/length to the same crate?`))return;}
 else {crate={id,items:[],manual:{outerL:ppNum(document.getElementById('ppOuterCrateL')?.value),outerW:ppNum(document.getElementById('ppOuterCrateW')?.value)||ppNum(master.crateWidth),orientation:document.getElementById('ppBoxOrientation')?.value||'auto'},createdAt:Date.now()};ppSmartCrates.push(crate);}
 const newItem={lineKey:ppSmartLineKey(r),po:r.poNumber,profile:r.profile,itemCode:r.itemCode,length:r.length,pcs,pcsPerBox:ppSmartPcsBox(r),boxes:Math.ceil(pcs/ppSmartPcsBox(r)),unitWeight:ppNum(r.unitWeight||master.unitWeight)};
 const calc=ppSmartCalcDims([...(crate.items||[]),newItem],{...(crate.manual||{}),packingH:0,orientation:document.getElementById('ppBoxOrientation')?.value||crate.manual?.orientation||'auto'});
 if(!calc.valid){alert(calc.reason||'This box quantity does not fit the crate. Reduce PCS or select another orientation.');if(!crate.items.length)ppSmartCrates=ppSmartCrates.filter(x=>x!==crate);return;}
 const hEl=document.getElementById('ppCrateH'),typedH=ppNum(hEl?.value),autoH=ppNum(hEl?.dataset?.autoValue);
 if(hEl?.dataset?.userEdited==='1' && typedH>0 && autoH>0 && typedH!==autoH){
   const maxPack=PP_MAX_PACKING_HEIGHT;
   if(typedH<calc.packingH){alert(`Manual packing height ${typedH} mm is below the calculated required height ${calc.packingH} mm for these boxes.`);return;}
   if(typedH>maxPack){alert(`Packing height must be ${maxPack} mm or less.`);return;}
   calc.packingH=typedH;calc.overallH=typedH+PP_LEG_HEIGHT+2*PP_WOOD_WIDTH;
 }
 crate.items.push(newItem);crate.outerL=calc.outerL;crate.outerW=calc.outerW;crate.packingH=calc.packingH;crate.overallH=calc.overallH;crate.perLayer=calc.perLayer;crate.layers=calc.layers;crate.boxes=calc.boxes;crate.orientation=calc.orientation;crate.manual={...(crate.manual||{}),outerL:calc.outerL,outerW:calc.outerW,packingH:calc.packingH,orientation:calc.orientation};
 ppSmartPersist();ppSmartRenderCrateList();ppSmartUpdateAllocationPreview();ppSmartRefreshPreviewOptions();
 const next=document.getElementById('ppSmartCrateNo');if(next)next.value=String(Math.min(60,n+1));const pcsInput=document.getElementById('ppSmartAllocatePcs');if(pcsInput)pcsInput.value='';ppSmartUpdateAllocationPreview();
 ppSmartShowPreview(ppSmartCrates.indexOf(crate));
}
function ppSmartShowPreview(i) {
 const c=ppSmartCrates[i]; if(!c)return;
 const host=document.getElementById('ppCrate3DPreview'); if(!host)return;
 const mode=document.getElementById('ppSmartViewMode')?.value||'3d',items=c.items||[];
 const parsed=items.map(it=>({it,d:ppDims(ppSmartMasterFor(it)?.boxSize)})).filter(x=>x.d);
 if(!parsed.length){host.innerHTML='<div class="pp-empty">Box size missing. Update Crate Master Data first.</div>';return;}
 const totalBoxes=items.reduce((s,x)=>s+ppNum(x.boxes),0),calc=ppSmartCalcDims(items,{outerL:c.outerL,outerW:c.outerW,orientation:c.orientation||c.manual?.orientation||'auto'});
 const orientation=c.orientation||calc.orientation||'height';
 const cross=parsed.map(x=>orientation==='width'?x.d.h:x.d.w),vertical=parsed.map(x=>orientation==='width'?x.d.w:x.d.h);
 const innerW=Math.max(1,ppNum(c.outerW)-40),per=Math.max(1,Math.min(99,Math.floor(innerW/Math.max(...cross)))),layers=Math.max(1,Math.ceil(totalBoxes/per)),packH=ppNum(c.packingH)||layers*Math.max(...vertical);
 const maxShow=72,bw=Math.max(18,Math.min(90,700/per)),bh=Math.max(12,Math.min(42,460/layers));let rects='',n=0;
 if(mode==='top'){
   items.forEach((it,idx)=>{for(let b=0;b<ppNum(it.boxes)&&n<maxShow;b++,n++){const col=n%per,row=Math.floor(n/per);rects+=`<rect x="${50+col*(700/per)}" y="${55+row*(460/layers)}" width="${Math.max(8,bw-3)}" height="${Math.max(8,bh-3)}" rx="2" fill="${idx%2?'#d7ad76':'#edd0a0'}" stroke="#84572c"/><text x="${52+col*(700/per)}" y="${58+row*(460/layers)+Math.max(8,bh/2)}" font-size="9" fill="#533a21">${ppEsc(it.profile)}</text>`;}});
   host.innerHTML=`<svg viewBox="0 0 820 560"><rect x="25" y="25" width="770" height="500" rx="8" fill="#f7e7c8" stroke="#84572c" stroke-width="8"/>${rects}<text x="30" y="548" font-size="17" font-weight="700" fill="#164e63">Top view · boxes' long side follows crate length · ${orientation==='width'?'rotated cross-section':'standard orientation'}</text></svg>`;
 } else if(mode==='side') {
   items.forEach((it,idx)=>{for(let b=0;b<ppNum(it.boxes)&&n<maxShow;b++,n++){const col=n%per,row=Math.floor(n/per);rects+=`<rect x="${40+col*(740/per)}" y="${45+row*(450/layers)}" width="${Math.max(5,730/per-3)}" height="${Math.max(5,440/layers-3)}" fill="${idx%2?'#d7ad76':'#edd0a0'}" stroke="#84572c"/>`;}});
   host.innerHTML=`<svg viewBox="0 0 820 560"><rect x="25" y="25" width="770" height="500" fill="#f7e7c8" stroke="#84572c" stroke-width="8"/>${rects}<rect x="35" y="490" width="60" height="55" fill="#a97842"/><rect x="725" y="490" width="60" height="55" fill="#a97842"/><text x="30" y="548" font-size="17" font-weight="700" fill="#164e63">Side view · ${layers} layers × ${Math.max(...vertical)} mm = ${packH} mm packing height</text></svg>`;
 } else {
   const L=510,D=155,H=Math.max(55,Math.min(270,packH/3.4)),x=95,y=170,depthY=65;let blocks='',idx=0;
   for(let layer=0;layer<layers&&idx<36;layer++)for(let col=0;col<per&&idx<totalBoxes&&idx<36;col++,idx++){
     const xx=x+col*(L/per),ww=Math.max(14,L/per-4),yy=y-layer*(H/layers);
     blocks+=`<polygon points="${xx},${yy} ${xx+ww},${yy-12} ${xx+ww+D/per},${yy-12-depthY/per} ${xx+D/per},${yy-depthY/per}" fill="${idx%2?'#d7ad76':'#edd0a0'}" stroke="#84572c"/><polygon points="${xx},${yy} ${xx+D/per},${yy-depthY/per} ${xx+D/per},${yy-depthY/per+H/layers} ${xx},${yy+H/layers}" fill="#b98549" stroke="#84572c"/>`;
   }
   host.innerHTML=`<svg viewBox="0 0 820 600"><polygon points="${x},${y} ${x+L},${y-12} ${x+L+D},${y-12-depthY} ${x+D},${y-depthY}" fill="#f1dfbc" stroke="#754b26" stroke-width="6"/>${blocks}<polygon points="${x},${y} ${x+D},${y-depthY} ${x+D},${y-depthY+H} ${x},${y+H}" fill="#bc8749" stroke="#754b26" stroke-width="5"/><polygon points="${x},${y+H} ${x+L},${y+H-12} ${x+L},${y-12+H} ${x},${y+H}" fill="#c18b4e" stroke="#754b26" stroke-width="5"/><g fill="#9c6b37" stroke="#70451f" stroke-width="3"><rect x="${x+20}" y="${y+H}" width="24" height="60"/><rect x="${x+L-30}" y="${y+H-8}" width="24" height="60"/><rect x="${x+D+5}" y="${y-depthY+H-8}" width="24" height="60"/></g><text x="30" y="555" font-size="18" font-weight="700" fill="#164e63">${ppEsc(c.id)} · ${c.outerL} × ${c.outerW} × ${packH} mm packing</text><text x="30" y="580" font-size="15" fill="#164e63">${totalBoxes} boxes · ${items.reduce((s,it)=>s+ppNum(it.pcs),0).toLocaleString()} PCS · ${layers} layers · ${orientation==='width'?'box rotated 90°':'standard box orientation'}</text></svg>`;
 }
 const info=document.getElementById('ppCrate3DInfo');if(info)info.innerHTML=`<b>${ppEsc(c.id)}</b><br>${items.map(it=>`${ppEsc(it.po)} / ${ppEsc(it.profile)} / ${ppEsc(it.itemCode)} / ${ppEsc(it.length)} mm: ${ppNum(it.pcs).toLocaleString()} PCS (${it.boxes} boxes)`).join('<br>')}<br><b>Outer dimensions:</b> ${c.outerL} × ${c.outerW} × ${c.overallH} mm overall (packing ${packH} + 100 mm legs).<br><b>Arrangement:</b> ${per} boxes/layer × ${layers} layers; ${orientation==='width'?'box width is vertical (rotated 90°)':'box height is vertical (standard)'}.`;
 const sel=document.getElementById('ppSmartPreviewCrate');if(sel)sel.value=String(i);
}

(function ppAutoHeightOnLineSelection(){
 const previous=window.ppOnNextPlLineChange;
 if(typeof previous==='function'&&!previous.__ppAutoHeightWrapped){
  const wrapped=function(){previous.apply(this,arguments);setTimeout(()=>{try{ppSmartDimensionChanged();}catch(e){console.warn(e);}},0);};
  wrapped.__ppAutoHeightWrapped=true;window.ppOnNextPlLineChange=wrapped;
 }
})();
function ppSmartEditCrate(i){
 const c=ppSmartCrates[i];if(!c)return;
 const l=prompt('Crate outer length (mm)',c.outerL||'');if(l===null)return;
 const w=prompt('Crate outer width (mm)',c.outerW||'');if(w===null)return;
 const h=prompt(`Packing height (mm). Maximum is ${PP_MAX_PACKING_HEIGHT} mm; overall height adds ${PP_LEG_HEIGHT} mm legs.`,c.packingH||'');if(h===null)return;
 const manualL=Math.max(1,ppNum(l)),manualW=Math.max(1,ppNum(w)),manualH=Math.max(1,ppNum(h));
 const calc=ppSmartCalcDims(c.items,{outerL:manualL,outerW:manualW,orientation:c.orientation||c.manual?.orientation||'auto'});
 if(!calc.valid){alert(calc.reason||'Crate dimensions do not fit.');return;}
 const maxPack=PP_MAX_PACKING_HEIGHT;
 if(manualH<calc.packingH){alert(`Packing height ${manualH} mm is too small. The selected boxes need at least ${calc.packingH} mm.`);return;}
 if(manualH>maxPack){alert(`Packing height must not exceed ${maxPack} mm.`);return;}
 Object.assign(c,calc,{outerL:manualL,outerW:manualW,packingH:manualH,overallH:manualH+PP_LEG_HEIGHT,manual:{outerL:manualL,outerW:manualW,packingH:manualH,orientation:calc.orientation}});
 ppSmartPersist();ppSmartRenderCrateList();ppSmartRefreshPreviewOptions();ppSmartShowPreview(i);
}


/* AIS Packing Planner reliability pass — selection-aware allocation, per-crate capacity,
   editable master dimensions, row orientation, and immediate cloud save. */
function ppSmartLineBalance(r){
 if(!r)return 0;
 const alloc=ppSmartGetAllocations();
 return Math.max(0,Math.floor(ppNum(r.planningQty))-(alloc[ppSmartLineKey(r)]||0));
}
function ppSmartSelectedCrateId(){
 const n=Math.max(1,Math.floor(ppNum(document.getElementById('ppSmartCrateNo')?.value)||1));
 const roman=document.getElementById('ppSmartRoman')?.value||'I';
 return `C-${String(n).padStart(2,'0')}-${roman}`;
}
function ppSmartClearSelectedLine(){
 ['ppPlanPo','ppPlanProfile','ppPlanItemCode','ppPlanLength','ppPlanQty','ppPlanPcsPerBox','ppPlanBoxQty','ppOuterCrateL','ppOuterCrateW','ppCrateH','ppSmartAllocatePcs','ppSmartAllocateBoxes'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
 const note=document.getElementById('ppOrientationFitNote');if(note)note.textContent='Select a Next Planning PL line first. No line quantities are shown until a line is selected.';
 const rem=document.getElementById('ppSmartRemainingPcs');if(rem)rem.textContent='—';
}
function ppOnNextPlLineChange(){
 const sel=document.getElementById('ppNextPlLine');
 if(!sel||sel.value===''){ppSmartClearSelectedLine();ppSmartUpdateAllocationPreview();return;}
 const i=Number(sel.value),r=ppCrateNextRows[i];if(!r){ppSmartClearSelectedLine();return;}
 const set=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v??'';};
 set('ppPlanPo',r.poNumber);set('ppPlanProfile',r.profile);set('ppPlanItemCode',r.itemCode);set('ppPlanLength',r.length);set('ppPlanQty',Math.floor(ppNum(r.planningQty)));
 const m=ppSmartMasterFor(r),cap=ppSmartPcsBox(r);set('ppPlanPcsPerBox',cap);set('ppPlanBoxQty',Math.ceil(ppNum(r.planningQty)/cap));
 const rowMode=document.getElementById('ppSmartRowMode');if(rowMode)rowMode.value=String(m?.rowMultiplier||1);
 const orient=document.getElementById('ppBoxOrientation');if(orient)orient.value=m?.orientation||'auto';
 set('ppOuterCrateL',m?.manualOuterL||Math.ceil((ppNum(r.length)+32)*(ppNum(rowMode?.value)||1)));set('ppOuterCrateW',m?.crateWidth||'');set('ppCrateH','');
 set('ppSmartAllocatePcs','');
 ppSmartUpdateAllocationPreview();ppSmartDimensionChanged();
}
function ppSmartOrientationMetrics(items,manual={}){
 const parsed=items.map(it=>({it,m:ppSmartMasterFor(it),d:ppDims(ppSmartMasterFor(it)?.boxSize)}));
 if(!parsed.length||parsed.some(x=>!x.d))return {valid:false,reason:'Box size data is missing. Update Crate Master Data.'};
 const masters=parsed.map(x=>x.m),width=ppNum(manual.outerW)||Math.max(...masters.map(m=>ppNum(m?.crateWidth)).filter(Boolean));
 if(!width)return {valid:false,reason:'Crate width is missing. Add the standard width in Crate Master Data.'};
 const innerW=width-2*PP_WOOD_THICKNESS,maxPack=PP_MAX_PACKING_HEIGHT;
 if(innerW<=0)return {valid:false,reason:'Crate internal width is too small.'};
 const orientation=manual.orientation||document.getElementById('ppBoxOrientation')?.value||'auto';
 const rowMultiplier=Math.max(1,Math.min(3,Math.floor(ppNum(manual.rowMultiplier)||Math.floor(ppNum(document.getElementById('ppSmartRowMode')?.value)||1))));
 const boxes=items.reduce((sum,it)=>sum+Math.ceil(Math.max(0,ppNum(it.pcs))/Math.max(1,ppNum(it.pcsPerBox))),0);
 const candidates=[];
 for(const key of ['height','width']){
  if(orientation!=='auto'&&orientation!==key)continue;
  const crossDims=parsed.map(x=>key==='height'?x.d.w:x.d.h),verticalDims=parsed.map(x=>key==='height'?x.d.h:x.d.w);
  const across=Math.floor(innerW/Math.max(...crossDims));if(across<1)continue;
  const perLayer=across*rowMultiplier,vertical=Math.max(...verticalDims),maxLayers=Math.floor(maxPack/vertical);if(maxLayers<1)continue;
  const layers=Math.max(1,Math.ceil(boxes/perLayer)),packingH=layers*vertical,overallH=packingH+PP_LEG_HEIGHT;
  const profileLength=Math.max(...items.map(it=>ppNum(it.length)||0));
  const outerL=ppNum(manual.outerL)||Math.ceil((profileLength+32)*rowMultiplier);
  candidates.push({valid:packingH<=PP_MAX_PACKING_HEIGHT,orientation:key,rowMultiplier,width,innerW,perLayer,layers,boxes,packingH,overallH,maxCapacity:perLayer*maxLayers,maxLayers,maxAcross:Math.max(...crossDims),maxVertical:vertical,outerL,outerW:width});
 }
 if(!candidates.length)return {valid:false,reason:`No box orientation fits the crate width and ${maxPack} mm maximum packing height.`};
 candidates.sort((a,b)=>(a.valid===b.valid?0:a.valid?-1:1)||b.maxCapacity-a.maxCapacity||a.overallH-b.overallH);
 const chosen=candidates[0];
 if(!chosen.valid)return {...chosen,valid:false,reason:`This quantity needs ${chosen.packingH} mm packing height. Maximum packing height is ${PP_MAX_PACKING_HEIGHT} mm. Reduce PCS, choose double-row where the length allows it, or use another crate.`};
 return chosen;
}
function ppSmartCalcDims(items,manual={}){
 if(!items.length)return {valid:false,reason:'Add at least one profile to calculate dimensions.'};
 const metric=ppSmartOrientationMetrics(items,manual);if(!metric.valid)return metric;
 return {...metric,packingH:metric.packingH,overallH:metric.overallH,perLayer:metric.perLayer,layers:metric.layers,boxes:metric.boxes,orientation:metric.orientation,rowMultiplier:metric.rowMultiplier};
}
function ppSmartUpdateAllocationPreview(){
 const r=ppSmartSelectedLine(),pcsInput=document.getElementById('ppSmartAllocatePcs'),boxesInput=document.getElementById('ppSmartAllocateBoxes'),note=document.getElementById('ppOrientationFitNote'),remaining=document.getElementById('ppSmartRemainingPcs');
 if(!r){if(boxesInput)boxesInput.value='';if(remaining)remaining.textContent='—';if(note)note.textContent='Select a Next Planning PL line first. No line quantities are shown until a line is selected.';return;}
 const pcs=Math.max(0,Math.floor(ppNum(pcsInput?.value))),pbox=ppSmartPcsBox(r),boxes=pcs?Math.ceil(pcs/pbox):0,balance=ppSmartLineBalance(r),crateId=ppSmartSelectedCrateId(),crate=ppSmartCrates.find(c=>c.id===crateId);
 if(boxesInput)boxesInput.value=pcs?boxes:'';
 if(remaining)remaining.textContent=balance.toLocaleString();
 const existing=crate?(crate.items||[]).reduce((s,it)=>s+ppNum(it.pcs),0):0;
 if(note){note.innerHTML=`<b>Selected line:</b> ${ppEsc(r.poNumber)} / ${ppEsc(r.profile)} / ${ppEsc(r.itemCode)} / ${ppEsc(r.length)} mm · Next PL ${Math.floor(ppNum(r.planningQty)).toLocaleString()} PCS · already allocated ${Math.max(0,Math.floor(ppNum(r.planningQty))-balance).toLocaleString()} PCS · <b>balance ${balance.toLocaleString()} PCS</b>.<br><b>Target crate ${ppEsc(crateId)}:</b> ${existing.toLocaleString()} PCS already in this crate. This addition: ${pcs.toLocaleString()} PCS = ${boxes.toLocaleString()} boxes. Balance is tracked per PO/profile/item/length.`;}
}
function ppSmartDimensionChanged(){
 const r=ppSmartSelectedLine();if(!r){ppSmartUpdateAllocationPreview();return;}
 const m=ppSmartMasterFor(r),pcs=Math.max(0,Math.floor(ppNum(document.getElementById('ppSmartAllocatePcs')?.value))),pbox=ppSmartPcsBox(r),item={lineKey:ppSmartLineKey(r),po:r.poNumber,profile:r.profile,itemCode:r.itemCode,length:r.length,pcs,pcsPerBox:pbox,boxes:pcs?Math.ceil(pcs/pbox):0,unitWeight:ppNum(r.unitWeight||m?.unitWeight)};
 const manual={outerL:ppNum(document.getElementById('ppOuterCrateL')?.value)||Math.ceil(ppNum(r.length)+32),outerW:ppNum(document.getElementById('ppOuterCrateW')?.value)||ppNum(m?.crateWidth),orientation:document.getElementById('ppBoxOrientation')?.value||'auto',rowMultiplier:ppNum(document.getElementById('ppSmartRowMode')?.value)||1};
 const crate=ppSmartCrates.find(c=>c.id===ppSmartSelectedCrateId()),items=crate?[...(crate.items||[]),item]:[item];
 const calc=pcs>0&&m?ppSmartCalcDims(items,manual):null,hEl=document.getElementById('ppCrateH');
 if(calc?.valid){if(hEl&&document.activeElement!==hEl)hEl.value=calc.packingH;const note=document.getElementById('ppOrientationFitNote');if(note)note.dataset.fit='yes';}
 else if(calc&&!calc.valid){if(hEl&&document.activeElement!==hEl)hEl.value='';const note=document.getElementById('ppOrientationFitNote');if(note)note.dataset.fit='no';}
 ppSmartUpdateAllocationPreview();
 if(calc?.valid){const note=document.getElementById('ppOrientationFitNote');if(note)note.innerHTML+=`<br><b>Recommended arrangement:</b> ${calc.orientation==='height'?'Box height vertical':'Box width vertical (rotate 90°)'} · ${calc.perLayer} boxes/layer · ${calc.layers} layers · ${calc.boxes} boxes total · ${calc.packingH} mm packing height + ${PP_LEG_HEIGHT} mm legs = ${calc.overallH} mm overall. ${calc.rowMultiplier===3?'Triple lengthwise rows selected.':calc.rowMultiplier===2?'Double lengthwise rows selected.':'Single lengthwise row selected.'}`;}
 else if(calc&&!calc.valid){const note=document.getElementById('ppOrientationFitNote');if(note)note.innerHTML+=`<br><b style="color:#b91c1c">Cannot fit:</b> ${ppEsc(calc.reason||'Check box size and crate dimensions.')}`;}
}
function ppSmartAddCrateFromSelected(){
 const r=ppSmartSelectedLine();if(!r){alert('Select a Next Planning PL line first.');return;}
 const master=ppSmartMasterFor(r),box=ppDims(master?.boxSize);if(!master||!box||!ppNum(master.crateWidth)){alert('This profile/length needs Box Size and Crate Width in Crate Master Data first.');return;}
 const requested=Math.floor(ppNum(document.getElementById('ppSmartAllocatePcs')?.value));if(requested<1){alert('Enter PCS to allocate to this crate.');return;}
 const balance=ppSmartLineBalance(r);if(requested>balance){alert(`Only ${balance.toLocaleString()} PCS remain for ${r.poNumber} / ${r.profile} / ${r.itemCode} / ${r.length} mm.`);return;}
 const id=ppSmartSelectedCrateId();let crate=ppSmartCrates.find(c=>c.id===id);const isNew=!crate;
 if(!crate)crate={id,items:[],createdAt:Date.now(),manual:{}};
 const same=crate.items.find(it=>it.lineKey===ppSmartLineKey(r));
 const pcsPerBox=ppSmartPcsBox(r),item={lineKey:ppSmartLineKey(r),po:r.poNumber,profile:r.profile,itemCode:r.itemCode,length:r.length,pcs:requested,pcsPerBox,boxes:Math.ceil(requested/pcsPerBox),unitWeight:ppNum(r.unitWeight||master.unitWeight)};
 const items=same?crate.items.map(it=>it===same?{...it,pcs:ppNum(it.pcs)+requested,boxes:Math.ceil((ppNum(it.pcs)+requested)/pcsPerBox)}:it):[...crate.items,item];
 const manual={...(crate.manual&&typeof crate.manual==='object'?crate.manual:{}),outerL:ppNum(document.getElementById('ppOuterCrateL')?.value)||ppNum(crate.outerL)||Math.ceil((ppNum(r.length)+32)*(ppNum(document.getElementById('ppSmartRowMode')?.value)||1)),outerW:ppNum(document.getElementById('ppOuterCrateW')?.value)||ppNum(crate.outerW)||ppNum(master.crateWidth),orientation:document.getElementById('ppBoxOrientation')?.value||crate.orientation||'auto',rowMultiplier:ppNum(document.getElementById('ppSmartRowMode')?.value)||ppNum(crate.rowMultiplier)||1};
 const calc=ppSmartCalcDims(items,manual);if(!calc.valid){if(isNew){}alert(calc.reason||'This crate cannot fit the selected boxes within 1100 mm packing height. Reduce PCS or use another crate.');return;}
 if(isNew)ppSmartCrates.push(crate);crate.items=items;Object.assign(crate,{outerL:calc.outerL,outerW:calc.outerW,packingH:calc.packingH,overallH:calc.overallH,perLayer:calc.perLayer,layers:calc.layers,boxes:calc.boxes,orientation:calc.orientation,rowMultiplier:calc.rowMultiplier,manual:{...manual,outerL:calc.outerL,outerW:calc.outerW,orientation:calc.orientation,rowMultiplier:calc.rowMultiplier}});
 ppSmartPersist();ppSmartRenderCrateList();ppSmartUpdateAllocationPreview();ppSmartRefreshPreviewOptions();
 const pcsInput=document.getElementById('ppSmartAllocatePcs');if(pcsInput)pcsInput.value='';
 ppSmartUpdateAllocationPreview();ppSmartShowPreview(ppSmartCrates.indexOf(crate));
 if(typeof showToast==='function')showToast(`${requested} PCS added to ${id}. Save the crate list to sync to cloud.`,'success');
}
function ppSmartAddProfileToCrate(i){
 const c=ppSmartCrates[i];if(!c)return;
 const choices=ppCrateNextRows.map((r,n)=>`${n}: ${r.poNumber} / ${r.profile} / ${r.itemCode} / ${r.length} mm — balance ${ppSmartLineBalance(r)} PCS`).join('\n');
 const raw=prompt('Select Next PL line number to add to '+c.id+':\n'+choices,'0');if(raw===null)return;const r=ppCrateNextRows[Math.floor(ppNum(raw))];if(!r){alert('Invalid Next PL line.');return;}
 const balance=ppSmartLineBalance(r);if(!balance){alert('No PCS remain for this Next PL line.');return;}
 const qtyRaw=prompt(`PCS to add to ${c.id} (remaining ${balance})`,String(balance));if(qtyRaw===null)return;const pcs=Math.floor(ppNum(qtyRaw));if(pcs<1||pcs>balance){alert(`Enter PCS from 1 to ${balance}.`);return;}
 const m=ppSmartMasterFor(r);if(!ppDims(m?.boxSize)||!ppNum(m?.crateWidth)){alert('Add Box Size and Crate Width in Crate Master Data first.');return;}
 const cap=ppSmartPcsBox(r),lineKey=ppSmartLineKey(r),existing=c.items.find(it=>it.lineKey===lineKey),item={lineKey,po:r.poNumber,profile:r.profile,itemCode:r.itemCode,length:r.length,pcs:pcs+(existing?ppNum(existing.pcs):0),pcsPerBox:cap,boxes:Math.ceil((pcs+(existing?ppNum(existing.pcs):0))/cap),unitWeight:ppNum(r.unitWeight||m.unitWeight)};
 const items=existing?c.items.map(it=>it===existing?item:it):[...c.items,item],calc=ppSmartCalcDims(items,{...(c.manual||{}),outerL:c.outerL,outerW:c.outerW,orientation:c.orientation||'auto',rowMultiplier:c.rowMultiplier||1});
 if(!calc.valid){alert(calc.reason||'The added profile does not fit within this crate.');return;}
 c.items=items;Object.assign(c,{...calc,manual:{...(c.manual||{}),outerL:calc.outerL,outerW:calc.outerW,orientation:calc.orientation,rowMultiplier:calc.rowMultiplier}});ppSmartPersist();ppSmartRenderCrateList();ppSmartUpdateAllocationPreview();ppSmartRefreshPreviewOptions();ppSmartShowPreview(i);
}
function ppSmartEditPcs(i){
 const c=ppSmartCrates[i];if(!c)return;const original=JSON.parse(JSON.stringify(c));
 for(const it of c.items||[]){const r=ppCrateNextRows.find(x=>ppSmartLineKey(x)===it.lineKey),alloc=ppSmartGetAllocations(),max=r?Math.max(0,ppNum(r.planningQty)-(alloc[it.lineKey]||0)+ppNum(it.pcs)):ppNum(it.pcs);const raw=prompt(`${it.po} / ${it.profile} / ${it.itemCode} / ${it.length} mm — PCS (max ${max})`,String(it.pcs));if(raw===null)return;const qty=Math.floor(ppNum(raw));if(qty<0||qty>max){alert(`Enter PCS from 0 to ${max}.`);return;}it.pcs=qty;it.boxes=Math.ceil(qty/Math.max(1,ppNum(it.pcsPerBox)));}
 c.items=(c.items||[]).filter(it=>ppNum(it.pcs)>0);const calc=ppSmartCalcDims(c.items,{...(c.manual||{}),outerL:c.outerL,outerW:c.outerW,orientation:c.orientation||'auto',rowMultiplier:c.rowMultiplier||1});if(c.items.length&&!calc.valid){Object.assign(c,original);alert(calc.reason||'Edited PCS do not fit.');return;}if(calc.valid)Object.assign(c,{...calc,manual:{...(c.manual||{}),outerL:calc.outerL,outerW:calc.outerW,orientation:calc.orientation,rowMultiplier:calc.rowMultiplier}});ppSmartPersist();ppSmartRenderCrateList();ppSmartUpdateAllocationPreview();ppSmartRefreshPreviewOptions();
}
function ppSmartEditCrate(i){
 const c=ppSmartCrates[i];if(!c)return;const L=prompt('Crate outer LENGTH (mm)',String(c.outerL||''));if(L===null)return;const W=prompt('Crate outer WIDTH (mm)',String(c.outerW||''));if(W===null)return;const orient=prompt('Box orientation: auto / height / width',c.orientation||'auto');if(orient===null)return;const row=prompt('Lengthwise rows: 1 or 2',String(c.rowMultiplier||1));if(row===null)return;
 const calc=ppSmartCalcDims(c.items,{outerL:ppNum(L),outerW:ppNum(W),orientation:['auto','height','width'].includes(orient.toLowerCase())?orient.toLowerCase():'auto',rowMultiplier:Math.max(1,Math.min(2,Math.floor(ppNum(row)||1)))});if(!calc.valid){alert(calc.reason||'These dimensions do not fit.');return;}Object.assign(c,{...calc,manual:{outerL:calc.outerL,outerW:calc.outerW,orientation:calc.orientation,rowMultiplier:calc.rowMultiplier}});ppSmartPersist();ppSmartRenderCrateList();ppSmartRefreshPreviewOptions();ppSmartShowPreview(i);
}
function ppSmartCopyCrate(i){const src=ppSmartCrates[i];if(!src)return;let n=1;const used=new Set(ppSmartCrates.map(c=>c.id));while(n<=60&&used.has(`C-${String(n).padStart(2,'0')}-I`))n++;if(n>60){alert('All crate numbers 1–60 are used.');return;}const copy=JSON.parse(JSON.stringify(src));copy.id=`C-${String(n).padStart(2,'0')}-I`;copy.createdAt=Date.now();copy.items=[];ppSmartCrates.push(copy);ppSmartPersist();ppSmartRenderCrateList();ppSmartRefreshPreviewOptions();}
function ppSmartRemoveCrate(i){if(!confirm('Remove this crate and return its PCS to the Next PL remaining balance?'))return;ppSmartCrates.splice(i,1);ppSmartPersist();ppSmartRenderCrateList();ppSmartUpdateAllocationPreview();ppSmartRefreshPreviewOptions();}
function ppSmartRenderCrateList(){
 const body=document.getElementById('ppCratePlanBody');if(!body)return;
 body.innerHTML=ppSmartCrates.length?ppSmartCrates.map((c,i)=>{const items=c.items||[],pcs=items.reduce((s,x)=>s+ppNum(x.pcs),0),boxes=items.reduce((s,x)=>s+ppNum(x.boxes),0),weight=items.reduce((s,x)=>s+ppNum(x.pcs)*ppNum(x.unitWeight),0);return `<tr><td><b>${ppEsc(c.id)}</b></td><td>${ppEsc([...new Set(items.map(x=>x.po))].join(', '))}</td><td>${ppEsc([...new Set(items.map(x=>x.profile))].join(' / '))}</td><td>${ppEsc([...new Set(items.map(x=>x.itemCode))].join(' / '))}</td><td>${ppEsc([...new Set(items.map(x=>x.length))].join(' / '))}</td><td>${pcs.toLocaleString()}</td><td>${items.map(x=>x.pcsPerBox).join(' / ')}</td><td>${boxes.toLocaleString()}</td><td>${c.outerL||'—'}</td><td>${c.outerW||'—'}</td><td>${c.packingH||'—'}</td><td>${c.overallH||'—'}</td><td>${c.perLayer||'—'}</td><td>${c.layers||'—'}</td><td>${c.rowMultiplier===2?'Double':'Single'}</td><td>${weight.toFixed(1)}</td><td><button class="btn btn-accent" onclick="ppSmartShowPreview(${i})">2D/3D</button></td><td><div class="pp-row-actions"><button class="btn btn-sm" onclick="ppSmartAddProfileToCrate(${i})">+ Profile</button><button class="btn btn-sm" onclick="ppSmartEditPcs(${i})">Edit PCS</button><button class="btn btn-sm" onclick="ppSmartCopyCrate(${i})">Copy</button><button class="btn btn-sm" onclick="ppSmartEditCrate(${i})">Edit</button><button class="btn btn-sm" onclick="ppSmartRemoveCrate(${i})">Remove</button><button class="btn btn-sm" onclick="ppSmartSaveNow()">Save</button></div></td></tr>`;}).join(''):'<tr><td colspan="18">No crates yet. Select a Next PL line and allocate PCS.</td></tr>';
 const pcs=ppSmartCrates.reduce((s,c)=>s+(c.items||[]).reduce((a,x)=>a+ppNum(x.pcs),0),0),weight=ppSmartCrates.reduce((s,c)=>s+(c.items||[]).reduce((a,x)=>a+ppNum(x.pcs)*ppNum(x.unitWeight),0),0),set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};set('ppSmartCrateCount',ppSmartCrates.length);set('ppSmartAllocatedPcs',pcs.toLocaleString());set('ppSmartTotalWeight',weight.toLocaleString(undefined,{maximumFractionDigits:1})+' kg');ppSmartRefreshPreviewOptions();
}
function ppRenderCrateMaster(){
 const body=document.getElementById('ppCrateMasterBody');if(!body)return;const q=(document.getElementById('ppCrateMasterSearch')?.value||'').toLowerCase();
 const rows=ppCrateMasterRows.filter(r=>[r.profile,r.itemCode,r.length,r.boxSize,r.crateWidth].join(' ').toLowerCase().includes(q));
 const matched=ppCrateMasterRows.filter(r=>r.excelMatched).length,missing=ppCrateMasterRows.filter(r=>!r.boxSize||!r.crateWidth||!ppCrateCalc(r).valid).length;
 const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};set('ppCrateMasterCount',ppCrateMasterRows.length);set('ppCrateMasterMatched',matched);set('ppCrateMasterMissing',missing);
 const dim=(idx,field,val)=>`<input type="number" min="1" step="1" value="${ppEsc(val??'')}" aria-label="${field}" style="width:84px;max-width:100%;padding:6px;border:1px solid #93c5fd;border-radius:7px" onchange="ppMasterInlineDim(${idx},'${field}',this.value)">`;
 body.innerHTML=rows.length?rows.map(r=>{const idx=ppCrateMasterRows.indexOf(r),c=ppCrateCalc(r),height= c.valid?c.packingH:'',overall=c.valid?c.overallH:'',status=(!r.boxSize||!r.crateWidth||!c.valid)?'<b style="color:#b45309">Manual data needed</b>':r.excelMatched?'<b style="color:#047857">Excel matched</b>':'<b style="color:#1d4ed8">Catalog / manual</b>';
 return `<tr><td><b>${ppEsc(r.profile)}</b></td><td>${ppEsc(r.itemCode||'—')}</td><td>${ppEsc(r.length)}</td><td>${ppNum(r.pcsPerBox)||1}</td><td>${ppEsc(r.boxSize||'—')}</td><td>${dim(idx,'crateWidth',r.crateWidth||c.outerW||'')}</td><td>${dim(idx,'manualOuterL',r.manualOuterL||c.outerL||Math.ceil(ppNum(r.length)+32))}</td><td>${height?dim(idx,'manualPackingH',r.manualPackingH||height):'—'}</td><td>${overall||'—'}</td><td>${c.valid?c.perLayer:'—'}</td><td class="pp-master-orientation"><label class="pp-control-label"><i class="fa-solid fa-arrows-up-down-left-right"></i> Vertical box side</label><select class="pp-master-select" aria-label="Box orientation" title="Choose which box dimension stands vertically" onchange="ppMasterInlineDim(${idx},'orientation',this.value)"><option value="auto" ${(r.orientation||'auto')==='auto'?'selected':''}>✨ Auto best fit</option><option value="height" ${r.orientation==='height'?'selected':''}>↕ Height vertical</option><option value="width" ${r.orientation==='width'?'selected':''}>↻ Width vertical (rotate)</option></select><button class="btn btn-sm pp-preview-btn" title="View crate arrangement" onclick="ppMasterPreview(${idx})"><i class="fa-solid fa-cubes-stacked"></i> Preview</button></td><td class="pp-master-rows"><label class="pp-control-label"><i class="fa-solid fa-layer-group"></i> Boxes across length</label><select class="pp-master-select" aria-label="Lengthwise rows" title="Double doubles the lengthwise box rows" onchange="ppMasterInlineDim(${idx},'rowMultiplier',this.value)"><option value="1" ${(ppNum(r.rowMultiplier)||1)===1?'selected':''}>1 row · Single</option><option value="2" ${ppNum(r.rowMultiplier)===2?'selected':''}>2 rows · Double</option><option value="3" ${ppNum(r.rowMultiplier)===3?'selected':''}>3 rows · Triple</option></select><small class="pp-cell-hint">${(ppNum(r.rowMultiplier)||1)===2?'Double row capacity':'Single row capacity'}</small></td><td>${c.valid?c.boxesPerCrate:'—'}</td><td>${status}</td><td><button class="btn btn-sm" onclick="ppEditCrateMaster('${encodeURIComponent(ppMasterKey(r.profile,r.itemCode,r.length))}')">Edit Box/PCS</button></td></tr>`;
 }).join(''):'<tr><td colspan="15">No matching Master Catalog records.</td></tr>';
}
function ppMasterInlineDim(index,field,value){const r=ppCrateMasterRows[index];if(!r)return;if(field==='orientation'){r.orientation=['auto','height','width'].includes(value)?value:'auto';}else if(field==='rowMultiplier'){r.rowMultiplier=Math.max(1,Math.min(3,Math.floor(ppNum(value)||1)));}else{const n=ppNum(value);if(n<1){alert('Enter a dimension greater than zero.');ppRenderCrateMaster();return;}if(field==='manualPackingH'&&n>PP_MAX_PACKING_HEIGHT){alert('Packing height cannot exceed 1100 mm.');ppRenderCrateMaster();return;}r[field]=n;r.manual=true;}
 r.manual=true;r.source='Manual / edited';r.calc=ppCrateCalc({...r,orientation:r.orientation,rowMultiplier:r.rowMultiplier});ppRenderCrateMaster();ppPopulateCrateStandards();ppRefreshNextPlLines();ppSaveCrateMaster();
}
function ppMasterPreview(index){const r=ppCrateMasterRows[index];if(!r)return;const c=ppCrateCalc(r),d=ppDims(r.boxSize);if(!d||!c.valid){alert('Please set valid box size, crate width and orientation first.');return;}const rowMultiplier=ppNum(r.rowMultiplier)||1,boxesPerLayer=c.perLayer*rowMultiplier,layers=c.layers,packingH=c.packingH,outerL=ppNum(r.manualOuterL)||Math.ceil((ppNum(r.length)+32)*rowMultiplier);const temp={id:'MASTER PREVIEW',items:[{profile:r.profile,itemCode:r.itemCode,length:r.length,pcsPerBox:r.pcsPerBox,pcs:boxesPerLayer*layers*r.pcsPerBox,boxes:boxesPerLayer*layers,lineKey:'master-preview'}],outerL,outerW:ppNum(r.crateWidth),packingH,overallH:packingH+PP_LEG_HEIGHT,perLayer:boxesPerLayer,layers,boxes:boxesPerLayer*layers,orientation:r.orientation||'auto',rowMultiplier};const old=ppSmartCrates;ppSmartCrates=[temp];ppSmartShowPreview(0);ppSmartCrates=old;ppSmartRefreshPreviewOptions();const tab=document.querySelector('#packingPlannerTab .pp-subtab[onclick*="ppContainerSubTab"]');if(tab)ppSwitchSubtab('ppContainerSubTab',tab);}

/* Final geometry override: master data capacity and preview must use the same orientation/row rules. */
function ppCrateCalc(row){
 const d=ppDims(row.boxSize);if(!d||!d.l||!d.w||!d.h)return {valid:false,reason:'Box size missing'};
 const width=ppNum(row.crateWidth);if(width<=0)return {valid:false,reason:'Crate width missing'};
 const innerW=width-2*PP_WOOD_THICKNESS,maxPack=PP_MAX_PACKING_HEIGHT,rowMultiplier=Math.max(1,Math.min(3,Math.floor(ppNum(row.rowMultiplier)||1)));
 const requested=row.orientation||'auto',candidates=[];
 for(const key of ['height','width']){
  if(requested!=='auto'&&requested!==key)continue;
  const cross=key==='height'?d.w:d.h,vertical=key==='height'?d.h:d.w,across=Math.floor(innerW/cross),perLayer=across*rowMultiplier;
  if(across<1)continue;
  const maxPackUsed=ppNum(row.manualPackingH)>0?Math.min(maxPack,ppNum(row.manualPackingH)):maxPack;
  const maxLayers=Math.floor(maxPackUsed/vertical);if(maxLayers<1)continue;
  const layers=maxLayers,boxes=Math.max(1,perLayer*layers),packingH=ppNum(row.manualPackingH)>0?ppNum(row.manualPackingH):layers*vertical,overallH=packingH+PP_LEG_HEIGHT;
  const autoL=Math.ceil((ppNum(row.length)||d.l)+32)*rowMultiplier,outerL=ppNum(row.manualOuterL)||autoL;
  candidates.push({valid:packingH<=PP_MAX_PACKING_HEIGHT,box:d,orientation:key,rowMultiplier,outerL,outerW:width,packingH,overallH,perLayer,layers,boxesPerCrate:boxes,maxCapacity:perLayer*layers,maxLayers,manual:!!(row.manualOuterL||row.manualPackingH)});
 }
 if(!candidates.length)return {valid:false,reason:'Box cannot fit the crate width and height limits'};
 candidates.sort((a,b)=>(a.valid===b.valid?0:a.valid?-1:1)||b.maxCapacity-a.maxCapacity||a.overallH-b.overallH);
 const c=candidates[0];c.per=c.perLayer;c.rowMultiplier=rowMultiplier;
 if(!c.valid)c.reason=`Packing height ${c.packingH} mm exceeds ${PP_MAX_PACKING_HEIGHT} mm.`;
 return c;
}
function ppSmartShowPreview(i){
 const c=ppSmartCrates[i];if(!c)return;const host=document.getElementById('ppCrate3DPreview');if(!host)return;
 const mode=document.getElementById('ppSmartViewMode')?.value||'3d',items=c.items||[],parsed=items.map(it=>({it,d:ppDims(ppSmartMasterFor(it)?.boxSize)}));
 if(!parsed.length||parsed.some(x=>!x.d)){host.innerHTML='<div class="pp-empty">Box size missing. Update Crate Master Data first.</div>';return;}
 const calc=ppSmartCalcDims(items,{outerL:c.outerL,outerW:c.outerW,orientation:c.orientation||c.manual?.orientation||'auto',rowMultiplier:c.rowMultiplier||c.manual?.rowMultiplier||1});
 const orientation=c.orientation||calc.orientation||'height',per=Math.max(1,calc.perLayer||c.perLayer||1),layers=Math.max(1,calc.layers||c.layers||1),packH=ppNum(c.packingH)||calc.packingH||1,totalBoxes=items.reduce((s,it)=>s+ppNum(it.boxes),0),maxShow=72;
 const color=(i)=>i%2?'#d7ad76':'#edd0a0';let svg='';
 if(mode==='top'||mode==='side'){
  let rects='',n=0;items.forEach((it,idx)=>{for(let b=0;b<ppNum(it.boxes)&&n<maxShow;b++,n++){const col=n%per,row=Math.floor(n/per);if(mode==='top'){const cellW=700/per,cellH=420/layers;rects+=`<rect x="55" y="${45+row*cellH}" width="${Math.max(4,cellW-3)}" height="${Math.max(4,cellH-3)}" rx="2" fill="${color(idx)}" stroke="#84572c"/>`;}else{const cellW=740/per,cellH=420/layers;rects+=`<rect x="40" y="${45+row*cellH}" width="${Math.max(4,cellW-3)}" height="${Math.max(4,cellH-3)}" fill="${color(idx)}" stroke="#84572c"/>`;}}});
  svg=mode==='top'?`<svg viewBox="0 0 820 540"><rect x="25" y="25" width="770" height="450" rx="8" fill="#f7e7c8" stroke="#84572c" stroke-width="8"/>${rects}<text x="30" y="510" font-size="17" font-weight="700" fill="#164e63">Top view · ${c.outerL} × ${c.outerW} mm · ${c.rowMultiplier===3?'triple lengthwise rows':c.rowMultiplier===2?'double lengthwise rows':'single lengthwise row'}</text></svg>`:`<svg viewBox="0 0 820 540"><rect x="25" y="25" width="770" height="450" fill="#f7e7c8" stroke="#84572c" stroke-width="8"/>${rects}<rect x="35" y="465" width="60" height="50" fill="#a97842"/><rect x="725" y="465" width="60" height="50" fill="#a97842"/><text x="30" y="510" font-size="17" font-weight="700" fill="#164e63">Side view · ${layers} layers × ${Math.round(packH/layers)} mm = ${packH} mm packing height</text></svg>`;
 }else{
  const x=95,y=155,L=500,D=150,baseH=Math.max(70,Math.min(270,packH/3)),layerH=baseH/layers;let blocks='',n=0;
  for(let layer=0;layer<layers&&n<36;layer++)for(let col=0;col<per&&n<totalBoxes&&n<36;col++,n++){const xx=x+col*(L/per),ww=Math.max(10,L/per-3),yy=y-layer*layerH;blocks+=`<polygon points="${xx},${yy} ${xx+ww},${yy-10} ${xx+ww+D/per},${yy-10-55/per} ${xx+D/per},${yy-55/per}" fill="${color(n)}" stroke="#84572c"/><polygon points="${xx},${yy} ${xx+D/per},${yy-55/per} ${xx+D/per},${yy-55/per+layerH} ${xx},${yy+layerH}" fill="#b98549" stroke="#84572c"/>`;}
  svg=`<svg viewBox="0 0 820 590"><polygon points="${x},${y} ${x+L},${y-10} ${x+L+D},${y-65} ${x+D},${y-55}" fill="#f1dfbc" stroke="#754b26" stroke-width="6"/>${blocks}<polygon points="${x},${y} ${x+D},${y-55} ${x+D},${y-55+baseH} ${x},${y+baseH}" fill="#bc8749" stroke="#754b26" stroke-width="5"/><polygon points="${x},${y+baseH} ${x+L},${y+baseH-10} ${x+L},${y-10+baseH} ${x},${y+baseH}" fill="#c18b4e" stroke="#754b26" stroke-width="5"/><g fill="#9c6b37" stroke="#70451f" stroke-width="3"><rect x="${x+20}" y="${y+baseH}" width="24" height="60"/><rect x="${x+L-30}" y="${y+baseH-8}" width="24" height="60"/><rect x="${x+D+5}" y="${y-55+baseH-8}" width="24" height="60"/></g><text x="30" y="545" font-size="18" font-weight="700" fill="#164e63">${ppEsc(c.id)} · ${c.outerL} × ${c.outerW} × ${packH} mm packing</text><text x="30" y="570" font-size="15" fill="#164e63">${totalBoxes} boxes · ${items.reduce((s,it)=>s+ppNum(it.pcs),0).toLocaleString()} PCS · ${per} boxes/layer × ${layers} layers · ${orientation==='width'?'rotated':'standard'}</text></svg>`;
 }
 host.innerHTML=svg;const info=document.getElementById('ppCrate3DInfo');if(info)info.innerHTML=`<b>${ppEsc(c.id)}</b><br>${items.map(it=>`${ppEsc(it.po)} / ${ppEsc(it.profile)} / ${ppEsc(it.itemCode)} / ${ppEsc(it.length)} mm: ${ppNum(it.pcs).toLocaleString()} PCS (${it.boxes} boxes)`).join('<br>')}<br><b>Dimensions:</b> ${c.outerL} × ${c.outerW} × ${packH} mm packing; ${c.overallH||packH+PP_LEG_HEIGHT} mm overall including 100 mm legs.<br><b>Arrangement:</b> ${per} boxes/layer × ${layers} layers · ${c.rowMultiplier===3?'triple':c.rowMultiplier===2?'double':'single'} lengthwise row(s) · ${orientation==='width'?'box width vertical (rotated 90°)':'box height vertical (standard)'}.`;
 const sel=document.getElementById('ppSmartPreviewCrate');if(sel)sel.value=String(i);
}

function ppSmartRowModeChanged(){
 const r=ppSmartSelectedLine();if(!r){ppSmartDimensionChanged();return;}
 const mode=Math.max(1,Math.min(2,Math.floor(ppNum(document.getElementById('ppSmartRowMode')?.value)||1))),len=ppNum(r.length),el=document.getElementById('ppOuterCrateL'),normal=Math.ceil(len+32),double=Math.ceil((len+32)*2),current=ppNum(el?.value);
 if(el&&(!current||Math.abs(current-normal)<=50||Math.abs(current-double)<=50))el.value=Math.ceil((len+32)*mode);
 ppSmartDimensionChanged();
}
const ppOldMasterInlineDim=window.ppMasterInlineDim;
window.ppMasterInlineDim=function(index,field,value){
 const r=ppCrateMasterRows[index];if(!r)return;
 if(field==='rowMultiplier'){
  const old=Math.max(1,Math.min(3,Math.floor(ppNum(r.rowMultiplier)||1))),next=Number(value)===2?2:1;
  r.rowMultiplier=next;r.manualOuterL=Math.ceil((ppNum(r.length)+32)*next);r.manual=true;r.source='Manual / edited';r.calc=ppCrateCalc(r);ppRenderCrateMaster();ppPopulateCrateStandards();ppRefreshNextPlLines();ppSaveCrateMaster();return;
 }
 return ppOldMasterInlineDim.call(this,index,field,value);
};

/* AIS crate geometry correction (2026-10-10): use Master Data orientation/row settings,
   calculate actual packing height from allocated box count, and keep overall height <= 1200 mm. */
function ppCrateCalc(row){
 const d=ppDims(row.boxSize); if(!d||!d.l||!d.w||!d.h)return {valid:false,reason:'Box Size missing'};
 const width=ppNum(row.crateWidth); if(width<=0)return {valid:false,reason:'Crate Width missing'};
 const innerW=width-2*PP_WOOD_THICKNESS, maxPack=PP_MAX_PACKING_HEIGHT;
 const rowMultiplier=Math.max(1,Math.min(3,Math.floor(ppNum(row.rowMultiplier)||1))), requested=['height','width'].includes(row.orientation)?row.orientation:'auto', candidates=[];
 for(const orientation of ['height','width']){
  if(requested!=='auto'&&requested!==orientation)continue;
  const cross=orientation==='height'?d.w:d.h, vertical=orientation==='height'?d.h:d.w;
  const across=Math.floor(innerW/cross); if(across<1)continue;
  const perLayer=across*rowMultiplier, layers=Math.floor(maxPack/vertical); if(layers<1)continue;
  const packingH=layers*vertical, overallH=packingH+PP_LEG_HEIGHT;
  const outerL=ppNum(row.manualOuterL)||Math.ceil((ppNum(row.length)||d.l)+32)*rowMultiplier;
  candidates.push({valid:packingH<=PP_MAX_PACKING_HEIGHT,box:d,orientation,rowMultiplier,outerL,outerW:width,packingH,overallH,perLayer,layers,boxesPerCrate:perLayer*layers,maxCapacity:perLayer*layers,maxLayers:layers,vertical,cross});
 }
 if(!candidates.length)return {valid:false,reason:'Box orientation does not fit the crate width or height limit'};
 candidates.sort((a,b)=>(a.valid===b.valid?0:a.valid?-1:1)||b.maxCapacity-a.maxCapacity||a.overallH-b.overallH);
 const c=candidates[0];c.per=c.perLayer;c.manual=!!(row.manualOuterL);return c;
}
function ppSmartOrientationMetrics(items,manual={}){
 const parsed=(items||[]).map(it=>({it,m:ppSmartMasterFor(it),d:ppDims(ppSmartMasterFor(it)?.boxSize)}));
 if(!parsed.length||parsed.some(x=>!x.m||!x.d))return {valid:false,reason:'Box Size or Crate Width is missing. Complete Crate Master Data first.'};
 const width=ppNum(manual.outerW)||Math.max(...parsed.map(x=>ppNum(x.m.crateWidth)));
 if(width<=0)return {valid:false,reason:'Crate Width is missing in Crate Master Data.'};
 const innerW=width-2*PP_WOOD_THICKNESS,maxPack=PP_MAX_PACKING_HEIGHT;
 const requested=['height','width'].includes(manual.orientation)?manual.orientation:'auto';
 const rowMultiplier=Math.max(1,Math.min(3,Math.floor(ppNum(manual.rowMultiplier)||Math.max(...parsed.map(x=>ppNum(x.m.rowMultiplier)||1)))));
 const boxes=parsed.reduce((sum,x)=>sum+Math.max(0,Math.floor(ppNum(x.it.boxes)||Math.ceil(ppNum(x.it.pcs)/Math.max(1,ppNum(x.it.pcsPerBox)||ppNum(x.m.pcsPerBox)||1)))),0);
 if(boxes<=0)return {valid:false,reason:'Enter PCS to allocate before calculating crate height.'};
 const candidates=[];
 for(const orientation of ['height','width']){
  if(requested!=='auto'&&requested!==orientation)continue;
  const cross=Math.max(...parsed.map(x=>orientation==='height'?x.d.w:x.d.h));
  const vertical=Math.max(...parsed.map(x=>orientation==='height'?x.d.h:x.d.w));
  const across=Math.floor(innerW/cross);if(across<1)continue;
  const perLayer=across*rowMultiplier,layers=Math.ceil(boxes/perLayer),packingH=layers*vertical,overallH=packingH+PP_LEG_HEIGHT;
  const profileLength=Math.max(...parsed.map(x=>ppNum(x.it.length)||0));
  const outerL=ppNum(manual.outerL)||Math.ceil((profileLength+32)*rowMultiplier);
  candidates.push({valid:packingH<=PP_MAX_PACKING_HEIGHT,orientation,rowMultiplier,width,innerW,perLayer,layers,boxes,packingH,overallH,maxCapacity:perLayer*Math.floor(maxPack/vertical),maxLayers:Math.floor(maxPack/vertical),maxAcross:cross,maxVertical:vertical,outerL,outerW:width});
 }
 if(!candidates.length)return {valid:false,reason:'Neither box orientation fits the crate width and maximum packing height.'};
 candidates.sort((a,b)=>(a.valid===b.valid?0:a.valid?-1:1)||b.maxCapacity-a.maxCapacity||a.overallH-b.overallH);
 const chosen=candidates[0];
 if(!chosen.valid)return {...chosen,valid:false,reason:`This box quantity needs ${chosen.packingH} mm packing height. Maximum packing height is ${PP_MAX_PACKING_HEIGHT} mm. Reduce PCS, choose the other box orientation, or use another crate.`};
 return chosen;
}
function ppSmartCalcDims(items,manual={}){const c=ppSmartOrientationMetrics(items,manual);return c.valid?{...c,per:c.perLayer,packingH:c.packingH,overallH:c.overallH,perLayer:c.perLayer,layers:c.layers,boxes:c.boxes,orientation:c.orientation,rowMultiplier:c.rowMultiplier}:c;}
function ppSmartDimensionChanged(){
 const r=ppSmartSelectedLine(); if(!r){ppSmartUpdateAllocationPreview();return;}
 const m=ppSmartMasterFor(r),pcs=Math.max(0,Math.floor(ppNum(document.getElementById('ppSmartAllocatePcs')?.value))),pbox=ppSmartPcsBox(r);
 const crate=ppSmartCrates.find(c=>c.id===ppSmartSelectedCrateId());
 const current=crate?(crate.items||[]):[];
 const same=current.find(it=>it.lineKey===ppSmartLineKey(r));
 const newQty=pcs+(same?ppNum(same.pcs):0);
 const item={lineKey:ppSmartLineKey(r),po:r.poNumber,profile:r.profile,itemCode:r.itemCode,length:r.length,pcs:newQty,pcsPerBox:pbox,boxes:newQty?Math.ceil(newQty/pbox):0,unitWeight:ppNum(r.unitWeight||m?.unitWeight)};
 const items=same?current.map(it=>it===same?item:it):[...current,item];
 const manual={outerL:ppNum(document.getElementById('ppOuterCrateL')?.value)||ppNum(crate?.outerL)||Math.ceil((ppNum(r.length)+32)*(ppNum(document.getElementById('ppSmartRowMode')?.value||m?.rowMultiplier)||1)),outerW:ppNum(document.getElementById('ppOuterCrateW')?.value)||ppNum(crate?.outerW)||ppNum(m?.crateWidth),orientation:document.getElementById('ppBoxOrientation')?.value||m?.orientation||'auto',rowMultiplier:ppNum(document.getElementById('ppSmartRowMode')?.value)||ppNum(m?.rowMultiplier)||1};
 const calc=pcs>0?ppSmartCalcDims(items,manual):null,hEl=document.getElementById('ppCrateH'),note=document.getElementById('ppOrientationFitNote');
 if(hEl){hEl.readOnly=true;hEl.value=calc?.packingH||'';hEl.title='Automatically calculated from allocated box quantity, Master Data orientation and boxes per layer.';}
 ppSmartUpdateAllocationPreview();
 if(note&&pcs>0){const totalBoxes=items.reduce((s,x)=>s+ppNum(x.boxes),0);if(calc?.valid){note.dataset.fit='yes';note.innerHTML=`<b>Master Data calculation:</b> ${totalBoxes} boxes ÷ ${calc.perLayer} boxes/layer = ${calc.layers} layers. <b>Packing height ${calc.packingH} mm</b> + ${PP_LEG_HEIGHT} mm legs = <b>${calc.overallH} mm overall</b>.<br><b>Orientation:</b> ${calc.orientation==='height'?'Box width across crate; box height vertical':'Box height across crate; box width vertical (rotate 90°)'}. ${calc.rowMultiplier===3?'Triple lengthwise rows.':calc.rowMultiplier===2?'Double lengthwise rows.':'Single lengthwise row.'}`;}else if(calc){note.dataset.fit='no';note.innerHTML=`<b style="color:#b91c1c">Cannot fit:</b> ${ppEsc(calc.reason||'Review crate dimensions and box orientation.')}<br>Calculated required packing height: ${calc.packingH||'—'} mm.`;}else{note.innerHTML='Enter PCS to calculate boxes per layer and packing height.';}}
}
function ppOnNextPlLineChange(){
 const sel=document.getElementById('ppNextPlLine');
 if(!sel||sel.value===''){ppSmartClearSelectedLine();ppSmartUpdateAllocationPreview();return;}
 const r=ppCrateNextRows[Number(sel.value)];if(!r){ppSmartClearSelectedLine();return;}
 const set=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v??'';};
 set('ppPlanPo',r.poNumber);set('ppPlanProfile',r.profile);set('ppPlanItemCode',r.itemCode);set('ppPlanLength',r.length);set('ppPlanQty',Math.floor(ppNum(r.planningQty)));
 const m=ppSmartMasterFor(r),cap=ppSmartPcsBox(r);set('ppPlanPcsPerBox',cap);set('ppPlanBoxQty',Math.ceil(ppNum(r.planningQty)/cap));
 const rowMode=document.getElementById('ppSmartRowMode');if(rowMode)rowMode.value=String(m?.rowMultiplier||1);
 const orient=document.getElementById('ppBoxOrientation');if(orient)orient.value=m?.orientation||'auto';
 set('ppOuterCrateL',m?.manualOuterL||Math.ceil((ppNum(r.length)+32)*(ppNum(rowMode?.value)||1)));set('ppOuterCrateW',m?.crateWidth||'');set('ppCrateH','');set('ppSmartAllocatePcs','');
 const h=document.getElementById('ppCrateH');if(h){h.readOnly=true;h.title='Auto-calculated from Master Data and allocated boxes.';}
 ppSmartUpdateAllocationPreview();ppSmartDimensionChanged();
}
function ppSmartAddCrateFromSelected(){
 const r=ppSmartSelectedLine();if(!r){alert('Select a Next Planning PL line first.');return;}
 const m=ppSmartMasterFor(r),box=ppDims(m?.boxSize);if(!m||!box||!ppNum(m.crateWidth)){alert('Complete Box Size and Crate Width in Crate Master Data first.');return;}
 const requested=Math.floor(ppNum(document.getElementById('ppSmartAllocatePcs')?.value));if(requested<1){alert('Enter PCS to allocate to this crate.');return;}
 const balance=ppSmartLineBalance(r);if(requested>balance){alert(`Only ${balance.toLocaleString()} PCS remain for ${r.poNumber} / ${r.profile} / ${r.itemCode} / ${r.length} mm.`);return;}
 const id=ppSmartSelectedCrateId();let crate=ppSmartCrates.find(c=>c.id===id);const isNew=!crate;if(!crate)crate={id,items:[],createdAt:Date.now(),manual:{}};
 const key=ppSmartLineKey(r),existing=crate.items.find(it=>it.lineKey===key),pcsPerBox=ppSmartPcsBox(r),newPCS=requested+(existing?ppNum(existing.pcs):0);
 const item={lineKey:key,po:r.poNumber,profile:r.profile,itemCode:r.itemCode,length:r.length,pcs:newPCS,pcsPerBox,boxes:Math.ceil(newPCS/pcsPerBox),unitWeight:ppNum(r.unitWeight||m.unitWeight)};
 const items=existing?crate.items.map(it=>it===existing?item:it):[...crate.items,item];
 const manual={...(crate.manual&&typeof crate.manual==='object'?crate.manual:{}),outerL:ppNum(document.getElementById('ppOuterCrateL')?.value)||ppNum(crate.outerL)||Math.ceil((ppNum(r.length)+32)*(ppNum(document.getElementById('ppSmartRowMode')?.value||m.rowMultiplier)||1)),outerW:ppNum(document.getElementById('ppOuterCrateW')?.value)||ppNum(crate.outerW)||ppNum(m.crateWidth),orientation:document.getElementById('ppBoxOrientation')?.value||m.orientation||'auto',rowMultiplier:ppNum(document.getElementById('ppSmartRowMode')?.value)||ppNum(m.rowMultiplier)||1};
 const calc=ppSmartCalcDims(items,manual);if(!calc.valid){alert(calc.reason||'This box quantity does not fit. Reduce PCS, change orientation, or use another crate.');return;}
 if(isNew)ppSmartCrates.push(crate);crate.items=items;Object.assign(crate,{outerL:calc.outerL,outerW:calc.outerW,packingH:calc.packingH,overallH:calc.overallH,perLayer:calc.perLayer,layers:calc.layers,boxes:calc.boxes,orientation:calc.orientation,rowMultiplier:calc.rowMultiplier,manual:{...manual,outerL:calc.outerL,outerW:calc.outerW,orientation:calc.orientation,rowMultiplier:calc.rowMultiplier}});
 ppSmartPersist();ppSmartRenderCrateList();ppSmartUpdateAllocationPreview();ppSmartRefreshPreviewOptions();
 const pcsInput=document.getElementById('ppSmartAllocatePcs');if(pcsInput)pcsInput.value='';ppSmartUpdateAllocationPreview();ppSmartShowPreview(ppSmartCrates.indexOf(crate));
 if(typeof showToast==='function')showToast(`${requested} PCS added to ${id}. Save the crate list to sync to cloud.`,'success');
}
function ppRenderCrateMaster(){
 const body=document.getElementById('ppCrateMasterBody');if(!body)return;const q=(document.getElementById('ppCrateMasterSearch')?.value||'').toLowerCase();
 const rows=ppCrateMasterRows.filter(r=>[r.profile,r.itemCode,r.length,r.boxSize,r.crateWidth].join(' ').toLowerCase().includes(q));
 const matched=ppCrateMasterRows.filter(r=>r.excelMatched).length,missing=ppCrateMasterRows.filter(r=>!r.boxSize||!r.crateWidth||!r.calc?.valid).length;
 const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};set('ppCrateMasterCount',ppCrateMasterRows.length);set('ppCrateMasterMatched',matched);set('ppCrateMasterMissing',missing);
 body.innerHTML=rows.length?rows.map(r=>{const k=ppMasterKey(r.profile,r.itemCode,r.length),idx=ppCrateMasterRows.indexOf(r),c=ppCrateCalc(r),status=(!r.boxSize||!r.crateWidth||!c.valid)?'<span style="color:#b45309;font-weight:800">⚠ Manual data needed</span>':(r.excelMatched?'<span style="color:#047857;font-weight:800">✓ Excel matched</span>':'<span style="color:#1d4ed8;font-weight:800">✎ Manual / Catalog</span>');
 const field=(name,val)=>`<input class="pp-inline-dim" aria-label="${name}" title="Edit ${name}" type="number" min="1" step="1" value="${ppEsc(val??'')}" onchange="ppUpdateCrateMasterField(${idx},'${name}',this.value)" style="width:88px;min-width:72px;padding:8px;border:1px solid #93c5fd;border-radius:8px;background:#f0f9ff;color:#12364d;font-weight:700">`;
 return `<tr><td><b>${ppEsc(r.profile)}</b></td><td>${ppEsc(r.itemCode||'—')}</td><td>${ppEsc(r.length)}</td><td>${r.pcsPerBox||1}</td><td>${ppEsc(r.boxSize||'—')}</td><td>${field('crateWidth',r.crateWidth||'')}</td><td>${field('manualOuterL',r.manualOuterL||c.outerL||'')}</td><td><strong>${c.valid?c.packingH+' mm':'—'}</strong><small class="pp-cell-hint">Auto from orientation / layers</small></td><td><strong>${c.valid?c.overallH+' mm':'—'}</strong><small class="pp-cell-hint">Max packing 1100 mm</small></td><td><strong>${c.valid?c.perLayer:'—'}</strong><small class="pp-cell-hint">Boxes per layer</small></td><td><label class="pp-control-label"><i class="fa-solid fa-arrows-up-down-left-right"></i> Vertical box side</label><select class="pp-master-select" aria-label="Box orientation" title="Height vertical: box width across the crate; Width vertical (rotate): box height across the crate" onchange="ppMasterInlineDim(${idx},'orientation',this.value)"><option value="auto" ${(r.orientation||'auto')==='auto'?'selected':''}>✨ Auto best fit</option><option value="height" ${r.orientation==='height'?'selected':''}>↕ Height vertical</option><option value="width" ${r.orientation==='width'?'selected':''}>↻ Width vertical (rotate)</option></select><button class="btn btn-sm pp-preview-btn" onclick="ppMasterPreview(${idx})"><i class="fa-solid fa-cubes-stacked"></i> Preview</button></td><td><label class="pp-control-label"><i class="fa-solid fa-layer-group"></i> Boxes across length</label><select class="pp-master-select" aria-label="Lengthwise rows" title="Double row doubles crate length and boxes per layer" onchange="ppMasterInlineDim(${idx},'rowMultiplier',this.value)"><option value="1" ${(ppNum(r.rowMultiplier)||1)===1?'selected':''}>1 row · Single</option><option value="2" ${ppNum(r.rowMultiplier)===2?'selected':''}>2 rows · Double</option><option value="3" ${ppNum(r.rowMultiplier)===3?'selected':''}>3 rows · Triple</option></select><small class="pp-cell-hint">${(ppNum(r.rowMultiplier)||1)===2?'Double crate length':'Single crate length'}</small></td><td><strong>${c.valid?c.boxesPerCrate:'—'}</strong></td><td>${status}</td><td><button class="btn btn-sm" onclick="ppEditCrateMaster('${encodeURIComponent(k)}')"><i class="fa-solid fa-pen-to-square"></i> Edit Box / PCS</button></td></tr>`;
 }).join(''):'<tr><td colspan="14">No matching Master Catalog records.</td></tr>';
}

/* Final follow-up: existing crate dimensions take precedence when adding another profile. */
const ppSmartDimensionChangedMasterAware = ppSmartDimensionChanged;
ppSmartDimensionChanged = function(){
 const r=ppSmartSelectedLine();if(!r){ppSmartUpdateAllocationPreview();return;}
 const m=ppSmartMasterFor(r),pcs=Math.max(0,Math.floor(ppNum(document.getElementById('ppSmartAllocatePcs')?.value))),pbox=ppSmartPcsBox(r),crate=ppSmartCrates.find(c=>c.id===ppSmartSelectedCrateId()),current=crate?(crate.items||[]):[],same=current.find(it=>it.lineKey===ppSmartLineKey(r)),newQty=pcs+(same?ppNum(same.pcs):0);
 const item={lineKey:ppSmartLineKey(r),po:r.poNumber,profile:r.profile,itemCode:r.itemCode,length:r.length,pcs:newQty,pcsPerBox:pbox,boxes:newQty?Math.ceil(newQty/pbox):0,unitWeight:ppNum(r.unitWeight||m?.unitWeight)};
 const items=same?current.map(it=>it===same?item:it):[...current,item];
 const rowMode=Math.max(1,Math.min(2,Math.floor(ppNum(document.getElementById('ppSmartRowMode')?.value)||ppNum(m?.rowMultiplier)||1)));
 const manual={outerL:ppNum(crate?.outerL)||ppNum(document.getElementById('ppOuterCrateL')?.value)||Math.ceil((ppNum(r.length)+32)*rowMode),outerW:ppNum(crate?.outerW)||ppNum(document.getElementById('ppOuterCrateW')?.value)||ppNum(m?.crateWidth),orientation:crate?.orientation||document.getElementById('ppBoxOrientation')?.value||m?.orientation||'auto',rowMultiplier:ppNum(crate?.rowMultiplier)||rowMode};
 const calc=pcs>0?ppSmartCalcDims(items,manual):null,hEl=document.getElementById('ppCrateH'),note=document.getElementById('ppOrientationFitNote');
 if(hEl){hEl.readOnly=true;hEl.value=calc?.packingH||'';hEl.title='Auto-calculated: boxes needed ÷ boxes per layer × vertical box dimension.';}
 ppSmartUpdateAllocationPreview();
 if(note&&pcs>0){const totalBoxes=items.reduce((s,x)=>s+ppNum(x.boxes),0);if(calc?.valid){note.dataset.fit='yes';note.innerHTML=`<b>Master Data calculation:</b> ${totalBoxes} boxes ÷ ${calc.perLayer} boxes/layer = ${calc.layers} layers. <b>Packing height ${calc.packingH} mm</b> + ${PP_LEG_HEIGHT} mm legs = <b>${calc.overallH} mm overall</b>.<br><b>Orientation:</b> ${calc.orientation==='height'?'Box width across crate; box height vertical':'Box height across crate; box width vertical (rotate 90°)'}. ${calc.rowMultiplier===3?'Triple lengthwise rows.':calc.rowMultiplier===2?'Double lengthwise rows.':'Single lengthwise row.'}`;}else if(calc){note.dataset.fit='no';note.innerHTML=`<b style="color:#b91c1c">Cannot fit:</b> ${ppEsc(calc.reason||'Review crate dimensions and box orientation.')}<br>Calculated required packing height: ${calc.packingH||'—'} mm.`;}else note.innerHTML='Enter PCS to calculate boxes per layer and packing height.';}
};
const ppSmartAddCrateFromSelectedMasterAware=ppSmartAddCrateFromSelected;
ppSmartAddCrateFromSelected=function(){
 const r=ppSmartSelectedLine();if(!r){alert('Select a Next Planning PL line first.');return;}const m=ppSmartMasterFor(r),box=ppDims(m?.boxSize);if(!m||!box||!ppNum(m.crateWidth)){alert('Complete Box Size and Crate Width in Crate Master Data first.');return;}
 const requested=Math.floor(ppNum(document.getElementById('ppSmartAllocatePcs')?.value));if(requested<1){alert('Enter PCS to allocate to this crate.');return;}const balance=ppSmartLineBalance(r);if(requested>balance){alert(`Only ${balance.toLocaleString()} PCS remain for ${r.poNumber} / ${r.profile} / ${r.itemCode} / ${r.length} mm.`);return;}
 const id=ppSmartSelectedCrateId();let crate=ppSmartCrates.find(c=>c.id===id);const isNew=!crate;if(!crate)crate={id,items:[],createdAt:Date.now(),manual:{}};
 const key=ppSmartLineKey(r),existing=crate.items.find(it=>it.lineKey===key),pcsPerBox=ppSmartPcsBox(r),newPCS=requested+(existing?ppNum(existing.pcs):0),item={lineKey:key,po:r.poNumber,profile:r.profile,itemCode:r.itemCode,length:r.length,pcs:newPCS,pcsPerBox,boxes:Math.ceil(newPCS/pcsPerBox),unitWeight:ppNum(r.unitWeight||m.unitWeight)};
 const items=existing?crate.items.map(it=>it===existing?item:it):[...crate.items,item],rowMode=Math.max(1,Math.min(2,Math.floor(ppNum(document.getElementById('ppSmartRowMode')?.value)||ppNum(m.rowMultiplier)||1)));
 const manual={...(crate.manual&&typeof crate.manual==='object'?crate.manual:{}),outerL:ppNum(crate.outerL)||ppNum(document.getElementById('ppOuterCrateL')?.value)||Math.ceil((ppNum(r.length)+32)*rowMode),outerW:ppNum(crate.outerW)||ppNum(document.getElementById('ppOuterCrateW')?.value)||ppNum(m.crateWidth),orientation:crate.orientation||document.getElementById('ppBoxOrientation')?.value||m.orientation||'auto',rowMultiplier:ppNum(crate.rowMultiplier)||rowMode};
 const calc=ppSmartCalcDims(items,manual);if(!calc.valid){alert(calc.reason||'This box quantity does not fit. Reduce PCS, change orientation, or use another crate.');return;}
 if(isNew)ppSmartCrates.push(crate);crate.items=items;Object.assign(crate,{outerL:calc.outerL,outerW:calc.outerW,packingH:calc.packingH,overallH:calc.overallH,perLayer:calc.perLayer,layers:calc.layers,boxes:calc.boxes,orientation:calc.orientation,rowMultiplier:calc.rowMultiplier,manual:{...manual,outerL:calc.outerL,outerW:calc.outerW,orientation:calc.orientation,rowMultiplier:calc.rowMultiplier}});
 ppSmartPersist();ppSmartRenderCrateList();ppSmartUpdateAllocationPreview();ppSmartRefreshPreviewOptions();const input=document.getElementById('ppSmartAllocatePcs');if(input)input.value='';ppSmartUpdateAllocationPreview();ppSmartShowPreview(ppSmartCrates.indexOf(crate));if(typeof showToast==='function')showToast(`${requested} PCS added to ${id}.`,'success');
};
function ppMasterPreview(index){const r=ppCrateMasterRows[index];if(!r)return;const c=ppCrateCalc(r),d=ppDims(r.boxSize);if(!d||!c.valid){alert('Please set valid box size, crate width and orientation first.');return;}const rowMultiplier=Math.max(1,Math.min(3,Math.floor(ppNum(r.rowMultiplier)||1))),boxesPerLayer=c.perLayer,layers=c.layers,packingH=c.packingH,outerL=ppNum(r.manualOuterL)||Math.ceil((ppNum(r.length)+32)*rowMultiplier);const temp={id:'MASTER PREVIEW',items:[{profile:r.profile,itemCode:r.itemCode,length:r.length,pcsPerBox:r.pcsPerBox,pcs:boxesPerLayer*layers*r.pcsPerBox,boxes:boxesPerLayer*layers,lineKey:'master-preview'}],outerL,outerW:ppNum(r.crateWidth),packingH,overallH:packingH+PP_LEG_HEIGHT,perLayer:boxesPerLayer,layers,boxes:boxesPerLayer*layers,orientation:r.orientation||c.orientation||'auto',rowMultiplier};const old=ppSmartCrates;ppSmartCrates=[temp];ppSmartShowPreview(0);ppSmartCrates=old;ppSmartRefreshPreviewOptions();const tab=document.querySelector('#packingPlannerTab .pp-subtab[onclick*="ppContainerSubTab"]');if(tab)ppSwitchSubtab('ppContainerSubTab',tab);}
function ppEditCrateMaster(enc){const k=decodeURIComponent(enc),r=ppCrateMasterRows.find(x=>ppMasterKey(x.profile,x.itemCode,x.length)===k);if(!r)return;const box=prompt(`Box Size L × W × H (mm) — ${r.profile} / ${r.itemCode} / ${r.length}`,r.boxSize||'');if(box===null)return;const parsed=ppDims(box);if(!parsed){alert('Enter box dimensions as Length × Width × Height, for example 1739 x 265 x 125.');return;}const pcs=prompt('PCS per Box — value from Master Catalog',String(r.pcsPerBox||1));if(pcs===null)return;const cap=Math.floor(ppNum(pcs));if(cap<1){alert('PCS per Box must be at least 1.');return;}r.boxSize=box.trim();r.pcsPerBox=cap;r.manual=true;r.source='Manual / edited';r.calc=ppCrateCalc(r);ppRenderCrateMaster();ppPopulateCrateStandards();ppRefreshNextPlLines();ppSaveCrateMaster();}
/* AIS Planner follow-up: only selected Next PL rows; support 1/2/3 lengthwise rows. */
function ppGetPlanningRows(){
 try { const rows=typeof nextPlGetRows==='function'?nextPlGetRows():[]; return rows.map(r=>{const key=String(r.rowKey??'');const q=typeof nextPlSelection!=='undefined'?Math.max(0,ppNum(nextPlSelection[key])):Math.max(0,ppNum(r.selectedQty));return {...r,selectedQty:q,planningQty:q};}).filter(r=>r.poNumber&&r.profile&&r.length&&r.planningQty>0&&!r.excluded); }
 catch(e){console.warn('Next PL rows unavailable',e);return [];}
}
function ppRefreshNextPlLines(){
 const sel=document.getElementById('ppNextPlLine');if(!sel)return;const prev=sel.value!==''?ppCrateNextRows[Number(sel.value)]:null;const key=prev?ppSmartLineKey(prev):'';ppCrateNextRows=ppGetPlanningRows();
 sel.innerHTML='<option value="">Select a selected Next Planning PL line</option>'+ppCrateNextRows.map((r,i)=>`<option value="${i}">${ppEsc(r.poNumber)} · ${ppEsc(r.profile)} · ${ppEsc(r.itemCode)} · ${ppEsc(r.length)} mm · ${Math.floor(ppNum(r.planningQty)).toLocaleString()} PCS</option>`).join('');
 const i=key?ppCrateNextRows.findIndex(r=>ppSmartLineKey(r)===key):-1;sel.value=i>=0?String(i):'';if(sel.value)ppOnNextPlLineChange();else ppSmartClearSelectedLine();
}
function ppOnNextPlLineChange(){
 const sel=document.getElementById('ppNextPlLine');if(!sel||sel.value===''){ppSmartClearSelectedLine();ppSmartUpdateAllocationPreview();return;}const r=ppCrateNextRows[Number(sel.value)];if(!r||ppNum(r.planningQty)<=0){ppSmartClearSelectedLine();return;}
 const set=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v??'';};set('ppPlanPo',r.poNumber);set('ppPlanProfile',r.profile);set('ppPlanItemCode',r.itemCode);set('ppPlanLength',r.length);set('ppPlanQty',Math.floor(ppNum(r.planningQty)));
 const m=ppSmartMasterFor(r),cap=ppSmartPcsBox(r);set('ppPlanPcsPerBox',cap);set('ppPlanBoxQty',Math.ceil(ppNum(r.planningQty)/cap));const row=document.getElementById('ppSmartRowMode');if(row)row.value=String(Math.max(1,Math.min(3,Math.floor(ppNum(m?.rowMultiplier)||1))));const ori=document.getElementById('ppBoxOrientation');if(ori)ori.value=m?.orientation||'auto';set('ppOuterCrateL',m?.manualOuterL||Math.ceil((ppNum(r.length)+32)*(ppNum(row?.value)||1)));set('ppOuterCrateW',m?.crateWidth||'');set('ppCrateH','');set('ppSmartAllocatePcs','');ppSmartUpdateAllocationPreview();ppSmartDimensionChanged();
}
function ppCrateCalc(row){
 const d=ppDims(row.boxSize);if(!d||!d.l||!d.w||!d.h)return {valid:false,reason:'Box Size missing'};const width=ppNum(row.crateWidth);if(width<=0)return {valid:false,reason:'Crate Width missing'};
 const maxPack=PP_MAX_PACKING_HEIGHT,rows=Math.max(1,Math.min(3,Math.floor(ppNum(row.rowMultiplier)||1))),requested=['height','width'].includes(row.orientation)?row.orientation:'auto',c=[];
 // AIS packing rule: use the full crate width for box fit; do not subtract timber width here.
 // Height-vertical: box W across crate, box H is vertical. Width-vertical: box H across crate, box W is vertical.
 for(const orientation of ['height','width']){if(requested!=='auto'&&requested!==orientation)continue;const acrossDim=orientation==='height'?d.w:d.h,vertical=orientation==='height'?d.h:d.w,across=Math.floor(width/acrossDim);if(across<1||vertical<1)continue;const perLayer=across*rows,layers=Math.floor(maxPack/vertical),packingH=layers*vertical,overallH=packingH+PP_LEG_HEIGHT,outerL=ppNum(row.manualOuterL)||Math.ceil((ppNum(row.length)||d.l)+32)*rows;c.push({valid:packingH<=PP_MAX_PACKING_HEIGHT,box:d,orientation,rowMultiplier:rows,outerL,outerW:width,packingH,overallH,perLayer,layers,boxesPerCrate:perLayer*layers,maxCapacity:perLayer*layers,vertical,cross:acrossDim,boxesAcross:across});}
 if(!c.length)return {valid:false,reason:'Box orientation does not fit crate width/height'};c.sort((a,b)=>(a.valid===b.valid?0:a.valid?-1:1)||b.maxCapacity-a.maxCapacity);return {...c[0],per:c[0].perLayer};
}
function ppSmartOrientationMetrics(items,manual={}){
 const parsed=(items||[]).map(it=>({it,m:ppSmartMasterFor(it),d:ppDims(ppSmartMasterFor(it)?.boxSize)}));if(!parsed.length||parsed.some(x=>!x.m||!x.d))return {valid:false,reason:'Box Size or Crate Width is missing. Complete Crate Master Data first.'};
 const width=ppNum(manual.outerW)||Math.max(...parsed.map(x=>ppNum(x.m.crateWidth)));if(width<=0)return {valid:false,reason:'Crate Width missing'};const maxPack=PP_MAX_PACKING_HEIGHT,requested=['height','width'].includes(manual.orientation)?manual.orientation:'auto';const masterRows=Math.max(...parsed.map(x=>Math.min(3,ppNum(x.m.rowMultiplier)||1)));const rows=Math.max(1,Math.min(3,Math.floor(ppNum(manual.rowMultiplier)||masterRows)));
 const boxes=parsed.reduce((s,x)=>{const cap=Math.max(1,ppNum(x.it.pcsPerBox)||ppNum(x.m.pcsPerBox)||1);const n=ppNum(x.it.boxes)||Math.ceil(ppNum(x.it.pcs)/cap);return s+Math.max(0,Math.floor(n));},0);if(boxes<=0)return {valid:false,reason:'Enter PCS to calculate crate height'};const c=[];
 for(const orientation of ['height','width']){if(requested!=='auto'&&requested!==orientation)continue;const acrossDim=Math.max(...parsed.map(x=>orientation==='height'?x.d.w:x.d.h)),vertical=Math.max(...parsed.map(x=>orientation==='height'?x.d.h:x.d.w)),across=Math.floor(width/acrossDim);if(across<1||vertical<1)continue;const perLayer=across*rows,layers=Math.ceil(boxes/perLayer),packingH=layers*vertical,overallH=packingH+PP_LEG_HEIGHT,maxLayers=Math.floor(maxPack/vertical),length=Math.max(...parsed.map(x=>ppNum(x.it.length)||0)),outerL=ppNum(manual.outerL)||Math.ceil(length+32)*rows;c.push({valid:packingH<=PP_MAX_PACKING_HEIGHT,orientation,rowMultiplier:rows,width,perLayer,layers,boxes,packingH,overallH,maxCapacity:perLayer*maxLayers,maxLayers,maxAcross:across,maxVertical:vertical,outerL,outerW:width,boxesAcross:across});}
 if(!c.length)return {valid:false,reason:'Neither box orientation fits the crate width'};c.sort((a,b)=>(a.valid===b.valid?0:a.valid?-1:1)||b.maxCapacity-a.maxCapacity||a.overallH-b.overallH);const best=c[0];return best.valid?best:{...best,valid:false,reason:`Needs ${best.packingH} mm packing height; maximum is ${PP_MAX_PACKING_HEIGHT} mm. Reduce PCS, change orientation or use another crate.`};
}
function ppSmartCalcDims(items,manual={}){const c=ppSmartOrientationMetrics(items,manual);return c.valid?{...c,per:c.perLayer,packingH:c.packingH,overallH:c.overallH,perLayer:c.perLayer,layers:c.layers,boxes:c.boxes,orientation:c.orientation,rowMultiplier:c.rowMultiplier}:c;}
function ppSmartRowModeChanged(){const r=ppSmartSelectedLine(),mode=Math.max(1,Math.min(3,Math.floor(ppNum(document.getElementById('ppSmartRowMode')?.value)||1))),el=document.getElementById('ppOuterCrateL');if(r&&el){const base=Math.ceil(ppNum(r.length)+32),cur=ppNum(el.value);if(!cur||[1,2,3].some(n=>Math.abs(cur-base*n)<=50))el.value=base*mode;}ppSmartDimensionChanged();}
function ppSmartDimensionChanged(){
 const r=ppSmartSelectedLine();if(!r){ppSmartUpdateAllocationPreview();return;}const m=ppSmartMasterFor(r),pcs=Math.max(0,Math.floor(ppNum(document.getElementById('ppSmartAllocatePcs')?.value))),pbox=ppSmartPcsBox(r),crate=ppSmartCrates.find(c=>c.id===ppSmartSelectedCrateId()),current=crate?.items||[],same=current.find(it=>it.lineKey===ppSmartLineKey(r)),qty=pcs+(same?ppNum(same.pcs):0),item={lineKey:ppSmartLineKey(r),po:r.poNumber,profile:r.profile,itemCode:r.itemCode,length:r.length,pcs:qty,pcsPerBox:pbox,boxes:qty?Math.ceil(qty/pbox):0,unitWeight:ppNum(r.unitWeight||m?.unitWeight)},items=same?current.map(it=>it===same?item:it):[...current,item];
 const rows=Math.max(1,Math.min(3,Math.floor(ppNum(document.getElementById('ppSmartRowMode')?.value)||ppNum(m?.rowMultiplier)||1))),manual={outerL:ppNum(document.getElementById('ppOuterCrateL')?.value)||ppNum(crate?.outerL)||Math.ceil((ppNum(r.length)+32)*rows),outerW:ppNum(document.getElementById('ppOuterCrateW')?.value)||ppNum(crate?.outerW)||ppNum(m?.crateWidth),orientation:document.getElementById('ppBoxOrientation')?.value||m?.orientation||'auto',rowMultiplier:rows},calc=pcs>0?ppSmartCalcDims(items,manual):null;
 const h=document.getElementById('ppCrateH'),b=document.getElementById('ppSmartAllocateBoxes'),note=document.getElementById('ppOrientationFitNote');if(h){h.readOnly=true;h.value=calc?.packingH||'';}if(b)b.value=pcs?Math.ceil(pcs/pbox):'';ppSmartUpdateAllocationPreview();if(!note)return;
 if(pcs<=0)note.innerHTML=`<b>Selected PO:</b> ${ppEsc(r.poNumber)} · Profile ${ppEsc(r.profile)} · ${ppEsc(r.itemCode)} · ${ppEsc(r.length)} mm. Next PL quantity: ${Math.floor(ppNum(r.planningQty)).toLocaleString()} PCS. Enter PCS for this crate.`;
 else if(calc?.valid){const across=Math.floor(manual.outerW/(calc.orientation==='height'?ppDims(m?.boxSize)?.w:ppDims(m?.boxSize)?.h));note.innerHTML=`<b>PO ${ppEsc(r.poNumber)}</b> · Next PL ${Math.floor(ppNum(r.planningQty)).toLocaleString()} PCS · allocated ${Math.floor(ppNum(r.planningQty))-ppSmartLineBalance(r)} PCS · balance ${ppSmartLineBalance(r)} PCS.<br><b>Calculation:</b> ${items.reduce((s,x)=>s+ppNum(x.boxes),0)} boxes ÷ (${across} boxes across × ${rows} lengthwise row(s)) = ${calc.layers} layers. Packing height = ${calc.packingH} mm; overall = ${calc.overallH} mm.`;}
 else note.innerHTML=`<b style="color:#b91c1c">Cannot fit:</b> ${ppEsc(calc?.reason||'Check dimensions and orientation')}`;
}
function ppSmartAddCrateFromSelected(){
 const r=ppSmartSelectedLine();if(!r){alert('Select a selected Next PL line first.');return;}const m=ppSmartMasterFor(r),box=ppDims(m?.boxSize);if(!m||!box||!ppNum(m.crateWidth)){alert('Complete Box Size and Crate Width in Crate Master Data first.');return;}const requested=Math.floor(ppNum(document.getElementById('ppSmartAllocatePcs')?.value));if(requested<1){alert('Enter PCS to allocate.');return;}const balance=ppSmartLineBalance(r);if(requested>balance){alert(`Only ${balance} PCS remain for ${r.poNumber} / ${r.profile} / ${r.itemCode} / ${r.length} mm.`);return;}
 const id=ppSmartSelectedCrateId();let crate=ppSmartCrates.find(c=>c.id===id);const isNew=!crate;if(!crate)crate={id,items:[],createdAt:Date.now(),manual:{}};const key=ppSmartLineKey(r),old=crate.items.find(x=>x.lineKey===key),pbox=ppSmartPcsBox(r),qty=requested+(old?ppNum(old.pcs):0),it={lineKey:key,po:r.poNumber,profile:r.profile,itemCode:r.itemCode,length:r.length,pcs:qty,pcsPerBox:pbox,boxes:Math.ceil(qty/pbox),unitWeight:ppNum(r.unitWeight||m.unitWeight)},items=old?crate.items.map(x=>x===old?it:x):[...crate.items,it],rows=Math.max(1,Math.min(3,Math.floor(ppNum(document.getElementById('ppSmartRowMode')?.value)||ppNum(m.rowMultiplier)||1))),manual={...(crate.manual||{}),outerL:ppNum(crate.outerL)||ppNum(document.getElementById('ppOuterCrateL')?.value)||Math.ceil((ppNum(r.length)+32)*rows),outerW:ppNum(crate.outerW)||ppNum(document.getElementById('ppOuterCrateW')?.value)||ppNum(m.crateWidth),orientation:document.getElementById('ppBoxOrientation')?.value||m.orientation||'auto',rowMultiplier:rows},calc=ppSmartCalcDims(items,manual);if(!calc.valid){alert(calc.reason||'Does not fit; reduce PCS or use another crate.');return;}if(isNew)ppSmartCrates.push(crate);crate.items=items;Object.assign(crate,{outerL:calc.outerL,outerW:calc.outerW,packingH:calc.packingH,overallH:calc.overallH,perLayer:calc.perLayer,layers:calc.layers,boxes:calc.boxes,orientation:calc.orientation,rowMultiplier:calc.rowMultiplier,manual:{...manual,outerL:calc.outerL,outerW:calc.outerW,orientation:calc.orientation,rowMultiplier:calc.rowMultiplier}});ppSmartPersist();ppSmartRenderCrateList();ppSmartUpdateAllocationPreview();ppSmartRefreshPreviewOptions();const inp=document.getElementById('ppSmartAllocatePcs');if(inp)inp.value='';ppSmartShowPreview(ppSmartCrates.indexOf(crate));if(typeof showToast==='function')showToast(`${requested} PCS added to ${id}.`,'success');
}
function ppMasterInlineDim(index,field,value){const r=ppCrateMasterRows[index];if(!r)return;if(field==='orientation')r.orientation=['auto','height','width'].includes(value)?value:'auto';else if(field==='rowMultiplier'){r.rowMultiplier=Math.max(1,Math.min(3,Math.floor(ppNum(value)||1)));r.manualOuterL=Math.ceil((ppNum(r.length)+32)*r.rowMultiplier);}else{const n=ppNum(value);if(n<1){alert('Enter a dimension greater than zero.');ppRenderCrateMaster();return;}if(field==='manualPackingH'&&n>PP_MAX_PACKING_HEIGHT){alert('Packing height cannot exceed 1100 mm.');ppRenderCrateMaster();return;}r[field]=n;}r.manual=true;r.source='Manual / edited';r.calc=ppCrateCalc(r);ppRenderCrateMaster();ppPopulateCrateStandards();ppRefreshNextPlLines();ppSaveCrateMaster();}
function ppRenderCrateMaster(){
 const body=document.getElementById('ppCrateMasterBody');if(!body)return;const q=(document.getElementById('ppCrateMasterSearch')?.value||'').toLowerCase(),rows=ppCrateMasterRows.filter(r=>[r.profile,r.itemCode,r.length,r.boxSize,r.crateWidth].join(' ').toLowerCase().includes(q)),matched=ppCrateMasterRows.filter(r=>r.excelMatched).length,missing=ppCrateMasterRows.filter(r=>!r.boxSize||!r.crateWidth||!ppCrateCalc(r).valid).length,set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};set('ppCrateMasterCount',ppCrateMasterRows.length);set('ppCrateMasterMatched',matched);set('ppCrateMasterMissing',missing);const dim=(idx,field,val)=>`<input type="number" min="1" step="1" value="${ppEsc(val??'')}" aria-label="${field}" title="Edit ${field}" style="width:84px;max-width:100%;padding:7px;border:1px solid #93c5fd;border-radius:7px" onchange="ppMasterInlineDim(${idx},'${field}',this.value)">`;
 body.innerHTML=rows.length?rows.map(r=>{const idx=ppCrateMasterRows.indexOf(r),c=ppCrateCalc(r),status=(!r.boxSize||!r.crateWidth||!c.valid)?'<b style="color:#b45309">⚠ Manual data needed</b>':r.excelMatched?'<b style="color:#047857">✓ Excel matched</b>':'<b style="color:#1d4ed8">✎ Catalog / manual</b>';return `<tr><td><b>${ppEsc(r.profile)}</b></td><td>${ppEsc(r.itemCode||'—')}</td><td>${ppEsc(r.length)}</td><td>${ppNum(r.pcsPerBox)||1}</td><td>${ppEsc(r.boxSize||'—')}</td><td>${dim(idx,'crateWidth',r.crateWidth||c.outerW||'')}</td><td>${dim(idx,'manualOuterL',r.manualOuterL||c.outerL||Math.ceil(ppNum(r.length)+32))}</td><td><strong>${c.valid?c.packingH+' mm':'—'}</strong></td><td><strong>${c.valid?c.overallH+' mm':'—'}</strong></td><td><strong>${c.valid?c.perLayer:'—'}</strong><small class="pp-cell-hint">Bottom-layer boxes including lengthwise rows</small></td><td><label class="pp-control-label"><i class="fa-solid fa-arrows-up-down-left-right"></i> Vertical box side</label><select class="pp-master-select" aria-label="Box orientation" onchange="ppMasterInlineDim(${idx},'orientation',this.value)"><option value="auto" ${(r.orientation||'auto')==='auto'?'selected':''}>✨ Auto best fit</option><option value="height" ${r.orientation==='height'?'selected':''}>↕ Height vertical</option><option value="width" ${r.orientation==='width'?'selected':''}>↻ Width vertical (rotate)</option></select><button class="btn btn-sm pp-preview-btn" onclick="ppMasterPreview(${idx})"><i class="fa-solid fa-eye"></i> Preview</button></td><td class="pp-master-rows"><label class="pp-control-label"><i class="fa-solid fa-layer-group"></i> Lengthwise rows</label><div class="pp-row-choice" role="group" aria-label="Choose number of lengthwise rows"> <button type="button" class="pp-row-choice-btn ${(Math.max(1,Math.min(3,Math.floor(ppNum(r.rowMultiplier)||1)))===1?'is-active':'')}" aria-pressed="${Math.max(1,Math.min(3,Math.floor(ppNum(r.rowMultiplier)||1)))===1}" title="Single row — 1 row along crate length" onclick="ppMasterInlineDim(${idx},'rowMultiplier',1)"><i class="fa-solid fa-grip-lines"></i><b>1</b><span>Single</span></button><button type="button" class="pp-row-choice-btn ${(Math.max(1,Math.min(3,Math.floor(ppNum(r.rowMultiplier)||1)))===2?'is-active':'')}" aria-pressed="${Math.max(1,Math.min(3,Math.floor(ppNum(r.rowMultiplier)||1)))===2}" title="Double rows — 2 rows along crate length" onclick="ppMasterInlineDim(${idx},'rowMultiplier',2)"><i class="fa-solid fa-layer-group"></i><b>2</b><span>Double</span></button><button type="button" class="pp-row-choice-btn ${(Math.max(1,Math.min(3,Math.floor(ppNum(r.rowMultiplier)||1)))===3?'is-active':'')}" aria-pressed="${Math.max(1,Math.min(3,Math.floor(ppNum(r.rowMultiplier)||1)))===3}" title="Triple rows — 3 rows along crate length" onclick="ppMasterInlineDim(${idx},'rowMultiplier',3)"><i class="fa-solid fa-boxes-stacked"></i><b>3</b><span>Triple</span></button></div><small class="pp-cell-hint">Selected: ${Math.max(1,Math.min(3,Math.floor(ppNum(r.rowMultiplier)||1)))} row(s)</small></td><td><strong>${c.valid?c.boxesPerCrate:'—'}</strong></td><td>${status}</td><td><button class="btn btn-sm" onclick="ppEditCrateMaster('${encodeURIComponent(ppMasterKey(r.profile,r.itemCode,r.length))}')"><i class="fa-solid fa-pen"></i> Edit</button></td></tr>`;}).join(''):'<tr><td colspan="15">No matching Master Catalog records.</td></tr>';
}
function ppMasterPreview(index){const r=ppCrateMasterRows[index];if(!r)return;const c=ppCrateCalc(r);if(!c.valid){alert('Please set valid box size, crate width and orientation first.');return;}const rows=Math.max(1,Math.min(3,Math.floor(ppNum(r.rowMultiplier)||1))),temp={id:'MASTER PREVIEW',items:[{profile:r.profile,itemCode:r.itemCode,length:r.length,pcsPerBox:r.pcsPerBox,pcs:c.boxesPerCrate*r.pcsPerBox,boxes:c.boxesPerCrate,lineKey:'master-preview'}],outerL:ppNum(r.manualOuterL)||Math.ceil((ppNum(r.length)+32)*rows),outerW:ppNum(r.crateWidth),packingH:c.packingH,overallH:c.overallH,perLayer:c.perLayer,layers:c.layers,boxes:c.boxesPerCrate,orientation:c.orientation,rowMultiplier:rows};const old=ppSmartCrates;ppSmartCrates=[temp];ppSmartShowPreview(0);ppSmartCrates=old;ppSmartRefreshPreviewOptions();const tab=document.querySelector('#packingPlannerTab .pp-subtab[onclick*="ppContainerSubTab"]');if(tab)ppSwitchSubtab('ppContainerSubTab',tab);}


/* Final Saved Crate List usability pass: human-readable crate IDs, multi-crate allocation,
   extra height allowance, editable PCS/height, completion balance and print export. */
function ppRomanLower(v){const map={I:'i',II:'ii',III:'iii',IV:'iv',V:'v',VI:'vi',VII:'vii',VIII:'viii',IX:'ix',X:'x',XI:'xi',XII:'xii',XIII:'xiii',XIV:'xiv',XV:'xv',XVI:'xvi',XVII:'xvii',XVIII:'xviii',XIX:'xix',XX:'xx'};return map[String(v||'I').toUpperCase()]||String(v||'i').toLowerCase();}
function ppDisplayCrateId(id){const m=String(id||'').match(/^C-0*(\d+)-([IVXLCDM]+)$/i);return m?`${Number(m[1])}-${ppRomanLower(m[2])}`:String(id||'—').replace(/^C-0*(\d+)-/i,'$1-').toLowerCase();}
function ppRomanAt(n){const vals=[[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];let out='';for(const [v,s] of vals){while(n>=v){out+=s;n-=v;}}return out||'I';}
function ppSmartEffectiveHeight(c){return Math.max(0,ppNum(c?.packingH))+Math.max(0,ppNum(c?.extraHeight));}
ppSmartAddCrateFromSelected = function(){
 const r=ppSmartSelectedLine();
 if(!r){alert('Select a Next Planning PL line first.');return;}
 const m=ppSmartMasterFor(r),box=ppDims(m?.boxSize);
 if(!m||!box||!ppNum(m.crateWidth)){alert('Complete Box Size and Crate Width in Crate Master Data first.');return;}
 // UI field is TOTAL PCS across all requested crates; distribute the total evenly.
 const totalPcs=Math.floor(ppNum(document.getElementById('ppSmartAllocatePcs')?.value));
 if(totalPcs<1){alert('Enter the total PCS to allocate across the crates.');return;}
 const count=Math.max(1,Math.min(60,Math.floor(ppNum(document.getElementById('ppSmartCrateCountInput')?.value)||1)));
 if(count>totalPcs){alert(`You entered ${totalPcs} total PCS for ${count} crates. Each crate must receive at least 1 PCS. Reduce the crate count or increase total PCS.`);return;}
 const balance=ppSmartLineBalance(r);
 if(totalPcs>balance){alert(`Cannot allocate ${totalPcs.toLocaleString()} PCS. Only ${balance.toLocaleString()} PCS remain for ${r.poNumber} / ${r.profile} / ${r.itemCode} / ${r.length} mm.`);return;}
 const extra=Math.max(0,Math.floor(ppNum(document.getElementById('ppSmartExtraHeight')?.value)||0));
 const baseId=ppSmartSelectedCrateId(),match=String(baseId).match(/^C-(\d+)-([IVXLCDM]+)$/i),baseNo=match?Number(match[1]):1,baseRoman=match?match[2].toUpperCase():(document.getElementById('ppSmartRoman')?.value||'I');
 const romanValues={I:1,II:2,III:3,IV:4,V:5,VI:6,VII:7,VIII:8,IX:9,X:10,XI:11,XII:12,XIII:13,XIV:14,XV:15,XVI:16,XVII:17,XVIII:18,XIX:19,XX:20};
 let searchFrom=romanValues[baseRoman]||1;
 const key=ppSmartLineKey(r),pbox=Math.max(1,ppSmartPcsBox(r));
 const rows=Math.max(1,Math.min(3,Math.floor(ppNum(document.getElementById('ppSmartRowMode')?.value)||ppNum(m.rowMultiplier)||1)));
 const manualBase={outerL:ppNum(document.getElementById('ppOuterCrateL')?.value)||ppNum(m.manualOuterL)||Math.ceil((ppNum(r.length)+32)*rows),outerW:ppNum(document.getElementById('ppOuterCrateW')?.value)||ppNum(m.crateWidth),orientation:document.getElementById('ppBoxOrientation')?.value||m.orientation||'auto',rowMultiplier:rows};
 const candidates=JSON.parse(JSON.stringify(ppSmartCrates));
 const usedIds=new Set(candidates.map(c=>String(c.id)));
 let created=0,assigned=0;
 const baseQty=Math.floor(totalPcs/count),remainder=totalPcs%count;
 for(let n=0;n<count;n++){
   const qty=baseQty+(n<remainder?1:0);
   let suffixN=searchFrom,id,guard=0;
   do {
     id=`C-${String(baseNo).padStart(2,'0')}-${ppRomanAt(suffixN++)}`;
     if(++guard>1000){alert('Could not find enough unused crate numbers. Choose another crate number.');return;}
   } while(usedIds.has(id));
   usedIds.add(id);
   const crate={id,items:[],createdAt:Date.now()+n,manual:{}};
   const it={lineKey:key,po:r.poNumber,profile:r.profile,itemCode:r.itemCode,length:r.length,pcs:qty,pcsPerBox:pbox,boxes:Math.ceil(qty/pbox),unitWeight:ppNum(r.unitWeight||m.unitWeight)};
   const manual={...manualBase,extraHeight:extra};
   const calc=ppSmartCalcDims([it],manual);
   if(!calc.valid){alert(`${ppDisplayCrateId(id)} cannot fit ${qty} PCS: ${calc.reason||'reduce PCS or use another crate.'}`);return;}
   const overall=calc.packingH+extra+PP_LEG_HEIGHT;
   if(calc.packingH+extra>PP_MAX_PACKING_HEIGHT){alert(`${ppDisplayCrateId(id)} needs ${calc.packingH+extra} mm packing height. Maximum is ${PP_MAX_PACKING_HEIGHT} mm. Reduce PCS or extra height.`);return;}
   crate.items=[it];
   Object.assign(crate,{outerL:calc.outerL,outerW:calc.outerW,packingH:calc.packingH,extraHeight:extra,overallH:overall,perLayer:calc.perLayer,layers:calc.layers,boxes:calc.boxes,orientation:calc.orientation,rowMultiplier:calc.rowMultiplier,manual:{...manual,outerL:calc.outerL,outerW:calc.outerW,orientation:calc.orientation,rowMultiplier:calc.rowMultiplier}});
   candidates.push(crate);created++;assigned+=qty;
 }
 if(assigned!==totalPcs){alert('Allocation check failed. No crates were saved. Please try again.');return;}
 ppSmartCrates=candidates;
 ppSmartPersist();ppSmartRenderCrateList();ppSmartUpdateAllocationPreview();ppSmartRefreshPreviewOptions();
 const inp=document.getElementById('ppSmartAllocatePcs');if(inp)inp.value='';
 const ex=document.getElementById('ppSmartExtraHeight');if(ex)ex.value='0';
 // Keep the requested crate count visible after a successful allocation.
 ppSmartUpdateAllocationPreview();
 if(created&&typeof showToast==='function')showToast(`${created} new crates saved with ${assigned} total PCS (${baseQty}–${baseQty+(remainder?1:0)} PCS per crate).`,'success');
};
function ppSmartEditCrate(i){const c=ppSmartCrates[i];if(!c)return;const pcsOriginal=JSON.parse(JSON.stringify(c.items||[]));
 const h=prompt(`Extra packing height to add (mm). Calculated base is ${Math.round(ppNum(c.packingH))} mm; maximum packing height 1100 mm.`,String(ppNum(c.extraHeight)||0));if(h===null)return;const extra=Math.max(0,Math.floor(ppNum(h)||0));if(ppNum(c.packingH)+extra>PP_MAX_PACKING_HEIGHT){alert(`Maximum extra packing height is ${Math.max(0,PP_MAX_PACKING_HEIGHT-ppNum(c.packingH))} mm.`);return;}
 c.extraHeight=extra;c.manual={...(c.manual&&typeof c.manual==='object'?c.manual:{}),extraHeight:extra};c.overallH=ppNum(c.packingH)+extra+PP_LEG_HEIGHT;ppSmartPersist();ppSmartRenderCrateList();ppSmartRefreshPreviewOptions();ppSmartShowPreview(i);
}
function ppSmartEditPcs(i){const c=ppSmartCrates[i];if(!c)return;const original=JSON.parse(JSON.stringify(c));
 for(const it of c.items||[]){const r=ppCrateNextRows.find(x=>ppSmartLineKey(x)===it.lineKey),alloc=ppSmartGetAllocations(),max=r?Math.max(0,Math.floor(ppNum(r.planningQty)-(alloc[it.lineKey]||0)+ppNum(it.pcs))):ppNum(it.pcs);const raw=prompt(`${it.po} / ${it.profile} / ${it.itemCode} / ${it.length} mm — PCS (maximum ${max})`,String(it.pcs));if(raw===null)return;const qty=Math.floor(ppNum(raw));if(qty<0||qty>max){alert(`Enter PCS from 0 to ${max}.`);return;}it.pcs=qty;it.boxes=Math.ceil(qty/Math.max(1,ppNum(it.pcsPerBox)));}
 c.items=(c.items||[]).filter(it=>ppNum(it.pcs)>0);const calc=ppSmartCalcDims(c.items,{...(c.manual&&typeof c.manual==='object'?c.manual:{}),outerL:c.outerL,outerW:c.outerW,orientation:c.orientation||'auto',rowMultiplier:c.rowMultiplier||1});if(c.items.length&&!calc.valid){Object.assign(c,original);alert(calc.reason||'Edited PCS do not fit.');return;}if(calc.valid){const extra=Math.max(0,ppNum(c.extraHeight));if(calc.packingH+extra>PP_MAX_PACKING_HEIGHT){Object.assign(c,original);alert(`Edited PCS plus extra height would exceed the ${PP_MAX_PACKING_HEIGHT} mm packing-height limit.`);return;}Object.assign(c,calc,{extraHeight:extra,packingH:calc.packingH,overallH:calc.packingH+extra+PP_LEG_HEIGHT,manual:{...(c.manual||{}),outerL:calc.outerL,outerW:calc.outerW,orientation:calc.orientation,rowMultiplier:calc.rowMultiplier,extraHeight:extra}});}ppSmartPersist();ppSmartRenderCrateList();ppSmartUpdateAllocationPreview();ppSmartRefreshPreviewOptions();
}
function ppSmartCopyCrate(i){const src=ppSmartCrates[i];if(!src)return;const count=1,used=new Set(ppSmartCrates.map(c=>c.id));let n=1,id;do{id=`C-${String(n).padStart(2,'0')}-I`;n++;}while(used.has(id)&&n<=61);if(used.has(id)){alert('No unused crate number available (1–60).');return;}const copy=JSON.parse(JSON.stringify(src));copy.id=id;copy.items=[];copy.createdAt=Date.now();ppSmartCrates.push(copy);ppSmartPersist();ppSmartRenderCrateList();ppSmartRefreshPreviewOptions();}
function ppSmartRenderCrateList(){
 const body=document.getElementById('ppCratePlanBody');if(!body)return;
 body.innerHTML=ppSmartCrates.length?ppSmartCrates.map((c,i)=>{const items=c.items||[],pcs=items.reduce((s,x)=>s+ppNum(x.pcs),0),boxes=items.reduce((s,x)=>s+ppNum(x.boxes),0),weight=items.reduce((s,x)=>s+ppNum(x.pcs)*ppNum(x.unitWeight),0),h=ppSmartEffectiveHeight(c);
 return `<tr><td><b class="pp-crate-id">${ppEsc(ppDisplayCrateId(c.id))}</b></td><td>${ppEsc([...new Set(items.map(x=>x.po))].join(', ')||'—')}</td><td>${ppEsc([...new Set(items.map(x=>x.profile))].join(' / ')||'—')}</td><td>${ppEsc([...new Set(items.map(x=>x.itemCode))].join(' / ')||'—')}</td><td>${ppEsc([...new Set(items.map(x=>x.length))].join(' / ')||'—')}</td><td><strong>${pcs.toLocaleString()}</strong></td><td>${items.map(x=>x.pcsPerBox).join(' / ')||'—'}</td><td><strong>${boxes.toLocaleString()}</strong></td><td>${c.outerW||'—'}</td><td>${c.outerL||'—'}</td><td><button class="btn btn-sm pp-dimension-edit" title="Edit additional height" onclick="ppSmartEditCrate(${i})">${h||'—'} <i class="fa-solid fa-pen"></i>${ppNum(c.extraHeight)>0?` <small>(+${ppNum(c.extraHeight)})</small>`:''}</button></td><td>${weight.toFixed(1)}</td><td><button class="btn btn-accent btn-sm" title="Open crate arrangement preview" onclick="ppSmartShowPreview(${i})"><i class="fa-solid fa-cubes-stacked"></i> 3D</button></td><td><div class="pp-row-actions"><button class="btn btn-sm" title="Add another profile to this crate" onclick="ppSmartAddProfileToCrate(${i})"><i class="fa-solid fa-plus"></i></button><button class="btn btn-sm" title="Edit PCS quantities" onclick="ppSmartEditPcs(${i})"><i class="fa-solid fa-cubes"></i> PCS</button><button class="btn btn-sm" title="Copy crate design" onclick="ppSmartCopyCrate(${i})"><i class="fa-solid fa-copy"></i></button><button class="btn btn-sm" title="Remove crate and return its PCS" onclick="ppSmartRemoveCrate(${i})"><i class="fa-solid fa-trash"></i></button></div></td></tr>`;}).join(''):'<tr><td colspan="14">No crates yet. Select a Next PL line and allocate PCS.</td></tr>';
 const pcs=ppSmartCrates.reduce((s,c)=>s+(c.items||[]).reduce((a,x)=>a+ppNum(x.pcs),0),0),weight=ppSmartCrates.reduce((s,c)=>s+(c.items||[]).reduce((a,x)=>a+ppNum(x.pcs)*ppNum(x.unitWeight),0),0),set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};set('ppSmartCrateCount',ppSmartCrates.length);set('ppSmartAllocatedPcs',pcs.toLocaleString());set('ppSmartTotalWeight',weight.toLocaleString(undefined,{maximumFractionDigits:1})+' kg');ppSmartRefreshPreviewOptions();
}
function ppSmartCompleteCrateList(){ppSmartPersist();ppSmartSaveNow();const alloc=ppSmartGetAllocations(),lines=(ppCrateNextRows||[]).filter(r=>ppNum(r.planningQty)>0).map(r=>({r,remaining:Math.max(0,Math.floor(ppNum(r.planningQty)-(alloc[ppSmartLineKey(r)]||0)))})).filter(x=>x.remaining>0);const host=document.getElementById('ppSmartCompletionSummary');if(!host)return;host.style.display='block';if(!lines.length){host.innerHTML='<b style="color:#047857"><i class="fa-solid fa-circle-check"></i> Crate list complete.</b> All positive-quantity Next PL lines have been allocated.';return;}host.innerHTML='<b><i class="fa-solid fa-list-check"></i> Next PL PCS not yet allocated to the crate list</b><div class="table-container" style="margin-top:8px"><table class="pp-table"><thead><tr><th>PO</th><th>Profile</th><th>Item Code</th><th>Length (mm)</th><th>Next PL PCS</th><th>Allocated PCS</th><th>Remaining PCS</th></tr></thead><tbody>'+lines.map(({r,remaining})=>{const total=Math.floor(ppNum(r.planningQty)),allocated=total-remaining;return `<tr><td>${ppEsc(r.poNumber)}</td><td>${ppEsc(r.profile)}</td><td>${ppEsc(r.itemCode)}</td><td>${ppEsc(r.length)}</td><td>${total.toLocaleString()}</td><td>${allocated.toLocaleString()}</td><td><b>${remaining.toLocaleString()}</b></td></tr>`;}).join('')+'</tbody></table></div><small>These quantities remain in Next PL and have not been assigned to a saved crate.</small>';host.scrollIntoView({behavior:'smooth',block:'nearest'});}
function ppSmartExportPdf(){const rows=ppSmartCrates.map(c=>{const items=c.items||[];return `<tr><td>${ppEsc(ppDisplayCrateId(c.id))}</td><td>${ppEsc([...new Set(items.map(x=>x.po))].join(', '))}</td><td>${ppEsc([...new Set(items.map(x=>x.profile))].join(' / '))}</td><td>${ppEsc([...new Set(items.map(x=>x.itemCode))].join(' / '))}</td><td>${ppEsc([...new Set(items.map(x=>x.length))].join(' / '))}</td><td>${items.reduce((s,x)=>s+ppNum(x.pcs),0)}</td><td>${items.reduce((s,x)=>s+ppNum(x.boxes),0)}</td><td>${c.outerW||''}</td><td>${c.outerL||''}</td><td>${ppSmartEffectiveHeight(c)}</td><td>${items.reduce((s,x)=>s+ppNum(x.pcs)*ppNum(x.unitWeight),0).toFixed(1)}</td></tr>`;}).join('');const w=window.open('','_blank');if(!w){alert('Please allow pop-ups to print the crate list as PDF.');return;}w.document.write(`<!doctype html><html><head><title>AIS Next PL Crate List</title><style>body{font:12px Arial,sans-serif;color:#12364d;padding:18px}h1{font-size:20px}p{color:#52677b}table{border-collapse:collapse;width:100%}th,td{border:1px solid #9db7c8;padding:6px;text-align:left}th{background:#075b63;color:#fff}tr:nth-child(even){background:#f1f6f8}@page{size:landscape;margin:10mm}</style></head><body><h1>AIS Next Planning PL — Saved Crate List</h1><p>Generated ${new Date().toLocaleString()} · ${ppSmartCrates.length} crates · ${ppSmartCrates.reduce((s,c)=>s+(c.items||[]).reduce((a,it)=>a+ppNum(it.pcs),0),0).toLocaleString()} PCS</p><table><thead><tr><th>Crate No.</th><th>PO</th><th>Profile(s)</th><th>Item Code(s)</th><th>Length(s) mm</th><th>PCS Qty</th><th>Box Qty</th><th>Width mm</th><th>Length mm</th><th>Height mm</th><th>Weight kg</th></tr></thead><tbody>${rows}</tbody></table><script>window.onload=()=>window.print();<\/script></body></html>`);w.document.close();}
(function ppCrateListCompactCss(){if(document.getElementById('pp-crate-list-final-css'))return;const st=document.createElement('style');st.id='pp-crate-list-final-css';st.textContent=`.pp-saved-crate-wrap{overflow-x:auto!important}.pp-saved-crate-table{width:100%;min-width:1180px;table-layout:auto;font-size:12px}.pp-saved-crate-table th,.pp-saved-crate-table td{padding:7px 8px;vertical-align:middle;white-space:nowrap}.pp-saved-crate-table th{line-height:1.2}.pp-saved-crate-table th i{margin-right:3px}.pp-saved-crate-table .pp-row-actions{display:flex;gap:4px;flex-wrap:wrap;max-width:175px}.pp-saved-crate-table .btn-sm{padding:5px 7px;font-size:11px}.pp-crate-id{font-size:13px;color:#075b63}.pp-saved-crate-table td:nth-child(3),.pp-saved-crate-table td:nth-child(4){white-space:normal;min-width:100px;max-width:170px}.pp-saved-crate-table td:nth-child(11){min-width:95px}`;document.head.appendChild(st);})();

/* Final display refinements for crate IDs, preview height and Excel export. */
ppSmartRefreshPreviewOptions=function(){const s=document.getElementById('ppSmartPreviewCrate');if(!s)return;const old=s.value;s.innerHTML='<option value="">Select a crate</option>'+ppSmartCrates.map((c,i)=>`<option value="${i}">${ppEsc(ppDisplayCrateId(c.id))} — ${ppEsc([...new Set((c.items||[]).map(x=>x.profile+' / '+x.length+'mm'))].join(', '))}</option>`).join('');if(old!==''&&Number(old)<ppSmartCrates.length)s.value=old;};
const ppSmartShowPreviewWithExtraHeight=ppSmartShowPreview;
ppSmartShowPreview=function(i){const c=ppSmartCrates[i];if(!c)return;const original=ppNum(c.packingH),extra=Math.max(0,ppNum(c.extraHeight));try{c.packingH=original+extra;ppSmartShowPreviewWithExtraHeight(i);}finally{c.packingH=original;}};
ppSmartExport=function(){const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');let body='';ppSmartCrates.forEach(c=>{const items=c.items||[];if(!items.length){body+=`<tr><td>${esc(ppDisplayCrateId(c.id))}</td><td colspan="11">Empty crate</td></tr>`;return;}items.forEach(it=>body+=`<tr><td>${esc(ppDisplayCrateId(c.id))}</td><td>${esc(it.po)}</td><td>${esc(it.profile)}</td><td>${esc(it.itemCode)}</td><td>${esc(it.length)}</td><td>${esc(it.pcs)}</td><td>${esc(it.pcsPerBox)}</td><td>${esc(it.boxes)}</td><td>${esc(c.outerW)}</td><td>${esc(c.outerL)}</td><td>${esc(ppSmartEffectiveHeight(c))}</td><td>${esc((ppNum(it.pcs)*ppNum(it.unitWeight)).toFixed(1))}</td>`);});const html=`<html><head><meta charset="utf-8"></head><body><table border="1"><thead><tr><th>Crate No.</th><th>PO</th><th>Profile</th><th>Item Code</th><th>Length (mm)</th><th>PCS Qty</th><th>PCS/Box</th><th>Box Qty</th><th>Width (mm)</th><th>Length (mm)</th><th>Height (mm)</th><th>Weight (kg)</th></tr></thead><tbody>${body}</tbody></table></body></html>`;const blob=new Blob(['\ufeff',html],{type:'application/vnd.ms-excel;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='AIS_Next_PL_Crate_List.xls';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};


/* AIS Container Plan: real dimensional top/front/back/left/right and isometric views.
   Scoped to the Container Loading Planner; preserves Crate List and Master Data behavior. */
let ppContSelectedId = '';
function ppContDims(c){
 // Physical outer envelope for the loading model:
 // length = saved crate outer length; width = crate width + 20 mm timber on each side;
 // height = crate body/frame height + 100 mm legs (overallH from Crate Master already includes both).
 const woodSide=Math.max(0,ppNum(typeof PP_WOOD_THICKNESS!=='undefined'?PP_WOOD_THICKNESS:20));
 const rawL=Math.max(1,ppNum(c?.outerL)||1);
 const rawW=Math.max(1,ppNum(c?.outerW)+2*woodSide||1);
 const rawH=Math.max(1,ppNum(c?.overallH)||(ppNum(c?.packingH)+ppNum(typeof PP_LEG_HEIGHT!=='undefined'?PP_LEG_HEIGHT:100))||1);
 const rot=!!c?.containerLayout?.rot;
 return {L:rot?rawW:rawL,W:rot?rawL:rawW,H:rawH,rot};
}
function ppContPcs(c){return (c.items||[]).reduce((s,it)=>s+ppNum(it.pcs),0);}
function ppContWeight(c){return (c.items||[]).reduce((s,it)=>s+ppNum(it.pcs)*ppNum(it.unitWeight),0);}
function ppContLayout(c){if(!c.containerLayout||typeof c.containerLayout!=='object')c.containerLayout={x:0,y:0,z:0,zMm:0,baseId:'',rot:false,placed:false};if(!Number.isFinite(Number(c.containerLayout.zMm)))c.containerLayout.zMm=(Number(c.containerLayout.z)||0)*(ppNum(c.overallH)||((ppNum(c.packingH)||1)+PP_LEG_HEIGHT));return c.containerLayout;}
function ppContGetSelected(){return ppSmartCrates.find(c=>c.id===ppContSelectedId)||null;}
function ppContSyncSelected(){
 const sel=document.getElementById('ppContSelectedCrate'); if(!sel)return;
 const placed=ppSmartCrates.filter(c=>ppContLayout(c).placed);
 const selectable=ppSmartCrates;
 const old=ppContSelectedId && selectable.some(c=>c.id===ppContSelectedId)?ppContSelectedId:(placed[0]?.id||selectable[0]?.id||'');
 ppContSelectedId=old;
 sel.innerHTML='<option value="">Select a crate</option>'+selectable.map(c=>`<option value="${ppEsc(c.id)}">${ppEsc(ppDisplayCrateId(c.id))}${ppContLayout(c).placed?' · placed':' · not placed'}</option>`).join('');sel.value=old;
 const c=ppContGetSelected(),meta=document.getElementById('ppContSelectedMeta');
 if(!c){if(meta)meta.textContent='Select a crate in the drawing or from the list.';['ppContX','ppContY'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});const z=document.getElementById('ppContZ');if(z)z.value='0';return;}
 const p=ppContLayout(c),d=ppContDims(c);if(meta)meta.innerHTML=`<b>${ppEsc(ppDisplayCrateId(c.id))}</b><br>Crate dimensions: ${d.L} × ${d.W} × ${d.H} mm<br>Profile PCS: ${ppContPcs(c).toLocaleString()}<br>Profile weight: ${ppContWeight(c).toLocaleString(undefined,{maximumFractionDigits:1})} kg<br>Crate tare: ${c.tareWeightKg===undefined||c.tareWeightKg===null?'Not entered':ppNum(c.tareWeightKg).toLocaleString(undefined,{maximumFractionDigits:1})+' kg'}<br>Total cargo weight: ${ppContCargoWeight(c).toLocaleString(undefined,{maximumFractionDigits:1})} kg<br>Position: X ${p.x} · Y ${p.y} · Elevation ${Math.round(p.zMm||0)} mm · Tier ${p.z+1}${p.baseId?` · on ${ppEsc(ppDisplayCrateId(p.baseId))}`:''}<br>Rotation: ${p.rot?'90°':'Original'}`;
 const x=document.getElementById('ppContX'),y=document.getElementById('ppContY'),z=document.getElementById('ppContZ');if(x)x.value=p.x;if(y)y.value=p.y;if(z)z.value=String(p.z);
 const stack=document.getElementById('ppContStackOn');if(stack){const keep=stack.value;stack.innerHTML='<option value="">No supporting crate selected</option>'+ppSmartCrates.filter(q=>q.id!==c.id&&ppContLayout(q).placed).map(q=>`<option value="${ppEsc(q.id)}">Place ${ppEsc(ppDisplayCrateId(c.id))} on ${ppEsc(ppDisplayCrateId(q.id))} · support tier ${ppContLayout(q).z+1}</option>`).join('');if([...stack.options].some(o=>o.value===keep))stack.value=keep;}
}
// V2.11 placement helpers: clear support labels, tier guidance and local safety confirmation.
function ppContSetStackConfirmation(checked){
 const globalBox=document.getElementById('ppContStackConfirmed'),localBox=document.getElementById('ppContStackConfirmedLocal');
 if(globalBox)globalBox.checked=!!checked;if(localBox)localBox.checked=!!checked;
 const hint=document.querySelector('.pp-stack-workflow');
 if(hint&&checked)hint.dataset.confirmed='1';else if(hint)delete hint.dataset.confirmed;
}
function ppContStackBaseChanged(){
 const id=document.getElementById('ppContStackOn')?.value||'',hint=document.querySelector('.pp-stack-workflow');
 const c=ppContGetSelected();
 if(!id){if(hint)hint.innerHTML='<b>How to stack crates:</b> Select the crate to move → choose a supporting crate above → confirm stacking strength → click <b>Stack on Supporting Crate</b>. To position a crate on the floor, leave the support selection empty and apply X/Y.';return;}
 const base=ppSmartCrates.find(q=>q.id===id);
 if(!base||!c||base===c){if(hint)hint.textContent='Choose a different crate as the support. A crate cannot support itself.';return;}
 if(!ppContLayout(base).placed){if(hint)hint.textContent='The supporting crate must first be placed in the container. Use Auto Arrange or place it on the floor first.';return;}
 const targetTier=Math.max(1,Math.floor(ppNum(ppContLayout(base).z))+1);
 const z=document.getElementById('ppContZ');if(z)z.value=String(Math.min(2,targetTier));
 const max=document.getElementById('ppContTiers'),required=targetTier+1;
 if(max&&ppNum(max.value)<required&&[...max.options].some(o=>ppNum(o.value)===required)){max.value=String(required);}
 if(hint)hint.innerHTML=`<b>Stack ready:</b> move <b>${ppEsc(ppDisplayCrateId(c.id))}</b> directly on top of <b>${ppEsc(ppDisplayCrateId(base.id))}</b> (target tier ${targetTier+1}). Maximum stack tiers is set to ${ppEsc(max?.value||'1')}. Confirm strength/stability using the checkbox below, then click <b>Stack on Supporting Crate</b>.`;
}
function ppContApplyRequestedLocation(){
 const support=document.getElementById('ppContStackOn')?.value;
 if(support){if(typeof showToast==='function')showToast('A supporting crate is selected. Use “Stack on Supporting Crate” to place this crate on top.','info');return;}
 ppContApplyPosition();
}

// Container layout undo: placement-only snapshot; crate/master records remain untouched.
let ppContUndoSnapshot = null;
function ppContTakeSnapshot(){
 ppContUndoSnapshot=JSON.stringify(ppSmartCrates.map(c=>({id:c.id,layout:JSON.parse(JSON.stringify(ppContLayout(c)))})));
 const b=document.getElementById('ppContUndoBtn');if(b)b.disabled=!ppContUndoSnapshot;
}
function ppContUndoLayout(){
 if(!ppContUndoSnapshot){if(typeof showToast==='function')showToast('No container layout change to undo.','info');return;}
 try{const snap=JSON.parse(ppContUndoSnapshot);snap.forEach(x=>{const c=ppSmartCrates.find(q=>q.id===x.id);if(c)c.containerLayout=x.layout;});ppContUndoSnapshot=null;const b=document.getElementById('ppContUndoBtn');if(b)b.disabled=true;ppSmartPersist();ppContSyncSelected();ppSmartRenderContainer();if(typeof showToast==='function')showToast('Previous container layout restored.','success');}catch(e){console.error(e);}
}
function ppContSelectCrate(){ppContSelectedId=document.getElementById('ppContSelectedCrate')?.value||'';ppContSyncSelected();ppSmartRenderContainer();const h=document.querySelector('.pp-location-hint');if(h)h.dataset.state='ready';}
function ppContApplyPosition(){
 const selectedSupport=document.getElementById('ppContStackOn')?.value||'';
 if(selectedSupport){if(typeof showToast==='function')showToast('A supporting crate is selected. Click “Stack on Supporting Crate” instead of Apply X/Y Position.','info');return;}
 const c=ppContGetSelected();if(!c)return;ppContTakeSnapshot();const p=ppContLayout(c),L=ppNum(document.getElementById('ppContLen')?.value)||12032,W=ppNum(document.getElementById('ppContWid')?.value)||2352,H=ppNum(document.getElementById('ppContHei')?.value)||2393,d=ppContDims(c),x=Math.max(0,ppNum(document.getElementById('ppContX')?.value)),y=Math.max(0,ppNum(document.getElementById('ppContY')?.value)),z=Math.max(0,Math.floor(ppNum(document.getElementById('ppContZ')?.value)));
 if(x+d.L>L||y+d.W>W||(z+1)*d.H>H){alert('This position is outside the container dimensions. Check X, Y, tier and crate dimensions.');ppContSyncSelected();return;}
 if(z>0&&!document.getElementById('ppContStackConfirmed')?.checked){alert('Confirm stacking strength and stability before placing crates above the floor.');const ze=document.getElementById('ppContZ');if(ze)ze.value='0';return;}
 p.x=x;p.y=y;p.z=z;p.zMm=z===0?0:z*(d.H);p.baseId='';p.placed=true;
 const clash=ppSmartCrates.find(q=>q!==c&&ppContLayout(q).placed&&ppContBoxesOverlap(c,q));if(clash){p.placed=false;if(typeof showToast==='function')showToast(`Position overlaps crate ${ppDisplayCrateId(clash.id)}. Choose a free position.`, 'warning');else alert(`This position overlaps crate ${ppDisplayCrateId(clash.id)}. Choose another X/Y position.`);ppContSyncSelected();ppSmartRenderContainer();return;}
 ppContSyncSelected();ppSmartPersist();ppSmartRenderContainer();
}
function ppContBoxesOverlap(a,b){const pa=ppContLayout(a),pb=ppContLayout(b),da=ppContDims(a),db=ppContDims(b);const az=ppNum(pa.zMm),bz=ppNum(pb.zMm),ax2=pa.x+da.L,ay2=pa.y+da.W,az2=az+da.H,bx2=pb.x+db.L,by2=pb.y+db.W,bz2=bz+db.H;return pa.x<bx2&&ax2>pb.x&&pa.y<by2&&ay2>pb.y&&az<bz2&&az2>bz;}
function ppContRotateSelected(){const c=ppContGetSelected();if(!c)return;ppContTakeSnapshot();const p=ppContLayout(c);p.rot=!p.rot;const L=ppNum(document.getElementById('ppContLen')?.value)||12032,W=ppNum(document.getElementById('ppContWid')?.value)||2352,d=ppContDims(c);if(p.x+d.L>L||p.y+d.W>W){p.rot=!p.rot;alert('Rotated crate would exceed the container boundary.');}else{const clash=ppSmartCrates.find(q=>q!==c&&ppContLayout(q).placed&&ppContBoxesOverlap(c,q));if(clash){p.rot=!p.rot;alert(`Rotation overlaps crate ${clash.id}.`);}}ppContSyncSelected();ppSmartPersist();ppSmartRenderContainer();}
function ppContRemoveSelected(){const c=ppContGetSelected();if(!c)return;ppContTakeSnapshot();ppContLayout(c).placed=false;ppContSelectedId='';ppSmartPersist();ppContSyncSelected();ppSmartRenderContainer();}
function ppContStackOnSelected(){
 const c=ppContGetSelected(),id=document.getElementById('ppContStackOn')?.value;
 if(!c)return;
 const L=ppNum(document.getElementById('ppContLen')?.value)||12032,W=ppNum(document.getElementById('ppContWid')?.value)||2352,H=ppNum(document.getElementById('ppContHei')?.value)||2393,d=ppContDims(c);
 const p=ppContLayout(c),x=Math.max(0,Math.floor(ppNum(document.getElementById('ppContX')?.value))),y=Math.max(0,Math.floor(ppNum(document.getElementById('ppContY')?.value))),tier=Math.max(0,Math.floor(ppNum(document.getElementById('ppContZ')?.value))),maxTier=Math.max(1,Math.floor(ppNum(document.getElementById('ppContTiers')?.value)||1));
 if(tier>=maxTier){if(typeof showToast==='function')showToast(`This container plan allows only ${maxTier} tier(s). Increase Maximum stack tiers first.`,'warning');return;}
 if(!id&&tier>0){if(typeof showToast==='function')showToast('For safe stacking, select a supporting crate from the Supporting crate list. Do not place a crate at a free-floating tier.','warning');else alert('Select a supporting crate before stacking.');return;}
 if(id){
  const base=ppSmartCrates.find(q=>q.id===id);if(!base||base===c){if(typeof showToast==='function')showToast('Select a different supporting crate.','warning');return;}
  if(!ppContLayout(base).placed){if(typeof showToast==='function')showToast('The supporting crate must be placed first.','warning');return;}
  if(!document.getElementById('ppContStackConfirmed')?.checked){if(typeof showToast==='function')showToast('Tick the stacking strength and stability confirmation first.','warning');return;}
  const bp=ppContLayout(base),bd=ppContDims(base),zMm=ppNum(bp.zMm)+bd.H;
  if(bp.z+1>=maxTier){if(typeof showToast==='function')showToast(`The selected supporting crate is already at the maximum tier (${maxTier}).`,'warning');return;}
  if(d.L>bd.L||d.W>bd.W){if(typeof showToast==='function')showToast('This crate footprint is larger than the selected base. Rotate it or choose a suitable base crate.','warning');return;}
  if(bp.x+d.L>L||bp.y+d.W>W||zMm+d.H>H){if(typeof showToast==='function')showToast('This crate will exceed the container boundary or height.','warning');return;}
  ppContTakeSnapshot();Object.assign(p,{x:bp.x,y:bp.y,z:bp.z+1,zMm,baseId:base.id,placed:true});
 }else{
  if(tier>0&&!document.getElementById('ppContStackConfirmed')?.checked){if(typeof showToast==='function')showToast('Tick the stacking strength and stability confirmation first.','warning');return;}
  const zMm=tier===0?0:tier*d.H;
  if(x+d.L>L||y+d.W>W||zMm+d.H>H){if(typeof showToast==='function')showToast('This position exceeds the container boundary. Adjust X, Y or tier.','warning');return;}
  ppContTakeSnapshot();Object.assign(p,{x,y,z:tier,zMm,baseId:'',placed:true});
 }
 const clash=ppSmartCrates.find(q=>q!==c&&ppContLayout(q).placed&&ppContBoxesOverlap(c,q));
 if(clash){if(ppContUndoSnapshot){try{JSON.parse(ppContUndoSnapshot).forEach(a=>{const q=ppSmartCrates.find(v=>v.id===a.id);if(q)q.containerLayout=a.layout;});}catch(e){}}if(typeof showToast==='function')showToast(`Cannot apply: overlaps ${ppDisplayCrateId(clash.id)}. Choose another position or supporting crate.`,'warning');ppContSyncSelected();ppSmartRenderContainer();return;}
 ppSmartPersist();ppContSyncSelected();ppSmartRenderContainer();if(typeof showToast==='function')showToast(id?`${ppDisplayCrateId(c.id)} placed on ${ppDisplayCrateId(id)} and saved.`:'Crate location applied and saved.','success');
}
function ppSmartResetContainerLayout(){if(!confirm('Reset all container positions? Crate List and Master Data will remain unchanged.'))return;ppSmartCrates.forEach(c=>{c.containerLayout={x:0,y:0,z:0,rot:false,placed:false};});ppContSelectedId='';ppSmartPersist();ppContSyncSelected();ppSmartRenderContainer();}
function ppSmartSaveContainerLayout(){ppSmartPersist();if(typeof showToast==='function')showToast('Container layout saved with the crate list.','success');else alert('Container layout saved locally with the crate list.');}
function ppSmartAutoArrange(){
 const L=ppNum(document.getElementById('ppContLen')?.value)||12032,W=ppNum(document.getElementById('ppContWid')?.value)||2352,H=ppNum(document.getElementById('ppContHei')?.value)||2393,payload=Math.min(18000,ppNum(document.getElementById('ppContPayload')?.value)||18000),allowStack=!!document.getElementById('ppContStackConfirmed')?.checked,maxTier=Math.max(1,Math.floor(ppNum(document.getElementById('ppContTiers')?.value)||1));
 if(!ppSmartCrates.length){if(typeof showToast==='function')showToast('Add crates in the Crate List tab first.','warning');return;}
 if(allowStack&&maxTier<2){if(typeof showToast==='function')showToast('To stack crates: change Maximum stack tiers to 2 or 3, then tick “Stacking strength and stability confirmed”.','warning');return;}
 ppContTakeSnapshot();
 const romanOrder={I:1,II:2,III:3,IV:4,V:5,VI:6,VII:7,VIII:8,IX:9,X:10};
 const key=c=>{const m=String(c.id||'').match(/^(?:C-)?0*(\d+)-([IVXLCDM]+)$/i);return m?{n:+m[1],r:romanOrder[m[2].toUpperCase()]||99}:{n:999,r:999};};
 const ordered=[...ppSmartCrates].sort((a,b)=>{const ka=key(a),kb=key(b);return ka.n-kb.n||ka.r-kb.r||String(a.id).localeCompare(String(b.id));});
 ordered.forEach(c=>{c.containerLayout={x:0,y:0,z:0,zMm:0,rot:false,placed:false,baseId:''};});
 let placedWeight=0;const placed=[];let floorX=0,floorY=0,rowDepth=0;
 const collisionAt=(c,x,y,zMm,rot)=>{const old=JSON.parse(JSON.stringify(ppContLayout(c)));Object.assign(ppContLayout(c),{x,y,zMm,rot,placed:true});const bad=ppSmartCrates.some(q=>q!==c&&ppContLayout(q).placed&&ppContBoxesOverlap(c,q));Object.assign(ppContLayout(c),old);return bad;};
 const putFloor=(c)=>{const p=ppContLayout(c),d=ppContDims(c),wt=ppContCargoWeight(c);if(placedWeight+wt>payload)return false;const opts=[{L:d.L,W:d.W,rot:false},{L:d.W,W:d.L,rot:true}].filter((o,i,a)=>a.findIndex(q=>q.L===o.L&&q.W===o.W)===i);let pick=null;
  for(const o of opts){let xx=floorX,yy=floorY,rd=rowDepth;if(xx+o.L>L){xx=0;yy+=rd;rd=0;}if(yy+o.W<=W&&xx+o.L<=L){pick={...o,x:xx,y:yy,rowDepth:Math.max(rd,o.W)};break;}}
  if(!pick)return false;Object.assign(p,{x:pick.x,y:pick.y,rot:pick.rot,z:0,zMm:0,baseId:'',placed:true});floorX=pick.x+pick.L;floorY=pick.y;rowDepth=Math.max(pick.rowDepth,pick.W);placedWeight+=wt;placed.push(c);return true;};
 const stackOn=(c,base)=>{if(!allowStack||maxTier<2||!base||!ppContLayout(base).placed)return false;const p=ppContLayout(c),bp=ppContLayout(base),d=ppContDims(c),bd=ppContDims(base),z=ppNum(bp.zMm)+bd.H,tier=bp.z+1,wt=ppContCargoWeight(c);if(tier>=maxTier||d.L>bd.L||d.W>bd.W||z+d.H>H||placedWeight+wt>payload)return false;
  Object.assign(p,{x:bp.x,y:bp.y,rot:bp.rot,z,zMm:z,baseId:base.id,placed:true});if(ppSmartCrates.some(q=>q!==c&&ppContLayout(q).placed&&ppContBoxesOverlap(c,q))){Object.assign(p,{x:0,y:0,z:0,zMm:0,rot:false,baseId:'',placed:false});return false;}placedWeight+=wt;placed.push(c);return true;};
 // Group Roman-suffixed crate IDs by main crate number. For each group, place i and ii on the floor,
 // then put iii directly above ii and iv directly above i (when stacking is enabled and dimensions allow).
 const groups=new Map();ordered.forEach(c=>{const k=key(c);if(k.n===999)return;if(!groups.has(k.n))groups.set(k.n,[]);groups.get(k.n).push(c);});
 const handled=new Set();
 for(const list of groups.values()){
  list.sort((a,b)=>key(a).r-key(b).r);
  const baseA=list[0],baseB=list[1];
  if(baseA){putFloor(baseA);handled.add(baseA.id);}
  if(baseB){putFloor(baseB);handled.add(baseB.id);}
  if(allowStack&&maxTier>1){if(list[2]&&baseB&&ppContLayout(baseB).placed&&stackOn(list[2],baseB))handled.add(list[2].id);if(list[3]&&baseA&&ppContLayout(baseA).placed&&stackOn(list[3],baseA))handled.add(list[3].id);}
 }
 // Remaining crates are packed into the remaining floor area; do not reset already chosen coordinates.
 for(const c of ordered){if(handled.has(c.id))continue;putFloor(c);handled.add(c.id);}
 ppContSelectedId=ordered.find(c=>ppContLayout(c).placed)?.id||'';
 // Persist only on this explicit Auto Correct action.
 ppSmartPersist();ppContSyncSelected();ppSmartRenderContainer();
 const finalPlaced=ordered.filter(c=>ppContLayout(c).placed),unplaced=ordered.length-finalPlaced.length,stacked=finalPlaced.filter(c=>ppContLayout(c).baseId).length;
 if(typeof showToast==='function')showToast(`Auto-correction saved: ${finalPlaced.length}/${ordered.length} crates placed${stacked?`, ${stacked} stacked on their assigned base crate`:''}.${unplaced?` ${unplaced} crate(s) need manual review.`:''}`,unplaced?'warning':'success');
 else if(unplaced)alert(`${finalPlaced.length} of ${ordered.length} crates arranged. ${unplaced} crate(s) need manual review.`);
}
function ppContExport(kind){
 const placed=ppSmartCrates.filter(c=>ppContLayout(c).placed),rows=[['Crate No','Profiles','PCS','Cargo weight incl. entered tare kg','Width mm','Length mm','Height mm','X mm','Y mm','Elevation mm','Tier','Rotation']];
 placed.forEach(c=>{const p=ppContLayout(c),d=ppContDims(c);rows.push([ppDisplayCrateId(c.id),[...new Set((c.items||[]).map(it=>it.profile))].join(' / '),ppContPcs(c),ppContCargoWeight(c).toFixed(1),d.W,d.L,d.H,p.x,p.y,Math.round(ppNum(p.zMm)),p.z+1,p.rot?'90°':'Original']);});
 if(kind==='print'||kind==='pdf'){
  const L=ppNum(document.getElementById('ppContLen')?.value)||12032,W=ppNum(document.getElementById('ppContWid')?.value)||2352,H=ppNum(document.getElementById('ppContHei')?.value)||2393,colors=['#b8d8d2','#c6d9e8','#ead7b6','#cdd4f0','#d8c6e8','#c9dfb2','#f0c8b8'];
  const viewSvg=(view)=>{const VW=1000,VH=430,pad=45,end=['front','back'].includes(view),axis=end?W:L,scale=Math.min((VW-2*pad)/axis,(VH-2*pad)/H),cw=axis*scale,ch=H*scale,ox=(VW-cw)/2,floor=VH-pad,top=floor-ch;let body='';placed.forEach((c,i)=>{const p=ppContLayout(c),d=ppContDims(c),x=end?(view==='front'?p.y:W-p.y-d.W):(view==='left'?p.x:L-p.x-d.L),xx=ox+x*scale,ww=(end?d.W:d.L)*scale,yy=floor-(ppNum(p.zMm)+d.H)*scale,hh=d.H*scale;body+=`<rect x="${xx}" y="${yy}" width="${Math.max(1,ww)}" height="${Math.max(1,hh)}" fill="${colors[i%colors.length]}" stroke="#254e60" stroke-width="2"/><text x="${xx+4}" y="${yy+16}" font-size="${Math.max(9,Math.min(14,ww/5))}" fill="#12364d" font-weight="700">${ppEsc(ppDisplayCrateId(c.id))}</text><text x="${xx+4}" y="${yy+30}" font-size="${Math.max(8,Math.min(11,ww/6))}" fill="#12364d">${ppContPcs(c)} PCS</text>`;});return `<svg viewBox="0 0 ${VW} ${VH}" style="width:100%;height:auto;border:1px solid #cbd5e1;background:#f1f7fa"><rect x="${ox}" y="${top}" width="${cw}" height="${ch}" fill="#eaf2f6" stroke="#24556b" stroke-width="8"/>${body}<text x="20" y="25" font-size="16" font-weight="800" fill="#164e63">${view.toUpperCase()} VIEW · ${axis} × ${H} mm</text></svg>`;};
  const w=window.open('','_blank');if(!w){if(typeof showToast==='function')showToast('Allow pop-ups to export the container plan.','warning');return;}
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>AIS Container Plan — Four Side Views</title><style>body{font:12px Arial;color:#12364d;margin:14mm}h1{color:#075b63}h2{margin:14px 0 5px;page-break-after:avoid}.views{display:grid;grid-template-columns:1fr 1fr;gap:12px}.view{break-inside:avoid}table{border-collapse:collapse;width:100%;font-size:10px;margin-top:12px}th,td{border:1px solid #9db7c8;padding:5px;text-align:left}th{background:#075b63;color:#fff}.swatch{display:inline-block;width:12px;height:12px;border:1px solid #35586b;margin-right:4px}@page{size:landscape;margin:8mm}@media print{body{margin:0}.views{gap:7px}}</style></head><body><h1>AIS Container Loading Plan</h1><p>Container: ${ppEsc(document.getElementById('ppSmartContainerType')?.value||'40 ft Standard')} · Internal dimensions ${L} × ${W} × ${H} mm · Crates placed ${placed.length}/${ppSmartCrates.length} · Total PCS ${placed.reduce((a,c)=>a+ppContPcs(c),0).toLocaleString()} · Estimated cargo weight ${placed.reduce((a,c)=>a+ppContCargoWeight(c),0).toFixed(1)} kg (profile + entered tare)</p><div class="views">${['front','back','left','right'].map(v=>`<section class="view"><h2>${v.toUpperCase()} SIDE</h2>${viewSvg(v)}</section>`).join('')}</div><h2>Crate position details</h2><table><thead><tr>${rows[0].map(x=>`<th>${ppEsc(x)}</th>`).join('')}<th>Colour</th></tr></thead><tbody>${rows.slice(1).map((r,i)=>`<tr>${r.map(x=>`<td>${ppEsc(x)}</td>`).join('')}<td><span class="swatch" style="background:${colors[i%colors.length]}"></span>${ppEsc(ppDisplayCrateId(placed[i]?.id||''))}</td></tr>`).join('')}</tbody></table><p>Planning schematic only. Confirm actual dimensions, door clearance, payload, load restraint and stacking strength before loading.</p><script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close();return;
 }
 const csv=rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n'),blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='AIS_Container_Loading_Plan.csv';a.click();URL.revokeObjectURL(url);
}
function ppSmartRenderContainer(){
 const host=document.getElementById('ppContainerVisual');if(!host)return;
 const L=Math.max(1,ppNum(document.getElementById('ppContLen')?.value)||12032),W=Math.max(1,ppNum(document.getElementById('ppContWid')?.value)||2352),H=Math.max(1,ppNum(document.getElementById('ppContHei')?.value)||2393),payload=Math.min(18000,Math.max(1,ppNum(document.getElementById('ppContPayload')?.value)||18000)),view=document.getElementById('ppContView')?.value||'top';
 const placed=ppSmartCrates.filter(c=>ppContLayout(c).placed).sort((a,b)=>ppNum(ppContLayout(a).zMm)-ppNum(ppContLayout(b).zMm)),totalPcs=placed.reduce((s,c)=>s+ppContPcs(c),0),totalWeight=placed.reduce((s,c)=>s+ppContCargoWeight(c),0),floorArea=placed.reduce((s,c)=>{const d=ppContDims(c);return s+d.L*d.W;},0),usedPct=Math.min(100,floorArea/(L*W)*100),remaining=payload-totalWeight;
 const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};set('ppContPlaced',`${placed.length} / ${ppSmartCrates.length}`);set('ppContPcs',totalPcs.toLocaleString());set('ppContWeight',`${totalWeight.toLocaleString(undefined,{maximumFractionDigits:1})} kg`);set('ppContArea',`${usedPct.toFixed(1)}%`);set('ppContRemaining',`${remaining.toLocaleString(undefined,{maximumFractionDigits:1})} kg`);
 if(!ppSmartCrates.length){host.innerHTML='<div class="pp-empty">Generate crate records first to preview the container layout.</div>';ppContSyncSelected();return;}
 const colors=['#b8d8d2','#c6d9e8','#ead7b6','#cdd4f0','#d8c6e8','#c9dfb2','#f0c8b8'];let svg='',Wv=900,Hv=500,shapes='';
 const txt=(c,x,y,fs=12)=>`<text x="${x}" y="${y}" font-size="${fs}" font-weight="700" fill="#12364d">${ppEsc(ppDisplayCrateId(c.id))}</text>`;
 const dims=c=>{const p=ppContLayout(c),d=ppContDims(c);return {...d,x:ppNum(p.x),y:ppNum(p.y),z:ppNum(p.z),p};};
 if(view==='top'){
  const pad=42,sx=(Wv-2*pad)/L,sy=(Hv-2*pad)/W,scale=Math.min(sx,sy);const cw=L*scale,ch=W*scale,ox=(Wv-cw)/2,oy=(Hv-ch)/2;
  shapes=placed.map((c,i)=>{const d=dims(c);const x=ox+d.x*scale,y=oy+d.y*scale,w=d.L*scale,h=d.W*scale;return `<g onclick="ppContPickById('${encodeURIComponent(c.id)}')" style="cursor:pointer"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${colors[i%colors.length]}" stroke="${c.id===ppContSelectedId?'#ef4444':'#35586b'}" stroke-width="${c.id===ppContSelectedId?4:1.8}"/><text x="${x+5}" y="${y+15}" font-size="${Math.max(8,Math.min(13,w/5))}" fill="#12364d">${ppEsc(ppDisplayCrateId(c.id))}</text><text x="${x+5}" y="${y+29}" font-size="${Math.max(7,Math.min(10,w/6))}" fill="#12364d">${ppContPcs(c)} PCS</text></g>`;}).join('');svg=`<svg data-mm-scale="${scale}" data-layout-view="top" viewBox="0 0 ${Wv} ${Hv}" role="img" aria-label="Container top view"><rect x="${(Wv-L*scale)/2}" y="${(Hv-W*scale)/2}" width="${L*scale}" height="${W*scale}" fill="#edf4f7" stroke="#24556b" stroke-width="8"/>${shapes}<text x="22" y="24" font-size="14" font-weight="800" fill="#164e63">TOP VIEW · X = ${L} mm · Y = ${W} mm</text></svg>`;
 }else if(['front','back','left','right'].includes(view)){
  const end=['front','back'].includes(view),axisLen=end?W:L,pad=48;
  // Keep the full container envelope visible; floor is anchored near the bottom.
  const scale=Math.min((Wv-2*pad)/axisLen,(Hv-2*pad)/H),cw=axisLen*scale,ch=H*scale,ox=(Wv-cw)/2,floorY=Hv-pad,topY=floorY-ch;
  // Left looks from Y=0; right looks from Y=container width. Draw far crates first.
  const sideOrder=[...placed].sort((a,b)=>view==='left'?(ppNum(ppContLayout(b).y)-ppNum(ppContLayout(a).y)):(view==='right'?(ppNum(ppContLayout(a).y)-ppNum(ppContLayout(b).y)):0));
  shapes=sideOrder.map((c,i)=>{const d=dims(c),xpos=end?(view==='front'?d.y:W-d.y-d.W):(view==='left'?d.x:L-d.x-d.L),xx=ox+xpos*scale,hh=d.H*scale,baseY=floorY-ppNum(d.p.zMm)*scale,yy=baseY-hh,ww=(end?d.W:d.L)*scale;
   return `<g onclick="ppContPickById('${encodeURIComponent(c.id)}')" style="cursor:pointer"><rect x="${xx}" y="${yy}" width="${Math.max(1,ww)}" height="${Math.max(1,hh)}" fill="${colors[i%colors.length]}" stroke="${c.id===ppContSelectedId?'#ef4444':'#35586b'}" stroke-width="${c.id===ppContSelectedId?4:1.6}"/><text x="${xx+4}" y="${yy+Math.min(15,Math.max(9,hh/3))}" font-size="${Math.max(7,Math.min(13,ww/5))}" fill="#12364d">${ppEsc(ppDisplayCrateId(c.id))}</text><text x="${xx+4}" y="${yy+Math.min(28,Math.max(16,hh*.65))}" font-size="${Math.max(6,Math.min(10,ww/6))}" fill="#12364d">${ppContPcs(c)} PCS</text></g>`;
  }).join('');
  svg=`<svg data-mm-scale="${scale}" data-layout-view="${view}" viewBox="0 0 ${Wv} ${Hv}" role="img" aria-label="Container ${view} side view"><rect x="${ox}" y="${topY}" width="${cw}" height="${ch}" fill="#edf4f7" stroke="#24556b" stroke-width="8"/>${shapes}<text x="22" y="24" font-size="14" font-weight="800" fill="#164e63">${view.toUpperCase()} SIDE VIEW · ${axisLen} × ${H} mm</text><text x="22" y="${Hv-12}" font-size="11" fill="#164e63">${end?'Looking from container '+view+' end (width × height)':'Looking along container '+view+' side (length × height)'}</text></svg>`;
 }else{
  const sx=Math.min(0.052,650/Math.max(1,L+W)),sy=Math.min(0.028,135/Math.max(1,L+W)),sz=Math.min(0.055,300/Math.max(1,H)),ox=180,oy=365;const P=(x,y,z)=>[ox+(x-y)*sx,oy+(x+y)*sy-z*sz];const poly=(pts,fill,stroke='#35586b',sw=1.5)=>`<polygon points="${pts.map(p=>p.join(',')).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
  const A=P(0,0,0),B=P(L,0,0),C=P(L,W,0),D=P(0,W,0),A2=P(0,0,H),B2=P(L,0,H),C2=P(L,W,H),D2=P(0,W,H);
  svg=`<svg data-mm-scale="${sx}" data-layout-view="3d" viewBox="0 0 900 520" role="img" aria-label="3D isometric container view">${poly([A,D,C,B],'#edf4f7','#24556b',4)}${poly([A,A2,D2,D],'#f8fafc','#24556b',3)}${poly([A,A2,B2,B],'#e2edf3','#24556b',3)}${poly([A2,B2,C2,D2],'none','#8ba5b3',1.5)}`;
  placed.forEach((c,i)=>{const d=dims(c),x=d.x,y=d.y,z=ppNum(d.p.zMm),pts=[P(x,y,z),P(x+d.L,y,z),P(x+d.L,y+d.W,z),P(x,y+d.W,z)],top=pts.map(p=>[p[0],p[1]-d.H*sz]),front=[pts[0],pts[1],top[1],top[0]],side=[pts[1],pts[2],top[2],top[1]],fill=colors[i%colors.length],stroke=c.id===ppContSelectedId?'#ef4444':'#35586b';svg+=`<g onclick="ppContPickById('${encodeURIComponent(c.id)}')" style="cursor:pointer">${poly(front,fill,stroke,c.id===ppContSelectedId?3:1.5)}${poly(side,'#9eb6c5',stroke,c.id===ppContSelectedId?3:1.5)}${poly(top,'#e7eff4',stroke,c.id===ppContSelectedId?3:1.5)}<text x="${(top[0][0]+top[1][0]+top[2][0]+top[3][0])/4-15}" y="${(top[0][1]+top[1][1]+top[2][1]+top[3][1])/4}" font-size="11" font-weight="700" fill="#12364d">${ppEsc(ppDisplayCrateId(c.id))}</text></g>`;});svg+=`<text x="22" y="24" font-size="14" font-weight="800" fill="#164e63">3D ISOMETRIC VIEW · ${L} × ${W} × ${H} mm</text></svg>`;
 }
 host.innerHTML=svg;
 // Draggable crate groups are bound by the final, single interaction handler at the end of this file.
 const svgEl=host.querySelector('svg');
 if(svgEl){svgEl.style.touchAction='none';svgEl.querySelectorAll('g[onclick*=ppContPickById]').forEach(g=>{g.style.cursor='grab';g.setAttribute('data-draggable-crate','1');g.setAttribute('tabindex','0');g.setAttribute('role','button');g.setAttribute('aria-label','Select and drag crate '+((g.getAttribute('onclick')||'').match(/ppContPickById\('([^']+)'\)/)||[])[1]);});}
 const cap=document.getElementById('ppContainerCapacity');if(cap)cap.innerHTML=`Placed <b>${placed.length}/${ppSmartCrates.length}</b> crates · <b>${totalPcs.toLocaleString()}</b> PCS · estimated cargo weight <b>${totalWeight.toLocaleString(undefined,{maximumFractionDigits:1})} kg</b> · floor footprint <b>${usedPct.toFixed(1)}%</b>. Payload remaining: <b>${remaining.toLocaleString(undefined,{maximumFractionDigits:1})} kg</b>. Dimensions are schematic; cargo estimate includes entered crate tare, but excludes missing tare, dunnage and restraints.`;
 const val=document.getElementById('ppContainerValidation');if(val){const out=ppSmartCrates.filter(c=>{const p=ppContLayout(c),d=ppContDims(c);return p.placed&&(p.x+d.L>L||p.y+d.W>W||ppNum(p.zMm)+d.H>H);}).length;const over=totalWeight>payload,missingTare=placed.filter(c=>c.tareWeightKg===undefined||c.tareWeightKg===null||c.tareWeightKg==='').length;val.innerHTML=`<b>Dimensions check:</b> ${out?'One or more crates exceed the container envelope.':`${placed.length} placed crates shown in ${view} view.`} ${over?'<b style="color:#b91c1c">18,000 kg cargo limit exceeded.</b>':'Cargo estimate is within the entered limit.'} ${missingTare?`<b style="color:#b45309">${missingTare} placed crate(s) missing tare weight; total cargo weight is incomplete.</b>`:''} Stacking strength must be confirmed separately.`;}
 const body=document.getElementById('ppContainerPlacedBody');if(body)body.innerHTML=ppSmartCrates.map(c=>{const p=ppContLayout(c),d=ppContDims(c);return `<tr><td>${ppEsc(ppDisplayCrateId(c.id))}</td><td>${ppEsc([...new Set((c.items||[]).map(it=>it.profile))].join(' / '))}</td><td>${ppContPcs(c).toLocaleString()}</td><td>${ppContCargoWeight(c).toFixed(1)}</td><td>${d.W}</td><td>${d.L}</td><td>${d.H}</td><td>${p.x}</td><td>${p.y}</td><td>${p.z+1}</td><td>${p.rot?'90°':'Original'}</td><td>${p.placed?'<b style="color:#047857">Placed</b>':'<span style="color:#b45309">Not placed</span>'}</td></tr>`;}).join('')||'<tr><td colspan="12">No crates available.</td></tr>';
 ppContSyncSelected();
}
// Cargo weight guardrails for the 3D container planner.
function ppContCargoWeight(c){return ppContWeight(c)+Math.max(0,ppNum(c?.tareWeightKg));}
function ppContPlacedCargoWeight(excludeId=''){return ppSmartCrates.filter(q=>ppContLayout(q).placed&&q.id!==excludeId).reduce((sum,q)=>sum+ppContCargoWeight(q),0);}
function ppContEnforcePayloadLimit(){const e=document.getElementById('ppContPayload');if(!e)return;let v=ppNum(e.value)||18000;if(v>18000){v=18000;e.value='18000';if(typeof showToast==='function')showToast('Maximum cargo weight is capped at 18,000 kg.','warning');}if(v<1){v=18000;e.value='18000';}return v;}
const ppContSyncSelectedBase=ppContSyncSelected;
ppContSyncSelected=function(){ppContSyncSelectedBase();const c=ppContGetSelected(),e=document.getElementById('ppContTareWeight');if(e)e.value=c&&(c.tareWeightKg!==undefined&&c.tareWeightKg!==null)?String(c.tareWeightKg):'';};
function ppContSetTareWeight(){const c=ppContGetSelected(),e=document.getElementById('ppContTareWeight');if(!c||!e)return;const raw=String(e.value??'').trim();if(raw===''||!Number.isFinite(Number(raw))||Number(raw)<0){if(typeof showToast==='function')showToast('Enter a valid non-negative crate tare weight in kg.','warning');return;}const old=c.tareWeightKg;c.tareWeightKg=Math.round(Number(raw)*10)/10;if(ppContLayout(c).placed&&ppContPlacedCargoWeight()>18000){if(old===undefined)delete c.tareWeightKg;else c.tareWeightKg=old;ppContSyncSelected();if(typeof showToast==='function')showToast('This tare weight would make cargo exceed 18,000 kg. The change was not saved.','error');return;}ppSmartPersist();ppSmartRenderContainer();if(typeof showToast==='function')showToast(`Tare weight saved for ${ppDisplayCrateId(c.id)}.`,'success');}
const ppContApplyPositionBase=ppContApplyPosition;
ppContApplyPosition=function(){const c=ppContGetSelected();if(!c)return;if(!ppContLayout(c).placed&&ppContPlacedCargoWeight()+ppContCargoWeight(c)>18000){if(typeof showToast==='function')showToast('Cannot place this crate: estimated cargo weight would exceed 18,000 kg.','error');return;}return ppContApplyPositionBase();};
const ppContStackOnSelectedBase=ppContStackOnSelected;
ppContStackOnSelected=function(){const c=ppContGetSelected();if(c&&!ppContLayout(c).placed&&ppContPlacedCargoWeight()+ppContCargoWeight(c)>18000){if(typeof showToast==='function')showToast('Cannot place this crate: estimated cargo weight would exceed 18,000 kg.','error');return;}return ppContStackOnSelectedBase();};
function ppContPickById(enc){const id=decodeURIComponent(enc);if(!ppSmartCrates.some(c=>c.id===id))return;ppContSelectedId=id;ppContSyncSelected();ppSmartRenderContainer();}



/* AIS Tracker V2.3 — Next PL multi-PO profile-to-existing-crate workflow.
   Adds to the established ppSmartCrates data model and leaves all saved records intact. */
function ppNewEsc(v){return typeof ppEsc==='function'?ppEsc(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function ppNewLineMatches(r,p,i,l){return String(r.profile)===String(p)&&String(r.itemCode)===String(i)&&String(r.length)===String(l);}
function ppNewSelectedLines(){const p=document.getElementById('ppNewProfile')?.value||'',i=document.getElementById('ppNewItemCode')?.value||'',l=document.getElementById('ppNewLength')?.value||'';return (ppCrateNextRows||[]).filter(r=>ppNewLineMatches(r,p,i,l));}
function ppNewBalance(r){return Math.max(0,Math.floor(ppNum(r.planningQty))-((ppSmartGetAllocations()||{})[ppSmartLineKey(r)]||0));}
function ppNewInit(){
 const num=document.getElementById('ppNewCrateNo');if(num){const old=num.value;num.innerHTML=Array.from({length:60},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('');if(old)num.value=old;}
 ppNewRefreshProfileOptions();ppNewRefreshCrateOptions();ppNewRenderSelectedCrate();
}
function ppNewRefreshProfileOptions(){
 const sel=document.getElementById('ppNewProfile');if(!sel)return;const old=sel.value;const rows=ppCrateNextRows||[];const values=[...new Set(rows.map(r=>String(r.profile??'')).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
 sel.innerHTML='<option value="">Select profile</option>'+values.map(v=>`<option value="${ppNewEsc(v)}">${ppNewEsc(v)}</option>`).join('');if(values.includes(old))sel.value=old;ppNewProfileChanged(false);
}
function ppNewProfileChanged(refresh=true){
 const p=document.getElementById('ppNewProfile')?.value||'',item=document.getElementById('ppNewItemCode'),len=document.getElementById('ppNewLength');if(!item||!len)return;
 const rows=(ppCrateNextRows||[]).filter(r=>String(r.profile)===p);const old=item.value,items=[...new Set(rows.map(r=>String(r.itemCode??'')).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));item.innerHTML='<option value="">Select item code</option>'+items.map(v=>`<option value="${ppNewEsc(v)}">${ppNewEsc(v)}</option>`).join('');item.disabled=!p;if(items.includes(old))item.value=old;
 ppNewItemChanged(refresh);
}
function ppNewItemChanged(refresh=true){
 const p=document.getElementById('ppNewProfile')?.value||'',i=document.getElementById('ppNewItemCode')?.value||'',len=document.getElementById('ppNewLength');if(!len)return;
 const rows=(ppCrateNextRows||[]).filter(r=>String(r.profile)===p&&String(r.itemCode)===i);const old=len.value,values=[...new Set(rows.map(r=>String(r.length??'')).filter(Boolean))].sort((a,b)=>Number(a)-Number(b));len.innerHTML='<option value="">Select length</option>'+values.map(v=>`<option value="${ppNewEsc(v)}">${ppNewEsc(v)}</option>`).join('');len.disabled=!(p&&i);
 // Auto-select a valid length as soon as Profile + Item Code are selected.
 // Preserve the current length only when it is also valid for this exact pair;
 // otherwise choose the first available length while keeping the dropdown editable.
 if(values.includes(old))len.value=old;else if(values.length)len.value=values[0];else len.value='';
 ppNewLengthChanged(refresh);
}
function ppNewLengthChanged(refresh=true){ppNewRenderPoRows();ppNewUpdateTotals();if(refresh)ppNewRenderSelectedCrate();}
function ppNewRenderPoRows(){
 const body=document.getElementById('ppNewPoRows');if(!body)return;const rows=ppNewSelectedLines();if(!rows.length){body.innerHTML='<tr><td colspan="7">Select a profile, item code and length to show matching POs.</td></tr>';return;}
 body.innerHTML=rows.map((r,n)=>{const bal=ppNewBalance(r),allocated=Math.max(0,Math.floor(ppNum(r.planningQty))-bal),id='ppNewQty_'+n;return `<tr><td><input type="checkbox" id="ppNewCheck_${n}" onchange="ppNewQtyCheckChanged(${n})" ${bal>0?'':'disabled'} aria-label="Select PO ${ppNewEsc(r.poNumber)}"></td><td><b>${ppNewEsc(r.poNumber)}</b></td><td>${Math.floor(ppNum(r.planningQty)).toLocaleString()}</td><td>${allocated.toLocaleString()}</td><td><b>${bal.toLocaleString()}</b></td><td><input id="${id}" type="number" min="0" max="${bal}" value="0" ${bal>0?'':'disabled'} oninput="ppNewUpdateTotals()" aria-label="PCS to add for ${ppNewEsc(r.poNumber)}"></td><td><button type="button" class="btn btn-sm pp-new-row-max" ${bal>0?'':'disabled'} onclick="ppNewSetMax(${n})">Max</button></td></tr>`;}).join('');
}
function ppNewQtyCheckChanged(n){const q=document.getElementById('ppNewQty_'+n),c=document.getElementById('ppNewCheck_'+n);if(q&&c&&c.checked&&ppNum(q.value)===0){q.value='';q.focus();}ppNewUpdateTotals();}
function ppNewSetMax(n){const r=ppNewSelectedLines()[n],q=document.getElementById('ppNewQty_'+n),c=document.getElementById('ppNewCheck_'+n);if(!r||!q)return;q.value=String(ppNewBalance(r));if(c)c.checked=true;ppNewUpdateTotals();}
function ppNewUpdateTotals(){const rows=ppNewSelectedLines();let pcs=0,boxes=0,weight=0;rows.forEach((r,n)=>{const q=Math.max(0,Math.floor(ppNum(document.getElementById('ppNewQty_'+n)?.value)));pcs+=q;const pbox=Math.max(1,ppSmartPcsBox(r));boxes+=q?Math.ceil(q/pbox):0;const m=ppSmartMasterFor(r);weight+=q*ppNum(r.unitWeight||m?.unitWeight);});const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};set('ppNewTotalPcs',pcs.toLocaleString());set('ppNewTotalWeight',weight.toLocaleString(undefined,{maximumFractionDigits:1})+' kg');set('ppNewTotalBoxes',boxes.toLocaleString());}
function ppNewRefreshCrateOptions(){const sel=document.getElementById('ppNewCrateSelect');if(!sel)return;const old=sel.value;sel.innerHTML='<option value="">Select an existing crate</option>'+ppSmartCrates.map(c=>`<option value="${ppNewEsc(c.id)}">${ppNewEsc(ppDisplayCrateId(c.id))} · ${(c.items||[]).length} profile line(s)</option>`).join('');if(ppSmartCrates.some(c=>c.id===old))sel.value=old;else if(ppSmartCrates.length)sel.value=ppSmartCrates[0].id;ppNewRenderSelectedCrate();}
function ppNewSelectedCrate(){const id=document.getElementById('ppNewCrateSelect')?.value||'';return ppSmartCrates.find(c=>String(c.id)===id)||null;}
function ppNewCrateChanged(){ppNewRenderSelectedCrate();}
function ppNewToggleCreate(){const box=document.getElementById('ppNewCreateBox');if(!box)return;box.style.display=box.style.display==='none'?'block':'none';}
function ppNewCreateCrates(){
 const no=Math.max(1,Math.min(60,Math.floor(ppNum(document.getElementById('ppNewCrateNo')?.value)||1))),count=Math.max(1,Math.min(60,Math.floor(ppNum(document.getElementById('ppNewCrateCount')?.value)||1))),tare=Math.max(0,ppNum(document.getElementById('ppNewTareWeight')?.value));
 const used=new Set(ppSmartCrates.map(c=>String(c.id).toUpperCase()));const ids=[];
 for(let n=0;n<count;n++){const id=count===1?`C-${String(no).padStart(2,'0')}`:`C-${String(no).padStart(2,'0')}-${ppRomanAt(n+1)}`;if(used.has(id.toUpperCase())){alert(`Crate ${ppDisplayCrateId(id)} already exists. Choose another crate number or number of crates.`);return;}ids.push(id);used.add(id.toUpperCase());}
 const firstLine=(ppCrateNextRows||[]).find(r=>String(r.profile)===String(document.getElementById('ppNewProfile')?.value)&&String(r.itemCode)===String(document.getElementById('ppNewItemCode')?.value)&&String(r.length)===String(document.getElementById('ppNewLength')?.value));
 let dims={outerL:Math.ceil((ppNum(firstLine?.length)||1)+40),outerW:Math.max(1,ppNum(ppSmartMasterFor(firstLine||{})?.crateWidth)||660),packingH:0,overallH:PP_LEG_HEIGHT,perLayer:0,layers:0,boxes:0,orientation:'auto',rowMultiplier:1};
 if(firstLine){const m=ppSmartMasterFor(firstLine),calc=m?ppSmartCalcDims([{lineKey:ppSmartLineKey(firstLine),po:firstLine.poNumber,profile:firstLine.profile,itemCode:firstLine.itemCode,length:firstLine.length,pcs:1,pcsPerBox:ppSmartPcsBox(firstLine),boxes:1,unitWeight:ppNum(firstLine.unitWeight||m?.unitWeight)}],{outerL:ppNum(m?.manualOuterL)||Math.ceil(ppNum(firstLine.length)+40),outerW:ppNum(m?.crateWidth),orientation:m?.orientation||'auto',rowMultiplier:1}):null;if(calc?.valid)dims={...dims,...calc,outerL:calc.outerL,outerW:calc.outerW,packingH:calc.packingH,overallH:calc.overallH};}
 ids.forEach(id=>ppSmartCrates.push({id,items:[],createdAt:Date.now(),outerL:dims.outerL,outerW:dims.outerW,packingH:0,extraHeight:0,overallH:PP_LEG_HEIGHT,perLayer:0,layers:0,boxes:0,orientation:dims.orientation||'auto',rowMultiplier:1,tareWeightKg:tare,manual:{outerL:dims.outerL,outerW:dims.outerW,orientation:dims.orientation||'auto',rowMultiplier:1},containerLayout:{x:0,y:0,z:0,zMm:0,rot:false,placed:false,baseId:''}}));
 ppSmartPersist();ppSmartRenderCrateList();ppNewRefreshCrateOptions();const last=ids[ids.length-1];document.getElementById('ppNewCrateSelect').value=last;ppNewRenderSelectedCrate();const box=document.getElementById('ppNewCreateBox');if(box)box.style.display='none';if(typeof showToast==='function')showToast(`${count} crate(s) created. Existing crate records were retained.`,'success');
}
let ppNewCrateViewMode='isometric';
function ppNewSetCrateView(mode){ppNewCrateViewMode=['isometric','top','front'].includes(mode)?mode:'isometric';ppNewRenderSelectedCrate();}
function ppNewRenderSelectedCrate(){
 const c=ppNewSelectedCrate(),host=document.getElementById('ppNewCrateDetails'),table=document.getElementById('ppNewCrateProfiles');if(!host||!table)return;
 if(!c){host.innerHTML='<div class="pp-empty">Select a saved crate or create a new crate.</div>';table.innerHTML='<table class="pp-table"><tbody><tr><td>No crate selected.</td></tr></tbody></table>';return;}
 const items=c.items||[],pcs=items.reduce((s,it)=>s+ppNum(it.pcs),0),profileWeight=items.reduce((s,it)=>s+ppNum(it.pcs)*ppNum(it.unitWeight),0),tare=Math.max(0,ppNum(c.tareWeightKg)),total=profileWeight+tare;
 const dL=Math.max(1,ppNum(c.outerL)),dW=Math.max(1,ppNum(c.outerW)+2*PP_WOOD_THICKNESS),dH=Math.max(1,ppNum(c.overallH)),maxH=PP_MAX_OVERALL_HEIGHT;
 const colors=['#829eac','#9ba7d4','#d7a35b','#71b6a0','#b7a0c9','#c77c66','#6e9cc8','#b3aa70'];
 const boxRows=items.map((it,i)=>{const master=ppSmartMasterFor(it)||{},dims=ppDims(master.boxSize)||{l:ppNum(it.length)||1,w:30,h:20};return {it,i,dims,boxes:Math.max(0,Math.floor(ppNum(it.boxes)||Math.ceil(ppNum(it.pcs)/Math.max(1,ppNum(it.pcsPerBox)||1)))),color:colors[i%colors.length]};}).filter(x=>x.boxes>0);
 let drawing='';
 if(ppNewCrateViewMode==='top'){
  drawing=`<svg viewBox="0 0 420 205" role="img" aria-label="Top view showing profile boxes inside crate" style="width:100%;max-height:250px"><rect x="44" y="26" width="332" height="145" rx="2" fill="#f0dfc2" stroke="#815a35" stroke-width="9"/><rect x="55" y="37" width="310" height="123" fill="#fff9ed" stroke="#ad7b48" stroke-width="1.5"/>`;
  let cursorY=43;const availableH=111,each=Math.min(15,Math.max(5,availableH/Math.max(1,boxRows.length)));
  boxRows.forEach((x,j)=>{const lenRatio=Math.max(.15,Math.min(1,(ppNum(x.it.length)||x.dims.l)/dL)),barW=292*lenRatio,qtyLines=Math.max(1,Math.min(4,Math.ceil(x.boxes/Math.max(1,Math.floor(292/Math.max(1,x.dims.w))))));for(let k=0;k<qtyLines&&cursorY<153;k++){drawing+=`<rect x="61" y="${cursorY}" width="${barW}" height="${Math.max(3,each-2)}" fill="${x.color}" stroke="#456171" stroke-width=".8" rx="1"/>`;cursorY+=Math.max(5,each); }drawing+=`<text x="64" y="${Math.min(155,cursorY-1)}" font-size="8" fill="#17324b">${ppNewEsc(String(x.it.profile))} · ${ppNewEsc(String(x.it.length))}mm · ${x.boxes} box(es)</text>`;});
  drawing+=`<text x="210" y="190" text-anchor="middle" font-size="11" font-weight="700" fill="#123c66">L ${dL} mm · W ${dW} mm</text></svg>`;
 }else if(ppNewCrateViewMode==='front'){
  drawing=`<svg viewBox="0 0 420 205" role="img" aria-label="Front view showing stacked profile boxes inside crate" style="width:100%;max-height:250px"><rect x="52" y="28" width="316" height="138" fill="#f0dfc2" stroke="#815a35" stroke-width="9"/><rect x="63" y="39" width="294" height="116" fill="#fff9ed" stroke="#ad7b48" stroke-width="1.5"/>`;
  const totalBoxes=Math.max(1,boxRows.reduce((sum,x)=>sum+x.boxes,0)),bands=Math.min(8,totalBoxes),bandH=105/bands;let y=45;for(let i=0;i<bands;i++){const x=boxRows[i%Math.max(1,boxRows.length)];drawing+=`<rect x="69" y="${y}" width="282" height="${Math.max(4,bandH-2)}" fill="${x?.color||'#829eac'}" stroke="#456171" stroke-width=".8"/>`;y+=bandH;}drawing+=`<text x="210" y="190" text-anchor="middle" font-size="11" font-weight="700" fill="#123c66">Front elevation · H ${dH} / ${maxH} mm</text></svg>`;
 }else{
  drawing=`<svg viewBox="0 0 420 230" role="img" aria-label="Isometric crate with profile box bundles loaded inside" style="width:100%;max-height:280px"><polygon points="34,62 235,20 385,72 179,117" fill="#e6c99d" stroke="#855b35" stroke-width="2"/><polygon points="34,62 179,117 179,181 34,121" fill="#c18a4a" stroke="#855b35" stroke-width="2"/><polygon points="179,117 385,72 385,137 179,181" fill="#b77b3f" stroke="#855b35" stroke-width="2"/><polygon points="51,64 235,31 365,73 179,105" fill="#f8ecd6" stroke="#9a6b3d" stroke-width="1.5"/>`;
  const innerCount=Math.max(1,boxRows.reduce((sum,x)=>sum+Math.min(6,Math.ceil(x.boxes/2)),0));let n=0;
  boxRows.forEach((x,j)=>{const count=Math.max(1,Math.min(6,Math.ceil(x.boxes/2))),ratio=Math.max(.18,Math.min(1,(ppNum(x.it.length)||x.dims.l)/dL));for(let k=0;k<count;k++){const t=n++/Math.max(1,innerCount),sx=67+t*90,sy=65+t*8,ex=sx+105*ratio,ey=sy+25*ratio;drawing+=`<path d="M ${sx} ${sy} L ${ex} ${ey} L ${ex} ${ey+3} L ${sx} ${sy+3} Z" fill="${x.color}" stroke="#476575" stroke-width=".7"/><path d="M ${sx} ${sy} L ${sx+4} ${sy-2} L ${ex+4} ${ey-2} L ${ex} ${ey} Z" fill="#d9e5eb" stroke="#476575" stroke-width=".6"/>`;}}
  );
  drawing+=`<polygon points="34,62 179,117 179,181 34,121" fill="#c18a4a" fill-opacity=".12" stroke="#855b35" stroke-width="2"/><polygon points="179,117 385,72 385,137 179,181" fill="#b77b3f" fill-opacity=".12" stroke="#855b35" stroke-width="2"/><g font-size="10" font-weight="700" fill="#123c66"><text x="188" y="205" text-anchor="middle">L ${dL} mm</text><text x="337" y="166">W ${dW} mm</text><text x="8" y="94">H ${dH} mm</text></g></svg>`;
 }
 const viewButtons=[['isometric','Isometric'],['top','Top'],['front','Front']].map(([mode,label])=>`<button type="button" class="btn btn-sm ${ppNewCrateViewMode===mode?'btn-accent':''}" onclick="ppNewSetCrateView('${mode}')">${label}</button>`).join('');
 const valid=items.length===0||dH<=maxH;
 host.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><b style="font-size:17px;color:#123c66">Crate ${ppNewEsc(ppDisplayCrateId(c.id))} Summary</b><span style="font-size:11px;font-weight:800;color:${valid?'#047857':'#b91c1c'}">${valid?'● HEIGHT VALID':'● HEIGHT OVER LIMIT'}</span></div><div class="pp-new-view-controls" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${viewButtons}</div><div class="pp-new-3dpreview">${drawing}<small>Crate loading preview · colored bundles represent profile/box groups; dimensions are schematic</small></div><div class="pp-new-dim-grid"><div><small>Crate length</small><b>${dL.toLocaleString()} mm</b></div><div><small>Crate width (outside)</small><b>${dW.toLocaleString()} mm</b></div><div><small>Overall height</small><b>${dH.toLocaleString()} / ${maxH} mm</b></div><div><small>Profiles / lines</small><b>${items.length}</b></div><div><small>Total PCS</small><b>${pcs.toLocaleString()}</b></div><div><small>Profile weight</small><b>${profileWeight.toLocaleString(undefined,{maximumFractionDigits:1})} kg</b></div><div><small>Crate tare</small><b>${tare.toLocaleString(undefined,{maximumFractionDigits:1})} kg</b></div><div><small>Total crate weight</small><b>${total.toLocaleString(undefined,{maximumFractionDigits:1})} kg</b></div><div><small>Box count</small><b>${items.reduce((s,it)=>s+ppNum(it.boxes),0).toLocaleString()}</b></div></div>`;
 table.innerHTML='<table class="pp-table"><thead><tr><th>PO</th><th>Profile</th><th>Item Code</th><th>Length</th><th>PCS</th><th>Boxes</th><th>Weight (kg)</th><th>Action</th></tr></thead><tbody>'+(items.length?items.map((it,i)=>`<tr><td>${ppNewEsc(it.po)}</td><td>${ppNewEsc(it.profile)}</td><td>${ppNewEsc(it.itemCode)}</td><td>${ppNewEsc(it.length)}</td><td>${ppNum(it.pcs).toLocaleString()}</td><td>${ppNum(it.boxes).toLocaleString()}</td><td>${(ppNum(it.pcs)*ppNum(it.unitWeight)).toLocaleString(undefined,{maximumFractionDigits:1})}</td><td><button class="btn btn-sm" onclick="ppNewEditLinePcs('${ppNewEsc(c.id)}',${i})">Edit PCS</button></td></tr>`).join(''):'<tr><td colspan="8">This crate is empty. Select a profile and add quantities from one or more POs.</td></tr>')+'</tbody></table>';
}
function ppNewEditLinePcs(crateId,index){const c=ppSmartCrates.find(x=>String(x.id)===String(crateId)),it=c?.items?.[index];if(!c||!it)return;const r=(ppCrateNextRows||[]).find(x=>ppSmartLineKey(x)===it.lineKey),alloc=ppSmartGetAllocations(),max=r?Math.max(0,Math.floor(ppNum(r.planningQty)-(alloc[it.lineKey]||0)+ppNum(it.pcs))):ppNum(it.pcs);const raw=prompt(`${it.po} / ${it.profile} / ${it.itemCode} / ${it.length} mm — PCS (max ${max})`,String(it.pcs));if(raw===null)return;const q=Math.floor(ppNum(raw));if(q<0||q>max){alert(`Enter PCS from 0 to ${max}.`);return;}const before=JSON.parse(JSON.stringify(c));it.pcs=q;it.boxes=Math.ceil(q/Math.max(1,ppNum(it.pcsPerBox)));c.items=c.items.filter(x=>ppNum(x.pcs)>0);const calc=ppSmartCalcDims(c.items,{...(c.manual||{}),outerL:ppNum(c.outerL),outerW:ppNum(c.outerW),orientation:c.orientation||'auto',rowMultiplier:c.rowMultiplier||1});if(c.items.length&&!calc.valid){Object.assign(c,before);alert(calc.reason||'PCS quantity does not fit the current crate.');return;}if(calc.valid){if(calc.packingH+ppNum(c.extraHeight)>PP_MAX_PACKING_HEIGHT){Object.assign(c,before);alert(`The updated crate would exceed ${PP_MAX_PACKING_HEIGHT} mm packing height.`);return;}Object.assign(c,calc,{extraHeight:ppNum(c.extraHeight),overallH:calc.overallH+ppNum(c.extraHeight)});}ppSmartPersist();ppSmartRenderCrateList();ppNewRefreshCrateOptions();}
function ppNewAddToCrate(){
 const c=ppNewSelectedCrate();if(!c){alert('Select an existing crate or create a new crate first.');return;}
 const rows=ppNewSelectedLines();if(!rows.length){alert('Select Profile, Item Code and Length from Next Planning PL first.');return;}
 const additions=[];for(let n=0;n<rows.length;n++){const r=rows[n],check=document.getElementById('ppNewCheck_'+n),q=Math.floor(ppNum(document.getElementById('ppNewQty_'+n)?.value));if(!check?.checked||q<1)continue;const balance=ppNewBalance(r);if(q>balance){alert(`${r.poNumber}: requested ${q} PCS, but only ${balance} PCS remain.`);return;}const m=ppSmartMasterFor(r),box=ppDims(m?.boxSize);if(!m||!box||!ppNum(m.crateWidth)){alert(`Crate Master Data is missing box size or width for ${r.profile} / ${r.itemCode} / ${r.length} mm.`);return;}if(ppNum(r.length)>ppNum(c.outerL)){alert(`Profile length ${r.length} mm is longer than crate ${ppDisplayCrateId(c.id)} length ${c.outerL} mm. Only profiles with length equal to or shorter than the crate are allowed.`);return;}const pbox=ppSmartPcsBox(r),key=ppSmartLineKey(r),existing=(c.items||[]).find(it=>it.lineKey===key);additions.push({lineKey:key,po:r.poNumber,profile:r.profile,itemCode:r.itemCode,length:r.length,pcs:q+(existing?ppNum(existing.pcs):0),pcsPerBox:pbox,boxes:Math.ceil((q+(existing?ppNum(existing.pcs):0))/pbox),unitWeight:ppNum(r.unitWeight||m.unitWeight)});}
 if(!additions.length){alert('Tick one or more PO rows and enter the PCS quantity to add.');return;}
 const items=[...(c.items||[])];for(const add of additions){const ix=items.findIndex(it=>it.lineKey===add.lineKey);if(ix>=0)items[ix]=add;else items.push(add);}
 const old=JSON.parse(JSON.stringify(c)),manual={...(c.manual||{}),outerL:ppNum(c.outerL),outerW:ppNum(c.outerW),orientation:c.orientation||'auto',rowMultiplier:Math.max(1,Math.min(3,Math.floor(ppNum(c.rowMultiplier)||1)))};
 const calc=ppSmartCalcDims(items,manual);if(!calc.valid){alert(`These profiles/PCS do not fit this crate: ${calc.reason||'check box size and dimensions'}`);return;}const extra=Math.max(0,ppNum(c.extraHeight));if(ppNum(calc.packingH)+extra>PP_MAX_PACKING_HEIGHT){alert(`Updated packing height would be ${ppNum(calc.packingH)+extra} mm. Maximum packing height is ${PP_MAX_PACKING_HEIGHT} mm. Reduce PCS or use another crate.`);return;}
 // Preserve crate identity, container location, tare and all other existing fields.
 c.items=items;Object.assign(c,{outerL:ppNum(c.outerL)||calc.outerL,outerW:ppNum(c.outerW)||calc.outerW,packingH:calc.packingH,extraHeight:extra,overallH:calc.overallH+extra,perLayer:calc.perLayer,layers:calc.layers,boxes:calc.boxes,orientation:calc.orientation,rowMultiplier:calc.rowMultiplier,manual:{...manual,packingH:calc.packingH,orientation:calc.orientation,rowMultiplier:calc.rowMultiplier}});
 if(ppNum(c.packingH)+ppNum(c.extraHeight)>PP_MAX_PACKING_HEIGHT){Object.assign(c,old);alert(`Packing height exceeds ${PP_MAX_PACKING_HEIGHT} mm. No changes were saved.`);return;}
 ppSmartPersist();ppSmartRenderCrateList();ppSmartRefreshPreviewOptions();ppNewRefreshCrateOptions();ppNewRenderSelectedCrate();ppNewRenderPoRows();ppNewUpdateTotals();if(typeof showToast==='function')showToast(`Added ${additions.reduce((s,x)=>s+x.pcs-(old.items||[]).filter(y=>y.lineKey===x.lineKey).reduce((a,y)=>a+ppNum(y.pcs),0),0)} PCS from ${additions.length} PO line(s) to crate ${ppDisplayCrateId(c.id)}.`, 'success');
}
// Crate IDs without suffix display as plain numbers; legacy IDs retain their original Roman suffix.
ppDisplayCrateId=function(id){const m=String(id||'').match(/^C-0*(\d+)(?:-([IVXLCDM]+))?$/i);return m?`${Number(m[1])}${m[2]?'-'+ppRomanLower(m[2]):''}`:String(id||'—').replace(/^C-0*(\d+)-/i,'$1-').toLowerCase();};
// Refresh the new UI whenever the legacy planner refreshes rows or renders the saved crate list.
const ppNewOriginalRefreshNextPlLines=ppRefreshNextPlLines;
ppRefreshNextPlLines=function(){const out=ppNewOriginalRefreshNextPlLines.apply(this,arguments);try{ppNewRefreshProfileOptions();}catch(e){console.warn('Multi-PO profile selector refresh:',e);}return out;};
const ppNewOriginalRenderCrateList=ppSmartRenderCrateList;
ppSmartRenderCrateList=function(){const out=ppNewOriginalRenderCrateList.apply(this,arguments);try{ppNewRefreshCrateOptions();ppNewUpdateTotals();}catch(e){console.warn('Crate builder refresh:',e);}return out;};
document.addEventListener('DOMContentLoaded',()=>{try{ppNewInit();}catch(e){console.warn('Crate builder init:',e);}});


/* AIS Tracker V2.8: corrected PCS-to-box-layer height calculation and compact dimensional 2D crate preview, Master Data-driven dimensions,
   live box/layer/height/weight breakdown. Does not migrate or rewrite existing records. */
function ppNewClampRows(v){return Math.max(1,Math.min(3,Math.floor(ppNum(v)||1)));}
function ppNewActiveMaster(){
 const r=(ppNewSelectedLines&&ppNewSelectedLines()[0])||null;
 return {line:r,master:r&&typeof ppSmartMasterFor==='function'?ppSmartMasterFor(r):null};
}
function ppNewUpdateCreateDimensions(){
 const lenEl=document.getElementById('ppNewAutoLength'),layerEl=document.getElementById('ppNewAutoLayerBoxes');
 const idsEl=document.getElementById('ppNewGeneratedIds');
 const {line:r,master:m}=ppNewActiveMaster();
 const rows=ppNewClampRows(document.getElementById('ppNewRowMode')?.value||m?.rowMultiplier||1);
 if(!r||!m){if(lenEl)lenEl.value='';if(layerEl)layerEl.value='';if(idsEl)idsEl.textContent='Select a Profile, Item Code and Length with complete Crate Master Data to calculate the dimensions.';return null;}
 const box=ppDims(m.boxSize);const width=ppNum(m.crateWidth);
 if(!box||width<=0){if(lenEl)lenEl.value='';if(layerEl)layerEl.value='';if(idsEl)idsEl.textContent='Crate Master Data needs a box size and standard width for this profile/length.';return null;}
 const masterRows=ppNewClampRows(m.rowMultiplier||1);
 const masterLength=ppNum(m.manualOuterL)>0?ppNum(m.manualOuterL)/masterRows:0;
 const singleLength=Math.max(ppNum(r.length)+32,masterLength);
 const outerL=Math.ceil(singleLength)*rows;
 const calc=ppCrateCalc({...m,rowMultiplier:rows,orientation:'auto',manualOuterL:outerL,manualPackingH:null,manualPerLayer:null,manualLayers:null,manualBoxesPerCrate:null});
 if(lenEl)lenEl.value=String(outerL);
 if(layerEl)layerEl.value=calc?.valid?String(ppNum(calc.perLayer)||ppNum(calc.per)||0):'';
 if(idsEl){const no=Math.max(1,Math.min(60,Math.floor(ppNum(document.getElementById('ppNewCrateNo')?.value)||1))),count=Math.max(1,Math.min(60,Math.floor(ppNum(document.getElementById('ppNewCrateCount')?.value)||1)));const ids=count===1?[String(no)]:Array.from({length:Math.min(count,5)},(_,i)=>`${no}-${ppRomanLower(ppRomanAt(i+1))}`);idsEl.innerHTML=`<b>Crate ID${count>1?'s':''}:</b> ${ids.map(ppNewEsc).join(', ')}${count>5?' …':''}<br><span>Usable Master Data width ${width} mm + ${2*PP_WOOD_THICKNESS} mm side timber = outside width ${width+2*PP_WOOD_THICKNESS} mm; ${rows} lengthwise row(s).</span>`;}
 return {line:r,master:m,box,width,rows,outerL,calc};
}
function ppNewRowModeChanged(){
 const d=ppNewUpdateCreateDimensions();
 if(d){const select=document.getElementById('ppNewRowMode');if(select)select.value=String(d.rows);}
 const crate=ppNewSelectedCrate();if(crate)ppNewRenderSelectedCrate();
}
function ppNewPreviewCrateIds(){ppNewUpdateCreateDimensions();}
function ppNewSetMasterRowMode(){const {line,master}=ppNewActiveMaster();const el=document.getElementById('ppNewRowMode');if(!line||!master||!el)return;el.value=String(ppNewClampRows(master.rowMultiplier||1));}
const ppNewProfileChangedV27Base=ppNewProfileChanged;
ppNewProfileChanged=function(){const out=ppNewProfileChangedV27Base.apply(this,arguments);ppNewSetMasterRowMode();ppNewUpdateCreateDimensions();return out;};
const ppNewItemChangedV27Base=ppNewItemChanged;
ppNewItemChanged=function(){const out=ppNewItemChangedV27Base.apply(this,arguments);ppNewSetMasterRowMode();ppNewUpdateCreateDimensions();return out;};
const ppNewLengthChangedV27Base=ppNewLengthChanged;
ppNewLengthChanged=function(){const out=ppNewLengthChangedV27Base.apply(this,arguments);ppNewSetMasterRowMode();ppNewUpdateCreateDimensions();return out;};

/* New-crate dimensions always originate from the selected profile's Crate Master row.
   A single crate uses its plain number; Roman suffixes are only generated for multi-crate creation. */
ppNewCreateCrates=function(){
 const no=Math.max(1,Math.min(60,Math.floor(ppNum(document.getElementById('ppNewCrateNo')?.value)||1)));
 const count=Math.max(1,Math.min(60,Math.floor(ppNum(document.getElementById('ppNewCrateCount')?.value)||1)));
 const tare=Math.max(0,ppNum(document.getElementById('ppNewTareWeight')?.value));
 const d=ppNewUpdateCreateDimensions();
 if(!d){alert('Select a Profile, Item Code and Length, then complete Box Size and Crate Width in Crate Master Data before creating the crate.');return;}
 const used=new Set(ppSmartCrates.map(c=>String(c.id).toUpperCase()));const ids=[];
 for(let n=0;n<count;n++){
  const id=count===1?`C-${String(no).padStart(2,'0')}`:`C-${String(no).padStart(2,'0')}-${ppRomanAt(n+1)}`;
  if(used.has(id.toUpperCase())){alert(`Crate ${ppDisplayCrateId(id)} already exists. Choose another crate number.`);return;}
  ids.push(id);used.add(id.toUpperCase());
 }
 for(const id of ids){
  ppSmartCrates.push({id,items:[],createdAt:Date.now(),outerL:d.outerL,outerW:d.width,packingH:0,extraHeight:0,overallH:PP_LEG_HEIGHT,perLayer:ppNum(d.calc?.perLayer)||ppNum(d.calc?.per)||0,layers:0,boxes:0,orientation:d.calc?.orientation||d.master.orientation||'auto',rowMultiplier:d.rows,tareWeightKg:tare,manual:{outerL:d.outerL,outerW:d.width,orientation:d.calc?.orientation||d.master.orientation||'auto',rowMultiplier:d.rows},containerLayout:{x:0,y:0,z:0,zMm:0,rot:false,placed:false,baseId:''}});
 }
 ppSmartPersist();ppSmartRenderCrateList();ppNewRefreshCrateOptions();
 const last=ids[ids.length-1],sel=document.getElementById('ppNewCrateSelect');if(sel)sel.value=last;
 ppNewRenderSelectedCrate();ppNewUpdateCreateDimensions();
 const createBox=document.getElementById('ppNewCreateBox');if(createBox)createBox.style.display='none';
 if(typeof showToast==='function')showToast(`${count} crate(s) created using Crate Master Data dimensions. Existing crate records were retained.`,'success');
};

ppNewCrateViewMode='side';
function ppNewSetCrateView(mode){ppNewCrateViewMode=['top','side','front'].includes(mode)?mode:'side';ppNewRenderSelectedCrate();}
function ppNewCalcCratePreview(c,items){
 const safeItems=(items||[]).filter(it=>ppNum(it.pcs)>0);
 const masterRows=safeItems.map(it=>({it,m:ppSmartMasterFor(it),d:ppDims(ppSmartMasterFor(it)?.boxSize)}));
 const firstSelected=ppNewActiveMaster();
 const fallbackMaster=masterRows.find(x=>x.m)?.m||firstSelected.master||null;
 const sourceRows=masterRows.filter(x=>x.m&&x.d);
 const boxTotal=safeItems.reduce((s,it)=>s+Math.ceil(ppNum(it.pcs)/Math.max(1,ppNum(it.pcsPerBox)||ppNum(ppSmartMasterFor(it)?.pcsPerBox)||1)),0);
 const rawMasterW=ppNum(c.outerW)||Math.max(0,...sourceRows.map(x=>ppNum(x.m.crateWidth)),ppNum(fallbackMaster?.crateWidth));
 const widthOutside=rawMasterW>0?rawMasterW+2*PP_WOOD_THICKNESS:0;
 const rows=ppNewClampRows(c.rowMultiplier||c.manual?.rowMultiplier||fallbackMaster?.rowMultiplier||1);
 let orientation=['height','width'].includes(c.orientation)?c.orientation:(['height','width'].includes(c.manual?.orientation)?c.manual.orientation:(fallbackMaster?.orientation||'auto'));
 if(!['height','width'].includes(orientation)){
  const calculated=safeItems.length?ppSmartCalcDims(safeItems,{outerL:ppNum(c.outerL),outerW:rawMasterW,rowMultiplier:rows,orientation:'auto'}):null;
  orientation=calculated?.orientation||ppCrateCalc({...fallbackMaster,rowMultiplier:rows,manualOuterL:ppNum(c.outerL)||fallbackMaster?.manualOuterL})?.orientation||'height';
 }
 const crossMax=sourceRows.length?Math.max(...sourceRows.map(x=>orientation==='width'?x.d.h:x.d.w)):0;
 const verticalMax=sourceRows.length?Math.max(...sourceRows.map(x=>orientation==='width'?x.d.w:x.d.h)):0;
 const innerW=Math.max(0,rawMasterW-2*PP_WOOD_THICKNESS);
 const acrossWidth=crossMax>0?Math.floor(innerW/crossMax):0;
 const boxesPerLayer=Math.max(0,acrossWidth*rows);
 const layers=boxTotal>0&&boxesPerLayer>0?Math.ceil(boxTotal/boxesPerLayer):0;
 const extra=Math.max(0,ppNum(c.extraHeight));
 let packingHeight=layers*verticalMax+extra;
 // Use calculator results for compatibility with the saved planner geometry, but do not trust
 // an old stored height after a quantity preview: calculate it again from PCS and Master Data.
 if(safeItems.length){const metric=ppSmartCalcDims(safeItems,{outerL:ppNum(c.outerL),outerW:rawMasterW,orientation,rowMultiplier:rows});if(metric?.valid){packingHeight=ppNum(metric.packingH)+extra;}}
 const overallHeight=packingHeight+PP_LEG_HEIGHT+2*PP_WOOD_WIDTH;
 const length=Math.max(1,ppNum(c.outerL)||Math.ceil((Math.max(0,...safeItems.map(it=>ppNum(it.length)),ppNum(firstSelected.line?.length))+32)*rows));
 const pcs=safeItems.reduce((s,it)=>s+ppNum(it.pcs),0);
 const profileWeight=safeItems.reduce((s,it)=>s+ppNum(it.pcs)*ppNum(it.unitWeight||ppSmartMasterFor(it)?.unitWeight),0);
 const tare=Math.max(0,ppNum(c.tareWeightKg));
 return {items:safeItems,sourceRows,boxTotal,boxesPerLayer,acrossWidth,layers,packingHeight,overallHeight,length,widthBase:rawMasterW,widthOutside,rows,orientation,crossMax,verticalMax,pcs,profileWeight,tare,totalWeight:profileWeight+tare,valid:packingHeight<=PP_MAX_PACKING_HEIGHT,extra,innerW};
}
function ppNewBuildDraftItems(c){
 const rows=ppNewSelectedLines();if(!c||!rows.length)return null;
 const draft=JSON.parse(JSON.stringify(c.items||[]));let found=false;
 rows.forEach((r,n)=>{
  const checked=document.getElementById('ppNewCheck_'+n)?.checked;
  const qty=Math.floor(ppNum(document.getElementById('ppNewQty_'+n)?.value));
  if(!checked||qty<1)return;
  const balance=ppNewBalance(r);if(qty>balance)return;
  const m=ppSmartMasterFor(r);if(!m||!ppDims(m.boxSize))return;
  const key=ppSmartLineKey(r),pbox=Math.max(1,ppSmartPcsBox(r)),ix=draft.findIndex(it=>it.lineKey===key);
  if(ix>=0){draft[ix].pcs=ppNum(draft[ix].pcs)+qty;draft[ix].pcsPerBox=pbox;draft[ix].boxes=Math.ceil(draft[ix].pcs/pbox);}
  else draft.push({lineKey:key,po:r.poNumber,profile:r.profile,itemCode:r.itemCode,length:r.length,pcs:qty,pcsPerBox:pbox,boxes:Math.ceil(qty/pbox),unitWeight:ppNum(r.unitWeight||m.unitWeight)});
  found=true;
 });
 return found?draft:null;
}
function ppNewDrawCrate2D(c,metric,view){
 const outerL=metric.length,outerW=metric.widthOutside||1,packing=metric.packingHeight,overall=metric.overallHeight,layers=metric.layers,perLayer=metric.boxesPerLayer,rows=metric.rows,items=metric.items;
 const colors=['#8ba9bb','#d5a15b','#6fb49d','#a899cb','#c78072','#6e9dc7','#a5b16b'];
 let svg='',desc='';
 if(view==='top'){
  const x=52,y=35,w=356,h=130,innerX=x+11,innerY=y+11,innerW=w-22,innerH=h-22;
  svg=`<svg viewBox="0 0 460 218" role="img" aria-label="2D top view crate box layout"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#b98146" stroke="#81562f" stroke-width="3"/><rect x="${innerX}" y="${innerY}" width="${innerW}" height="${innerH}" fill="#fff8e9" stroke="#96673c" stroke-width="1.5"/>`;
  if(metric.boxTotal>0&&perLayer>0){const shown=Math.min(perLayer,100),across=Math.max(1,Math.ceil(perLayer/rows)),cellX=innerW/rows,cellY=innerH/across;for(let n=0;n<shown;n++){const rr=Math.floor(n/across),cc=n%across;const pad=1.5;svg+=`<rect x="${innerX+rr*cellX+pad}" y="${innerY+cc*cellY+pad}" width="${Math.max(1,cellX-3)}" height="${Math.max(1,cellY-3)}" rx="1.5" fill="${colors[n%colors.length]}" stroke="#466477" stroke-width=".7"/>`;}}
  svg+=`<text x="230" y="188" text-anchor="middle" font-size="11" font-weight="800" fill="#123c66">L ${outerL} mm · W ${Math.round(outerW)} mm</text><text x="230" y="205" text-anchor="middle" font-size="10" fill="#536b7b">Bottom layer layout · ${perLayer} box slot(s) / layer · ${rows} lengthwise row(s)</text></svg>`;
  desc='Top view — individual tiles show the bottom-layer box positions.';
 }else if(view==='front'){
  const x=100,y=31,w=260,baseY=166,packPx=91,framePx=10,legPx=13,usableY=baseY-framePx-packPx;
  svg=`<svg viewBox="0 0 460 218" role="img" aria-label="2D front cross-section of the crate"><rect x="${x}" y="${usableY-framePx}" width="${w}" height="${packPx+2*framePx}" fill="#d6a86c" stroke="#81562f" stroke-width="2"/><rect x="${x+9}" y="${usableY}" width="${w-18}" height="${packPx}" fill="#fff8e9" stroke="#96673c" stroke-width="1.5"/>`;
  if(metric.boxTotal>0&&layers>0){const drawLayers=Math.min(layers,15),band=packPx/drawLayers,slots=Math.max(1,Math.min(metric.acrossWidth,12)),slotW=(w-22)/slots;for(let r=0;r<drawLayers;r++){for(let k=0;k<slots;k++){svg+=`<rect x="${x+11+k*slotW}" y="${usableY+r*band+1}" width="${Math.max(1,slotW-2)}" height="${Math.max(1,band-2)}" fill="${colors[(r+k)%colors.length]}" stroke="#466477" stroke-width=".65"/>`;}}}
  svg+=`<rect x="${x+16}" y="${baseY+framePx}" width="18" height="${legPx}" fill="#a87842" stroke="#81562f"/><rect x="${x+w-34}" y="${baseY+framePx}" width="18" height="${legPx}" fill="#a87842" stroke="#81562f"/><text x="230" y="199" text-anchor="middle" font-size="11" font-weight="800" fill="#123c66">Front / end cross-section · W ${Math.round(outerW)} mm</text><text x="230" y="212" text-anchor="middle" font-size="10" fill="#536b7b">${layers} layer(s) · ${Math.round(packing)} mm packing + ${PP_LEG_HEIGHT} mm legs</text></svg>`;
  desc='Front view — shows stack layers, timber frame and legs schematically.';
 }else{
  const x=51,y=28,w=358,baseY=162,packPx=Math.min(95,Math.max(0,packing/PP_MAX_PACKING_HEIGHT*95)),framePx=9,legPx=14,bodyTop=baseY-framePx-packPx-framePx,packTop=bodyTop+framePx,packBottom=baseY-framePx;
  svg=`<svg viewBox="0 0 460 218" role="img" aria-label="2D side elevation with box layers and crate legs"><rect x="${x}" y="${bodyTop}" width="${w}" height="${packPx+2*framePx}" fill="#d3a064" stroke="#81562f" stroke-width="2"/><rect x="${x+9}" y="${packTop}" width="${w-18}" height="${Math.max(0,packPx)}" fill="#fff8e9" stroke="#96673c" stroke-width="1.5"/>`;
  if(metric.boxTotal>0&&layers>0&&packPx>0){const drawLayers=Math.min(layers,15),band=packPx/drawLayers,slots=Math.max(1,Math.min(perLayer,18)),slotW=(w-20)/slots;for(let r=0;r<drawLayers;r++){for(let k=0;k<slots;k++){svg+=`<rect x="${x+10+k*slotW}" y="${packTop+r*band+1}" width="${Math.max(1,slotW-2)}" height="${Math.max(1,band-2)}" fill="${colors[(r+k)%colors.length]}" stroke="#466477" stroke-width=".65"/>`;}}}
  svg+=`<rect x="${x+14}" y="${baseY}" width="18" height="${legPx}" fill="#a87842" stroke="#81562f"/><rect x="${x+w/2-9}" y="${baseY}" width="18" height="${legPx}" fill="#a87842" stroke="#81562f"/><rect x="${x+w-32}" y="${baseY}" width="18" height="${legPx}" fill="#a87842" stroke="#81562f"/><text x="230" y="194" text-anchor="middle" font-size="11" font-weight="800" fill="#123c66">Side elevation · L ${outerL} mm</text><text x="230" y="208" text-anchor="middle" font-size="10" fill="#536b7b">Packing ${Math.round(packing)} mm · legs 100 mm · overall ${Math.round(overall)} mm</text></svg>`;
  desc='Side elevation — layers and the timber frame/leg height are shown schematically.';
 }
 return `<div class="pp-new-2d-stage">${svg}<div class="pp-new-2d-caption">${desc} Diagram is scaled for display; final dimensions are calculated in millimetres.</div></div>`;
}
ppNewRenderSelectedCrate=function(draftItems=null,draftMode=false){
 const c=ppNewSelectedCrate(),host=document.getElementById('ppNewCrateDetails'),table=document.getElementById('ppNewCrateProfiles');if(!host||!table)return;
 if(!c){host.innerHTML='<div class="pp-empty">Select an existing crate or create a new crate.</div>';table.innerHTML='<table class="pp-table"><tbody><tr><td>No crate selected.</td></tr></tbody></table>';return;}
 const items=draftItems?draftItems:(c.items||[]),metric=ppNewCalcCratePreview(c,items),valid=metric.valid,viewButtons=[['top','Top 2D'],['side','Side 2D'],['front','Front 2D']].map(([mode,label])=>`<button type="button" class="btn btn-sm ${ppNewCrateViewMode===mode?'btn-accent':''}" onclick="ppNewSetCrateView('${mode}')">${label}</button>`).join('');
 const dimensionTiles=[
  ['Length (Master Data)',`${metric.length.toLocaleString()} mm`],
  ['Width outside',`${Math.round(metric.widthOutside).toLocaleString()} mm`],
  ['Bottom-layer boxes',metric.boxesPerLayer.toLocaleString()],
  ['Total boxes / layers',`${metric.boxTotal.toLocaleString()} boxes / ${metric.layers.toLocaleString()} layer(s)`],
  ['Packing height',`${Math.round(metric.packingHeight)} / ${PP_MAX_PACKING_HEIGHT} mm`],
  ['Leg height',`${PP_LEG_HEIGHT} mm`],
  ['Timber side allowance',`${2*PP_WOOD_THICKNESS} mm on width`],
  ['Overall height incl. legs',`${Math.round(metric.overallHeight).toLocaleString()} mm`],
  ['Profile PCS / weight',`${metric.pcs.toLocaleString()} PCS · ${metric.profileWeight.toLocaleString(undefined,{maximumFractionDigits:1})} kg`],
  ['Crate tare / total',`${metric.tare.toLocaleString(undefined,{maximumFractionDigits:1})} + ${metric.totalWeight.toLocaleString(undefined,{maximumFractionDigits:1})} kg`]
 ];
 host.innerHTML=`<div class="pp-new-summary-head"><div><b>Crate ${ppNewEsc(ppDisplayCrateId(c.id))} — Packing details</b><small>${metric.rows} lengthwise row(s) · dimensions follow Crate Master Data</small></div><span class="pp-new-validity ${valid?'ok':'bad'}">${valid?'HEIGHT VALID':'HEIGHT OVER 1100 MM'}</span></div>${draftMode?'<div class="pp-new-draft-banner"><i class="fa-solid fa-eye"></i> Preview includes your selected PCS quantities; click Add to save them.</div>':''}<div class="pp-new-view-controls">${viewButtons}</div>${ppNewDrawCrate2D(c,metric,ppNewCrateViewMode)}<div class="pp-new-dim-grid pp-new-dim-grid-v27">${dimensionTiles.map(([label,value])=>`<div><small>${ppNewEsc(label)}</small><b>${ppNewEsc(value)}</b></div>`).join('')}</div><div class="pp-new-fit-note ${valid?'ok':'bad'}">${valid?`Calculated from ${metric.boxTotal} box(es): ${metric.boxesPerLayer} box(es) per bottom layer × ${metric.layers} layer(s) = ${Math.round(metric.packingHeight)} mm packing height.`:`Calculated packing height is ${Math.round(metric.packingHeight)} mm. Reduce PCS or review box size, orientation, width and rows in Crate Master Data.`} Overall height = packing height + ${PP_LEG_HEIGHT} mm legs. Timber side allowance is applied to outside width, not added again to height. ${metric.widthBase} mm Master Data width + ${2*PP_WOOD_THICKNESS} mm timber/frame allowance = ${Math.round(metric.widthOutside)} mm outside width.</div>`;
 table.innerHTML=`<table class="pp-table"><thead><tr><th>PO</th><th>Profile</th><th>Item Code</th><th>Length</th><th>PCS</th><th>PCS/Box</th><th>Boxes</th><th>Weight (kg)</th><th>Action</th></tr></thead><tbody>${items.length?items.map((it,i)=>`<tr><td>${ppNewEsc(it.po)}</td><td>${ppNewEsc(it.profile)}</td><td>${ppNewEsc(it.itemCode)}</td><td>${ppNewEsc(it.length)}</td><td>${ppNum(it.pcs).toLocaleString()}</td><td>${Math.max(1,ppNum(it.pcsPerBox)||1).toLocaleString()}</td><td>${Math.ceil(ppNum(it.pcs)/Math.max(1,ppNum(it.pcsPerBox)||1)).toLocaleString()}</td><td>${(ppNum(it.pcs)*ppNum(it.unitWeight||ppSmartMasterFor(it)?.unitWeight)).toLocaleString(undefined,{maximumFractionDigits:1})}</td><td>${draftMode?'<span class="pp-new-pending-label">Pending add</span>':`<button class="btn btn-sm" onclick="ppNewEditLinePcs('${ppNewEsc(c.id)}',${i})">Edit PCS</button>`}</td></tr>`).join(''):'<tr><td colspan="9">No profiles added yet. Select a profile and add quantities from one or more POs.</td></tr>'}</tbody></table>`;
};
const ppNewUpdateTotalsV27Base=ppNewUpdateTotals;
ppNewUpdateTotals=function(){const out=ppNewUpdateTotalsV27Base.apply(this,arguments);const c=ppNewSelectedCrate();if(c){const draft=ppNewBuildDraftItems(c);ppNewRenderSelectedCrate(draft||null,!!draft);}return out;};
const ppNewCrateChangedV27Base=ppNewCrateChanged;
ppNewCrateChanged=function(){const out=ppNewCrateChangedV27Base.apply(this,arguments);ppNewUpdateTotals();return out;};
const ppNewAddToCrateV27Base=ppNewAddToCrate;
ppNewAddToCrate=function(){const c=ppNewSelectedCrate(),before=c?JSON.stringify(c):'';ppNewAddToCrateV27Base.apply(this,arguments);const afterCrate=ppNewSelectedCrate();if(afterCrate&&JSON.stringify(afterCrate)!==before){ppNewSelectedLines().forEach((r,n)=>{const q=document.getElementById('ppNewQty_'+n),ch=document.getElementById('ppNewCheck_'+n);if(q)q.value='0';if(ch)ch.checked=false;});ppNewRenderPoRows();ppNewUpdateTotals();ppSmartPersist();}};
const ppNewRefreshCrateOptionsV27Base=ppNewRefreshCrateOptions;
ppNewRefreshCrateOptions=function(){const out=ppNewRefreshCrateOptionsV27Base.apply(this,arguments);ppNewUpdateCreateDimensions();return out;};
document.addEventListener('DOMContentLoaded',()=>{try{ppNewUpdateCreateDimensions();ppNewPreviewCrateIds();}catch(e){console.warn('V2.8 crate dimension preview:',e);}});



/* AIS Tracker V2.8 packing calculation correction.
   Crate Master Data crateWidth is the usable/internal width. Add 20 mm timber per side
   only for the physical outside width. Height formula: box vertical side × layers + 100 mm legs.
   Old records are not rewritten; the calculations are applied whenever a crate is previewed or edited. */
function ppV28Rows(v){return Math.max(1,Math.min(3,Math.floor(ppNum(v)||1)));}
function ppV28OrientationRequest(items, manual={}){
 // Only an explicit selection in the live crate-builder control may lock orientation.
 // Old Master Catalog orientation values are historical hints and can otherwise force
 // a poor fit (for example, 10 boxes being treated as 5 layers of 265 mm).
 const input=document.getElementById('ppBoxOrientation')?.value;
 if(input==='height'||input==='width') return input;
 return 'auto';
}
ppCrateCalc=function(row){
 const d=ppDims(row?.boxSize);if(!d||!d.l||!d.w||!d.h)return {valid:false,reason:'Box Size (L × W × H) is missing in Crate Master Data.'};
 const width=ppNum(row.crateWidth);if(width<=0)return {valid:false,reason:'Usable/internal crate width is missing in Crate Master Data.'};
 const rows=ppV28Rows(row.rowMultiplier),requested=['height','width'].includes(row.orientation)?row.orientation:'auto';
 const candidates=[];
 for(const orientation of ['height','width']){
  if(requested!=='auto'&&requested!==orientation)continue;
  // Box Size is L × W × H. Standard: H vertical; rotated: W vertical.
  const acrossDim=orientation==='height'?d.w:d.h;
  const vertical=orientation==='height'?d.h:d.w;
  const across=Math.floor(width/acrossDim);if(across<1||vertical<=0)continue;
  const perLayer=across*rows;
  const maxLayers=Math.floor(PP_MAX_PACKING_HEIGHT/vertical);if(maxLayers<1)continue;
  let layers=maxLayers,boxes=perLayer*maxLayers,packingH=layers*vertical;
  const manualBoxes=Math.floor(ppNum(row.manualBoxesPerCrate));
  const manualH=ppNum(row.manualPackingH);
  const manualPer=Math.floor(ppNum(row.manualPerLayer));
  const actualPer=manualPer>0?manualPer:perLayer;
  if(manualBoxes>0){boxes=manualBoxes;layers=Math.ceil(boxes/actualPer);packingH=manualH>0?manualH:layers*vertical;}
  else if(manualH>0){packingH=Math.min(PP_MAX_PACKING_HEIGHT,manualH);layers=Math.floor(packingH/vertical);boxes=actualPer*layers;}
  const overallH=packingH+PP_LEG_HEIGHT;
  const minimumLength=Math.ceil((ppNum(row.length)||d.l)+32)*rows;
  const outerL=ppNum(row.manualOuterL)||minimumLength;
  const valid=packingH<=PP_MAX_PACKING_HEIGHT && overallH<=PP_MAX_OVERALL_HEIGHT && layers>=0 && boxes>=0;
  candidates.push({valid,box:d,orientation,outerL,outerW:width,widthOutside:width+2*PP_WOOD_THICKNESS,packingH,overallH,perLayer:actualPer,per:actualPer,layers,boxesPerCrate:boxes,maxCapacity:actualPer*maxLayers,maxLayers,boxesAcross:across,rowMultiplier:rows,internalWidth:width,manual:!!(row.manualOuterL||row.manualPackingH||row.manualPerLayer||row.manualBoxesPerCrate)});
 }
 if(!candidates.length)return {valid:false,reason:'Neither box orientation fits the Master Data crate width.'};
 candidates.sort((a,b)=>(a.valid===b.valid?0:a.valid?-1:1)||b.maxCapacity-a.maxCapacity||a.packingH-b.packingH);
 const c=candidates[0];
 if(!c.valid)c.reason=`Packing height ${c.packingH} mm exceeds the ${PP_MAX_PACKING_HEIGHT} mm limit.`;
 return c;
};

ppSmartOrientationMetrics=function(items,manual={}){
 const parsed=(items||[]).map(it=>({it,m:ppSmartMasterFor(it),d:ppDims(ppSmartMasterFor(it)?.boxSize)}));
 if(!parsed.length||parsed.some(x=>!x.m||!x.d))return {valid:false,reason:'Box Size is missing for one or more profiles. Complete Crate Master Data first.'};
 const masters=parsed.map(x=>x.m);
 // Existing crate outerW values in AIS Tracker have historically stored the Master Data internal width.
 const width=ppNum(manual.outerW)||Math.max(0,...masters.map(m=>ppNum(m.crateWidth)));
 if(width<=0)return {valid:false,reason:'Crate Master Data usable width is missing.'};
 const rows=ppV28Rows(manual.rowMultiplier||Math.max(1,...masters.map(m=>ppV28Rows(m.rowMultiplier))));
 const boxes=(items||[]).reduce((sum,it)=>sum+Math.ceil(Math.max(0,ppNum(it.pcs))/Math.max(1,ppNum(it.pcsPerBox)||ppNum(ppSmartMasterFor(it)?.pcsPerBox)||1)),0);
 const requested=ppV28OrientationRequest(items,manual);
 const longestProfile=Math.max(0,...items.map(it=>ppNum(it.length)));
 const masterSingleLength=Math.max(0,...masters.map(m=>ppNum(m.manualOuterL)>0?ppNum(m.manualOuterL)/ppV28Rows(m.rowMultiplier):0));
 const singleLength=Math.max(longestProfile+32,masterSingleLength);
 const outerL=ppNum(manual.outerL)||Math.ceil(singleLength)*rows;
 const maxBoxL=Math.max(0,...parsed.map(x=>x.d.l));
 if(maxBoxL>outerL/rows+0.5)return {valid:false,reason:`Box length ${maxBoxL} mm is longer than the available length per row (${Math.round(outerL/rows)} mm). Increase crate length in Crate Master Data.`};
 const candidates=[];
 for(const orientation of ['height','width']){
  if(requested!=='auto'&&requested!==orientation)continue;
  const crossDims=parsed.map(x=>orientation==='height'?x.d.w:x.d.h);
  const verticalDims=parsed.map(x=>orientation==='height'?x.d.h:x.d.w);
  const acrossDim=Math.max(...crossDims),vertical=Math.max(...verticalDims);
  const across=Math.floor(width/acrossDim);if(across<1||vertical<=0)continue;
  const perLayer=across*rows;
  const layers=boxes>0?Math.ceil(boxes/perLayer):0;
  const packingH=layers*vertical,overallH=packingH+PP_LEG_HEIGHT;
  const maxLayers=Math.floor(PP_MAX_PACKING_HEIGHT/vertical),maxCapacity=perLayer*maxLayers;
  candidates.push({valid:packingH<=PP_MAX_PACKING_HEIGHT&&overallH<=PP_MAX_OVERALL_HEIGHT,orientation,rowMultiplier:rows,width,internalWidth:width,widthOutside:width+2*PP_WOOD_THICKNESS,perLayer,per:perLayer,layers,boxes,packingH,overallH,maxCapacity,maxLayers,maxAcross:across,maxVertical:vertical,outerL,outerW:width,boxesAcross:across});
 }
 if(!candidates.length)return {valid:false,reason:'No box orientation fits the crate internal width. Check Box Size and Crate Master Data width.'};
 candidates.sort((a,b)=>(a.valid===b.valid?0:a.valid?-1:1)||b.maxCapacity-a.maxCapacity||a.packingH-b.packingH);
 const best=candidates[0];
 if(!best.valid)return {...best,valid:false,reason:`Needs ${best.packingH} mm packing height (${best.boxes} boxes ÷ ${best.perLayer} boxes per bottom layer = ${best.layers} layers). Maximum packing height is ${PP_MAX_PACKING_HEIGHT} mm. Reduce PCS, increase bottom-layer rows if the length permits, or use another crate.`};
 return best;
};
ppSmartCalcDims=function(items,manual={}){
 const c=ppSmartOrientationMetrics(items,manual);
 return c.valid?{...c,packingH:c.packingH,overallH:c.overallH,per:c.perLayer,perLayer:c.perLayer,layers:c.layers,boxes:c.boxes,orientation:c.orientation,rowMultiplier:c.rowMultiplier,outerW:c.width,outerL:c.outerL}:c;
};

/* Recalculate previews strictly from current PCS -> boxes -> boxes/bottom layer -> layers -> box vertical side. */
ppNewCalcCratePreview=function(c,items){
 const safeItems=(items||[]).filter(it=>ppNum(it.pcs)>0);
 const masterRows=safeItems.map(it=>({it,m:ppSmartMasterFor(it),d:ppDims(ppSmartMasterFor(it)?.boxSize)}));
 const validRows=masterRows.filter(x=>x.m&&x.d);
 const firstSelected=ppNewActiveMaster();
 const fallbackMaster=validRows[0]?.m||firstSelected.master||null;
 const masterWidth=ppNum(c?.masterWidth)||ppNum(c?.outerW)||Math.max(0,...validRows.map(x=>ppNum(x.m.crateWidth)),ppNum(fallbackMaster?.crateWidth));
 const widthOutside=masterWidth>0?masterWidth+2*PP_WOOD_THICKNESS:0;
 const rows=ppV28Rows(c?.rowMultiplier||c?.manual?.rowMultiplier||fallbackMaster?.rowMultiplier||1);
 const boxTotal=safeItems.reduce((s,it)=>s+Math.ceil(ppNum(it.pcs)/Math.max(1,ppNum(it.pcsPerBox)||ppNum(ppSmartMasterFor(it)?.pcsPerBox)||1)),0);
 let orientation=ppV28OrientationRequest(safeItems,{}) ;
 let metric=null;
 if(safeItems.length){metric=ppSmartCalcDims(safeItems,{outerL:ppNum(c?.outerL),outerW:masterWidth,rowMultiplier:rows,orientation});orientation=metric?.orientation||orientation;}
 else if(fallbackMaster){const mcalc=ppCrateCalc({...fallbackMaster,rowMultiplier:rows,orientation:'auto'});orientation=mcalc?.orientation||'width';metric=mcalc;}
 if(!['height','width'].includes(orientation))orientation='width';
 const crossMax=validRows.length?Math.max(...validRows.map(x=>orientation==='height'?x.d.w:x.d.h)):0;
 const verticalMax=validRows.length?Math.max(...validRows.map(x=>orientation==='height'?x.d.h:x.d.w)):0;
 const acrossWidth=crossMax>0?Math.floor(masterWidth/crossMax):0;
 const boxesPerLayer=metric?.perLayer>0?metric.perLayer:Math.max(0,acrossWidth*rows);
 const layers=boxTotal>0&&boxesPerLayer>0?Math.ceil(boxTotal/boxesPerLayer):0;
 const extra=Math.max(0,ppNum(c?.extraHeight));
 let packingHeight=layers*verticalMax+extra;
 if(metric?.valid&&safeItems.length)packingHeight=ppNum(metric.packingH)+extra;
 const overallHeight=packingHeight+PP_LEG_HEIGHT;
 const profileLength=Math.max(0,...safeItems.map(it=>ppNum(it.length)),ppNum(firstSelected.line?.length));
 const length=Math.max(1,ppNum(c?.outerL)||ppNum(metric?.outerL)||Math.ceil(profileLength+32)*rows);
 const pcs=safeItems.reduce((s,it)=>s+ppNum(it.pcs),0);
 const profileWeight=safeItems.reduce((s,it)=>s+ppNum(it.pcs)*ppNum(it.unitWeight||ppSmartMasterFor(it)?.unitWeight),0);
 const tare=Math.max(0,ppNum(c?.tareWeightKg));
 const isValid=packingHeight<=PP_MAX_PACKING_HEIGHT&&overallHeight<=PP_MAX_OVERALL_HEIGHT&&(!safeItems.length||!!metric?.valid);
 return {items:safeItems,sourceRows:validRows,boxTotal,boxesPerLayer,acrossWidth,layers,packingHeight,overallHeight,length,widthBase:masterWidth,widthOutside,rows,orientation,crossMax,verticalMax,pcs,profileWeight,tare,totalWeight:profileWeight+tare,valid:isValid,extra,innerW:masterWidth,metric};
};

/* New crates begin empty at leg height; as soon as PCS are added, height derives from box layers. */
ppNewCreateCrates=function(){
 const no=Math.max(1,Math.min(60,Math.floor(ppNum(document.getElementById('ppNewCrateNo')?.value)||1)));
 const count=Math.max(1,Math.min(60,Math.floor(ppNum(document.getElementById('ppNewCrateCount')?.value)||1)));
 const tare=Math.max(0,ppNum(document.getElementById('ppNewTareWeight')?.value));
 const d=ppNewUpdateCreateDimensions();
 if(!d){alert('Select Profile, Item Code and Length and complete Box Size / Crate Width in Crate Master Data.');return;}
 const used=new Set(ppSmartCrates.map(c=>String(c.id).toUpperCase())),ids=[];
 for(let n=0;n<count;n++){
  const id=count===1?`C-${String(no).padStart(2,'0')}`:`C-${String(no).padStart(2,'0')}-${ppRomanAt(n+1)}`;
  if(used.has(id.toUpperCase())){alert(`Crate ${ppDisplayCrateId(id)} already exists. Choose another crate number.`);return;}
  ids.push(id);used.add(id.toUpperCase());
 }
 ids.forEach(id=>ppSmartCrates.push({id,items:[],createdAt:Date.now(),outerL:d.outerL,outerW:d.width,masterWidth:d.width,outsideWidth:d.width+2*PP_WOOD_THICKNESS,packingH:0,extraHeight:0,overallH:PP_LEG_HEIGHT,perLayer:ppNum(d.calc?.perLayer)||ppNum(d.calc?.per)||0,layers:0,boxes:0,orientation:d.calc?.orientation||'auto',rowMultiplier:d.rows,tareWeightKg:tare,manual:{outerL:d.outerL,outerW:d.width,orientation:'auto',rowMultiplier:d.rows},containerLayout:{x:0,y:0,z:0,zMm:0,rot:false,placed:false,baseId:''}}));
 ppSmartPersist();ppSmartRenderCrateList();ppNewRefreshCrateOptions();
 const sel=document.getElementById('ppNewCrateSelect');if(sel)sel.value=ids[ids.length-1];
 ppNewRenderSelectedCrate();ppNewUpdateCreateDimensions();
 const box=document.getElementById('ppNewCreateBox');if(box)box.style.display='none';
 if(typeof showToast==='function')showToast(`${count} crate(s) created from Crate Master Data. Existing crate records were retained.`,'success');
};

/* Keep crate length/width semantics consistent in container loading: master width + 40 mm timber. */
const ppV28OriginalContDims=ppContDims;
ppContDims=function(c){
 const rawL=Math.max(1,ppNum(c?.outerL)||1);
 const masterW=ppNum(c?.masterWidth)||ppNum(c?.outerW)||1;
 const rawW=Math.max(1,ppNum(c?.outsideWidth)||masterW+2*PP_WOOD_THICKNESS);
 const rawH=Math.max(1,ppNum(c?.overallH)||(ppNum(c?.packingH)+PP_LEG_HEIGHT)||1);
 const rot=!!c?.containerLayout?.rot;
 return {L:rot?rawW:rawL,W:rot?rawL:rawW,H:rawH,rot};
};


/* V2.8 Master Data row controls: selecting 1 / 2 / 3 rows updates crate length and boxes per bottom layer. */
ppMasterInlineDim=function(index,field,value){
 const r=ppCrateMasterRows[index];if(!r)return;
 if(field==='orientation')r.orientation=['auto','height','width'].includes(value)?value:'auto';
 else if(field==='rowMultiplier'){
  r.rowMultiplier=ppV28Rows(value);
  r.manualOuterL=Math.ceil((ppNum(r.length)+32)*r.rowMultiplier);
  r.manualPackingH=null;r.manualPerLayer=null;r.manualBoxesPerCrate=null;
 }else{
  const n=ppNum(value);if(n<1){alert('Enter a dimension greater than zero.');ppRenderCrateMaster();return;}
  if(field==='manualPackingH'&&n>PP_MAX_PACKING_HEIGHT){alert(`Packing height must be ${PP_MAX_PACKING_HEIGHT} mm or less.`);ppRenderCrateMaster();return;}
  r[field]=n;
 }
 r.manual=true;r.source='Manual / edited';r.calc=ppCrateCalc(r);
 ppRenderCrateMaster();ppPopulateCrateStandards();ppRefreshNextPlLines();ppSaveCrateMaster();
};
window.ppMasterInlineDim=ppMasterInlineDim;


/* AIS Tracker V2.9 — true long-side elevation + explicit current/add/result capacity preview.
   Existing saved crate records and Supabase schema remain unchanged. */
const ppV29OriginalDrawCrate2D = ppNewDrawCrate2D;
ppNewDrawCrate2D = function(c, metric, view){
  if(view !== 'side') return ppV29OriginalDrawCrate2D(c, metric, view);
  const outerL=Math.max(1,ppNum(metric.length)||ppNum(c?.outerL)||1);
  const outerW=Math.max(1,ppNum(metric.widthOutside)||1);
  const packing=Math.max(0,ppNum(metric.packingHeight));
  const overall=Math.max(0,ppNum(metric.overallHeight));
  const layers=Math.max(0,Math.floor(ppNum(metric.layers)));
  const rows=ppNewClampRows(metric.rows||c?.rowMultiplier||1);
  const boxesPerLayer=Math.max(0,Math.floor(ppNum(metric.boxesPerLayer)));
  const acrossWidth=Math.max(0,Math.floor(ppNum(metric.acrossWidth)));
  const palette=['#8ba9bb','#d5a15b','#6fb49d','#a899cb','#c78072','#6e9dc7','#a5b16b'];
  const x=47, w=366, innerX=x+10, innerW=w-20, baseY=156, framePx=8, legPx=14;
  const packPx=packing>0?Math.min(100,Math.max(2,packing/Math.max(1,PP_MAX_PACKING_HEIGHT)*100)):0;
  const bodyTop=baseY-framePx-packPx-framePx, boxTop=bodyTop+framePx, boxBottom=baseY-framePx;
  let svg=`<svg viewBox="0 0 460 218" role="img" aria-label="Corrected side elevation showing long boxes stacked by layer">
    <rect x="${x}" y="${bodyTop}" width="${w}" height="${Math.max(18,packPx+2*framePx)}" fill="#d3a064" stroke="#81562f" stroke-width="2"/>
    <rect x="${innerX}" y="${boxTop}" width="${innerW}" height="${Math.max(0,packPx)}" fill="#fff8e9" stroke="#96673c" stroke-width="1.3"/>`;
  if(layers>0 && packPx>0){
    const band=packPx/layers;
    const masterLengths=(metric.sourceRows||[]).map(r=>ppNum(r.d?.l)).filter(Boolean);
    const boxLong=Math.max(0,...masterLengths);
    const availablePerRow=outerL/rows;
    const longRatio=boxLong>0?Math.min(1,boxLong/Math.max(1,availablePerRow)):0.985;
    const slotW=innerW/rows;
    // A long-side elevation is a projection along the box length. Boxes in the same
    // widthwise row overlap in this view; draw the number of lengthwise row positions,
    // not every box across crate width as a false 5-column grid.
    for(let layer=0;layer<Math.min(layers,30);layer++){
      const y=boxTop+(layers-1-layer)*band;
      for(let row=0;row<rows;row++){
        const bw=Math.max(3,(slotW-3)*longRatio);
        const bx=innerX+row*slotW+(slotW-bw)/2;
        svg+=`<rect x="${bx.toFixed(2)}" y="${(y+1).toFixed(2)}" width="${bw.toFixed(2)}" height="${Math.max(1,band-2).toFixed(2)}" fill="${palette[(layer*rows+row)%palette.length]}" stroke="#466477" stroke-width=".9"/>`;
      }
      if(band>=19){
        svg+=`<text x="${innerX+4}" y="${(y+Math.min(band-3,12)).toFixed(2)}" font-size="8.5" font-weight="800" fill="#183a51">Layer ${layer+1}</text>`;
      }
    }
  }
  svg+=`<rect x="${x+14}" y="${baseY}" width="18" height="${legPx}" fill="#a87842" stroke="#81562f"/><rect x="${x+w/2-9}" y="${baseY}" width="18" height="${legPx}" fill="#a87842" stroke="#81562f"/><rect x="${x+w-32}" y="${baseY}" width="18" height="${legPx}" fill="#a87842" stroke="#81562f"/>
    <text x="230" y="190" text-anchor="middle" font-size="11" font-weight="800" fill="#123c66">Side elevation · crate length ${Math.round(outerL)} mm</text>
    <text x="230" y="204" text-anchor="middle" font-size="9.5" fill="#536b7b">${boxesPerLayer} boxes/layer (${acrossWidth} across width × ${rows} lengthwise row${rows===1?'':'s'}) · ${layers} layer${layers===1?'':'s'}</text>
    <text x="230" y="215" text-anchor="middle" font-size="9.5" fill="#536b7b">Packing ${Math.round(packing)} mm + ${PP_LEG_HEIGHT} mm legs = ${Math.round(overall)} mm overall</text></svg>`;
  return `<div class="pp-new-2d-stage">${svg}<div class="pp-new-2d-caption">Side 2D shows long box lengths aligned along the crate length; each layer is stacked vertically. Boxes across the crate width overlap in this elevation, so the layer count is represented accurately without a false grid.</div></div>`;
};

// Rebuild PCS-to-boxes from PCS and Master Data on every preview. This avoids stale
// historical `boxes` fields affecting height after old crate records are opened.
const ppV29OriginalCalcCratePreview = ppNewCalcCratePreview;
ppNewCalcCratePreview = function(c, items){
  const normalized=(items||[]).filter(it=>ppNum(it.pcs)>0).map(it=>{
    const m=ppSmartMasterFor(it);
    const cap=Math.max(1,Math.floor(ppNum(it.pcsPerBox)||ppNum(m?.pcsPerBox)||ppSmartPcsBox(it)||1));
    const pcs=Math.max(0,Math.floor(ppNum(it.pcs)));
    return {...it,pcs,pcsPerBox:cap,boxes:pcs>0?Math.ceil(pcs/cap):0};
  });
  return ppV29OriginalCalcCratePreview(c, normalized);
};

function ppV29CountPcs(items){return (items||[]).reduce((sum,it)=>sum+Math.max(0,ppNum(it.pcs)),0);}
function ppV29CountBoxes(items){return (items||[]).reduce((sum,it)=>sum+Math.ceil(Math.max(0,ppNum(it.pcs))/Math.max(1,ppNum(it.pcsPerBox)||ppNum(ppSmartMasterFor(it)?.pcsPerBox)||1)),0);}
function ppV29GetDeltaItems(currentItems,draftItems){
  const oldByKey=new Map((currentItems||[]).map(it=>[String(it.lineKey||`${it.po}|${it.profile}|${it.itemCode}|${it.length}`),it]));
  const deltas=[];
  (draftItems||[]).forEach(it=>{
    const key=String(it.lineKey||`${it.po}|${it.profile}|${it.itemCode}|${it.length}`),old=oldByKey.get(key),delta=Math.max(0,Math.floor(ppNum(it.pcs)-ppNum(old?.pcs)));
    if(delta>0)deltas.push({...it,pcs:delta,boxes:Math.ceil(delta/Math.max(1,ppNum(it.pcsPerBox)||1))});
  });
  return deltas;
}

// Make preview clearly distinguish existing crate contents from proposed additions.
const ppV29OriginalRenderSelectedCrate=ppNewRenderSelectedCrate;
ppNewRenderSelectedCrate=function(draftItems=null,draftMode=false){
  const out=ppV29OriginalRenderSelectedCrate.apply(this,arguments);
  if(!draftMode||!Array.isArray(draftItems))return out;
  const c=ppNewSelectedCrate(),host=document.getElementById('ppNewCrateDetails');
  if(!c||!host)return out;
  const current=c.items||[],delta=ppV29GetDeltaItems(current,draftItems);
  const currentPcs=ppV29CountPcs(current),currentBoxes=ppV29CountBoxes(current);
  const addedPcs=ppV29CountPcs(delta),addedBoxes=ppV29CountBoxes(delta);
  const afterPcs=ppV29CountPcs(draftItems),afterBoxes=ppV29CountBoxes(draftItems);
  const banner=host.querySelector('.pp-new-draft-banner');
  if(banner){
    const m=ppNewCalcCratePreview(c,draftItems),addMetric=delta.length?ppSmartCalcDims(delta,{outerL:ppNum(c.outerL),outerW:ppNum(c.masterWidth)||ppNum(c.outerW),orientation:'auto',rowMultiplier:ppV29Rows(c.rowMultiplier||1)}):null;
    const extraHint=(addMetric&&addMetric.valid)?` Selected quantities by themselves: ${Math.round(addMetric.boxes)} box(es) ÷ ${addMetric.perLayer} per layer = ${addMetric.layers} layer(s), ${Math.round(addMetric.packingH)} mm packing + ${PP_LEG_HEIGHT} mm legs = ${Math.round(addMetric.overallH)} mm overall.`:'';
    banner.innerHTML=`<b>Current crate:</b> ${currentPcs.toLocaleString()} PCS / ${currentBoxes.toLocaleString()} boxes &nbsp;·&nbsp; <b>Selected to add:</b> ${addedPcs.toLocaleString()} PCS / ${addedBoxes.toLocaleString()} boxes &nbsp;·&nbsp; <b>After adding:</b> ${afterPcs.toLocaleString()} PCS / ${afterBoxes.toLocaleString()} boxes. ${m.valid?`Expected result: ${m.boxesPerLayer} boxes/layer × ${m.layers} layer(s) = ${Math.round(m.packingHeight)} mm packing height.`:`This total needs ${m.boxesPerLayer} boxes/layer × ${m.layers} layers = ${Math.round(m.packingHeight)} mm packing height, over the ${PP_MAX_PACKING_HEIGHT} mm limit.`}${extraHint}`;
    if(!m.valid)banner.classList.add('pp-new-draft-banner-invalid');else banner.classList.remove('pp-new-draft-banner-invalid');
  }
  return out;
};

// Explain a rejected add using both the current saved contents and the exact requested PCS.
// A crate that already contains 150 PCS must be checked as 150 + the new quantity, not as an empty crate.
const ppV29OriginalAddToCrate=ppNewAddToCrate;
ppNewAddToCrate=function(){
  const c=ppNewSelectedCrate();
  const draft=c?ppNewBuildDraftItems(c):null;
  if(c&&draft&&draft.length){
    const result=ppNewCalcCratePreview(c,draft);
    if(!result.valid){
      ppNewRenderSelectedCrate(draft,true);
      const oldItems=c.items||[],delta=ppV29GetDeltaItems(oldItems,draft);
      const currentPcs=ppV29CountPcs(oldItems),currentBoxes=ppV29CountBoxes(oldItems),addPcs=ppV29CountPcs(delta),addBoxes=ppV29CountBoxes(delta),afterPcs=ppV29CountPcs(draft),afterBoxes=ppV29CountBoxes(draft);
      const perLayer=Math.max(0,ppNum(result.boxesPerLayer)),layers=Math.max(0,ppNum(result.layers)),packH=Math.round(ppNum(result.packingHeight));
      let addOnly='';
      if(delta.length){const m=ppSmartCalcDims(delta,{outerL:ppNum(c.outerL),outerW:ppNum(c.masterWidth)||ppNum(c.outerW),orientation:'auto',rowMultiplier:ppV29Rows(c.rowMultiplier||1)});if(m&&m.valid)addOnly=`\nThe selected quantities alone would be ${Math.round(m.boxes)} box(es), ${m.perLayer} per bottom layer, ${m.layers} layer(s), ${Math.round(m.packingH)} mm packing + ${PP_LEG_HEIGHT} mm legs = ${Math.round(m.overallH)} mm overall on an empty crate.`;}
      alert(`Cannot add these PCS to the selected crate because the resulting crate would exceed the packing-height limit.\n\nCurrent crate: ${currentPcs} PCS / ${currentBoxes} boxes.\nSelected addition: ${addPcs} PCS / ${addBoxes} boxes.\nAfter addition: ${afterPcs} PCS / ${afterBoxes} boxes.\nRequired: ${perLayer} boxes per bottom layer × ${layers} layers = ${packH} mm packing height; maximum is ${PP_MAX_PACKING_HEIGHT} mm.${addOnly}\n\nNo changes were saved. Select/create an empty crate to pack only the selected quantities, or split the PCS between crates.`);
      return;
    }
  }
  return ppV29OriginalAddToCrate.apply(this,arguments);
};

function ppV29Rows(v){return Math.max(1,Math.min(3,Math.floor(ppNum(v)||1)));}
window.ppV29Rows=ppV29Rows;

/* AIS Tracker V2.10 — grouped full crate details report and exports.
   This is a read-only report over existing crate records; it does not rewrite saved data. */
function ppFullDetailsNormalizeId(id){
  const display=typeof ppDisplayCrateId==='function'?ppDisplayCrateId(id):String(id||'');
  const match=String(display).match(/^(\d+)(?:-([ivxlcdm]+))?$/i);
  return match?{base:String(Number(match[1])),roman:match[2]||''}:{base:String(display||'—'),roman:''};
}
function ppFullDetailsCrateMetrics(crate){
  const masterWidth=Math.max(0,ppNum(crate?.masterWidth)||ppNum(crate?.outerW));
  const width=Math.max(0,ppNum(crate?.outsideWidth)||(masterWidth>0?masterWidth+2*(ppNum(typeof PP_WOOD_THICKNESS!=='undefined'?PP_WOOD_THICKNESS:20)):0));
  const length=Math.max(0,ppNum(crate?.outerL));
  const packing=Math.max(0,ppNum(typeof ppSmartEffectiveHeight==='function'?ppSmartEffectiveHeight(crate):crate?.packingH));
  const height=Math.max(0,ppNum(crate?.overallH)||(packing+ppNum(typeof PP_LEG_HEIGHT!=='undefined'?PP_LEG_HEIGHT:100)));
  return {width,length,height};
}
function ppFullDetailsItemsSignature(crate){
  return (crate?.items||[]).map(it=>({
    po:String(it.po??''),profile:String(it.profile??''),itemCode:String(it.itemCode??''),length:ppNum(it.length),
    pcs:Math.max(0,Math.floor(ppNum(it.pcs))),pcsPerBox:Math.max(0,ppNum(it.pcsPerBox)),
    boxes:Math.max(0,ppNum(it.boxes)),unitWeight:Math.round(ppNum(it.unitWeight)*10000)/10000
  })).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
function ppFullCrateDetailsData(){
  const groups=new Map();
  (Array.isArray(ppSmartCrates)?ppSmartCrates:[]).forEach((crate,index)=>{
    const id=ppFullDetailsNormalizeId(crate?.id),metrics=ppFullDetailsCrateMetrics(crate);
    const items=ppFullDetailsItemsSignature(crate);
    const signature=JSON.stringify({base:id.base,items,width:Math.round(metrics.width*100)/100,length:Math.round(metrics.length*100)/100,height:Math.round(metrics.height*100)/100});
    if(!groups.has(signature))groups.set(signature,{base:id.base,crate,metrics,items:crate?.items||[],indexes:[index]});
    else groups.get(signature).indexes.push(index);
  });
  const rows=[];
  for(const group of groups.values()){
    const crateCount=group.indexes.length;
    const metrics=group.metrics;
    const items=(group.items||[]).filter(it=>Math.max(0,ppNum(it.pcs))>0);
    if(!items.length){
      rows.push({
        'Crate No.':group.base,'PO Number':'—','Profile':'—','Item Code':'—','Profile Length (mm)':'—',
        'Crate Width (mm)':metrics.width||'—','Crate Height (mm)':metrics.height||'—','Crate Length (mm)':metrics.length||'—',
        'Number of Crates':crateCount,'PCS / Crate (PO)':0,'Total PCS':0
      });
      continue;
    }
    items.forEach(it=>{
      const pcs=Math.max(0,Math.floor(ppNum(it.pcs)));
      rows.push({
        'Crate No.':group.base,'PO Number':it.po||'—','Profile':it.profile||'—','Item Code':it.itemCode||'—',
        'Profile Length (mm)':it.length??'—','Crate Width (mm)':metrics.width||'—','Crate Height (mm)':metrics.height||'—',
        'Crate Length (mm)':metrics.length||'—','Number of Crates':crateCount,'PCS / Crate (PO)':pcs,
        'Total PCS':pcs*crateCount
      });
    });
  }
  return rows;
}
function ppRenderFullCrateDetails(){
  const body=document.getElementById('ppFullCrateDetailsBody');
  if(!body)return;
  const rows=ppFullCrateDetailsData(),foot=document.getElementById('ppFullCrateDetailsFoot'),summary=document.getElementById('ppFullCrateDetailsSummary');
  const esc=v=>typeof ppEsc==='function'?ppEsc(v):String(v??'');
  if(!rows.length){body.innerHTML='<tr><td colspan="11">No crate details yet. Add PCS to crates to build this report.</td></tr>';if(foot)foot.innerHTML='';if(summary)summary.textContent='No crate details to display.';return;}
  // Merge the Crate No. cell vertically when consecutive detail rows belong to the same physical crate.
  // Keep the underlying records untouched; only the report presentation is merged.
  const cols=Object.keys(rows[0]),noCol='Crate No.',rendered=[];
  for(let i=0;i<rows.length;){
    let end=i+1;
    while(end<rows.length && String(rows[end][noCol]??'')===String(rows[i][noCol]??'')) end++;
    for(let j=i;j<end;j++){
      const other=cols.filter(k=>k!==noCol).map(k=>`<td>${esc(rows[j][k])}</td>`).join('');
      rendered.push(`<tr>${j===i?`<td class=\"pp-merged-crate\" rowspan=\"${end-i}\">${esc(rows[i][noCol])}</td>`:''}${other}</tr>`);
    }
    i=end;
  }
  body.innerHTML=rendered.join('');
  const totalCrates=(Array.isArray(ppSmartCrates)?ppSmartCrates:[]).length;
  const totalPcs=rows.reduce((s,r)=>s+Math.max(0,ppNum(r['Total PCS'])),0);
  if(foot)foot.innerHTML=`<tr><td colspan="8">TOTAL</td><td>${totalCrates.toLocaleString()}</td><td>—</td><td>${totalPcs.toLocaleString()}</td></tr>`;
  if(summary)summary.textContent=`${totalCrates.toLocaleString()} physical crate(s) · ${rows.length.toLocaleString()} PO/profile detail row(s) · Total PCS across all matching crates: ${totalPcs.toLocaleString()}. Roman suffixes are grouped only when crate number, dimensions and complete contents match.`;
}
function ppFullDetailsRowsForExport(rows){
  // The XLS/PDF/print copy uses a blank continuation cell instead of repeating the same crate number.
  const copy=rows.map(r=>({...r}));let previous=null;
  for(const row of copy){
    const key=String(row['Crate No.']??'');
    if(key===previous) row['Crate No.']='';
    previous=key;
  }
  return copy;
}
function ppFullDetailsRequireRows(){
  const rows=ppFullCrateDetailsData();
  if(!rows.length){if(typeof showToast==='function')showToast('No crate details to export yet.','warning');else alert('No crate details to export yet.');return null;}
  return rows;
}
function ppExportFullCrateDetailsExcel(){
  const sourceRows=ppFullDetailsRequireRows();if(!sourceRows)return;const rows=ppFullDetailsRowsForExport(sourceRows);
  if(typeof exportTableToExcel==='function')exportTableToExcel(rows,'AIS_Full_Crate_Details','Full Crate Details');
  else{
    const cols=Object.keys(rows[0]),escape=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const html=`<!doctype html><html><head><meta charset="utf-8"></head><body><table border="1"><thead><tr>${cols.map(c=>`<th>${escape(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${cols.map(c=>`<td>${escape(r[c])}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
    const url=URL.createObjectURL(new Blob(['\ufeff',html],{type:'application/vnd.ms-excel;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='AIS_Full_Crate_Details.xls';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
}
function ppExportFullCrateDetailsPdf(){
  const sourceRows=ppFullDetailsRequireRows();if(!sourceRows)return;const rows=ppFullDetailsRowsForExport(sourceRows);
  if(typeof exportDataToPdf==='function')exportDataToPdf(rows,'AIS_Full_Crate_Details','AIS Tracker — Full Crate Details','Crate dimensions and PCS totals grouped by matching crate design');
  else ppPrintFullCrateDetails();
}
function ppPrintFullCrateDetails(){
  const sourceRows=ppFullDetailsRequireRows();if(!sourceRows)return;const rows=ppFullDetailsRowsForExport(sourceRows);
  const w=window.open('','_blank');
  if(!w){alert('Please allow pop-ups to print the full crate details.');return;}
  const cols=Object.keys(rows[0]),esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const totalCrates=(Array.isArray(ppSmartCrates)?ppSmartCrates:[]).length,totalPcs=rows.reduce((s,r)=>s+Math.max(0,ppNum(r['Total PCS'])),0);
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>AIS Tracker — Full Crate Details</title><style>body{font:11px Arial,sans-serif;color:#17364c;padding:14px}h1{font-size:18px;margin:0 0 6px}p{color:#52677b}table{border-collapse:collapse;width:100%;font-size:10px}th,td{border:1px solid #a9bfcd;padding:6px;text-align:left}th{background:#075b63;color:#fff}tbody tr:nth-child(even){background:#eff6f9}tfoot{font-weight:bold;background:#e5f2f7}@page{size:landscape A4;margin:8mm}.meta{margin-bottom:12px}</style></head><body><h1>AIS Tracker — Full Crate Details</h1><p class="meta">Generated ${esc(new Date().toLocaleString())} · Physical crates: ${totalCrates} · Total PCS: ${totalPcs.toLocaleString()}</p><table><thead><tr>${cols.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${cols.map(c=>`<td>${esc(r[c])}</td>`).join('')}</tr>`).join('')}</tbody><tfoot><tr><td colspan="8">TOTAL</td><td>${totalCrates}</td><td>—</td><td>${totalPcs.toLocaleString()}</td></tr></tfoot></table><script>window.onload=()=>window.print();<\/script></body></html>`);
  w.document.close();
}
const ppV210OriginalRenderCrateList=ppSmartRenderCrateList;
ppSmartRenderCrateList=function(){
  const result=ppV210OriginalRenderCrateList.apply(this,arguments);
  try{ppRenderFullCrateDetails();}catch(e){console.warn('Full crate detail render skipped:',e);}
  return result;
};
window.ppFullCrateDetailsData=ppFullCrateDetailsData;
window.ppRenderFullCrateDetails=ppRenderFullCrateDetails;
document.addEventListener('DOMContentLoaded',()=>{try{ppRenderFullCrateDetails();}catch(e){console.warn('Initial full crate details render skipped:',e);}});

/* AIS Tracker V2.11 — merged crate-number report cells and clearer container stacking workflow. */


/* AIS Tracker V2.12 — click-to-place, nearest-gap snapping, compact packing and colour PDF views. */
const ppV212BaseRender = ppSmartRenderContainer;
const ppV212BaseAutoArrange = ppSmartAutoArrange;

function ppContEscV212(v){return typeof ppEsc==='function'?ppEsc(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function ppContRectOverlapV212(a,b){return a.x < b.x+b.L-0.01 && a.x+a.L > b.x+0.01 && a.y < b.y+b.W-0.01 && a.y+a.W > b.y+0.01 && a.zMm < b.zMm+b.H-0.01 && a.zMm+a.H > b.zMm+0.01;}
function ppContMoveClusterV212(root){
 const cluster=[root],seen=new Set([root.id]);let changed=true;
 while(changed){changed=false;for(const q of ppSmartCrates){if(seen.has(q.id)||!ppContLayout(q).placed)continue;const base=String(ppContLayout(q).baseId||'');if(seen.has(base)){cluster.push(q);seen.add(q.id);changed=true;}}}
 return cluster;
}
function ppContClusterFitsV212(cluster,root,x,y,L,W,H,maxTier){
 const rootP=ppContLayout(root),oldX=ppNum(rootP.x),oldY=ppNum(rootP.y),oldZ=ppNum(rootP.zMm),oldTier=ppNum(rootP.z),ids=new Set(cluster.map(c=>c.id)),placedOthers=ppSmartCrates.filter(q=>!ids.has(q.id)&&ppContLayout(q).placed);
 const proposed=[];
 for(const c of cluster){const p=ppContLayout(c),d=ppContDims(c),nx=x+(ppNum(p.x)-oldX),ny=y+(ppNum(p.y)-oldY),nz=Math.max(0,ppNum(p.zMm)-oldZ),nt=Math.max(0,Math.round(ppNum(p.z)-oldTier));
  if(nx < -0.01 || ny < -0.01 || nx+d.L>L+0.01 || ny+d.W>W+0.01 || nz+d.H>H+0.01 || nt>=maxTier)return null;
  const next={c,p,d,x:nx,y:ny,zMm:nz,z:nt,L:d.L,W:d.W,H:d.H};
  for(const other of placedOthers){const op=ppContLayout(other),od=ppContDims(other);if(ppContRectOverlapV212(next,{x:ppNum(op.x),y:ppNum(op.y),zMm:ppNum(op.zMm),L:od.L,W:od.W,H:od.H}))return null;}
  for(const prev of proposed){if(ppContRectOverlapV212(next,prev))return null;}
  proposed.push(next);
 }
 return proposed;
}
function ppContContactLengthV212(d, x, y, others){
 let contact=0;
 for(const q of others){const p=ppContLayout(q);if(!p.placed||ppNum(p.zMm)>1)continue;const e=ppContDims(q),overX=Math.max(0,Math.min(x+d.L,p.x+e.L)-Math.max(x,p.x)),overY=Math.max(0,Math.min(y+d.W,p.y+e.W)-Math.max(y,p.y));
  if(Math.abs(x+d.L-p.x)<1||Math.abs(p.x+e.L-x)<1)contact+=overY;
  if(Math.abs(y+d.W-p.y)<1||Math.abs(p.y+e.W-y)<1)contact+=overX;
 }
 return contact;
}
function ppContFindNearestPositionV212(root,targetX,targetY,cluster=ppContMoveClusterV212(root),compact=false){
 const L=Math.max(1,ppNum(document.getElementById('ppContLen')?.value)||12032),W=Math.max(1,ppNum(document.getElementById('ppContWid')?.value)||2352),H=Math.max(1,ppNum(document.getElementById('ppContHei')?.value)||2393),maxTier=Math.max(1,Math.floor(ppNum(document.getElementById('ppContTiers')?.value)||1));
 const rootP=ppContLayout(root),rootOldX=ppNum(rootP.x),rootOldY=ppNum(rootP.y),ids=new Set(cluster.map(c=>c.id)),others=ppSmartCrates.filter(q=>!ids.has(q.id)&&ppContLayout(q).placed);
 const d=ppContDims(root),xs=new Set([0,Math.max(0,Math.round(targetX)),Math.max(0,Math.round(rootOldX))]),ys=new Set([0,Math.max(0,Math.round(targetY)),Math.max(0,Math.round(rootOldY))]);
 for(const q of others){const p=ppContLayout(q),qd=ppContDims(q);for(const c of cluster){const cp=ppContLayout(c),cd=ppContDims(c),ox=ppNum(cp.x)-rootOldX,oy=ppNum(cp.y)-rootOldY;[p.x-ox,p.x+qd.L-ox,p.x-cd.L-ox,p.x+qd.L-cd.L-ox].forEach(v=>{if(v>=0&&v<=L)xs.add(Math.round(v));});[p.y-oy,p.y+qd.W-oy,p.y-cd.W-oy,p.y+qd.W-cd.W-oy].forEach(v=>{if(v>=0&&v<=W)ys.add(Math.round(v));});}}
 const xlist=[...xs].filter(v=>v<=L-d.L).sort((a,b)=>compact?a-b:Math.abs(a-targetX)-Math.abs(b-targetX)).slice(0,compact?200:60);
 const ylist=[...ys].filter(v=>v<=W-d.W).sort((a,b)=>compact?a-b:Math.abs(a-targetY)-Math.abs(b-targetY)).slice(0,compact?200:60);
 let good=[];
 for(const x of xlist){for(const y of ylist){const proposed=ppContClusterFitsV212(cluster,root,x,y,L,W,H,maxTier);if(!proposed)continue;const contact=ppContContactLengthV212(d,x,y,others);const distance=(x-targetX)**2+(y-targetY)**2;const compactScore=y*(L+1)+x;good.push({x,y,proposed,contact,distance,compactScore});}}
 if(!good.length)return null;
 if(compact){good.sort((a,b)=>a.compactScore-b.compactScore||b.contact-a.contact);return good[0];}
 // Prefer edge-adjacent positions whenever a touching fit exists, then choose the nearest one to the click.
 const touching=good.filter(g=>g.contact>0);if(touching.length)good=touching;
 good.sort((a,b)=>a.distance-b.distance||b.contact-a.contact||a.y-b.y||a.x-b.x);return good[0];
}
function ppContCommitClusterV212(root,candidate,cluster){
 if(!candidate)return false;
 const L=Math.max(1,ppNum(document.getElementById('ppContLen')?.value)||12032),W=Math.max(1,ppNum(document.getElementById('ppContWid')?.value)||2352),H=Math.max(1,ppNum(document.getElementById('ppContHei')?.value)||2393);
 const clusterIds=new Set(cluster.map(c=>c.id)),outsideWeight=ppSmartCrates.filter(c=>ppContLayout(c).placed&&!clusterIds.has(c.id)).reduce((s,c)=>s+ppContCargoWeight(c),0),clusterWeight=cluster.reduce((s,c)=>s+ppContCargoWeight(c),0);
 if(outsideWeight+clusterWeight>18000){if(typeof showToast==='function')showToast('Move rejected: total cargo weight would exceed 18,000 kg.','error');return false;}
 // Save the full position snapshot before changing anything.
 ppContTakeSnapshot();
 for(const v of candidate.proposed){const p=ppContLayout(v.c);Object.assign(p,{x:v.x,y:v.y,z:v.z,zMm:v.zMm,placed:true,baseId:v.c===root?'':p.baseId});}
 // A manually moved crate is detached from its former support; its own dependants move with it.
 const rp=ppContLayout(root);rp.baseId='';rp.z=0;rp.zMm=0;
 // Rebuild tiers/support relationships from actual z elevations for child crates in the moving stack.
 for(const c of cluster){if(c===root)continue;const p=ppContLayout(c);p.baseId=cluster.some(q=>q.id===p.baseId)?p.baseId:'';p.z=Math.max(0,Math.round(ppNum(p.zMm)/Math.max(1,ppContDims(c).H)));}
 const invalid=cluster.some(c=>{const p=ppContLayout(c),d=ppContDims(c);return p.x<0||p.y<0||p.x+d.L>L||p.y+d.W>W||p.zMm+d.H>H;});
 const collided=invalid||cluster.some(c=>ppSmartCrates.some(q=>q!==c&&ppContLayout(q).placed&&!clusterIds.has(q.id)&&ppContBoxesOverlap(c,q)));
 if(collided){if(typeof showToast==='function')showToast('Move cancelled: the snapped position would overlap another crate or exceed the container.','warning');return false;}
 ppContSelectedId=root.id;ppSmartPersist();ppContSyncSelected();ppSmartRenderContainer();return true;
}
function ppContMoveSelectedNearV212(targetX,targetY){
 const root=ppContGetSelected();if(!root){if(typeof showToast==='function')showToast('Select a crate first, then click a destination in the Top view.','info');return false;}
 const L=Math.max(1,ppNum(document.getElementById('ppContLen')?.value)||12032),W=Math.max(1,ppNum(document.getElementById('ppContWid')?.value)||2352),H=Math.max(1,ppNum(document.getElementById('ppContHei')?.value)||2393),cluster=ppContMoveClusterV212(root);
 const candidate=ppContFindNearestPositionV212(root,targetX,targetY,cluster,false);
 if(!candidate){if(typeof showToast==='function')showToast('No valid free position found for this crate/stack. Try Auto Arrange or adjust the container dimensions.','warning');return false;}
 const ok=ppContCommitClusterV212(root,candidate,cluster);if(ok&&typeof showToast==='function')showToast(`${ppDisplayCrateId(root.id)} moved to the nearest fitting position (${candidate.x}, ${candidate.y}) mm. Nearby crates were kept clear.`, 'success');return ok;
}
function ppContSetQuickView(view){const sel=document.getElementById('ppContView');if(!sel)return;sel.value=view;if(typeof ppSmartRenderContainer==='function')ppSmartRenderContainer();}
function ppContBindMoveInteractionsV212(host){
 if(!host||host.dataset.ppV212MoveBound==='1')return;host.dataset.ppV212MoveBound='1';let drag=null,suppressClickUntil=0;
 const clientPoint=(svg,ev)=>{try{const pt=svg.createSVGPoint();pt.x=ev.clientX;pt.y=ev.clientY;const q=pt.matrixTransform(svg.getScreenCTM().inverse());return {x:q.x,y:q.y};}catch(e){const r=svg.getBoundingClientRect(),vb=svg.viewBox.baseVal;return {x:(ev.clientX-r.left)/r.width*vb.width,y:(ev.clientY-r.top)/r.height*vb.height};}};
 host.addEventListener('click',ev=>{
  if(Date.now()<suppressClickUntil){ev.preventDefault();ev.stopImmediatePropagation();return;}
  const svg=ev.target.closest('svg[data-layout-view]');if(!svg||svg.dataset.layoutView!=='top')return;
  if(ev.target.closest('g[data-draggable-crate]'))return;
  if(!['rect','svg','polygon'].includes(String(ev.target.localName||'').toLowerCase()))return;
  const p=clientPoint(svg,ev),L=Math.max(1,ppNum(document.getElementById('ppContLen')?.value)||12032),W=Math.max(1,ppNum(document.getElementById('ppContWid')?.value)||2352),scale=Math.max(.0001,ppNum(svg.dataset.mmScale)||Math.min(816/L,416/W)),ox=(900-L*scale)/2,oy=(500-W*scale)/2,root=ppContGetSelected();if(!root)return;
  const d=ppContDims(root),tx=Math.max(0,Math.min(L-d.L,Math.round((p.x-ox)/scale-d.L/2))),ty=Math.max(0,Math.min(W-d.W,Math.round((p.y-oy)/scale-d.W/2)));
  ev.preventDefault();ppContMoveSelectedNearV212(tx,ty);
 },true);
 host.addEventListener('pointerdown',ev=>{
  const g=ev.target.closest('g[data-draggable-crate]'),svg=ev.target.closest('svg[data-layout-view]');if(!g||!svg||svg.dataset.layoutView!=='top')return;
  const m=(g.getAttribute('onclick')||'').match(/ppContPickById\('([^']+)'\)/);if(!m)return;const id=decodeURIComponent(m[1]),c=ppSmartCrates.find(q=>q.id===id);if(!c)return;
  drag={id,startX:ev.clientX,startY:ev.clientY,moved:false};try{host.setPointerCapture(ev.pointerId);}catch(e){}ev.preventDefault();
 });
 host.addEventListener('pointermove',ev=>{if(!drag)return;if(Math.abs(ev.clientX-drag.startX)+Math.abs(ev.clientY-drag.startY)>5)drag.moved=true;});
 host.addEventListener('pointerup',ev=>{
  if(!drag)return;const state=drag;drag=null;if(!state.moved)return;suppressClickUntil=Date.now()+350;
  const svg=host.querySelector('svg[data-layout-view="top"]');if(!svg)return;const p=clientPoint(svg,ev),L=Math.max(1,ppNum(document.getElementById('ppContLen')?.value)||12032),W=Math.max(1,ppNum(document.getElementById('ppContWid')?.value)||2352),scale=Math.max(.0001,ppNum(svg.dataset.mmScale)||Math.min(816/L,416/W)),ox=(900-L*scale)/2,oy=(500-W*scale)/2,c=ppSmartCrates.find(q=>q.id===state.id);if(!c)return;
  ppContSelectedId=c.id;ppContSyncSelected();const d=ppContDims(c),tx=Math.max(0,Math.min(L-d.L,Math.round((p.x-ox)/scale-d.L/2))),ty=Math.max(0,Math.min(W-d.W,Math.round((p.y-oy)/scale-d.W/2)));ppContMoveSelectedNearV212(tx,ty);
 });
}
window.ppSmartRenderContainer = function ppSmartRenderContainerV212(){
 const host=document.getElementById('ppContainerVisual');if(host)host.dataset.dragBound='1';
 const out=ppV212BaseRender.apply(this,arguments);
 if(host)ppContBindMoveInteractionsV212(host);
 return out;
};
function ppContPickById(enc){const id=decodeURIComponent(enc);if(!ppSmartCrates.some(c=>c.id===id))return;ppContSelectedId=id;ppContSyncSelected();ppSmartRenderContainer();}
window.ppSmartAutoArrange = function ppSmartAutoArrangeV212(){
 const L=Math.max(1,ppNum(document.getElementById('ppContLen')?.value)||12032),W=Math.max(1,ppNum(document.getElementById('ppContWid')?.value)||2352),H=Math.max(1,ppNum(document.getElementById('ppContHei')?.value)||2393),payload=Math.min(18000,Math.max(1,ppNum(document.getElementById('ppContPayload')?.value)||18000)),maxTier=Math.max(1,Math.floor(ppNum(document.getElementById('ppContTiers')?.value)||1));
 if(!ppSmartCrates.length){if(typeof showToast==='function')showToast('Add crates in the Crate List tab first.','warning');return;}
 ppContTakeSnapshot();ppSmartCrates.forEach(c=>{ppContLayout(c);Object.assign(c.containerLayout,{x:0,y:0,z:0,zMm:0,baseId:'',rot:false,placed:false});});
 const ordered=[...ppSmartCrates].sort((a,b)=>{const da=ppContDims(a),db=ppContDims(b);return (db.L*db.W)-(da.L*da.W)||Math.max(db.L,db.W)-Math.max(da.L,da.W);});
 let weight=0;const packed=[];
 for(const c of ordered){const wt=ppContCargoWeight(c);if(weight+wt>payload)continue;const d=ppContDims(c),xs=new Set([0]),ys=new Set([0]);for(const q of packed){const p=ppContLayout(q),qd=ppContDims(q);[p.x,p.x+qd.L,p.x-d.L,p.x+qd.L-d.L].forEach(v=>{if(v>=0&&v<=L)xs.add(Math.round(v));});[p.y,p.y+qd.W,p.y-d.W,p.y+qd.W-d.W].forEach(v=>{if(v>=0&&v<=W)ys.add(Math.round(v));});}
  let choices=[];for(const rot of [!!c.containerLayout.rot,!c.containerLayout.rot]){const dd=rot?{L:d.W,W:d.L,H:d.H}:{L:d.L,W:d.W,H:d.H};for(const x of xs){for(const y of ys){if(x+dd.L>L||y+dd.W>W||dd.H>H)continue;const overlap=packed.some(q=>{const p=ppContLayout(q),qd=ppContDims(q);return x<p.x+qd.L&&x+dd.L>p.x&&y<p.y+qd.W&&y+dd.W>p.y;});if(overlap)continue;const contact=ppContContactLengthV212(dd,x,y,packed);choices.push({x,y,rot,dd,contact,score:y*(L+1)+x-(contact*.01)});}}}
  if(!choices.length)continue;choices.sort((a,b)=>a.score-b.score);const best=choices[0],p=ppContLayout(c);Object.assign(p,{x:best.x,y:best.y,z:0,zMm:0,baseId:'',rot:best.rot,placed:true});packed.push(c);weight+=wt;
 }
 const notPlaced=ppSmartCrates.length-packed.length;
 // If a floor-only arrangement cannot fit all crates, offer the existing validated stack planner as the fallback.
 if(notPlaced>0&&document.getElementById('ppContStackConfirmed')?.checked&&maxTier>1){ppV212BaseAutoArrange.apply(this,arguments);return;}
 ppContSelectedId=packed[0]?.id||'';ppSmartPersist();ppContSyncSelected();ppSmartRenderContainer();
 if(typeof showToast==='function')showToast(`Compact arrange saved: ${packed.length}/${ppSmartCrates.length} crates placed with edge-snapped positions.${notPlaced?` ${notPlaced} crate(s) did not fit on the floor; review container space or enable confirmed stacking.`:''}`,notPlaced?'warning':'success');
};
function ppContBuildViewSvgV212(view){
 const L=Math.max(1,ppNum(document.getElementById('ppContLen')?.value)||12032),W=Math.max(1,ppNum(document.getElementById('ppContWid')?.value)||2352),H=Math.max(1,ppNum(document.getElementById('ppContHei')?.value)||2393),VW=1100,VH=600,pad=44,colors=['#8fc3d0','#e4b36b','#78b9a5','#b5a3d5','#d38c7c','#7faed7','#a7bb73','#d5a2c5','#b6c7d8','#d7c18f'];
 const placed=ppSmartCrates.filter(c=>ppContLayout(c).placed).sort((a,b)=>ppNum(ppContLayout(a).zMm)-ppNum(ppContLayout(b).zMm));let s='';
 if(view==='top'){
  const scale=Math.min((VW-2*pad)/L,(VH-2*pad)/W),cw=L*scale,ch=W*scale,ox=(VW-cw)/2,oy=(VH-ch)/2;
  s+=`<rect x="${ox}" y="${oy}" width="${cw}" height="${ch}" rx="2" fill="#eaf2f6" stroke="#184f68" stroke-width="9"/>`;
  placed.forEach((c,i)=>{const p=ppContLayout(c),d=ppContDims(c),x=ox+p.x*scale,y=oy+p.y*scale,w=d.L*scale,h=d.W*scale;s+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${colors[i%colors.length]}" stroke="#173f53" stroke-width="2.5"/><text x="${x+5}" y="${y+Math.min(19,Math.max(9,h/2))}" font-size="${Math.max(8,Math.min(16,w/5))}" font-weight="700" fill="#143649">${ppContEscV212(ppDisplayCrateId(c.id))}</text><text x="${x+5}" y="${y+Math.min(35,Math.max(18,h*.8))}" font-size="${Math.max(7,Math.min(12,w/6))}" fill="#143649">${ppContPcs(c)} PCS</text>`;});
  s+=`<text x="20" y="26" font-size="18" font-weight="800" fill="#164e63">TOP VIEW · ${L} × ${W} mm</text>`;
 }else{
  const end=['front','back'].includes(view),axis=end?W:L,scale=Math.min((VW-2*pad)/axis,(VH-2*pad)/H),cw=axis*scale,ch=H*scale,ox=(VW-cw)/2,floor=VH-pad,top=floor-ch;
  s+=`<rect x="${ox}" y="${top}" width="${cw}" height="${ch}" fill="#eaf2f6" stroke="#184f68" stroke-width="9"/>`;
  // Side views draw far-side crates first so near crates cover them realistically.
  const sideOrder=[...placed].sort((a,b)=>view==='left'?(ppNum(ppContLayout(b).y)-ppNum(ppContLayout(a).y)):(view==='right'?(ppNum(ppContLayout(a).y)-ppNum(ppContLayout(b).y)):0));
  sideOrder.forEach((c,i)=>{const p=ppContLayout(c),d=ppContDims(c),xpos=end?(view==='front'?p.y:W-p.y-d.W):(view==='left'?p.x:L-p.x-d.L),xx=ox+xpos*scale,ww=(end?d.W:d.L)*scale,hh=d.H*scale,yy=floor-(ppNum(p.zMm)+d.H)*scale;s+=`<rect x="${xx}" y="${yy}" width="${Math.max(1,ww)}" height="${Math.max(1,hh)}" fill="${colors[i%colors.length]}" stroke="#173f53" stroke-width="2.5"/><text x="${xx+5}" y="${yy+Math.min(20,Math.max(9,hh/3))}" font-size="${Math.max(8,Math.min(16,ww/5))}" font-weight="700" fill="#143649">${ppContEscV212(ppDisplayCrateId(c.id))}</text><text x="${xx+5}" y="${yy+Math.min(36,Math.max(18,hh*.7))}" font-size="${Math.max(7,Math.min(12,ww/6))}" fill="#143649">${ppContPcs(c)} PCS</text>`;});
  s+=`<text x="20" y="26" font-size="18" font-weight="800" fill="#164e63">${view.toUpperCase()} VIEW · ${axis} × ${H} mm</text><text x="20" y="${VH-12}" font-size="12" fill="#164e63">Crates shown to scale for layout planning. Confirm physical dimensions and restraint.</text>`;
 }
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW} ${VH}" width="${VW}" height="${VH}">${s}</svg>`;
}
async function ppContExport(kind){
 const placed=ppSmartCrates.filter(c=>ppContLayout(c).placed),headers=['Crate No','Profiles','PCS','Cargo weight incl. entered tare kg','Width mm','Length mm','Height mm','X mm','Y mm','Elevation mm','Tier','Rotation'];
 const rows=placed.map(c=>{const p=ppContLayout(c),d=ppContDims(c);return [ppDisplayCrateId(c.id),[...new Set((c.items||[]).map(it=>it.profile))].join(' / '),ppContPcs(c),ppContCargoWeight(c).toFixed(1),d.W,d.L,d.H,p.x,p.y,Math.round(ppNum(p.zMm)),p.z+1,p.rot?'90°':'Original'];});
 if(kind==='excel'||kind==='csv'){const csv=[headers,...rows].map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n'),blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='AIS_Container_Loading_Plan.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);return;}
 if(kind==='print'){ppContOpenColourPrintV212(headers,rows);return;}
 if(kind==='pdf'){
  if(!window.jspdf?.jsPDF||typeof window.html2canvas!=='function'){if(typeof showToast==='function')showToast('PDF engine is unavailable. Opening the colour print report instead.','warning');ppContOpenColourPrintV212(headers,rows);return;}
  const doc=new window.jspdf.jsPDF({orientation:'landscape',unit:'mm',format:'a4'}),views=[['top','TOP VIEW'],['left','SIDE VIEW (LEFT)'],['right','SIDE VIEW (RIGHT)'],['front','FRONT VIEW'],['back','BACK VIEW']];
  const totalPcs=placed.reduce((s,c)=>s+ppContPcs(c),0),weight=placed.reduce((s,c)=>s+ppContCargoWeight(c),0),L=ppNum(document.getElementById('ppContLen')?.value)||12032,W=ppNum(document.getElementById('ppContWid')?.value)||2352,H=ppNum(document.getElementById('ppContHei')?.value)||2393;
  for(let i=0;i<views.length;i++){
   const [view,label]=views[i],stage=document.createElement('div');stage.style.cssText='position:fixed;left:-20000px;top:0;width:1240px;box-sizing:border-box;padding:28px;background:#ffffff;color:#12364d;font-family:Arial,sans-serif;';stage.innerHTML=`<h1 style="font-size:30px;margin:0 0 10px;color:#075b63">ALUMEX AIS TRACKER — CONTAINER LOADING PLAN</h1><h2 style="font-size:22px;margin:0 0 12px">${label}</h2><p style="font-size:15px;margin:0 0 14px">Container ${ppContEscV212(document.getElementById('ppSmartContainerType')?.selectedOptions?.[0]?.textContent||'40 ft Standard')} · Internal dimensions ${L} × ${W} × ${H} mm · Placed crates ${placed.length}/${ppSmartCrates.length} · ${totalPcs.toLocaleString()} PCS · Estimated profile + entered tare weight ${weight.toFixed(1)} kg</p><div style="border:1px solid #cbdde6;border-radius:10px;padding:12px;background:#f7fbfd">${ppContBuildViewSvgV212(view)}</div><p style="font-size:13px;margin-top:12px;color:#52677b">Colour-coded dimensional schematic. Verify actual container/door dimensions, payload, dunnage, load securing and stack strength before loading.</p>`;
   document.body.appendChild(stage);
   try{const canvas=await window.html2canvas(stage,{scale:1.5,backgroundColor:'#ffffff',logging:false,useCORS:true});if(i>0)doc.addPage('a4','landscape');const data=canvas.toDataURL('image/png'),ratio=canvas.height/canvas.width,iw=281,ih=Math.min(185,iw*ratio);doc.addImage(data,'PNG',8,8,iw,ih,'','FAST');}
   finally{stage.remove();}
  }
  doc.addPage('a4','landscape');doc.setFont('helvetica','bold');doc.setFontSize(17);doc.setTextColor(7,91,99);doc.text('Crate Position Details',10,14);doc.setFont('helvetica','normal');doc.setFontSize(8);
  if(typeof doc.autoTable==='function')doc.autoTable({head:[headers],body:rows,startY:20,theme:'grid',styles:{font:'helvetica',fontSize:7,cellPadding:2,overflow:'linebreak'},headStyles:{fillColor:[7,91,99],textColor:[255,255,255]},alternateRowStyles:{fillColor:[239,246,249]},margin:{left:8,right:8,bottom:8}});
  else{let y=22;doc.setFontSize(7);headers.forEach((h,i)=>doc.text(String(h).slice(0,16),10+(i*23),y));y+=8;rows.forEach(r=>{r.forEach((v,i)=>doc.text(String(v??'').slice(0,16),10+(i*23),y));y+=6;if(y>195){doc.addPage('a4','landscape');y=15;}});}
  doc.save('AIS_Container_Loading_Plan_Colour.pdf');if(typeof showToast==='function')showToast('Colour container plan PDF downloaded with Top, Left Side, Right Side, Front and Back views.','success');return;
 }
}
function ppContOpenColourPrintV212(headers,rows){
 const w=window.open('','_blank');if(!w){if(typeof showToast==='function')showToast('Allow pop-ups to print or save the colour container plan as PDF.','warning');return;}
 const esc=ppContEscV212,placed=ppSmartCrates.filter(c=>ppContLayout(c).placed),views=[['top','TOP VIEW'],['left','SIDE VIEW (LEFT)'],['right','SIDE VIEW (RIGHT)'],['front','FRONT VIEW'],['back','BACK VIEW']],L=ppNum(document.getElementById('ppContLen')?.value)||12032,W=ppNum(document.getElementById('ppContWid')?.value)||2352,H=ppNum(document.getElementById('ppContHei')?.value)||2393;
 w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>AIS Colour Container Plan</title><style>*{box-sizing:border-box}body{font:12px Arial;color:#12364d;margin:10mm}h1{color:#075b63;margin:0 0 7px}h2{margin:8px 0}.sheet{page-break-after:always;break-after:page}.drawing svg{display:block;width:100%;height:auto;border:1px solid #cbdde6;background:#fff}table{border-collapse:collapse;width:100%;font-size:9px}th,td{border:1px solid #9db7c8;padding:5px;text-align:left}th{background:#075b63!important;color:#fff!important}tr:nth-child(even){background:#eff6f9!important}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}@page{size:A4 landscape;margin:8mm}</style></head><body><section class="sheet"><h1>ALUMEX AIS TRACKER — CONTAINER LOADING PLAN</h1><p>Container ${esc(document.getElementById('ppSmartContainerType')?.selectedOptions?.[0]?.textContent||'40 ft Standard')} · ${L} × ${W} × ${H} mm · ${placed.length}/${ppSmartCrates.length} crates placed · ${placed.reduce((s,c)=>s+ppContPcs(c),0).toLocaleString()} PCS · ${placed.reduce((s,c)=>s+ppContCargoWeight(c),0).toFixed(1)} kg estimated cargo weight</p><h2>TOP VIEW</h2><div class="drawing">${ppContBuildViewSvgV212('top')}</div></section>${views.slice(1).map(([v,label])=>`<section class="sheet"><h1>ALUMEX AIS TRACKER — CONTAINER LOADING PLAN</h1><h2>${label}</h2><div class="drawing">${ppContBuildViewSvgV212(v)}</div></section>`).join('')}<section class="sheet"><h1>Crate Position Details</h1><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></section><script>window.onload=()=>window.print();<\/script></body></html>`);w.document.close();
}

// Refresh instructions and export labels for the enhanced manipulation workflow.
document.addEventListener('DOMContentLoaded',()=>{
 const btns=document.querySelectorAll('#packingPlannerTab .pp-container-exports button');btns.forEach(b=>{if((b.getAttribute('onclick')||'').includes("ppContExport('pdf')"))b.innerHTML='<i class="fa-solid fa-file-pdf"></i> Download Colour PDF';});
 const controls=document.querySelector('.pp-container-controls-secondary');if(controls&&!document.getElementById('ppV212QuickViews')){const row=document.createElement('div');row.id='ppV212QuickViews';row.className='pp-view-shortcuts';row.innerHTML='<b>View:</b><button type="button" onclick="ppContSetQuickView(\'top\')">Top</button><button type="button" onclick="ppContSetQuickView(\'left\')">Side</button><button type="button" onclick="ppContSetQuickView(\'front\')">Front</button><button type="button" onclick="ppContSetQuickView(\'back\')">Back</button><button type="button" onclick="ppContSetQuickView(\'3d\')">3D</button><span>Top view: click a crate to select it, then click an open position to move it. Moves snap to the nearest valid edge-aligned gap.</span>';controls.insertAdjacentElement('afterend',row);}
 const help=document.querySelector('.pp-container-selected .pp-location-hint');if(help)help.innerHTML='<i class="fa-solid fa-circle-info"></i> <b>Quick move:</b> choose a crate, then in <b>Top view</b> click the destination. The crate snaps to the nearest valid, edge-aligned position. For stacking, choose a supporting crate and use <b>Stack on Supporting Crate</b>.';
 try{if(typeof ppSmartRenderContainer==='function')ppSmartRenderContainer();}catch(e){console.warn('V2.12 container refresh skipped',e);}
});



/* AIS Tracker V2.12 — create N matching crates with per-crate PO quantities.
   Each quantity entered in the Next PL table is interpreted as PCS PER CRATE for this action.
   PO balances are reserved for quantity × crate count; no existing crate records are rewritten. */
function ppV212BatchRows(){
 const rows=ppNewSelectedLines(),count=Math.max(1,Math.min(60,Math.floor(ppNum(document.getElementById('ppNewCrateCount')?.value)||1)));
 return rows.map((r,n)=>({r,n,q:Math.max(0,Math.floor(ppNum(document.getElementById('ppNewQty_'+n)?.value))),checked:!!document.getElementById('ppNewCheck_'+n)?.checked})).filter(x=>x.q>0);
}
function ppV212UpdateBatchSummary(){
 const host=document.getElementById('ppNewCrateBatchSummary');if(!host)return;
 const count=Math.max(1,Math.min(60,Math.floor(ppNum(document.getElementById('ppNewCrateCount')?.value)||1))),no=Math.max(1,Math.min(60,Math.floor(ppNum(document.getElementById('ppNewCrateNo')?.value)||1))),rows=ppV212BatchRows();
 const per=rows.reduce((s,x)=>s+x.q,0),total=per*count,alloc=rows.map(x=>`${ppNewEsc(x.r.poNumber)}: ${x.q} × ${count} = ${x.q*count} PCS (balance ${ppNewBalance(x.r)})`);
 const ids=count===1?String(no):`${no}-${ppRomanLower(ppRomanAt(1))} … ${no}-${ppRomanLower(ppRomanAt(count))}`;
 host.innerHTML=`<b>Batch preview:</b> ${per.toLocaleString()} PCS per crate × ${count} crate(s) = <b>${total.toLocaleString()} PCS total</b> · IDs: <b>${ppNewEsc(ids)}</b>${alloc.length?`<div class="pp-v212-batch-lines">${alloc.join('<br>')}</div>`:''}<small>PCS values are per crate. Creation is blocked if any PO balance is less than PCS per crate × number of crates.</small>`;
 host.classList.toggle('warning',rows.some(x=>x.q*count>ppNewBalance(x.r)));
}
const ppV212UpdateTotalsBase=ppNewUpdateTotals;
ppNewUpdateTotals=function(){const r=ppV212UpdateTotalsBase.apply(this,arguments);ppV212UpdateBatchSummary();return r;};

ppNewCreateCrates=function(){
 const no=Math.max(1,Math.min(60,Math.floor(ppNum(document.getElementById('ppNewCrateNo')?.value)||1)));
 const count=Math.max(1,Math.min(60,Math.floor(ppNum(document.getElementById('ppNewCrateCount')?.value)||1)));
 const tare=Math.max(0,ppNum(document.getElementById('ppNewTareWeight')?.value));
 const d=ppNewUpdateCreateDimensions();
 if(!d){alert('Select a Profile, Item Code and Length, then complete Box Size and Crate Width in Crate Master Data before creating crates.');return;}
 const selected=ppV212BatchRows();
 // Validate the full requested batch against each PO balance before mutating any records.
 for(const x of selected){const required=x.q*count,balance=ppNewBalance(x.r);if(required>balance){alert(`${x.r.poNumber}: ${x.q} PCS per crate × ${count} crates = ${required} PCS, but only ${balance} PCS remain. Reduce PCS per crate or the number of crates.`);return;}const m=ppSmartMasterFor(x.r);if(!m||!ppDims(m.boxSize)||ppNum(m.crateWidth)<=0){alert(`Crate Master Data is incomplete for ${x.r.profile} / ${x.r.itemCode} / ${x.r.length} mm.`);return;}if(ppNum(x.r.length)>d.outerL){alert(`Profile length ${x.r.length} mm does not fit crate length ${d.outerL} mm.`);return;}}
 const itemsPerCrate=selected.map(x=>{const m=ppSmartMasterFor(x.r),pbox=Math.max(1,ppSmartPcsBox(x.r));return {lineKey:ppSmartLineKey(x.r),po:x.r.poNumber,profile:x.r.profile,itemCode:x.r.itemCode,length:x.r.length,pcs:x.q,pcsPerBox:pbox,boxes:Math.ceil(x.q/pbox),unitWeight:ppNum(x.r.unitWeight||m.unitWeight)};});
 const manual={outerL:d.outerL,outerW:d.width,orientation:'auto',rowMultiplier:d.rows};
 let calc=null;if(itemsPerCrate.length){calc=ppSmartCalcDims(itemsPerCrate,manual);if(!calc?.valid){alert(`These per-crate quantities do not fit the crate: ${calc?.reason||'check Master Data, box orientation, width and rows.'}`);return;}if(ppNum(calc.packingH)>PP_MAX_PACKING_HEIGHT){alert(`Packing height would be ${Math.round(ppNum(calc.packingH))} mm. Maximum packing height is ${PP_MAX_PACKING_HEIGHT} mm. Reduce PCS per crate or adjust Crate Master Data.`);return;}}
 const used=new Set(ppSmartCrates.map(c=>String(c.id).toUpperCase())),ids=[];
 for(let n=0;n<count;n++){const id=count===1?`C-${String(no).padStart(2,'0')}`:`C-${String(no).padStart(2,'0')}-${ppRomanAt(n+1)}`;if(used.has(id.toUpperCase())){alert(`Crate ${ppDisplayCrateId(id)} already exists. Choose another crate number.`);return;}ids.push(id);used.add(id.toUpperCase());}
 // Each physical crate receives the same entered per-crate PO quantities.
 for(const id of ids){const crateItems=itemsPerCrate.map(it=>({...it}));const metric=crateItems.length?ppSmartCalcDims(crateItems,manual):null;const packingH=metric?.valid?ppNum(metric.packingH):0,overallH=metric?.valid?ppNum(metric.overallH):PP_LEG_HEIGHT;
  ppSmartCrates.push({id,items:crateItems,createdAt:Date.now(),outerL:d.outerL,outerW:d.width,packingH,extraHeight:0,overallH,perLayer:ppNum(metric?.perLayer)||ppNum(metric?.per)||ppNum(d.calc?.perLayer)||0,layers:ppNum(metric?.layers)||0,boxes:ppNum(metric?.boxes)||crateItems.reduce((s,it)=>s+ppNum(it.boxes),0),orientation:metric?.orientation||d.calc?.orientation||d.master.orientation||'auto',rowMultiplier:d.rows,tareWeightKg:tare,manual:{...manual,packingH,orientation:metric?.orientation||'auto'},containerLayout:{x:0,y:0,z:0,zMm:0,rot:false,placed:false,baseId:''}});
 }
 ppSmartPersist();ppSmartRenderCrateList();ppNewRefreshCrateOptions();const last=ids[ids.length-1],sel=document.getElementById('ppNewCrateSelect');if(sel)sel.value=last;
 ppNewSelectedLines().forEach((r,n)=>{const q=document.getElementById('ppNewQty_'+n),ch=document.getElementById('ppNewCheck_'+n);if(q)q.value='0';if(ch)ch.checked=false;});
 ppNewRenderPoRows();ppNewUpdateTotals();ppNewRenderSelectedCrate();const box=document.getElementById('ppNewCreateBox');if(box)box.style.display='block';
 if(typeof showToast==='function')showToast(`${count} crate(s) created; ${selected.reduce((s,x)=>s+x.q,0).toLocaleString()} PCS per crate × ${count} = ${selected.reduce((s,x)=>s+x.q,0)*count} PCS allocated. Existing crate records retained.`, 'success');
};

// Make the four-view container PDF export and click-to-place tools available in the page.
document.addEventListener('DOMContentLoaded',()=>{
 const total=document.querySelector('.pp-new-totals');if(total&&!document.getElementById('ppNewCrateBatchSummary')){const summary=document.createElement('div');summary.id='ppNewCrateBatchSummary';summary.className='pp-v212-batch-summary';summary.innerHTML='Enter PCS per crate and set Number of crates to preview the total PO allocation.';total.insertAdjacentElement('afterend',summary);}
 const createBox=document.getElementById('ppNewCreateBox');if(createBox){const btn=createBox.querySelector('button[onclick="ppNewCreateCrates()"]');if(btn)btn.innerHTML='<i class="fa-solid fa-box-open"></i> Create Crate(s) + Allocate PCS';const small=createBox.querySelector('small');if(small)small.textContent='PCS entered in the PO table are per physical crate. Number of crates multiplies each PO quantity. Roman suffixes are used only when creating multiple crates in one action; PO balance and crate height are validated before saving.';}
 const countInput=document.getElementById('ppNewCrateCount');if(countInput)countInput.addEventListener('input',ppV212UpdateBatchSummary);const numberInput=document.getElementById('ppNewCrateNo');if(numberInput)numberInput.addEventListener('change',ppV212UpdateBatchSummary);
 const labels=document.querySelectorAll('.pp-new-totals small');if(labels[0])labels[0].textContent='PCS per crate';if(labels[1])labels[1].textContent='Profile weight per crate';if(labels[2])labels[2].textContent='Boxes per crate';
 const controls=document.querySelector('.pp-container-controls-secondary');if(controls&&!document.getElementById('ppV212QuickViews')){const row=document.createElement('div');row.id='ppV212QuickViews';row.className='pp-view-shortcuts';row.innerHTML='<b>View:</b><button type="button" onclick="ppContSetQuickView(\'top\')">Top</button><button type="button" onclick="ppContSetQuickView(\'left\')">Side</button><button type="button" onclick="ppContSetQuickView(\'front\')">Front</button><button type="button" onclick="ppContSetQuickView(\'back\')">Back</button><button type="button" onclick="ppContSetQuickView(\'3d\')">3D</button><span>Click a crate to select it, then click a destination in Top view, or drag it. The layout snaps to the nearest valid position and avoids overlaps.</span>';controls.insertAdjacentElement('afterend',row);}
 try{ppNewUpdateBatchSummary();if(typeof ppSmartRenderContainer==='function')ppSmartRenderContainer();}catch(e){console.warn('V2.12 init:',e);}
});
/* AIS Tracker V2.13 — explicit Master Data box-height calculation, batch allocation preview,
   and reliable click/drag/compact container placement. Existing saved records are retained. */

function ppV213MasterBoxesPerLayer(m, d, width, rows){
  if(!m||!d)return 0;
  const manual=Math.floor(ppNum(m.manualPerLayer));
  if(manual>0)return manual;
  const direct=[m.boxesPerLayer,m.perLayer,m.calc?.perLayer,m.calc?.per,m.calculatedBoxesPerLayer,m.boxesBottomLayer].map(ppNum).find(v=>v>0);
  if(direct){const masterRows=Math.max(1,Math.floor(ppNum(m.rowMultiplier)||1));return Math.max(1,Math.floor(direct* Math.max(1,rows)/masterRows));}
  try{
    const mc=ppCrateCalc({...m,rowMultiplier:rows,orientation:'height',manualPackingH:null,manualLayers:null,manualBoxesPerCrate:null});
    if(ppNum(mc?.perLayer||mc?.per)>0)return Math.max(1,Math.floor(ppNum(mc.perLayer||mc.per)));
  }catch(e){}
  const inner=Math.max(1,ppNum(width)-2*PP_WOOD_THICKNESS);
  return Math.max(1,Math.floor(inner/Math.max(1,ppNum(d.w)))*Math.max(1,rows));
}

/* Box Size is Length × Width × Height. The Master Data Height (third dimension) is vertical.
   Layers = ceil(total boxes / Master Data bottom-layer capacity); packing height = layers × box height. */
ppSmartOrientationMetrics=function(items,manual={}){
  const parsed=(items||[]).map(it=>({it,m:ppSmartMasterFor(it),d:ppDims(ppSmartMasterFor(it)?.boxSize)}));
  if(!parsed.length||parsed.some(x=>!x.m||!x.d))return {valid:false,reason:'Box Size is missing for one or more profiles. Complete Crate Master Data first.'};
  const masters=parsed.map(x=>x.m),width=ppNum(manual.outerW)||Math.max(0,...masters.map(m=>ppNum(m.crateWidth)));
  if(width<=0)return {valid:false,reason:'Crate Master Data usable width is missing.'};
  const rows=Math.max(1,Math.min(3,Math.floor(ppNum(manual.rowMultiplier)||Math.max(1,...masters.map(m=>ppNum(m.rowMultiplier)||1)))));
  // Group identical box types (POs can differ while the physical box type is the same).
  const grouped=new Map();
  for(const x of parsed){
    const pbox=Math.max(1,ppNum(x.it.pcsPerBox)||ppNum(x.m.pcsPerBox)||1),pcs=Math.max(0,Math.floor(ppNum(x.it.pcs))),boxCount=Math.ceil(pcs/pbox);
    if(!boxCount)continue;
    const key=[x.it.profile,x.it.itemCode,x.it.length,x.m.boxSize,pbox].join('|');
    if(!grouped.has(key))grouped.set(key,{profile:x.it.profile,itemCode:x.it.itemCode,length:ppNum(x.it.length),master:x.m,dim:x.d,pcsPerBox:pbox,boxes:0});
    grouped.get(key).boxes+=boxCount;
  }
  const groups=[...grouped.values()];
  const boxes=groups.reduce((s,g)=>s+g.boxes,0);
  if(boxes<=0)return {valid:false,reason:'Enter PCS per crate to calculate box layers and height.'};
  for(const g of groups){g.perLayer=ppV213MasterBoxesPerLayer(g.master,g.dim,width,rows);g.layers=Math.ceil(g.boxes/Math.max(1,g.perLayer));g.verticalHeight=ppNum(g.dim.h);g.packingH=g.layers*g.verticalHeight;}
  const layers=groups.reduce((s,g)=>s+g.layers,0),packingH=groups.reduce((s,g)=>s+g.packingH,0),overallH=packingH+PP_LEG_HEIGHT,perLayer=Math.min(...groups.map(g=>g.perLayer));
  const profileLength=Math.max(0,...(items||[]).map(it=>ppNum(it.length)));
  const masterSingleLength=Math.max(0,...masters.map(m=>ppNum(m.manualOuterL)>0?ppNum(m.manualOuterL)/Math.max(1,ppNum(m.rowMultiplier)||1):0));
  const outerL=ppNum(manual.outerL)||Math.ceil(Math.max(profileLength+32,masterSingleLength)*rows);
  const maxBoxL=Math.max(0,...parsed.map(x=>ppNum(x.d.l)));
  if(maxBoxL>outerL/rows+0.5)return {valid:false,reason:`Box length ${maxBoxL} mm is longer than available length per row (${Math.round(outerL/rows)} mm). Increase crate length in Crate Master Data.`};
  const maxLayers=Math.floor(PP_MAX_PACKING_HEIGHT/Math.max(1,...groups.map(g=>g.verticalHeight)));
  const valid=packingH<=PP_MAX_PACKING_HEIGHT&&overallH<=PP_MAX_OVERALL_HEIGHT;
  const layerBreakdown=groups.map(g=>`${g.profile} ${g.itemCode}: ${g.boxes} boxes ÷ ${g.perLayer}/layer = ${g.layers} layer(s) × ${g.verticalHeight} mm = ${g.packingH} mm`);
  return {valid,reason:valid?'':`Needs ${packingH} mm packing height. ${layerBreakdown.join('; ')}. Maximum packing height is ${PP_MAX_PACKING_HEIGHT} mm.`,orientation:'height',rowMultiplier:rows,width,internalWidth:width,widthOutside:width+2*PP_WOOD_THICKNESS,perLayer,per:perLayer,layers,boxes,packingH,overallH,maxCapacity:groups.reduce((s,g)=>s+g.perLayer*maxLayers,0),maxLayers,maxAcross:perLayer,maxVertical:Math.max(...groups.map(g=>g.verticalHeight)),outerL,outerW:width,boxesAcross:perLayer,verticalBoxHeight:Math.max(...groups.map(g=>g.verticalHeight)),masterLayerCapacities:groups.map(g=>g.perLayer),layerGroups:groups,layerBreakdown};
};
ppSmartCalcDims=function(items,manual={}){const c=ppSmartOrientationMetrics(items,manual);return c.valid?{...c,packingH:c.packingH,overallH:c.overallH,per:c.perLayer,perLayer:c.perLayer,layers:c.layers,boxes:c.boxes,orientation:'height',rowMultiplier:c.rowMultiplier,outerW:c.width,outerL:c.outerL}:c;};

/* Crate preview follows the same box-count/layer/height formula as actual crate creation. */
ppNewCalcCratePreview=function(c,items){
  const safeItems=(items||[]).filter(it=>ppNum(it.pcs)>0),sourceRows=safeItems.map(it=>({it,m:ppSmartMasterFor(it),d:ppDims(ppSmartMasterFor(it)?.boxSize)})).filter(x=>x.m&&x.d);
  const active=ppNewActiveMaster(),fallback=sourceRows[0]?.m||active.master||null;
  const masterWidth=ppNum(c?.masterWidth)||ppNum(c?.outerW)||Math.max(0,...sourceRows.map(x=>ppNum(x.m.crateWidth)),ppNum(fallback?.crateWidth));
  const rows=Math.max(1,Math.min(3,Math.floor(ppNum(c?.rowMultiplier||c?.manual?.rowMultiplier||fallback?.rowMultiplier)||1)));
  const boxTotal=safeItems.reduce((s,it)=>s+Math.ceil(Math.max(0,ppNum(it.pcs))/Math.max(1,ppNum(it.pcsPerBox)||ppNum(ppSmartMasterFor(it)?.pcsPerBox)||1)),0);
  const length=Math.max(1,ppNum(c?.outerL)||Math.ceil((Math.max(0,...safeItems.map(it=>ppNum(it.length)),ppNum(active.line?.length))+32)*rows));
  const metric=safeItems.length?ppSmartCalcDims(safeItems,{outerL:length,outerW:masterWidth,rowMultiplier:rows,orientation:'height'}):null;
  const boxesPerLayer=ppNum(metric?.perLayer)||0,layers=ppNum(metric?.layers)||0,verticalMax=ppNum(metric?.verticalBoxHeight)||Math.max(0,...sourceRows.map(x=>ppNum(x.d.h)));
  const extra=Math.max(0,ppNum(c?.extraHeight)),packingHeight=(metric?ppNum(metric.packingH):layers*verticalMax)+extra,overallHeight=packingHeight+PP_LEG_HEIGHT;
  const pcs=safeItems.reduce((s,it)=>s+ppNum(it.pcs),0),profileWeight=safeItems.reduce((s,it)=>s+ppNum(it.pcs)*ppNum(it.unitWeight||ppSmartMasterFor(it)?.unitWeight),0),tare=Math.max(0,ppNum(c?.tareWeightKg));
  return {items:safeItems,sourceRows,boxTotal,boxesPerLayer,acrossWidth:boxesPerLayer,layers,packingHeight,overallHeight,length,widthBase:masterWidth,widthOutside:masterWidth+2*PP_WOOD_THICKNESS,rows,orientation:'height',crossMax:0,verticalMax,pcs,profileWeight,tare,totalWeight:profileWeight+tare,valid:!!metric?.valid&&packingHeight<=PP_MAX_PACKING_HEIGHT&&overallHeight<=PP_MAX_OVERALL_HEIGHT,extra,innerW:masterWidth,metric};
};

/* Batch table: only checked PO lines are allocated; PCS is per crate, count multiplies it. */
ppV212BatchRows=function(){
  const rows=ppNewSelectedLines(),count=Math.max(1,Math.min(60,Math.floor(ppNum(document.getElementById('ppNewCrateCount')?.value)||1)));
  return rows.map((r,n)=>({r,n,q:Math.max(0,Math.floor(ppNum(document.getElementById('ppNewQty_'+n)?.value))),checked:!!document.getElementById('ppNewCheck_'+n)?.checked})).filter(x=>x.checked&&x.q>0);
};
ppV212UpdateBatchSummary=function(){
  const host=document.getElementById('ppNewCrateBatchSummary');if(!host)return;
  const count=Math.max(1,Math.min(60,Math.floor(ppNum(document.getElementById('ppNewCrateCount')?.value)||1))),no=Math.max(1,Math.min(60,Math.floor(ppNum(document.getElementById('ppNewCrateNo')?.value)||1))),rows=ppV212BatchRows();
  const per=rows.reduce((s,x)=>s+x.q,0),total=per*count,alloc=rows.map(x=>`${ppNewEsc(x.r.poNumber)}: ${x.q} PCS/crate × ${count} = ${x.q*count} PCS (balance ${ppNewBalance(x.r)})`);
  const ids=count===1?String(no):`${no}-${ppRomanLower(ppRomanAt(1))} … ${no}-${ppRomanLower(ppRomanAt(count))}`;
  const d=ppNewUpdateCreateDimensions();let height='Select a PO row and enter PCS per crate to calculate box layers and height.';
  if(d&&rows.length){const items=rows.map(x=>{const m=ppSmartMasterFor(x.r),pbox=Math.max(1,ppSmartPcsBox(x.r));return {lineKey:ppSmartLineKey(x.r),po:x.r.poNumber,profile:x.r.profile,itemCode:x.r.itemCode,length:x.r.length,pcs:x.q,pcsPerBox:pbox,boxes:Math.ceil(x.q/pbox),unitWeight:ppNum(x.r.unitWeight||m?.unitWeight)};});const calc=ppSmartCalcDims(items,{outerL:d.outerL,outerW:d.width,rowMultiplier:d.rows,orientation:'height'});if(calc)height=calc.valid?`<b>${calc.boxes} boxes/crate · ${calc.layers} total layer(s)</b><br>${(calc.layerBreakdown||[]).map(ppNewEsc).join('<br>')}<br>Combined packing height <b>${calc.packingH} mm</b> + ${PP_LEG_HEIGHT} mm legs = <b>${calc.overallH} mm overall</b>.`:`${ppNewEsc(calc.reason||'Review Master Data.')}`;}
  host.innerHTML=`<b>Batch preview:</b> ${per.toLocaleString()} PCS per crate × ${count} crate(s) = <b>${total.toLocaleString()} PCS total</b> · IDs: <b>${ppNewEsc(ids)}</b><div class="pp-v213-height-preview">${height}</div>${alloc.length?`<div class="pp-v212-batch-lines">${alloc.join('<br>')}</div>`:''}<small>Tick each PO row to allocate it. Every new physical crate receives the same selected per-crate quantities. Creation is blocked if any PO balance is less than PCS/crate × crate count.</small>`;
  host.classList.toggle('warning',rows.some(x=>x.q*count>ppNewBalance(x.r)));
};
const ppV213UpdateTotalsBase=ppNewUpdateTotals;
ppNewUpdateTotals=function(){const r=ppV213UpdateTotalsBase.apply(this,arguments);ppV212UpdateBatchSummary();return r;};

/* Keep the selected PO quantities as PCS PER CRATE; clone identical contents to each Roman-suffixed crate. */
ppNewCreateCrates=function(){
  const no=Math.max(1,Math.min(60,Math.floor(ppNum(document.getElementById('ppNewCrateNo')?.value)||1))),count=Math.max(1,Math.min(60,Math.floor(ppNum(document.getElementById('ppNewCrateCount')?.value)||1))),tare=Math.max(0,ppNum(document.getElementById('ppNewTareWeight')?.value)),d=ppNewUpdateCreateDimensions();
  if(!d){alert('Select Profile, Item Code and Length and complete Box Size / Crate Width in Crate Master Data.');return;}
  const selected=ppV212BatchRows();if(!selected.length){alert('Tick at least one PO row and enter PCS per crate before creating crates.');return;}
  for(const x of selected){const required=x.q*count,balance=ppNewBalance(x.r);if(required>balance){alert(`${x.r.poNumber}: ${x.q} PCS per crate × ${count} crates = ${required} PCS, but only ${balance} PCS remain. Reduce PCS per crate or number of crates.`);return;}const m=ppSmartMasterFor(x.r);if(!m||!ppDims(m.boxSize)||ppNum(m.crateWidth)<=0){alert(`Crate Master Data is incomplete for ${x.r.profile} / ${x.r.itemCode} / ${x.r.length} mm.`);return;}if(ppNum(x.r.length)>d.outerL){alert(`Profile length ${x.r.length} mm does not fit crate length ${d.outerL} mm.`);return;}}
  const itemsPerCrate=selected.map(x=>{const m=ppSmartMasterFor(x.r),pbox=Math.max(1,ppSmartPcsBox(x.r));return {lineKey:ppSmartLineKey(x.r),po:x.r.poNumber,profile:x.r.profile,itemCode:x.r.itemCode,length:x.r.length,pcs:x.q,pcsPerBox:pbox,boxes:Math.ceil(x.q/pbox),unitWeight:ppNum(x.r.unitWeight||m.unitWeight)};});
  const manual={outerL:d.outerL,outerW:d.width,orientation:'height',rowMultiplier:d.rows};const calc=ppSmartCalcDims(itemsPerCrate,manual);
  if(!calc?.valid){alert(`These per-crate quantities do not fit: ${calc?.reason||'check Master Data and crate dimensions.'}`);return;}
  if(calc.packingH>PP_MAX_PACKING_HEIGHT||calc.overallH>PP_MAX_OVERALL_HEIGHT){alert(`Required packing height is ${calc.packingH} mm + ${PP_LEG_HEIGHT} mm legs = ${calc.overallH} mm overall. Maximum packing height is ${PP_MAX_PACKING_HEIGHT} mm and maximum overall height is ${PP_MAX_OVERALL_HEIGHT} mm.`);return;}
  const used=new Set(ppSmartCrates.map(c=>String(c.id).toUpperCase())),ids=[];
  for(let n=0;n<count;n++){const id=count===1?`C-${String(no).padStart(2,'0')}`:`C-${String(no).padStart(2,'0')}-${ppRomanAt(n+1)}`;if(used.has(id.toUpperCase())){alert(`Crate ${ppDisplayCrateId(id)} already exists. Choose another crate number.`);return;}ids.push(id);used.add(id.toUpperCase());}
  // Build and validate the whole batch before mutating the live in-memory list.
  const created=ids.map((id,n)=>({id,items:itemsPerCrate.map(it=>({...it})),createdAt:Date.now()+n,outerL:calc.outerL,outerW:d.width,masterWidth:d.width,outsideWidth:d.width+2*PP_WOOD_THICKNESS,packingH:calc.packingH,extraHeight:0,overallH:calc.overallH,perLayer:calc.perLayer,layers:calc.layers,boxes:calc.boxes,orientation:'height',rowMultiplier:d.rows,tareWeightKg:tare,manual:{...manual,packingH:calc.packingH,orientation:'height',rowMultiplier:d.rows},containerLayout:{x:0,y:0,z:0,zMm:0,rot:false,placed:false,baseId:''}}));
  ppSmartCrates.push(...created);ppSmartPersist();ppSmartRenderCrateList();ppNewRefreshCrateOptions();const sel=document.getElementById('ppNewCrateSelect');if(sel)sel.value=ids[ids.length-1];ppNewRenderSelectedCrate();ppNewRenderPoRows();ppNewUpdateTotals();
  if(typeof showToast==='function')showToast(`${count} crate(s) created: ${selected.reduce((s,x)=>s+x.q,0).toLocaleString()} PCS per crate × ${count} = ${selected.reduce((s,x)=>s+x.q,0)*count} PCS. IDs: ${ids.map(ppDisplayCrateId).join(', ')}.`,'success');
};

/* Reliable Top-view selection, destination click and drag. Moving crates snap to the nearest valid gap. */
function ppContBindMoveInteractionsV213(host){
 if(!host||host.dataset.ppV213MoveBound==='1')return;host.dataset.ppV213MoveBound='1';let drag=null,suppressUntil=0;
 const point=(svg,ev)=>{try{const p=svg.createSVGPoint();p.x=ev.clientX;p.y=ev.clientY;const q=p.matrixTransform(svg.getScreenCTM().inverse());return{x:q.x,y:q.y};}catch(e){const r=svg.getBoundingClientRect(),vb=svg.viewBox.baseVal;return{x:(ev.clientX-r.left)/r.width*vb.width,y:(ev.clientY-r.top)/r.height*vb.height};}};
 const target=(svg,ev,c)=>{const p=point(svg,ev),vb=svg.viewBox.baseVal,L=Math.max(1,ppNum(document.getElementById('ppContLen')?.value)||12032),W=Math.max(1,ppNum(document.getElementById('ppContWid')?.value)||2352),scale=Math.max(.0001,ppNum(svg.dataset.mmScale)||Math.min((vb.width-84)/L,(vb.height-84)/W)),ox=(vb.width-L*scale)/2,oy=(vb.height-W*scale)/2,d=ppContDims(c);return{x:Math.max(0,Math.min(L-d.L,Math.round((p.x-ox)/scale-d.L/2))),y:Math.max(0,Math.min(W-d.W,Math.round((p.y-oy)/scale-d.W/2)))};};
 host.addEventListener('click',ev=>{
  if(Date.now()<suppressUntil){ev.preventDefault();ev.stopImmediatePropagation();return;}
  const svg=ev.target.closest('svg[data-layout-view]');if(!svg||svg.dataset.layoutView==='3d'||ev.target.closest('g[data-draggable-crate]'))return;
  if(!['rect','svg','polygon'].includes(String(ev.target.localName||'').toLowerCase()))return;
  const c=ppContGetSelected();if(!c)return;const layout=ppContLayout(c);
  if(ppNum(layout.zMm)>0||layout.baseId){if(typeof showToast==='function')showToast('This crate is stacked. Use the supporting-crate controls to move it safely.','info');return;}
  const view=svg.dataset.layoutView,pt=point(svg,ev),vb=svg.viewBox.baseVal,L=Math.max(1,ppNum(document.getElementById('ppContLen')?.value)||12032),W=Math.max(1,ppNum(document.getElementById('ppContWid')?.value)||2352),H=Math.max(1,ppNum(document.getElementById('ppContHei')?.value)||2393),pad=48,axis=['front','back'].includes(view)?W:L,scale=Math.max(.0001,ppNum(svg.dataset.mmScale)||Math.min((vb.width-2*pad)/axis,(vb.height-2*pad)/H)),axisWidth=axis*scale,ox=(vb.width-axisWidth)/2,d=ppContDims(c);let tx=ppNum(layout.x),ty=ppNum(layout.y);
  if(view==='top'){const xy=target(svg,ev,c);tx=xy.x;ty=xy.y;}
  else if(view==='left'||view==='right'){tx=Math.max(0,Math.min(L-d.L,Math.round((pt.x-ox)/scale-d.L/2)));}
  else if(view==='front'||view==='back'){ty=Math.max(0,Math.min(W-d.W,Math.round((pt.x-ox)/scale-d.W/2)));}
  ev.preventDefault();ppContMoveSelectedNearV212(tx,ty);
 },true);
 host.addEventListener('pointerdown',ev=>{const g=ev.target.closest('g[data-draggable-crate]'),svg=ev.target.closest('svg[data-layout-view="top"]');if(!g||!svg)return;const hit=(g.getAttribute('onclick')||'').match(/ppContPickById\('([^']+)'\)/);if(!hit)return;const id=decodeURIComponent(hit[1]),c=ppSmartCrates.find(q=>q.id===id);if(!c)return;const p=ppContLayout(c);if(ppNum(p.zMm)>0||p.baseId){if(typeof showToast==='function')showToast('Select floor crates for drag movement. Use supporting-crate controls for stacked crates.','info');return;}ppContSelectedId=id;ppContSyncSelected();drag={id,startX:ev.clientX,startY:ev.clientY,moved:false};try{svg.setPointerCapture(ev.pointerId);}catch(e){}ev.preventDefault();});
 host.addEventListener('pointermove',ev=>{if(drag&&Math.abs(ev.clientX-drag.startX)+Math.abs(ev.clientY-drag.startY)>5)drag.moved=true;});
 host.addEventListener('pointerup',ev=>{if(!drag)return;const state=drag;drag=null;if(!state.moved)return;suppressUntil=Date.now()+400;const c=ppSmartCrates.find(q=>q.id===state.id),svg=host.querySelector('svg[data-layout-view="top"]');if(!c||!svg)return;const xy=target(svg,ev,c);ppContMoveSelectedNearV212(xy.x,xy.y);});
}
ppSmartRenderContainer=function(){const host=document.getElementById('ppContainerVisual');if(host)host.dataset.dragBound='1';const out=ppV212BaseRender.apply(this,arguments);if(host)ppContBindMoveInteractionsV213(host);return out;};
ppContPickById=function(enc){const id=decodeURIComponent(enc);if(!ppSmartCrates.some(c=>c.id===id))return;ppContSelectedId=id;ppContSyncSelected();ppSmartRenderContainer();};

/* Compact bottom-left arrangement with correct rotated dimensions and no floor overlaps. */
ppSmartAutoArrange=function(){
 const L=Math.max(1,ppNum(document.getElementById('ppContLen')?.value)||12032),W=Math.max(1,ppNum(document.getElementById('ppContWid')?.value)||2352),H=Math.max(1,ppNum(document.getElementById('ppContHei')?.value)||2393),payload=Math.min(18000,Math.max(1,ppNum(document.getElementById('ppContPayload')?.value)||18000)),allowStack=!!document.getElementById('ppContStackConfirmed')?.checked,maxTier=Math.max(1,Math.floor(ppNum(document.getElementById('ppContTiers')?.value)||1));
 if(!ppSmartCrates.length){if(typeof showToast==='function')showToast('Add crates in the Crate List tab first.','warning');return;}
 ppContTakeSnapshot();ppSmartCrates.forEach(c=>{ppContLayout(c);Object.assign(c.containerLayout,{x:0,y:0,z:0,zMm:0,baseId:'',rot:false,placed:false});});
 const ordered=[...ppSmartCrates].sort((a,b)=>{const da=ppContDims(a),db=ppContDims(b);return db.L*db.W-da.L*da.W||Math.max(db.L,db.W)-Math.max(da.L,da.W);});let totalWeight=0;const placed=[];
 for(const c of ordered){const wt=ppContCargoWeight(c);if(totalWeight+wt>payload)continue;const baseL=Math.max(1,ppNum(c.outerL)||1),baseW=Math.max(1,ppNum(c.outerW)+2*PP_WOOD_THICKNESS),h=Math.max(1,ppNum(c.overallH)||ppNum(c.packingH)+PP_LEG_HEIGHT),xs=new Set([0]),ys=new Set([0]);
  for(const q of placed){const p=ppContLayout(q),qd=ppContDims(q);[p.x,p.x+qd.L,p.x-baseL,p.x+qd.L-baseL,p.x-baseW,p.x+qd.L-baseW].forEach(v=>{if(v>=0&&v<=L)xs.add(Math.round(v));});[p.y,p.y+qd.W,p.y-baseW,p.y+qd.W-baseW,p.y+qd.W-baseL,p.y-baseL].forEach(v=>{if(v>=0&&v<=W)ys.add(Math.round(v));});}
  const opts=[];for(const rot of [false,true]){const cl=rot?baseW:baseL,cw=rot?baseL:baseW;if(cl>L||cw>W||h>H)continue;for(const x of xs){for(const y of ys){if(x+cl>L||y+cw>W)continue;const overlap=placed.some(q=>{const p=ppContLayout(q),d=ppContDims(q);return x<p.x+d.L&&x+cl>p.x&&y<p.y+d.W&&y+cw>p.y;});if(overlap)continue;opts.push({x,y,rot,L:cl,W:cw,score:y*(L+1)+x});}}}
  if(!opts.length)continue;opts.sort((a,b)=>a.score-b.score);const best=opts[0];Object.assign(ppContLayout(c),{x:best.x,y:best.y,z:0,zMm:0,baseId:'',rot:best.rot,placed:true});placed.push(c);totalWeight+=wt;
 }
 const unplaced=ppSmartCrates.length-placed.length;
 if(unplaced>0&&allowStack&&maxTier>1){ppV212BaseAutoArrange.apply(this,arguments);return;}
 ppContSelectedId=placed[0]?.id||'';ppSmartPersist();ppContSyncSelected();ppSmartRenderContainer();if(typeof showToast==='function')showToast(`Compact auto-arrange saved: ${placed.length}/${ppSmartCrates.length} crates placed, using nearest edge-aligned gaps.${unplaced?` ${unplaced} crate(s) do not fit on the floor; review container size or use confirmed stacking.`:''}`,unplaced?'warning':'success');
};

(function ppV213StyleAndRefresh(){
 const st=document.createElement('style');st.id='pp-v213-style';st.textContent='.pp-v213-height-preview{margin-top:8px;padding:10px 12px;border:1px solid #b9e4d9;border-radius:9px;background:#effcf8;color:#145c59;font-size:12px;line-height:1.55}.pp-v213-height-preview b{color:#075b63}.pp-v212-batch-summary.warning .pp-v213-height-preview{border-color:#f0b4b4;background:#fff5f5;color:#9f1239}';document.head.appendChild(st);
 document.addEventListener('DOMContentLoaded',()=>{try{ppV212UpdateBatchSummary();if(typeof ppSmartRenderContainer==='function')ppSmartRenderContainer();}catch(e){console.warn('V2.13 initialization:',e);}});
})();


/* AIS Tracker V2.15 — simplified drag-and-drop container arrangement.
   One delegated pointer handler avoids competing legacy handlers. Existing crate and PO records are untouched. */
ppContBindMoveInteractionsV213=function(host){
 if(!host||host.dataset.ppV215DragBound==='1')return;
 host.dataset.ppV215DragBound='1';
 let drag=null,ignoreClickUntil=0;
 const getPoint=(svg,ev)=>{try{const pt=svg.createSVGPoint();pt.x=ev.clientX;pt.y=ev.clientY;const q=pt.matrixTransform(svg.getScreenCTM().inverse());return{x:q.x,y:q.y};}catch(e){const r=svg.getBoundingClientRect(),vb=svg.viewBox.baseVal;return{x:(ev.clientX-r.left)/r.width*vb.width,y:(ev.clientY-r.top)/r.height*vb.height};}};
 const setHint=(text)=>{const hint=document.querySelector('.pp-container-selected .pp-location-hint');if(hint)hint.innerHTML='<i class="fa-solid fa-circle-info"></i> '+text;};
 host.addEventListener('pointerdown',ev=>{
  const g=ev.target.closest('g[data-draggable-crate]');
  const svg=ev.target.closest('svg[data-layout-view="top"]');
  if(!g||!svg||ev.button!==0)return;
  const hit=(g.getAttribute('onclick')||'').match(/ppContPickById\('([^']+)'\)/);if(!hit)return;
  const id=decodeURIComponent(hit[1]),c=ppSmartCrates.find(q=>q.id===id);if(!c)return;
  const lp=ppContLayout(c);
  if(ppNum(lp.zMm)>0||lp.baseId){ppContSelectedId=id;ppContSyncSelected();if(typeof showToast==='function')showToast('This crate is stacked. Select a floor crate to drag, or use Stack on Supporting Crate.','info');return;}
  ppContSelectedId=id;ppContSyncSelected();
  const pt=getPoint(svg,ev);
  drag={id,g,svg,pointerId:ev.pointerId,startClientX:ev.clientX,startClientY:ev.clientY,startPoint:pt,startX:ppNum(lp.x),startY:ppNum(lp.y),moved:false,scale:Math.max(.0001,ppNum(svg.dataset.mmScale)||.05)};
  try{svg.setPointerCapture(ev.pointerId);}catch(e){}
  setHint('<b>Moving '+ppContEscV212(ppDisplayCrateId(id))+'…</b> Drag to the desired location and release. The crate will snap to the nearest valid free position. Press Esc to cancel.');
  ev.preventDefault();
 },true);
 host.addEventListener('pointermove',ev=>{
  if(!drag)return;
  const pt=getPoint(drag.svg,ev),dx=pt.x-drag.startPoint.x,dy=pt.y-drag.startPoint.y;
  if(Math.abs(ev.clientX-drag.startClientX)+Math.abs(ev.clientY-drag.startClientY)>4)drag.moved=true;
  if(drag.moved){drag.g.setAttribute('transform',`translate(${dx} ${dy})`);drag.g.style.opacity='.82';drag.g.style.filter='drop-shadow(0 4px 5px rgba(0,0,0,.22))';setHint('<b>Drop to place.</b> The preview follows your pointer; it will snap to the nearest valid gap and will not overlap another crate.');}
 },true);
 const finish=(ev,cancel=false)=>{
  if(!drag)return;const d=drag;drag=null;
  try{d.g.removeAttribute('transform');d.g.style.opacity='';d.g.style.filter='';}catch(e){}
  if(cancel){ppContSelectedId=d.id;ppContSyncSelected();ppSmartRenderContainer();setHint('Drag cancelled. Select a crate and drag it to move, or use <b>Auto Arrange</b>.');return;}
  if(!d.moved){ppContPickById(encodeURIComponent(d.id));setHint('<b>Drag &amp; drop:</b> grab any floor crate in Top View, move it, and release. Use Auto Arrange to pack all crates into a compact layout.');return;}
  ignoreClickUntil=Date.now()+450;
  const svg=d.svg,pt=getPoint(svg,ev),dx=(pt.x-d.startPoint.x)/d.scale,dy=(pt.y-d.startPoint.y)/d.scale;
  ppContSelectedId=d.id;ppContSyncSelected();
  const ok=ppContMoveSelectedNearV212(Math.round(d.startX+dx),Math.round(d.startY+dy));
  setHint(ok?'<b>Move complete.</b> Crate snapped to a valid position. Continue dragging other crates, or use <b>Auto Arrange</b>.':'<b>Move not applied.</b> There is no valid free position near that location. Try another spot or use <b>Auto Arrange</b>.');
 };
 host.addEventListener('pointerup',ev=>finish(ev,false),true);
 host.addEventListener('pointercancel',ev=>finish(ev,true),true);
 host.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&drag){ev.preventDefault();finish(ev,true);}},true);
 host.addEventListener('click',ev=>{if(Date.now()<ignoreClickUntil){ev.preventDefault();ev.stopImmediatePropagation();}},true);
};

/* Friendly controls and clear instructions for first-time users. */
(function ppV215FriendlyArrangement(){
 const st=document.createElement('style');st.id='pp-v215-drag-style';st.textContent=`
 #ppV215Guide{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:10px 0 12px;padding:12px 14px;border:1px solid #a8e6d7;border-radius:12px;background:linear-gradient(110deg,#effcf8,#f4f9ff);color:#164e63;font-size:13px;line-height:1.55}
 #ppV215Guide .guide-title{font-weight:800;color:#075b63;display:flex;align-items:center;gap:7px}
 #ppV215Guide .guide-step{display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border-radius:999px;background:#fff;border:1px solid #d2e4ec;font-weight:700}
 #ppV215Guide .guide-note{flex:1 1 260px;color:#4b6576}
 #ppContainerVisual svg g[data-draggable-crate]{cursor:grab!important;touch-action:none;transition:filter .12s ease}
 #ppContainerVisual svg g[data-draggable-crate]:hover{filter:drop-shadow(0 2px 3px rgba(7,91,99,.25))}
 #ppContainerVisual svg g[data-draggable-crate]:active{cursor:grabbing!important}
 `;document.head.appendChild(st);
 const install=()=>{
  const visual=document.getElementById('ppContainerVisual');if(visual&&!document.getElementById('ppV215Guide')){
   const guide=document.createElement('div');guide.id='ppV215Guide';guide.innerHTML='<span class="guide-title"><i class="fa-solid fa-hand-pointer"></i> Easy Container Arrangement</span><span class="guide-step">1. Click and hold a crate</span><i class="fa-solid fa-arrow-right" aria-hidden="true"></i><span class="guide-step">2. Drag it to the new spot</span><i class="fa-solid fa-arrow-right" aria-hidden="true"></i><span class="guide-step">3. Release to snap in place</span><span class="guide-note">Use <b>Top View</b> for moving floor crates. <b>Auto Arrange</b> packs crates compactly; Undo Layout restores the previous arrangement.</span>';
   visual.parentNode.insertBefore(guide,visual);
  }
  const quick=document.getElementById('ppV212QuickViews');if(quick){const span=quick.querySelector('span');if(span)span.textContent='Easy mode: in Top View, click and hold a floor crate, drag it, then release. It snaps to the nearest valid free space. Use Auto Arrange for a compact layout.';}
  const hint=document.querySelector('.pp-container-selected .pp-location-hint');if(hint)hint.innerHTML='<i class="fa-solid fa-circle-info"></i> <b>Easy move:</b> choose <b>Top View</b>, then click and hold a floor crate, drag it to the desired place, and release. It snaps to a valid gap automatically. To pack all crates, use <b>Auto Arrange · Validate &amp; Save</b>. Use the supporting-crate controls for stacking.';
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();


/* AIS Tracker V2.17 — 865 mm leg positions + tier-by-tier container viewing.
   Additive UI/rendering changes only. Existing crate records, Supabase tables and IDs are preserved. */
function ppLegPositions865(lengthMm, woodAllowanceMm=20){
  const L=Math.max(0,Number(lengthMm)||0), inset=Math.max(0,Number(woodAllowanceMm)||0), spacing=865;
  if(L<=inset) return [Math.max(0,L/2)];
  const out=[];
  for(let x=inset; x<L && out.length<3; x+=spacing) out.push(x);
  if(out.length===1 && L>spacing+inset) out.push(inset+spacing);
  return out;
}
const ppV217OriginalDrawCrate2D=ppNewDrawCrate2D;
ppNewDrawCrate2D=function(c,metric,view){
  let out=ppV217OriginalDrawCrate2D.apply(this,arguments);
  if(view!=='side') return out;
  const length=Math.max(1,Number(metric?.length)||Number(c?.outerL)||1);
  const positions=ppLegPositions865(length,20);
  // Current side elevation uses a 366 px body inside a 460 px SVG viewBox.
  const x=47,w=366,baseY=156,legPx=14,legW=18,scale=w/length;
  const legs=positions.map(mm=>{
    const px=x+Math.max(0,Math.min(w-legW,mm*scale-legW/2));
    return `<rect x="${px.toFixed(2)}" y="${baseY}" width="${legW}" height="${legPx}" fill="#a87842" stroke="#81562f"/>`;
  }).join('');
  // Replace the legacy fixed three-leg row; all crate dimensions and packing drawings stay as before.
  out=out.replace(/(?:<rect x="[^\"]+" y="156" width="18" height="14" fill="#a87842" stroke="#81562f"\/>){1,3}/,legs);
  out=out.replace('Side elevation · crate length '+Math.round(length)+' mm','Side elevation · crate length '+Math.round(length)+' mm · legs every 865 mm');
  out=out.replace('Side 2D shows long box lengths aligned along the crate length; each layer is stacked vertically.','Side 2D shows long box lengths aligned along the crate length; timber legs start at the end timber allowance and repeat every 865 mm (maximum 3 shown). Each layer is stacked vertically.');
  return out;
};

// Leg alignment is checked before placing a crate on a supporting crate.
function ppV217LegsAlign(upper,base){
  const upD=ppContDims(upper),baseD=ppContDims(base),upP=ppContLayout(upper),baseP=ppContLayout(base);
  const upperLen=upP.rot?upD.W:upD.L, baseLen=baseP.rot?baseD.W:baseD.L;
  const upLegs=ppLegPositions865(upperLen,20),baseLegs=ppLegPositions865(baseLen,20);
  // Length axes must be aligned and each upper leg must sit over a corresponding lower support leg.
  const sameAxis=!!upP.rot===!!baseP.rot;
  if(!sameAxis) return {ok:false,reason:'Leg alignment requires the upper and supporting crate length directions to match. Rotate one crate so the leg rows align.'};
  const offset=Math.abs((Number(upP.x)||0)-(Number(baseP.x)||0));
  if(offset>30) return {ok:false,reason:'Move the upper crate so its leg row aligns with the supporting crate.'};
  const unmatched=upLegs.filter(a=>!baseLegs.some(b=>Math.abs(a-b)<=60));
  if(unmatched.length) return {ok:false,reason:'The upper crate legs do not align with the supporting crate leg positions (865 mm spacing). Adjust the crate length/rotation or choose a better supporting crate.'};
  return {ok:true};
}
const ppV217BaseStack=ppContStackOnSelected;
ppContStackOnSelected=function(){
  const c=ppContGetSelected(),id=document.getElementById('ppContStackOn')?.value;
  if(c&&id){const base=ppSmartCrates.find(q=>q.id===id);if(base&&base!==c){const check=ppV217LegsAlign(c,base);if(!check.ok){if(typeof showToast==='function')showToast(check.reason,'warning');else alert(check.reason);return;}}}
  return ppV217BaseStack.apply(this,arguments);
};

// Separate visual filters for Floor / Tier 2 / Tier 3. Filtering is visual-only; no data is changed.
const ppV217BaseContainerRender=ppSmartRenderContainer;
ppSmartRenderContainer=function(){
  const result=ppV217BaseContainerRender.apply(this,arguments);
  try{
    const host=document.getElementById('ppContainerVisual'),filter=document.getElementById('ppContTierView');
    if(!host||!filter||filter.value==='all') return result;
    const target=Number(filter.value);
    host.querySelectorAll('g[onclick*="ppContPickById"]').forEach(g=>{
      const match=(g.getAttribute('onclick')||'').match(/ppContPickById\('([^']+)'\)/);
      if(!match)return;
      const id=decodeURIComponent(match[1]);
      const c=ppSmartCrates.find(q=>q.id===id);
      g.style.display=(c&&ppContLayout(c).placed&&Number(ppContLayout(c).z)===target)?'':'none';
    });
    const labels=['Floor only','Tier 2 only','Tier 3 only'];
    let note=document.getElementById('ppV217TierNote');
    if(!note){note=document.createElement('div');note.id='ppV217TierNote';note.className='pp-note';host.insertAdjacentElement('afterend',note);}
    const count=ppSmartCrates.filter(c=>ppContLayout(c).placed&&Number(ppContLayout(c).z)===target).length;
    note.innerHTML='<b>'+labels[target]+'</b> · '+count+' crate(s) at this level. Saved positions and other tiers are unchanged.';
  }catch(e){console.warn('Tier view filter:',e);}
  return result;
};


/* AIS Tracker V2.18 — practical crate leg positions, width zones and loading instructions.
   Additive rendering/reporting only; no database schema changes or record migration. */
ppLegPositions865=function(lengthMm, woodAllowanceMm=20){
 const L=Math.max(0,Number(lengthMm)||0),inset=Math.min(Math.max(0,Number(woodAllowanceMm)||0),L/2),spacing=865;
 if(L<=0)return [0];
 // Short crates need a support at both ends even when 865 mm spacing is impossible.
 if(L<=spacing+2*inset) return L-2*inset>=80?[inset,L-inset]:[L/2];
 const out=[inset];
 for(let x=inset+spacing;x<L-inset && out.length<3;x+=spacing) out.push(x);
 // If the crate is long enough for a third regular support, include it; otherwise retain two.
 if(out.length===1 && L-inset-inset>=spacing) out.push(L-inset);
 return out;
};
function ppV218ZoneFor(c){
 const W=Math.max(1,ppNum(document.getElementById('ppContWid')?.value)||2352),p=ppContLayout(c),d=ppContDims(c),center=(ppNum(p.y)+(ppNum(d.W)/2));
 return center<W/3?'A':center<(2*W/3)?'B':'C';
}
function ppV218SupportChain(c){
 const out=[],seen=new Set();let cur=c;
 while(cur&&ppContLayout(cur).baseId&&!seen.has(cur.id)){
  seen.add(cur.id);const id=ppContLayout(cur).baseId,base=ppSmartCrates.find(q=>q.id===id);if(!base)break;out.push(ppDisplayCrateId(base.id));cur=base;
 }
 return out;
}
function ppV218Location(c){
 const p=ppContLayout(c),zone=ppV218ZoneFor(c),tier=Math.max(1,Math.floor(ppNum(p.z))+1),support=p.baseId?ppDisplayCrateId(p.baseId):'';
 return {zone,tier,support,label:`Zone ${zone} · ${tier===1?'Floor':'Tier '+tier}`+(support?` · on ${support}`:'')};
}
// Override the stacking guard so a short crate's end legs can sit on end supports.
ppV217LegsAlign=function(upper,base){
 const upP=ppContLayout(upper),baseP=ppContLayout(base),upD=ppContDims(upper),baseD=ppContDims(base);
 if(!!upP.rot!==!!baseP.rot)return {ok:false,reason:'Leg alignment requires the upper and supporting crate length directions to match. Rotate one crate so the leg rows align.'};
 if(Math.abs((Number(upP.x)||0)-(Number(baseP.x)||0))>30)return {ok:false,reason:'Move the upper crate so its leg row aligns with the supporting crate.'};
 const ul=upP.rot?upD.W:upD.L,bl=baseP.rot?baseD.W:baseD.L,upLegs=ppLegPositions865(ul,20),baseLegs=ppLegPositions865(bl,20);
 const unmatched=upLegs.filter(a=>!baseLegs.some(b=>Math.abs(a-b)<=60));
 if(unmatched.length)return {ok:false,reason:'The upper crate legs do not align with the supporting crate legs. Align both ends/support rows before stacking.'};
 return {ok:true};
};
// Add location and support relationship to the live table after the existing renderer updates it.
const ppV218BaseRenderContainer=ppSmartRenderContainer;
ppSmartRenderContainer=function(){
 const result=ppV218BaseRenderContainer.apply(this,arguments);
 try{
  const table=document.querySelector('#packingPlannerTab .pp-container-table');
  if(table){const head=table.querySelector('thead tr');if(head&&!head.querySelector('[data-v218-location]')){const th=document.createElement('th');th.dataset.v218Location='1';th.textContent='Container location';head.insertBefore(th,head.children[9]||null);const sh=document.createElement('th');sh.dataset.v218Support='1';sh.textContent='Supported by';head.insertBefore(sh,head.children[10]||null);const eh=document.createElement('th');eh.dataset.v218Elevation='1';eh.textContent='Elevation Z (mm)';head.insertBefore(eh,head.children[10]||null);}
   const body=document.getElementById('ppContainerPlacedBody');if(body){body.innerHTML=ppSmartCrates.map(c=>{const p=ppContLayout(c),d=ppContDims(c),loc=ppV218Location(c);return `<tr><td>${ppEsc(ppDisplayCrateId(c.id))}</td><td>${ppEsc([...new Set((c.items||[]).map(it=>it.profile))].join(' / '))}</td><td>${ppContPcs(c).toLocaleString()}</td><td>${ppContCargoWeight(c).toFixed(1)}</td><td>${d.W}</td><td>${d.L}</td><td>${d.H}</td><td>${p.x}</td><td>${p.y}</td><td><b>${loc.zone}</b> · ${loc.tier===1?'Floor':'Tier '+loc.tier}</td><td>${loc.support?ppEsc(loc.support):'—'}</td><td>${Math.round(ppNum(p.zMm))}</td><td>${p.z+1}</td><td>${p.rot?'90°':'Original'}</td><td>${p.placed?'<b style="color:#047857">Placed</b>':'<span style="color:#b45309">Not placed</span>'}</td></tr>`;}).join('')||'<tr><td colspan="15">No crates available.</td></tr>';}
  }
  const meta=document.getElementById('ppContSelectedMeta'),c=ppContGetSelected();if(meta&&c){const loc=ppV218Location(c);const oldExtra=meta.querySelector('[data-v218-extra]');if(oldExtra)oldExtra.remove();const div=document.createElement('div');div.dataset.v218Extra='1';div.innerHTML=`<br><b>Practical loading location:</b> Zone ${loc.zone} · ${loc.tier===1?'Floor':'Tier '+loc.tier}${loc.support?` · stacked on ${ppEsc(loc.support)}`:''}<br><b>Position guide:</b> X ${Math.round(ppNum(ppContLayout(c).x))} mm from container end; Y ${Math.round(ppNum(ppContLayout(c).y))} mm from side wall.`;meta.appendChild(div);}
 }catch(e){console.warn('V2.18 location details:',e);}
 return result;
};
// Add A/B/C width zones to every exported and on-screen top-view schematic.
const ppV218BaseBuildView=ppContBuildViewSvgV212;
ppContBuildViewSvgV212=function(view){
 let svg=ppV218BaseBuildView.apply(this,arguments);
 if(view!=='top')return svg;
 const L=Math.max(1,ppNum(document.getElementById('ppContLen')?.value)||12032),W=Math.max(1,ppNum(document.getElementById('ppContWid')?.value)||2352),VW=1100,VH=600,pad=44,scale=Math.min((VW-2*pad)/L,(VH-2*pad)/W),cw=L*scale,ch=W*scale,ox=(VW-cw)/2,oy=(VH-ch)/2;
 let overlay='';for(let i=1;i<=2;i++){const yy=oy+ch*i/3;overlay+=`<line x1="${ox}" y1="${yy}" x2="${ox+cw}" y2="${yy}" stroke="#0f766e" stroke-width="2" stroke-dasharray="8 5" opacity=".85"/>`;}
 ['A','B','C'].forEach((z,i)=>{const yy=oy+ch*(i+.5)/3;overlay+=`<rect x="${ox+4}" y="${yy-13}" width="28" height="26" rx="5" fill="#ffffff" stroke="#0f766e"/><text x="${ox+18}" y="${yy+5}" text-anchor="middle" font-size="16" font-weight="900" fill="#0f766e">${z}</text>`;});
 return svg.replace('</svg>',overlay+'</svg>');
};
// Detailed CSV/PDF report: add A/B/C zone, tier, and exact support-chain columns.
const ppV218OriginalExport=ppContExport;
ppContExport=async function(kind){
 const placed=ppSmartCrates.filter(c=>ppContLayout(c).placed),headers=['Crate No','Profiles','PCS','Cargo weight incl. tare kg','Width mm','Length mm','Height mm','X from container end mm','Y from side wall mm','Width zone A/B/C','Level','Supported by crate','Support chain','Elevation Z mm','Rotation'];
 const rows=placed.map(c=>{const p=ppContLayout(c),d=ppContDims(c),loc=ppV218Location(c),chain=ppV218SupportChain(c);return [ppDisplayCrateId(c.id),[...new Set((c.items||[]).map(it=>it.profile))].join(' / '),ppContPcs(c),ppContCargoWeight(c).toFixed(1),d.W,d.L,d.H,Math.round(ppNum(p.x)),Math.round(ppNum(p.y)),loc.zone,loc.tier===1?'Floor':`Tier ${loc.tier}`,loc.support||'—',chain.length?chain.join(' ← '):'Floor / no support',Math.round(ppNum(p.zMm)),p.rot?'90°':'Original'];});
 if(kind==='excel'||kind==='csv'){
  const csv=[headers,...rows].map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n'),blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='AIS_Container_Loading_Details.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);return;
 }
 if(kind==='print'){ppContOpenColourPrintV212(headers,rows);return;}
 if(kind!=='pdf')return ppV218OriginalExport.apply(this,arguments);
 if(!window.jspdf?.jsPDF||typeof window.html2canvas!=='function'){if(typeof showToast==='function')showToast('PDF engine unavailable. Opening the colour print report instead.','warning');ppContOpenColourPrintV212(headers,rows);return;}
 const doc=new window.jspdf.jsPDF({orientation:'landscape',unit:'mm',format:'a4'}),views=[['top','TOP VIEW — WIDTH ZONES A / B / C'],['left','LEFT SIDE VIEW'],['right','RIGHT SIDE VIEW'],['front','FRONT VIEW'],['back','BACK VIEW']],totalPcs=placed.reduce((s,c)=>s+ppContPcs(c),0),weight=placed.reduce((s,c)=>s+ppContCargoWeight(c),0),L=ppNum(document.getElementById('ppContLen')?.value)||12032,W=ppNum(document.getElementById('ppContWid')?.value)||2352,H=ppNum(document.getElementById('ppContHei')?.value)||2393;
 for(let i=0;i<views.length;i++){const [view,label]=views[i],stage=document.createElement('div');stage.style.cssText='position:fixed;left:-20000px;top:0;width:1240px;box-sizing:border-box;padding:28px;background:#fff;color:#12364d;font-family:Arial,sans-serif;';stage.innerHTML=`<h1 style="font-size:28px;margin:0 0 8px;color:#075b63">ALUMEX AIS TRACKER — CONTAINER LOADING PLAN</h1><h2 style="font-size:21px;margin:0 0 10px">${label}</h2><p>Container ${ppContEscV212(document.getElementById('ppSmartContainerType')?.selectedOptions?.[0]?.textContent||'40 ft Standard')} · Internal dimensions ${L} × ${W} × ${H} mm · ${placed.length}/${ppSmartCrates.length} crates · ${totalPcs.toLocaleString()} PCS · ${weight.toFixed(1)} kg estimated cargo weight</p><div style="border:1px solid #cbdde6;padding:10px;background:#f7fbfd">${ppContBuildViewSvgV212(view)}</div><p style="font-size:13px;color:#52677b">A/B/C divide the container width into three practical location bands. For each crate, use the matching zone, X/Y dimensions and level on the detail sheet. Stacked crates identify their direct supporting crate. Confirm actual dimensions, payload, restraint and timber strength before loading.</p>`;document.body.appendChild(stage);try{const canvas=await window.html2canvas(stage,{scale:1.5,backgroundColor:'#fff',logging:false,useCORS:true});if(i)doc.addPage('a4','landscape');const data=canvas.toDataURL('image/png'),ratio=canvas.height/canvas.width,iw=281,ih=Math.min(185,iw*ratio);doc.addImage(data,'PNG',8,8,iw,ih,'','FAST');}finally{stage.remove();}}
 doc.addPage('a4','landscape');doc.setFont('helvetica','bold');doc.setFontSize(16);doc.setTextColor(7,91,99);doc.text('CRATE LOADING INSTRUCTIONS & POSITIONS',9,12);doc.setFont('helvetica','normal');doc.setFontSize(7);
 if(typeof doc.autoTable==='function')doc.autoTable({head:[headers],body:rows,startY:17,theme:'grid',styles:{font:'helvetica',fontSize:6.4,cellPadding:1.6,overflow:'linebreak'},headStyles:{fillColor:[7,91,99],textColor:[255,255,255]},alternateRowStyles:{fillColor:[239,246,249]},margin:{left:6,right:6,bottom:8},didDrawPage:()=>{doc.setFontSize(7);doc.setTextColor(80,100,115);doc.text('Loading sequence: Floor crates first → confirm Zone A/B/C and X/Y → place Tier 2/3 only on the listed supporting crate.',7,202);}});
 else {let y=20;rows.forEach(r=>{doc.text(r.map(v=>String(v)).join(' | ').slice(0,220),8,y);y+=6;if(y>195){doc.addPage('a4','landscape');y=15;}});}
 doc.save('AIS_Container_Loading_Instructions_Zones_ABC.pdf');if(typeof showToast==='function')showToast('Colour PDF downloaded with container views, A/B/C width zones, exact crate locations and supporting-crate details.','success');
};
// Make the print fallback use the enhanced loading instructions too.
const ppV218BasePrint=ppContOpenColourPrintV212;
ppContOpenColourPrintV212=function(headers,rows){
 const placed=ppSmartCrates.filter(c=>ppContLayout(c).placed),extraHeaders=['Width zone A/B/C','Level','Supported by crate','Support chain'];
 if(!headers.includes('Width zone A/B/C')){headers=[...headers,...extraHeaders];rows=placed.map((c,i)=>{const p=ppContLayout(c),loc=ppV218Location(c),chain=ppV218SupportChain(c);return [...(rows[i]||[]),loc.zone,loc.tier===1?'Floor':`Tier ${loc.tier}`,loc.support||'—',chain.length?chain.join(' ← '):'Floor / no support'];});}
 return ppV218BasePrint(headers,rows);
};


/* AIS Tracker V2.19 final side-view visibility correction:
   near-side crates are painted last, masking crates behind them exactly as a real side elevation. */
const ppFinalSideVisibilityBaseRender = ppSmartRenderContainer;
ppSmartRenderContainer = function(){
  const result = ppFinalSideVisibilityBaseRender.apply(this, arguments);
  try {
    const svg = document.querySelector('#ppContainerVisual svg[data-layout-view]');
    const view = svg?.getAttribute('data-layout-view');
    if (svg && (view === 'left' || view === 'right')) {
      const groups = [...svg.querySelectorAll('g[onclick*="ppContPickById"]')];
      const getCrate = g => {
        const m = (g.getAttribute('onclick') || '').match(/ppContPickById\('([^']+)'\)/);
        if (!m) return null;
        try { return ppSmartCrates.find(c => c.id === decodeURIComponent(m[1])) || null; } catch(e) { return null; }
      };
      groups.sort((ga,gb) => {
        const a=getCrate(ga), b=getCrate(gb);
        const ay=ppNum(ppContLayout(a||{}).y), by=ppNum(ppContLayout(b||{}).y);
        return view === 'left' ? by-ay : ay-by;
      });
      const anchor = svg.querySelector('text');
      groups.forEach(g => svg.insertBefore(g, anchor || null));
    }
  } catch(e) { console.warn('Side view visibility correction skipped:', e); }
  return result;
};


/* AIS Tracker safe UX patch: Enter-to-save + duplicate-submit guard.
   Additive only: no database schema, records, or existing data are changed. */
(function aisEnterAndDuplicateGuard(){
  const formActions = [
    ['rejectEntryForm', 'saveRejectEntry'],
    ['rejectRecoverForm', 'saveRecoverEntry'],
    ['recoverWrapForm', 'saveRecoverWrapEntry'],
    ['dailyEntryForm', 'submitDailyEntry'],
    ['poEntryForm', 'saveNewPO'],
    ['packingListForm', 'savePackingListEntry'],
    ['cardboardEntryForm', 'processCardboardTransaction'],
    ['shipmentEntryForm', 'saveShipmentEntry'],
    ['cardboardManualForm', 'saveCardboardManualData']
  ];
  const lastSubmissions = new Map();
  const inFlight = new Set();

  function formSignature(form, fnName, args) {
    const values = Array.from(form.elements || [])
      .filter(el => el.name || el.id)
      .map(el => [el.name || el.id, el.type === 'checkbox' || el.type === 'radio' ? !!el.checked : String(el.value ?? '')]);
    const safeArgs = (args || []).map(arg => {
      if (arg && typeof arg === 'object') return { eventType: arg.type || '', eventTarget: arg.target && (arg.target.id || arg.target.tagName) || '' };
      return arg;
    });
    return fnName + '|' + JSON.stringify(safeArgs) + '|' + JSON.stringify(values);
  }

  function installGuard(formId, fnName) {
    const form = document.getElementById(formId);
    const original = window[fnName];
    if (!form || typeof original !== 'function' || original.__aisDuplicateGuarded) return;

    const guarded = function(...args) {
      const sig = formSignature(form, fnName, args);
      const now = Date.now();
      const previous = lastSubmissions.get(fnName);
      if (inFlight.has(fnName)) {
        if (typeof window.showToast === 'function') window.showToast('Save is already in progress. Please wait. / දත්ත සුරැකෙමින් පවතී. කරුණාකර රැඳී සිටින්න.', 'info');
        return;
      }
      if (previous && previous.signature === sig && now - previous.time < 5000) {
        if (typeof window.showToast === 'function') window.showToast('Same data was just submitted. Duplicate save prevented. / එකම දත්ත නැවත save කිරීම වැළැක්වුවා.', 'warning');
        return;
      }
      inFlight.add(fnName);
      const started = Date.now();
      try {
        const result = original.apply(this, args);
        if (result && typeof result.then === 'function') {
          return result.then(value => {
            lastSubmissions.set(fnName, { signature: sig, time: Date.now() });
            return value;
          }).catch(err => {
            throw err;
          }).finally(() => { inFlight.delete(fnName); });
        }
        lastSubmissions.set(fnName, { signature: sig, time: Date.now() });
        inFlight.delete(fnName);
        return result;
      } catch (err) {
        inFlight.delete(fnName);
        throw err;
      }
    };
    guarded.__aisDuplicateGuarded = true;
    window[fnName] = guarded;
  }

  function installEnterHandler(formId, fnName) {
    const form = document.getElementById(formId);
    if (!form || form.dataset.aisEnterSaveBound === '1') return;
    form.dataset.aisEnterSaveBound = '1';
    form.addEventListener('keydown', function(ev) {
      if (ev.key !== 'Enter' || ev.isComposing || ev.shiftKey || ev.ctrlKey || ev.altKey || ev.metaKey) return;
      const target = ev.target;
      if (!target || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (target.tagName === 'BUTTON') return;
      // Avoid hijacking Enter in multiline/editable areas; otherwise use the form's primary save action.
      ev.preventDefault();
      const buttons = Array.from(form.querySelectorAll('button'));
      let button = null;
      if (formId === 'packingListForm') {
        // Enter adds the selected profile to the current crate; the second action remains available explicitly.
        button = buttons.find(b => (b.getAttribute('onclick') || '').includes('savePackingListEntry(false)'));
      } else if (formId === 'cardboardManualForm') {
        button = form.querySelector('button[type="submit"]');
      } else {
        button = buttons.find(b => !b.disabled && /save|process|submit|shipment|movement|recovery|deduct stock/i.test((b.innerText || b.textContent || '') + ' ' + (b.getAttribute('onclick') || '')));
      }
      if (button && !button.disabled) button.click();
      else if (typeof window[fnName] === 'function') window[fnName]();
    });
  }

  function init() {
    formActions.forEach(([formId, fnName]) => {
      installGuard(formId, fnName);
      installEnterHandler(formId, fnName);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

/* AIS Crate Planner reliability patch (2026-10-22)
   Keep the crate builder selectors in sync with Next PL quantity selections.
   UI-only refresh; no database schema or saved records are modified. */
(function aisCratePlannerSyncPatch(){
  if (window.__aisCratePlannerSyncPatchInstalled) return;
  window.__aisCratePlannerSyncPatchInstalled = true;

  function ensureStatusNode(){
    const panel = document.querySelector('#ppMultiPoCrateBuilder .pp-new-panel');
    if (!panel) return null;
    let node = document.getElementById('ppNewSourceStatus');
    if (!node) {
      node = document.createElement('div');
      node.id = 'ppNewSourceStatus';
      node.className = 'pp-new-hint';
      node.style.margin = '8px 0';
      const table = panel.querySelector('.pp-new-po-table-wrap');
      if (table) panel.insertBefore(node, table);
      else panel.appendChild(node);
    }
    return node;
  }

  function updateSourceStatus(){
    const node = ensureStatusNode();
    if (!node) return;
    const selected = Array.isArray(ppCrateNextRows) ? ppCrateNextRows : [];
    let candidates = [];
    try {
      candidates = typeof nextPlGetRows === 'function'
        ? nextPlGetRows().filter(r => Number(r.pendingQty || 0) > 0 && !r.excluded)
        : [];
    } catch (e) { candidates = []; }
    if (selected.length) {
      node.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${selected.length} selected Next PL PO line(s) loaded. Choose Profile, Item Code and Length to allocate PCS.`;
      node.style.borderColor = '#86efac';
      node.style.background = '#f0fdf4';
      return;
    }
    const go = `<button type="button" class="btn btn-sm" style="margin-left:8px" onclick="switchTab('nextPlPlanningTab',null)">Open Next PL Planning</button>`;
    if (candidates.length) {
      node.innerHTML = `<i class="fa-solid fa-circle-info"></i> No PCS quantities are selected in Next PL yet. ${candidates.length} eligible PO line(s) are available. Open Next PL Planning, enter/select the PCS quantities, then return here. ${go}`;
    } else {
      node.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> No eligible pending PO lines were found. Check Production Orders, Master Catalog matching, shipment balance and Next PL selections. ${go}`;
    }
    node.style.borderColor = '#fbbf24';
    node.style.background = '#fffbeb';
  }

  const originalProfileRefresh = window.ppNewRefreshProfileOptions || (typeof ppNewRefreshProfileOptions === 'function' ? ppNewRefreshProfileOptions : null);
  if (originalProfileRefresh) {
    const wrappedProfileRefresh = function(...args){
      const result = originalProfileRefresh.apply(this, args);
      try { updateSourceStatus(); } catch (e) { console.warn('Crate planner status update:', e); }
      return result;
    };
    wrappedProfileRefresh.__aisSourceStatusWrapped = true;
    window.ppNewRefreshProfileOptions = wrappedProfileRefresh;
    ppNewRefreshProfileOptions = wrappedProfileRefresh;
  }

  function refreshCratePlanner(){
    try {
      if (typeof ppRefreshNextPlLines === 'function') ppRefreshNextPlLines();
      else if (typeof ppNewRefreshProfileOptions === 'function') ppNewRefreshProfileOptions();
      if (typeof ppNewRefreshCrateOptions === 'function') ppNewRefreshCrateOptions();
      if (typeof ppNewUpdateCreateDimensions === 'function') ppNewUpdateCreateDimensions();
      updateSourceStatus();
    } catch (e) { console.warn('Crate planner refresh after Next PL change:', e); }
  }

  // Next PL quantities are changed in-place; explicitly refresh the dependent crate selectors.
  ['nextPlSetQty','nextPlToggleExclude','nextPlClearSelection','nextPlAddManual','nextPlQuickAdd','nextPlAutoBuild'].forEach(name => {
    const original = window[name];
    if (typeof original !== 'function' || original.__aisCrateRefreshWrapped) return;
    const wrapped = function(...args){
      const result = original.apply(this, args);
      setTimeout(refreshCratePlanner, 40);
      if (result && typeof result.then === 'function') result.finally(() => setTimeout(refreshCratePlanner, 80));
      return result;
    };
    wrapped.__aisCrateRefreshWrapped = true;
    window[name] = wrapped;
  });

  // Refresh when returning to Crate Planning 2D, including after asynchronous data loads.
  const originalSwitchTab = window.switchTab;
  if (typeof originalSwitchTab === 'function' && !originalSwitchTab.__aisCrateRefreshWrapped) {
    const wrappedSwitchTab = function(tabId, btn){
      const result = originalSwitchTab.apply(this, arguments);
      if (tabId === 'packingPlannerTab' || tabId === 'nextPlPlanningTab') {
        setTimeout(refreshCratePlanner, 80);
        setTimeout(refreshCratePlanner, 450);
      }
      return result;
    };
    wrappedSwitchTab.__aisCrateRefreshWrapped = true;
    window.switchTab = wrappedSwitchTab;
    switchTab = wrappedSwitchTab;
  }

  // Avoid accidentally creating a new empty crate when no Next PL line is selected.
  const originalCreateCrates = window.ppNewCreateCrates || (typeof ppNewCreateCrates === 'function' ? ppNewCreateCrates : null);
  if (originalCreateCrates && !originalCreateCrates.__aisRequireNextPlLine) {
    const guardedCreateCrates = function(...args){
      const selectedLines = typeof ppNewSelectedLines === 'function' ? ppNewSelectedLines() : [];
      if (!selectedLines.length) {
        alert('Before creating a crate, select a Profile, Item Code and Length from a selected Next Planning PL line. If the list is empty, open Next PL Planning and select PCS quantities first.');
        return;
      }
      return originalCreateCrates.apply(this, args);
    };
    guardedCreateCrates.__aisRequireNextPlLine = true;
    window.ppNewCreateCrates = guardedCreateCrates;
    ppNewCreateCrates = guardedCreateCrates;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { setTimeout(refreshCratePlanner, 120); setTimeout(refreshCratePlanner, 700); }, {once:true});
  } else {
    setTimeout(refreshCratePlanner, 120);
    setTimeout(refreshCratePlanner, 700);
  }
})();
