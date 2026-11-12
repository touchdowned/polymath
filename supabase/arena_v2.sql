-- ===== daily challenge: one written question a day (New York time), same for everyone, one attempt =====
create or replace function public.pm_today() returns date language sql stable set search_path to '' as $$ select (now() at time zone 'America/New_York')::date $$;
create table if not exists public.daily(day date primary key, qid bigint references public.pool_questions on delete set null, created_at timestamptz default now());
alter table public.daily enable row level security;
create table if not exists public.daily_answers(day date not null, user_id uuid not null references auth.users on delete cascade, ans text, score numeric, max numeric, grade jsonb,
  gstatus text not null default 'started', started_at timestamptz default now(), submitted_at timestamptz, primary key(day, user_id));
alter table public.daily_answers enable row level security;


-- ===== sharing: server-side record of what each player already shared, and one copy of each book =====
create table if not exists public.pool_share_log(user_id uuid not null references auth.users on delete cascade, key text not null, state text not null, info jsonb, updated_at timestamptz default now(), primary key(user_id, key));
alter table public.pool_share_log enable row level security;
create table if not exists public.pool_sources(hash text primary key, owner uuid not null references auth.users on delete cascade, title text, kind text, created_at timestamptz default now());
alter table public.pool_sources enable row level security;

create or replace function public.pm_share_get() returns json language sql stable security definer set search_path to 'public' as $$
  select coalesce(json_object_agg(key, json_build_object('state', state, 'info', info)), '{}'::json) from pool_share_log where user_id = auth.uid() $$;
create or replace function public.pm_share_set(p_key text, p_state text, p_info jsonb default null) returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null or pm_is_guest(auth.uid()) then raise exception 'sign in first'; end if;
  insert into pool_share_log(user_id, key, state, info) values (auth.uid(), left(p_key, 200), left(p_state, 20), p_info)
  on conflict (user_id, key) do update set state = excluded.state, info = excluded.info, updated_at = now();
end $$;
-- 'new' = go ahead, 'mine' = you already shared this file, 'taken' = someone else already shared the same file
create or replace function public.pm_claim_source(p_hash text, p_title text, p_kind text) returns json language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); s pool_sources;
begin
  if me is null or pm_is_guest(me) then raise exception 'sign in first'; end if;
  select * into s from pool_sources where hash = p_hash for update;
  if not found then insert into pool_sources(hash, owner, title, kind) values (p_hash, me, left(p_title, 80), p_kind); return json_build_object('status', 'new'); end if;
  if s.owner = me then return json_build_object('status', 'mine', 'title', s.title); end if;
  if not exists (select 1 from pool_questions where owner = s.owner and title = s.title) then
    update pool_sources set owner = me, title = left(p_title, 80), kind = p_kind, created_at = now() where hash = p_hash; return json_build_object('status', 'new');
  end if;
  return json_build_object('status', 'taken', 'title', s.title);
end $$;

-- ===== pool columns: rotation, variants, duplicate check =====
alter table public.pool_questions add column if not exists retired boolean not null default false;
alter table public.pool_questions add column if not exists retired_at timestamptz;
alter table public.pool_questions add column if not exists uses_week int not null default 0;
alter table public.pool_questions add column if not exists refreshed boolean not null default false;
alter table public.pool_questions add column if not exists refresh_claim timestamptz;
alter table public.pool_questions add column if not exists variant_of bigint;
alter table public.pool_questions add column if not exists qnorm text;
update public.pool_questions set qnorm = md5(lower(regexp_replace(coalesce(q, ''), '[^a-zA-Z0-9]', '', 'g'))) where kind <> 'sat' and qnorm is null;
create index if not exists pool_questions_qnorm on public.pool_questions(qnorm);

create or replace function public.pm_pool_cat_t() returns trigger language plpgsql set search_path to '' as $$
begin
  new.cat := public.pm_refine_cat(coalesce(new.cat, public.pm_guess_cat(new.title)), new.kind, new.subject, new.title);
  if new.cat is null or not (new.cat = any(public.pm_cats())) then new.cat := coalesce(public.pm_guess_cat(new.title), 'math'); end if;
  if new.kind <> 'sat' then
    new.qnorm := md5(lower(regexp_replace(coalesce(new.q, ''), '[^a-zA-Z0-9]', '', 'g')));
    if exists (select 1 from public.pool_questions p where p.qnorm = new.qnorm and p.kind <> 'sat') then return null; end if;   -- the same question is already in the pool
  end if;
  return new;
end $$;

create or replace function public.pm_contribute(p_kind text, p_title text, p_items jsonb, p_cat text default null) returns integer language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); it jsonb; n int := 0; k int; mx int;
  c text := case when p_cat = any(pm_cats()) then p_cat else pm_guess_cat(p_title) end;
