// Se ejecuta dentro de la pagina de Facebook. Recibe una orden "publish" del background
// y maneja el cuadro de nueva publicacion del grupo. No evita CAPTCHAs ni verificaciones.
(function () {
  if (window.__scLoaded) return;
  window.__scLoaded = true;

  var COMPOSER = /^(escribe algo|write something|crea una publicaci[oó]n|create a public post|create post|¿qué estás pensando|what's on your mind)/i;
  var JOIN = /^(unirte al grupo|unirme al grupo|unirse al grupo|join group|join)$/i;

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function visible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    var r = el.getBoundingClientRect();
    var cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
  }
  function labelOf(el) { return ((el.getAttribute && el.getAttribute('aria-label')) || el.innerText || '').trim(); }
  function waitFor(fn, timeout) {
    var end = Date.now() + timeout;
    return new Promise(function (resolve) {
      (function loop() {
        var v = null;
        try { v = fn(); } catch (e) {}
        if (v) return resolve(v);
        if (Date.now() > end) return resolve(null);
        setTimeout(loop, 300);
      })();
    });
  }
  function click(el) {
    ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(function (t) {
      el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window }));
    });
  }
  function all(root, sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); }
  function findByText(root, re, sel) {
    var list = all(root, sel || '[role="button"],button,span');
    for (var i = 0; i < list.length; i++) {
      if (visible(list[i]) && re.test(labelOf(list[i]))) return list[i];
    }
    return null;
  }
  function lastDialog() {
    var d = all(document, '[role="dialog"]').filter(visible);
    return d.length ? d[d.length - 1] : null;
  }
  function needsHuman() {
    if (/checkpoint|two_step|recover/i.test(location.href)) return true;
    if (/\/login/i.test(location.pathname) || document.querySelector('form[action*="/login"] input[name="pass"]')) return true;
    return false;
  }
  function fail(msg, human) { var e = new Error(msg); e.human = !!human; throw e; }

  function toFiles(images) {
    return images.map(function (im) {
      var bin = atob(im.b64), u8 = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return new File([u8], im.name, { type: im.mime });
    });
  }

  function setFiles(input, files) {
    var dt = new DataTransfer();
    files.forEach(function (f) { dt.items.add(f); });
    input.files = dt.files;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function imageInput(dialog) {
    var list = all(dialog, 'input[type="file"]');
    for (var i = 0; i < list.length; i++) {
      var acc = list[i].getAttribute('accept') || '';
      if (!acc || /image/i.test(acc)) return list[i];
    }
    return null;
  }

  // Busca siempre el cuadro vigente: Facebook puede reemplazarlo mientras carga.
  function composer() {
    var d = all(document, '[role="dialog"]').filter(visible);
    for (var i = d.length - 1; i >= 0; i--) {
      var b = all(d[i], '[role="textbox"][contenteditable="true"]').filter(visible)[0];
      // Solo el cuadro de publicacion, nunca un chat.
      var post = d[i].querySelector('[aria-label="Publicar"],[aria-label="Post"]') || /crear publicaci|create post/i.test(d[i].innerText);
      if (b && post) return { dialog: d[i], box: b };
    }
    return null;
  }
  function norm(s) { return String(s || '').replace(/\s+/g, ''); }
  function hasText(text) {
    var c = composer();
    return !!c && norm(c.box.innerText).indexOf(norm(text).slice(0, 15)) >= 0;
  }
  function banner(text) {
    var b = document.getElementById('sc-banner');
    if (!b) {
      b = document.createElement('div');
      b.id = 'sc-banner';
      b.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:2147483647;max-width:360px;padding:10px 14px;border-radius:8px;background:#12203a;color:#fff;font:14px/1.4 Arial,sans-serif;pointer-events:none';
      document.documentElement.appendChild(b);
    }
    b.textContent = 'Social Campaign 2.2.0: ' + text;
  }
  function step(text) { banner(text); try { chrome.runtime.sendMessage({ type: 'step', text: text }); } catch (e) {} }

  async function writeText(text) {
    var methods = ['paste', 'insert'];
    for (var i = 0; i < methods.length; i++) {
      var c = composer();
      if (!c) break;
      click(c.box);
      c.box.focus();
      await sleep(500);
      await chrome.runtime.sendMessage({ type: 'write', method: methods[i], text: text });
      if (await waitFor(function () { return hasText(text); }, 4000)) return;
    }
    fail('No se pudo escribir la descripcion en el cuadro de Facebook.');
  }

  var OPENER = /(escribe algo|escribe una publicaci|crea una publicaci|write something|create a (public )?post|qu[eé] est[aá]s pensando)/i;
  function findOpeners() {
    return all(document, '[role="button"],span').filter(function (el) {
      var t = labelOf(el), s = (el.innerText || '').trim();
      return visible(el) && !el.closest('[role="dialog"]') && ((t.length < 80 && OPENER.test(t)) || (s.length < 80 && OPENER.test(s)));
    });
  }

  // Boton flotante de abajo a la derecha, solo si su nombre dice que crea una publicacion.
  function floating() {
    return all(document, '[role="button"][aria-label]').filter(function (el) {
      return visible(el) && !el.closest('[role="dialog"]') && /(crear|escribir|nueva|create|new).*(publicaci|post)/i.test(el.getAttribute('aria-label'));
    });
  }

  var SELL = /^(vender algo|vende algo|sell something)$/i;
  // Espera 20 s arriba, sin mover la pagina; recien despues baja despacio.
  async function searchOpeners() {
    window.scrollTo(0, 0);
    for (var n = 0; n < 28; n++) {
      var l = findOpeners();
      if (l.length) return l;
      // "Vender algo" ya esta a la vista: se usa sin bajar (4 s de margen para "Escribe algo").
      if (n >= 4 && byText(SELL).length) return null;
      if (n >= 20) { window.scrollBy(0, 150); await sleep(2500); } else await sleep(1000);
    }
    return null;
  }

  function byText(re, sel) {
    return all(document, sel || '[role="button"],span').filter(function (el) {
      return visible(el) && !el.closest('[role="dialog"]') && (re.test((el.innerText || '').trim()) || re.test((el.getAttribute('aria-label') || '').trim()));
    });
  }

  // 2da opcion "Vender algo" / "Vende algo"; 3ra, el boton del lapiz.
  async function otherOpeners() {
    var talk = byText(/^(conversaci[oó]n|discusi[oó]n|discussion)$/i, '[role="tab"],a')[0];
    if (talk) {
      step('Probando la pestaña Conversacion');
      click(talk);
      await sleep(3000);
      var l = await waitFor(function () { var x = findOpeners(); return x.length ? x : null; }, 5000);
      if (l) { click(l[0].querySelector('span') || l[0]); var c = await waitFor(composer, 10000); if (c) return c; }
    }
    if (!byText(SELL).length) window.scrollTo(0, 0);
    await sleep(1500);
    var tries = [['"Vender algo"', byText(SELL)], ['el boton del lapiz', floating()]];
    var sale = false;
    for (var i = 0; i < tries.length; i++) {
      var el = tries[i][1][0];
      if (!el || !document.contains(el)) continue;
      step('Tocando ' + tries[i][0]);
      click(el.querySelector('span') || el);
      var found = await waitFor(function () { return composer() || (saleVisible() ? { sale: true } : null); }, 12000);
      if (found) return found;
    }
    return null;
  }

  var PRICE = '1';
  function field(re) {
    var list = all(document, 'label,input[aria-label],textarea[aria-label]').filter(visible);
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (!re.test((el.getAttribute('aria-label') || el.innerText || '').trim())) continue;
      var c = /^(INPUT|TEXTAREA)$/.test(el.tagName) ? el : el.querySelector('input,textarea');
      if (c) return c;
    }
    return null;
  }
  var TITLE = /^t[ií]tulo|^title/i;
  function card() { return all(document, '[role="dialog"] span,[role="dialog"] [role="button"]').filter(function (e) { return visible(e) && /^(art[ií]culo en venta|item for sale)$/i.test((e.innerText || '').trim()); })[0]; }
  function saleVisible() { return !!(field(TITLE) || card()); }
  function button(re) { return all(document, '[role="button"],button').filter(function (e) { return visible(e) && re.test((e.getAttribute('aria-label') || e.innerText || '').trim()); }).pop(); }
  function enabled(re) { var b = button(re); return b && b.getAttribute('aria-disabled') !== 'true' && !b.disabled ? b : null; }

  async function fill(re, value, name) {
    var el = await waitFor(function () { return field(re); }, 10000);
    if (!el) fail('No se encontro el campo ' + name + '.');
    el.scrollIntoView({ block: 'center' });
    click(el);
    el.focus();
    await chrome.runtime.sendMessage({ type: 'write', method: 'insert', text: value });
    await sleep(800);
    if (!el.value) fail('No se pudo completar ' + name + '.');
  }

  // Baja la pagina y los paneles con desplazamiento.
  function scrollDown() {
    window.scrollBy(0, 300);
    all(document, 'div').forEach(function (d) {
      if (d.scrollHeight > d.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(d).overflowY)) d.scrollTop += 300;
    });
  }

  // Formulario "Articulo en venta": fotos, titulo, precio, estado y descripcion.
  async function sell(msg) {
    step('Eligiendo "Articulo en venta"');
    var c = !field(TITLE) && card();
    if (c) click(c);
    if (!(await waitFor(function () { return field(TITLE); }, 15000))) fail('No se abrio el formulario de articulo en venta.');
    await sleep(1500);

    var files = toFiles(msg.images || []);
    if (!files.length) fail('Para vender hace falta al menos una foto en la campaña.');
    step('Subiendo ' + files.length + ' foto(s)');
    var inputs = all(document, 'input[type="file"]').filter(function (i) { return /image/.test(i.accept || ''); });
    if (!inputs.length) fail('No se encontro donde subir las fotos.');
    var before = document.images.length;
    setFiles(inputs[inputs.length - 1], files);
    if (!(await waitFor(function () { return document.images.length > before || /(Fotos|Photos)\s*·\s*[1-9]/.test(document.body.innerText); }, 45000))) fail('No se cargaron las fotos.');
    await sleep(2000 + files.length * 1200);

    step('La IA esta creando el titulo');
    var r = await chrome.runtime.sendMessage({ type: 'title', text: msg.text });
    var title = (r && r.title) || msg.text.split('\n')[0].slice(0, 80);
    step('Completando titulo y precio');
    await fill(TITLE, title, 'Titulo');
    await fill(/^(precio|price)/i, PRICE, 'Precio');

    step('Estado: Nuevo');
    var state = all(document, '[role="combobox"],label').filter(function (e) { return visible(e) && /^(estado|condition)/i.test((e.getAttribute('aria-label') || e.innerText || '').trim()); })[0];
    if (!state) fail('No se encontro el campo Estado.');
    click(state);
    var option = await waitFor(function () { return all(document, '[role="option"],[role="menuitem"]').filter(function (e) { return visible(e) && /^(nuevo|new)$/i.test((e.innerText || '').trim()); })[0]; }, 10000);
    if (!option) fail('No se encontro la opcion Nuevo.');
    click(option);
    await sleep(1000);

    step('Completando la descripcion');
    var DESC = /^(descripci[oó]n|description)/i;
    if (!field(DESC)) {
      var more = button(/^(m[aá]s detalles|more details)/i) || all(document, 'span').filter(function (e) { return visible(e) && /^(m[aá]s detalles|more details)$/i.test((e.innerText || '').trim()); })[0];
      if (more) click(more);
    }
    await fill(DESC, msg.text, 'Descripcion');
    await sleep(1500);

    var NEXT = /^(siguiente|next)$/i, POST = /^(publicar|post|publish)$/i;
    if (!button(POST)) {
      var next = await waitFor(function () { return enabled(NEXT); }, 30000);
      if (!next) fail('El boton Siguiente quedo desactivado: falta algun dato obligatorio.');
      click(next);
      await sleep(3000);
    }
    step('Bajando hasta "Publicar"');
    var post = null;
    for (var n = 0; n < 20 && !(post = enabled(POST)); n++) { scrollDown(); await sleep(1500); }
    if (!post) fail('No se encontro el boton Publicar de la venta.');
    post.scrollIntoView({ block: 'center' });
    await sleep(800);
    if (msg.dry) return { ok: true, dry: true, note: 'Prueba lista: venta completada, sin publicar.' };
    step('Publicando');
    await chrome.runtime.sendMessage({ type: 'clicked' });
    click(post);
    var closed = await waitFor(function () { return !document.contains(post) || !visible(post); }, 120000);
    if (!closed) fail('La venta no se confirmo (el formulario sigue abierto).');
    await sleep(3000);
    return { ok: true, note: 'Publicada como articulo en venta.' };
  }

  // Toca "Escribe algo..." y reintenta si el cuadro no se abre.
  async function openComposer() {
    step('Buscando "Escribe algo..."');
    for (var i = 0; i < 4; i++) {
      var list = await searchOpeners();
      if (composer()) return composer();
      if (!list) break;
      var el = list[i % list.length];
      el.scrollIntoView({ block: 'center' });
      await sleep(800);
      step('Tocando "Escribe algo..." (intento ' + (i + 1) + ')');
      click(el.querySelector('span') || el);
      var c = await waitFor(composer, 10000);
      if (c) return c;
    }
    var other = await otherOpeners();
    if (other) return other;
    fail('No se encontro "Escribe algo", "Vender algo" ni el boton para publicar.');
  }

  async function attach(files) {
    function dlg() { var c = composer(); return c ? c.dialog : null; }
    function imgs() { var d = dlg(); return d ? all(d, 'img').length : 0; }
    function input() { var d = dlg(); return d ? imageInput(d) : null; }
    var before = imgs();
    var found = input();
    if (!found) {
      var d = dlg();
      var btn = d && (d.querySelector('[aria-label="Foto/video"],[aria-label="Photo/video"],[aria-label="Foto o video"]') ||
        findByText(d, /(foto|photo)/i, '[role="button"],button'));
      if (btn) click(btn);
      found = await waitFor(input, 10000);
    }
    if (!found) fail('No se encontro donde subir la foto.');
    setFiles(found, files);
    var ok = await waitFor(function () { return imgs() > before; }, 45000);
    if (!ok) fail('No se pudieron cargar las fotos en la publicacion.');
    await sleep(2500 + files.length * 1200);
  }

  async function run(msg) {
    if (needsHuman()) fail('Facebook pide iniciar sesion o verificar la cuenta. Resolvelo en Chrome.', true);
    await sleep(2500);
    if (needsHuman()) fail('Facebook pide iniciar sesion o verificar la cuenta. Resolvelo en Chrome.', true);
    if (findByText(document.body, JOIN, '[role="button"],button')) fail('Tu cuenta todavia no es miembro de este grupo.');

    var c = await openComposer();
    if (c.sale) return sell(msg);
    await sleep(1500);
    step('Escribiendo la descripcion');
    await writeText(msg.text);
    await sleep(800);

    var files = toFiles(msg.images || []);
    c = composer();
    if (!c) fail('El cuadro de publicacion se cerro.');
    if (files.length) {
      step('Subiendo ' + files.length + ' foto(s)');
      await attach(files);
    }
    c = composer();
    if (!c || !hasText(msg.text)) fail('La descripcion se borro antes de publicar; no se publico.');
    var dialog = c.dialog;

    if (msg.dry) return { ok: true, dry: true, note: 'Prueba lista: texto y fotos cargados, sin publicar.' };

    var post = await waitFor(function () {
      var b = dialog.querySelector('[aria-label="Publicar"][role="button"],[aria-label="Post"][role="button"]');
      return b && visible(b) ? b : null;
    }, 15000);
    if (!post) fail('No se encontro el boton Publicar.');
    var ready = await waitFor(function () { return post.getAttribute('aria-disabled') !== 'true'; }, 20000);
    if (!ready) fail('El boton Publicar quedo desactivado.');
    step('Publicando');
    await chrome.runtime.sendMessage({ type: 'clicked' });
    click(post);

    var closed = await waitFor(function () { return !document.contains(dialog) || !visible(dialog) || !hasText(msg.text); }, 120000);
    if (!closed) fail('La publicacion no se confirmo (el cuadro sigue abierto).');
    await sleep(3000);
    var body = (document.body.innerText || '');
    var pending = /pendiente de aprobaci[oó]n|aprobar[aá]n|pending (admin )?approval|will be reviewed/i.test(body);
    return { ok: true, note: pending ? 'Publicada; queda pendiente de aprobacion del administrador del grupo.' : '' };
  }

  chrome.runtime.onMessage.addListener(function (msg, sender, send) {
    if (!msg) return;
    if (msg.type === 'ping') { send({ pong: 1 }); return; }
    if (msg.type === 'publish') {
      // En Chrome viejo la extension se duerme si no recibe nada.
      var alive = setInterval(function () { try { chrome.runtime.sendMessage({ type: 'alive' }); } catch (e) {} }, 10000);
      run(msg).finally(function () { clearInterval(alive); }).then(function (r) { banner(r.dry ? 'Prueba lista, sin publicar.' : 'Publicacion terminada.'); send(r); }, function (e) { banner('ERROR: ' + (e.message || e)); send({ ok: false, error: String(e.message || e), human: !!e.human }); });
      return true;
    }
  });
})();
