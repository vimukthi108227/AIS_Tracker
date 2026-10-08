const SUPABASE_URL = "https://rtlizqawcwzduxpnzznd.supabase.co";
const SUPABASE_KEY = "sb_publishable_Eyo0gj7_BjN6FoQ76oJQYw_ZBOGj9BW";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);



let currentUserRole = null; let isAdminUnlocked = false; let isDarkMode = false; let isAppBusy = false;
let masterChartInstance = null, overallPoChartInstance = null, overallPlChartInstance = null, plChartInstance = null, monthlyShiftChartInstance = null, poChartInstances = [], rejectDashChart = null, rejectProfileChartInstance = null;
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
  ['entryDate','shift','selectProfile','selectItemCode','selectLength','shipmentDate','shipmentMonth','shipmentContainer','shipSelectPo','shipSelectProfile','shipSelectItemCode','shipSelectLength'].forEach(rememberFormField);
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
    const data=historyLogs.map(h=>({'Date':h.date,'Time':h.timestamp,'Shift':h.shift,'Profile':h.profile,'Length (mm)':h.length,'Cut Qty':h.cutQty,'Punch Qty':h.punchQty,'Wrap Qty':h.wrapQty,'Box Qty':h.boxQty,'Crate Qty':h.crateQty}));
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
window.exportHistoryExcel = function() { const data = historyLogs.map(h => ({ "Date": h.date, "Time": h.timestamp, "Shift": h.shift, "Profile": h.profile, "Length (mm)": h.length, "Cut Qty": h.cutQty, "Punch Qty": h.punchQty, "Wrap Qty": h.wrapQty, "Box Qty": h.boxQty, "Crate Qty": h.crateQty })); exportTableToExcel(data, "AIS_Production_History", "History"); };
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

    const safeFetchOptional = async (table, options={}) => { try { return await safeFetch(table, options, true); } catch(e) { console.warn(`Optional DB table unavailable: ${table}`, e); return []; } };
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
      const obj = { db_id: item.id, profile: String(item.profile).trim(), itemCode: String(item.item_code || '').trim(), material: item.material || localExt.mat || '-', length: cleanLen(item.length), exLength: item.ex_length || localExt.ex || '', unitWeight: parseFloat(item.unit_weight) || 0, cutQty: item.cut_qty || 0, punchQty: item.punch_qty || 0, wrapQty: item.wrap_qty || 0, boxQty: item.box_qty || 0, crateQty: item.crate_qty || 0, boxCapacity: item.box_capacity || localExt.cap || 100 };
      const uniqueKey = `${obj.profile}_${obj.itemCode}_${obj.length}`;
      if (!seenMap.has(uniqueKey)) { seenMap.set(uniqueKey, obj); uniqueData.push(obj); } 
      else { const ex = seenMap.get(uniqueKey); ex.cutQty += obj.cutQty; ex.punchQty += obj.punchQty; ex.wrapQty += obj.wrapQty; ex.boxQty += obj.boxQty; ex.crateQty += obj.crateQty; if (!ex.itemCode || ex.itemCode === '-' || ex.itemCode === '') ex.itemCode = obj.itemCode; }
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
    packingLists = plData.map(item => ({ id: item.id, plNumber: item.pl_number, poNumber: item.po_number, month: item.shipment_month || 'January', container: item.container || '1st Container', crateNo: item.crate_no || `Crate 1`, profile: item.profile, itemCode: item.item_code || '', length: cleanLen(item.length), boxQty: item.box_qty || 1, pcsQty: item.pcs_qty || 0, netWeight: item.net_weight || 0, grossWeight: item.gross_weight || 0, date: item.packing_date }));
    historyLogs = logData.map(item => ({ id: item.id, date: item.log_date, shift: item.shift, profile: item.profile, length: cleanLen(item.length), cutQty: item.cut_qty || 0, punchQty: item.punch_qty || 0, wrapQty: item.wrap_qty || 0, boxQty: item.box_qty || 0, crateQty: item.crate_qty || 0, timestamp: item.log_time || item.created_at || new Date().toISOString() }));
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
        else { const newRec={target_date:new Date().toISOString().split('T')[0],target_user:'SYS_PL_SHIPMENT_STATE',priority:'Normal',message:jsonStr,status:'Completed',action_taken:'System Data'}; const {error}=await supabaseClient.from('daily_instructions').insert([newRec]); if(error) throw error; dailyInstructionsList.push({...newRec,id:-Date.now()}); }
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
    version: 2,
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
    nextPlSelection={...(state.selection||{})};
    nextPlExcluded={...(state.excluded||{})};
    nextPlManualOverride={...(state.manualOverride||{})};
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
  const pos=[...new Set(rows.map(r=>r.poNumber).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:'base'}));
  const pfs=[]; rows.forEach(r=>{if(r.profile&&!pfs.some(x=>nextPlSameProfile(x,r.profile)))pfs.push(r.profile);});
  pfs.sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:'base'}));
  poSel.innerHTML='<option value="">All POs</option>'+pos.map(x=>`<option value="${nextPlEsc(x)}">${nextPlEsc(x)}</option>`).join('');
  pfSel.innerHTML='<option value="">All Profiles</option>'+pfs.map(x=>`<option value="${nextPlEsc(x)}">${nextPlEsc(x)}</option>`).join('');
  if(pos.includes(poCur))poSel.value=poCur; if(pfs.some(x=>nextPlSameProfile(x,pfCur)))pfSel.value=pfs.find(x=>nextPlSameProfile(x,pfCur))||'';
  if(lfSel){ const ls=[...new Set(rows.map(r=>cleanLen(r.length)).filter(Boolean))].sort((a,b)=>Number(a)-Number(b)); lfSel.innerHTML='<option value="">All Lengths</option>'+ls.map(x=>`<option value="${nextPlEsc(x)}">${nextPlEsc(x)} mm</option>`).join(''); if(ls.includes(cleanLen(lfCur)))lfSel.value=cleanLen(lfCur); }
}
function nextPlSetQty(rowKey,value){
  const row=nextPlGetRows().find(r=>r.rowKey===String(rowKey)); if(!row)return;
  let qty=Math.max(0,Math.floor(nextPlNum(value)));
  const cap=row.pendingQty;
  if(qty>cap){qty=cap;showToast(`Selected Qty cannot exceed ${cap.toLocaleString()} Pcs for this PO line.`,'warning');}
  nextPlSelection[String(rowKey)]=qty; nextPlExcluded[String(rowKey)]=false; nextPlSchedulePersist(); renderNextPlPlanning();
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
      <td><input class="next-pl-quick-qty" id="nextPlQuickQty_${uid}" type="number" min="0" max="${g.balancePcs}" step="1" placeholder="Pcs" value="${hasSelected?g.selectedPcs:''}" oninput="nextPlQuickPreview(this, ${JSON.stringify(g.po)}, ${JSON.stringify(g.rows.map(r=>({rowKey:r.rowKey,pendingQty:r.pendingQty,unitWeight:r.unitWeight})))})"></td>
      <td><span class="next-pl-quick-weight" data-po="${nextPlEsc(g.po)}">${g.selectedWeight.toFixed(2)} kg</span><button type="button" class="btn btn-accent next-pl-quick-add" onclick="nextPlQuickAdd(${JSON.stringify(g.po)}, ${JSON.stringify(g.rows.map(r=>({rowKey:r.rowKey,pendingQty:r.pendingQty,unitWeight:r.unitWeight})))}, this)"><i class="fa-solid fa-${hasSelected?'rotate':'plus'}"></i> ${hasSelected?'Update':'Add'}</button></td>
    </tr>`;
  }).join('');
  const quickBalancePcs=gs.reduce((sum,g)=>sum+g.balancePcs,0), quickBalanceWt=gs.reduce((sum,g)=>sum+g.balanceWeight,0), quickSelectedPcs=gs.reduce((sum,g)=>sum+g.selectedPcs,0), quickSelectedWt=gs.reduce((sum,g)=>sum+g.selectedWeight,0), quickRemainingPcs=Math.max(0,quickBalancePcs-quickSelectedPcs), quickRemainingWt=Math.max(0,quickBalanceWt-quickSelectedWt);
  const quickFoot=document.getElementById('nextPlQuickPoFoot');
  if(quickFoot)quickFoot.innerHTML=`<tr class="next-pl-total-row"><td colspan="3">TOTAL — SELECTED PROFILE / LENGTH</td><td>${quickBalancePcs.toLocaleString()} Pcs</td><td>${quickBalanceWt.toFixed(2)} kg</td><td>${quickSelectedPcs.toLocaleString()} Pcs</td><td>${quickRemainingPcs.toLocaleString()} Pcs</td><td>${quickRemainingWt.toFixed(2)} kg</td><td>${quickSelectedPcs.toLocaleString()} Pcs</td><td>${quickSelectedWt.toFixed(2)} kg</td></tr>`;
  if(note)note.innerHTML='<i class="fa-solid fa-circle-check"></i> <b>'+nextPlEsc(pf.value)+' / '+nextPlEsc(ls.value)+' mm</b> selected. Only POs with shipment balance &gt; 0 are shown. <b>Already planned Pcs, remaining balance and weight update automatically.</b> Enter the final Send Pcs and click Add/Update — the same PO will never be added twice.';
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
function nextPlShipmentBalanceFor(poNumber,profile){
  const rows=nextPlGetRows().filter(r=>r.poNumber===String(poNumber||'') && nextPlSameProfile(r.profile,profile));
  const order=rows.reduce((s,r)=>s+r.orderQty,0);
  const shipped=rows.reduce((s,r)=>s+r.shippedQty,0);
  const currentPL=rows.reduce((s,r)=>s+r.currentPlQty,0);
  const remaining=Math.max(0,order-shipped);
  const afterPL=Math.max(0,remaining-currentPL);
  const wtAfterPL=rows.reduce((s,r)=>s+Math.max(0,r.pendingQty)*Math.max(0,r.unitWeight),0);
  const lengths=[...new Set(rows.map(r=>String(r.length)).filter(Boolean))];
  return {order,shipped,remaining,currentPL,afterPL,wtAfterPL,lengths};
}
function nextPlRenderShipmentBalance(rows){
  const poSel=document.getElementById('nextPlShipmentPo'), pfSel=document.getElementById('nextPlShipmentProfile');
  const info=document.getElementById('nextPlShipmentBalanceInfo'); if(!poSel||!pfSel||!info)return;
  const oldPo=poSel.value, oldPf=pfSel.value;
  const pos=[...new Set(rows.map(r=>r.poNumber).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:'base'}));
  poSel.innerHTML='<option value="">Select PO</option>'+pos.map(x=>`<option value="${nextPlEsc(x)}">${nextPlEsc(x)}</option>`).join('');
  if(pos.includes(oldPo))poSel.value=oldPo;
  const pRows=rows.filter(r=>!poSel.value||r.poNumber===poSel.value);
  const profiles=[]; pRows.forEach(r=>{if(!profiles.some(x=>nextPlSameProfile(x,r.profile)))profiles.push(r.profile);});
  profiles.sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:'base'}));
  pfSel.innerHTML='<option value="">Select Profile</option>'+profiles.map(x=>`<option value="${nextPlEsc(x)}">${nextPlEsc(x)}</option>`).join('');
  if(profiles.some(x=>nextPlSameProfile(x,oldPf)))pfSel.value=profiles.find(x=>nextPlSameProfile(x,oldPf))||'';
  if(!poSel.value||!pfSel.value){info.innerHTML='<div class="next-pl-shipment-empty"><i class="fa-solid fa-hand-pointer"></i> Select a <b>PO Number + Profile</b> to see shipment balance.</div>';return;}
  const b=nextPlShipmentBalanceFor(poSel.value,pfSel.value);
  info.innerHTML=`<div class="next-pl-shipment-grid">
    <div><span>PO Qty</span><b>${b.order.toLocaleString()} Pcs</b></div>
    <div><span>Already Shipped</span><b>${b.shipped.toLocaleString()} Pcs</b></div>
    <div class="warn"><span>Shipment Balance</span><b>${b.remaining.toLocaleString()} Pcs</b></div>
    <div><span>Already in Current PL</span><b>${b.currentPL.toLocaleString()} Pcs</b></div>
    <div class="good"><span>Balance After Current PL</span><b>${b.afterPL.toLocaleString()} Pcs</b></div>
    <div class="good"><span>Balance Weight</span><b>${b.wtAfterPL.toFixed(2)} kg</b></div>
  </div><div class="next-pl-shipment-note">Lengths in this PO/Profile: <b>${b.lengths.map(x=>nextPlEsc(x)+' mm').join(', ')||'-'}</b></div>`;
}
function nextPlRenderProfileSummary(rows){
  const box=document.getElementById('nextPlProfileSummaryBody'), poBox=document.getElementById('nextPlPoSummaryBody'); if(!box||!poBox)return;
  const selectedRows=rows.filter(r=>nextPlNum(nextPlSelection[r.rowKey])>0);
  const pg=new Map(); const pog=new Map();
  selectedRows.forEach(r=>{
    const q=nextPlNum(nextPlSelection[r.rowKey]), wt=q*r.unitWeight;
    const pk=nextPlProfileKey(r.profile), p=pg.get(pk)||{profile:r.profile,pcs:0,weight:0,po:new Set(),stock:0,cut:0,pending:0,pendingWeight:0};
    const linePending=Math.max(0,r.pendingQty), linePendingAfter=Math.max(0,linePending-q);
    p.pcs+=q; p.weight+=wt; p.po.add(r.poNumber); p.stock+=Math.min(r.availableForPo,q); p.cut+=Math.max(0,q-Math.min(r.availableForPo,q)); p.pending+=linePendingAfter; p.pendingWeight+=linePendingAfter*Math.max(0,r.unitWeight); pg.set(pk,p);
    const ok=r.poNumber+'|'+pk, g=pog.get(ok)||{po:r.poNumber,profile:r.profile,pcs:0,weight:0,poBalanceWeight:0,pending:0,pendingWeight:0};
    g.pcs+=q; g.weight+=wt; g.poBalanceWeight+=linePending*Math.max(0,r.unitWeight); g.pending+=linePendingAfter; g.pendingWeight+=linePendingAfter*Math.max(0,r.unitWeight); pog.set(ok,g);
  });
  const ps=[...pg.values()].sort((a,b)=>b.weight-a.weight);
  const pos=[...pog.values()].sort((a,b)=>String(a.po).localeCompare(String(b.po),undefined,{numeric:true})||String(a.profile).localeCompare(String(b.profile),undefined,{numeric:true}));
  box.innerHTML=ps.length?ps.map((g,i)=>`<tr><td>${i+1}</td><td><b>${nextPlEsc(g.profile)}</b></td><td>${[...g.po].map(nextPlEsc).join(', ')}</td><td>${g.pcs.toLocaleString()}</td><td class="next-pl-weight">${g.weight.toFixed(2)} kg</td><td>${g.stock.toLocaleString()}</td><td>${g.cut.toLocaleString()}</td></tr>`).join(''):`<tr><td colspan="7" class="next-pl-summary-empty">Auto Build or manually select Pcs to see the expected Next PL profile totals.</td></tr>`;
  const pFoot=document.getElementById('nextPlProfileSummaryFoot'); if(pFoot){const tP=ps.reduce((s,g)=>s+g.pcs,0),tW=ps.reduce((s,g)=>s+g.weight,0),tS=ps.reduce((s,g)=>s+g.stock,0),tC=ps.reduce((s,g)=>s+g.cut,0);pFoot.innerHTML=`<tr class="next-pl-total-row"><td colspan="3">TOTAL</td><td>${tP.toLocaleString()} Pcs</td><td>${tW.toFixed(2)} kg</td><td>${tS.toLocaleString()} Pcs</td><td>${tC.toLocaleString()} Pcs</td></tr>`;}
  poBox.innerHTML=pos.length?pos.map((g,i)=>`<tr><td>${i+1}</td><td><b>${nextPlEsc(g.po)}</b></td><td>${nextPlEsc(g.profile)}</td><td class="next-pl-po-balance-weight">${g.poBalanceWeight.toFixed(2)} kg</td><td>${g.pcs.toLocaleString()}</td><td class="next-pl-weight next-pl-plan-weight">${g.weight.toFixed(2)} kg</td><td class="next-pl-pending-weight">${g.pendingWeight.toFixed(2)} kg</td></tr>`).join(''):`<tr><td colspan="7" class="next-pl-summary-empty">No PO-wise Next PL selections yet.</td></tr>`;
  const poFoot=document.getElementById('nextPlPoSummaryFoot'); if(poFoot){const tB=pos.reduce((s,g)=>s+g.poBalanceWeight,0),tP=pos.reduce((s,g)=>s+g.pcs,0),tW=pos.reduce((s,g)=>s+g.weight,0),tPend=pos.reduce((s,g)=>s+g.pendingWeight,0);poFoot.innerHTML=`<tr class="next-pl-total-row"><td colspan="3">TOTAL</td><td>${tB.toFixed(2)} kg</td><td>${tP.toLocaleString()} Pcs</td><td>${tW.toFixed(2)} kg</td><td>${tPend.toFixed(2)} kg</td></tr>`;}
  const totalProfilePcs=ps.reduce((s,g)=>s+g.pcs,0), totalProfileWt=ps.reduce((s,g)=>s+g.weight,0), totalStock=ps.reduce((s,g)=>s+g.stock,0), totalCut=ps.reduce((s,g)=>s+g.cut,0);
  const pfTable=box.closest('table');
  if(pfTable){let tf=pfTable.querySelector('tfoot');if(!tf){tf=document.createElement('tfoot');pfTable.appendChild(tf);}tf.innerHTML=`<tr class="next-pl-total-row"><td colspan="3">TOTAL PROFILE PLAN</td><td>${totalProfilePcs.toLocaleString()}</td><td>${totalProfileWt.toFixed(2)} kg</td><td>${totalStock.toLocaleString()}</td><td>${totalCut.toLocaleString()}</td></tr>`;}
  const totalPoBalance=pos.reduce((s,g)=>s+g.poBalanceWeight,0), totalPoPcs=pos.reduce((s,g)=>s+g.pcs,0), totalPoPlan=pos.reduce((s,g)=>s+g.weight,0), totalPoPending=pos.reduce((s,g)=>s+g.pendingWeight,0);
  const poTable=poBox.closest('table');
  if(poTable){let tf=poTable.querySelector('tfoot');if(!tf){tf=document.createElement('tfoot');poTable.appendChild(tf);}tf.innerHTML=`<tr class="next-pl-total-row"><td colspan="3">TOTAL PO PLAN</td><td>${totalPoBalance.toFixed(2)} kg</td><td>${totalPoPcs.toLocaleString()}</td><td>${totalPoPlan.toFixed(2)} kg</td><td>${totalPoPending.toFixed(2)} kg</td></tr>`;}
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
    const rowCap=nextPlManualOverride[r.rowKey]?r.pendingQty:r.availableForPo;
    r.selectedQty=r.excluded?0:Math.min(nextPlNum(nextPlSelection[r.rowKey]),rowCap); nextPlSelection[r.rowKey]=r.selectedQty;
    selectedPcs+=r.selectedQty; selectedWeight+=r.selectedQty*r.unitWeight; pendingAfterNextWeight+=Math.max(0,r.pendingQty-r.selectedQty)*Math.max(0,r.unitWeight); cutWeight+=r.needCutWeight; if(r.selectedQty>0)selectedLines++;
    if(!uniqueStockKeys.has(r.key)){availableWeight+=r.stockTotal*r.unitWeight;uniqueStockKeys.add(r.key);}
  });
  const remainingMin=Math.max(0,summary.targetMin-currentPlWeight), remainingMax=Math.max(0,summary.targetMax-currentPlWeight);
  if(!rows.length)body.innerHTML='<tr><td colspan="18" style="padding:28px;text-align:center;color:#64748b;font-weight:800;">No pending PO lines with matching Master Catalog data.</td></tr>';
  else body.innerHTML=rows.map((r,i)=>`<tr class="${r.excluded?'next-pl-excluded':''}">
    <td><span style="display:inline-block;min-width:25px;padding:3px 6px;border-radius:999px;background:${i<3?'#dcfce7':'#f1f5f9'};color:${i<3?'#047857':'#475569'};font-weight:900;">${i+1}</span></td>
    <td>${nextPlEsc(r.date||'-')}</td><td><b>${nextPlEsc(r.poNumber)}</b></td><td><b>${nextPlEsc(r.profile)}</b></td><td>${nextPlEsc(r.itemCode||'-')}</td><td>${nextPlEsc(r.length)} mm</td>
    <td>${r.unitWeight.toFixed(4)} kg</td><td class="next-pl-pending"><b>${r.pendingQty.toLocaleString()}</b> <small style="display:block;color:#be123c;font-weight:800;">${r.remainingPoWeight.toFixed(2)} kg</small></td><td>${r.currentPlQty.toLocaleString()} <small style="display:block;color:#047857;font-weight:800;">${r.currentPlWeight.toFixed(2)} kg</small></td><td>${r.stockTotal.toLocaleString()} <small style="display:block;color:#0f766e;font-weight:800;">${(r.stockTotal*r.unitWeight).toFixed(2)} kg</small></td><td>${r.stockReady.toLocaleString()} <small style="display:block;color:#0f766e;font-weight:800;">${(r.stockReady*r.unitWeight).toFixed(2)} kg</small></td><td>${r.stockWip.toLocaleString()} <small style="display:block;color:#b45309;font-weight:800;">${(r.stockWip*r.unitWeight).toFixed(2)} kg</small></td><td class="next-pl-available"><b>${r.availableForPo.toLocaleString()}</b> <small style="display:block;color:#047857;font-weight:800;">${(r.availableForPo*r.unitWeight).toFixed(2)} kg</small></td><td><input class="next-pl-select-input ${nextPlManualOverride[r.rowKey]?'manual':''}" type="number" min="0" max="${Math.floor(r.pendingQty)}" step="1" value="${Math.floor(r.selectedQty)}" ${r.excluded?'disabled':''} onchange="nextPlSetQty('${nextPlEsc(r.rowKey)}',this.value)" oninput="nextPlSetQty('${nextPlEsc(r.rowKey)}',this.value)"></td><td class="next-pl-weight"><b>${(r.selectedQty*r.unitWeight).toFixed(2)} kg</b></td><td>${r.needCutQty.toLocaleString()}</td><td>${r.needCutWeight.toFixed(2)} kg</td><td><label class="next-pl-skip"><input type="checkbox" ${r.excluded?'checked':''} onchange="nextPlToggleExclude('${nextPlEsc(r.rowKey)}',this.checked)"> Skip</label>${nextPlManualOverride[r.rowKey]?'<div class="next-pl-manual-badge">Manual / Cut</div>':''}</td>
  </tr>`).join('');
  const totalBalanceWeight=rows.reduce((s,r)=>s+Math.max(0,r.remainingPoWeight),0);
  const totalCurrentPlWeight=rows.reduce((s,r)=>s+Math.max(0,r.currentPlWeight),0);
  const totalStockWeight=rows.reduce((s,r)=>s+Math.max(0,r.stockTotal)*Math.max(0,r.unitWeight),0);
  const totalReadyWeight=rows.reduce((s,r)=>s+Math.max(0,r.stockReady)*Math.max(0,r.unitWeight),0);
  const totalWipWeight=rows.reduce((s,r)=>s+Math.max(0,r.stockWip)*Math.max(0,r.unitWeight),0);
  const totalAvailableWeight=rows.reduce((s,r)=>s+Math.max(0,r.availableForPo)*Math.max(0,r.unitWeight),0);
  const totalNeedCutWeight=rows.reduce((s,r)=>s+Math.max(0,r.needCutWeight),0);
  const totalSelectedPcs=rows.reduce((s,r)=>s+Math.max(0,r.selectedQty),0);
  const totalSelectedWeight=rows.reduce((s,r)=>s+Math.max(0,r.selectedQty)*Math.max(0,r.unitWeight),0);
  const mainFoot=document.getElementById('nextPlPlanningFoot');
  const totalBalancePcs=rows.reduce((s,r)=>s+Math.max(0,r.pendingQty),0), totalCurrentPlPcs=rows.reduce((s,r)=>s+Math.max(0,r.currentPlQty),0), totalStockPcs=rows.reduce((s,r)=>s+Math.max(0,r.stockTotal),0), totalReadyPcs=rows.reduce((s,r)=>s+Math.max(0,r.stockReady),0), totalWipPcs=rows.reduce((s,r)=>s+Math.max(0,r.stockWip),0), totalAvailablePcs=rows.reduce((s,r)=>s+Math.max(0,r.availableForPo),0), totalNeedCutPcs=rows.reduce((s,r)=>s+Math.max(0,r.needCutQty),0);
  if(mainFoot)mainFoot.innerHTML=`<tr class="next-pl-total-row"><td colspan="7">TOTAL — VISIBLE PO LINES</td><td><b>${totalBalancePcs.toLocaleString()} Pcs</b><small>${totalBalanceWeight.toFixed(2)} kg</small></td><td><b>${totalCurrentPlPcs.toLocaleString()} Pcs</b><small>${totalCurrentPlWeight.toFixed(2)} kg</small></td><td><b>${totalStockPcs.toLocaleString()} Pcs</b><small>${totalStockWeight.toFixed(2)} kg</small></td><td><b>${totalReadyPcs.toLocaleString()} Pcs</b><small>${totalReadyWeight.toFixed(2)} kg</small></td><td><b>${totalWipPcs.toLocaleString()} Pcs</b><small>${totalWipWeight.toFixed(2)} kg</small></td><td><b>${totalAvailablePcs.toLocaleString()} Pcs</b><small>${totalAvailableWeight.toFixed(2)} kg</small></td><td><b>${totalSelectedPcs.toLocaleString()} Pcs</b></td><td><b>${totalSelectedWeight.toFixed(2)} kg</b></td><td><b>${totalNeedCutPcs.toLocaleString()} Pcs</b></td><td><b>${totalNeedCutWeight.toFixed(2)} kg</b></td><td>-</td></tr>`;
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('nextPlCurrentPLWeight',`${currentPlWeight.toFixed(2)} kg`); set('nextPlCurrentPLPcs',`${summary.pcs.toLocaleString()} Pcs`); set('nextPlRemainingMin',`${remainingMin.toFixed(2)} kg`); set('nextPlRemainingMax',`${remainingMax.toFixed(2)} kg`);
  set('nextPlSelectedWeight',`${selectedWeight.toFixed(2)} kg`); set('nextPlTotalNextWeight',`${(currentPlWeight+selectedWeight).toFixed(2)} kg`); set('nextPlPendingAfterNextWeight',`${pendingAfterNextWeight.toFixed(2)} kg`); set('nextPlSelectedPcs',selectedPcs.toLocaleString()); set('nextPlSelectedLines',`${selectedLines} selected lines`); set('nextPlAvailableWeight',`${availableWeight.toFixed(2)} kg`); set('nextPlToMin',`${Math.max(0,remainingMin-selectedWeight).toFixed(2)} kg`); set('nextPlToMax',`${Math.max(0,remainingMax-selectedWeight).toFixed(2)} kg`); set('nextPlNeedCutWeight',`${cutWeight.toFixed(2)} kg`);
  nextPlRenderProfileSummary(all);
  nextPlRenderPoWeightChart(all);
  const totalPlPlusSelection=currentPlWeight+selectedWeight;
  const targetTotal=summary.targetTotal;
  const status=document.getElementById('nextPlTargetStatus'), alert=document.getElementById('nextPlAlert');
  if(status){
    const delta=targetTotal-totalPlPlusSelection;
    status.textContent=Math.abs(delta)<0.01?'TARGET READY':delta<0?'OVER TARGET':`Need ${delta.toFixed(2)} kg more`;
    status.style.color=Math.abs(delta)<0.01?'#047857':delta<0?'#be123c':'#b45309';
  }
  if(alert){
    const active=`${summary.container||'Current PL'} • ${currentPlWeight.toFixed(2)} kg already planned`;
    if(totalPlPlusSelection>19000 || targetTotal>19000)alert.innerHTML=`<div style="background:#fff1f2;border:1px solid #fda4af;color:#be123c;"><i class="fa-solid fa-triangle-exclamation"></i> <b>WARNING — Next PL is over 19 tons:</b> ${totalPlPlusSelection.toFixed(2)} kg total (${(totalPlPlusSelection/1000).toFixed(2)} T). Please reduce the planned Pcs or target weight before finalizing the Packing List.</div>`;
    else if(Math.abs(totalPlPlusSelection-targetTotal)<0.01)alert.innerHTML=`<div style="background:#ecfdf5;border:1px solid #a7f3d0;color:#047857;"><i class="fa-solid fa-circle-check"></i> <b>Next PL target ready:</b> ${totalPlPlusSelection.toFixed(2)} kg total (${currentPlWeight.toFixed(2)} kg existing + ${selectedWeight.toFixed(2)} kg new).</div>`;
    else if(totalPlPlusSelection>summary.targetMax)alert.innerHTML=`<div style="background:#fff1f2;border:1px solid #fecdd3;color:#be123c;"><i class="fa-solid fa-triangle-exclamation"></i> <b>Over maximum:</b> reduce ${(totalPlPlusSelection-summary.targetMax).toFixed(2)} kg. ${active}.</div>`;
    else alert.innerHTML=`<div style="background:#fffbeb;border:1px solid #fde68a;color:#92400e;"><i class="fa-solid fa-circle-info"></i> <b>${active}.</b> Select another ${Math.max(0,targetTotal-totalPlPlusSelection).toFixed(2)} kg to reach the manual target of ${targetTotal.toLocaleString()} kg.</div>`;
  }
  nextPlSchedulePersist();
}
function nextPlAutoBuild(){
  const summary=nextPlGetCurrentSummary();
  // Auto Build always uses the current PO/Profile filters and the suggested stock-backed
  // candidates, regardless of which table View mode is currently selected.
  let rows=nextPlGetRows().filter(r=>!r.excluded && r.pendingQty>0);
  const poFilter=document.getElementById('nextPlPoFilter')?.value||'';
  const profileFilter=document.getElementById('nextPlProfileFilter')?.value||'';
  rows=rows.filter(r=>(!poFilter||r.poNumber===poFilter)&&(!profileFilter||nextPlSameProfile(r.profile,profileFilter)));
  const priority=document.getElementById('nextPlPriority')?.value||'oldest';
  rows.sort((a,b)=>{const da=new Date(a.date||0).getTime(),db=new Date(b.date||0).getTime();const d=priority==='newest'?db-da:da-db;return d||(priority==='newest'?String(b.poNumber).localeCompare(String(a.poNumber),undefined,{numeric:true}):String(a.poNumber).localeCompare(String(b.poNumber),undefined,{numeric:true}));});
  nextPlSelection={}; nextPlManualOverride={};
  const targetTotal=Math.max(0,nextPlNum(summary.targetTotal));
  const targetNew=Math.max(0,targetTotal-summary.weight);
  let total=0;
  if(targetTotal>19000)showToast(`Target is ${(targetTotal/1000).toFixed(2)}T, which is above the 19T warning limit. Warning will remain visible.`,'warning');
  // First consume current stock, then use PO balance that needs cutting so Auto Build
  // can still reach the target when stock alone is not enough.
  const stockRows=rows.filter(r=>r.availableForPo>0).sort((a,b)=>0);
  const cutRows=rows.filter(r=>r.needCutQty>0);
  for(const pool of [stockRows,cutRows]){
    for(const r of pool){
      if(total>=targetNew || r.unitWeight<=0)break;
      const cap=pool===stockRows ? Math.min(r.availableForPo,r.pendingQty) : r.needCutQty;
      const room=targetNew-total;
      const qty=Math.min(cap,Math.floor(room/r.unitWeight));
      if(qty<=0)continue;
      nextPlSelection[r.rowKey]=Math.min(r.pendingQty,Math.max(0,nextPlNum(nextPlSelection[r.rowKey]))+qty);
      nextPlManualOverride[r.rowKey]=pool===cutRows;
      total+=qty*r.unitWeight;
    }
    if(total>=targetNew)break;
  }
  nextPlSchedulePersist();
  renderNextPlPlanning();
  const grand=summary.weight+total;
  const diff=targetTotal-grand;
  showToast(Math.abs(diff)<0.01?`Auto plan matched ${grand.toFixed(2)} kg target.`:`Auto plan built ${grand.toFixed(2)} kg; ${Math.abs(diff).toFixed(2)} kg ${diff>0?'still needed':'over target'}.`,Math.abs(diff)<0.01?'success':'warning');
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
      if (tabId === 'packingListTab') { populatePlPoDropdown(); renderPackingListTable(); } 
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
    document.getElementById('rejectEntryForm').reset(); document.getElementById('rejDate').value=d;
  } catch(e){ console.error(e); showToast(e.message||'Reject save failed.','error'); } finally { isAppBusy=false; }
}
function renderRejectTable() { try { const subTab = document.getElementById('rejectEntrySubTab'); let filterDiv = document.getElementById('rejectFilterContainer'); if (!filterDiv && subTab) { filterDiv = document.createElement('div'); filterDiv.id = 'rejectFilterContainer'; filterDiv.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center; background: rgba(16, 185, 129, 0.05); padding: 15px; border-radius: 8px; margin-bottom: 15px; border: 1px dashed var(--emerald-border); flex-wrap: wrap; gap: 15px;"><div><label style="font-weight:800; margin-right:10px; color:var(--primary-dark);"><i class="fa-solid fa-calendar-days"></i> Filter by Month:</label><input type="month" id="rejectMonthFilter" onchange="renderRejectTable()" style="padding: 6px 12px; border-radius: 6px; border: 1px solid var(--accent-color); font-weight: 700;"></div><div style="display:flex; gap: 12px; font-weight: 800; font-size: 13.5px; flex-wrap: wrap;"><div style="background: #fee2e2; color: #9f1239; padding: 8px 14px; border-radius: 6px;"><i class="fa-solid fa-dumpster"></i> Total: <span id="rejSumTotal">0.00</span> kg</div></div></div>`; const tableContainer = subTab.querySelector('.table-container'); subTab.insertBefore(filterDiv, tableContainer); const now = new Date(); document.getElementById('rejectMonthFilter').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; } const selectedMonthVal = document.getElementById('rejectMonthFilter') ? document.getElementById('rejectMonthFilter').value : ''; let filteredLogs = rejectLogs; let sumTotal = 0; if (selectedMonthVal) filteredLogs = rejectLogs.filter(r => r.reject_date && r.reject_date.startsWith(selectedMonthVal)); filteredLogs.forEach(r => { sumTotal += (parseFloat(r.weight) || 0); }); if (document.getElementById('rejSumTotal')) document.getElementById('rejSumTotal').textContent = sumTotal.toFixed(2); const tb = document.getElementById('rejectTableBody'); if(!tb) return; let html = ''; if(filteredLogs.length===0) html = `<tr><td colspan="10" style="text-align:center;">No Reject Records Found.</td></tr>`; else { filteredLogs.forEach(r => { html += `<tr><td>${r.reject_date}</td><td>${r.shift}</td><td>${r.location}</td><td>${r.stage}</td><td><b>${r.profile}</b></td><td>${r.item_code}</td><td>${r.length}</td><td>${r.pcs}</td><td>${r.weight} kg</td><td>${currentUserRole === 'Admin' ? `<button class="btn btn-danger" onclick="deleteRejectItem(${r.id})"><i class="fa-solid fa-trash"></i></button>` : `<i class="fa-solid fa-lock"></i>`}</td></tr>`; }); } tb.innerHTML = html; } catch(e) {} }
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

