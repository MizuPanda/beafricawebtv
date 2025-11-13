import { urlFor } from '@/sanity/lib/sanityImage';

type VideoImageSource = {
  thumbnail?: unknown; // Sanity image
  stream?: {
    playbackId?: string | null;
    thumbnailUrl?: string | null;
  } | null;
};

export const getVideoThumbnailUrl = (video?: VideoImageSource): string | null => {
  if (!video) {
    return null;
  }

  const sanityThumb = video.thumbnail
    ? urlFor(video.thumbnail).width(1280).height(720).fit('crop').url()
    : null;

  if (sanityThumb) {
    return sanityThumb;
  }

  if (video.stream?.thumbnailUrl) {
    return video.stream.thumbnailUrl;
  }

  if (video.stream?.playbackId) {
    return `https://videodelivery.net/${video.stream.playbackId}/thumbnails/thumbnail.jpg?height=720`;
  }

  return null;
};
