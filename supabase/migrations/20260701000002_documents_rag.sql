-- ============================================================
-- Document upload + RAG (retrieval-augmented generation)
--
-- Adds document storage/metadata and vector-embedded chunks so a chat
-- can answer questions grounded in uploaded files. Layered on top of the
-- existing schema — no edits to previous tables.
-- ============================================================

-- ------------------------------------------------------------
-- Extension: pgvector (embedding storage + similarity search)
-- ------------------------------------------------------------
create extension if not exists vector;

-- ------------------------------------------------------------
-- Table: documents
-- One row per uploaded file, scoped to a single chat. The binary lives
-- in the private `documents` Storage bucket (storage_path); this row
-- holds metadata + ingestion status.
-- ------------------------------------------------------------
create table public.documents (
  id           uuid        primary key default gen_random_uuid(),
  chat_id      uuid        not null references public.chats (id) on delete cascade,
  user_id      uuid        not null references public.users (id) on delete cascade,
  filename     text        not null,
  storage_path text        not null,
  mime_type    text        not null,
  size_bytes   int         not null,
  status       text        not null default 'processing'
                 check (status in ('processing', 'ready', 'failed')),
  created_at   timestamptz not null default now()
);

-- List a chat's documents newest-first.
create index idx_documents_chat_created on public.documents (chat_id, created_at desc);

-- ------------------------------------------------------------
-- Table: document_chunks
-- One row per text chunk of a document, with its embedding. Retrieval
-- runs a cosine-similarity search over these, filtered by chat.
-- 768-dim to match gemini-embedding-001 (outputDimensionality: 768).
-- ------------------------------------------------------------
create table public.document_chunks (
  id          uuid        primary key default gen_random_uuid(),
  document_id uuid        not null references public.documents (id) on delete cascade,
  chat_id     uuid        not null references public.chats (id)     on delete cascade,
  user_id     uuid        not null references public.users (id)     on delete cascade,
  chunk_index int         not null,
  content     text        not null,
  embedding   vector(768) not null,
  created_at  timestamptz not null default now()
);

-- Approximate-nearest-neighbour index for fast cosine similarity search.
create index idx_document_chunks_embedding
  on public.document_chunks
  using hnsw (embedding vector_cosine_ops);

-- Scope retrieval to a chat cheaply.
create index idx_document_chunks_chat on public.document_chunks (chat_id);

-- ------------------------------------------------------------
-- RPC: match_document_chunks
-- Top-k cosine-similarity search over a chat's chunks, restricted to
-- documents that finished ingesting (status = 'ready'). Called only
-- server-side via the service-role client.
-- ------------------------------------------------------------
create or replace function public.match_document_chunks(
  p_chat_id         uuid,
  p_query_embedding vector(768),
  p_match_count     int
)
returns table (
  content     text,
  document_id uuid,
  filename    text,
  chunk_index int,
  similarity  float
)
language sql
stable
as $$
  select
    dc.content,
    dc.document_id,
    d.filename,
    dc.chunk_index,
    1 - (dc.embedding <=> p_query_embedding) as similarity
  from public.document_chunks dc
  join public.documents d on d.id = dc.document_id
  where dc.chat_id = p_chat_id
    and d.status = 'ready'
  order by dc.embedding <=> p_query_embedding
  limit p_match_count
$$;
