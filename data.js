/* CareRelay — DEMO DATA (prototype only; no real patients, no live government feeds) */
const HOUR = 3600e3, DAY = 24 * HOUR;
const now = () => Date.now();

function seed() {
  const t = now();
  return {
    meta: { version: 3, seededAt: t, offline: false, lang: 'mr', role: null, userId: null },
    facilities: [
      { id: 'F1', name: 'Kondhali Sub-Centre', type: 'SubCentre', block: 'Kondhali', district: 'Nagpur', level: 1 },
      { id: 'F2', name: 'Kondhali PHC', type: 'PHC', block: 'Kondhali', district: 'Nagpur', level: 2 },
      { id: 'F3', name: 'Katol Rural Hospital', type: 'RuralHospital', block: 'Katol', district: 'Nagpur', level: 3 },
      { id: 'F4', name: 'Nagpur District Hospital', type: 'DistrictHospital', block: 'Nagpur', district: 'Nagpur', level: 4 }
    ],
    users: [
      { id: 'U1', name: 'Sunita Meshram', role: 'ASHA', facilityId: 'F1', phone: '+91 90000 11111' },
      { id: 'U2', name: 'Rekha Patil (ANM)', role: 'ASHA', facilityId: 'F1', phone: '+91 90000 11112' },
      { id: 'U3', name: 'Coordinator Anil Deshmukh', role: 'FACILITY', facilityId: 'F3', phone: '+91 90000 22222' },
      { id: 'U4', name: 'Dr. Kavita Rao (MO)', role: 'DOCTOR', facilityId: 'F3', phone: '+91 90000 33333' },
      { id: 'U5', name: 'Lab Tech Ramesh Jadhav', role: 'LAB', facilityId: 'F3', phone: '+91 90000 44444' },
      { id: 'U6', name: 'Pharmacist Shalu Kale', role: 'LAB', facilityId: 'F3', phone: '+91 90000 44445' },
      { id: 'U7', name: 'District Admin V. Kulkarni', role: 'ADMIN', facilityId: 'F4', phone: '+91 90000 55555' }
    ],
    patients: [
      { id: 'P1', name: 'Kamla Bai Tayde', age: 54, sex: 'F', village: 'Sonegaon', phone: '+91 98111 00011', abha: '', lang: 'mr', distanceKm: 26, createdBy: 'U1', createdAt: t - 3 * DAY, synced: true },
      { id: 'P2', name: 'Ganesh Uike', age: 61, sex: 'M', village: 'Kondhali', phone: '+91 98111 00012', abha: '91-2222-3333-4444', lang: 'mr', distanceKm: 12, createdBy: 'U1', createdAt: t - 9 * DAY, synced: true },
      { id: 'P3', name: 'Laxmi Warthi', age: 29, sex: 'F', village: 'Dhapewada', phone: '+91 98111 00013', abha: '', lang: 'hi', distanceKm: 31, createdBy: 'U2', createdAt: t - 14 * DAY, synced: true },
      { id: 'P4', name: 'Shankar Dhote', age: 47, sex: 'M', village: 'Sonegaon', phone: '+91 98111 00014', abha: '', lang: 'mr', distanceKm: 26, createdBy: 'U1', createdAt: t - 20 * DAY, synced: true }
    ],
    encounters: [
      { id: 'E1', patientId: 'P2', by: 'U1', at: t - 2 * DAY, type: 'HouseholdVisit', note: 'Known diabetic, complains of fatigue and blurred vision', synced: true },
      { id: 'E2', patientId: 'P3', by: 'U2', at: t - 5 * DAY, type: 'ANC', note: 'ANC visit 2, mild anaemia suspected', synced: true }
    ],
    vitals: [
      { id: 'V1', encounterId: 'E1', patientId: 'P2', at: t - 2 * DAY, bpSys: 158, bpDia: 96, glucose: 268, spo2: 97, temp: 98.4, pulse: 88, synced: true },
      { id: 'V2', encounterId: 'E2', patientId: 'P3', at: t - 5 * DAY, bpSys: 112, bpDia: 72, glucose: 96, spo2: 98, temp: 98.1, pulse: 92, synced: true }
    ],
    referrals: [
      { id: 'R-1042', patientId: 'P2', fromFacility: 'F1', toFacility: 'F3', reason: 'Uncontrolled type-2 diabetes with hypertension', priority: 'Urgent', state: 'Requested', createdBy: 'U1', createdAt: t - 2 * DAY, owner: 'U3', dueAt: t + 6 * HOUR, requiredResources: ['Doctor', 'Lab', 'Technician', 'Reagents', 'Medicine'], serviceRequest: 'HbA1c + FBS + Serum creatinine + Fundus screening', synced: true, history: [{ state: 'Requested', at: t - 2 * DAY, by: 'U1', note: 'Created offline at Sonegaon, synced at PHC' }] },
      { id: 'R-1039', patientId: 'P3', fromFacility: 'F1', toFacility: 'F3', reason: 'Anaemia in pregnancy — Hb confirmation', priority: 'Routine', state: 'Scheduled', createdBy: 'U2', createdAt: t - 5 * DAY, owner: 'U3', dueAt: t + 2 * DAY, requiredResources: ['Doctor', 'Lab', 'Technician', 'Reagents'], serviceRequest: 'CBC + Peripheral smear', synced: true, history: [{ state: 'Requested', at: t - 5 * DAY, by: 'U2' }, { state: 'Accepted', at: t - 4 * DAY, by: 'U3' }, { state: 'Scheduled', at: t - 4 * DAY, by: 'U3' }] },
      { id: 'R-1031', patientId: 'P4', fromFacility: 'F2', toFacility: 'F4', reason: 'Chronic cough, sputum AFB follow-up', priority: 'Routine', state: 'Attended', createdBy: 'U1', createdAt: t - 12 * DAY, owner: 'U4', dueAt: t - 1 * DAY, requiredResources: ['Doctor', 'Lab', 'Technician', 'Reagents'], serviceRequest: 'Sputum AFB x2 + Chest X-ray', synced: true, history: [{ state: 'Requested', at: t - 12 * DAY, by: 'U1' }, { state: 'Accepted', at: t - 11 * DAY, by: 'U3' }, { state: 'Scheduled', at: t - 10 * DAY, by: 'U3' }, { state: 'Attended', at: t - 2 * DAY, by: 'U3' }] },
      { id: 'R-1024', patientId: 'P1', fromFacility: 'F1', toFacility: 'F3', reason: 'Cataract surgery assessment', priority: 'Routine', state: 'Requested', createdBy: 'U1', createdAt: t - 9 * DAY, owner: 'U3', dueAt: t - 7 * DAY, requiredResources: ['Doctor', 'Equipment'], serviceRequest: 'Ophthalmology OPD assessment', synced: true, history: [{ state: 'Requested', at: t - 9 * DAY, by: 'U1', note: 'No acknowledgement from receiving facility' }] }
    ],
    appointments: [
      { id: 'A-501', referralId: 'R-1039', facilityId: 'F3', at: t + 2 * DAY + 4 * HOUR, slot: '10:30', dept: 'OPD-2', coordinator: 'U3' }
    ],
    bundles: [
      { id: 'B-301', referralId: 'R-1039', createdAt: t - 4 * DAY, lastValidatedAt: t - 20 * HOUR, status: 'READY', transport: 'Sub-centre Jeep 07:30 pickup at Dhapewada stop', fallback: 'If jeep unavailable → 108 non-emergency transport; else reschedule to next CBC day (Thu)' }
    ],
    readiness: [
      /* facility resource claims: each has validity window — the heart of expiry-aware readiness */
      { id: 'K1', facilityId: 'F3', resource: 'Doctor', detail: 'Dr. Kavita Rao, Medicine OPD', claim: 'Confirmed', verifiedAt: t - 3 * HOUR, validHours: 24, by: 'U3' },
      { id: 'K2', facilityId: 'F3', resource: 'Lab', detail: 'Pathology lab open 09:00–14:00', claim: 'Confirmed', verifiedAt: t - 4 * HOUR, validHours: 24, by: 'U5' },
      { id: 'K3', facilityId: 'F3', resource: 'Technician', detail: 'Lab tech Ramesh on duty', claim: 'Confirmed', verifiedAt: t - 5 * HOUR, validHours: 24, by: 'U5' },
      { id: 'K4', facilityId: 'F3', resource: 'Reagents', detail: 'HbA1c cartridges (batch RX-88)', claim: 'Confirmed', verifiedAt: t - 30 * HOUR, validHours: 24, by: 'U5' },
      { id: 'K5', facilityId: 'F3', resource: 'Medicine', detail: 'Metformin 500mg, Amlodipine 5mg', claim: 'Confirmed', verifiedAt: t - 2 * HOUR, validHours: 24, by: 'U6' },
      { id: 'K6', facilityId: 'F3', resource: 'Equipment', detail: 'Semi-auto analyser + fundus camera', claim: 'LastKnown', verifiedAt: t - 40 * HOUR, validHours: 48, by: 'U3' },
      { id: 'K7', facilityId: 'F4', resource: 'Doctor', detail: 'Physician OPD, 3 MOs', claim: 'Confirmed', verifiedAt: t - 6 * HOUR, validHours: 24, by: 'U7' },
      { id: 'K8', facilityId: 'F4', resource: 'Lab', detail: 'District lab + X-ray', claim: 'Confirmed', verifiedAt: t - 7 * HOUR, validHours: 24, by: 'U7' },
      { id: 'K9', facilityId: 'F4', resource: 'Technician', detail: '2 technicians', claim: 'Confirmed', verifiedAt: t - 7 * HOUR, validHours: 24, by: 'U7' },
      { id: 'K10', facilityId: 'F4', resource: 'Reagents', detail: 'AFB stain kit', claim: 'Pending', verifiedAt: t - 2 * HOUR, validHours: 12, by: 'U7' },
      { id: 'K11', facilityId: 'F4', resource: 'Medicine', detail: 'AKT kits', claim: 'Confirmed', verifiedAt: t - 9 * HOUR, validHours: 24, by: 'U7' },
      { id: 'K12', facilityId: 'F4', resource: 'Equipment', detail: 'X-ray unit', claim: 'Unavailable', verifiedAt: t - 1 * HOUR, validHours: 24, by: 'U7', note: 'Tube fault, engineer expected in 2 days' },
      { id: 'K13', facilityId: 'F2', resource: 'Doctor', detail: 'MO available Mon/Wed/Fri', claim: 'LastKnown', verifiedAt: t - 26 * HOUR, validHours: 24, by: 'U3' },
      { id: 'K14', facilityId: 'F2', resource: 'Medicine', detail: 'Metformin 500mg — 40 strips', claim: 'Confirmed', verifiedAt: t - 3 * HOUR, validHours: 24, by: 'U6' }
    ],
    stock: [
      { id: 'S1', facilityId: 'F3', item: 'Metformin 500mg', unit: 'strip', qty: 120, reorder: 40, updatedAt: t - 2 * HOUR },
      { id: 'S2', facilityId: 'F3', item: 'Amlodipine 5mg', unit: 'strip', qty: 64, reorder: 30, updatedAt: t - 2 * HOUR },
      { id: 'S3', facilityId: 'F3', item: 'HbA1c reagent cartridge', unit: 'pack', qty: 3, reorder: 5, updatedAt: t - 30 * HOUR },
      { id: 'S4', facilityId: 'F3', item: 'Iron-folic acid tablets', unit: 'bottle', qty: 0, reorder: 10, updatedAt: t - 12 * HOUR },
      { id: 'S5', facilityId: 'F4', item: 'AFB stain kit', unit: 'kit', qty: 2, reorder: 4, updatedAt: t - 2 * HOUR },
      { id: 'S6', facilityId: 'F2', item: 'ORS sachets', unit: 'box', qty: 18, reorder: 10, updatedAt: t - 20 * HOUR }
    ],
    orders: [
      { id: 'D-701', referralId: 'R-1031', patientId: 'P4', facilityId: 'F4', tests: 'Sputum AFB x2', state: 'Resulted', orderedAt: t - 2 * DAY, resultAt: t - 20 * HOUR, result: 'AFB negative x2. Advise chest X-ray when unit restored.', reviewed: false },
      { id: 'D-702', referralId: 'R-1039', patientId: 'P3', facilityId: 'F3', tests: 'CBC + Peripheral smear', state: 'Ordered', orderedAt: t - 4 * DAY, result: '', reviewed: false }
    ],
    followups: [
      { id: 'FU-91', referralId: 'R-1031', patientId: 'P4', assignedTo: 'U1', task: 'Home visit — explain AFB negative result, re-screen in 14 days', dueAt: t + 1 * DAY, state: 'Due', createdAt: t - 20 * HOUR },
      { id: 'FU-88', referralId: 'R-1024', patientId: 'P1', assignedTo: 'U1', task: 'Counsel on cataract camp date, confirm escort', dueAt: t - 2 * DAY, state: 'Overdue', createdAt: t - 6 * DAY }
    ],
    notifications: [
      { id: 'N1', to: 'U5', at: t - 30 * HOUR, text: 'HbA1c reagent claim nearing expiry — re-verify before 09:00', read: false },
      { id: 'N2', to: 'U3', at: t - 7 * DAY, text: 'Referral R-1024 unacknowledged for 48h — escalated to district', read: false }
    ],
    audit: [
      { id: 'L1', at: t - 2 * DAY, actor: 'U1', action: 'REFERRAL_CREATE', target: 'R-1042', mode: 'offline' },
      { id: 'L2', at: t - 4 * DAY, actor: 'U3', action: 'REFERRAL_ACCEPT', target: 'R-1039', mode: 'online' }
    ],
    syncQueue: [],
    toasts: []
  };
}
