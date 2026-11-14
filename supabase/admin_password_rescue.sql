-- ============================================================
-- Admin password rescue. Run in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query).
-- 1. Put YOUR sign-up email and the NEW password in the two lines marked <<<.
-- 2. Click Run. Then log in at tapandscore.com/login with that email and password.
-- Safe to run more than once.
-- ============================================================
do $$
declare
  v_email text := 'rupamsarmah.duiet@gmail.com';  -- <<< your account email
  v_pass  text := 'ChangeMe-2026!';               -- <<< the new password you want (min 8 characters)
  v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(v_email);
  if v_id is null then raise exception 'No account found for %', v_email; end if;
  update auth.users
     set encrypted_password = crypt(v_pass, gen_salt('bf')),
         email_confirmed_at = coalesce(email_confirmed_at, now()),
         updated_at = now()
   where id = v_id;
  update public.profiles set is_admin = true where id = v_id;   -- make sure this account is an admin
  raise notice 'Done. Log in as % with the new password.', v_email;
end $$;