function aisUndoLabel(){ return aisUndoStack.length ? `↩ Undo: ${aisUndoStack[aisUndoStack.length-1].label}` : '↩ Undo Last Change'; }
function aisUpdateUndoButtons(){
  document.querySelectorAll('.ais-undo-btn').forEach(btn=>{
    btn.disabled = !aisUndoStack.length || aisUndoBusy;
    btn.innerHTML = `<i class="fa-solid fa-rotate-left"></i> ${aisUndoLabel()}`;
    btn.title = aisUndoStack.length ? `Undo ${aisUndoStack[aisUndoStack.length-1].label}` : 'No recent change to undo';
  });
}

window.aisUndoLastAction = async function(){
  if(aisUndoBusy || !aisUndoStack.length) return showToast('There is no recent change to undo.','info');
  if(currentUserRole!=='Admin' && currentUserRole!=='Planner') return showToast('Undo is available to Admin / Planner only.','warning');
  const action=aisUndoStack[aisUndoStack.length-1];
  if(!confirm(`Undo this change?\n\n${action.label}\n\nThe saved data will be reverted.`)) return;
  aisUndoBusy=true; aisUpdateUndoButtons();
  try{
    await action.undoFn();
    aisUndoStack.pop();
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
    btn.type='button'; btn.className='btn ais-undo-btn';
    btn.style.cssText='background:#64748b;color:#fff;border:1px solid #475569;padding:7px 11px;font-size:11px;font-weight:900;';
    btn.onclick=()=>window.aisUndoLastAction();
    wrap.appendChild(btn);
  });
  aisUpdateUndoButtons();
}

