import { PreviewState, findRelease, trackUri } from "./manifest";
import { log } from "./log";

declare const Spicetify: any;

export function installPlaybackHook(getState: () => PreviewState): void {
  const api = Spicetify.Platform?.PlayerAPI;
  if (!api?.play) {
    log.warn("PlayerAPI.play not found, local release playback disabled");
    return;
  }
  const original = api.play.bind(api);

  api.play = async (context: any, options: any, ...extra: any[]) => {
    const release = findRelease(getState(), context?.uri);
    if (!release) return original(context, options, ...extra);

    const playable = release.tracks
      .map((track, index) => ({ track, uri: trackUri(release, index) }))
      .filter((entry) => entry.track.localUri);
    if (!playable.length) {
      Spicetify.showNotification("This test release has no playable audio files", true);
      log.warn("no playable tracks for", release.title);
      return undefined;
    }

    const skipUri: string | undefined = options?.skipTo?.uri;
    const skipIndex: number | undefined = options?.skipTo?.index;
    let start = skipUri ? playable.findIndex((entry) => entry.uri === skipUri) : -1;
    if (start < 0 && typeof skipIndex === "number") start = Math.min(skipIndex, playable.length - 1);
    if (start < 0) start = 0;

    log.info("playing test release", release.title, "from track", start + 1);
    await Spicetify.Player.playUri(playable[start].track.localUri);
    const rest = playable.slice(start + 1).map((entry) => ({ uri: entry.track.localUri }));
    if (rest.length) await Spicetify.addToQueue(rest);
    return undefined;
  };
  log.info("playback hook installed");
}
