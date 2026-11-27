import { HTML } from "./panel.js";

/* ------------------------------------------------------------------ */
/*  Utilidades                                                         */
/* ------------------------------------------------------------------ */

const SECURITY_HEADERS = {
 "X-Content-Type-Options": "nosniff",
 "Referrer-Policy": "no-referrer",
 "Cache-Control": "no-store"
};

function json(data, status = 200) {
 return new Response(JSON.stringify(data), {
  status,
  headers: { ...SECURITY_HEADERS, "Content-Type": "application/json" }
 });
}

// La clave de administrador sale del secreto SOCIAL_ADMIN_TOKEN de Cloudflare
// y se inyecta en el panel al servirlo: no hay que escribirla y no queda
// guardada en el repositorio.
function html(env) {
 const token = JSON.stringify(String(env.SOCIAL_ADMIN_TOKEN || "")).replace(/</g, "\\u003c");
 return new Response(HTML.replace('"__ADMIN_TOKEN__"', () => token), {
  headers: { ...SECURITY_HEADERS, "Content-Type": "text/html;charset=UTF-8" }
 });
}

function safeEq(a, b) {
 if (a.length !== b.length) return false;
 let r = 0;
 for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
 return r === 0;
}

const MAX_IMAGES_PER_CAMPAIGN = 6;
const MAX_B64_LENGTH = 1500000;

/* ------------------------------------------------------------------ */
/*  Esquema (se crea / completa solo, no hay que ejecutar SQL a mano)  */
/* ------------------------------------------------------------------ */

let schemaReady = null;

function ensureSchema(env) {
 if (schemaReady) return schemaReady;
 schemaReady = (async () => {
  const db = env.DB;
  await db.batch([
   db.prepare("CREATE TABLE IF NOT EXISTS sc_destinations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, platform TEXT NOT NULL DEFAULT 'facebook', destination_type TEXT NOT NULL DEFAULT 'group', destination_url TEXT, enabled INTEGER NOT NULL DEFAULT 1)"),
   db.prepare("CREATE TABLE IF NOT EXISTS sc_campaigns (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, content TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', start_date TEXT, end_date TEXT)"),
   db.prepare("CREATE TABLE IF NOT EXISTS sc_jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, campaign_id INTEGER NOT NULL, destination_id INTEGER, scheduled_at TEXT, status TEXT NOT NULL DEFAULT 'pending')"),
   db.prepare("CREATE TABLE IF NOT EXISTS sc_media (id INTEGER PRIMARY KEY AUTOINCREMENT, campaign_id INTEGER NOT NULL, mime TEXT NOT NULL, data TEXT NOT NULL, thumb TEXT, size INTEGER)"),
   db.prepare("CREATE TABLE IF NOT EXISTS sc_kv (k TEXT PRIMARY KEY, v TEXT)")
  ]);

  const info = await db.prepare("PRAGMA table_info(sc_jobs)").all();
  const have = (info.results || []).map(r => r.name);
  const wanted = [
   ["attempts", "INTEGER NOT NULL DEFAULT 0"],
   ["last_error", "TEXT"],
   ["started_at", "TEXT"],
   ["finished_at", "TEXT"],
   ["post_note", "TEXT"],
   ["plan_id", "TEXT"]
  ];
  for (const [name, type] of wanted) {
   if (!have.includes(name)) await db.prepare("ALTER TABLE sc_jobs ADD COLUMN " + name + " " + type).run();
  }

  // Las tareas viejas se guardaron con hora local (sin "Z"). Se convierten una
  // sola vez a UTC (Argentina = UTC-3) para que no salgan a la hora equivocada.
  const done = await db.prepare("SELECT v FROM sc_kv WHERE k='tz_migrated'").first();
  if (!done) {
   await db.prepare(
    "UPDATE sc_jobs SET scheduled_at=strftime('%Y-%m-%dT%H:%M:00.000Z',datetime(replace(substr(scheduled_at,1,16),'T',' '),'+3 hours')) " +
    "WHERE scheduled_at IS NOT NULL AND scheduled_at NOT LIKE '%Z' AND datetime(replace(substr(scheduled_at,1,16),'T',' ')) IS NOT NULL"
   ).run();
   await db.prepare("INSERT OR REPLACE INTO sc_kv (k,v) VALUES ('tz_migrated','1')").run();
  }
 })().catch(e => { schemaReady = null; throw e; });
 return schemaReady;
}

