import { classifyStreamProbe } from '../../src/lib/stream-probe.js';

export const config = { runtime: 'edge' };

function streamText(stream: any): string {
  return `${stream.name ?? ''} ${stream.title ?? ''} ${stream.description ?? ''} ${stream.behaviorHints?.filename ?? ''} ${stream.url ?? ''}`.toLowerCase();
}

function metadataRejectReason(stream: any): string | null {
  const text = streamText(stream);
  if (text.includes('.mkv')) return 'matroska-metadata';
  if (text.includes('hevc') || text.includes('h.265') || text.includes('h265') || text.includes('x265')) return 'hevc-metadata';
  if (text.includes('dolby vision') || text.includes(' dv ') || text.includes('hdr')) return 'hdr-metadata';
  return null;
}

function metadataPlayableType(stream: any): 'video/mp4' | 'application/x-mpegurl' | null {
  const text = streamText(stream);
  if (text.includes('.m3u8')) return 'application/x-mpegurl';
  if (text.includes('.mp4')) return 'video/mp4';
  return null;
}

async function readProbeBytes(res: Response): Promise<Uint8Array> {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < 1024) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      total += value.length;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const bytes = new Uint8Array(Math.min(total, 1024));
  let offset = 0;
  for (const chunk of chunks) {
    const slice = chunk.slice(0, Math.min(chunk.length, bytes.length - offset));
    bytes.set(slice, offset);
    offset += slice.length;
    if (offset >= bytes.length) break;
  }
  return bytes;
}

async function probeBrowserPlayable(stream: any): Promise<{ playable: boolean; type?: 'video/mp4' | 'application/x-mpegurl'; reason?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const headers = new Headers(stream.behaviorHints?.proxyHeaders?.request ?? {});
    if (!headers.has('Range')) headers.set('Range', 'bytes=0-1023');
    const res = await fetch(stream.url, {
      headers,
      redirect: 'follow',
      signal: controller.signal,
    });
    const bytes = await readProbeBytes(res);
    return classifyStreamProbe({ status: res.status, contentType: res.headers.get('content-type'), bytes });
  } catch {
    return { playable: false, reason: 'probe-timeout' };
  } finally {
    clearTimeout(timeout);
  }
}

async function annotateBrowserPlayableStreams(data: any): Promise<any> {
  if (!Array.isArray(data.streams)) return data;

  const streams = await Promise.all(data.streams.map(async (stream: any) => {
    if (!stream.url || stream.infoHash || stream.behaviorHints?.notWebReady) return stream;
    const metadataReason = metadataRejectReason(stream);
    if (metadataReason) {
      return { ...stream, behaviorHints: { ...stream.behaviorHints, notWebReady: true, webNotReadyReason: metadataReason } };
    }
    const metadataType = metadataPlayableType(stream);
    if (metadataType === 'application/x-mpegurl') {
      return { ...stream, behaviorHints: { ...stream.behaviorHints, webPlayableType: metadataType } };
    }
    const probe = await probeBrowserPlayable(stream);
    if (probe.playable) return { ...stream, behaviorHints: { ...stream.behaviorHints, webPlayableType: probe.type ?? metadataType ?? undefined } };
    return {
      ...stream,
      behaviorHints: {
        ...stream.behaviorHints,
        notWebReady: true,
        webNotReadyReason: probe.reason,
      },
    };
  }));

  return { ...data, streams };
}

export default async function handler(req: Request) {
  const params = new URL(req.url).searchParams;
  const baseUrl = params.get('url');
  const type = params.get('type');
  const id = params.get('id');

  if (!baseUrl || !type || !id) {
    return new Response('Missing url, type, or id', { status: 400 });
  }

  const res = await fetch(`${baseUrl}/stream/${type}/${id}.json`);
  if (!res.ok) return new Response('Upstream error', { status: res.status });

  let upstreamData: any;
  try {
    upstreamData = await res.json();
  } catch {
    return new Response('Invalid upstream stream response', { status: 502 });
  }

  const data = await annotateBrowserPlayableStreams(upstreamData);
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
