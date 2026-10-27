import { createClient } from '@supabase/supabase-js';
import { readPublicConfig, PRODUCT_FIELDS, STORE_FIELDS } from './validation.js';
export function createCatalogClient(config = {}) {
  const parsed = readPublicConfig(config);
  if (!parsed) return null;
  return createClient(parsed.url, parsed.key, {
    auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'catalog-admin-memory' },
    global: { fetch: (input, init = {}) => fetch(input, { ...init, signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(config.timeoutMs || 12000)]) : AbortSignal.timeout(config.timeoutMs || 12000) }) }
  });
}
export async function getAllProducts(client, { admin = false, timeoutMs = 12000 } = {}) {
  const products = [];
  for (let offset = 0; offset < 20000; offset += 1000) {
    let query = client.from('products').select(PRODUCT_FIELDS).order('id').range(offset, offset + 999).abortSignal(AbortSignal.timeout(timeoutMs));
    if (!admin) query = query.eq('published', true);
    const { data, error } = await query;
    if (error) throw error;
    products.push(...data);
    if (data.length < 1000) return products;
  }
  throw new Error('El catálogo excede el límite de esta versión.');
}
export async function loadCatalog(client, { timeoutMs = 12000 } = {}) {
  const [products, result] = await Promise.all([
    getAllProducts(client, { timeoutMs }), client.from('store_settings').select(STORE_FIELDS).eq('id', 1).abortSignal(AbortSignal.timeout(timeoutMs)).single()
  ]);
  if (result.error) throw result.error;
  return { products, store: result.data };
}
export function requireResult(result) {
  if (result.error) throw result.error;
  return result.data;
}
