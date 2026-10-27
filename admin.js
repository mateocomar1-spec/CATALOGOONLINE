import { createCatalogClient, getAllProducts, requireResult } from './supabase-client.js';
import { validateProduct, validateStore, PRODUCT_FIELDS, STORE_FIELDS } from './validation.js';
const $ = selector => document.querySelector(selector);
const status = (message, error = false) => { $('#admin-status').textContent = message; $('#admin-status').classList.toggle('error', error); };
const element = (tag, text, className) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; };
let client, factorId, products = [], settings, editing, user, authSubscription;
const forms = ['#login-form', '#mfa-form', '#product-form', '#settings-form'];
function busy(form, value) { for (const field of form.elements) field.disabled = value; }
function message(error) {
  if (error?.code === '23505') return 'Ese código ya existe. Elegí otro código.';
  if (error?.code === 'PGRST116') return 'El registro cambió o ya no tenés permiso. Cerrá el editor y actualizá la lista antes de volver a guardar.';
  if (error?.code === '42501') return 'No tenés permiso. Verificá tu sesión y la autorización de tu cuenta.';
  if (error?.code === '23514') return 'La base rechazó un dato inválido. Revisá los campos.';
  if (error?.code === 'invalid_credentials') return 'No pudimos ingresar. Revisá tu email y contraseña.';
  if (error?.code?.includes('mfa') || error?.message?.includes('TOTP')) return 'No se pudo verificar el código. Revisá tu autenticador e intentá nuevamente.';
  if (error instanceof Error && !('code' in error)) return error.message;
  return 'No se pudo completar la operación. Revisá la conexión, los datos y los permisos.';
}
function clearMfa() {
  factorId = undefined;
  $('#mfa-qr').removeAttribute('src'); $('#mfa-qr').hidden = true;
  $('#mfa-secret').textContent = ''; $('#mfa-manual').hidden = true;
  $('#mfa-form').reset();
}
function resetPanel() {
  user = undefined; products = []; settings = undefined; editing = undefined;
  $('#dashboard').hidden = true; $('#mfa-panel').hidden = true;
  $('#login-panel').hidden = !client;
  $('#admin-products').replaceChildren(); $('#audit-list').replaceChildren();
  for (const selector of forms) $(selector).reset();
  if ($('#product-dialog').open) $('#product-dialog').close();
  clearMfa();
}
function attachAuthEvents() {
  authSubscription?.unsubscribe();
  authSubscription = client.auth.onAuthStateChange(event => { if (event === 'SIGNED_OUT') resetPanel(); }).data.subscription;
}
async function signOut() {
  const previous = client;
  authSubscription?.unsubscribe();
  resetPanel();
  try {
    if (previous) { await previous.auth.stopAutoRefresh(); await previous.auth.signOut({ scope: 'local' }); }
  } catch { /* El cliente anterior se descarta igualmente. */ } finally {
    // Cliente nuevo: una falla de red nunca conserva la sesión en memoria.
    client = createCatalogClient(window.CATALOG_CONFIG);
    if (client) attachAuthEvents();
    resetPanel(); status('Sesión cerrada en este navegador.');
  }
}
async function enterDashboard() {
  if (requireResult(await client.rpc('is_catalog_admin')) !== true) throw new Error('Tu cuenta necesita autorización y verificación en dos pasos.');
  const [nextProducts, nextSettings] = await Promise.all([
    getAllProducts(client, { admin: true }), client.from('store_settings').select(STORE_FIELDS).eq('id', 1).single().then(requireResult)
  ]);
  products = nextProducts; settings = nextSettings;
  clearMfa(); $('#login-panel').hidden = true; $('#mfa-panel').hidden = true; $('#dashboard').hidden = false;
  $('#admin-account').textContent = `${user.email} · Verificación en dos pasos activa`;
  populate($('#settings-form'), settings); renderProducts();
  status('Sesión verificada. Los cambios guardados se publican al recargar el catálogo.');
}
async function prepareMfa() {
  if (requireResult(await client.rpc('has_catalog_admin_membership')) !== true) {
    await signOut(); throw new Error('Esta cuenta no está autorizada para administrar la ferretería.');
  }
  const assurance = requireResult(await client.auth.mfa.getAuthenticatorAssuranceLevel());
  if (assurance.currentLevel === 'aal2') { await enterDashboard(); return; }
  const factors = requireResult(await client.auth.mfa.listFactors());
  const verified = factors.totp.find(f => f.status === 'verified');
  clearMfa();
  if (verified) {
    factorId = verified.id;
    $('#mfa-instructions').textContent = 'Ingresá el código de seis dígitos de tu aplicación de autenticación.';
  } else {
    // Eliminar solo inscripciones incompletas de esta cuenta para permitir reintentos.
    for (const factor of factors.all.filter(f => f.factor_type === 'totp' && f.status === 'unverified')) requireResult(await client.auth.mfa.unenroll({ factorId: factor.id }));
    const enrollment = requireResult(await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Administración de ferretería' }));
    factorId = enrollment.id;
    $('#mfa-instructions').textContent = 'Primera vez: escaneá este QR con Google Authenticator, 1Password u otra aplicación TOTP. Guardá el acceso a tu autenticador y luego ingresá el código.';
    const qr = enrollment.totp.qr_code;
    // SVG del proveedor como imagen, sin insertar HTML ejecutable.
    $('#mfa-qr').src = qr.startsWith('data:image/svg+xml') ? qr : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr)}`;
    $('#mfa-qr').hidden = false;
    $('#mfa-secret').textContent = enrollment.totp.secret; $('#mfa-manual').hidden = false;
  }
  $('#login-panel').hidden = true; $('#mfa-panel').hidden = false;
  status('Verificá tu identidad para continuar.');
  $('#mfa-form input').focus();
}
$('#login-form').addEventListener('submit', async event => {
  event.preventDefault(); const form = event.currentTarget, values = new FormData(form); busy(form, true);
  try {
    const data = requireResult(await client.auth.signInWithPassword({ email: String(values.get('email')).trim(), password: String(values.get('password')) }));
    user = data.user; form.reset(); await prepareMfa();
  } catch (error) {
    status(message(error), true);
    if ($('#mfa-panel').hidden && $('#dashboard').hidden && user) { await client.auth.signOut({ scope: 'local' }); resetPanel(); }
  } finally { form.elements.password.value = ''; busy(form, false); }
});
$('#mfa-form').addEventListener('submit', async event => {
  event.preventDefault(); const form = event.currentTarget, code = new FormData(form).get('code'); busy(form, true);
  try { requireResult(await client.auth.mfa.challengeAndVerify({ factorId, code: String(code) })); await enterDashboard(); }
  catch (error) { status(message(error), true); }
  finally { form.reset(); busy(form, false); }
});
for (const button of document.querySelectorAll('.logout')) button.addEventListener('click', signOut);
function populate(form, data) {
  for (const field of form.elements) {
    if (!field.name || !(field.name in data)) continue;
    if (field.type === 'checkbox') field.checked = data[field.name] === true;
    else field.value = data[field.name] ?? '';
  }
}
function readForm(form) {
  const values = Object.fromEntries(new FormData(form));
  for (const field of form.querySelectorAll('input[type=checkbox]')) values[field.name] = field.checked;
  return values;
}
function renderProducts() {
  const query = $('#admin-search').value.toLocaleLowerCase('es');
  const filtered = products.filter(p => `${p.id} ${p.name} ${p.category}`.toLocaleLowerCase('es').includes(query));
  const money = value => new Intl.NumberFormat(settings.locale, { style: 'currency', currency: settings.currency }).format(value);
  $('#admin-products').replaceChildren(...filtered.map(product => {
    const row = element('tr'), title = element('td'), state = element('td');
    title.append(element('strong', product.name), element('small', product.id));
    state.append(element('span', product.published ? 'Publicado' : 'Borrador', `pill ${product.published ? '' : 'draft'}`), element('small', product.stock ? 'Disponible' : 'Sin stock'));
    const action = element('td'), edit = element('button', 'Editar', 'secondary');
    edit.setAttribute('aria-label', `Editar ${product.name}`); edit.onclick = () => openEditor(product); action.append(edit);
    row.append(title, element('td', product.category), element('td', money(product.price)), state, action); return row;
  }));
  if (!filtered.length) { const row = element('tr'), cell = element('td', 'No hay productos para mostrar.'); cell.colSpan = 5; row.append(cell); $('#admin-products').append(row); }
  $('#category-options').replaceChildren(...[...new Set(products.map(p => p.category))].map(category => { const option = element('option'); option.value = category; return option; }));
}
function openEditor(product) {
  editing = product || null;
  const form = $('#product-form'); form.reset(); form.elements.id.readOnly = !!product;
  if (product) populate(form, product);
  $('#editor-title').textContent = product ? 'Editar producto' : 'Nuevo producto'; $('#editor-status').textContent = '';
  $('#product-dialog').showModal();
}
$('#reload-products').onclick = async () => {
  try { products = await getAllProducts(client, { admin: true }); renderProducts(); status('Lista actualizada.'); }
  catch (error) { status(message(error), true); }
};
$('#reload-settings').onclick = async () => {
  try { settings = requireResult(await client.from('store_settings').select(STORE_FIELDS).eq('id', 1).single()); populate($('#settings-form'), settings); status('Datos recargados desde la base.'); }
  catch (error) { status(message(error), true); }
};
$('#admin-search').oninput = renderProducts;
$('#new-product').onclick = () => openEditor(); $('#close-editor').onclick = () => $('#product-dialog').close();
$('#product-form').addEventListener('submit', async event => {
  event.preventDefault(); const form = event.currentTarget;
  try {
    const input = validateProduct(readForm(form)); busy(form, true);
    const mutation = editing
      ? client.from('products').update(input).eq('id', editing.id).eq('updated_at', editing.updated_at)
      : client.from('products').insert(input);
    const saved = requireResult(await mutation.select(PRODUCT_FIELDS).single());
    products = [...products.filter(p => p.id !== saved.id), saved].sort((a,b) => a.id.localeCompare(b.id));
    renderProducts(); $('#product-dialog').close(); status(`Producto “${saved.name}” guardado${saved.published ? ' y publicado' : ' como borrador'}.`);
  } catch (error) { $('#editor-status').textContent = message(error); }
  finally { busy(form, false); }
});
$('#settings-form').addEventListener('submit', async event => {
  event.preventDefault(); const form = event.currentTarget;
  try {
    const input = validateStore(readForm(form)); busy(form, true);
    settings = requireResult(await client.from('store_settings').update(input).eq('id', 1).eq('updated_at', settings.updated_at).select(STORE_FIELDS).single());
    populate(form, settings); renderProducts(); status('Datos del negocio guardados.');
  } catch (error) { status(message(error), true); }
  finally { busy(form, false); }
});
async function refreshAudit() {
  try {
    const entries = requireResult(await client.rpc('read_catalog_audit'));
    $('#audit-list').replaceChildren(...entries.map(entry => {
      const item = element('details');
      item.append(element('summary', `${new Date(entry.changed_at).toLocaleString()} · ${entry.entity} / ${entry.row_id} · ${entry.action}`), element('p', `Usuario: ${entry.actor || 'Operación del propietario en SQL'}`, 'help'), element('pre', JSON.stringify({ antes: entry.before_data, despues: entry.after_data }, null, 2)));
      return item;
    }));
    if (!entries.length) $('#audit-list').append(element('p', 'Todavía no hay cambios registrados.', 'help'));
  } catch (error) { status(message(error), true); }
}
for (const tab of document.querySelectorAll('[data-tab]')) tab.onclick = async () => {
  for (const other of document.querySelectorAll('[data-tab]')) { const selected = other === tab; other.setAttribute('aria-pressed', String(selected)); $(`#${other.dataset.tab}`).hidden = !selected; }
  if (tab.dataset.tab === 'audit-panel') await refreshAudit();
};
$('#refresh-audit').onclick = refreshAudit;
try {
  client = createCatalogClient(window.CATALOG_CONFIG);
  if (!client) status('Todavía falta conectar Supabase. El propietario debe completar config.js siguiendo las instrucciones de README.md. No se puede ingresar ni guardar cambios sin esa conexión.');
  else {
    $('#login-panel').hidden = false; status('Ingresá con tu cuenta autorizada. La sesión se conserva solo mientras esta página esté abierta.');
    attachAuthEvents();
  }
} catch (error) { status(message(error), true); }
