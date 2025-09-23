import { sanityClient } from '../sanity/lib/sanity';
import VideoCard from '@/components/VideoCard';

type VideoListItem = {
  _id: string;
  title: string;
  slug: { current: string };
  thumbnail?: any;             // Sanity image (optional)
  streamPlaybackId?: string;   // Cloudflare playbackId or UID
  publishedAt?: string;
};

export default async function Home() {
  const videos = await sanityClient.fetch<VideoListItem[]>(
    `*[_type == "video"] | order(publishedAt desc){
      _id, title, slug, thumbnail, streamPlaybackId, publishedAt
    }`
  );

  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Videos</h1>

      {videos.length === 0 ? (
        <p className="text-gray-600">No videos yet. Add one in <code>/studio</code>.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map(v => (
            <VideoCard
              key={v._id}
              title={v.title}
              slug={v.slug.current}
              thumbnail={v.thumbnail}
              streamId={v.streamPlaybackId} // 👈 pass it down
            />
          ))}
        </div>
      )}
    </main>
  );
}