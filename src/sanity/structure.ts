import type {StructureResolver} from 'sanity/structure'

// https://www.sanity.io/docs/structure-builder-cheat-sheet
export const structure: StructureResolver = S =>
  S.list()
    .title('Contenus éditoriaux')
    .items([
      S.documentTypeListItem('video').title('Vidéos'),
      S.divider(),
      ...S.documentTypeListItems().filter(item => item.getId() !== 'video'),
    ])
