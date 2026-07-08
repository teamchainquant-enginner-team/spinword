# COMPLIANCE.md — read this before enabling real-money entries

This is not legal advice. It's an engineer's summary of why on-chain staking ships **off**, and what has to be true before it can turn on. Get a licensed gaming/crypto lawyer in your target markets before touching any of this.

## What the MVP does (and why it's safe to ship)

- Entries and payouts use an **off-chain $SPIN points ledger**. Points are earned, not bought, and can't be cashed out.
- Phantom connect is **identity + read-only balance display**. The app never takes custody of funds and never settles a game outcome on-chain.
- Result: it's a **word game with a token-flavored economy**, not a gambling operation.

## Why the real-money version is regulated

If a user stakes something of value on an uncertain outcome to win a multiplied amount of value, that's a **wager**. Your payout table (`10× / 7× / 5.5× / 3.5× / 1.5× / 0.7×` by row solved) is a betting odds table, and the "win other people's SOL" pot is a **pooled prize pool**. Depending on jurisdiction this is treated as gambling, a lottery, or a prediction market — all licensed activities.

Operating unlicensed can mean seized funds, personal liability for the operator, and criminal exposure. Crypto doesn't exempt you; it adds AML obligations on top.

## The gate — everything below must be real before `REAL_MONEY_ENABLED=true`

1. **Licensing** in every market you serve, or hard geoblocking of everywhere you're not licensed.
2. **KYC / AML** — identity verification, sanctions screening, transaction monitoring, source-of-funds.
3. **Age-gating** (18/21+ depending on market) with real verification, not a checkbox.
4. **Geofencing** — IP + wallet heuristics to block prohibited regions (many US states, and entire countries).
5. **Audited smart contracts** — the escrow/pool/payout program independently audited; provably-fair or verifiable RNG for the daily word so users can't claim the house cheats, and you can't be accused of it.
6. **Responsible-gaming tooling** — deposit/loss limits, self-exclusion, cool-off periods, visible odds and house edge.
7. **Honest payout math** — see below. Marketing a 0.7× outcome as a "win" is deceptive-practices territory even before gambling law.
8. **Segregated funds & solvency** — user funds can't be commingled with treasury; the pool must always be able to pay out.

## The math problem you should fix regardless

With `R6 = 0.7×`, a player who **solves the word on the last row still loses 30% of their stake**, and any miss loses 100%. Because harder words push solves into later rows, expected value skews sharply negative and you're labeling a net loss a "win." That's how a project gets ratioed by its own community and flagged by regulators. Options: cap the loss at break-even (`≥1.0×` on any solve), publish the exact house edge, or reframe entries as a skill tournament with a transparent rake.

## Architecture (high level, when/if you go licensed)

Escrow program holds staked $SPIN in a per-round PDA → a **server-authoritative** result oracle (never the client) submits the solved-row for each entry → program pays `stake × ROW_MULT` from the round pool, rake to treasury, remainder rolls to jackpot. Every step audited, geofenced at the app layer, KYC-gated at deposit. This repo deliberately does **not** include that program.