async function promoteDue(env) {
 const nowIso = new Date().toISOString();
 const stale = new Date(Date.now() - 8 * 60000).toISOString();
 // Una tarea "running" de mas de 8 min quedo colgada: no se repite sola para no duplicar.
 await env.DB.prepare("UPDATE sc_jobs SET status='failed',last_error='Quedó interrumpida. Revisá el grupo antes de reintentar.' WHERE status='running' AND started_at<?").bind(stale).run();
 // Del calendario: si la PC estuvo apagada, lo atrasado mas de 12 h no se publica todo junto.
 await env.DB.prepare("UPDATE sc_jobs SET status='failed',last_error='No salio a tiempo (PC apagada o sin conexion).' WHERE plan_id IS NOT NULL AND status IN ('pending','ready') AND scheduled_at<?")
  .bind(new Date(Date.now() - 12 * 3600000).toISOString()).run();
 const r = await env.DB.prepare("UPDATE sc_jobs SET status='ready' WHERE status='pending' AND scheduled_at<=?").bind(nowIso).run();
 return r.meta?.changes || 0;
}

/* ------------------------------------------------------------------ */
/*  Gemini                                                             */
/* ------------------------------------------------------------------ */

async function rewriteText(content, env, instruction) {
 const keys = (env.GEMINI_API_KEYS || env.GEMINI_API_KEY || "")
  .split(",").map(x => x.trim()).filter(Boolean);
 if (!keys.length) throw Error("Falta GEMINI_API_KEYS.");

 const models = [...new Set([env.GEMINI_MODEL, "gemini-3.6-flash", "gemini-3.8-flash", "gemini-3.5-flash-lite"].filter(Boolean))];
 let last = "No se pudo generar el texto.";

 for (const key of keys) {
  for (const model of models) {
   try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    const r = await fetch(
     "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + encodeURIComponent(key),
     {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
       contents: [{ parts: [{ text: instruction ? instruction + "\n\n" + content :
        "Reescribí el siguiente texto para una publicación comercial de redes sociales. " +
        "Conservá fielmente los datos, no inventes precios, promociones, productos ni hechos. " +
        "Usá un tono atractivo, claro y natural. Respondé únicamente con el texto final.\n\n" + content
       }] }]
      })
     }
    );
    clearTimeout(timeout);
    const data = await r.json();
    if (!r.ok) { last = data?.error?.message || "Error Gemini"; continue; }
    const result = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("").trim();
    if (result) return result;
   } catch (e) { last = e.message; }
  }
 }
 throw Error(last);
}

/* ------------------------------------------------------------------ */
/*  Rutas                                                              */
/* ------------------------------------------------------------------ */

const JOB_SELECT =
 "SELECT j.id,j.campaign_id,c.content AS text,c.name AS campaign_name,d.name AS group_name,d.destination_url AS group_url " +
 "FROM sc_jobs j JOIN sc_campaigns c ON c.id=j.campaign_id JOIN sc_destinations d ON d.id=j.destination_id ";

function idFrom(path) {
 const id = Number(path.split("/").pop());
 return Number.isInteger(id) && id > 0 ? id : 0;
}

