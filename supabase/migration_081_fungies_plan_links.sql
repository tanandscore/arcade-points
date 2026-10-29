-- Migration 081 (checklist step 13): tells the website which Fungies checkout link belongs to which plan.
-- Paste ALL of this into Supabase > SQL Editor and click Run. It is safe to run again.
-- Prices are shown on the site exactly as typed below.

update public.subscription_plans set
  fungies_checkout_url_monthly = 'https://tapandscore.app.fungies.io/subscribe/6e15245d-6227-4718-8e10-58636902ce4f',
  fungies_checkout_url_annual  = 'https://tapandscore.app.fungies.io/subscribe/eb8035b1-5495-4814-8f14-efd9951f9e5b',
  fungies_price_display_monthly = '$2',
  fungies_price_display_annual  = '$10'
where id = 'premium';

update public.subscription_plans set
  fungies_checkout_url_monthly = 'https://tapandscore.app.fungies.io/subscribe/dcc37b34-26ee-4953-b5c6-7a27d24f6525',
  fungies_checkout_url_annual  = 'https://tapandscore.app.fungies.io/subscribe/9ae03524-1299-4351-a3ae-eee7e9066c97',
  fungies_price_display_monthly = '$5',
  fungies_price_display_annual  = '$50'
where id = 'premium_plus';

-- Check: this should list 2 rows, each with both links and both prices filled in.
select id, fungies_checkout_url_monthly, fungies_checkout_url_annual, fungies_price_display_monthly, fungies_price_display_annual
from public.subscription_plans where id in ('premium','premium_plus');