async function dbInsert(table, row, action) {
  // Do NOT request the inserted row back here. With Supabase RLS, INSERT may be
  // allowed while SELECT/RETURNING is not. Using .select() made a successful
  // write look like a failed write and could trigger a rollback in production.
  const result = await supabaseClient.from(table).insert([row]);
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
  const now=new Date(); const currentKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  if(monthKey===currentKey){ ensurePackingSelection(); return {month:activePackingMonth,container:activePackingContainer,records:getPackingContainerRecords(activePackingMonth,activePackingContainer)}; }
  const rows=packingLists.filter(p=>{ const d=new Date(p.date); return !Number.isNaN(d.getTime()) && `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`===monthKey; });
  if(!rows.length) return {month:'',container:'',records:[]};
  const rank=c=>String(c||'').toLowerCase().includes('3rd')?3:String(c||'').toLowerCase().includes('2nd')?2:1;
  rows.sort((a,b)=>new Date(b.date)-new Date(a.date) || rank(b.container)-rank(a.container));
  const m=rows[0].month||dashboardMonthLabel(monthKey); const c=rows[0].container||'1st Container';
  return {month:m,container:c,records:getPackingContainerRecords(m,c)};
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
      
      let isManualComplete = isManualCrateComplete(crateId, activePackingContainer) ? true : false;
      
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
  try { renderMonthlyShiftChart(); } catch (err) { console.error('Monthly dashboard chart error:', err); showToast('Dashboard chart error: ' + (err?.message || 'Unable to render monthly chart.'), 'error'); }
  recoveryMonthReminder();
}

