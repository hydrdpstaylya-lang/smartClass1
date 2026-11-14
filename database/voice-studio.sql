-- SmartClass Voice Studio — run after database/chat.sql and database/chat-calls.sql.
-- Idempotent schema for classroom events, transcription consent and breakout rooms.
-- The application server uses the service_role key; browser clients have no direct table access.

create table if not exists public.sc_voice_events (
  id bigint generated always as identity primary key,
  chat_id text not null references public.sc_chats(id),
  room_name text not null,
  actor bigint not null references public.sc_users(id),
  event_type text not null check (event_type in (
    'hand_raise','hand_lower','turn_granted','turn_revoked','mute_all',
    'board_stroke','board_note','board_clear',
    'quiz_start','quiz_end','quiz_answer','quiz_grade',
    'group_plan','command_executed',
    'transcription_start','transcription_stop','transcript_line','summary_saved'
  )),
  payload jsonb not null default '{}'::jsonb,
  created bigint not null
);
create index if not exists sc_voice_events_chat_room_id
  on public.sc_voice_events(chat_id, room_name, id);

create table if not exists public.sc_voice_consents (
  chat_id text not null references public.sc_chats(id),
  room_name text not null,
  user_id bigint not null references public.sc_users(id),
  allowed boolean not null default false,
  updated bigint not null,
  primary key (chat_id, room_name, user_id)
);

create table if not exists public.sc_voice_breakouts (
  id uuid primary key default gen_random_uuid(),
  chat_id text not null references public.sc_chats(id),
  parent_room_name text not null,
  room_name text not null unique,
  room_url text not null,
  label text not null,
  members bigint[] not null default '{}'::bigint[],
  created bigint not null,
  expires_at bigint not null,
  ended_at bigint
);
create index if not exists sc_voice_breakouts_active
  on public.sc_voice_breakouts(chat_id, expires_at)
  where ended_at is null;

alter table public.sc_voice_events enable row level security;
alter table public.sc_voice_consents enable row level security;
alter table public.sc_voice_breakouts enable row level security;

revoke all on public.sc_voice_events, public.sc_voice_consents, public.sc_voice_breakouts
  from public, anon, authenticated;
grant all on public.sc_voice_events, public.sc_voice_consents, public.sc_voice_breakouts
  to service_role;
revoke all on sequence public.sc_voice_events_id_seq from public, anon, authenticated;
grant usage, select on sequence public.sc_voice_events_id_seq to service_role;
