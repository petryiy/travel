# MeetU Architecture Diagram

Editable diagrams.net / draw.io source: [meetu-architecture.drawio](meetu-architecture.drawio)

![MeetU architecture diagram](public/meetu-architecture-diagram.svg)

The polished SVG version above is intended for hackathon submission screenshots or direct upload. The Mermaid version below is kept as an editable technical backup.

```mermaid
flowchart LR
  U["User Browser<br/>desktop / mobile"] --> V["Vercel Deployment<br/>Next.js App Router"]

  subgraph Client["Client UI"]
    L["Login / Register"]
    D["Dashboard<br/>saved trips"]
    E["Trip Editor<br/>Ask MeetU agent + timeline + map"]
    O["Trip Overview<br/>share / publish / export"]
    G["Gallery<br/>published trips"]
    F["Footprints<br/>memory map + story export"]
  end

  V --> Client

  subgraph Server["Next.js Server on Vercel"]
    AUTH["NextAuth<br/>Google OAuth + credentials"]
    CHAT["/api/chat<br/>AI itinerary generation + refinement"]
    TRIPS["/api/trips<br/>save, load, rename, publish"]
    ROUTES["/api/routes<br/>route enrichment"]
    HOURS["/api/check-hours<br/>place opening hours"]
    STATICMAP["/api/maps/static<br/>poster map image"]
    CAPTION["/api/poster-caption<br/>AI poster caption"]
  end

  V --> AUTH
  V --> CHAT
  V --> TRIPS
  V --> ROUTES
  V --> HOURS
  V --> STATICMAP
  V --> CAPTION

  subgraph AWS["AWS Database Layer"]
    DB["AWS Aurora DSQL / PostgreSQL-compatible database<br/>users, accounts, sessions, trips,<br/>itinerary JSON, messages, publish status"]
  end

  AUTH <-->|"session + user records"| DB
  TRIPS <-->|"saved trips + gallery metadata"| DB

  subgraph External["External Services"]
    GEMINI["Google Gemini API<br/>travel agent, itinerary edits, captions"]
    MAPS["Google Maps Platform<br/>Maps JS, Directions, Places, Static Maps"]
    GOOGLEAUTH["Google OAuth"]
  end

  CHAT --> GEMINI
  CAPTION --> GEMINI
  ROUTES --> MAPS
  HOURS --> MAPS
  STATICMAP --> MAPS
  E --> MAPS
  F --> MAPS
  AUTH --> GOOGLEAUTH

  F --> LOCAL["Browser localStorage<br/>Footprints memories in current MVP"]
```

## Data Flow

1. Users open MeetU from the Vercel-hosted Next.js application.
2. Authentication is handled by NextAuth using Google OAuth or email/password credentials.
3. Users create or refine trips in the Trip Editor. The editor calls `/api/chat`, which uses the Google Gemini API to generate structured itinerary JSON.
4. The itinerary is enriched with Google Maps data through server routes for directions, transit options, static maps, and opening-hour context.
5. Saved trips, user sessions, share status, and gallery publish metadata are stored in the AWS database.
6. The Dashboard reads saved trips from the database. The Overview page displays a polished, shareable version of a saved trip.
7. Published trips appear in the Gallery and link to public overview pages.
8. Poster and PDF export are generated from the saved itinerary content.
9. The Footprints feature lets users place memories on a real map with photos, notes, and emoji pins. In the current MVP, these memories are stored in browser localStorage.

## AWS Database Used

The application uses an AWS PostgreSQL-compatible database layer for persistent product data. In the current codebase, the database client connects through an Aurora DSQL endpoint using AWS DSQL authentication.
