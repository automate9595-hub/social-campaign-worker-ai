// Panel web. Sin librerías ni fuentes externas: HTML + CSS + JS puro (liviano).
// IMPORTANTE: dentro de este bloque no usar acentos graves ni la secuencia dólar-llave.
export const HTML = String.raw`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Social Campaign</title>
<style>
:root{
 --bg:#eef1f6;--panel:#ffffff;--soft:#f4f6fb;--line:#dde3ee;
 --ink:#12203a;--muted:#5d6b85;--accent:#2b59ff;--accent-ink:#ffffff;--accent-soft:#e3eaff;
 --ok:#0f8a5f;--ok-soft:#dcf5ea;--warn:#a86400;--warn-soft:#fdf0d4;--bad:#c4314b;--bad-soft:#fde5ea;
 --radius:14px;
 --font:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
}
@media (prefers-color-scheme:dark){
 :root{
  --bg:#0c111c;--panel:#141b2b;--soft:#19223a;--line:#25304a;
  --ink:#e8edf8;--muted:#93a1bf;--accent:#6b8bff;--accent-ink:#0b1220;--accent-soft:#1d2a52;
  --ok:#4fd3a0;--ok-soft:#133a2e;--warn:#f3b84b;--warn-soft:#3a2d12;--bad:#ff7d92;--bad-soft:#431a25;
 }
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 var(--font);min-height:100vh}
button,input,textarea,select{font:inherit;color:inherit}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}

/* Estructura */
.app{display:grid;grid-template-columns:232px 1fr;min-height:100vh}
.side{position:sticky;top:0;height:100vh;padding:22px 14px;border-right:1px solid var(--line);background:var(--panel);display:flex;flex-direction:column;gap:18px}
.brand{display:flex;align-items:center;gap:10px;padding:0 8px;font-weight:700;font-size:17px;letter-spacing:-.01em}
.logo{width:30px;height:30px;border-radius:9px;background:var(--accent);position:relative;flex:none}
.logo:before,.logo:after{content:"";position:absolute;left:7px;right:7px;height:3px;border-radius:2px;background:var(--accent-ink)}
.logo:before{top:10px}.logo:after{top:17px;right:12px}
nav{display:flex;flex-direction:column;gap:2px}
.tab{display:flex;align-items:center;gap:10px;padding:10px 12px;border:0;background:none;border-radius:10px;cursor:pointer;color:var(--muted);font-weight:600;text-align:left}
.tab:hover{background:var(--soft);color:var(--ink)}
.tab[aria-selected=true]{background:var(--accent-soft);color:var(--accent)}
.tab svg{width:18px;height:18px;flex:none;stroke:currentColor;fill:none;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.tab .n{margin-left:auto;font-size:12px;background:var(--soft);color:var(--muted);border-radius:99px;padding:1px 8px}
.tab[aria-selected=true] .n{background:var(--accent);color:var(--accent-ink)}
.runner{margin-top:auto;border:1px solid var(--line);border-radius:12px;padding:12px;font-size:13px;background:var(--soft)}
.runner b{display:flex;align-items:center;gap:8px;font-size:13px}
.dot{width:9px;height:9px;border-radius:50%;background:var(--muted);flex:none}
.dot.on{background:var(--ok);box-shadow:0 0 0 0 var(--ok);animation:pulse 2s infinite}
.dot.warn{background:var(--warn)}
@keyframes pulse{70%{box-shadow:0 0 0 7px transparent}100%{box-shadow:0 0 0 0 transparent}}
.runner span{color:var(--muted);display:block;margin-top:4px;overflow-wrap:anywhere}

main{padding:28px clamp(16px,4vw,44px) 60px;max-width:980px;width:100%}
h1{margin:0 0 4px;font-size:26px;letter-spacing:-.02em}
.lead{margin:0 0 22px;color:var(--muted);max-width:60ch}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:22px}
.stat{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:12px 14px}
.stat b{display:block;font-size:24px;letter-spacing:-.02em;line-height:1.1}
.stat span{font-size:13px;color:var(--muted)}

.card{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:18px;margin-bottom:16px}
.card h2{margin:0 0 12px;font-size:16px}
label.f{display:block;font-size:13px;font-weight:600;color:var(--muted);margin:12px 0 5px}
input[type=text],input[type=url],input[type=date],input[type=time],textarea,select{width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--soft)}
input:focus,textarea:focus,select:focus{border-color:var(--accent);outline:none;box-shadow:0 0 0 3px var(--accent-soft)}
textarea{min-height:130px;resize:vertical}
.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.btn{border:1px solid transparent;border-radius:10px;padding:9px 16px;font-weight:650;cursor:pointer;background:var(--accent);color:var(--accent-ink)}
.btn:hover{filter:brightness(1.07)}
.btn:disabled{opacity:.55;cursor:default}
.btn.ghost{background:transparent;border-color:var(--line);color:var(--ink)}
.btn.ghost:hover{background:var(--soft)}
.btn.sm{padding:5px 11px;font-size:13px;border-radius:8px}
.btn.del{background:transparent;border-color:var(--line);color:var(--bad)}
.btn.del:hover{background:var(--bad-soft)}

.list{display:flex;flex-direction:column;gap:8px}
.item{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:var(--soft)}
.item .t{min-width:0}
.item .t b{display:block;overflow-wrap:anywhere}
.item .t small{display:block;color:var(--muted);overflow-wrap:anywhere}
.item .t p{margin:6px 0 0;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--muted);font-size:14px;max-height:5.2em;overflow:hidden}
.item .b{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;flex:none}
.empty{border:1px dashed var(--line);border-radius:12px;padding:22px;text-align:center;color:var(--muted)}
.badge{display:inline-block;font-size:12px;font-weight:700;padding:2px 9px;border-radius:99px;background:var(--soft);color:var(--muted);margin-left:6px;vertical-align:1px}
.badge.pending{background:var(--accent-soft);color:var(--accent)}
.badge.ready,.badge.running{background:var(--warn-soft);color:var(--warn)}
.badge.done{background:var(--ok-soft);color:var(--ok)}
.badge.failed{background:var(--bad-soft);color:var(--bad)}
.err{color:var(--bad);font-size:13px;margin-top:4px;overflow-wrap:anywhere}

.thumbs{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.th{position:relative;width:64px;height:64px;border-radius:10px;overflow:hidden;border:1px solid var(--line);background:var(--soft)}
.th img{width:100%;height:100%;object-fit:cover;display:block}
.th button{position:absolute;top:2px;right:2px;width:20px;height:20px;border:0;border-radius:50%;background:rgba(10,14,25,.75);color:#fff;font-size:13px;line-height:20px;padding:0;cursor:pointer}
.drop{display:flex;align-items:center;justify-content:center;gap:8px;border:1.5px dashed var(--line);border-radius:12px;padding:14px;color:var(--muted);cursor:pointer;margin-top:12px;font-weight:600}
.drop:hover{border-color:var(--accent);color:var(--accent)}
.drop input{display:none}

.pick{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px;margin-top:6px}
.pick label{display:flex;gap:8px;align-items:center;border:1px solid var(--line);border-radius:10px;padding:8px 10px;background:var(--soft);cursor:pointer;overflow-wrap:anywhere}
.pick input{width:auto;accent-color:var(--accent)}
.seg{display:inline-flex;border:1px solid var(--line);border-radius:10px;overflow:hidden;margin:2px 0 4px}
.seg button{border:0;background:var(--soft);padding:8px 14px;cursor:pointer;font-weight:600;color:var(--muted)}
.seg button[aria-pressed=true]{background:var(--accent);color:var(--accent-ink)}

#toast{position:fixed;left:50%;bottom:22px;transform:translate(-50%,20px);opacity:0;pointer-events:none;background:var(--ink);color:var(--bg);padding:10px 16px;border-radius:10px;font-weight:600;max-width:calc(100vw - 32px);transition:opacity .2s,transform .2s;z-index:9}
#toast.show{opacity:1;transform:translate(-50%,0)}
#toast.bad{background:var(--bad);color:#fff}
section[hidden]{display:none}

#mbar{display:none;align-items:center;gap:8px;font-size:13px;color:var(--muted);margin:-10px 0 14px}
@media (max-width:820px){
 .app{display:block}
 .side{position:fixed;inset:auto 0 0 0;height:auto;z-index:5;flex-direction:row;padding:6px 8px;border-right:0;border-top:1px solid var(--line);gap:0}
 .brand,.runner{display:none}
 nav{flex-direction:row;width:100%;justify-content:space-between}
 .tab{flex-direction:column;gap:2px;font-size:11px;padding:6px 4px;flex:1;align-items:center;text-align:center}
 .tab .n{display:none}
 main{padding:18px 16px 96px}
 .stats{grid-template-columns:repeat(2,1fr)}
 .row{grid-template-columns:1fr}
 .item{flex-direction:column}.item .b{justify-content:flex-start}
 #mbar{display:flex}
}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>
</head>
<body>
<div class="app">
 <aside class="side">
  <div class="brand"><i class="logo"></i>Social Campaign</div>
  <nav id="tabs" role="tablist">
   <button class="tab" role="tab" data-tab="groups"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M18 14.8c1.7.7 3 2.4 3 5.2"/></svg>Grupos<span class="n" id="nGroups">0</span></button>
   <button class="tab" role="tab" data-tab="campaigns"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 9h10M7 13h6"/></svg>Campañas<span class="n" id="nCamps">0</span></button>
   <button class="tab" role="tab" data-tab="schedule"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>Programar<span class="n" id="nQueue">0</span></button>
   <button class="tab" role="tab" data-tab="activity"><svg viewBox="0 0 24 24"><path d="M3 12h4l3-7 4 14 3-7h4"/></svg>Actividad</button>
  </nav>
  <div class="runner"><b><i class="dot" id="rDot"></i><span id="rTitle" style="margin:0;color:inherit">Worker de Windows</span></b><span id="rInfo">Sin conexión todavía</span></div>
 </aside>

 <main>
  <div id="mbar"><i class="dot" id="rDot2"></i><span id="rInfo2">Worker de Windows: sin conexión</span></div>
  <div class="stats">
   <div class="stat"><b id="sGroups">0</b><span>Grupos</span></div>
   <div class="stat"><b id="sCamps">0</b><span>Campañas</span></div>
   <div class="stat"><b id="sQueue">0</b><span>En cola</span></div>
   <div class="stat"><b id="sDone">0</b><span>Publicadas</span></div>
  </div>

  <section id="tab-groups" hidden>
   <h1>Grupos</h1>
   <p class="lead">Los grupos de Facebook donde el worker va a publicar.</p>
   <div class="card">
    <h2>Agregar grupo</h2>
    <label class="f" for="destName">Nombre</label>
    <input type="text" id="destName" placeholder="Ej: Ventas Zona Norte">
    <label class="f" for="destUrl">Enlace del grupo</label>
    <input type="url" id="destUrl" placeholder="https://www.facebook.com/groups/...">
    <div class="actions"><button class="btn" data-act="addDest">Guardar grupo</button></div>
   </div>
   <div class="list" id="destinations"></div>
  </section>

  <section id="tab-campaigns" hidden>
   <h1>Campañas</h1>
   <p class="lead">El texto y las fotos que se publican. Cada campaña puede tener hasta 6 fotos.</p>
   <div class="card">
    <h2>Nueva campaña</h2>
    <label class="f" for="campName">Nombre interno</label>
    <input type="text" id="campName" placeholder="Ej: Oferta de noviembre">
    <label class="f" for="campContent">Texto de la publicación</label>
    <textarea id="campContent" placeholder="Lo que va a decir la publicación"></textarea>
    <label class="drop"><input type="file" id="campFiles" accept="image/*" multiple>+ Agregar fotos</label>
    <div class="thumbs" id="newThumbs"></div>
    <div class="actions">
     <button class="btn" data-act="addCamp" id="btnAddCamp">Guardar campaña</button>
     <button class="btn ghost" data-act="rewrite">Mejorar texto con Gemini</button>
    </div>
   </div>
   <div class="list" id="campaigns"></div>
  </section>

  <section id="tab-schedule" hidden>
   <h1>Programar</h1>
   <p class="lead">Elegí una campaña y los grupos. El worker de Windows las publica de a una, con pausas entre cada grupo.</p>
   <div class="card">
    <h2>Nueva publicación</h2>
    <label class="f" for="jobCampaign">Campaña</label>
    <select id="jobCampaign"></select>
    <label class="f">Grupos <button class="btn ghost sm" data-act="allGroups" style="margin-left:6px">Marcar todos</button></label>
    <div class="pick" id="jobGroups"></div>
    <label class="f">Cuándo</label>
    <div class="seg"><button data-when="now" aria-pressed="true">Ahora</button><button data-when="later" aria-pressed="false">Elegir fecha y hora</button></div>
    <div class="row" id="whenRow" hidden>
     <div><label class="f" for="jobDate">Fecha</label><input type="date" id="jobDate"></div>
     <div><label class="f" for="jobTime">Hora</label><input type="time" id="jobTime"></div>
    </div>
    <div class="actions"><button class="btn" data-act="schedule">Programar</button></div>
   </div>
   <h2 style="font-size:16px;margin:22px 0 10px">En cola</h2>
   <div class="list" id="queue"></div>
  </section>

  <section id="tab-activity" hidden>
   <h1>Actividad</h1>
   <p class="lead">Publicaciones ya hechas y las que fallaron.</p>
   <div class="actions" style="margin:0 0 12px"><button class="btn ghost" data-act="refresh">Actualizar</button></div>
   <div class="list" id="history"></div>
  </section>
 </main>
</div>
<div id="toast" role="status" aria-live="polite"></div>

<script>
var TOKEN = "__ADMIN_TOKEN__";
var S = {dest:[],camp:[],jobs:[],pending:[],when:"now",busy:false};
var $ = function(id){return document.getElementById(id)};

function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
var tt;
function toast(msg,bad){var t=$("toast");t.textContent=msg;t.className="show"+(bad?" bad":"");clearTimeout(tt);tt=setTimeout(function(){t.className=""},3200)}

async function api(path,method,body){
 var h={"X-Admin-Token":TOKEN};
 if(body)h["Content-Type"]="application/json";
 var r=await fetch(path,{method:method||"GET",headers:h,body:body?JSON.stringify(body):null});
 var d=await r.json().catch(function(){return {error:"Respuesta inválida del servidor"}});
 if(!r.ok)throw Error(d.error||("Error "+r.status));
 return d;
}
function fail(e){toast(e.message||String(e),true)}

/* ---------- Pestañas ---------- */
function showTab(name){
 ["groups","campaigns","schedule","activity"].forEach(function(t){$("tab-"+t).hidden=(t!==name)});
 var bs=document.querySelectorAll(".tab");
 for(var i=0;i<bs.length;i++)bs[i].setAttribute("aria-selected",bs[i].dataset.tab===name?"true":"false");
 try{localStorage.setItem("sc_tab",name)}catch(e){}
}

/* ---------- Fechas ---------- */
function fmt(iso){
 if(!iso)return "";
 var d=new Date(iso);if(isNaN(d))return String(iso);
 return d.toLocaleString("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});
}
var LABEL={pending:"Programada",ready:"Lista",running:"Publicando",done:"Publicada",failed:"Falló"};

/* ---------- Render ---------- */
function renderAll(){
 var queue=S.jobs.filter(function(j){return j.status==="pending"||j.status==="ready"||j.status==="running"});
 var done=S.jobs.filter(function(j){return j.status==="done"});
 $("sGroups").textContent=S.dest.length;$("nGroups").textContent=S.dest.length;
 $("sCamps").textContent=S.camp.length;$("nCamps").textContent=S.camp.length;
 $("sQueue").textContent=queue.length;$("nQueue").textContent=queue.length;
 $("sDone").textContent=done.length;

 $("destinations").innerHTML=S.dest.map(function(x){
  return '<div class="item"><div class="t"><b>'+esc(x.name)+'</b><small>'+esc(x.destination_url||"Sin enlace: agregalo para poder publicar")+'</small></div>'+
   '<div class="b"><button class="btn del sm" data-act="delDest" data-id="'+x.id+'">Eliminar</button></div></div>';
 }).join("")||'<div class="empty">Todavía no agregaste grupos.</div>';

 $("campaigns").innerHTML=S.camp.map(function(x){
  var th=(x.media||[]).map(function(m){
   return '<span class="th"><img alt="" src="'+esc(m.thumb||"")+'"><button title="Quitar foto" data-act="delMedia" data-id="'+m.id+'">×</button></span>';
  }).join("");
  return '<div class="item"><div class="t"><b>'+esc(x.name)+'</b><p>'+esc(x.content)+'</p>'+
   '<div class="thumbs">'+th+'</div></div>'+
   '<div class="b"><label class="btn ghost sm" style="cursor:pointer">+ Foto<input type="file" accept="image/*" multiple hidden data-addmedia="'+x.id+'"></label>'+
   '<button class="btn del sm" data-act="delCamp" data-id="'+x.id+'">Eliminar</button></div></div>';
 }).join("")||'<div class="empty">Todavía no creaste campañas.</div>';

 var sel=$("jobCampaign"),prev=sel.value;
 sel.innerHTML=S.camp.map(function(x){return '<option value="'+x.id+'">'+esc(x.name)+'</option>'}).join("");
 if(prev)sel.value=prev;
 var checked={};
 var cbs=document.querySelectorAll("#jobGroups input:checked");
 for(var i=0;i<cbs.length;i++)checked[cbs[i].value]=1;
 $("jobGroups").innerHTML=S.dest.map(function(x){
  return '<label><input type="checkbox" value="'+x.id+'"'+(checked[x.id]?" checked":"")+'>'+esc(x.name)+'</label>';
 }).join("")||'<div class="empty" style="grid-column:1/-1">Primero agregá grupos.</div>';

 $("queue").innerHTML=queue.map(jobHtml).join("")||'<div class="empty">No hay publicaciones en cola.</div>';
 var hist=S.jobs.filter(function(j){return j.status==="done"||j.status==="failed"});
 $("history").innerHTML=hist.map(jobHtml).join("")||'<div class="empty">Todavía no hay actividad.</div>';
}
function jobHtml(j){
 var run=(j.status==="pending"||j.status==="ready"||j.status==="failed");
 return '<div class="item"><div class="t"><b>'+esc(j.campaign_name||"Campaña")+' <span class="badge '+esc(j.status)+'">'+(LABEL[j.status]||esc(j.status))+'</span></b>'+
  '<small>'+esc(j.destination_name||"Grupo eliminado")+' · '+esc(fmt(j.status==="done"||j.status==="failed"?(j.finished_at||j.scheduled_at):j.scheduled_at))+'</small>'+
  (j.post_note?'<small>'+esc(j.post_note)+'</small>':'')+
  (j.last_error?'<div class="err">'+esc(j.last_error)+'</div>':'')+'</div>'+
  '<div class="b">'+(run?'<button class="btn ghost sm" data-act="runJob" data-id="'+j.id+'">'+(j.status==="failed"?"Reintentar":"Publicar ya")+'</button>':'')+
  (j.status!=="running"?'<button class="btn del sm" data-act="delJob" data-id="'+j.id+'">'+(j.status==="done"||j.status==="failed"?"Quitar":"Cancelar")+'</button>':'')+'</div></div>';
}

async function refresh(quiet){
 try{
  var r=await Promise.all([api("/api/destinations"),api("/api/campaigns"),api("/api/jobs"),api("/api/runner")]);
  S.dest=r[0].items||[];S.camp=r[1].items||[];S.jobs=r[2].items||[];
  renderAll();renderRunner(r[3]);
  if(!quiet)toast("Datos actualizados");
 }catch(e){if(!quiet)fail(e)}
}
function renderRunner(r){
 var on=r&&r.runner&&r.age_seconds!=null&&r.age_seconds<120;
 var txt=on?("En línea"+(r.runner.state?" · "+r.runner.state:"")):(r&&r.runner?"Sin señal desde "+fmt(r.runner.at):"Sin conexión todavía");
 $("rDot").className="dot"+(on?" on":(r&&r.runner?" warn":""));
 $("rDot2").className=$("rDot").className;
 $("rInfo").textContent=on?txt+(r.runner.host?" ("+r.runner.host+")":""):txt;
 $("rInfo2").textContent="Worker de Windows: "+txt;
}

/* ---------- Fotos (se reducen en el navegador antes de subir) ---------- */
function loadImg(file){return new Promise(function(ok,no){var u=URL.createObjectURL(file),i=new Image();i.onload=function(){URL.revokeObjectURL(u);ok(i)};i.onerror=function(){URL.revokeObjectURL(u);no(Error("No se pudo leer la foto"))};i.src=u})}
function draw(img,max,q){
 var s=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement("canvas");
 c.width=Math.max(1,Math.round(img.width*s));c.height=Math.max(1,Math.round(img.height*s));
 var x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,c.width,c.height);x.drawImage(img,0,0,c.width,c.height);
 return c.toDataURL("image/jpeg",q);
}
async function prepare(file){
 var img=await loadImg(file),q=0.82,d=draw(img,1280,q);
 while(d.length>1300000&&q>0.4){q-=0.12;d=draw(img,1280,q)}
 return {mime:"image/jpeg",data:d.split(",")[1],thumb:draw(img,160,0.7)};
}
async function pickFiles(files){
 var out=[];
 for(var i=0;i<files.length;i++){try{out.push(await prepare(files[i]))}catch(e){fail(e)}}
 return out;
}
function renderNewThumbs(){
 $("newThumbs").innerHTML=S.pending.map(function(p,i){
  return '<span class="th"><img alt="" src="'+p.thumb+'"><button title="Quitar" data-act="rmPending" data-i="'+i+'">×</button></span>';
 }).join("");
}

/* ---------- Acciones ---------- */
var ACT={
 async addDest(){
  var name=$("destName").value.trim(),url=$("destUrl").value.trim();
  if(!name)return toast("Escribí un nombre",true);
  if(!url)return toast("Pegá el enlace del grupo",true);
  await api("/api/destinations","POST",{name:name,url:url});
  $("destName").value="";$("destUrl").value="";
  await refresh(true);toast("Grupo guardado");
 },
 async delDest(el){if(!confirm("¿Eliminar este grupo?"))return;await api("/api/destinations/"+el.dataset.id,"DELETE");await refresh(true);toast("Grupo eliminado")},
 async addCamp(){
  var name=$("campName").value.trim(),content=$("campContent").value.trim();
  if(!name||!content)return toast("Completá el nombre y el texto",true);
  $("btnAddCamp").disabled=true;
  try{
   var r=await api("/api/campaigns","POST",{name:name,content:content});
   for(var i=0;i<S.pending.length;i++){var p=S.pending[i];await api("/api/media","POST",{campaign_id:r.id,mime:p.mime,data:p.data,thumb:p.thumb})}
   $("campName").value="";$("campContent").value="";S.pending=[];renderNewThumbs();
   await refresh(true);toast("Campaña guardada");
  }finally{$("btnAddCamp").disabled=false}
 },
 async delCamp(el){if(!confirm("¿Eliminar esta campaña con sus fotos?"))return;await api("/api/campaigns/"+el.dataset.id,"DELETE");await refresh(true);toast("Campaña eliminada")},
 async delMedia(el){await api("/api/media/"+el.dataset.id,"DELETE");await refresh(true);toast("Foto quitada")},
 rmPending(el){S.pending.splice(Number(el.dataset.i),1);renderNewThumbs()},
 async rewrite(){
  var c=$("campContent").value.trim();
  if(!c)return toast("Escribí primero el texto",true);
  toast("Gemini está trabajando...");
  var r=await api("/api/rewrite","POST",{content:c});
  $("campContent").value=r.content;toast("Texto mejorado");
 },
 allGroups(){
  var cbs=document.querySelectorAll("#jobGroups input"),all=true,i;
  for(i=0;i<cbs.length;i++)if(!cbs[i].checked)all=false;
  for(i=0;i<cbs.length;i++)cbs[i].checked=!all;
 },
 async schedule(){
  var camp=Number($("jobCampaign").value),ids=[],cbs=document.querySelectorAll("#jobGroups input:checked");
  for(var i=0;i<cbs.length;i++)ids.push(Number(cbs[i].value));
  if(!camp)return toast("Elegí una campaña",true);
  if(!ids.length)return toast("Marcá al menos un grupo",true);
  var body={campaign_id:camp,destination_ids:ids};
  if(S.when==="now")body.now=true;
  else{
   var d=$("jobDate").value,t=$("jobTime").value;
   if(!d||!t)return toast("Elegí fecha y hora",true);
   body.scheduled_at=new Date(d+"T"+t).toISOString();
  }
  var r=await api("/api/jobs","POST",body);
  await refresh(true);
  toast(r.created+(r.created===1?" publicación en cola":" publicaciones en cola"));
 },
 async runJob(el){await api("/api/jobs/"+el.dataset.id+"/run","POST");await refresh(true);toast("Enviada al worker")},
 async delJob(el){await api("/api/jobs/"+el.dataset.id,"DELETE");await refresh(true);toast("Quitada")},
 refresh(){return refresh(false)}
};

document.addEventListener("click",async function(ev){
 var tab=ev.target.closest(".tab");
 if(tab){showTab(tab.dataset.tab);return}
 var w=ev.target.closest("[data-when]");
 if(w){
  S.when=w.dataset.when;
  var bs=document.querySelectorAll("[data-when]");
  for(var i=0;i<bs.length;i++)bs[i].setAttribute("aria-pressed",bs[i]===w?"true":"false");
  $("whenRow").hidden=S.when==="now";
  if(S.when==="later"&&!$("jobDate").value){
   var n=new Date(Date.now()+3600000);
   $("jobDate").value=n.getFullYear()+"-"+String(n.getMonth()+1).padStart(2,"0")+"-"+String(n.getDate()).padStart(2,"0");
   $("jobTime").value=String(n.getHours()).padStart(2,"0")+":00";
  }
  return;
 }
 var el=ev.target.closest("[data-act]");
 if(!el||!ACT[el.dataset.act])return;
 try{await ACT[el.dataset.act](el)}catch(e){fail(e)}
});
document.addEventListener("change",async function(ev){
 var t=ev.target;
 try{
  if(t.id==="campFiles"){
   var room=6-S.pending.length,files=Array.prototype.slice.call(t.files,0,Math.max(room,0));
   var got=await pickFiles(files);S.pending=S.pending.concat(got);renderNewThumbs();t.value="";
  }else if(t.dataset&&t.dataset.addmedia){
   var got2=await pickFiles(Array.prototype.slice.call(t.files));
   for(var i=0;i<got2.length;i++)await api("/api/media","POST",{campaign_id:Number(t.dataset.addmedia),mime:got2[i].mime,data:got2[i].data,thumb:got2[i].thumb});
   t.value="";await refresh(true);toast("Fotos agregadas");
  }
 }catch(e){fail(e)}
});

var start="groups";try{start=localStorage.getItem("sc_tab")||"groups"}catch(e){}
showTab(start);
refresh(true);
setInterval(function(){if(!document.hidden)refresh(true)},20000);
</script>
</body>
</html>`;
