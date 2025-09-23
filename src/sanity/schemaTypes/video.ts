import { defineType, defineField } from 'sanity';
import StreamUploadInput from '../components/StreamUploadInput';

export default defineType({
  name: 'video',
  title: 'Video',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      type: 'string',
      title: 'Title',
      validation: r => r.required(),
    }),
    defineField({
      name: 'slug',
      type: 'slug',
      title: 'Slug',
      options: { source: 'title', maxLength: 96 },
      validation: r => r.required(),
    }),
    defineField({ name: 'description', type: 'text', title: 'Description' }),
    defineField({ name: 'thumbnail', type: 'image', title: 'Thumbnail' }),
    defineField({ name: 'tags', type: 'array', title: 'Tags', of: [{ type: 'string' }] }),
    defineField({
      name: 'publishedAt',
      type: 'datetime',
      title: 'Published At',
      initialValue: () => new Date().toISOString(),
    }),
    defineField({
      name: 'streamPlaybackId',
      type: 'string',
      title: 'Cloudflare Stream Playback ID',
      components: { input: StreamUploadInput }, // ← attach custom input
    }),
    defineField({
     name: 'duration',
     type: 'number',
     title: 'Duration (seconds)',
     readOnly: true,
     hidden: true,
   }),
   defineField({
     name: 'streamThumbnailUrl',
     type: 'url',
     title: 'Stream Thumbnail URL',
     readOnly: true,
     hidden: true,
   }),
  ],
});
