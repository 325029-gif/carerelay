/* CareRelay — domain logic: readiness expiry, referral state machine, bundle, offline sync */
const KEY = 'carerelay.v3';
/* Offline store shim: an in-memory key/value store standing in for the device
   database (IndexedDB/SQLite in production). Keeps the prototype embeddable. */
const STORE = { _m: {}, getItem(k) { return this._m[k] || null; }, setItem(k, v) { this._m[k] = v; }, removeItem(k) { delete this._m[k]; } };
let DB = load();

function load() {
  try {
    const raw = STORE.getItem(KEY);
    if (raw) { const d = JSON.parse(raw); if (d.meta && d.meta.version === 3) return d; }
  } catch (e) {}
  const d = seed(); STORE.setItem(KEY, JSON.stringify(d)); return d;
}
function save() { STORE.setItem(KEY, JSON.stringify(DB)); }
function resetDB() { STORE.removeItem(KEY); DB = load(); }
const uid = (p) => p + '-' + Math.random().toString(36).slice(2, 7).toUpperCase();
const by = (arr, id) => arr.find(x => x.id === id);
const fac = id => (by(DB.facilities, id) || { name: '—' }).name;
const usr = id => (by(DB.users, id) || { name: 'Unassigned' }).name;
const pat = id => by(DB.patients, id) || { name: 'Unknown' };

/* ---------- time helpers ---------- */
function fmt(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
}
function rel(ts) {
  const m = Math.round((ts - now()) / 60000), a = Math.abs(m);
  if (a < 1) return 'just now';
  const s = a < 60 ? a + 'm' : a < 1440 ? Math.round(a / 60) + 'h' : Math.round(a / 1440) + 'd';
  return m >= 0 ? 'in ' + s : s + ' ago';
}

/* ---------- 1. EXPIRY-AWARE READINESS ---------- */
/* A claim is only as good as its validity window. Statuses:
   Confirmed | LastKnown | Pending | Expired | Unavailable                    */
function claimStatus(k) {
  if (!k) return 'Pending';
  if (k.claim === 'Unavailable') return 'Unavailable';
  const validUntil = k.verifiedAt + k.validHours * HOUR;
  if (now() > validUntil) return 'Expired';
  return k.claim; // Confirmed | LastKnown | Pending
}
const validUntil = k => k.verifiedAt + k.validHours * HOUR;
const READY_OK = s => s === 'Confirmed';
function facilityReadiness(facilityId) {
  return DB.readiness.filter(k => k.facilityId === facilityId)
    .map(k => ({ ...k, status: claimStatus(k), validUntil: validUntil(k) }));
}
function verifyClaim(kid, claim, hours, userId, detail) {
  const k = by(DB.readiness, kid); if (!k) return;
  k.claim = claim; k.verifiedAt = now(); k.validHours = hours || k.validHours;
  k.by = userId || DB.meta.userId; if (detail) k.detail = detail;
  log('READINESS_VERIFY', k.facilityId + '/' + k.resource + '=' + claim);
  revalidateAll(); save();
}

