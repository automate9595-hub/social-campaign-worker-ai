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

  function typeText(box, text) {
    box.focus();
    var lines = String(text).split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      if (lines[i]) document.execCommand('insertText', false, lines[i]);
      if (i < lines.length - 1) document.execCommand('insertParagraph', false, null);
    }
    if (!(box.innerText || '').trim()) {
      // plan B: simular un pegado de texto
      var dt = new DataTransfer();
      dt.setData('text/plain', text);
      box.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    }
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
    click(opener);

    var dialog = await waitFor(lastDialog, 20000);
    if (!dialog) fail('No se abrio el cuadro de nueva publicacion.');
    await sleep(1200);

    var box = await waitFor(function () { return dialog.querySelector('[role="textbox"][contenteditable="true"]'); }, 10000);
    if (!box) fail('No se encontro el campo de texto.');
    typeText(box, msg.text);
    await sleep(800);

    var files = toFiles(msg.images || []);
    if (files.length) await attach(dialog, box, files);

    if (msg.dry) return { ok: true, dry: true, note: 'Prueba lista: texto y fotos cargados, sin publicar.' };

    var post = await waitFor(function () {
      var b = dialog.querySelector('[aria-label="Publicar"][role="button"],[aria-label="Post"][role="button"]');
      return b && visible(b) ? b : null;
    }, 15000);
    if (!post) fail('No se encontro el boton Publicar.');
    await waitFor(function () { return post.getAttribute('aria-disabled') !== 'true'; }, 20000);
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
