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
