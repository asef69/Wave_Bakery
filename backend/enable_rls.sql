-- Enable Row-Level Security on every public table.
-- Wave Bakery's backend talks to Postgres directly (SQLAlchemy/psycopg2, the
-- Postgres role), which is unaffected by RLS. This only blocks Supabase's
-- auto-generated PostgREST API (the anon/authenticated keys), which was
-- otherwise exposing every row -- including players.password_hash and
-- players.token -- to anyone with the project URL.
--
-- No policies are added on purpose: RLS enabled + zero policies denies all
-- access from anon/authenticated, which is what we want since nothing should
-- be reading this database through the REST API.

ALTER TABLE public.players            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredients        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appliances         ENABLE ROW LEVEL SECURITY;
