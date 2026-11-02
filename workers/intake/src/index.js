const WEB_ORIGIN = "https://martingfilippi-dotcom.github.io";
const NOTION_DATA_SOURCE_DEFAULT = "065d4e3e-f8e9-4710-94c0-37fefe37c919";
const ALLOWED_SERVICES = new Set([
  "Producción de beat", "Producción completa de canción", "Plan Esencial",
  "Plan Pro", "Plan Élite", "Beat personalizado", "Sesión de fotos",
  "Hora de estudio", "Videoclip / audiovisual", "Booking / eventos", "Otro"
]);
const corsHeaders = {
  "Access-Control-Allow-Origin": WEB_ORIGIN,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin"
};
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders, "Cache-Control": "no-store" }
});
const clean = (value, max = 2000) => typeof value === "string"
  ? value.trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").slice(0, max)
  : "";
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[char]);
const richText = (value) => ({
  rich_text: value ? [{ type: "text", text: { content: String(value).slice(0, 2000) } }] : []
});
async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00.000Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function localToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Asuncion" }).format(new Date());
}
async function activity(db, id, event, details = "") {
  await db.prepare(
    "INSERT INTO request_activity (request_id,event,details,created_at) VALUES (?,?,?,?)"
  ).bind(id, event, clean(details, 1000), new Date().toISOString()).run();
}
async function setIntegrationState(db, id, column, status, error = null) {
  const allowedColumns = new Set([
    "notion_status", "notion_last_error", "email_status", "email_last_error",
    "customer_email_status", "admin_email_status"
  ]);
  if (!allowedColumns.has(column)) throw new Error("Invalid integration state column");
  await db.prepare(`UPDATE requests SET ${column} = ? WHERE id = ?`)
    .bind(status === null ? null : clean(status, 2000), id).run();
  if (error) await db.prepare(`UPDATE requests SET ${column === "notion_status" ? "notion_last_error" : "email_last_error"} = ? WHERE id = ?`)
    .bind(clean(error, 1800), id).run();
}
async function notionRequest(path, token, body) {
  const response = await fetch("https://api.notion.com/v1" + path, {
    method: body ? "POST" : "GET",
    headers: {
      "Authorization": "Bearer " + token,
      "Notion-Version": "2025-09-03",
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("Notion " + response.status + ": " + clean(payload.message || payload.code || "API error", 500));
  return payload;
}
async function syncNotion(env, requestRow) {
  if (!env.NOTION_TOKEN) {
    await setIntegrationState(env.DB, requestRow.id, "notion_status", "not_configured");
    return;
  }
  await env.DB.prepare("UPDATE requests SET notion_attempts = notion_attempts + 1 WHERE id = ?")
    .bind(requestRow.id).run();
  try {
    const sourceId = clean(env.NOTION_DATA_SOURCE_ID || NOTION_DATA_SOURCE_DEFAULT, 80);
    const existing = await notionRequest("/data_sources/" + sourceId + "/query", env.NOTION_TOKEN, {
      filter: { property: "ID de solicitud", rich_text: { equals: requestRow.id } },
      page_size: 1
    });
    let pageId = existing.results?.[0]?.id;
    if (!pageId) {
      const properties = {
        "Nombre completo": { title: [{ type: "text", text: { content: requestRow.name } }] },
        "Email": { email: requestRow.email },
        "Tipo de solicitud": { select: { name: requestRow.request_type } },
        "Estado": { select: { name: "Nuevo" } },
        "Estado de sincronización": { select: { name: "Sincronizado" } },
        "ID de solicitud": richText(requestRow.id),
        "Horario preferido": richText(requestRow.preferred_time),
        "Detalles del proyecto": richText(requestRow.details),
        "Enlaces de referencia": richText((JSON.parse(requestRow.references_json || "[]")).join("\n")),
        "Presupuesto estimado": richText(requestRow.budget),
        "Origen": richText("Formulario web ECO Studios"),
        "Consentimiento de datos": { checkbox: !!requestRow.consent_data },
        "Consentimiento de contacto": { checkbox: !!requestRow.consent_contact }
      };
      if (requestRow.phone) properties["Teléfono / WhatsApp"] = { phone_number: requestRow.phone };
      if (requestRow.service) properties["Servicio solicitado"] = { select: { name: requestRow.service } };
      if (requestRow.preferred_date) properties["Fecha preferida"] = { date: { start: requestRow.preferred_date } };
      const page = await notionRequest("/pages", env.NOTION_TOKEN, {
        parent: { type: "data_source_id", data_source_id: sourceId },
        properties
      });
      pageId = page.id;
    }
    await env.DB.prepare(
      "UPDATE requests SET notion_status='synced', notion_page_id=?, notion_last_error=NULL WHERE id=?"
    ).bind(pageId, requestRow.id).run();
    await activity(env.DB, requestRow.id, "notion_synced", pageId || "");
  } catch (error) {
    await env.DB.prepare("UPDATE requests SET notion_status='error', notion_last_error=? WHERE id=?")
      .bind(clean(error.message, 1800), requestRow.id).run();
    await activity(env.DB, requestRow.id, "notion_error", clean(error.message, 500));
  }
}
async function sendResendEmail(env, to, subject, html, idempotencyKey, replyTo) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + env.RESEND_API_KEY,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [to],
      subject,
      html,
      ...(replyTo ? { reply_to: [replyTo] } : {})
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("Resend " + response.status + ": " + clean(data.message || data.name || "API error", 500));
  return data;
}
async function sendEmails(env, row) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    await setIntegrationState(env.DB, row.id, "email_status", "not_configured");
    return;
  }
  await env.DB.prepare("UPDATE requests SET email_attempts = email_attempts + 1 WHERE id = ?")
    .bind(row.id).run();
  const safeName = escapeHtml(row.name);
  const safeId = escapeHtml(row.id);
  const safeService = escapeHtml(row.service || "Solo contacto");
  const safeDate = escapeHtml(row.preferred_date || "Sin preferencia");
  const safeTime = escapeHtml(row.preferred_time || "Sin preferencia");
  const safeDetails = escapeHtml(row.details || "Sin detalles adicionales").replace(/\n/g, "<br>");
  const safeBudget = escapeHtml(row.budget || "No indicado");
  const confirmationHtml = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#171717;max-width:620px;margin:auto"><div style="background:#0B0B0B;color:#F5F2EB;padding:26px"><div style="color:#FF6A00;letter-spacing:3px;font-size:12px">ECO STUDIOS</div><h1 style="font-size:25px;margin:12px 0 0">Recibimos tu solicitud.</h1></div><div style="padding:24px"><p>Hola ${safeName},</p><p>Gracias por contactar a ECO Studios. Tu solicitud quedó registrada con el código <strong>${safeId}</strong>.</p><p>Nuestro equipo revisará la información y se comunicará contigo. El envío no confirma una reserva ni una fecha de estudio.</p><p>Saludos,<br><strong>ECO Studios</strong></p></div></div>`;
  const adminHtml = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#171717;max-width:680px;margin:auto"><h2>Nueva solicitud web · ECO Studios</h2><p><strong>ID:</strong> ${safeId}</p><p><strong>Nombre:</strong> ${safeName}<br><strong>Email:</strong> ${escapeHtml(row.email)}<br><strong>Teléfono:</strong> ${escapeHtml(row.phone || "No indicado")}</p><p><strong>Tipo:</strong> ${escapeHtml(row.request_type)}<br><strong>Servicio:</strong> ${safeService}<br><strong>Fecha:</strong> ${safeDate}<br><strong>Horario:</strong> ${safeTime}<br><strong>Presupuesto:</strong> ${safeBudget}</p><p><strong>Detalles:</strong><br>${safeDetails}</p><p><strong>Referencias:</strong><br>${escapeHtml((JSON.parse(row.references_json || "[]")).join("\n") || "Ninguna").replace(/\n/g, "<br>")}</p><p>Revisar en el panel privado de Notion.</p></div>`;
  const jobs = [];
  if (row.customer_email_status !== "sent") {
    jobs.push((async () => {
      try {
        await sendResendEmail(env, row.email, "Recibimos tu solicitud · ECO Studios", confirmationHtml, "eco-" + row.id + "-customer");
        await env.DB.prepare("UPDATE requests SET customer_email_status='sent' WHERE id=?").bind(row.id).run();
        await activity(env.DB, row.id, "customer_email_sent");
      } catch (error) {
        await env.DB.prepare("UPDATE requests SET customer_email_status='error', email_last_error=? WHERE id=?")
          .bind(clean(error.message, 1800), row.id).run();
        await activity(env.DB, row.id, "customer_email_error", clean(error.message, 500));
      }
    })());
  }
  if (row.admin_email_status !== "sent") {
    jobs.push((async () => {
      try {
        await sendResendEmail(env, env.ADMIN_EMAIL || "ecostudiosparaguay@gmail.com", "Nueva solicitud " + row.id + " · ECO Studios", adminHtml, "eco-" + row.id + "-admin", row.email);
        await env.DB.prepare("UPDATE requests SET admin_email_status='sent' WHERE id=?").bind(row.id).run();
        await activity(env.DB, row.id, "admin_email_sent");
      } catch (error) {
        await env.DB.prepare("UPDATE requests SET admin_email_status='error', email_last_error=? WHERE id=?")
          .bind(clean(error.message, 1800), row.id).run();
        await activity(env.DB, row.id, "admin_email_error", clean(error.message, 500));
      }
    })());
  }
  await Promise.all(jobs);
  const statuses = await env.DB.prepare("SELECT customer_email_status,admin_email_status FROM requests WHERE id=?").bind(row.id).first();
  const complete = statuses?.customer_email_status === "sent" && statuses?.admin_email_status === "sent";
  await env.DB.prepare("UPDATE requests SET email_status=? WHERE id=?")
    .bind(complete ? "sent" : "error", row.id).run();
}
async function fetchRequest(db, id) {
  return db.prepare("SELECT * FROM requests WHERE id=?").bind(id).first();
}
async function processIntegrations(env, id) {
  const row = await fetchRequest(env.DB, id);
  if (!row) return;
  await Promise.all([syncNotion(env, row), sendEmails(env, row)]);
}
async function handleSubmission(request, env, ctx) {
  const origin = request.headers.get("Origin");
  if (origin !== WEB_ORIGIN) return json({ error: "Origin not allowed" }, 403);
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 20000) return json({ error: "La solicitud supera el tamaño permitido." }, 413);
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Solicitud inválida." }, 400);
  }
  const websiteField = clean(body.companyWebsite, 200);
  if (websiteField) return json({ error: "Solicitud inválida." }, 400);
  const name = clean(body.name, 120);
  const email = clean(body.email, 254).toLowerCase();
  const phone = clean(body.phone, 40);
  const requestType = body.requestType === "contact" ? "Solo contacto" : body.requestType === "service" ? "Servicio" : "";
  const service = clean(body.service, 80);
  const details = clean(body.details, 3000);
  const budget = clean(body.budget, 100);
  const date = clean(body.preferredDate, 10);
  const time = clean(body.preferredTime, 5);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "Completá un nombre y un email válido." }, 422);
  }
  if (!requestType || (requestType === "Servicio" && !ALLOWED_SERVICES.has(service))) {
    return json({ error: "Seleccioná un tipo de solicitud y un servicio válido." }, 422);
  }
  if (body.consentContact !== true || body.consentData !== true) {
    return json({ error: "Necesitamos ambos consentimientos para gestionar la solicitud." }, 422);
  }
  if (date && (!validDate(date) || date < localToday())) return json({ error: "La fecha preferida debe ser una fecha válida y no pasada." }, 422);
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return json({ error: "El horario no es válido." }, 422);
  let references = [];
  if (body.references !== undefined && !Array.isArray(body.references)) return json({ error: "Las referencias deben enviarse como una lista de enlaces." }, 422);
  if (Array.isArray(body.references)) {
    if (body.references.length > 5) return json({ error: "Podés enviar un máximo de cinco enlaces de referencia." }, 422);
    for (const item of body.references) {
      const value = clean(item, 500);
      try {
        const parsed = new URL(value);
        if (parsed.protocol !== "https:" || !parsed.hostname) throw new Error("invalid");
        references.push(parsed.toString());
      } catch {
        return json({ error: "Cada referencia debe ser un enlace HTTPS válido." }, 422);
      }
    }
  }
  if (!env.RATE_LIMIT_SALT || env.RATE_LIMIT_SALT.length < 32) {
    return json({ error: "El formulario no está disponible temporalmente. Escribinos por WhatsApp." }, 503);
  }
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const ipHash = await sha256(ip + "|" + env.RATE_LIMIT_SALT);
  const recent = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM rate_limits WHERE ip_hash=? AND julianday(created_at)>julianday('now','-1 hour')"
  ).bind(ipHash).first();
  if ((recent?.n || 0) >= 5) return json({ error: "Alcanzaste el límite temporal. Escribinos por WhatsApp para continuar." }, 429);
  const now = new Date().toISOString();
  const id = "ECO-" + now.slice(0, 10).replaceAll("-", "") + "-" + crypto.randomUUID().slice(0, 8).toUpperCase();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO requests (id,name,email,phone,request_type,service,preferred_date,preferred_time,details,references_json,budget,contact_method,consent_contact,consent_data,status,email_status,notion_status,customer_email_status,admin_email_status,created_at,ip_hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'Nuevo','pending','pending','pending','pending',?,?)")
      .bind(id, name, email, phone || null, requestType, requestType === "Servicio" ? service : null, date || null, time || null, details, JSON.stringify(references), budget, "email", 1, 1, now, ipHash),
    env.DB.prepare("INSERT INTO rate_limits (ip_hash,created_at) VALUES (?,?)").bind(ipHash, now),
    env.DB.prepare("INSERT INTO request_activity (request_id,event,details,created_at) VALUES (?,?,?,?)").bind(id, "created", "Formulario web", now),
    env.DB.prepare("DELETE FROM rate_limits WHERE julianday(created_at)<julianday('now','-2 days')")
  ]);
  ctx.waitUntil(processIntegrations(env, id));
  return json({
    ok: true,
    id,
    message: "Solicitud recibida. ECO Studios se pondrá en contacto contigo."
  }, 201);
}
export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      if (request.headers.get("Origin") !== WEB_ORIGIN) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") {
      return json({
        ok: true,
        service: "ECO Studios Intake API",
        region: "EU",
        integrations: {
          notion: !!env.NOTION_TOKEN,
          email: !!env.RESEND_API_KEY && !!env.EMAIL_FROM,
          files: !!env.FILES_BUCKET
        }
      });
    }
    if (url.pathname === "/api/requests" && request.method === "POST") return handleSubmission(request, env, ctx);
    return json({ error: "Not found" }, 404);
  },
  async scheduled(controller, env, ctx) {
    const hasNotion = !!env.NOTION_TOKEN;
    const hasEmail = !!env.RESEND_API_KEY && !!env.EMAIL_FROM;
    if (!hasNotion && !hasEmail) return;
    const rows = await env.DB.prepare(
      "SELECT * FROM requests WHERE ((notion_status IN ('pending','error','not_configured') AND notion_attempts < 8) OR (email_status IN ('pending','error','not_configured') AND email_attempts < 8)) ORDER BY created_at ASC LIMIT 20"
    ).all();
    for (const row of rows.results || []) {
      const jobs = [];
      if (hasNotion && ["pending", "error", "not_configured"].includes(row.notion_status) && row.notion_attempts < 8) jobs.push(syncNotion(env, row));
      if (hasEmail && ["pending", "error", "not_configured"].includes(row.email_status) && row.email_attempts < 8) jobs.push(sendEmails(env, row));
      await Promise.allSettled(jobs);
    }
  }
};
