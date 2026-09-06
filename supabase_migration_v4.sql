-- ============================================================
-- BOXLOG — Migration v4
-- À exécuter après supabase_migration_v2.sql et v3.sql (Supabase → SQL Editor → Run)
--
-- Ajoute :
--   - notifications in-app (nouveau WOD, réponse dans un chat)
--   - suivi de lecture du chat général de box (badge "non lu")
--   - stockage Supabase pour l'upload direct de vidéos (WOD + mouvements)
--   - RLS resserrée sur les messages liés à une séance perso : un fil sous
--     une séance perso ne doit être visible que par l'athlète propriétaire,
--     l'auteur du message et le coach de la box — pas tous les membres.
-- ============================================================

-- ─── 1. Historique de lecture du chat (badge non-lu) ───────────
create table if not exists public.chat_reads (
  user_id     uuid not null references auth.users(id) on delete cascade,
  box_id      uuid not null references public.boxes(id) on delete cascade,
  channel     text not null default 'general',
  last_read_at timestamptz not null default now(),
  primary key (user_id, box_id, channel)
);
alter table public.chat_reads enable row level security;
create policy "chat_reads_owner" on public.chat_reads
  for all using (user_id = auth.uid());

-- ─── 2. Notifications in-app ────────────────────────────────────
create table if not exists public.notifications (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null check (type in ('new_wod','chat_reply')),
  title       text not null,
  body        text,
  link        text,
  read        boolean not null default false,
  created_at  timestamptz default now()
);
alter table public.notifications enable row level security;
create policy "notifications_owner_select" on public.notifications
  for select using (user_id = auth.uid());
create policy "notifications_owner_update" on public.notifications
  for update using (user_id = auth.uid());
create policy "notifications_owner_delete" on public.notifications
  for delete using (user_id = auth.uid());
-- Pas de policy insert pour les utilisateurs : seules les fonctions
-- security definer ci-dessous créent des notifications, jamais le client.

create index if not exists idx_notifications_user_unread on public.notifications(user_id, read, created_at desc);

alter publication supabase_realtime add table public.notifications;

-- Nouveau WOD posté dans une box → notifie tous les membres actifs sauf le créateur.
create or replace function public.notify_new_wod()
returns trigger language plpgsql security definer as $$
begin
  insert into public.notifications (user_id, type, title, body, link)
  select bm.user_id, 'new_wod', 'Nouveau WOD : ' || new.title,
         to_char(new.wod_date, 'DD/MM/YYYY'),
         '/dashboard/wod/' || new.id
  from public.box_members bm
  where bm.box_id = new.box_id
    and bm.status = 'active'
    and bm.user_id <> new.created_by;
  return new;
end;
$$;

drop trigger if exists trg_notify_new_wod on public.wods;
create trigger trg_notify_new_wod
  after insert on public.wods
  for each row execute function public.notify_new_wod();

-- Nouveau message de chat → notifie les destinataires concernés :
--   - salon général : tous les membres actifs de la box sauf l'auteur
--   - fil sous un WOD : tous les membres actifs de la box sauf l'auteur
--   - fil sous une séance perso : uniquement le propriétaire de la séance
--     (si ce n'est pas lui l'auteur) — pas toute la box, pour ne pas
--     exposer qu'une conversation privée existe à des tiers.
create or replace function public.notify_new_chat_message()
returns trigger language plpgsql security definer as $$
declare wod_title text; session_owner uuid;
begin
  if new.session_id is not null then
    select user_id into session_owner from public.personal_sessions where id = new.session_id;
    if session_owner is not null and session_owner <> new.user_id then
      insert into public.notifications (user_id, type, title, body, link)
      values (session_owner, 'chat_reply', 'Nouveau message sur ta séance',
              left(new.content, 140), '/dashboard/perso');
    end if;
    return new;
  end if;

  if new.wod_id is not null then
    select title into wod_title from public.wods where id = new.wod_id;
    insert into public.notifications (user_id, type, title, body, link)
    select bm.user_id, 'chat_reply', 'Nouveau message — ' || coalesce(wod_title, 'un WOD'),
           left(new.content, 140), '/dashboard/wod/' || new.wod_id
    from public.box_members bm
    where bm.box_id = new.box_id and bm.status = 'active' and bm.user_id <> new.user_id;
    return new;
  end if;

  insert into public.notifications (user_id, type, title, body, link)
  select bm.user_id, 'chat_reply', 'Nouveau message dans le chat',
         left(new.content, 140), '/dashboard/chat'
  from public.box_members bm
  where bm.box_id = new.box_id and bm.status = 'active' and bm.user_id <> new.user_id;
  return new;
end;
$$;

drop trigger if exists trg_notify_new_chat_message on public.chat_messages;
create trigger trg_notify_new_chat_message
  after insert on public.chat_messages
  for each row execute function public.notify_new_chat_message();

-- ─── 3. RLS resserrée : fil de chat sous une séance perso ──────
drop policy if exists "chat_select_box_member" on public.chat_messages;
create policy "chat_select_thread_scoped" on public.chat_messages
  for select using (
    (session_id is null and box_id in (select public.my_box_ids()))
    or (session_id is not null and (
         user_id = auth.uid()
         or session_id in (select id from public.personal_sessions where user_id = auth.uid())
         or public.is_box_coach(box_id)
       ))
  );

-- ─── 4. Stockage : bucket public pour vidéos (WOD + mouvements) ─
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- Lecture publique (les vidéos de démo n'ont pas besoin d'auth pour être vues).
create policy "media_public_read" on storage.objects
  for select using (bucket_id = 'media');

-- Upload : utilisateurs authentifiés uniquement, dans leur propre dossier
-- (convention : media/<user_id>/...) pour permettre la policy de suppression.
create policy "media_auth_upload" on storage.objects
  for insert with check (
    bucket_id = 'media'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "media_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- FIN DE LA MIGRATION v4
-- ============================================================
