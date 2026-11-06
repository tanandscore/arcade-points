import "./globals.css";
import { getGames, getComingSoon } from "@/lib/games";
import DeploymentGuard from "@/components/DeploymentGuard";
import SiteFooter from "@/components/SiteFooter";
import PerformanceBeacon from "@/components/PerformanceBeacon";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import CloudflareAnalytics from "@/components/CloudflareAnalytics";
import CommandPalette from "@/components/CommandPalette";
import ErrorReporter from "@/components/ErrorReporter";
import ConsentBanner from "@/components/ConsentBanner";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import { getActiveAnnouncement } from "@/lib/announcements";

const FALLBACK_DESCRIPTION =
  "Big games that run in your browser: free platformers and physics puzzles, deeper Power Pass action games, and four 3D flagships. No downloads, no ads.";

export async function generateMetadata() {
  const description = FALLBACK_DESCRIPTION;
  const title = "Tap & Score — Big Browser Games, Zero Ads";

  return {
    metadataBase: new URL("https://tapandscore.com"),
    title: {
      default: title,
      template: "%s · Tap & Score",
    },
    description,
    keywords: [
      "free online games",
      "browser games",
      "platformer games online",
      "physics puzzle games",
      "play games online free",
      "no download games",
      "3D browser games",
      "racing games online",
      "strategy games online",
      "leaderboard games",
      "free online games india",
    ],
    alternates: { canonical: "/" },
    openGraph: {
      title,
      description,
      url: "https://tapandscore.com",
      siteName: "Tap & Score",
      type: "website",
      // Real preview card for shared links — previously missing
      // entirely, so every link shared anywhere (Discord, WhatsApp,
      // iMessage, social media) showed as plain text with no visual.
      // Standard 1200x630 dimensions, built from the site's own logo
      // rather than a generic placeholder.
      images: [{ url: "/og-image-v3.png", width: 1200, height: 630, alt: "Tap & Score — big browser games, zero ads" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og-image-v3.png"],
    },
    robots: { index: true, follow: true },
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "Tap & Score",
    },
  };
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#12092b",
};

const WEBSITE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Tap & Score",
  url: "https://tapandscore.com",
  description: FALLBACK_DESCRIPTION,
  inLanguage: "en",
};

const ORG_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Tap & Score",
  url: "https://tapandscore.com",
  logo: "https://tapandscore.com/icon-512",
  email: "info@tapandscore.com",
};

// Runs before anything else on every page. Supabase's emailed reset link carries its sign-in token after a "#". If that link
// ever lands somewhere other than the reset page (for example the home page, when the address wasn't on Supabase's allowed
// list), this hands it on to /reset-password with the token intact. If instead Supabase is reporting that the link has
// expired or was already used, and this browser recently asked for a reset, the person is sent to ask for a fresh one.
const AUTH_LINK_RESCUE = `(function(){try{var h=location.hash;if(!h||h.length<2||location.pathname==="/reset-password"||location.pathname==="/forgot-password")return;var p=new URLSearchParams(h.slice(1));if(p.get("type")==="recovery"&&p.get("access_token")){location.replace("/reset-password"+h);return}if(p.get("error_code")||p.get("error")){var t=0;try{t=Number(localStorage.getItem("tas_reset_asked"))||0}catch(e){}if(t&&Date.now()-t<10800000){location.replace("/forgot-password?error=link")}}}catch(e){}})();`;

export default async function RootLayout({ children }) {
  const [announcement, allGames, soonGames] = await Promise.all([getActiveAnnouncement(), getGames(), getComingSoon()]);
  const paletteGames = [...allGames, ...soonGames].map((g) => ({ slug: g.slug, name: g.name, icon: g.icon, tagline: g.tagline, genre: g.genre, tier: g.tier, status: g.status }));
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: AUTH_LINK_RESCUE }} />
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_JSON_LD) }}
        />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSON_LD) }} />
      </head>
      <body className="text-textLight flex flex-col min-h-screen">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-bgPanel focus:text-textLight focus:px-4 focus:py-2 focus:rounded-lg">Skip to content</a>
        {announcement && <AnnouncementBanner a={announcement} />}
        <div id="main" className="flex-1">{children}</div>
        <CommandPalette games={paletteGames} />
        <SiteFooter />
        <DeploymentGuard />
        <PerformanceBeacon />
        <ServiceWorkerRegistration />
        <CloudflareAnalytics />
        <ErrorReporter />
        <ConsentBanner />
      </body>
    </html>
  );
}
