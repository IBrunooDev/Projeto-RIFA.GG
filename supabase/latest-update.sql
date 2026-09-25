-- Rifa.GG - atualização completa e segura para instalações existentes.
-- Pode ser executada novamente. Não apaga contas, rifas ou compras.

begin;

create extension if not exists pgcrypto;

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_-]{3,24}$'),
  discount_percent integer not null check (discount_percent between 1 and 100),
  raffle_id bigint references public.raffles(id) on delete cascade,
  max_uses integer check (max_uses is null or max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  expires_at timestamptz,
  active boolean not null default true,
  created_by uuid references public.accounts(id) on delete set null,
  created_by_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Colunas usadas pela versão atual.
alter table public.raffles add column if not exists original_price integer;
alter table public.raffles add column if not exists winner_phone text;
alter table public.accounts add column if not exists player_id text;
alter table public.accounts add column if not exists phone text;
alter table public.accounts add column if not exists role text not null default 'member';
alter table public.accounts add column if not exists active boolean not null default true;
alter table public.accounts add column if not exists updated_at timestamptz not null default now();
alter table public.accounts add column if not exists recovery_code_hash text;
alter table public.accounts add column if not exists recovery_failed_attempts integer not null default 0;
alter table public.accounts add column if not exists recovery_locked_until timestamptz;
alter table public.accounts add column if not exists login_failed_attempts integer not null default 0;
alter table public.accounts add column if not exists login_locked_until timestamptz;
alter table public.accounts add column if not exists session_version integer not null default 1;
alter table public.purchases add column if not exists account_id uuid references public.accounts(id) on delete set null;
alter table public.purchases add column if not exists buyer_phone text;
alter table public.purchases add column if not exists reviewed_by_id uuid references public.accounts(id) on delete set null;
alter table public.purchases add column if not exists subtotal_value bigint;
alter table public.purchases add column if not exists discount_percent integer not null default 0;
alter table public.purchases add column if not exists coupon_id uuid references public.coupons(id) on delete set null;
alter table public.purchases add column if not exists coupon_code text;
alter table public.raffle_numbers add column if not exists buyer_phone text;
alter table public.purchases alter column total_value type bigint using total_value::bigint;
update public.purchases set subtotal_value = total_value where subtotal_value is null;
alter table public.purchases alter column subtotal_value set not null;

-- Corrige valores antigos antes de aplicar as regras.
update public.raffles set original_price = null where original_price is not null and original_price <= price;
update public.accounts set role = 'member' where role not in ('owner', 'admin', 'sponsor', 'member') or role is null;
update public.accounts set recovery_failed_attempts = 0 where recovery_failed_attempts is null or recovery_failed_attempts < 0;
update public.accounts set login_failed_attempts = 0 where login_failed_attempts is null or login_failed_attempts < 0;
update public.accounts set session_version = 1 where session_version is null or session_version < 1;
update public.accounts set phone = null where phone is not null and phone !~ '^[0-9]{1,6}$';

alter table public.raffles drop constraint if exists raffles_original_price_check;
alter table public.raffles add constraint raffles_original_price_check check (original_price is null or original_price > price);
alter table public.raffles drop constraint if exists raffles_winner_phone_check;
alter table public.raffles add constraint raffles_winner_phone_check check (winner_phone is null or winner_phone ~ '^[0-9]{1,6}$');
alter table public.purchases drop constraint if exists purchases_buyer_phone_check;
alter table public.purchases add constraint purchases_buyer_phone_check check (buyer_phone is null or buyer_phone ~ '^[0-9]{1,6}$');
alter table public.raffle_numbers drop constraint if exists raffle_numbers_buyer_phone_check;
alter table public.raffle_numbers add constraint raffle_numbers_buyer_phone_check check (buyer_phone is null or buyer_phone ~ '^[0-9]{1,6}$');
alter table public.accounts drop constraint if exists accounts_role_check;
alter table public.accounts add constraint accounts_role_check check (role in ('owner', 'admin', 'sponsor', 'member'));
alter table public.accounts drop constraint if exists accounts_phone_check;
alter table public.accounts add constraint accounts_phone_check check (phone is null or phone ~ '^[0-9]{1,6}$');
alter table public.accounts drop constraint if exists accounts_login_failed_attempts_check;
alter table public.accounts add constraint accounts_login_failed_attempts_check check (login_failed_attempts >= 0);
alter table public.accounts drop constraint if exists accounts_session_version_check;
alter table public.accounts add constraint accounts_session_version_check check (session_version > 0);
alter table public.purchases drop constraint if exists purchases_discount_percent_check;
alter table public.purchases add constraint purchases_discount_percent_check check (discount_percent between 0 and 100);
alter table public.purchases drop constraint if exists purchases_subtotal_value_check;
alter table public.purchases add constraint purchases_subtotal_value_check check (subtotal_value >= 0);
alter table public.purchases drop constraint if exists purchases_total_value_consistency_check;
alter table public.purchases add constraint purchases_total_value_consistency_check check (total_value >= 0 and total_value <= subtotal_value);

-- Garante que exista um Dono e apenas uma rifa ativa.
with first_manager as (
  select id from public.accounts
  where role in ('admin', 'sponsor')
  order by case role when 'admin' then 0 else 1 end, created_at asc
  limit 1
)
update public.accounts set role = 'owner', updated_at = now()
where id = (select id from first_manager)
  and not exists (select 1 from public.accounts where role = 'owner');

with ranked_active as (
  select id, row_number() over (order by created_at desc, id desc) as position
  from public.raffles where status = 'active'
)
update public.raffles set status = 'draft'
where id in (select id from ranked_active where position > 1);

create unique index if not exists accounts_username_unique on public.accounts (lower(username));
create unique index if not exists raffles_one_active on public.raffles ((status)) where status = 'active';
create index if not exists purchases_account_created_idx on public.purchases (account_id, created_at desc);
create index if not exists purchases_status_created_idx on public.purchases (status, created_at desc);
create index if not exists raffle_numbers_raffle_status_idx on public.raffle_numbers (raffle_id, status);
create index if not exists coupons_active_code_idx on public.coupons (active, code);
create index if not exists purchases_coupon_status_idx on public.purchases (coupon_id, status);
create unique index if not exists purchases_coupon_account_active_unique on public.purchases (coupon_id, account_id)
where coupon_id is not null and account_id is not null and status in ('pending', 'approved');

create or replace function public.sync_coupon_used_count()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_old_coupon uuid; v_new_coupon uuid;
begin
  v_old_coupon := case when tg_op in ('UPDATE', 'DELETE') then old.coupon_id else null end;
  v_new_coupon := case when tg_op in ('INSERT', 'UPDATE') then new.coupon_id else null end;
  if v_old_coupon is not null then
    update coupons set used_count = (select count(*) from purchases where coupon_id = v_old_coupon and status in ('pending', 'approved')), updated_at = now() where id = v_old_coupon;
  end if;
  if v_new_coupon is not null then
    update coupons set used_count = (select count(*) from purchases where coupon_id = v_new_coupon and status in ('pending', 'approved')), updated_at = now() where id = v_new_coupon;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end; $$;

drop trigger if exists purchases_sync_coupon_count on public.purchases;
create trigger purchases_sync_coupon_count after insert or update of status, coupon_id or delete on public.purchases
for each row execute function public.sync_coupon_used_count();

update public.coupons c set used_count = (
  select count(*) from public.purchases p where p.coupon_id = c.id and p.status in ('pending', 'approved')
);

-- Remove assinaturas antigas para não deixar funções inseguras disponíveis.
drop function if exists public.create_reservation(bigint, uuid, text, text, integer[]);
drop function if exists public.create_reservation(bigint, text, text, integer[]);
drop function if exists public.create_reservation(bigint, uuid, text, text, text, integer[]);
drop function if exists public.review_purchase(uuid, text);
drop function if exists public.register_manual_sale(bigint, text, text, integer[]);
drop function if exists public.register_manual_sale(bigint, text, text, text, integer[]);
drop function if exists public.get_account_for_auth(text);

-- Busca exata e sem curingas para login e recuperação de senha.
create function public.get_account_for_auth(p_username text)
returns table (
  id uuid,
  username text,
  password_hash text,
  player_id text,
  role text,
  active boolean,
  recovery_code_hash text,
  recovery_failed_attempts integer,
  recovery_locked_until timestamptz,
  login_failed_attempts integer,
  login_locked_until timestamptz,
  session_version integer
) language sql stable security definer set search_path = public as $$
  select a.id, a.username, a.password_hash, a.player_id, a.role, a.active,
         a.recovery_code_hash, a.recovery_failed_attempts, a.recovery_locked_until,
         a.login_failed_attempts, a.login_locked_until, a.session_version
  from accounts a
  where lower(a.username) = lower(trim(p_username))
  limit 1;
$$;

create or replace function public.record_login_failure(p_account_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_attempts integer; v_locked_until timestamptz;
begin
  select login_failed_attempts, login_locked_until into v_attempts, v_locked_until from accounts where id = p_account_id for update;
  if not found then return jsonb_build_object('locked', false, 'lockedUntil', null); end if;
  if v_locked_until is not null and v_locked_until > now() then return jsonb_build_object('locked', true, 'lockedUntil', v_locked_until); end if;
  v_attempts := coalesce(v_attempts, 0) + 1;
  if v_attempts >= 8 then
    v_locked_until := now() + interval '15 minutes';
    update accounts set login_failed_attempts = 0, login_locked_until = v_locked_until, updated_at = now() where id = p_account_id;
    return jsonb_build_object('locked', true, 'lockedUntil', v_locked_until);
  end if;
  update accounts set login_failed_attempts = v_attempts, login_locked_until = null, updated_at = now() where id = p_account_id;
  return jsonb_build_object('locked', false, 'lockedUntil', null);
end; $$;

create or replace function public.clear_login_failures(p_account_id uuid)
returns void language sql security definer set search_path = public as $$
  update accounts set login_failed_attempts = 0, login_locked_until = null, updated_at = now() where id = p_account_id;
$$;

create or replace function public.record_recovery_failure(p_account_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_attempts integer; v_locked_until timestamptz;
begin
  select recovery_failed_attempts, recovery_locked_until into v_attempts, v_locked_until from accounts where id = p_account_id for update;
  if not found then return jsonb_build_object('locked', false, 'lockedUntil', null); end if;
  if v_locked_until is not null and v_locked_until > now() then return jsonb_build_object('locked', true, 'lockedUntil', v_locked_until); end if;
  v_attempts := coalesce(v_attempts, 0) + 1;
  if v_attempts >= 5 then
    v_locked_until := now() + interval '15 minutes';
    update accounts set recovery_failed_attempts = 0, recovery_locked_until = v_locked_until, updated_at = now() where id = p_account_id;
    return jsonb_build_object('locked', true, 'lockedUntil', v_locked_until);
  end if;
  update accounts set recovery_failed_attempts = v_attempts, recovery_locked_until = null, updated_at = now() where id = p_account_id;
  return jsonb_build_object('locked', false, 'lockedUntil', null);
end; $$;

create or replace function public.apply_recovered_password(p_account_id uuid, p_password_hash text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if length(coalesce(p_password_hash, '')) < 20 then raise exception 'Senha protegida inválida'; end if;
  update accounts set password_hash = p_password_hash, recovery_failed_attempts = 0, recovery_locked_until = null,
    login_failed_attempts = 0, login_locked_until = null, session_version = session_version + 1, updated_at = now()
  where id = p_account_id and active = true;
  if not found then raise exception 'Conta não encontrada ou bloqueada'; end if;
end; $$;

-- Resumo agregado evita estatísticas incompletas pelo limite padrão da API.
create or replace function public.get_admin_overview_summary()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'raffleCounts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'raffleId', r.id,
        'sold', (select count(*) from raffle_numbers n where n.raffle_id = r.id and n.status = 'sold'),
        'reserved', (select count(*) from raffle_numbers n where n.raffle_id = r.id and n.status = 'reserved')
      ) order by r.id desc)
      from raffles r
    ), '[]'::jsonb),
    'stats', jsonb_build_object(
      'active', (select count(*) from raffles where status = 'active'),
      'pending', (select count(*) from purchases where status = 'pending'),
      'soldNumbers', (select count(*) from raffle_numbers where status = 'sold'),
      'players', (select count(distinct buyer_game_id) from purchases)
    )
  );
