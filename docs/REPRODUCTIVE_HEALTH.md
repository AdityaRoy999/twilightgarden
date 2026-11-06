# Reproductive health implementation and validation

Implemented 7 November 2026. Entry point: **Your health, your way** from Today, Wellness or Account (`/#/health`). The carer sees only explicitly shared additional entries at `/#/partner/health`, linked from Insights.

## Feature coverage

| Area | Implemented behavior |
| --- | --- |
| Period history | Median of up to six recorded cycle intervals, explicit period-start/end markers, observed range. Missing check-ins are not interpreted as bleeding days. No future-start leakage into past estimates. |
| Daily logs | Pain severity/location/duration, effect on daily life, relief and response, product changes, clots, bleeding between periods, explicit period end. Sleep duration and self-reported sleep quality are separate. |
| Sexual health | Activity, protection, comfort, desire, post-activity bleeding, private notes. Prompt source-linked help for contraceptive failure, pain or bleeding. |
| Contraception | Existing method, start/review dates and generic private reminders. No treatment selection, dosage advice or contraceptive efficacy claim. |
| Fertility observations | Celsius basal temperatures, cervical mucus, LH and pregnancy tests, dated chart and observation cards. No confirmation of ovulation or fertility diagnosis. |
| Pregnancy | LMP/clinician-adjusted due date, local-calendar gestational age, trimester, due date, thirteen educational stages, original embryo-to-curled-baby SVG that grows by stage. Weeks 0–42 preview without changing saved dates; tracking through 44 weeks. |
| Pregnancy journal | Symptoms, impact, movement observations, optional weight, notes, immediate source-linked escalation for movement concerns. No simulated heartbeat, scan, exact size or fetal-wellbeing assessment. |
| Recovery | Birth/loss/ended/paused states, bleeding, comfort, emotional wellbeing and optional feeding context. Pausing hides pregnancy art without resuming fertility predictions. History remains available. |
| Medicines | Name, prescribed dose text, taken/skipped/start/stop/side effect and perceived response. No prescribing or interaction checker. |
| Conditions | Clinician-diagnosed condition or symptoms to discuss, daily impact and existing treatment. Includes PCOS, endometriosis, fibroids and perimenopause contexts. |
| Vaginal/urinary health | Symptoms, screening status, optional results, impact and notes. No diagnosis from discharge/urinary observations. |
| Care planning | Appointments, questions, local times and one-time/daily reminders. Generic lock-screen notification text. |
| Education | Sixteen original short summaries linked to NHS, CDC, WHO and ASRM. Source links in `lib/healthEducation.ts`. Clinical editorial review remains outstanding. |
| Portability | User-triggered JSON and PDF exports; documented Celsius CSV and Twilight JSON import. Imports generate new IDs and remove all previous sharing grants. 100 entries / 2 MB per import. |
| Offline additional journals | Existing encrypted snapshots, encrypted per-account/per-vault pending edits, serialized queue writes, explicit conflicts with export/discard choices. No silent overwrite. |
| Carer access | Additional entries private by default. Per-entry grants require health-sharing consent and the current connection ID. Carer view is read only. |

## Privacy and synchronization

- Uses the existing account vault and AES-GCM record encryption. No second backup password. New record kinds: `reproductive_settings`, `reproductive_entries`.
- Pregnancy dates/mode and other additional journey settings are never granted to the carer. Only the generic `calendar_estimates_paused` flag is shared under existing health consent. Updating the mode and this flag uses one atomic database batch.
- Pregnancy, postpartum, contraception and perimenopause modes pause calendar fertility predictions. The owner and carer use the same history-based prediction model when predictions are enabled.
- Additional-entry grants require explicit selection plus `shareCoupleId` matching the active relationship. A later connection cannot automatically inherit an old grant. Broad sharing withdrawal revokes envelopes in the database.
- Withdrawing health consent prevents additional journal loading. All runtime decrypted journal state is cleared when the vault is cleared.
- Offline snapshots and pending edits contain record ciphertext, stored through `DeviceSecrets`. Native storage uses secure storage; the browser uses the existing non-extractable wrapping key. Retired-vault cleanup includes the journal cache.
- Additional-entry removal overwrites notes, title and values with an encrypted deletion marker, removes the recipient grant and hides it on refresh. The marker is retained for synchronization. Previously downloaded/decrypted copies and provider backups cannot be recalled.
- External AI does not automatically receive the new sexual-health, pregnancy or medication journals. Existing optional AI check-in behavior remains governed by AI consent.
- JSON/PDF exports are deliberately readable. Native temporary exports are removed from app cache after the share sheet finishes. Files saved by the user remain outside app control.
- No actual user records were reset or seeded for this task. Database integration tests use disposable synthetic accounts and clean them up.

## Native reminders

