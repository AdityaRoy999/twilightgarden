# Cloudflare relay and onboarding follow-up

## Cloudflare activation and request budget

Configured the three existing backend-only Cloudflare variables from the local
ignored `.env` using `npm run setup:turn`. The upload helper publishes only those
three values to Supabase and removes its temporary secret file. No Cloudflare API
token is sent to the frontend or committed to Git.

The first authenticated call returned 429 even for a fresh test account. The
database helper allowed only `ai` and `push`, so the new `turn-credentials` action
was always rejected before Cloudflare was called. Migration
`20261026121205_allow_cloudflare_turn_request_budget.sql` repairs this. TURN has
30 requests per user per UTC clock hour; AI/push retain their existing per-minute
windows. The helper remains executable only by the backend service role.

Live checks:

- Cloudflare credential API: HTTP 201.
- Authenticated Twilight `call-credentials`: HTTP 200 with expiring Cloudflare ICE
  servers and approximately one-hour lifetime.
- Anonymous request: HTTP 401; unrelated relationship request: HTTP 403.
- Rollback-only SQL regression checks: first 30 TURN requests accepted, request 31
  rejected, hourly TURN/minute AI/push windows preserved, invalid arguments rejected,
  and client execute privileges denied.

## Forced-relay transport measurements

Used two temporary tracker/partner accounts and credentials issued by Twilight's
actual deployed endpoint. Two Node WebRTC peers (werift 0.25.2, installed only in an
ignored test directory) were forced to use relay candidates. Each connection sent
20 data-channel messages with an echo in the other direction. This exercises ICE,
TURN and encrypted DTLS/SCTP transport, without accessing media devices or a browser.

| Cloudflare transport | Connection setup | Median RTT | p95 RTT | Selected candidates |
| --- | ---: | ---: | ---: | --- |
| UDP, port 3478 | 663ms | 60ms | 78ms | Relay at both ends |
| TCP, port 3478 | 929ms | 99ms | 114ms | Relay at both ends |
| TLS, port 443 | 1185ms | 100ms | 112ms | Relay at both ends |

These are observations from this machine and network, not an SLA. The Node check
does not run the React call provider, browser media decoding or physical microphone/
camera capture. Browser control failed to initialize with a missing kernel-assets
path even after a reset, so browser call acceptance could not be repeated in this
run. The previous browser checks established direct synthetic audio/video only.

Both temporary accounts, their profiles, settings/logs, relationship, encryption
keys/backups and private budget records were removed after verification. Exact
post-cleanup checks found zero remaining accounts/profiles/budgets for those test
IDs. The temporary credential fixture was deleted. Existing user data was untouched.

## Onboarding save error

The reported failure corresponds to PostgreSQL `P0001: Invalid cycle settings`
from `save_cycle_settings`. With a fresh synthetic tracker account, October 1 and
October 26 saved successfully, while October 31 reproduced that error on October
26. The existing calendar allowed a future period-start date to reach the backend,
and the plain PostgREST error object became a generic retry banner.

The calendar now disables future dates/months. Shared settings validation rejects
future/impossible dates, missing completed-onboarding dates and invalid lengths
before sending the RPC. Save failures become readable Error objects, with specific
guidance for the backend validation error. Selecting a date that has become future
relative to the current day returns onboarding to its date step.

Added component tests covering future-date/month blocking and the complete setup
journey with today's date, plus shared validation/error-object regressions. All
45 automated tests and the production build passed locally. Browser UI verification
was unavailable due to the browser tool initialization failure described above.
The exact date in the user's failed selection was not captured; future selection
is a reproduced failure path, not an assertion about that private input.
