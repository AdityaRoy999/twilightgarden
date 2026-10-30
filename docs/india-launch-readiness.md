# India testing release — 30 October 2026

This implements engineering controls from the India-first audit. It does not
certify compliance with every Indian law or authorize a worldwide launch.
The intended audience remains 13+, but sensitive access for under-18 accounts
is disabled until genuine guardian verification is implemented. It is not
implemented as a self-certified parental checkbox.

## Implemented

- A privacy boundary loads choices before mounting health/chat/call providers.
  All existing users must make new choices; none were silently opted in.
- Versioned account and health consent; optional partner health sharing, AI and
  shopping processing default off. Withdrawal is recorded and enforced in RLS
  and server functions. Consent events are private and cannot be edited by users.
- Age bands are server-stored. A recorded younger age cannot self-upgrade.
  This is self-declaration, not verified age assurance.
- Private access/correction/withdrawal/deletion/grievance/safety request receipts,
  rate limits, acknowledgement/resolution deadlines and a service-only queue.
  A receipt is explicitly distinguished from a human acknowledgement.
- Recent-sign-in account deletion, session revocation before cleanup, Storage API
  object removal, connection teardown and a retryable deletion job. Personal
  health records belonging to the other member are retained.
- Strict active-session checks for user Edge Functions and sensitive data RLS.
  Definer RPC writes hit consent triggers too.
- Public health bearer-link retrieval disabled; explicit local report exports
  remain available. Legacy plaintext localStorage health snapshots removed.
- Generic push-reminder previews. Notifications are registered after admission.
- Accurate provider/encryption/retention disclosures replace claims of anonymous
  AI data, universal E2EE and nonexistent account deletion.
- Daily expired-share cleanup; resolved requests expire after 90 days from
  submission; completed deletion job IDs expire after 7 days. Unresolved safety
  requests are not silently discarded by the scheduler.
- Public operator/contact fields can be supplied through `.env.example` names,
  Vercel environment variables and GitHub repository variables for the IPA.

## Must be completed before a public launch

1. **Identity and staffed grievance/safety operations.** Supply a real legal
   operator, public service address, support contact, grievance officer and email.
   App tickets require actual human monitoring. Use the Supabase owner dashboard
   to review `privacy_requests`, ordered by `resolve_by`. Configure restricted
   operator access and escalation alerts; do not share service-role keys.
2. **Guardian verification and age assurance.** Select and assess an identity/
   guardian verification process; record the verified adult and authority, scope,
   revocation and evidence reference without copying unnecessary identity docs.
   Do not enable teen sensitive features until this is operational and reviewed.
3. **Provider contracts and transfers.** Confirm processor terms, countries,
   subprocessors, security, retention and backups for Supabase, NVIDIA, Vercel,
   Cloudflare, Firebase, GIPHY, search/maps and retailers. A regional database is
   not proof of India-only processing or a compliant transfer arrangement.
4. **Security work and review.** Native key/session storage still needs a dedicated
   Keychain/Keystore review. Chat cryptography, recovery, device revocation,
   backups, account recovery, upload handling and access controls require an
   independent security review. Supabase leaked-password protection remains a
   configuration/plan item; it was not falsely marked enabled. No claim of full
   health-data E2EE is made.
5. **Incident operations.** Appoint the CERT-In point of contact, synchronize time,
   configure access-controlled security logs and their applicable 180-day
   retention, establish the covered-incident 6-hour response path, and test it.
   Never log passwords, JWTs, chat plaintext or raw health prompts as security
   evidence. Verify the exact applicable directions and exclusions with counsel.
6. **Legal orders, child safety and preservation.** Establish an authenticated
   court/government notice process, urgent intimate-content and child-safety
   escalation, POCSO reporting procedure, and narrowly scoped legal holds when
   required. Ordinary unlink/deletion currently removes shared app records; it
   is not a substitute for an assessed legal-preservation process. No E2EE
   backdoor or blanket indefinite message retention is implemented.
7. **Clinical and product review.** Validate cycle/health assumptions and AI
   boundaries. Determine intended-use/medical-device classification before
   clinical claims. Do not advertise contraception, diagnosis or guaranteed
   fertility accuracy. Assess social-game classification/required registrations,
   intellectual-property licenses, accessibility and storefront disclosures.
8. **Operational rights and store processes.** Monitor access/correction requests,
   arrange reviewed age corrections, define provider-backup erasure, verify data
   exports and complete Play/App Store privacy declarations. No human review or
   legal filing is performed by the ticket scheduler. Cross-market launch needs
   a separate assessment.

## Incident/grievance workflow to establish

On receipt, record a minimal reference, classify urgency, assign an accountable
person and deadline, acknowledge through a safe channel and preserve only
necessary evidence. Child-safety/intimate-content/legal-order timelines can be
shorter than the ordinary 7-day target. Validate authority and scope before
disclosure; never request or re-upload abusive images as ordinary ticket evidence.
Document the action, verification and retention/deletion decision. Escalate a
covered security incident through the CERT-In process within the applicable
deadline. A staff member, not an automated receipt, performs these duties.

## Legal reference baseline

- [SPDI Rules 2011, MeitY](https://www.meity.gov.in/writereaddata/files/GSR313E_10511%281%29_0.pdf)
- [DPDP Rules 2025, MeitY](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa)
- [IT Rules, MeitY](https://www.meity.gov.in/content/intermediary-guidelines-and-digital-media-ethics-code-rules-2021)
- [CERT-In Directions](https://www.cert-in.org.in/Directions70B.jsp)

The earlier downloaded audit bundle contains the detailed source ledger,
commencement analysis, evidence, 32 findings and conditional applicability.
DPDP substantive duties are phased; do not present every future provision as
already in force. A qualified Indian legal review is still required.

## Verification and release

`node scripts/verify-privacy.mjs` creates disposable synthetic accounts and checks
pre-consent denial, teen restrictions, optional processing, health sharing and
withdrawal, tamper denial, private tickets, public-share denial, live AI generation
during a concurrent Ready action, account deletion and old-token rejection.
It cleans up synthetic accounts and writes `tmp/verification/privacy-live.json`.
Run `npm test`, `npm run build`, `npm run verify:ui` and review database advisors.
The GitHub `ios-unsigned.yml` workflow builds an unsigned device IPA; it does not
sign, install, or grant push/VoIP entitlements to a free Apple ID.
