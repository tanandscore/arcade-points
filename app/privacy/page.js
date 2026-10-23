import Link from "next/link";
import MarqueeBar from "@/components/MarqueeBar";
import CookieSettingsLink from "@/components/CookieSettingsLink";
import { MIN_AGE, POLICY_DATE_TEXT, CONTACT_EMAIL, OPERATOR_NAME } from "@/lib/compliance";

export const metadata = {
  title: "Privacy Policy",
  alternates: { canonical: "/privacy" },
  description: "How Tap & Score collects, uses, shares and protects personal data, and the rights you have under GDPR, UK GDPR, CCPA/CPRA, India's DPDP Act, LGPD and other privacy laws.",
};

const A = "text-accentCyan underline";
const H = (c) => `font-pixel text-[11px] ${c} mb-3`;

function Table({ head, rows }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-lineColor">
      <table className="w-full text-left text-[12px]">
        <thead className="bg-bgPanel3 text-textLight">
          <tr>{head.map((h) => <th key={h} className="px-3 py-2 font-mono font-bold">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-lineColor align-top">
              {r.map((c, j) => <td key={j} className="px-3 py-2">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-bgDeep text-textLight">
      <MarqueeBar
        rightSlot={
          <Link href="/" className="font-mono text-[10px] px-3 py-1.5 rounded-md border border-lineColor text-textLight">
            ← Home
          </Link>
        }
      />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="font-pixel text-lg text-textLight mb-2">PRIVACY POLICY</h1>
        <p className="text-textDim text-sm mb-4">Last updated: {POLICY_DATE_TEXT}</p>
        <p className="text-textLight/90 text-sm leading-relaxed mb-8">
          This page explains, in plain words, what personal information Tap &amp; Score collects, why, who sees it, how long we keep it, and what you can do about it — wherever in the world you live.
          The short version: we collect only what we need to run your account and games, we <strong>never sell or share your data for advertising</strong>, and you can download or delete your data yourself any time from{" "}
          <Link href="/account" className={A}>Account Settings</Link>.
        </p>
        <nav aria-label="On this page" className="flex flex-wrap gap-2 mb-10 font-mono text-[11px]">
          {[["collect", "What we collect"], ["why", "Why we use it"], ["share", "Who we share it with"], ["cookies", "Cookies"], ["retention", "How long we keep it"], ["rights", "Your rights"], ["california", "California & US states"], ["children", "Children"], ["contact", "Contact & complaints"]].map(([id, label]) => (
            <a key={id} href={`#${id}`} className="px-3 py-1.5 rounded-full border border-lineColor text-textLight/90 hover:bg-bgPanel3">{label}</a>
          ))}
        </nav>

        <div className="space-y-10 text-sm text-textDim leading-relaxed">
          <section id="who">
            <h2 className={H("text-accentCyan")}>WHO WE ARE</h2>
            <p>Tap &amp; Score (tapandscore.com) is operated by <span className="text-textLight">{OPERATOR_NAME}</span>, based in India. We are the “controller” of your personal data (the party that decides how and why it is used; “data fiduciary” under India’s DPDP Act). Contact: <a href={`mailto:${CONTACT_EMAIL}`} className={A}>{CONTACT_EMAIL}</a>.</p>
          </section>

          <section id="collect">
            <h2 className={H("text-accentAmber")}>WHAT WE COLLECT</h2>
            <Table
              head={["What", "Details", "Where it comes from"]}
              rows={[
                ["Account", "Email address, username, country, password (stored only in scrambled/hashed form by our login provider), the date you agreed to the Terms and your age confirmation.", "You, at sign-up"],
                ["Profile choices", "Avatar, theme, badge, whether your activity is visible, email-reminder preference.", "You"],
                ["Gameplay", "Scores, leaderboard rank, points and XP, achievements, streaks, daily challenges, tournament entries, game progress and saved settings, multiplayer match results.", "Generated as you play"],
                ["Purchases", "Which plan or game you bought, status, dates, amounts and payment-reference numbers. We never see or store your card, UPI or bank details — our payment provider Fungies handles those.", "You and Fungies"],
                ["Messages", "What you write in feedback or support emails.", "You"],
                ["Referrals", "Your referral code and who referred you.", "You"],
                ["Technical", "Browser type and the page involved when an error happens (kept in error logs); your network (IP) address is seen briefly by our host to deliver the site and block abuse. For the beta program only, a one-way scrambled fingerprint of your network address (it cannot be turned back into the address) to stop duplicate sign-ups.", "Your browser"],
                ["Optional analytics", "Anonymous page-speed and page-visit statistics, only if you press “Allow analytics”.", "Your browser, with your consent"],
              ]}
            />
            <p className="mt-4">We do <strong className="text-textLight">not</strong> collect precise location, contacts, photos, microphone or camera data, government IDs, or health information. Please do not put sensitive information in feedback messages or usernames.</p>
            <p className="mt-3"><strong className="text-textLight">What other players can see:</strong> your username, country, avatar, scores, rank and (unless you turn it off) recent activity appear on leaderboards, the Hall of Fame and the activity feed. Your email address is never shown.</p>
          </section>

          <section id="why">
            <h2 className={H("text-accentCyan")}>WHY WE USE IT (LEGAL BASES)</h2>
            <Table
              head={["Purpose", "Legal basis (GDPR / UK GDPR)"]}
              rows={[
                ["Create and run your account, save progress, show leaderboards, unlock what you paid for, support you", "Contract — needed to give you the service"],
                ["Take payments, keep tax and accounting records, respond to legal requests", "Legal obligation; contract"],
                ["Keep the site secure, stop cheating and fraud (including automatic anti-cheat checks), fix errors, prevent duplicate beta sign-ups", "Legitimate interests (keeping a fair and safe game)"],
                ["Streak reminder emails (you can switch them off any time in Account Settings)", "Legitimate interests / your consent where the law requires it"],
                ["Anonymous analytics and speed measurements", "Your consent (you can withdraw it any time via Cookie settings)"],
              ]}
            />
            <p className="mt-4">We do not use your data for advertising, profiling for ads, or to make decisions that legally affect you. The only automated decision is anti-cheat: a score that looks impossible can be removed or an account suspended; you can write to us for a human review.</p>
          </section>

          <section id="share">
            <h2 className={H("text-accentAmber")}>WHO WE SHARE IT WITH</h2>
            <p className="mb-3">We do not sell your personal data and do not “share” it for cross-context behavioural advertising. We use a small number of service providers (“processors”) who handle data only on our instructions:</p>
            <Table
              head={["Provider", "What for", "Data involved"]}
              rows={[
                ["Supabase", "Database and login", "Account, profile, gameplay, purchase records"],
                ["Fungies", "Payments and subscriptions — Fungies is our Merchant of Record and runs the checkout, handles payment data and may keep its own records as an independent controller", "Payment details go to them directly; they tell us plan status and payment references"],
                ["Cloudflare", "Hosting, security and, only with your consent, cookie-free web analytics", "Network address, request details, optional analytics"],
                ["Email delivery service", "Sign-up confirmation, password reset and reminder emails", "Your email address and the message"],
              ]}
            />
            <p className="mt-4">We may also disclose data if the law requires it, to protect people’s safety or our rights, or as part of a sale or reorganisation of the business (you would be told first).</p>
            <p className="mt-3"><strong className="text-textLight">International transfers.</strong> We are in India and our providers run servers in several countries, including the United States and the European Union. Where data leaves your country we rely on the safeguards the law allows, such as the European Commission’s Standard Contractual Clauses, the UK addendum, and contracts with our providers.</p>
          </section>

          <section id="cookies">
            <h2 className={H("text-accentCyan")}>COOKIES AND SIMILAR STORAGE</h2>
            <Table
              head={["Name", "Type", "Purpose", "Lifetime"]}
              rows={[
                ["sb-… (login cookies)", "Essential", "Keep you signed in", "Session to about 1 year"],
                ["ts-consent-v1 (browser storage)", "Essential", "Remembers your cookie choice", "Until you clear it"],
                ["Game settings & progress (browser storage)", "Functional", "Sound, graphics quality, saved game progress, last-played", "Until you clear it"],
                ["Offline cache (service worker)", "Functional", "Lets the site load faster and work offline", "Until updated"],
                ["Cloudflare Web Analytics", "Optional — only if you allow it", "Anonymous visit and speed statistics; sets no cookies", "None stored on your device"],
              ]}
            />
            <p className="mt-4">We use no advertising or cross-site tracking cookies. Optional analytics stay off until you choose “Allow analytics”. If your browser sends a “Global Privacy Control” or “Do Not Track” signal, we treat it as a “No”. Change your mind any time: <CookieSettingsLink className={A} />.</p>
          </section>

          <section id="retention">
            <h2 className={H("text-accentAmber")}>HOW LONG WE KEEP IT</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong className="text-textLight">Account and gameplay data:</strong> until you delete your account. Deleting removes your profile, scores, progress, purchases records held by us and messages straight away; copies in routine backups expire within the backup provider’s cycle.</li>
              <li><strong className="text-textLight">Payment records:</strong> our payment provider keeps transaction records for as long as tax and accounting laws require, even after account deletion.</li>
              <li><strong className="text-textLight">Error logs and speed measurements:</strong> deleted automatically after 90 days; they are not linked to your account.</li>
              <li><strong className="text-textLight">Beta duplicate-check fingerprint:</strong> removed when your account is deleted.</li>
              <li><strong className="text-textLight">Emails you send us:</strong> kept while needed to help you and for a reasonable period after.</li>
            </ul>
          </section>

          <section id="rights">
            <h2 className={H("text-accentCyan")}>YOUR RIGHTS — ANYWHERE IN THE WORLD</h2>
            <p className="mb-3">Whatever the law of your country says, we give every user these rights:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong className="text-textLight">See and download</strong> your data — press “Download my data” in <Link href="/account" className={A}>Account Settings</Link> (a machine-readable file you can take elsewhere).</li>
              <li><strong className="text-textLight">Correct</strong> it — edit your username and country in Account Settings, or email us for anything else.</li>
              <li><strong className="text-textLight">Delete</strong> it — “Delete account” in Account Settings removes your data right away.</li>
              <li><strong className="text-textLight">Object, restrict, or withdraw consent</strong> — switch analytics off in <CookieSettingsLink className={A} />, switch reminder emails off in Account Settings, or email us.</li>
              <li><strong className="text-textLight">Human review</strong> of an anti-cheat decision.</li>
              <li><strong className="text-textLight">No retaliation</strong> — we will not treat you worse for using these rights.</li>
            </ul>
            <p className="mt-4"><strong className="text-textLight">If you live in the EU/EEA, UK or Switzerland</strong> (GDPR, UK GDPR, Swiss FADP) you also have the rights of access, rectification, erasure, restriction, portability and objection, the right to withdraw consent at any time, and the right to complain to your local data-protection authority (for example the ICO in the UK, or the authority in your EU country).</p>
            <p className="mt-3"><strong className="text-textLight">If you live in India</strong> (Digital Personal Data Protection Act, 2023) you may ask for a summary of your data and who it is shared with, correction and erasure, withdraw consent, nominate a person to exercise your rights for you if you cannot, and use our grievance channel below. If we do not resolve your complaint you may approach the Data Protection Board of India.</p>
            <p className="mt-3"><strong className="text-textLight">If you live in Brazil</strong> (LGPD), Canada (PIPEDA, Quebec Law 25), Australia (Privacy Act), Singapore (PDPA), South Africa (POPIA), Japan (APPI), South Korea (PIPA), Turkey (KVKK), the UAE, Saudi Arabia, New Zealand or elsewhere, your local law gives you similar rights of access, correction, deletion and complaint; they are covered by the list above, and you may also complain to your national privacy regulator.</p>
            <p className="mt-3"><strong className="text-textLight">How to use a right:</strong> use the tools in Account Settings (instant), or email <a href={`mailto:${CONTACT_EMAIL}`} className={A}>{CONTACT_EMAIL}</a> from your account email. We may need to confirm it’s you. We answer within 30 days, sooner where the law demands. You may ask someone to act for you; we will ask for proof of their authority.</p>
          </section>

          <section id="california">
            <h2 className={H("text-accentAmber")}>CALIFORNIA AND OTHER US STATES (CCPA/CPRA)</h2>
            <p>In the last 12 months we collected these categories of personal information: identifiers (email, username, network address), commercial information (purchases and subscriptions), internet or app activity (gameplay and, with consent, analytics), geographic information limited to the country you choose, and your account log-in credentials (treated as sensitive personal information; used only to run your account). We collect them for the purposes in “Why we use it”, and disclose them only to the providers listed above for business purposes.</p>
            <p className="mt-3"><strong className="text-textLight">We do not sell or share your personal information</strong> (as those words are defined in California law), we have not done so in the past 12 months, and we have no actual knowledge of selling or sharing data of anyone under 16. We do not use sensitive personal information to infer characteristics about you.</p>
            <p className="mt-3">California residents, and residents of Virginia, Colorado, Connecticut, Texas, Oregon and other states with privacy laws, may ask to know, access, correct, delete and port their information, opt out of sale/sharing/targeted advertising (nothing to opt out of, but we honour Global Privacy Control signals), and appeal a decision (reply to our answer and write “Appeal”). Use <Link href="/account" className={A}>Account Settings</Link> or email <a href={`mailto:${CONTACT_EMAIL}`} className={A}>{CONTACT_EMAIL}</a>.</p>
          </section>

          <section id="children">
            <h2 className={H("text-accentCyan")}>CHILDREN</h2>
            <p>Tap &amp; Score is for people aged <strong className="text-textLight">{MIN_AGE} or older</strong>. You confirm this when you create an account. We do not knowingly collect personal data from anyone younger. If you believe a child has an account, email us and we will delete it. Parents and guardians can write to us at any time.</p>
          </section>

          <section id="security">
            <h2 className={H("text-accentAmber")}>SECURITY AND BREACHES</h2>
            <p>Connections use HTTPS; passwords are stored only in hashed form; access to the database is limited by per-user security rules and a small number of admin accounts; payment details never touch our servers. No system is perfectly secure. If a breach affects your data we will tell you and the authorities as the law requires (for example within 72 hours to EU regulators where applicable).</p>
          </section>

          <section id="changes">
            <h2 className={H("text-accentCyan")}>CHANGES TO THIS POLICY</h2>
            <p>If we change this policy in an important way we will update the date above and tell signed-in users (for example with a banner). Older versions are available on request.</p>
          </section>

          <section id="contact">
            <h2 className={H("text-accentAmber")}>CONTACT, GRIEVANCES AND COMPLAINTS</h2>
            <p>Privacy questions, rights requests and the <strong className="text-textLight">Grievance Officer</strong> contact (India’s DPDP Act and IT Rules): <span className="text-textLight">{OPERATOR_NAME}</span>, <a href={`mailto:${CONTACT_EMAIL}`} className={A}>{CONTACT_EMAIL}</a>, phone <a href="tel:+917399372232" className={A}>+91 73993 72232</a>. We acknowledge complaints promptly and aim to resolve them within 30 days. You can also reach us through the <Link href="/contact" className={A}>Contact page</Link>. You always have the right to complain to your own data-protection authority.</p>
            <p className="mt-3">See also our <Link href="/terms" className={A}>Terms of Service</Link> and <Link href="/refund-policy" className={A}>Refund Policy</Link>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
