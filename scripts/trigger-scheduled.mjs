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

// Normalize: ensure an https:// scheme so we never hit an http->https redirect
// (a redirect downgrades POST to GET, which returns 405 from a POST-only route).
let base = appUrl.replace(/\/$/, "");
if (!/^https?:\/\//i.test(base)) base = `https://${base}`;
base = base.replace(/^http:\/\//i, "https://");

const endpoint = `${base}/api/cron/publish-scheduled`;

try {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "x-cron-secret": secret },
    // Surface redirects loudly instead of silently following them as a GET.
    redirect: "manual",
  });

  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get("location");
    console.error(
      `Cron trigger got a redirect (${res.status}) to ${location}. ` +
        `Set APP_URL to the exact https URL to avoid this. Endpoint tried: ${endpoint}`,
    );
    process.exit(1);
  }

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