begin
  if me is null or pm_is_guest(me) then raise exception 'sign in first'; end if;
  if p_kind not in ('book','notes','iq') then raise exception 'bad kind'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 60 then raise exception 'send 1 to 60 questions'; end if;
  if (select count(*) from pool_questions where owner = me and kind <> 'sat') > 3000 then raise exception 'sharing limit reached'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    k := 0;
    if it->>'type' = 'written' then
      if length(coalesce(it->>'q','')) between 10 and 600 and length(coalesce(it->>'ma','')) > 10 and jsonb_typeof(it->'rubric') = 'array' and jsonb_array_length(it->'rubric') between 1 and 6 then
        mx := least(6, greatest(1, (select coalesce(sum(least(3, greatest(0, coalesce((x->>'pts')::numeric, 1)))), 0)::int from jsonb_array_elements(it->'rubric') x)));
        insert into pool_questions(owner, kind, title, q, choices, answer, level, explain, rating, cat, qtype, ans_text, rubric, max_pts)
        values (me, p_kind, left(coalesce(p_title,''), 80), it->>'q', '[]'::jsonb, 0, least(4, greatest(1, coalesce((it->>'d')::int, 3)))::smallint, '',
          case when (it->>'r') ~ '^[0-9]+(\.[0-9]+)?$' then least(170, greatest(75, (it->>'r')::numeric)) else 115 end, c, 'written', left(it->>'ma', 3000),
          (select jsonb_agg(jsonb_build_object('pts', least(3, greatest(0, coalesce((x->>'pts')::numeric, 1))), 'desc', left(coalesce(x->>'desc', ''), 300))) from jsonb_array_elements(it->'rubric') x), mx);
        get diagnostics k = row_count;
      end if;
    elsif jsonb_typeof(it->'c') = 'array' and jsonb_array_length(it->'c') = 4 and length(coalesce(it->>'q','')) between 3 and 600 and (it->>'a') ~ '^[0-3]$' then
      insert into pool_questions(owner, kind, title, q, choices, answer, level, explain, rating, cat)
      values (me, p_kind, left(coalesce(p_title,''), 80), it->>'q', (select jsonb_agg(left(x, 200)) from jsonb_array_elements_text(it->'c') x),
        (it->>'a')::smallint, least(4, greatest(1, coalesce((it->>'d')::int, 2)))::smallint, left(coalesce(it->>'ex',''), 400),
        case when (it->>'r') ~ '^[0-9]+(\.[0-9]+)?$' then least(170, greatest(75, (it->>'r')::numeric)) end, c);
      get diagnostics k = row_count;
    end if;
    n := n + k;
  end loop;
  return n;
end $$;

-- ===== weekly rotation: overused questions retire (at least 12 stay live per subject), and players with a Claude key write fresh versions =====
create table if not exists public.pm_meta(k text primary key, v jsonb, at timestamptz default now());
alter table public.pm_meta enable row level security;
create or replace function public.pm_rotate() returns json language plpgsql security definer set search_path to 'public' as $$
declare last timestamptz; n int := 0;
begin
  select at into last from pm_meta where k = 'rotated' for update;
  if last is not null and last > now() - interval '7 days' then return json_build_object('rotated', false, 'next', last + interval '7 days'); end if;
  with c as (select cat, count(*) active from pool_questions where not retired and kind <> 'sat' group by cat),
       r as (select p.id, row_number() over (partition by p.cat order by p.uses_week desc, random()) rn, c.active from pool_questions p join c using (cat)
             where not p.retired and p.kind <> 'sat' and p.uses_week >= 3)
  update pool_questions set retired = true, retired_at = now() where id in (select id from r where rn <= r.active - 12);
  get diagnostics n = row_count;
  update pool_questions set uses_week = 0 where uses_week <> 0;
  insert into pm_meta(k, v, at) values ('rotated', jsonb_build_object('retired', n), now()) on conflict (k) do update set v = excluded.v, at = now();
  return json_build_object('rotated', true, 'retired', n);
end $$;
create or replace function public.pm_refresh_batch(p_n int default 6) returns json language plpgsql security definer set search_path to 'public' as $$
declare ids bigint[];
begin
  if auth.uid() is null or pm_is_guest(auth.uid()) then raise exception 'sign in first'; end if;
  select array_agg(id) into ids from (select id from pool_questions where retired and not refreshed and kind <> 'sat' and coalesce(qtype, 'mc') = 'mc'
      and (refresh_claim is null or refresh_claim < now() - interval '30 minutes') order by retired_at limit least(10, greatest(1, p_n)) for update skip locked) x;
  if ids is null then return '[]'::json; end if;
  update pool_questions set refresh_claim = now() where id = any(ids);
  return (select json_agg(json_build_object('id', id, 'q', q, 'c', choices, 'a', answer, 'ex', explain, 'title', title, 'cat', cat)) from pool_questions where id = any(ids));