/* ---------- 2. TRAVEL-READY CARE BUNDLE ---------- */
function bundleFor(refId) { return DB.bundles.find(b => b.referralId === refId); }
function evaluateBundle(ref) {
  const claims = facilityReadiness(ref.toFacility);
  const items = ref.requiredResources.map(r => {
    const k = claims.find(c => c.resource === r);
    return { resource: r, detail: k ? k.detail : 'No claim recorded', status: k ? k.status : 'Pending',
             verifiedAt: k ? k.verifiedAt : null, validUntil: k ? k.validUntil : null, owner: k ? k.by : null, kid: k ? k.id : null };
  });
  const appt = DB.appointments.find(a => a.referralId === ref.id);
  items.unshift({ resource: 'Appointment', detail: appt ? `${fmt(appt.at)} · ${appt.dept} · slot ${appt.slot}` : 'Not scheduled',
                  status: appt ? 'Confirmed' : 'Pending', verifiedAt: appt ? appt.at : null, validUntil: null, owner: appt ? appt.coordinator : null });
  const failed = items.filter(i => !READY_OK(i.status));
  return { items, failed, ready: failed.length === 0 && ['Scheduled', 'Attended', 'Reviewed', 'Followed-up'].includes(ref.state) };
}
function generateBundle(refId, transport, fallback) {
  const ref = by(DB.referrals, refId); if (!ref) return;
  let b = bundleFor(refId);
  const ev = evaluateBundle(ref);
  if (!b) {
    b = { id: uid('B'), referralId: refId, createdAt: now(), lastValidatedAt: now(),
          status: ev.ready ? 'READY' : 'NOT_READY',
          transport: transport || 'Sub-centre transport to be confirmed by coordinator',
          fallback: fallback || 'If any component fails → coordinator reschedules to next available slot and informs ASHA' };
    DB.bundles.push(b);
  } else { b.lastValidatedAt = now(); b.status = ev.ready ? 'READY' : 'NOT_READY'; }
  log('BUNDLE_GENERATE', refId + ' → ' + b.status); save(); return b;
}
/* ---------- 3. PRE-TRAVEL REVALIDATION ---------- */
function revalidate(refId, actor) {
  const ref = by(DB.referrals, refId); const b = bundleFor(refId); if (!ref || !b) return null;
  const ev = evaluateBundle(ref);
  b.lastValidatedAt = now(); b.status = ev.ready ? 'READY' : 'NOT_READY';
  if (!ev.ready) {
    ev.failed.forEach(f => {
      notify(f.owner || ref.owner, `REVALIDATION FAILED for ${ref.id} (${pat(ref.patientId).name}): ${f.resource} is ${f.status}. Fix or reschedule before travel.`);
    });
  }
  log('REVALIDATE', `${refId} → ${b.status}${ev.ready ? '' : ' [' + ev.failed.map(f => f.resource).join(',') + ']'}`, actor);
  save(); return { bundle: b, ev };
}
function revalidateAll() { DB.bundles.forEach(b => { const r = by(DB.referrals, b.referralId); if (r) b.status = evaluateBundle(r).ready ? 'READY' : 'NOT_READY'; }); }

/* ---------- 4. ACCOUNTABLE REFERRAL CLOSURE ---------- */
const FLOW = ['Requested', 'Accepted', 'Scheduled', 'Attended', 'Reviewed', 'Followed-up'];
const SLA = { Requested: 12, Accepted: 24, Scheduled: 72, Attended: 24, Reviewed: 48, 'Followed-up': 0 }; // hours for the NEXT step
const NEXT_OWNER = { Requested: 'FACILITY', Accepted: 'FACILITY', Scheduled: 'FACILITY', Attended: 'DOCTOR', Reviewed: 'ASHA' };
const ACTOR_FOR = { Accepted: 'U3', Scheduled: 'U3', Attended: 'U3', Reviewed: 'U4' };
function advance(refId, to, actor, note) {
  const ref = by(DB.referrals, refId); if (!ref) return;
  actor = actor || ACTOR_FOR[to] || DB.meta.userId;
  const i = FLOW.indexOf(ref.state);
  if (FLOW.indexOf(to) !== i + 1) { toast('Invalid transition ' + ref.state + ' → ' + to); return; }
  if (to === 'Attended') { const b = bundleFor(refId); if (!b || b.status !== 'READY') { toast('Blocked: bundle is NOT READY. Fix the failed component and revalidate.'); return; } }
  ref.state = to; ref.history.push({ state: to, at: now(), by: actor || DB.meta.userId, note: note || '' });
  const role = NEXT_OWNER[to];
  ref.owner = role ? (DB.users.find(u => u.role === role && u.facilityId === ref.toFacility) || DB.users.find(u => u.role === role)).id : ref.createdBy;
  ref.dueAt = now() + (SLA[to] || 24) * HOUR;
  if (to === 'Reviewed') {
    const f = { id: uid('FU'), referralId: refId, patientId: ref.patientId, assignedTo: ref.createdBy,
                task: 'Post-visit follow-up: confirm medicines taken, repeat vitals, counsel in local language', dueAt: now() + 3 * DAY, state: 'Due', createdAt: now() };
    DB.followups.push(f); notify(ref.createdBy, `Follow-up ${f.id} assigned for ${pat(ref.patientId).name} (${refId}).`);
  }
  if (to === 'Followed-up') { ref.closedAt = now(); ref.dueAt = null; }
  notify(ref.owner, `${refId} moved to ${to}. You own the next step, due ${fmt(ref.dueAt)}.`);
  log('REFERRAL_' + to.toUpperCase(), refId, actor); save();
}
const isOverdue = r => r.dueAt && r.state !== 'Followed-up' && now() > r.dueAt;
function escalate(refId) { const r = by(DB.referrals, refId); if (!r) return; r.escalated = true; notify('U7', `ESCALATION: ${refId} overdue at stage ${r.state} (owner ${usr(r.owner)}).`); log('ESCALATE', refId); save(); }

