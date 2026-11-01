# 3ellwa.space MCP server

A separate Cloudflare Worker exposing public read-only site tools and owner-paired read-only admin diagnostics.

## Endpoints

- MCP: `https://3ellwa-space-mcp.alimohamed1752010.workers.dev/mcp`
- Health: `https://3ellwa-space-mcp.alimohamed1752010.workers.dev/health`

## Public tools

- `site_health`
- `site_public_overview`
- `site_public_links`
- `site_public_projects`
- `site_public_announcements`
- `site_public_page`
- `read_project_document`
- `site_check`

## Paired admin tools

- `mcp_pair`: exchange a one-time code generated in the authenticated website admin panel.
- `mcp_admin_status`: read a compact admin overview.
- `mcp_logout`: revoke the paired session.

The plugin never receives the website password, Discord OTP, or raw session cookie. Pairing codes are one-use and expire after two minutes. The MCP Worker stores only the HttpOnly website session cookie in a dedicated KV namespace and returns an opaque random handle. The KV entry expires no later than the site's normal 12-hour session.

There are no content editing, deletion, DNS mutation, or publishing tools in this release.

## Security boundary

The pairing code is generated only after the normal password + Discord OTP login. The exchange creates a separate normal website session; it does not bypass or alter the existing login. The MCP Worker has no direct D1, R2, secrets, or website Worker bindings. Authenticated requests are sent only to fixed same-origin admin endpoints. No generic proxy or arbitrary URL tool exists.

## Tests

Run from the repository root:

```sh
node --test mcp/worker.test.mjs
```

## Deploy

```sh
npx wrangler deploy --config mcp/wrangler.jsonc
```
