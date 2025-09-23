import { NextResponse } from 'next/server';

export async function POST() {
  const accountId = process.env.CF_ACCOUNT_ID;
  const token = process.env.CF_STREAM_TOKEN;

  if (!accountId || !token) {
    return NextResponse.json({ error: 'Missing Cloudflare credentials' }, { status: 500 });
  }

  // Ask Cloudflare for a direct upload URL
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        maxDurationSeconds: 60 * 60 * 3, // up to 3 hours
      }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json({ error: data }, { status: res.status });
  }

  // Return { uploadURL, uid } to the Studio client
  return NextResponse.json({
    uploadURL: data.result.uploadURL,
    uid: data.result.uid,
  });
}
