# Chatbot

A ChatGPT-style AI chatbot: send messages and stream responses in real time, keep a searchable history of conversations, attach images, upload documents to ground answers in your own files, and try it anonymously before signing in. Built with Next.js, Google Gemini, and Supabase.

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

1. **Run the migrations.** Open the Supabase **SQL Editor** and run each file in `supabase/migrations/` in filename order (or use `supabase db push` if you have the CLI linked). The document-RAG migration enables the `pgvector` extension automatically.
2. **Create the Storage buckets.** Storage → New bucket → create two private buckets (keep **Public bucket unchecked** — files are served via signed URLs):
   - `attachments` — for pasted/attached images.
   - `documents` — for uploaded documents used as RAG context.
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
- **Document upload + RAG** — attach PDFs, text, Markdown, or Word docs to a chat. Their text is extracted, chunked, and embedded (`gemini-embedding-001`, stored in Postgres via `pgvector`); each question retrieves the most relevant chunks and grounds the answer in them (retrieval-augmented generation).
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
| Document RAG | `pgvector` + `gemini-embedding-001` embeddings, cosine similarity search |
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
| `GET` / `POST` | `/api/documents` | List a chat's documents / upload + ingest a document (extract, chunk, embed) |
| `DELETE` | `/api/documents/[documentId]` | Remove a document, its chunks, and its stored file |
| `GET` | `/api/usage` | Anonymous free-question count remaining |

All routes are auth-guarded and scoped to the signed-in (or anonymous) user.

## Database design

Postgres on Supabase. All tables live in `public`; the app reads and writes them exclusively through the service-role admin client (no RLS policies — authorization is enforced in the API layer). Full SQL is in `supabase/migrations/`.

**Design choices**

- **User-scoped ownership** — chats, attachments, documents, and chunks carry `user_id`; messages are scoped via `chat_id` → `chats.user_id`. Every API query filters on the authenticated user.
- **Normalized core, flexible messages** — chats and messages are relational; message content lives in a `jsonb` `parts` column (AI SDK shape: text, file, document chip) so we avoid a parts sub-table while still supporting search over text parts.
- **Chat-scoped RAG** — documents and embeddings belong to a chat, not a global library, keeping retrieval simple and bounded.
- **Cascade deletes in Postgres** — deleting a user, chat, message, or document removes dependent rows via FK `on delete cascade`. Storage bucket objects are removed explicitly in the API layer (Postgres does not manage Storage).
- **Service-role-only DML** — table grants are limited to `service_role`; `anon`/`authenticated` roles have no direct table access, so the publishable key cannot read or write app data.

### Tables

| Table | Purpose | Key relationships |
|---|---|---|
| `users` | App profile mirror of `auth.users` (`is_anonymous` for the 3-question limit) | PK = `auth.users.id` |
| `chats` | Conversation metadata and title | `user_id` → `users` |
| `messages` | Ordered message history | `chat_id` → `chats`; `parts` jsonb |
| `attachments` | Image metadata (binary in Storage `attachments` bucket) | `message_id` → `messages`; denormalized `chat_id`, `user_id` |
| `usages` | Anonymous message counter (one row per user) | PK = `user_id` |
| `documents` | Uploaded file metadata and ingestion status | `chat_id`, `user_id`; binary in Storage `documents` bucket |
| `document_chunks` | Text chunks + 768-dim embeddings (`pgvector`) | `document_id` → `documents`; denormalized `chat_id`, `user_id` |

### Indexes and functions

| Name | Why |
|---|---|
| `idx_chats_user_updated` | Sidebar: list a user's chats by most recently active |
| `idx_messages_chat_created` | Load message history in insertion order |
| `idx_documents_chat_created` | List documents for a chat, newest first |
| `idx_document_chunks_embedding` (HNSW) | Fast cosine-similarity search for RAG retrieval |
| `idx_document_chunks_chat` | Scope chunk retrieval to a chat |
| `increment_anon_count()` | Atomic upsert for the anonymous usage limit |
| `search_chats()` | Title + message text search, user-scoped, capped at 20 results |
| `match_document_chunks()` | Top-k chunk retrieval over a chat's ready documents |

## Deployment (Vercel)

1. Push this repo to GitHub, then in Vercel: **Add New → Project → Import** the repo (framework auto-detects as Next.js).
2. Add the five environment variables from `.env.example` in **Settings → Environment Variables** (Production + Preview).
3. Deploy, then open Supabase → **Authentication → URL Configuration**:
   - **Site URL** → `https://<app>.vercel.app` (the default post-login destination).
   - **Redirect URLs** → add `https://<app>.vercel.app/auth/callback` (Supabase rejects any redirect not on this list, which breaks OAuth).