function renderMonthlyShiftChart() {
    const ctx = document.getElementById('monthlyShiftChart'); if(!ctx || typeof Chart === 'undefined') return;
    safeChartDestroy(monthlyShiftChartInstance, 'monthlyShiftChart');
    const now = new Date(); const key = dashboardSelectedMonth || `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`; const [selectedYear, selectedMonthNum] = key.split('-').map(Number); const currentYear = selectedYear || now.getFullYear(); const currentMonth = (selectedMonthNum||now.getMonth()+1)-1;
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
        recoveryWrapLogs.filter(r => r.wrap_date === dateKey).forEach(r => {
            const wt=Number(r.wrap_weight)||0;
            dayRecover += wt;
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
        <div class="prod-metric monthly"><span id="dashMonthlyWrapLabel">Monthly Wrapping</span><b id="dashMonthlyWrapWeight">${monthWrapWeight.toFixed(2)} kg</b><small>${monthWrapPcs.toLocaleString()} Pcs • Wrap/Cut ${monthWrapEfficiencyPct.toFixed(1)}%</small></div>
        <div class="prod-metric reject"><span id="dashMonthlyRejectLabel">Monthly Reject</span><b id="dashMonthlyRejectWeight">${monthRejectWeight.toFixed(2)} kg</b><small>${monthRejectPct.toFixed(1)}% of wrapping</small></div>
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
async function deductCardboardBoxesForProduction(profile, itemCode, length, boxesNeeded) {
  if(boxesNeeded <= 0) return null;
  const available=getAvailableCardboard(profile,itemCode,length);
  if(boxesNeeded>available) throw new Error(`Not enough cardboard boxes for ${profile} / ${itemCode} / ${length} mm. Available: ${available} boxes; required: ${boxesNeeded} boxes.`);
  const txToken=`TX-${Date.now()}-${Math.random().toString(36).slice(2,8)}`; const newEntry={cb_date:new Date().toISOString().split('T')[0],cb_type:cardboardType(profile,itemCode,length)+` | ${txToken}`,incoming:0,used:boxesNeeded};
  const result=await supabaseClient.from('cardboard_stock').insert([newEntry]);
  if(result.error) throw new Error(dbErrorMessage(result.error,'Cardboard stock deduction failed'));
  const localItem={id:-Date.now(),db_id:null,date:newEntry.cb_date,type:newEntry.cb_type,incoming:0,used:boxesNeeded,timestamp:new Date().toLocaleTimeString()};
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
function onCbMaterialSelect(){ const val=(document.getElementById('cbMaterialInput')?.value||'').trim(); const matches=masterData.filter(m=>String(m.material||'').trim()===val); const p=document.getElementById('cbSelectProfile'); if(p){p.innerHTML='<option value="">-- Choose Profile --</option>'; [...new Set(matches.map(m=>String(m.profile).trim()))].forEach(x=>p.appendChild(new Option(x,x)));} onCbProfileSelect(); }
function onCbProfileSelect(){ const p=document.getElementById('cbSelectProfile'); const i=document.getElementById('cbSelectItemCode'); if(!p||!i)return; const profile=p.value; i.innerHTML='<option value="">-- Choose Item Code --</option>'; const mat=(document.getElementById('cbMaterialInput')?.value||'').trim(); masterData.filter(m=>String(m.profile).trim()===profile && (!mat||String(m.material||'').trim()===mat)).forEach(m=>{if(m.itemCode&&!Array.from(i.options).some(o=>o.value===m.itemCode))i.appendChild(new Option(m.itemCode,m.itemCode));}); onCbItemCodeSelect();}
function onCbItemCodeSelect(){ const p=document.getElementById('cbSelectProfile'),i=document.getElementById('cbSelectItemCode'),l=document.getElementById('cbSelectLength'); if(!p||!i||!l)return; l.innerHTML='<option value="">-- Choose Length --</option>'; masterData.filter(m=>String(m.profile).trim()===p.value&&m.itemCode===i.value).forEach(m=>l.appendChild(new Option(`${m.length} mm`,m.length))); if(l.options.length===2)l.selectedIndex=1; }
async function processCardboardTransaction(){ if(currentUserRole!=='Admin'&&currentUserRole!=='Planner')return; const date=document.getElementById('cbDate').value||new Date().toISOString().split('T')[0], type=document.getElementById('cbTxType').value, profile=document.getElementById('cbSelectProfile').value,item=document.getElementById('cbSelectItemCode').value,length=document.getElementById('cbSelectLength').value,qty=parseInt(document.getElementById('cbQty').value)||0; if(!profile||!item||!length||qty<=0)return showToast('Select profile, item, length and quantity.','warning'); const bal=getAvailableCardboard(profile,item,length); if(type==='OUT'&&qty>bal)return showToast(`Insufficient cardboard stock. Available: ${bal} boxes.`,'error'); const rec={cb_date:date,cb_type:cardboardType(profile,item,length),incoming:type==='IN'?qty:0,used:type==='OUT'?qty:0}; try{const r=await supabaseClient.from('cardboard_stock').insert([rec]);if(r.error)throw r.error;cardboardStockList.unshift({id:-Date.now(),db_id:null,date, type:rec.cb_type,incoming:rec.incoming,used:rec.used,timestamp:new Date().toLocaleTimeString()});saveCardboardLocally();aisRegisterUndo(`Cardboard ${type==='IN'?'IN':'OUT'} • ${profile} / ${length} • ${qty} Boxes`,async()=>{await aisDeleteLatest('cardboard_stock',rec);},'cardboardTab');renderCardboardStock();document.getElementById('cardboardEntryForm')?.reset();showToast('Cardboard transaction saved.','success');}catch(e){showToast(dbErrorMessage(e,'Cardboard save failed'),'error');}}
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
    cancelCardboardManualEdit(); renderCardboardStock();
  }catch(e){showToast(dbErrorMessage(e,'Manual cardboard data save failed'),'error');}
}
function editCardboardManualData(id){
  const r=cardboardManualData.find(x=>String(x.manual_id||x.id)===String(id));
  if(!r)return showToast('Manual record not found.','error');
  document.getElementById('cbManualId').value=r.manual_id||r.id; document.getElementById('cbManualDate').value=r.date||''; document.getElementById('cbManualMaterial').value=r.material||''; document.getElementById('cbManualProfile').value=r.profile||''; document.getElementById('cbManualItemCode').value=r.itemCode||''; document.getElementById('cbManualLength').value=r.length||''; document.getElementById('cbManualQty').value=Number(r.quantity)||0; document.getElementById('cbManualNote').value=r.note||'';
  document.getElementById('cbManualSaveBtn').innerHTML='<i class="fa-solid fa-check"></i> Update Manual Data'; document.getElementById('cbManualCancelBtn').style.display='inline-flex'; document.getElementById('cbManualDataArea')?.scrollIntoView({behavior:'smooth',block:'center'});
}
function cancelCardboardManualEdit(){
  const f=document.getElementById('cardboardManualForm'); if(f)f.reset(); const id=document.getElementById('cbManualId'); if(id)id.value=''; const d=document.getElementById('cbManualDate'); if(d)d.value=new Date().toISOString().split('T')[0]; const b=document.getElementById('cbManualSaveBtn'); if(b)b.innerHTML='<i class="fa-solid fa-save"></i> Save Manual Data'; const c=document.getElementById('cbManualCancelBtn'); if(c)c.style.display='none';
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
  if(isAppBusy) return; isAppBusy=true;
  try {
    if (currentUserRole !== 'Admin' && currentUserRole !== 'Planner') return;
    const dateVal=document.getElementById('entryDate').value, shiftVal=document.getElementById('shift').value,
      profileVal=document.getElementById('selectProfile').value, itemCodeVal=document.getElementById('selectItemCode').value,
      lengthVal=document.getElementById('selectLength').value, cutQty=parseInt(document.getElementById('cutQty').value)||0,
      punchQty=parseInt(document.getElementById('punchQty').value)||0, wrapQty=parseInt(document.getElementById('wrapQty').value)||0,
      enteredBoxes=Math.max(0,parseInt(document.getElementById('boxQty').value)||0), crateQty=parseInt(document.getElementById('crateQty').value)||0;
    const availableCardboard=Math.max(0,Number(getAvailableCardboard(profileVal,itemCodeVal,lengthVal))||0);
    // Do not block production when cardboard is insufficient. The production Box Qty is
    // recorded as entered, while actual cardboard stock consumption is capped at what is available.
    if(!dateVal||!profileVal||!itemCodeVal||!lengthVal) return showToast('Please select correctly.','warning');
    const item=masterData.find(m=>String(m.profile).trim()===profileVal&&m.itemCode===itemCodeVal&&cleanLen(m.length)===cleanLen(lengthVal));
    if(!item) return showToast('Selected catalog item was not found.','error');

    const previous={cutQty:Number(item.cutQty)||0,punchQty:Number(item.punchQty)||0,wrapQty:Number(item.wrapQty)||0,boxQty:Number(item.boxQty)||0,crateQty:Number(item.crateQty)||0};
    let next={...previous};
    const boxPcs=enteredBoxes*(item.boxCapacity||100);
    next.cutQty+=cutQty;
    if(punchQty>0){ next.cutQty=Math.max(0,next.cutQty-punchQty); next.punchQty+=punchQty; }
    if(wrapQty>0){
      if(isPunchBypassed(profileVal,lengthVal)||next.punchQty<=0) next.cutQty=Math.max(0,next.cutQty-wrapQty);
      else if(next.punchQty>=wrapQty) next.punchQty-=wrapQty;
      else { const rem=wrapQty-next.punchQty; next.punchQty=0; next.cutQty=Math.max(0,next.cutQty-rem); }
      next.wrapQty+=wrapQty;
    }
    if(boxPcs>0){ next.wrapQty=Math.max(0,next.wrapQty-boxPcs); next.boxQty+=boxPcs; }
    if(crateQty>0){ next.boxQty=Math.max(0,next.boxQty-crateQty); next.crateQty+=crateQty; }

    const newLog={log_date:dateVal,shift:shiftVal,profile:profileVal,length:cleanLen(lengthVal),cut_qty:cutQty,punch_qty:punchQty,wrap_qty:wrapQty,box_qty:boxPcs,crate_qty:crateQty,log_time:new Date().toLocaleTimeString()};
    let stockUpdated=false, insertedLog=null, cardboardDeducted=null;
    try {
      // Reserve only the cardboard that actually exists. If production needs more boxes,
      // the remaining production quantity is still recorded, but cardboard stock bottoms at 0.
      const cardboardToDeduct=Math.min(enteredBoxes,availableCardboard);
      if(cardboardToDeduct>0) cardboardDeducted=await deductCardboardBoxesForProduction(profileVal,itemCodeVal,lengthVal,cardboardToDeduct);
      if(item.db_id){
        await dbUpdate('master_catalog',{cut_qty:next.cutQty,punch_qty:next.punchQty,wrap_qty:next.wrapQty,box_qty:next.boxQty,crate_qty:next.crateQty},item.db_id,'Production stock save failed');
        stockUpdated=true;
      } else throw new Error('Production stock save failed: this catalog item has no database ID. Refresh data and try again.');
      insertedLog=await dbInsert('history_logs',newLog,'Production history save failed');
    } catch(err) {
      if(stockUpdated&&item.db_id){ try{ await dbUpdate('master_catalog',previousToDb(previous),item.db_id,'Production rollback failed'); }catch(rb){ console.error(rb); } }
      // If later production save failed, reverse the cardboard transaction we just made.
      if(cardboardDeducted){
        try {
          // The insert helper intentionally does not request SELECT/RETURNING; remove the most recent matching local transaction if possible.
          const idx=cardboardStockList.indexOf(cardboardDeducted); if(idx>=0){cardboardStockList.splice(idx,1);saveCardboardLocally();}
          const q=await supabaseClient.from('cardboard_stock').delete().eq('cb_date',cardboardDeducted.date).eq('cb_type',cardboardDeducted.type).eq('used',cardboardToDeduct);
          if(q.error) console.warn('Cardboard rollback warning:',q.error);
        } catch(rb){ console.warn('Cardboard rollback failed:',rb); }
      }
      throw err;
    }
    Object.assign(item,{cutQty:next.cutQty,punchQty:next.punchQty,wrapQty:next.wrapQty,boxQty:next.boxQty,crateQty:next.crateQty});
    aisRegisterUndo(`Daily Production • ${profileVal} / ${lengthVal} • ${dateVal}`, async()=>{
      if(item.db_id) await aisUpdateById('master_catalog',item.db_id,previousToDb(previous));
      await aisDeleteLatest('history_logs',{log_date:newLog.log_date,shift:newLog.shift,profile:newLog.profile,length:newLog.length,cut_qty:newLog.cut_qty,punch_qty:newLog.punch_qty,wrap_qty:newLog.wrap_qty,box_qty:newLog.box_qty,crate_qty:newLog.crate_qty,log_time:newLog.log_time});
      if(cardboardDeducted) await aisDeleteLatest('cardboard_stock',{cb_date:cardboardDeducted.date,cb_type:cardboardDeducted.type,incoming:0,used:cardboardDeducted.used});
    },'adminEntryTab');
    historyLogs.unshift({id:insertedLog.id || -Date.now(),date:dateVal,shift:shiftVal,profile:profileVal,length:cleanLen(lengthVal),cutQty,punchQty,wrapQty,boxQty:boxPcs,crateQty,timestamp:insertedLog.log_time||insertedLog.created_at});
    showToast('Movement saved to Supabase successfully.','success');
    renderDashboard(); renderProfileSummaryTable(); renderHistoryData(); checkDateStatus(); renderCardboardStock(); renderBalanceWorkTable();
    ['cutQty','punchQty','wrapQty','boxQty','crateQty'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=0;});
  } catch(e){ console.error('Production save error:',e); await loadDataFromSupabase(true).catch(()=>{}); showToast(e.message||'Movement save failed.','error'); }
  finally{isAppBusy=false;}
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
  const remainingBefore=Math.max(0,(Number(po.orderQty)||0)-shippedSoFar);
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
  renderShipmentHistoryTable(); renderDashboard(); renderProfileSummaryTable(); renderBalanceWorkTable(); updatePoFilters(); renderPoDetailsTable();
 }catch(e){console.error('Shipment save error:',e);showToast(e.message||'Shipment save failed.','error');}finally{isAppBusy=false;}
}

