import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createCatalogServer} from '../server.js';
let server,base;
before(async()=>{server=createCatalogServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;});
after(async()=>new Promise(resolve=>server.close(resolve)));
test('sirve catálogo y panel con CSP y sin publicar código del servidor o SQL',async()=>{
 for(const path of ['/','/admin']){const r=await fetch(base+path);assert.equal(r.status,200);assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.equal(r.headers.get('cache-control'),'no-store');assert.ok((await r.text()).includes('<!doctype html>'));}
 for(const path of ['/server.js','/supabase/migrations/001_catalog.sql','/package.json','/.env']) assert.equal((await fetch(base+path)).status,404);
 assert.equal((await fetch(base+'/',{method:'POST'})).status,405);
});
