# ECO Studios — Notion webhook receiver

This Cloudflare Worker receives Notion webhook events, validates the X-Notion-Signature header, and dispatches notion-content-changed to GitHub Actions. The existing sync workflow still applies the publication checks: only records with Estado = Publicado and Derechos de uso verificados = true are published.

## No paid plan required

Cloudflare Workers Free currently allows up to 100,000 requests per day. This receiver should use only a tiny fraction of that limit. See the [official limits](https://developers.cloudflare.com/workers/platform/limits/). GitHub Actions usage may depend on repository visibility and runner type; this repository is public and uses the standard GitHub-hosted runner.

## Required secrets

Set these in the Cloudflare Worker as **Secrets** (not plain-text variables):

- NOTION_WEBHOOK_SECRET: the exact verification_token Notion sends during webhook setup.
- GITHUB_DISPATCH_TOKEN: a fine-grained GitHub personal access token limited to this repository, with **Contents: Read and write** (write permission is required for repository dispatch).

Never commit either value to the repository or send either value in chat.

## Quick setup through the Cloudflare dashboard

1. In Cloudflare, open **Workers & Pages** and create a Worker (a workers.dev address is enough; no custom domain is needed).
2. Open **Edit code**, replace the sample code with the contents of src/index.js from this folder, and deploy.
3. In **Settings → Variables and Secrets**, add the two required values as encrypted secrets. The Notion secret is obtained in step 5 below; the GitHub token is created in step 4.
4. In GitHub, create a fine-grained personal access token scoped only to martingfilippi-dotcom/eco-studios, with **Contents: Read and write**. Store it in Cloudflare as GITHUB_DISPATCH_TOKEN. Do not paste it into Notion or this repository.
5. In your Notion integration/connection settings, open **Webhooks**, create a subscription pointing to https://YOUR-WORKER.workers.dev/notion, and select page/content update events. The first request contains a verification_token; open the Worker live logs and copy the TEMP_NOTION_VERIFICATION_TOKEN=... value. Paste the token into Notion's **Verify** modal, and save the same value in Cloudflare as the encrypted secret NOTION_WEBHOOK_SECRET.
6. **Security cleanup:** immediately remove the temporary console.log line that prints the verification token from the Worker code and redeploy. The subscription remains valid because the secret is already stored in Cloudflare. Keep the signature validation logic.
7. Check https://YOUR-WORKER.workers.dev/health; it should show "status":"ok". Then edit a harmless field on an approved test record and verify that GitHub Actions starts and the public site updates.

## Cloudflare live logs and the initial verification token

The token is printed only during the first, unsigned verification request, because Notion requires it to be copied manually into the subscription-verification form. Treat it as a secret. Do not share logs or screenshots containing it. Remove that temporary log line and redeploy immediately after verification.

## CLI alternative

From this directory, after authenticating Wrangler to the intended Cloudflare account:

~~~sh
npx wrangler secret put NOTION_WEBHOOK_SECRET
npx wrangler secret put GITHUB_DISPATCH_TOKEN
npx wrangler deploy
~~~

## Security and fallback

- Signed event requests with invalid/missing signatures are rejected.
- The initial verification request never triggers a GitHub dispatch.
- GitHub Actions remains the authority for publication approvals.
- The existing five-minute schedule remains as a fallback if a webhook event is missed.
- Notion may aggregate some page-content events and deliver them with a delay of roughly a minute or two; “webhook” does not guarantee every keystroke is published instantly.
