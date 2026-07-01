-- Full-text search across chat titles and message content.
-- Returns up to 20 chats ordered by recency; includes a snippet from the
-- first matching message when the hit comes from message content.
create or replace function public.search_chats(
  p_user_id uuid,
  p_query    text
)
returns table (
  id         uuid,
  title      text,
  updated_at timestamptz,
  snippet    text
)
language sql
stable
as $$
  select id, title, updated_at, snippet
  from (
    -- Matches on chat title
    select
      c.id,
      c.title,
      c.updated_at,
      null::text as snippet
    from public.chats c
    where c.user_id = p_user_id
      and c.title ilike '%' || p_query || '%'

    union

    -- Matches on message text content (one row per chat)
    select
      c.id,
      c.title,
      c.updated_at,
      (
        select elem->>'text'
        from jsonb_array_elements(m.parts) elem
        where elem->>'type' = 'text'
          and elem->>'text' ilike '%' || p_query || '%'
        limit 1
      ) as snippet
    from (
      select distinct on (chat_id) chat_id, parts
      from public.messages
      where exists (
        select 1
        from jsonb_array_elements(parts) elem
        where elem->>'type' = 'text'
          and elem->>'text' ilike '%' || p_query || '%'
      )
      order by chat_id, created_at desc
    ) m
    join public.chats c on c.id = m.chat_id
    where c.user_id = p_user_id
  ) combined
  order by updated_at desc
  limit 20
$$;
