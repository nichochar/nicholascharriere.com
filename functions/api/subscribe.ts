// POST /api/subscribe — stores newsletter signups in D1 (binding `DB`) and, when the
// `KIT_API_KEY` Pages secret is present, also adds them to Kit (API v4) via the double opt-in
// form, which sends the confirmation email. D1 is written first and is the backup: a Kit failure
// or a missing secret is logged but still returns `{ ok: true }`, because the signup is saved.
// Pages Functions convention: functions/api/subscribe.ts → /api/subscribe.
// Schema: migrations/0001_subscribers.sql. Client: src/components/SubscribeCta.astro.
//
// Request:  JSON `{ email, source_path?, website? }` or the same fields form-encoded.
// Response: JSON `{ ok: true }` or `{ ok: false, error }` with 400/403/405/413/415/429/500.
// There is deliberately no endpoint that lists or exports subscribers (see AGENTS.md).

export interface Env {
  DB: D1Database;
  /** Encrypted Pages secret. Optional so local dev without it still works. */
  KIT_API_KEY?: string;
}

/** Honeypot input name. Must match `honeypotField` in src/config/newsletter.ts. */
const HONEYPOT_FIELD = "website";
const MAX_BODY_BYTES = 8 * 1024;
const MAX_EMAIL_LEN = 254;
const MAX_PATH_LEN = 200;
const MAX_UA_LEN = 512;
const RATE_LIMIT = 8; // requests…
const RATE_WINDOW_SECONDS = 600; // …per 10-minute fixed window, per IP

const KIT_API_BASE = "https://api.kit.com/v4";
// Kit double opt-in form (not a secret); adding a subscriber to it sends the confirmation email.
const KIT_FORM_ID = 10240384;
const KIT_TIMEOUT_MS = 8000;

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]+$/;
const PATH_RE = /^\/[A-Za-z0-9\-._~/%]*$/;

const json = (body: Record<string, unknown>, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });

const fail = (error: string, status: number, headers?: Record<string, string>) =>
  json({ ok: false, error }, status, headers);

function clientIp(request: Request): string {
  const cf = request.headers.get("CF-Connecting-IP");
  if (cf) return cf.trim();
  const xff = request.headers.get("X-Forwarded-For");
  if (xff) return xff.split(",")[0].trim();
  return "unknown";
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Fixed-window counter in D1. Returns true if this request is over the limit. */
async function rateLimited(db: D1Database, ip: string): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / RATE_WINDOW_SECONDS);
  // Hash the IP so the rate-limit table never holds raw addresses.
  const key = await sha256Hex(ip);
  const [, upsert] = await db.batch<{ count: number }>([
    db.prepare("DELETE FROM rate_limits WHERE bucket < ?").bind(bucket - 1),
    db
      .prepare(
        `INSERT INTO rate_limits (ip_hash, bucket, count) VALUES (?, ?, 1)
         ON CONFLICT (ip_hash, bucket) DO UPDATE SET count = count + 1
         RETURNING count`,
      )
      .bind(key, bucket),
  ]);
  const count = upsert.results[0]?.count ?? 0;
  return count > RATE_LIMIT;
}

function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (email.length === 0 || email.length > MAX_EMAIL_LEN) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(email)) return null;
  const [local, domain] = email.split("@");
  if (!local || !domain || local.length > 64) return null;
  if (domain.startsWith(".") || domain.endsWith(".") || domain.includes("..")) return null;
  return EMAIL_RE.test(email) ? email : null;
}

