'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

type VideoPreview = {
  _id: string;
  title: string;
  slug: { current: string };
  thumbnailUrl: string | null;
  description?: string;
  streamPlaybackId?: string;
  publishedAt?: string;
};

type VideoInfiniteGridProps = {
  initialVideos: VideoPreview[];
  initialOffset: number;
  totalCount: number;
  pageSize?: number;
  autoLoadOnMount?: boolean;
  showManualTrigger?: boolean;
};

const DEFAULT_PAGE_SIZE = 6;

export default function VideoInfiniteGrid({
  initialVideos,
  initialOffset,
  totalCount,
  pageSize = DEFAULT_PAGE_SIZE,
  autoLoadOnMount = false,
  showManualTrigger = true,
}: VideoInfiniteGridProps) {
  const [videos, setVideos] = useState<VideoPreview[]>(initialVideos);
  const [offset, setOffset] = useState(initialOffset);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoLoadEnabled, setAutoLoadEnabled] = useState(autoLoadOnMount);
  const [hasMore, setHasMore] = useState(initialOffset < totalCount);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/videos?offset=${offset}&limit=${pageSize}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Impossible de charger plus de vidéos pour le moment.');
      }

      const data: {
        videos: VideoPreview[];
        totalCount: number;
        hasMore: boolean;
      } = await response.json();

      if (Array.isArray(data.videos) && data.videos.length > 0) {
        setVideos(prev => {
          const existingIds = new Set(prev.map(video => video._id));
          const merged = data.videos.filter(video => !existingIds.has(video._id));
          return [...prev, ...merged];
        });
        const nextOffset = offset + data.videos.length;
        setOffset(nextOffset);
        setHasMore(data.hasMore);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inattendue.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [hasMore, loading, offset, pageSize]);

  useEffect(() => {
    if (autoLoadOnMount) {
      setAutoLoadEnabled(true);
    }
  }, [autoLoadOnMount]);

  useEffect(() => {
    if (!autoLoadEnabled || !hasMore) {
      return;
    }

    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [autoLoadEnabled, hasMore, loadMore]);

  const handleEnableAutoLoad = () => {
    if (!autoLoadEnabled) {
      setAutoLoadEnabled(true);
    }
    void loadMore();
  };

  if (totalCount === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-10 text-center text-slate-300">
        Aucune vidéo n&apos;est encore publiée.
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-8 text-center text-slate-300">
        Aucune autre vidéo n&apos;est disponible pour le moment.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {videos.map(video => {
          const fallbackThumb =
            video.thumbnailUrl ??
            (video.streamPlaybackId
              ? `https://videodelivery.net/${video.streamPlaybackId}/thumbnails/thumbnail.jpg?height=360`
              : null);

          return (
            <Link
              key={video._id}
              href={`/video/${video.slug.current}`}
              className="group block overflow-hidden rounded-xl border border-white/10 bg-slate-950/60 hover:border-white/20 hover:shadow-lg transition"
            >
              <div className="aspect-video bg-slate-900">
                {fallbackThumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={fallbackThumb}
                    alt={video.title}
                    className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-sm text-slate-300">
                    Miniature à venir
                  </div>
                )}
              </div>
              <div className="p-3">
                <h3 className="text-base font-medium text-white line-clamp-2">{video.title}</h3>
              </div>
            </Link>
          );
        })}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {hasMore && showManualTrigger ? (
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={handleEnableAutoLoad}
            disabled={loading}
            className="rounded-full border border-white/20 px-5 py-2 text-sm font-medium text-white transition hover:border-white/40 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Chargement…' : autoLoadEnabled ? 'Charger plus de vidéos' : 'Voir toute la vidéothèque'}
          </button>
        </div>
      ) : null}

      {autoLoadEnabled && hasMore ? (
        <div className="text-center text-xs text-slate-400">
          Faites défiler pour charger plus de vidéos
        </div>
      ) : null}

      {autoLoadEnabled && hasMore ? (
        <div ref={sentinelRef} className="h-1 w-full" />
      ) : null}
    </div>
  );
}
