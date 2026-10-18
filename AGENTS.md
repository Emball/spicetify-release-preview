# spicetify-release-preview

Spicetify extension for Windows Spotify desktop. Overlays locally defined test releases and artist page overrides onto the real client UI, so unreleased albums can be previewed rendered by Spotify's own components.

## Architecture

- `src/index.ts`: entry; waits for Spicetify APIs, installs the hooks, registers the menu item.
- `src/overlay/hook.ts`: wraps `window.fetch` (pathfinder requests) and `Spicetify.GraphQL.Request`; dispatches by operation name to adapters; logs each newly seen operation once.
- `src/adapters/`: all knowledge of Spotify response shapes. `artist` (overrides, discography injection), `album` (synthesizes the page for local album URIs), `search` (album results), `shapes` (builders). Client updates are fixed here only.
- `src/playback.ts`: wraps `Platform.PlayerAPI.play`; a local album context plays the first track via `Player.playUri` and queues the rest.
- `src/store.ts`: localStorage persistence plus JSON export and import.
- `src/manifest.ts`: types and URI helpers.
- `src/tags.ts`: ID3v2.3/2.4 reader (title, artist, album, track number, cover), audio duration, `spotify:local:` URI builder.
- `src/color.ts`: dominant color from cover art.
- `src/ui.ts`: "Release Preview" menu item opening a modal to add, delete, export and import releases.
- `releases/sample.json`: example import file.

## Data model

- Local URIs are 22 characters: `spotify:album:LOCAL` plus a 17-char release id; tracks are `spotify:track:LOCAL` plus 14 id chars plus a 3-char index.
- Displayed track URIs are the fake ones; each track also stores `localUri` (`spotify:local:artist:album:title:seconds` built from the file's own tags), which is what actually plays. The audio folder must be a Local Files source in Spotify.
- Artist overrides are keyed by the real artist URI (biography, avatar, header image); there is no UI for them yet, import JSON to set them.

## Workflow

- Build: `npm run build`. Typecheck: `npm run typecheck`.
- Install on Windows: copy `dist/release-preview.js` to the Spicetify Extensions folder, then `spicetify config extensions release-preview.js` and `spicetify apply`.
- Operation names and response shapes in adapters are best-effort; the console log of discovered operations is the source for tuning them.