async function handle(request, env) {
 const url = new URL(request.url);
 const path = url.pathname;
 const method = request.method;

 if (method === "OPTIONS") return new Response(null, { status: 204, headers: SECURITY_HEADERS });
 if (path === "/" && method === "GET") return html(env);
 if (path === "/api/status" && method === "GET")
  return json({ ok: true, worker: "active", time: new Date().toISOString() });

 if (!env.DB) return json({ error: "No está configurada la vinculación D1 DB." }, 500);
 const auth = request.headers.get("X-Admin-Token") || "";
 if (!env.SOCIAL_ADMIN_TOKEN || !safeEq(auth, String(env.SOCIAL_ADMIN_TOKEN)))
  return json({ error: "Acceso no autorizado." }, 401);

 try {
  await ensureSchema(env);
  const nowIso = new Date().toISOString();

  /* ---------- Gemini ---------- */
  if (path === "/api/rewrite" && method === "POST") {
   const body = await request.json();
   const content = String(body.content || "").trim();
   if (!content) return json({ error: "Texto vacío." }, 400);
   return json({ content: await rewriteText(content, env) });
  }

  if (path === "/api/listing-title" && method === "POST") {
   const content = String((await request.json()).content || "").trim();
   if (!content) return json({ error: "Texto vacío." }, 400);
   const title = await rewriteText(content, env,
    "Escribí un título de venta de hasta 80 caracteres para este aviso. No inventes datos ni precios. Respondé solo con el título, sin comillas.");
   return json({ title: title.split("\n")[0].replace(/^["*# ]+|["* ]+$/g, "").slice(0, 100) });
  }

  /* ---------- Destinos ---------- */
  if (path === "/api/destinations" && method === "GET") {
   const r = await env.DB.prepare("SELECT * FROM sc_destinations ORDER BY id DESC").all();
   return json({ items: r.results || [] });
  }

  if (path === "/api/destinations" && method === "POST") {
   const body = await request.json();
   const name = String(body.name || "").trim();
   const link = String(body.url || "").trim();
   if (!name) return json({ error: "El nombre es obligatorio." }, 400);
   if (link && !/^https:\/\/([a-z0-9-]+\.)?facebook\.com\//i.test(link))
    return json({ error: "El enlace debe ser de un grupo de Facebook (https://www.facebook.com/groups/...)." }, 400);
   await env.DB.prepare(
    "INSERT INTO sc_destinations (name,platform,destination_type,destination_url,enabled) VALUES (?, 'facebook','group',?,1)"
   ).bind(name, link || null).run();
   return json({ ok: true });
  }

  if (path.startsWith("/api/destinations/") && method === "DELETE") {
   const id = idFrom(path);
   if (!id) return json({ error: "ID inválido." }, 400);
   const jobs = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM sc_jobs WHERE destination_id=? AND status IN ('pending','ready','running')"
   ).bind(id).first();
   if (jobs?.n) return json({ error: "Este grupo tiene tareas pendientes. Cancelalas primero." }, 400);
   await env.DB.prepare("DELETE FROM sc_destinations WHERE id=?").bind(id).run();
   return json({ ok: true });
  }

  if (path.startsWith("/api/destinations/") && method === "PATCH") {
   const id = idFrom(path);
   const body = await request.json();
   if (!id) return json({ error: "ID inválido." }, 400);
   await env.DB.prepare("UPDATE sc_destinations SET enabled=? WHERE id=?").bind(body.enabled ? 1 : 0, id).run();
   return json({ ok: true });
  }

  /* ---------- Campañas ---------- */
  if (path === "/api/campaigns" && method === "GET") {
   const r = await env.DB.prepare("SELECT id,name,content,status,start_date FROM sc_campaigns ORDER BY id DESC").all();
   const m = await env.DB.prepare("SELECT id,campaign_id,thumb FROM sc_media ORDER BY id").all();
   const byCamp = {};
   for (const x of m.results || []) (byCamp[x.campaign_id] ||= []).push({ id: x.id, thumb: x.thumb });
   const items = (r.results || []).map(c => ({ ...c, media: byCamp[c.id] || [] }));
   return json({ items });
  }

  if (path === "/api/campaigns" && method === "POST") {
   const body = await request.json();
   const name = String(body.name || "").trim();
   const content = String(body.content || "").trim();
   const start = String(body.start_date || nowIso).trim();
   const end = body.end_date ? String(body.end_date) : null;
   if (!name || !content) return json({ error: "Faltan el nombre o el texto de la campaña." }, 400);
   const r = await env.DB.prepare(
    "INSERT INTO sc_campaigns (name,content,status,start_date,end_date) VALUES (?,?,'active',?,?)"
   ).bind(name, content, start, end).run();
   return json({ ok: true, id: r.meta?.last_row_id });
  }

  if (path.startsWith("/api/campaigns/") && method === "DELETE") {
   const id = idFrom(path);
   if (!id) return json({ error: "ID inválido." }, 400);
   const jobs = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM sc_jobs WHERE campaign_id=? AND status IN ('pending','ready','running')"
   ).bind(id).first();
   if (jobs?.n) return json({ error: "Esta campaña tiene tareas pendientes. Cancelalas primero." }, 400);
   await env.DB.batch([
    env.DB.prepare("DELETE FROM sc_media WHERE campaign_id=?").bind(id),
    env.DB.prepare("DELETE FROM sc_jobs WHERE campaign_id=?").bind(id),
    env.DB.prepare("DELETE FROM sc_campaigns WHERE id=?").bind(id)
   ]);
   return json({ ok: true });
  }

  /* ---------- Fotos ---------- */
  if (path === "/api/media" && method === "POST") {
   const body = await request.json();
   const campaign = Number(body.campaign_id);
   const mime = String(body.mime || "");
   const data = String(body.data || "");
   const thumb = String(body.thumb || "");
   if (!campaign || !["image/jpeg", "image/png", "image/webp"].includes(mime))
    return json({ error: "Foto no válida (usá JPG, PNG o WebP)." }, 400);
   if (!data || data.length > MAX_B64_LENGTH || thumb.length > 60000)
    return json({ error: "La foto es demasiado pesada." }, 400);
   const c = await env.DB.prepare("SELECT id FROM sc_campaigns WHERE id=?").bind(campaign).first();
   if (!c) return json({ error: "Campaña inexistente." }, 400);
   const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM sc_media WHERE campaign_id=?").bind(campaign).first();
   if ((n?.n || 0) >= MAX_IMAGES_PER_CAMPAIGN)
    return json({ error: "Máximo " + MAX_IMAGES_PER_CAMPAIGN + " fotos por campaña." }, 400);
   const r = await env.DB.prepare(
    "INSERT INTO sc_media (campaign_id,mime,data,thumb,size) VALUES (?,?,?,?,?)"
   ).bind(campaign, mime, data, thumb || null, data.length).run();
   return json({ ok: true, id: r.meta?.last_row_id });
  }

  if (path.startsWith("/api/media/") && path.endsWith("/raw") && method === "GET") {
   const id = Number(path.split("/")[3]);
   const m = await env.DB.prepare("SELECT mime,data FROM sc_media WHERE id=?").bind(id).first();
   if (!m) return json({ error: "Foto inexistente." }, 404);
   const bin = Uint8Array.from(atob(m.data), ch => ch.charCodeAt(0));
   return new Response(bin, { headers: { ...SECURITY_HEADERS, "Content-Type": m.mime } });
  }

  if (path.startsWith("/api/media/") && method === "DELETE") {
   const id = idFrom(path);
   if (!id) return json({ error: "ID inválido." }, 400);
   await env.DB.prepare("DELETE FROM sc_media WHERE id=?").bind(id).run();
   return json({ ok: true });
  }

  /* ---------- Tareas ---------- */
  if (path === "/api/jobs/pending" && method === "DELETE") {
   await env.DB.prepare("DELETE FROM sc_jobs WHERE status IN ('pending','ready')").run();
   return json({ ok: true });
  }

  const LIST = "SELECT j.id,j.campaign_id,j.destination_id,j.scheduled_at,j.status,j.attempts,j.last_error,j.finished_at,j.post_note," +
   "c.name AS campaign_name,d.name AS destination_name FROM sc_jobs j " +
   "LEFT JOIN sc_campaigns c ON c.id=j.campaign_id LEFT JOIN sc_destinations d ON d.id=j.destination_id ";

  if (path === "/api/jobs" && method === "GET") {
   const next = await env.DB.prepare(LIST + "WHERE j.status IN ('pending','ready','running') ORDER BY j.scheduled_at ASC LIMIT 100").all();
   const old = await env.DB.prepare(LIST + "WHERE j.status IN ('done','failed') ORDER BY j.finished_at DESC LIMIT 200").all();
   const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM sc_jobs WHERE status IN ('pending','ready','running')").first();
   return json({ items: [...(next.results || []), ...(old.results || [])], queued: n?.n || 0 });
  }

  if (path === "/api/calendar" && method === "GET") {
   const r = await env.DB.prepare(LIST + "WHERE j.scheduled_at>=? AND j.scheduled_at<? ORDER BY j.scheduled_at LIMIT 2000")
    .bind(url.searchParams.get("from"), url.searchParams.get("to")).all();
   return json({ items: r.results || [] });
  }

  if (path === "/api/plans" && method === "POST") {
   const body = await request.json();
   const campaign = Number(body.campaign_id);
   const items = Array.isArray(body.items) ? body.items : [];
   if (!items.length || items.length > 6000) return json({ error: "El plan debe tener entre 1 y 6000 publicaciones." }, 400);
   if (items.some(x => !Number.isInteger(x[0]) || isNaN(Date.parse(x[1])))) return json({ error: "Plan no válido." }, 400);
   if (!(await env.DB.prepare("SELECT id FROM sc_campaigns WHERE id=?").bind(campaign).first()))
    return json({ error: "Campaña inexistente." }, 400);
   const rows = JSON.stringify(items.map(x => [x[0], new Date(x[1]).toISOString()]));
   await env.DB.prepare(
    "INSERT INTO sc_jobs (campaign_id,destination_id,scheduled_at,status,plan_id) " +
    "SELECT ?,json_extract(value,'$[0]'),json_extract(value,'$[1]'),'pending',? FROM json_each(?)"
   ).bind(campaign, "p" + Date.now(), rows).run();
   return json({ ok: true, created: items.length });
  }

  if (path === "/api/jobs" && method === "POST") {
   const body = await request.json();
   const campaign = Number(body.campaign_id);
   const ids = (Array.isArray(body.destination_ids) ? body.destination_ids : [body.destination_id])
    .map(Number).filter(n => Number.isInteger(n) && n > 0);
   let when = body.now ? nowIso : String(body.scheduled_at || "").trim();
   if (!campaign || !ids.length || !when) return json({ error: "Faltan datos." }, 400);
   if (isNaN(Date.parse(when))) return json({ error: "Fecha u hora no válida." }, 400);
   when = new Date(when).toISOString();
   const c = await env.DB.prepare("SELECT id FROM sc_campaigns WHERE id=?").bind(campaign).first();
   if (!c) return json({ error: "Campaña inexistente." }, 400);
   const all = await env.DB.prepare("SELECT id,enabled,destination_url FROM sc_destinations").all();
   const byId = new Map((all.results || []).map(d => [d.id, d]));
   const gap = Math.min(1440, Math.max(0, Number(body.interval_minutes) || 0)) * 60000;
   const stmts = [];
   for (const id of ids) {
    const d = byId.get(id);
    if (!d) return json({ error: "Grupo inexistente." }, 400);
    if (!d.enabled) return json({ error: "Un grupo está desactivado." }, 400);
    if (!d.destination_url) return json({ error: "Un grupo no tiene enlace; el worker no sabe a dónde entrar." }, 400);
    const at = new Date(Date.parse(when) + gap * stmts.length).toISOString();
    stmts.push(env.DB.prepare(
     "INSERT INTO sc_jobs (campaign_id,destination_id,scheduled_at,status) VALUES (?,?,?,'pending')"
    ).bind(campaign, id, at));
   }
   await env.DB.batch(stmts);
   if (body.now) await promoteDue(env);
   return json({ ok: true, created: stmts.length });
  }

  if (path.startsWith("/api/jobs/") && path.endsWith("/run") && method === "POST") {
   const id = Number(path.split("/")[3]);
   await env.DB.prepare(
    "UPDATE sc_jobs SET status='ready',scheduled_at=?,last_error=NULL WHERE id=? AND status IN ('pending','ready','failed')"
   ).bind(nowIso, id).run();
   return json({ ok: true });
  }

  if (path.startsWith("/api/jobs/") && method === "DELETE") {
   const id = idFrom(path);
   if (!id) return json({ error: "ID inválido." }, 400);
   await env.DB.prepare("DELETE FROM sc_jobs WHERE id=? AND status<>'running'").bind(id).run();
   return json({ ok: true });
  }

  if (path === "/api/cron" && method === "POST") {
   return json({ ok: true, ready: await promoteDue(env) });
  }

  /* ---------- Worker de Windows ---------- */
  if (path === "/api/worker/heartbeat" && method === "POST") {
   const body = await request.json().catch(() => ({}));
   const v = JSON.stringify({
    at: nowIso,
    host: String(body.host || "").slice(0, 60),
    version: String(body.version || "").slice(0, 20),
    state: String(body.state || "").slice(0, 80)
   });
   await env.DB.prepare("INSERT OR REPLACE INTO sc_kv (k,v) VALUES ('runner',?)").bind(v).run();
   return json({ ok: true });
  }

  if (path === "/api/runner" && method === "GET") {
   const row = await env.DB.prepare("SELECT v FROM sc_kv WHERE k='runner'").first();
   let info = null;
   try { info = row ? JSON.parse(row.v) : null; } catch (e) { info = null; }
   const age = info ? Math.round((Date.now() - Date.parse(info.at)) / 1000) : null;
   return json({ runner: info, age_seconds: age });
  }

  if (path === "/api/worker/claim" && method === "POST") {
   const body = await request.json().catch(() => ({}));
   await promoteDue(env);
   let job;
   if (body.peek) {
    // Modo prueba: devuelve la próxima tarea sin reservarla ni cambiarle el estado.
    job = await env.DB.prepare(
     JOB_SELECT + "WHERE j.status IN ('pending','ready','failed') ORDER BY j.scheduled_at ASC, j.id ASC LIMIT 1"
    ).first();
   } else if (body.id) {
    job = await env.DB.prepare(JOB_SELECT + "WHERE j.status='ready' AND j.id=?").bind(Number(body.id)).first();
   } else {
    job = await env.DB.prepare(
     JOB_SELECT + "WHERE j.status='ready' ORDER BY j.scheduled_at ASC, j.id ASC LIMIT 1"
    ).first();
   }
   if (!job) return json({ job: null });
   if (!body.peek) {
    const r = await env.DB.prepare(
     "UPDATE sc_jobs SET status='running',started_at=?,attempts=attempts+1 WHERE id=? AND status='ready'"
    ).bind(nowIso, job.id).run();
    if (!r.meta?.changes) return json({ job: null });
   }
   const media = await env.DB.prepare("SELECT id,mime FROM sc_media WHERE campaign_id=? ORDER BY id").bind(job.campaign_id).all();
   return json({ job: { ...job, media: media.results || [] } });
  }

  if (path.startsWith("/api/worker/jobs/") && path.endsWith("/result") && method === "POST") {
   const id = Number(path.split("/")[4]);
   const body = await request.json().catch(() => ({}));
   if (!Number.isInteger(id) || id <= 0) return json({ error: "ID inválido." }, 400);
   const ok = !!body.ok;
   await env.DB.prepare(
    "UPDATE sc_jobs SET status=?,last_error=?,post_note=?,finished_at=? WHERE id=?"
   ).bind(
    ok ? "done" : "failed",
    ok ? null : String(body.error || "Error desconocido").slice(0, 500),
    body.note ? String(body.note).slice(0, 300) : null,
    nowIso, id
   ).run();
   return json({ ok: true });
  }

  return json({ error: "Ruta no encontrada." }, 404);
 } catch (e) {
  return json({ error: e.message || "Error interno" }, 500);
 }
}

export default {
 async fetch(request, env) {
  return handle(request, env);
 },
 async scheduled(event, env, ctx) {
  if (!env.DB) return;
  ctx.waitUntil(ensureSchema(env).then(() => promoteDue(env)));
 }
};
