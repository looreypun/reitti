# Reitti

Find attractions across Finland and plan your trip day by day.

- Search 226 places in 40 cities by city, budget, interests and trip length
- Weather for your travel date (live forecast, climate averages further ahead)
- Day-by-day itineraries with timed stops and route maps
- **Ask AI**: chat about places in plain language, answered by a local model via [Ollama](https://ollama.com)

Built with React, TypeScript and Vite.

## Getting started

```bash
npm install
npm run dev       # http://localhost:5173
```

| Command | |
| --- | --- |
| `npm test` | Run tests |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build |
| `npm run data` | Regenerate `public/data.json` |

## AI assistant

Install Ollama, pull a chat model and keep it running:

```bash
ollama pull granite4.2:3b
```

Optional settings: copy `.env.example` to `.env.local` and edit.

```bash
cp .env.example .env.local
```

If the app is served from another origin than `localhost`, allow it in Ollama with `OLLAMA_ORIGINS`.

## Data

The app loads `public/data.json`, generated from the seed `data.json` and the catalogue in `scripts/catalog/`. Edit those, then run `npm run data`. Photo choices can be fixed per place in `scripts/catalog/image-overrides.mjs`.

## Credits

Weather: [Open-Meteo](https://open-meteo.com) (CC BY 4.0) · Photos: Wikimedia Commons · Maps: © OpenStreetMap contributors
