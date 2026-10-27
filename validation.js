export const PRODUCT_FIELDS = 'id,name,category,price,unit,image,emoji,featured,stock,published,updated_at';
export const STORE_FIELDS = 'id,name,whatsapp,address,hours,currency,locale,updated_at';
export function readPublicConfig(config = {}) {
  if (!config.supabaseUrl && !config.supabasePublishableKey) return null;
  if (!config.supabaseUrl) throw new Error('Falta la URL del proyecto de Supabase en config.js.');
  const url = new URL(config.supabaseUrl);
  if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) || url.port || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Usá la URL HTTPS del proyecto de Supabase.');
  }
  const key = String(config.supabasePublishableKey || '');
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
    throw new Error('Usá una clave pública sb_publishable_. No uses service_role ni claves secretas.');
  }
  return { url: url.origin, key };
}
function text(value, label, max, required = true) {
  const result = String(value ?? '').trim();
  if ((required && !result) || result.length > max) throw new Error(`${label}: revisá el contenido (máximo ${max} caracteres).`);
  return result;
}
export function validateProduct(input) {
  const id = text(input.id, 'Código', 64);
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id)) throw new Error('Código: usá letras, números, guiones o guion bajo.');
  if (String(input.price ?? '').trim() === '') throw new Error('Ingresá un precio.');
  const price = Number(input.price);
  if (!Number.isFinite(price) || price < 0 || price > 9999999999.99 || Math.abs(price * 100 - Math.round(price * 100)) > 0.001) throw new Error('El precio debe ser positivo o cero y tener como máximo dos decimales.');
  const image = text(input.image, 'Imagen', 2048, false);
  if (image) {
    const url = new URL(image);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('La imagen debe tener una URL HTTPS pública.');
  }
  return { id, name: text(input.name, 'Nombre', 160), category: text(input.category, 'Categoría', 80), price,
    unit: text(input.unit || 'Por unidad', 'Presentación', 120), image,
    emoji: text(input.emoji || '🛠️', 'Ícono', 16), featured: input.featured === true, stock: input.stock === true, published: input.published === true };
}
export function validateStore(input) {
  const whatsapp = text(input.whatsapp, 'WhatsApp', 30, false).replace(/[\s+()-]/g, '');
  if (whatsapp && !/^[1-9]\d{7,14}$/.test(whatsapp)) throw new Error('WhatsApp: ingresá código de país y área, sin prefijos locales.');
  const currency = text(input.currency, 'Moneda', 3);
  const locale = text(input.locale, 'Formato regional', 10);
  if (!['ARS', 'USD', 'UYU', 'CLP', 'EUR'].includes(currency) || !['es-AR', 'es-UY', 'es-CL', 'es-ES', 'en-US'].includes(locale)) throw new Error('Seleccioná una moneda y un formato regional válidos.');
  return { id: 1, name: text(input.name, 'Nombre', 120), whatsapp, address: text(input.address, 'Dirección', 250, false), hours: text(input.hours, 'Horarios', 250, false), currency, locale };
}
