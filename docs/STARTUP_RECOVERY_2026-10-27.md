# Recoverable startup and AI generation

The screenshots showed two different startup states: the session error boundary
and the full-page app loader. Code review found unbounded dataset-epoch and
initial-session waits, error state retained during Retry, and AI session lookups
outside their fetch timeout.

Session verification now has a 15-second overall deadline, forwarded request
cancellation, one retry for transient reads, preserved structured error messages,
and recovery on explicit Retry or returning online/focusing an errored page. A
12-second watchdog starts a bounded session lookup if INITIAL_SESSION never
arrives. Auth HTTP requests also have a 12-second network timeout. Repeated
same-account sign-in checks run in the background without blanking the screen.
Roles still come from the authoritative profile; cached/editable metadata never
grants access. Late and superseded results cannot restore stale accounts.

Partner health loading starts independently of chat identity registration.
Identity reads are bounded, and encrypted messages still require valid keys.

AI generation has a bounded session lookup and in-flight cache lifetime, plus a
view deadline. A failed/timed-out request releases its pending cache entry so
Retry can start a new request. Prepared quotes and a local progress indicator
appear immediately inside the guide, with reduced-motion and in-app animation
preferences respected. No generation is awaited by authentication/startup.

Validation: 147 app tests, TypeScript/production build, 76 live API checks with
isolated test accounts cleaned up, and local served UI checks. Regression tests
cover stuck initial sessions, structured errors, Retry progress, stale responses,
background verification, authorization denial, hung AI session lookups, and
hung AI provider requests followed by retry. No real account data was changed.
Browser automation remains unavailable; interactive screenshots and reproduction
of the user's exact network/session state are not claimed.
