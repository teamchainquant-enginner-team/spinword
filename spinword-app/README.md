# SPINWORD 🎰

**Guess the word. Spin the reels. Hit the jackpot.**
Wordle × slot machine × crypto loot — a daily 5-letter mystery word with slot-reel reveals, loot packs, streaks, leaderboards, and a by-row multiplier payout loop. Powered by **$SPIN** on **Solana**, with real **Phantom** wallet connect.

> **Read before you ship:** real-money staking is intentionally **disabled**. Entries and payouts run on an off-chain **$SPIN points** ledger. See [`COMPLIANCE.md`](./COMPLIANCE.md) before enabling on-chain wagers — doing so without a license is illegal in most jurisdictions.

---

## What's in the box

- **Full game** — daily word, 6 guesses, slot-reel letter reveal, casino win/lose modals, coin FX.
- **Degen Entry loop** — stake $SPIN points, win by row solved: `R1 10× · R2 7× · R3 5.5× · R4 3.5× · R5 1.5× · R6 0.7×`. (Row 6 pays a *loss* by design — the UI flags it.)
- **Loot packs** — weighted drop tables, pack-opening animation, inventory (hints, extra guesses, multipliers, shields, wildcards, jackpot tickets).
- **Predict** — stake points on future daily words up to 7 days out (points-only).
- **Leaderboard** — daily / weekly / streaks / biggest wins.
- **Profile** — real Phantom connect, live SOL + $SPIN balance, streaks, badges, referral link.
- **Persistence** — the points ledger is saved to `localStorage` for MVP. Swap for Supabase (schema in `spinword-spec.md`) for real multi-device play and server-authoritative scoring.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in your RPC + $SPIN mint (optional)
npm run dev                  # http://localhost:3000
```

Phantom connect works on `localhost` and any deployed https origin (the browser extension injects `window.solana`).

## Environment variables

| Var | What it does |
|---|---|
| `NEXT_PUBLIC_SOLANA_RPC` | Solana RPC endpoint. Use a paid one (Helius/QuickNode) in prod — the public endpoint rate-limits hard. |
| `NEXT_PUBLIC_SPIN_MINT` | Your $SPIN SPL mint address. Set it to show real on-chain $SPIN balances; leave blank to skip. |
| `NEXT_PUBLIC_REAL_MONEY_ENABLED` | Ships `false`. Gate for on-chain staking. **Do not flip without reading `COMPLIANCE.md`.** |

## Push to GitHub

```bash
git init
git add .
git commit -m "SPINWORD MVP"
git branch -M main
git remote add origin https://github.com/<you>/spinword.git
git push -u origin main
```

## Deploy on Vercel

1. Go to **vercel.com → Add New → Project** and import the repo.
2. Framework preset auto-detects **Next.js**. Build command `next build`, output is handled automatically — no changes needed.
3. Add the env vars from `.env.example` under **Project → Settings → Environment Variables**.
4. **Deploy.** Every push to `main` redeploys.

## Where to go next

- Move guess-scoring, pack rolls, and prediction resolution **server-side** (Next route handlers or Supabase edge functions). The client must never hold the answer or the RNG — see `spinword-spec.md §6`.
- Wire Supabase auth + the 13-table schema for real accounts, leaderboards, and anti-abuse.
- Add sound + haptics for the slot reveal and pack opens.

## Stack

Next.js 14 (App Router) · React 18 · Tailwind (utilities available; UI is inline-styled) · `@solana/web3.js` · Phantom provider · lucide-react.

## License

You own your build. This scaffold is provided as-is with no warranty. The `$SPIN`/Solana/Phantom marks belong to their owners.
