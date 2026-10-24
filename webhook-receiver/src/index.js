/**
 * ECO Studios — Notion webhook receiver
 * Deploy as a Cloudflare Worker. Required secrets:
 *   NOTION_WEBHOOK_SECRET  Notion webhook signing secret
 *   GITHUB_DISPATCH_TOKEN  Fine-grained PAT with Contents: Read and write on eco-studios
 */
const encoder = new TextEncoder();

function toHex(bytes) {
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

async function verifyNotionSignature(rawBody, signature, secret) {
  if (!signature || !secret || !signature.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  return constantTimeEqual("sha256=" + toHex(digest), signature);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ service: "eco-studios-notion-receiver", status: "ok" });
    }
    if (url.pathname !== "/notion" || request.method !== "POST") {
      return json({ error: "not_found" }, 404);
    }

    const rawBody = await request.text();
    let event;
    try { event = JSON.parse(rawBody); }
    catch { return json({ error: "invalid_json" }, 400); }

    // Notion sends a verification token when registering the webhook endpoint.
    // A challenge must never trigger a GitHub dispatch.
    if (event && event.verification_token && !request.headers.get("X-Notion-Signature")) {
      return json({ received: true, verification: "challenge_received" });
    }

    const valid = await verifyNotionSignature(
      rawBody,
      request.headers.get("X-Notion-Signature"),
      env.NOTION_WEBHOOK_SECRET
    );
    if (!valid) return json({ error: "invalid_signature" }, 401);

    if (!env.GITHUB_DISPATCH_TOKEN) return json({ error: "receiver_not_configured" }, 503);

    const eventId = String(event.id || event.event_id || "");
    const eventType = String(event.type || event.event_type || "unknown");

    const response = await fetch(
      "https://api.github.com/repos/martingfilippi-dotcom/eco-studios/dispatches",
      {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + env.GITHUB_DISPATCH_TOKEN,
          "Accept": "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "ECO-Studios-Notion-Webhook"
        },
        body: JSON.stringify({
          event_type: "notion-content-changed",
          client_payload: {
            source: "notion",
            event_id: eventId.slice(0, 200),
            event_type: eventType.slice(0, 100),
            received_at: new Date().toISOString()
          }
        })
      }
    );

    if (!response.ok) {
      // Do not leak GitHub response details or tokens to the caller.
      return json({ error: "github_dispatch_failed", status: response.status }, 502);
    }
    return json({ accepted: true, event_id: eventId || null });
  }
};
