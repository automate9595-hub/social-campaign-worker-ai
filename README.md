# Social Campaign Worker AI — Base inicial

Incluye Worker de Cloudflare, panel sencillo, endpoint de Gemini, guardado de borradores en D1 y workflows de GitHub Actions para validación y deploy.

## Archivos que contiene
- `src/index.js`: Worker y panel.
- `schema.sql`: tablas para campañas, destinos y tareas.
- `wrangler.toml`: configuración de Worker/D1/Cron.
- `.github/workflows/worker-check.yml`: validación automática.
- `.github/workflows/deploy-worker.yml`: publicación desde Actions.

## Preparación pendiente antes del deploy
1. Crear una base D1 llamada `social-campaign-db` en Cloudflare.
2. Ejecutar `schema.sql` en esa base.
3. Copiar el ID de la base a `wrangler.toml` en `REPLACE_WITH_D1_DATABASE_ID`.
4. En Cloudflare, configurar la variable secreta `GEMINI_API_KEY` para el Worker.
5. Para deploy desde GitHub Actions, crear secrets de repositorio `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`.

## Nota
Esta es una base de arranque, no una plataforma terminada. No publica automáticamente en redes ni contiene conectores de redes sociales o automatización gráfica todavía. Las publicaciones requieren conectores compatibles, permisos y controles apropiados. No se incluye automatización para eludir límites, CAPTCHAs o controles de plataformas.
