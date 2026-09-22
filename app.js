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
    ['U7', 'District Administrator', 'Monitor bottlenecks, readiness failures, overdue referrals'],
    ['PT', 'Patient view', 'Printed / low-literacy care card in English, Marathi, Hindi']
  ];
  $('#app').innerHTML = `<div class="login"><div class="box">
    <div class="row tight" style="align-items:center;gap:12px">${LOGO}<div><h1 style="margin:0;font-size:22px;letter-spacing:-.02em">CareRelay</h1>
    <p class="muted" style="margin:2px 0 0">SIH26133 · care-readiness verification layer over eSanjeevani + ABDM</p></div></div>
    <div class="banner b-info" style="margin:16px 0"><b>We do not book appointments. We verify that care is actually ready — and we say so when it is not.</b></div>
    <p class="muted">Select a role to enter the prototype. All data on this device is demo data.</p>
    <div class="roles">${roles.map(([id, n, d]) => `<button class="role" onclick="pick('${id}')"><b>${n}</b><small>${d}</small></button>`).join('')}</div>
    <div class="row tight" style="margin-top:16px"><label style="margin:0">Patient-facing language</label>
      ${['mr', 'en', 'hi'].map(l => `<button class="btn ${DB.meta.lang === l ? 'acc' : 'alt'} mini" onclick="DB.meta.lang='${l}';save();renderLogin()">${{ en: 'English', mr: 'मराठी', hi: 'हिंदी' }[l]}</button>`).join('')}
    </div>
    <p class="muted" style="margin-top:18px;font-size:13px">CareRelay runs on top of eSanjeevani and ABDM. No hospital installs a new system. Strengthening — not replacing — the public health system.</p>
  </div></div>`;
}
function pick(id) {
  if (id === 'PT') { DB.meta.role = 'PATIENT'; DB.meta.userId = 'U1'; save(); return go('card/R-1039'); }
  const u = by(DB.users, id); DB.meta.role = u.role; DB.meta.userId = u.id; save();
  go({ ASHA: 'asha', FACILITY: 'hospital', DOCTOR: 'doctor', LAB: 'lab', ADMIN: 'admin' }[u.role]);
}

/* ============================ 2. ASHA DASHBOARD ============================ */
function scAsha() {
  const mine = DB.patients.filter(p => p.createdBy === DB.meta.userId || true);
  const myRefs = DB.referrals.filter(r => r.createdBy === DB.meta.userId || DB.meta.role !== 'ASHA');
  const fu = DB.followups.filter(f => f.assignedTo === DB.meta.userId && f.state !== 'Done');
  return head('ASHA field dashboard', esc(usr(DB.meta.userId)) + ' · ' + fac(by(DB.users, DB.meta.userId).facilityId),
    `<button class="btn acc mini" onclick="go('register')">+ New patient</button>`) + `
  <div class="grid g4" style="margin-bottom:14px">
    ${kpi(mine.length, 'Patients')}${kpi(myRefs.filter(r => r.state !== 'Followed-up').length, 'Open referrals')}
    ${kpi(fu.length, 'Follow-ups due')}${kpi(pendingCount(), 'Queued offline')}</div>
  <div class="grid g2">
    <div class="card"><h3>My referrals — journey status</h3><table><tr><th>Patient</th><th>Referral</th><th>Stage</th><th>Journey</th><th></th></tr>
    ${myRefs.map(r => { const b = bundleFor(r.id); return `<tr><td><b>${esc(pat(r.patientId).name)}</b><div class="muted">${esc(pat(r.patientId).village)} · ${pat(r.patientId).distanceKm} km</div></td>
      <td class="mono">${r.id}</td><td>${stateTag(r.state)}${isOverdue(r) ? ' <span class="tag t-bad">Overdue</span>' : ''}</td>
      <td>${b ? (b.status === 'READY' ? '<span class="tag t-ok">TRAVEL READY</span>' : '<span class="tag t-bad">NOT READY</span>') : '<span class="tag t-mute">No bundle</span>'}</td>
      <td><button class="btn alt mini" onclick="go('bundle/${r.id}')">Open</button></td></tr>`; }).join('')}</table></div>
    <div class="card"><h3>Patients</h3><table><tr><th>Name</th><th>Age</th><th>Village</th><th>Sync</th><th></th></tr>
    ${mine.map(p => `<tr><td>${esc(p.name)}</td><td>${p.age}${p.sex}</td><td>${esc(p.village)}</td>
      <td>${p.synced ? '<span class="tag t-ok">Synced</span>' : '<span class="tag t-warn">On device</span>'}</td>
      <td><button class="btn alt mini" onclick="go('patient/${p.id}')">Open</button></td></tr>`).join('')}</table></div>
    <div class="card"><h3>Follow-up tasks assigned to me</h3>${fu.length ? `<ul class="list">${fu.map(f => `<li><b>${esc(pat(f.patientId).name)}</b> — ${esc(f.task)} <span class="tag ${f.state === 'Overdue' ? 't-bad' : 't-warn'}">${f.state} ${rel(f.dueAt)}</span></li>`).join('')}</ul>` : '<p class="muted">Nothing pending.</p>'}
      <button class="btn alt mini" style="margin-top:10px" onclick="go('followup')">Open follow-up dashboard</button></div>
    <div class="card"><h3>Device sync</h3><p class="muted">Registration, vitals and referrals work fully offline. Live facts (slots, stock) are shown as <b>Last Known</b> until the device syncs.</p>
      <div class="row tight"><button class="btn" onclick="syncNow();render()">Sync Now</button><button class="btn alt" onclick="go('sync')">View queue (${pendingCount()})</button></div></div>
  </div>`;
}
const kpi = (v, l) => `<div class="card kpi"><small>${l}</small><b>${v}</b></div>`;
