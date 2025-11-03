import Link from 'next/link';
import { urlFor } from '../sanity/lib/sanityImage';

type Props = {
  title: string;
  slug: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  thumbnail?: any;       // Sanity image
  streamId?: string;     // Cloudflare playbackId or UID
};

export default function VideoCard({ title, slug, thumbnail, streamId }: Props) {
  const sanityUrl = thumbnail
    ? urlFor(thumbnail).width(640).height(360).fit('crop').url()
    : null;

  // Cloudflare public thumbnail endpoint (works with playbackId or UID)
  // You can add width/height/time params if you want: ?height=360&time=1
  const cfThumb = streamId
    ? `https://videodelivery.net/${streamId}/thumbnails/thumbnail.jpg?height=360`
    : null;

  const thumbUrl = sanityUrl || cfThumb || null;

  return (
    <Link
      href={`/video/${slug}`}
      className="group block overflow-hidden rounded-xl border hover:shadow-lg transition"
    >
      <div className="aspect-video bg-gray-100">
        {thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl}
            alt={title}
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
          />
        ) : (
          <div className="h-full w-full grid place-items-center text-gray-400 text-sm">
            No thumbnail
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-base font-medium line-clamp-2">{title}</h3>
      </div>
    </Link>
  );
}