/** Keep only a site-relative path ("/blog/foo"). URLs, protocol-relative paths, junk → null. */
function sanitizePath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const path = raw.trim().split(/[?#]/)[0];
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  if (path.length > MAX_PATH_LEN || !PATH_RE.test(path)) return null;
  return path;
}

async function readFields(request: Request): Promise<Record<string, unknown> | "too_large" | "bad_body" | "unsupported"> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return "too_large";

  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return "too_large";

  const type = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (type === "application/json") {
    try {
      const parsed: unknown = JSON.parse(text);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "bad_body";
      return parsed as Record<string, unknown>;
    } catch {
      return "bad_body";
    }
  }
  if (type === "application/x-www-form-urlencoded") {
    return Object.fromEntries(new URLSearchParams(text));
  }
  return "unsupported";
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // Same-origin only: browsers always send Origin on cross-site POSTs.
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return fail("forbidden", 403);

  if (!env.DB) return fail("not_configured", 500);

  try {
    if (await rateLimited(env.DB, clientIp(request))) {
      return fail("rate_limited", 429, { "retry-after": String(RATE_WINDOW_SECONDS) });
    }
  } catch (err) {
    console.error("subscribe: rate limit check failed", err);
    return fail("server_error", 500);
  }

  const fields = await readFields(request);
  if (fields === "too_large") return fail("too_large", 413);
  if (fields === "unsupported") return fail("unsupported_media_type", 415);
  if (fields === "bad_body") return fail("bad_request", 400);

  // Honeypot: humans never see this field. Anything in it means a bot; don't insert.
  const trap = fields[HONEYPOT_FIELD];
  if (trap !== undefined && trap !== null && String(trap).trim() !== "") return fail("rejected", 400);

  const email = normalizeEmail(fields.email);
  if (!email) return fail("invalid_email", 400);

  const sourcePath = sanitizePath(fields.source_path);
  const userAgent = (request.headers.get("User-Agent") ?? "").slice(0, MAX_UA_LEN) || null;
  const country = (request.headers.get("CF-IPCountry") ?? "").slice(0, 8) || null;

  try {
    // Duplicate email → ignored, and still `{ ok: true }` so we never reveal who is subscribed.
    await env.DB.prepare(
      `INSERT OR IGNORE INTO subscribers (email, source_path, user_agent, country) VALUES (?, ?, ?, ?)`,
    )
      .bind(email, sourcePath, userAgent, country)
      .run();
  } catch (err) {
    console.error("subscribe: insert failed", err);
    return fail("server_error", 500);
  }

  await forwardToKit(env, request, email, sourcePath);
  return json({ ok: true });
};

/** POST JSON to a Kit v4 endpoint. Returns true on 2xx. Never throws; logs failures without the email or key. */
async function kitPost(apiKey: string, path: string, payload: Record<string, unknown>, step: string): Promise<boolean> {
  let res: Response;
  try {
    res = await fetch(`${KIT_API_BASE}${path}`, {
      method: "POST",
      headers: {
        "X-Kit-Api-Key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(KIT_TIMEOUT_MS),
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "unknown";
    console.error(`subscribe: kit ${step} request failed (${name})`);
    return false;
  }

  if (res.ok) return true;

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Non-JSON error body; fall through with null.
  }
  // Kit errors look like `{ "errors": ["..."] }`.
  const errors = body && typeof body === "object" ? (body as { errors?: unknown }).errors : undefined;
  const first = Array.isArray(errors) ? errors.find((e): e is string => typeof e === "string") : undefined;
  // Messages can echo the address back; strip anything email-shaped and cap the length.
  const short = (first ?? "").replace(/[^\s@]+@[^\s@]+/g, "[email]").slice(0, 120);
  console.error(`subscribe: kit ${step} error status=${res.status} ${short}`.trim());
  return false;
}

/**
 * Add the signup to Kit. Never throws and never affects the response:
 * D1 already holds the signup, so failures are only logged (status + short message, no email, no key).
 *
 * 1. Upsert the subscriber as `inactive` (unconfirmed). Existing subscribers keep their state,
 *    so a confirmed reader stays confirmed.
 * 2. Add them to the double opt-in form, which is what sends the confirmation email.
 *    Skipped if step 1 failed.
 */
async function forwardToKit(env: Env, request: Request, email: string, sourcePath: string | null): Promise<void> {
  const apiKey = env.KIT_API_KEY?.trim();
  if (!apiKey) {
    console.error("subscribe: KIT_API_KEY not set; saved to D1 only");
    return;
  }

  const created = await kitPost(apiKey, "/subscribers", { email_address: email, state: "inactive" }, "subscriber");
  if (!created) return;

  const formPayload: Record<string, unknown> = { email_address: email };
  if (sourcePath) formPayload.referrer = `${new URL(request.url).origin}${sourcePath}`;
  await kitPost(apiKey, `/forms/${KIT_FORM_ID}/subscribers`, formPayload, "form");
}

// Anything other than POST (onRequestPost takes precedence for POST).
export const onRequest: PagesFunction<Env> = async () => fail("method_not_allowed", 405, { allow: "POST" });
