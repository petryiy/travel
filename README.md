# Travel Planner

AI-powered travel planning app. Chat with Gemini on the left; get a live itinerary and map on the right.

## Stack

- **Next.js** (App Router) + TypeScript
- **Tailwind CSS v4**
- **Google Gemini** (`gemini-2.5-flash-lite`) for AI
- **Leaflet + OpenStreetMap** for maps (no API key required)

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

Create `.env.local` in the project root:

```
GEMINI_API_KEY=your_google_ai_studio_key
```

Get a key at [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey).

## How it works

1. Fill in destination, dates, travelers, and trip style on the Canvas panel
2. Gemini asks any clarifying questions (shown as suggestion chips on the Canvas)
3. Once it has enough info, it generates a day-by-day itinerary with an interactive map
