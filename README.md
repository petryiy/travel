# Travel Planner

AI-powered travel planning app. Chat with Gemini on the left; get a live itinerary and map on the right. Saved trips are persisted to Aurora PostgreSQL and can be exported as Markdown.

## Stack

- **Next.js** (App Router) + TypeScript
- **Tailwind CSS v4**
- **Google Gemini** (`gemini-2.5-flash-lite`) for AI
- **Aurora PostgreSQL** for saved trips and itinerary history
- **Prisma** for database schema and migrations
- **Mapbox + Google Maps** for interactive maps

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

Create `.env.local` in the project root for the Next.js app:

```
GEMINI_API_KEY=your_google_ai_studio_key
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token
NEXT_PUBLIC_GOOGLE_MAPS_KEY=your_google_maps_key
```

Get a key at [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey).

For Prisma CLI commands, also put `DATABASE_URL` in a root `.env` file or pass it inline. Prisma reads `.env` by default, while Next.js reads `.env.local`.

For the hackathon submission, point `DATABASE_URL` at the Aurora PostgreSQL database connection string. Run migrations before using saved trips:

```bash
npx prisma migrate deploy
```

## How it works

1. Fill in destination, dates, travelers, and trip style on the Canvas panel
2. Gemini asks any clarifying questions (shown as suggestion chips on the Canvas)
3. Once it has enough info, it generates a day-by-day itinerary with an interactive map
4. Click **Save trip** to persist the itinerary and chat context to Aurora PostgreSQL
5. Reopen saved itineraries from the setup screen or export the plan as a Markdown file

## Data model

The first SaaS-ready persistence layer stores one row per saved trip:

- Trip owner browser id
- Destination, dates, travelers, and style
- Full itinerary JSON
- Chat messages JSON
- Created and updated timestamps

This keeps the MVP small while leaving room to add real users, workspaces, trip members, invites, and collaborative editing later.
