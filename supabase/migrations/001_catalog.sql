-- Migración inicial. Ejecutar una sola vez en el SQL Editor del proyecto.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.catalog_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
revoke all on private.catalog_admins from public, anon, authenticated;

-- La membresía solo la concede el propietario en SQL; nunca el propio usuario.
create function public.has_catalog_admin_membership() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.catalog_admins where user_id = auth.uid());
$$;
revoke all on function public.has_catalog_admin_membership() from public, anon;
grant execute on function public.has_catalog_admin_membership() to authenticated;

create function public.is_catalog_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt()->>'aal' = 'aal2', false)
    and exists (select 1 from private.catalog_admins where user_id = auth.uid());
$$;
revoke all on function public.is_catalog_admin() from public, anon;
grant execute on function public.is_catalog_admin() to authenticated;

create table public.products (
  id text primary key check (id ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$'),
  name text not null check (length(trim(name)) between 1 and 160),
  category text not null check (length(trim(category)) between 1 and 80),
  price numeric(12,2) not null check (price >= 0 and price <= 9999999999.99),
  unit text not null default 'Por unidad' check (length(trim(unit)) between 1 and 120),
  image text not null default '' check (length(image) <= 2048 and (image = '' or image ~ '^https://[^[:space:]]+$')),
  emoji text not null default '🛠️' check (length(emoji) between 1 and 16),
  featured boolean not null default false,
  stock boolean not null default true,
  published boolean not null default false,
  updated_at timestamptz not null default now()
);
create index products_published_category_idx on public.products(category) where published;
create table public.store_settings (
  id integer primary key default 1 check (id = 1),
  name text not null check (length(trim(name)) between 1 and 120),
  whatsapp text not null default '' check (whatsapp = '' or whatsapp ~ '^[1-9][0-9]{7,14}$'),
  address text not null default '' check (length(address) <= 250),
  hours text not null default '' check (length(hours) <= 250),
  currency text not null default 'ARS' check (currency in ('ARS','USD','UYU','CLP','EUR')),
  locale text not null default 'es-AR' check (locale in ('es-AR','es-UY','es-CL','es-ES','en-US')),
  updated_at timestamptz not null default now()
);
insert into public.store_settings (id, name) values (1, 'Mi ferretería');

alter table public.products enable row level security;
alter table public.store_settings enable row level security;
revoke all on public.products, public.store_settings from public, anon, authenticated;
grant select on public.products, public.store_settings to anon, authenticated;
grant insert, update on public.products to authenticated;
grant update on public.store_settings to authenticated;

create policy published_products on public.products for select to anon, authenticated using (published = true);
create policy admin_read_products on public.products for select to authenticated using ((select public.is_catalog_admin()));
create policy admin_insert_products on public.products for insert to authenticated with check ((select public.is_catalog_admin()));
create policy admin_update_products on public.products for update to authenticated using ((select public.is_catalog_admin())) with check ((select public.is_catalog_admin()));
create policy public_store_settings on public.store_settings for select to anon, authenticated using (true);
create policy admin_update_settings on public.store_settings for update to authenticated using ((select public.is_catalog_admin())) with check ((select public.is_catalog_admin()));

create table private.catalog_audit (
  id bigint generated always as identity primary key,
  changed_at timestamptz not null default now(),
  actor uuid,
  entity text not null,
  row_id text not null,
  action text not null,
  before_data jsonb,
  after_data jsonb
);
revoke all on private.catalog_audit from public, anon, authenticated;

create function private.touch_catalog_row() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.id is distinct from old.id then
    raise exception 'El código no se puede modificar';
  end if;
  new.updated_at = clock_timestamp();
  return new;
end;
$$;
create function private.audit_catalog_row() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into private.catalog_audit(actor,entity,row_id,action,before_data,after_data)
  values(auth.uid(),tg_table_name,coalesce(new.id::text,old.id::text),tg_op,
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return null;
end;
$$;
revoke all on function private.touch_catalog_row(), private.audit_catalog_row() from public, anon, authenticated;
create trigger products_timestamp before insert or update on public.products for each row execute function private.touch_catalog_row();
create trigger settings_timestamp before update on public.store_settings for each row execute function private.touch_catalog_row();
create trigger products_audit after insert or update or delete on public.products for each row execute function private.audit_catalog_row();
create trigger settings_audit after update on public.store_settings for each row execute function private.audit_catalog_row();

create function public.read_catalog_audit() returns table (
  id bigint, changed_at timestamptz, actor uuid, entity text, row_id text, action text, before_data jsonb, after_data jsonb
) language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_catalog_admin() then raise exception 'Acceso denegado' using errcode = '42501'; end if;
  return query select a.id,a.changed_at,a.actor,a.entity,a.row_id,a.action,a.before_data,a.after_data
    from private.catalog_audit a order by a.id desc limit 100;
end;
$$;
revoke all on function public.read_catalog_audit() from public, anon;
grant execute on function public.read_catalog_audit() to authenticated;
commit;
