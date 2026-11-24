/**
 * Fixed Wikimedia Commons photos by place id (take priority over all other image sources).
 * Use null for no photo.
 */
export const IMAGE_OVERRIDES = {
  // search matched photos from elsewhere
  'reindeer-farm-rovaniemi': 'Reindeer Rovaniemi.jpg',
  'levi-northern-lights-snowmobile': 'Green aurora curtain over Levi, Kittilä, Lapland, Finland, 2023 September.jpg',
  'reindeer-sledge-ride-inari': 'Reindeer farm, Inari, Suomi - Finland 2013-03-10 g.jpg',
  'joensuu-orthodox-church': 'Joensuu, Saint Nicholas Church in April 2016.JPG',
  'glass-igloo-aurora-night': 'Kakslauttanen Igloo village.jpg',
  'husky-sled-safari-rovaniemi': 'Huskysafarialappin.jpg',
  'pyha-ski-resort': 'Pyhä Ski Slopes (4866414897).jpg',

  // nearby but unrelated buildings / roads
  'kenkavero-vicarage': 'Kenkävero Mikkeli.jpg',
  'hanko-water-tower': 'Hanko water tower - Hangon vesitorni C IMG 2370.jpg',
  'kuusijarvi-recreation-area': 'Kuusijärvi smoke saunas letting some smoke, Kuninkaanmäki, Vantaa, Finland, 2023 April.jpg',
  'hameenlinna-prison-museum': 'Hämeenlinna vankila museo Prison 1 (2019).jpg',
  'botania-tropical-garden': 'Botania kasvitieteellinen puutarha, Joensuu.JPG',
  'jatkankamppa-smoke-sauna': 'Suomalainen savusauna.jpg',
  'lampivaara-amethyst-mine': 'Ametisti kide Suomi Lappi Luosto.jpg',
  'ounasvaara-fell': 'Luminen Ounasvaara.jpg',
  'postimaki-outdoor-museum': 'Postbacken 01.jpg',

  // no photo found automatically
  'iittala-village': 'Iittala glass village view.jpg',
  'kalajoki-sandbanks': 'Kalajoen hiekkasärkät 2017.jpg',

  // no suitable photo available
  'arctic-snowhotel': null,
  'malva-art-museum': null,
};
