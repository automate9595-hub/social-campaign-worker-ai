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
      if (b) return { dialog: d[i], box: b };
    }
    return null;
  }
  function norm(s) { return String(s || '').replace(/\s+/g, ''); }
  function hasText(text) {
    var c = composer();
    return !!c && norm(c.box.innerText).indexOf(norm(text).slice(0, 15)) >= 0;
  }
  function step(text) { try { chrome.runtime.sendMessage({ type: 'step', text: text }); } catch (e) {} }

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

  async function attach(dialog, box, files) {
    var before = all(dialog, 'img').length;
    var input = imageInput(dialog);
    if (!input) {
      var btn = dialog.querySelector('[aria-label="Foto/video"],[aria-label="Photo/video"],[aria-label="Foto o video"]') ||
        findByText(dialog, /(foto|photo)/i, '[role="button"],button');
      if (btn) click(btn);
      input = await waitFor(function () { return imageInput(dialog); }, 8000);
    }
    if (input) {
      setFiles(input, files);
    } else {
      var dt = new DataTransfer();
      files.forEach(function (f) { dt.items.add(f); });
      box.focus();
      box.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    }
    var ok = await waitFor(function () { return all(dialog, 'img').length > before; }, 45000);
    if (!ok) fail('No se pudieron cargar las fotos en la publicacion.');
    await sleep(2500 + files.length * 1200);
  }

  async function run(msg) {
    if (needsHuman()) fail('Facebook pide iniciar sesion o verificar la cuenta. Resolvelo en Chrome.', true);
    await sleep(2500);
    if (needsHuman()) fail('Facebook pide iniciar sesion o verificar la cuenta. Resolvelo en Chrome.', true);
    if (findByText(document.body, JOIN, '[role="button"],button')) fail('Tu cuenta todavia no es miembro de este grupo.');

    var opener = await waitFor(function () {
      var list = all(document, '[role="button"]').filter(visible);
      for (var i = 0; i < list.length; i++) if (COMPOSER.test((list[i].innerText || '').trim())) return list[i];
      var spans = all(document, 'span').filter(visible);
      for (var j = 0; j < spans.length; j++) if (COMPOSER.test((spans[j].innerText || '').trim())) return spans[j];
      return null;
    }, 25000);
    if (!opener) fail("No se encontro el cuadro 'Escribe algo...'. El grupo puede no permitir publicar o Facebook cambio su diseno.");
    step('Abriendo el cuadro de publicacion');
    click(opener);

    var c = await waitFor(composer, 30000);
    if (!c) fail('Se abrio Facebook pero no se encontro el campo de texto.');
    await sleep(1500);
    step('Escribiendo la descripcion');
    await writeText(msg.text);
    await sleep(800);

    var files = toFiles(msg.images || []);
    c = composer();
    if (!c) fail('El cuadro de publicacion se cerro.');
    if (files.length) {
      step('Cargando fotos');
      await attach(c.dialog, c.box, files);
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
    click(post);

    var closed = await waitFor(function () { return !document.contains(dialog) || !visible(dialog); }, 120000);
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
      run(msg).then(send, function (e) { send({ ok: false, error: String(e.message || e), human: !!e.human }); });
      return true;
    }
  });
})();
