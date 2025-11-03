import { urlFor } from '@/sanity/lib/sanityImage';

type VideoImageSource = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  thumbnail?: any;
  streamPlaybackId?: string;
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

  if (video.streamPlaybackId) {
    return `https://videodelivery.net/${video.streamPlaybackId}/thumbnails/thumbnail.jpg?height=720`;
  }

  return null;
};
