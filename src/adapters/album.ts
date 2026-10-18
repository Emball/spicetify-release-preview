import { findRelease } from "../manifest";
import { log } from "../log";
import { Adapter } from "./types";
import { albumUnion } from "./shapes";

export const albumAdapter: Adapter = {
  operations: ["getAlbum", "queryAlbum"],
  synthesize(variables, state) {
    const release = findRelease(state, variables?.uri);
    if (!release) return undefined;
    log.info("album page synthesized for", release.title);
    return { data: { albumUnion: albumUnion(release) } };
  },
  patch(json) {
    return json;
  },
};
