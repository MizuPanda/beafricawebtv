'use client';

type Props = { playbackId: string };

export default function VideoPlayer({ playbackId }: Props) {
  return (
    <div className="aspect-video w-full rounded-2xl shadow">
      <iframe
        src={`https://iframe.cloudflarestream.com/${playbackId}`}
        allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        className="h-full w-full rounded-2xl"
        loading="lazy"
        title="Video player"
      />
    </div>
  );
}
