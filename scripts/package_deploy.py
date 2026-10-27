"""Empaquetar únicamente los archivos públicos compilados para Netlify Drop."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parent.parent
source = root / 'dist'
files = sorted(source.iterdir())
required = {'index.html', 'admin.html', 'app.js', 'admin.js', 'config.js', '_headers', '_redirects'}
if not required.issubset({file.name for file in files}):
    raise SystemExit('Faltan archivos compilados. Ejecutá npm run build primero.')
if any(not file.is_file() or file.is_symlink() for file in files):
    raise SystemExit('El paquete solo admite archivos públicos regulares.')
if any(file.name.startswith('.') or file.suffix in {'.sql', '.map'} for file in files):
    raise SystemExit('Se detectaron archivos que no deben publicarse.')
output = root / 'artifacts' / 'catalogo-ferreteria.zip'
output.parent.mkdir(exist_ok=True)
with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
    for file in files:
        archive.write(file, file.name)
print(f'Paquete listo: {output}')
