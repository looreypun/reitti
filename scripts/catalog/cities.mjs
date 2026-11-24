// Curated destination catalogue for Finland.
// hub = the default start point for daily routes (station / market square / village centre).
// zone = climate zone used to derive monthly climate normals.

const c = (id, city, region, lat, lon, hub, opts = {}) => ({
  id,
  city,
  region,
  lat,
  lon,
  hub: { name: hub[0], lat: hub[1], lon: hub[2] },
  zone: opts.zone ?? 'south',
  tram: opts.tram ?? false,
  specialty: opts.specialty ?? 'seasonal Nordic dishes',
  wiki: opts.wiki ?? city,
  description: opts.description ?? '',
});

export const CITIES = [
  c('helsinki', 'Helsinki', 'Uusimaa', 60.1699, 24.9384, ['Helsinki Central Station', 60.1719, 24.9414], {
    tram: true,
    specialty: 'salmon soup (lohikeitto) and fresh Baltic herring',
    description: 'Finland’s seaside capital, mixing Neoclassical squares, Nordic design, island fortresses and public saunas.',
  }),
  c('espoo', 'Espoo', 'Uusimaa', 60.2055, 24.6559, ['Tapiola Metro Station', 60.1752, 24.8058], {
    specialty: 'modern Nordic cuisine with forest mushrooms',
    description: 'Helsinki’s green neighbour, gateway to Nuuksio National Park and home of modernist Tapiola garden city.',
  }),
  c('vantaa', 'Vantaa', 'Uusimaa', 60.2934, 25.0378, ['Tikkurila Station', 60.2925, 25.0444], {
    specialty: 'Finnish comfort food like meatballs with lingonberry',
    description: 'Airport city with Heureka science centre, aviation history and wild Sipoonkorpi forests.',
  }),
  c('porvoo', 'Porvoo', 'Uusimaa', 60.3923, 25.6651, ['Porvoo Bus Station', 60.3946, 25.6593], {
    specialty: 'Runeberg torte and riverside bistro fare',
    description: 'Finland’s second-oldest town, famous for its red riverside storehouses and cobbled Old Town.',
  }),
  c('loviisa', 'Loviisa', 'Uusimaa', 60.4569, 26.2253, ['Loviisa Market Square', 60.4566, 26.2259], {
    specialty: 'coastal fish dishes',
    description: 'Charming 18th-century coastal town with sea fortresses and historic ironworks nearby.',
  }),
  c('hanko', 'Hanko', 'Uusimaa', 59.8236, 22.9681, ['Hanko Railway Station', 59.827, 22.969], {
    specialty: 'smoked fish and summer seafood',
    description: 'Finland’s southernmost town: sandy beaches, grand wooden villas and sunny archipelago summers.',
  }),
  c('raasepori', 'Raasepori', 'Uusimaa', 59.975, 23.437, ['Ekenäs Railway Station', 59.9742, 23.43], {
    specialty: 'archipelago fish and Fiskars village bistros',
    wiki: 'Raseborg',
    description: 'Ekenäs old town, medieval castle ruins, Fiskars design village and an archipelago national park.',
  }),
  c('turku', 'Turku', 'Southwest Finland', 60.4518, 22.2666, ['Turku Market Square', 60.4512, 22.2669], {
    specialty: 'Turku mustard sausages and archipelago bread',
    description: 'Finland’s oldest city and former capital, built around the Aura River, a medieval castle and cathedral.',
  }),
  c('naantali', 'Naantali', 'Southwest Finland', 60.4678, 22.0256, ['Naantali Bus Station', 60.4669, 22.0266], {
    specialty: 'harbourside seafood',
    description: 'Idyllic seaside town with wooden Old Town lanes, the presidential summer garden and Moomin World.',
  }),
  c('rauma', 'Rauma', 'Satakunta', 61.1272, 21.5113, ['Rauma Market Square', 61.1282, 21.5113], {
    specialty: 'Rauma rye bread and fish dishes',
    description: 'Home to Old Rauma, the largest unified wooden town in the Nordics and a UNESCO World Heritage Site.',
  }),
  c('pori', 'Pori', 'Satakunta', 61.4851, 21.7974, ['Pori Market Square', 61.4848, 21.7977], {
    specialty: 'porilainen — Pori’s famous sausage sandwich',
    description: 'West-coast jazz city with the dunes of Yyteri beach and grand riverside architecture.',
  }),
  c('tampere', 'Tampere', 'Pirkanmaa', 61.4978, 23.761, ['Tampere Railway Station', 61.4985, 23.7735], {
    tram: true,
    specialty: 'black sausage (mustamakkara) with lingonberry jam',
    description: 'Lakeside industrial city between two lakes, with red-brick factories, museums and the sauna capital title.',
  }),
  c('mantta', 'Mänttä', 'Pirkanmaa', 62.0297, 24.6213, ['Mänttä Centre', 62.0297, 24.6213], {
    specialty: 'lakeside manor café fare',
    wiki: 'Mänttä-Vilppula',
    description: 'Small paper-mill town that hosts the acclaimed Serlachius art museums.',
  }),
  c('hameenlinna', 'Hämeenlinna', 'Kanta-Häme', 60.9959, 24.4643, ['Hämeenlinna Railway Station', 60.9998, 24.4781], {
    specialty: 'traditional Häme cuisine',
    description: 'Birthplace of Jean Sibelius with a medieval brick castle and the romantic Aulanko park.',
  }),
  c('lahti', 'Lahti', 'Päijät-Häme', 60.9827, 25.6612, ['Lahti Travel Centre', 60.9776, 25.6575], {
    specialty: 'lakeside fish and harbour cafés',
    description: 'Winter-sports city with landmark ski jumps, the wooden Sibelius Hall and Lake Vesijärvi harbour.',
  }),
  c('kotka', 'Kotka', 'Kymenlaakso', 60.4664, 26.9458, ['Kotka Market Square', 60.4669, 26.9452], {
    specialty: 'Baltic Sea fish and vendace',
    description: 'Maritime city with an aquarium, award-winning parks and an imperial fishing lodge.',
  }),
  c('kouvola', 'Kouvola', 'Kymenlaakso', 60.8679, 26.7042, ['Kouvola Railway Station', 60.8664, 26.7046], {
    specialty: 'hearty Kymenlaakso home cooking',
    description: 'Gateway to Repovesi National Park and the UNESCO-listed Verla mill.',
  }),
  c('lappeenranta', 'Lappeenranta', 'South Karelia', 61.0587, 28.1887, ['Lappeenranta Market Square', 61.0576, 28.1895], {
    zone: 'central',
    specialty: 'vety and atomi meat pies',
    description: 'Lake Saimaa harbour town with a hilltop fortress and the summer Sandcastle.',
  }),
  c('imatra', 'Imatra', 'South Karelia', 61.1719, 28.7524, ['Imatrankoski Centre', 61.1931, 28.7766], {
    zone: 'central',
    specialty: 'Karelian stew (karjalanpaisti)',
    description: 'Famous for the Imatrankoski rapids show and its Art Nouveau castle hotel.',
  }),
  c('savonlinna', 'Savonlinna', 'South Savo', 61.8687, 28.8867, ['Savonlinna Market Square', 61.869, 28.8852], {
    zone: 'central',
    specialty: 'lörtsy pastries and fried vendace (muikku)',
    description: 'Heart of the Saimaa lakeland, home of Olavinlinna castle and the world-famous opera festival.',
  }),
  c('mikkeli', 'Mikkeli', 'South Savo', 61.6886, 27.2723, ['Mikkeli Market Square', 61.6883, 27.2724], {
    zone: 'central',
    specialty: 'Savonian fish pies',
    description: 'Historic wartime headquarters town surrounded by lakes and ancient rock paintings.',
  }),
  c('kuopio', 'Kuopio', 'North Savo', 62.8924, 27.677, ['Kuopio Market Square', 62.8924, 27.678], {
    zone: 'central',
    specialty: 'kalakukko — rye-crusted fish and pork pie',
    description: 'Lakeland city with Puijo tower views, a lively market hall and the world’s largest smoke sauna.',
  }),
  c('jyvaskyla', 'Jyväskylä', 'Central Finland', 62.2426, 25.7473, ['Jyväskylä Travel Centre', 62.2416, 25.7537], {
    zone: 'central',
    specialty: 'lake fish and modern Finnish bistro dishes',
    description: 'University town nicknamed the Athens of Finland, full of Alvar Aalto architecture.',
  }),
  c('joensuu', 'Joensuu', 'North Karelia', 62.601, 29.7636, ['Joensuu Market Square', 62.6012, 29.7605], {
    zone: 'central',
    specialty: 'Karelian pies (karjalanpiirakka) with egg butter',
    description: 'Riverside capital of North Karelia with Karelian food culture and tropical Botania.',
  }),
  c('koli', 'Koli', 'North Karelia', 63.0964, 29.8056, ['Koli Village', 63.0964, 29.8056], {
    zone: 'central',
    specialty: 'Karelian pies and lake fish',
    description: 'Iconic national landscape of hills rising above Lake Pielinen.',
  }),
  c('vaasa', 'Vaasa', 'Ostrobothnia', 63.096, 21.6158, ['Vaasa Market Square', 63.0951, 21.6165], {
    zone: 'central',
    specialty: 'Ostrobothnian bread cheese and fish',
    description: 'Sunny bilingual coastal city and gateway to the UNESCO Kvarken Archipelago.',
  }),
  c('kalajoki', 'Kalajoki', 'North Ostrobothnia', 64.2597, 23.9486, ['Kalajoki Centre', 64.2597, 23.9486], {
    zone: 'north',
    specialty: 'smoked salmon and rieska flatbread',
    description: 'Seaside resort known for vast sand dunes and family water fun.',
  }),
  c('oulu', 'Oulu', 'North Ostrobothnia', 65.0121, 25.4651, ['Oulu Market Square', 65.0136, 25.465], {
    zone: 'north',
    specialty: 'rieska flatbread and fried vendace',
    description: 'Northern tech city at the mouth of the Oulujoki river, European Capital of Culture 2026.',
  }),
  c('sotkamo', 'Sotkamo (Vuokatti)', 'Kainuu', 64.143, 28.283, ['Vuokatti Village', 64.144, 28.27], {
    zone: 'north',
    specialty: 'rönttönen lingonberry pastries',
    wiki: 'Vuokatti',
    description: 'All-season sports resort among Kainuu’s ridges and wilderness.',
  }),
  c('kuusamo', 'Kuusamo & Ruka', 'North Ostrobothnia', 66.1654, 29.147, ['Ruka Village', 66.1654, 29.147], {
    zone: 'lapland',
    specialty: 'reindeer and fresh lake fish',
    wiki: 'Ruka',
    description: 'Wilderness hub for Oulanka National Park, the Bear’s Ring trail and Ruka’s slopes.',
  }),
  c('rovaniemi', 'Rovaniemi', 'Lapland', 66.5039, 25.7294, ['Rovaniemi Lordi Square', 66.5022, 25.729], {
    zone: 'lapland',
    specialty: 'sautéed reindeer (poronkäristys) with mashed potato',
    description: 'Capital of Lapland on the Arctic Circle — Santa, huskies, reindeer and northern lights.',
  }),
  c('kemi', 'Kemi', 'Lapland', 65.7363, 24.5637, ['Kemi Railway Station', 65.7353, 24.5711], {
    zone: 'north',
    specialty: 'Bothnian Bay salmon',
    description: 'Sea Lapland town of icebreaker cruises and the annual SnowCastle.',
  }),
  c('luosto', 'Pyhä-Luosto', 'Lapland', 67.144, 26.905, ['Luosto Village', 67.144, 26.905], {
    zone: 'arctic',
    specialty: 'reindeer and cloudberry desserts',
    wiki: 'Luosto',
    description: 'Peaceful fell area with an amethyst mine and Finland’s oldest fell national park.',
  }),
  c('levi', 'Levi', 'Lapland', 67.8045, 24.8086, ['Levi Village Centre', 67.8045, 24.8086], {
    zone: 'arctic',
    specialty: 'reindeer and Arctic char',
    wiki: 'Levi, Finland',
    description: 'Finland’s largest ski resort with snow villages, fell hikes and aurora tours.',
  }),
  c('yllas', 'Ylläs (Äkäslompolo)', 'Lapland', 67.6025, 24.1508, ['Äkäslompolo Village', 67.6025, 24.1508], {
    zone: 'arctic',
    specialty: 'Lappish salmon soup and leipäjuusto',
    wiki: 'Äkäslompolo',
    description: 'Fell village with long ski trails and quiet wilderness hikes.',
  }),
  c('saariselka', 'Saariselkä', 'Lapland', 68.421, 27.417, ['Saariselkä Village', 68.421, 27.417], {
    zone: 'arctic',
    specialty: 'reindeer and Lappish bread cheese',
    description: 'Northern fell village by Urho Kekkonen National Park, famous for glass igloos and auroras.',
  }),
  c('inari', 'Inari', 'Lapland', 68.9058, 27.0281, ['Inari Village', 68.9058, 27.0281], {
    zone: 'arctic',
    specialty: 'Sámi-style reindeer and Lake Inari whitefish',
    description: 'Centre of Finnish Sámi culture on the shores of vast Lake Inari.',
  }),
  c('kilpisjarvi', 'Kilpisjärvi', 'Lapland', 69.047, 20.795, ['Kilpisjärvi Village', 69.047, 20.796], {
    zone: 'arctic',
    specialty: 'Arctic char and reindeer',
    wiki: 'Kilpisjärvi (village)',
    description: 'Finland’s high-fell corner, where Finland, Sweden and Norway meet.',
  }),
  c('utsjoki', 'Utsjoki', 'Lapland', 69.908, 27.027, ['Utsjoki Village', 69.908, 27.027], {
    zone: 'arctic',
    specialty: 'Teno River salmon',
    description: 'Finland’s northernmost municipality, on the Teno River and the Norwegian border.',
  }),
  c('mariehamn', 'Mariehamn', 'Åland', 60.0973, 19.9348, ['Mariehamn Town Centre', 60.0975, 19.94], {
    zone: 'aland',
    specialty: 'Åland pancake (Ålandspannkaka) with prune cream',
    description: 'Capital of the autonomous Åland Islands — maritime heritage, castles and island cycling.',
  }),
];

