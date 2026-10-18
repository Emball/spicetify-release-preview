export interface TrackSpec {
  title: string;
  lengthMs: number;
  localUri?: string;
  artists?: string[];
  explicit?: boolean;
}

export interface ReleaseSpec {
  id: string;
  artistUri: string;
  artistName: string;
  title: string;
  type: "album" | "single" | "ep";
  releaseDate: string;
  label?: string;
  coverUrl?: string;
  color?: string;
  tracks: TrackSpec[];
}

export interface ArtistOverride {
  artistUri: string;
  headerImageUrl?: string;
  avatarUrl?: string;
  biography?: string;
}

export interface PreviewState {
  version: 1;
  releases: ReleaseSpec[];
  overrides: ArtistOverride[];
}

export const LOCAL_ALBUM_PREFIX = "spotify:album:LOCAL";
export const LOCAL_TRACK_PREFIX = "spotify:track:LOCAL";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function newReleaseId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(17));
  return Array.from(bytes, (b) => BASE62[b % 62]).join("");
}

export function releaseUri(release: ReleaseSpec): string {
  return `${LOCAL_ALBUM_PREFIX}${release.id}`;
}

export function trackUri(release: ReleaseSpec, index: number): string {
  return `${LOCAL_TRACK_PREFIX}${release.id.slice(0, 14)}${index.toString(36).padStart(3, "0")}`;
}

export function findRelease(state: PreviewState, albumUri: string | undefined): ReleaseSpec | undefined {
  if (!albumUri || !albumUri.startsWith(LOCAL_ALBUM_PREFIX)) return undefined;
  return state.releases.find((r) => releaseUri(r) === albumUri);
}
