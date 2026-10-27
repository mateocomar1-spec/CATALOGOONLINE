import {test,expect} from '@playwright/test';
const project='https://mockcatalog.supabase.co';
const product={id:'TAL-01',name:'Taladro seguro',category:'Herramientas',price:1234.50,unit:'Por unidad',emoji:'🔧',image:'',featured:true,stock:true,published:true,updated_at:'2026-01-01T00:00:00Z'};
const store={id:1,name:'Ferretería de prueba',whatsapp:'5491112345678',currency:'ARS',locale:'es-AR',address:'Calle de prueba',hours:'Lunes a viernes',updated_at:'2026-01-01T00:00:00Z'};
const uid='11111111-1111-4111-8111-111111111111';
function session(aal,factors=[]){const payload={sub:uid,aal,exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000),aud:'authenticated',role:'authenticated'};const jwt=[{alg:'HS256',typ:'JWT'},payload].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).join('.')+'.'+Buffer.from('fake-signature-for-mock-only').toString('base64url');return {access_token:jwt,refresh_token:'mock-refresh',expires_in:3600,token_type:'bearer',user:{id:uid,email:'admin@example.test',aud:'authenticated',role:'authenticated',factors}};}
async function setup(page,{fail=false,member=true,enrolled=true}={}){
 let aal='aal1';const factors=enrolled?[{id:'factor-1',factor_type:'totp',status:'verified',friendly_name:'Test'}]:[];
 await page.route('**/config.js',route=>route.fulfill({contentType:'text/javascript',body:`window.CATALOG_CONFIG=${JSON.stringify({supabaseUrl:project,supabasePublishableKey:'sb_publishable_mock',timeoutMs:1000})}`}));
 await page.route(`${project}/**`,async route=>{
  const request=route.request(), url=new URL(request.url()), method=request.method();
  const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)});
  if(fail)return json({message:'Unavailable'},503);
  if(url.pathname==='/auth/v1/token')return json(session('aal1',factors));
  if(url.pathname==='/auth/v1/user')return json(session(aal,factors).user);
  if(url.pathname==='/auth/v1/factors'&&method==='POST')return json({id:'factor-1',type:'totp',totp:{qr_code:'<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"></svg>',secret:'MOCKSECRET'}});
  if(url.pathname.endsWith('/challenge'))return json({id:'challenge-1',expires_at:Date.now()+60000});
  if(url.pathname.endsWith('/verify')){aal='aal2';return json(session(aal,[{id:'factor-1',factor_type:'totp',status:'verified'}]));}
  if(url.pathname==='/auth/v1/logout')return route.fulfill({status:204});
  if(url.pathname.endsWith('/rpc/has_catalog_admin_membership'))return json(member);
  if(url.pathname.endsWith('/rpc/is_catalog_admin'))return json(member&&aal==='aal2');
  if(url.pathname.endsWith('/rpc/read_catalog_audit'))return json([{id:1,changed_at:'2026-01-01T12:00:00Z',actor:uid,entity:'products',row_id:product.id,action:'UPDATE',before_data:{price:100},after_data:{price:1234.5}}]);
  if(url.pathname==='/rest/v1/products'){
   if(method==='PATCH'||method==='POST'){expect(aal).toBe('aal2');return json({...product,...request.postDataJSON(),updated_at:'2026-02-01T00:00:00Z'});}
   return json([product]);
  }
  if(url.pathname==='/rest/v1/store_settings')return json(method==='PATCH'?{...store,...request.postDataJSON()}:store);
  return json({message:'Unexpected route '+url.pathname},400);
 });
}
async function login(page){await page.goto('/admin');await page.getByLabel('Email',{exact:true}).fill('admin@example.test');await page.getByLabel('Contraseña',{exact:true}).fill('mock-only-password');await page.getByRole('button',{name:'Ingresar →',exact:true}).click();}
test('catálogo conectado: buscar, carrito persistente y pedido con precio decimal',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await setup(page);await page.goto('/');
 await expect(page.locator('.product')).toHaveCount(1);await expect(page.locator('.price')).toContainText('1.234,5');
 await page.getByRole('button',{name:'Agregar Taladro seguro'}).click();await page.reload();await page.getByRole('button',{name:/Bolsa de pedido/}).click();
 await expect(page.locator('.cart-row')).toHaveCount(1);await expect(page.locator('#checkout')).toBeEnabled();
 await page.evaluate(()=>{window.open=(url)=>{window.testOrderUrl=url;return null;};});await page.locator('#checkout').click();
 const orderUrl=await page.evaluate(()=>window.testOrderUrl);expect(new URL(orderUrl).hostname).toBe('wa.me');expect(new URL(orderUrl).searchParams.get('text')).toContain('1.234,5');expect(errors).toEqual([]);
});
test('fallo de la base: datos de ejemplo identificados y pedidos bloqueados',async({page})=>{
 await setup(page,{fail:true});await page.goto('/');await expect(page.locator('.product')).toHaveCount(8);await expect(page.locator('#data-status')).toContainText('demostración');await page.locator('.add').first().click();await page.locator('#open-cart').click();await expect(page.locator('#checkout')).toBeDisabled();
});
test('panel: MFA, edición, datos del negocio, auditoría y sesión solo en memoria',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await setup(page);await login(page);
 await expect(page.locator('#dashboard')).toBeHidden();await expect(page.locator('#mfa-panel')).toBeVisible();
 await page.getByLabel('Código de tu autenticador').fill('123456');await page.getByRole('button',{name:'Verificar e ingresar'}).click();
 await expect(page.locator('#dashboard')).toBeVisible();await page.getByRole('button',{name:'Editar Taladro seguro'}).click();await page.getByLabel('Precio de venta').fill('1500.75');await page.getByRole('button',{name:'Guardar producto'}).click();
 await expect(page.locator('#admin-products')).toContainText('1.500,75');
 await page.getByRole('button',{name:'Datos del negocio',exact:true}).click();await page.locator('#settings-form').getByLabel('Nombre',{exact:true}).fill('Mi negocio actualizado');await page.getByRole('button',{name:'Guardar datos',exact:true}).click();await expect(page.locator('#admin-status')).toContainText('guardados');
 await page.getByRole('button',{name:'Historial de cambios',exact:true}).click();await expect(page.locator('#audit-list')).toContainText('TAL-01');
 expect(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.includes('auth')||k.includes('catalog-admin')))).toEqual([]);
 await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await expect(page.locator('#admin-status')).toContainText('Sesión cerrada');await expect(page.locator('#login-panel')).toBeVisible();await page.reload();await expect(page.locator('#dashboard')).toBeHidden();expect(errors).toEqual([]);
});
test('primera sesión: inscripción MFA antes de cualquier edición',async({page})=>{
 await setup(page,{enrolled:false});await login(page);await expect(page.locator('#mfa-qr')).toBeVisible();await expect(page.locator('#dashboard')).toBeHidden();await page.getByLabel('Código de tu autenticador').fill('123456');await page.getByRole('button',{name:'Verificar e ingresar'}).click();await expect(page.locator('#dashboard')).toBeVisible();await expect(page.locator('#mfa-secret')).toBeEmpty();
});
test('una cuenta sin autorización no entra al panel',async({page})=>{
 await setup(page,{member:false});await login(page);await expect(page.locator('#admin-status')).toContainText('no está autorizada');await expect(page.locator('#dashboard')).toBeHidden();
});
test('celular: catálogo y panel no desbordan la pantalla',async({page})=>{
 await page.setViewportSize({width:390,height:844});await setup(page);await page.goto('/');await expect(page.locator('.product')).toHaveCount(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.goto('/admin');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('alta de producto: comienza como borrador y se guarda con código propio',async({page})=>{
 await setup(page);await login(page);await page.getByLabel('Código de tu autenticador').fill('123456');await page.getByRole('button',{name:'Verificar e ingresar'}).click();await page.getByRole('button',{name:'+ Nuevo producto'}).click();
 const form=page.locator('#product-form');await form.getByLabel('Código único').fill('NUEVO-01');await form.getByLabel('Nombre',{exact:true}).fill('Martillo nuevo');await form.getByLabel('Categoría',{exact:true}).fill('Manuales');await form.getByLabel('Precio de venta').fill('3500.99');await expect(form.getByLabel('Publicado en el catálogo')).not.toBeChecked();await form.getByRole('button',{name:'Guardar producto'}).click();await expect(page.locator('#admin-products')).toContainText('Martillo nuevo');await expect(page.locator('#admin-products')).toContainText('Borrador');
});
