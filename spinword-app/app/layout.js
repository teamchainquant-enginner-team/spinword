export const metadata = {
  title: "SPINWORD — Guess the word. Spin the reels. Hit the jackpot.",
  description: "Wordle x slot machine x crypto loot. A daily 5-letter mystery word with slot-reel reveals, loot packs, and by-row multipliers. Powered by $SPIN on Solana.",
  openGraph: {
    title: "SPINWORD",
    description: "Wordle got rugged — the casino took over.",
    type: "website",
  },
  themeColor: "#080511",
};

export const viewport = { width: "device-width", initialScale: 1, maximumScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#080511" }}>{children}</body>
    </html>
  );
}
