-- ============================================================
-- Initial schema
-- ============================================================

-- ------------------------------------------------------------
-- Extensions
-- ------------------------------------------------------------
create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------
-- Enums
-- ------------------------------------------------------------
create type public.message_role as enum ('user', 'assistant', 'system');

-- ------------------------------------------------------------
-- Helper: auto-update updated_at on any table
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- Table: users
-- Mirrors auth.users. Created automatically via trigger below.
-- ------------------------------------------------------------
create table public.users (
  id           uuid        primary key references auth.users (id) on delete cascade,
  email        text,
  name         text,
  avatar_url   text,
  is_anonymous boolean     not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Trigger: create a users row whenever a new auth user signs up
-- Works for email, OAuth, and anonymous sign-ins.
-- ------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name, avatar_url, is_anonymous)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    ),
    new.raw_user_meta_data->>'avatar_url',
    coalesce(
      (new.raw_app_meta_data->>'provider') = 'anonymous',
      false
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ------------------------------------------------------------
-- Table: chats
-- ------------------------------------------------------------
create table public.chats (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references public.users (id) on delete cascade,
  title      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Efficiently list chats for a user sorted by most-recently-active
create index idx_chats_user_updated on public.chats (user_id, updated_at desc);

create trigger chats_set_updated_at
  before update on public.chats
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Table: messages
-- ------------------------------------------------------------
create table public.messages (
  id         uuid              primary key default gen_random_uuid(),
  chat_id    uuid              not null references public.chats (id) on delete cascade,
  role       public.message_role not null,
  parts      jsonb             not null default '[]'::jsonb,
  created_at timestamptz       not null default now()
);

-- Fetch messages for a chat in insertion order
create index idx_messages_chat_created on public.messages (chat_id, created_at);

-- ------------------------------------------------------------
-- Table: attachments
-- ------------------------------------------------------------
create table public.attachments (
  id           uuid        primary key default gen_random_uuid(),
  message_id   uuid        not null references public.messages (id) on delete cascade,
  chat_id      uuid        not null references public.chats (id)    on delete cascade,
  user_id      uuid        not null references public.users (id)    on delete cascade,
  storage_path text        not null,
  mime_type    text        not null,
  size_bytes   int         not null,
  created_at   timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Table: usage
-- Tracks anonymous message count for the 3-free-question limit.
-- One row per user, upserted on first message.
-- ------------------------------------------------------------
create table public.usages (
  user_id            uuid        primary key references public.users (id) on delete cascade,
  anon_message_count int         not null default 0,
  updated_at         timestamptz not null default now()
);

create trigger usages_set_updated_at
  before update on public.usages
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- RPC: increment_anon_count
-- Atomically upserts the usage row and increments the counter.
-- Returns the updated usage row.
-- ------------------------------------------------------------
create or replace function public.increment_anon_count(p_user_id uuid)
returns setof public.usages
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usages (user_id, anon_message_count)
  values (p_user_id, 1)
  on conflict (user_id) do update
    set anon_message_count = usages.anon_message_count + 1,
        updated_at         = now();

  return query
    select * from public.usages where user_id = p_user_id;
end;
$$;
