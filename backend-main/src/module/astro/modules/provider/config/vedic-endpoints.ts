export const VedicEndpoints = {
  horoscope: {
    birthChart: '/horoscope/birth-chart',
    navamsaChart: '/horoscope/navamsa-chart',
    planetPositions: '/horoscope/planet-details',
  },

  dasha: {
    mahaDasha: '/dashas/maha-dasha',
    mahaDashaPrediction: '/dashas/maha-dasha-predictions',
  },

  dosha: {
    mangal: '/dosha/mangal-dosh',
    manglik: '/dosha/manglik-dosh',
    kaalSarp: '/dosha/kaalsarp-dosh',
    pitra: '/dosha/pitra-dosh',
    papaSamaya: '/dosha/papasamaya',
  },

  extended: {
    gemSuggestion: '/extended-horoscope/gem-suggestion',
    sadeSati: '/extended-horoscope/sade-sati-table',
    friendship: '/extended-horoscope/friendship-table',
    kpHouses: '/extended-horoscope/kp-houses',
    kpPlanets: '/extended-horoscope/kp-planets',
    yogaList: '/extended-horoscope/yoga-list',
  },

  prediction: {
    numerology: '/prediction/numerology',
  },

  matching: {
    ashtakoot: '/matching/ashtakoot',
  },

  utilities: {
    geoSearch: '/utilities/geo-search-advanced',
  },
} as const;
