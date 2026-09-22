/* CareRelay — UI shell, router and 15 screens */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function toast(msg) { const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg; document.body.appendChild(el); setTimeout(() => el.remove(), 3800); }
function go(h) { location.hash = h; }
const route = () => (location.hash.slice(1) || 'login').split('/');

const LOGO = `<svg width="30" height="30" viewBox="0 0 32 32" aria-label="CareRelay logo"><rect width="32" height="32" rx="9" fill="#0f9e8e"/><path d="M6 20h5.5l3-8 3.2 12 3-8H24" stroke="#04221f" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const STATUS_TAG = { Confirmed: 't-ok', LastKnown: 't-info', Pending: 't-warn', Expired: 't-bad', Unavailable: 't-bad' };
const sTag = s => `<span class="tag ${STATUS_TAG[s] || 't-mute'}">${s === 'LastKnown' ? 'Last Known' : s}</span>`;
const stateTag = s => `<span class="tag ${s === 'Followed-up' ? 't-ok' : s === 'Requested' ? 't-warn' : 't-info'}">${s}</span>`;

const NAV = {
  ASHA: [['asha', 'ASHA Dashboard'], ['register', 'Register Patient'], ['followup', 'Follow-ups'], ['sync', 'Offline Queue']],
  FACILITY: [['hospital', 'Referral Inbox'], ['readiness', 'Facility Readiness'], ['revalidate', 'Pre-Travel Revalidation'], ['lab', 'Lab & Pharmacy']],
  DOCTOR: [['doctor', 'Doctor Dashboard'], ['hospital', 'Referral Inbox'], ['readiness', 'Facility Readiness']],
  LAB: [['lab', 'Lab & Pharmacy'], ['readiness', 'Facility Readiness']],
  ADMIN: [['admin', 'District Dashboard'], ['hospital', 'All Referrals'], ['readiness', 'Facility Readiness'], ['audit', 'Audit Log']],
  PATIENT: [['patients', 'My Care Card']]
};

/* ============================ SHELL ============================ */
function render() {
  const r = route();
  if (!DB.meta.role || r[0] === 'login') return renderLogin();
  const nav = (NAV[DB.meta.role] || []).concat([['demo', 'Guided Demo'], ['patients', 'Patients']]);
  $('#app').innerHTML = `<div class="shell">
    <aside>
      <div class="logo">${LOGO}<div><b>CareRelay</b><span>Journey-ready care</span></div></div>
      <nav>
        <div class="grp">${DB.meta.role} · ${esc(usr(DB.meta.userId))}</div>
        ${nav.map(([h, l]) => `<a href="#${h}" class="${r[0] === h ? 'on' : ''}">${l}${h === 'sync' && pendingCount() ? `<span class="pill">${pendingCount()}</span>` : ''}${h === 'followup' && DB.followups.filter(f => f.state !== 'Done').length ? `<span class="pill">${DB.followups.filter(f => f.state !== 'Done').length}</span>` : ''}</a>`).join('')}
        <div class="grp">Session</div>
        <a href="#login">Switch role</a>
        <a href="#" onclick="resetDB();go('login');return false">Reset demo data</a>
      </nav>
      <div style="margin-top:auto;font-size:11px;color:#7fa8a5;padding:10px">Prototype with DEMO DATA. No live ABDM / eSanjeevani connection.</div>
    </aside>
    <main id="main"></main></div>`;
  const body = {
    asha: scAsha, register: scRegister, patients: scPatients, patient: scPatient, triage: scTriage, refer: scRefer,
    hospital: scHospital, readiness: scReadiness, bundle: scBundle, revalidate: scRevalidate, doctor: scDoctor,
    lab: scLab, card: scCard, followup: scFollowup, admin: scAdmin, audit: scAudit, sync: scSync, demo: scDemo
  }[r[0]] || scAsha;
  $('#main').innerHTML = body(r.slice(1));
}
function head(title, sub, actions) {
  return `<div class="topbar"><div><h1>${title}</h1><p>${sub || ''}</p></div><div class="spacer"></div>
    <div class="offline"><span class="dot ${DB.meta.offline ? 'off' : ''}"></span>${DB.meta.offline ? 'Offline mode' : 'Online'}</div>
    <button class="btn alt mini" onclick="DB.meta.offline=!DB.meta.offline;save();render()">${DB.meta.offline ? 'Go online' : 'Simulate offline'}</button>
    <button class="btn mini" onclick="syncNow();render()">Sync Now${pendingCount() ? ' (' + pendingCount() + ')' : ''}</button>
    ${actions || ''}</div>`;
}

/* ============================ 1. LOGIN ============================ */
function renderLogin() {
  const roles = [
    ['U1', 'ASHA / ANM', 'Register patients offline, triage, create referrals, close follow-ups'],
    ['U3', 'PHC / Rural Hospital staff', 'Accept referrals, schedule, verify readiness, revalidate before travel'],
    ['U4', 'Doctor / Clinician', 'Review vitals and results, decide next stage, sign off referrals'],
    ['U5', 'Lab / Pharmacy staff', 'Update reagent, equipment and medicine claims; upload results'],
    ['U7', 'District 
