// Sube TODO el contenido de esta carpeta a tu repositorio de GitHub (rama principal),
// reemplazando lo que hubiera. Login por "device code". Escrito en JavaScript simple
// para que funcione hasta con versiones muy viejas de Node.js (4 o mas nuevo).
var fs = require('fs');
var path = require('path');
var https = require('https');
var http = require('http');
var url = require('url');
var readline = require('readline');
var cp = require('child_process');

var ROOT = path.resolve(__dirname, '..');
var WW = path.join(ROOT, 'tools');
var DATA = path.join(WW, 'data');
var CONFIG = path.join(DATA, 'config.json');
var TOKEN_FILE = path.join(DATA, 'github.json');
var API = process.env.SC_GH_API || 'https://api.github.com';
var WEB = process.env.SC_GH_WEB || 'https://github.com';
var SKIP = { '.git': 1, 'node_modules': 1, 'data': 1 };

function mkdir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p); }
function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return {}; } }
function writeJson(f, o) { mkdir(WW); mkdir(DATA); fs.writeFileSync(f, JSON.stringify(o, null, 2)); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function say(s) { console.log(s); }

var RL = null;
var QUEUE = [], WAITING = null;
function ask(q, def) {
  if (!RL) {
    RL = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
    RL.on('line', function (l) { if (WAITING) { var w = WAITING; WAITING = null; w(l); } else { QUEUE.push(l); } });
  }
  return new Promise(function (res) {
    process.stdout.write(q + (def ? ' [' + def + ']' : '') + ': ');
    function done(a) { res((a || '').trim() || def || ''); }
    if (QUEUE.length) done(QUEUE.shift()); else WAITING = done;
  });
}

function request(method, u, headers, body) {
  return new Promise(function (resolve, reject) {
    var o = url.parse(u);
    var lib = o.protocol === 'http:' ? http : https;
    var data = body ? JSON.stringify(body) : null;
    var h = { 'User-Agent': 'social-campaign-push', 'Accept': 'application/vnd.github+json' };
    Object.keys(headers || {}).forEach(function (k) { h[k] = headers[k]; });
    if (data) { h['Content-Type'] = 'application/json'; h['Content-Length'] = Buffer.byteLength(data); }
    var req = lib.request({ method: method, hostname: o.hostname, port: o.port, path: o.path, headers: h }, function (res) {
      var b = '';
      res.setEncoding('utf8');
      res.on('data', function (c) { b += c; });
      res.on('end', function () {
        var j = {};
        try { j = JSON.parse(b); } catch (e) {}
        resolve({ status: res.statusCode, json: j });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function walk(dir, rel) {
  var out = [];
  fs.readdirSync(dir).forEach(function (name) {
    var full = path.join(dir, name);
    var r = rel ? rel + '/' + name : name;
    var st = fs.statSync(full);
    if (st.isDirectory()) {
      if (!SKIP[name]) out = out.concat(walk(full, r));
    } else if (st.isFile() && !/\.zip$/i.test(name) && st.size <= 5 * 1024 * 1024) {
      out.push(r);
    }
  });
  return out;
}

function deviceLogin(clientId) {
  return request('POST', WEB + '/login/device/code', { Accept: 'application/json' },
    { client_id: clientId, scope: 'repo workflow' }).then(function (r) {
    var d = r.json;
    if (!d.device_code) {
      throw new Error('GitHub no entrego un codigo: ' + (d.error_description || d.error || r.status) +
        '\nRevisa el Client ID y que "Enable Device Flow" este activado en tu OAuth App.');
    }
    say('\n==================================================');
    say('  1) Abri:   ' + d.verification_uri);
    say('  2) Ingresa este codigo:\n');
    say('        ' + d.user_code + '\n');
    say('  (vence en ' + Math.round(d.expires_in / 60) + ' minutos)');
    say('==================================================\n');
    if (process.platform === 'win32') {
      try { cp.spawn('cmd', ['/c', 'start', '', d.verification_uri], { stdio: 'ignore', detached: true }).unref(); } catch (e) {}
    }
    var interval = (d.interval || 5) * 1000;
    var until = Date.now() + d.expires_in * 1000;
    function poll() {
      if (Date.now() > until) throw new Error('El codigo vencio. Abri el archivo de nuevo para pedir otro.');
      return sleep(interval).then(function () {
        return request('POST', WEB + '/login/oauth/access_token', { Accept: 'application/json' },
          { client_id: clientId, device_code: d.device_code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' });
      }).then(function (t) {
        var j = t.json;
        if (j.access_token) return j.access_token;
        if (j.error === 'authorization_pending') return poll();
        if (j.error === 'slow_down') { interval += 5000; return poll(); }
        if (j.error === 'expired_token') throw new Error('El codigo vencio. Abri el archivo de nuevo para pedir otro.');
        if (j.error === 'access_denied') throw new Error('Cancelaste la autorizacion en GitHub.');
        throw new Error(j.error_description || j.error || 'Error desconocido de GitHub');
      });
    }
    return poll();
  });
}

function getToken(clientId) {
  var saved = readJson(TOKEN_FILE);
  var check = saved.token
    ? request('GET', API + '/user', { Authorization: 'Bearer ' + saved.token }).then(function (r) { return r.status === 200 ? saved.token : null; })
    : Promise.resolve(null);
  return check.then(function (tok) {
    if (tok) return tok;
    return deviceLogin(clientId).then(function (t) {
      writeJson(TOKEN_FILE, { token: t });
      say('GitHub conectado.');
      return t;
    });
  });
}

function main() {
  var cfg = readJson(CONFIG);
  var needClient = !cfg.githubClientId;
  if (needClient) {
    say('\nPrimero hace falta una OAuth App de GitHub (se hace una sola vez, 1 minuto):');
    say('  1) Entra a https://github.com/settings/developers  ->  OAuth Apps  ->  New OAuth App');
    say('  2) Nombre y URLs: lo que quieras (ej: http://localhost)');
    say('  3) Despues de crearla, tilda "Enable Device Flow" y guarda');
    say('  4) Copia el "Client ID" y pegalo aca abajo\n');
  }
  return ask('Tu repositorio de GitHub (usuario/nombre-del-repo)', cfg.githubRepo || '').then(function (repo) {
    cfg.githubRepo = repo;
    return ask('Client ID de tu OAuth App', cfg.githubClientId || '');
  }).then(function (cid) {
    cfg.githubClientId = cid;
    if (!cfg.githubRepo || !cfg.githubClientId) throw new Error('Faltan datos.');
    writeJson(CONFIG, cfg);
    var files = walk(ROOT, '');
    if (files.indexOf('src/index.js') < 0) throw new Error('No encuentro src/index.js: abri este archivo desde la carpeta descomprimida del proyecto.');
    say('\nSe van a subir ' + files.length + ' archivos a https://github.com/' + cfg.githubRepo);
    say('Esto REEMPLAZA todo el contenido actual del repositorio (el historial anterior queda guardado en GitHub).');
    return ask('Escribi SI para continuar', '').then(function (yes) {
      if (yes.toUpperCase() !== 'SI') { say('Cancelado. No se cambio nada.'); return; }
      return push(cfg, files);
    });
  });
}

function push(cfg, files) {
  var repo = cfg.githubRepo, H, branch, parent = null, tree = [];
  function call(method, p, body) {
    return request(method, API + '/repos/' + repo + p, H, body).then(function (r) {
      if (r.status === 401) writeJson(TOKEN_FILE, {});
      if (r.status >= 400) throw new Error('GitHub respondio ' + r.status + ' en ' + p + ': ' + (r.json.message || ''));
      return r.json;
    });
  }
  return getToken(cfg.githubClientId).then(function (token) {
    H = { Authorization: 'Bearer ' + token };
    return call('GET', '');
  }).then(function (info) {
    branch = info.default_branch || 'main';
    say('Rama: ' + branch);
    return call('GET', '/git/ref/heads/' + branch).then(function (r) { parent = r.object.sha; }, function (e) {
      if (!/ 404 /.test(e.message)) throw e;
    });
  }).then(function () {
    var n = 0;
    return files.reduce(function (chain, f) {
      return chain.then(function () {
        var b64 = fs.readFileSync(path.join(ROOT, f)).toString('base64');
        return call('POST', '/git/blobs', { content: b64, encoding: 'base64' }).then(function (b) {
          tree.push({ path: f, mode: '100644', type: 'blob', sha: b.sha });
          n++;
          process.stdout.write('\r  Subiendo archivos... ' + n + '/' + files.length);
        });
      });
    }, Promise.resolve());
  }).then(function () {
    say('');
    // Sin base_tree: el arbol nuevo reemplaza por completo al anterior.
    return call('POST', '/git/trees', { tree: tree });
  }).then(function (t) {
    return call('POST', '/git/commits', {
      message: 'Actualizacion completa: panel nuevo y worker de Windows',
      tree: t.sha,
      parents: parent ? [parent] : []
    });
  }).then(function (c) {
    var upd = parent
      ? call('PATCH', '/git/refs/heads/' + branch, { sha: c.sha, force: true })
      : call('POST', '/git/refs', { ref: 'refs/heads/' + branch, sha: c.sha });
    return upd.then(function () {
      say('Repositorio reemplazado (commit ' + c.sha.slice(0, 7) + ').');
      say('Esperando el deploy a Cloudflare...');
      return waitDeploy(call, c.sha, 0);
    });
  });
}

function waitDeploy(call, sha, i) {
  if (i >= 18) { say('El deploy sigue en curso. Revisa la pestana Actions del repositorio.'); return; }
  return sleep(10000).then(function () {
    return call('GET', '/actions/runs?head_sha=' + sha).then(function (runs) { return runs; }, function () { return {}; });
  }).then(function (runs) {
    var list = runs.workflow_runs || [], run = null;
    list.forEach(function (r) { if (/deploy/i.test(r.name)) run = r; });
    if (!run) {
      if (i >= 3) { say('No se vio ningun deploy: revisa la pestana Actions del repositorio.'); return; }
      return waitDeploy(call, sha, i + 1);
    }
    if (run.status === 'completed') {
      if (run.conclusion === 'success') say('\nLISTO: el panel nuevo ya esta publicado. Recargalo con Ctrl+F5.');
      else say('\nERROR: el deploy termino con error (' + run.conclusion + '). Casi siempre faltan los secretos CLOUDFLARE_API_TOKEN y CLOUDFLARE_ACCOUNT_ID en GitHub.\n  Detalle: ' + run.html_url);
      return;
    }
    return waitDeploy(call, sha, i + 1);
  });
}

main().then(function () { if (RL) RL.close(); }, function (e) { if (RL) RL.close(); console.error('\nError: ' + e.message); process.exitCode = 1; });
