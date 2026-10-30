import type { Env } from "../env";

/** Post a plain message to the private auth webhook. Returns true if Discord accepted it. */
export async function sendDiscord(env: Env, content: string): Promise<boolean> {
  if (!env.DISCORD_AUTH_WEBHOOK_URL) return false;
  try {
    const res = await fetch(env.DISCORD_AUTH_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "3ellwa.space", content, allowed_mentions: { parse: [] } }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