end $$;
create or replace function public.pm_add_variant(p_old bigint, p_item jsonb) returns boolean language plpgsql security definer set search_path to 'public' as $$
declare o pool_questions; k int;
begin
  if auth.uid() is null or pm_is_guest(auth.uid()) then raise exception 'sign in first'; end if;
  select * into o from pool_questions where id = p_old and retired and not refreshed for update;
  if not found then return false; end if;
  if not (jsonb_typeof(p_item->'c') = 'array' and jsonb_array_length(p_item->'c') = 4 and length(coalesce(p_item->>'q','')) between 3 and 600 and (p_item->>'a') ~ '^[0-3]$') then return false; end if;
  insert into pool_questions(owner, kind, title, q, choices, answer, level, explain, rating, cat, variant_of)
  values (o.owner, o.kind, o.title, p_item->>'q', (select jsonb_agg(left(x, 200)) from jsonb_array_elements_text(p_item->'c') x), (p_item->>'a')::smallint, o.level,
          left(coalesce(p_item->>'ex', ''), 400), o.rating, o.cat, o.id);
  get diagnostics k = row_count;
  update pool_questions set refreshed = true where id = p_old;
  return k > 0;
end $$;

create or replace function public.pm_pick_part(p_target numeric, p_n integer, p_cat text, p_sat boolean, p_not bigint[], p_users uuid[], p_avoid boolean) returns bigint[] language plpgsql security definer set search_path to 'public' as $$
declare q bigint[]; w numeric;
begin
  if p_n <= 0 then return '{}'; end if;
  foreach w in array array[9, 16, 26, 41, 68, 400] loop
    select array_agg(id) into q from (select p.id from pool_questions p
      where p.rating between p_target - w and p_target + w and (p_cat is null or p.cat = p_cat) and ((p.kind = 'sat') = p_sat) and p.qtype is distinct from 'written' and not p.retired
        and not (p.id = any(p_not))
        and (not p_avoid or not exists (select 1 from seen_questions s where s.qid = p.id and s.user_id = any(p_users)))
      order by random() limit p_n) s;
    exit when coalesce(array_length(q, 1), 0) >= p_n;
  end loop;
  return coalesce(q, '{}');
end $$;
create or replace function public.pm_pick_fill(p_target numeric, p_n integer, p_cat text, p_sat boolean, p_not bigint[], p_users uuid[]) returns bigint[] language plpgsql security definer set search_path to 'public' as $$
declare a bigint[]; b bigint[];
begin
  if p_n <= 0 then return '{}'; end if;
  a := pm_pick_part(p_target, p_n, p_cat, p_sat, p_not, p_users, true);
  if coalesce(array_length(a, 1), 0) >= p_n then return a; end if;
  -- everything unseen is used up: take the ones these players saw longest ago
  select array_agg(id) into b from (select p.id from pool_questions p
      left join lateral (select max(s.seen_at) last from seen_questions s where s.qid = p.id and s.user_id = any(p_users)) s on true
      where (p_cat is null or p.cat = p_cat) and ((p.kind = 'sat') = p_sat) and p.qtype is distinct from 'written' and not p.retired and not (p.id = any(p_not || a))
      order by s.last nulls first, abs(p.rating - p_target) limit p_n - coalesce(array_length(a, 1), 0)) x;
  return a || coalesce(b, '{}');
end $$;
create or replace function public.pm_pick_written(p_target numeric, p_cat text, p_users uuid[], p_k integer) returns bigint[] language sql security definer set search_path to 'public' as $$
  select coalesce(array_agg(id), '{}') from (select p.id from pool_questions p
    left join lateral (select max(s.seen_at) last from seen_questions s where s.qid = p.id and s.user_id = any(p_users)) s on true
    where p.qtype = 'written' and not p.retired and (p_cat is null or p.cat = p_cat) and (p_target >= 112 or p.rating <= 112)
      and not exists (select 1 from daily d where d.qid = p.id and d.day >= pm_today() - 1)
    order by s.last nulls first, abs(p.rating - p_target), random() limit greatest(0, p_k)) x $$;

-- ===== comeback questions: one per player per match, swapped in only for that player =====
create table if not exists public.match_swaps(match_id uuid not null references public.matches on delete cascade, user_id uuid not null, idx int not null, qid bigint not null, secs int not null default 300, mult numeric not null default 1.5, at timestamptz default now(), primary key(match_id, user_id, idx));
alter table public.match_swaps enable row level security;
create or replace function public.pm_qid(p_id uuid, p_user uuid, p_idx int) returns bigint language sql stable security definer set search_path to 'public' as $$
  select coalesce((select qid from match_swaps where match_id = p_id and user_id = p_user and idx = p_idx), (select qids[p_idx + 1] from matches where id = p_id)) $$;

