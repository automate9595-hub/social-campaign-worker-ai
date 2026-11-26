// Conecta el panel con la extension: la configura sola y ejecuta al instante.
(function () {
  if (location.hostname.indexOf('social-campaign-worker-ai.') !== 0) return;
  function say(text) { window.postMessage({ sc: 'ext', text: text }, location.origin); }
  window.addEventListener('message', function (e) {
    if (e.source !== window || !e.data || e.data.sc !== 'panel') return;
    chrome.runtime.sendMessage({ type: 'panel', action: e.data.action, token: e.data.token, id: e.data.id }, function (r) {
      say(chrome.runtime.lastError || !r ? 'La extensión no respondió. Recargala y apretá F5.' : r.text);
    });
  });
  function next() {
    chrome.storage.local.get('st', function (o) {
      var st = o.st || {};
      window.postMessage({ sc: 'next', at: Math.max(st.nextAt || 0, st.pauseUntil || 0) }, location.origin);
    });
  }
  next();
  chrome.storage.onChanged.addListener(function (c) {
    if (c.st) next(); if (c.status && c.status.newValue) say(c.status.newValue.text); });
  // Mantiene despierta la extension mientras el panel esta abierto.
  setInterval(function () { try { chrome.runtime.sendMessage({ type: 'alive' }); } catch (e) {} }, 20000);
  window.postMessage({ sc: 'ready' }, location.origin);
})();
