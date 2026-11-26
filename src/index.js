const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

function response(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function html(content) {
  return new Response(content, {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

async function rewriteWithGemini(env, text) {
  const keys = (env.GEMINI_API_KEYS || "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  if (!keys.length) {
    throw new Error("No está configurado GEMINI_API_KEYS.");
  }

  const prompt = `
Reescribí el siguiente texto para una publicación comercial atractiva
para redes sociales.

Reglas:
- Conservá exactamente los datos reales.
- No inventes precios, productos, promociones, características ni condiciones.
- Utilizá un tono comercial natural.
- Utilizá emojis cuando sean apropiados.
- Entregá solamente el texto final.

Texto original:
${text}
`;

  let lastError = "";

  for (const key of keys) {
    try {
      const res = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": key,
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
          }),
        }
      );

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        const result =
          data?.candidates?.[0]?.content?.parts
            ?.map((part) => part.text || "")
            .join("\n") || "";

        if (!result.trim()) {
          throw new Error("Gemini no devolvió contenido.");
        }

        return result.trim();
      }

      lastError =
        data?.error?.message ||
        `Error de Gemini HTTP ${res.status}`;

      // Se prueba otra clave únicamente ante errores transitorios
      // de cuota, disponibilidad o servidor.
      if (
        res.status !== 429 &&
        res.status !== 500 &&
        res.status !== 502 &&
        res.status !== 503 &&
        res.status !== 504
      ) {
        throw new Error(lastError);
      }
    } catch (error) {
      lastError = error.message || "Error de conexión con Gemini";
    }
  }

  throw new Error(
    "Se agotaron las claves disponibles de Gemini. " + lastError
  );
}

const PANEL = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Social Campaign AI</title>
<style>
*{box-sizing:border-box}
body{
  margin:0;
  background:#10131b;
  color:#f1f5f9;
  font-family:Arial,sans-serif;
}
header{
  padding:22px;
  background:#171d29;
  border-bottom:1px solid #293243;
}
h1{margin:0;color:#00e5ff}
main{
  max-width:850px;
  margin:auto;
  padding:20px;
}
.card{
  background:#171d29;
  border:1px solid #293243;
  border-radius:14px;
  padding:18px;
  margin-bottom:18px;
}
label{
  display:block;
  margin:12px 0 8px;
  font-weight:bold;
}
input,textarea,button{
  width:100%;
  padding:13px;
  border-radius:9px;
  border:1px solid #344155;
  background:#10131b;
  color:white;
  font-size:16px;
}
textarea{
  min-height:140px;
  resize:vertical;
}
button{
  margin-top:12px;
  background:#00bcd4;
  color:#07131a;
  font-weight:bold;
  border:none;
  cursor:pointer;
}
button.secondary{
  background:#293243;
  color:white;
}
#result,#status{
  white-space:pre-wrap;
  overflow-wrap:anywhere;
  margin-top:14px;
}
.item{
  border-bottom:1px solid #293243;
  padding:12px 0;
}
small{color:#aab5c5}
</style>
</head>
<body>
<header>
<h1>Social Campaign AI</h1>
<small>Panel de campañas y publicaciones</small>
</header>

<main>
<div class="card">
<h2>Nueva publicación</h2>

<label>Nombre de la campaña</label>
<input id="title" placeholder="Ej: Promoción de noviembre">

<label>Texto de la publicación</label>
<textarea id="text" placeholder="Escribí el texto de tu publicación..."></textarea>

<button onclick="rewrite()">Mejorar texto con IA</button>
<button class="secondary" onclick="save()">Guardar borrador</button>

<div id="result"></div>
</div>

<div class="card">
<h2>Estado del sistema</h2>
<button class="secondary" onclick="checkStatus()">Consultar estado</button>
<div id="status"></div>
</div>

<div class="card">
<h2>Borradores guardados</h2>
<button class="secondary" onclick="loadDrafts()">Actualizar borradores</button>
<div id="drafts"></div>
</div>
</main>

<script>
async function rewrite(){
  const text=document.getElementById('text').value;
  if(!text.trim()){
    alert('Escribí primero el texto.');
    return;
  }
  const out=document.getElementById('result');
  out.textContent='Procesando con Gemini...';

  try{
    const r=await fetch('/api/rewrite',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({text})
    });
    const d=await r.json();
    if(!r.ok)throw new Error(d.error||'Error');
    document.getElementById('text').value=d.text;
    out.textContent='Texto mejorado.';
  }catch(e){
    out.textContent='Error: '+e.message;
  }
}

