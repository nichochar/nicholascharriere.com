// Newsletter provider config for the subscribe card (src/components/SubscribeCta.astro).
// To switch provider, set `action` (and `emailField` if the provider needs a different name).
export const newsletter = {
  // Form action URL. Empty string means no provider is configured yet:
  // the card then shows copy + RSS only, with no form.
  // Buttondown example: "https://buttondown.com/api/emails/embed-subscribe/USERNAME"
  // Kit example: "https://app.kit.com/forms/FORM_ID/subscriptions"
  action: "",
  // Input name. Buttondown uses "email"; Kit often uses "email_address".
  emailField: "email",
};
