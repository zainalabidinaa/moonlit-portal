/** Canvas renderer for 1920×1080 cover export only.
 *
 *  The live preview uses HTML/CSS. This module only handles the final PNG export.
 */

export const COVER_W = 1920;
export const COVER_H = 1080;

export interface Sphere {
  x: number; y: number; r: number; c: number[];
}

export interface CoverOptions {
  title: string;
  subtitle: string;
  accentColor: string;
  backgroundImg: HTMLImageElement | null;
  bgOpacity: number;
  spheres: Sphere[];
  vignette: boolean;
  filmGrain: boolean;
  meshPrism: boolean;
  topGradient: boolean;
  titleFont: string;
  titleSize: number;
  titleY: number;
  bodyFont: string;
  subtitleSize: number;
  subtitleColor: string;
}

const SPHERE_COLORS_DEFAULT: Sphere[] = [
  { x: 150, y: 150, r: 600, c: [212, 175, 55] },
  { x: 1850, y: 900, r: 650, c: [79, 70, 229] },
  { x: 960, y: 150, r: 500, c: [226, 232, 240] },
];

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  if (h.length === 3) return [parseInt(h[0]+h[0],16), parseInt(h[1]+h[1],16), parseInt(h[2]+h[2],16)];
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}

function drawSphere(ctx: CanvasRenderingContext2D, s: Sphere) {
  const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
  const [r, g, b] = s.c;
  grad.addColorStop(0, `rgba(${r},${g},${b},0.22)`);
  grad.addColorStop(0.5, `rgba(${r},${g},${b},0.06)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
}

function drawTopGradient(ctx: CanvasRenderingContext2D, w: number) {
  const grad = ctx.createLinearGradient(0, 0, 0, 500);
  grad.addColorStop(0, 'rgba(0,0,0,0.70)');
  grad.addColorStop(0.5, 'rgba(0,0,0,0.25)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, 500);
}

function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w / 2, cy = h / 2;
  const maxR = Math.sqrt(cx * cx + cy * cy);
  const grad = ctx.createRadialGradient(cx, cy, maxR * 0.55, cx, cy, maxR * 1.1);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.7, 'rgba(0,0,0,0.12)');
  grad.addColorStop(1, 'rgba(0,0,0,0.78)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

function drawFilmGrain(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const id = ctx.getImageData(0, 0, w, h);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 12;
    d[i]=Math.min(255,Math.max(0,d[i]+n));
    d[i+1]=Math.min(255,Math.max(0,d[i+1]+n));
    d[i+2]=Math.min(255,Math.max(0,d[i+2]+n));
  }
  ctx.putImageData(id, 0, 0);
}

function drawGradientTitle(
  ctx: CanvasRenderingContext2D, text: string, font: string, accent: string, w: number, y: number,
) {
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const tw = ctx.measureText(text).width;
  const x = w / 2;
  const th = 90;

  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillText(text, x + 6, y + 6);
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillText(text, x + 3, y + 3);

  const left = x - tw / 2;
  const half = tw / 2;
  const center = left + half;
  for (let i = 0; i < Math.ceil(tw); i++) {
    const px = left + i;
    const dist = Math.abs(px - center);
    const t = Math.min(dist / (half + 1), 1);
    const tEased = t > 0.6 ? (t - 0.6) / 0.4 : 0;
    const [ar, ag, ab] = hexToRgb(accent);
    ctx.fillStyle = `rgb(${Math.round(255*(1-tEased)+ar*tEased)},${Math.round(255*(1-tEased)+ag*tEased)},${Math.round(255*(1-tEased)+ab*tEased)})`;
    ctx.fillRect(px, y - 4, 1, th + 8);
  }

  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = '#fff';
  ctx.fillText(text, x, y);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, x, y);
}

export function renderCover(
  ctx: CanvasRenderingContext2D, opts: CoverOptions, w = COVER_W, h = COVER_H,
) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#08080a';
  ctx.fillRect(0, 0, w, h);

  if (opts.meshPrism) {
    const spheres = opts.spheres.length ? opts.spheres : SPHERE_COLORS_DEFAULT;
    for (const s of spheres) drawSphere(ctx, s);
  }

  if (opts.backgroundImg) {
    ctx.save();
    ctx.globalAlpha = opts.bgOpacity;
    ctx.drawImage(opts.backgroundImg, 0, 0, w, h);
    ctx.restore();
  }

  if (opts.topGradient) drawTopGradient(ctx, w);
  if (opts.vignette) drawVignette(ctx, w, h);
  if (opts.filmGrain) drawFilmGrain(ctx, w, h);

  const titleFontStr = `800 ${opts.titleSize}px "${opts.titleFont}", sans-serif`;
  drawGradientTitle(ctx, opts.title, titleFontStr, opts.accentColor, w, opts.titleY);

  if (opts.subtitle) {
    ctx.font = `600 ${opts.subtitleSize}px "${opts.bodyFont}", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillText(opts.subtitle, w / 2 + 2, opts.titleY + opts.titleSize + 22);
    ctx.fillStyle = opts.subtitleColor;
    ctx.fillText(opts.subtitle, w / 2, opts.titleY + opts.titleSize + 20);
  }
}