/* ---------- RULE-BASED TRIAGE (no AI/ML — transparent rules) ---------- */
function triage(v, patient) {
  const flags = [], rules = [];
  const add = (cond, msg, level) => { rules.push({ msg, hit: !!cond, level }); if (cond) flags.push({ msg, level }); };
  add(v.glucose >= 300 || v.bpSys >= 180 || v.bpDia >= 120 || v.spo2 < 90, 'Critical vitals — emergency pathway', 'EMERGENCY');
  add(v.glucose >= 200 && v.glucose < 300, 'Glucose 200–299 mg/dL — needs lab confirmation (HbA1c/FBS)', 'FACILITY');
  add(v.bpSys >= 140 || v.bpDia >= 90, 'Raised BP — clinician review needed', 'TELE');
  add(v.spo2 >= 90 && v.spo2 < 95, 'Low SpO2 — local diagnostics + review', 'FACILITY');
  add(v.temp >= 101, 'Fever ≥101°F — local diagnostics (malaria/dengue screen)', 'LOCAL');
  add(patient && patient.age >= 60 && (v.bpSys >= 140 || v.glucose >= 180), 'Elderly with raised readings — prioritise', 'FACILITY');
  let outcome = 'ROUTINE';
  if (flags.some(f => f.level === 'EMERGENCY')) outcome = 'EMERGENCY';
  else if (flags.some(f => f.level === 'FACILITY')) outcome = 'FACILITY_VISIT';
  else if (flags.some(f => f.level === 'LOCAL')) outcome = 'LOCAL_DIAGNOSTICS';
  else if (flags.some(f => f.level === 'TELE')) outcome = 'TELECONSULT';
  return { outcome, flags, rules };
}

/* ---------- OFFLINE-FIRST SYNC ---------- */
/* Writes while offline are appended to a local queue with a device timestamp and
   marked unsynced. Live facts (stock, slots) are NEVER invented offline — the UI
   shows Last Known / Pending instead.                                          */