create or replace function public.pm_start(p_id uuid, p_guest uuid) returns void language plpgsql security definer set search_path to 'public' as $$
declare m public.matches; q bigint[]; grader boolean; t numeric;
begin
  select * into m from matches where id = p_id for update;
  grader := exists (select 1 from secrets where user_id in (m.host, p_guest));
  t := (pm_target(m.host, m.cat) + pm_target(p_guest, m.cat)) / 2;
  q := pm_pick(t, array_length(m.qids, 1), m.cat, array[m.host, p_guest], case when not grader then 0 when t < 112 then 2 else 1 end);
  if coalesce(array_length(q, 1), 0) < array_length(m.qids, 1) then q := m.qids; end if;
  update matches set guest = p_guest, status = 'playing', started_at = now() + interval '4 seconds', qids = q,
    secs = (select array_agg(case when p.qtype = 'written' then 240
                                  when p.kind = 'sat' then (case when p.subject = 'rw' then 70 else 90 end) + (case when p.rating >= 112 then 15 else 0 end)
                                  else pm_qsecs(p.rating, p.q) end order by t.ord)
            from unnest(q) with ordinality t(qid, ord) join pool_questions p on p.id = t.qid)
  where id = p_id;
  update pool_questions set uses_week = uses_week + 1 where id = any(q);
end $$;

create or replace function public.pm_answer(p_id uuid, p_idx integer, p_choice integer, p_text text default null) returns json language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); m public.matches; pq public.pool_questions; pr numeric; last timestamptz; ms int; ok boolean; pts int; host boolean; lim int; blank boolean;
begin
  select * into m from matches where id = p_id for update;
  if not found or me not in (m.host, m.guest) then raise exception 'not your game'; end if;
  if m.status <> 'playing' or now() < m.started_at then raise exception 'game not running'; end if;
  host := me = m.host;
  if p_idx <> (case when host then m.host_n else m.guest_n end) then raise exception 'answer the questions in order'; end if;
  if p_idx >= array_length(m.qids, 1) then raise exception 'no more questions'; end if;
  lim := coalesce((select secs from match_swaps where match_id = p_id and user_id = me and idx = p_idx), m.secs[p_idx + 1], 30);
  select * into pq from pool_questions where id = pm_qid(p_id, me, p_idx);
  pr := pm_rating(me, m.cat);
  select max(at) into last from match_answers where match_id = p_id and user_id = me;
  ms := least((lim + 30) * 1000, greatest(0, extract(epoch from (now() - coalesce(last, m.started_at))) * 1000))::int;
  insert into seen_questions(user_id, qid) values (me, pq.id) on conflict (user_id, qid) do update set seen_at = now(), times = seen_questions.times + 1;
  if pq.qtype = 'written' then
    blank := p_choice < 0 or coalesce(trim(p_text), '') = '';
    insert into match_answers(match_id, user_id, idx, choice, correct, points, ms, txt, ans, gstatus)
      values (p_id, me, p_idx, p_choice, false, 0, ms, left(p_text, 40), left(p_text, 6000), case when blank then 'done' else 'pending' end);
    if host then update matches set host_n = host_n + 1 where id = p_id; else update matches set guest_n = guest_n + 1 where id = p_id; end if;
    return json_build_object('pending', not blank, 'correct', false, 'points', 0, 'answer', null, 'explain', null);
  end if;
  ok := case when pq.qtype = 'spr' then p_choice >= 0 and pm_spr_ok(pq.ans_text, p_text) else p_choice = pq.answer end;
  pts := case when ok then round((100 + 50 * greatest(0, 1 - ms / (lim * 1000.0))) * (case when pq.kind = 'sat' then 0.6 else 1 end)) else 0 end;
  insert into match_answers(match_id, user_id, idx, choice, correct, points, ms, txt) values (p_id, me, p_idx, p_choice, ok, pts, ms, left(p_text, 40));
  if not pm_unrated(m) then
    update pool_questions set rating = least(185, greatest(60, rating - 1.2 * ((case when ok then 1 else 0 end) - 1 / (1 + power(10, (pq.rating - pr) / 30.0))))) where id = pq.id;
  end if;
  if host then update matches set host_score = host_score + pts, host_n = host_n + 1, host_right = host_right + ok::int where id = p_id;
  else update matches set guest_score = guest_score + pts, guest_n = guest_n + 1, guest_right = guest_right + ok::int where id = p_id; end if;
  return json_build_object('correct', ok, 'answer', pq.answer, 'answer_text', case when pq.qtype = 'spr' then split_part(pq.ans_text, ',', 1) end, 'explain', pq.explain, 'points', pts);
