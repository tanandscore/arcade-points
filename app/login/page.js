// This page is deliberately built at request time, never ahead of time.
// It has no "use client" itself — the actual form lives in LoginForm.js.
// Building this page live (rather than baking it in advance) means it
// always has real, current settings available, no matter how the host
// happens to be configured at build time.
export const dynamic = "force-dynamic";

import LoginForm from "./LoginForm";

export default function LoginPage() {
  return <LoginForm />;
}
