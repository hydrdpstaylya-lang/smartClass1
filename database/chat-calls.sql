-- SmartClass secure live rooms (Daily private rooms)
create table if not exists public.sc_chat_calls (
  chat_id text primary key references public.sc_chats(id) on delete cascade,
  room_name text not null unique check (room_name ~ '^[A-Za-z0-9_-]{8,120}$'),
  room_url text not null,
  started_by bigint not null references public.sc_users(id) on delete restrict,
  started_at bigint not null,
  expires_at bigint not null,
  ended_at bigint,
  created_at timestamptz not null default now()
);
create index if not exists sc_chat_calls_active on public.sc_chat_calls(expires_at) where ended_at is null;
alter table public.sc_chat_calls enable row level security;
revoke all on public.sc_chat_calls from anon, authenticated;
grant all on public.sc_chat_calls to service_role;
