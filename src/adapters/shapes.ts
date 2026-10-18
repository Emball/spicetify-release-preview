import { ReleaseSpec, releaseUri, trackUri } from "../manifest";

function hexBlock(hex: string) {
  return { hex };
}

export function artistRef(r: ReleaseSpec) {
  return { uri: r.artistUri, profile: { name: r.artistName } };
}

export function coverArt(r: ReleaseSpec) {
  const sources = r.coverUrl ? [640, 300, 64].map((w) => ({ url: r.coverUrl, width: w, height: w })) : [];
  const color = r.color ?? "#535353";
  return {
    sources,
    extractedColors: {
      colorRaw: hexBlock(color),
      colorLight: hexBlock(color),
      colorDark: hexBlock(color),
    },
  };
}

export function albumDate(r: ReleaseSpec) {
  const d = new Date(r.releaseDate);
  return { year: d.getUTCFullYear(), isoString: d.toISOString(), precision: "DAY" };
}

export function albumCard(r: ReleaseSpec) {
  return {
    __typename: "Album",
    uri: releaseUri(r),
    id: releaseUri(r).split(":")[2],
    name: r.title,
    type: r.type === "ep" ? "EP" : r.type.toUpperCase(),
    date: albumDate(r),
    coverArt: coverArt(r),
    artists: { items: [artistRef(r)] },
    playability: { playable: true, reason: "PLAYABLE" },
    sharingInfo: { shareId: "", shareUrl: "" },
  };
}

export function trackItem(r: ReleaseSpec, index: number) {
  const t = r.tracks[index];
  return {
    uid: `local-${r.id}-${index}`,
    track: {
      uri: trackUri(r, index),
      name: t.title,
      trackNumber: index + 1,
      discNumber: 1,
      duration: { totalMilliseconds: t.lengthMs },
      playcount: "0",
      playability: { playable: true },
      contentRating: { label: t.explicit ? "EXPLICIT" : "NONE" },
      saved: false,
      artists: { items: (t.artists?.length ? t.artists : [r.artistName]).map((name) => ({
        uri: r.artistUri,
        profile: { name },
      })) },
    },
  };
}

export function albumUnion(r: ReleaseSpec) {
  const items = r.tracks.map((_, i) => trackItem(r, i));
  return {
    ...albumCard(r),
    label: r.label ?? "",
    copyright: { items: [] },
    courtesyLine: "",
    saved: false,
    discs: { totalCount: 1, items: [{ number: 1, tracks: { totalCount: items.length, items } }] },
    tracksV2: { totalCount: items.length, items },
    moreAlbumsByArtist: { items: [] },
    releases: { items: [] },
  };
}

export function appendUnique(list: any[], item: any, key = "uri"): void {
  if (list.some((entry) => entry?.[key] === item[key])) return;
  list.unshift(item);
}
