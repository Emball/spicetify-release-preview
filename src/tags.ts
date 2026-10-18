import { log } from "./log";

export interface FileMeta {
  title: string;
  artist?: string;
  album?: string;
  trackNumber?: number;
  durationMs: number;
  coverDataUrl?: string;
}

interface Id3Tags {
  title?: string;
  artist?: string;
  album?: string;
  trackNumber?: number;
  cover?: { bytes: Uint8Array; mime: string };
}

function synchsafe(b: Uint8Array, o: number): number {
  return (b[o] << 21) | (b[o + 1] << 14) | (b[o + 2] << 7) | b[o + 3];
}

function plainInt(b: Uint8Array, o: number): number {
  return (b[o] * 2 ** 24) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3];
}

function decode(enc: number, bytes: Uint8Array): string {
  let label = "utf-8";
  let data = bytes;
  if (enc === 0) label = "windows-1252";
  if (enc === 1 || enc === 2) {
    const bigEndian = (data[0] === 0xfe && data[1] === 0xff) || enc === 2;
    label = bigEndian ? "utf-16be" : "utf-16le";
    if ((data[0] === 0xfe && data[1] === 0xff) || (data[0] === 0xff && data[1] === 0xfe)) data = data.slice(2);
  }
  return new TextDecoder(label).decode(data).replace(/\0+$/, "");
}

function parseCover(d: Uint8Array): Id3Tags["cover"] {
  const enc = d[0];
  let p = 1;
  const mimeEnd = d.indexOf(0, p);
  if (mimeEnd < 0) return undefined;
  const mime = new TextDecoder("latin1").decode(d.slice(p, mimeEnd)).replace("image/jpg", "image/jpeg");
  p = mimeEnd + 2;
  if (enc === 1 || enc === 2) {
    while (p + 1 < d.length && !(d[p] === 0 && d[p + 1] === 0)) p += 2;
    p += 2;
  } else {
    while (p < d.length && d[p] !== 0) p++;
    p += 1;
  }
  return { bytes: new Uint8Array(d.subarray(p)), mime: mime.startsWith("image/") ? mime : "image/jpeg" };
}

export async function readId3(file: File): Promise<Id3Tags> {
  const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
  if (String.fromCharCode(head[0], head[1], head[2]) !== "ID3") return {};
  const version = head[3];
  if (version !== 3 && version !== 4) {
    log.warn("unsupported ID3 version", version, "for", file.name);
    return {};
  }
  const tagSize = synchsafe(head, 6);
  const tag = new Uint8Array(await file.slice(10, 10 + tagSize).arrayBuffer());
  const tags: Id3Tags = {};

  let p = 0;
  if (head[5] & 0x40) p = version === 4 ? synchsafe(tag, 0) : plainInt(tag, 0) + 4;

  while (p + 10 <= tag.length && tag[p] !== 0) {
    const id = String.fromCharCode(tag[p], tag[p + 1], tag[p + 2], tag[p + 3]);
    const size = version === 4 ? synchsafe(tag, p + 4) : plainInt(tag, p + 4);
    const body = tag.slice(p + 10, p + 10 + size);
    p += 10 + size;
    if (!body.length) continue;

    if (id === "TIT2") tags.title = decode(body[0], body.slice(1));
    else if (id === "TPE1") tags.artist = decode(body[0], body.slice(1));
    else if (id === "TALB") tags.album = decode(body[0], body.slice(1));
    else if (id === "TRCK") tags.trackNumber = parseInt(decode(body[0], body.slice(1)), 10) || undefined;
    else if (id === "APIC" && !tags.cover) tags.cover = parseCover(body);
  }
  return tags;
}

function readDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const done = (ms: number) => {
      URL.revokeObjectURL(url);
      resolve(ms);
    };
    audio.preload = "metadata";
    audio.onloadedmetadata = () => done(Math.round(audio.duration * 1000));
    audio.onerror = () => {
      log.warn("duration read failed for", file.name);
      done(0);
    };
    audio.src = url;
  });
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function readFileMeta(file: File): Promise<FileMeta> {
  let tags: Id3Tags = {};
  try {
    tags = await readId3(file);
  } catch (err) {
    log.warn("tag read failed for", file.name, err);
  }
  const durationMs = await readDuration(file);
  const coverDataUrl = tags.cover
    ? await blobToDataUrl(new Blob([tags.cover.bytes as BlobPart], { type: tags.cover.mime }))
    : undefined;
  const meta: FileMeta = {
    title: tags.title ?? file.name.replace(/\.[^.]+$/, ""),
    artist: tags.artist,
    album: tags.album,
    trackNumber: tags.trackNumber,
    durationMs,
    coverDataUrl,
  };
  log.info("read file meta", file.name, meta.title, meta.durationMs, "ms");
  return meta;
}

export function buildLocalUri(artist: string, album: string, title: string, durationMs: number): string {
  const enc = (s: string) => encodeURIComponent(s).replace(/%20/g, "+");
  return `spotify:local:${enc(artist)}:${enc(album)}:${enc(title)}:${Math.round(durationMs / 1000)}`;
}
