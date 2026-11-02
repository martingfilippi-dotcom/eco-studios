const cors = {
  "Access-Control-Allow-Origin": "https://martingfilippi-dotcom.github.io",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400"
};
const json = (data, status=200) => new Response(JSON.stringify(data), {status,headers:{"Content-Type":"application/json; charset=utf-8",...cors,"Cache-Control":"no-store"}});
const clean = (v,n=2000) => typeof v==="string" ? v.trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,"").slice(0,n) : "";
const allowed = new Set(["Producción de beat","Producción completa de canción","Plan Esencial","Plan Pro","Plan Élite","Beat personalizado","Sesión de fotos","Hora de estudio","Videoclip / audiovisual","Booking / eventos","Otro"]);
async function hash(value){const bytes=new TextEncoder().encode(value);const digest=await crypto.subtle.digest("SHA-256",bytes);return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");}
export default {
 async fetch(request, env) {
  if(request.method==="OPTIONS") return new Response(null,{status:204,headers:cors});
  const url=new URL(request.url);
  if(url.pathname==="/health" && request.method==="GET") return json({ok:true,service:"ECO Studios Intake API",region:"EU"});
  if(url.pathname!=="/api/requests" || request.method!=="POST") return json({error:"Not found"},404);
  if(request.headers.get("Origin")!=="https://martingfilippi-dotcom.github.io") return json({error:"Origin not allowed"},403);
  let body; try { body=await request.json(); } catch { return json({error:"Solicitud inválida"},400); }
  const name=clean(body.name,120), email=clean(body.email,254).toLowerCase(), phone=clean(body.phone,40);
  const requestType=body.requestType==="contact"?"Solo contacto":"Servicio";
  const service=clean(body.service,80);
  const details=clean(body.details,3000), budget=clean(body.budget,100);
  const date=clean(body.preferredDate,10), time=clean(body.preferredTime,20);
  const references=Array.isArray(body.references)?body.references.slice(0,5).map(x=>clean(x,500)).filter(x=>/^https:\/\//i.test(x)): [];
  if(!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !body.consentData || !body.consentContact) return json({error:"Completá nombre, email y los consentimientos obligatorios."},422);
  if(requestType==="Servicio" && !allowed.has(service)) return json({error:"Seleccioná un servicio válido."},422);
  if(date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({error:"La fecha no es válida."},422);
  if(time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return json({error:"El horario no es válido."},422);
  const ip=request.headers.get("CF-Connecting-IP")||"unknown";
  const ipHash=await hash(ip+"|eco-intake-v1");
  const now=new Date().toISOString();
  const recent=await env.DB.prepare("SELECT COUNT(*) AS n FROM rate_limits WHERE ip_hash=? AND created_at > datetime('now','-1 hour')").bind(ipHash).first();
  if((recent?.n||0)>=5) return json({error:"Alcanzaste el límite temporal. Escribinos por WhatsApp para continuar."},429);
  const id="ECO-"+now.slice(0,10).replaceAll("-","")+"-"+crypto.randomUUID().slice(0,8).toUpperCase();
  await env.DB.batch([
   env.DB.prepare("INSERT INTO requests (id,name,email,phone,request_type,service,preferred_date,preferred_time,details,references_json,budget,contact_method,consent_contact,consent_data,status,email_status,notion_status,created_at,ip_hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'Nuevo','pending','pending',?,?)").bind(id,name,email,phone,requestType,requestType==="Servicio"?service:null,date||null,time||null,details,JSON.stringify(references),budget,clean(body.contactMethod,20)||"email",1,1,now,ipHash),
   env.DB.prepare("INSERT INTO rate_limits (ip_hash,created_at) VALUES (?,?)").bind(ipHash,now),
   env.DB.prepare("DELETE FROM rate_limits WHERE created_at < datetime('now','-2 days')")
  ]);
  return json({ok:true,id,message:"Solicitud recibida. ECO Studios se pondrá en contacto contigo."},201);
 }
};