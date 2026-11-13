-- Run once in Supabase SQL Editor to enable phone-number sign-in.
-- Existing accounts remain unchanged; users can continue using their username.
ALTER TABLE public.sc_users ADD COLUMN IF NOT EXISTS phone text;
CREATE UNIQUE INDEX IF NOT EXISTS sc_users_phone_unique ON public.sc_users(phone) WHERE phone IS NOT NULL;
