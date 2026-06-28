import { useCallback, useState, type DragEvent, type ChangeEvent } from 'react';

const COVER_W = 1920;
const COVER_H = 1080;

export default function CardGeneratorPage() {
  const [title, setTitle] = useState('Moonlit');
  const [subtitle, setSubtitle] = useState('');
  const [titleFont, setTitleFont] = useState('Montserrat');
  const [titleSize, setTitleSize] = useState(96);
  const [titleY, setTitleY] = useState(60);
  const [bodyFont, setBodyFont] = useState('Inter');
  const [subtitleSize, setSubtitleSize] = useState(28);
  const [subtitleColor, setSubtitleColor] = useState('#cbd5e1');
  const [accentColor, setAccentColor] = useState('#6366f1');
  const [bgDataUrl, setBgDataUrl] = useState<string | null>(null);
  const [bgOpacity, setBgOpacity] = useState(1);
  const [topGradient, setTopGradient] = useState(true);
  const [vignette, setVignette] = useState(true);
  const [dragBg, setDragBg] = useState(false);

  // ── Load image as base64 data URL ──────────────────────────────
  const loadBg = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setBgDataUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleBgDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragBg(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) loadBg(file);
  };

  const handleBgFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadBg(file);
  };

  const removeBg = () => setBgDataUrl(null);

  // ── Download: render to canvas with fresh Image load ───────────
  const handleDownload = useCallback(() => {
    const dataUrl = bgDataUrl;
    console.log('[CoverGen] download — dataUrl:', dataUrl ? `${dataUrl.slice(0, 50)}...` : 'none');

    const canvas = document.createElement('canvas');
    canvas.width = COVER_W;
    canvas.height = COVER_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw dark base
    ctx.fillStyle = '#08080a';
    ctx.fillRect(0, 0, COVER_W, COVER_H);

    // Draw background image
    const drawRest = () => {
      // Top gradient
      if (topGradient) {
        const grad = ctx.createLinearGradient(0, 0, 0, 500);
        grad.addColorStop(0, 'rgba(0,0,0,0.70)');
        grad.addColorStop(0.5, 'rgba(0,0,0,0.25)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, COVER_W, 500);
      }

      // Vignette
      if (vignette) {
        const cx = COVER_W / 2;
        const cy = COVER_H / 2;
        const maxR = Math.sqrt(cx * cx + cy * cy);
        const grad = ctx.createRadialGradient(cx, cy, maxR * 0.55, cx, cy, maxR * 1.1);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(0.7, 'rgba(0,0,0,0.12)');
        grad.addColorStop(1, 'rgba(0,0,0,0.78)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, COVER_W, COVER_H);
      }

      // Title with shadow
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const titleFontStr = `800 ${titleSize}px "${titleFont}", sans-serif`;
      ctx.font = titleFontStr;

      // Shadow layers
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillText(title, COVER_W / 2 + 6, titleY + 6);
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillText(title, COVER_W / 2 + 3, titleY + 3);

      // Gradient title: white center → accent edges
      const tw = ctx.measureText(title).width;
      const left = COVER_W / 2 - tw / 2;
      const half = tw / 2;
      const center = left + half;
      const th = 90;
      const a = hexToRgb(accentColor);

      for (let i = 0; i < Math.ceil(tw); i++) {
        const px = left + i;
        const dist = Math.abs(px - center);
        const t = Math.min(dist / (half + 1), 1);
        const tEased = t > 0.6 ? (t - 0.6) / 0.4 : 0;
        ctx.fillStyle = `rgb(${Math.round(255*(1-tEased)+a[0]*tEased)},${Math.round(255*(1-tEased)+a[1]*tEased)},${Math.round(255*(1-tEased)+a[2]*tEased)})`;
        ctx.fillRect(px, titleY - 4, 1, th + 8);
      }

      // Clip gradient to text shape
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = '#fff';
      ctx.fillText(title, COVER_W / 2, titleY);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#fff';
      ctx.fillText(title, COVER_W / 2, titleY);

      // Subtitle
      if (subtitle) {
        ctx.font = `600 ${subtitleSize}px "${bodyFont}", sans-serif`;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillText(subtitle, COVER_W / 2 + 2, titleY + titleSize + 22);
        ctx.fillStyle = subtitleColor;
        ctx.fillText(subtitle, COVER_W / 2, titleY + titleSize + 20);
      }

      // Export
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title.replace(/\s+/g, '_').toLowerCase()}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }, 'image/png');
    };

    if (dataUrl) {
      const img = new Image();
      img.onload = () => {
        console.log('[CoverGen] image loaded for export:', img.naturalWidth, 'x', img.naturalHeight);
        ctx.save();
        ctx.globalAlpha = bgOpacity;
        ctx.drawImage(img, 0, 0, COVER_W, COVER_H);
        ctx.restore();
        drawRest();
      };
      img.onerror = () => {
        console.error('[CoverGen] image failed to load for export');
        drawRest();
      };
      img.src = dataUrl;
    } else {
      drawRest();
    }
  }, [bgDataUrl, bgOpacity, topGradient, vignette, title, titleFont, titleSize, titleY, subtitle, subtitleColor, subtitleSize, bodyFont, accentColor]);

  const inputClass = 'w-full bg-surface border border-border rounded-lg px-3 py-2 text-text text-sm placeholder-faint focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors';
  const labelClass = 'block text-xs font-medium text-muted uppercase tracking-wider mb-1';

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="flex h-screen overflow-hidden">
        {/* ── PREVIEW — pure HTML/CSS ──────────────────────────── */}
        <div className="flex-1 flex items-center justify-center p-6 bg-bg2 overflow-auto">
          <div className="relative w-full max-w-[960px] rounded-lg overflow-hidden shadow-2xl border border-border" style={{ aspectRatio: '16/9' }}>
            {bgDataUrl ? (
              <img src={bgDataUrl} className="absolute inset-0 w-full h-full object-cover" style={{ opacity: bgOpacity }} alt="" />
            ) : (
              <div className="absolute inset-0 bg-[#08080a]" />
            )}

            {topGradient && (
              <div className="absolute top-0 left-0 right-0 h-[46%] pointer-events-none"
                style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.70) 0%, rgba(0,0,0,0.25) 50%, transparent 100%)' }} />
            )}

            {vignette && (
              <div className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.12) 70%, rgba(0,0,0,0.78) 110%)' }} />
            )}

            <div className="absolute left-1/2 -translate-x-1/2 text-center pointer-events-none"
              style={{ top: `${(titleY / COVER_H) * 100}%` }}>
              <h1 className="font-extrabold leading-none"
                style={{
                  fontFamily: `"${titleFont}", sans-serif`,
                  fontSize: `${(titleSize / COVER_H) * 100}vh`,
                  background: `linear-gradient(to right, ${accentColor} 0%, white 30%, white 70%, ${accentColor} 100%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.8))',
                }}>
                {title}
              </h1>
              {subtitle && (
                <p className="font-semibold mt-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]"
                  style={{ fontFamily: `"${bodyFont}", sans-serif`, fontSize: `${(subtitleSize / COVER_H) * 100}vh`, color: subtitleColor }}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── CONTROLS ────────────────────────────────────────── */}
        <div className="w-[380px] bg-surface border-l border-border overflow-y-auto p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Cover Generator</h2>
            <button onClick={handleDownload}
              className="px-4 py-2 bg-accent text-[#2a1206] font-semibold rounded-lg shadow-glow hover:bg-accent-2 transition-colors text-sm">
              Download PNG
            </button>
          </div>

          <div>
            <label className={labelClass}>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Size ({titleSize}px)</label>
              <input type="range" min="40" max="200" value={titleSize} onChange={(e) => setTitleSize(+e.target.value)} className="w-full accent-accent cursor-pointer" />
            </div>
            <div>
              <label className={labelClass}>Position ({titleY}px)</label>
              <input type="range" min="20" max="600" value={titleY} onChange={(e) => setTitleY(+e.target.value)} className="w-full accent-accent cursor-pointer" />
            </div>
          </div>

          <div>
            <label className={labelClass}>Subtitle</label>
            <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className={inputClass} placeholder="Optional tagline" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Size ({subtitleSize}px)</label>
              <input type="range" min="12" max="64" value={subtitleSize} onChange={(e) => setSubtitleSize(+e.target.value)} className="w-full accent-accent cursor-pointer" />
            </div>
            <div>
              <label className={labelClass}>Color</label>
              <div className="flex gap-1.5 items-center">
                <input type="color" value={subtitleColor} onChange={(e) => setSubtitleColor(e.target.value)} className="w-7 h-7 rounded border border-border cursor-pointer bg-transparent p-0.5" />
                <input value={subtitleColor} onChange={(e) => setSubtitleColor(e.target.value)} className={inputClass} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Accent</label>
              <div className="flex gap-1.5 items-center">
                <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="w-7 h-7 rounded border border-border cursor-pointer bg-transparent p-0.5" />
                <input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Title Font</label>
              <select value={titleFont} onChange={(e) => setTitleFont(e.target.value)} className={`${inputClass} appearance-none cursor-pointer`}>
                <option>Montserrat</option><option>Inter</option><option>SF Pro Display</option><option>Bricolage Grotesque</option><option>Funnel Display</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Body Font</label>
              <select value={bodyFont} onChange={(e) => setBodyFont(e.target.value)} className={`${inputClass} appearance-none cursor-pointer`}>
                <option>Inter</option><option>SF Pro Text</option><option>Montserrat</option><option>Funnel Display</option><option>JetBrains Mono</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Background Image</label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragBg(true); }}
              onDragLeave={() => setDragBg(false)}
              onDrop={handleBgDrop}
              onClick={() => document.getElementById('bg-upload')?.click()}
              className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${dragBg ? 'border-accent bg-accent/5' : 'border-border hover:border-faint'} ${bgDataUrl ? 'p-2' : 'py-8'}`}
            >
              {bgDataUrl ? (
                <div className="relative group">
                  <img src={bgDataUrl} className="w-full h-20 object-cover rounded" alt="" />
                  <button onClick={(e) => { e.stopPropagation(); removeBg(); }} className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                </div>
              ) : (
                <p className="text-xs text-muted">Drop an image or click to browse</p>
              )}
              <input id="bg-upload" type="file" accept="image/*" className="hidden" onChange={handleBgFile} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Image Opacity ({Math.round(bgOpacity * 100)}%)</label>
            <input type="range" min="0" max="100" value={bgOpacity * 100} onChange={(e) => setBgOpacity(+e.target.value / 100)} className="w-full accent-accent cursor-pointer" />
          </div>

          <div>
            <label className={labelClass}>Effects</label>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-text">
                <input type="checkbox" checked={vignette} onChange={(e) => setVignette(e.target.checked)} className="w-4 h-4 rounded border-border bg-surface accent-accent" />
                Vignette
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-text">
                <input type="checkbox" checked={topGradient} onChange={(e) => setTopGradient(e.target.checked)} className="w-4 h-4 rounded border-border bg-surface accent-accent" />
                Top gradient
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  if (h.length === 3) return [parseInt(h[0]+h[0],16), parseInt(h[1]+h[1],16), parseInt(h[2]+h[2],16)];
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}
