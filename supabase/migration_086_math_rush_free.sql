-- Upgrade 57: there is no one-time payment plan any more. Math Rush (and any other game still marked 'onetime') becomes free for everyone.
update public.games
   set access_type = 'free', price_paise = null, price_display = null
 where access_type = 'onetime' or component_key = 'math';