end $$;

create or replace function public.pm_set_grade(p_id uuid, p_user uuid, p_idx integer, p_score numeric, p_grade jsonb) returns json language plpgsql security definer set search_path to 'public' as $$
declare m public.matches; a public.match_answers; pq public.pool_questions; mx numeric; pts int; ok boolean; d int; dr int; pr numeric; mult numeric;
begin
  select * into m from matches where id = p_id for update;
  select * into a from match_answers where match_id = p_id and user_id = p_user and idx = p_idx for update;
  if not found then raise exception 'no such answer'; end if;
  select * into pq from pool_questions where id = pm_qid(p_id, p_user, p_idx);
  mult := coalesce((select s.mult from match_swaps s where s.match_id = p_id and s.user_id = p_user and s.idx = p_idx), 1);
  mx := greatest(1, coalesce(pq.max_pts, 3));
  pts := round(300 * mult * least(1, greatest(0, p_score / mx)));
  ok := p_score >= mx * 0.67;
  d := pts - a.points; dr := ok::int - a.correct::int;
  update match_answers set points = pts, correct = ok, grade = p_grade || jsonb_build_object('score', p_score, 'max', mx), gstatus = 'done' where match_id = p_id and user_id = p_user and idx = p_idx;
  if p_user = m.host then update matches set host_score = host_score + d, host_right = host_right + dr where id = p_id;
  else update matches set guest_score = guest_score + d, guest_right = guest_right + dr where id = p_id; end if;
  if a.gstatus = 'pending' and not pm_unrated(m) then
    pr := pm_rating(p_user, m.cat);
    update pool_questions set rating = least(185, greatest(60, rating - 1.2 * (p_score / mx - 1 / (1 + power(10, (pq.rating - pr) / 30.0))))) where id = pq.id;
  end if;
  if m.status = 'done' then perform pm_rescore(p_id); end if;
  return json_build_object('points', pts, 'correct', ok);
end $$;

-- the most points a player can still earn (their unanswered questions at full marks, plus written answers still being graded)
create or replace function public.pm_max_left(p_id uuid, p_user uuid) returns numeric language sql stable security definer set search_path to 'public' as $$
  select coalesce((select sum(case when p.qtype = 'written' then 300 * coalesce(s.mult, 1) else 150 * (case when p.kind = 'sat' then 0.6 else 1 end) end)
      from matches m cross join generate_series(case when m.host = p_user then m.host_n else m.guest_n end, array_length(m.qids, 1) - 1) i
      left join match_swaps s on s.match_id = m.id and s.user_id = p_user and s.idx = i
      join pool_questions p on p.id = coalesce(s.qid, m.qids[i + 1]) where m.id = p_id), 0)
  + coalesce((select sum(300 * coalesce(s.mult, 1)) from match_answers a left join match_swaps s on s.match_id = a.match_id and s.user_id = a.user_id and s.idx = a.idx
      where a.match_id = p_id and a.user_id = p_user and a.gstatus = 'pending'), 0) $$;

create or replace function public.pm_comeback(p_id uuid) returns json language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); m public.matches; host boolean; my_n int; mine numeric; theirs numeric; q bigint;
begin
  select * into m from matches where id = p_id for update;
  if not found or me not in (m.host, m.guest) then raise exception 'not your game'; end if;
  if m.status <> 'playing' then raise exception 'The match is over.'; end if;
  if exists (select 1 from match_swaps where match_id = p_id and user_id = me) then raise exception 'You already used your comeback question.'; end if;
  if not exists (select 1 from secrets where user_id in (m.host, m.guest)) then raise exception 'Comeback questions are written and need a Claude key from a player in the match.'; end if;
  host := me = m.host; my_n := case when host then m.host_n else m.guest_n end;
  if my_n >= array_length(m.qids, 1) then raise exception 'No questions left.'; end if;
  mine := case when host then m.host_score else m.guest_score end; theirs := case when host then m.guest_score else m.host_score end;
  if mine + pm_max_left(p_id, me) >= theirs then raise exception 'You can still catch up with normal questions.'; end if;
  select p.id into q from pool_questions p
    where p.qtype = 'written' and not p.retired and not (p.id = any(m.qids))
      and not exists (select 1 from seen_questions s where s.qid = p.id and s.user_id = me)
    order by (p.cat is not distinct from m.cat) desc, (p.rating >= 125) desc, p.rating desc, random() limit 1;
  if q is null then
    select p.id into q from pool_questions p where p.qtype = 'written' and not (p.id = any(m.qids)) order by (p.cat is not distinct from m.cat) desc, p.rating desc, random() limit 1;
  end if;
  if q is null then raise exception 'There are no written questions in the pool yet, so there is no comeback question to give.'; end if;
  insert into match_swaps(match_id, user_id, idx, qid, secs, mult) values (p_id, me, my_n, q, 300, 1.5);
  return json_build_object('ok', true, 'idx', my_n);
