import { PreviewState } from "./manifest";
import { loadState } from "./store";
import { installFetchHook, installGraphQlHook } from "./overlay/hook";
import { installPlaybackHook } from "./playback";
import { registerUi } from "./ui";
import { log } from "./log";

declare const Spicetify: any;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForSpicetify(): Promise<void> {
  const ready = () =>
    typeof Spicetify !== "undefined" &&
    Spicetify.Platform &&
    Spicetify.Menu &&
    Spicetify.PopupModal &&
    Spicetify.GraphQL &&
    Spicetify.CosmosAsync;
  while (!ready()) await delay(200);
}

async function main(): Promise<void> {
  await waitForSpicetify();
  let state: PreviewState = loadState();
  const holder = {
    get: () => state,
    set: (next: PreviewState) => {
      state = next;
    },
  };
  installFetchHook(holder.get);
  installGraphQlHook(holder.get);
  installPlaybackHook(holder.get);
  registerUi(holder);
  log.info("ready", state.releases.length, "releases loaded");
}

main().catch((err) => log.error("startup failed", err));
