# Catálogo de ferretería · Supabase
Catálogo público adaptable a celulares, búsqueda, categorías, bolsa persistente y pedido por WhatsApp. Panel privado para productos, precios, disponibilidad, publicación y datos del negocio. El pago y la entrega se coordinan por WhatsApp; la web no procesa tarjetas ni confirma pagos.

## Desarrollo
Requiere Node.js 20 o superior.

```sh
npm ci
npm run dev
```
`npm run dev` recompila los módulos al editar. `npm start` compila e inicia el servidor; `PORT` permite cambiar el puerto 3000. Catálogo en `/` y administración en `/admin`. Las sesiones administrativas permanecen en memoria: recargar la página obliga a ingresar otra vez.

```sh
npm test
npm run test:browser
```
Las pruebas de permisos ejecutan la migración real en PostgreSQL local mediante PGlite, con roles y JWT simulados para verificar RLS. Las de navegador usan Chromium y respuestas simuladas de Supabase para comprobar los formularios, MFA, carrito y estados de error. No sustituyen la verificación contra el proyecto real. Chromium debe estar instalado (`CHROMIUM_PATH=/ruta/a/chromium`); si no existe, instalarlo por el procedimiento oficial de Playwright y ajustar esa variable.

## Conectar el proyecto real
La URL y clave **publishable** proporcionadas por el propietario están configuradas en `config.js`. Son públicas; por sí solas no conceden permisos de escritura. No incluir claves `secret`, `service_role`, contraseñas ni conexiones PostgreSQL en el frontend.

### 1. Crear tablas y permisos
En el **SQL Editor** de tu proyecto de Supabase, crear una consulta y ejecutar todo el archivo [001_catalog.sql](supabase/migrations/001_catalog.sql). Es la migración inicial y se ejecuta una sola vez. Si ya existen tablas con esos nombres, revisar su esquema antes de ejecutarla: no borrar datos para resolver conflictos. La transacción revierte todo ante un error.

La migración crea:
- `public.products`: información comercial pública. Los borradores son privados.
- `public.store_settings`: nombre, WhatsApp, dirección, horarios, moneda y formato regional. Todos sus campos son públicos.
- `private.catalog_admins`: usuarios autorizados, administrados solo por el propietario desde SQL.
- `private.catalog_audit`: registro de quién cambió qué, cuándo y los valores anteriores y nuevos.

No agregar costos internos, clientes, comprobantes ni secretos a las tablas públicas. Para datos privados futuros, crear tablas separadas con políticas específicas.

### 2. Configurar autenticación
En **Authentication**:
1. Habilitar email/contraseña y TOTP en la configuración de MFA.
2. Desactivar nuevos registros públicos y proveedores que no se utilicen. La aplicación no ofrece registro.
3. Crear tu cuenta desde **Users → Add user → Create new user**, con una contraseña única y fuerte. No usar una invitación por enlace: esta versión usa ingreso directo con contraseña y no implementa la aceptación de invitaciones ni recuperación por email.
4. Ejecutar [authorize-admin.sql](supabase/authorize-admin.sql) en SQL Editor reemplazando el email de ejemplo por el de esa cuenta.
5. Abrir `/admin`, ingresar y vincular un autenticador con el QR. El segundo factor es obligatorio incluso si se intenta modificar la base sin usar el panel.

Crear cada administrador con su propia cuenta. Para quitar acceso, borrar su membresía desde SQL:

```sql
delete from private.catalog_admins
where user_id = (select id from auth.users where lower(email) = lower('EMAIL_A_REVOCAR'));
```

La revocación afecta la siguiente consulta incluso si el token aún no expiró. Si alguien pierde contraseña o autenticador, el propietario debe verificar su identidad y gestionar la recuperación mediante las herramientas administrativas de Supabase. No quitar el requisito de MFA ni compartir cuentas. La recuperación automática por email no está implementada.

### 3. Cargar los datos del negocio
En el panel, completar nombre y número de WhatsApp real con país y área. Crear productos como borradores y marcar **Publicado** cuando estén listos. Desmarcar **Disponible** evita agregarlo al pedido. Despublicar retira un producto sin borrarlo.

Los precios aceptan hasta dos decimales. Código único e inmutable, por ejemplo `TAL-001`. Las imágenes deben tener una URL HTTPS pública. Su proveedor puede recibir solicitudes de los visitantes: usar un alojamiento de confianza. No se incluye subida de archivos ni importación masiva en esta versión.

