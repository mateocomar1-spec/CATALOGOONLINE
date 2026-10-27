import test from 'node:test';
import assert from 'node:assert/strict';
import {readPublicConfig,validateProduct,validateStore} from '../validation.js';
const product={id:'TAL-01',name:'Taladro',category:'Herramientas',price:10,stock:true,published:false};
test('rechaza claves secretas, destinos inseguros y URLs no estándar',()=>{
  assert.equal(readPublicConfig({}),null);
  assert.throws(()=>readPublicConfig({supabaseUrl:'https://demo.supabase.co',supabasePublishableKey:'sb_secret_no'}));
  assert.throws(()=>readPublicConfig({supabaseUrl:'https://evil.example',supabasePublishableKey:'sb_publishable_test'}));
  assert.equal(readPublicConfig({supabaseUrl:'https://demo.supabase.co',supabasePublishableKey:'sb_publishable_test'}).url,'https://demo.supabase.co');
});
test('valida precio explícito, decimales, código e imagen',()=>{
  for(const price of ['',null,-1,1.001,Infinity])assert.throws(()=>validateProduct({...product,price}));
  assert.equal(validateProduct({...product,price:'12.50'}).price,12.5);
  assert.throws(()=>validateProduct({...product,id:'../secret'}));
  assert.throws(()=>validateProduct({...product,image:'javascript:alert(1)'}));
});
test('solo guarda datos públicos de configuración y valida WhatsApp',()=>{
  const input={name:'Ferretería',whatsapp:'+54 9 11 1234 5678',currency:'ARS',locale:'es-AR',secret:'no guardar'};
  const result=validateStore(input);assert.equal(result.whatsapp,'5491112345678');assert.equal('secret'in result,false);
  assert.throws(()=>validateStore({...input,whatsapp:'123'}));
});
