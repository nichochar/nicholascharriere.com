// Config for the subscribe card (src/components/SubscribeCta.astro).
//
// The card POSTs JSON to the same-origin Cloudflare Pages Function at
// functions/api/subscribe.ts. The function writes each signup to D1 (binding `DB`,
// the backup) and then forwards it to Kit (API v4, double opt-in form), using the
// `KIT_API_KEY` Pages secret. The browser never talks to Kit directly,
// so the form contract (JSON body, `{ ok: true }` response) stays the same.
export const newsletter = {
  // Same-origin endpoint the form submits to.
  endpoint: "/api/subscribe",
  // Honeypot input name. Must match HONEYPOT_FIELD in functions/api/subscribe.ts.
  // It is intentionally hidden from humans; do not remove it.
  honeypotField: "website",
};
