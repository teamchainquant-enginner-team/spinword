"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Check, ChevronRight, CircleDollarSign, Clock3, Coins, History, Info, LockKeyhole, Menu, ShieldCheck, Sparkles, Trophy, UserRound, WalletCards, X } from "lucide-react";

type Currency = "LOOT_COIN" | "SPIN_COIN";
type Mode = "STANDARD" | "MAX";
type Tile = "correct" | "present" | "absent";
type View = "PLAY" | "DAILY" | "LEADERBOARDS" | "RECENT" | "TOURNAMENTS" | "REWARDS" | "PROFILE" | "FAIRNESS" | "RULES";
type Guess = { guessNumber: number; word: string; result: Tile[]; submittedAt: string };
type Round = {
  id: string; publicRef: string; mode: Mode; currency: Currency; playAmountMinor: number; status: "ACTIVE" | "SETTLED" | "VOIDED" | "EXPIRED";
  outcome: "WON" | "LOST" | null; paytableVersion: string; paytable: number[]; wordPoolVersion: string; serverSeedHash: string;
  revealedServerSeed: string | null; clientSeed: string; nonce: number; guessesUsed: number; multiplierBasisPoints: number | null;
  payoutAmountMinor: number | null; answer: string | null; verificationStatus: string; createdAt: string; settledAt: string | null; guesses: Guess[];
};
type Session = {
  player: { id: string; displayName: string; preferredMode: Mode; preferredCurrency: Currency; preferredAmountMinor: number };
  balances: Record<Currency, number>; dailyClaim: { available: boolean; nextClaimAt: string; amountMinor: number };
  activeRound: Round | null; limits: { minPlayMinor: number; maxPlayMinor: number; highValueReviewMinor: number };
  paytables: Record<Mode, { id: string; multipliers: number[] }>; sandbox: boolean;
};
type Progress = { rounds: number; scoredRounds: number; score: number; completed: boolean; canContinue: boolean; milestones: Array<{ target: number; complete: boolean }> };

const PRESETS = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 5000, 10000, 25000, 50000, 100000];
const KEY_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
const NAV: Array<[View, string]> = [["PLAY", "Play"], ["DAILY", "Daily Challenge"], ["LEADERBOARDS", "Leaderboards"], ["RECENT", "Recent Games"], ["TOURNAMENTS", "Tournaments"], ["REWARDS", "Rewards"], ["PROFILE", "Profile"], ["FAIRNESS", "Fairness"], ["RULES", "Game Rules"]];

const money = (minor: number, digits = 2) => (minor / 100).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const multiplier = (basisPoints: number | null) => basisPoints == null ? "—" : `${Number((basisPoints / 10000).toFixed(2))}x`;
const currencyLabel = (currency: Currency) => currency === "LOOT_COIN" ? "Loot Coins" : "Spin Coins";
const api = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || "Request failed");
  return body as T;
};