end $$;

create or replace function public.pm_match_state(p_id uuid) returns json language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); m public.matches; n int; qs json; total int; pend int;
begin
  select * into m from matches where id = p_id;
  if not found or me not in (m.host, coalesce(m.guest, m.host)) then raise exception 'not your game'; end if;
  n := array_length(m.qids, 1);
  total := coalesce((select sum(s) from unnest(m.secs) s), n * 30) + n * 2 + 25
         + coalesce((select max(x) from (select sum(greatest(0, s.secs - coalesce(m.secs[s.idx + 1], 30))) x from match_swaps s where s.match_id = p_id group by s.user_id) y), 0);
  pend := (select count(*) from match_answers where match_id = p_id and gstatus = 'pending');
  if m.status = 'playing' and pend > 0 and now() > m.started_at + make_interval(secs => total + 150) then
    update match_answers set gstatus = 'failed', grade = jsonb_build_object('reason', 'The grader did not answer in time, so this counts as 0.') where match_id = p_id and gstatus = 'pending'; pend := 0;
  end if;
  if m.status = 'playing' and pend = 0 and ((m.host_n >= n and m.guest_n >= n) or now() > m.started_at + make_interval(secs => total)) then
    perform pm_finish(p_id); select * into m from matches where id = p_id;
  end if;
  if m.status in ('playing','done') then
    select json_agg(json_build_object('q', p.q, 'c', p.choices, 'hard', p.rating >= 130 or s.qid is not null, 'secs', coalesce(s.secs, m.secs[t.ord], 30), 'img', p.img, 'type', p.qtype, 'max', p.max_pts,
        'comeback', s.qid is not null) order by t.ord) into qs
    from unnest(m.qids) with ordinality t(qid, ord)
      left join match_swaps s on s.match_id = m.id and s.user_id = me and s.idx = t.ord - 1
      join pool_questions p on p.id = coalesce(s.qid, t.qid);
  end if;
  return json_build_object('id', m.id, 'code', m.code, 'status', m.status, 'n', n, 'cat', m.cat, 'you', case when me = m.host then 'host' else 'guest' end, 'grading', pend,
    'me_guest', pm_is_guest(me), 'unrated', m.guest is not null and pm_unrated(m),
    'grader', exists (select 1 from secrets where user_id in (m.host, m.guest)),
    'comeback_used', exists (select 1 from match_swaps where match_id = p_id and user_id = me),
    'max_left', case when m.status = 'playing' then pm_max_left(p_id, me) end,
    'starts_in', case when m.started_at is null then null else extract(epoch from (m.started_at - now())) end,
    'host', (select json_build_object('name', name, 'rating', pm_rating(m.host, m.cat), 'guest', is_guest) from player_profiles where user_id = m.host),
    'guest', (select json_build_object('name', name, 'rating', pm_rating(m.guest, m.cat), 'guest', is_guest) from player_profiles where user_id = m.guest),
    'host_score', m.host_score, 'guest_score', m.guest_score, 'host_n', m.host_n, 'guest_n', m.guest_n,
    'host_right', m.host_right, 'guest_right', m.guest_right,
    'winner', case when m.winner is null then null when m.winner = me then 'you' else 'them' end,
    'delta', case when me = m.host then m.host_delta else m.guest_delta end, 'questions', qs);
end $$;

create or replace function public.pm_review(p_id uuid) returns json language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); m public.matches; them uuid;
begin
  select * into m from matches where id = p_id;
  if not found or me not in (m.host, m.guest) then raise exception 'not your game'; end if;
  if m.status <> 'done' then raise exception 'the game is not finished yet'; end if;
  them := case when me = m.host then m.guest else m.host end;
  return json_build_object('opponent', (select name from player_profiles where user_id = them), 'me_guest', pm_is_guest(me), 'unrated', pm_unrated(m),
    'you_score', case when me = m.host then m.host_score else m.guest_score end, 'them_score', case when me = m.host then m.guest_score else m.host_score end,
    'result', case when m.winner is null then 'draw' when m.winner = me then 'win' else 'loss' end,
    'delta', case when me = m.host then m.host_delta else m.guest_delta end,
    'items', (select json_agg(json_build_object('id', p.id, 'q', p.q, 'c', p.choices, 'answer', p.answer, 'explain', p.explain, 'secs', coalesce(s.secs, m.secs[t.ord], 30),
        'img', p.img, 'type', p.qtype, 'answer_text', p.ans_text, 'subject', p.subject, 'rubric', p.rubric, 'max', p.max_pts, 'cat', p.cat, 'comeback', s.qid is not null,
        'mine', (select json_build_object('choice', a.choice, 'ok', a.correct, 'ms', a.ms, 'pts', a.points, 'txt', a.txt, 'ans', a.ans, 'grade', a.grade, 'gstatus', a.gstatus) from match_answers a where a.match_id = p_id and a.user_id = me and a.idx = t.ord - 1),
        'theirs', (select json_build_object('ok', a.correct, 'ms', a.ms, 'pts', a.points) from match_answers a where a.match_id = p_id and a.user_id = them and a.idx = t.ord - 1))
      order by t.ord) from unnest(m.qids) with ordinality t(qid, ord)
        left join match_swaps s on s.match_id = m.id and s.user_id = me and s.idx = t.ord - 1
        join pool_questions p on p.id = coalesce(s.qid, t.qid)));
