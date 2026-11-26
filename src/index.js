const HTML = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Social Campaign AI</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#10131b;color:#f4f6fb;font-family:Arial,sans-serif}
header{padding:22px;background:#171d2a;border-bottom:1px solid #293246}
h1{margin:0;color:#fff;font-size:24px}
h1 span{color:#55e6ff}
main{max-width:1100px;margin:auto;padding:18px}
.card{background:#1a2130;border:1px solid #303b50;border-radius:14px;padding:18px;margin:14px 0}
input,textarea,select,button{width:100%;padding:12px;margin:7px 0;border-radius:8px;border:1px solid #38445b;background:#101722;color:white;font-size:15px}
textarea{min-height:110px;resize:vertical}
button{background:#00c8e8;color:#06131b;font-weight:bold;border:none;cursor:pointer}
button.secondary{background:#303d54;color:white}
button.danger{background:#c74353;color:white}
.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.item{border:1px solid #38445b;padding:12px;margin:8px 0;border-radius:9px;overflow-wrap:anywhere}
.small{font-size:12px;color:#aebbd0}
.status{color:#55e6ff}
#msg{padding:10px;color:#55e6ff;overflow-wrap:anywhere}
@media(max-width:650px){.row{grid-template-columns:1fr}}
</style>
</head>
<body>
<header><h1>Social Campaign <span>AI</span></h1><p>Panel de campañas y programación</p></header>
<main>
<div class="card">
<h3>Administrador</h3>
<input id="token" type="password" placeholder="SOCIAL_ADMIN_TOKEN">
<button onclick="saveToken()">Ingresar / Guardar acceso</button>
<button class="secondary" onclick="forgetToken()">Cerrar sesión</button>
<div id="msg">Ingresá la contraseña de administrador.</div>
</div>

<div class="card">
<h3>1. Destinos de publicación</h3>
<input id="destName" placeholder="Nombre del grupo de Facebook">
<input id="destUrl" placeholder="Enlace del grupo">
<button onclick="addDestination()">Agregar destino</button>
<div id="destinations"></div>
</div>

<div class="card">
<h3>2. Crear campaña</h3>
<input id="campName" placeholder="Nombre de la campaña">
<textarea id="campContent" placeholder="Texto de la publicación"></textarea>
<button class="secondary" onclick="rewrite()">Mejorar texto con Gemini</button>
<div class="row">
<div><label>Inicio</label><input type="datetime-local" id="campStart"></div>
<div><label>Fin (opcional)</label><input type="datetime-local" id="campEnd"></div>
</div>
<button onclick="addCampaign()">Guardar campaña</button>
<div id="campaigns"></div>
</div>

<div class="card">
<h3>3. Programar publicaciones</h3>
<select id="jobCampaign"></select>
<select id="jobDestination"></select>
<div class="row">
<div><label>Fecha</label><input type="date" id="jobDate"></div>
<div><label>Hora</label><input type="time" id="jobTime"></div>
</div>
<button onclick="scheduleJob()">Programar</button>
<p class="small">Cada tarea se guarda con su fecha, hora, destino y campaña. La publicación real requiere conectar el ejecutor de Facebook.</p>
<div id="jobs"></div>
</div>

<div class="card">
<h3>Estado del sistema</h3>
<button class="secondary" onclick="refresh()">Actualizar panel</button>
<div id="system"></div>
</div>
</main>
<script>
let token=sessionStorage.getItem('sc_token')||'';
let destinations=[],campaigns=[];

document.getElementById('token').value=token;
function message(t){document.getElementById('msg').textContent=t}
function saveToken(){
 token=document.getElementById('token').value.trim();
 if(!token){message('Ingresá el token.');return}
 sessionStorage.setItem('sc_token',token);
 message('Token guardado en esta sesión.');
 refresh();
}
function forgetToken(){
 token='';
 sessionStorage.removeItem('sc_token');
 document.getElementById('token').value='';
 message('Sesión cerrada.');
}
async function api(path,method='GET',body=null){
 const headers={'X-Admin-Token':token};
 if(body)headers['Content-Type']='application/json';
 const r=await fetch(path,{method,headers,body:body?JSON.stringify(body):null});
 const data=await r.json().catch(()=>({error:'Respuesta inválida'}));
 if(!r.ok)throw Error(data.error||'Error '+r.status);
 return data;
}
function esc(s){
 return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
async function addDestination(){
 try{
 const name=document.getElementById('destName').value.trim();
 const url=document.getElementById('destUrl').value.trim();
 if(!name)throw Error('Ingresá un nombre.');
 await api('/api/destinations','POST',{name,url});
 document.getElementById('destName').value='';
 document.getElementById('destUrl').value='';
 await refresh();
 message('Destino guardado.');
 }catch(e){message(e.message)}
}
async function addCampaign(){
 try{
 const name=document.getElementById('campName').value.trim();
 const content=document.getElementById('campContent').value.trim();
 const start=document.getElementById('campStart').value;
 const end=document.getElementById('campEnd').value;
 if(!name||!content||!start)throw Error('Completá nombre, contenido e inicio.');
 await api('/api/campaigns','POST',{name,content,start_date:start,end_date:end||null});
 await refresh();
 message('Campaña guardada.');
 }catch(e){message(e.message)}
}
async function rewrite(){
 try{
 const content=document.getElementById('campContent').value.trim();
 if(!content)throw Error('Escribí primero el texto.');
 message('Gemini está trabajando...');
 const r=await api('/api/rewrite','POST',{content});
 document.getElementById('campContent').value=r.content;
 message('Texto mejorado.');
 }catch(e){message(e.message)}
}
async function scheduleJob(){
 try{
 const campaign_id=Number(document.getElementById('jobCampaign').value);
 const destination_id=Number(document.getElementById('jobDestination').value);
 const date=document.getElementById('jobDate').value;
 const time=document.getElementById('jobTime').value;
 if(!campaign_id||!destination_id||!date||!time)throw Error('Completá todos los datos.');
 await api('/api/jobs','POST',{campaign_id,destination_id,scheduled_at:date+'T'+time});
 await refresh();
 message('Publicación programada y guardada.');
 }catch(e){message(e.message)}
}
async function refresh(){
 if(!token){message('Ingresá el token de administrador.');return}
 try{
 const [d,c,j,s]=await Promise.all([
 api('/api/destinations'),api('/api/campaigns'),api('/api/jobs'),api('/api/status')
 ]);
 destinations=d.items||[];
 campaigns=c.items||[];
 document.getElementById('destinations').innerHTML=destinations.map(x=>
 '<div class="item"><b>'+esc(x.name)+'</b><br><span class="small">'+esc(x.destination_url||'Sin URL')+'</span><br><button class="danger" onclick="deleteDestination('+x.id+')">Eliminar</button></div>'
 ).join('')||'No hay destinos.';
 document.getElementById('campaigns').innerHTML=campaigns.map(x=>
 '<div class="item"><b>'+esc(x.name)+'</b><br>'+esc(x.content)+'<br><span class="small">'+esc(x.start_date)+'</span><br><button class="danger" onclick="deleteCampaign('+x.id+')">Eliminar</button></div>'
 ).join('')||'No hay campañas.';
 document.getElementById('jobCampaign').innerHTML=campaigns.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join('');
 document.getElementById('jobDestination').innerHTML=destinations.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join('');
 document.getElementById('jobs').innerHTML=(j.items||[]).map(x=>
 '<div class="item"><b>'+esc(x.campaign_name||'Campaña')+'</b><br>Destino: '+esc(x.destination_name||'')+'<br>Fecha: '+esc(x.scheduled_at)+'<br>Estado: <span class="status">'+esc(x.status)+'</span><br>'+(x.last_error?'<span class="small">'+esc(x.last_error)+'</span>':'')+'<br><button class="danger" onclick="deleteJob('+x.id+')">Cancelar tarea</button></div>'
 ).join('')||'No hay tareas programadas.';
 document.getElementById('system').textContent='Panel conectado. Campañas: '+campaigns.length+' | Destinos: '+destinations.length+' | Tareas: '+(j.items||[]).length+' | Worker activo.';
 message('Datos actualizados.');
 }catch(e){message(e.message)}
}
async function deleteDestination(id){
 if(!confirm('¿Eliminar este destino?'))return;
 try{await api('/api/destinations/'+id,'DELETE');await refresh()}catch(e){message(e.message)}
}
async function deleteCampaign(id){
 if(!confirm('¿Eliminar esta campaña?'))return;
 try{await api('/api/campaigns/'+id,'DELETE');await refresh()}catch(e){message(e.message)}
}
async function deleteJob(id){
 if(!confirm('¿Cancelar esta tarea?'))return;
 try{await api('/api/jobs/'+id,'DELETE');await refresh()}catch(e){message(e.message)}
}
</script>
</body>
</html>`;

const corsHeaders = {
 "Access-Control-Allow-Origin": "*",
 "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
 "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS"
};

function json(data,status=200){
 return new Response(JSON.stringify(data),{
  status,
  headers:{...corsHeaders,"Content-Type":"application/json"}
 });
}

function html(){
 return new Response(HTML,{
  headers:{...corsHeaders,"Content-Type":"text/html;charset=UTF-8"}
 });
}

async function rewriteText(content,env){
 const keys=(env.GEMINI_API_KEYS||env.GEMINI_API_KEY||"")
 .split(",").map(x=>x.trim()).filter(Boolean);
 if(!keys.length)throw Error("Falta GEMINI_API_KEYS.");

 const models=["gemini-2.5-flash","gemini-2.0-flash"];
 let last="No se pudo generar el texto.";

 for(const key of keys){
  for(const model of models){
   try{
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),12000);
    const r=await fetch(
     "https://generativelanguage.googleapis.com/v1beta/models/"+model+":generateContent?key="+encodeURIComponent(key),
     {
      method:"POST",
      signal:controller.signal,
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
       contents:[{parts:[{text:
        "Reescribí el siguiente texto para una publicación comercial de redes sociales. "+
        "Conservá fielmente los datos, no inventes precios, promociones, productos ni hechos. "+
        "Usá un tono atractivo, claro y natural. Respondé únicamente con el texto final.\\n\\n"+content
       }]}],
       generationConfig:{temperature:0.7}
      })
     }
    );
    clearTimeout(timeout);
    const data=await r.json();
    if(!r.ok){last=data?.error?.message||"Error Gemini";continue}
    const result=data?.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("").trim();
    if(result)return result;
   }catch(e){last=e.message}
  }
 }
 throw Error(last);
}

async function handle(request,env){
 const url=new URL(request.url);
 const path=url.pathname;
 const method=request.method;

 if(method==="OPTIONS")return new Response(null,{headers:corsHeaders});
 if(path==="/"&&method==="GET")return html();

 if(path==="/api/status"&&method==="GET")
  return json({ok:true,worker:"active",time:new Date().toISOString()});

 if(!env.DB)return json({error:"No está configurada la vinculación D1 DB."},500);
 const auth=request.headers.get("X-Admin-Token")||"";
 if(!env.SOCIAL_ADMIN_TOKEN||auth!==env.SOCIAL_ADMIN_TOKEN)
  return json({error:"Token incorrecto. Ingresá el token de administrador."},401);

 try{
  if(path==="/api/rewrite"&&method==="POST"){
   const body=await request.json();
   const content=String(body.content||"").trim();
   if(!content)return json({error:"Texto vacío."},400);
   const result=await rewriteText(content,env);
   return json({content:result});
  }

  if(path==="/api/destinations"&&method==="GET"){
   const result=await env.DB.prepare(
    "SELECT * FROM sc_destinations ORDER BY id DESC"
   ).all();
   return json({items:result.results||[]});
  }

  if(path==="/api/destinations"&&method==="POST"){
   const body=await request.json();
   const name=String(body.name||"").trim();
   const url=String(body.url||"").trim();
   if(!name)return json({error:"El nombre es obligatorio."},400);
   await env.DB.prepare(
    "INSERT INTO sc_destinations (name,platform,destination_type,destination_url,enabled) VALUES (?, 'facebook','group',?,1)"
   ).bind(name,url||null).run();
   return json({ok:true});
  }

  if(path.startsWith("/api/destinations/")&&method==="DELETE"){
   const id=Number(path.split("/").pop());
   if(!Number.isInteger(id)||id<=0)return json({error:"ID inválido."},400);
   const jobs=await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM sc_jobs WHERE destination_id=? AND status IN ('pending','ready')"
   ).bind(id).first();
   if(jobs?.n)return json({error:"Este destino tiene tareas pendientes. Cancelalas primero."},400);
   await env.DB.prepare("DELETE FROM sc_destinations WHERE id=?").bind(id).run();
   return json({ok:true});
  }

  if(path==="/api/campaigns"&&method==="GET"){
   const result=await env.DB.prepare(
    "SELECT * FROM sc_campaigns ORDER BY id DESC"
   ).all();
   return json({items:result.results||[]});
  }

  if(path==="/api/campaigns"&&method==="POST"){
   const body=await request.json();
   const name=String(body.name||"").trim();
   const content=String(body.content||"").trim();
   const start=String(body.start_date||"").trim();
   const end=body.end_date?String(body.end_date):null;
   if(!name||!content||!start)return json({error:"Faltan datos de campaña."},400);
   await env.DB.prepare(
    "INSERT INTO sc_campaigns (name,content,status,start_date,end_date) VALUES (?,?,'active',?,?)"
   ).bind(name,content,start,end).run();
   return json({ok:true});
  }

  if(path.startsWith("/api/campaigns/")&&method==="DELETE"){
   const id=Number(path.split("/").pop());
   if(!Number.isInteger(id)||id<=0)return json({error:"ID inválido."},400);
   const jobs=await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM sc_jobs WHERE campaign_id=? AND status IN ('pending','ready')"
   ).bind(id).first();
   if(jobs?.n)return json({error:"Esta campaña tiene tareas pendientes. Cancelalas primero."},400);
   await env.DB.prepare("DELETE FROM sc_campaigns WHERE id=?").bind(id).run();
   return json({ok:true});
  }

  if(path==="/api/jobs"&&method==="GET"){
   const result=await env.DB.prepare(
    "SELECT j.*,c.name AS campaign_name,d.name AS destination_name FROM sc_jobs j LEFT JOIN sc_campaigns c ON c.id=j.campaign_id LEFT JOIN sc_destinations d ON d.id=j.destination_id ORDER BY j.scheduled_at DESC LIMIT 200"
   ).all();
   return json({items:result.results||[]});
  }

  if(path==="/api/jobs"&&method==="POST"){
   const body=await request.json();
   const campaign=Number(body.campaign_id);
   const destination=Number(body.destination_id);
   const date=String(body.scheduled_at||"").trim();
   if(!campaign||!destination||!date)return json({error:"Faltan datos."},400);
   const c=await env.DB.prepare("SELECT id FROM sc_campaigns WHERE id=?").bind(campaign).first();
   const d=await env.DB.prepare("SELECT id,enabled FROM sc_destinations WHERE id=?").bind(destination).first();
   if(!c||!d)return json({error:"Campaña o destino inexistente."},400);
   if(!d.enabled)return json({error:"El destino está desactivado."},400);
   await env.DB.prepare(
    "INSERT INTO sc_jobs (campaign_id,destination_id,scheduled_at,status) VALUES (?,?,?,'pending')"
   ).bind(campaign,destination,date).run();
   return json({ok:true});
  }

  if(path.startsWith("/api/jobs/")&&method==="DELETE"){
   const id=Number(path.split("/").pop());
   if(!Number.isInteger(id)||id<=0)return json({error:"ID inválido."},400);
   await env.DB.prepare(
    "DELETE FROM sc_jobs WHERE id=? AND status IN ('pending','ready')"
   ).bind(id).run();
   return json({ok:true});
  }

  if(path==="/api/cron"&&method==="POST"){
   const result=await env.DB.prepare(
    "UPDATE sc_jobs SET status='ready' WHERE status='pending' AND scheduled_at<=datetime('now')"
   ).run();
   return json({ok:true,ready:result.meta?.changes||0,note:"Las tareas están marcadas como ready; todavía requieren un ejecutor de publicación."});
  }

  return json({error:"Ruta no encontrada."},404);
 }catch(e){
  return json({error:e.message||"Error interno"},500);
 }
}

export default {
 async fetch(request,env,ctx){
  return handle(request,env);
 },
 async scheduled(event,env,ctx){
  if(!env.DB)return;
  ctx.waitUntil(
   env.DB.prepare(
    "UPDATE sc_jobs SET status='ready' WHERE status='pending' AND scheduled_at<=datetime('now')"
   ).run()
  );
 }
};
