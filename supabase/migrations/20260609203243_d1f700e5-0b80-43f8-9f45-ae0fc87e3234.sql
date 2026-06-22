
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nome text not null default '',
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;

alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by authenticated" on public.profiles;
create policy "Profiles are viewable by authenticated"
  on public.profiles for select to authenticated using (true);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();

create or replace function public.handle_new_user_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_roles (user_id, role)
  values (new.id, 'diretor') on conflict do nothing;
  insert into public.profiles (user_id, email, nome)
  values (new.id, new.email,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user_role();

insert into public.profiles (user_id, email, nome)
select u.id, u.email, coalesce(u.raw_user_meta_data->>'nome', split_part(u.email, '@', 1))
from auth.users u
where not exists (select 1 from public.profiles p where p.user_id = u.id);

update auth.users
set email_confirmed_at = now()
where email_confirmed_at is null;
