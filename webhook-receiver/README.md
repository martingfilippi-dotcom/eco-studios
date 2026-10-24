# ECO Studios — instant Notion webhook receiver

This Worker receives Notion webhook events, validates `X-Notion-Signature`, and dispatches the `notion-content-changed` event to the `martingfilippi-dotcom/eco-studios` GitHub repository. It does not publish content itself; the existing GitHub Actions workflow applies the approval and rights checks before publishing.

## Required secrets

Configure these as Cloudflare Worker secrets (never commit them to this repository):

- `NOTION_WEBHOOK_SECRET`: signing secret generated for the Notion webhook subscription.
- `GITHUB_DISPATCH_TOKEN`: fine-grained GitHub token limited to this repository with **Contents: Read and write** permission.

## Deploy

From this directory with Wrangler authenticated to the intended Cloudflare account:

```sh
npx wrangler secret put NOTION_WEBHOOK_SECRET
npx wrangler secret put GITHUB_DISPATCH_TOKEN
npx wrangler deploy
```

Set the Notion webhook URL to:

```
https://<your-worker-subdomain>.workers.dev/notion
```

Check deployment with `GET https://<your-worker-subdomain>.workers.dev/health`. The receiver returns JSON with `status: ok`.

## Notion setup and verification

1. In the Notion integration that has access to **📦 Contenido de ECO Studios**, register a webhook subscription for page/content changes and use the deployed `/notion` URL.
2. Save the signing secret in Cloudflare as `NOTION_WEBHOOK_SECRET`.
3. Confirm the subscription is active. Notion's verification challenge must be completed according to its setup flow.
4. Edit a harmless field on an already-published test record and confirm the receiver responds successfully, GitHub Actions starts, and the public JSON/site updates.

## Security and publication behavior

- Requests with invalid/missing signatures are rejected.
- The verification challenge never triggers publication.
- GitHub tokens and Notion secrets are not returned to callers or written to logs.
- GitHub Actions remains the authority for content publication: only items marked `Estado = Publicado` and `Derechos de uso verificados = true` are published.
- The five-minute schedule remains as a fallback if a webhook event is missed.
