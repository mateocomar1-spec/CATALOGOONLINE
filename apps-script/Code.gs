// Proyecto vinculado a la planilla: Extensiones > Apps Script.
function doGet() {
  try {
    const book = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = book.getSheetByName('Productos');
    const settings = book.getSheetByName('Configuracion');
    if (!sheet || !settings) throw new Error('Faltan hojas');
    const rows = sheet.getDataRange().getValues();
    const headers = rows.shift().map(String);
    ['id','name','category','price'].forEach(function(key) {
      if (headers.indexOf(key) < 0) throw new Error('Falta columna ' + key);
    });
    const products = rows.filter(function(row) {return String(row[0]).trim() !== '';}).map(function(row) {
      const p = {};
      headers.forEach(function(key,i) {p[key] = row[i];});
      p.id = String(p.id);
      return p;
    });
    const store = {};
    const allowed = ['name','whatsapp','address','hours','currency','locale'];
    settings.getDataRange().getValues().slice(1).forEach(function(row) {
      if (allowed.indexOf(String(row[0])) >= 0) store[String(row[0])] = String(row[1]);
    });
    return json_({products:products,store:store});
  } catch (error) {
    console.error(error);
    return json_({error:'No se pudo leer el catálogo. Revisá las hojas y sus encabezados.'});
  }
}
function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
