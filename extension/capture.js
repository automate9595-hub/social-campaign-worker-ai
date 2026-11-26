// Capturador: mientras esta activo, anota los grupos que VOS vas abriendo.
(function () {
  if (window.__scCapture) return;
  window.__scCapture = true;
  var SKIP = /^(feed|discover|joins|create|search|notifications)$/i;
  var GENERIC = /^(facebook|grupos|groups|chats|notificaciones|notifications)?$/i;
  var slug = '', seen = 0, sent = false, lastName = '', badge = null;

  function clean(t) {
    return String(t || '').replace(/^\(\d+\+?\)\s*/, '').replace(/(\s*\|\s*(Facebook|Grupos|Groups))+\s*$/i, '').trim();
  }
  function findName(id) {
    var h = Array.prototype.slice.call(document.querySelectorAll('h1'));
    // Lo mas seguro: el titulo que enlaza a este mismo grupo.
    for (var i = 0; i < h.length; i++) {
      var a = h[i].querySelector('a[href*="/groups/' + id + '"]');
      if (a && !GENERIC.test(clean(a.innerText))) return { name: clean(a.innerText), sure: true };
    }
    for (var j = 0; j < h.length; j++) {
      var t = clean(h[j].innerText);
      if (!GENERIC.test(t)) return { name: t };
    }
    var d = clean(document.title);
    return { name: GENERIC.test(d) ? '' : d };
  }

  setInterval(function () {
    try {
      chrome.storage.local.get(['capture', 'captured', 'captureError'], function (o) {
        if (!o.capture) { if (badge) { badge.remove(); badge = null; } slug = ''; return; }
        if (!badge) {
          badge = document.createElement('div');
          badge.style.cssText = 'position:fixed;right:12px;top:70px;z-index:2147483647;max-width:320px;padding:10px 14px;border-radius:8px;background:#c4314b;color:#fff;font:14px Arial,sans-serif;pointer-events:none';
          document.documentElement.appendChild(badge);
        }
        var list = o.captured || [];
        badge.textContent = 'Capturando grupos: ' + list.length + (o.captureError ? '. Error: ' + o.captureError : (list[0] ? '. Ultimo: ' + list[0].name : ''));
        var m = location.pathname.match(/^\/groups\/([^\/]+)/);
        if (!m || SKIP.test(m[1])) { slug = ''; return; }
        if (m[1] !== slug) { slug = m[1]; seen = 0; sent = false; lastName = ''; }
        if (sent || list.some(function (g) { return g.slug === slug; })) return;
        seen++;
        var f = findName(slug);
        var stable = f.name && f.name === lastName;
        lastName = f.name;
        // Facebook cambia de grupo sin recargar: sin titulo enlazado se espera mas.
        if ((f.sure && stable) || (stable && seen >= 4) || seen >= 8) {
          sent = true;
          chrome.runtime.sendMessage({ type: 'group', name: f.name || 'Grupo ' + slug, slug: slug });
        }
      });
    } catch (e) {} // la extension se recargo
  }, 1000);
})();
