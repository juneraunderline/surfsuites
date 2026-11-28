alter table public.videos_pousada
  drop constraint if exists videos_pousada_plataforma_check;

alter table public.videos_pousada
  add constraint videos_pousada_plataforma_check
  check (plataforma in ('youtube', 'instagram', 'tiktok', 'facebook', 'vimeo', 'arquivo'));

create policy "Administradores podem consultar bucket de videos"
on storage.buckets for select to authenticated
using (id = 'videos-pousada' and public.has_role((select auth.uid()), 'admin'::public.app_role));

create policy "Administradores podem criar bucket de videos"
on storage.buckets for insert to authenticated
with check (id = 'videos-pousada' and public.has_role((select auth.uid()), 'admin'::public.app_role));

create policy "Administradores podem enviar videos"
on storage.objects for insert to authenticated
with check (bucket_id = 'videos-pousada' and public.has_role((select auth.uid()), 'admin'::public.app_role));

create policy "Administradores podem excluir arquivos de videos"
on storage.objects for delete to authenticated
using (bucket_id = 'videos-pousada' and public.has_role((select auth.uid()), 'admin'::public.app_role));
