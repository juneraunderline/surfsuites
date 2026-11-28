create table if not exists public.videos_pousada (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(titulo) between 2 and 120),
  descricao text check (descricao is null or char_length(descricao) <= 300),
  url text not null check (char_length(url) <= 2048),
  plataforma text not null check (plataforma in ('youtube', 'instagram', 'tiktok', 'facebook', 'vimeo')),
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.videos_pousada enable row level security;
grant select on public.videos_pousada to anon;
grant select, insert, update, delete on public.videos_pousada to authenticated;

create policy "Videos ativos visiveis publicamente"
on public.videos_pousada for select to anon using (ativo = true);

create policy "Videos visiveis ou gerenciados por administradores"
on public.videos_pousada for select to authenticated
using (ativo = true or public.has_role((select auth.uid()), 'admin'::public.app_role));

create policy "Administradores podem adicionar videos"
on public.videos_pousada for insert to authenticated
with check (public.has_role((select auth.uid()), 'admin'::public.app_role));

create policy "Administradores podem atualizar videos"
on public.videos_pousada for update to authenticated
using (public.has_role((select auth.uid()), 'admin'::public.app_role))
with check (public.has_role((select auth.uid()), 'admin'::public.app_role));

create policy "Administradores podem excluir videos"
on public.videos_pousada for delete to authenticated
using (public.has_role((select auth.uid()), 'admin'::public.app_role));
