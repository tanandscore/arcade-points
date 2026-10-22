# Upgrade 46 - Fungies checkout as a normal link

- The pop-up (overlay) checkout was refused by the Fungies store ("tapandscore.app.fungies.io refused to connect"). Subscribe buttons are now plain links that open Fungies' own checkout page with ?user_id=...&plan_id=... added (prefilled custom fields).
- Webhook now works out the plan from the offer that was actually paid (matched to the saved checkout links) instead of trusting plan_id from the link; falls back to the link value.
- Not verified against a live payment yet: first real $2 test purchase must confirm the account unlocks.
