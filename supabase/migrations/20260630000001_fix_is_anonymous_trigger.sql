-- Fix handle_new_auth_user: read is_anonymous directly from auth.users
-- instead of inferring it from raw_app_meta_data (which may not be set yet).
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
    coalesce(new.is_anonymous, false)
  );
  return new;
end;
$$;

-- Backfill existing rows that were inserted with the wrong is_anonymous value.
update public.users pu
set is_anonymous = coalesce(au.is_anonymous, false)
from auth.users au
where pu.id = au.id
  and pu.is_anonymous is distinct from coalesce(au.is_anonymous, false);
