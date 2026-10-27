# Mobile navigation, responsive games and invitations

The seven-item mobile bar is 80px high with 6px selection insets. Its outer radius
is 34px and the edge selection radii are 28px, matching the bar's curve. The bar
sits lower with `max(8px, safe-area-bottom - 10px)` clearance. At a simulated iPhone
393x852 viewport with a 34px bottom safe area, it ends 24px above the viewport
bottom. On a 320px phone each of the seven links still has a 44x68px touch target.
Selection uses a background-color fade; there is no moving/scaled highlight layer.
Conflicting mobile geometry was removed from the old override sheets.

Tic Tac Toe, Connect Four and Dots & Boxes paint valid public placements before
the request resolves. A rejected request rolls back; newer Realtime revisions
supersede the preview. Scores, winners, hidden cards/words and turn acceptance
remain server-authoritative. Other game inputs retain immediate press feedback
and show a sync status while the server checks the action.

Game actions fetch the room, relationship and secret in one indexed nested read,
in parallel with rate-budget verification, instead of serial reads. Joined private
data is stripped before any response, including stale actions and duplicate invites.
The existing authorization, revision locks and service-only write boundary remain.

Opening a room as its host now automatically persists a partner invitation.
Reopening and manual invites share a deterministic ID, avoiding duplicate alerts.
Best-effort push runs as an Edge Runtime background task after durable persistence.
New Realtime invitations display a portal banner with a role-correct Join action.
History hydration does not replay alerts, and account switching invalidates callbacks.
Permitted iOS local alerts and tap listeners work without registering APNs tokens.

**iPhone delivery limit:** this free-Apple-ID native build has no APNs provider or
entitlement. It receives Realtime invitations while the webview is running, not
guaranteed remote alerts while suspended/locked/closed. Returning to the app reloads
unread invitations. The in-app banner requires no OS permission; native local
presentation requires permission from Account notification settings. This release
does not enable background push. Physical-device validation remains necessary.

Validation: 256 tests passed before adding the banner navigation check, plus that
focused check; the final CI run verifies the combined suite. All 81 production
game checks passed using disposable accounts, including automatic invitation
Realtime delivery, all 19 game rooms, secret isolation, stale-write rejection,
direct-write denial, AI rounds, recipient reads and outsider denial. QA accounts
were removed. TypeScript, six Deno function checks, build and theme checks passed.

A five-move sample measured 259ms median HTTP commit, 272ms sample p95, 103.4ms
median Edge handler time and 417ms for the first partner Realtime update, from
this computer. Local placement no longer waits for that round trip. These are
observations, not latency guarantees or a controlled before/after benchmark.
