# Test report — 0.1.0

Date: 2026-10-27. Target: Foundry VTT 14. Node.js: 24.22.1.

## Executed successfully

`npm test`: 13 tests passed, 0 failed.

- A 1:35 → B 1:35 → A 1:55.
- Pause, change selected version while paused, resume.
- Shared seeking and stop/reset.
- Late join at the current server-clock position.
- Shortest-file common loop, wraparound, explicit shorter loop.
- Non-looping end.
- Invalid selection and disallowed list edits while playing.
- Rejection of executable/data/local-browser paths.
- Stop outgoing audio before starting incoming audio.
- Delayed load cannot override a newer selection.
- Stop cancels a pending load.
- Browser unlock delay is included in the target timestamp.
- Load error stops old audio without a retry flood.
- Integration test: actual main.js loaded in separate Node VM contexts
  representing GM, player and late-joining player. Mock Foundry settings
  transport propagates playback changes; player control is denied.

The integration test is included in the 13 test total. Audio APIs, DOM and
Foundry server are mocked. It is not an actual multiplayer Foundry test.

JS syntax and JSON manifest were checked. ZIP content and checksum integrity
were checked at packaging time.

## Not verified here

- Actual Foundry runtime, WFRP4e world, native FilePicker upload workflow.
- Actual Foundry socket/settings propagation under network latency.
- Native Sound implementation, audio decoding and audible quality of fades.
- Visual rendering of the panel in Foundry themes.
- Real client reload/reconnect and browser autoplay policies.

A Playwright browser smoke test could not be run because the browser runtime
was unavailable and the browser download did not produce a valid archive.
No browser-test pass is claimed.

Perform the short GM + player acceptance test in README.md before a session.