async function save(){
  const title=document.getElementById('title').value.trim();
  const text=document.getElementById('text').value.trim();

  if(!text){
    alert('Ingresá un texto.');
    return;
  }

  const out=document.getElementById('result');
  out.textContent='Guardando...';

  try{
    const r=await fetch('/api/drafts',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({title,text})
    });
    const d=await r.json();
    if(!r.ok)throw new Error(d.error||'Error');
    out.textContent='Borrador guardado correctamente.';
    loadDrafts();
  }catch(e){
    out.textContent='Error: '+e.message;
  }
}

async function loadDrafts(){
  const box=document.getElementById('drafts');
  box.textContent='Cargando...';

  try{
    const r=await fetch('/api/drafts');
    const d=await r.json();
    if(!r.ok)throw new Error(d.error||'Error');

    if(!d.drafts||!d.drafts.length){
      box.textContent='Todavía no hay borradores.';
      return;
    }

    box.innerHTML='';
    d.drafts.forEach(item=>{
      const div=document.createElement('div');
      div.className='item';

      const heading=document.createElement('strong');
      heading.textContent=item.title||'Sin título';

      const paragraph=document.createElement('p');
      paragraph.textContent=item.text||'';

      const date=document.createElement('small');
      date.textContent=item.created_at||'';

      div.appendChild(heading);
      div.appendChild(paragraph);
      div.appendChild(date);
      box.appendChild(div);
    });
  }catch(e){
    box.textContent='Error: '+e.message;
  }
}

async function checkStatus(){
  const box=document.getElementById('status');
  box.textContent='Consultando...';

  try{
    const r=await fetch('/api/status');
    const d=await r.json();
    box.textContent=JSON.stringify(d,null,2);
  }catch(e){
    box.textContent='Error: '+e.message;
  }
}

loadDrafts();
checkStatus();
</script>
</body>
</html>`;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    try {
      // Panel principal
      if (path === "/" && request.method === "GET") {
        return html(PANEL);
      }

      // Estado del Worker
      if (path === "/api/status" && request.method === "GET") {
        return response({
          ok: true,
          service: "Social Campaign Worker AI",
          timestamp: new Date().toISOString(),
          gemini_configured: Boolean(env.GEMINI_API_KEYS),
          database_configured: Boolean(env.DB),
        });
      }

      // Reescritura mediante Gemini
      if (path === "/api/rewrite" && request.method === "POST") {
        const body = await request.json();
        const text = String(body.text || "").trim();

        if (!text) {
          return response({ error: "El texto está vacío." }, 400);
        }

        const rewritten = await rewriteWithGemini(env, text);

        return response({
          ok: true,
          text: rewritten,
        });
      }

      // Listado de borradores
      if (path === "/api/drafts" && request.method === "GET") {
        if (!env.DB) {
          return response(
            { error: "No está configurada la conexión D1 (DB)." },
            500
          );
        }

        const result = await env.DB.prepare(
          "SELECT id, title, text, status, created_at FROM campaigns ORDER BY id DESC LIMIT 100"
        ).all();

        return response({
          ok: true,
          drafts: result.results || [],
        });
      }

      // Guardar borrador
      if (path === "/api/drafts" && request.method === "POST") {
        if (!env.DB) {
          return response(
            { error: "No está configurada la conexión D1 (DB)." },
            500
          );
        }

        const body = await request.json();
        const title = String(body.title || "Sin título").trim();
        const text = String(body.text || "").trim();

        if (!text) {
          return response({ error: "El texto está vacío." }, 400);
        }

        const result = await env.DB.prepare(
          "INSERT INTO campaigns (title, text, status) VALUES (?, ?, 'draft')"
        )
          .bind(title, text)
          .run();

        return response({
          ok: true,
          id: result.meta?.last_row_id,
          message: "Borrador guardado.",
        });
      }

      // Cron: base para futuras tareas programadas
      if (path === "/api/cron" && request.method === "GET") {
        return response({
          ok: true,
          message: "Cron endpoint activo. La ejecución de publicaciones aún no está implementada.",
        });
      }

      return response({
        error: "Ruta no encontrada.",
      }, 404);

    } catch (error) {
      return response({
        ok: false,
        error: error.message || "Error interno.",
      }, 500);
    }
  },

  async scheduled(event, env, ctx) {
    // Base del programador.
    // La publicación automática se desarrollará en la siguiente etapa.
    ctx.waitUntil(
      Promise.resolve().then(() => {
        console.log("Scheduler ejecutado:", new Date().toISOString());
      })
    );
  },
};
