create type public.app_role as enum ('admin');
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- first account created becomes the admin
create or replace function public.handle_first_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created_admin after insert on auth.users
for each row execute function public.handle_first_admin();

create table public.reservas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 2 and 100),
  telefone text not null check (char_length(telefone) between 8 and 30),
  email text check (email is null or char_length(email) <= 255),
  check_in date not null,
  check_out date not null,
  hospedes int not null check (hospedes between 1 and 5),
  mensagem text check (mensagem is null or char_length(mensagem) <= 1000),
  status text not null default 'pendente' check (status in ('pendente','confirmada','cancelada')),
  created_at timestamptz not null default now(),
  check (check_out > check_in)
);
grant insert on public.reservas to anon, authenticated;
grant select, update, delete on public.reservas to authenticated;
grant all on public.reservas to service_role;
alter table public.reservas enable row level security;
create policy "anyone can request" on public.reservas for insert to anon, authenticated with check (status = 'pendente');
create policy "admin reads" on public.reservas for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admin updates" on public.reservas for update to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admin deletes" on public.reservas for delete to authenticated using (public.has_role(auth.uid(),'admin'));