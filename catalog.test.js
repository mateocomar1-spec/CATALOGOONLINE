import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProducts,filterProducts,whatsappUrl,orderMessage,demoProducts} from './catalog.js';
test('búsqueda sin acentos, categorías y precios',()=>{assert.equal(filterProducts(demoProducts,'metrica','Todos','featured')[0].id,'4');assert.equal(filterProducts(demoProducts,'','Pinturería','price-asc')[0].price,3900);});
test('la fuente de precios rechaza números inválidos e IDs duplicados',()=>{assert.throws(()=>normalizeProducts([{id:'x',name:'X',price:'no'}]));assert.throws(()=>normalizeProducts([{id:'x',name:'X',price:1},{id:'x',name:'Y',price:2}]));assert.equal(normalizeProducts([{id:1,name:'A',price:0,stock:false}])[0].stock,false);});
test('WhatsApp requiere número válido y codifica cantidades y total',()=>{assert.equal(whatsappUrl('','hola'),null);const text=orderMessage([{product:demoProducts[0],quantity:2}],{name:'Prueba'},n=>'$'+n);assert.match(text,/2 × Taladro/);assert.match(text,/157800/);assert.equal(new URL(whatsappUrl('+54 9 11 1234 5678',text)).searchParams.get('text'),text);});
