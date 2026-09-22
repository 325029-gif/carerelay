# CareRelay

**Care-readiness verification layer over eSanjeevani + ABDM**  
Smart India Hackathon 2026 · Problem ID SIH26133 · Theme: MedTech / BioTech / HealthTech

> We do not book appointments. We verify that care is actually ready — and we say so when it is not.

A rural patient can travel 26 km to a confirmed appointment and still be turned away because a reagent ran out, the technician is off duty, or the equipment is down. CareRelay is a coordination layer over existing government facilities that answers one question before the patient leaves home: **can this patient actually complete the required next stage of care with this journey?**

CareRelay runs on top of eSanjeevani and ABDM. No hospital installs a new system. Strengthening — not replacing — the public health system.

## Run it

No build step, no dependencies. Open `index.html`, or serve the folder:

```bash
python3 -m http.server 8080
