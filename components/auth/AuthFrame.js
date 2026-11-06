import MarqueeBar from "@/components/MarqueeBar";
import { CheckIcon } from "@/components/store/Icons";

// Upgrade 70: one frame for every sign-in page (log in, create account, forgot password, set a new password), so they look like
// the store: the slim top bar, a plain title, and one calm form card. On a wide screen the log-in and sign-up pages also show a
// short "what you get" panel with three games beside the form. The logic of each form stays in its own file; this is only the look.
//
//   rightSlot  buttons for the top bar        banner    a strip under the top bar (the beta-spots notice)
//   title/sub  heading and the line under it  footer    the line under the card ("New here? Create a free account")
//   showcase   false for the quiet pages (check your email, reset password)
const SHOWCASE = [
  ["kikoleap", "Kiko Leap", "Free"],
  ["fluffapult", "Fluffapult", "Free"],
  ["skylinesiege", "Skyline Siege", "Power Pass"],
];

function Showcase() {
  return (
    <div className="hidden lg:block">
      <p className="st-h1" style={{ fontSize: "clamp(2.2rem, 3.6vw, 3.1rem)" }}>Big games in your browser.</p>
      <p className="st-muted mt-4 max-w-md text-[17px] leading-relaxed">One free account keeps your levels, stars and scores, so you can carry on from any device.</p>
      <ul className="mt-6 space-y-2.5 text-[15.5px] text-[#dcd5ff]">
        {["Free games to start, no card needed", "Power Pass and Legend Pass for bigger adventures", "Leaderboards, achievements and daily challenges"].map((t) => (
          <li key={t} className="flex items-center gap-3"><span className="text-accentCyan"><CheckIcon /></span>{t}</li>
        ))}
      </ul>
      <div className="mt-9 grid max-w-xl grid-cols-3 gap-4" aria-hidden="true">
        {SHOWCASE.map(([slug, name, tier]) => (
          <div key={slug}>
            <div className="st-art">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/capsules/${slug}.jpg`} alt="" loading="lazy" />
            </div>
            <p className="st-card-title mt-2.5">{name}</p>
            <p className="st-card-sub">{tier}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AuthFrame({ rightSlot, banner = null, title, sub = null, children, footer = null, showcase = false }) {
  return (
    <div className="bg-bgDeep text-textLight">
      <MarqueeBar rightSlot={rightSlot} />
      {banner}
      <div className="flex items-start sm:items-center" style={{ minHeight: "calc(100vh - 57px)", background: "radial-gradient(ellipse at 50% 0%, #241154 0%, #12092b 62%)" }}>
        <div className={`st-container py-12 sm:py-16 ${showcase ? "lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center lg:gap-20" : ""}`}>
          {showcase && <Showcase />}
          <div className="mx-auto w-full max-w-[420px]">
            <h1 className="st-h1" style={{ fontSize: "clamp(1.8rem, 3.6vw, 2.3rem)" }}>{title}</h1>
            {sub && <p className="st-muted mt-2 text-[15px] leading-relaxed">{sub}</p>}
            <div className="st-panel mt-6 p-6 sm:p-7">{children}</div>
            {footer && <p className="st-muted mt-5 text-center text-[14.5px]">{footer}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
