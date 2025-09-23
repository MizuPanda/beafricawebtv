'use client';

import * as React from 'react';
import { set, unset, PatchEvent } from 'sanity';

type Props = {
  value?: string;                  // current streamPlaybackId
  onChange: (patchEvent: PatchEvent) => void;
  schemaType: any;
};

type CreateUploadResponse = { uploadURL: string; uid: string };

export default function StreamUploadInput({ value, onChange }: Props) {
  const [uploading, setUploading] = React.useState(false);
  const [progressText, setProgressText] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [meta, setMeta] = React.useState<{ duration?: number | null; thumbnail?: string | null }>({});

  async function createDirectUpload(): Promise<CreateUploadResponse> {
    const res = await fetch('/api/stream/create-upload', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to create direct upload URL');
    return res.json();
  }

  async function pollUntilReady(uid: string): Promise<{ id: string | null; duration: number | null; thumbnail: string | null }> {
    for (;;) {
      await new Promise(r => setTimeout(r, 3000));
      const res = await fetch('/api/stream/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(`Status check failed: ${JSON.stringify(data)}`);

      const isReady = data.readyToStream || data.status === 'ready';
      const id = data.playbackId || data.uid || null;

      if (isReady && id) {
        return {
          id,
          duration: (typeof data.duration === 'number' ? data.duration : null),
          thumbnail: (typeof data.thumbnail === 'string' ? data.thumbnail : null),
        };
      }
      setProgressText(`Processing… (${data.status ?? 'queued'})`);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);
    setProgressText('Requesting upload URL…');

    try {
        const { uploadURL, uid } = await createDirectUpload();

        setProgressText('Uploading to Cloudflare…');
        const form = new FormData();
        form.append('file', file, file.name);

        const uploadRes = await fetch(uploadURL, { method: 'POST', body: form });
        if (!uploadRes.ok) throw new Error(`Upload failed: ${await uploadRes.text()}`);

        setProgressText('Processing on Cloudflare…');
        const { id, duration, thumbnail } = await pollUntilReady(uid);
        if (!id) throw new Error('No playback/uid returned');

        // 🔧 Defer the patch to avoid "getAttribute only applies to plain objects"
        queueMicrotask(() => {
            onChange(PatchEvent.from(set(id))); // only set current field
        });

        setProgressText('Done.');
        setMeta({ duration, thumbnail }); // local preview only
    } catch (err: any) {
        console.error(err);
        setError(err?.message ?? String(err));
        onChange(PatchEvent.from(unset())); // clear current field on error
    } finally {
        setUploading(false);
        e.target.value = '';
    }
}

  function clearValue() {
    onChange(PatchEvent.from(unset()));
    setMeta({});
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {value ? (
        <div style={{ display: 'grid', gap: 6 }}>
          <div><strong>Playback ID:</strong> {value}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={clearValue}>Clear</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          <input type="file" accept="video/*" onChange={handleFileChange} disabled={uploading} />
        </div>
      )}

      {uploading && <div>{progressText ?? 'Uploading…'}</div>}
      {error && <div style={{ color: 'crimson' }}>{error}</div>}

      {meta?.thumbnail && (
        <div style={{ display: 'grid', gap: 6, maxWidth: 320 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={meta.thumbnail}
            alt="Stream thumbnail"
            style={{ width: '100%', borderRadius: 8, border: '1px solid #e5e7eb' }}
          />
        </div>
      )}
      {typeof meta?.duration === 'number' && (
        <div style={{ color: '#6b7280' }}>
          Duration: {Math.floor((meta.duration ?? 0) / 60)}:
          {String(Math.floor((meta.duration ?? 0) % 60)).padStart(2, '0')}
        </div>
      )}
    </div>
  );
}
