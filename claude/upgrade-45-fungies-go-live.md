# Upgrade 45 - Fungies go-live setup

- Fungies has no Test Mode switch: its sandbox is a separate environment (app.stage.fungies.net) with its own account, products, keys and webhook, and checkout needs Fungies approval. Chosen plan: test with one small real purchase ($2 Power Pass monthly), then cancel/refund.
- Products created: Power Pass ($2/mo, $10/yr), Legend Pass ($5/mo, $50/yr), both with custom fields user_id and plan_id. Webhook -> https://tapandscore.com/api/fungies/webhook (payment_success, subscription_updated, subscription_cancelled).
- supabase/migration_081_fungies_plan_links.sql stores the 4 checkout links and price text. Run it once in Supabase.
- NEXT_PUBLIC_FUNGIES_STORE_URL is public and now committed in wrangler.toml and .env.production.
- Secrets (FUNGIES_PUBLIC_KEY, FUNGIES_SECRET_KEY, FUNGIES_WEBHOOK_SECRET) must stay only in Cloudflare Variables and Secrets (type Secret), never in GitHub.
