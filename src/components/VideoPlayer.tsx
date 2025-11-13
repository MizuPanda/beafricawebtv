'use client';

type Props = {
  playbackId?: string | null;
};

export default function VideoPlayer({ playbackId }: Props) {
  if (!playbackId) {
    return (
      <div className="aspect-video w-full rounded-2xl bg-slate-900/50 grid place-items-center text-slate-400">
        Vidéo en cours de préparation…
      </div>
    );
  }

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
