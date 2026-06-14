import { useEffect, useState, useRef } from 'react';
import { useParams, useSearch, useRouter } from '@tanstack/react-router';
import { useAuth } from '@/app/AuthProvider';
import Player from '@/components/Player';
import { StreamItem } from '@/lib/types';
import { SubtitleItem, fetchSubtitlesFromAll, fetchStreamsFromAll } from '@/lib/stremio';
import { getCachedStreams, getCachedStream, cacheStreams } from '@/lib/stream-cache';
import { getPlayableStreamUrl, sortStreamsForBrowserPlayback, getStreamCompatibility, getInitialSourceType } from '@/lib/player-utils';
import { getLastStream, saveLastStream } from '@/lib/last-stream';
import { getStreamingServerUrl } from '@/lib/config';
import { buildRemuxUrl } from '@/lib/streaming-server';
import { ChevronLeft } from 'lucide-react';

export default function WatchPage() {
  const { type, id } = useParams({ strict: false }) as { type: string; id: string };
  const { url: initialUrl = '', cid: cacheId = '', title: displayTitle, logo: mediaLogo, poster: mediaPoster, background: mediaBackground, pos: resumePosition } =
    useSearch({ strict: false }) as { url?: string; cid?: string; title?: string; logo?: string; poster?: string; background?: string; pos?: number };
  // Prefer the wide backdrop for the loading-screen bg; fall back to portrait poster
  const loadingBg = mediaBackground || mediaPoster;
  const router = useRouter();
  const { addons, isLoading: authLoading } = useAuth();

  const resolvedTitle = displayTitle || decodeURIComponent(id);
  const cachedStreams = cacheId ? (getCachedStreams(cacheId) ?? []) : [];
  const cachedStream = cacheId && initialUrl ? getCachedStream(cacheId, initialUrl) : null;

  const [activeStream, setActiveStream] = useState<StreamItem>(
    cachedStream || (initialUrl ? { url: initialUrl, addonName: 'Direct' } : { url: '', addonName: '' })
  );
  const [activeUrl, setActiveUrl] = useState(initialUrl);
  const [allStreams, setAllStreams] = useState<StreamItem[]>(cachedStreams);
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>([]);
  // null = still fetching, string = error message, '' = ready
  // Skip fetch if we already have cached streams from the browse page prefetch
  const hasCachedStreams = cachedStreams.length > 0;
  const [fetchError, setFetchError] = useState<string | null>(initialUrl || hasCachedStreams ? '' : null);
  const savedPosition = useRef(0);

  // Pre-warm the streaming server so it's ready if a non-direct stream is picked.
  // Fire-and-forget — we don't care about the response.
  useEffect(() => {
    const serverUrl = getStreamingServerUrl();
    if (serverUrl) fetch(`${serverUrl}/settings`, { signal: AbortSignal.timeout(10000) }).catch(() => {});
  }, []);

  // Fetch streams for this title — always runs so Sources stays complete even
  // when the page was opened with a pre-selected URL (initialUrl) or cached streams.
  useEffect(() => {
    if (authLoading) return;
    if (addons.length === 0) return;
    // If the browse page prefetched and cached streams, use them immediately.
    if (hasCachedStreams) {
      setAllStreams(cachedStreams);
    }

    let cancelled = false;
    if (!hasCachedStreams && !initialUrl) setFetchError(null);

    (async () => {
      try {
        // Always fetch fresh — if we had cached streams they were used to start
        // playback immediately, but we still refresh so newly-added addons appear.
        const fetched = await fetchStreamsFromAll(type, id, addons);
        if (cancelled) return;
        const cacheKey = `${type}:${id}`;
        cacheStreams(cacheKey, fetched);
        setAllStreams(fetched);

        // When a URL was pre-selected (clicked from browse), check if the now-resolved
        // full stream metadata reveals bad audio (EAC3/DTS/TrueHD). If a streaming
        // server is configured, silently re-route through it so audio works.
        if (initialUrl) {
          const fullStream = fetched.find(s => s.url === initialUrl || s.externalUrl === initialUrl);
          if (fullStream) {
            const serverUrl = getStreamingServerUrl();
            const tier = getStreamCompatibility(fullStream);
            if (serverUrl && tier !== 'direct' && !initialUrl.startsWith(serverUrl)) {
              const effectiveTier = tier === 'remux' ? 'remux' : 'transcode';
              setActiveStream({ ...fullStream, behaviorHints: { ...fullStream.behaviorHints, webPlayableType: 'application/x-mpegurl' } });
              setActiveUrl(buildRemuxUrl(serverUrl, initialUrl, effectiveTier));
            }
          }
        }

        if (!initialUrl) {
          // Prefer the stream the user last played for this title (mirrors iOS LastPlaybackSourceStore).
          const lastStream = getLastStream(`${type}:${id}`);
          const lastMatch = lastStream ? fetched.find(s => s.url === lastStream.url) : null;
          const best = lastMatch ?? sortStreamsForBrowserPlayback(fetched)[0];
          if (lastMatch) console.log(`[watch] resuming last stream: ${lastStream!.url}`);
          if (best) {
            const rawUrl = getPlayableStreamUrl(best) ?? '';
            const serverUrl = getStreamingServerUrl();
            const tier = getStreamCompatibility(best);
            console.log(`[watch] stream tier: ${tier} | server: ${serverUrl ? 'configured' : 'none'}`);

            // Only route through server for streams that actually need it.
            // direct-tier HTTPS streams: try the browser first — elfhosted and
            // similar proxies often redirect to CDN URLs the browser can load.
            // HTTP streams still need the server to avoid mixed-content blocking.
            const needsServer = serverUrl && (
              tier !== 'direct' ||
              (rawUrl.startsWith('http:') && window.location.protocol === 'https:')
            );

            if (needsServer) {
              const effectiveTier = tier === 'direct' ? 'remux' : tier;
              const remuxed = buildRemuxUrl(serverUrl, rawUrl, effectiveTier);
              console.log(`[watch] routing via server (${effectiveTier}): ${remuxed}`);
              setActiveStream({
                ...best,
                behaviorHints: { ...best.behaviorHints, webPlayableType: 'application/x-mpegurl' },
              });
              setActiveUrl(remuxed);
            } else {
              console.log(`[watch] direct play (${tier}): ${rawUrl}`);
              setActiveStream(best);
              setActiveUrl(rawUrl);
            }
            saveLastStream(`${type}:${id}`, { url: rawUrl, addonName: best.addonName, streamTitle: best.title ?? best.name });
            setFetchError('');
          } else {
            setFetchError('No playable sources found for this title.');
          }
        }
      } catch {
        if (!cancelled) setFetchError('Failed to load sources. Check your addons in Settings.');
      }
    })();

    return () => { cancelled = true; };
  }, [type, id, addons, authLoading]);

  useEffect(() => {
    if (!addons || addons.length === 0) return;
    fetchSubtitlesFromAll(type, id, addons).then(setSubtitles).catch(() => {});
  }, [type, id, addons]);

  function handleSwitchStream(newStream: StreamItem) {
    const rawUrl = getPlayableStreamUrl(newStream);
    if (!rawUrl) return;
    const video = document.querySelector('video');
    savedPosition.current = video?.currentTime || 0;
    const serverUrl = getStreamingServerUrl();
    const tier = getStreamCompatibility(newStream);
    const needsServer = serverUrl && !rawUrl.startsWith(serverUrl) && (
      tier !== 'direct' ||
      (rawUrl.startsWith('http:') && window.location.protocol === 'https:')
    );
    if (needsServer) {
      const effectiveTier = tier === 'direct' ? 'remux' : tier;
      setActiveStream({ ...newStream, behaviorHints: { ...newStream.behaviorHints, webPlayableType: 'application/x-mpegurl' } });
      setActiveUrl(buildRemuxUrl(serverUrl, rawUrl, effectiveTier));
    } else {
      setActiveStream(newStream);
      setActiveUrl(rawUrl);
    }
    saveLastStream(`${type}:${id}`, { url: rawUrl, addonName: newStream.addonName, streamTitle: newStream.title ?? newStream.name });
  }

  // Still fetching streams — cinematic loading screen
  if (fetchError === null) {
    return (
      <div className="fixed inset-0 bg-black z-50 overflow-hidden select-none">
        {/* Wide backdrop (background image preferred, portrait poster fallback) */}
        {loadingBg && (
          <>
            <img
              src={loadingBg}
              alt=""
              className="absolute inset-0 w-full h-full object-cover scale-110"
              style={{ filter: 'blur(24px)', opacity: 0.4 }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/20" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/30 to-transparent" />
          </>
        )}

        {/* Back button */}
        <button
          onClick={() => router.history.back()}
          className="absolute top-5 left-6 z-10 flex items-center gap-2 text-white/70 hover:text-white transition-colors text-sm font-medium"
        >
          <ChevronLeft size={20} strokeWidth={2} />
          Back
        </button>

        {/* Centre: show logo + spinner */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-8">
          {mediaLogo
            ? <img src={mediaLogo} alt={resolvedTitle} className="max-h-24 max-w-xs object-contain drop-shadow-2xl animate-pulse" />
            : <h2 className="text-3xl font-black text-white text-center drop-shadow-2xl animate-pulse leading-tight">{resolvedTitle}</h2>}
          <div className="flex items-center gap-3 rounded-full border border-white/10 bg-black/40 px-4 py-2 backdrop-blur-xl">
            <span className="h-2 w-2 rounded-full bg-nightarc-accent animate-pulse" />
            <span className="text-sm font-semibold text-white/60">Finding best source</span>
          </div>
        </div>
      </div>
    );
  }

  // Fetch completed but no playable stream found
  if (fetchError) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center gap-4 select-none">
        <p className="text-white text-lg font-semibold">Nothing to play</p>
        <p className="text-white/50 text-sm text-center max-w-xs px-4">{fetchError}</p>
        <button
          onClick={() => router.history.back()}
          className="mt-2 px-6 py-2.5 bg-white/10 hover:bg-white/15 border border-white/10 text-white rounded-full text-sm"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <Player
      streamUrl={activeUrl}
      streams={allStreams}
      currentStream={activeStream}
      title={resolvedTitle}
      mediaLogo={mediaLogo}
      mediaPoster={mediaPoster}
      mediaId={id}
      mediaType={type}
      startPosition={savedPosition.current > 0 ? savedPosition.current : resumePosition}
      subtitles={subtitles}
      onSwitchStream={handleSwitchStream}
      onBack={() => router.history.back()}
    />
  );
}
