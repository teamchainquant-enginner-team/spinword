# SpinWord verification report

Date: 2026-07-14 (America/New_York) / 2026-07-15 UTC

## Automated results

| Check | Result | Coverage |
|---|---:|---|
| Strict TypeScript | Pass | Application, route handlers, domain, scripts, tests |
| ESLint | Pass, zero warnings | Next.js core web vitals and TypeScript rules |
| Unit/integration | 19/19 pass | 4 files |
| Desktop E2E | Pass | Claim, Max selection, confirmation, lock, server cleanup |
| Mobile E2E | Pass | Same flow at Pixel 7 profile |
| Production build | Pass | Next.js 16.2.10 webpack production build |
| Dependency audit | Pass | `npm audit`: 0 vulnerabilities |
| RTP simulator | Pass | 1,000,000 development rounds, JSON and CSV output |

## Tested financial/game invariants

- integer-minor-unit parsing rejects malformed precision and handles exact $1 / $100,000 boundaries;
- $100,000 Standard and Max maximum total returns calculate to $700,000 and $10,000,000 virtual-credit equivalents;
- daily Loot Coin claim creates one grant and one ledger entry despite retries;
- Loot and Spin balances remain separate;
- active rounds prevent mode/currency/amount changes and second-round creation;
- server commitments are deterministic to verify and reveal only after settlement;
- first-guess Max settlement returns exactly 100x once, including retry behavior;
- private history is player-scoped and public identities are masked;
- unsettled rounds never enter public wins or rankings;
- exposure limits reject an otherwise valid round;
- Daily Ten scores only the first ten qualifying rounds while round eleven remains playable;
- $10 sandbox purchase credit is idempotent; subminimum and expired quotes do not credit.

## Visual/manual browser checks

- original and upgraded application inspected in the in-app browser;
- desktop navigation, daily claim, Max paytable, confirmation, balance debit, server commitment, active-round lock, and console verified;
- 390 × 844 mobile viewport verified for reachable mode controls, readable cards, primary board flow, and no console warnings/errors.

## Simulation result caveat

The 1,000,000-round report uses the intentionally tiny 32-word development pool. It demonstrates tooling only and produces an unrealistically player-favorable result. The UI does not display its RTP. No RTP or house-edge claim is approved until a reviewed 2,048-word pool, accepted dictionary, and strongest solver suite are supplied and tested.

## External-infrastructure tests not represented as complete

Production email authentication, provider blockchain confirmations, SMTP/push delivery, distributed rate limiting, PostgreSQL row locks, scheduled workers, backups/restores, and load tests require operator infrastructure and credentials. Their boundaries and production checklist are documented in `README.md`; purchases stay disabled.
