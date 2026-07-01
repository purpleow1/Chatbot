# Chatbot

A ChatGPT-style AI chatbot: send messages and stream responses in real time, keep a searchable history of conversations, attach images, and try it anonymously before signing in. Built with Next.js, Google Gemini, and Supabase.

> Live demo: https://chatbot-rosy-alpha-59.vercel.app/

## Getting started

### Prerequisites

- Node.js 18+
- A free [Supabase](https://supabase.com) project
- A [Google Gemini API key](https://aistudio.google.com/apikey) (free tier is enough for the demo)

### 1. Install

```bash
git clone git@github.com:purpleow1/Chatbot.git
cd Chatbot
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Where to find it |
|---|---|
| `GOOGLE_GENERATIVE_AI_API_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `SUPABASE_URL` | Supabase Dashboard → Project Settings → Data API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API Keys (**secret** — server-only) |
| `NEXT_PUBLIC_SUPABASE_URL` | Same as `SUPABASE_URL` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API Keys (publishable/anon) |

### 3. Set up Supabase

1. **Run the migrations.** Open the Supabase **SQL Editor** and run each file in `supabase/migrations/` in filename order (or use `supabase db push` if you have the CLI linked).
2. **Create the Storage bucket.** Storage → New bucket → name it `attachments`, and keep **Public bucket unchecked** (images are served via signed URLs).
3. **Enable anonymous sign-ins.** Authentication → Sign In / Providers → enable **Anonymous Sign-ins**.
4. **(Optional) Enable Google / GitHub OAuth.** See below.

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### OAuth setup (Google / GitHub)

In the Supabase dashboard → Authentication:

- **URL Configuration** → set **Site URL** to `http://localhost:3000` (and add your Vercel URL for production), and add `http://localhost:3000/auth/callback` (+ the production equivalent) to **Redirect URLs**.
- **Sign In / Providers** → enable **Google** and/or **GitHub** and paste each provider's Client ID + Secret.
- In the provider's own console (Google Cloud Console / GitHub Developer Settings), set the authorized callback to `https://<your-project-ref>.supabase.co/auth/v1/callback`.

## Features

- **Streaming chat** — messages stream token-by-token from Google Gemini via the Vercel AI SDK, with a stop button and typing indicator.
- **Persistent chat history** — left sidebar lists your conversations (create, rename, delete, search), stored in Postgres.
- **Authentication** — email/password plus Google and GitHub OAuth, via Supabase Auth.
- **Anonymous access** — try up to 3 free questions with no account, then a prompt to sign up. Upgrading keeps your existing chats.
- **Image attachments** — paste, drag, or pick images and ask about them (Gemini vision). Images persist across reloads.
- **Cross-tab sync** — creating, renaming, or deleting a chat in one tab updates all other open tabs in real time (Supabase Realtime).
- **Polished UX** — Markdown + syntax-highlighted code with copy buttons, auto-scroll, dark mode, and loading/empty/error states.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router, TypeScript) |
| UI | shadcn/ui + Tailwind CSS |
| Data fetching | TanStack Query |
| LLM | Google Gemini via the Vercel AI SDK v5 |
| Server | Next.js REST route handlers (`src/app/api/*`) |
| Database | Supabase Postgres (accessed server-side only, via the service-role key) |
| Auth | Supabase Auth (`@supabase/ssr`) |
| Realtime | Supabase Realtime (Broadcast) |
| Deployment | Vercel + Supabase cloud |

## Architecture

The codebase keeps the three layers strictly separate, per the project brief:

```
Client components ──fetch──▶ REST API routes ──▶ DB data-access layer ──▶ Supabase Postgres
(TanStack Query,            (src/app/api/*)      (src/lib/db/*,
 useChat)                                         service-role, server-only)
```

- **No DB calls in components** (including Server Components). Components only call `/api/*`.
- **All DB access uses the Supabase service-role client**, isolated in `server-only` files. There is no public DB client and no RLS reliance.
- **Auth identity** is read from the request cookie via `@supabase/ssr` (auth only), and every query is scoped to that `userId`.
- The **public anon key** is used only client-side for Supabase Realtime (Broadcast) — the one place the brief allows it.
- Secrets (`GOOGLE_GENERATIVE_AI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) are never prefixed with `NEXT_PUBLIC_`.

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` / `POST` | `/api/chats` | List / create chats |
| `GET` / `PATCH` / `DELETE` | `/api/chats/[chatId]` | Fetch / rename / delete a chat |
| `GET` | `/api/chats/[chatId]/messages` | Load a chat's message history |
| `GET` | `/api/chats/search?q=` | Search chats by title and message content |
| `POST` | `/api/chat` | Stream an assistant response and persist messages |
| `POST` | `/api/uploads` | Upload an image to Storage, return a signed URL |
| `GET` | `/api/usage` | Anonymous free-question count remaining |

All routes are auth-guarded and scoped to the signed-in (or anonymous) user.

## Deployment (Vercel)

1. Push this repo to GitHub, then in Vercel: **Add New → Project → Import** the repo (framework auto-detects as Next.js).
2. Add the five environment variables from `.env.example` in **Settings → Environment Variables** (Production + Preview).
3. Deploy, then add the resulting `https://<app>.vercel.app` URL to Supabase → Authentication → URL Configuration (Site URL + Redirect URLs) so OAuth works in production.
