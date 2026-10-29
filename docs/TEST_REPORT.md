# Test report — 0.4.3

Target: Foundry VTT 14 / WFRP4e. `npm test`: 24 passing tests.

Coverage:
- Shared clock, track switching, pause/resume, seek, loops and late joining.
- No overlapping audio, stale loads, delayed unlock, error handling.
- Integrated module entry point in simulated GM/player clients, settings propagation and permissions.
- ID migration preserves old data and existing new settings; standard board paths repaired.
- Chase board creation writes its background to the V14 Level, and opening an existing board repairs an absent image.
- Native playlist DOM fixture with LinkeDOM: existing native rows/controls retained; repeated rendering does not duplicate chain buttons or current track; native play buttons route to shared time; unrelated playlists pass through.
- Player current-track DOM exposes name, timestamp and resync only, without GM transport or seek controls.
- Timestamp parsing, slider preview/commit and ±10 controls.
- User manually verified the chase board and music in Foundry VTT 14; the server-side settings migration fix is covered by an automated regression test.

Package script checks JavaScript syntax, manifest resources, compendium presence and ZIP integrity. LinkeDOM is test-only and excluded from the installable ZIP.

Not verified by automated tests: exact production PlaylistDirectory markup across V14 builds, WFRP themes, browser rendering, native audio output, server-side settings migration against a live world, actual network/socket propagation and compendium loading. DOM fixtures and audio APIs are simulated.
