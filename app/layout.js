import "./globals.css";

export const metadata = {
  title: "Tap & Score",
  description: "Play quick games, earn points, climb the leaderboard.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="ap-scanlines">{children}</body>
    </html>
  );
}