$$;

-- Estatísticas completas de uma rifa para o painel administrativo.
create or replace function public.get_raffle_statistics(p_raffle_id bigint, p_actor_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_statistics jsonb;
begin
  if not exists (
    select 1 from accounts
    where id = p_actor_id and role in ('owner', 'admin', 'sponsor') and active = true
  ) then raise exception 'Responsável inválido'; end if;

  if not exists (select 1 from raffles where id = p_raffle_id) then
    raise exception 'Rifa não encontrada';
  end if;

  select jsonb_build_object(
    'sold', (select count(*) from raffle_numbers n where n.raffle_id = r.id and n.status = 'sold'),
    'reserved', (select count(*) from raffle_numbers n where n.raffle_id = r.id and n.status = 'reserved'),
    'free', (select count(*) from raffle_numbers n where n.raffle_id = r.id and n.status = 'available'),
    'totalNumbers', r.total_numbers,
    'totalConfirmed', (select coalesce(sum(p.total_value), 0) from purchases p where p.raffle_id = r.id and p.status = 'approved'),
    'dailySales', (
      select coalesce(jsonb_agg(jsonb_build_object('date', to_char(days.day, 'YYYY-MM-DD'), 'count', days.sold) order by days.day), '[]'::jsonb)
      from (
        select series.day::date as day,
          coalesce((
            select sum(cardinality(p.numbers))
            from purchases p
            where p.raffle_id = r.id and p.status = 'approved'
              and p.created_at >= series.day and p.created_at < series.day + interval '1 day'
          ), 0) as sold
        from generate_series(current_date - 6, current_date, interval '1 day') as series(day)
      ) days
    ),
    'freeNumbers', (
      select coalesce(jsonb_agg(n.number order by n.number), '[]'::jsonb)
      from raffle_numbers n where n.raffle_id = r.id and n.status = 'available'
    )
  ) into v_statistics
  from raffles r where r.id = p_raffle_id;

  return v_statistics;
end; $$;

drop function if exists public.create_raffle(text, text, integer, integer, date, text);

create or replace function public.create_raffle(
  p_title text,
  p_description text,
  p_price integer,
  p_total_numbers integer,
  p_drawing_date date,
  p_image_url text,
  p_actor_id uuid,
  p_actor text
) returns bigint language plpgsql security definer set search_path = public as $$
declare v_raffle_id bigint;
begin
  if not exists (select 1 from accounts where id = p_actor_id and role in ('owner', 'admin', 'sponsor') and active = true) then raise exception 'Responsável inválido'; end if;
  if length(trim(p_title)) not between 2 and 100 then raise exception 'O título deve ter de 2 a 100 caracteres'; end if;
  if length(trim(p_description)) not between 3 and 2000 then raise exception 'A descrição deve ter de 3 a 2.000 caracteres'; end if;
  if p_price is null or p_price < 1 or p_total_numbers < 10 or p_total_numbers > 500 or p_drawing_date is null then raise exception 'Valor, quantidade ou data inválidos'; end if;
  perform id from raffles where status = 'active' for update;
  if exists (
    select 1 from purchases p join raffles r on r.id = p.raffle_id
    where r.status = 'active' and p.status = 'pending'
  ) then raise exception 'Aprove ou recuse as compras pendentes antes de criar outra rifa'; end if;
  update raffles set status = 'draft' where status = 'active';
  insert into raffles (title, description, price, total_numbers, drawing_date, image_url, status)
  values (trim(p_title), trim(p_description), p_price, p_total_numbers, p_drawing_date, nullif(trim(coalesce(p_image_url, '')), ''), 'active')
  returning id into v_raffle_id;
  insert into raffle_numbers (raffle_id, number) select v_raffle_id, value from generate_series(1, p_total_numbers) as value;
  insert into audit_logs (event, actor, details) values ('raffle_created', trim(p_actor), jsonb_build_object('raffle_id', v_raffle_id, 'actor_id', p_actor_id));
  return v_raffle_id;
end; $$;

create or replace function public.validate_coupon(
  p_code text, p_raffle_id bigint, p_account_id uuid, p_number_count integer
) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_coupon coupons%rowtype; v_price integer; v_subtotal bigint; v_discount bigint; v_total bigint;
begin
  if p_number_count is null or p_number_count not between 1 and 500 then raise exception 'Selecione os números antes de aplicar o cupom'; end if;
  select price into v_price from raffles where id = p_raffle_id and status = 'active';
  if v_price is null then raise exception 'Rifa não está aberta'; end if;
  select * into v_coupon from coupons where code = upper(trim(coalesce(p_code, ''))) and active = true;
  if v_coupon.id is null then raise exception 'Cupom inválido ou desativado'; end if;
  if v_coupon.expires_at is not null and v_coupon.expires_at <= now() then raise exception 'Este cupom expirou'; end if;
  if v_coupon.raffle_id is not null and v_coupon.raffle_id <> p_raffle_id then raise exception 'Este cupom não vale para esta rifa'; end if;
  if v_coupon.max_uses is not null and v_coupon.used_count >= v_coupon.max_uses then raise exception 'Este cupom atingiu o limite de usos'; end if;
  if exists (select 1 from purchases where coupon_id = v_coupon.id and account_id = p_account_id and status in ('pending', 'approved')) then raise exception 'Você já utilizou este cupom'; end if;
  if not exists (select 1 from accounts where id = p_account_id and role = 'member' and active = true) then raise exception 'Conta de membro inválida'; end if;
  v_subtotal := v_price::bigint * p_number_count;
  v_discount := floor(v_subtotal::numeric * v_coupon.discount_percent / 100)::bigint;
  v_total := greatest(0, v_subtotal - v_discount);
  return jsonb_build_object('code', v_coupon.code, 'discountPercent', v_coupon.discount_percent, 'subtotal', v_subtotal, 'discountValue', v_discount, 'total', v_total);
end; $$;

create or replace function public.create_coupon(
  p_code text, p_discount_percent integer, p_raffle_id bigint, p_max_uses integer,
  p_expires_at timestamptz, p_actor_id uuid, p_actor text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_code text := upper(trim(coalesce(p_code, '')));
begin
  if not exists (select 1 from accounts where id = p_actor_id and role in ('owner', 'admin', 'sponsor') and active = true) then raise exception 'Responsável inválido'; end if;
  if v_code !~ '^[A-Z0-9_-]{3,24}$' then raise exception 'Código de cupom inválido'; end if;
  if p_discount_percent is null or p_discount_percent not between 1 and 100 then raise exception 'O desconto deve ser de 1%% a 100%%'; end if;
  if p_max_uses is not null and p_max_uses < 1 then raise exception 'O limite de usos deve ser positivo'; end if;
  if p_expires_at is not null and p_expires_at <= now() then raise exception 'A validade precisa ser uma data futura'; end if;
  if p_raffle_id is not null and not exists (select 1 from raffles where id = p_raffle_id) then raise exception 'Rifa não encontrada'; end if;
  insert into coupons (code, discount_percent, raffle_id, max_uses, expires_at, created_by, created_by_name)
  values (v_code, p_discount_percent, p_raffle_id, p_max_uses, p_expires_at, p_actor_id, trim(p_actor)) returning id into v_id;
  insert into audit_logs (event, actor, details) values ('coupon_created', trim(p_actor), jsonb_build_object('coupon_id', v_id, 'code', v_code, 'discount_percent', p_discount_percent));
  return v_id;
end; $$;

create or replace function public.set_coupon_active(
  p_coupon_id uuid, p_active boolean, p_actor_id uuid, p_actor text
) returns text language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if not exists (select 1 from accounts where id = p_actor_id and role in ('owner', 'admin', 'sponsor') and active = true) then raise exception 'Responsável inválido'; end if;
  if p_active is null then raise exception 'Estado do cupom inválido'; end if;
  update coupons set active = p_active, updated_at = now() where id = p_coupon_id returning code into v_code;
  if v_code is null then raise exception 'Cupom não encontrado'; end if;
  insert into audit_logs (event, actor, details) values (case when p_active then 'coupon_activated' else 'coupon_deactivated' end, trim(p_actor), jsonb_build_object('coupon_id', p_coupon_id, 'code', v_code));
  return v_code;
end; $$;

create or replace function public.delete_coupon(
  p_coupon_id uuid, p_actor_id uuid, p_actor text
) returns text language plpgsql security definer set search_path = public as $$
declare v_code text; v_discount integer; v_used_count integer;
begin
  if not exists (select 1 from accounts where id = p_actor_id and role in ('owner', 'admin', 'sponsor') and active = true) then raise exception 'Responsável inválido'; end if;
  select code, discount_percent, used_count into v_code, v_discount, v_used_count from coupons where id = p_coupon_id for update;
  if v_code is null then raise exception 'Cupom não encontrado'; end if;
  delete from coupons where id = p_coupon_id;
  insert into audit_logs (event, actor, details) values ('coupon_deleted', trim(p_actor), jsonb_build_object('coupon_id', p_coupon_id, 'code', v_code, 'discount_percent', v_discount, 'used_count', v_used_count, 'actor_id', p_actor_id));
  return v_code;
end; $$;

create or replace function public.create_reservation(
  p_raffle_id bigint, p_account_id uuid, p_buyer_name text, p_buyer_game_id text,
  p_buyer_phone text, p_numbers integer[], p_coupon_code text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_purchase_id uuid := gen_random_uuid(); v_price integer; v_available integer; v_subtotal bigint; v_total bigint; v_discount integer := 0; v_coupon coupons%rowtype;
begin
  select price into v_price from raffles where id = p_raffle_id and status = 'active' for update;
  if v_price is null then raise exception 'Rifa não está aberta'; end if;
  if length(trim(coalesce(p_buyer_name, ''))) not between 2 and 50 then raise exception 'O nome do jogador deve ter de 2 a 50 caracteres'; end if;
  if length(trim(coalesce(p_buyer_game_id, ''))) not between 1 and 50 then raise exception 'O ID do jogador deve ter de 1 a 50 caracteres'; end if;
  if trim(coalesce(p_buyer_phone, '')) !~ '^[0-9]{1,6}$' then raise exception 'O telefone no jogo deve ter de 1 a 6 dígitos'; end if;
  if coalesce(cardinality(p_numbers), 0) not between 1 and 500 then raise exception 'Escolha de 1 a 500 números'; end if;
  if cardinality(p_numbers) <> (select count(distinct selected_number) from unnest(p_numbers) as chosen(selected_number)) then raise exception 'Não repita números na mesma compra'; end if;
  perform id from raffle_numbers where raffle_id = p_raffle_id and number = any(p_numbers) order by id for update;
  select count(*) into v_available from raffle_numbers where raffle_id = p_raffle_id and number = any(p_numbers) and status = 'available';
  if v_available <> cardinality(p_numbers) then raise exception 'Um ou mais números estão indisponíveis'; end if;
  if not exists (select 1 from accounts where id = p_account_id and role = 'member' and active = true) then raise exception 'Entre na sua conta de membro para reservar'; end if;
  v_subtotal := v_price::bigint * cardinality(p_numbers);
  v_total := v_subtotal;
  if nullif(trim(coalesce(p_coupon_code, '')), '') is not null then
    select * into v_coupon from coupons where code = upper(trim(p_coupon_code)) for update;
    if v_coupon.id is null or not v_coupon.active then raise exception 'Cupom inválido ou desativado'; end if;
    if v_coupon.expires_at is not null and v_coupon.expires_at <= now() then raise exception 'Este cupom expirou'; end if;
    if v_coupon.raffle_id is not null and v_coupon.raffle_id <> p_raffle_id then raise exception 'Este cupom não vale para esta rifa'; end if;
    if v_coupon.max_uses is not null and v_coupon.used_count >= v_coupon.max_uses then raise exception 'Este cupom atingiu o limite de usos'; end if;
    if exists (select 1 from purchases where coupon_id = v_coupon.id and account_id = p_account_id and status in ('pending', 'approved')) then raise exception 'Você já utilizou este cupom'; end if;
    v_discount := v_coupon.discount_percent;
    v_total := greatest(0, v_subtotal - floor(v_subtotal::numeric * v_discount / 100)::bigint);
  end if;
  insert into purchases (id, raffle_id, account_id, buyer_name, buyer_game_id, buyer_phone, numbers, subtotal_value, total_value, discount_percent, coupon_id, coupon_code)
  values (v_purchase_id, p_raffle_id, p_account_id, trim(p_buyer_name), trim(p_buyer_game_id), trim(p_buyer_phone), p_numbers, v_subtotal, v_total, v_discount, v_coupon.id, v_coupon.code);
  update raffle_numbers set status = 'reserved', buyer_name = trim(p_buyer_name), buyer_game_id = trim(p_buyer_game_id), buyer_phone = trim(p_buyer_phone), purchase_id = v_purchase_id, updated_at = now()
  where raffle_id = p_raffle_id and number = any(p_numbers) and status = 'available';
  insert into audit_logs (event, actor, details) values ('reservation_requested', trim(p_buyer_game_id), jsonb_build_object('purchase_id', v_purchase_id, 'coupon_code', v_coupon.code, 'discount_percent', v_discount));
  return v_purchase_id;
end; $$;

create or replace function public.review_purchase(
  p_purchase_id uuid,
  p_action text,
  p_actor_id uuid,
  p_actor text
) returns text language plpgsql security definer set search_path = public as $$
declare v_status text; v_raffle_id bigint; v_raffle_status text;
begin
  if p_action not in ('approve', 'reject') then raise exception 'Ação inválida'; end if;
  if not exists (select 1 from accounts where id = p_actor_id and role in ('owner', 'admin', 'sponsor') and active = true) then raise exception 'Responsável inválido'; end if;
  select raffle_id into v_raffle_id from purchases where id = p_purchase_id and status = 'pending' for update;
  if v_raffle_id is null then raise exception 'Pedido não encontrado ou já analisado'; end if;
  if p_action = 'approve' then
    select status into v_raffle_status from raffles where id = v_raffle_id for update;
    if v_raffle_status <> 'active' then raise exception 'Não é possível aprovar uma compra de uma rifa encerrada ou em rascunho'; end if;
  end if;
  v_status := case when p_action = 'approve' then 'approved' else 'rejected' end;
  update purchases set status = v_status, reviewed_at = now(), reviewed_by = trim(p_actor), reviewed_by_id = p_actor_id
  where id = p_purchase_id and status = 'pending';
  if p_action = 'approve' then
    update raffle_numbers set status = 'sold', updated_at = now() where purchase_id = p_purchase_id;
  else
    update raffle_numbers set status = 'available', buyer_name = null, buyer_game_id = null, buyer_phone = null, purchase_id = null, updated_at = now() where purchase_id = p_purchase_id;
  end if;
  insert into audit_logs (event, actor, details) values ('purchase_' || v_status, trim(p_actor), jsonb_build_object('purchase_id', p_purchase_id, 'actor_id', p_actor_id));
  return v_status;
end; $$;

create or replace function public.register_manual_sale(
  p_raffle_id bigint,
  p_buyer_name text,
  p_buyer_game_id text,
  p_buyer_phone text,
  p_numbers integer[],
  p_actor_id uuid,
  p_actor text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_purchase_id uuid := gen_random_uuid(); v_price integer; v_available integer;
begin
  select price into v_price from raffles where id = p_raffle_id and status = 'active' for update;
  if v_price is null then raise exception 'Rifa ativa não encontrada'; end if;
  if not exists (select 1 from accounts where id = p_actor_id and role in ('owner', 'admin') and active = true) then raise exception 'Administrador inválido'; end if;
  if length(trim(coalesce(p_buyer_name, ''))) not between 2 and 50 then raise exception 'O nome do jogador deve ter de 2 a 50 caracteres'; end if;
  if length(trim(coalesce(p_buyer_game_id, ''))) not between 1 and 50 then raise exception 'O ID do jogador deve ter de 1 a 50 caracteres'; end if;
  if trim(coalesce(p_buyer_phone, '')) !~ '^[0-9]{1,6}$' then raise exception 'O telefone no jogo deve ter de 1 a 6 dígitos'; end if;
  if coalesce(cardinality(p_numbers), 0) not between 1 and 500 then raise exception 'Informe de 1 a 500 números'; end if;
  if cardinality(p_numbers) <> (select count(distinct selected_number) from unnest(p_numbers) as chosen(selected_number)) then raise exception 'Não repita números na mesma compra'; end if;
  perform id from raffle_numbers where raffle_id = p_raffle_id and number = any(p_numbers) order by id for update;
  select count(*) into v_available from raffle_numbers where raffle_id = p_raffle_id and number = any(p_numbers) and status = 'available';
  if v_available <> cardinality(p_numbers) then raise exception 'Um ou mais números estão indisponíveis'; end if;
  insert into purchases (id, raffle_id, buyer_name, buyer_game_id, buyer_phone, numbers, subtotal_value, total_value, status, reviewed_at, reviewed_by, reviewed_by_id)
  values (v_purchase_id, p_raffle_id, trim(p_buyer_name), trim(p_buyer_game_id), trim(p_buyer_phone), p_numbers, v_price::bigint * cardinality(p_numbers), v_price::bigint * cardinality(p_numbers), 'approved', now(), trim(p_actor), p_actor_id);
  update raffle_numbers set status = 'sold', buyer_name = trim(p_buyer_name), buyer_game_id = trim(p_buyer_game_id), buyer_phone = trim(p_buyer_phone), purchase_id = v_purchase_id, updated_at = now()
  where raffle_id = p_raffle_id and number = any(p_numbers) and status = 'available';
  insert into audit_logs (event, actor, details) values ('manual_sale_registered', trim(p_actor), jsonb_build_object('purchase_id', v_purchase_id, 'actor_id', p_actor_id));
  return v_purchase_id;
end; $$;

drop function if exists public.draw_raffle(bigint);

create or replace function public.draw_raffle(p_raffle_id bigint, p_actor_id uuid, p_actor text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_winner raffle_numbers%rowtype; v_title text;
begin
  if not exists (select 1 from accounts where id = p_actor_id and role in ('owner', 'admin') and active = true) then raise exception 'Administrador inválido'; end if;
  select title into v_title from raffles where id = p_raffle_id and status = 'active' for update;
  if v_title is null then raise exception 'Rifa ativa não encontrada'; end if;
  if exists (select 1 from purchases where raffle_id = p_raffle_id and status = 'pending') then raise exception 'Aprove ou recuse todas as compras pendentes antes do sorteio'; end if;
  select * into v_winner from raffle_numbers where raffle_id = p_raffle_id and status = 'sold' order by gen_random_bytes(16) limit 1;
  if v_winner.id is null then raise exception 'Registre ou aprove pelo menos uma compra antes do sorteio'; end if;
  update raffles set status = 'completed', winner_number = v_winner.number, winner_name = v_winner.buyer_name, winner_game_id = v_winner.buyer_game_id, winner_phone = v_winner.buyer_phone where id = p_raffle_id;
  insert into audit_logs (event, actor, details) values ('winner_drawn', trim(p_actor), jsonb_build_object('raffle_id', p_raffle_id, 'number', v_winner.number, 'actor_id', p_actor_id));
  return jsonb_build_object('raffleId', p_raffle_id, 'title', v_title, 'number', v_winner.number, 'name', v_winner.buyer_name, 'gameId', v_winner.buyer_game_id, 'phone', v_winner.buyer_phone);
end; $$;

drop function if exists public.reset_raffle(bigint, text);

create or replace function public.reset_raffle(p_raffle_id bigint, p_actor_id uuid, p_actor text)
returns void language plpgsql security definer set search_path = public as $$
declare v_title text;
begin
  if not exists (select 1 from accounts where id = p_actor_id and role = 'owner' and active = true) then raise exception 'Somente o Dono pode resetar rifas'; end if;
  select title into v_title from raffles where id = p_raffle_id for update;
  if v_title is null then raise exception 'Rifa não encontrada'; end if;
  update raffles set status = 'draft' where status = 'active' and id <> p_raffle_id;
  delete from purchases where raffle_id = p_raffle_id;
  update raffle_numbers set status = 'available', buyer_name = null, buyer_game_id = null, buyer_phone = null, purchase_id = null, updated_at = now() where raffle_id = p_raffle_id;
  update raffles set status = 'active', winner_number = null, winner_name = null, winner_game_id = null, winner_phone = null where id = p_raffle_id;
  insert into audit_logs (event, actor, details) values ('raffle_reset', trim(p_actor), jsonb_build_object('raffle_id', p_raffle_id, 'title', v_title, 'actor_id', p_actor_id));
end; $$;

-- Remove a função antiga de preço isolado. A edição atual usa
-- update_raffle_details, que também valida a identidade e o cargo do responsável.
drop function if exists public.update_raffle_price(bigint, integer, text);

create or replace function public.update_raffle_details(
  p_raffle_id bigint, p_title text, p_price integer, p_drawing_date date,
  p_image_url text, p_actor_id uuid, p_actor text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_old_title text; v_status text; v_old_price integer; v_original_price integer; v_new_original_price integer; v_image_url text;
begin
  if not exists (select 1 from accounts where id = p_actor_id and role in ('owner', 'admin', 'sponsor') and active = true) then raise exception 'Responsável inválido'; end if;
  if length(trim(coalesce(p_title, ''))) not between 2 and 100 then raise exception 'O título deve ter de 2 a 100 caracteres'; end if;
  if p_price is null or p_price < 1 or p_drawing_date is null then raise exception 'Valor ou data inválidos'; end if;
  select title, status, price, original_price into v_old_title, v_status, v_old_price, v_original_price from raffles where id = p_raffle_id for update;
  if v_old_title is null then raise exception 'Rifa não encontrada'; end if;
  if v_status not in ('active', 'draft') then raise exception 'Somente rifas ativas ou em rascunho podem ser editadas'; end if;
  v_new_original_price := v_original_price;
  if p_price < v_old_price and (v_new_original_price is null or v_new_original_price <= p_price) then v_new_original_price := v_old_price; end if;
  if v_new_original_price is not null and p_price >= v_new_original_price then v_new_original_price := null; end if;
  v_image_url := nullif(trim(coalesce(p_image_url, '')), '');
  update raffles set title = trim(p_title), price = p_price, original_price = v_new_original_price, drawing_date = p_drawing_date, image_url = v_image_url where id = p_raffle_id;
  insert into audit_logs (event, actor, details) values ('raffle_updated', trim(p_actor), jsonb_build_object('raffle_id', p_raffle_id, 'old_title', v_old_title, 'new_title', trim(p_title), 'old_price', v_old_price, 'new_price', p_price, 'actor_id', p_actor_id));
  return jsonb_build_object('title', trim(p_title), 'price', p_price, 'originalPrice', v_new_original_price, 'drawingDate', p_drawing_date, 'imageUrl', v_image_url);
end; $$;

drop function if exists public.delete_raffle(bigint, text);

create or replace function public.delete_raffle(p_raffle_id bigint, p_actor_id uuid, p_actor text)
returns void language plpgsql security definer set search_path = public as $$
declare v_title text; v_status text; v_next_id bigint;
begin
  if not exists (select 1 from accounts where id = p_actor_id and role = 'owner' and active = true) then raise exception 'Somente o Dono pode excluir rifas'; end if;
  select title, status into v_title, v_status from raffles where id = p_raffle_id for update;
  if v_title is null then raise exception 'Rifa não encontrada'; end if;
  delete from raffles where id = p_raffle_id;
  if v_status = 'active' then
    select id into v_next_id from raffles where status = 'draft' order by created_at desc limit 1;
    if v_next_id is not null then update raffles set status = 'active' where id = v_next_id; end if;
  end if;
  insert into audit_logs (event, actor, details) values ('raffle_deleted', trim(p_actor), jsonb_build_object('raffle_id', p_raffle_id, 'title', v_title, 'actor_id', p_actor_id));
end; $$;

-- Apenas o servidor com service_role pode executar funções sensíveis.
revoke execute on function public.get_account_for_auth(text) from public, anon, authenticated;
revoke execute on function public.record_login_failure(uuid) from public, anon, authenticated;
revoke execute on function public.clear_login_failures(uuid) from public, anon, authenticated;
revoke execute on function public.record_recovery_failure(uuid) from public, anon, authenticated;
revoke execute on function public.apply_recovered_password(uuid, text) from public, anon, authenticated;
revoke execute on function public.get_admin_overview_summary() from public, anon, authenticated;
revoke execute on function public.get_raffle_statistics(bigint, uuid) from public, anon, authenticated;
revoke execute on function public.create_raffle(text, text, integer, integer, date, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.validate_coupon(text, bigint, uuid, integer) from public, anon, authenticated;
revoke execute on function public.create_coupon(text, integer, bigint, integer, timestamptz, uuid, text) from public, anon, authenticated;
revoke execute on function public.set_coupon_active(uuid, boolean, uuid, text) from public, anon, authenticated;
revoke execute on function public.delete_coupon(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.create_reservation(bigint, uuid, text, text, text, integer[], text) from public, anon, authenticated;
revoke execute on function public.review_purchase(uuid, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.register_manual_sale(bigint, text, text, text, integer[], uuid, text) from public, anon, authenticated;
revoke execute on function public.draw_raffle(bigint, uuid, text) from public, anon, authenticated;
revoke execute on function public.reset_raffle(bigint, uuid, text) from public, anon, authenticated;
revoke execute on function public.update_raffle_details(bigint, text, integer, date, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.delete_raffle(bigint, uuid, text) from public, anon, authenticated;

grant execute on function public.get_account_for_auth(text) to service_role;
grant execute on function public.record_login_failure(uuid) to service_role;
grant execute on function public.clear_login_failures(uuid) to service_role;
grant execute on function public.record_recovery_failure(uuid) to service_role;
grant execute on function public.apply_recovered_password(uuid, text) to service_role;
grant execute on function public.get_admin_overview_summary() to service_role;
grant execute on function public.get_raffle_statistics(bigint, uuid) to service_role;
grant execute on function public.create_raffle(text, text, integer, integer, date, text, uuid, text) to service_role;
grant execute on function public.validate_coupon(text, bigint, uuid, integer) to service_role;
grant execute on function public.create_coupon(text, integer, bigint, integer, timestamptz, uuid, text) to service_role;
grant execute on function public.set_coupon_active(uuid, boolean, uuid, text) to service_role;
grant execute on function public.delete_coupon(uuid, uuid, text) to service_role;
grant execute on function public.create_reservation(bigint, uuid, text, text, text, integer[], text) to service_role;
grant execute on function public.review_purchase(uuid, text, uuid, text) to service_role;
grant execute on function public.register_manual_sale(bigint, text, text, text, integer[], uuid, text) to service_role;
grant execute on function public.draw_raffle(bigint, uuid, text) to service_role;
grant execute on function public.reset_raffle(bigint, uuid, text) to service_role;
grant execute on function public.update_raffle_details(bigint, text, integer, date, text, uuid, text) to service_role;
grant execute on function public.delete_raffle(bigint, uuid, text) to service_role;

alter table public.raffles enable row level security;
alter table public.accounts enable row level security;
alter table public.purchases enable row level security;
alter table public.raffle_numbers enable row level security;
alter table public.audit_logs enable row level security;
alter table public.coupons enable row level security;

insert into storage.buckets (id, name, public)
values ('raffle-images', 'raffle-images', true)
on conflict (id) do update set public = true;

-- Garante que o sorteio encontre pgcrypto no schema usado pelo Supabase.
do $correcao_sorteio$
declare v_schema text; v_bytes integer;
begin
  select n.nspname into v_schema
  from pg_catalog.pg_extension e
  join pg_catalog.pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'pgcrypto';
  if v_schema is null then raise exception 'A extensão pgcrypto não foi encontrada'; end if;
  execute pg_catalog.format('select pg_catalog.octet_length(%I.gen_random_bytes(16))', v_schema) into v_bytes;
  if v_bytes is distinct from 16 then raise exception 'Falha ao validar pgcrypto'; end if;
  execute pg_catalog.format('alter function public.draw_raffle(bigint, uuid, text) set search_path = pg_catalog, public, %I, pg_temp', v_schema);
end;
$correcao_sorteio$;

notify pgrst, 'reload schema';
commit;



-- Remove o limite de 5 e restringe novos cadastros a uma conta por IP. Preserva dados.
begin;
create or replace function public.create_reservation(
  p_raffle_id bigint,
  p_account_id uuid,
  p_buyer_name text,
  p_buyer_game_id text,
  p_buyer_phone text,
  p_numbers integer[],
  p_coupon_code text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_purchase_id uuid := gen_random_uuid(); v_price integer; v_available integer; v_subtotal bigint; v_total bigint; v_discount integer := 0; v_coupon coupons%rowtype;
begin
  select price into v_price from raffles where id = p_raffle_id and status = 'active' for update;
  if v_price is null then raise exception 'Rifa não está aberta'; end if;
  if length(trim(coalesce(p_buyer_name, ''))) not between 2 and 50 then raise exception 'O nome do jogador deve ter de 2 a 50 caracteres'; end if;
  if length(trim(coalesce(p_buyer_game_id, ''))) not between 1 and 50 then raise exception 'O ID do jogador deve ter de 1 a 50 caracteres'; end if;
  if trim(coalesce(p_buyer_phone, '')) !~ '^[0-9]{1,6}$' then raise exception 'O telefone no jogo deve ter no máximo 6 dígitos'; end if;
  if coalesce(cardinality(p_numbers), 0) not between 1 and 500 then raise exception 'Escolha de 1 a 500 números'; end if;
  if cardinality(p_numbers) <> (select count(distinct selected_number) from unnest(p_numbers) as chosen(selected_number)) then raise exception 'Não repita números na mesma compra'; end if;
  perform id from raffle_numbers where raffle_id = p_raffle_id and number = any(p_numbers) order by id for update;
  select count(*) into v_available from raffle_numbers where raffle_id = p_raffle_id and number = any(p_numbers) and status = 'available';
  if v_available <> cardinality(p_numbers) then raise exception 'Um ou mais números estão indisponíveis'; end if;
  if not exists (select 1 from accounts where id = p_account_id and role = 'member' and active = true) then raise exception 'Entre na sua conta de membro para reservar'; end if;
  v_subtotal := v_price::bigint * cardinality(p_numbers);
  v_total := v_subtotal;
  if nullif(trim(coalesce(p_coupon_code, '')), '') is not null then
    select * into v_coupon from coupons where code = upper(trim(p_coupon_code)) for update;
    if v_coupon.id is null or not v_coupon.active then raise exception 'Cupom inválido ou desativado'; end if;
    if cardinality(p_numbers) < v_coupon.min_numbers then raise exception 'Este cupom exige pelo menos % números. Selecione mais % para usar.', v_coupon.min_numbers, v_coupon.min_numbers - cardinality(p_numbers); end if;
    if v_coupon.expires_at is not null and v_coupon.expires_at <= now() then raise exception 'Este cupom expirou'; end if;
    if v_coupon.raffle_id is not null and v_coupon.raffle_id <> p_raffle_id then raise exception 'Este cupom não vale para esta rifa'; end if;
    if v_coupon.max_uses is not null and v_coupon.used_count >= v_coupon.max_uses then raise exception 'Este cupom atingiu o limite de usos'; end if;
    if exists (select 1 from purchases where coupon_id = v_coupon.id and account_id = p_account_id and status in ('pending', 'approved')) then raise exception 'Você já utilizou este cupom'; end if;
    v_discount := v_coupon.discount_percent;
    v_total := greatest(0, v_subtotal - floor(v_subtotal::numeric * v_discount / 100)::bigint);
  end if;
  insert into purchases (id, raffle_id, account_id, buyer_name, buyer_game_id, buyer_phone, numbers, subtotal_value, total_value, discount_percent, coupon_id, coupon_code)
  values (v_purchase_id, p_raffle_id, p_account_id, trim(p_buyer_name), trim(p_buyer_game_id), trim(p_buyer_phone), p_numbers, v_subtotal, v_total, v_discount, v_coupon.id, v_coupon.code);
  update raffle_numbers set status = 'reserved', buyer_name = trim(p_buyer_name), buyer_game_id = trim(p_buyer_game_id), buyer_phone = trim(p_buyer_phone), purchase_id = v_purchase_id, updated_at = now()
  where raffle_id = p_raffle_id and number = any(p_numbers) and status = 'available';
  insert into audit_logs (event, actor, details) values ('reservation_requested', trim(p_buyer_game_id), jsonb_build_object('purchase_id', v_purchase_id, 'coupon_code', v_coupon.code, 'discount_percent', v_discount));
  return v_purchase_id;
end; $$;

create or replace function public.register_manual_sale(
  p_raffle_id bigint,
  p_buyer_name text,
  p_buyer_game_id text,
  p_buyer_phone text,
  p_numbers integer[],
  p_actor_id uuid,
  p_actor text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_purchase_id uuid := gen_random_uuid(); v_price integer; v_available integer;
begin
  select price into v_price from raffles where id = p_raffle_id and status = 'active' for update;
  if v_price is null then raise exception 'Rifa ativa não encontrada'; end if;
  if not exists (select 1 from accounts where id = p_actor_id and role in ('owner', 'admin') and active = true) then raise exception 'Administrador inválido'; end if;
  if length(trim(coalesce(p_buyer_name, ''))) not between 2 and 50 then raise exception 'O nome do jogador deve ter de 2 a 50 caracteres'; end if;
  if length(trim(coalesce(p_buyer_game_id, ''))) not between 1 and 50 then raise exception 'O ID do jogador deve ter de 1 a 50 caracteres'; end if;
  if trim(coalesce(p_buyer_phone, '')) !~ '^[0-9]{1,6}$' then raise exception 'O telefone no jogo deve ter no máximo 6 dígitos'; end if;
  if coalesce(cardinality(p_numbers), 0) not between 1 and 500 then raise exception 'Informe de 1 a 500 números'; end if;
  if cardinality(p_numbers) <> (select count(distinct selected_number) from unnest(p_numbers) as chosen(selected_number)) then raise exception 'Não repita números na mesma compra'; end if;
  perform id from raffle_numbers where raffle_id = p_raffle_id and number = any(p_numbers) order by id for update;
  select count(*) into v_available from raffle_numbers where raffle_id = p_raffle_id and number = any(p_numbers) and status = 'available';
  if v_available <> cardinality(p_numbers) then raise exception 'Um ou mais números estão indisponíveis'; end if;
  insert into purchases (id, raffle_id, buyer_name, buyer_game_id, buyer_phone, numbers, subtotal_value, total_value, status, reviewed_at, reviewed_by, reviewed_by_id)
  values (v_purchase_id, p_raffle_id, trim(p_buyer_name), trim(p_buyer_game_id), trim(p_buyer_phone), p_numbers, v_price::bigint * cardinality(p_numbers), v_price::bigint * cardinality(p_numbers), 'approved', now(), trim(p_actor), p_actor_id);
  update raffle_numbers set status = 'sold', buyer_name = trim(p_buyer_name), buyer_game_id = trim(p_buyer_game_id), buyer_phone = trim(p_buyer_phone), purchase_id = v_purchase_id, updated_at = now()
  where raffle_id = p_raffle_id and number = any(p_numbers) and status = 'available';
  insert into audit_logs (event, actor, details) values ('manual_sale_registered', trim(p_actor), jsonb_build_object('purchase_id', v_purchase_id, 'actor_id', p_actor_id));
  return v_purchase_id;
end; $$;
alter table public.accounts add column if not exists registration_ip inet;
create or replace function public.normalize_registration_ip()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.registration_ip is not null then
    new.registration_ip := host(new.registration_ip)::inet;
    if new.registration_ip <<= inet '::ffff:0.0.0.0/96' then
      new.registration_ip := substring(host(new.registration_ip) from 8)::inet;
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists accounts_normalize_registration_ip on public.accounts;
create trigger accounts_normalize_registration_ip before insert or update of registration_ip
on public.accounts for each row execute function public.normalize_registration_ip();
create unique index if not exists accounts_registration_ip_unique on public.accounts(registration_ip) where registration_ip is not null;
revoke all on function public.normalize_registration_ip() from public, anon, authenticated;

drop function if exists public.check_player_number_limit(bigint, text, integer);
drop function if exists public.normalized_player_id(text);
notify pgrst, 'reload schema';
commit;
