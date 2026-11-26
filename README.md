# Social Campaign Worker AI

Panel web (Cloudflare Worker + D1) para cargar grupos de Facebook, campañas (texto + fotos) y programar publicaciones, más una **extensión de Chrome** (el worker) que ejecuta esas publicaciones con tu propia sesión de Facebook.

```
Panel (Cloudflare)  ──cola de tareas──▶  Extensión de Chrome  ──tu sesión──▶  Grupos de Facebook
```

## Panel (Cloudflare)
- `src/index.js`: API + servidor del panel. `src/panel.js`: la interfaz (HTML/CSS/JS puro, sin librerías).
- Se despliega con GitHub Actions (`deploy-worker.yml`) al hacer push a `main`.
- Secretos en Cloudflare: `SOCIAL_ADMIN_TOKEN` (tu clave de administrador) y `GEMINI_API_KEY`.
- El panel entra solo: la clave sale del secreto `SOCIAL_ADMIN_TOKEN` y no se escribe en ningún archivo del repo.
- Las tablas de D1 se crean/actualizan solas. Las fotos se reducen en el navegador y se guardan en D1.

## Los dos archivos .bat
Funciona en Windows 7/8/10/11 con Chrome. No hace falta Node.js nuevo para el worker.

### 2-Subir-a-GitHub.bat — reemplaza todo el repositorio y publica el panel
Necesita Node.js (sirve cualquier versión, incluso muy vieja).
1. Una sola vez: en GitHub creá una **OAuth App** (https://github.com/settings/developers → New OAuth App), tildá **Enable Device Flow** y copiá el **Client ID**.
2. Abrí el `.bat`. Pide `usuario/repositorio` (el Client ID solo si no encuentra uno guardado).
3. Si no hay una sesión guardada, muestra un **código** (`XXXX-XXXX`) y abre https://github.com/login/device: ingresalo y autorizá.
4. Sube todos los archivos reemplazando el contenido del repo (el historial anterior queda en GitHub). Al subir a `main`, GitHub Actions publica el Worker en Cloudflare y el `.bat` avisa cuando terminó. Recargá el panel con Ctrl+F5.

### 1-Instalar-Worker-en-Chrome.bat — el worker que publica en Facebook
Es una extensión de Chrome (carpeta `extension/`) que usa tu sesión de Facebook ya iniciada.
1. Abrí el `.bat`: abre la carpeta `extension` y `chrome://extensions`.
2. Activá "Modo de desarrollador" → "Cargar descomprimida" → elegí la carpeta `extension`.
3. En la extensión, pegá la URL del panel y la clave de administrador → Guardar.
4. Dejá Chrome abierto. Cada minuto busca tareas listas y las publica en una ventana aparte, que se cierra sola.
5. "Modo prueba" arma la publicación de la próxima tarea sin publicarla: usalo primero.

## Cómo trabaja
- Entra al grupo, abre "Escribe algo…", pega el texto, adjunta las fotos y publica.
- Pausa de 90–240 s entre grupos y tope de 15 publicaciones por día (`minDelaySec`, `maxDelaySec`, `maxPerDay` en `extension/background.js`).
- Si Facebook pide verificación o CAPTCHA, se frena 15 minutos y espera a que lo resuelvas vos; no intenta saltearlo.
- Los errores aparecen en *Actividad* del panel y en el registro de la extensión.

## Aviso
Facebook no ofrece una API oficial para publicar en grupos y sus condiciones restringen la automatización: publicar en muchos grupos seguido puede generar bloqueos de la cuenta. Usá pausas largas, pocos grupos por día y solo grupos que permitan publicidad.
