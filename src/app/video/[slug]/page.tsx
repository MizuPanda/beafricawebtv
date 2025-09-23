import { notFound } from 'next/navigation';
import { sanityClient } from '../../../sanity/lib/sanity';
import VideoPlayer from '@/components/VideoPlayer';
import Link from 'next/link';
import type { Metadata } from 'next';

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
  { params }: { params: { slug: string } }
): Promise<Metadata> {
  const video = await getVideo(params.slug);
  if (!video) return { title: 'Video not found' };

  const title = video.title;
  const description =
    (video.description && video.description.slice(0, 160)) || 'Watch this video';

  return {
    title,
    description,
    openGraph: { title, description, type: 'video.other' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function Page({ params }: { params: { slug: string } }) {
  const video = await getVideo(params.slug);
  if (!video) return notFound();

  const date =
    video.publishedAt
      ? new Date(video.publishedAt).toLocaleDateString()
      : undefined;

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3 text-sm">
        <Link href="/" className="text-blue-600 underline">&larr; Back</Link>
        {date && <span className="text-gray-500">• {date}</span>}
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