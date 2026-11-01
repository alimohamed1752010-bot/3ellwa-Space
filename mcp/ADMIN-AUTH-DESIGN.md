# Admin authorization bridge design

Status: design only. The current MCP Worker remains read-only until this design is implemented, reviewed, and tested.

## Goal

Allow the Site Manager plugin to perform narrowly scoped owner actions on 3ellwa.space without weakening the website's existing authentication.

## Required login flow

1. `admin_auth_start` accepts the owner password and forwards it only to the fixed same-origin endpoint `POST /api/auth/password`.
2. The website sends its existing one-time code to the configured Discord webhook and returns a short-lived challenge ID.
3. `admin_auth_complete` accepts the challenge ID and eight-digit code and forwards them only to `POST /api/auth/code`. It must never set `trustDevice`.
4. The website returns the existing HttpOnly session cookie. The MCP Worker extracts only the cookie name/value pair and stores it in a dedicated KV namespace with a maximum 12-hour TTL.
5. The tool returns a random, high-entropy opaque handle. It never returns the website cookie, password, or OTP.
6. Every authenticated admin tool requires the opaque handle. The Worker hashes it before using it as the KV key, retrieves the stored cookie, and calls only a hard-coded same-origin admin endpoint.
7. `admin_auth_logout` calls the website's fixed logout endpoint, then deletes the KV record.

## Security requirements

- Preserve password plus mandatory Discord OTP, one-use challenges, expiry, and the website's existing rate limits. Never add a password-only route, OTP bypass, or trusted-device shortcut.
- Use a dedicated KV namespace. Do not bind the MCP Worker to the production D1 database or R2 bucket.
- Never log passwords, OTPs, session cookies, opaque handles, or admin request bodies.
- Never return or expose the website session cookie to the model or caller.
- Do not implement a generic HTTP proxy. Every tool maps to a fixed method/path pair and validates every path parameter and request body.
- Keep DNS writes behind the website's existing preview token, fresh-state recheck, typed hostname confirmation, and audit log.
- Publishing must remain an explicit operation. Draft edits and publication must be separate tools.
- Use no more than the website session's remaining lifetime; KV expiry must never extend the website session.
- Reject missing, expired, malformed, or revoked handles. Logout revokes the bridge handle as well as the upstream session.
- Add tests for OTP-required behavior, invalid/expired codes, cookie extraction, KV expiry, handle hashing, endpoint allowlisting, input validation, logout, and ensuring secrets never appear in tool results or logs.

## Initial tool scope after implementation

Start with read-only authenticated diagnostics (admin ping, profile, and configuration summaries). Add narrowly scoped edits only after those tools pass security tests. Avoid exposing bulk delete, arbitrary imports, credential reads, or direct database operations through MCP.

## Deployment prerequisites

- Create a dedicated Cloudflare KV namespace for MCP session handles.
- Bind it only to the `3ellwa-space-mcp` Worker.
- Keep the existing site Worker secrets and production bindings unchanged.
- Deploy and verify the bridge independently before adding any write tools.
