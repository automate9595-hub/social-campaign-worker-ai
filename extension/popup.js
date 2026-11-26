var $ = function (id) { return document.getElementById(id); };
function fmt(t) { return new Date(t).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }); }
async function render() {
  var o = await chrome.storage.local.get(['cfg', 'status', 'log']);
  var cfg = o.cfg || {};
  if (document.activeElement !== $('url')) $('url').value = cfg.workerUrl || '';
  if (document.activeElement !== $('tok')) $('tok').value = cfg.adminToken || '';
  $('on').checked = cfg.enabled !== false;
  $('st').textContent = o.status ? o.status.text + ' (' + fmt(o.status.at) + ')' : 'Todavia sin actividad.';
  $('log').innerHTML = (o.log || []).map(function (l) {
    var d = document.createElement('div'); d.textContent = fmt(l.t) + '  ' + l.text; return d.outerHTML;
  }).join('');
}
async function save() {
  var o = await chrome.storage.local.get('cfg');
  var cfg = o.cfg || {};
  cfg.workerUrl = $('url').value.trim().replace(/\/+$/, '');
  cfg.adminToken = $('tok').value.trim();
  cfg.enabled = $('on').checked;
  await chrome.storage.local.set({ cfg: cfg });
}
$('save').onclick = async function () { await save(); $('st').textContent = 'Guardado.'; chrome.runtime.sendMessage({ type: 'tick' }); };
$('now').onclick = async function () { await save(); $('st').textContent = 'Buscando tareas...'; chrome.runtime.sendMessage({ type: 'tick' }); };
$('dry').onclick = async function () { await save(); $('st').textContent = 'Preparando prueba...'; chrome.runtime.sendMessage({ type: 'dry' }); };
$('on').onchange = save;
render(); setInterval(render, 1500);
