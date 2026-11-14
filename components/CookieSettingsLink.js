"use client";
// Footer / account button that re-opens the privacy-choices banner.
export default function CookieSettingsLink({ className = "", children = "Cookie settings" }) {
  return <button type="button" className={className} onClick={() => window.dispatchEvent(new Event("ts-open-consent"))}>{children}</button>;
}
