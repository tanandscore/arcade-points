# Upgrade 46 - Fungies checkout as a normal link

- The pop-up (overlay) checkout was refused by the Fungies store ("tapandscore.app.fungies.io refused to connect"). Subscribe buttons are now plain links that open Fungies' own checkout page with ?user_id=...&plan_id=... added (prefilled custom fields).
- Webhook now works out the plan from the offer that was actually paid (matched to the saved checkout links) instead of trusting plan_id from the link; falls back to the link value.
- Not verified against a live payment yet: first real $2 test purchase must confirm the account unlocks.

## Webhook hardening (same day)
- Real Fungies payload: custom fields arrive at data.items[0].customFields, subscription at data.subscription (id, status, currentIntervalEnd ms, cancelAtIntervalEnd). Webhook now falls back to the message when the lookup differs, and returns 500 with the database error text instead of silently succeeding.
- Cloudflare: Bot Fight Mode (free plan, cannot be skipped) and Managed rules were returning 403 to Fungies; Bot Fight Mode had to be switched off.
