import { ArtistOverride, PreviewState, ReleaseSpec } from "./manifest";
import { log } from "./log";

const KEY = "release-preview:state";

const EMPTY: PreviewState = { version: 1, releases: [], overrides: [] };

export function loadState(): PreviewState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(EMPTY);
    const parsed = JSON.parse(raw) as PreviewState;
    if (parsed.version !== 1) {
      log.warn("unknown state version, starting empty", parsed.version);
      return structuredClone(EMPTY);
    }
    return parsed;
  } catch (err) {
    log.error("failed to load state", err);
    return structuredClone(EMPTY);
  }
}

export function saveState(state: PreviewState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    log.info("state saved", state.releases.length, "releases", state.overrides.length, "overrides");
  } catch (err) {
    log.error("failed to save state", err);
  }
}

export function upsertRelease(state: PreviewState, release: ReleaseSpec): PreviewState {
  const releases = state.releases.filter((r) => r.id !== release.id).concat(release);
  const next = { ...state, releases };
  saveState(next);
  return next;
}

export function upsertOverride(state: PreviewState, override: ArtistOverride): PreviewState {
  const overrides = state.overrides.filter((o) => o.artistUri !== override.artistUri).concat(override);
  const next = { ...state, overrides };
  saveState(next);
  return next;
}

export function exportState(state: PreviewState): string {
  return JSON.stringify(state, null, 2);
}

export function importState(json: string): PreviewState {
  const parsed = JSON.parse(json) as PreviewState;
  if (parsed.version !== 1 || !Array.isArray(parsed.releases) || !Array.isArray(parsed.overrides)) {
    throw new Error("not a release-preview export");
  }
  saveState(parsed);
  return parsed;
}
