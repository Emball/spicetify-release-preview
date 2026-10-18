import { log } from "../log";
import { Adapter } from "./types";
import { albumCard } from "./shapes";

export const searchAdapter: Adapter = {
  operations: ["searchDesktop", "searchModalResults"],
  patch(json, variables, state) {
    const term = String(variables?.searchTerm ?? "").trim().toLowerCase();
    const albums: any[] | undefined = json?.data?.searchV2?.albumsV2?.items;
    if (!term || !albums) return json;

    for (const release of state.releases) {
      const haystack = `${release.title} ${release.artistName}`.toLowerCase();
      if (!haystack.includes(term)) continue;
      const card = albumCard(release);
      if (albums.some((a) => a?.data?.uri === card.uri)) continue;
      albums.unshift({ __typename: "AlbumResponseWrapper", data: card });
      log.info("search gained release", release.title, "for term", term);
    }
    return json;
  },
};
