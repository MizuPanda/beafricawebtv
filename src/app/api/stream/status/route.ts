import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const accountId = process.env.CF_ACCOUNT_ID;
  const token = process.env.CF_STREAM_TOKEN;

  if (!accountId || !token) {
    return NextResponse.json({ error: 'Missing Cloudflare credentials' }, { status: 500 });
  }

  const { uid } = await req.json();
  if (!uid) {
    return NextResponse.json({ error: 'Missing uid' }, { status: 400 });
  }

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${uid}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }
  );

  const data = await res.json();

  // 🔎 Server-side log (visible in your terminal)
  console.log('[CF Stream status]', JSON.stringify(data, null, 2));

  if (!res.ok) {
    return NextResponse.json({ error: data }, { status: res.status });
  }

  const r = data?.result ?? {};
  // Different accounts/settings expose different fields. Capture all the likely ones:
  const playbackArrayId =
    Array.isArray(r.playback) && r.playback[0] && r.playback[0].id
      ? r.playback[0].id
      : null;

  const playbackIdsArrayId =
    Array.isArray(r.playbackIds) && r.playbackIds[0] && r.playbackIds[0].id
      ? r.playbackIds[0].id
      : null;

  return NextResponse.json({
    // what we *thought* we'd use
    readyToStream: r.readyToStream ?? false,
    status: r.status?.state ?? null,
    playbackId: playbackArrayId || playbackIdsArrayId || null,
    uid: r.uid ?? null, // <— iframe.cloudflarestream.com/{uid} also works
    // full payload for debugging in the browser console
    duration: r.duration ?? null,
    thumbnail: r.thumbnail ?? null, // 👈 add this
    raw: data,
  });
}