Cada guardado comprueba `updated_at`: si otro administrador modificó el registro, se rechaza el guardado en lugar de sobrescribirlo. Volver a cargar la lista o los datos, revisar el nuevo valor y editar nuevamente.

## Seguridad implementada
- RLS habilitada en productos y configuración. Visitantes solo leen productos publicados y datos públicos del negocio.
- Una cuenta autenticada necesita membresía privada **y** JWT `aal2` (MFA) para modificar datos o leer borradores e historial.
- El usuario no puede concederse permisos. Las funciones administrativas tienen `search_path` fijo y permisos explícitos.
- No hay borrado de productos desde el cliente ni escritura en el historial. Las actualizaciones generan auditoría mediante triggers dentro de la misma transacción.
- Validaciones de datos en la base y en los formularios; datos renderizados con `textContent`, sin HTML de productos.
- Credenciales administrativas en memoria, sin almacenamiento persistente. El carrito solo conserva códigos y cantidades; vuelve a cargar precios desde la base.
- CSP y cabeceras contra inclusión en marcos, interpretación incorrecta de archivos y filtrado de referer en el servidor incluido. Solo sirve archivos compilados de `dist`.

Estas medidas deben verificarse también en el proyecto desplegado: la clave pública no reemplaza las políticas. El propietario y las claves secretas de Supabase pueden eludir RLS y necesitan protección independiente.

## Publicación
Ejecutar `npm ci && npm run build` y publicar **solo `dist/`** en un alojamiento HTTPS, o ejecutar `npm start` detrás de un proxy HTTPS. El servidor incluido aplica cabeceras; si se usa alojamiento estático, configurar las mismas cabeceras de `server.js` en ese proveedor y una ruta `/admin` hacia `/admin.html`.

Autorizar en la red del entorno el dominio exacto del proyecto `bminpnrpfkcqfuqopzcx.supabase.co` y `registry.npmjs.org` para dependencias. No se necesitan claves secretas para iniciar el catálogo. No publicar archivos SQL, tests, `node_modules` ni la carpeta de integración anterior con Sheets. Los archivos `apps-script/` se conservan solo como referencia histórica y ya no se utilizan.

## Verificación antes de recibir pedidos reales
1. Sin iniciar sesión: consultar publicados, comprobar que los borradores no aparezcan e intentar una escritura con la clave pública (debe fallar).
2. Con una cuenta común y un administrador sin MFA: comprobar que no se pueda editar.
3. Con administrador y MFA: crear un borrador, publicarlo, cambiar precio y revisar historial. Comprobar conflicto de edición entre dos sesiones.
4. Recargar el catálogo, armar un pedido y verificar número de WhatsApp, cantidades y precios. El personal confirma stock y total antes de cobrar.
5. Verificar los controles de registro, límites de autenticación, protección de contraseña y MFA de la cuenta propietaria de Supabase. Añadir CAPTCHA si el tráfico o los intentos de abuso lo requieren; no está integrado en esta versión.

Sin configuración o cuando falla la lectura de la base, se muestran productos de demostración identificados y se bloquean pedidos. Si la base responde correctamente pero está vacía, se muestra un catálogo vacío. No se mezclan ejemplos con productos reales.

## Copias de seguridad y recuperación
La migración y la auditoría **no son respaldos**. Antes de producción, el propietario debe elegir y activar la política de backups de Supabase disponible en su plan y definir la retención; verificar si incluye recuperación a un punto en el tiempo (PITR). Mantener además una copia lógica cifrada fuera del proyecto según la necesidad del negocio. No guardar volcados en Git ni en el alojamiento público.

Comprobar una restauración en un proyecto separado antes del lanzamiento y periódicamente. La auditoría y la lista de administradores están en `private`: incluir ese esquema en las copias lógicas. Auth y archivos de Storage tienen consideraciones separadas; seguir el procedimiento vigente de Supabase para el tipo de respaldo utilizado. Esta tarea no activa backups ni ha probado una restauración en tu proyecto.

## Publicación guiada
Ver [PUBLICACION.md](PUBLICACION.md) para obtener una dirección HTTPS en Netlify o Vercel. `npm run package:deploy` genera el ZIP para publicación manual en Netlify (descomprimir y subir su carpeta). El catálogo incluye el enlace **Administrar catálogo** en el pie de página.
