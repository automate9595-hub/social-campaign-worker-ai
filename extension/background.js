// Cada minuto pregunta al panel si hay una tarea lista y la publica en el grupo de Facebook
// usando tu propia sesion de Chrome. Pausa entre grupos y tope diario incluidos.
var VERSION = '2.2.0';
var busy = false;

function get(k) { return chrome.storage.local.get(k); }
function set(o) { return chrome.storage.local.set(o); }
function today() { return new Date().toLocaleDateString('en-CA'); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function getCfg() {
  var o = await get('cfg');
  return Object.assign({ maxPerDay: 15, minDelaySec: 90, maxDelaySec: 240, enabled: true }, o.cfg || {});
}
async function status(text) { await set({ status: { text: text, at: Date.now() } }); }
async function addLog(text) {
  var o = await get('log');
  var log = o.log || [];
  log.unshift({ t: Date.now(), text: text });
  await set({ log: log.slice(0, 30) });
}

async function api(cfg, path, method, body) {
  var base = String(cfg.workerUrl).trim();
  if (!/^https?:\/\//i.test(base)) base = 'https://' + base;
  var r = await fetch(new URL(base).origin + path, {
    method: method || 'GET',
    headers: { 'X-Admin-Token': cfg.adminToken, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  return r;
}
async function apiJson(cfg, path, method, body) {
  var r = await api(cfg, path, method, body);
  var d = await r.json().catch(function () { return {}; });
  if (r.status === 401) throw new Error('La clave de administrador es incorrecta.');
  if (!r.ok) throw new Error(d.error || ('Error ' + r.status));
  return d;
}
async function beat(cfg, state) {
  try { await api(cfg, '/api/worker/heartbeat', 'POST', { host: 'Chrome', version: VERSION, state: state }); } catch (e) {}
}

function b64(buf) {
  var u8 = new Uint8Array(buf), s = '';
  for (var i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}

async function loadImages(cfg, job) {
  var out = [];
  for (var i = 0; i < (job.media || []).length; i++) {
    var m = job.media[i];
    var r = await api(cfg, '/api/media/' + m.id + '/raw');
    if (!r.ok) throw new Error('No se pudo descargar una foto (' + r.status + ').');
    var ext = m.mime === 'image/png' ? '.png' : m.mime === 'image/webp' ? '.webp' : '.jpg';
    out.push({ name: 'foto-' + m.id + ext, mime: m.mime, b64: b64(await r.arrayBuffer()) });
  }
  return out;
}

async function waitComplete(tabId, timeout) {
  var end = Date.now() + timeout;
  while (Date.now() < end) {
    var t = await chrome.tabs.get(tabId);
    if (t.status === 'complete') return;
    await sleep(500);
  }
  // Facebook a veces nunca termina de cargar: se sigue igual y fb.js espera el cuadro.
}

async function publish(cfg, job, dry) {
  var u = new URL(job.group_url);
  if (!/(^|\.)facebook\.com$/i.test(u.hostname)) throw new Error('El enlace del grupo no es de Facebook.');
  u.hostname = 'www.facebook.com';
  var images = await loadImages(cfg, job);
  var win = await chrome.windows.create({ url: u.toString(), type: 'normal', focused: true, state: 'maximized' });
  var tabId = win.tabs[0].id;
  await set({ win: win.id });
  try {
    await waitComplete(tabId, 60000);
    await sleep(2000);
    // Evita que se abra el selector de archivos de Windows al tocar "Foto/video".
    await chrome.scripting.executeScript({
      target: { tabId: tabId }, world: 'MAIN',
      func: function () {
        if (window.__scPatched) return;
        window.__scPatched = true;
        var orig = HTMLInputElement.prototype.click;
        HTMLInputElement.prototype.click = function () {
          if (this.type === 'file') return;
          return orig.apply(this, arguments);
        };
      }
    });
    var res = null;
    for (var i = 0; i < 10 && !res; i++) {
      try { await chrome.tabs.sendMessage(tabId, { type: 'ping' }); res = true; } catch (e) {
        // Si la pagina no tiene el script, se lo inyecta.
        try { await chrome.scripting.executeScript({ target: { tabId: tabId }, files: ['fb.js'] }); } catch (e2) {}
        await sleep(1000);
      }
    }
    if (!res) throw new Error('No se pudo comunicar con la pagina de Facebook. Recarga la extension.');
    if (!dry && !(await getCfg()).enabled) throw new Error('Detenida por vos antes de publicar.');
    var timer;
    var out = await Promise.race([
      chrome.tabs.sendMessage(tabId, { type: 'publish', text: job.text, images: images, dry: !!dry }),
      new Promise(function (ok, no) { timer = setTimeout(function () { no(new Error('Facebook no respondio en 4 minutos. Revisa el grupo antes de reintentar.')); }, 240000); })
    ]).catch(async function (e) {
      var cur = (await get('current')).current;
      if (cur && cur.clicked && !/4 minutos/.test(e.message)) return { ok: true, note: 'Publicada (Facebook recargo la pagina).' };
      throw e;
    }).finally(function () { clearTimeout(timer); });
    if (!out) {
      var c2 = (await get('current')).current;
      if (c2 && c2.clicked) out = { ok: true, note: 'Publicada (Facebook recargo la pagina).' };
    }
    if (!out) throw new Error('Sin respuesta de la pagina de Facebook.');
    if (!out.ok) { if (!dry) await sleep(20000); var e = new Error(out.error || 'Error desconocido'); e.human = out.human; throw e; }
    return out;
  } finally {
    if (!dry) { await sleep(1000); try { await chrome.windows.remove(win.id); } catch (e) {} }
  }
}

// El resultado se guarda y se reenvia hasta que el panel lo recibe.
async function flush(cfg) {
  var p = (await get('pending')).pending;
  if (!p) return true;
  try { await apiJson(cfg, '/api/worker/jobs/' + p.id + '/result', 'POST', p.body); } catch (e) { return false; }
  await set({ pending: null });
  return true;
}
async function report(cfg, id, body) {
  await set({ pending: { id: id, body: body }, current: null });
  await flush(cfg);
}

async function tick(dry, forced) {
  if (busy) return;
  busy = true;
  var current = 'Trabajando';
  var keep = setInterval(async function () {
    var c = await getCfg();
    var s = (await get('status')).status;
    if (c.workerUrl && c.adminToken) beat(c, s ? s.text : current);
  }, 20000);
  try {
    var cfg = await getCfg();
    if (!cfg.workerUrl || !cfg.adminToken) { await status('Falta configurar la URL y la clave.'); return; }
    if (!cfg.enabled && !dry) { await status('En pausa (desactivado).'); await beat(cfg, 'Desactivado en la extension'); return; }

    // Si la extension se reinicio en medio de una publicacion, se cierra esa tarea.
    var cur = (await get('current')).current;
    if (cur) await report(cfg, cur.id, cur.clicked ? { ok: true, note: 'Publicada (se corto la confirmacion; revisa el grupo).' } : { ok: false, error: 'Quedo interrumpida antes de publicar.' });
    if (!(await flush(cfg))) { await status('Sin conexion con el panel; reintentando.'); return; }

    var st = (await get('st')).st || {};
    var count = st.day === today() ? (st.count || 0) : 0;
    var now = Date.now();
    if (!dry) {
      if (count >= cfg.maxPerDay) { await status('Limite diario alcanzado (' + cfg.maxPerDay + ').'); await beat(cfg, 'Limite diario alcanzado'); return; }
      if (!forced && st.pauseUntil && now < st.pauseUntil) { await status('En pausa: ' + (st.pauseWhy || 'esperando')); await beat(cfg, 'En pausa'); return; }
      if (!forced && st.nextAt && now < st.nextAt) { await status('Pausa entre publicaciones...'); await beat(cfg, 'Pausa entre publicaciones'); return; }
    }

    var job;
    try {
      job = (await apiJson(cfg, '/api/worker/claim', 'POST', { peek: !!dry, id: forced || undefined })).job;
    } catch (e) { await status('Sin conexion con el panel: ' + e.message); return; }

    if (!job) {
      if (!forced) await status(dry ? 'No hay tareas para probar. Programa una en el panel.' : 'Conectado. Esperando tareas.');
      await beat(cfg, 'Esperando tareas');
      return;
    }

    await status('Publicando en ' + job.group_name + '...');
    await beat(cfg, 'Publicando en ' + job.group_name);
    await addLog((dry ? 'Prueba' : 'Tarea ' + job.id) + ': ' + job.campaign_name + ' -> ' + job.group_name);
    if (!dry) await set({ current: { id: job.id, clicked: false } });
    try {
      if (!job.group_url) throw new Error('El grupo no tiene enlace.');
      if (!String(job.text || '').trim()) throw new Error('La campania no tiene texto.');
      var res = await publish(cfg, job, dry);
      if (dry) { await status('Prueba lista: revisa la ventana de Facebook (no se publico).'); await addLog('Prueba OK, sin publicar.'); return; }
      await report(cfg, job.id, { ok: true, note: res.note || '' });
      var gap = (cfg.minDelaySec + Math.random() * Math.max(0, cfg.maxDelaySec - cfg.minDelaySec)) * 1000;
      await set({ st: { day: today(), count: count + 1, nextAt: Date.now() + gap } });
      chrome.alarms.create('next', { when: Date.now() + gap + 1000 });
      await addLog('Publicado en ' + job.group_name + (res.note ? ' (' + res.note + ')' : ''));
      await status('Publicado en ' + job.group_name + '. La proxima en cola sale a las ' + new Date(Date.now() + gap).toLocaleTimeString('es-AR') + '.');
    } catch (e) {
      await addLog('Error: ' + e.message);
      await status('Error: ' + e.message);
      if (!dry) {
        await report(cfg, job.id, { ok: false, error: (await getCfg()).enabled ? e.message : 'Detenida por vos. ' + e.message });
        chrome.alarms.create('next', { when: Date.now() + (e.human ? 15 * 60000 : 2 * 60000) + 1000 });
        var pause = e.human ? 15 * 60000 : 2 * 60000;
        await set({ st: { day: st.day === today() ? st.day : today(), count: count, nextAt: Date.now() + 60000, pauseUntil: Date.now() + pause, pauseWhy: e.human ? 'Facebook pide verificacion' : 'revisa el error' } });
      }
    }
  } finally {
    clearInterval(keep);
    busy = false;
    var f = (await get('forced')).forced;
    if (f && !dry) { await set({ forced: null }); setTimeout(function () { tick(false, f); }, 3000); }
  }
}

// Si la alarma se perdio, se vuelve a crear cada vez que la extension despierta.
chrome.alarms.get('tick').then(function (a) { if (!a) chrome.alarms.create('tick', { periodInMinutes: 1 }); });
chrome.alarms.onAlarm.addListener(function (a) { if (a.name === 'tick' || a.name === 'next') tick(false); });
chrome.runtime.onInstalled.addListener(function () { chrome.alarms.create('tick', { periodInMinutes: 1 }); tick(false); });
chrome.runtime.onStartup.addListener(function () { tick(false); });
// Se ejecuta en el contexto de la pagina, sobre el campo que tiene el foco.
function writeInPage(method, text) {
  var el = document.activeElement;
  if (!el || !(el.isContentEditable || /^(INPUT|TEXTAREA)$/.test(el.tagName))) return;
  document.execCommand('selectAll', false, null);
  if (method === 'paste') {
    var dt = new DataTransfer();
    dt.setData('text/plain', text);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  } else {
    document.execCommand('insertText', false, text);
  }
}

// Pedido desde el panel ("Ahora" o "Publicar ya").
async function fromPanel(msg, origin) {
  var cfg = await getCfg();
  var linked = '';
  if (cfg.workerUrl) try { linked = new URL(/^https?:/i.test(cfg.workerUrl) ? cfg.workerUrl : 'https://' + cfg.workerUrl).origin; } catch (e) {}
  if (linked && linked !== origin) return 'La extensión está vinculada a otra dirección (' + linked + '). Corregila en la ventanita de la extensión.';
  cfg.workerUrl = origin;
  cfg.adminToken = msg.token;
  await set({ cfg: cfg });
  await beat(cfg, 'Conectado');
  if (msg.action === 'captureStart') { await set({ capture: true, captured: [], captureError: '' }); await injectCapture(); return 'Capturador activado. Entrá a tus grupos en Facebook.'; }
  if (msg.action === 'captureStop') { await set({ capture: false }); return 'Capturador detenido.'; }
  if (msg.action === 'pause' || msg.action === 'stop') {
    cfg.enabled = false;
    await set({ cfg: cfg, forced: null });
    await beat(cfg, 'Pausado');
    var w = (await get('win')).win;
    if (msg.action === 'stop' && busy && w) { try { await chrome.windows.remove(w); } catch (e) {} return 'Detenido. No sale nada hasta que toques Reanudar.'; }
    return busy ? 'En pausa: termina la publicación en curso y no sigue.' : 'En pausa. No sale nada hasta que toques Reanudar.';
  }
  if (msg.action === 'resume') {
    cfg.enabled = true;
    await set({ cfg: cfg });
    var s = (await get('st')).st || {};
    delete s.pauseUntil;
    await set({ st: s });
    tick(false).catch(function (e) { status('Error: ' + e.message); });
    return 'Reanudado.';
  }
  if (msg.action !== 'run') return 'Conectada (versión ' + VERSION + ').';
  if (!cfg.enabled) return 'La extensión está desactivada: marcá "Worker activo" en su ventanita.';
  if (busy) {
    if (msg.id) await set({ forced: msg.id });
    return 'Hay una publicación en curso; esta sale apenas termine.';
  }
  var st = (await get('st')).st || {};
  delete st.pauseUntil;
  await set({ st: st });
  if (st.day === today() && st.count >= cfg.maxPerDay) return 'Se alcanzó el límite de ' + cfg.maxPerDay + ' publicaciones por día.';
  var wait = Math.ceil(((st.nextAt || 0) - Date.now()) / 1000);
  if (!msg.id && wait > 0) return 'Pausa entre grupos: la siguiente sale sola en ' + (wait < 60 ? 'menos de 2 minutos' : 'unos ' + Math.ceil(wait / 60 + 1) + ' minutos') + '.';
  tick(false, msg.id).catch(function (e) { status('Error: ' + e.message); });
  return 'Orden recibida. Abriendo el grupo...';
}

// Mete el capturador en las pestañas de Facebook ya abiertas (no hace falta F5).
function injectInto(tabId) {
  return chrome.scripting.executeScript({ target: { tabId: tabId }, files: ['capture.js'] }).catch(function () {});
}
async function injectCapture() {
  var tabs = await chrome.tabs.query({ url: 'https://*.facebook.com/*' });
  for (var i = 0; i < tabs.length; i++) await injectInto(tabs[i].id);
}
chrome.tabs.onUpdated.addListener(async function (tabId, change, tab) {
  if (!(change.url || change.status === 'complete') || !/^https:\/\/[^\/]*facebook\.com\//.test(tab.url || '')) return;
  if ((await get('capture')).capture) injectInto(tabId);
});

// De a uno, para no pisar la lista ni duplicar grupos.
var saving = Promise.resolve();
async function saveGroup(msg) {
  var o = await get(['capture', 'captured']);
  var list = o.captured || [];
  if (!o.capture || list.some(function (g) { return g.slug === msg.slug; })) return;
  var cfg = await getCfg();
  var items = (await apiJson(cfg, '/api/destinations')).items || [];
  var exists = items.some(function (d) {
    var m = String(d.destination_url || '').match(/\/groups\/([^\/?#]+)/);
    return m && m[1] === msg.slug;
  });
  if (!exists) await apiJson(cfg, '/api/destinations', 'POST', { name: msg.name.slice(0, 120), url: 'https://www.facebook.com/groups/' + msg.slug });
  list.unshift({ slug: msg.slug, name: msg.name, old: exists });
  await set({ captured: list, captureError: '' });
}

chrome.runtime.onMessage.addListener(function (msg, sender, send) {
  if (msg && msg.type === 'alive') return;
  if (msg && msg.type === 'title') {
    getCfg().then(function (cfg) { return apiJson(cfg, '/api/listing-title', 'POST', { content: msg.text }); })
      .then(function (r) { send({ title: r.title }); }, function () { send({}); });
    return true;
  }
  if (msg && msg.type === 'group') {
    saving = saving.then(function () { return saveGroup(msg); }).catch(function (e) { return set({ captureError: e.message }); });
    return;
  }
  if (msg && msg.type === 'clicked') {
    get('current').then(function (o) { return o.current ? set({ current: { id: o.current.id, clicked: true } }) : null; }).then(function () { send({}); });
    return true;
  }
  if (msg && msg.type === 'panel' && sender.tab) {
    fromPanel(msg, new URL(sender.url).origin).then(function (t) { send({ text: t }); }, function (e) { send({ text: 'Error: ' + e.message }); });
    return true;
  }
  if (msg && msg.type === 'write' && sender.tab) {
    chrome.scripting.executeScript({ target: { tabId: sender.tab.id }, world: 'MAIN', func: writeInPage, args: [msg.method, msg.text] })
      .then(function () { send({ ok: true }); }, function () { send({ ok: false }); });
    return true;
  }
  if (msg && msg.type === 'step') { status(msg.text); getCfg().then(function (cfg) { beat(cfg, msg.text); }); return; }
  if (msg && msg.type === 'tick') { set({ st: {} }).then(function () { return tick(false); }).then(function () { send({ ok: true }); }); return true; }
  if (msg && msg.type === 'dry') { tick(true).then(function () { send({ ok: true }); }); return true; }
});
