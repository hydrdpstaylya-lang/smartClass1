-- SmartClass گفتگو (پیام‌رسان مدرسه) — run once in Supabase SQL Editor AFTER database/setup.sql.
-- Safe to run again: every statement is idempotent.
-- All access happens through the server (service_role key). Browsers never talk to these tables directly.

-- One global, monotonic revision counter. Every insert/update on chat tables takes the next value,
-- so a client can ask "give me everything after revision N" with a single indexed range query.
create sequence if not exists public.sc_chat_rev_seq;

create or replace function public.sc_chat_bump_rev()
returns trigger
language plpgsql
set search_path = pg_catalog
as $
begin
  new.rev := nextval('public.sc_chat_rev_seq');
  return new;
end
$;
revoke all on function public.sc_chat_bump_rev() from public, anon, authenticated;

-- Public chat profile next to the account (title, avatar, presence).
create table if not exists public.sc_chat_profiles(
  user_id bigint primary key references public.sc_users(id) on delete cascade,
  title text not null default '' check (length(title) <= 60),
  avatar text check (avatar is null or length(avatar) <= 140000),
  avatar_ver integer not null default 0,
  last_seen bigint not null default 0,
  rev bigint not null default 0
);

-- A conversation: personal (2 people), group, class (teacher-led), channel (broadcast) or saved (self).
create table if not exists public.sc_chats(
  id text primary key check (id ~ '^[A-Za-z0-9_-]{3,48}$'),
  type text not null check (type in ('personal','group','class','channel','saved')),
  name text not null default '' check (length(name) <= 60),
  sym text not null default '' check (length(sym) <= 16),
  color smallint not null default 0 check (color between 0 and 15),
  owner bigint references public.sc_users(id) on delete set null,
  pinned_msg text,
  live boolean not null default false,
  created bigint not null,
  rev bigint not null default 0
);

create table if not exists public.sc_chat_members(
  chat_id text not null references public.sc_chats(id) on delete cascade,
  user_id bigint not null references public.sc_users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  last_read bigint not null default 0,
  typing_until bigint not null default 0,
  pinned boolean not null default false,
  muted boolean not null default false,
  hidden_before bigint not null default 0,
  joined bigint not null,
  rev bigint not null default 0,
  primary key (chat_id, user_id)
);

create table if not exists public.sc_messages(
  id text primary key check (id ~ '^[A-Za-z0-9_-]{3,48}$'),
  chat_id text not null references public.sc_chats(id) on delete cascade,
  sender bigint references public.sc_users(id) on delete set null,
  kind text not null default 'text' check (kind in ('text','sys','image','file','voice','sticker','assign','quiz','att','grade')),
  body jsonb not null,
  created bigint not null,
  edited bigint,
  deleted boolean not null default false,
  rev bigint not null default 0
);

-- Uploaded objects (Supabase Storage, private bucket). The row proves who uploaded what, for which chat.
create table if not exists public.sc_chat_files(
  path text primary key,
  chat_id text not null references public.sc_chats(id) on delete cascade,
  chat_ids text[] not null default '{}',
  owner bigint not null references public.sc_users(id) on delete cascade,
  name text not null default '' check (length(name) <= 120),
  mime text not null default '' check (length(mime) <= 100),
  size bigint not null default 0,
  created bigint not null
);

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'sc_chat_profiles_rev') then
    create trigger sc_chat_profiles_rev before insert or update on public.sc_chat_profiles for each row execute function public.sc_chat_bump_rev();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'sc_chats_rev') then
    create trigger sc_chats_rev before insert or update on public.sc_chats for each row execute function public.sc_chat_bump_rev();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'sc_chat_members_rev') then
    create trigger sc_chat_members_rev before insert or update on public.sc_chat_members for each row execute function public.sc_chat_bump_rev();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'sc_messages_rev') then
    create trigger sc_messages_rev before insert or update on public.sc_messages for each row execute function public.sc_chat_bump_rev();
  end if;
end $$;

create index if not exists sc_chat_members_user on public.sc_chat_members(user_id);
create index if not exists sc_chat_members_rev on public.sc_chat_members(chat_id, rev);
create index if not exists sc_chats_rev on public.sc_chats(rev);
create index if not exists sc_messages_chat_created on public.sc_messages(chat_id, created desc);
create index if not exists sc_messages_chat_rev on public.sc_messages(chat_id, rev);
create index if not exists sc_chat_profiles_rev on public.sc_chat_profiles(rev);

alter table public.sc_chat_profiles enable row level security;
alter table public.sc_chats enable row level security;
alter table public.sc_chat_members enable row level security;
alter table public.sc_messages enable row level security;
alter table public.sc_chat_files enable row level security;
revoke all on public.sc_chat_profiles, public.sc_chats, public.sc_chat_members, public.sc_messages, public.sc_chat_files from anon, authenticated;
revoke all on sequence public.sc_chat_rev_seq from anon, authenticated;

-- Private storage bucket for photos, files and voice notes (50 MB per object).
insert into storage.buckets (id, name, public, file_size_limit)
values ('sc-chat', 'sc-chat', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;
