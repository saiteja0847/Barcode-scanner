import { ean13Modules } from "../logic/ean13";

export function drawEan13(code: string): HTMLCanvasElement {
  const modules = ean13Modules(code);
  const scale = 4;
  const quiet = 12; // quiet zone in modules on each side
  const height = 120;
  const canvas = document.createElement("canvas");
  canvas.width = (modules.length + quiet * 2) * scale;
  canvas.height = height + 40;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000000";
  for (let i = 0; i < modules.length; i++) {
    if (modules[i] === "1") ctx.fillRect((quiet + i) * scale, 20, scale, height);
  }
  return canvas;
}
