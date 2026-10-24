# ECO Studios — Notion webhook receiver

This Cloudflare Worker receives Notion webhook events, validates the X-Notion-Signature header, and dispatches notion-content-changed to GitHub Actions. The sync workflow remains responsible for publication checks: only records marked Estado = Publicado and Derechos de uso verificados = true can be published.

## Cost

Cloudflare Workers Free currently permits up to 100,000 requests per day; this receiver should use a tiny fraction of that limit. See the [official Cloudflare limits](https://developers.cloudflare.com/workers/platform/limits/). The repository is public and uses standard GitHub-hosted runners for Actions.

## Required secrets

Configure these in Cloudflare as encrypted Worker **Secrets**, never as plain-text variables:

- NOTION_WEBHOOK_SECRET: the exact verification_token received from Notion during setup.
- GITHUB_DISPATCH_TOKEN: a fine-grained GitHub personal access token scoped only to martingfilippi-dotcom/eco-studios, with Contents: Read and write.

Never commit either value to this repository or send it in chat.

## Dashboard setup

1. In Cloudflare, open Workers & Pages and create a Worker. The free workers.dev address is sufficient; no custom domain is needed.
2. Open Edit code and paste the source from this folder's src/index.js; then deploy.
3. In GitHub, create a fine-grained token scoped only to martingfilippi-dotcom/eco-studios with Contents: Read and write. Add it to the Worker as the encrypted secret GITHUB_DISPATCH_TOKEN.
4. Before subscribing to Notion, prepare the verification-token log temporarily in the Cloudflare editor: in the existing branch that detects event.verification_token and absence of X-Notion-Signature, add this line immediately before the return: console.log("TEMP_NOTION_VERIFICATION_TOKEN=" + event.verification_token); Deploy that temporary change.
5. In the same Notion integration/connection that can access the ECO Studios content data source (ideally the integration used by the existing NOTION_TOKEN), open Webhooks and create a subscription to https://YOUR-WORKER.workers.dev/notion. Subscribe to page.created, page.properties_updated, page.content_updated, page.deleted, page.undeleted, and data_source.content_updated so additions, field edits, content edits, and deletions trigger a sync. Open the Cloudflare Worker live logs and copy the TEMP_NOTION_VERIFICATION_TOKEN value. Treat this as a secret.
6. Set that exact value as the encrypted Cloudflare secret NOTION_WEBHOOK_SECRET, and paste the same value into Notion's Verify modal. Complete subscription verification.
7. **Immediately remove the temporary console.log line and redeploy.** Do not leave the verification token in logs longer than necessary, and do not share logs or screenshots containing it. Keep the signature-validation code unchanged.
8. Open https://YOUR-WORKER.workers.dev/health; the response should show status: ok. Then edit a harmless field on an approved test record and confirm GitHub Actions starts and the public site updates.

## CLI alternative

From this directory, after authenticating Wrangler to the correct Cloudflare account:

~~~sh
npx wrangler secret put NOTION_WEBHOOK_SECRET
npx wrangler secret put GITHUB_DISPATCH_TOKEN
npx wrangler deploy
~~~

## Security and fallback

- Signed requests with invalid or missing signatures are rejected.
- An unsigned verification request never triggers a GitHub dispatch.
- GitHub Actions remains the authority for publication approval.
- The existing five-minute schedule remains as a fallback if a webhook is missed.
- Notion can aggregate page-content changes and deliver them with a delay of around a minute or two; a webhook does not mean every keystroke appears immediately.
