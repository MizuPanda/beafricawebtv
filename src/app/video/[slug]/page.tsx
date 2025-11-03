import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { sanityClient } from '../../../sanity/lib/sanity';
import VideoBackButton from '@/components/VideoBackButton';
import VideoPlayer from '@/components/VideoPlayer';

type VideoDoc = {
  title: string;
  description?: string;
  streamPlaybackId?: string;
  publishedAt?: string;
};

async function getVideo(slug: string) {
  const query = `*[_type == "video" && slug.current == $slug][0]{
    title, description, streamPlaybackId, publishedAt
  }`;
  return sanityClient.fetch<VideoDoc | null>(query, { slug });
}

export async function generateMetadata(
  { params }: { params: { slug: string } },
): Promise<Metadata> {
  const video = await getVideo(params.slug);
  if (!video) return { title: 'Video not found' };

  const title = video.title;
  const description =
    (video.description && video.description.slice(0, 160)) ||
    'Watch this video';

  return {
    title,
    description,
    openGraph: { title, description, type: 'video.other' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

type PageProps = {
  params: { slug: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

function sanitizeInternalPath(
  value: string | null | undefined,
): string | null {
  if (!value || typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed.startsWith('/')) return null;
  if (trimmed.startsWith('//')) return null;

  return trimmed;
}

function pickBackPathFromQuery(
  searchParams: PageProps['searchParams'],
): string | null {
  if (!searchParams) return null;

  const candidateKeys = ['from', 'origin', 'ref', 'returnTo', 'redirect'];

  for (const key of candidateKeys) {
    const raw = searchParams[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    const path = sanitizeInternalPath(value);
    if (path) return path;
  }

  return null;
}

function sanitizeRefererPath(
  referer: string | null,
  hostHeader: string | null,
): string | null {
  if (!referer || !hostHeader) return null;

  const allowedHost = hostHeader.split(',')[0]?.trim();
  if (!allowedHost) return null;

  try {
    const refererUrl = new URL(referer);
    if (refererUrl.host !== allowedHost) return null;

    return `${refererUrl.pathname}${refererUrl.search}${refererUrl.hash}`;
  } catch {
    return null;
  }
}

export default async function Page({ params, searchParams }: PageProps) {
  const video = await getVideo(params.slug);
  if (!video) return notFound();

  const headerList = headers();
  const hostHeader =
    headerList.get('x-forwarded-host') ?? headerList.get('host');
  const refererPath = sanitizeRefererPath(
    headerList.get('referer'),
    hostHeader,
  );
  const queryBackPath = pickBackPathFromQuery(searchParams);

  const date = video.publishedAt
    ? new Date(video.publishedAt).toLocaleDateString()
    : undefined;

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3 text-sm">
        <VideoBackButton
          className="text-blue-600 underline"
          queryHref={queryBackPath}
          referrerHref={refererPath}
        />
        {date && <span className="text-gray-500">| {date}</span>}
      </div>

      <h1 className="text-2xl sm:text-3xl font-semibold">{video.title}</h1>

      {/* Player */}
      {video.streamPlaybackId ? (
        <div className="rounded-2xl overflow-hidden">
          <VideoPlayer playbackId={video.streamPlaybackId} />
        </div>
      ) : (
        <p className="text-sm text-red-600">
          No playback ID set for this video. Add one in the Studio.
        </p>
      )}

      {/* Description */}
      {video.description && (
        <section className="prose prose-sm sm:prose-base max-w-none">
          <p>{video.description}</p>
        </section>
      )}
    </main>
  );
}
