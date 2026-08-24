import "./globals.css";
import { getGames } from "@/lib/games";
import DeploymentGuard from "@/components/DeploymentGuard";

const FALLBACK_DESCRIPTION =
  "Play free browser games — reflex, puzzle, word, strategy, racing, and arcade — and climb real leaderboards. Sign up free, no downloads.";

export async function generateMetadata() {
  const games = await getGames();
  const description = games.length
    ? `Play ${games.length} browser games free — reflex, puzzle, word, strategy, racing, and arcade — and climb real leaderboards. Sign up free, no downloads.`
    : FALLBACK_DESCRIPTION;
  const title = "Tap & Score — Free Online Games & Leaderboards";

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
      "arcade games",
      "leaderboard games",
      "play games online free",
      "reflex games",
      "puzzle games",
      "racing games online",
      "strategy games online",
      "free online games india",
    ],
    alternates: { canonical: "/" },
    openGraph: {
      title,
      description,
      url: "https://tapandscore.com",
      siteName: "Tap & Score",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
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

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_JSON_LD) }}
        />
      </head>
      <body className="ap-scanlines bg-bgDeep text-textLight">
        {children}
        <DeploymentGuard />
      </body>
    </html>
  );
}
