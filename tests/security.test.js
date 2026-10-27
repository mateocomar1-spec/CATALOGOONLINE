import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const admin = '11111111-1111-4111-8111-111111111111';
const member = '22222222-2222-4222-8222-222222222222';
async function actor(role, uid = null, aal = 'aal1') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({sub:uid,aal})]);
  await db.exec(`set role ${role}`);
}
const rows = async sql => (await db.query(sql)).rows;
before(async () => {
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb) $$;
    grant usage on schema auth, public to anon, authenticated;
    insert into auth.users values ('${admin}'),('${member}');
  `);
  await db.exec(await readFile(new URL('../supabase/migrations/001_catalog.sql',import.meta.url),'utf8'));
  await db.exec(`insert into private.catalog_admins(user_id) values ('${admin}');
    insert into public.products(id,name,category,price,published) values ('PUB','Público','General',10,true),('DRAFT','Privado','General',20,false);`);
});
after(async () => db.close());
test('visitante: solo catálogo publicado, sin escritura ni acceso a auditoría', async () => {
  await actor('anon');
  assert.deepEqual((await rows('select id from public.products')).map(p=>p.id),['PUB']);
  assert.equal((await rows('select * from public.store_settings')).length,1);
  await assert.rejects(db.exec("update public.products set price=1 where id='PUB'"),/permission denied/);
  await assert.rejects(db.exec('select * from private.catalog_admins'),/permission denied/);
  await assert.rejects(db.exec('select * from private.catalog_audit'),/permission denied/);
  await assert.rejects(db.exec('select public.read_catalog_audit()'),/permission denied/);
});
test('usuario común incluso con MFA: sin permisos administrativos ni autoautorización', async () => {
  await actor('authenticated',member,'aal2');
  assert.equal((await rows('select public.is_catalog_admin() as allowed'))[0].allowed,false);
  assert.equal((await rows('select * from public.products')).length,1);
  assert.equal((await rows("update public.products set price=1 where id='PUB' returning id")).length,0);
  await assert.rejects(db.exec("insert into public.products(id,name,category,price) values ('BAD','X','X',1)"),/row-level security/);
  await assert.rejects(db.exec(`insert into private.catalog_admins(user_id) values ('${member}')`),/permission denied/);
  await assert.rejects(db.exec('select public.read_catalog_audit()'),/Acceso denegado/);
});
test('administrador sin segundo factor: modificaciones bloqueadas', async () => {
  await actor('authenticated',admin,'aal1');
  assert.equal((await rows('select public.has_catalog_admin_membership() as allowed'))[0].allowed,true);
  assert.equal((await rows('select public.is_catalog_admin() as allowed'))[0].allowed,false);
  assert.equal((await rows("update public.products set price=1 where id='PUB' returning id")).length,0);
  assert.equal((await rows("update public.store_settings set name='Intruso' returning id")).length,0);
  await assert.rejects(db.exec("insert into public.products(id,name,category,price) values ('BAD','X','X',1)"),/row-level security/);
});
test('administrador con MFA: modifica, registra cambios, valida datos y evita sobrescritura', async () => {
  await actor('authenticated',admin,'aal2');
  assert.equal((await rows('select * from public.products')).length,2);
  const original=(await rows("select updated_at from public.products where id='PUB'"))[0].updated_at;
  await db.exec("update public.products set price=42.50 where id='PUB'");
  assert.equal((await db.query("update public.products set price=999 where id='PUB' and updated_at=$1 returning id",[original])).rows.length,0);
  await db.exec("insert into public.products(id,name,category,price) values ('NEW','Nuevo','General',3)");
  await assert.rejects(db.exec("update public.products set price=-1 where id='PUB'"),/check constraint/);
  await assert.rejects(db.exec("update public.products set id='CHANGED' where id='PUB'"),/código no se puede modificar/);
  await assert.rejects(db.exec("delete from public.products where id='PUB'"),/permission denied/);
  const log=await rows('select * from public.read_catalog_audit()');
  assert.ok(log.some(e=>e.row_id==='PUB'&&e.actor===admin&&e.before_data.price===10&&e.after_data.price===42.5));
  await assert.rejects(db.exec('delete from private.catalog_audit'),/permission denied/);
});
test('revocar membresía quita permisos aunque el JWT siga teniendo MFA', async () => {
  await actor('postgres'); await db.exec(`delete from private.catalog_admins where user_id='${admin}'`);
  await actor('authenticated',admin,'aal2');
  assert.equal((await rows("update public.products set price=1 where id='PUB' returning id")).length,0);
  assert.equal((await rows("select * from public.products where id='DRAFT'")).length,0);
});
