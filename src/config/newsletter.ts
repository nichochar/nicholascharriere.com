// Config for the subscribe card (src/components/SubscribeCta.astro).
//
// By default the card POSTs JSON to the same-origin Cloudflare Pages Function at
// functions/api/subscribe.ts, which stores addresses in D1 (binding `DB`).
// If a provider (Buttondown / Kit) is adopted later, it would be swapped in here,
// but note the client and function contract (JSON body, `{ ok: true }` response)
// would need to change with it.
export const newsletter = {
  // Same-origin endpoint the form submits to.
  endpoint: "/api/subscribe",
  // Honeypot input name. Must match HONEYPOT_FIELD in functions/api/subscribe.ts.
  // It is intentionally hidden from humans; do not remove it.
  honeypotField: "website",
};
