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
