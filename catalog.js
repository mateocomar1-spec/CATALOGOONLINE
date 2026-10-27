export const demoStore = { name:'La Central', whatsapp:'', address:'', hours:'', currency:'ARS', locale:'es-AR' };
export const demoProducts = [
{id:'1',name:'Taladro percutor 13 mm',category:'Herramientas eléctricas',price:78900,unit:'Por unidad · 650 W',emoji:'🛠️',featured:true,stock:true},
{id:'2',name:'Martillo de carpintero',category:'Herramientas manuales',price:12500,unit:'Por unidad · 500 g',emoji:'🔨',featured:false,stock:true},
{id:'3',name:'Set de llaves combinadas',category:'Herramientas manuales',price:34900,unit:'Set de 12 piezas',emoji:'🔧',featured:true,stock:true},
{id:'4',name:'Cinta métrica 5 metros',category:'Medición',price:6800,unit:'Por unidad · Con freno',emoji:'📏',featured:false,stock:true},
{id:'5',name:'Tornillos para madera',category:'Fijaciones',price:4200,unit:'Caja de 100 unidades',emoji:'🔩',featured:false,stock:true},
{id:'6',name:'Pintura látex interior',category:'Pinturería',price:28500,unit:'Por balde · Blanco · 4 L',emoji:'🪣',featured:false,stock:true},
{id:'7',name:'Pincel de cerda 2 pulgadas',category:'Pinturería',price:3900,unit:'Por unidad · Uso general',emoji:'🖌️',featured:false,stock:true},
{id:'8',name:'Guantes de trabajo reforzados',category:'Seguridad',price:5600,unit:'Por par · Talle universal',emoji:'🧤',featured:false,stock:true}
];
export function normalizeProducts(products) {
 if(!Array.isArray(products)) throw new Error('Formato de productos inválido');
 const ids=new Set();
 return products.map(p=>{
  const id=String(p.id??'').trim();const price=typeof p.price==='number'?p.price:Number(String(p.price??'').trim());
  if(!id||ids.has(id)||!String(p.name??'').trim()||!Number.isFinite(price)||price<0) throw new Error('Revisá ID, nombre y precio de los productos');
  ids.add(id);return {...p,id,name:String(p.name).trim(),category:String(p.category||'General'),unit:String(p.unit||'Por unidad'),price,stock:![false,'false',0,'0','FALSE'].includes(p.stock),featured:[true,'true',1,'1','TRUE'].includes(p.featured)};
 });
}
export function filterProducts(products,query,category,sort) {
 const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const list=products.filter(p=>(category==='Todos'||p.category===category)&&norm(p.name+' '+p.category).includes(norm(query.trim())));
 return list.sort((a,b)=>sort==='price-asc'?a.price-b.price:sort==='price-desc'?b.price-a.price:sort==='name'?a.name.localeCompare(b.name,'es'):Number(b.featured)-Number(a.featured));
}
export function whatsappUrl(number,message){const phone=String(number).replace(/\D/g,'');if(!/^[1-9]\d{7,14}$/.test(phone)) return null;return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;}
export function orderMessage(items,store,format){return `¡Hola, ${store.name}! Quisiera hacer este pedido:\n\n`+items.map(({product:p,quantity:q})=>`• ${q} × ${p.name} (${p.id}) — ${format(p.price*q)}`).join('\n')+`\n\nTotal estimado: ${format(items.reduce((sum,{product:p,quantity:q})=>sum+p.price*q,0))}\n\n¿Me confirman disponibilidad, formas de pago y entrega?`;}
