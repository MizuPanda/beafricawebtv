import {NextRequest, NextResponse} from 'next/server'

type ClientPayload = {
  filename?: string
  filetype?: string
  filesize?: number
  maxDurationSeconds?: number
}

const DEFAULT_MAX_DURATION_SECONDS = 60 * 60 * 3

function toBase64(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64')
}

function sanitizeFilename(value: string | undefined): string {
  if (!value) return 'upload'
  const trimmed = value.trim()
  if (!trimmed) return 'upload'
  return trimmed
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 150) || 'upload'
}

export async function POST(req: NextRequest) {
  const accountId = process.env.CF_ACCOUNT_ID
  const token = process.env.CF_STREAM_TOKEN

  if (!accountId || !token) {
    return NextResponse.json({error: 'Missing Cloudflare credentials'}, {status: 500})
  }

  let payload: ClientPayload
  try {
    payload = (await req.json()) as ClientPayload
  } catch {
    return NextResponse.json({error: 'Invalid upload payload'}, {status: 400})
  }

  const {filename, filetype, filesize, maxDurationSeconds} = payload ?? {}

  if (typeof filesize !== 'number' || Number.isNaN(filesize) || filesize <= 0) {
    return NextResponse.json({error: 'Missing or invalid filesize'}, {status: 400})
  }

  const safeFilename = sanitizeFilename(filename)
  const safeFiletype =
    typeof filetype === 'string' && filetype.trim() ? filetype.trim() : 'application/octet-stream'
  const duration =
    typeof maxDurationSeconds === 'number' && maxDurationSeconds > 0
      ? maxDurationSeconds
      : DEFAULT_MAX_DURATION_SECONDS

  const metadataEntries: Array<[string, string]> = [
    ['filename', safeFilename],
    ['filetype', safeFiletype],
    ['maxDurationSeconds', String(duration)],
  ]

  const uploadMetadata = metadataEntries.map(([key, value]) => `${key} ${toBase64(value)}`).join(',')

  const cfResponse = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream?direct_user=true`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Tus-Resumable': '1.0.0',
        'Upload-Length': String(filesize),
        'Upload-Metadata': uploadMetadata,
      },
    },
  )

  const rawBody = await cfResponse.text()
  let parsedBody: unknown = null
  try {
    parsedBody = rawBody ? JSON.parse(rawBody) : null
  } catch {
    parsedBody = rawBody || null
  }

  if (!cfResponse.ok) {
    return NextResponse.json(
      {
        error:
          typeof parsedBody === 'string'
            ? parsedBody
            : parsedBody ?? 'Cloudflare Stream request failed',
      },
      {status: cfResponse.status || 502},
    )
  }

  const headerEntries = Array.from(cfResponse.headers.entries())
  const locationHeader = headerEntries.find(
    ([key]) => key.toLowerCase() === 'location',
  )?.[1] as string | undefined

  if (!locationHeader) {
    return NextResponse.json(
      {error: 'Cloudflare Stream did not return an upload URL'},
      {status: 502},
    )
  }

  const uidHeader = headerEntries.find(([key]) => key.toLowerCase() === 'stream-media-id')?.[1]
  const resultUid =
    (parsedBody as {result?: {uid?: string}} | null)?.result?.uid ?? uidHeader ?? null

  return NextResponse.json({
    uploadURL: locationHeader,
    uid: resultUid,
  })
}