// Monthly climate normals per zone (approximate 1991–2020 values).
export const CLIMATE_ZONES = {
  south: {
    high: [-1.5, -2, 1.5, 8, 15, 19.5, 22.5, 20.5, 15, 8.5, 3.5, 0.5],
    low: [-6.5, -7.5, -4.5, 0.5, 6, 10.5, 13.5, 12.5, 8, 3, -1, -4.5],
    precip: [53, 37, 38, 32, 37, 57, 63, 80, 56, 76, 70, 58],
  },
  aland: {
    high: [0, -0.5, 2.5, 7.5, 13, 17.5, 21, 20, 15, 9.5, 5, 2],
    low: [-4.5, -5.5, -3, 0.5, 5, 9.5, 13, 13, 9, 4.5, 1, -2],
    precip: [50, 35, 35, 30, 30, 40, 50, 65, 60, 70, 70, 60],
  },
  central: {
    high: [-4, -4, 0.5, 7, 15, 19.5, 22, 19.5, 13.5, 6.5, 1, -2],
    low: [-10, -11, -7, -1.5, 4.5, 9.5, 12.5, 11, 6, 1, -3.5, -7.5],
    precip: [45, 33, 32, 34, 41, 63, 76, 75, 55, 62, 54, 48],
  },
  north: {
    high: [-6.5, -6.5, -1.5, 5, 12.5, 18, 21, 18, 12, 4.5, -1, -4.5],
    low: [-14, -14, -10, -3.5, 2.5, 8.5, 11.5, 9.5, 5, 0, -5, -10.5],
    precip: [33, 26, 26, 28, 36, 52, 70, 66, 50, 50, 44, 37],
  },
  lapland: {
    high: [-9, -8, -3, 3, 10, 16.5, 19.5, 16.5, 10, 2.5, -3, -6.5],
    low: [-17, -16.5, -12.5, -5.5, 1, 7, 10, 8, 3.5, -2, -8.5, -14],
    precip: [38, 32, 30, 30, 38, 56, 72, 64, 50, 50, 44, 40],
  },
  arctic: {
    high: [-10.5, -10, -5, 1, 8, 14.5, 18, 15, 9, 1, -4.5, -8],
    low: [-20, -19.5, -15.5, -8, -1, 5, 8.5, 6, 1.5, -4, -11, -16.5],
    precip: [30, 25, 23, 25, 32, 55, 70, 60, 45, 40, 35, 30],
  },
};

// Existing seed destinations that need a zone other than the default.
export const SEED_ZONE_OVERRIDES = {
  rovaniemi: 'lapland',
  inari: 'arctic',
  koli: 'central',
  kuopio: 'central',
  jyvaskyla: 'central',
  vaasa: 'central',
};
