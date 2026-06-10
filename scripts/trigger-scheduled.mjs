/**
 * Cron trigger for scheduled LinkedIn posts.
 *
 * Runs as a SEPARATE Railway service on a cron schedule (e.g. every 5 min).
 * It makes one authenticated request to the web app's /api/cron/publish-
 * scheduled endpoint, logs the result, and exits. All the real work (querying
 * due posts, publishing) happens in the web service behind the endpoint — this
 * is just the trigger.
 *
 * Required env on the cron service:
 *   APP_URL      e.g. https://linkedin-poster-v2-production.up.railway.app
 *   CRON_SECRET  must match the web service's CRON_SECRET
 *
 * No project dependencies — runs with plain `node scripts/trigger-scheduled.mjs`
 * (Node 18+ has global fetch). Exits 0 on success, 1 on failure.
 */

const appUrl = process.env.APP_URL;
const secret = process.env.CRON_SECRET;

if (!appUrl || !secret) {
  console.error("Missing APP_URL or CRON_SECRET env var.");
  process.exit(1);
}

const endpoint = `${appUrl.replace(/\/$/, "")}/api/cron/publish-scheduled`;

try {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "x-cron-secret": secret },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Cron trigger failed (${res.status}): ${text}`);
    process.exit(1);
  }
  console.log(`Cron trigger ok: ${text}`);
  process.exit(0);
} catch (err) {
  console.error(`Cron trigger error: ${err?.message ?? err}`);
  process.exit(1);
}
