-- tapselo.com MCP directory review: creator delete + retention cap at 30 days.
-- Apply in Chocksy/pos (source of truth for Supabase). Rollout: migration, then tapselo.com.

alter table public.public_tool_drafts
  add column if not exists delete_secret text;

update public.public_tool_drafts
   set delete_secret = encode(extensions.gen_random_bytes(24), 'base64')
 where delete_secret is null;

alter table public.public_tool_drafts
  alter column delete_secret set not null;

-- Cap any row that still expires later than 30 days after creation.
update public.public_tool_drafts
   set expires_at = created_at + interval '30 days'
 where expires_at > created_at + interval '30 days';

alter table public.public_tool_drafts
  alter column expires_at set default (now() + interval '30 days');

create or replace function public.public_tool_create_draft(p_kind text, p_payload jsonb) returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  c_drafts_per_hour constant int := 300;
  c_max_bytes       constant int := 32768;
  c_max_text        constant int := 200;
  c_max_number      constant numeric := 1000000;
  c_url_re          constant text :=
    '(https?://|www\.|://|[a-z0-9-]+\.(ro|com|net|org|eu|info|io|co|biz|xyz|ru|top)(/|\y))';
  v_list  text;
  v_max   int;
  v_id    text;
  v_secret text;
  v_tries int := 0;
begin
  if p_kind is null or p_kind not in ('flyer', 'labels', 'nir', 'recipe', 'cashbook') then
    raise exception 'Tip de document necunoscut.' using errcode = '22023';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Datele documentului lipsesc.' using errcode = '22023';
  end if;
  if octet_length(p_payload::text) > c_max_bytes then
    raise exception 'Documentul este prea mare. Trimite mai putine randuri.' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_path_query(p_payload, 'strict $.**') as v
     where jsonb_typeof(v) = 'string' and (v #>> '{}') ~* c_url_re
  ) then
    raise exception 'Textul nu poate contine adrese web sau linkuri.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_path_query(p_payload, 'strict $.**') as v
     where jsonb_typeof(v) = 'string'
       and (length(v #>> '{}') > c_max_text or (v #>> '{}') ~ '[[:cntrl:]]')
  ) then
    raise exception 'Un text este prea lung sau contine caractere nepermise (maxim % de caractere).', c_max_text
      using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_path_query(p_payload, 'strict $.**') as v
     where jsonb_typeof(v) = 'number' and (v::numeric < 0 or v::numeric > c_max_number)
  ) then
    raise exception 'Numerele trebuie sa fie intre 0 si 1.000.000.' using errcode = '22023';
  end if;

  v_list := case p_kind
              when 'flyer' then 'products' when 'labels' then 'products'
              when 'nir' then 'lines' when 'recipe' then 'ingredients'
              else 'entries' end;
  v_max := case p_kind when 'flyer' then 24 when 'labels' then 60 else 40 end;
  if p_payload ? v_list then
    if jsonb_typeof(p_payload -> v_list) <> 'array' then
      raise exception 'Lista % nu este valida.', v_list using errcode = '22023';
    end if;
    if jsonb_array_length(p_payload -> v_list) > v_max then
      raise exception 'Prea multe randuri: maxim % pentru acest document.', v_max using errcode = '22023';
    end if;
  end if;
  if p_kind = 'flyer'
     and (jsonb_typeof(p_payload -> 'products') is distinct from 'array'
          or jsonb_array_length(p_payload -> 'products') = 0) then
    raise exception 'Flyerul are nevoie de cel putin un produs.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('public_tool_create_draft'));

  if (select count(*) from public_tool_drafts where created_at > now() - interval '1 hour') >= c_drafts_per_hour then
    raise exception 'Serviciul este foarte solicitat acum. Incearca din nou peste o ora.'
      using errcode = '53400';
  end if;

  loop
    v_id := public_tool_new_id();
    v_secret := encode(extensions.gen_random_bytes(24), 'base64');
    insert into public_tool_drafts (id, kind, payload, delete_secret)
    values (v_id, p_kind, p_payload, v_secret)
    on conflict (id) do nothing;
    exit when found;
    v_tries := v_tries + 1;
    if v_tries >= 5 then
      raise exception 'Documentul nu a putut fi creat. Incearca din nou.';
    end if;
  end loop;

  return jsonb_build_object('id', v_id, 'delete_secret', v_secret);
end $$;

revoke all on function public.public_tool_create_draft(text, jsonb) from public;
grant execute on function public.public_tool_create_draft(text, jsonb) to anon, authenticated;

create or replace function public.public_tool_delete_draft(p_id text, p_delete_secret text) returns boolean
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_deleted int;
begin
  if p_id is null or p_id !~ '^[A-Za-z0-9]{10}$' then
    return false;
  end if;
  if p_delete_secret is null or length(p_delete_secret) < 16 or length(p_delete_secret) > 64 then
    return false;
  end if;
  delete from public.public_tool_drafts
   where id = p_id
     and delete_secret = p_delete_secret
     and expires_at > now();
  get diagnostics v_deleted = row_count;
  return v_deleted = 1;
end $$;

revoke all on function public.public_tool_delete_draft(text, text) from public;
grant execute on function public.public_tool_delete_draft(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
