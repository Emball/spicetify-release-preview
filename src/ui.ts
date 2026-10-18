import { PreviewState, ReleaseSpec, newReleaseId } from "./manifest";
import { exportState, importState, saveState, upsertRelease } from "./store";
import { FileMeta, blobToDataUrl, buildLocalUri, readFileMeta } from "./tags";
import { dominantColor } from "./color";
import { log } from "./log";

declare const Spicetify: any;

export interface StateHolder {
  get(): PreviewState;
  set(state: PreviewState): void;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  style = "",
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  if (style) node.setAttribute("style", style);
  return node;
}

function field(label: string, input: HTMLElement): HTMLElement {
  const wrap = el("label", {}, "display:flex;flex-direction:column;gap:4px;font-size:13px;");
  wrap.append(el("span", { textContent: label }), input);
  return wrap;
}

const INPUT_STYLE =
  "padding:8px;border-radius:4px;border:1px solid var(--spice-button-disabled,#555);background:var(--spice-card,#222);color:var(--spice-text,#fff);";
const BUTTON_STYLE =
  "padding:8px 16px;border-radius:500px;border:0;cursor:pointer;font-weight:700;background:var(--spice-button,#1db954);color:var(--spice-main,#000);";

async function currentArtist(): Promise<{ uri: string; name: string } | undefined> {
  const path: string = Spicetify.Platform?.History?.location?.pathname ?? "";
  const match = path.match(/^\/artist\/([0-9A-Za-z]{22})/);
  if (!match) return undefined;
  const uri = `spotify:artist:${match[1]}`;
  try {
    const res = await Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/artists/${match[1]}`);
    return { uri, name: res?.name ?? "" };
  } catch (err) {
    log.warn("artist name lookup failed", err);
    return { uri, name: "" };
  }
}

async function buildRelease(
  form: {
    artistUri: string;
    artistName: string;
    title: string;
    type: ReleaseSpec["type"];
    date: string;
    label: string;
    color: string;
    useCustomColor: boolean;
  },
  audio: File[],
  coverFile: File | undefined,
): Promise<ReleaseSpec> {
  const metas: { meta: FileMeta; index: number }[] = [];
  for (const [index, file] of audio.entries()) metas.push({ meta: await readFileMeta(file), index });
  metas.sort((a, b) => (a.meta.trackNumber ?? 999 + a.index) - (b.meta.trackNumber ?? 999 + b.index));

  const first = metas[0]?.meta;
  const title = form.title || first?.album || "Untitled";
  const artistName = form.artistName || first?.artist || "Unknown Artist";
  const coverUrl = coverFile ? await blobToDataUrl(coverFile) : first?.coverDataUrl;
  const auto = coverUrl ? await dominantColor(coverUrl) : undefined;

  return {
    id: newReleaseId(),
    artistUri: form.artistUri,
    artistName,
    title,
    type: form.type,
    releaseDate: form.date || new Date().toISOString().slice(0, 10),
    label: form.label || undefined,
    coverUrl,
    color: form.useCustomColor ? form.color : auto,
    tracks: metas.map(({ meta }) => ({
      title: meta.title,
      lengthMs: meta.durationMs,
      artists: meta.artist ? [meta.artist] : undefined,
      localUri: buildLocalUri(meta.artist ?? artistName, meta.album ?? title, meta.title, meta.durationMs),
    })),
  };
}

function renderModal(holder: StateHolder): HTMLElement {
  const root = el("div", {}, "display:flex;flex-direction:column;gap:12px;min-width:420px;");

  const artistUri = el("input", { placeholder: "spotify:artist:..." }, INPUT_STYLE);
  const artistName = el("input", { placeholder: "Artist name" }, INPUT_STYLE);
  const useArtist = el("button", { textContent: "Use current artist page" }, BUTTON_STYLE);
  useArtist.onclick = async () => {
    const found = await currentArtist();
    if (!found) return Spicetify.showNotification("Open an artist page first", true);
    artistUri.value = found.uri;
    artistName.value = found.name;
  };

  const title = el("input", { placeholder: "Defaults to the album tag" }, INPUT_STYLE);
  const type = el("select", {}, INPUT_STYLE);
  for (const t of ["album", "single", "ep"]) type.append(el("option", { value: t, textContent: t }));
  const date = el("input", { type: "date" }, INPUT_STYLE);
  const label = el("input", { placeholder: "Label (optional)" }, INPUT_STYLE);
  const color = el("input", { type: "color", value: "#535353" }, "height:32px;");
  const useColor = el("input", { type: "checkbox" });
  const colorRow = el("div", {}, "display:flex;gap:8px;align-items:center;font-size:13px;");
  colorRow.append(useColor, el("span", { textContent: "Custom header color (otherwise taken from cover)" }), color);

  const cover = el("input", { type: "file", accept: "image/*" });
  const audio = el("input", { type: "file", accept: "audio/*", multiple: true });

  const save = el("button", { textContent: "Save test release" }, BUTTON_STYLE);
  save.onclick = async () => {
    if (!artistUri.value.startsWith("spotify:artist:")) {
      return Spicetify.showNotification("Enter or pick a valid artist URI", true);
    }
    if (!audio.files?.length) return Spicetify.showNotification("Add at least one audio file", true);
    save.disabled = true;
    try {
      const release = await buildRelease(
        {
          artistUri: artistUri.value.trim(),
          artistName: artistName.value.trim(),
          title: title.value.trim(),
          type: type.value as ReleaseSpec["type"],
          date: date.value,
          label: label.value.trim(),
          color: color.value,
          useCustomColor: useColor.checked,
        },
        Array.from(audio.files),
        cover.files?.[0],
      );
      holder.set(upsertRelease(holder.get(), release));
      Spicetify.showNotification(`Saved "${release.title}" with ${release.tracks.length} tracks`);
      Spicetify.PopupModal.hide();
    } catch (err) {
      log.error("save release failed", err);
      Spicetify.showNotification("Could not save release, see console", true);
    } finally {
      save.disabled = false;
    }
  };

  const existing = el("div", {}, "display:flex;flex-direction:column;gap:6px;font-size:13px;");
  for (const release of holder.get().releases) {
    const row = el("div", {}, "display:flex;justify-content:space-between;align-items:center;");
    row.append(el("span", { textContent: `${release.artistName} - ${release.title}` }));
    const remove = el("button", { textContent: "Delete" }, BUTTON_STYLE);
    remove.onclick = () => {
      const next = { ...holder.get(), releases: holder.get().releases.filter((r) => r.id !== release.id) };
      saveState(next);
      holder.set(next);
      row.remove();
    };
    row.append(remove);
    existing.append(row);
  }

  const exportBtn = el("button", { textContent: "Export JSON" }, BUTTON_STYLE);
  exportBtn.onclick = () => {
    const blob = new Blob([exportState(holder.get())], { type: "application/json" });
    const a = el("a", { href: URL.createObjectURL(blob), download: "release-preview.json" });
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importInput = el("input", { type: "file", accept: "application/json" });
  importInput.onchange = async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    try {
      holder.set(importState(await file.text()));
      Spicetify.showNotification("Imported release preview data");
      Spicetify.PopupModal.hide();
    } catch (err) {
      log.error("import failed", err);
      Spicetify.showNotification("Import failed, not a release-preview file", true);
    }
  };

  const backup = el("div", {}, "display:flex;gap:12px;align-items:center;");
  backup.append(exportBtn, importInput);

  root.append(
    useArtist,
    field("Artist URI", artistUri),
    field("Artist name", artistName),
    field("Title", title),
    field("Type", type),
    field("Release date", date),
    field("Label", label),
    colorRow,
    field("Cover image (optional, else embedded art)", cover),
    field("Audio files", audio),
    save,
    el("hr"),
    existing,
    backup,
  );
  return root;
}

export function registerUi(holder: StateHolder): void {
  new Spicetify.Menu.Item("Release Preview", false, () => {
    Spicetify.PopupModal.display({ title: "Release Preview", content: renderModal(holder), isLarge: true });
  }).register();
  log.info("menu item registered");
}
