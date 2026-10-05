import { Fragment, useState } from 'react';
import { TV_INSTALL_TEXT, TV_LANGS, type TvLang } from '../../lib/tvInstallText';
import { TV_APK, TV_CHECKSUM_URL, TV_SHORT_URL } from '../../lib/releases';

const TV_INSTALL_TEXT_KEY = 'moonlit.tvInstallLang';

function initialLang(): TvLang {
  try {
    const saved = localStorage.getItem(TV_INSTALL_TEXT_KEY) as TvLang | null;
    if (saved && TV_LANGS.includes(saved)) return saved;
  } catch { /* storage can be blocked */ }
  const browser = (navigator.language || 'en').slice(0, 2).toLowerCase() as TvLang;
  return TV_LANGS.includes(browser) ? browser : 'en';
}

const mono = 'font-mono text-[13px] text-text';

/** Renders one step: **bold** UI labels plus the {short} and {activate} placeholders. */
function Step({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\{short\}|\{activate\})/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p === '{short}') return <span key={i} dir="ltr" className={`${mono} inline-block`}>{TV_SHORT_URL}</span>;
        if (p === '{activate}') return <span key={i} dir="ltr" className={`${mono} inline-block`}>trymoonlit.app/activate</span>;
        if (p.startsWith('**')) return <span key={i} className="text-text">{p.slice(2, -2)}</span>;
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

export function TvInstallGuide() {
  const [lang, setLang] = useState<TvLang>(initialLang);
  const t = TV_INSTALL_TEXT[lang];

  const choose = (next: TvLang) => {
    setLang(next);
    try { localStorage.setItem(TV_INSTALL_TEXT_KEY, next); } catch { /* ignore */ }
  };

  return (
    <div id="install-android-tv" className="scroll-mt-24 rounded-2xl border border-border bg-surface px-[22px] py-5 text-sm text-muted">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold text-text" dir={t.rtl ? 'rtl' : 'ltr'}>{t.title}</p>
        <select
          aria-label={t.languageLabel}
          value={lang}
          onChange={(e) => choose(e.target.value as TvLang)}
          className="h-8 rounded-full border border-border-strong bg-bg px-3 text-[13px] text-text"
        >
          {TV_LANGS.map((l) => <option key={l} value={l}>{TV_INSTALL_TEXT[l].name}</option>)}
        </select>
      </div>

      <div dir={t.rtl ? 'rtl' : 'ltr'} lang={lang}>
        <p className="mt-3 font-semibold text-text">{t.easiest}</p>
        <ol className={`mt-2.5 list-decimal space-y-1 ${t.rtl ? 'pr-5' : 'pl-5'}`}>
          {t.steps.map((s) => <li key={s}><Step text={s} /></li>)}
        </ol>

        <p className="mt-4 font-semibold text-text">{t.adbHeading}</p>
        <pre dir="ltr" className="mt-2 overflow-x-auto rounded-lg bg-bg px-3 py-2.5 font-mono text-xs leading-relaxed text-text">{`adb connect YOUR-TV-IP\nadb install ${TV_APK}`}</pre>

        <p className="mt-3">{t.warning}</p>
        <p className="mt-2">
          {t.verify} <a className="text-accent" href={TV_CHECKSUM_URL}>{t.checksum}</a>.
        </p>
      </div>
    </div>
  );
}
