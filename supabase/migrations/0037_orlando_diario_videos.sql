alter table public.diario_entries
drop constraint if exists diario_entries_tipo_check;

alter table public.diario_entries
add constraint diario_entries_tipo_check
check (tipo in ('texto', 'audio', 'foto', 'video'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'diario',
  'diario',
  false,
  52428800,
  array[
    'application/json',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
    'video/mp4',
    'video/webm'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
