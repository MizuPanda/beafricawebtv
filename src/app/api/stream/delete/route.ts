import {NextResponse} from 'next/server'

export async function POST(req: Request) {
  const accountId = process.env.CF_ACCOUNT_ID
  const token = process.env.CF_STREAM_TOKEN

  if (!accountId || !token) {
    return NextResponse.json({error: 'Missing Cloudflare credentials'}, {status: 500})
  }

  let id: unknown
  try {
    const body = await req.json()
    id = body?.id ?? body?.uid ?? body?.playbackId
  } catch {
    return NextResponse.json({error: 'Invalid JSON payload'}, {status: 400})
  }

  if (typeof id !== 'string' || id.trim() === '') {
    return NextResponse.json({error: 'Missing Cloudflare Stream identifier'}, {status: 400})
  }

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${id}`
  const res = await fetch(endpoint, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    let errorPayload: unknown = null
    try {
      errorPayload = await res.json()
    } catch {
      errorPayload = await res.text()
    }
    return NextResponse.json(
      {
        error: 'Unable to delete Cloudflare Stream asset',
        details: errorPayload,
      },
      {status: res.status},
    )
  }

  return NextResponse.json({deleted: true})
}
