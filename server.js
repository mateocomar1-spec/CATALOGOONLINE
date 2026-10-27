import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('./dist/', import.meta.url));
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8' };
const headers = {
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer',
  'X-Frame-Options':'DENY',
  'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' https: data:; connect-src https://*.supabase.co wss://*.supabase.co; font-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'"
};
export function createCatalogServer() {
  return http.createServer(async (req, res) => {
    try {
      if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405,{...headers,Allow:'GET, HEAD'});res.end();return; }
      let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (pathname === '/') pathname = '/index.html';
      if (pathname === '/admin' || pathname === '/admin/') pathname = '/admin.html';
      const file = path.resolve(root, '.' + pathname);
      if (!file.startsWith(root) || !types[path.extname(file)] || pathname.includes('..') || pathname.includes('\\')) throw new Error('Not found');
      const body = await readFile(file);
      res.writeHead(200,{...headers,'Content-Type':types[path.extname(file)],'Cache-Control':'no-store'});
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch { res.writeHead(404, {...headers,'Content-Type':'text/plain; charset=utf-8'}); res.end('No encontrado'); }
  });
}
if (process.argv[1] && (path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) || process.argv[1].endsWith('scripts/build.mjs'))) {
  createCatalogServer().listen(Number(process.env.PORT || 3000),'0.0.0.0',()=>console.log('Catálogo iniciado en puerto '+(process.env.PORT||3000)));
}
