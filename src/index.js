const html = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Campañas IA</title><style>body{font:16px system-ui;background:#101318;color:#eee;max-width:760px;margin:30px auto;padding:0 16px}input,textarea,button{box-sizing:border-box;width:100%;padding:12px;margin:8px 0;background:#202631;color:#fff;border:1px solid #475569;border-radius:8px}button{background:#b91c1c;font-weight:bold;cursor:pointer}pre{white-space:pre-wrap;background:#202631;padding:12px;border-radius:8px}</style><h1>Social Campaign Worker AI</h1><p>Panel inicial: redactar y guardar borradores.</p><label>Texto base</label><textarea id="text" rows="5" placeholder="Escribí la descripción del producto o servicio"></textarea><button onclick="generate()">Generar versión con IA</button><button onclick="save()">Guardar borrador</button><pre id="out"></pre><script>async function generate(){out.textContent='Generando…';let r=await fetch('/api/generate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:text.value})});out.textContent=await r.text()}async function save(){out.textContent='Guardando…';let r=await fetch('/api/draft',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:text.value,title:text.value.slice(0,80)})});out.textContent=await r.text()}</script></html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/" && request.method === "GET") return new Response(html,{headers:{"content-type":"text/html;charset=utf-8"}});
    if (url.pathname === "/health") return Response.json({ok:true,name:"social-campaign-worker-ai"});
    if (url.pathname === "/api/generate" && request.method === "POST") {
      if (!env.GEMINI_API_KEY) return Response.json({error:"Falta configurar GEMINI_API_KEY"}, {status:500});
      let body; try { body=await request.json(); } catch { return Response.json({error:"JSON inválido"},{status:400}); }
      const source=String(body.text||"").trim();
      if(!source) return Response.json({error:"Ingresá un texto"}, {status:400});
      const model=env.GEMINI_MODEL||"gemini-2.5-flash";
      const endpoint=`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
      const prompt=`Reescribe el siguiente anuncio en español claro y atractivo para redes sociales. No inventes precios, características, disponibilidad, beneficios ni datos que no estén presentes. Mantén fieles los hechos.\n\n${source}`;
      const response=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:prompt}]}]})});
      const data=await response.json();
      if(!response.ok) return Response.json({error:"Gemini respondió con error",details:data}, {status:502});
      return Response.json({text:data.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("")||""});
    }
    if (url.pathname === "/api/draft" && request.method === "POST") {
      if(!env.DB) return Response.json({error:"D1 todavía no está conectado"}, {status:500});
      let body; try{body=await request.json()}catch{return Response.json({error:"JSON inválido"},{status:400})}
      const text=String(body.text||"").trim(); const title=String(body.title||"Borrador").trim();
      if(!text) return Response.json({error:"El texto está vacío"},{status:400});
      const result=await env.DB.prepare("INSERT INTO campaigns(title,text,status) VALUES(?,?, 'draft')").bind(title,text).run();
      return Response.json({ok:true,id:result.meta?.last_row_id});
    }
    if (url.pathname === "/api/drafts" && request.method === "GET") {
      if(!env.DB) return Response.json({error:"D1 todavía no está conectado"}, {status:500});
      const result=await env.DB.prepare("SELECT id,title,text,status,created_at FROM campaigns ORDER BY id DESC LIMIT 50").all();
      return Response.json(result.results||[]);
    }
    return new Response("No encontrado",{status:404});
  },
  async scheduled(controller, env, ctx) {
    // Placeholder de scheduler: la cola y los conectores de publicación se implementarán después.
    console.log("Scheduler tick:", new Date(controller.scheduledTime).toISOString());
  }
};
