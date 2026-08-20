import "./globals.css";
import { GAMES } from "@/lib/games";

const description = `Play ${GAMES.length} free browser games — reflex, puzzle, word, and arcade — and climb real leaderboards. Sign up free, no downloads.`;

export const metadata = {
  metadataBase: new URL("https://tapandscore.com"),
  title: {
    default: "Tap & Score — Free Online Arcade Games & Leaderboards",
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
  ],
  openGraph: {
    title: "Tap & Score — Free Online Arcade Games & Leaderboards",
    description,
    url: "https://tapandscore.com",
    siteName: "Tap & Score",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Tap & Score — Free Online Arcade Games & Leaderboards",
    description,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="ap-scanlines">{children}</body>
    </html>
  );
}
