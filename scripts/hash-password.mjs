// Usage: node scripts/hash-password.mjs "your long passphrase"
// Output goes into the ADMIN_PASSWORD_HASH secret. Format: pbkdf2$iterations$saltB64$hashB64
// 100000 iterations is the maximum Cloudflare Workers WebCrypto allows, so a long passphrase matters.
import { pbkdf2Sync, randomBytes } from "node:crypto";
const pw = process.argv[2];
if (!pw || pw.length < 12) { console.error('Give a passphrase of at least 12 characters: node scripts/hash-password.mjs "..."'); process.exit(1); }
const iterations = 100000, salt = randomBytes(32);
const hash = pbkdf2Sync(pw, salt, iterations, 32, "sha256");
console.log(`pbkdf2$${iterations}$${salt.toString("base64")}$${hash.toString("base64")}`);
