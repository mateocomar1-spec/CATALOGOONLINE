-- Ejecutar en SQL Editor DESPUÉS de crear tu usuario en Authentication > Users.
-- Reemplazar únicamente el email de ejemplo por el de tu cuenta.
do $$
declare owner_id uuid;
begin
  select id into strict owner_id from auth.users
    where lower(email) = lower('TU_EMAIL@EJEMPLO.COM');
  insert into private.catalog_admins(user_id) values (owner_id)
    on conflict (user_id) do nothing;
exception when no_data_found then
  raise exception 'Primero creá el usuario y reemplazá el email de ejemplo por su email real.';
end;
$$;
