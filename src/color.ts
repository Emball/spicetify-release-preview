import { log } from "./log";

export function dominantColor(imageUrl: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const size = 32;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(undefined);
      ctx.drawImage(img, 0, 0, size, size);
      const { data } = ctx.getImageData(0, 0, size, size);
      let r = 0, g = 0, b = 0, weight = 0;
      for (let i = 0; i < data.length; i += 4) {
        const max = Math.max(data[i], data[i + 1], data[i + 2]);
        const min = Math.min(data[i], data[i + 1], data[i + 2]);
        const w = 0.1 + (max - min) / 255;
        r += data[i] * w;
        g += data[i + 1] * w;
        b += data[i + 2] * w;
        weight += w;
      }
      const hex = [r, g, b]
        .map((v) => Math.round(v / weight).toString(16).padStart(2, "0"))
        .join("");
      resolve(`#${hex}`);
    };
    img.onerror = () => {
      log.warn("dominant color extraction failed");
      resolve(undefined);
    };
    img.src = imageUrl;
  });
}
