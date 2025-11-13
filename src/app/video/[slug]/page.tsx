import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { sanityClient } from '../../../sanity/lib/sanity';
import VideoBackButton from '@/components/VideoBackButton';
import VideoPlayer from '@/components/VideoPlayer';
import VideoShareButton from '@/components/VideoShareButton';
import { getVideoThumbnailUrl } from '@/utils/videoThumbnails';

const FALLBACK_OPENGRAPH_IMAGE = '/images/channel-avatar.jpg';

type HeaderList = Awaited<ReturnType<typeof headers>>;

type VideoDoc = {
  title: string;
  description?: string;
  publishedAt?: string;
  thumbnail?: unknown;
  stream?: {
    playbackId?: string | null;
    uid?: string | null;
    duration?: number | null;
    thumbnailUrl?: string | null;
  } | null;
};

async function getVideo(slug: string) {
  const query = `*[_type == "video" && slug.current == $slug][0]{
    title,
    description,
    publishedAt,
    thumbnail,
    stream {
      playbackId,
      uid,
      duration,
      thumbnailUrl
    }
  }`;
  return sanityClient.fetch<VideoDoc | null>(query, { slug });
}


function resolveBaseUrl(headerList: HeaderList): string | null {
  const forwardedProto = headerList.get('x-forwarded-proto');
  const proto = forwardedProto?.split(',')[0]?.trim() ?? 'https';
  const host =
    headerList.get('x-forwarded-host') ??
    headerList.get('host') ??
    process.env.VERCEL_URL ??
    process.env.NEXT_PUBLIC_SITE_URL;

  if (!host) return null;

  const normalizedHost = host.startsWith('http') ? host : `${proto}://${host}`;
  try {
    const url = new URL(normalizedHost);
    return url.origin;
  } catch {
    return null;
  }
}

function resolveOgImageUrl(
  video: VideoDoc,
  headerList: HeaderList,
): string | null {
  const directThumbnail = getVideoThumbnailUrl(video);
  if (directThumbnail) return directThumbnail;

  const baseUrl = resolveBaseUrl(headerList);
  if (!baseUrl) return null;

  return new URL(FALLBACK_OPENGRAPH_IMAGE, baseUrl).toString();
}

function resolveCanonicalUrl(
  slug: string,
  headerList: HeaderList,
): string | null {
  const baseUrl = resolveBaseUrl(headerList);
  if (!baseUrl) return null;

  return new URL(`/video/${slug}`, baseUrl).toString();
}

export async function generateMetadata(
  { params }: Pick<PageProps, 'params'>,
): Promise<Metadata> {
  const resolvedParams = params ? await params : undefined;
  const slug = resolvedParams?.slug;
  if (!slug) return { title: 'Video not found' };

  const headerList = await headers();

  const video = await getVideo(slug);
  if (!video) return { title: 'Video not found' };

  const title = video.title;
  const description =
    (video.description && video.description.slice(0, 160)) ||
    'Watch this video';
  const ogImageUrl = resolveOgImageUrl(video, headerList);
  const canonicalUrl = resolveCanonicalUrl(slug, headerList);

  return {
    title,
    description,
    alternates: canonicalUrl
      ? {
          canonical: canonicalUrl,
        }
      : undefined,
    openGraph: {
      title,
      description,
      type: 'video.other',
      url: canonicalUrl ?? undefined,
      images: ogImageUrl
        ? [
            {
              url: ogImageUrl,
              width: 1280,
              height: 720,
              alt: `${title} - Beafrica WebTV`,
            },
          ]
        : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ogImageUrl ? [ogImageUrl] : undefined,
    },
  };
}

type PageProps = {
  params?: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
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
  searchParams: Awaited<PageProps['searchParams']>,
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
  const resolvedParams = params ? await params : undefined;
  const slug = resolvedParams?.slug;
  if (!slug) return notFound();

  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  const video = await getVideo(slug);
  if (!video) return notFound();

  // 👇 headers() is async in your setup
  const headerList = await headers();
  const hostHeader =
    headerList.get('x-forwarded-host') ?? headerList.get('host');
  const refererPath = sanitizeRefererPath(
    headerList.get('referer'),
    hostHeader,
  );
  const queryBackPath = pickBackPathFromQuery(resolvedSearchParams);

  const date = video.publishedAt
    ? new Date(video.publishedAt).toLocaleDateString()
    : undefined;

  const playbackId = video.stream?.playbackId ?? null;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
        <div className="flex items-center gap-3 text-sm">
          <VideoBackButton
            className="text-blue-600 underline"
            queryHref={queryBackPath}
            referrerHref={refererPath}
          />
          {date && <span className="text-slate-300">| {date}</span>}
        </div>

        <h1 className="text-2xl font-semibold sm:text-3xl">{video.title}</h1>

        {/* Player */}
        {playbackId ? (
          <div className="overflow-hidden rounded-2xl">
            <VideoPlayer playbackId={playbackId} />
          </div>
        ) : (
        <p className="text-sm text-red-400">
          No playback ID set for this video. Add one in the Studio.
          </p>
        )}

        <VideoShareButton
          title={video.title}
          description={video.description}
          path={`/video/${slug}`}
          className="sm:flex-row sm:items-center sm:gap-3"
        />

        {/* Description */}
        {video.description && (
          <section className="prose prose-sm max-w-none text-slate-200 sm:prose-base">
            <p className="break-words whitespace-pre-wrap">{video.description}</p>
          </section>
        )}
      </div>
    </main>
  );
}