end $$;

create or replace function public.pm_daily_streak(p_user uuid) returns int language sql stable security definer set search_path to 'public' as $$
  with d as (select day from daily_answers where user_id = p_user and submitted_at is not null),
       s as (select day, day - (row_number() over (order by day))::int as grp from d)
  select case when (select max(day) from d) >= pm_today() - 1 then (select count(*)::int from s where grp = (select grp from s order by day desc limit 1)) else 0 end $$;

create or replace function public.pm_daily() returns json language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); d date := pm_today(); q bigint; p pool_questions; a daily_answers;
begin
  if me is null then raise exception 'sign in first'; end if;
  perform pm_rotate();
  select qid into q from daily where day = d;
  if q is null then
    select x.id into q from pool_questions x where x.qtype = 'written' and not x.retired and not exists (select 1 from daily y where y.qid = x.id)
      order by abs(x.rating - 118), random() limit 1;
    if q is null then select x.id into q from pool_questions x where x.qtype = 'written' order by random() limit 1; end if;
    if q is not null then
      insert into daily(day, qid) values (d, q) on conflict (day) do update set qid = excluded.qid where daily.qid is null;
      select qid into q from daily where day = d;
    end if;
  end if;
  select * into p from pool_questions where id = q;
  select * into a from daily_answers where day = d and user_id = me;
  return json_build_object('day', d, 'has', q is not null, 'guest', pm_is_guest(me),
    'q', p.q, 'cat', p.cat, 'rating', p.rating, 'max', p.max_pts, 'secs', 900,
    'state', coalesce(a.gstatus, 'new'), 'started_at', a.started_at,
    'mine', case when a.submitted_at is not null then json_build_object('ans', a.ans, 'score', a.score, 'max', a.max, 'grade', a.grade, 'gstatus', a.gstatus,
       'secs', extract(epoch from (a.submitted_at - a.started_at))::int) end,
    'model', case when a.submitted_at is not null then p.ans_text end,
    'streak', pm_daily_streak(me),
    'solvers', (select count(*) from daily_answers where day = d and submitted_at is not null),
    'board', (select coalesce(json_agg(b), '[]'::json) from (select pp.name, x.score, x.max, extract(epoch from (x.submitted_at - x.started_at))::int secs, x.user_id = me me
        from daily_answers x join player_profiles pp on pp.user_id = x.user_id where x.day = d and x.gstatus = 'done' and not pp.is_guest
        order by x.score desc nulls last, x.submitted_at - x.started_at limit 10) b));
end $$;
create or replace function public.pm_daily_start() returns json language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid();
begin
  if me is null or pm_is_guest(me) then raise exception 'Make an account to play the daily challenge.'; end if;
  if not exists (select 1 from daily where day = pm_today() and qid is not null) then raise exception 'There is no daily challenge yet today.'; end if;
  insert into daily_answers(day, user_id) values (pm_today(), me) on conflict do nothing;
  return json_build_object('started_at', (select started_at from daily_answers where day = pm_today() and user_id = me));
end $$;
create or replace function public.pm_daily_submit(p_ans text) returns json language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); k int;
begin
  if me is null or pm_is_guest(me) then raise exception 'sign in first'; end if;
  update daily_answers set ans = left(coalesce(p_ans, ''), 6000), gstatus = case when coalesce(trim(p_ans), '') = '' then 'done' else 'pending' end,
      score = case when coalesce(trim(p_ans), '') = '' then 0 end, submitted_at = now()
    where day = pm_today() and user_id = me and gstatus = 'started';
  get diagnostics k = row_count;
  if k = 0 then raise exception 'You already answered today''s challenge.'; end if;
  return json_build_object('ok', true);
end $$;

