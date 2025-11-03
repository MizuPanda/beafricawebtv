import VideoInfiniteGrid from '@/components/VideoInfiniteGrid';
import { sanityClient } from '@/sanity/lib/sanity';
import { getVideoThumbnailUrl } from '@/utils/videoThumbnails';

const INITIAL_PAGE_SIZE = 12;

type VideoSanityItem = {
  _id: string;
  title: string;
  slug: { current: string };
  thumbnail?: unknown;
  streamPlaybackId?: string;
  publishedAt?: string;
};

type VideoPreview = VideoSanityItem & {
  thumbnailUrl: string | null;
};

export const metadata = {
  title: 'Vidéothèque | Beafrica WebTV',
  description:
    'Découvrez l’ensemble des vidéos de Beafrica WebTV et parcourez-les librement grâce au défilement infini.',
};

export default async function VideosPage() {
  const { videos: rawVideos, total } = await sanityClient.fetch<{
    videos: VideoSanityItem[];
    total: number;
  }>(
    `{
      "videos": *[_type == "video"] | order(coalesce(publishedAt, _createdAt) desc, _createdAt desc)[0...${INITIAL_PAGE_SIZE - 1}]{
        _id, title, slug, thumbnail, streamPlaybackId, publishedAt
      },
      "total": count(*[_type == "video"])
    }`
  );

  const initialVideos: VideoPreview[] = rawVideos.map(video => ({
    ...video,
    thumbnailUrl: getVideoThumbnailUrl(video),
  }));

  const initialOffset = Math.min(total, initialVideos.length);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12">
        <header className="space-y-3">
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">Vidéothèque</h1>
          <p className="text-sm text-slate-300 sm:text-base">
            Retrouvez l’ensemble de nos émissions, replays et exclusivités dans cette galerie.
          </p>
        </header>

        <VideoInfiniteGrid
          initialVideos={initialVideos}
          initialOffset={initialOffset}
          totalCount={total}
          pageSize={INITIAL_PAGE_SIZE}
          autoLoadOnMount
          showManualTrigger={false}
        />
      </div>
    </main>
  );
}
