import VideoPlayer from '@/components/VideoPlayer';

export default function Page() {
  // Temporary placeholder; we’ll swap for a real Cloudflare Stream playbackId later.
  const demoPlaybackId = 'e1cba85ba3fba7b45b3447cfffe622d0';

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Video Test</h1>
      <p className="text-sm text-gray-600">
        Replace the playbackId with a real Cloudflare Stream ID to play a video.
      </p>
      <VideoPlayer playbackId={demoPlaybackId} />
    </main>
  );
}
