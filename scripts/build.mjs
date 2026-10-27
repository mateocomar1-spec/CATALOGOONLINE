import { build, context } from 'esbuild';
import { mkdir, copyFile, rm } from 'node:fs/promises';
if (!process.argv.includes('--watch')) await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
const assets = ['index.html','admin.html','styles.css','admin.css','config.js'];
async function copyAssets() { await Promise.all([...assets.map(file => copyFile(file, `dist/${file}`)), ...['_headers','_redirects'].map(file => copyFile(`deploy/${file}`, `dist/${file}`))]); }
const options = { entryPoints: ['app.js','admin.js'], bundle: true, outdir: 'dist', format: 'esm', splitting: true, platform: 'browser', target: ['es2022'], minify: true, legalComments: 'eof', plugins: [{name:'static-assets',setup(builder){builder.onEnd(copyAssets);}}] };
if (process.argv.includes('--watch')) {
  const watcher = await context(options); await watcher.watch();
  // Los archivos estáticos también se copian al editar durante desarrollo.
  const { watch } = await import('node:fs');
  for (const file of assets) watch(file, () => copyAssets().catch(console.error));
  await import('../server.js');
} else await build(options);