Schedules up to 40 upcoming generic local alerts. Daily reminders cover the next seven days; one-time reminders/appointments are scheduled within 32 days. Reopening refreshes the schedule. Notification permission is required. Browsers retain journal dates without pretending to deliver native scheduled alerts. Device settings can delay delivery. Native release/device delivery verification remains necessary.

## Validation evidence

- Production TypeScript/Vite build: passes; health page and chart/PDF tools load on demand. Health page chunk approximately 12 KB gzip; pregnancy SVG component approximately 1.6 KB gzip. Existing vendor bundles are shared.
- Responsive UI inspected at widths 320, 390, 768 and 1440 pixels. No horizontal overflow; goal and journal sheets fit the viewport and scroll internally; 16px form inputs avoid iOS focus zoom.
- Nine journal categories exercised in the browser with synthetic in-memory data, including validation, private defaults, date/time saving and movement-concern text. Date/time inputs handle native input events as well as change events.
- Timeline preview/current-stage return, light/dark themes and disabled animation setting exercised. Shared motion presets honor OS reduced motion and app animation settings.
- Full regression suite: **80 files / 364 tests passed**. Automated tests cover dating, leap days, adjusted due dates, pause/loss transitions, prediction history, period duration, field validation, reminders, import privacy, offline conflicts, concurrent queue writes, account/epoch isolation and failed drafts.
- Live Supabase QA: **8 scenarios passed**: ciphertext-only storage/private default; intended-carer decryption; no inherited connection grant; atomically paused partner estimates without private pregnancy settings; unauthorized writes/absent health consent denied; withdrawal revocation; stale-revision rejection; personal vaults preserved on sharing changes.
- Security advisor review: existing intended authenticated security-definer APIs and server-only tables remain flagged informationally; leaked-password protection is disabled in Supabase Auth and still needs account configuration. Performance advisor reports only previously unused indexes. No new missing-index warning was reported.
- UI theme/static-asset validation and credential scan pass. Local preview screenshots are under ignored `output/reproductive-health/`.

## Limits and remaining work

This implements reproductive-health tracking and education tools; it is not a clinical product certification or a guarantee that every possible reproductive-health feature exists.

1. Native Apple Health / Android Health Connect integration is **not connected**. Manual import/export works; native permissions and mapping require a separate integration and device tests.
2. Offline creation/editing covers the **additional journals**, not every legacy daily-log operation. Existing daily-log saves still require their online transaction.
3. Education and developmental artwork require professional clinical/editorial review before public health claims. No clinician has approved this release.
4. No due-date animation is a live view of the user's baby. It follows entered dates and general stages only. No diagnosis, fertility assurance, treatment recommendation, scan analysis or pregnancy outcome prediction is provided.
5. Pregnancy journal observations are not a clinical kick-count monitor. No timer suggests waiting when movement is reduced.
6. No medication interaction engine, emergency response service, automated diagnosis, clinical visit booking or lab integration.
7. PDF uses the existing standard PDF font; JSON preserves the original Unicode text and is the preferred lossless export. Full multilingual PDF font coverage is not implemented.
8. Browser responsive tests do not prove physical iPhone/Android performance, background notification delivery or native integration behavior. Fresh native builds/device testing remain necessary.
9. Existing public-launch blockers remain: operator/service/grievance contacts, guardian verification (13–17 remains blocked), staffed safety response and legal/clinical review.

## Repeatable checks

```powershell
npm test
npm run build
npm run dev:local
# In another terminal:
npm run verify:ui
node scripts/check-secrets.mjs
# Requires the project's local service-role credentials; never put them in frontend code:
node scripts/verify-reproductive-health.mjs
```

The database migration is `supabase/migrations/20261106161759_reproductive_health_records.sql`; it was applied to Twilight's configured Supabase project for these tests. Existing app versions remain compatible with the added encrypted record kinds.


## Illustrated logging controls

Settings and the carer account appearance panel include **Show logging labels** (on by default). This device-local setting switches health choices between SVG + text and SVG-only; accessible names, form headings, consent and safety wording remain available. The existing encrypted records and enum strings are unchanged.

Health entry forms use original `ChoiceSymbol` drawings, custom calendar/month/year navigation, a custom clock, and themed checkboxes. General menus use the local Solar adapter. No native HTML selects or date/time inputs remain in the app. Calendars retain local date keys, min/max constraints and keyboard navigation; blank pain and recorded zero remain distinct. Desktop daily logging uses aligned pairs, with full-width pain and sleep sections. Reduced motion and the in-app animation preference are respected.

Validation: `tests/garden-controls.test.tsx` exercises calendar limits/leap days, keyboard focus, listbox Escape containment, consent defaults, label persistence, clock precision, SVG availability and the pain scale. `tests/reproductive-ui.test.tsx` checks saved values through the real health form controls. No native build is required for this change.
