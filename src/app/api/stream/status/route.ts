import {NextResponse} from 'next/server'

const POLL_INTERVAL_MS = 4000
const MAX_WAIT_MS = 5 * 60 * 1000

type CloudflarePlayback = {id?: string | null} | null | undefined

type CloudflareResult = {
  playbackId?: string | null
  playback?: CloudflarePlayback[]
  playbackIds?: CloudflarePlayback[]
  readyToStream?: boolean
  status?: {
    state?: string | null
    pctComplete?: number | null
    errorReason?: string | null
  }
  uid?: string | null
  duration?: number | null
  thumbnail?: string | null
}

type CloudflareApiResponse = {
  result?: CloudflareResult | null
  [key: string]: unknown
}

function extractPlaybackId(result: CloudflareResult | null | undefined): string | null {
  if (!result) return null
  if (typeof result.playbackId === 'string' && result.playbackId.trim()) {
    return result.playbackId.trim()
  }
  const playbackArrayId =
    Array.isArray(result.playback) && result.playback[0] && result.playback[0]?.id
      ? result.playback[0]?.id
      : null
  const playbackIdsArrayId =
    Array.isArray(result.playbackIds) && result.playbackIds[0] && result.playbackIds[0]?.id
      ? result.playbackIds[0]?.id
      : null

  return playbackArrayId || playbackIdsArrayId || null
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

type CloudflareStatusPayload = {
  readyToStream: boolean
  status: string | null
  progress: number | null
  errorReason: string | null
  playbackId: string | null
  uid: string | null
  duration: number | null
  thumbnail: string | null
  raw: unknown
}

function normalizePct(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.min(100, value))
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.min(100, parsed))
    }
  }
  return null
}

function buildPayload(rawData: unknown, fallbackUid: string): CloudflareStatusPayload {
  const parsed = (rawData && typeof rawData === 'object' ? (rawData as CloudflareApiResponse) : {}) || {}
  const result = parsed.result ?? {}
  const pct = normalizePct(result.status?.pctComplete)

  const payload: CloudflareStatusPayload = {
    readyToStream: Boolean(result.readyToStream),
    status: typeof result.status?.state === 'string' ? result.status.state : null,
    progress: pct,
    errorReason:
      typeof result.status?.errorReason === 'string' && result.status.errorReason
        ? result.status.errorReason
        : null,
    playbackId: extractPlaybackId(result),
    uid: typeof result.uid === 'string' && result.uid ? result.uid : fallbackUid,
    duration: typeof result.duration === 'number' ? result.duration : null,
    thumbnail: typeof result.thumbnail === 'string' ? result.thumbnail : null,
    raw: rawData,
  }

  if (!payload.playbackId && payload.uid && (payload.readyToStream || payload.status === 'ready')) {
    payload.playbackId = payload.uid
  }

  return payload
}

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

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${uid}`
  const startedAt = Date.now()

  let lastPayload: CloudflareStatusPayload | null = null

  // Keep polling Cloudflare until a playback ID is available or timeout is reached.
  for (;;) {
    const res = await fetch(endpoint, {
      headers: {Authorization: `Bearer ${token}`},
      cache: 'no-store',
    })

    let data: unknown
    try {
      data = await res.json()
    } catch {
      data = null
    }

    console.log('[CF Stream status]', JSON.stringify(data, null, 2))

    if (!res.ok) {
      return NextResponse.json({error: data}, {status: res.status})
    }

    lastPayload = buildPayload(data, uid)

    const statusLabel = lastPayload.status?.toLowerCase()
    const errored =
      statusLabel === 'error' ||
      statusLabel === 'failed' ||
      Boolean(lastPayload.errorReason) ||
      data === null

    if (lastPayload.playbackId) {
      return NextResponse.json(lastPayload)
    }

    if (errored) {
      return NextResponse.json(lastPayload, {status: 502})
    }

    if (Date.now() - startedAt >= MAX_WAIT_MS) {
      return NextResponse.json(
        {
          ...lastPayload,
          timedOut: true,
          timeoutMs: MAX_WAIT_MS,
        },
        {status: 504},
      )
    }

    await wait(POLL_INTERVAL_MS)
  }
}
