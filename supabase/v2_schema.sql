-- PolyMath v2: real tables for books, study items and memory. Additive: version 1 keeps working untouched.
create table if not exists public.v2_books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  v1_id text,                       -- the version-1 workspace this came from, if any
  title text not null,
  subject text,
  tone text,
  pages int,
  storage_path text,                -- where the PDF lives in the books bucket
  status text not null default 'new' check (status in ('new','processing','ready','failed')),
  created_at timestamptz not null default now(),
  unique (user_id, v1_id)
);
create table if not exists public.v2_sections (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.v2_books(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  idx int not null,
  title text not null,
  page_start int, page_end int,
  summary jsonb
);
create table if not exists public.v2_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid references public.v2_books(id) on delete cascade,
  section_id uuid references public.v2_sections(id) on delete cascade,
  kind text not null check (kind in ('question','term','concept','exam')),
  source text,                      -- 'book', 'sat', 'mcat', ...
  ord int not null default 0,
  body jsonb not null,
  created_at timestamptz not null default now()
);
create table if not exists public.v2_memory (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.v2_items(id) on delete cascade,
  s real not null default 0, d real not null default 5,
  due timestamptz, reps int not null default 0, lapses int not null default 0, last timestamptz,
  primary key (user_id, item_id)
);
create table if not exists public.v2_reviews (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.v2_items(id) on delete cascade,
  q real not null, signals jsonb, mode text,
  at timestamptz not null default now()
);
create table if not exists public.v2_ai_usage (     -- shared-key budget, written only by server functions
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  calls int not null default 0, tokens int not null default 0,
  primary key (user_id, day)
);
create index if not exists v2_items_user_book on public.v2_items (user_id, book_id, ord);
create index if not exists v2_memory_due on public.v2_memory (user_id, due);
create index if not exists v2_reviews_user_at on public.v2_reviews (user_id, at desc);
create index if not exists v2_sections_book on public.v2_sections (book_id, idx);

alter table public.v2_books enable row level security;
alter table public.v2_sections enable row level security;
alter table public.v2_items enable row level security;
alter table public.v2_memory enable row level security;
alter table public.v2_reviews enable row level security;
alter table public.v2_ai_usage enable row level security;

do $$ declare t text; begin
  foreach t in array array['v2_books','v2_sections','v2_items','v2_memory'] loop
    execute format('drop policy if exists %I on public.%I', t||'_own', t);
    execute format('create policy %I on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t||'_own', t);
  end loop;
end $$;
drop policy if exists v2_reviews_read on public.v2_reviews;
create policy v2_reviews_read on public.v2_reviews for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists v2_reviews_add on public.v2_reviews;
create policy v2_reviews_add on public.v2_reviews for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists v2_ai_usage_read on public.v2_ai_usage;
create policy v2_ai_usage_read on public.v2_ai_usage for select to authenticated using (user_id = (select auth.uid()));
