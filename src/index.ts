import { PreviewState } from "./manifest";
import { loadState } from "./store";
import { installFetchHook, installGraphQlHook } from "./overlay/hook";
import { installPlaybackHook } from "./playback";
import { registerUi } from "./ui";
import { log } from "./log";

declare const Spicetify: any;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function sp(): any {
  return typeof Spicetify === "undefined" ? undefined : Spicetify;
}

function missing(names: string[]): string[] {
  const s = sp();
  return names.filter((name) => !s?.[name]);
}

async function waitFor(ready: () => boolean, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (ready()) return true;
    await delay(200);
  }
  return ready();
}

function toast(message: string, isError = false): void {
  try {
    sp()?.showNotification?.(message, isError);
  } catch (err) {
    log.error("toast failed", err);
  }
}

async function main(): Promise<void> {
  log.info("script loaded");

  let state: PreviewState = loadState();
  const holder = {
    get: () => state,
    set: (next: PreviewState) => {
      state = next;
    },
  };

  installFetchHook(holder.get);

  const uiApis = ["Menu", "PopupModal", "showNotification"];
  if (await waitFor(() => !missing(uiApis).length, 30000)) {
    try {
      registerUi(holder);
      toast("Release Preview loaded");
    } catch (err) {
      log.error("menu registration failed", err);
      toast("Release Preview: menu registration failed", true);
    }
  } else {
    const gone = missing(uiApis);
    log.error("menu not registered, missing Spicetify APIs:", gone);
    toast(`Release Preview: missing Spicetify.${gone.join(", Spicetify.")}`, true);
  }

  if (await waitFor(() => !!sp()?.GraphQL?.Request, 30000)) installGraphQlHook(holder.get);
  else log.warn("graphql hook skipped, Spicetify.GraphQL.Request never appeared");

  if (await waitFor(() => !!sp()?.Platform?.PlayerAPI?.play, 30000)) installPlaybackHook(holder.get);
  else log.warn("playback hook skipped, Platform.PlayerAPI.play never appeared");

  log.info("ready", state.releases.length, "releases loaded");
}

main().catch((err) => {
  log.error("startup failed", err);
  toast("Release Preview: startup failed, see console", true);
});
