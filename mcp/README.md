# 3ellwa.space MCP server

A separate Cloudflare Worker exposing a read-only MCP Streamable HTTP endpoint for the public 3ellwa.space site and allowlisted public project documentation.

## Endpoint

- MCP: `https://3ellwa-space-mcp.alimohamed1752010.workers.dev/mcp`
- Health: `https://3ellwa-space-mcp.alimohamed1752010.workers.dev/health`

## Tools

- `site_health`
- `site_public_overview`
- `site_public_links`
- `site_public_projects`
- `site_public_announcements`
- `site_public_page`
- `read_project_document` (strict allowlist)
- `site_check`

## Security boundary

This first release is intentionally read-only. It calls only published public APIs on 3ellwa.space and reads a fixed allowlist of documentation files from the public GitHub repository. It does not access /api/admin, D1 directly, R2 objects, secrets, authentication cookies, or arbitrary URLs/paths. No production website Worker, D1 binding, or R2 bucket is modified.

Authenticated admin operations are a separate milestone. They must use an explicit, narrowly scoped service authorization design and preserve the existing password + Discord OTP login; do not add an OTP bypass.

## Deploy

From the repository root:

```sh
npx wrangler deploy --config mcp/wrangler.jsonc
```

## Local development

```sh
npx wrangler dev --config mcp/wrangler.jsonc
```