function deleteShipmentItem(id) { if (currentUserRole !== 'Admin') return; showConfirm("Delete this Shipment?", async () => { await supabaseClient.from('shipments').delete().eq('id', id); shipmentList = shipmentList.filter(s => s.id !== id); window.renderShipmentHistoryTable(); renderDashboard(); renderBalanceWorkTable(); updatePoFilters(); renderPoDetailsTable(); showToast("Deleted", "success"); }); }

window.downloadPackingTemplate = function(){
    if(typeof XLSX==='undefined') return showToast('Excel library not loaded.','error');
    const rows=[
      {'Crate No':'11','PO Number':'363760','Profile':'AL-1037','Item Code':'RT-BT68','Number of Crates':1,'Pcs per Crate':100,'Total Qty':100},
      {'Crate No':'12','PO Number':'363760','Profile':'AL-1037','Item Code':'RT-BT68','Number of Crates':4,'Pcs per Crate':150,'Total Qty':600}
    ];
    exportTableToExcel(rows,'AIS_Packing_List_7_Column_Template','Packing List');
};

function getReadyCrateRows(records) {
    // Crate-level readiness/status. A crate is Ready only when EVERY
    // profile/item/length line assigned to that crate has its full required
    // quantity in Box Stage. For non-ready crates, show the earliest missing
    // stage so the operator knows why the crate is pending.
    const rows=[];
    const stockMap=new Map();
    masterData.forEach(m=>{
        const key=`${String(m.profile||'').trim()}|${String(m.itemCode||'').trim()}|${cleanLen(m.length)}`;
        stockMap.set(key, {
            cut:Math.max(0, Number(m.cutQty)||0),
            punch:Math.max(0, Number(m.punchQty)||0),
            wrap:Math.max(0, Number(m.wrapQty)||0),
            box:Math.max(0, Number(m.boxQty)||0),
            crate:Math.max(0, Number(m.crateQty)||0)
        });
    });

    const crateGroups=new Map();
    [...records].sort(sortCrates).forEach(item=>{
        const crateNo=String(item.crateNo||'-').trim();
        if(!crateGroups.has(crateNo)) crateGroups.set(crateNo, []);
        crateGroups.get(crateNo).push(item);
    });

    function lineStatus(required, st){
        const req=Math.max(0, Number(required)||0);
        if(req<=0) return {status:'Ready to Pack',availableBox:0,reason:'Ready'};
        const box=st?.box||0, wrap=st?.wrap||0, punch=st?.punch||0, cut=st?.cut||0;
        if(box>=req) return {status:'Ready to Pack',availableBox:req,reason:'Ready'};
        // Stock is counted through the production flow. The first stage that
        // cannot supply the remaining requirement determines the pending label.
        if(box+wrap>=req) return {status:'Pending Box',availableBox:box,reason:'Pending Box'};
        if(box+wrap+punch>=req) return {status:'Pending Wrapping',availableBox:box,reason:'Pending Wrapping'};
        if(box+wrap+punch+cut>=req) return {status:'Pending Punch',availableBox:box,reason:'Pending Punch'};
        return {status:'Pending Cut',availableBox:box,reason:'Pending Cut'};
    }

    crateGroups.forEach(items=>{
        const crateNo=String(items[0]?.crateNo||'-').trim();
        const details=[];
        let crateReady=true;
        let crateStatus='Ready to Pack';
        let statusPriority=99;
        const priority={
            'Pending Cut':1,
            'Pending Punch':2,
            'Pending Wrapping':3,
            'Pending Box':4,
            'Ready to Pack':99,
            'Manual Packed':100
        };

        items.forEach(item=>{
            const key=`${String(item.profile||'').trim()}|${String(item.itemCode||'').trim()}|${cleanLen(item.length)}`;
            const req=Math.max(0, Number(item.pcsQty)||0);
            const st=stockMap.get(key)||{cut:0,punch:0,wrap:0,box:0,crate:0};
            const ls=lineStatus(req,st);
            const manual=isManualCrateComplete(crateNo,activePackingContainer,activePackingMonth);
            const finalStatus=manual ? 'Manual Packed' : ls.status;
            if(!manual && ls.status!=='Ready to Pack') crateReady=false;
            if(priority[finalStatus] < statusPriority){ statusPriority=priority[finalStatus]; crateStatus=finalStatus; }
            const exPlan=getExtrusionPlan(item.profile,item.itemCode,item.length,req);
            details.push({
                id:item.id, crateNo, profile:item.profile||'-', itemCode:item.itemCode||'-', length:item.length||'-',
                exLength:exPlan.exLength, pcsPerEx:exPlan.pcsPerEx, requiredExtrusions:exPlan.requiredExtrusions,
                pcsQty:req, availableBox:Math.min(req,st.box), status:finalStatus,
                cut:st.cut, punch:st.punch, wrap:st.wrap, box:st.box, crate:st.crate,
                plNumber:item.plNumber||'', poNumber:item.poNumber||'', date:item.date||''
            });
        });

        const manual=isManualCrateComplete(crateNo,activePackingContainer,activePackingMonth);
        if(manual) crateStatus='Manual Packed';
        rows.push({
            id:details[0]?.id, crateNo,
            profile:details[0]?.profile||'-', itemCode:details[0]?.itemCode||'-', length:details[0]?.length||'-',
            pcsQty:details.reduce((a,x)=>a+x.pcsQty,0),
            availableBox:details.reduce((a,x)=>a+x.availableBox,0),
            requiredExtrusions:details.reduce((a,x)=>a+(Number(x.requiredExtrusions)||0),0),
            status:crateStatus,
            profiles:details,
            profileCount:details.length,
            plNumber:details.map(x=>x.plNumber).filter(Boolean).join(', '),
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
    const data=rows.map(r=>({'Crate ID':r.crateNo,'Profile':r.profile,'Item Code':r.itemCode,'Length':r.length,'Req Qty':r.pcsQty,'Box Available':r.availableBox,'Status':r.status}));
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
        showToast('Preparing Packing List PDF...','info');
        // Clone the SAME rendered crate card that the user sees on screen.
        // This keeps the grouped-crate layout, pending reasons, profile rows,
        // colours, spacing and status badges instead of converting it to a flat table.
        const clone=source.cloneNode(true);
        cloneWrap=document.createElement('div');
        cloneWrap.style.position='fixed';
        cloneWrap.style.left='-20000px';
        cloneWrap.style.top='0';
        cloneWrap.style.width=Math.max(source.getBoundingClientRect().width,1100)+'px';
        cloneWrap.style.background='#ffffff';
        cloneWrap.style.padding='18px';
        cloneWrap.style.zIndex='-1';
        cloneWrap.style.boxSizing='border-box';

        // PDF should show the page exactly as the packing section, but buttons are not useful on paper.
        clone.querySelectorAll('button').forEach(el=>el.style.display='none');
        clone.querySelectorAll('.btn').forEach(el=>el.style.display='none');
        const title=clone.querySelector('h3');
        if(title){
            title.insertAdjacentHTML('afterend',`<div style=\"font:700 11px Arial;color:#64748b;margin:4px 0 10px 0;\">Month: ${activePackingMonth} • ${activePackingContainer} • Filter: ${filterLabel}${searchValue?` • Search: ${searchValue}`:''} • Generated: ${stamp}</div>`);
        }
        cloneWrap.appendChild(clone);
        document.body.appendChild(cloneWrap);

        // Let the browser finish layout before capturing.
        await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
        const canvas=await window.html2canvas(clone,{
            scale:2,
            useCORS:true,
            backgroundColor:'#ffffff',
            logging:false,
            width:cloneWrap.scrollWidth,
            height:cloneWrap.scrollHeight,
            windowWidth:cloneWrap.scrollWidth,
            windowHeight:Math.max(window.innerHeight,cloneWrap.scrollHeight)
        });

        const {jsPDF}=window.jspdf;
        const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
        const pageW=doc.internal.pageSize.getWidth();
        const pageH=doc.internal.pageSize.getHeight();
        const margin=6;
        const usableW=pageW-margin*2;
        const pxPerMm=canvas.width/usableW;
        const sliceHeightPx=Math.floor((pageH-margin*2)*pxPerMm);
        let y=0; let page=0;

        while(y<canvas.height){
            const h=Math.min(sliceHeightPx,canvas.height-y);
            const slice=document.createElement('canvas');
            slice.width=canvas.width; slice.height=h;
            const ctx=slice.getContext('2d');
            ctx.fillStyle='#fff'; ctx.fillRect(0,0,slice.width,slice.height);
            ctx.drawImage(canvas,0,y,canvas.width,h,0,0,canvas.width,h);
            const img=slice.toDataURL('image/jpeg',0.94);
            const imgH=h/pxPerMm;
            if(page>0) doc.addPage();
            doc.addImage(img,'JPEG',margin,margin,usableW,imgH,undefined,'FAST');
            y+=h; page++;
        }
        doc.save(`AIS_Packing_List_${String(activePackingMonth).replace(/\s+/g,'_')}_${String(activePackingContainer).replace(/\s+/g,'_')}.pdf`);
        showToast('Packing List PDF downloaded in the same grouped-crate layout.','success');
    }catch(e){
        console.error('Packing List PDF export error:',e);
        showToast(`Packing List PDF export failed: ${e?.message||e}`,'error');
    }finally{
        if(cloneWrap && cloneWrap.parentNode) cloneWrap.parentNode.removeChild(cloneWrap);
    }
};
window.exportPlConsolidated=function(){
    ensurePackingSelection();
    const rows=[]; document.querySelectorAll('#plSummaryTableBody tr').forEach(tr=>{const cells=[...tr.querySelectorAll('td')].map(td=>td.innerText.trim()); if(cells.length===10) rows.push(cells);});
    if(!rows.length) return showToast('No Packing List balance data to export!','warning');
    const headers=['Profile','Item Code','Cut Length','Ex Length','Pcs / Ex','Total Req Pcs','Req Extrusions','Current Stock (Pcs)','PL Balance','Cardboard Bal'];
    const data=rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]||''])));
    exportTableToExcel(data,'AIS_Packing_Summary_Active_PL','Packing Summary - Active PL');
};
window.exportPlConsolidatedPdf=function(){
    ensurePackingSelection();
    const rows=[]; document.querySelectorAll('#plSummaryTableBody tr').forEach(tr=>{const cells=[...tr.querySelectorAll('td')].map(td=>td.innerText.trim()); if(cells.length===10) rows.push(cells);});
    if(!rows.length) return showToast('No Packing List balance data to print!','warning');
    const headers=['Profile','Item Code','Cut Length','Ex Length','Pcs / Ex','Total Req Pcs','Req Extrusions','Current Stock (Pcs)','PL Balance','Cardboard Bal'];
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
                'Pending Box':{c:'#b45309',bg:'#fef3c7',icon:'fa-box-open',label:'Pending Box'},
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
            const actionBtn=`<div style="display:flex;gap:6px;align-items:center;justify-content:flex-end;">${manualTickHtml}${editBtn}</div>`;

            const profileCards=(row.profiles||[]).map(i=>{
                const lineBg=i.status==='Ready to Pack'||i.status==='Manual Packed'?'#ffffff':'#fffaf0';
                return `<div style="display:grid;grid-template-columns:90px minmax(145px,1.35fr) 95px 95px 85px 100px 100px minmax(115px,.9fr);gap:8px;align-items:center;padding:10px 12px;border-top:1px solid #dbe5ea;background:${lineBg};font-size:12px;">
                    <div><div style="font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;">Profile</div><b style="font-size:13px;color:#334155;">${i.profile}</b></div>
                    <div><div style="font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;">Item Code</div><span style="color:var(--info-color);font-weight:800;">${i.itemCode}</span></div>
                    <div><div style="font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;">Cut L</div><b>${i.length} mm</b></div>
                    <div><div style="font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;">Ex L</div><b style="color:#047857;">${i.exLength ? i.exLength+' mm' : '-'}</b></div>
                    <div><div style="font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;">Pcs / Ex</div><span class="stock-badge" style="background:#eff6ff;color:#0369a1;">${i.pcsPerEx || '-'}</span></div>
                    <div><div style="font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;">PL Req</div>${currentUserRole==='Admin' ? `<button type="button" class="stock-badge bg-total" style="border:0;cursor:pointer;min-width:58px;" title="Admin: click to edit Pcs Qty" onclick="openGenericEdit('packing_list', ${i.id}, {pcs_qty: '${i.pcsQty}'})">${i.pcsQty}</button>` : `<span class="stock-badge bg-total">${i.pcsQty}</span>`}</div>
                    <div><div style="font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;">Req Ex</div><span class="stock-badge" style="background:#fff7ed;color:#c2410c;">${i.requiredExtrusions || '-'}</span></div>
                    <div><div style="font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;">Box / Status</div><span class="stock-badge" style="background:#ecfdf5;color:#10b981;">${i.availableBox}</span> ${lineStatusHtml(i.status)}</div>
                </div>`;
            }).join('');

            readyCratesHTML+=`<tr class="crate-card-row">
                <td colspan="7" style="padding:0 0 16px 0;border:0;background:transparent;">
                    <div style="border:2px solid ${crateBorder};border-radius:16px;overflow:hidden;background:${crateBg};box-shadow:0 4px 14px rgba(15,23,42,.10);margin:0 2px 0 2px;position:relative;">
                        <div style="height:5px;background:${crateBorder};width:100%;"></div>
                        <div style="display:grid;grid-template-columns:140px 90px minmax(180px,1.4fr) 115px 120px 105px minmax(145px,1fr) 110px;gap:10px;align-items:center;padding:14px 16px;border-bottom:2px solid ${crateBorder};background:linear-gradient(90deg,rgba(255,255,255,.72),rgba(255,255,255,.28));">
                            <div><div style="font-size:10px;color:#64748b;font-weight:800;text-transform:uppercase;">Crate</div><b style="font-size:17px;color:#164e63;display:inline-flex;align-items:center;gap:6px;"><i class="fa-solid fa-box-open"></i>${row.crateNo}</b></div>
                            <div><div style="font-size:10px;color:#64748b;font-weight:800;text-transform:uppercase;">Profiles</div><b>${row.profileCount}</b></div>
                            <div><div style="font-size:10px;color:#64748b;font-weight:800;text-transform:uppercase;">Profiles / Items</div><span style="font-size:12px;color:#475569;">${row.profiles.map(x=>x.itemCode).join(' • ')}</span></div>
                            <div><div style="font-size:10px;color:#64748b;font-weight:800;text-transform:uppercase;">PL Req Total</div><span class="stock-badge bg-total">${row.pcsQty}</span></div>
                            <div><div style="font-size:10px;color:#64748b;font-weight:800;text-transform:uppercase;">Box Stage Total</div><span class="stock-badge" style="background:#ecfdf5;color:#10b981;">${row.availableBox}</span></div>
                            <div><div style="font-size:10px;color:#64748b;font-weight:800;text-transform:uppercase;">Req Extrusions</div><span class="stock-badge" style="background:#fff7ed;color:#c2410c;">${row.requiredExtrusions || '-'}</span></div>
                            <div><div style="font-size:10px;color:#64748b;font-weight:800;text-transform:uppercase;">Crate Status</div>${crateStatusHtml(row.status)}</div>
                            <div>${actionBtn}</div>
                        </div>
                        <div style="padding:0;background:#fff;">
                            <div style="display:grid;grid-template-columns:90px minmax(145px,1.35fr) 95px 95px 85px 100px 100px minmax(115px,.9fr);gap:8px;align-items:center;padding:8px 12px;background:#dcecf0;color:#164e63;border-bottom:1px solid #c7dfe5;font-size:10px;font-weight:800;text-transform:uppercase;">
                                <div>Profile</div><div>Item Code</div><div>Cut L</div><div>Ex L</div><div>Pcs / Ex</div><div>PL Req Pcs</div><div>Req Ex</div><div>Box / Status</div>
                            </div>
                            ${profileCards}
                        </div>
                    </div>
                </td>
            </tr>`;
        });
        const readySummary=document.getElementById('plReadyFilterSummary');
        if(readySummary) readySummary.textContent=`${readyFiltered.length} crates shown • ${readyRows.length} total in ${activePackingContainer} • ${statusFilter||'All statuses'}`;
        let rawHTML = '';
        filtered.forEach(pl => {
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
            let currentStock = matched ? ((matched.cutQty||0) + (matched.punchQty||0) + (matched.wrapQty||0) + (matched.boxQty||0) + (matched.crateQty||0)) : 0;
            let bal = currentStock - v.qty;
            if(!matchesBalanceFilter(bal, plSummaryMode)) return '';
            let balStatus = bal >= 0 ? `<span class="pl-balance-badge pl-balance-positive"><i class="fa-solid fa-check"></i> +${bal}</span>` : `<span class="pl-balance-badge pl-balance-negative"><i class="fa-solid fa-arrow-down"></i> ${Math.abs(bal)}</span>`;
            let wipPcs = matched ? ((matched.cutQty||0) + (matched.punchQty||0) + (matched.wrapQty||0)) : 0;
            let plPendingQty = Math.max(0, v.qty - currentStock);
            let unboxedAndPendingPcs = plPendingQty + wipPcs;
            let cap = matched ? (matched.boxCapacity || 100) : 100;
            let reqBoxes = Math.ceil(unboxedAndPendingPcs / cap);
            let availCardboard = getAvailableCardboard(v.profile, v.itemCode, v.length);
            let cbBalance = availCardboard - reqBoxes;
            let cbStatusHtml = cbBalance >= 0 ? `<span style="color:var(--success-color);font-weight:800;">OK (+${cbBalance})</span>` : `<span style="color:var(--warning-color);font-weight:800;">Short ${Math.abs(cbBalance)}</span>`;
            const plan=getExtrusionPlan(v.profile,v.itemCode,v.length,v.qty);
            return `<tr><td><b>${v.profile}</b></td><td><span style="color:var(--info-color);font-weight:600;">${v.itemCode}</span></td><td>${v.length} mm</td><td>${plan.exLength ? plan.exLength+' mm' : '-'}</td><td><span class="stock-badge" style="background:#eff6ff;color:#0369a1;">${plan.pcsPerEx || '-'} Pcs</span></td><td><span class="stock-badge bg-total">${v.qty} Pcs</span></td><td><span class="stock-badge" style="background:#fff7ed;color:#c2410c;">${plan.requiredExtrusions || '-'} Ex</span></td><td><span class="stock-badge bg-wrap">${currentStock} Pcs</span></td><td><b>${balStatus}</b></td><td style="background:${cbBalance < 0 ? 'rgba(225, 29, 72, 0.05)' : 'rgba(16, 185, 129, 0.05)'};">${cbStatusHtml}</td></tr>`;
        }).filter(Boolean).join('');

        const sumTbody = document.getElementById('plSummaryTableBody'); if (sumTbody) sumTbody.innerHTML = consHTML || '<tr><td colspan="10" style="text-align:center;padding:24px;color:#64748b;font-weight:700;">No active PL lines match this balance filter.</td></tr>';
        const readyTbody = document.getElementById('plReadyToPackTableBody'); if (readyTbody) readyTbody.innerHTML = readyCratesHTML || '<tr><td colspan="7" style="text-align:center; color:var(--text-muted);padding:30px;">No crates match this status</td></tr>';
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
 if(isAppBusy)return; isAppBusy=true;
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
  packingLists.unshift({id:inserted?.id||-Date.now(),plNumber:plNum,poNumber:poNum,month:filterMonth,container,crateNo,profile,itemCode,length,boxQty:1,pcsQty,netWeight,grossWeight,date:plDate});
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
  renderPackingListTable();
 }catch(e){console.error(e);showToast(e.message||'Packing List save failed.','error');}finally{isAppBusy=false;}
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
  const roman=['i','ii','iii','iv','v','vi','vii','viii','ix','x','xi','xii','xiii','xiv','xv','xvi','xvii','xviii','xix','xx'];
  const toRoman=n=>roman[n-1]||String(n);
  const normalHeader=h=>{
    const raw=String(h??'').replace(/\uFEFF/g,'').trim().toLowerCase();
    const compact=raw.replace(/[^a-z0-9]/g,'');
    // Accept both the 7-column website template and the user's existing
    // Packing List format: '#', 'PO #', 'Profile #', etc.
    if(raw==='#') return 'crateno';
    if(compact==='po') return 'ponumber';
    if(compact==='profileno') return 'profile';
    if(compact==='cratenumber') return 'crateno';
    if(compact==='pcspercrateqty') return 'pcspercrate';
    return compact;
  };
  const requiredHeaders=['crateno','ponumber','profile','itemcode','numberofcrates','pcspercrate','totalqty'];

  try{
    // The website selectors are the source of truth for this upload target.
    activePackingMonth=uploadMonth;
    activePackingContainer=uploadContainer;

    const data=new Uint8Array(await file.arrayBuffer());
    const workbook=XLSX.read(data,{type:'array',cellDates:true});
    if(!workbook.SheetNames?.length) throw new Error('The Excel workbook has no worksheets.');

    // IMPORTANT: The user's workbook can contain Production Orders on the first
    // sheet and the Packing List on another sheet (normally Sheet2). Search ALL
    // worksheets instead of assuming the first sheet is the Packing List.
    let worksheet=null, rawJson=null, headerRowIndex=-1, headers=[], packingSheetName='';
    for(const sheetName of workbook.SheetNames){
      const candidate=workbook.Sheets[sheetName];
      const candidateJson=XLSX.utils.sheet_to_json(candidate,{header:1,defval:''});
      for(let i=0;i<Math.min(50,candidateJson.length);i++){
        const row=(candidateJson[i]||[]).map(normalHeader);
        if(requiredHeaders.every(h=>row.includes(h))){
          worksheet=candidate; rawJson=candidateJson; headerRowIndex=i; headers=row; packingSheetName=sheetName;
          break;
        }
      }
      if(worksheet) break;
    }
    if(!worksheet || headerRowIndex<0) throw new Error('Required Packing List headers were not found in any Excel sheet. Required: Crate No, PO Number, Profile, Item Code, Number of Crates, Pcs per Crate, Total Qty.');

    const col={}; requiredHeaders.forEach(h=>col[h]=headers.indexOf(h));
    const rowsToInsert=[];
    const errors=[];
    const seen=new Set();

    for(let i=headerRowIndex+1;i<rawJson.length;i++){
      const row=rawJson[i];
      if(!row || row.every(v=>String(v??'').trim()==='')) continue;
      const excelRow=i+1;
      const get=h=>row[col[h]];
      const crateRaw=String(get('crateno')??'').trim().replace(/^crate\s*/i,'').replace(/\.0$/,'');
      const poNum=String(get('ponumber')??'').trim().replace(/\.0$/,'');
      let profile=String(get('profile')??'').trim();
      const itemCode=String(get('itemcode')??'').trim();
      // Ignore Excel total/subtotal rows. They are not Packing List records.
      if(!poNum && !profile && !itemCode) continue;
      const numberOfCrates=Number(get('numberofcrates'));
      const pcsPerCrate=Number(get('pcspercrate'));
      const totalQty=Number(get('totalqty'));
      if(!crateRaw||!poNum||!profile||!itemCode||!Number.isInteger(numberOfCrates)||numberOfCrates<1||!Number.isInteger(pcsPerCrate)||pcsPerCrate<1||!Number.isFinite(totalQty)||totalQty<1){
        errors.push(`Row ${excelRow}: all 7 required values must be valid.`); continue;
      }
      if(totalQty!==numberOfCrates*pcsPerCrate){errors.push(`Row ${excelRow}: Total Qty must equal Number of Crates × Pcs per Crate.`);continue;}
      if(profile.toUpperCase().startsWith('AL-')) profile=profile.substring(3).trim();
      const normalizeProfile=v=>String(v??'').trim().toUpperCase().replace(/^AL-\s*/,'');

      const catalogMatches=masterData.filter(m=>normalizeProfile(m.profile)===normalizeProfile(profile) && String(m.itemCode||'').trim().toUpperCase()===itemCode.toUpperCase());
      if(catalogMatches.length===0){errors.push(`Row ${excelRow}: Profile ${profile} + Item Code ${itemCode} was not found in Master Catalog.`);continue;}
      if(catalogMatches.length>1){errors.push(`Row ${excelRow}: Profile ${profile} + Item Code ${itemCode} matches multiple Master Catalog lengths. Excel has no Length column, so this row was not imported for safety.`);continue;}
      const cat=catalogMatches[0];
      const length=cleanLen(cat.length);
      const unitWeight=Number(cat.unitWeight)||0;
      if(!length){errors.push(`Row ${excelRow}: Master Catalog length is missing for ${profile} / ${itemCode}.`);continue;}

      const hasSuffix=/-[a-z]+$/i.test(crateRaw);
      if(hasSuffix && numberOfCrates!==1){errors.push(`Row ${excelRow}: Crate No ${crateRaw} already has a suffix; use Number of Crates = 1.`);continue;}
      const crateNames=hasSuffix?[crateRaw]:Array.from({length:numberOfCrates},(_,k)=>numberOfCrates>1?`${crateRaw}-${toRoman(k+1)}`:crateRaw);
      for(const crateName of crateNames){
        const uniqueKey=`${uploadMonth}|${uploadContainer}|${poNum}|${crateName}|${profile}|${itemCode}|${length}`.toLowerCase();
        if(seen.has(uniqueKey)){errors.push(`Row ${excelRow}: duplicate crate/profile/item entry in this Excel file (${crateName}).`);continue;}
        seen.add(uniqueKey);
        const netWeight=Number((pcsPerCrate*unitWeight).toFixed(2));
        rowsToInsert.push({pl_number:defaultPlNum,po_number:poNum,shipment_month:uploadMonth,container:uploadContainer,crate_no:`Crate ${crateName}`,profile,item_code:itemCode,length,box_qty:1,pcs_qty:pcsPerCrate,net_weight:netWeight,gross_weight:netWeight,packing_date:uploadDate});
      }
    }

    if(errors.length) throw new Error(errors.slice(0,8).join(' | ')+(errors.length>8?` | +${errors.length-8} more errors`:''));
    if(!rowsToInsert.length) throw new Error('No valid packing rows were found.');

    // Safety check: do not insert records that already exist for the selected PL target.
    const {data:existing,error:existingError}=await supabaseClient.from('packing_list').select('po_number,crate_no,profile,item_code,length,shipment_month,container').eq('shipment_month',uploadMonth).eq('container',uploadContainer);
    if(existingError) throw existingError;
    const existingKeys=new Set((existing||[]).map(x=>`${String(x.shipment_month||'').trim()}|${String(x.container||'').trim()}|${String(x.po_number||'').trim()}|${String(x.crate_no||'').replace(/^crate\s*/i,'').trim()}|${String(x.profile||'').trim()}|${String(x.item_code||'').trim()}|${cleanLen(x.length)}`.toLowerCase()));
    const duplicateRows=rowsToInsert.filter(x=>existingKeys.has(`${uploadMonth}|${uploadContainer}|${x.po_number}|${x.crate_no.replace(/^crate\s*/i,'')}|${x.profile}|${x.item_code}|${cleanLen(x.length)}`.toLowerCase()));
    if(duplicateRows.length) throw new Error(`Upload stopped safely: ${duplicateRows.length} record(s) already exist in ${uploadMonth} / ${uploadContainer}. Existing data was not changed.`);

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
    window.onPlExcelUploadSelectionChange();
    showToast(`${uploadMonth} / ${uploadContainer} Packing List uploaded successfully: ${rowsToInsert.length} crate-item records from sheet '${packingSheetName}'.`,`success`);
    renderPackingListTable(); renderDashboard(); renderBalanceWorkTable();
  }catch(err){
    console.error('Packing List Excel upload error:',err);
    showToast(`Upload failed: ${err?.message||'Invalid Excel or database error'}`,'error');
  }finally{
    if(uploadBtn){uploadBtn.innerHTML=originalBtnText;uploadBtn.disabled=false;}
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
  const profile=document.getElementById('filterPoProfile')?.value||''; const item=document.getElementById('filterPoItemCode'); if(!item)return;
  item.innerHTML='<option value="">All Item Codes</option>';
  [...new Set(poList.filter(p=>!profile||String(p.profile).trim()===profile).map(p=>p.itemCode).filter(Boolean))].forEach(v=>item.appendChild(new Option(v,v)));
  renderPoDetailsTable();
}
function updatePoFilters(){
  const pn=document.getElementById('filterPoNumber'), pf=document.getElementById('filterPoProfile'), pi=document.getElementById('filterPoItemCode');
  if(!pn||!pf||!pi)return;
  const oldN=pn.value,oldP=pf.value,oldI=pi.value;
  pn.innerHTML='<option value="">All PO Numbers</option>'; [...new Set(poList.map(p=>p.poNumber).filter(Boolean))].forEach(v=>pn.appendChild(new Option(v,v)));
  pf.innerHTML='<option value="">All Profiles</option>'; [...new Set(poList.map(p=>String(p.profile||'').trim()).filter(Boolean))].forEach(v=>pf.appendChild(new Option(v,v)));
  pn.value=oldN; pf.value=oldP;
  pi.innerHTML='<option value="">All Item Codes</option>';
  [...new Set(poList.filter(p=>!pf.value||String(p.profile).trim()===pf.value).map(p=>{
    const ic=(typeof resolveMasterItemCode==='function'?resolveMasterItemCode(p.profile,p.length,p.itemCode):p.itemCode)||'';
    p.itemCode=ic; return ic;
  }).filter(Boolean))].forEach(v=>pi.appendChild(new Option(v,v)));
  pi.value=oldI;
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
