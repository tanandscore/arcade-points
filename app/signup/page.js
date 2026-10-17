// Same reasoning as app/login/page.js — built live per visitor, not
// baked in ahead of time, so it never needs settings to exist at build.
export const dynamic = "force-dynamic";

import SignupForm from "./SignupForm";

export default function SignupPage() {
  return <SignupForm />;
}
