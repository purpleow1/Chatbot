# Chatbot

A ChatGPT-style AI chatbot with streaming responses, conversation history, image support, and anonymous access.

## Features

- Stream responses from OpenAI `gpt-4o` to the client in real time
- Left sidebar with persistent chat history (per user)
- Email/password and OAuth sign-in (Google, GitHub) via Supabase Auth
- Paste or attach images — answered by GPT-4o vision
- Anonymous access for up to 3 free questions before prompting sign-up
- New chats sync across open browser tabs via Supabase Realtime

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router, TypeScript) |
| UI | shadcn/ui + Tailwind CSS |
| LLM | OpenAI `gpt-4o` via Vercel AI SDK v5 |
| Data fetching | TanStack Query |
| Database | Supabase Postgres (service-role, server-only) |
| Auth | Supabase Auth (`@supabase/ssr`) |
| Realtime | Supabase Realtime (Broadcast) |
| Deployment | Vercel + Supabase cloud |

## Getting started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- An [OpenAI](https://platform.openai.com) API key

### Local setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-username/chatbot.git
   cd chatbot
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   ```bash
   cp .env.example .env.local
   ```

   Fill in the values in `.env.local`:

   | Variable | Where to find it |
   |---|---|
   | `OPENAI_API_KEY` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
   | `SUPABASE_URL` | Supabase Dashboard → Project Settings → API |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API |
   | `NEXT_PUBLIC_SUPABASE_URL` | Same as `SUPABASE_URL` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API |

4. **Apply database migrations**

   Open the [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql) for your project, paste the contents of `supabase/migrations/20260630000000_initial_schema.sql`, and run it.

   Alternatively, use the Supabase CLI (requires `supabase` CLI installed and project linked):

   ```bash
   supabase db push
   ```

   After running the migration:
   - Enable **Anonymous Sign-Ins** in your Supabase project: Authentication → Settings → Enable Anonymous Sign-ins.
   - Create a private Storage bucket named `attachments`: Storage → New bucket → name `attachments`, uncheck "Public bucket".

5. **Run the development server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

### OAuth setup (Google / GitHub)

Configure redirect URLs in your Supabase Auth settings:

- **Site URL**: `http://localhost:3000` (dev) / `https://your-app.vercel.app` (prod)
- **Redirect URL**: `http://localhost:3000/auth/callback`

Then add your OAuth app credentials (Client ID + Secret) in Supabase → Auth → Providers.

## Project structure

```
src/
  app/
    (auth)/          # login, signup pages
    (chat)/          # chat UI (sidebar + message area)
    api/             # REST route handlers (chats, messages, streaming, uploads)
    auth/callback/   # OAuth callback
  components/
    chat/            # chat-specific components
    ui/              # shadcn primitives
  lib/
    supabase/        # admin (server-only), ssr auth, realtime clients
    db/              # data-access repositories (server-only)
    api/             # client-side fetchers + TanStack Query keys
  providers/         # QueryProvider
supabase/
  migrations/        # SQL migration files
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Run production build locally |
| `npm run lint` | ESLint |
| `npm run format` | Prettier format |

## Deployment

Deploy to Vercel with one click or via the CLI:

```bash
npx vercel --prod
```

Set the same environment variables from `.env.example` in Vercel → Project → Settings → Environment Variables.
