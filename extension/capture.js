// Capturador: mientras esta activo, anota los grupos que VOS vas abriendo.
(function () {
  var last = '', seen = 0, badge = null;
  var SKIP = /^(feed|discover|joins|create|search|notifications)$/i;
  setInterval(function () {
    chrome.storage.local.get(['capture', 'captured'], function (o) {
      if (!o.capture) { if (badge) { badge.remove(); badge = null; } last = ''; return; }
      if (!badge) {
        badge = document.createElement('div');
        badge.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:2147483647;padding:10px 14px;border-radius:8px;background:#c4314b;color:#fff;font:14px Arial,sans-serif;pointer-events:none';
        document.documentElement.appendChild(badge);
      }
      badge.textContent = 'Capturando grupos: ' + (o.captured || []).length;
      var m = location.pathname.match(/^\/groups\/([^\/]+)/);
      if (!m || SKIP.test(m[1])) { last = ''; return; }
      var h = document.querySelector('[role="main"] h1');
      var name = ((h && h.innerText) || document.title.replace(/^\(\d+\+?\)\s*/, '').replace(/\s*\|\s*Facebook$/, '')).trim();
      if (!name || /^(facebook|grupos|groups)$/i.test(name)) return;
      // Espera a que direccion y nombre queden quietos (Facebook cambia de pagina sin recargar).
      var now = m[1] + '|' + name;
      if (now !== last) { last = now; seen = 0; return; }
      if (++seen === 2) chrome.runtime.sendMessage({ type: 'group', name: name, slug: m[1] });
    });
  }, 1500);
})();