-- ===== rivals and badges =====
create or replace function public.pm_rivals() returns json language sql stable security definer set search_path to 'public' as $$
  select coalesce(json_agg(r), '[]'::json) from (
    select pp.name, count(*) games, count(*) filter (where m.winner = auth.uid()) w, count(*) filter (where m.winner is not null and m.winner <> auth.uid()) l,
      count(*) filter (where m.winner is null) d, max(m.created_at) last
    from matches m join player_profiles pp on pp.user_id = case when m.host = auth.uid() then m.guest else m.host end
    where m.status = 'done' and auth.uid() in (m.host, m.guest) and not pp.is_guest and not pm_is_guest(auth.uid())
    group by pp.user_id, pp.name order by count(*) desc, max(m.created_at) desc limit 8) r $$;
create or replace function public.pm_h2h(p_id uuid) returns json language sql stable security definer set search_path to 'public' as $$
  with x as (select case when host = auth.uid() then guest else host end opp from matches where id = p_id and auth.uid() in (host, guest))
  select json_build_object('w', count(*) filter (where m.winner = auth.uid()), 'l', count(*) filter (where m.winner = x.opp), 'd', count(*) filter (where m.winner is null), 'games', count(*))
  from x join matches m on m.status = 'done' and m.id <> p_id and ((m.host = auth.uid() and m.guest = x.opp) or (m.guest = auth.uid() and m.host = x.opp)) $$;

create or replace function public.pm_badges() returns json language sql stable security definer set search_path to 'public' as $$
  with ans as (select a.*, p.cat, p.rating, p.qtype from match_answers a join pool_questions p on p.id = pm_qid(a.match_id, a.user_id, a.idx) where a.user_id = auth.uid()),
       mt as (select m.id, m.cat, m.host, m.guest, m.winner = auth.uid() as won, array_length(m.qids, 1) n,
                case when m.host = auth.uid() then m.host_right else m.guest_right end myright,
                case when m.host = auth.uid() then m.host_delta else m.guest_delta end d,
                case when m.host = auth.uid() then m.guest else m.host end opp,
                pm_is_guest(m.host) or pm_is_guest(m.guest) unrated
              from matches m where m.status = 'done' and auth.uid() in (m.host, m.guest))
  select json_build_object(
    'experts', (select coalesce(json_object_agg(cat, n), '{}'::json) from (select cat, count(*) n from ans where correct and rating >= 120 group by cat) e),
    'proofs', (select count(*) from ans where qtype = 'written' and gstatus = 'done' and (grade->>'score')::numeric >= coalesce((grade->>'max')::numeric, 3)),
    'flawless', (select count(*) from mt where myright = n),
    'giant', (select count(*) from mt where won and not unrated and d >= 3),
    'comeback', (select count(*) from mt where won and exists (select 1 from match_swaps s where s.match_id = mt.id and s.user_id = auth.uid())),
    'rival', (select coalesce(max(c), 0) from (select count(*) c from mt where won and not unrated group by opp) x),
    'cats', (select count(distinct cat) from mt where won and not unrated and cat is not null),
    'wins', (select count(*) from mt where won and not unrated),
    'streak', pm_daily_streak(auth.uid()),
    'daily_perfect', (select count(*) from daily_answers where user_id = auth.uid() and gstatus = 'done' and score >= max)) $$;

revoke execute on function public.pm_rotate(), public.pm_qid(uuid, uuid, int), public.pm_max_left(uuid, uuid), public.pm_daily_streak(uuid), public.pm_start(uuid, uuid), public.pm_set_grade(uuid, uuid, integer, numeric, jsonb),
  public.pm_pick_part(numeric, integer, text, boolean, bigint[], uuid[], boolean), public.pm_pick_fill(numeric, integer, text, boolean, bigint[], uuid[]), public.pm_pick_written(numeric, text, uuid[], integer) from public, anon, authenticated;
grant execute on function public.pm_share_get(), public.pm_share_set(text, text, jsonb), public.pm_claim_source(text, text, text), public.pm_refresh_batch(int), public.pm_add_variant(bigint, jsonb),
  public.pm_comeback(uuid), public.pm_daily(), public.pm_daily_start(), public.pm_daily_submit(text), public.pm_rivals(), public.pm_h2h(uuid), public.pm_badges() to authenticated;
revoke execute on function public.pm_share_get(), public.pm_share_set(text, text, jsonb), public.pm_claim_source(text, text, text), public.pm_refresh_batch(int), public.pm_add_variant(bigint, jsonb),
  public.pm_comeback(uuid), public.pm_daily(), public.pm_daily_start(), public.pm_daily_submit(text), public.pm_rivals(), public.pm_h2h(uuid), public.pm_badges() from anon, public;
