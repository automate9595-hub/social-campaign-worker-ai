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
    throw new Error("Falta configurar GEMINI_API_KEYS en Cloudflare.");
  }

  const models = [
    "gemini-3-flash-preview",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
  ];

  const prompt = `
Convertí el texto en una publicación comercial atractiva para redes sociales.

REGLAS:
- No inventes información.
- No alteres precios, nombres, productos ni condiciones.
- Mejorá la redacción.
- Usá emojis moderadamente.
- Entregá únicamente el texto final de la publicación.

TEXTO ORIGINAL:
${text}
`;

  let lastError = "No se pudo obtener respuesta de Gemini.";
  let attempts = 0;
  const maxAttempts = Math.min(keys.length * models.length, 4);

  for (const model of models) {
    for (const key of keys) {
      if (attempts >= maxAttempts) break;
      attempts++;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);

        let res;

        try {
          res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
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
                generationConfig: {
                  temperature: 0.7,
                  maxOutputTokens: 1024,
                },
              }),
              signal: controller.signal,
            }
          );
        } finally {
          clearTimeout(timeout);
        }

        const data = await res.json().catch(() => ({}));

        if (res.ok) {
          const result =
            data?.candidates?.[0]?.content?.parts
              ?.map((part) => part.text || "")
              .join("\n") || "";

          if (result.trim()) {
            return result.trim();
          }

          lastError = `El modelo ${model} no devolvió texto.`;
          continue;
        }

        lastError =
          data?.error?.message ||
          `Google respondió HTTP ${res.status}.`;

        // Se continúa ante problemas temporales, de modelo o cuota.
        if (
          res.status === 429 ||
          res.status === 500 ||
          res.status === 502 ||
          res.status === 503 ||
          res.status === 504 ||
          res.status === 404
        ) {
          continue;
        }

        // Error de autenticación, permisos u otra configuración.
        if (res.status === 400 || res.status === 401 || res.status === 403) {
          lastError = `Google API (${res.status}): ${lastError}`;
          continue;
        }
      } catch (error) {
        lastError =
          error.name === "AbortError"
            ? "Google demoró más de 12 segundos en responder."
            : error.message || "Error de conexión con Google.";
      }
    }

    if (attempts >= maxAttempts) break;
  }

  throw new Error(
    `Gemini no respondió después de ${attempts} intentos. Último error: ${lastError}`
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
button:disabled{
  opacity:.5;
  cursor:wait;
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

<button id="rewriteBtn" onclick="rewrite()">Mejorar texto con IA</button>
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
  const btn=document.getElementById('rewriteBtn');
  const out=document.getElementById('result');

  if(!text.trim()){
    alert('Escribí primero el texto.');
    return;
  }

  btn.disabled=true;
  out.textContent='Consultando Gemini. Esto puede tardar...';

  try{
    const r=await fetch('/api/rewrite',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({text})
    });

    const d=await r.json();
    if(!r.ok)throw new Error(d.error||'Error desconocido');

    document.getElementById('text').value=d.text;
    out.textContent='Texto mejorado correctamente.';
  }catch(e){
    out.textContent='ERROR: '+e.message;
  }finally{
    btn.disabled=false;
  }
}

async function save(){
  const title=document.getElementById('title').value.trim();
  const text=document.getElementById('text').value.trim();
  const out=document.getElementById('result');

  if(!text){
    alert('Ingresá un texto.');
    return;
  }

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
      if (path === "/" && request.method === "GET") {
        return html(PANEL);
      }

      if (path === "/api/status" && request.method === "GET") {
        return response({
          ok: true,
          service: "Social Campaign Worker AI",
          timestamp: new Date().toISOString(),
          gemini_configured: Boolean(env.GEMINI_API_KEYS),
          database_configured: Boolean(env.DB),
        });
      }

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

      if (path === "/api/cron" && request.method === "GET") {
        return response({
          ok: true,
          message: "Cron endpoint activo. La ejecución de publicaciones aún no está implementada.",
        });
      }

      return response({ error: "Ruta no encontrada." }, 404);

    } catch (error) {
      return response({
        ok: false,
        error: error.message || "Error interno.",
      }, 500);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      Promise.resolve().then(() => {
        console.log("Scheduler ejecutado:", new Date().toISOString());
      })
    );
  },
};
