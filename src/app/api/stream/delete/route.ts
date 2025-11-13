import {NextResponse} from 'next/server'

export async function POST(req: Request) {
  const accountId = process.env.CF_ACCOUNT_ID
  const token = process.env.CF_STREAM_TOKEN

  if (!accountId || !token) {
    return NextResponse.json({error: 'Missing Cloudflare credentials'}, {status: 500})
  }

  let uid: unknown
  try {
    const body = await req.json()
    uid = body?.uid
  } catch {
    return NextResponse.json({error: 'Invalid JSON payload'}, {status: 400})
  }

  if (typeof uid !== 'string' || uid.trim() === '') {
    return NextResponse.json({error: 'Missing Cloudflare Stream UID'}, {status: 400})
  }

  const normalizedUid = uid.trim()
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${normalizedUid}`
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
