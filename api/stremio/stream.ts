import { classifyStreamProbe } from '../../src/lib/stream-probe';

export const config = { runtime: 'edge' };

async function probeBrowserPlayable(url: string): Promise<{ playable: boolean; reason?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url, {
      headers: { Range: 'bytes=0-1023' },
      redirect: 'follow',
      signal: controller.signal,
    });
    const bytes = new Uint8Array(await res.arrayBuffer());
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
    const probe = await probeBrowserPlayable(stream.url);
    if (probe.playable) return stream;
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

  const data = await annotateBrowserPlayableStreams(await res.json());
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
