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
      name: 'stream',
      title: 'Cloudflare Stream',
      type: 'object',
      description: 'Téléversement et métadonnées Cloudflare Stream.',
      components: {
        input: StreamUploadInput,
      },
      fields: [
        defineField({
          name: 'playbackId',
          type: 'string',
          title: 'Identifiant de lecture Cloudflare Stream',
          readOnly: true,
        }),
        defineField({
          name: 'uid',
          type: 'string',
          title: 'Identifiant Cloudflare Stream (UID)',
          description:
            'Identifiant interne utilisé pour les API Cloudflare (statut, suppression).',
          readOnly: true,
          hidden: true,
        }),
        defineField({
          name: 'duration',
          type: 'number',
          title: 'Durée (secondes)',
          readOnly: true,
          hidden: true,
        }),
        defineField({
          name: 'thumbnailUrl',
          type: 'url',
          title: 'Miniature Cloudflare',
          readOnly: true,
          hidden: true,
        }),
      ],
    }),
  ],
})
