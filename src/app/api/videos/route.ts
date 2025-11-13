import { NextResponse } from 'next/server';
import { sanityClient } from '@/sanity/lib/sanity';
import { getVideoThumbnailUrl } from '@/utils/videoThumbnails';

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 9;
const MAX_LIMIT = 24;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const offsetParam = url.searchParams.get('offset');
  const limitParam = url.searchParams.get('limit');

  const offset = Math.max(Number(offsetParam ?? '0') || 0, 0);
  const requestedLimit = Math.max(Number(limitParam ?? DEFAULT_LIMIT) || DEFAULT_LIMIT, 1);
  const limit = Math.min(requestedLimit, MAX_LIMIT);

  try {
    const rawVideos = await sanityClient.fetch(
      `*[_type == "video"] | order(coalesce(publishedAt, _createdAt) desc, _createdAt desc)[${offset}...${offset + limit}]{
      _id,
      title,
      slug,
      description,
      thumbnail,
      stream {
        playbackId,
        thumbnailUrl
      },
      publishedAt
    }`
  );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const videos = rawVideos.map((video: any) => ({
      ...video,
      thumbnailUrl: getVideoThumbnailUrl(video),
    }));

    const totalCount = await sanityClient.fetch<number>(
      'count(*[_type == "video"])'
    );

    return NextResponse.json({
      videos,
      totalCount,
      hasMore: offset + videos.length < totalCount,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Erreur lors de la récupération des vidéos.';

    return NextResponse.json(
      { message },
      { status: 500 }
    );
  }
}
