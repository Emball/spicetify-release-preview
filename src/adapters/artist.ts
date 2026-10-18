import { log } from "../log";
import { Adapter } from "./types";
import { albumCard, appendUnique } from "./shapes";

function discographyKey(type: string): "albums" | "singles" {
  return type === "album" ? "albums" : "singles";
}

export const artistAdapter: Adapter = {
  operations: ["queryArtistOverview", "artistOverview"],
  patch(json, _variables, state) {
    const artist = json?.data?.artistUnion;
    if (!artist?.uri) return json;

    const override = state.overrides.find((o) => o.artistUri === artist.uri);
    if (override) {
      if (override.biography !== undefined) {
        artist.profile = { ...artist.profile, biography: { ...artist.profile?.biography, text: override.biography } };
      }
      if (override.avatarUrl) {
        const sources = [{ url: override.avatarUrl, width: 640, height: 640 }];
        artist.visuals = { ...artist.visuals, avatarImage: { ...artist.visuals?.avatarImage, sources } };
      }
      if (override.headerImageUrl) {
        const sources = [{ url: override.headerImageUrl, width: 2000, height: 1000 }];
        artist.visuals = { ...artist.visuals, headerImage: { ...artist.visuals?.headerImage, sources } };
        artist.headerImage = { ...artist.headerImage, data: { ...artist.headerImage?.data, sources } };
      }
      log.info("artist overrides applied to", artist.uri);
    }

    const releases = state.releases.filter((r) => r.artistUri === artist.uri);
    if (!releases.length) return json;

    artist.discography = artist.discography ?? {};
    const disco = artist.discography;
    for (const release of releases) {
      const card = albumCard(release);
      const key = discographyKey(release.type);
      disco[key] = disco[key] ?? { items: [] };
      const wrappers: any[] = disco[key].items;
      if (!wrappers.length) wrappers.push({ releases: { items: [] } });
      wrappers[0].releases = wrappers[0].releases ?? { items: [] };
      appendUnique(wrappers[0].releases.items, card);

      if (disco.popularReleasesAlbums?.items) appendUnique(disco.popularReleasesAlbums.items, card);

      const latestDate = disco.latest?.date?.isoString;
      if (!latestDate || latestDate < card.date.isoString) disco.latest = card;
      log.info("artist page gained release", release.title);
    }
    return json;
  },
};