export default function SpinWord() {
  const [session, setSession] = useState<Session | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [view, setView] = useState<View>("PLAY");
  const [mode, setMode] = useState<Mode>("STANDARD");
  const [currency, setCurrency] = useState<Currency>("LOOT_COIN");
  const [amount, setAmount] = useState("1");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mobileNav, setMobileNav] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const bootstrap = await api<{ session: Session; progress: Progress }>("/api/game", { method: "POST", body: JSON.stringify({ action: "bootstrap" }) });
      const nextSession = bootstrap.session; const nextProgress = bootstrap.progress;
      setSession(nextSession); setProgress(nextProgress); setRound(nextSession.activeRound);
      if (nextSession.activeRound) { setMode(nextSession.activeRound.mode); setCurrency(nextSession.activeRound.currency); setAmount(String(nextSession.activeRound.playAmountMinor / 100)); }
      else { setMode(nextSession.player.preferredMode); setCurrency(nextSession.player.preferredCurrency); setAmount(String(nextSession.player.preferredAmountMinor / 100)); }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load SpinWord"); }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer); }, [refresh]);

  const amountMinor = Math.round(Number(amount || 0) * 100);
  const paytable = session?.paytables[mode].multipliers ?? (mode === "MAX" ? [1000000, 50000, 30000, 15000, 7000, 3300] : [70000, 50000, 30000, 17000, 7000, 3000]);
  const maximumReturn = Number.isFinite(amountMinor) ? Math.floor((amountMinor * paytable[0]) / 10000) : 0;
  const netMaximum = maximumReturn - amountMinor;
  const settingsLocked = round?.status === "ACTIVE";

  async function claim() {
    setBusy(true); setError("");
    try { await api("/api/game", { method: "POST", body: JSON.stringify({ action: "claim", idempotencyKey: crypto.randomUUID() }) }); await refresh(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Claim failed"); }
    finally { setBusy(false); }
  }

  async function startRound() {
    setBusy(true); setError("");
    try {
      const created = await api<Round>("/api/game", { method: "POST", body: JSON.stringify({ action: "createRound", mode, currency, amount, clientSeed: crypto.randomUUID() }) });
      setRound(created); setConfirmOpen(false); setResultOpen(false); await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Round could not start"); }
    finally { setBusy(false); }
  }

  function navigate(next: View) { setView(next); setMobileNav(false); }

  if (!session) return <div className="boot"><div className="spinner" /><Image src="/logo.png" alt="SpinWord" width={180} height={52} priority /><p>{error || "Opening the game floor…"}</p></div>;

  return (
    <div className="app-shell">
      <div className="ambient" aria-hidden="true"><span /><span /><span /></div>
      <header className="topbar">
        <button className="brand" onClick={() => navigate("PLAY")} aria-label="SpinWord home"><Image src="/logo.png" alt="SpinWord" width={168} height={48} priority /></button>
        <nav className={mobileNav ? "nav open" : "nav"} aria-label="Main navigation">
          {NAV.map(([key, label]) => <button key={key} className={view === key ? "active" : ""} onClick={() => navigate(key)}>{label}</button>)}
        </nav>
        <div className="account-strip">
          <span className="sandbox-pill">SANDBOX</span>
          <BalancePill currency="LOOT_COIN" value={session.balances.LOOT_COIN} />
          <BalancePill currency="SPIN_COIN" value={session.balances.SPIN_COIN} />
          <button className="icon-button mobile-menu" onClick={() => setMobileNav((open) => !open)} aria-label="Toggle navigation">{mobileNav ? <X /> : <Menu />}</button>
        </div>
      </header>

      <main className="page-wrap">
        {error && <div className="error-banner" role="alert"><Info size={18} /><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss"><X size={16} /></button></div>}
        {view === "PLAY" && <PlayView session={session} progress={progress} round={round} mode={mode} currency={currency} amount={amount}
          paytable={paytable} maximumReturn={maximumReturn} netMaximum={netMaximum} locked={settingsLocked} busy={busy}
          onMode={setMode} onCurrency={setCurrency} onAmount={setAmount} onClaim={claim} onConfirm={() => setConfirmOpen(true)}
          onRound={setRound} onError={setError} onResult={() => setResultOpen(true)} onNavigate={navigate} />}
        {view !== "PLAY" && <SecondaryView view={view} navigate={navigate} />}
      </main>

      <footer><span>SpinWord social casino sandbox</span><span>Loot Coins and Spin Coins are virtual credits. No cash, crypto, transfer, withdrawal, or redemption value.</span></footer>

      {confirmOpen && <ConfirmRound mode={mode} currency={currency} amountMinor={amountMinor} balance={session.balances[currency]} paytable={paytable}
        maximumReturn={maximumReturn} netMaximum={netMaximum} highValue={amountMinor >= session.limits.highValueReviewMinor}
        large={amountMinor >= 100000} busy={busy} onClose={() => setConfirmOpen(false)} onConfirm={startRound} />}
      {resultOpen && round?.status === "SETTLED" && <ResultModal round={round} onClose={() => setResultOpen(false)} onPlayAgain={() => { setRound(null); setResultOpen(false); setConfirmOpen(true); }}
        onSwitch={() => { setRound(null); setMode(round.mode === "MAX" ? "STANDARD" : "MAX"); setResultOpen(false); }} onHistory={() => { setResultOpen(false); navigate("RECENT"); }} onFairness={() => { setResultOpen(false); navigate("FAIRNESS"); }} />}
    </div>
  );
}

function BalancePill({ currency, value }: { currency: Currency; value: number }) {
  return <div className={`balance ${currency === "LOOT_COIN" ? "loot" : "spin"}`}><Coins size={15} /><div><small>{currencyLabel(currency)}</small><strong>{money(value, 0)}</strong></div></div>;
}

function PlayView(props: {
  session: Session; progress: Progress | null; round: Round | null; mode: Mode; currency: Currency; amount: string; paytable: number[];
  maximumReturn: number; netMaximum: number; locked: boolean; busy: boolean; onMode: (mode: Mode) => void; onCurrency: (currency: Currency) => void;
  onAmount: (value: string) => void; onClaim: () => void; onConfirm: () => void; onRound: (round: Round) => void; onError: (error: string) => void;
  onResult: () => void; onNavigate: (view: View) => void;
}) {
  const { session, progress, round, mode, currency, amount, paytable, maximumReturn, netMaximum, locked } = props;
  return <>
    <div className="live-marquee"><span>LIVE</span><b>WORD JACKPOT</b><i>★</i><b>{mode === "MAX" ? "100X MAX MODE" : "7X CLASSIC MODE"}</b><i>★</i><b>SIX SPINS TO HIT</b></div>
    <section className="hero casino-hero">
      <div><span className="eyebrow"><Sparkles size={14} /> FRESH WORDS · VERIFIABLE SELECTION</span><h1>Pick your risk. <em>Spin the word.</em></h1><p>Unlimited independent rounds, six guesses each. Every outcome is locked on the server before your first letter.</p></div>
      <div className="today-progress"><div className="progress-head"><div><small>TODAY&apos;S RUN</small><strong>{progress?.rounds ?? 0} / 10</strong></div><Trophy /></div><div className="progress-track"><span style={{ width: `${Math.min((progress?.rounds ?? 0) * 10, 100)}%` }} /></div><p>{progress?.completed ? "Daily Ten complete — gameplay stays open." : `First 10 eligible settled rounds score. ${Math.max(10 - (progress?.rounds ?? 0), 0)} to go.`}</p></div>
    </section>

    <section className="game-grid casino-layout">
      <aside className="side-stack casino-rail">
        <DailyClaimCard claim={session.dailyClaim} busy={props.busy} onClaim={props.onClaim} />
        <div className="panel compact"><div className="panel-title"><Clock3 /> TODAY</div>{["Claim 1,000,000 Loot Coins", "Complete Daily Challenge", "Play 3 rounds", "Play 5 rounds", "Play 7 rounds", "Complete Daily Ten"].map((item, index) => <div className="check-row" key={item}><span className={(index === 0 && !session.dailyClaim.available) || (index > 1 && (progress?.rounds ?? 0) >= [0, 0, 3, 5, 7, 10][index]) ? "done" : ""}>{(index === 0 && !session.dailyClaim.available) || (index > 1 && (progress?.rounds ?? 0) >= [0, 0, 3, 5, 7, 10][index]) ? <Check size={13} /> : "○"}</span>{item}</div>)}</div>
        <button className="panel promo-card" onClick={() => props.onNavigate("DAILY")}><span className="eyebrow">FREE DAILY CHALLENGE</span><strong>One word. Same puzzle for everyone.</strong><span>Included for all players — no Spin Coin purchase required. <ChevronRight size={15} /></span></button>
      </aside>

      <section className="center-stack slot-cabinet">
        <div className="cabinet-crown"><div className="bulb-row" aria-hidden="true">{Array.from({ length: 15 }, (_, index) => <span key={index} />)}</div><small>CASINO WORD REELS</small><strong>SPIN<span>WORD</span></strong><p>{mode === "MAX" ? "★ MEGA 100X JACKPOT ★" : "★ CLASSIC 7X JACKPOT ★"}</p></div>
        <div className="panel configurator machine-controls">
          <div className="lock-line"><div><span className="step">1</span><strong>Choose currency</strong></div>{locked && <span><LockKeyhole size={14} /> Locked for round {round?.publicRef}</span>}</div>
          <div className="choice-grid currency-grid">
            <ChoiceCard selected={currency === "LOOT_COIN"} disabled={locked} onClick={() => props.onCurrency("LOOT_COIN")} icon={<Sparkles />} title="Loot Coins" badge="FREE" lines={["Free social play", "No purchase necessary", "No cash or crypto value"]} />
            <ChoiceCard selected={currency === "SPIN_COIN"} disabled={locked} onClick={() => props.onCurrency("SPIN_COIN")} icon={<CircleDollarSign />} title="Spin Coins" badge="PURCHASED" lines={["Purchased virtual credits", "Nonredeemable", "Kept in a separate ledger"]} />
          </div>
          <div className="section-divider" />
          <div className="lock-line"><div><span className="step">2</span><strong>Choose mode</strong></div><span>Multipliers are total returns, including the original play amount.</span></div>
          <div className="choice-grid">
            <ChoiceCard selected={mode === "STANDARD"} disabled={locked} onClick={() => props.onMode("STANDARD")} icon={<ShieldCheck />} title="Standard Mode" badge="MAX 7x" lines={["Higher late-round returns", "Balanced volatility", "Guess 6 returns 0.3x"]} />
            <ChoiceCard selected={mode === "MAX"} disabled={locked} onClick={() => props.onMode("MAX")} icon={<Sparkles />} title="Max Mode" badge="MAX 100x" lines={["100x on the first guess", "Higher volatility", "Lower late-round returns"]} accent />
          </div>
          <div className="section-divider" />
          <div className="lock-line"><div><span className="step">3</span><strong>Choose play amount</strong></div><span>Available: {money(session.balances[currency], 0)} {currencyLabel(currency)}</span></div>
          <div className="amount-row"><label><span>Virtual-credit play</span><div><b>$</b><input aria-label="Play amount" value={amount} disabled={locked} inputMode="decimal" onChange={(event) => props.onAmount(event.target.value)} /></div></label><div className="max-return"><small>MAXIMUM POSSIBLE TOTAL RETURN</small><strong>{money(maximumReturn, 0)}</strong><span>+{money(netMaximum, 0)} maximum net · virtual credits</span></div></div>
          <div className="presets">{PRESETS.map((preset) => <button key={preset} disabled={locked} className={Number(amount) === preset ? "selected" : ""} onClick={() => props.onAmount(String(preset))}>${preset.toLocaleString()}</button>)}</div>
          {!round || round.status !== "ACTIVE" ? <button className="primary-action" disabled={props.busy} onClick={props.onConfirm}><LockKeyhole size={18} /> Review & confirm round</button> : <div className="active-notice"><span className="live-dot" /><div><strong>Round {round.publicRef} is active</strong><small>{currencyLabel(round.currency)} · {round.mode} · {money(round.playAmountMinor)} play · {6 - round.guessesUsed} guesses left</small></div></div>}
        </div>

        <div className="slot-machine-shell"><GameBoard round={round} busy={props.busy} onRound={props.onRound} onError={props.onError} onResult={props.onResult} /></div>
      </section>

      <aside className="side-stack casino-rail">
        <Paytable mode={mode} values={paytable} />
        <div className="panel compact"><div className="panel-title"><ShieldCheck /> ROUND GUARANTEES</div>{["Mode, currency & amount locked", "Versioned server paytable", "Fresh nonce and commitment", "Answer hidden until settlement", "Exactly-once ledger return"].map((line) => <div className="guarantee" key={line}><Check size={14} />{line}</div>)}<button className="text-button" onClick={() => props.onNavigate("FAIRNESS")}>How verification works <ChevronRight size={14} /></button></div>
        <div className="panel compact purchase-card"><div className="panel-title"><WalletCards /> BUY SPIN COINS</div><strong>Minimum purchase: $10</strong><p>Crypto purchasing is sandboxed and disabled until an approved provider and credentials are configured.</p><button disabled>Purchases currently disabled</button></div>
      </aside>
    </section>
  </>;
}

function ChoiceCard({ selected, disabled, onClick, icon, title, badge, lines, accent }: { selected: boolean; disabled: boolean; onClick: () => void; icon: React.ReactNode; title: string; badge: string; lines: string[]; accent?: boolean }) {
  return <button className={`choice-card ${selected ? "selected" : ""} ${accent ? "accent" : ""}`} disabled={disabled} onClick={onClick} aria-pressed={selected}><span className="choice-icon">{icon}</span><span className="choice-copy"><b>{title}</b>{lines.map((line) => <small key={line}>{line}</small>)}</span><span className="choice-badge">{badge}</span>{selected && <span className="selected-check"><Check size={12} /></span>}</button>;
}

function DailyClaimCard({ claim, busy, onClaim }: { claim: Session["dailyClaim"]; busy: boolean; onClaim: () => void }) {
  const [remaining, setRemaining] = useState("");
  useEffect(() => {
    const tick = () => { const seconds = Math.max(0, Math.floor((new Date(claim.nextClaimAt).getTime() - Date.now()) / 1000)); setRemaining(`${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`); };
    tick(); const timer = window.setInterval(tick, 1000); return () => window.clearInterval(timer);
  }, [claim.nextClaimAt]);
  return <div className="panel claim-card"><span className="eyebrow">DAILY LOOT COINS</span><Coins className="claim-coin" /><strong>{claim.available ? "Claim 1,000,000" : "Daily reward claimed"}</strong><p>{claim.available ? "Free social-play coins · No purchase necessary · No cash or crypto value" : "Next claim available in:"}</p>{claim.available ? <button onClick={onClaim} disabled={busy}>{busy ? "Claiming…" : "Claim free Loot Coins"}</button> : <div className="countdown">{remaining}</div>}</div>;
}

function Paytable({ mode, values }: { mode: Mode; values: number[] }) {
  return <div className="panel paytable"><div className="panel-title"><BarChart3 /> {mode === "MAX" ? "MAX MODE" : "STANDARD MODE"} PAYTABLE</div><p>Total returns include the original play amount.</p>{values.map((value, index) => <div className={index === 0 ? "pay-row top" : "pay-row"} key={index}><span>Correct on guess {index + 1}</span><strong>{multiplier(value)}</strong></div>)}<div className="pay-row"><span>Failure</span><strong>0x</strong></div><small>Paytable {mode === "MAX" ? "MAX_V1" : "STANDARD_V1"} · Server authoritative</small></div>;
}

function GameBoard({ round, busy, onRound, onError, onResult }: { round: Round | null; busy: boolean; onRound: (round: Round) => void; onError: (error: string) => void; onResult: () => void }) {
  const [current, setCurrent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const active = round?.status === "ACTIVE";
  const keyState = useMemo(() => {
    const rank = { absent: 0, present: 1, correct: 2 }; const state: Record<string, Tile> = {};
    round?.guesses.forEach((guess) => guess.word.split("").forEach((letter, index) => { const next = guess.result[index]; if (!state[letter] || rank[next] > rank[state[letter]]) state[letter] = next; })); return state;
  }, [round?.guesses]);
  const submit = useCallback(async () => {
    if (!round || !active || current.length !== 5) { if (active) onError("Enter a five-letter word."); return; }
    setSubmitting(true); onError("");
    try { const updated = await api<Round>("/api/game", { method: "POST", body: JSON.stringify({ action: "guess", roundId: round.id, guess: current }) }); setCurrent(""); onRound(updated); if (updated.status === "SETTLED") onResult(); }
    catch (caught) { onError(caught instanceof Error ? caught.message : "Guess failed"); }
    finally { setSubmitting(false); }
  }, [active, current, onError, onResult, onRound, round]);
  const press = useCallback((key: string) => {
    if (!active || submitting) return;
    if (key === "BACKSPACE") setCurrent((value) => value.slice(0, -1));
    else if (key === "ENTER") void submit();
    else if (/^[A-Z]$/.test(key)) setCurrent((value) => value.length < 5 ? `${value}${key}` : value);
  }, [active, submit, submitting]);
  useEffect(() => { const handler = (event: KeyboardEvent) => { const key = event.key.toUpperCase(); if (/^[A-Z]$/.test(key) || key === "ENTER" || key === "BACKSPACE") press(key); }; window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler); }, [press]);
  const rows = Array.from({ length: 6 }, (_, rowIndex) => {
    const submitted = round?.guesses[rowIndex]; const letters = submitted?.word.split("") ?? (rowIndex === (round?.guesses.length ?? 0) && active ? current.padEnd(5, " ").split("") : Array(5).fill(" "));
    return <div className="board-row" key={rowIndex}>{letters.map((letter, index) => <div key={index} className={`tile ${submitted?.result[index] ?? ""} ${letter.trim() ? "filled" : ""}`}>{letter}</div>)}</div>;
  });
  return <div className="panel game-board"><div className="board-head"><div><span className="eyebrow">{active ? "ACTIVE ROUND" : round?.status === "SETTLED" ? "ROUND SETTLED" : "READY WHEN YOU ARE"}</span><strong>{round ? `#${round.publicRef}` : "Confirm settings to receive a fresh word"}</strong></div>{round && <span className="commit"><LockKeyhole size={13} /> {round.serverSeedHash.slice(0, 12)}…</span>}</div><div className="tiles">{rows}</div><div className="keyboard">{KEY_ROWS.map((row, index) => <div className="key-row" key={row}>{index === 2 && <button disabled={!active || busy} onClick={() => press("ENTER")} className="wide">ENTER</button>}{row.split("").map((key) => <button key={key} disabled={!active || busy} onClick={() => press(key)} className={keyState[key] ?? ""}>{key}</button>)}{index === 2 && <button disabled={!active || busy} onClick={() => press("BACKSPACE")} className="wide">⌫</button>}</div>)}</div>{round?.status === "SETTLED" && <button className="primary-action" onClick={onResult}>Review result</button>} {!round && <div className="board-overlay"><LockKeyhole /><strong>The answer is selected only after confirmation</strong><span>No answer list or payout authority is shipped to this browser.</span></div>}{submitting && <div className="submitting">Checking guess…</div>}</div>;
}

function ConfirmRound({ mode, currency, amountMinor, balance, paytable, maximumReturn, netMaximum, large, highValue, busy, onClose, onConfirm }: { mode: Mode; currency: Currency; amountMinor: number; balance: number; paytable: number[]; maximumReturn: number; netMaximum: number; large: boolean; highValue: boolean; busy: boolean; onClose: () => void; onConfirm: () => void }) {
  const [checked, setChecked] = useState(false); const needsCheck = large || highValue;
  return <Modal onClose={onClose}><div className="modal-heading"><div><span className="eyebrow">ROUND CONFIRMATION</span><h2>Review every locked setting</h2></div><button className="icon-button" onClick={onClose}><X /></button></div><div className="review-grid"><Review label="Currency" value={currencyLabel(currency)} /><Review label="Mode" value={`${mode === "MAX" ? "Max" : "Standard"} Mode`} /><Review label="Play amount" value={`${money(amountMinor)} virtual credits`} /><Review label="Current balance" value={money(balance)} /><Review label="Balance after debit" value={money(balance - amountMinor)} /><Review label="Maximum total return" value={money(maximumReturn)} accent /><Review label="Maximum net result" value={`+${money(netMaximum)}`} accent /></div>{highValue && <div className="warning"><ShieldCheck /><div><strong>High-value confirmation</strong><span>This play may require additional account verification and server risk approval.</span></div></div>}<Paytable mode={mode} values={paytable} />{needsCheck && <label className="confirmation-check"><input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} /><span>I understand the selected play amount and maximum possible result.</span></label>}<p className="fine-print">All amounts are nonredeemable virtual-credit equivalents. Multipliers are total returns including the original play amount.</p><div className="modal-actions"><button className="secondary" onClick={onClose}>Go back</button><button className="primary" disabled={busy || (needsCheck && !checked) || amountMinor < 100 || amountMinor > 10000000 || amountMinor > balance} onClick={onConfirm}>{busy ? "Starting securely…" : "Confirm & start round"}</button></div></Modal>;
}

function Review({ label, value, accent }: { label: string; value: string; accent?: boolean }) { return <div className={accent ? "review accent" : "review"}><small>{label}</small><strong>{value}</strong></div>; }

function ResultModal({ round, onClose, onPlayAgain, onSwitch, onHistory, onFairness }: { round: Round; onClose: () => void; onPlayAgain: () => void; onSwitch: () => void; onHistory: () => void; onFairness: () => void }) {
  const net = (round.payoutAmountMinor ?? 0) - round.playAmountMinor; const won = round.outcome === "WON";
  return <Modal onClose={onClose}><div className={`result-hero ${won ? "won" : "lost"}`}><span className="eyebrow">VERIFIABLE ROUND · {round.publicRef}</span><Sparkles /><h2>{won ? (round.multiplierBasisPoints === 1000000 ? "100x HIT" : "Word solved") : "Round complete"}</h2><div className="answer">{round.answer}</div><p>{won ? `Solved in ${round.guessesUsed} ${round.guessesUsed === 1 ? "guess" : "guesses"}` : "Six valid guesses used"}</p></div><div className="result-numbers"><Review label="Play" value={`${money(round.playAmountMinor)} ${currencyLabel(round.currency)}`} /><Review label="Multiplier" value={multiplier(round.multiplierBasisPoints)} /><Review label="Total return" value={money(round.payoutAmountMinor ?? 0)} accent /><Review label="Net result" value={`${net >= 0 ? "+" : ""}${money(net)}`} accent={net > 0} /></div><div className="seed-line"><ShieldCheck /><div><small>Server seed revealed</small><code>{round.revealedServerSeed}</code></div></div><div className="result-actions"><button className="primary" onClick={onPlayAgain}>Play again with same settings</button><button onClick={onSwitch}>Switch mode</button><button onClick={onFairness}>View verification</button><button onClick={onHistory}>Recent games</button></div></Modal>;
}

function SecondaryView({ view, navigate }: { view: View; navigate: (view: View) => void }) {
  if (view === "RECENT") return <RecentGames />;
  if (view === "LEADERBOARDS") return <Leaderboards />;
  if (view === "PROFILE") return <Profile />;
  if (view === "FAIRNESS") return <Fairness />;
  if (view === "RULES") return <Rules />;
  const content: Record<string, { eyebrow: string; title: string; copy: string; items: string[] }> = {
    DAILY: { eyebrow: "FREE DAILY CHALLENGE", title: "One shared word, once per UTC day", copy: "The Daily Challenge is separated from play balances and remains available without a Spin Coin purchase.", items: ["Same server-controlled answer for every eligible player", "One completion per account per day", "Share card hides the answer until expiry", "Daily streak and nonredeemable progression rewards"] },
    TOURNAMENTS: { eyebrow: "TOURNAMENTS", title: "Published rules. Fixed windows. Finalized standings.", copy: "Tournament infrastructure is configured server-side with immutable rules and prize-allocation records.", items: ["Daily Ten skill events", "Fewest-average-guesses events", "Max Mode achievement events", "Fraud review before standings finalize"] },
    REWARDS: { eyebrow: "MISSIONS & REWARDS", title: "Progress without changing your odds", copy: "XP, badges, themes, profile frames, and tournament tickets reward participation while every player keeps the same published ruleset.", items: ["First Round and First Win", "Daily Ten and Seven-Day Streak", "First Max Mode Win and First 100x", "Cosmetic keyboards, boards, avatars, and result cards"] },
  };
  const data = content[view];
  return <section className="secondary-page"><span className="eyebrow">{data.eyebrow}</span><h1>{data.title}</h1><p>{data.copy}</p><div className="feature-cards">{data.items.map((item, index) => <div className="panel" key={item}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item}</strong><p>Server-controlled, audited, and nonredeemable at launch.</p></div>)}</div><button className="primary" onClick={() => navigate("PLAY")}>Return to play</button></section>;
}

function RecentGames() {
  const [data, setData] = useState<{ rounds: Round[]; total: number } | null>(null); const [mode, setMode] = useState(""); const [currency, setCurrency] = useState(""); const [outcome, setOutcome] = useState(""); const [selected, setSelected] = useState<Round | null>(null);
  useEffect(() => { void api<{ rounds: Round[]; total: number }>(`/api/rounds?limit=50&mode=${mode}&currency=${currency}&outcome=${outcome}`).then(setData); }, [mode, currency, outcome]);
  return <section className="secondary-page wide"><span className="eyebrow">COMPLETE PLAY HISTORY</span><h1>Recent Games</h1><p>Only rounds for the authenticated account appear here. Open any settled round to review guesses and verification data.</p><div className="filters"><select aria-label="Mode filter" value={mode} onChange={(event) => setMode(event.target.value)}><option value="">All modes</option><option value="STANDARD">Standard Mode</option><option value="MAX">Max Mode</option></select><select aria-label="Currency filter" value={currency} onChange={(event) => setCurrency(event.target.value)}><option value="">All currencies</option><option value="LOOT_COIN">Loot Coins</option><option value="SPIN_COIN">Spin Coins</option></select><select aria-label="Outcome filter" value={outcome} onChange={(event) => setOutcome(event.target.value)}><option value="">Wins & losses</option><option value="WON">Wins</option><option value="LOST">Losses</option></select><span>{data?.total ?? 0} rounds</span></div><div className="history-list">{data?.rounds.length ? data.rounds.map((round) => <button className="history-card" key={round.id} onClick={() => setSelected(round)}><div><small>{new Date(round.createdAt).toLocaleString()}</small><strong>{round.mode === "MAX" ? "Max Mode" : "Standard Mode"} · {currencyLabel(round.currency)}</strong><span>#{round.publicRef} · {round.status}</span></div><div><strong>{money(round.playAmountMinor)} play</strong><span>{round.outcome === "WON" ? `Solved in ${round.guessesUsed}` : round.outcome ?? "Active"}</span></div><div className={(round.payoutAmountMinor ?? 0) - round.playAmountMinor >= 0 ? "positive" : "negative"}><strong>{multiplier(round.multiplierBasisPoints)}</strong><span>{money(round.payoutAmountMinor ?? 0)} returned</span></div><ShieldCheck /></button>) : <Empty icon={<History />} title="No matching games" copy="Settle a round or change the filters." />}</div>{selected && <RoundReview round={selected} onClose={() => setSelected(null)} />}</section>;
}

function RoundReview({ round, onClose }: { round: Round; onClose: () => void }) {
  return <Modal onClose={onClose}><div className="modal-heading"><div><span className="eyebrow">ROUND #{round.publicRef}</span><h2>{round.mode} · {currencyLabel(round.currency)}</h2></div><button className="icon-button" onClick={onClose}><X /></button></div><div className="mini-board">{round.guesses.map((guess) => <div className="board-row" key={guess.guessNumber}>{guess.word.split("").map((letter, index) => <span className={`tile ${guess.result[index]}`} key={index}>{letter}</span>)}</div>)}</div><div className="review-grid"><Review label="Answer" value={round.answer ?? "Hidden while active"} /><Review label="Play" value={money(round.playAmountMinor)} /><Review label="Multiplier" value={multiplier(round.multiplierBasisPoints)} /><Review label="Return" value={money(round.payoutAmountMinor ?? 0)} /><Review label="Pool" value={round.wordPoolVersion} /><Review label="Paytable" value={round.paytableVersion} /></div><div className="seed-line"><ShieldCheck /><div><small>Commitment</small><code>{round.serverSeedHash}</code><small>Revealed seed</small><code>{round.revealedServerSeed ?? "Revealed after settlement"}</code><small>Client seed · Nonce {round.nonce}</small><code>{round.clientSeed}</code></div></div></Modal>;
}

function Leaderboards() {
  const [period, setPeriod] = useState("DAILY"); const [mode, setMode] = useState(""); const [currency, setCurrency] = useState(""); const [entries, setEntries] = useState<Array<Record<string, string | number>>>([]);
  useEffect(() => { void api<{ entries: Array<Record<string, string | number>> }>(`/api/leaderboards?period=${period}&mode=${mode}&currency=${currency}`).then((data) => setEntries(data.entries)); }, [period, mode, currency]);
  return <section className="secondary-page wide"><span className="eyebrow">SKILL & PARTICIPATION RANKINGS</span><h1>Leaderboards</h1><p>Only genuine settled, eligible rounds count. Ties resolve by multiplier, guesses, wins, settlement time, then player ID.</p><div className="filters"><select aria-label="Period filter" value={period} onChange={(event) => setPeriod(event.target.value)}><option>DAILY</option><option>WEEKLY</option><option>MONTHLY</option><option>ALL_TIME</option></select><select aria-label="Leaderboard mode" value={mode} onChange={(event) => setMode(event.target.value)}><option value="">All modes</option><option value="STANDARD">Standard</option><option value="MAX">Max</option></select><select aria-label="Leaderboard currency" value={currency} onChange={(event) => setCurrency(event.target.value)}><option value="">All currencies</option><option value="LOOT_COIN">Loot Coins</option><option value="SPIN_COIN">Spin Coins</option></select></div><div className="leader-list">{entries.length ? entries.map((entry) => <div className="leader-card" key={`${entry.player_id}-${entry.mode}-${entry.currency}`}><span className="rank">#{entry.rank}</span><div><strong>{entry.identity}</strong><small>{entry.mode} · {entry.currency === "LOOT_COIN" ? "Loot Coins" : "Spin Coins"}</small></div><div><strong>{multiplier(Number(entry.best_multiplier_basis_points))}</strong><small>best multiplier</small></div><div><strong>{entry.wins}</strong><small>verified wins</small></div></div>) : <Empty icon={<Trophy />} title="No eligible rankings yet" copy="The board never inserts generated players or fabricated wins." />}</div></section>;
}

function Profile() {
  const [stats, setStats] = useState<{ overall: Record<string, number>; modes: Array<Record<string, number | string>> } | null>(null); useEffect(() => { void api<typeof stats>("/api/player/statistics").then(setStats); }, []);
  const overall = stats?.overall ?? {}; return <section className="secondary-page wide"><span className="eyebrow">PLAYER PERFORMANCE</span><h1>Sandbox Player</h1><p>Mode and currency statistics remain separate so free and purchased virtual-credit play are never misrepresented.</p><div className="stat-grid"><Stat label="Total rounds" value={overall.total_rounds ?? 0} /><Stat label="Successful rounds" value={overall.successful_rounds ?? 0} /><Stat label="Average guesses" value={overall.total_rounds ? (overall.total_guesses / overall.total_rounds).toFixed(2) : "—"} /><Stat label="Best multiplier" value={multiplier(overall.best_multiplier_basis_points ?? 0)} /><Stat label="Current streak" value={overall.current_streak ?? 0} /><Stat label="Longest streak" value={overall.longest_streak ?? 0} /><Stat label="XP" value={overall.xp ?? 0} /><Stat label="Level" value={overall.level ?? 1} /></div><h2>Mode statistics</h2><div className="mode-stats">{stats?.modes.length ? stats.modes.map((row) => <div className="panel" key={`${row.mode}-${row.currency}`}><span className="eyebrow">{row.mode} · {row.currency}</span><strong>{row.rounds} rounds · {row.wins} wins</strong><p>{money(Number(row.played_minor))} played · {money(Number(row.returned_minor))} returned · {row.wins_100x} verified 100x results</p></div>) : <Empty icon={<UserRound />} title="No statistics yet" copy="Settle a round to begin your profile." />}</div></section>;
}

function Fairness() { return <section className="secondary-page"><span className="eyebrow">VERIFIABLE ROUND SELECTION</span><h1>Committed before you play. Revealed after settlement.</h1><p>SpinWord does not claim external certification. The implementation provides a reproducible technical verification foundation.</p><div className="timeline">{[["01", "Generate", "The server creates a cryptographically secure random seed."], ["02", "Commit", "SHA-256 of the server seed is shown before the first guess."], ["03", "Select", "HMAC-SHA256 combines server seed, client seed, nonce, and immutable pool version."], ["04", "Bound fairly", "Rejection sampling maps the digest to a pool index without modulo bias."], ["05", "Reveal", "After settlement the answer and server seed become visible for recomputation."]].map(([number, title, copy]) => <div key={number}><span>{number}</span><div><strong>{title}</strong><p>{copy}</p></div></div>)}</div><div className="panel disclosure"><Info /><p>The bundled development pool is intentionally small and labeled DEVELOPMENT. Publishing a production pool requires exactly 2,048 reviewed words and a saved simulation report. No RTP or house-edge claim is displayed until that work is complete.</p></div></section>; }

function Rules() { const standard = [70000, 50000, 30000, 17000, 7000, 3000]; const max = [1000000, 50000, 30000, 15000, 7000, 3300]; return <section className="secondary-page wide"><span className="eyebrow">GAME RULES</span><h1>Clear before confirmation. Locked during play.</h1><p>Choose a currency, mode, and $1–$100,000 virtual-credit amount. The server revalidates balance and risk limits, then selects one five-letter answer. Submit up to six accepted five-letter guesses.</p><div className="rule-grid"><Paytable mode="STANDARD" values={standard} /><Paytable mode="MAX" values={max} /></div><div className="panel disclosure"><Info /><p>Loot Coins are free, unpurchased, nontransferable, and have no cash or crypto value. Spin Coins are purchased, nontransferable, nonwithdrawable, and nonredeemable. Neither is an investment or cryptocurrency. Autoplay is not offered.</p></div></section>; }

function Stat({ label, value }: { label: string; value: string | number }) { return <div className="stat"><small>{label}</small><strong>{value}</strong></div>; }
function Empty({ icon, title, copy }: { icon: React.ReactNode; title: string; copy: string }) { return <div className="empty">{icon}<strong>{title}</strong><p>{copy}</p></div>; }
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) { return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="modal" role="dialog" aria-modal="true">{children}</section></div>; }
