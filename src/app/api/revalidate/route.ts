import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export async function POST(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get('secret');

  if (secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Sanity can send various payload shapes; we try a few safe paths.
  let body: any = {};
  try { body = await req.json(); } catch { /* ignore empty body */ }

  const slug =
    body?.slug?.current ??
    body?.slug ??
    body?.after?.slug?.current ?? // if using "document mutations" payload
    null;

  // Revalidate the homepage list
  revalidatePath('/');

  // Revalidate the specific video page if we got a slug
  if (slug && typeof slug === 'string') {
    revalidatePath(`/video/${slug}`);
  }

  return NextResponse.json({ ok: true, revalidated: true, slug: slug ?? null });
}
