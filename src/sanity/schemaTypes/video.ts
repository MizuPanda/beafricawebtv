import {defineField, defineType} from 'sanity'
import StreamUploadInput from '../components/StreamUploadInput'

export default defineType({
  name: 'video',
  title: 'Vidéo',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      type: 'string',
      title: 'Titre',
      validation: rule => rule.required(),
    }),
    defineField({
      name: 'slug',
      type: 'slug',
      title: 'Slug',
      options: {source: 'title', maxLength: 96},
      validation: rule => rule.required(),
    }),
    defineField({
      name: 'description',
      type: 'text',
      title: 'Description',
    }),
    defineField({
      name: 'thumbnail',
      type: 'image',
      title: 'Miniature',
    }),
    defineField({
      name: 'publishedAt',
      type: 'datetime',
      title: 'Date de publication',
      initialValue: () => new Date().toISOString(),
    }),
    defineField({
      name: 'streamPlaybackId',
      type: 'string',
      title: 'Identifiant de lecture Cloudflare Stream',
      description: 'Renseigné automatiquement après téléversement.',
      components: {input: StreamUploadInput},
    }),
    defineField({
      name: 'duration',
      type: 'number',
      title: 'Durée (secondes)',
      readOnly: true,
      hidden: true,
    }),
    defineField({
      name: 'streamThumbnailUrl',
      type: 'url',
      title: 'Miniature Cloudflare',
      readOnly: true,
      hidden: true,
    }),
  ],
})
