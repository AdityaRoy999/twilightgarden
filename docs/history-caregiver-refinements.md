# History and caregiver refinements

The exercise generator now joins the head through a visible neck, attaches
shaped palms/fingers to the wrist ends, and connects ankles to shoe silhouettes.
Head tilt rotates around the neck base; hand direction follows the forearm.
All 44 two-pose exercise sets and their dark variants were regenerated. Six
representative dark sets were rendered and visually inspected locally. These
remain simplified movement cues with the existing written guidance/video links.

History now uses one shared grid/list component in tracking-side Insights
(the new **History** tab), caregiver Insights, and both existing history routes.
Cards use theme-aware mood colors, local calendar dates, botanical details,
Solar/custom health symbols, and the same non-sliding view toggle. Initial
rendering is limited to 30 entries; Show more exposes the remaining history.

The detail dialog displays every recorded mood, unique symptom count, period
start, flow, energy, sleep quality/hours and notes. It handles mapped and legacy
field names, including the previously missed `notes` field. Missing moods remain
“Not logged”, never an invented neutral mood. Owners can edit their own entries;
caregiver views are read-only and honor sharing/active-connection gates. A
selected row is resolved from current data rather than a stale copied object.

Calendar guidance now addresses the supporter. It uses recent non-demo shared
check-ins, labels their dates, and asks what would help when evidence is missing.
Historical observations are never silently described as today’s symptoms. AI
care prompts explicitly define the caregiver as the audience, with practical
offer/do/ask actions; a common wrong-role wording guard rejects tips referring
to the caregiver’s own period/cramps/body. Prepared waiting quotes also address
the supporter. Fictional and future records stay excluded from AI context.

Validation: 181 unit/component tests; TypeScript and production build; static
design gallery including light/dark grid/list history; served stylesheet/artwork
checks; 76 live API checks against isolated synthetic accounts, including AI
caregiver wording validation. No database schema or real user rows were changed.
Browser control still fails to initialize on this host, so interactive visual
parity and real-device behavior are not claimed.