function write(kind, payload, label) {
  payload.synced = !DB.meta.offline;
  const coll = { patient: 'patients', encounter: 'encounters', vital: 'vitals', referral: 'referrals', order: 'orders', followup: 'followups' }[kind];
  DB[coll].push(payload);
  if (DB.meta.offline) {
    DB.syncQueue.push({ id: uid('Q'), kind, ref: payload.id, label, queuedAt: now(), state: 'Pending' });
    toast('Saved on device. Queued for sync: ' + label);
  } else { toast('Saved and synced: ' + label); }
  log(kind.toUpperCase() + '_CREATE', payload.id, null, DB.meta.offline ? 'offline' : 'online'); save();
}
function syncNow() {
  if (DB.meta.offline) { toast('Still offline — turn connectivity on to sync.'); return 0; }
  let n = 0;
  DB.syncQueue.filter(q => q.state === 'Pending').forEach(q => {
    q.state = 'Synced'; q.syncedAt = now(); n++;
    ['patients', 'encounters', 'vitals', 'referrals', 'orders', 'followups'].forEach(c => { const o = by(DB[c], q.ref); if (o) o.synced = true; });
  });
  DB.syncQueue = DB.syncQueue.filter(q => q.state !== 'Synced' || now() - q.syncedAt < 60 * DAY);
  log('SYNC_FLUSH', n + ' records'); save(); toast(n ? n + ' record(s) synced to server.' : 'Nothing pending.'); return n;
}
const pendingCount = () => DB.syncQueue.filter(q => q.state === 'Pending').length;

/* ---------- notifications / audit ---------- */
function notify(to, text) { DB.notifications.unshift({ id: uid('N'), to, at: now(), text, read: false }); }
function log(action, target, actor, mode) {
  DB.audit.unshift({ id: uid('L'), at: now(), actor: actor || DB.meta.userId || 'system', action, target, mode: mode || (DB.meta.offline ? 'offline' : 'online') });
}

/* ---------- district metrics ---------- */
function metrics() {
  const refs = DB.referrals;
  const bundles = DB.bundles.map(b => ({ ...b, ready: b.status === 'READY' }));
  const failures = [];
  refs.forEach(r => { const ev = evaluateBundle(r); ev.failed.forEach(f => failures.push({ ref: r.id, facility: fac(r.toFacility), resource: f.resource, status: f.status })); });
  return {
    patients: DB.patients.length,
    pending: refs.filter(r => !['Followed-up'].includes(r.state)).length,
    overdue: refs.filter(isOverdue).length,
    ready: bundles.filter(b => b.ready).length,
    notReady: bundles.filter(b => !b.ready).length,
    failures,
    stockouts: DB.stock.filter(s => s.qty === 0 || s.qty < s.reorder),
    diagIssues: DB.orders.filter(o => o.state !== 'Resulted' || !o.reviewed),
    fuDue: DB.followups.filter(f => f.state !== 'Done').length,
    fuDone: DB.followups.filter(f => f.state === 'Done').length,
    closed: refs.filter(r => r.state === 'Followed-up').length
  };
}

/* ---------- i18n (prototype: en / mr / hi for patient-facing text) ---------- */
const I18N = {
  en: { card: 'Patient Care Card', appt: 'Appointment', bring: 'Bring this card and your medicines', fasting: 'Come fasting (no food after 10 pm)', ask: 'Ask for the coordinator at the entrance', transport: 'Transport', ready: 'JOURNEY READY', notready: 'JOURNEY NOT READY — wait for ASHA call' },
  mr: { card: 'रुग्ण सेवा कार्ड', appt: 'भेटीची वेळ', bring: 'हे कार्ड आणि तुमची औषधे सोबत आणा', fasting: 'उपाशी पोटी या (रात्री १० नंतर काही खाऊ नका)', ask: 'प्रवेशद्वारावर समन्वयकाला विचारा', transport: 'वाहतूक', ready: 'प्रवास तयार', notready: 'प्रवास तयार नाही — आशा ताईंच्या फोनची वाट पहा' },
  hi: { card: 'रोगी देखभाल कार्ड', appt: 'अपॉइंटमेंट', bring: 'यह कार्ड और अपनी दवाइयाँ साथ लाएँ', fasting: 'खाली पेट आएँ (रात 10 बजे के बाद कुछ न खाएँ)', ask: 'प्रवेश द्वार पर समन्वयक से पूछें', transport: 'परिवहन', ready: 'यात्रा तैयार', notready: 'यात्रा तैयार नहीं — आशा के फोन का इंतज़ार करें' }
};
const T = k => (I18N[DB.meta.lang] || I18N.en)[k] || I18N.en[k];
