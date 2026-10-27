# Abrir el catálogo y el panel desde una dirección pública

El paquete ya está preparado en `artifacts/catalogo-ferreteria.zip`. Incluye únicamente archivos públicos compilados, la conexión pública a Supabase y las cabeceras de seguridad. No contiene contraseñas, SQL ni archivos del servidor. La web todavía no está publicada por preparar este archivo.

## Netlify: publicación manual sin Git

1. Entrá con **tu propia cuenta** en https://app.netlify.com/drop. No compartas la contraseña ni tokens por chat.
2. Descargá `catalogo-ferreteria.zip` y descomprimilo. Buscá la carpeta que contiene directamente `index.html`, `admin.html`, `_headers` y `_redirects`. En algunos sistemas los archivos que comienzan con guion bajo pueden requerir mostrar todos los archivos: no los borres.
3. Arrastrá **esa carpeta completa** a la zona de publicación de Netlify. No subas el repositorio completo ni solo `index.html`.
4. Esperá la confirmación de publicación y copiá la dirección HTTPS que te asigne Netlify. Se puede cambiar el nombre del sitio desde su configuración si está disponible.
5. Abrí esa dirección para ver el catálogo. Al final de la página está **Administrar catálogo**; ese enlace abre `/admin` en la misma web. También podés añadir `/admin` a la dirección asignada.
6. Ingresá con tu usuario de Supabase, configurá el autenticador y completá los datos reales y productos.

Para actualizar la web, ejecutar `npm ci`, `npm run package:deploy` (requiere Python 3), descomprimir el ZIP nuevo y subir su carpeta a la sección de despliegues **del mismo sitio**. Cambiar precios o datos desde el panel no exige volver a publicar el código.

## Publicación automática desde Git

El repositorio incluye `netlify.toml` y `vercel.json`. El código ya está subido a GitHub en la rama `main`. Desde tu cuenta de Netlify o Vercel, importar `mateocomar1-spec/CATALOGOONLINE`. Configuración: Node 24, comando `npm run build`, carpeta pública `dist`. El código y el ZIP se publicaron en GitHub en el commit inicial `7d8ad07`. La existencia del ZIP no confirma un despliegue web.

Netlify obtiene cabeceras y rutas de `dist/_headers` y `dist/_redirects`. Vercel las aplica desde `vercel.json`. No subir el ZIP manualmente a Vercel: usar su importación del repositorio o una CLI autenticada.

## Comprobar después de publicar

- La dirección pública del catálogo y `/admin` deben abrir con HTTPS. El panel también puede abrirse desde `/admin.html`.
- Confirmar que el catálogo consulta el proyecto de Supabase correcto, sin mostrar el aviso de demostración. Si todavía no hay productos publicados, la lista estará vacía.
- Ingresar al panel con contraseña y segundo factor, crear un producto de prueba, publicarlo, recargar el catálogo y comprobar precio y disponibilidad.
- Configurar el WhatsApp real y probar el pedido. La persona que atiende confirma stock, pago y entrega.
- Verificar las cabeceras de seguridad en el sitio publicado, especialmente `Content-Security-Policy`, y que rutas como `/.env`, `/server.js` y `/supabase/migrations/001_catalog.sql` no entreguen archivos internos.
- Configurar respaldos en Supabase y probar recuperación antes de recibir pedidos reales. La publicación web no configura backups.

La aplicación usa login directo y TOTP. No depende de enlaces de invitación ni recuperación por email; esos flujos todavía no están implementados. No desactivar MFA para resolver un problema de acceso.
