import {NextResponse} from 'next/server'

export async function POST(req: Request) {
  const accountId = process.env.CF_ACCOUNT_ID
  const token = process.env.CF_STREAM_TOKEN

  if (!accountId || !token) {
    return NextResponse.json({error: 'Missing Cloudflare credentials'}, {status: 500})
  }

  const {uid} = await req.json()
  if (!uid) {
    return NextResponse.json({error: 'Missing uid'}, {status: 400})
  }

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${uid}`,
    {
      headers: {Authorization: `Bearer ${token}`},
      cache: 'no-store',
    },
  )

  const data = await res.json()

  console.log('[CF Stream status]', JSON.stringify(data, null, 2))

  if (!res.ok) {
    return NextResponse.json({error: data}, {status: res.status})
  }

  const r = data?.result ?? {}
  const playbackArrayId =
    Array.isArray(r.playback) && r.playback[0] && r.playback[0].id
      ? r.playback[0].id
      : null

  const playbackIdsArrayId =
    Array.isArray(r.playbackIds) && r.playbackIds[0] && r.playbackIds[0].id
      ? r.playbackIds[0].id
      : null

  const pct =
    typeof r.status?.pctComplete === 'number' ? Math.max(0, Math.min(100, r.status.pctComplete)) : null

  return NextResponse.json({
    readyToStream: r.readyToStream ?? false,
    status: r.status?.state ?? null,
    progress: pct,
    errorReason: r.status?.errorReason ?? null,
    playbackId: playbackArrayId || playbackIdsArrayId || null,
    uid: r.uid ?? null, // <- iframe.cloudflarestream.com/{uid} fonctionne aussi
    duration: r.duration ?? null,
    thumbnail: r.thumbnail ?? null,
    raw: data,
  })
}
